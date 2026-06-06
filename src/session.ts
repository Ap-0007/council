import fs from 'fs';
import path from 'path';
import { CouncilSession, SessionMeta } from './types.js';

const SESSIONS_DIR = './sessions';
const EXPORTS_DIR = './exports';

export function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

export function ensureExportsDir() {
  if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

export function saveSession(session: CouncilSession) {
  ensureSessionsDir();
  try {
    fs.writeFileSync(path.join(SESSIONS_DIR, `${session.sessionId}.json`), JSON.stringify(session, null, 2));
  } catch (e) {
    console.warn(`Failed to save session ${session.sessionId}`);
  }
}

export function listSessions(): SessionMeta[] {
  ensureSessionsDir();
  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
  const sessions = files.map(file => {
    try {
      const data = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf8');
      const session = JSON.parse(data) as CouncilSession;
      return {
        sessionId: session.sessionId,
        timestamp: session.timestamp,
        decisionType: session.decisionType,
        preview: session.rawDecision.slice(0, 80)
      } as SessionMeta;
    } catch {
      return null;
    }
  }).filter(Boolean) as SessionMeta[];

  sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return sessions;
}

export function loadSession(id: string): CouncilSession | null {
  ensureSessionsDir();
  try {
    const data = fs.readFileSync(path.join(SESSIONS_DIR, `${id}.json`), 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function searchSessions(keyword: string): SessionMeta[] {
  const sessions = listSessions();
  const kw = keyword.toLowerCase();
  return sessions.filter(s => s.preview.toLowerCase().includes(kw) || s.decisionType.toLowerCase().includes(kw));
}

export function exportToMarkdown(session: CouncilSession): string {
  ensureExportsDir();
  let md = `# Decision Report: ${session.sessionId}\n\n`;
  md += `**Date**: ${new Date(session.timestamp).toLocaleString()}\n`;
  md += `**Type**: ${session.decisionType}\n\n`;
  md += `## The Decision\n${session.rawDecision}\n\n`;
  
  if (session.contextUsed) {
    md += `## Context Included\n${session.contextUsed}\n\n`;
  }

  md += `## Member Perspectives\n\n`;
  session.memberResponses.forEach(r => {
    md += `### ${r.memberName}\n`;
    md += `${r.auditedResponse}\n\n`;
  });

  md += `## Synthesis\n\n`;
  md += `**Consensus**: ${session.synthesis.consensus}\n\n`;
  md += `**Core Tension**: ${session.synthesis.coreTension}\n\n`;
  md += `**Final Verdict**: ${session.synthesis.finalVerdict}\n\n`;
  
  if (session.followUps && session.followUps.length > 0) {
    md += `## Follow-up Questions\n\n`;
    session.followUps.forEach(f => {
      md += `**Q: ${f.question}**\n\n`;
      md += `${f.targetMemberId === 'council' ? 'The Council' : f.targetMemberId} responded:\n${f.response}\n\n`;
    });
  }

  const filePath = path.join(EXPORTS_DIR, `${session.sessionId}.md`);
  fs.writeFileSync(filePath, md);
  return filePath;
}
