import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronRight, Download, Eye, File, Loader2 } from "lucide-react";
import { useChatStore, type ChatMessage } from "@/stores/chatStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePreviewStore } from "@/stores/previewStore";
import { ArtifactViewer } from "@/components/ArtifactViewer";
import { tryParseArtifact } from "@/lib/artifacts";
import {
    Questionnaire,
    type QuestionnaireData,
    type QuestionnaireResponses,
} from "@/components/Questionnaire";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PROSE_CLASSES =
    "prose dark:prose-invert prose-sm max-w-none " +
    "[&>p]:leading-relaxed [&>p+p]:mt-3 " +
    "[&>h1]:mt-5 [&>h2]:mt-4 [&>h3]:mt-3 " +
    "[&>h1]:mb-2 [&>h2]:mb-2 [&>h3]:mb-1.5 " +
    "[&>ul]:mt-2 [&>ol]:mt-2 [&>ul]:mb-3 [&>ol]:mb-3 " +
    "[&_li]:mt-1 [&_li>p]:my-0 " +
    "[&_table]:border-collapse [&_table]:w-full [&_table]:my-3 " +
    "[&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-1.5 [&_th]:bg-muted/50 [&_th]:text-left [&_th]:font-medium " +
    "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5 " +
    "[&_pre]:bg-muted [&_pre]:rounded-md " +
    "[&_code]:text-xs [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded";

interface MessageListProps {
    messages: ChatMessage[];
    streamingText: string;
    thinkingText: string;
    isStreaming: boolean;
}

export function MessageList({
    messages,
    streamingText,
    thinkingText,
    isStreaming,
}: MessageListProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const stickToBottom = useRef(true);

    // Track whether user has scrolled away from the bottom
    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const threshold = 80;
        stickToBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    }, []);

    // Smooth-scroll on discrete new messages
    useEffect(() => {
        if (!stickToBottom.current) return;
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Instant snap during streaming (no competing animations)
    useEffect(() => {
        if (!stickToBottom.current || !isStreaming) return;
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [streamingText, thinkingText, isStreaming]);

    if (messages.length === 0 && !isStreaming) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                    <h2 className="text-xl font-medium mb-2">Cortask</h2>
                    <p className="text-sm">
                        Your local AI assistant. Type a message to get started.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-6"
        >
            <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                ))}

                {isStreaming && thinkingText && (
                    <ThinkingBubble content={thinkingText} isStreaming />
                )}

                {isStreaming && streamingText && (
                    <div className="flex gap-3">
                        <Avatar className="w-7 h-7 shrink-0">
                            <AvatarFallback className="text-xs">
                                AI
                            </AvatarFallback>
                        </Avatar>
                        <div className={`${PROSE_CLASSES} overflow-x-auto`}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {streamingText}
                            </ReactMarkdown>
                            <span className="inline-block w-2 h-4 bg-muted-foreground animate-pulse ml-0.5" />
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>
        </div>
    );
}

function MessageBubble({ message }: { message: ChatMessage }) {
    if (message.role === "user") {
        return (
            <div className="flex gap-3 justify-end">
                <Card className="max-w-[80%] bg-secondary border-0">
                    <CardContent className="px-4 py-2.5">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {message.content}
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (message.role === "tool") {
        if (message.messageType === "tool_call") {
            return <ToolCallBubble message={message} />;
        }

        if (message.messageType === "permission_request") {
            return <InlinePermission message={message} />;
        }

        if (message.messageType === "questionnaire") {
            return <InlineQuestionnaire message={message} />;
        }

        // Regular tool result - show artifact, file card, or hide
        const artifact = tryParseArtifact(message.content);
        if (artifact) {
            return (
                <div className="flex gap-3">
                    <div className="w-7 h-7 shrink-0" />
                    <div className="max-w-[80%] w-full">
                        <ArtifactViewer artifact={artifact} />
                    </div>
                </div>
            );
        }

        const fileRef = tryParseFileRef(message.content);
        if (fileRef) {
            return <FileCard fileRef={fileRef} />;
        }

        // Non-artifact tool result - skip rendering
        return null;
    }

    if (message.messageType === "thinking") {
        return <ThinkingBubble content={message.content} />;
    }

    // Assistant message
    return (
        <div className="flex gap-3">
            <Avatar className="w-7 h-7 shrink-0">
                <AvatarFallback className="text-xs">AI</AvatarFallback>
            </Avatar>
            <div
                className={`${PROSE_CLASSES} overflow-x-auto ${message.isError ? "text-red-400" : ""}`}
            >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                </ReactMarkdown>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tool-specific input formatting
// ---------------------------------------------------------------------------

function formatToolInput(
    toolName: string | undefined,
    args: Record<string, unknown> | undefined,
): string | null {
    if (!args || Object.keys(args).length === 0) return null;

    switch (toolName) {
        case "bash":
            return (args.command as string) ?? null;
        case "write_file":
        case "read_file":
        case "list_files":
            return (args.path as string) ?? null;
        case "web_fetch":
            return (args.url as string) ?? null;
        case "web_search":
            return (args.query as string) ?? null;
        case "show_file":
            return (args.path as string) ?? null;
        case "data_file":
            return `${args.action ?? ""}${args.path ? ` — ${args.path}` : ""}`;
        case "artifact":
            return `${args.type ?? ""}${args.title ? ` — ${args.title}` : ""}`;
        case "memory_read":
        case "memory_save":
        case "memory_append":
            return (args.scope as string) ?? "project";
        default: {
            // Generic: show first string arg value
            const first = Object.entries(args).find(
                ([, v]) => typeof v === "string",
            );
            return first ? (first[1] as string) : JSON.stringify(args);
        }
    }
}

function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max) + "…";
}

// ---------------------------------------------------------------------------
// ToolCallBubble — collapsible with IN / OUT
// ---------------------------------------------------------------------------

function ToolCallBubble({ message }: { message: ChatMessage }) {
    const [open, setOpen] = useState(false);
    const hasDetails =
        message.status !== "running" && (message.toolArgs || message.content);

    const inputText = formatToolInput(message.toolName, message.toolArgs);
    const outputText = message.content || null;
    // Don't show output if it's an artifact or file ref (those render separately)
    const isStructured = outputText
        ? !!(tryParseArtifact(outputText) || tryParseFileRef(outputText))
        : false;

    return (
        <div className="flex gap-3">
            <div className="w-7 shrink-0" />
            <div className="max-w-[80%]">
                {/* Header row */}
                <button
                    type="button"
                    onClick={() => hasDetails && setOpen(!open)}
                    className={`flex items-center gap-2 py-0.5 ${hasDetails ? "cursor-pointer" : "cursor-default"}`}
                >
                    {/* Status indicator */}
                    {message.status === "running" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : message.status === "error" ? (
                        <span className="flex h-3.5 w-3.5 items-center justify-center">
                            <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                        </span>
                    ) : (
                        <span className="flex h-3.5 w-3.5 items-center justify-center">
                            <span className="h-2 w-2 rounded-full bg-green-500" />
                        </span>
                    )}

                    <span className="text-xs text-muted-foreground truncate max-w-md">
                        {message.toolName || "Tool"}
                        {message.status === "running" && "…"}
                        {message.status === "running" && inputText && (
                            <span className="ml-1.5 text-muted-foreground/60">
                                {truncate(inputText, 80)}
                            </span>
                        )}
                    </span>

                    {/* Chevron */}
                    {hasDetails && (
                        <ChevronRight
                            className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
                        />
                    )}
                </button>

                {/* Collapsible details */}
                {open && hasDetails && (
                    <div className="ml-5.5 mt-1 space-y-1 border-l border-border pl-3">
                        {inputText && (
                            <div>
                                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                                    in
                                </span>
                                <pre className="mt-0.5 text-xs text-muted-foreground whitespace-pre-wrap break-all">
                                    {truncate(inputText, 2000)}
                                </pre>
                            </div>
                        )}
                        {outputText && !isStructured && (
                            <div>
                                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                                    out
                                </span>
                                <pre className="mt-0.5 text-xs text-muted-foreground whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
                                    {truncate(outputText, 3000)}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// ThinkingBubble — collapsible thinking block
// ---------------------------------------------------------------------------

function ThinkingBubble({
    content,
    isStreaming: isLive,
}: {
    content: string;
    isStreaming?: boolean;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="flex gap-3">
            <div className="w-7 shrink-0" />
            <div className="max-w-[80%]">
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className="flex items-center gap-2 py-0.5 cursor-pointer"
                >
                    {isLive ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                        <span className="flex h-3.5 w-3.5 items-center justify-center">
                            <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                        </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                        {isLive ? "Thinking…" : "Thought"}
                    </span>
                    <ChevronRight
                        className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
                    />
                </button>

                {open && (
                    <div className="ml-5.5 mt-1 border-l border-border pl-3">
                        <pre className="text-xs text-muted-foreground/70 whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
                            {content}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// File reference parsing & card
// ---------------------------------------------------------------------------

interface FileRef {
    path: string;
    size: number;
}

function tryParseFileRef(content: string): FileRef | null {
    try {
        const parsed = JSON.parse(content);
        if (parsed.__fileRef && parsed.path) {
            return { path: parsed.path, size: parsed.size ?? 0 };
        }
    } catch {
        // Not JSON or not a file ref
    }
    return null;
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileCard({ fileRef }: { fileRef: FileRef }) {
    const workspaceId = useWorkspaceStore((s) => s.activeWorkspace?.id);
    const openPreview = usePreviewStore((s) => s.open);
    const downloadUrl = workspaceId
        ? `/api/workspaces/${workspaceId}/files/${fileRef.path}`
        : "#";
    const fileName = fileRef.path.split("/").pop() || fileRef.path;
    const ext = fileName.includes(".")
        ? fileName.split(".").pop()!.toLowerCase()
        : "text";

    const handlePreview = (e: React.MouseEvent) => {
        e.preventDefault();
        openPreview({ title: fileName, url: downloadUrl, type: ext });
    };

    return (
        <div className="flex gap-3">
            <div className="w-7 shrink-0" />
            <div className="flex items-center gap-1.5 max-w-[80%]">
                <button
                    type="button"
                    onClick={handlePreview}
                    className="flex items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-secondary transition-colors cursor-pointer"
                >
                    <File className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1 text-left">
                        <p className="text-sm truncate">{fileName}</p>
                        {fileRef.size > 0 && (
                            <p className="text-xs text-muted-foreground">
                                {formatSize(fileRef.size)}
                            </p>
                        )}
                    </div>
                    <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
                <a
                    href={downloadUrl}
                    download={fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md p-1.5 hover:bg-secondary transition-colors text-muted-foreground"
                    title="Download"
                >
                    <Download className="h-3.5 w-3.5" />
                </a>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Inline permission
// ---------------------------------------------------------------------------

function InlinePermission({ message }: { message: ChatMessage }) {
    const respondToPermission = useChatStore((s) => s.respondToPermission);

    if (message.permissionResolved) {
        return (
            <div className="flex items-center gap-3 py-0.5">
                <div className="w-7 shrink-0" />
                <div className="flex items-center gap-2">
                    <span className="flex h-3.5 w-3.5 items-center justify-center">
                        <span
                            className={`h-2 w-2 rounded-full ${
                                message.permissionApproved
                                    ? "bg-green-500"
                                    : "bg-muted-foreground"
                            }`}
                        />
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {message.permissionApproved ? "Allowed" : "Denied"}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex gap-3">
            <div className="w-7 shrink-0" />
            <Card className="max-w-[80%] border-yellow-500/30">
                <CardContent className="px-4 py-3 space-y-2">
                    <p className="text-xs font-medium text-yellow-500">
                        Permission Required
                    </p>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
                        {message.content}
                    </p>
                    <div className="flex gap-2 pt-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                                respondToPermission(
                                    message.id,
                                    message.permissionRequestId!,
                                    false,
                                )
                            }
                        >
                            Deny
                        </Button>
                        <Button
                            size="sm"
                            className="h-7 text-xs bg-green-700 hover:bg-green-600 text-white"
                            onClick={() =>
                                respondToPermission(
                                    message.id,
                                    message.permissionRequestId!,
                                    true,
                                )
                            }
                        >
                            Allow
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Inline questionnaire
// ---------------------------------------------------------------------------

function InlineQuestionnaire({ message }: { message: ChatMessage }) {
    const respondToQuestionnaire = useChatStore(
        (s) => s.respondToQuestionnaire,
    );

    if (!message.questionnaireData) return null;

    try {
        const data = JSON.parse(message.questionnaireData) as QuestionnaireData;
        const submittedResponses = message.questionnaireResponses
            ? (JSON.parse(
                  message.questionnaireResponses,
              ) as QuestionnaireResponses)
            : undefined;

        return (
            <Questionnaire
                data={data}
                isResolved={message.questionnaireResolved}
                submittedResponses={submittedResponses}
                onSubmit={(responses) =>
                    respondToQuestionnaire(
                        message.id,
                        message.questionnaireRequestId!,
                        responses,
                    )
                }
                onSkip={() =>
                    respondToQuestionnaire(
                        message.id,
                        message.questionnaireRequestId!,
                        {},
                    )
                }
            />
        );
    } catch {
        return null;
    }
}
