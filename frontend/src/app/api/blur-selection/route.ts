import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const res = await fetch(`${API_URL}/api/update-blur-selection`, {
            method: 'POST',
            body: formData as any
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
