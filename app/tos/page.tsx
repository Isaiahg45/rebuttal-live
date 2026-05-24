import Link from 'next/link'
import Nav from '../components/Nav'

export default function TermsOfService() {
  return (
    <>
      <Nav active="tos" />
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
            Terms of Service
          </h1>
          <p style={{ color: '#aaaaaa', fontSize: 14 }}>
            Effective date: May 24, 2026 &nbsp;·&nbsp; ViralBot AI LLC
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

          <Section title="1. Acceptance of Terms">
            By accessing or using Rebuttal.live (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service. These Terms apply to all visitors, users, and others who access or use the Service.
          </Section>

          <Section title="2. About the Service">
            Rebuttal.live is a live debate platform operated by ViralBot AI LLC, a limited liability company registered in the State of New Jersey, USA. The Service allows users to participate in text and voice-based debates, earn ranking points (ELO), and compete on leaderboards. AI-generated scoring is provided for entertainment and competitive purposes and does not constitute professional judgment of any kind.
          </Section>

          <Section title="3. Eligibility">
            You must be at least 13 years of age to use the Service. By using the Service, you represent and warrant that you meet this requirement. If you are under 18, you represent that you have your parent or guardian's permission to use the Service. We reserve the right to terminate accounts of users who misrepresent their age.
          </Section>

          <Section title="4. Accounts">
            <p>To access certain features, you must create an account. You are responsible for:</p>
            <ul style={{ paddingLeft: 20, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activity that occurs under your account</li>
              <li>Ensuring your account information is accurate and up to date</li>
            </ul>
            <p style={{ marginTop: 12 }}>We reserve the right to suspend or terminate accounts that violate these Terms, engage in abusive behavior, or are inactive for extended periods.</p>
          </Section>

          <Section title="5. User Conduct">
            <p>By using the Service, you agree not to:</p>
            <ul style={{ paddingLeft: 20, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Post or transmit hate speech, slurs, or content that targets individuals based on race, ethnicity, religion, gender, sexual orientation, disability, or national origin</li>
              <li>Harass, threaten, or intimidate other users</li>
              <li>Impersonate any person or entity</li>
              <li>Spam, flood, or deliberately repeat arguments to game the scoring system</li>
              <li>Use automated tools, bots, or scripts to interact with the Service in ways not expressly permitted</li>
              <li>Attempt to reverse engineer, hack, or compromise the integrity of the platform</li>
              <li>Post content that is illegal, defamatory, or violates any third-party rights</li>
            </ul>
            <p style={{ marginTop: 12 }}>Violations may result in immediate account suspension or permanent ban without notice.</p>
          </Section>

          <Section title="6. AI Scoring & ELO System">
            Rebuttal.live uses AI-powered scoring to evaluate debate arguments. This scoring is automated and provided for entertainment and competitive gameplay purposes only. It does not reflect professional, academic, or legal judgment. ELO ratings and leaderboard positions are in-platform metrics with no monetary value. We reserve the right to adjust, reset, or modify ELO scores and rankings at any time.
          </Section>

          <Section title="7. Voice Chat & Audio">
            Certain features of the Service allow real-time voice communication between users. By participating in voice debates, you consent to your spoken audio being temporarily processed for transcription and AI scoring purposes. Audio is not permanently stored. You must not use voice features to harass, threaten, or abuse other users. We reserve the right to disable voice features for users who violate these Terms.
          </Section>

          <Section title="8. Content Ownership & License">
            <p>You retain ownership of any content you submit to the Service. By submitting content (including debate arguments, text, and voice), you grant ViralBot AI LLC a non-exclusive, royalty-free, worldwide license to use, display, reproduce, and distribute that content in connection with operating and improving the Service.</p>
            <p style={{ marginTop: 12 }}>High-scoring arguments may be featured publicly on the platform. If you do not want your arguments featured, you may request removal by contacting us at viralbotaihelp@gmail.com.</p>
          </Section>

          <Section title="9. Intellectual Property">
            All content, design, code, branding, and features of Rebuttal.live — excluding user-submitted content — are the property of ViralBot AI LLC and protected by applicable intellectual property laws. You may not copy, reproduce, distribute, or create derivative works from any part of the Service without our express written permission.
          </Section>

          <Section title="10. Third-Party Services">
            The Service relies on third-party providers including Supabase (database and authentication), OpenAI (AI scoring), and cloud infrastructure providers. Your use of the Service is also subject to the terms and privacy policies of these third parties. We are not responsible for the practices of third-party services.
          </Section>

          <Section title="11. Disclaimer of Warranties">
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. VIRALBOTAI LLC DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS. YOUR USE OF THE SERVICE IS AT YOUR SOLE RISK.
          </Section>

          <Section title="12. Limitation of Liability">
            TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, VIRALBOTAI LLC SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY TO YOU SHALL NOT EXCEED $100 USD.
          </Section>

          <Section title="13. Indemnification">
            You agree to indemnify, defend, and hold harmless ViralBot AI LLC and its members, officers, employees, and agents from any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of your use of the Service, your content, or your violation of these Terms.
          </Section>

          <Section title="14. Modifications to the Service & Terms">
            We reserve the right to modify or discontinue the Service at any time without notice. We may also update these Terms from time to time. Continued use of the Service after changes are posted constitutes your acceptance of the revised Terms. We will update the effective date at the top of this page when changes are made.
          </Section>

          <Section title="15. Governing Law">
            These Terms are governed by and construed in accordance with the laws of the State of New Jersey, USA, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved in the state or federal courts located in New Jersey.
          </Section>

          <Section title="16. Contact">
            <p>If you have any questions about these Terms, please contact us:</p>
            <p style={{ marginTop: 12 }}>
              <strong style={{ color: '#f5f5f5' }}>ViralBot AI LLC</strong><br />
              New Jersey, USA<br />
              <a href="mailto:viralbotaihelp@gmail.com" style={{ color: '#e63946' }}>viralbotaihelp@gmail.com</a>
            </p>
          </Section>

        </div>

        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid #222', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/privacy" style={{ color: '#aaaaaa', fontSize: 14, textDecoration: 'underline' }}>Privacy Policy</Link>
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