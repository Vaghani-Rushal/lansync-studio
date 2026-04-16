import { useEffect, useState } from 'react'

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

type ClientPlatform = 'mac' | 'windows' | 'other'

function getClientPlatform(): ClientPlatform {
  if (typeof window === 'undefined') return 'other'
  const platform = window.navigator.platform.toLowerCase()
  const userAgent = window.navigator.userAgent.toLowerCase()
  if (platform.includes('mac') || userAgent.includes('mac')) return 'mac'
  if (platform.includes('win') || userAgent.includes('win')) return 'windows'
  return 'other'
}

export function Home() {
  const [platform] = useState<ClientPlatform>(getClientPlatform)

  const visibleDownloads = downloads.filter(
    (download) => platform === 'other' || download.platform === platform
  )

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('[data-reveal]')
    )
    if (!sections.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle('is-visible', entry.isIntersecting)
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -8% 0px' }
    )

    for (const section of sections) {
      observer.observe(section)
    }

    return () => { observer.disconnect() }
  }, [])

  return (
    <>
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
              <span className="meta-pill" key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="studio-window studio-window-main">
            <div className="window-bar">
              <span /><span /><span />
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
                  <span /><span /><span /><span />
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
              <a className="download-btn-large" key={download.title} href={download.href}>
                <div className="download-btn-icon">
                  {download.platform === 'mac' ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.641-.026 2.669-1.48 3.655-2.922 1.144-1.676 1.616-3.299 1.642-3.385-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.569 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.693.793-1.365 2.247-1.183 3.614 1.341.104 2.636-.585 3.47-1.602z"/></svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 12.4023L35.2 7.42773V41.8008H0V12.4023ZM39.6 6.80469L88 0V41.8008H39.6V6.80469ZM0 46.2051H35.2V80.5781L0 75.6035V46.2051ZM39.6 46.2051H88V88L39.6 81.1953V46.2051Z" fill="currentColor"/></svg>
                  )}
                </div>
                <div className="download-btn-content">
                  <span className="download-btn-title">{download.title}</span>
                  <span className="download-btn-meta">{download.meta}</span>
                </div>
                <div className="download-btn-arrow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
