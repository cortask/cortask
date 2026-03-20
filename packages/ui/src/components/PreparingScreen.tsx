import { Loader2 } from "lucide-react";
import { WindowControls } from "@/components/WindowControls";

export function PreparingScreen() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <div
        className="flex h-10 shrink-0 justify-end"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <WindowControls />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground">
            Setting up Cortask
          </p>
          <p className="text-xs text-muted-foreground">
            Downloading browser and preparing components...
          </p>
        </div>
      </div>
    </div>
  );
}
