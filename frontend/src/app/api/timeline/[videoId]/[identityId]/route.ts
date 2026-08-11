import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

export async function GET(req: NextRequest, { params }: { params: Promise<{ videoId: string, identityId: string }> }) {
    try {
        const { videoId, identityId } = await params;
        const res = await fetch(`${API_URL}/api/timeline/${videoId}/${identityId}`);
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
