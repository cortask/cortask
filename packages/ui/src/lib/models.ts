export interface ModelDef {
  id: string;
  label: string;
}

export const MODELS_BY_PROVIDER: Record<string, ModelDef[]> = {
  anthropic: [
    { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini" },
    { id: "o3-mini", label: "o3-mini" },
  ],
  google: [
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { id: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro" },
  ],
};

/**
 * Maps UI provider IDs to credential store provider IDs where they differ.
 * e.g. the providers API returns "google" but credentials use "gemini".
 */
export const PROVIDER_STORE_IDS: Record<string, string> = {
  google: "gemini",
};
