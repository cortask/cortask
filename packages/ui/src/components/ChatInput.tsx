import { useState, useRef, useEffect, useCallback } from "react";
import { Paperclip, ArrowUp, Square, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { api, type Provider, type EnabledModel } from "@/lib/api";
import { TemplateMenu } from "@/components/TemplateMenu";

interface FileAttachment {
  file: File;
  base64: string;
  preview?: string;
}

interface ChatInputProps {
  onSend: (
    message: string,
    attachments?: Array<{ mimeType: string; base64: string; name?: string }>,
  ) => void;
  isStreaming: boolean;
  onCancel: () => void;
  disabled?: boolean;
}

type PermissionMode = "safe" | "auto";

const ACCEPTED_TYPES = "image/png,image/jpeg,image/gif,image/webp";

export function ChatInput({
  onSend,
  isStreaming,
  onCancel,
  disabled,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<PermissionMode>("safe");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus textarea on mount and whenever streaming ends
  useEffect(() => {
    if (!isStreaming && !disabled) {
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [isStreaming, disabled]);

  const [enabledModels, setEnabledModels] = useState<EnabledModel[]>([]);

  useEffect(() => {
    Promise.all([api.providers.list(), api.models.enabled()]).then(
      ([provs, models]) => {
        setProviders(provs);
        setEnabledModels(models);
        const defaultProvider = provs.find((p) => p.isDefault && p.configured);
        if (defaultProvider) {
          // Use saved model from config, fall back to first enabled model
          const savedModel = models.find((m) => m.modelId === defaultProvider.defaultModel);
          const firstEnabled = models.find((m) => m.provider === defaultProvider.id);
          setSelectedModel(savedModel?.modelId ?? firstEnabled?.modelId ?? defaultProvider.defaultModel);
        } else {
          const firstConfigured = provs.find((p) => p.configured);
          if (firstConfigured) {
            const savedModel = models.find((m) => m.modelId === firstConfigured.defaultModel);
            const firstEnabled = models.find((m) => m.provider === firstConfigured.id);
            setSelectedModel(savedModel?.modelId ?? firstEnabled?.modelId ?? firstConfigured.defaultModel);
          }
        }
      },
    );
  }, []);

  // Close model menu on outside click
  useEffect(() => {
    if (!modelMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        modelMenuRef.current &&
        !modelMenuRef.current.contains(e.target as Node)
      ) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelMenuOpen]);

  const configuredProviders = providers.filter((p) => p.configured);

  // Group enabled models by provider
  const modelsByProvider = new Map<string, EnabledModel[]>();
  for (const m of enabledModels) {
    const prov = configuredProviders.find((p) => p.id === m.provider);
    if (!prov) continue;
    if (!modelsByProvider.has(m.provider)) modelsByProvider.set(m.provider, []);
    modelsByProvider.get(m.provider)!.push(m);
  }

  const selectedLabel =
    enabledModels.find((m) => m.modelId === selectedModel)?.label ??
    selectedModel ??
    "Model";

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data:...;base64, prefix
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const newAttachments: FileAttachment[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const base64 = await readFileAsBase64(file);
      newAttachments.push({
        file,
        base64,
        preview: URL.createObjectURL(file),
      });
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const removed = prev[index];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = () => {
    const trimmed = input.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming) return;

    const attData = attachments.length
      ? attachments.map((a) => ({
          mimeType: a.file.type,
          base64: a.base64,
          name: a.file.name,
        }))
      : undefined;

    onSend(trimmed || "What is in this image?", attData);
    setInput("");
    // Clean up previews
    for (const a of attachments) {
      if (a.preview) URL.revokeObjectURL(a.preview);
    }
    setAttachments([]);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.focus();
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      const dt = new DataTransfer();
      for (const f of imageFiles) dt.items.add(f);
      handleFiles(dt.files);
    }
  };

  return (
    <div className="px-4 pb-4 pt-2 max-w-3xl mx-auto w-full">
      <div className="rounded-xl border bg-card shadow-sm">
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex gap-2 px-4 pt-3 flex-wrap">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="relative group h-16 w-16 rounded-lg overflow-hidden border bg-muted"
              >
                <img
                  src={att.preview}
                  alt={att.file.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="absolute -top-1 -right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <div className="px-4 pt-3 pb-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              disabled
                ? "Select a workspace to start..."
                : "Type a message..."
            }
            disabled={disabled}
            rows={1}
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            style={{ maxHeight: "200px" }}
          />
        </div>

        <Separator />

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2">
          {/* Mode toggle */}
          <button
            type="button"
            onClick={() => setMode(mode === "safe" ? "auto" : "safe")}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <div
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                mode === "safe" ? "bg-yellow-500" : "bg-green-500",
              )}
            />
            {mode === "safe" ? "Safe mode" : "Auto mode"}
          </button>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {/* Model selector */}
            <div className="relative" ref={modelMenuRef}>
              <button
                type="button"
                onClick={() => setModelMenuOpen(!modelMenuOpen)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {selectedLabel}
                <ChevronDown className="h-3 w-3" />
              </button>

              {modelMenuOpen && enabledModels.length > 0 && (
                <div className="absolute bottom-full right-0 mb-1 w-56 rounded-lg border bg-popover p-1 shadow-md max-h-64 overflow-y-auto">
                  {configuredProviders.map((provider) => {
                    const models = modelsByProvider.get(provider.id);
                    if (!models?.length) return null;
                    return (
                      <div key={provider.id}>
                        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {provider.name}
                        </div>
                        {models.map((model) => (
                          <button
                            key={model.modelId}
                            type="button"
                            onClick={() => {
                              setSelectedModel(model.modelId);
                              setModelMenuOpen(false);
                              api.providers.setDefault(provider.id, model.modelId);
                            }}
                            className={cn(
                              "flex w-full items-center rounded-md px-2 py-1.5 text-xs transition-colors",
                              selectedModel === model.modelId
                                ? "bg-accent text-accent-foreground"
                                : "text-popover-foreground hover:bg-accent/50",
                            )}
                          >
                            {model.label}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {/* Attach */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              title="Attach image"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            {/* Templates */}
            <TemplateMenu
              onSelect={(content) => {
                setInput(content);
                requestAnimationFrame(() => textareaRef.current?.focus());
              }}
              currentInput={input}
              disabled={disabled}
            />

            {/* Send / Stop */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md bg-destructive p-1.5 text-destructive-foreground transition-colors hover:bg-destructive/90"
                title="Stop"
              >
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  (!input.trim() && attachments.length === 0) || disabled
                }
                className="rounded-md bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Send"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
