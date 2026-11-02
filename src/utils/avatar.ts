// Initials avatar generated in the browser (SVG data URI), so no third-party avatar
// service is needed.

const PALETTE = ['#ea580c', '#0d8abc', '#db2777', '#22c55e', '#6366f1', '#f59e0b', '#0f766e', '#7c3aed'];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase().replace(/[^A-Z0-9]/g, '') || '?';
}

function colourFor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function avatarUrl(name?: string | null, background?: string, foreground = '#ffffff'): string {
  const label = name?.trim() || '?';
  const bg = background ?? colourFor(label);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">` +
    `<rect width="128" height="128" fill="${bg}"/>` +
    `<text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="${foreground}" ` +
    `font-family="Inter, Arial, sans-serif" font-size="52" font-weight="600">${initials(label)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
