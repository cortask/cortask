import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const SKILL_TEMPLATE = `---
name: my-skill
description: Describe what this skill does and when the agent should use it
metadata:
  tags: []
  emoji: ""
always: true
---

## Instructions

Describe what the agent should do when this skill is activated...

## When to Use

- When the user asks about...

## When NOT to Use

- When...
`;

interface SkillEditorProps {
    open: boolean;
    mode: "create" | "edit";
    skillName?: string;
    initialContent?: string;
    onSave: () => void;
    onClose: () => void;
}

export function SkillEditor({
    open,
    mode,
    skillName,
    initialContent,
    onSave,
    onClose,
}: SkillEditorProps) {
    const [name, setName] = useState(skillName ?? "");
    const [content, setContent] = useState(
        initialContent ?? SKILL_TEMPLATE,
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleNameChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            // Auto-enforce kebab-case
            const val = e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, "-")
                .replace(/--+/g, "-")
                .replace(/^-/, "");
            setName(val);
        },
        [],
    );

    const handleSave = useCallback(async () => {
        setError(null);
        setSaving(true);
        try {
            if (mode === "create") {
                if (!name || name.length < 2) {
                    setError("Skill name must be at least 2 characters");
                    setSaving(false);
                    return;
                }
                await api.skills.create({ name, content });
            } else {
                await api.skills.update(skillName!, { content });
            }
            onSave();
            onClose();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to save skill",
            );
        } finally {
            setSaving(false);
        }
    }, [mode, name, content, skillName, onSave, onClose]);

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col bg-card p-0">
                <DialogHeader className="px-6 pt-6 pb-2">
                    <DialogTitle>
                        {mode === "create"
                            ? "Create custom skill"
                            : `Edit skill: ${skillName}`}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col flex-1 overflow-hidden px-6 pb-6 gap-4">
                    {mode === "create" && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-muted-foreground">
                                Skill name (kebab-case)
                            </label>
                            <Input
                                value={name}
                                onChange={handleNameChange}
                                placeholder="my-custom-skill"
                                className="font-mono text-sm max-w-xs"
                            />
                        </div>
                    )}

                    <div className="flex flex-col flex-1 min-h-0 gap-1.5">
                        <label className="text-sm font-medium text-muted-foreground">
                            SKILL.md content
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="flex-1 min-h-0 w-full rounded-md border bg-muted/40 p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                            spellCheck={false}
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving
                                ? "Saving..."
                                : mode === "create"
                                  ? "Create skill"
                                  : "Save changes"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
