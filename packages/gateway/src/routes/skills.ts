import crypto from "node:crypto";
import { Router } from "express";
import path from "node:path";
import {
  loadSkills,
  clearSkillCache,
  installSkillFromGit,
  removeSkill,
  createSkill,
  updateSkill,
  readSkillFile,
  validateSkillName,
  getCredentialStorageKey,
  getOAuth2StorageKeys,
  buildSkillOAuth2AuthUrl,
  exchangeSkillOAuth2Code,
  revokeSkillOAuth2,
} from "@cortask/core";
import type { GatewayContext } from "../server.js";

// In-memory CSRF state store for OAuth2 flows
const oauthStates = new Map<string, { skillName: string; credentialId: string; createdAt: number }>();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Clean up expired states every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthStates) {
    if (now - val.createdAt > STATE_TTL_MS) {
      oauthStates.delete(key);
    }
  }
}, 60_000).unref();

function oauthHtml(title: string, message: string, script?: string): string {
  return `<html><body><h2>${title}</h2><p>${message}</p>${script ? `<script>${script}</script>` : "<p>You can close this tab.</p>"}</body></html>`;
}

export function createSkillRoutes(ctx: GatewayContext): Router {
  const router = Router();

  const bundledDir = ctx.bundledSkillsDir;
  const userSkillsDir = path.join(ctx.dataDir, "skills");

  async function findSkillAndOAuth(name: string) {
    const skills = await loadSkills(
      bundledDir,
      userSkillsDir,
      ctx.config.skills.dirs,
      ctx.credentialStore,
    );
    const skill = skills.find((s) => s.manifest.name === name);
    if (!skill) return null;
    const oauth2Cred = skill.credentialSchema?.credentials.find((c) => c.type === "oauth2");
    return { skill, oauth2Cred };
  }

  router.get("/", async (_req, res) => {
    try {
      const skills = await loadSkills(
        bundledDir,
        userSkillsDir,
        ctx.config.skills.dirs,
        ctx.credentialStore,
      );

      const result = skills.map((s) => ({
        name: s.manifest.name,
        description: s.manifest.description,
        eligible: s.eligible,
        ineligibleReason: s.ineligibleReason,
        source: s.source,
        editable: s.editable,
        hasCodeTools: s.hasCodeTools,
        toolCount: (s.manifest.tools?.length ?? 0) + (s.hasCodeTools ? 1 : 0),
        tags: s.manifest.metadata?.tags ?? [],
        homepage: (s.manifest.metadata?.homepage as string) ?? null,
        content: s.content,
        installOptions: s.installOptions,
        credentialSchema: s.credentialSchema,
        credentialStatus: s.credentialStatus,
      }));

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post("/install", async (req, res) => {
    try {
      const { gitUrl } = req.body;
      if (!gitUrl) {
        res.status(400).json({ error: "gitUrl is required" });
        return;
      }

      const result = await installSkillFromGit(gitUrl, userSkillsDir);
      clearSkillCache();
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.delete("/:name", async (req, res) => {
    try {
      await removeSkill(req.params.name, userSkillsDir);
      clearSkillCache();
      res.status(204).send();
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // ───── Create custom skill ─────
  router.post("/", async (req, res) => {
    try {
      const { name, content } = req.body;
      if (!name || !content) {
        res.status(400).json({ error: "name and content are required" });
        return;
      }

      const nameErr = validateSkillName(name);
      if (nameErr) {
        res.status(400).json({ error: nameErr });
        return;
      }

      // Check for conflict with bundled skills
      const allSkills = await loadSkills(
        bundledDir,
        userSkillsDir,
        ctx.config.skills.dirs,
        ctx.credentialStore,
      );
      const isBundled = allSkills.some(
        (s) => s.source === "bundled" && s.manifest.name === name,
      );
      if (isBundled) {
        res.status(409).json({
          error: `A built-in skill named "${name}" already exists. Choose a different name.`,
        });
        return;
      }

      const result = await createSkill(userSkillsDir, name, content);
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // ───── Update custom skill ─────
  router.put("/:name", async (req, res) => {
    try {
      const { content } = req.body;
      if (!content) {
        res.status(400).json({ error: "content is required" });
        return;
      }

      // Reject editing bundled skills
      const allSkills = await loadSkills(
        bundledDir,
        userSkillsDir,
        ctx.config.skills.dirs,
        ctx.credentialStore,
      );
      const skill = allSkills.find((s) => s.manifest.name === req.params.name);
      if (skill && !skill.editable) {
        res.status(403).json({ error: "Built-in skills cannot be edited" });
        return;
      }

      await updateSkill(userSkillsDir, req.params.name, content);
      res.json({ name: req.params.name });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // ───── Get raw SKILL.md content for editing ─────
  router.get("/:name/content", async (req, res) => {
    try {
      const content = await readSkillFile(userSkillsDir, req.params.name);
      res.json({ name: req.params.name, content });
    } catch (err) {
      res.status(404).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // ───── OAuth2: Start authorization flow ─────
  router.get("/:name/oauth2/authorize", async (req, res) => {
    try {
      const name = req.params.name;
      const result = await findSkillAndOAuth(name);

      if (!result || !result.oauth2Cred?.oauth) {
        res.status(400).json({ error: "Skill not found or has no OAuth2 config" });
        return;
      }

      const credentialId = result.oauth2Cred.id;
      const clientIdKey = getCredentialStorageKey(name, credentialId, "clientId", result.oauth2Cred.storeAs);
      const clientId = await ctx.credentialStore.get(clientIdKey);

      if (!clientId) {
        res.status(400).json({ error: "Client ID not configured. Save it before authorizing." });
        return;
      }

      const state = crypto.randomBytes(16).toString("hex");
      oauthStates.set(state, { skillName: name, credentialId, createdAt: Date.now() });

      // Determine gateway base URL from the request
      const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3777";
      const gatewayBaseUrl = `${proto}://${host}`;

      const redirectUri = `${gatewayBaseUrl}/api/skills/${encodeURIComponent(name)}/oauth2/callback`;
      const authorizationUrl = buildSkillOAuth2AuthUrl(
        name,
        result.oauth2Cred.oauth,
        clientId,
        redirectUri,
        state,
      );

      res.json({ authorizationUrl, redirectUri });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ───── OAuth2: Get redirect URI (for display before credentials are saved) ─────
  router.get("/:name/oauth2/redirect-uri", (req, res) => {
    const name = req.params.name;
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3777";
    const gatewayBaseUrl = `${proto}://${host}`;
    const redirectUri = `${gatewayBaseUrl}/api/skills/${encodeURIComponent(name)}/oauth2/callback`;
    res.json({ redirectUri });
  });

  // ───── OAuth2: Callback from provider ─────
  router.get("/:name/oauth2/callback", async (req, res) => {
    const { code, state, error: oauthError } = req.query as Record<string, string>;
    const name = req.params.name;

    if (oauthError) {
      res.status(400).send(oauthHtml("OAuth Error", oauthError));
      return;
    }

    if (!code || !state) {
      res.status(400).send(oauthHtml("Error", "Missing code or state parameter."));
      return;
    }

    // Validate CSRF state
    const stateEntry = oauthStates.get(state);
    if (!stateEntry || stateEntry.skillName !== name) {
      res.status(400).send(oauthHtml("Error", "Invalid or expired OAuth state. Please try again."));
      return;
    }
    oauthStates.delete(state);

    if (Date.now() - stateEntry.createdAt > STATE_TTL_MS) {
      res.status(400).send(oauthHtml("Error", "OAuth state expired. Please try again."));
      return;
    }

    try {
      const result = await findSkillAndOAuth(name);
      if (!result || !result.oauth2Cred?.oauth) {
        res.status(400).send(oauthHtml("Error", "Skill not found or has no OAuth2 config."));
        return;
      }

      const credentialId = result.oauth2Cred.id;
      const clientIdKey = getCredentialStorageKey(name, credentialId, "clientId", result.oauth2Cred.storeAs);
      const clientSecretKey = getCredentialStorageKey(name, credentialId, "clientSecret", result.oauth2Cred.storeAs);
      const clientId = await ctx.credentialStore.get(clientIdKey);
      const clientSecret = await ctx.credentialStore.get(clientSecretKey);

      if (!clientId || !clientSecret) {
        res.status(400).send(oauthHtml("Error", "OAuth client credentials not configured."));
        return;
      }

      const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3777";
      const gatewayBaseUrl = `${proto}://${host}`;
      const redirectUri = `${gatewayBaseUrl}/api/skills/${encodeURIComponent(name)}/oauth2/callback`;

      await exchangeSkillOAuth2Code(
        name,
        credentialId,
        result.oauth2Cred.oauth,
        clientId,
        clientSecret,
        code,
        redirectUri,
        ctx.credentialStore,
      );

      clearSkillCache();

      res.send(oauthHtml(
        "Authorization Successful",
        `Skill "${name}" has been authorized.`,
        `if (window.opener) { window.opener.postMessage({ type: "oauth-success", skill: "${name}" }, "*"); }`,
      ));
    } catch (err) {
      res.status(500).send(oauthHtml("Error", `Token exchange failed: ${err instanceof Error ? err.message : String(err)}`));
    }
  });

  // ───── OAuth2: Token status ─────
  router.get("/:name/oauth2/status", async (req, res) => {
    try {
      const name = req.params.name;
      const result = await findSkillAndOAuth(name);

      if (!result || !result.oauth2Cred) {
        res.status(400).json({ error: "Skill not found or has no OAuth2 config" });
        return;
      }

      const keys = getOAuth2StorageKeys(name, result.oauth2Cred.id);
      const hasToken = await ctx.credentialStore.has(keys.accessToken);
      const expiresAtStr = await ctx.credentialStore.get(keys.expiresAt);
      const hasRefresh = await ctx.credentialStore.has(keys.refreshToken);

      let expiresAt: number | null = null;
      let expired = false;
      if (expiresAtStr) {
        expiresAt = parseInt(expiresAtStr, 10);
        expired = !isNaN(expiresAt) && Date.now() >= expiresAt;
      }

      res.json({ connected: hasToken, expired, expiresAt, hasRefreshToken: hasRefresh });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ───── OAuth2: Revoke tokens ─────
  router.post("/:name/oauth2/revoke", async (req, res) => {
    try {
      const name = req.params.name;
      const result = await findSkillAndOAuth(name);

      if (!result || !result.oauth2Cred) {
        res.status(400).json({ error: "Skill not found or has no OAuth2 config" });
        return;
      }

      await revokeSkillOAuth2(name, result.oauth2Cred.id, ctx.credentialStore);
      clearSkillCache();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
