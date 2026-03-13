import type { ProviderId } from "../providers/index.js";

export interface OnboardingData {
  provider: {
    type: ProviderId;
    apiKey: string;
  };
  workspace: {
    defaultDir: string;
  };
}

export interface OnboardingStatus {
  completed: boolean;
  hasProvider: boolean;
  hasWorkspace: boolean;
}

export interface ProviderValidationResult {
  valid: boolean;
  error?: string;
  model?: string; // Detected default model
}
