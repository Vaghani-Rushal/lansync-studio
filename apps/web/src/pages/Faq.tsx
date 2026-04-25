interface QA {
  q: string
  a: string
}

interface Group {
  title: string
  items: QA[]
}

const groups: Group[] = [
  {
    title: 'Basics',
    items: [
      {
        q: 'What is LanSync Studio?',
        a: 'A desktop app for sharing folders and files between computers on the same local network, with no cloud involved.',
      },
      {
        q: 'Do I need an account?',
        a: "No. There's no login, no cloud profile, and no sign-up flow. You pick a display name the first time you open the app — that's it.",
      },
      {
        q: 'How many people can join one session?',
        a: 'As many as your LAN comfortably supports. The host approves each joiner individually and can revoke access at any time.',
      },
    ],
  },
  {
    title: 'Security & privacy',
    items: [
      {
        q: 'Does any data leave my network?',
        a: 'No. All traffic is peer-to-peer on the local network. LanSync Studio has no cloud relay, no analytics, and no telemetry.',
      },
      {
        q: 'Can I use LanSync on an air-gapped network?',
        a: 'Yes. The app requires zero internet connectivity and ships with no update-check beacons.',
      },
      {
        q: 'What happens to files on the joining computer?',
        a: 'Clients stream files into RAM by default. Only files the client explicitly edits and saves (with View + Edit permission) are written back to the host.',
      },
    ],
  },
  {
    title: 'Platform support',
    items: [
      {
        q: 'Which operating systems are supported?',
        a: 'macOS 12+ and Windows 10+. Linux support is on the roadmap.',
      },
      {
        q: 'Can a Mac host and a Windows client work together?',
        a: 'Yes. Hosts and clients are interchangeable across platforms, and the on-wire protocol is identical.',
      },
    ],
  },
  {
    title: 'Troubleshooting',
    items: [
      {
        q: "My teammate's machine isn't being discovered.",
        a: "Confirm both machines are on the same subnet and that mDNS isn't blocked. On Windows, make sure the network is set to Private, not Public. You can always join by typing the session code manually.",
      },
      {
        q: 'Can I change the port LanSync uses?',
        a: "Not in the UI yet — it's on the short-term roadmap. If 7788 is blocked, open an issue on the repo and we'll prioritize exposing it.",
      },
      {
        q: 'Where do I find the logs?',
        a: 'Open the app menu and choose Help → Export logs. This bundles recent logs into a zip you can attach to an issue.',
      },
    ],
  },
]

export function Faq() {
  return (
    <div className="doc-page">
      <div className="doc-header">
        <p className="eyebrow">FAQ</p>
        <h1>Frequently asked questions</h1>
        <p className="doc-lede">
          Short answers to the things we hear most often. If your question isn't
          here, the <a href="/docs">docs</a> cover setup in more depth.
        </p>
      </div>

      {groups.map((group) => (
        <section className="faq-group" key={group.title}>
          <p className="eyebrow">{group.title}</p>
          <div className="faq-list">
            {group.items.map((item) => (
              <details className="faq-item" key={item.q}>
                <summary>
                  <span>{item.q}</span>
                  <span className="faq-chevron" aria-hidden="true">+</span>
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
