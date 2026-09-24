import { NextResponse } from 'next/server';

const API_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

export async function GET() {
    try {
        const res = await fetch(`${API_URL}/api/model-file/onnx`, {
            // Pass cache headers through so browser caches the large file
            cache: 'force-cache',
        });
        if (!res.ok) {
            return NextResponse.json(
                { error: 'ONNX model not available' },
                { status: res.status }
            );
        }
        // Stream the binary directly — avoids loading the whole file into memory
        return new Response(res.body, {
            status: 200,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': 'inline; filename="yolo26n-face.onnx"',
                'Cache-Control': 'public, max-age=86400',
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
