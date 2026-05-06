import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUPPORTED_LOCALES, localeLabel } from "@/lib/locales";

interface Props {
  current: string;
  available: string[];
  onChange: (code: string) => void;
}

export function LanguageSwitcher({ current, available, onChange }: Props) {
  // Only show if there's at least one non-English translation available.
  const options = ["en", ...SUPPORTED_LOCALES.map((l) => l.code).filter((c) => available.includes(c))];
  if (options.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
      {options.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onChange(code)}
          className={cn(
            "text-xs rounded-full border px-2 py-0.5 transition-colors",
            current === code
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground hover:bg-muted",
          )}
        >
          {code === "en" ? "English" : localeLabel(code)}
        </button>
      ))}
    </div>
  );
}