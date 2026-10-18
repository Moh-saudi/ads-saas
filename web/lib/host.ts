export function normalizeHost(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!value || /[\s,\/@\\?#]/.test(value)) return "";
  try {
    return new URL(`http://${value}`).hostname.replace(/\.$/, "");
  } catch {
    return "";
  }
}
