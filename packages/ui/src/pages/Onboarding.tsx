import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { WindowControls } from "@/components/WindowControls";

const PROVIDERS = [
    { id: "anthropic", name: "Anthropic", logo: "/logos/anthropic.svg", fieldLabel: "API Key", fieldType: "password" as const, darkInvert: false },
    { id: "openai", name: "OpenAI", logo: "/logos/openai.svg", fieldLabel: "API Key", fieldType: "password" as const, darkInvert: true },
    { id: "google", name: "Google", logo: "/logos/google.svg", fieldLabel: "API Key", fieldType: "password" as const, darkInvert: false },
    { id: "moonshot", name: "Moonshot", logo: "/logos/moonshot.svg", fieldLabel: "API Key", fieldType: "password" as const, darkInvert: true },
    { id: "grok", name: "Grok", logo: "/logos/grok.svg", fieldLabel: "API Key", fieldType: "password" as const, darkInvert: true },
    { id: "openrouter", name: "OpenRouter", logo: "/logos/openrouter.svg", fieldLabel: "API Key", fieldType: "password" as const, darkInvert: true },
    { id: "minimax", name: "MiniMax", logo: "/logos/minimax.svg", fieldLabel: "API Key", fieldType: "password" as const, darkInvert: false },
    { id: "ollama", name: "Ollama", logo: "/logos/ollama.svg", fieldLabel: "Host URL", fieldType: "text" as const, darkInvert: true },
] as const;

export function OnboardingPage() {
    const navigate = useNavigate();
    const [selectedProvider, setSelectedProvider] = useState<string | null>(
        null,
    );
    const [apiKey, setApiKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleComplete = async () => {
        if (!selectedProvider || !apiKey) {
            setError("Please select a provider and enter an API key");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const isOllama = selectedProvider === "ollama";
            await api.onboarding.complete({
                provider: {
                    type: selectedProvider,
                    ...(isOllama ? { host: apiKey } : { apiKey }),
                },
            });

            // Redirect to main app
            navigate("/");
            window.location.reload(); // Reload to refresh app state
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to complete onboarding",
            );
        } finally {
            setLoading(false);
        }
    };

    const selectedProviderMeta = PROVIDERS.find(
        (p) => p.id === selectedProvider,
    );

    return (
        <div className="flex h-screen items-center justify-center bg-background p-4">
            <div
                className="fixed top-0 left-0 right-0 h-10 z-50 flex justify-end"
                style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
            >
                <WindowControls />
            </div>
            <Card className="w-full max-w-lg">
                <CardContent className="p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-bold">
                            Welcome to Cortask
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Let's start by connecting an AI provider
                        </p>
                    </div>

                    {error && (
                        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-3">
                            {PROVIDERS.map((provider) => (
                                <button
                                    key={provider.id}
                                    onClick={() =>
                                        setSelectedProvider(provider.id)
                                    }
                                    className={cn(
                                        "flex flex-col items-center gap-3 rounded-lg border p-4 transition-colors",
                                        selectedProvider === provider.id
                                            ? "border-primary bg-accent"
                                            : "border-border hover:bg-accent/50",
                                    )}
                                >
                                    <img
                                        src={provider.logo}
                                        alt={provider.name}
                                        className={cn(
                                            "h-10 w-10",
                                            provider.darkInvert &&
                                                "dark:invert",
                                        )}
                                    />
                                    <span className="text-xs font-medium">
                                        {provider.name}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {selectedProviderMeta && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    {selectedProviderMeta.fieldLabel}
                                </label>
                                <Input
                                    type={selectedProviderMeta.fieldType}
                                    placeholder={
                                        selectedProviderMeta.id === "ollama"
                                            ? "http://localhost:11434"
                                            : `Enter your ${selectedProviderMeta.fieldLabel.toLowerCase()}...`
                                    }
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !loading)
                                            handleComplete();
                                    }}
                                />
                                {selectedProviderMeta.id !== "ollama" && (
                                    <p className="text-xs text-muted-foreground">
                                        Get your API key from the{" "}
                                        {selectedProviderMeta.name} dashboard
                                    </p>
                                )}
                            </div>
                        )}

                        <Button
                            className="w-full"
                            onClick={handleComplete}
                            disabled={!selectedProvider || !apiKey || loading}
                        >
                            {loading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Get Started
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
