import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Download, GripVertical } from "lucide-react";
import { usePreviewStore } from "@/stores/previewStore";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

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

export function PreviewPanel() {
    const item = usePreviewStore((s) => s.item);
    const close = usePreviewStore((s) => s.close);
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const dragging = useRef(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, []);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragging.current) return;
        const container = panelRef.current?.parentElement;
        if (!container) return;
        const containerRect = container.getBoundingClientRect();
        const newWidth = containerRect.right - e.clientX;
        setWidth(Math.max(MIN_WIDTH, Math.min(newWidth, containerRect.width * 0.7)));
    }, []);

    const onPointerUp = useCallback(() => {
        dragging.current = false;
    }, []);

    if (!item) return null;

    const renderer = resolveRenderer(item.type);

    return (
        <div
            ref={panelRef}
            className="relative flex h-full shrink-0 border-l border-border bg-background"
            style={{ width }}
        >
            {/* Drag handle */}
            <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
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
                    {renderer === "markdown" && <MarkdownRenderer url={item.url} />}
                    {renderer === "html" && (
                        <iframe
                            src={item.url}
                            title={item.title}
                            className="w-full h-full min-h-[600px] border-0"
                            sandbox="allow-scripts"
                        />
                    )}
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
                </ScrollArea>
            </div>
        </div>
    );
}
