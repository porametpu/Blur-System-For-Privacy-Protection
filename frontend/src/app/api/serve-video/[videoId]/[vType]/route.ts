import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

export async function GET(req: NextRequest, { params }: { params: Promise<{ videoId: string, vType: string }> }) {
    try {
        const { videoId, vType } = await params;
        
        // Fetch the video from the backend
        const res = await fetch(`${API_URL}/api/serve-video/${videoId}/${vType}`);
        
        if (!res.ok) {
            return new NextResponse('Video not found', { status: res.status });
        }
        
        // Forward the backend response stream to the client
        const headers = new Headers();
        headers.set('Content-Type', res.headers.get('Content-Type') || 'video/mp4');
        headers.set('Content-Length', res.headers.get('Content-Length') || '');
        if (res.headers.has('Accept-Ranges')) {
            headers.set('Accept-Ranges', res.headers.get('Accept-Ranges')!);
        }
        if (res.headers.has('Content-Range')) {
            headers.set('Content-Range', res.headers.get('Content-Range')!);
        }
        if (res.headers.has('content-disposition')) {
            headers.set('Content-Disposition', res.headers.get('content-disposition')!);
        } else {
            const ext = res.headers.get('Content-Type')?.includes('image') ? 'jpg' : 'mp4';
            headers.set('Content-Disposition', `attachment; filename="blurred_${videoId}.${ext}"`);
        }

        return new NextResponse(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers: headers,
        });
    } catch (e: any) {
        return new NextResponse(e.message, { status: 500 });
    }
}
