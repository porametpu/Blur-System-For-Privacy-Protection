import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

export async function POST(req: NextRequest, { params }: { params: Promise<{ video_id: string }> }) {
    try {
        const { video_id } = await params;
        const body = await req.json();
        const res = await fetch(`${API_URL}/api/submit-detections/${video_id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
