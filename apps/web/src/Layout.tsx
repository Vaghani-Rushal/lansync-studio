import { useEffect } from 'react'
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

  return (
    <div className="page-shell">
      <ScrollToTop />

      <header className="topbar">
        <Link className="brand" to="/" aria-label="LanSync Studio home">
          <span className="brand-mark">LS</span>
          <span>LanSync Studio</span>
        </Link>

        {/* ✅ Show ONLY on homepage */}
        {isHome && (
          <nav className="topnav" aria-label="Primary">
            <a href="/#features">Features</a>
            <a href="/#how-it-works">How it works</a>
            <a href="/#downloads">Download</a>
          </nav>
        )}

        <button
          className="theme-toggle"
          type="button"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          <span className="theme-toggle__icon" aria-hidden="true">
            {theme === 'light' ? '◐' : '◑'}
          </span>
          <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
        </button>
      </header>

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
                href="https://github.com"
                aria-label="LanSync Studio on GitHub"
                target="_blank"
                rel="noopener noreferrer"
              >
                {/* SVG */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"> <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.203 22 16.447 22 12.021 22 6.484 17.522 2 12 2z" /> </svg>
              </a>

              <a
                className="social-link"
                href="https://twitter.com"
                aria-label="LanSync Studio on X (Twitter)"
                target="_blank"
                rel="noopener noreferrer"
              >
                {/* SVG */}
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"> <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /> </svg>
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
  )
}