import { useLocation } from "react-router";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { WindowControls } from "@/components/WindowControls";

const pageTitles: Record<string, string> = {
    "/skills": "Skills",
    "/channels": "Channels",
    "/cron": "Cron",
    "/settings": "Settings",
};

export function Header() {
    const location = useLocation();
    const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
    const { theme, toggle } = useTheme();

    const title =
        location.pathname === "/"
            ? activeWorkspace?.name ?? "Chat"
            : pageTitles[location.pathname] ?? "Cortask";

    return (
        <header
            className="flex h-14 items-center border-b px-4 gap-2"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
            <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
                <h1 className="text-lg font-semibold">{title}</h1>
            </div>

            <div
                className="ml-auto flex items-center gap-2"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggle}
                    aria-label="Toggle theme"
                >
                    {theme === "dark" ? (
                        <Sun className="h-4 w-4" />
                    ) : (
                        <Moon className="h-4 w-4" />
                    )}
                </Button>
            </div>
            <WindowControls />
        </header>
    );
}
