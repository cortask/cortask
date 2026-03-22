import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Download, GripVertical, Save, Eye, Pencil } from "lucide-react";
import { usePreviewStore } from "@/stores/previewStore";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspaceStore";

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

const MIN_WIDTH = 280;
const DEFAULT_WIDTH = 480;
const LS_KEY = "cortask:preview-width";

function loadWidth(): number {
    try {
        const v = localStorage.getItem(LS_KEY);
        if (v) return Math.max(MIN_WIDTH, Number(v));
    } catch {}
    return DEFAULT_WIDTH;
}

const EDITABLE_TYPES = new Set([
    "text", "markdown", "md", "txt", "js", "jsx", "ts", "tsx", "json",
    "css", "scss", "less", "yaml", "yml", "toml", "xml", "csv",
    "sh", "bash", "zsh", "py", "rb", "go", "rs", "java", "c", "cpp",
    "h", "hpp", "sql", "graphql", "env", "ini", "conf", "log",
]);

/** Check if a file type supports editing */
function isEditable(type: string): boolean {
    return EDITABLE_TYPES.has(type.toLowerCase());
}

/** Map file extension / artifact type to a renderer category */
function resolveRenderer(
    type: string,
): "markdown" | "html" | "image" | "pdf" | "text" {
    const t = type.toLowerCase();
    if (["md", "markdown"].includes(t)) return "markdown";
    if (["html", "svg", "htm"].includes(t)) return "html";
    if (["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "image"].includes(t))
        return "image";
    if (t === "pdf") return "pdf";
    return "text";
}

/** Extract workspace ID and relative file path from a preview URL */
function parseFileUrl(url: string): { workspaceId: string; filePath: string } | null {
    const match = url.match(/\/api\/workspaces\/([^/]+)\/files\/(.+)/);
    if (!match) return null;
    return { workspaceId: match[1], filePath: decodeURIComponent(match[2]) };
}

function MarkdownRenderer({ url }: { url: string }) {
    const [content, setContent] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch(url)
            .then((r) => r.text())
            .then((text) => {
                if (!cancelled) setContent(text);
            });
        return () => {
            cancelled = true;
        };
    }, [url]);

    if (content === null)
        return (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        );

    return (
        <div className={`p-4 ${PROSE_CLASSES}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
    );
}

function HtmlRenderer({ url }: { url: string }) {
    const [content, setContent] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch(url)
            .then((r) => r.text())
            .then((text) => {
                if (!cancelled) setContent(text);
            });
        return () => {
            cancelled = true;
        };
    }, [url]);

    if (content === null)
        return (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        );

    return (
        <iframe
            srcDoc={content}
            title="HTML Preview"
            className="w-full h-full min-h-[600px] border-0"
            sandbox="allow-scripts"
        />
    );
}

function TextRenderer({ url }: { url: string }) {
    const [content, setContent] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch(url)
            .then((r) => r.text())
            .then((text) => {
                if (!cancelled) setContent(text);
            });
        return () => {
            cancelled = true;
        };
    }, [url]);

    if (content === null)
        return (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        );

    return (
        <pre className="p-4 text-xs text-muted-foreground whitespace-pre-wrap break-words">
            {content}
        </pre>
    );
}

function EditableRenderer({
    url,
    onDirtyChange,
    editorRef,
}: {
    url: string;
    onDirtyChange: (dirty: boolean) => void;
    editorRef: React.MutableRefObject<{ getContent: () => string } | null>;
}) {
    const [original, setOriginal] = useState<string | null>(null);
    const [content, setContent] = useState<string>("");

    useEffect(() => {
        let cancelled = false;
        fetch(url)
            .then((r) => r.text())
            .then((text) => {
                if (!cancelled) {
                    setOriginal(text);
                    setContent(text);
                    onDirtyChange(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [url]);

    useEffect(() => {
        editorRef.current = {
            getContent: () => content,
        };
    }, [content, editorRef]);

    if (original === null)
        return (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        );

    return (
        <textarea
            className="w-full h-full min-h-[400px] p-4 text-xs font-mono bg-transparent text-foreground resize-none outline-none"
            value={content}
            onChange={(e) => {
                setContent(e.target.value);
                onDirtyChange(e.target.value !== original);
            }}
            spellCheck={false}
        />
    );
}

export function PreviewPanel() {
    const item = usePreviewStore((s) => s.item);
    const close = usePreviewStore((s) => s.close);
    const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
    const [width, setWidthRaw] = useState(loadWidth);
    const setWidth = useCallback((w: number) => {
        setWidthRaw(w);
        try { localStorage.setItem(LS_KEY, String(w)); } catch {}
    }, []);
    const [editMode, setEditMode] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<{ getContent: () => string } | null>(null);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);

    // Close preview when workspace changes (skip initial mount)
    const prevWorkspaceId = useRef(activeWorkspace?.id);
    useEffect(() => {
        if (prevWorkspaceId.current !== undefined && prevWorkspaceId.current !== activeWorkspace?.id) {
            close();
        }
        prevWorkspaceId.current = activeWorkspace?.id;
    }, [activeWorkspace?.id]);

    // Reset edit mode when item changes
    useEffect(() => {
        setEditMode(false);
        setDirty(false);
    }, [item?.url]);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        startXRef.current = e.clientX;
        startWidthRef.current = width;

        const onPointerMove = (ev: PointerEvent) => {
            const delta = startXRef.current - ev.clientX;
            const container = panelRef.current?.parentElement;
            const maxWidth = container ? container.getBoundingClientRect().width * 0.7 : 1200;
            setWidth(Math.max(MIN_WIDTH, Math.min(startWidthRef.current + delta, maxWidth)));
        };

        const onPointerUp = () => {
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
        };

        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp);
    }, [width]);

    const handleSave = useCallback(async () => {
        if (!item || !editorRef.current) return;
        const parsed = parseFileUrl(item.url);
        if (!parsed) return;

        setSaving(true);
        try {
            await api.workspaces.writeFile(parsed.workspaceId, parsed.filePath, editorRef.current.getContent());
            setDirty(false);
        } catch (err) {
            console.error("Failed to save file:", err);
        } finally {
            setSaving(false);
        }
    }, [item]);

    if (!item) return null;

    const renderer = resolveRenderer(item.type);
    const canEdit = isEditable(item.type);

    return (
        <div
            ref={panelRef}
            className="relative flex h-full shrink-0 border-l border-border bg-background"
            style={{ width }}
        >
            {/* Drag handle */}
            <div
                onPointerDown={onPointerDown}
                className="absolute left-0 top-0 bottom-0 w-2 -translate-x-1/2 cursor-col-resize z-20 flex items-center justify-center group"
            >
                <GripVertical className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors" />
            </div>

            <div className="flex flex-col w-full min-w-0">
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
                    <span className="text-sm font-medium truncate flex-1">
                        {item.title}
                    </span>
                    {canEdit && (
                        <Tabs
                            value={editMode ? "edit" : "view"}
                            onValueChange={(v) => {
                                if (v === "view" && dirty) setDirty(false);
                                setEditMode(v === "edit");
                            }}
                        >
                            <TabsList className="h-7">
                                <TabsTrigger value="view" className="gap-1 text-xs px-2.5 py-0.5 h-5">
                                    <Eye className="h-3 w-3" />
                                    View
                                </TabsTrigger>
                                <TabsTrigger value="edit" className="gap-1 text-xs px-2.5 py-0.5 h-5">
                                    <Pencil className="h-3 w-3" />
                                    Edit
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    )}
                    <a
                        href={item.url}
                        download={item.title}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Download className="h-3.5 w-3.5" />
                        </Button>
                    </a>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={close}
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>

                {/* Content */}
                <ScrollArea className="flex-1">
                    {editMode && canEdit ? (
                        <EditableRenderer
                            url={item.url}
                            onDirtyChange={setDirty}
                            editorRef={editorRef}
                        />
                    ) : (
                        <>
                            {renderer === "markdown" && <MarkdownRenderer url={item.url} />}
                            {renderer === "html" && <HtmlRenderer url={item.url} />}
                            {renderer === "image" && (
                                <div className="p-4 flex items-center justify-center">
                                    <img
                                        src={item.url}
                                        alt={item.title}
                                        className="max-w-full max-h-[80vh] object-contain"
                                    />
                                </div>
                            )}
                            {renderer === "pdf" && (
                                <iframe
                                    src={item.url}
                                    title={item.title}
                                    className="w-full h-full min-h-[600px] border-0"
                                />
                            )}
                            {renderer === "text" && <TextRenderer url={item.url} />}
                        </>
                    )}
                </ScrollArea>

                {/* Save button — slides in when dirty */}
                <div
                    className={`border-t border-border px-3 py-2 flex justify-end transition-all duration-200 ${
                        dirty ? "max-h-16 opacity-100" : "max-h-0 opacity-0 overflow-hidden py-0 border-t-0"
                    }`}
                >
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="gap-1.5"
                    >
                        <Save className="h-3.5 w-3.5" />
                        {saving ? "Saving…" : "Save"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
