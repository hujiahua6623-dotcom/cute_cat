/** Vite `base` prefix for files under `public/` (e.g. GitHub Pages subpath). */
export function gameAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const normalized = path.replace(/^\//, "");
  return base.endsWith("/") ? `${base}${normalized}` : `${base}/${normalized}`;
}
