import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useChatStore } from "@/stores/chatStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function SessionTabs() {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspaceStore();
  const { sessions, activeSessionId, setActiveSession, newSession, fetchSessions } =
    useChatStore();

  useEffect(() => {
    if (activeWorkspace && sessions.length === 0) {
      fetchSessions(activeWorkspace.id);
    }
  }, [activeWorkspace, sessions.length, fetchSessions]);

  const handleNewChat = () => {
    newSession();
    navigate("/");
  };

  const handleSelectSession = (sessionId: string) => {
    if (!activeWorkspace) return;
    setActiveSession(sessionId, activeWorkspace.id);
    navigate("/");
  };

  const isNewChat =
    activeSessionId === null ||
    !sessions.some((s) => s.id === activeSessionId);

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto">
      {isNewChat && (
        <button
          className="shrink-0 rounded-md px-3 py-1 text-sm transition-colors bg-accent text-accent-foreground"
        >
          New chat
        </button>
      )}
      {sessions.map((session) => (
        <button
          key={session.id}
          className={cn(
            "shrink-0 rounded-md px-3 py-1 text-sm transition-colors cursor-pointer max-w-[200px] truncate",
            session.id === activeSessionId
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50",
          )}
          onClick={() => handleSelectSession(session.id)}
          title={session.title}
        >
          {session.title || "Untitled"}
        </button>
      ))}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={handleNewChat}
        title="New Chat"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
