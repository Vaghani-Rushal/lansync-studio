import { useEffect, useState } from 'react'

const GITHUB_RELEASE_BASE_URL = 'https://github.com/Jenish109/lansync-studio/releases/latest/download'
const RELEASE_ASSET_NAMES = {
  mac: 'lansync-studio-macos.dmg',
  windows: 'lansync-studio-windows.exe',
} as const

const downloads = [
  {
    title: 'Download for macOS',
    href: `${GITHUB_RELEASE_BASE_URL}/${RELEASE_ASSET_NAMES.mac}`,
    meta: 'Apple silicon + Intel',
    platform: 'mac',
  },
  {
    title: 'Download for Windows',
    href: `${GITHUB_RELEASE_BASE_URL}/${RELEASE_ASSET_NAMES.windows}`,
    meta: 'Windows 10 and above',
    platform: 'windows',
  },
]

type FeatureIconKey = 'network' | 'lock' | 'bolt' | 'shield' | 'layers' | 'terminal'

const features: Array<{ title: string; body: string; icon: FeatureIconKey }> = [
  {
    title: 'LAN-only by design',
    body: 'Traffic stays on your local subnet. No relay servers, no cloud sync, no internet dependency.',
    icon: 'network',
  },
  {
    title: 'Zero-storage workflow',
    body: 'Preview and edit files straight from the host machine. No duplicated copies on every laptop.',
    icon: 'layers',
  },
  {
    title: 'Fast team handoff',
    body: 'Share a workspace, approve join requests, and let teammates open the exact files in seconds.',
    icon: 'bolt',
  },
  {
    title: 'Private by default',
    body: 'No accounts, no telemetry, no sign-ups. The host is the source of truth for every byte.',
    icon: 'shield',
  },
  {
    title: 'Mixed-platform ready',
    body: 'macOS and Windows hosts and joiners coexist on the same network without special configuration.',
    icon: 'terminal',
  },
  {
    title: 'Short-code join',
    body: 'Hand a teammate a four-character code and they are in. One approval from the host, done.',
    icon: 'lock',
  },
]

const faqs = [
  {
    q: 'Does LanSync Studio upload anything to the cloud?',
    a: 'No. Every byte stays on your local network. LanSync does not operate relay or sync servers. The host machine is the source of truth.',
  },
  {
    q: 'Do teammates need an account?',
    a: 'No sign-up or login is required. Joining a workspace takes a four-character short code and one approval from the host.',
  },
  {
    q: 'Which platforms are supported?',
    a: 'macOS (Apple silicon and Intel) and Windows 10 or later. Hosts and joiners can mix platforms on the same network.',
  },
  {
    q: 'Is it safe for sensitive work?',
    a: 'LanSync is built for studios, classrooms, and air-gapped environments. Because it never touches the internet, it fits use-cases where cloud tools cannot.',
  },
]

type ClientPlatform = 'mac' | 'windows' | 'other'

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3v11m0 0 4-4m-4 4-4-4M4 17v2h16v-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlatformIcon({ platform }: { platform: 'mac' | 'windows' | 'other' }) {
  if (platform === 'mac') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.641-.026 2.669-1.48 3.655-2.922 1.144-1.676 1.616-3.299 1.642-3.385-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.569 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.693.793-1.365 2.247-1.183 3.614 1.341.104 2.636-.585 3.47-1.602z" />
      </svg>
    )
  }
  if (platform === 'windows') {
    return (
      <svg width="16" height="16" viewBox="0 0 88 88" fill="currentColor" aria-hidden="true">
        <path d="M0 12.4023L35.2 7.42773V41.8008H0V12.4023ZM39.6 6.80469L88 0V41.8008H39.6V6.80469ZM0 46.2051H35.2V80.5781L0 75.6035V46.2051ZM39.6 46.2051H88V88L39.6 81.1953V46.2051Z" />
      </svg>
    )
  }
  return <DownloadIcon />
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h14m0 0-6-6m6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FeatureIcon({ name }: { name: FeatureIconKey }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
    case 'network':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <circle cx="5" cy="5" r="2" />
          <circle cx="19" cy="5" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
          <path d="m7 7 3 3m7-3-3 3m-7 7 3-3m7 3-3-3" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      )
    case 'bolt':
      return (
        <svg {...common}>
          <path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )
    case 'layers':
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 13 9 5 9-5" />
          <path d="m3 17 9 5 9-5" />
        </svg>
      )
    case 'terminal':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="m7 9 3 3-3 3m6 0h4" />
        </svg>
      )
  }
}

function getClientPlatform(): ClientPlatform {
  if (typeof window === 'undefined') return 'other'
  const platform = window.navigator.platform.toLowerCase()
  const userAgent = window.navigator.userAgent.toLowerCase()
  if (platform.includes('mac') || userAgent.includes('mac')) return 'mac'
  if (platform.includes('win') || userAgent.includes('win')) return 'windows'
  return 'other'
}

function ProductPreview() {
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview-chrome">
        <span className="preview-dot" />
        <span className="preview-dot" />
        <span className="preview-dot" />
        <div className="preview-title">LAN Share · Desktop</div>
      </div>

      <div className="preview-app">
        <header className="app-header">
          <div className="app-brand">
            <span className="app-brand-mark">L</span>
            <div className="app-brand-text">
              <span className="app-brand-name">LAN Share</span>
              <span className="app-brand-sub">Real-time · Zero cloud · Pure local</span>
            </div>
          </div>

          <div className="app-user">
            <span className="app-user-avatar">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4 0-8 2-8 6v2h16v-2c0-4-4-6-8-6Z" />
              </svg>
            </span>
            <span>Alex Park</span>
          </div>
        </header>

        <div className="app-actions">
          <button className="app-action is-primary" type="button">
            <div className="app-action-icon" data-tone="share">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12" />
                <path d="m7 8 5-5 5 5" />
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
            </div>
            <div className="app-action-body">
              <div className="app-action-title">
                Share a file
                <span className="app-action-pill">⌘ N</span>
              </div>
              <div className="app-action-desc">Host one or more workspaces on the LAN</div>
            </div>
          </button>

          <button className="app-action" type="button">
            <div className="app-action-icon" data-tone="join">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="7" width="18" height="12" rx="2" />
                <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
                <path d="M10 13h4" />
              </svg>
            </div>
            <div className="app-action-body">
              <div className="app-action-title">Join a session</div>
              <div className="app-action-desc">Enter a share code to connect</div>
              <div className="app-code-row" aria-hidden="true">
                <span>4</span><span>H</span><span>D</span><span className="is-cursor">9</span>
              </div>
            </div>
          </button>
        </div>

        <div className="app-section">
          <div className="app-section-head">
            <span className="app-section-label">Nearby devices</span>
            <span className="app-section-count">3 found</span>
          </div>

          <ul className="app-devices">
            <li>
              <span className="app-device-dot" data-tone="mac" />
              <div>
                <div className="app-device-name">Ava's MacBook Pro</div>
                <div className="app-device-meta">macOS 14 · Studio-A · Host</div>
              </div>
              <span className="app-device-action">Request</span>
            </li>
            <li>
              <span className="app-device-dot" data-tone="win" />
              <div>
                <div className="app-device-name">Noah's Windows</div>
                <div className="app-device-meta">Windows 11 · Marketing</div>
              </div>
              <span className="app-device-action">Request</span>
            </li>
            <li>
              <span className="app-device-dot" data-tone="mac" />
              <div>
                <div className="app-device-name">Kai's iMac</div>
                <div className="app-device-meta">macOS 14 · Design · Joined</div>
              </div>
              <span className="app-device-action is-joined">Joined</span>
            </li>
          </ul>
        </div>

        <footer className="app-status">
          <span className="app-status-pill">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            No internet · No cloud · LAN only
          </span>
          <span className="app-status-pill is-scanning">
            <span className="app-scan-dot" />
            Scanning
          </span>
        </footer>
      </div>
    </div>
  )
}

export function Home() {
  const [platform] = useState<ClientPlatform>(getClientPlatform)

  const visibleDownloads = downloads.filter(
    (download) => platform === 'other' || download.platform === platform
  )

  const primaryDownload = visibleDownloads[0] ?? downloads[0]

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
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    )

    for (const section of sections) {
      observer.observe(section)
    }

    return () => { observer.disconnect() }
  }, [])

  return (
    <>
      <section className="hero reveal-section" id="hero" data-reveal>
        <a className="announcement" href="#downloads">
          <span className="announcement-tag">New</span>
          <span>LanSync Studio 1.0 is here</span>
          <ArrowIcon />
        </a>

        <h1 className="hero-title">
          Share workspaces across your LAN.
          <span className="hero-title-accent"> Never touch the cloud.</span>
        </h1>

        <p className="hero-sub">
          A calm, native-feeling desktop app that lets macOS and Windows teams move
          files, previews, and edits across the same network — with zero uploads and zero sign-ups.
        </p>

        <div className="hero-ctas">
          <a className="btn btn-primary" href={primaryDownload.href}>
            <PlatformIcon platform={primaryDownload.platform as 'mac' | 'windows' | 'other'} />
            <span>{primaryDownload.title}</span>
          </a>
          <a className="btn btn-ghost" href="#how-it-works">
            See how it works
            <ArrowIcon />
          </a>
        </div>

        <p className="hero-foot">
          Free · Open on GitHub · macOS &amp; Windows
        </p>
      </section>

      <section className="preview-stage reveal-section" data-reveal>
        <ProductPreview />
      </section>

      <section className="section reveal-section" id="features" data-reveal>
        <div className="section-head">
          <p className="eyebrow">Why teams use it</p>
          <h2>Local collaboration. None of the cloud friction.</h2>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature" key={feature.title}>
              <span className="feature-icon" aria-hidden="true">
                <FeatureIcon name={feature.icon} />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section reveal-section" id="how-it-works" data-reveal>
        <div className="section-head">
          <p className="eyebrow">How it works</p>
          <h2>Three steps from host machine to shared files.</h2>
        </div>

        <div className="steps-grid">
          <article className="step-card">
            <div className="step-visual" aria-hidden="true">
              <span className="step-waves" />
              <span className="step-waves step-waves--2" />
              <div className="step-folder">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                </svg>
                <span>design-system</span>
                <span className="step-folder-dot" />
              </div>
              <div className="step-caption">Broadcasting on LAN</div>
            </div>
            <div className="step-card-body">
              <span className="step-num">01</span>
              <h3>Host a workspace</h3>
              <p>Pick a folder on your desktop and open it as a shared workspace. LanSync broadcasts it on your network.</p>
            </div>
          </article>

          <article className="step-card">
            <div className="step-visual" aria-hidden="true">
              <ul className="step-peers">
                <li>
                  <span className="step-peer-dot" data-tone="ok" />
                  <span className="step-peer-name">Ava's MacBook</span>
                  <span className="step-peer-status">Discovered</span>
                </li>
                <li>
                  <span className="step-peer-dot" data-tone="info" />
                  <span className="step-peer-name">Noah's Windows</span>
                  <span className="step-peer-status">Joining…</span>
                </li>
                <li>
                  <span className="step-peer-dot" data-tone="muted" />
                  <span className="step-peer-name">Kai's iMac</span>
                  <span className="step-peer-status">Idle</span>
                </li>
              </ul>
              <div className="step-code" aria-hidden="true">
                <span>4</span><span>H</span><span>D</span><span className="is-focus">9</span>
              </div>
            </div>
            <div className="step-card-body">
              <span className="step-num">02</span>
              <h3>Teammates join</h3>
              <p>They discover the workspace on the same LAN, or paste a four-character short code.</p>
            </div>
          </article>

          <article className="step-card">
            <div className="step-visual" aria-hidden="true">
              <div className="step-toast">
                <span className="step-toast-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                </span>
                <div className="step-toast-body">
                  <strong>Request approved</strong>
                  <span>Noah joined · Code 4HD9</span>
                </div>
              </div>
              <div className="step-files">
                <div className="step-file"><span className="step-file-icon">▣</span>Assets<span className="step-file-meta">48</span></div>
                <div className="step-file"><span className="step-file-icon">▣</span>Components<span className="step-file-meta">64</span></div>
                <div className="step-file is-active"><span className="step-file-icon">▢</span>README.md<span className="step-file-meta">Synced</span></div>
              </div>
            </div>
            <div className="step-card-body">
              <span className="step-num">03</span>
              <h3>Approve and go</h3>
              <p>Accept the request and teammates are reading and editing the exact files — with zero uploads.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="section reveal-section" data-reveal>
        <div className="section-head">
          <p className="eyebrow">FAQ</p>
          <h2>Answers for the skeptical.</h2>
        </div>
        <div className="faq">
          {faqs.map((item) => (
            <details className="faq-item" key={item.q}>
              <summary>
                <span>{item.q}</span>
                <span className="faq-toggle" aria-hidden="true">+</span>
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section cta-section reveal-section" id="downloads" data-reveal>
        <div className="cta-card">
          <div>
            <p className="eyebrow">Install LanSync Studio</p>
            <h2>Ready on the machines you already use.</h2>
            <p className="cta-sub">
              Direct desktop downloads from the latest GitHub Release. No telemetry, no nested installers.
            </p>
          </div>
          <div className="cta-downloads">
            {visibleDownloads.map((download) => (
              <a className="download-row" key={download.title} href={download.href}>
                <span className="download-row-icon">
                  <PlatformIcon platform={download.platform as 'mac' | 'windows' | 'other'} />
                </span>
                <span className="download-row-body">
                  <span className="download-row-title">{download.title}</span>
                  <span className="download-row-meta">{download.meta}</span>
                </span>
                <span className="download-row-arrow" aria-hidden="true">
                  <ArrowIcon />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
