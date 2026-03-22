import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import { api, type Workspace, type CronJobWithState } from "@/lib/api";
import { useChatStore } from "@/stores/chatStore";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Send,
    FileText,
    Brain,
    MessageCircle,
    Clock,
    Pencil,
} from "lucide-react";

export function ProjectHome({ workspace }: { workspace: Workspace }) {
    const navigate = useNavigate();
    const { sessions, sendMessage, setActiveSession } = useChatStore();
    const [input, setInput] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Files
    const [files, setFiles] = useState<Array<{ name: string; mtime: number }>>([]);
    useEffect(() => {
        api.workspaces.listFiles(workspace.id).then((r) => setFiles(r.files)).catch(() => {});
    }, [workspace.id]);

    // Memory
    const [memory, setMemory] = useState<string | null>(null);
    const [memoryEditOpen, setMemoryEditOpen] = useState(false);
    const [memoryDraft, setMemoryDraft] = useState("");
    useEffect(() => {
        api.workspaces.readMemory(workspace.id).then((r) => setMemory(r.content)).catch(() => {});
    }, [workspace.id]);

    // Cron
    const [cronJobs, setCronJobs] = useState<CronJobWithState[]>([]);
    useEffect(() => {
        api.cron.list(workspace.id).then(setCronJobs).catch(() => {});
    }, [workspace.id]);

    const handleSubmit = () => {
        const text = input.trim();
        if (!text) return;
        sendMessage(text, workspace.id);
        setInput("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleMemoryEdit = () => {
        setMemoryDraft(memory ?? "");
        setMemoryEditOpen(true);
    };

    const handleMemorySave = async () => {
        await api.workspaces.writeMemory(workspace.id, memoryDraft);
        setMemory(memoryDraft);
        setMemoryEditOpen(false);
    };

    const recentSessions = sessions.slice(0, 5);

    return (
        <div className="flex h-full flex-col overflow-auto">
            {/* Chat input */}
            <div className="mx-auto w-full max-w-2xl px-6 pt-8 pb-4">
                <div className="flex items-end gap-2 rounded-lg border bg-background p-2">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything..."
                        rows={1}
                        className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
                    />
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={handleSubmit}
                        disabled={!input.trim()}
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Widgets */}
            <div className="mx-auto w-full max-w-2xl px-6 pb-8">
                <div className="grid grid-cols-2 gap-4">
                    {/* Recent Files */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                <FileText className="h-4 w-4" />
                                Recent Files
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {files.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No files yet.</p>
                            ) : (
                                <ul className="space-y-1">
                                    {files.slice(0, 5).map((f) => (
                                        <li
                                            key={f.name}
                                            className="truncate text-xs text-muted-foreground"
                                        >
                                            {f.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    {/* Memory */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                <Brain className="h-4 w-4" />
                                Memory
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="ml-auto h-5 w-5"
                                    onClick={handleMemoryEdit}
                                >
                                    <Pencil className="h-3 w-3" />
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {memory ? (
                                <p className="text-xs text-muted-foreground line-clamp-5 whitespace-pre-wrap">
                                    {memory.slice(0, 200)}
                                    {memory.length > 200 ? "..." : ""}
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground">No memory saved.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Recent Chats */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                <MessageCircle className="h-4 w-4" />
                                Recent Chats
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {recentSessions.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No recent chats.</p>
                            ) : (
                                <ul className="space-y-1">
                                    {recentSessions.map((s) => (
                                        <li key={s.id}>
                                            <button
                                                onClick={() => {
                                                    setActiveSession(s.id, workspace.id);
                                                    navigate("/");
                                                }}
                                                className="w-full truncate text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {s.title}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    {/* Cron Jobs */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                <Clock className="h-4 w-4" />
                                Scheduled Tasks
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {cronJobs.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No scheduled tasks.</p>
                            ) : (
                                <ul className="space-y-1.5">
                                    {cronJobs.slice(0, 3).map((job) => (
                                        <li
                                            key={job.id}
                                            className="flex items-center gap-2 text-xs text-muted-foreground"
                                        >
                                            <span className="truncate flex-1">{job.name}</span>
                                            <Badge
                                                variant={job.enabled ? "default" : "secondary"}
                                                className="text-[10px] px-1 py-0"
                                            >
                                                {job.enabled ? "Active" : "Off"}
                                            </Badge>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Memory Edit Dialog */}
            <Dialog open={memoryEditOpen} onOpenChange={setMemoryEditOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Memory</DialogTitle>
                    </DialogHeader>
                    <Textarea
                        value={memoryDraft}
                        onChange={(e) => setMemoryDraft(e.target.value)}
                        rows={12}
                        className="font-mono text-xs"
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMemoryEditOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleMemorySave}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
