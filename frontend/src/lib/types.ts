export interface Video {
  video_id: number;
  filename: string;
  fps: number;
  width: number;
  height: number;
  total_frames: number;
  duration_seconds: number;
}

export interface PreviewFrame {
  frame_number: number;
  timestamp_ms: number;
  thumbnail_url: string;
}

export interface DetectedPerson {
  id: number;
  label: string;
  representative_thumbnail: string; // base64
  appearance_count: number;
  avg_confidence: number;
  should_blur: boolean;
  timeline_summary: TimelineEntry[];
}

export interface TimelineEntry {
  frame_number: number;
  timestamp_ms: number;
  timestamp_formatted: string;
}

export interface BlurSelection {
  identity_id: number;
  should_blur: boolean;
}

export type AppStep = 'upload' | 'tools_selection' | 'face_map' | 'preview' | 'keyframes' | 'detecting' | 'results' | 'blur_manager' | 'preview_blur' | 'export' | 'manual_control';

export type BlurType = 'gaussian' | 'pixelate' | 'black' | 'sticker';

export interface ManualBlurBox {
  id?: number;
  start_frame_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  is_tracking?: boolean;
}
