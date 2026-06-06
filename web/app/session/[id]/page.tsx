'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

const MEMBER_META: Record<string, { emoji: string; color: string }> = {
  marcus: { emoji: '♟️', color: 'var(--color-marcus)' },
  soren:  { emoji: '🔭', color: 'var(--color-soren)'  },
  rachel: { emoji: '⚙️', color: 'var(--color-rachel)' },
  lena:   { emoji: '🦢', color: 'var(--color-lena)'   },
  arjun:  { emoji: '🌌', color: 'var(--color-arjun)'  },
};

type MemberState = 'pending' | 'running' | 'done' | 'error';

interface LiveMember {
  id: string;
  name: string;
  state: MemberState;
  response?: any;
  thinkingStages?: { id: string; label: string; content: string }[];
}

function ConfidenceRing({ score }: { score: number }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="confidence-ring">
      <svg width="90" height="90" viewBox="0 0 90 90">
        <defs>
          <linearGradient id="confidenceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-bright)" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <circle className="bg" cx="45" cy="45" r={r} fill="none" strokeWidth="8" />
        <circle className="fill" cx="45" cy="45" r={r} fill="none" strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset="0" />
      </svg>
      <div className="confidence-number">{score}%</div>
    </div>
  );
}

const STAGE_META: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  parse:             { label: 'PARSE',             color: '#60a5fa', icon: '🔍', desc: 'Fact inventory & gap analysis'       },
  first_principles:  { label: 'FIRST PRINCIPLES',  color: '#38bdf8', icon: '⚡', desc: 'Fundamental truths & core axioms'     },
  steelman:          { label: 'STEELMAN',          color: '#f472b6', icon: '⚔️', desc: 'Strongest case against own position' },
  pressure_test:     { label: 'PRESSURE TEST',     color: '#fb923c', icon: '🔥', desc: 'Post-stress position audit'          },
  second_order:      { label: 'SECOND-ORDER',      color: '#e879f9', icon: '🌊', desc: 'Ripple effects & unintended impacts' },
  pre_mortem:        { label: 'PRE-MORTEM',        color: '#fcd34d', icon: '💀', desc: 'Failure simulation & risk analysis'  },
  draft:             { label: 'DRAFT SYNTHESIS',   color: '#a78bfa', icon: '📝', desc: 'Preliminary structured answer'       },
  peer_review:       { label: 'PEER REVIEW',       color: '#2dd4bf', icon: '👥', desc: 'Critique of fellow council members'  },
  cross_examination: { label: 'CROSS-EXAMINATION', color: '#f87171', icon: '🪞', desc: 'Ruthless self-review & flaw hunting' },
  refined_synthesis: { label: 'REFINED SYNTHESIS', color: '#34d399', icon: '✨', desc: 'Final structured answer (fixed)'     },
};

function StagesPanel({ stages }: { stages: { id: string; label: string; content: string }[] }) {
  const [openStage, setOpenStage] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  return (
    <div style={{ borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.25)' }}>
      <button
        onClick={() => setShowAll(o => !o)}
        style={{
          width: '100%', padding: '10px 20px', background: 'none', border: 'none',
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600,
          letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'left',
        }}
      >
        <span>{showAll ? '▲' : '▼'}</span>
        <span>Thinking Trace</span>
        <span style={{ marginLeft: 4, color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
          — {stages.length} stage{stages.length !== 1 ? 's' : ''} completed
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {stages.map(s => {
            const meta = STAGE_META[s.id];
            return (
              <span key={s.id} title={meta?.label || s.label} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: meta?.color || 'var(--text-muted)',
                opacity: 0.8,
              }} />
            );
          })}
        </div>
      </button>

      {showAll && (
        <div style={{ padding: '0 16px 16px' }}>
          {stages.map((stage) => {
            const meta = STAGE_META[stage.id] || { label: stage.label, color: 'var(--text-muted)', icon: '💭', desc: '' };
            const isOpen = openStage === stage.id;
            return (
              <div key={stage.id} style={{
                marginBottom: 8, border: `1px solid ${meta.color}33`,
                borderRadius: 10, overflow: 'hidden',
                background: `${meta.color}08`,
              }}>
                <button
                  onClick={() => setOpenStage(isOpen ? null : stage.id)}
                  style={{
                    width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>{meta.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: meta.color, letterSpacing: '0.07em' }}>
                      {meta.label}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{meta.desc}</div>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 14px 14px' }}>
                    <pre style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem',
                      color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word', margin: 0,
                      borderTop: `1px solid ${meta.color}22`, paddingTop: 10,
                    }}>
                      {stage.content}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResponseCard({ member, liveMember }: { member: any; liveMember: LiveMember }) {
  const [expanded, setExpanded] = useState(true);
  const meta = MEMBER_META[liveMember.id] || { emoji: '🤖', color: 'white' };
  const resp = liveMember.response;

  return (
    <div className="response-card" id={`member-card-${liveMember.id}`}
      style={{ borderColor: liveMember.state === 'done' ? meta.color + '55' : 'var(--border)' }}>
      <div className="response-header" onClick={() => setExpanded(e => !e)}>
        <span style={{ fontSize: '1.4rem' }}>{meta.emoji}</span>
        <div>
          <div className="response-member-name">{liveMember.name}</div>
          {resp && <div className="response-member-title" style={{ color: meta.color, fontSize: '0.72rem', fontWeight: 600 }}>
            {resp.confidence != null ? `Confidence: ${resp.confidence}%` : ''}
          </div>}
        </div>
        {liveMember.state === 'running' && (
          <div className="pulse text-muted text-sm" style={{ marginLeft: 'auto' }}>thinking…</div>
        )}
        {liveMember.state === 'pending' && (
          <div className="text-muted text-sm" style={{ marginLeft: 'auto' }}>waiting…</div>
        )}
        {resp && (
          <span className={`risk-badge risk-${resp.hallucinationRisk}`} style={{ marginLeft: 'auto' }}>
            {resp.hallucinationRisk} RISK
          </span>
        )}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 8 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="response-body">
          {liveMember.state === 'pending' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[80, 60, 90, 50].map((w, i) => (
                <div key={i} className="skeleton" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}
          {liveMember.state === 'running' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[75, 55, 85, 40].map((w, i) => (
                <div key={i} className="skeleton" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}
          {(liveMember.state === 'done' || liveMember.state === 'error') && resp && (
            <div dangerouslySetInnerHTML={{ __html: formatResponse(resp.auditedResponse) }} />
          )}
          {resp?.flags && resp.flags.length > 0 && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(245,158,11,0.06)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.15)' }}>
              <div className="text-xs" style={{ color: '#f59e0b', fontWeight: 700, marginBottom: 4 }}>⚠ Flagged Claims</div>
              {resp.flags.map((f: string, i: number) => (
                <div key={i} className="text-xs text-muted">{f}</div>
              ))}
            </div>
          )}
        </div>
      )}
      {expanded && resp?.thinkingStages && resp.thinkingStages.length > 0 && (
        <StagesPanel stages={resp.thinkingStages} />
      )}
    </div>
  );
}

function formatResponse(text: string): string {
  if (!text || text === '[MEMBER UNAVAILABLE]') return `<p style="color:var(--text-muted)">[Member unavailable]</p>`;
  return text
    .replace(/\*\*\[([^\]]+)\]\*\*/g, '<div class="section-label">$1</div>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[UNCERTAIN\]/g, '<span style="color:#f59e0b;font-size:0.7rem;font-weight:700">[UNCERTAIN]</span>')
    .replace(/\[UNVERIFIED:[^\]]+\]/g, (m) => `<span style="color:#ef4444;font-size:0.7rem">${m}</span>`)
    .replace(/• ([^\n]+)/g, '<li>$1</li>')
    .replace(/\n/g, '<br/>');
}

function WebResearcherCard({ research }: { research: any }) {
  if (!research) return null;
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="response-card" style={{ borderColor: 'var(--border)' }}>
      <div className="response-header" onClick={() => setExpanded(e => !e)}>
        <span style={{ fontSize: '1.4rem' }}>🌍</span>
        <div>
          <div className="response-member-name">Web Researcher</div>
          <div className="response-member-title" style={{ color: '#60a5fa', fontSize: '0.72rem', fontWeight: 600 }}>
            Gathered Live Context
          </div>
        </div>
        <span className="risk-badge" style={{ marginLeft: 'auto', background: '#3b82f622', color: '#60a5fa', border: '1px solid #3b82f655' }}>
          {research.queries?.length || 0} Queries
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 8 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="response-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <strong>Searched:</strong> {research.queries?.map((q: string) => `"${q}"`).join(', ')}
          </div>
          {research.results?.map((r: any, i: number) => (
            <div key={i} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <a href={r.url} target="_blank" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: 4 }}>
                {r.title}
              </a>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {r.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SessionPage() {
  const { id } = useParams();
  const sessionId = Array.isArray(id) ? id[0] : id;

  const [liveMembers, setLiveMembers] = useState<LiveMember[]>([]);
  const [synthesis, setSynthesis] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [webResearch, setWebResearch] = useState<any>(null);
  const [status, setStatus] = useState('Connecting…');
  const [phase, setPhase] = useState<'streaming' | 'done' | 'error'>('streaming');
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [followUpQ, setFollowUpQ] = useState('');
  const [followUpTarget, setFollowUpTarget] = useState('council');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    // Try loading existing session first
    fetch(`/api/session/${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setSession(data);
          setFollowUps(data.followUps || []);
          setSynthesis(data.synthesis);
          if (data.webResearch) setWebResearch(data.webResearch);
          setLiveMembers(data.memberResponses.map((r: any) => ({
            id: r.memberId, name: r.memberName, state: 'done', response: r, thinkingTrace: r.thinkingTrace
          })));
          setPhase('done');
          setStatus('');
          return;
        }
        // New session — stream from SSE
        const es = new EventSource(`/api/council?sessionId=${sessionId}`);
        es.onmessage = (e) => {
          const event = JSON.parse(e.data);
          handleEvent(event);
          if (event.type === 'session_done' || event.type === 'error') es.close();
        };
        es.onerror = () => {
          setStatus('Connection error');
          setPhase('error');
          es.close();
        };
      })
      .catch(() => setPhase('error'));
  }, [sessionId]);

  function handleEvent(event: any) {
    switch (event.type) {
      case 'status':
        setStatus(event.message);
        break;
      case 'web_research_done':
        setWebResearch(event.webResearch);
        setStatus('Web search complete. Members are reasoning…');
        break;
      case 'member_start':
        setLiveMembers(prev => {
          const exists = prev.find(m => m.id === event.memberId);
          if (exists) return prev.map(m => m.id === event.memberId ? { ...m, state: 'running' } : m);
          return [...prev, { id: event.memberId, name: event.memberName, state: 'running' }];
        });
        setStatus(`${event.memberName} is reasoning…`);
        break;
      case 'member_thinking':
        setLiveMembers(prev => prev.map(m =>
          m.id === event.memberId ? { ...m, thinkingStages: event.stages } : m
        ));
        break;
      case 'member_done':
        setLiveMembers(prev => prev.map(m =>
          m.id === event.memberId
            ? { ...m, state: 'done', response: event.response }
            : m
        ));
        break;
      case 'synthesis_start':
        setStatus('Synthesizing perspectives…');
        break;
      case 'synthesis_done':
        setSynthesis(event.synthesis);
        break;
      case 'session_done':
        setSession(event.session);
        setFollowUps(event.session.followUps || []);
        setPhase('done');
        setStatus('');
        break;
      case 'error':
        setStatus(event.message);
        setPhase('error');
        break;
    }
  }

  const submitFollowUp = async () => {
    if (!followUpQ.trim()) return;
    setFollowUpLoading(true);
    try {
      const res = await fetch('/api/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, question: followUpQ, targetMemberId: followUpTarget })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFollowUps(prev => [...prev, data]);
      setFollowUpQ('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setFollowUpLoading(false);
    }
  };

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <a href="/" className="btn btn-ghost text-sm" style={{ padding: '6px 12px' }}>← New Session</a>
          <a href="/sessions" className="btn btn-ghost text-sm" style={{ padding: '6px 12px' }}>Sessions</a>
        </div>
        {session ? (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span className="badge badge-type">{session.decisionType}</span>
              <span className="badge badge-date">{new Date(session.timestamp).toLocaleString()}</span>
              <span className="badge badge-date">ID: {session.sessionId}</span>
            </div>
            <h1 className="page-title" style={{ fontSize: '1.2rem', lineHeight: 1.5 }}>{session.rawDecision}</h1>
          </>
        ) : (
          <>
            <div className="skeleton" style={{ width: 200, height: 18, marginBottom: 10 }} />
            <div className="skeleton" style={{ width: '70%', height: 28 }} />
          </>
        )}
      </div>

      {/* Status bar */}
      {phase === 'streaming' && status && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, padding: '12px 16px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 12 }}>
          <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="2.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          <span className="text-sm" style={{ color: 'var(--accent-bright)' }}>{status}</span>
        </div>
      )}
      {phase === 'error' && (
        <div style={{ marginBottom: 24, padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, color: '#ef4444', fontSize: '0.875rem' }}>
          ⚠ {status}
        </div>
      )}

      {/* Member responses */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
        {webResearch && <WebResearcherCard research={webResearch} />}

        {liveMembers.length === 0 && phase === 'streaming' && (
          [1,2,3].map(i => (
            <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="skeleton" style={{ width: 200, height: 18 }} />
              <div className="skeleton" style={{ width: '90%', height: 12 }} />
              <div className="skeleton" style={{ width: '75%', height: 12 }} />
            </div>
          ))
        )}
        {liveMembers.map(m => (
          <ResponseCard key={m.id} member={m} liveMember={m} />
        ))}
      </div>

      {/* Synthesis */}
      {synthesis && (
        <div className="synthesis-panel section-gap" id="synthesis-panel">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 24 }}>
            <div className="confidence-ring-wrap">
              <ConfidenceRing score={synthesis.confidenceScore || 0} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Council Synthesis</div>
                <div className="text-secondary text-sm">Confidence score across all members</div>
              </div>
            </div>
          </div>

          <div className="synthesis-label">Consensus</div>
          <p className="synthesis-text">{synthesis.consensus}</p>
          <div className="synthesis-divider" />

          <div className="synthesis-label">Core Tension</div>
          <p className="synthesis-text">{synthesis.coreTension}</p>
          <div className="synthesis-divider" />

          <div className="synthesis-label">Final Verdict</div>
          <p className="synthesis-verdict">{synthesis.finalVerdict}</p>

          {synthesis.actionPlan && synthesis.actionPlan.length > 0 && (
            <>
              <div className="synthesis-divider" />
              <div className="synthesis-label">Action Plan</div>
              <div className="questions-list" style={{ background: 'var(--bg-main)' }}>
                {synthesis.actionPlan.map((step: string, i: number) => (
                  <div key={i} className="question-item" style={{ borderLeftColor: 'var(--accent)' }}>
                    <span className="question-num">{i + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {synthesis.tradeoffs && synthesis.tradeoffs.length > 0 && (
            <>
              <div className="synthesis-divider" />
              <div className="synthesis-label">Accepted Tradeoffs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {synthesis.tradeoffs.map((t: string, i: number) => (
                  <div key={i} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, fontSize: '0.9rem', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: '#ef4444' }}>⚖️</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {synthesis.consistencyFlags && synthesis.consistencyFlags.length > 0 && (
            <>
              <div className="synthesis-divider" />
              <div className="synthesis-label">⚠ Consistency Flags</div>
              {synthesis.consistencyFlags.map((f: string, i: number) => (
                <div key={i} className="consistency-flag">⚡ {f}</div>
              ))}
            </>
          )}

          {synthesis.questionsToAnswer && synthesis.questionsToAnswer.length > 0 && (
            <>
              <div className="synthesis-divider" />
              <div className="synthesis-label">Questions to Resolve</div>
              <div className="questions-list">
                {synthesis.questionsToAnswer.map((q: string, i: number) => (
                  <div key={i} className="question-item">
                    <span className="question-num">{i + 1}.</span>
                    <span>{q}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Follow-up chat */}
      {phase === 'done' && session && (
        <div className="card section-gap" id="followup-section">
          <div style={{ fontWeight: 700, marginBottom: 16 }}>🗣 Ask a Follow-Up</div>

          {followUps.length > 0 && (
            <div className="chat-wrap mb-4">
              {followUps.map((f, i) => (
                <div key={i}>
                  <div className="chat-message chat-user">
                    <div className="chat-role">You → {f.targetMemberId === 'council' ? 'The Council' : f.targetMemberId}</div>
                    <div className="chat-text">{f.question}</div>
                  </div>
                  <div className="chat-message chat-assistant">
                    <div className="chat-role">{f.targetMemberId === 'council' ? 'The Council' : f.targetMemberId}</div>
                    <div className="chat-text" dangerouslySetInnerHTML={{ __html: f.response.replace(/\n/g, '<br/>') }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <select
              id="followup-target"
              value={followUpTarget}
              onChange={e => setFollowUpTarget(e.target.value)}
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '0.875rem', outline: 'none', minWidth: 200 }}
            >
              <option value="council">The Council (Synthesizer)</option>
              {liveMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="chat-input-row">
            <input
              id="followup-input"
              className="form-input"
              placeholder="Ask a follow-up question…"
              value={followUpQ}
              onChange={e => setFollowUpQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !followUpLoading && submitFollowUp()}
            />
            <button
              id="followup-submit"
              className="btn btn-primary"
              onClick={submitFollowUp}
              disabled={followUpLoading || !followUpQ.trim()}
            >
              {followUpLoading ? (
                <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              ) : 'Ask'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
