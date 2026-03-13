// --- Skill tool templates (HTTP tools defined in SKILL.md frontmatter) ---

export interface SkillToolInput {
  type: string; // "string" | "object" | "number" | "boolean"
  description?: string;
  enum?: string[];
  required?: boolean; // default true
}

export interface SkillToolTemplate {
  name: string; // e.g. "dataforseo_serp"
  description: string;
  input: Record<string, SkillToolInput>;
  request: {
    url: string; // "https://api.example.com/v1/{{path}}"
    method?: string; // default "GET"
    headers?: Record<string, string>;
    body?: string; // "{{body}}" or fixed JSON
  };
}

// --- Skill binary install spec ---

export type SkillInstallKind =
  | "brew"
  | "npm"
  | "go"
  | "uv"
  | "download"
  | "winget"
  | "scoop"
  | "choco";

export interface SkillInstallSpec {
  id?: string;
  kind: SkillInstallKind;
  label?: string;
  bins?: string[];
  os?: string[];
  formula?: string;
  package?: string;
  module?: string;
  url?: string;
  archive?: string;
  extract?: boolean;
  targetDir?: string;
}

export interface SkillInstallOption {
  id: string;
  kind: SkillInstallKind;
  label: string;
}

// --- Skill manifest (parsed from SKILL.md frontmatter) ---

export interface SkillManifest {
  name: string;
  description: string;
  requires?: {
    env?: string[];
    bins?: string[];
    config?: string[];
  };
  install?: SkillInstallSpec[];
  tools?: SkillToolTemplate[];
  compatibility?: {
    os?: string[];
  };
  always?: boolean;
  metadata?: {
    homepage?: string;
    tags?: string[];
    author?: string;
    gitUrl?: string;
    [key: string]: unknown;
  };
}

// --- Skill entry (loaded + enriched) ---

export type SkillSource = "bundled" | "user" | "config-dir" | "git";

export interface SkillEntry {
  manifest: SkillManifest;
  content: string; // markdown body (instructions for the agent)
  path: string; // directory path
  eligible: boolean;
  ineligibleReason?: string;
  source: SkillSource;
  editable: boolean;
  hasCodeTools?: boolean;
  installOptions?: SkillInstallOption[];
  credentialSchema?: CredentialSchema;
  credentialStatus?: Record<string, boolean>;
}

// --- Code skill tool interface (exported from index.js) ---

export interface SkillCodeTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    context: { credentialStore: unknown; skillName: string },
  ) => Promise<{ content: string; isError?: boolean }>;
}

// --- Credential schema types ---

export type CredentialAuthType =
  | "api-key"
  | "basic-auth"
  | "bearer-token"
  | "oauth2"
  | "custom";

export type CredentialFieldType = "text" | "secret" | "url" | "email" | "model-select";

export interface CredentialField {
  key: string;
  label: string;
  type: CredentialFieldType;
  required?: boolean;
  description?: string;
  placeholder?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

export interface OAuth2Config {
  authorizationUrl: string;
  tokenUrl: string;
  scopes?: string[];
  pkce?: boolean;
  refreshable?: boolean;
}

export interface CredentialDefinition {
  id: string;
  type: CredentialAuthType;
  name: string;
  description?: string;
  fields?: CredentialField[];
  oauth?: OAuth2Config;
  storeAs?: string;
  multiple?: boolean; // Allow multiple named instances of this credential
}

export interface CredentialInstance {
  id: string;
  label: string;
}

export interface CredentialSchema {
  credentials: CredentialDefinition[];
}
