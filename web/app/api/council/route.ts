import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

const pendingJobs = new Map<string, { decision: string; selectedMemberIds: string[] }>();

export async function POST(req: NextRequest) {
  try {
    const { decision, selectedMemberIds } = await req.json();
    if (!decision || !selectedMemberIds?.length) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const sessionId = nanoid(8);
    pendingJobs.set(sessionId, { decision, selectedMemberIds });
    return NextResponse.json({ sessionId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return new NextResponse('Missing sessionId', { status: 400 });

  const job = pendingJobs.get(sessionId);
  if (!job) return new NextResponse('Job not found or expired', { status: 404 });
  pendingJobs.delete(sessionId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
      };
      try {
        const { runCouncil } = await import('../../../lib/council');
        const session = await runCouncil(job.decision, job.selectedMemberIds, (event) => send(event));
        send({ type: 'session_done', session });
      } catch (e: any) {
        send({ type: 'error', message: e.message || 'Unknown error' });
      } finally {
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  });
}
