import { useEffect, useState } from 'react'
import './App.css'

const downloads = [
  {
    title: 'Download for macOS',
    href: '/downloads/lansync-studio-macos.dmg',
    meta: 'Apple silicon + Intel',
    platform: 'mac',
  },
  {
    title: 'Download for Windows',
    href: '/downloads/lansync-studio-windows.exe',
    meta: 'Windows 10 and above',
    platform: 'windows',
  },
]

const features = [
  {
    title: 'LAN-only by design',
    body: 'Work across the same Wi-Fi or wired network with no cloud relay and no internet dependency.',
  },
  {
    title: 'Zero-storage workflow',
    body: 'Preview, edit, and sync files directly from the host machine instead of duplicating them everywhere.',
  },
  {
    title: 'Fast team handoff',
    body: 'Share a workspace, approve requests, and let teammates open the exact files they need in seconds.',
  },
]

const highlights = [
  'No cloud upload',
  'Join with a short code',
  'Built for macOS and Windows',
  'Designed for local teams and labs',
]

const steps = [
  'Host a workspace from your desktop.',
  'Teammates discover it on the same LAN or join with a code.',
  'Approve access and start working inside the shared files instantly.',
]

type Theme = 'light' | 'dark'
type ClientPlatform = 'mac' | 'windows' | 'other'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const storedTheme = window.localStorage.getItem('lansync-theme')
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function getClientPlatform(): ClientPlatform {
  if (typeof window === 'undefined') {
    return 'other'
  }

  const platform = window.navigator.platform.toLowerCase()
  const userAgent = window.navigator.userAgent.toLowerCase()

  if (platform.includes('mac') || userAgent.includes('mac')) {
    return 'mac'
  }

  if (platform.includes('win') || userAgent.includes('win')) {
    return 'windows'
  }

  return 'other'
}

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [platform] = useState<ClientPlatform>(getClientPlatform)

  const visibleDownloads = downloads.filter(
    (download) => platform === 'other' || download.platform === platform
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem('lansync-theme', theme)
  }, [theme])

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('[data-reveal]')
    )

    if (!sections.length) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle('is-visible', entry.isIntersecting)
        }
      },
      {
        threshold: 0.2,
        rootMargin: '0px 0px -8% 0px',
      }
    )

    for (const section of sections) {
      observer.observe(section)
    }

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div className="page-shell">
      <header className="topbar">
        <a className="brand" href="#hero" aria-label="LanSync Studio home">
          <span className="brand-mark">LS</span>
          <span>LanSync Studio</span>
        </a>
        <nav className="topnav" aria-label="Primary">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#downloads">Download</a>
        </nav>
        <button
          className="theme-toggle"
          type="button"
          onClick={() => setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          <span className="theme-toggle__icon" aria-hidden="true">
            {theme === 'light' ? '◐' : '◑'}
          </span>
          <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
        </button>
      </header>

      <main>
        <section className="hero-section reveal-section" id="hero" data-reveal>
          <div className="hero-copy">
            <p className="eyebrow">Desktop collaboration for the same network</p>
            <h1>Share local workspaces across your LAN without sending a single file to the cloud.</h1>
            <p className="hero-text">
              LanSync Studio helps teams move files, previews, and edits between
              macOS and Windows machines on the same network with a calm,
              native-feeling desktop experience.
            </p>

            <div
              className={`hero-actions ${visibleDownloads.length === 1 ? 'hero-actions--single' : ''}`}
              id="downloads"
            >
              {visibleDownloads.map((download) => (
                <a className="download-card" key={download.title} href={download.href}>
                  <span>{download.title}</span>
                  <small>{download.meta}</small>
                </a>
              ))}
            </div>

            <div className="hero-meta">
              {highlights.map((item) => (
                <span className="meta-pill" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="studio-window studio-window-main">
              <div className="window-bar">
                <span />
                <span />
                <span />
              </div>
              <div className="window-grid">
                <div className="window-panel window-panel-primary">
                  <p className="panel-label">Live workspace</p>
                  <h2>design-system</h2>
                  <ul>
                    <li>Assets</li>
                    <li>Components</li>
                    <li>Docs</li>
                    <li>Release notes</li>
                  </ul>
                </div>
                <div className="window-panel">
                  <p className="panel-label">Session status</p>
                  <div className="signal-row">
                    <strong>LAN active</strong>
                    <span>4 teammates connected</span>
                  </div>
                  <div className="signal-meter">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <div className="window-panel window-panel-wide">
                  <p className="panel-label">Recent activity</p>
                  <div className="activity-item">
                    <span>Workspace shared</span>
                    <strong>2 sec ago</strong>
                  </div>
                  <div className="activity-item">
                    <span>Client approved</span>
                    <strong>Short code 4HD9</strong>
                  </div>
                  <div className="activity-item">
                    <span>Readme updated</span>
                    <strong>Synced instantly</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="studio-window studio-window-side">
              <p className="panel-label">Quick join</p>
              <div className="join-code">4HD9</div>
              <div className="join-note">Same LAN. One approval. You are in.</div>
            </div>
          </div>
        </section>

        <section className="proof-strip reveal-section" data-reveal>
          <p>Built for studios, classrooms, office floors, and air-gapped local setups.</p>
        </section>

        <section className="content-section reveal-section" id="features" data-reveal>
          <div className="section-heading">
            <p className="eyebrow">Why teams use it</p>
            <h2>Fast local collaboration with none of the cloud friction.</h2>
          </div>

          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="content-section workflow-section reveal-section"
          id="how-it-works"
          data-reveal
        >
          <div className="section-heading">
            <p className="eyebrow">How it works</p>
            <h2>Three steps from host machine to shared files.</h2>
          </div>

          <div className="step-grid">
            {steps.map((step, index) => (
              <article className="step-card" key={step}>
                <span className="step-number">0{index + 1}</span>
                <p>{step}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="content-section download-section reveal-section" data-reveal>
          <div className="download-panel">
            <div>
              <p className="eyebrow">Ready to try</p>
              <h2>Install LanSync Studio on the machines you work from every day.</h2>
              <p className="download-copy">
                The landing page is wired for direct desktop downloads. Place your
                release artifacts at the linked paths and the buttons are ready to ship.
              </p>
            </div>
            <div className="download-stack">
              {visibleDownloads.map((download) => (
                <a className="download-row" key={download.title} href={download.href}>
                  <span>{download.title}</span>
                  <small>{download.meta}</small>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>&copy; {new Date().getFullYear()} LanSync Studio. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default App
