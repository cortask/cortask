export const DEFAULT_LOCAL_MODEL =
  "hf:ggml-org/embeddinggemma-300m-qat-q8_0-GGUF/embeddinggemma-300m-qat-Q8_0.gguf";

export interface LocalEmbeddingProvider {
  id: "local";
  model: string;
  embedQuery(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dispose(): void;
}

function normalizeEmbedding(vec: number[]): number[] {
  const sanitized = vec.map((v) => (Number.isFinite(v) ? v : 0));
  const magnitude = Math.sqrt(
    sanitized.reduce((sum, v) => sum + v * v, 0),
  );
  if (magnitude < 1e-10) return sanitized;
  return sanitized.map((v) => v / magnitude);
}

export async function createLocalEmbeddingProvider(
  modelPath?: string,
): Promise<LocalEmbeddingProvider> {
  const resolvedPath = modelPath?.trim() || DEFAULT_LOCAL_MODEL;

  // Dynamic import — node-llama-cpp is an optional dependency
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { getLlama, resolveModelFile, LlamaLogLevel } = await import(
    "node-llama-cpp" as string
  ) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let llama: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let model: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let context: any = null;

  const ensureContext = async () => {
    if (!llama) {
      llama = await getLlama({ logLevel: LlamaLogLevel.error });
    }
    if (!model) {
      const resolved = await resolveModelFile(resolvedPath);
      model = await llama.loadModel({ modelPath: resolved });
    }
    if (!context) {
      context = await model.createEmbeddingContext();
    }
    return context;
  };

  return {
    id: "local",
    model: resolvedPath,

    async embedQuery(text: string): Promise<number[]> {
      const ctx = await ensureContext();
      const embedding = await ctx.getEmbeddingFor(text);
      return normalizeEmbedding(Array.from(embedding.vector));
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      const ctx = await ensureContext();
      const results = await Promise.all(
        texts.map(async (text) => {
          const embedding = await ctx.getEmbeddingFor(text);
          return normalizeEmbedding(Array.from(embedding.vector));
        }),
      );
      return results;
    },

    dispose() {
      if (context) {
        context.dispose?.();
        context = null;
      }
      if (model) {
        model.dispose?.();
        model = null;
      }
      llama = null;
    },
  };
}
