export function PrivacyPolicy() {
  return (
    <div className="policy-page">
      <div className="policy-header">
        <h1>Privacy Policy</h1>
        <span className="policy-date">Last updated: April 16, 2026</span>
      </div>

      <div className="policy-content">
        <section className="policy-section">
          <h2>Introduction</h2>
          <p>
            LanSync Studio is a desktop application that enables file sharing and workspace
            collaboration over local area networks (LAN). We are committed to protecting your
            privacy. This policy explains what information the application handles and how.
          </p>
          <p>
            The short version: LanSync Studio does not collect, transmit, or store any personal
            information on external servers. Everything stays on your local network.
          </p>
        </section>

        <section className="policy-section">
          <h2>Information We Collect</h2>
          <p>
            LanSync Studio does not collect personal data. All data handled by the
            application — including workspace files, join codes, and session activity —
            remains entirely within your local network and is never sent to any external server.
          </p>
          <p>We do not collect:</p>
          <ul>
            <li>Names, email addresses, or account credentials</li>
            <li>IP addresses or device identifiers beyond local LAN communication</li>
            <li>Usage analytics, telemetry, or crash reports</li>
            <li>File contents, file names, or file metadata</li>
            <li>Location data of any kind</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Local Data Storage</h2>
          <p>
            LanSync Studio stores only application preferences — such as your theme setting —
            locally on your device using standard OS mechanisms (e.g., browser localStorage for
            the web interface). No data is synchronized to any cloud service or third-party server.
          </p>
          <p>
            Workspace data, session history, and file activity logs are kept entirely in memory
            or on the local filesystem of the host machine and are never transmitted off-network.
          </p>
        </section>

        <section className="policy-section">
          <h2>Network Communication</h2>
          <p>
            The application communicates exclusively over your local area network (LAN).
            No data is sent to the internet, and no internet connection is required to use
            LanSync Studio. Peer discovery and file transfer happen directly between devices
            on the same network segment.
          </p>
        </section>

        <section className="policy-section">
          <h2>Third-Party Services</h2>
          <p>
            LanSync Studio does not integrate with or transmit data to any third-party services,
            analytics platforms, advertising networks, or cloud providers. The application
            has no external dependencies that involve data sharing.
          </p>
        </section>

        <section className="policy-section">
          <h2>Cookies and Tracking</h2>
          <p>
            The LanSync Studio desktop application does not use cookies or any tracking
            technologies. The marketing website (this site) uses only a single localStorage
            entry to remember your theme preference (light or dark mode). No tracking cookies,
            fingerprinting, or behavioral analytics are used.
          </p>
        </section>

        <section className="policy-section">
          <h2>Children's Privacy</h2>
          <p>
            LanSync Studio is not directed at children under the age of 13. We do not
            knowingly collect any information from children. If you believe a child has
            provided us with personal information, please contact us so we can take
            appropriate action.
          </p>
        </section>

        <section className="policy-section">
          <h2>Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time to reflect changes in the
            application or applicable law. We will indicate the date of the most recent update
            at the top of this document. We encourage you to review this policy periodically.
          </p>
        </section>

        <section className="policy-section">
          <h2>Contact</h2>
          <p>
            If you have questions or concerns about this Privacy Policy, please open an issue
            on our{' '}
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              GitHub repository
            </a>
            . We aim to respond within a few business days.
          </p>
        </section>
      </div>

    </div>
  )
}
