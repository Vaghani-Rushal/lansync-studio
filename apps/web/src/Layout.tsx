import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

type Theme = 'light' | 'dark'

interface LayoutProps {
  theme: Theme
  setTheme: (theme: Theme) => void
  children: React.ReactNode
}

const GITHUB_REPO_URL = 'https://github.com/Jenish109/lansync-studio'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export function Layout({ theme, setTheme, children }: LayoutProps) {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="page-shell">
      <ScrollToTop />

      <header className="topbar">
        <Link className="brand" to="/" aria-label="LanSync Studio home">
          <span className="brand-mark">LS</span>
          <span>LanSync Studio</span>
          <span className="version-chip">Beta</span>
        </Link>

        <nav className="topnav" aria-label="Primary">
          {isHome ? (
            <>
              <a href="/#features">Features</a>
              <a href="/#how-it-works">How it works</a>
            </>
          ) : null}
          <Link to="/docs">Docs</Link>
          <Link to="/changelog">Changelog</Link>
          {isHome ? <a href="/#downloads">Download</a> : null}
        </nav>

        <button
          className="theme-toggle"
          type="button"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          <span className="theme-toggle__icon" aria-hidden="true">
            {theme === 'light' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            )}
          </span>
          <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
        </button>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="footer-cta">
          <div className="footer-cta-copy">
            <p className="eyebrow">Ready when you are</p>
            <h2>Share files on your LAN in under a minute.</h2>
          </div>
          <div className="footer-cta-actions">
            <a className="footer-cta-btn primary" href="/#downloads">
              Download LanSync
              <span aria-hidden="true">→</span>
            </a>
            <Link className="footer-cta-btn" to="/docs">
              Read the docs
            </Link>
          </div>
        </div>

        <div className="footer-divider" />

        <div className="footer-main">
          <div className="footer-brand">
            <Link className="brand footer-brand-link" to="/" aria-label="LanSync Studio home">
              <span className="brand-mark">LS</span>
              <span>LanSync Studio</span>
            </Link>

            <p className="footer-tagline">
              Fast, local-first file sharing and workspace collaboration for teams on the same network — no cloud, no friction.
            </p>

            <div className="footer-social">
              <a
                className="social-link"
                href={GITHUB_REPO_URL}
                aria-label="LanSync Studio on GitHub"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.203 22 16.447 22 12.021 22 6.484 17.522 2 12 2z" /></svg>
              </a>
              <a
                className="social-link"
                href="https://twitter.com"
                aria-label="LanSync Studio on X (Twitter)"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
              <a
                className="social-link"
                href="mailto:hello@lansyncstudio.local"
                aria-label="Email LanSync Studio"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
              </a>
            </div>
          </div>

          <nav className="footer-nav" aria-label="Footer">
            <div className="footer-col">
              <p className="footer-col-title">Product</p>
              <a className="footer-link" href="/#features">Features</a>
              <a className="footer-link" href="/#how-it-works">How it works</a>
              <a className="footer-link" href="/#downloads">Download</a>
              <Link className="footer-link" to="/changelog">Changelog</Link>
            </div>

            <div className="footer-col">
              <p className="footer-col-title">Resources</p>
              <Link className="footer-link" to="/docs">Docs</Link>
              <Link className="footer-link" to="/security">Security</Link>
              <Link className="footer-link" to="/faq">FAQ</Link>
            </div>

            <div className="footer-col">
              <p className="footer-col-title">Legal</p>
              <Link className="footer-link" to="/privacy">Privacy Policy</Link>
              <Link className="footer-link" to="/terms">Terms of Service</Link>
            </div>
          </nav>
        </div>

        <div className="footer-wordmark" aria-hidden="true">
          LanSync
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">
            &copy; {new Date().getFullYear()} LanSync Studio. All rights reserved.
          </p>
          <div className="footer-bottom-meta">
            <span className="footer-status">
              <span className="footer-status-dot" /> All systems operational
            </span>
            <span className="footer-version">v0.4.0</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
