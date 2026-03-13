// Summarize skill — self-contained code tool
// Extracts content from URLs / YouTube / local files and summarizes via LLM API

const MAX_CONTENT_CHARS = 100_000;
const MAX_RESPONSE_CHARS = 50_000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Well-known credential keys for provider API keys
const PROVIDER_API_KEYS = {
  anthropic: "provider.anthropic.apiKey",
  openai: "provider.openai.apiKey",
  gemini: "provider.gemini.apiKey",
  openrouter: "provider.openrouter.apiKey",
};

const DEFAULT_MODELS = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
  openrouter: "openrouter/auto",
};

// ─── LLM provider calls ───

async function callAnthropic(apiKey, model, systemPrompt, userContent, maxTokens) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

async function callOpenAI(apiKey, model, systemPrompt, userContent, maxTokens) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(apiKey, model, systemPrompt, userContent, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callOpenRouter(apiKey, model, systemPrompt, userContent, maxTokens) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

const PROVIDER_CALLERS = { anthropic: callAnthropic, openai: callOpenAI, gemini: callGemini, openrouter: callOpenRouter };

async function generateSummary(credentialStore, skillName, systemPrompt, userContent, maxTokens) {
  // Read skill-specific model preference (format: "provider:model_id")
  const prefModelRaw = await credentialStore.get(`skill.${skillName}.llm_model`);

  if (prefModelRaw && prefModelRaw.includes(":")) {
    const [prefProvider, ...rest] = prefModelRaw.split(":");
    const prefModel = rest.join(":");
    if (PROVIDER_CALLERS[prefProvider]) {
      const apiKey = await credentialStore.get(PROVIDER_API_KEYS[prefProvider]);
      if (!apiKey) {
        throw new Error(`API key for provider "${prefProvider}" not configured.`);
      }
      return PROVIDER_CALLERS[prefProvider](apiKey, prefModel, systemPrompt, userContent, maxTokens);
    }
  }

  // Auto-detect: try each provider in order of cost-effectiveness
  const order = ["gemini", "openai", "anthropic", "openrouter"];
  for (const pid of order) {
    const apiKey = await credentialStore.get(PROVIDER_API_KEYS[pid]);
    if (apiKey) {
      return PROVIDER_CALLERS[pid](apiKey, DEFAULT_MODELS[pid], systemPrompt, userContent, maxTokens);
    }
  }

  throw new Error("No LLM provider API key found. Configure at least one provider in Settings.");
}

// ─── YouTube transcript extraction ───

function isYouTubeUrl(url) {
  try {
    const parsed = new URL(url);
    return ["www.youtube.com", "youtube.com", "youtu.be", "m.youtube.com"].includes(parsed.hostname);
  } catch { return false; }
}

function extractVideoId(url) {
  const parsed = new URL(url);
  if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1);
  return parsed.searchParams.get("v");
}

async function fetchYouTubeTranscript(url) {
  const videoId = extractVideoId(url);
  if (!videoId) return { error: "Could not extract YouTube video ID." };

  // Use YouTube's innertube API with the IOS client — this reliably returns
  // caption track URLs that work from server-side (unlike the WEB client which
  // returns UNPLAYABLE or caption URLs that serve empty responses).
  const IOS_UA = "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X)";
  const API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

  const playerRes = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": IOS_UA,
      Origin: "https://www.youtube.com",
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "IOS",
          clientVersion: "19.45.4",
          deviceMake: "Apple",
          deviceModel: "iPhone16,2",
          hl: "en",
          gl: "US",
        },
      },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!playerRes.ok) {
    return { error: `YouTube API returned ${playerRes.status}.` };
  }

  const player = await playerRes.json();

  if (player?.playabilityStatus?.status !== "OK") {
    return { error: `Video is not available (${player?.playabilityStatus?.status ?? "unknown"}).` };
  }

  const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) {
    return { error: "No captions available for this video." };
  }

  // Prefer English, fall back to first
  const track = tracks.find((t) => t.languageCode?.startsWith("en")) || tracks[0];

  const captionRes = await fetch(track.baseUrl, {
    headers: { "User-Agent": IOS_UA },
    signal: AbortSignal.timeout(10_000),
  });
  const xml = await captionRes.text();

  if (!xml || xml.length === 0) {
    return { error: "Caption data was empty. The video may have restricted captions." };
  }

  // Parse timed text XML → plain text
  const lines = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const text = m[1]
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/<[^>]+>/g, "").trim();
    if (text) lines.push(text);
  }

  if (lines.length === 0) {
    return { error: "No transcript text found in captions data." };
  }

  return {
    title: player?.videoDetails?.title ?? "",
    author: player?.videoDetails?.author ?? "",
    language: track.languageCode,
    transcript: lines.join(" "),
  };
}

// ─── URL content extraction ───

function stripTags(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

function htmlToText(html) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, body) =>
    `\n${"#".repeat(Number(level))} ${stripTags(body).trim()}\n`);
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, body) => `\n- ${stripTags(body).trim()}`);
  text = text.replace(/<(br|hr)\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|section|article|header|footer|table|tr|ul|ol)>/gi, "\n");
  text = stripTags(text);
  text = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  return text;
}

async function fetchUrlContent(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html;q=0.9, text/markdown;q=1.0, */*;q=0.1",
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    return { error: `Fetch failed (${response.status}): ${response.statusText}` };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/pdf")) {
    return { error: "PDF URLs are not yet supported. Download the file and use a PDF reader." };
  }

  const body = await response.text();
  const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]).trim() : "";

  let text;
  if (contentType.includes("text/html")) {
    text = htmlToText(body);
  } else if (contentType.includes("application/json")) {
    try { text = JSON.stringify(JSON.parse(body), null, 2); } catch { text = body; }
  } else {
    text = body;
  }

  return { text, title };
}

// ─── Local file reading ───

async function readLocalFile(filePath) {
  const { readFileSync, existsSync } = await import("node:fs");
  if (!existsSync(filePath)) {
    return { error: `File not found: ${filePath}` };
  }
  const content = readFileSync(filePath, "utf-8");
  return { text: content };
}

// ─── Truncation helper ───

function truncate(text, max) {
  return text.length > max ? text.slice(0, max) + "\n...(truncated)" : text;
}

// ─── Exported tool ───

export const tools = [
  {
    name: "summarize_content",
    description:
      "Extract and optionally summarize content from URLs, YouTube videos, or local files. " +
      "Handles web pages (HTML to text), YouTube transcripts, and text files. " +
      'Returns an LLM-generated summary by default, or raw extracted text with mode "extract".',
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "URL (web page or YouTube) or local file path to summarize.",
        },
        mode: {
          type: "string",
          enum: ["summary", "extract"],
          description: '"summary" (default) generates an LLM summary, "extract" returns raw extracted text.',
        },
        length: {
          type: "string",
          enum: ["short", "medium", "long"],
          description: '"short" (~200 words), "medium" (~500 words, default), "long" (~1000 words).',
        },
        language: {
          type: "string",
          description: "Language for the summary output (default: same as source content).",
        },
      },
      required: ["source"],
    },

    async execute(args, { credentialStore, skillName }) {
      const source = String(args.source).trim();
      const mode = args.mode || "summary";
      const length = args.length || "medium";
      const language = args.language;

      if (!source) {
        return { content: "source is required.", isError: true };
      }

      let extractedText = "";
      let title = "";
      let sourceType = "unknown";

      try {
        const isUrl = source.startsWith("http://") || source.startsWith("https://");

        if (isUrl && isYouTubeUrl(source)) {
          sourceType = "youtube";
          const result = await fetchYouTubeTranscript(source);
          if (result.error) {
            return { content: `YouTube extraction failed: ${result.error}`, isError: true };
          }
          extractedText = result.transcript;
          title = result.title;
        } else if (isUrl) {
          sourceType = "webpage";
          const result = await fetchUrlContent(source);
          if (result.error) {
            return { content: result.error, isError: true };
          }
          extractedText = result.text;
          title = result.title;
        } else {
          sourceType = "file";
          const result = await readLocalFile(source);
          if (result.error) {
            return { content: result.error, isError: true };
          }
          extractedText = result.text;
        }

        extractedText = truncate(extractedText, MAX_CONTENT_CHARS);

        if (!extractedText.trim()) {
          return { content: "No content could be extracted from the source.", isError: true };
        }

        // Extract-only mode
        if (mode === "extract") {
          const header = title ? `Title: ${title}\nSource: ${source}\nType: ${sourceType}\n\n` : "";
          return { content: truncate(header + extractedText, MAX_RESPONSE_CHARS) };
        }

        // Summary mode — call LLM
        const lengthGuide = { short: "~200 words", medium: "~500 words", long: "~1000 words" };
        const langInstruction = language ? ` Write the summary in ${language}.` : "";

        const systemPrompt =
          `You are a content summarizer. Summarize the following content in approximately ${lengthGuide[length] || lengthGuide.medium}. ` +
          `Be concise, accurate, and capture the key points.${langInstruction}`;

        const userContent = title
          ? `Title: ${title}\nSource: ${source}\n\nContent:\n${extractedText}`
          : `Source: ${source}\n\nContent:\n${extractedText}`;

        const maxTokens = length === "short" ? 500 : length === "long" ? 2000 : 1000;

        const summary = await generateSummary(credentialStore, skillName, systemPrompt, userContent, maxTokens);

        return { content: summary };
      } catch (err) {
        return { content: `Summarization failed: ${err.message}`, isError: true };
      }
    },
  },
];
