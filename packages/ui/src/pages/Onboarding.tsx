import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { api, type AvailableModel, type EnabledModel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    Loader2,
    Plug,
    FlaskConical,
    Plus,
    Trash2,
    Check,
    ChevronRight,
} from "lucide-react";
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

    // Step state
    const [step, setStep] = useState<1 | 2>(1);

    // Step 1 — Provider connection
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [apiKey, setApiKey] = useState("");
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Step 2 — Model selection
    const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
    const [enabledModels, setEnabledModels] = useState<EnabledModel[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [selectedModelId, setSelectedModelId] = useState("");
    const [customModel, setCustomModel] = useState({ id: "", name: "", inputPrice: 0, outputPrice: 0 });
    const [showCustom, setShowCustom] = useState(false);
    const [finishing, setFinishing] = useState(false);

    const selectedProviderMeta = PROVIDERS.find((p) => p.id === selectedProvider);
    const enabledModelIds = new Set(enabledModels.map((m) => m.modelId));

    const handleConnect = async () => {
        if (!selectedProvider || !apiKey) {
            setError("Please select a provider and enter an API key");
            return;
        }

        setConnecting(true);
        setError(null);

        try {
            const isOllama = selectedProvider === "ollama";
            await api.onboarding.complete({
                provider: {
                    type: selectedProvider,
                    ...(isOllama ? { host: apiKey } : { apiKey }),
                },
            });
            setConnected(true);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to connect provider",
            );
        } finally {
            setConnecting(false);
        }
    };

    const handleTest = async () => {
        if (!selectedProvider) return;
        setTesting(true);
        setTestResult("");
        try {
            const result = await api.providers.test(selectedProvider);
            setTestResult(
                result.success
                    ? `Connected! "${result.response}"`
                    : `Failed: ${result.error}`,
            );
        } catch (err) {
            setTestResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setTesting(false);
        }
    };

    const loadModels = useCallback(async (providerId: string) => {
        setLoadingModels(true);
        try {
            const [available, enabled] = await Promise.all([
                api.models.available(providerId),
                api.models.enabled(providerId),
            ]);
            setAvailableModels(available);
            setEnabledModels(enabled);
        } catch (err) {
            console.error(err);
            setAvailableModels([]);
            setEnabledModels([]);
        } finally {
            setLoadingModels(false);
        }
    }, []);

    useEffect(() => {
        if (step === 2 && selectedProvider) {
            loadModels(selectedProvider);
        }
    }, [step, selectedProvider, loadModels]);

    const addModel = async (model: AvailableModel) => {
        if (!selectedProvider) return;
        try {
            await api.models.enable({
                provider: selectedProvider,
                modelId: model.id,
                label: model.name,
                inputPricePer1m: model.inputPricePer1m ?? 0,
                outputPricePer1m: model.outputPricePer1m ?? 0,
            });
            await loadModels(selectedProvider);
            setSelectedModelId("");
        } catch (err) {
            console.error(err);
        }
    };

    const addCustomModel = async () => {
        if (!selectedProvider || !customModel.id) return;
        try {
            await api.models.enable({
                provider: selectedProvider,
                modelId: customModel.id,
                label: customModel.name || customModel.id,
                inputPricePer1m: customModel.inputPrice,
                outputPricePer1m: customModel.outputPrice,
            });
            await loadModels(selectedProvider);
            setCustomModel({ id: "", name: "", inputPrice: 0, outputPrice: 0 });
            setShowCustom(false);
        } catch (err) {
            console.error(err);
        }
    };

    const removeModel = async (provider: string, modelId: string) => {
        try {
            await api.models.disable(provider, modelId);
            if (selectedProvider) await loadModels(selectedProvider);
        } catch (err) {
            console.error(err);
        }
    };

    const handleFinish = () => {
        setFinishing(true);
        navigate("/");
        window.location.reload();
    };

    return (
        <div className="flex h-screen items-center justify-center bg-background p-4">
            <div
                className="fixed top-0 left-0 right-0 h-10 z-50 flex justify-end"
                style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
            >
                <WindowControls />
            </div>
            <Card className="w-full max-w-2xl">
                <CardContent className="p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-bold">
                            Welcome to Cortask
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {step === 1
                                ? "Let's start by connecting an AI provider"
                                : "Now choose which models you'd like to use"}
                        </p>
                        {/* Step indicator */}
                        <div className="flex items-center justify-center gap-2 pt-2">
                            <div className={cn(
                                "h-2 w-2 rounded-full",
                                step === 1 ? "bg-primary" : "bg-primary/40",
                            )} />
                            <div className={cn(
                                "h-2 w-2 rounded-full",
                                step === 2 ? "bg-primary" : "bg-primary/40",
                            )} />
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    {/* ─── Step 1: Connect Provider ─── */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-3">
                                {PROVIDERS.map((provider) => (
                                    <button
                                        key={provider.id}
                                        disabled={connected}
                                        onClick={() => {
                                            setSelectedProvider(provider.id);
                                            setApiKey("");
                                            setConnected(false);
                                            setTestResult("");
                                        }}
                                        className={cn(
                                            "flex flex-col items-center gap-3 rounded-lg border p-4 transition-colors",
                                            selectedProvider === provider.id
                                                ? "border-primary bg-accent"
                                                : "border-border hover:bg-accent/50",
                                            connected && selectedProvider !== provider.id && "opacity-50",
                                        )}
                                    >
                                        <img
                                            src={provider.logo}
                                            alt={provider.name}
                                            className={cn(
                                                "h-10 w-10",
                                                provider.darkInvert && "dark:invert",
                                            )}
                                        />
                                        <span className="text-xs font-medium">
                                            {provider.name}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {selectedProviderMeta && !connected && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">
                                        {selectedProviderMeta.fieldLabel}
                                    </label>
                                    <div className="flex gap-2">
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
                                                if (e.key === "Enter" && !connecting)
                                                    handleConnect();
                                            }}
                                        />
                                        <Button
                                            size="sm"
                                            onClick={handleConnect}
                                            disabled={!apiKey || connecting}
                                        >
                                            <Plug className="mr-1.5 h-3.5 w-3.5" />
                                            {connecting ? "Connecting..." : "Connect"}
                                        </Button>
                                    </div>
                                    {selectedProviderMeta.id !== "ollama" && (
                                        <p className="text-xs text-muted-foreground">
                                            Get your API key from the{" "}
                                            {selectedProviderMeta.name} dashboard
                                        </p>
                                    )}
                                </div>
                            )}

                            {selectedProviderMeta && connected && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={selectedProviderMeta.logo}
                                            alt={selectedProviderMeta.name}
                                            className={cn("h-6 w-6", selectedProviderMeta.darkInvert && "dark:invert")}
                                        />
                                        <span className="text-sm font-semibold">
                                            {selectedProviderMeta.name}
                                        </span>
                                        <Badge className="bg-green-900/30 text-green-400 border-green-800 hover:bg-green-900/30">
                                            <Check className="mr-1 h-3 w-3" />
                                            Connected
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={handleTest}
                                            disabled={testing}
                                        >
                                            <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                                            {testing ? "Testing..." : "Test connection"}
                                        </Button>
                                        {testResult && (
                                            <p className="text-xs text-muted-foreground">
                                                {testResult}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {connected ? (
                                <Button
                                    className="w-full"
                                    onClick={() => setStep(2)}
                                >
                                    Next: Configure Models
                                    <ChevronRight className="ml-1.5 h-4 w-4" />
                                </Button>
                            ) : (
                                <div />
                            )}
                        </div>
                    )}

                    {/* ─── Step 2: Model Selection ─── */}
                    {step === 2 && selectedProvider && (
                        <div className="space-y-4">
                            {/* Add model dropdown */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-medium">Add Models</Label>
                                    {loadingModels && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                </div>
                                <div className="flex gap-2">
                                    <Select
                                        value={showCustom ? "__custom__" : selectedModelId}
                                        onValueChange={(v) => {
                                            if (v === "__custom__") {
                                                setShowCustom(true);
                                                setSelectedModelId("");
                                            } else {
                                                setShowCustom(false);
                                                setSelectedModelId(v);
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Select a model to add..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableModels
                                                .filter((m) => !enabledModelIds.has(m.id))
                                                .map((m) => (
                                                    <SelectItem key={m.id} value={m.id}>
                                                        <div className="flex items-center justify-between gap-4 w-full">
                                                            <span>{m.name}</span>
                                                            {(m.inputPricePer1m !== undefined || m.outputPricePer1m !== undefined) && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    ${m.inputPricePer1m?.toFixed(2) ?? "?"} / ${m.outputPricePer1m?.toFixed(2) ?? "?"} per 1M
                                                                </span>
                                                            )}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            <SelectItem value="__custom__">
                                                <span className="text-muted-foreground">+ Custom model...</span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {selectedModelId && !showCustom && (
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                const m = availableModels.find((m) => m.id === selectedModelId);
                                                if (m) addModel(m);
                                            }}
                                        >
                                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                                            Add
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Custom model form */}
                            {showCustom && (
                                <Card className="border-dashed">
                                    <CardContent className="p-4 space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Model ID</Label>
                                                <Input
                                                    placeholder="e.g. my-model-v1"
                                                    value={customModel.id}
                                                    onChange={(e) => setCustomModel((p) => ({ ...p, id: e.target.value }))}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Display Name</Label>
                                                <Input
                                                    placeholder="e.g. My Model v1"
                                                    value={customModel.name}
                                                    onChange={(e) => setCustomModel((p) => ({ ...p, name: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Input price / 1M tokens ($)</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    step={0.01}
                                                    value={customModel.inputPrice}
                                                    onChange={(e) => setCustomModel((p) => ({ ...p, inputPrice: Number(e.target.value) || 0 }))}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Output price / 1M tokens ($)</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    step={0.01}
                                                    value={customModel.outputPrice}
                                                    onChange={(e) => setCustomModel((p) => ({ ...p, outputPrice: Number(e.target.value) || 0 }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={addCustomModel} disabled={!customModel.id}>
                                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                                Add Custom Model
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => setShowCustom(false)}>
                                                Cancel
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Enabled models list */}
                            {enabledModels.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Enabled Models</Label>
                                    <div className="space-y-1.5">
                                        {enabledModels.map((m) => (
                                            <div
                                                key={m.id}
                                                className="flex items-center justify-between rounded-md border px-3 py-2"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium truncate">{m.label}</p>
                                                    <p className="text-xs text-muted-foreground font-mono truncate">{m.modelId}</p>
                                                </div>
                                                <div className="flex items-center gap-3 ml-3 shrink-0">
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        ${m.inputPricePer1m.toFixed(2)} / ${m.outputPricePer1m.toFixed(2)}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                                        onClick={() => removeModel(m.provider, m.modelId)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!loadingModels && enabledModels.length === 0 && (
                                <p className="text-xs text-muted-foreground">
                                    No models enabled yet. Add models above to use them in chat.
                                </p>
                            )}

                            <div className="flex gap-2 pt-2">
                                <Button
                                    className="flex-1"
                                    onClick={handleFinish}
                                    disabled={finishing}
                                >
                                    {finishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Get Started
                                </Button>
                            </div>
                            <button
                                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setStep(1)}
                            >
                                Back to provider setup
                            </button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
