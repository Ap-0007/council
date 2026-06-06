import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { listSessions } = await import('../../../lib/session');
    const sessions = listSessions();
    return NextResponse.json(sessions);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
