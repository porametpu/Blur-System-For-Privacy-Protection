import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization');
        const res = await fetch(`${API_URL}/api/history`, {
            headers: {
                ...(authHeader ? { 'Authorization': authHeader } : {})
            }
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
