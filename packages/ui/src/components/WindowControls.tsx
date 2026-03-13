import { useState, useEffect } from "react";
import { Minus, Square, X, Copy } from "lucide-react";

const omni = (window as any).cortask;

export function WindowControls() {
    const [maximized, setMaximized] = useState(false);

    useEffect(() => {
        if (!omni?.window) return;
        omni.window.isMaximized().then(setMaximized);
        return omni.window.onMaximizeChange(setMaximized);
    }, []);

    if (!omni?.window) return null;

    return (
        <div
            className="flex items-center"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
            <button
                onClick={() => omni.window.minimize()}
                className="inline-flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Minimize"
            >
                <Minus className="h-4 w-4" />
            </button>
            <button
                onClick={() => omni.window.maximize()}
                className="inline-flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label={maximized ? "Restore" : "Maximize"}
            >
                {maximized ? (
                    <Copy className="h-3 w-3" />
                ) : (
                    <Square className="h-3 w-3" />
                )}
            </button>
            <button
                onClick={() => omni.window.close()}
                className="inline-flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-red-500 hover:text-white transition-colors"
                aria-label="Close"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
