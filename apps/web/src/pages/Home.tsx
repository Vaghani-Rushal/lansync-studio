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

const highlights = ['No cloud', 'Join with a code', 'macOS + Windows']

const stats = [
  { value: '0', label: 'Cloud uploads' },
  { value: '<100', label: 'ms first byte' },
  { value: '7788', label: 'Local port' },
  { value: '2', label: 'Platforms' },
]

type ClientPlatform = 'mac' | 'windows' | 'other'

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
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v11m0 0 4-4m-4 4-4-4M4 17v2h16v-2" />
    </svg>
  )
}

const BoltIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8z" />
  </svg>
)

const ShieldIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 4 6v6c0 5 3.4 8.5 8 9 4.6-.5 8-4 8-9V6l-8-3z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

const NetworkIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <circle cx="4" cy="5" r="2" />
    <circle cx="20" cy="5" r="2" />
    <circle cx="4" cy="19" r="2" />
    <circle cx="20" cy="19" r="2" />
    <path d="m6 6 4 4m8-4-4 4m-8 8 4-4m8 4-4-4" />
  </svg>
)

const features = [
  {
    icon: <BoltIcon />,
    title: 'Instant sharing',
    body: 'Pick a folder, get a code. Peers join from the same Wi-Fi in one click.',
  },
  {
    icon: <ShieldIcon />,
    title: 'Nothing leaves the LAN',
    body: 'No cloud relay. No telemetry. Works on air-gapped networks.',
  },
  {
    icon: <NetworkIcon />,
    title: 'Live, not synced',
    body: 'Clients stream files on demand. No duplicate copies, no drift.',
  },
]

const steps = [
  {
    label: 'Host',
    title: 'Share a workspace',
    body: 'Pick a folder. Set default permissions.',
    mock: (
      <div className="step-mock">
        <div className="step-mock-head">
          <span className="step-mock-dot" /> Workspace
        </div>
        <div className="step-mock-field">design-system</div>
        <div className="step-mock-row">
          <span className="chip chip-active">View + Edit</span>
          <span className="chip">View only</span>
        </div>
        <div className="step-mock-btn">Pick folder →</div>
      </div>
    ),
  },
  {
    label: 'Join',
    title: 'Enter the code',
    body: 'Or pick a host that appears on your LAN.',
    mock: (
      <div className="step-mock">
        <div className="step-mock-head">
          <span className="step-mock-dot dot-indigo" /> Session code
        </div>
        <div className="step-mock-code">4HD9</div>
        <div className="step-mock-list">
          <div className="step-mock-list-item">
            <span className="step-mock-dot dot-green" />
            <span>Maya's Mac · design-system</span>
          </div>
          <div className="step-mock-list-item">
            <span className="step-mock-dot dot-green" />
            <span>Alex-PC · shared-docs</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: 'Work',
    title: 'Open and edit',
    body: 'Files stream on demand. Edits save to the host.',
    mock: (
      <div className="step-mock">
        <div className="step-mock-head">
          <span className="step-mock-dot dot-green" /> Live · README.md
        </div>
        <div className="step-mock-lines">
          <div className="mock-line w60" />
          <div className="mock-line w90" />
          <div className="mock-line w40" />
          <div className="mock-line w80" />
          <div className="mock-line w55" />
        </div>
        <div className="step-mock-footer">
          <span className="chip chip-active">Saved</span>
          <span className="mock-mono">2 sec ago</span>
        </div>
      </div>
    ),
  },
]

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
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    )

    for (const section of sections) {
      observer.observe(section)
    }

    return () => { observer.disconnect() }
  }, [])

  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="hero-section reveal-section" id="hero" data-reveal>
        <div className="hero-copy">
          <p className="eyebrow">LAN-native file sharing</p>
          <h1>Share files. On your network. In seconds.</h1>

          <div
            className={`hero-actions ${visibleDownloads.length === 1 ? 'hero-actions--single' : ''}`}
            id="downloads"
          >
            {visibleDownloads.map((download) => (
              <a className="download-card" key={download.title} href={download.href}>
                <div className="download-card-body">
                  <span className="download-card-title">{download.title}</span>
                  <small>{download.meta}</small>
                </div>
                <span className="download-card-arrow" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </span>
              </a>
            ))}
          </div>

          <div className="hero-meta">
            {highlights.map((item) => (
              <span className="meta-pill" key={item}>
                <span className="meta-dot" /> {item}
              </span>
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
                <p className="panel-label">Session</p>
                <div className="signal-row">
                  <strong>4 peers</strong>
                  <span>LAN active</span>
                </div>
                <div className="signal-meter">
                  <span /><span /><span /><span />
                </div>
              </div>
              <div className="window-panel window-panel-wide">
                <p className="panel-label">Activity</p>
                <div className="activity-item">
                  <span>Maya joined</span>
                  <strong>just now</strong>
                </div>
                <div className="activity-item">
                  <span>README.md</span>
                  <strong>edited</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="studio-window studio-window-side">
            <p className="panel-label">Quick join</p>
            <div className="join-code">4HD9</div>
            <div className="join-note">Same LAN. One tap.</div>
          </div>
        </div>
      </section>

      {/* ─── LAN diagram ──────────────────────────────────────── */}
      <section className="diagram-section reveal-section" data-reveal>
        <div className="section-heading centered">
          <p className="eyebrow">How the network works</p>
          <h2>One host. Many peers. Zero cloud.</h2>
        </div>

        <div className="lan-diagram" aria-hidden="true">
          <svg viewBox="0 0 900 340" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#7170ff" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#7170ff" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="stroke" x1="0" x2="1">
                <stop offset="0%" stopColor="#5e6ad2" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#7170ff" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#5e6ad2" stopOpacity="0.4" />
              </linearGradient>
            </defs>

            <circle cx="450" cy="170" r="160" fill="url(#glow)" />

            <g stroke="url(#stroke)" strokeWidth="1.4" fill="none" strokeLinecap="round">
              <path d="M 450 170 C 340 110, 220 100, 140 80" className="lan-path" />
              <path d="M 450 170 C 570 100, 690 95, 760 80" className="lan-path" />
              <path d="M 450 170 C 360 240, 240 260, 140 280" className="lan-path" />
              <path d="M 450 170 C 560 250, 680 260, 760 280" className="lan-path" />
              <path d="M 450 170 C 440 240, 430 280, 450 310" className="lan-path" />
            </g>

            <g fill="#7170ff">
              <circle r="3" className="lan-packet">
                <animateMotion dur="3.2s" repeatCount="indefinite" path="M 450 170 C 340 110, 220 100, 140 80" />
              </circle>
              <circle r="3" className="lan-packet">
                <animateMotion dur="3.6s" begin="0.4s" repeatCount="indefinite" path="M 450 170 C 570 100, 690 95, 760 80" />
              </circle>
              <circle r="3" className="lan-packet">
                <animateMotion dur="3.4s" begin="0.8s" repeatCount="indefinite" path="M 450 170 C 360 240, 240 260, 140 280" />
              </circle>
              <circle r="3" className="lan-packet">
                <animateMotion dur="3.8s" begin="1.2s" repeatCount="indefinite" path="M 450 170 C 560 250, 680 260, 760 280" />
              </circle>
            </g>

            <g>
              <rect x="400" y="130" width="100" height="80" rx="14" fill="#191a1b" stroke="#7170ff" strokeWidth="1.2" />
              <text x="450" y="165" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="510" fill="#8a8f98" letterSpacing="0.12em">HOST</text>
              <text x="450" y="188" textAnchor="middle" fontFamily="Berkeley Mono, ui-monospace" fontSize="13" fontWeight="510" fill="#f7f8f8">design-system</text>
            </g>

            {[
              { x: 100, y: 60, name: 'Maya' },
              { x: 720, y: 60, name: 'Alex' },
              { x: 100, y: 260, name: 'Sam' },
              { x: 720, y: 260, name: 'Kai' },
              { x: 420, y: 290, name: 'Jin' },
            ].map((p) => (
              <g key={p.name}>
                <rect x={p.x} y={p.y} width="80" height="50" rx="10" fill="#0f1011" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <circle cx={p.x + 14} cy={p.y + 25} r="3" fill="#10b981" />
                <text x={p.x + 26} y={p.y + 30} fontFamily="Inter, sans-serif" fontSize="12" fontWeight="510" fill="#d0d6e0">{p.name}</text>
              </g>
            ))}

            <g opacity="0.55" transform="translate(820, 30)">
              <text x="0" y="-4" fontFamily="Inter, sans-serif" fontSize="9" fontWeight="510" letterSpacing="0.18em" fill="#eb5757">NO</text>
              <path d="M 6 0 Q 14 -6 22 0 Q 30 -2 34 4 Q 40 4 40 10 L 6 10 Q 0 10 0 6 Q 0 2 6 0 Z" fill="none" stroke="#eb5757" strokeWidth="1.2" />
              <line x1="-2" y1="-2" x2="42" y2="14" stroke="#eb5757" strokeWidth="1.6" strokeLinecap="round" />
            </g>
          </svg>
        </div>
      </section>

      {/* ─── Stats strip ──────────────────────────────────────── */}
      <section className="stats-strip reveal-section" data-reveal>
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      {/* ─── Features (bento with icons) ───────────────────────── */}
      <section className="content-section reveal-section" id="features" data-reveal>
        <div className="section-heading">
          <p className="eyebrow">Why it feels different</p>
          <h2>Built for the network you're already on.</h2>
        </div>
        <div className="bento-grid">
          {features.map((feature) => (
            <article className="bento-card" key={feature.title}>
              <div className="bento-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ─── How it works (with mini-mocks) ────────────────────── */}
      <section
        className="content-section workflow-section reveal-section"
        id="how-it-works"
        data-reveal
      >
        <div className="section-heading">
          <p className="eyebrow">How it works</p>
          <h2>Three steps. No account. No setup.</h2>
        </div>
        <div className="step-grid step-grid-visual">
          {steps.map((step, index) => (
            <article className="step-card-v2" key={step.label}>
              <div className="step-card-mock">{step.mock}</div>
              <div className="step-card-meta">
                <span className="step-number">0{index + 1} · {step.label}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ─── Download CTA ─────────────────────────────────────── */}
      <section className="content-section download-section reveal-section" data-reveal>
        <div className="download-panel">
          <div>
            <p className="eyebrow">Ready when you are</p>
            <h2>Install once. Share instantly.</h2>
          </div>
          <div className="download-stack">
            {visibleDownloads.map((download) => (
              <a className="download-btn-large" key={download.title} href={download.href}>
                <div className="download-btn-icon">
                  <PlatformIcon platform={download.platform as 'mac' | 'windows' | 'other'} />
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
