import { useState, useEffect, useRef } from "react";
import {
  LayoutTemplate,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
} from "lucide-react";
import { api, type PromptTemplate } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TemplateMenuProps {
  onSelect: (content: string) => void;
  currentInput?: string;
  disabled?: boolean;
}

export function TemplateMenu({
  onSelect,
  currentInput,
  disabled,
}: TemplateMenuProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(
    null,
  );
  const [formName, setFormName] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("General");
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchTemplates = async () => {
    try {
      const list = await api.templates.list();
      setTemplates(list);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (open || manageOpen) fetchTemplates();
  }, [open, manageOpen]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Group by category
  const grouped = new Map<string, PromptTemplate[]>();
  for (const t of templates) {
    if (!grouped.has(t.category)) grouped.set(t.category, []);
    grouped.get(t.category)!.push(t);
  }

  const handleSelect = (t: PromptTemplate) => {
    onSelect(t.content);
    setOpen(false);
  };

  const openCreate = (prefill?: string) => {
    setEditingTemplate(null);
    setFormName("");
    setFormContent(prefill ?? "");
    setFormCategory("General");
    setManageOpen(true);
    setOpen(false);
  };

  const openEdit = (t: PromptTemplate) => {
    setEditingTemplate(t);
    setFormName(t.name);
    setFormContent(t.content);
    setFormCategory(t.category);
    setManageOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formContent.trim()) return;
    if (editingTemplate) {
      await api.templates.update(editingTemplate.id, {
        name: formName.trim(),
        content: formContent.trim(),
        category: formCategory.trim() || "General",
      });
    } else {
      await api.templates.create(
        formName.trim(),
        formContent.trim(),
        formCategory.trim() || "General",
      );
    }
    setManageOpen(false);
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    await api.templates.delete(id);
    fetchTemplates();
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={disabled}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          title="Prompt templates"
        >
          <LayoutTemplate className="h-4 w-4" />
        </button>

        {open && (
          <div className="absolute bottom-full right-0 mb-1 w-64 rounded-lg border bg-popover p-1 shadow-md max-h-80 overflow-y-auto">
            {templates.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                No templates yet
              </div>
            ) : (
              Array.from(grouped.entries()).map(([category, items]) => (
                <div key={category}>
                  <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {category}
                  </div>
                  {items.map((t) => (
                    <div
                      key={t.id}
                      className="group flex items-center rounded-md px-2 py-1.5 text-xs text-popover-foreground hover:bg-accent/50 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(t)}
                        className="flex-1 text-left truncate"
                      >
                        {t.name}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(t);
                        }}
                        className="p-0.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-all shrink-0 ml-1"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}

            <div className="border-t mt-1 pt-1 space-y-0.5">
              {currentInput?.trim() && (
                <button
                  type="button"
                  onClick={() => openCreate(currentInput)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
                >
                  <Save className="h-3 w-3" />
                  Save current as template
                </button>
              )}
              <button
                type="button"
                onClick={() => openCreate()}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
              >
                <Plus className="h-3 w-3" />
                New template
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "New Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Summarize"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-category">Category</Label>
              <Input
                id="tpl-category"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="General"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-content">Prompt content</Label>
              <textarea
                id="tpl-content"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Write your template prompt..."
                rows={5}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>

          {/* Existing templates list when creating (manage mode) */}
          {!editingTemplate && templates.length > 0 && (
            <div className="border-t pt-3 mt-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Existing templates
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-accent/30"
                  >
                    <span className="truncate flex-1">
                      <span className="text-muted-foreground mr-1.5">
                        {t.category}:
                      </span>
                      {t.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className={cn(
                          "p-1 rounded text-muted-foreground hover:text-foreground transition-colors",
                        )}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageOpen(false)}>
              <X className="h-3.5 w-3.5 mr-1.5" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formName.trim() || !formContent.trim()}
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {editingTemplate ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
