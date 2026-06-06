import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Council — AI Decision Analysis',
  description: 'A council of five AI advisors with distinct analytical frameworks to help you make better decisions.',
  keywords: ['AI', 'decision analysis', 'strategy', 'advisory', 'council'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <nav className="navbar">
          <a href="/" className="navbar-brand">
            <div className="icon">⚖️</div>
            <span>THE COUNCIL</span>
          </a>
          <div className="navbar-links">
            <a href="/" id="nav-home">New Session</a>
            <a href="/sessions" id="nav-sessions">Sessions</a>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
