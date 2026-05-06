export interface LocaleOption {
  code: string;
  label: string;
  rtl?: boolean;
}

export const SUPPORTED_LOCALES: LocaleOption[] = [
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "hi", label: "हिन्दी" },
  { code: "ar", label: "العربية", rtl: true },
];

export function isRtl(code: string): boolean {
  return SUPPORTED_LOCALES.find((l) => l.code === code)?.rtl ?? false;
}

export function localeLabel(code: string): string {
  return SUPPORTED_LOCALES.find((l) => l.code === code)?.label ?? code;
}