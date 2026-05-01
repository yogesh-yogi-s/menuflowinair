import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink } from "lucide-react";
import { getCredentialSchema } from "@/server/platforms/credentials";
import type { PlatformId } from "@/server/platforms";

interface Props {
  platform: PlatformId;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

export function CredentialForm({ platform, values, onChange }: Props) {
  const schema = getCredentialSchema(platform);
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{schema.helpText}</p>
      {schema.fields.map((f) => (
        <div key={f.name} className="space-y-1">
          <Label className="text-xs">
            {f.label}
            {f.required && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            type={f.type}
            value={values[f.name] ?? ""}
            placeholder={f.placeholder}
            onChange={(e) => onChange({ ...values, [f.name]: e.target.value })}
          />
        </div>
      ))}
      <a
        href={schema.helpUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        Where do I find these? <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

export function isCredentialFormComplete(
  platform: PlatformId,
  values: Record<string, string>,
): boolean {
  const schema = getCredentialSchema(platform);
  return schema.fields
    .filter((f) => f.required)
    .every((f) => (values[f.name] ?? "").trim().length > 0);
}