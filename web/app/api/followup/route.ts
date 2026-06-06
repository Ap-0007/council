import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, question, targetMemberId } = await req.json();
    if (!sessionId || !question || !targetMemberId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const { loadSession } = await import('../../../lib/session');
    const { runFollowUp } = await import('../../../lib/council');
    const session = loadSession(sessionId);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const followUp = await runFollowUp(session, question, targetMemberId);
    return NextResponse.json(followUp);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
