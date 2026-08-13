import { Video, PreviewFrame, DetectedPerson, TimelineEntry, BlurSelection, BlurType } from './types';

const getAuthHeader = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const uploadVideo = async (file: File): Promise<Video> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', {
        method: 'POST',
        headers: getAuthHeader(),
        body: fd
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const getPreviewFrames = async (videoId: number): Promise<PreviewFrame[]> => {
    const res = await fetch(`/api/preview-frames/${videoId}`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.frames;
};

export const selectKeyframes = async (videoId: number, keyframeIndices: number[]): Promise<void> => {
    const fd = new FormData();
    fd.append('video_id', videoId.toString());
    fd.append('keyframe_indices', JSON.stringify(keyframeIndices));
    const res = await fetch('/api/select-keyframes', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
};

export const startDetection = async (videoId: number, keyframeIndices: number[], skipFrames: number = 5): Promise<any> => {
    const fd = new FormData();
    fd.append('keyframe_indices', JSON.stringify(keyframeIndices));
    fd.append('skip_frames', skipFrames.toString());
    const res = await fetch(`/api/start-detection/${videoId}`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const checkStatus = async (videoId: number): Promise<any> => {
    const res = await fetch(`/api/status/${videoId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const getRecognizedPersons = async (videoId: number): Promise<DetectedPerson[]> => {
    const res = await fetch(`/api/recognized-persons/${videoId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const updateBlurSelections = async (videoId: number, selections: BlurSelection[]): Promise<void> => {
    const fd = new FormData();
    fd.append('video_id', videoId.toString());
    fd.append('selections', JSON.stringify(selections));
    const res = await fetch('/api/blur-selection', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
};

export const renderPreview = async (videoId: number, blurType: string = 'gaussian', blurStrength: number = 31, stickerImage?: string): Promise<{ preview_url: string }> => {
    const fd = new FormData();
    fd.append('blur_type', blurType);
    fd.append('blur_strength', blurStrength.toString());
    if (stickerImage) fd.append('sticker_image', stickerImage);
    const res = await fetch(`/api/preview-video/${videoId}`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const exportVideo = async (videoId: number, blurType: string, blurStrength: number, stickerImage?: string): Promise<{ download_url: string, cloudinary_url?: string }> => {
    const fd = new FormData();
    fd.append('blur_type', blurType);
    fd.append('blur_strength', blurStrength.toString());
    if (stickerImage) fd.append('sticker_image', stickerImage);
    const res = await fetch(`/api/export-video/${videoId}`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const getTimeline = async (videoId: number, identityId: number): Promise<TimelineEntry[]> => {
    const res = await fetch(`/api/timeline/${videoId}/${identityId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const getManualBlurBoxes = async (videoId: number): Promise<{boxes: any[]}> => {
    const res = await fetch(`/api/manual-blur/${videoId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const saveManualBlurBoxes = async (videoId: number, boxes: any[]): Promise<void> => {
    const res = await fetch(`/api/manual-blur/${videoId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ boxes })
    });
    if (!res.ok) throw new Error(await res.text());
};

export const registerUser = async (data: { email: str; password: str; full_name?: string }) => {
    const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || err.error || 'Registration failed');
    }
    return res.json();
};

export const loginUser = async (data: { email: str; password: str }) => {
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || err.error || 'Login failed');
    }
    return res.json();
};

export const googleLoginUser = async (data: { token?: string; email: string; full_name?: string; google_id: string; avatar_url?: string }) => {
    const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || err.error || 'Google login failed');
    }
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
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};
