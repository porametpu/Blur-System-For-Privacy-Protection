import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

export async function GET(req: NextRequest, { params }: { params: Promise<{ videoId: string, frameNumber: string }> }) {
    try {
        const { videoId, frameNumber } = await params;
        const res = await fetch(`${API_URL}/api/thumbnail/${videoId}/${frameNumber}`);
        if (!res.ok) {
            return new NextResponse('Not found', { status: res.status });
        }
        const blob = await res.blob();
        return new NextResponse(blob, {
            headers: { 'Content-Type': 'image/jpeg' }
        });
    } catch (e: any) {
        return new NextResponse(e.message, { status: 500 });
    }
}
