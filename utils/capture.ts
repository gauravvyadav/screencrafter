import type { CaptureItem } from './types';

/** Get the first available thumbnail from a capture item */
export const getThumbnail = (cap: CaptureItem): string | null => {
  if (cap.image) return cap.image;
  if (cap.fragments?.[0]) {
    const f = cap.fragments[0];
    return typeof f === 'string' ? f : f.dataUrl;
  }
  return null;
};

/** Extract domain from URL, stripping www prefix */
export const getDomain = (url?: string): string => {
  if (!url) return 'Unknown';
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
};

/** Relative time string: "Just now", "5m ago", "2h ago", "3d ago", or a date */
export const formatRelativeDate = (ts: number): string => {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  const d = new Date(ts);
  const now = new Date();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

/** Full date/time string */
export const formatFullDate = (ts: number): string => {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
};

/** Human-readable capture type label */
export const getCaptureTypeLabel = (type?: string): string => {
  if (!type) return 'Visible';
  if (type.includes('full')) return 'Full Page';
  return 'Visible';
};
