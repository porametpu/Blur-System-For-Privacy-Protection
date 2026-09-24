import { Video, PreviewFrame, DetectedPerson, TimelineEntry, BlurSelection, BlurType } from './types';

const getAuthHeader = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const handleResponseError = async (res: Response, defaultMsg: string): Promise<never> => {
    let errText = '';
    try {
        const text = await res.text();
        try {
            const json = JSON.parse(text);
            errText = json.detail || json.error || text;
        } catch {
            errText = text || res.statusText || defaultMsg;
        }
    } catch {
        errText = defaultMsg;
    }
    throw new Error(errText || defaultMsg);
};

export const uploadVideo = async (file: File): Promise<Video> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', {
        method: 'POST',
        headers: getAuthHeader(),
        body: fd
    });
    if (!res.ok) await handleResponseError(res, 'Upload failed');
    return res.json();
};

export const getPreviewFrames = async (videoId: number): Promise<PreviewFrame[]> => {
    const res = await fetch(`/api/preview-frames/${videoId}`);
    if (!res.ok) await handleResponseError(res, 'Failed to fetch preview frames');
    const data = await res.json();
    return data.frames;
};

export const selectKeyframes = async (videoId: number, keyframeIndices: number[]): Promise<void> => {
    const fd = new FormData();
    fd.append('video_id', videoId.toString());
    fd.append('keyframe_indices', JSON.stringify(keyframeIndices));
    const res = await fetch('/api/select-keyframes', { method: 'POST', body: fd });
    if (!res.ok) await handleResponseError(res, 'Failed to select keyframes');
};

export const startDetection = async (videoId: number, keyframeIndices: number[], skipFrames: number = 5): Promise<any> => {
    const fd = new FormData();
    fd.append('keyframe_indices', JSON.stringify(keyframeIndices));
    fd.append('skip_frames', skipFrames.toString());
    const res = await fetch(`/api/start-detection/${videoId}`, { method: 'POST', body: fd });
    if (!res.ok) await handleResponseError(res, 'Failed to start detection');
    return res.json();
};

export const checkStatus = async (videoId: number): Promise<any> => {
    const res = await fetch(`/api/status/${videoId}`);
    if (!res.ok) await handleResponseError(res, 'Failed to check status');
    return res.json();
};

export const getRecognizedPersons = async (videoId: number): Promise<DetectedPerson[]> => {
    const res = await fetch(`/api/recognized-persons/${videoId}`);
    if (!res.ok) await handleResponseError(res, 'Failed to fetch recognized persons');
    return res.json();
};

export const updateBlurSelections = async (videoId: number, selections: BlurSelection[]): Promise<void> => {
    const fd = new FormData();
    fd.append('video_id', videoId.toString());
    fd.append('selections', JSON.stringify(selections));
    const res = await fetch('/api/blur-selection', { method: 'POST', body: fd });
    if (!res.ok) await handleResponseError(res, 'Failed to update blur selections');
};

export const renderPreview = async (videoId: number, blurType: string = 'gaussian', blurStrength: number = 31, stickerImage?: string): Promise<{ preview_url: string }> => {
    const fd = new FormData();
    fd.append('blur_type', blurType);
    fd.append('blur_strength', blurStrength.toString());
    if (stickerImage) fd.append('sticker_image', stickerImage);
    const res = await fetch(`/api/preview-video/${videoId}`, { method: 'POST', body: fd });
    if (!res.ok) await handleResponseError(res, 'Failed to render preview');
    return res.json();
};

export const exportVideo = async (videoId: number, blurType: string, blurStrength: number, stickerImage?: string): Promise<{ download_url: string, cloudinary_url?: string }> => {
    const fd = new FormData();
    fd.append('blur_type', blurType);
    fd.append('blur_strength', blurStrength.toString());
    if (stickerImage) fd.append('sticker_image', stickerImage);
    const res = await fetch(`/api/export-video/${videoId}`, { method: 'POST', body: fd });
    if (!res.ok) await handleResponseError(res, 'Failed to export video');
    return res.json();
};

export const getTimeline = async (videoId: number, identityId: number): Promise<TimelineEntry[]> => {
    const res = await fetch(`/api/timeline/${videoId}/${identityId}`);
    if (!res.ok) await handleResponseError(res, 'Failed to fetch timeline');
    return res.json();
};

export const getManualBlurBoxes = async (videoId: number): Promise<{boxes: any[]}> => {
    const res = await fetch(`/api/manual-blur/${videoId}`);
    if (!res.ok) await handleResponseError(res, 'Failed to get manual blur boxes');
    return res.json();
};

export const saveManualBlurBoxes = async (videoId: number, boxes: any[]): Promise<void> => {
    const res = await fetch('/api/manual-blur/' + videoId, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ boxes })
    });
    if (!res.ok) await handleResponseError(res, 'Failed to save manual blur boxes');
};

export const registerUser = async (data: { email: string; password: string; full_name?: string }) => {
    const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) await handleResponseError(res, 'Registration failed');
    return res.json();
};

export const loginUser = async (data: { email: string; password: string }) => {
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) await handleResponseError(res, 'Login failed');
    return res.json();
};

export const googleLoginUser = async (data: { token?: string; email: string; full_name?: string; google_id: string; avatar_url?: string }) => {
    const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) await handleResponseError(res, 'Google login failed');
    return res.json();
};

export const getCurrentUser = async () => {
    const res = await fetch('/api/auth/me', {
        headers: getAuthHeader(),
    });
    if (!res.ok) return null;
    return res.json();
};

export const getUserHistory = async () => {
    const res = await fetch('/api/history', {
        headers: getAuthHeader(),
    });
    if (!res.ok) await handleResponseError(res, 'Failed to fetch user history');
    return res.json();
};

export const getModelBackend = async (): Promise<{
    current: string;
    available: string[];
    export_status: Record<string, string>;
    export_errors: Record<string, string>;
    device: string;
    has_cuda: boolean;
}> => {
    const res = await fetch('/api/model-backend');
    if (!res.ok) await handleResponseError(res, 'Failed to fetch model backend');
    return res.json();
};

export const setModelBackend = async (backend: string): Promise<{
    success: boolean;
    backend: string;
    status: string;
    error?: string;
}> => {
    const res = await fetch('/api/model-backend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backend }),
    });
    if (!res.ok) await handleResponseError(res, 'Failed to switch backend');
    return res.json();
};

export interface FrameDetectionPayload {
    frame_number: number;
    detections: {
        bbox: { x1: number; y1: number; x2: number; y2: number };
        confidence: number;
    }[];
}

export const submitClientDetections = async (
    videoId: number,
    frameDetections: FrameDetectionPayload[]
): Promise<{ status: string }> => {
    const res = await fetch(`/api/submit-detections/${videoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame_detections: frameDetections }),
    });
    if (!res.ok) await handleResponseError(res, 'Failed to submit detections');
    return res.json();
};
