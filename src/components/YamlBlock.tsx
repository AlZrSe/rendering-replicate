import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

function highlight(line: string) {
  const m = /^(\s*)([\w.-]+)(:)(.*)$/.exec(line);
  if (!m) {
    const dash = /^(\s*)(- )(.*)$/.exec(line);
    if (dash)
      return (
        <>
          <span>{dash[1]}</span>
          <span className="text-muted-foreground">{dash[2]}</span>
          <span className="text-success">{dash[3]}</span>
        </>
      );
    return <span className="text-muted-foreground">{line}</span>;
  }
  return (
    <>
      <span>{m[1]}</span>
      <span className="text-primary">{m[2]}</span>
      <span className="text-muted-foreground">{m[3]}</span>
      <span className="text-success">{m[4]}</span>
    </>
  );
}

export function YamlBlock({ yaml, filename }: { yaml: string; filename?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-mono text-xs text-muted-foreground">{filename ?? "job.yaml"}</span>
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="max-h-96 overflow-auto bg-secondary/40 p-4 font-mono text-xs leading-relaxed">
        {yaml.split("\n").map((line, i) => (
          <div key={i}>{highlight(line)}</div>
        ))}
      </pre>
    </div>
  );
}
