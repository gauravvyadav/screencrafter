// Shared types used across popup, dashboard, and editor

export interface CaptureItem {
  id?: string;
  image?: string;
  fragments?: any[];
  url?: string;
  title?: string;
  timestamp: number;
  type?: string;
  fullWidth?: number;
  fullHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}
