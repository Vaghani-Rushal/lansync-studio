export function TermsOfService() {
  return (
    <div className="policy-page">
      <div className="policy-header">
        <h1>Terms of Service</h1>
        <span className="policy-date">Last updated: April 16, 2026</span>
      </div>

      <div className="policy-content">
        <section className="policy-section">
          <h2>Acceptance of Terms</h2>
          <p>
            By downloading, installing, or using LanSync Studio (the "Application"), you agree
            to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms,
            please do not download or use the Application.
          </p>
          <p>
            These Terms apply to all users of LanSync Studio, including individuals using it
            for personal purposes and teams using it in a professional or educational environment.
          </p>
        </section>

        <section className="policy-section">
          <h2>Description of Service</h2>
          <p>
            LanSync Studio is a desktop application that enables local area network (LAN)
            file sharing and workspace collaboration between macOS and Windows machines on
            the same network. The Application operates without an internet connection and
            does not require cloud storage or external accounts.
          </p>
        </section>

        <section className="policy-section">
          <h2>Use License</h2>
          <p>
            Subject to your compliance with these Terms, we grant you a non-exclusive,
            non-transferable, revocable license to download, install, and use LanSync Studio
            for personal and commercial purposes on devices you own or control.
          </p>
          <p>You may:</p>
          <ul>
            <li>Install and use LanSync Studio on any devices you own or have permission to use</li>
            <li>Use the Application in professional, educational, or personal settings</li>
            <li>Share information about the Application and link to our official website</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Prohibited Uses</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Reverse engineer, decompile, disassemble, or attempt to derive the source code of the Application (except where permitted by applicable law)</li>
            <li>Use the Application to violate any applicable local, national, or international law or regulation</li>
            <li>Attempt to gain unauthorized access to other systems, networks, or devices through the Application</li>
            <li>Redistribute, sublicense, sell, or transfer the Application to third parties without permission</li>
            <li>Modify or create derivative works based on the Application without permission</li>
            <li>Use the Application in any manner that could damage, disable, or impair the Application or related infrastructure</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Intellectual Property</h2>
          <p>
            LanSync Studio and all related trademarks, logos, and software are the property
            of their respective owners. These Terms do not grant you any rights to use our
            trademarks, trade names, or other intellectual property except as expressly
            stated in the Use License above.
          </p>
          <p>
            Your own files and workspace data remain your property. We claim no ownership
            over content you create, share, or access using LanSync Studio.
          </p>
        </section>

        <section className="policy-section">
          <h2>Disclaimer of Warranties</h2>
          <p>
            LanSync Studio is provided <strong>"as is"</strong> and <strong>"as available"</strong>,
            without warranty of any kind, express or implied. To the fullest extent permitted
            by law, we disclaim all warranties, including but not limited to:
          </p>
          <ul>
            <li>Implied warranties of merchantability and fitness for a particular purpose</li>
            <li>Warranties that the Application will be uninterrupted, error-free, or secure</li>
            <li>Warranties regarding the accuracy or reliability of any information provided through the Application</li>
          </ul>
          <p>
            Your use of the Application is at your sole risk. You are responsible for
            maintaining appropriate backups of your data.
          </p>
        </section>

        <section className="policy-section">
          <h2>Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, LanSync Studio and its
            contributors, maintainers, and distributors shall not be liable for any:
          </p>
          <ul>
            <li>Indirect, incidental, special, consequential, or punitive damages</li>
            <li>Loss of profits, data, goodwill, or other intangible losses</li>
            <li>Damages resulting from unauthorized access to or alteration of your data</li>
            <li>Damages resulting from any interruption or cessation of the Application</li>
          </ul>
          <p>
            This limitation applies regardless of the theory of liability and even if we
            have been advised of the possibility of such damages.
          </p>
        </section>

        <section className="policy-section">
          <h2>Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will indicate the
            date of the most recent update at the top of this document. Material changes
            will be communicated through our GitHub repository or the official website.
          </p>
          <p>
            Your continued use of LanSync Studio after any changes constitutes your
            acceptance of the revised Terms.
          </p>
        </section>

        <section className="policy-section">
          <h2>Governing Law</h2>
          <p>
            These Terms are governed by and construed in accordance with applicable laws,
            without regard to conflict of law principles. Any disputes arising from these
            Terms or your use of the Application will be subject to the exclusive jurisdiction
            of competent courts in the applicable jurisdiction.
          </p>
        </section>

        <section className="policy-section">
          <h2>Contact</h2>
          <p>
            If you have questions about these Terms of Service, please open an issue on our{' '}
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
