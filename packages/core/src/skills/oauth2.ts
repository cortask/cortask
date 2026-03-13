import type { OAuth2Config } from "./types.js";
import type { EncryptedCredentialStore } from "../credentials/store.js";
import { getOAuth2StorageKeys, getCredentialStorageKey } from "./credential-schema.js";

/**
 * Build the OAuth2 authorization URL for a skill.
 */
export function buildSkillOAuth2AuthUrl(
  skillName: string,
  oauth: OAuth2Config,
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    access_type: oauth.refreshable ? "offline" : "online",
    prompt: "consent",
  });

  if (oauth.scopes?.length) {
    params.set("scope", oauth.scopes.join(" "));
  }

  return `${oauth.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange an OAuth2 authorization code for tokens and store them.
 */
export async function exchangeSkillOAuth2Code(
  skillName: string,
  credentialId: string,
  oauth: OAuth2Config,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  credentialStore: EncryptedCredentialStore,
): Promise<void> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(oauth.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };

  const keys = getOAuth2StorageKeys(skillName, credentialId);
  await credentialStore.set(keys.accessToken, data.access_token);

  if (data.refresh_token) {
    await credentialStore.set(keys.refreshToken, data.refresh_token);
  }

  if (data.expires_in) {
    const expiresAt = Date.now() + data.expires_in * 1000;
    await credentialStore.set(keys.expiresAt, String(expiresAt));
  }
}

/**
 * Revoke OAuth2 tokens for a skill by removing them from the credential store.
 */
export async function revokeSkillOAuth2(
  skillName: string,
  credentialId: string,
  credentialStore: EncryptedCredentialStore,
): Promise<void> {
  const keys = getOAuth2StorageKeys(skillName, credentialId);
  await credentialStore.delete(keys.accessToken);
  await credentialStore.delete(keys.refreshToken);
  await credentialStore.delete(keys.expiresAt);
}
