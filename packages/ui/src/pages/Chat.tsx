import { useState } from "react";
import { ChatInput } from "@/components/ChatInput";
import { MessageList } from "@/components/MessageList";
import { PreviewPanel } from "@/components/PreviewPanel";
import { useChatStore } from "@/stores/chatStore";
import { usePreviewStore } from "@/stores/previewStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

function WelcomeCard() {
    const { createWorkspace, setActiveWorkspace } = useWorkspaceStore();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [name, setName] = useState("");

    const handleCreate = async () => {
        if (!name.trim()) return;
        const ws = await createWorkspace(name.trim());
        setActiveWorkspace(ws);
        setDialogOpen(false);
    };

    return (
        <>
            <div className="flex h-full items-center justify-center p-8">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle>Welcome to Cortask</CardTitle>
                        <CardDescription>
                            Create a project to get started. Each project gets
                            its own session history and memory.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={() => setDialogOpen(true)}
                            className="w-full"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            New Project
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>New Project</DialogTitle>
                        <DialogDescription>
                            Give your project a name to get started.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="welcome-name">Name</Label>
                        <Input
                            id="welcome-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleCreate();
                            }}
                            placeholder="My Project"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={!name.trim()}>
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export function ChatPage() {
    const {
        messages,
        isStreaming,
        streamingText,
        thinkingText,
        sendMessage,
        cancelStream,
    } = useChatStore();
    const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
    const workspaces = useWorkspaceStore((s) => s.workspaces);
    const loading = useWorkspaceStore((s) => s.loading);
    const previewItem = usePreviewStore((s) => s.item);

    if (!loading && workspaces.length === 0) {
        return <WelcomeCard />;
    }

    return (
        <div className="flex h-full">
            {/* Chat column */}
            <div className="relative flex flex-col h-full flex-1 min-w-0">
                {/* Messages */}
                <MessageList
                    messages={messages}
                    streamingText={streamingText}
                    thinkingText={thinkingText}
                    isStreaming={isStreaming}
                />

                {/* Fade gradient above input */}
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />

                {/* Input */}
                <div className="relative z-10">
                    <ChatInput
                        onSend={(text, attachments) => {
                            if (activeWorkspace) {
                                sendMessage(text, activeWorkspace.id, attachments);
                            }
                        }}
                        isStreaming={isStreaming}
                        onCancel={cancelStream}
                        disabled={!activeWorkspace}
                    />
                </div>
            </div>

            {/* Preview panel (right side) */}
            {previewItem && <PreviewPanel />}
        </div>
    );
}
