import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { loadSession } = await import('../../../../lib/session');
    const session = loadSession(id);
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(session);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
