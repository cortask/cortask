import { useState } from "react";
import { PanelRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePreviewStore } from "@/stores/previewStore";
import type { ArtifactData } from "@/lib/artifacts";

export function ArtifactViewer({ artifact }: { artifact: ArtifactData }) {
  const [expanded, setExpanded] = useState(false);
  const rawUrl = `/api/artifacts/${artifact.artifactId}?raw`;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card className="overflow-hidden mt-2">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-3 py-2 bg-secondary cursor-pointer">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="uppercase text-xs">
                {artifact.type}
              </Badge>
              <span className="text-sm">{artifact.title}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {expanded ? "Collapse" : "Expand"}
            </span>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="bg-card">
            {artifact.type === "image" ? (
              <img
                src={rawUrl}
                alt={artifact.title}
                className="w-full max-h-[500px] object-contain"
              />
            ) : artifact.type === "html" || artifact.type === "svg" ? (
              <iframe
                src={rawUrl}
                title={artifact.title}
                className="w-full h-80 border-0"
                sandbox="allow-scripts"
              />
            ) : artifact.type === "csv" ? (
              <div className="p-3 overflow-x-auto">
                <CsvTable url={rawUrl} />
              </div>
            ) : (
              <pre className="p-3 text-xs text-muted-foreground whitespace-pre-wrap overflow-x-auto max-h-80">
                Loading...
              </pre>
            )}
            <div className="px-3 py-2 border-t flex items-center gap-3">
              <a
                href={rawUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Open raw
              </a>
              <OpenInPanelButton artifact={artifact} url={rawUrl} />
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function OpenInPanelButton({ artifact, url }: { artifact: ArtifactData; url: string }) {
  const openPreview = usePreviewStore((s) => s.open);

  return (
    <button
      type="button"
      onClick={() =>
        openPreview({ title: artifact.title, url, type: artifact.type })
      }
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <PanelRight className="h-3 w-3" />
      Open in panel
    </button>
  );
}

function CsvTable({ url }: { url: string }) {
  const [rows, setRows] = useState<string[][] | null>(null);

  if (!rows) {
    fetch(url)
      .then((r) => r.text())
      .then((text) => {
        const lines = text.trim().split("\n");
        setRows(lines.map((l) => l.split(",")));
      });
    return <span className="text-xs text-muted-foreground">Loading CSV...</span>;
  }

  if (rows.length === 0) return null;

  const [header, ...body] = rows;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {header.map((h, i) => (
            <TableHead key={i}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {body.slice(0, 50).map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) => (
              <TableCell key={j}>{cell}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

