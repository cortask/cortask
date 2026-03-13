import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Markdown from "react-markdown";
import { api, type SkillInfo, type Provider } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Puzzle, Search, GitBranch, Plus, ChevronDown, Trash2, ChevronRight, Info, KeyRound, FileText, ExternalLink } from "lucide-react";
import type { SkillCredentialDef } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MODELS_BY_PROVIDER, PROVIDER_STORE_IDS } from "@/lib/models";

function formatSkillName(name: string): string {
    return name
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

function getFaviconUrl(homepage: string | null): string | null {
    if (!homepage) return null;
    try {
        const domain = new URL(homepage).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
        return null;
    }
}

export function SkillsPage() {
    const [skills, setSkills] = useState<SkillInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);
    const [credentialInputs, setCredentialInputs] = useState<
        Record<string, string>
    >({});
    const [editingCredentials, setEditingCredentials] = useState<
        Set<string>
    >(new Set());
    const [providers, setProviders] = useState<Provider[]>([]);
    const [activeTab, setActiveTab] = useState<"overview" | "credentials" | "docs">("overview");

    // Add skill dialogs
    const [gitDialogOpen, setGitDialogOpen] = useState(false);
    const [installUrl, setInstallUrl] = useState("");
    const [installing, setInstalling] = useState(false);
    const [customDialogOpen, setCustomDialogOpen] = useState(false);

    const fetchSkills = useCallback(async () => {
        try {
            const data = await api.skills.list();
            setSkills(data);
            setError(null);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load skills",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSkills();
        api.providers.list().then(setProviders).catch(() => {});
    }, [fetchSkills]);

    const filteredSkills = useMemo(() => {
        if (!search.trim()) return skills;
        const q = search.toLowerCase();
        return skills.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q) ||
                s.tags.some((t) => t.toLowerCase().includes(q)),
        );
    }, [skills, search]);

    async function handleInstall() {
        if (!installUrl.trim()) return;
        setInstalling(true);
        try {
            await api.skills.install(installUrl.trim());
            setInstallUrl("");
            setGitDialogOpen(false);
            await fetchSkills();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to install skill",
            );
        } finally {
            setInstalling(false);
        }
    }

    async function handleRemove(name: string) {
        if (!confirm(`Remove skill "${name}"?`)) return;
        try {
            await api.skills.remove(name);
            setSelectedSkill(null);
            await fetchSkills();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to remove skill",
            );
        }
    }

    async function handleSaveAllCredentials() {
        if (!selectedSkill?.credentialSchema) return;
        try {
            const entries = Object.entries(credentialInputs).filter(
                ([, v]) => v.trim() !== "",
            );
            for (const [key, value] of entries) {
                await api.credentials.set(key, value);
            }
            setCredentialInputs({});
            setEditingCredentials(new Set());
            await fetchSkills();
            const fresh = await api.skills.list();
            const updated = fresh.find((s) => s.name === selectedSkill.name);
            if (updated) setSelectedSkill(updated);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to save credentials",
            );
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading skills...
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-6">
            {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive text-destructive-foreground text-sm max-w-4xl mx-auto">
                    {error}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2"
                        onClick={() => setError(null)}
                    >
                        Dismiss
                    </Button>
                </div>
            )}

            {/* Toolbar: search + add buttons */}
            <div className="flex items-center gap-2 max-w-4xl mx-auto mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search skills..."
                        className="pl-9"
                    />
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGitDialogOpen(true)}
                >
                    <GitBranch className="mr-1.5 h-3.5 w-3.5" />
                    Add from GitHub
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomDialogOpen(true)}
                >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Create skill
                </Button>
            </div>

            {/* Skill Grid */}
            {filteredSkills.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center">
                    {skills.length === 0
                        ? "No skills found."
                        : "No skills match your search."}
                </p>
            ) : (
                <div className="grid grid-cols-3 gap-4 max-w-4xl mx-auto">
                    {filteredSkills.map((skill) => (
                        <SkillCard
                            key={skill.name}
                            skill={skill}
                            onClick={() => setSelectedSkill(skill)}
                        />
                    ))}
                </div>
            )}

            {/* Skill Detail Modal */}
            <Dialog
                open={!!selectedSkill}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedSkill(null);
                        setEditingCredentials(new Set());
                        setCredentialInputs({});
                        setActiveTab("overview");
                    }
                }}
            >
                {selectedSkill && (
                    <DialogContent className="max-w-4xl h-[80vh] flex flex-col overflow-hidden bg-card p-0 gap-0">
                        {/* Header */}
                        <DialogHeader className="px-5 pt-4 pb-3 border-b shrink-0">
                            <div className="flex items-center gap-3">
                                <SkillFavicon
                                    homepage={selectedSkill.homepage}
                                    size={32}
                                />
                                <div className="flex items-center gap-2.5">
                                    <DialogTitle>
                                        {formatSkillName(selectedSkill.name)}
                                    </DialogTitle>
                                    <Badge
                                        className={cn(
                                            "text-[10px] px-1.5 py-0",
                                            selectedSkill.eligible
                                                ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/40"
                                                : "text-muted-foreground border-border bg-transparent hover:bg-transparent",
                                        )}
                                        variant={selectedSkill.eligible ? "default" : "outline"}
                                    >
                                        {selectedSkill.eligible ? "Active" : "Inactive"}
                                    </Badge>
                                </div>
                            </div>
                            <DialogDescription className="sr-only">
                                {selectedSkill.description}
                            </DialogDescription>
                        </DialogHeader>

                        {/* Body: sidebar + content */}
                        <div className="flex flex-1 min-h-0">
                            {/* Sidebar */}
                            <div className="w-44 shrink-0 border-r flex flex-col">
                                <nav className="flex-1 p-2 space-y-0.5">
                                    {([
                                        { id: "overview" as const, label: "Overview", icon: Info },
                                        { id: "credentials" as const, label: "Credentials", icon: KeyRound },
                                        { id: "docs" as const, label: "Docs", icon: FileText },
                                    ]).map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={cn(
                                                "flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors text-left",
                                                activeTab === tab.id
                                                    ? "bg-accent text-accent-foreground font-medium"
                                                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                                            )}
                                        >
                                            <tab.icon className="h-4 w-4 shrink-0" />
                                            {tab.label}
                                        </button>
                                    ))}
                                </nav>
                                {selectedSkill.editable && (
                                    <div className="p-2 border-t">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                                            onClick={() => handleRemove(selectedSkill.name)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                            Remove skill
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Content area */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {/* Overview tab */}
                                {activeTab === "overview" && (
                                    <div className="space-y-5">
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {selectedSkill.description}
                                        </p>

                                        {selectedSkill.ineligibleReason && (
                                            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/30 px-3 py-2">
                                                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                                    {selectedSkill.ineligibleReason}
                                                </p>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                {selectedSkill.source}
                                            </Badge>
                                            {selectedSkill.hasCodeTools && (
                                                <Badge variant="outline" className="text-xs">
                                                    Code tools
                                                </Badge>
                                            )}
                                            {selectedSkill.toolCount > 0 && (
                                                <Badge variant="outline" className="text-xs">
                                                    {selectedSkill.toolCount} tool{selectedSkill.toolCount > 1 ? "s" : ""}
                                                </Badge>
                                            )}
                                        </div>

                                        {selectedSkill.tags.length > 0 && (
                                            <div className="space-y-1.5">
                                                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</h4>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {selectedSkill.tags.map((tag) => (
                                                        <Badge key={tag} variant="secondary" className="text-xs">
                                                            {tag}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {selectedSkill.homepage && (
                                            <div className="space-y-1.5">
                                                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Homepage</h4>
                                                <a
                                                    href={selectedSkill.homepage}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                                                >
                                                    {selectedSkill.homepage}
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </div>
                                        )}

                                        {selectedSkill.installOptions && selectedSkill.installOptions.length > 0 && (
                                            <div className="space-y-1.5">
                                                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Install options</h4>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {selectedSkill.installOptions.map((opt) => (
                                                        <Badge key={opt.id} variant="outline" className="text-xs">
                                                            {opt.label}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Credentials tab */}
                                {activeTab === "credentials" && (
                                    <div className="space-y-4">
                                        {selectedSkill.credentialSchema &&
                                            selectedSkill.credentialSchema.credentials.length > 0 ? (
                                            <>
                                                {selectedSkill.credentialSchema.credentials.map(
                                                    (cred) => {
                                                        if (cred.multiple) {
                                                            return (
                                                                <MultiInstanceCredentials
                                                                    key={cred.id}
                                                                    cred={cred}
                                                                    skillName={selectedSkill.name}
                                                                    onChanged={async () => {
                                                                        await fetchSkills();
                                                                        const fresh = await api.skills.list();
                                                                        const updated = fresh.find((s) => s.name === selectedSkill.name);
                                                                        if (updated) setSelectedSkill(updated);
                                                                    }}
                                                                />
                                                            );
                                                        }

                                                        const fulfilled =
                                                            selectedSkill.credentialStatus?.[cred.id] ?? false;

                                                        // OAuth2 credentials get special treatment
                                                        if (cred.type === "oauth2") {
                                                            return (
                                                                <OAuth2Credentials
                                                                    key={cred.id}
                                                                    cred={cred}
                                                                    skillName={selectedSkill.name}
                                                                    fulfilled={fulfilled}
                                                                    credentialInputs={credentialInputs}
                                                                    setCredentialInputs={setCredentialInputs}
                                                                    editingCredentials={editingCredentials}
                                                                    setEditingCredentials={setEditingCredentials}
                                                                    onChanged={async () => {
                                                                        await fetchSkills();
                                                                        const fresh = await api.skills.list();
                                                                        const updated = fresh.find((s) => s.name === selectedSkill.name);
                                                                        if (updated) setSelectedSkill(updated);
                                                                    }}
                                                                    onError={setError}
                                                                />
                                                            );
                                                        }

                                                        return (
                                                            <div key={cred.id} className="space-y-3">
                                                                <div className="flex items-center gap-2">
                                                                    <span
                                                                        className={cn(
                                                                            "w-2 h-2 rounded-full",
                                                                            fulfilled ? "bg-green-500" : "bg-yellow-500",
                                                                        )}
                                                                    />
                                                                    <span className="text-sm font-medium">{cred.name}</span>
                                                                    {fulfilled && !editingCredentials.has(cred.id) && (
                                                                        <>
                                                                            <span className="text-xs text-muted-foreground">— Configured</span>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="ml-auto h-6 px-2 text-xs text-muted-foreground"
                                                                                onClick={() =>
                                                                                    setEditingCredentials((prev) => new Set(prev).add(cred.id))
                                                                                }
                                                                            >
                                                                                Edit
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                {cred.description && (!fulfilled || editingCredentials.has(cred.id)) && (
                                                                    <p className="text-xs text-muted-foreground">{cred.description}</p>
                                                                )}
                                                                {(!fulfilled || editingCredentials.has(cred.id)) && cred.fields && (
                                                                    <div className="space-y-2">
                                                                        {cred.fields.map((field) => {
                                                                            const storageKey = cred.storeAs
                                                                                ? `${cred.storeAs}.${field.key}`
                                                                                : `skill.${selectedSkill.name}.${cred.id}.${field.key}`;
                                                                            if (field.type === "model-select") {
                                                                                const configuredProviders = providers.filter((p) => p.configured);
                                                                                return (
                                                                                    <div key={field.key} className="space-y-1">
                                                                                        <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                                                                                        <ModelSelect
                                                                                            providers={configuredProviders}
                                                                                            value={credentialInputs[storageKey] ?? ""}
                                                                                            onChange={(val: string) =>
                                                                                                setCredentialInputs((prev) => ({ ...prev, [storageKey]: val }))
                                                                                            }
                                                                                        />
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return (
                                                                                <div key={field.key} className="space-y-1">
                                                                                    <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                                                                                    <Input
                                                                                        type={field.type === "secret" ? "password" : "text"}
                                                                                        value={credentialInputs[storageKey] ?? ""}
                                                                                        onChange={(e) =>
                                                                                            setCredentialInputs((prev) => ({ ...prev, [storageKey]: e.target.value }))
                                                                                        }
                                                                                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                                                                                    />
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    },
                                                )}
                                                {selectedSkill.credentialSchema.credentials
                                                    .filter((c) => !c.multiple && c.type !== "oauth2")
                                                    .some(
                                                        (c) =>
                                                            !(selectedSkill.credentialStatus?.[c.id] ?? false) ||
                                                            editingCredentials.has(c.id),
                                                    ) && (
                                                    <Button
                                                        onClick={handleSaveAllCredentials}
                                                        disabled={!Object.values(credentialInputs).some((v) => v.trim() !== "")}
                                                        className="w-full"
                                                    >
                                                        Save credentials
                                                    </Button>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                This skill requires no credentials.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Docs tab */}
                                {activeTab === "docs" && (
                                    <div>
                                        {selectedSkill.content ? (
                                            <div className="prose prose-sm max-w-none">
                                                <Markdown>{selectedSkill.content}</Markdown>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                No documentation available.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                )}
            </Dialog>

            {/* Install from GitHub Dialog */}
            <Dialog open={gitDialogOpen} onOpenChange={setGitDialogOpen}>
                <DialogContent className="max-w-md bg-card">
                    <DialogHeader>
                        <DialogTitle>Add from GitHub</DialogTitle>
                        <DialogDescription>
                            Enter a Git repository URL containing a SKILL.md
                            file.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2">
                        <Input
                            value={installUrl}
                            onChange={(e) => setInstallUrl(e.target.value)}
                            placeholder="https://github.com/user/skill-repo.git"
                            onKeyDown={(e) =>
                                e.key === "Enter" && handleInstall()
                            }
                        />
                        <Button
                            onClick={handleInstall}
                            disabled={installing || !installUrl.trim()}
                        >
                            {installing ? "Installing..." : "Install"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create Custom Skill Dialog */}
            <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
                <DialogContent className="max-w-md bg-card">
                    <DialogHeader>
                        <DialogTitle>Create custom skill</DialogTitle>
                        <DialogDescription>
                            Create a new skill by adding a SKILL.md file to your
                            user skills directory.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border bg-muted/40 p-4">
                        <p className="text-sm text-muted-foreground">
                            Create a folder with a{" "}
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                SKILL.md
                            </code>{" "}
                            file in your user skills directory. The skill will
                            appear here automatically after a page refresh.
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                            See the <strong>example</strong> skill for the
                            SKILL.md format reference.
                        </p>
                    </div>
                    <div className="flex justify-end">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setCustomDialogOpen(false)}
                        >
                            Got it
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

interface CredentialInstanceInfo {
    id: string;
    label: string;
}

function slugify(label: string): string {
    return label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function RedirectUriHint({ skillName }: { skillName: string }) {
    const [uri, setUri] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        api.skills.oauth2RedirectUri(skillName).then((data) => setUri(data.redirectUri)).catch(() => {});
    }, [skillName]);

    if (!uri) return null;

    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Redirect URI</label>
            <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted text-xs font-mono cursor-pointer select-all break-all"
                onClick={() => {
                    navigator.clipboard.writeText(uri);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                }}
                title="Click to copy"
            >
                {uri}
            </div>
            <p className="text-[11px] text-muted-foreground">
                {copied ? "Copied!" : "Add this as an authorized redirect URI in your OAuth provider. Click to copy."}
            </p>
        </div>
    );
}

function OAuth2Credentials({
    cred,
    skillName,
    fulfilled,
    credentialInputs,
    setCredentialInputs,
    editingCredentials,
    setEditingCredentials,
    onChanged,
    onError,
}: {
    cred: SkillCredentialDef;
    skillName: string;
    fulfilled: boolean;
    credentialInputs: Record<string, string>;
    setCredentialInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    editingCredentials: Set<string>;
    setEditingCredentials: React.Dispatch<React.SetStateAction<Set<string>>>;
    onChanged: () => Promise<void>;
    onError: (err: string | null) => void;
}) {
    const [connecting, setConnecting] = useState(false);
    const [fieldsSaved, setFieldsSaved] = useState(false);

    // Check if clientId/clientSecret have been saved (fields are fulfilled but oauth token may not be)
    // If the credential is fulfilled, the oauth token exists. If not, we need to check if fields are saved.
    const hasFields = cred.fields?.every((f) => {
        const storageKey = cred.storeAs
            ? `${cred.storeAs}.${f.key}`
            : `skill.${skillName}.${cred.id}.${f.key}`;
        return credentialInputs[storageKey]?.trim();
    });

    // Listen for OAuth success message from popup
    useEffect(() => {
        function handleMessage(event: MessageEvent) {
            if (event.data?.type === "oauth-success" && event.data?.skill === skillName) {
                onChanged();
            }
        }
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [skillName, onChanged]);

    async function handleSaveAndConnect() {
        try {
            // First save the credential fields
            if (cred.fields) {
                for (const field of cred.fields) {
                    const storageKey = cred.storeAs
                        ? `${cred.storeAs}.${field.key}`
                        : `skill.${skillName}.${cred.id}.${field.key}`;
                    const value = credentialInputs[storageKey];
                    if (value?.trim()) {
                        await api.credentials.set(storageKey, value.trim());
                    }
                }
            }
            setFieldsSaved(true);

            // Then start OAuth2 flow
            setConnecting(true);
            const { authorizationUrl } = await api.skills.oauth2Authorize(skillName);
            window.open(authorizationUrl, "_blank", "width=600,height=700");
        } catch (err) {
            onError(err instanceof Error ? err.message : "Failed to start OAuth2 flow");
        } finally {
            setConnecting(false);
        }
    }

    async function handleConnect() {
        try {
            setConnecting(true);
            const { authorizationUrl } = await api.skills.oauth2Authorize(skillName);
            window.open(authorizationUrl, "_blank", "width=600,height=700");
        } catch (err) {
            onError(err instanceof Error ? err.message : "Failed to start OAuth2 flow");
        } finally {
            setConnecting(false);
        }
    }

    async function handleDisconnect() {
        try {
            await api.skills.oauth2Revoke(skillName);
            await onChanged();
        } catch (err) {
            onError(err instanceof Error ? err.message : "Failed to disconnect");
        }
    }

    const isEditing = editingCredentials.has(cred.id);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <span
                    className={cn(
                        "w-2 h-2 rounded-full",
                        fulfilled ? "bg-green-500" : "bg-yellow-500",
                    )}
                />
                <span className="text-sm font-medium">{cred.name}</span>
                {fulfilled && !isEditing && (
                    <>
                        <span className="text-xs text-muted-foreground">— Connected</span>
                        <div className="ml-auto flex gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-muted-foreground"
                                onClick={() =>
                                    setEditingCredentials((prev) => new Set(prev).add(cred.id))
                                }
                            >
                                Edit
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-destructive"
                                onClick={handleDisconnect}
                            >
                                Disconnect
                            </Button>
                        </div>
                    </>
                )}
            </div>

            {(!fulfilled || isEditing) && (
                <>
                    {cred.description && (
                        <p className="text-xs text-muted-foreground">{cred.description}</p>
                    )}

                    <RedirectUriHint skillName={skillName} />

                    {cred.fields && (
                        <div className="space-y-2">
                            {cred.fields.map((field) => {
                                const storageKey = cred.storeAs
                                    ? `${cred.storeAs}.${field.key}`
                                    : `skill.${skillName}.${cred.id}.${field.key}`;
                                return (
                                    <div key={field.key} className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                                        <Input
                                            type={field.type === "secret" ? "password" : "text"}
                                            value={credentialInputs[storageKey] ?? ""}
                                            onChange={(e) =>
                                                setCredentialInputs((prev) => ({ ...prev, [storageKey]: e.target.value }))
                                            }
                                            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <Button
                        onClick={hasFields ? handleSaveAndConnect : handleConnect}
                        disabled={connecting || (!hasFields && !fieldsSaved && !fulfilled)}
                        className="w-full"
                    >
                        {connecting
                            ? "Opening authorization..."
                            : hasFields
                                ? "Save & Connect"
                                : fulfilled || fieldsSaved
                                    ? "Reconnect"
                                    : "Enter credentials above"}
                    </Button>
                </>
            )}
        </div>
    );
}

function MultiInstanceCredentials({
    cred,
    skillName,
    onChanged,
}: {
    cred: SkillCredentialDef;
    skillName: string;
    onChanged: () => Promise<void>;
}) {
    const [instances, setInstances] = useState<CredentialInstanceInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [newLabel, setNewLabel] = useState("");
    const [fieldInputs, setFieldInputs] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const registryKey = cred.storeAs
        ? `${cred.storeAs}._instances`
        : `skill.${skillName}.${cred.id}._instances`;

    const loadInstances = useCallback(async () => {
        try {
            const res = await api.credentials.get(registryKey);
            setInstances(JSON.parse(res.value));
        } catch {
            setInstances([]);
        } finally {
            setLoading(false);
        }
    }, [registryKey]);

    useEffect(() => {
        loadInstances();
    }, [loadInstances]);

    function getFieldKey(instanceId: string, fieldKey: string) {
        return cred.storeAs
            ? `${cred.storeAs}.${instanceId}.${fieldKey}`
            : `skill.${skillName}.${cred.id}.${instanceId}.${fieldKey}`;
    }

    async function handleSaveInstance() {
        if (!newLabel.trim()) return;
        setSaving(true);
        try {
            const instanceId = slugify(newLabel);
            if (!instanceId) return;

            // Save each field
            for (const field of cred.fields ?? []) {
                const value = fieldInputs[field.key];
                if (value?.trim()) {
                    await api.credentials.set(
                        getFieldKey(instanceId, field.key),
                        value,
                    );
                }
            }

            // Update instances registry
            const updated = [
                ...instances,
                { id: instanceId, label: newLabel.trim() },
            ];
            await api.credentials.set(registryKey, JSON.stringify(updated));

            setInstances(updated);
            setNewLabel("");
            setFieldInputs({});
            setAdding(false);
            await onChanged();
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteInstance(instanceId: string) {
        setSaving(true);
        try {
            // Delete all field keys for this instance
            for (const field of cred.fields ?? []) {
                try {
                    await api.credentials.delete(
                        getFieldKey(instanceId, field.key),
                    );
                } catch {
                    // Key may not exist
                }
            }

            // Update registry
            const updated = instances.filter((i) => i.id !== instanceId);
            if (updated.length > 0) {
                await api.credentials.set(
                    registryKey,
                    JSON.stringify(updated),
                );
            } else {
                try {
                    await api.credentials.delete(registryKey);
                } catch {
                    // Already gone
                }
            }

            setInstances(updated);
            if (expandedId === instanceId) setExpandedId(null);
            await onChanged();
        } finally {
            setSaving(false);
        }
    }

    async function handleUpdateInstance(instanceId: string) {
        setSaving(true);
        try {
            for (const field of cred.fields ?? []) {
                const value = fieldInputs[`${instanceId}.${field.key}`];
                if (value?.trim()) {
                    await api.credentials.set(
                        getFieldKey(instanceId, field.key),
                        value,
                    );
                }
            }
            setFieldInputs((prev) => {
                const next = { ...prev };
                for (const field of cred.fields ?? []) {
                    delete next[`${instanceId}.${field.key}`];
                }
                return next;
            });
            setExpandedId(null);
            await onChanged();
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="text-xs text-muted-foreground">
                Loading accounts...
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <span
                    className={cn(
                        "w-2 h-2 rounded-full",
                        instances.length > 0 ? "bg-green-500" : "bg-yellow-500",
                    )}
                />
                <span className="text-sm font-medium">{cred.name}</span>
                <span className="text-xs text-muted-foreground">
                    {instances.length > 0
                        ? `${instances.length} account${instances.length > 1 ? "s" : ""}`
                        : "No accounts"}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-6 px-2 text-xs"
                    onClick={() => {
                        setAdding(!adding);
                        setExpandedId(null);
                    }}
                >
                    <Plus className="h-3 w-3 mr-1" />
                    Add account
                </Button>
            </div>

            {cred.description && instances.length === 0 && !adding && (
                <p className="text-xs text-muted-foreground">
                    {cred.description}
                </p>
            )}

            {/* Existing instances */}
            {instances.map((inst) => (
                <div
                    key={inst.id}
                    className="rounded-md border bg-background p-3 space-y-2"
                >
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground/80"
                            onClick={() =>
                                setExpandedId(
                                    expandedId === inst.id ? null : inst.id,
                                )
                            }
                        >
                            <ChevronRight
                                className={cn(
                                    "h-3 w-3 transition-transform",
                                    expandedId === inst.id && "rotate-90",
                                )}
                            />
                            {inst.label}
                        </button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteInstance(inst.id)}
                            disabled={saving}
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>

                    {expandedId === inst.id && cred.fields && (
                        <div className="space-y-2 pt-1">
                            {cred.fields.map((field) => (
                                <div key={field.key} className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        {field.label}
                                    </label>
                                    <Input
                                        type={
                                            field.type === "secret"
                                                ? "password"
                                                : "text"
                                        }
                                        value={
                                            fieldInputs[
                                                `${inst.id}.${field.key}`
                                            ] ?? ""
                                        }
                                        onChange={(e) =>
                                            setFieldInputs((prev) => ({
                                                ...prev,
                                                [`${inst.id}.${field.key}`]:
                                                    e.target.value,
                                            }))
                                        }
                                        placeholder={`Update ${field.label.toLowerCase()}...`}
                                    />
                                </div>
                            ))}
                            <Button
                                size="sm"
                                className="w-full"
                                onClick={() => handleUpdateInstance(inst.id)}
                                disabled={
                                    saving ||
                                    !(cred.fields ?? []).some(
                                        (f) =>
                                            fieldInputs[
                                                `${inst.id}.${f.key}`
                                            ]?.trim(),
                                    )
                                }
                            >
                                Update
                            </Button>
                        </div>
                    )}
                </div>
            ))}

            {/* Add new instance form */}
            {adding && (
                <div className="rounded-md border border-dashed bg-background p-3 space-y-2">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                            Account name
                        </label>
                        <Input
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            placeholder='e.g. "Work Gmail", "Support"'
                            autoFocus
                        />
                    </div>
                    {(cred.fields ?? []).map((field) => (
                        <div key={field.key} className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">
                                {field.label}
                            </label>
                            <Input
                                type={
                                    field.type === "secret" ? "password" : "text"
                                }
                                value={fieldInputs[field.key] ?? ""}
                                onChange={(e) =>
                                    setFieldInputs((prev) => ({
                                        ...prev,
                                        [field.key]: e.target.value,
                                    }))
                                }
                                placeholder={
                                    field.placeholder ??
                                    `Enter ${field.label.toLowerCase()}...`
                                }
                            />
                        </div>
                    ))}
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            className="flex-1"
                            onClick={handleSaveInstance}
                            disabled={
                                saving ||
                                !newLabel.trim() ||
                                !(cred.fields ?? [])
                                    .filter((f) => f.required !== false)
                                    .every((f) => fieldInputs[f.key]?.trim())
                            }
                        >
                            {saving ? "Saving..." : "Save account"}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setAdding(false);
                                setNewLabel("");
                                setFieldInputs({});
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function SkillFavicon({
    homepage,
    size = 24,
}: {
    homepage: string | null;
    size?: number;
}) {
    const faviconUrl = getFaviconUrl(homepage);

    if (!faviconUrl) {
        return (
            <div
                className="flex items-center justify-center rounded bg-muted"
                style={{ width: size, height: size }}
            >
                <Puzzle className="h-4 w-4 text-muted-foreground" />
            </div>
        );
    }

    return (
        <img
            src={faviconUrl}
            alt=""
            width={size}
            height={size}
            className="rounded"
        />
    );
}

function SkillCard({
    skill,
    onClick,
}: {
    skill: SkillInfo;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="relative overflow-hidden flex flex-col items-center gap-3 rounded-lg border bg-card p-5 transition-colors hover:bg-accent/50 text-center"
        >
            {/* Status badge */}
            <Badge
                className={cn(
                    "absolute top-2 right-2 text-[10px] px-1.5 py-0",
                    skill.eligible
                        ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/40"
                        : "text-muted-foreground border-border bg-transparent hover:bg-transparent",
                )}
                variant={skill.eligible ? "default" : "outline"}
            >
                {skill.eligible ? "Active" : "Inactive"}
            </Badge>

            {/* Favicon */}
            <SkillFavicon homepage={skill.homepage} size={32} />

            {/* Name */}
            <span className="text-sm font-medium">
                {formatSkillName(skill.name)}
            </span>

            {/* Description */}
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {skill.description}
            </p>

            {/* Green convex shine at bottom for active skills */}
            {skill.eligible && (
                <div
                    className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 h-16 w-3/4 rounded-[50%]"
                    style={{
                        background:
                            "radial-gradient(ellipse at center, rgba(74, 222, 128, 0.45) 0%, rgba(74, 222, 128, 0.15) 40%, transparent 70%)",
                    }}
                />
            )}
        </button>
    );
}

function ModelSelect({
    providers,
    value,
    onChange,
}: {
    providers: Provider[];
    value: string;
    onChange: (value: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    // Parse current value to get label
    const selectedLabel = useMemo(() => {
        if (!value) return null;
        for (const provider of providers) {
            const models = MODELS_BY_PROVIDER[provider.id] ?? [];
            const match = models.find(
                (m) =>
                    `${PROVIDER_STORE_IDS[provider.id] ?? provider.id}:${m.id}` === value,
            );
            if (match) return `${match.label}`;
        }
        return value;
    }, [value, providers]);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={cn(
                    "flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:bg-accent/50",
                    !selectedLabel && "text-muted-foreground",
                )}
            >
                <span>{selectedLabel ?? "Auto-detect"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {open && (
                <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-lg border bg-popover p-1 shadow-md">
                    <button
                        type="button"
                        onClick={() => {
                            onChange("");
                            setOpen(false);
                        }}
                        className={cn(
                            "flex w-full items-center rounded-md px-2 py-1.5 text-xs transition-colors",
                            !value
                                ? "bg-accent text-accent-foreground"
                                : "text-popover-foreground hover:bg-accent/50",
                        )}
                    >
                        Auto-detect
                    </button>
                    {providers.map((provider) => {
                        const models =
                            MODELS_BY_PROVIDER[provider.id] ?? [];
                        if (models.length === 0) return null;
                        const storeId =
                            PROVIDER_STORE_IDS[provider.id] ?? provider.id;
                        return (
                            <div key={provider.id}>
                                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    {provider.name}
                                </div>
                                {models.map((model) => {
                                    const modelValue = `${storeId}:${model.id}`;
                                    return (
                                        <button
                                            key={model.id}
                                            type="button"
                                            onClick={() => {
                                                onChange(modelValue);
                                                setOpen(false);
                                            }}
                                            className={cn(
                                                "flex w-full items-center rounded-md px-2 py-1.5 text-xs transition-colors",
                                                value === modelValue
                                                    ? "bg-accent text-accent-foreground"
                                                    : "text-popover-foreground hover:bg-accent/50",
                                            )}
                                        >
                                            {model.label}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
