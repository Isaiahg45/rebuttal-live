import Link from 'next/link'
import Nav from '../components/Nav'

export default function PrivacyPolicy() {
  return (
    <>
      <Nav active="privacy" />
      <main style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '60px 24px 120px',
        fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
        color: '#f5f5f5',
      }}>
        <div style={{ marginBottom: 48 }}>
          <p style={{ color: '#e63946', fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Legal</p>
          <h1 style={{ fontSize: 'clamp(32px, 6vw, 52px)', fontFamily: 'var(--font-bebas), Bebas Neue, sans-serif', letterSpacing: 1, marginBottom: 16, lineHeight: 1.1 }}>
            Privacy Policy
          </h1>
          <p style={{ color: '#aaaaaa', fontSize: 14 }}>
            Effective date: May 24, 2026 &nbsp;·&nbsp; ViralBot AI LLC
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

          <Section title="1. Introduction">
            ViralBot AI LLC ("we," "us," or "our") operates Rebuttal.live (the "Service"). This Privacy Policy explains how we collect, use, disclose, and protect information about you when you use the Service. By using the Service, you agree to the collection and use of information in accordance with this policy.
          </Section>

          <Section title="2. Information We Collect">
            <p><strong style={{ color: '#f5f5f5' }}>Information you provide directly:</strong></p>
            <ul style={{ paddingLeft: 20, marginTop: 10, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Email address (collected via Google OAuth or email sign-up through Supabase Auth)</li>
              <li>Username chosen at account creation</li>
              <li>Debate arguments and messages submitted to the platform</li>
              <li>Voice audio submitted during voice debate sessions (processed in real time, not stored)</li>
            </ul>
            <p><strong style={{ color: '#f5f5f5' }}>Information collected automatically:</strong></p>
            <ul style={{ paddingLeft: 20, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>ELO score, win/loss record, and debate history</li>
              <li>Timestamps of debates and arguments</li>
              <li>General usage data such as pages visited and features used</li>
              <li>IP address and browser/device information via standard server logs</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul style={{ paddingLeft: 20, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Create and manage your account</li>
              <li>Operate the debate platform, including real-time matchmaking and scoring</li>
              <li>Calculate and display ELO rankings and leaderboards</li>
              <li>Process and score debate arguments using AI (via OpenAI)</li>
              <li>Feature high-scoring arguments publicly on the platform</li>
              <li>Detect and prevent abuse, spam, and violations of our Terms of Service</li>
              <li>Improve the Service and develop new features</li>
              <li>Respond to your inquiries and support requests</li>
            </ul>
          </Section>

          <Section title="4. Voice Audio & Transcription">
            When you participate in a voice debate, your microphone audio is captured by your browser using the Web Speech API. This audio is processed locally in your browser and/or temporarily transmitted to transcription services solely for the purpose of generating debate argument text for AI scoring. We do not record, store, or retain raw audio after a debate session ends. Transcribed text from your arguments may be stored as part of your debate record.
          </Section>

          <Section title="5. AI Scoring & OpenAI">
            Debate arguments (text and transcribed voice) are sent to OpenAI's API for scoring and feedback. This means your argument text is processed by OpenAI in accordance with their privacy policy and terms of service. We do not send your name, email, or account information to OpenAI — only the argument text and the debate topic. For more information, see{' '}
            <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: '#e63946' }}>OpenAI's Privacy Policy</a>.
          </Section>

          <Section title="6. How We Share Your Information">
            <p>We do not sell your personal information. We may share information in the following limited circumstances:</p>
            <ul style={{ paddingLeft: 20, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><strong style={{ color: '#f5f5f5' }}>Service providers:</strong> We use Supabase for authentication and database services, and OpenAI for AI scoring. These providers receive only the data necessary to perform their functions.</li>
              <li><strong style={{ color: '#f5f5f5' }}>Public platform features:</strong> Your username, ELO score, debate record, and high-scoring arguments may be displayed publicly on the platform.</li>
              <li><strong style={{ color: '#f5f5f5' }}>Legal requirements:</strong> We may disclose your information if required by law, regulation, or valid legal process.</li>
              <li><strong style={{ color: '#f5f5f5' }}>Business transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.</li>
            </ul>
          </Section>

          <Section title="7. Data Retention">
            We retain your account information and debate history for as long as your account is active. If you delete your account, we will delete or anonymize your personal information within 30 days, except where retention is required by law or for legitimate business purposes such as fraud prevention. Debate messages that have been publicly featured may remain on the platform in anonymized form.
          </Section>

          <Section title="8. Cookies & Local Storage">
            The Service uses cookies and browser local storage to maintain your session and authentication state. We do not use third-party advertising cookies. You can disable cookies in your browser settings, but doing so may affect your ability to log in or use certain features of the Service.
          </Section>

          <Section title="9. Security">
            We implement reasonable technical and organizational measures to protect your information against unauthorized access, loss, or misuse. Authentication is handled through Supabase, which uses industry-standard encryption. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
          </Section>

          <Section title="10. Children's Privacy">
            The Service is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected such information, we will delete it promptly. If you believe a child under 13 has provided us with personal information, please contact us at viralbotaihelp@gmail.com.
          </Section>

          <Section title="11. Your Rights & Choices">
            <p>Depending on your location, you may have the following rights regarding your personal information:</p>
            <ul style={{ paddingLeft: 20, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><strong style={{ color: '#f5f5f5' }}>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong style={{ color: '#f5f5f5' }}>Correction:</strong> Request correction of inaccurate information</li>
              <li><strong style={{ color: '#f5f5f5' }}>Deletion:</strong> Request deletion of your account and associated data</li>
              <li><strong style={{ color: '#f5f5f5' }}>Opt-out of featured content:</strong> Request removal of your arguments from public features</li>
            </ul>
            <p style={{ marginTop: 12 }}>To exercise any of these rights, contact us at viralbotaihelp@gmail.com. We will respond within 30 days.</p>
          </Section>

          <Section title="12. Third-Party Links">
            The Service may contain links to third-party websites. We are not responsible for the privacy practices of those sites. We encourage you to review the privacy policies of any third-party sites you visit.
          </Section>

          <Section title="13. Changes to This Policy">
            We may update this Privacy Policy from time to time. When we do, we will update the effective date at the top of this page. Continued use of the Service after changes are posted constitutes your acceptance of the updated policy. We encourage you to review this policy periodically.
          </Section>

          <Section title="14. Contact Us">
            <p>If you have any questions, concerns, or requests regarding this Privacy Policy, please contact us:</p>
            <p style={{ marginTop: 12 }}>
              <strong style={{ color: '#f5f5f5' }}>ViralBot AI LLC</strong><br />
              New Jersey, USA<br />
              <a href="mailto:viralbotaihelp@gmail.com" style={{ color: '#e63946' }}>viralbotaihelp@gmail.com</a>
            </p>
          </Section>

        </div>

        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid #222', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/tos" style={{ color: '#aaaaaa', fontSize: 14, textDecoration: 'underline' }}>Terms of Service</Link>
          <Link href="/rebut" style={{ color: '#aaaaaa', fontSize: 14, textDecoration: 'underline' }}>Back to Rebuttal</Link>
        </div>
      </main>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{
        fontSize: 18,
        fontWeight: 700,
        color: '#f5f5f5',
        marginBottom: 14,
        paddingBottom: 10,
        borderBottom: '1px solid #1e1e1e',
      }}>
        {title}
      </h2>
      <div style={{ color: '#aaaaaa', fontSize: 15, lineHeight: 1.75 }}>
        {typeof children === 'string' ? <p>{children}</p> : children}
      </div>
    </section>
  )
}