import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

export async function GET(req: NextRequest, { params }: { params: Promise<{ videoId: string, vType: string }> }) {
    try {
        const { videoId, vType } = await params;

        // Forward Range header for video seeking support
        const rangeHeader = req.headers.get('range');
        const fetchHeaders: Record<string, string> = {};
        if (rangeHeader) {
            fetchHeaders['Range'] = rangeHeader;
        }

        const res = await fetch(`${API_URL}/api/serve-video/${videoId}/${vType}`, {
            headers: fetchHeaders,
        });

        if (!res.ok && res.status !== 206) {
            return new NextResponse('Video not found', { status: res.status });
        }

        const contentType = res.headers.get('Content-Type') || 'video/mp4';
        const headers = new Headers();
        headers.set('Content-Type', contentType);

        // Copy range-related headers for proper video streaming
        const forwardHeaders = ['Content-Length', 'Content-Range', 'Accept-Ranges'];
        for (const h of forwardHeaders) {
            const val = res.headers.get(h);
            if (val) headers.set(h, val);
        }

        // Always inline — never force download for video playback
        headers.set('Content-Disposition', 'inline');
        headers.set('Cache-Control', 'no-store');

        return new NextResponse(res.body, {
            status: res.status,
            headers,
        });
    } catch (e: any) {
        return new NextResponse(e.message, { status: 500 });
    }
}
