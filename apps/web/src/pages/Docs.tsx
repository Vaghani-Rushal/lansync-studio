const sections = [
  { id: 'prerequisites', label: 'Prerequisites' },
  { id: 'install', label: 'Install' },
  { id: 'share', label: 'Share a workspace' },
  { id: 'join', label: 'Join a session' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'shortcuts', label: 'Keyboard shortcuts' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
]

const shortcuts: Array<{ keys: string[]; label: string }> = [
  { keys: ['⌘', 'K'], label: 'Open command palette' },
  { keys: ['⌘', 'N'], label: 'Start a new workspace' },
  { keys: ['⌘', 'J'], label: 'Join a session' },
  { keys: ['⌘', 'C'], label: 'Copy session code' },
  { keys: ['⌘', 'S'], label: 'Save current file' },
  { keys: ['Esc'], label: 'Close modal or cancel' },
]

export function Docs() {
  return (
    <div className="doc-page doc-with-toc">
      <aside className="doc-toc" aria-label="Documentation sections">
        <p className="eyebrow">On this page</p>
        <nav>
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="doc-main">
        <div className="doc-header">
          <p className="eyebrow">Documentation</p>
          <h1>Getting started with LanSync Studio</h1>
          <p className="doc-lede">
            A quick tour of hosting, joining, and editing workspaces across a local
            network. Works the same on macOS and Windows.
          </p>
        </div>

        <section id="prerequisites" className="doc-section">
          <h2>Prerequisites</h2>
          <ul>
            <li>macOS 12+ or Windows 10+</li>
            <li>A shared network (Wi-Fi, wired, or ad-hoc) for every participating device</li>
            <li>mDNS/Bonjour enabled (default on macOS; enabled in Windows 10+)</li>
            <li>Port <code>7788</code> available on the host machine</li>
          </ul>
        </section>

        <section id="install" className="doc-section">
          <h2>Install</h2>
          <p>
            Download the desktop binary for your platform from the <a href="/#downloads">home page</a>.
            The installer is signed and notarized; no post-install configuration is required.
          </p>
          <div className="doc-callout">
            <p className="eyebrow">First launch</p>
            <p>
              On Windows you'll see a firewall prompt the first time you share — allow it
              so peers on the same LAN can discover your host.
            </p>
          </div>
        </section>

        <section id="share" className="doc-section">
          <h2>Share a workspace</h2>
          <ol>
            <li>Launch LanSync Studio and pick a display name.</li>
            <li>Click <strong>Share a workspace</strong> from the home screen.</li>
            <li>Give the workspace a name and choose a default permission.</li>
            <li>Pick a file or folder — the session code appears instantly.</li>
            <li>Share the code with teammates. They can join over mDNS or by typing the code.</li>
          </ol>
        </section>

        <section id="join" className="doc-section">
          <h2>Join a session</h2>
          <p>
            From the home screen, click <strong>Join a session</strong>. You'll see any nearby
            hosts advertised over the LAN — click one to request access. If you don't see a
            host, type the 4-character session code into the code box.
          </p>
          <p>
            The host sees your display name and can approve or decline. You remain in
            the "waiting" state until they do; cancelling is safe.
          </p>
        </section>

        <section id="permissions" className="doc-section">
          <h2>Permissions</h2>
          <p>There are two permission levels, set per client by the host:</p>
          <ul>
            <li><strong>View only</strong> — stream files, preview contents, no writes.</li>
            <li><strong>View + Edit</strong> — save changes back to the host's workspace.</li>
          </ul>
          <p>
            Permissions can be changed while a client is connected; the client's editor
            transitions to read-only without a reconnect.
          </p>
        </section>

        <section id="shortcuts" className="doc-section">
          <h2>Keyboard shortcuts</h2>
          <div className="shortcut-grid">
            {shortcuts.map((s) => (
              <div className="shortcut-row" key={s.label}>
                <span className="shortcut-keys">
                  {s.keys.map((k) => (
                    <kbd className="kbd" key={k}>
                      {k}
                    </kbd>
                  ))}
                </span>
                <span className="shortcut-label">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="troubleshooting" className="doc-section">
          <h2>Troubleshooting</h2>
          <ul>
            <li>
              <strong>Host isn't discovered.</strong> Verify both machines are on the same subnet and
              that mDNS isn't blocked by a corporate firewall — the session-code fallback always works.
            </li>
            <li>
              <strong>Firewall prompt loops on Windows.</strong> Approve the prompt as Private Network.
              Public networks block mDNS by default.
            </li>
            <li>
              <strong>Large previews feel slow.</strong> Ensure both ends run v0.3.2 or later — chunk
              sizing was tuned for multi-megabyte files.
            </li>
          </ul>
          <p>
            Still stuck? File an issue on the repo with the log bundle from{' '}
            <strong>Help → Export logs</strong>.
          </p>
        </section>
      </div>
    </div>
  )
}
