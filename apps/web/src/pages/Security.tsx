const principles = [
  {
    title: 'No cloud, ever',
    body:
      'All workspace data flows directly between peers on your network. We never proxy, mirror, or store a single byte of your files.',
  },
  {
    title: 'No telemetry',
    body:
      'The desktop app ships with no analytics, no crash-reporting beacons, and no remote logging. It works identically on an air-gapped network.',
  },
  {
    title: 'Session-scoped access',
    body:
      'Every join is gated by the host. Approvals are explicit and revocable; clients hold no persistent credentials.',
  },
  {
    title: 'Memory-first clients',
    body:
      "Joining clients stream files directly into RAM. Nothing is written to disk unless the host explicitly grants edit permission and the user saves.",
  },
]

export function Security() {
  return (
    <div className="doc-page">
      <div className="doc-header">
        <p className="eyebrow">Security</p>
        <h1>How LanSync Studio keeps your data local</h1>
        <p className="doc-lede">
          A summary of the architectural decisions that make LanSync Studio safe to
          run on sensitive or regulated networks.
        </p>
      </div>

      <div className="principles-grid">
        {principles.map((p) => (
          <article className="principle-card" key={p.title}>
            <h3>{p.title}</h3>
            <p>{p.body}</p>
          </article>
        ))}
      </div>

      <section className="doc-section">
        <h2>Data flow</h2>
        <p>
          A host machine runs a WebSocket server on port <code>7788</code> and advertises
          itself over mDNS. Clients on the same LAN discover the host, request to join,
          and — upon approval — receive file metadata and on-demand byte streams.
        </p>
        <p>
          No traffic leaves the local network. There is no back-channel to us, to any
          cloud provider, or to any third-party service. Session codes are random,
          short-lived identifiers; they grant nothing outside the local session.
        </p>
      </section>

      <section className="doc-section">
        <h2>Threat model</h2>
        <p>
          LanSync Studio assumes a trusted local network. It is designed for studios,
          offices, classrooms, and labs where participants have already been vetted.
          It is <strong>not</strong> intended as a public file-drop or as a substitute for
          end-to-end encrypted messaging.
        </p>
        <p>
          Within a trusted LAN, the following protections apply:
        </p>
        <ul>
          <li>All join requests require host approval — no auto-accept mode.</li>
          <li>Session codes are randomly generated per workspace and rotate on restart.</li>
          <li>Revoked clients are disconnected immediately and cannot reconnect without a new approval.</li>
          <li>Edits are serialized through the host; clients cannot modify each other's state directly.</li>
        </ul>
      </section>

      <section className="doc-section">
        <h2>Reporting a vulnerability</h2>
        <p>
          If you believe you've found a security issue, please email{' '}
          <a href="mailto:security@lansyncstudio.local">security@lansyncstudio.local</a>{' '}
          with reproduction steps. We respond within 72 hours and will coordinate a
          disclosure timeline with you before publishing a fix.
        </p>
      </section>
    </div>
  )
}
