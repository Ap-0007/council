'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const TYPE_COLORS: Record<string, string> = {
  career: 'rgba(59,130,246,0.15)',
  financial: 'rgba(34,197,94,0.15)',
  strategic: 'rgba(124,58,237,0.15)',
  personal: 'rgba(168,85,247,0.15)',
  ethical: 'rgba(245,158,11,0.15)',
  technical: 'rgba(239,68,68,0.15)',
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then(data => { setSessions(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = sessions.filter(s =>
    !search || s.preview?.toLowerCase().includes(search.toLowerCase()) || s.decisionType?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Past Sessions</h1>
        <p className="page-sub">{sessions.length} decision{sessions.length !== 1 ? 's' : ''} analysed</p>
      </div>

      <div className="search-row">
        <input
          id="session-search"
          className="form-input"
          placeholder="Search by decision text or type…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Link href="/" className="btn btn-primary" id="new-session-btn">+ New Session</Link>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 14 }} />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🏛</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>No sessions yet</div>
          <p className="text-secondary text-sm">Submit a decision to begin.</p>
          <Link href="/" className="btn btn-primary mt-4" style={{ display: 'inline-flex' }}>Convene The Council</Link>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(s => (
          <Link key={s.sessionId} href={`/session/${s.sessionId}`} className="session-item" id={`session-${s.sessionId}`}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center',
              background: TYPE_COLORS[s.decisionType] || 'rgba(255,255,255,0.05)',
              fontSize: '1.1rem', flexShrink: 0,
            }}>
              {{career:'💼',financial:'💰',strategic:'♟️',personal:'🧠',ethical:'⚖️',technical:'⚙️'}[s.decisionType as string] || '📋'}
            </div>
            <div className="session-preview">
              <strong>{s.decisionType?.toUpperCase()}</strong>{' '}
              {s.preview}…
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              <span className="text-xs text-muted">{new Date(s.timestamp).toLocaleDateString()}</span>
              <span className="text-xs text-muted">{s.sessionId}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
