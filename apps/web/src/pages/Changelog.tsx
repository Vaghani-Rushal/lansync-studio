type EntryType = 'Feature' | 'Improvement' | 'Fix' | 'Performance'

interface Entry {
  version: string
  date: string
  title: string
  tags: EntryType[]
  items: string[]
}

const entries: Entry[] = [
  {
    version: '0.4.0',
    date: 'April 20, 2026',
    title: 'Linear-inspired UI refresh',
    tags: ['Feature', 'Improvement'],
    items: [
      'Redesigned desktop surfaces with Inter Variable typography and a new indigo accent.',
      'New action-list pattern on Home and Join screens with inline status dots.',
      'Session code card gained a copy button with success feedback.',
      'Breadcrumb nav bar replaces the old back-button header across Share and Join.',
    ],
  },
  {
    version: '0.3.2',
    date: 'April 6, 2026',
    title: 'Client-side streaming hardened',
    tags: ['Fix', 'Performance'],
    items: [
      'Chunked streams now resume cleanly after a renderer reload.',
      'Fixed a rare deadlock when two clients opened the same DOCX simultaneously.',
      'Reduced preview memory footprint for large images by ~30%.',
    ],
  },
  {
    version: '0.3.0',
    date: 'March 18, 2026',
    title: 'Multi-workspace hosting',
    tags: ['Feature'],
    items: [
      'Host can now advertise several workspaces at once, each with its own session code.',
      'Permission updates propagate to connected clients without a reconnect.',
      'Added per-workspace pending-join counters in the Share screen.',
    ],
  },
  {
    version: '0.2.1',
    date: 'February 28, 2026',
    title: 'Windows installer polish',
    tags: ['Fix', 'Improvement'],
    items: [
      'Resolved firewall prompts on first launch on Windows 11.',
      'Installer now honors system-wide Inter and Segoe UI fallbacks.',
      'mDNS advertising is retried when the network interface changes.',
    ],
  },
  {
    version: '0.2.0',
    date: 'February 10, 2026',
    title: 'Clipboard window',
    tags: ['Feature'],
    items: [
      'Opt-in floating clipboard window with cross-platform paste shortcut.',
      'Image thumbnails for screenshots copied within a session.',
      'Configurable history size, disabled by default for privacy.',
    ],
  },
]

const tagTone: Record<EntryType, string> = {
  Feature: 'tag-feature',
  Improvement: 'tag-improvement',
  Fix: 'tag-fix',
  Performance: 'tag-performance',
}

export function Changelog() {
  return (
    <div className="doc-page">
      <div className="doc-header">
        <p className="eyebrow">Changelog</p>
        <h1>What we shipped</h1>
        <p className="doc-lede">
          Release notes for LanSync Studio. New builds ship roughly every two weeks; follow
          the repo for nightly channels.
        </p>
      </div>

      <div className="timeline">
        {entries.map((entry) => (
          <article className="timeline-entry" key={entry.version}>
            <div className="timeline-side">
              <span className="timeline-version">v{entry.version}</span>
              <span className="timeline-date">{entry.date}</span>
            </div>
            <div className="timeline-body">
              <h2>{entry.title}</h2>
              <div className="timeline-tags">
                {entry.tags.map((tag) => (
                  <span className={`tag ${tagTone[tag]}`} key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
              <ul className="timeline-list">
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
