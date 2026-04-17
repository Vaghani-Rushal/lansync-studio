import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

type Theme = 'light' | 'dark'

interface LayoutProps {
  theme: Theme
  setTheme: (theme: Theme) => void
  children: React.ReactNode
}

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
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.documentElement.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.documentElement.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <>
      <ScrollToTop />

      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" to="/" aria-label="LanSync Studio home">
            <span className="brand-mark">LS</span>
            <span className="brand-text">LanSync Studio</span>
          </Link>

          {isHome && (
            <nav className="topnav" aria-label="Primary">
              <a href="/#features">Features</a>
              <a href="/#how-it-works">How it works</a>
              <a href="/#downloads">Download</a>
            </nav>
          )}

          <div className="site-header-actions">
            <a
              className="header-icon-link"
              href="https://github.com/Jenish109/lansync-studio"
              aria-label="LanSync Studio on GitHub"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.203 22 16.447 22 12.021 22 6.484 17.522 2 12 2z" />
              </svg>
            </a>

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
            </button>

            <a className="header-cta" href="/#downloads">
              Download
            </a>

            <button
              className="menu-toggle"
              type="button"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className={`menu-toggle-icon${menuOpen ? ' is-open' : ''}`} aria-hidden="true">
                <span />
                <span />
              </span>
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div
          className="mobile-menu-backdrop"
          role="presentation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`mobile-menu${menuOpen ? ' is-open' : ''}`} aria-hidden={!menuOpen}>
        {isHome && (
          <nav className="mobile-nav" aria-label="Mobile primary">
            <a href="/#features" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="/#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
            <a href="/#downloads" onClick={() => setMenuOpen(false)}>Download</a>
          </nav>
        )}
        <div className="mobile-menu-foot">
          <a
            className="footer-link"
            href="https://github.com/Jenish109/lansync-studio"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <Link className="footer-link" to="/privacy">Privacy</Link>
          <Link className="footer-link" to="/terms">Terms</Link>
        </div>
      </aside>

      <div className="page-shell">
        <main>{children}</main>

        <footer className="site-footer">
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
                  href="https://github.com/Jenish109/lansync-studio"
                  aria-label="LanSync Studio on GitHub"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.203 22 16.447 22 12.021 22 6.484 17.522 2 12 2z" />
                  </svg>
                </a>

                <a
                  className="social-link"
                  href="https://twitter.com"
                  aria-label="LanSync Studio on X (Twitter)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              </div>
            </div>

            <nav className="footer-nav" aria-label="Footer">
              <div className="footer-col">
                <p className="footer-col-title">Product</p>
                <a className="footer-link" href="/#features">Features</a>
                <a className="footer-link" href="/#how-it-works">How it works</a>
                <a className="footer-link" href="/#downloads">Download</a>
              </div>

              <div className="footer-col">
                <p className="footer-col-title">Legal</p>
                <Link className="footer-link" to="/privacy">Privacy Policy</Link>
                <Link className="footer-link" to="/terms">Terms of Service</Link>
              </div>
            </nav>
          </div>

          <div className="footer-bottom">
            <p className="footer-copyright">
              &copy; {new Date().getFullYear()} LanSync Studio. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}
