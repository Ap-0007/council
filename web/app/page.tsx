'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MEMBERS = [
  { id: 'marcus', name: 'Marcus Aurelius Chen', title: 'Game Theorist & Strategist', emoji: '♟️' },
  { id: 'soren',  name: 'Dr. Soren Voss',       title: 'Philosopher & Ethicist',      emoji: '🔭' },
  { id: 'rachel', name: 'Rachel Stone',          title: 'Execution Specialist',        emoji: '⚙️' },
  { id: 'lena',   name: 'Lena Morrow',           title: 'Contrarian & Black Swan',     emoji: '🦢' },
  { id: 'arjun',  name: 'Arjun Mehta',           title: 'Futurist & Complexity',       emoji: '🌌' },
];

export default function HomePage() {
  const router = useRouter();
  const [decision, setDecision] = useState('');
  const [selected, setSelected] = useState<string[]>(MEMBERS.map(m => m.id));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleMember = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const submit = async () => {
    if (decision.trim().length < 20) { setError('Please provide more context (min 20 chars).'); return; }
    if (selected.length === 0) { setError('Select at least one council member.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/council', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, selectedMemberIds: selected })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initiate session');
      router.push(`/session/${data.sessionId}`);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="hero">
        <div className="hero-eyebrow">AI Decision Council</div>
        <h1 className="hero-title">Convene Your Council</h1>
        <p className="hero-sub">
          Five AI advisors, five distinct analytical frameworks. Submit your decision and receive deeply reasoned, cross-validated perspectives.
        </p>
      </div>

      <div className="home-grid">
        {/* Left: Decision form */}
        <div className="glass" style={{ padding: 28 }}>
          <div className="form-group mb-6">
            <label className="form-label" htmlFor="decision-input">Your Decision</label>
            <textarea
              id="decision-input"
              className="form-textarea"
              placeholder="Describe the decision you're facing. Include relevant context, constraints, and what's at stake. The more detail, the better the analysis."
              value={decision}
              onChange={e => setDecision(e.target.value)}
              style={{ minHeight: 160 }}
            />
            <div className="text-xs text-muted" style={{ marginTop: 4 }}>
              {decision.length} chars {decision.length < 20 && '— need at least 20'}
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#ef4444', fontSize: '0.8rem' }}>
              {error}
            </div>
          )}

          <button
            id="submit-btn"
            className="btn btn-primary w-full"
            onClick={submit}
            disabled={loading}
            style={{ height: 48 }}
          >
            {loading ? (
              <>
                <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Initiating Session…
              </>
            ) : (
              <> ⚖️ Convene The Council </>
            )}
          </button>
        </div>

        {/* Right: Member selector */}
        <div className="glass" style={{ padding: 28 }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label">Council Members</span>
            <button className="btn-ghost text-xs" style={{ padding: '4px 10px', borderRadius: 6 }}
              onClick={() => setSelected(selected.length === MEMBERS.length ? [] : MEMBERS.map(m => m.id))}>
              {selected.length === MEMBERS.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="members-grid">
            <div
              key="dynamic"
              id="member-dynamic"
              className={`member-card ${selected.includes('dynamic') ? 'selected' : ''}`}
              onClick={() => {
                if (selected.includes('dynamic')) {
                  setSelected(MEMBERS.map(m => m.id));
                } else {
                  setSelected(['dynamic']);
                }
              }}
              style={{ gridColumn: '1 / -1', background: selected.includes('dynamic') ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)', borderColor: selected.includes('dynamic') ? 'var(--accent)' : 'var(--border)' }}
              role="checkbox"
            >
              <div className="member-card-header">
                <span className="member-emoji">🧠</span>
                <div>
                  <div className="member-name">Dynamic Assembly</div>
                  <div className="member-title">AI automatically selects the best 3 experts for your decision</div>
                </div>
                <div className="member-check" style={{ borderColor: selected.includes('dynamic') ? 'var(--accent)' : 'var(--border)', background: selected.includes('dynamic') ? 'var(--accent)' : 'transparent', color: selected.includes('dynamic') ? 'white' : 'transparent' }}>✓</div>
              </div>
            </div>

            {!selected.includes('dynamic') && MEMBERS.map(m => (
              <div
                key={m.id}
                id={`member-${m.id}`}
                className={`member-card ${selected.includes(m.id) ? 'selected' : ''}`}
                data-member={m.id}
                onClick={() => toggleMember(m.id)}
                role="checkbox"
                aria-checked={selected.includes(m.id)}
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && toggleMember(m.id)}
              >
                <div className="member-card-header">
                  <span className="member-emoji">{m.emoji}</span>
                  <div>
                    <div className="member-name">{m.name}</div>
                    <div className="member-title">{m.title}</div>
                  </div>
                  <div className="member-check">{selected.includes(m.id) && '✓'}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted mt-4" style={{ textAlign: 'center' }}>
            {selected.length} of {MEMBERS.length} advisors selected
          </div>
        </div>
      </div>
    </div>
  );
}
