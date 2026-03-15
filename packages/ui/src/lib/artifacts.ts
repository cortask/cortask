export interface ArtifactData {
  artifactId: string;
  type: string;
  title: string;
  mimeType: string;
}

export function tryParseArtifact(content: string): ArtifactData | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.artifactId && parsed.type && parsed.title) {
      return parsed as ArtifactData;
    }
  } catch {
    // Not JSON or not an artifact
  }
  return null;
}
