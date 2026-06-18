'use client'
import { useState } from 'react'
import Nav from '../components/Nav'
import { useRouter } from 'next/navigation'

const faqs = [
  {
    q: 'What is rebuttal.live?',
    a: 'rebuttal.live is a real-time competitive debate platform where you argue with strangers on any topic — from pop culture to politics — and an AI judge scores your arguments live. The best debater wins ELO and climbs the global leaderboard.'
  },
  {
    q: 'How does the AI scoring work?',
    a: 'After every message you send, our AI judge evaluates it on four criteria: logic & clarity (0–8), evidence & examples (0–8), depth of argument (0–7), and vocabulary & expression (0–7) — for a max of 30 points per argument. The stronger and more detailed your point, the higher your score.'
  },
  {
    q: 'How do I earn ELO?',
    a: 'ELO is earned by winning debates. In games with 6 or fewer players, the top scorer wins ELO and everyone else loses a small amount. In larger games, the top 3 scorers all gain ELO. Competitive rooms offer much higher ELO rewards but also higher stakes. Guests do not earn ELO — sign up to keep your ranking.'
  },
  {
    q: 'What are the different room types?',
    a: 'Casual rooms are light and fun (food, pop culture, everyday topics) with small ELO stakes. Serious rooms tackle real political, social, and philosophical questions with higher ELO rewards. Competitive rooms are for high-ELO players only and offer the biggest gains. Random rooms are wildcard topics — anything goes.'
  },
  {
    q: 'What is Topic of the Day?',
    a: 'Topic of the Day is a massive 40-person debate room that runs for 30 minutes at a time. One hot topic, up to 40 debaters, and one winner. It resets every 30 minutes with a new topic. There\'s no ELO at stake — just bragging rights and the leaderboard.'
  },
  {
    q: 'Can I play as a guest?',
    a: 'Yes — guests can join any room and debate freely, but they won\'t earn ELO or appear on the global rankings. Sign up with Google or email to track your progress and climb the leaderboard.'
  },
  {
    q: 'Why can\'t I copy and paste into the chat?',
    a: 'Copy-pasting is disabled to keep debates authentic. The AI scores your arguments — if you paste someone else\'s words, you\'re not actually debating. Write your own arguments for a fair fight.'
  },
  {
    q: 'Why is there a cooldown between messages?',
    a: 'In rooms with 6 or fewer players, the cooldown is 15 seconds. In larger rooms it\'s 30 seconds. This prevents spam and encourages thoughtful, considered arguments rather than rapid-fire low-quality messages.'
  },
  {
    q: 'What are competitive rooms and how do I access them?',
    a: 'Competitive rooms require a minimum ELO to join (shown on the room card). They feature the most challenging philosophical and political topics, the longest debates, and the highest ELO rewards — up to +200 ELO for first place. Earn your way there.'
  },
  {
    q: 'Can I spectate ongoing debates?',
    a: 'Yes. Any active debate can be watched in real-time. Click "Watch Live" on any ongoing debate from the lobby. You\'ll see all messages and scores but won\'t be able to participate.'
  },
 {
    q: 'What are Buddies?',
    a: 'Buddies are your connections on Rebuttal. You can send a buddy request to any debater by clicking their profile. Once they accept, you\'re buddies — you\'ll appear in each other\'s buddy list on your profile, and you can challenge them directly to a private custom debate with one tap. Your buddy count is also visible on your public profile. It\'s the fastest way to set up rematches with people you\'ve debated before.'
  },
 {
    q: 'How do I change my username?',
    a: 'Go to your Profile page and click "Edit Username". Usernames must be 3–16 characters and can only contain letters, numbers, and underscores. Your old username is released when you change it.'
  },
  {
    q: 'Who is the Rebut Man?',
    a: "The Rebut Man is Rebuttal live's immortal mascot and the face of the Rebut Shop. Legend has it he won every debate competition he entered throughout history, whether it was  with Plato during 400 BC, the early 1800s or the 90s — undefeated, untouchable, never once on the losing side of an argument. His reputation finally caught up with him in a bar fight after one debate too many, where he lost an eye defending his unbeaten record. Now he wears the eye patch as a badge of honor, still dressed sharp, still ready to argue anyone under the table. He watches over the Rebut Shop today, dealing in Rebut coins and Pro memberships from his dungeon."
  },
]

export default function HelpPage() {
  const [open, setOpen] = useState<number | null>(null)
  const router = useRouter()

  return (
    <>
      <Nav active="help" />
      <div style={{ minHeight: 'calc(100vh - 56px)', overflowY: 'auto' }}>

        {/* Hero */}
        <div style={{ background: 'linear-gradient(180deg,rgba(230,57,70,0.08),transparent)', padding: '48px 24px 40px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '48px', letterSpacing: '4px', marginBottom: '12px' }}>
            HELP CENTER
          </div>
          <div style={{ fontSize: '15px', color: 'var(--muted)', maxWidth: '500px', margin: '0 auto', lineHeight: 1.7 }}>
            Everything you need to know about rebuttal.live — how it works, how to win, and how to climb the ranks.
          </div>
          <button
            onClick={() => router.push('/rebut')}
            style={{ marginTop: '24px', background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '12px 28px', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
          >
            ⚡ Start Debating
          </button>
        </div>

        {/* What is rebuttal.live */}
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', marginBottom: '32px' }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '2px', marginBottom: '16px', color: 'var(--accent)' }}>
              WHAT IS REBUTTAL.LIVE?
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 1.9, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p>rebuttal.live is where debate becomes a competitive sport. You join live rooms, argue your position on real topics — politics, philosophy, pop culture, ethics — and an AI judge scores every argument you make in real time.</p>
              <p>Every point you score builds toward your total. The person with the most points at the end wins the debate, earns ELO, and climbs the global leaderboard. The best debaters unlock high-stakes Competitive rooms with massive ELO rewards.</p>
              <p>Unlike social media arguments, rebuttal.live is structured, scored, and fair. No bots running your opinion. No algorithms hiding your voice. Just your arguments vs. theirs — and the AI decides who made the better case.</p>
            </div>
          </div>

          {/* How to play */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', marginBottom: '16px' }}>
              HOW TO PLAY
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {[
                { step: '1', title: 'Pick a room', desc: 'Choose from Casual, Serious, Competitive, or Random debate rooms. Each has different topics and ELO stakes.' },
                { step: '2', title: 'Make arguments', desc: 'Type your argument and hit Rebut. The AI scores it 0–30 points based on logic, evidence, depth, and vocabulary.' },
                { step: '3', title: 'Beat everyone', desc: 'Outscore the other debaters by the time the clock runs out. The best argument wins — not the loudest voice.' },
                { step: '4', title: 'Earn ELO', desc: 'Winners gain ELO. Losers lose a small amount. Climb the global leaderboard to unlock Competitive rooms.' },
              ].map(s => (
                <div key={s.step} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '32px', color: 'var(--accent)', lineHeight: 1, marginBottom: '8px' }}>{s.step}</div>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>{s.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

         {/* Who is the Rebut Man */}
          <div id="who-is-that" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', marginBottom: '32px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <img src="/shop/rebutman.jpg" alt="The Rebut Man" style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '12px', border: '1px solid rgba(230,57,70,0.3)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', marginBottom: '8px', color: 'var(--accent)' }}>
                  WHO IS THE REBUT MAN?
                </div>
                <p style={{ fontSize: '13.5px', color: 'var(--text2)', lineHeight: 1.8, margin: 0 }}>
                  The Rebut Man is Rebuttal live's immortal mascot and the face of the Rebut Shop. Legend has it he won every debate competition he entered throughout history, whether it was with Plato during 400 BC, the early 1800s or the 90s — undefeated, untouchable, never once on the losing side of an argument. His reputation finally caught up with him in a bar fight after one debate too many, where he lost an eye defending his unbeaten record. Now he wears the eye patch as a badge of honor, still dressed sharp, still ready to argue anyone under the table. He watches over the Rebut Shop today, dealing in Rebut coins and Pro memberships from his dungeon.
                </p>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', marginBottom: '16px' }}>
              FREQUENTLY ASKED QUESTIONS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  style={{ background: 'var(--surface)', border: `1px solid ${open === i ? 'rgba(230,57,70,0.3)' : 'var(--border)'}`, borderRadius: '12px', overflow: 'hidden', transition: 'border-color .2s' }}
                >
                  <button
                    onClick={() => setOpen(open === i ? null : i)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'none', border: 'none', color: 'var(--text)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif', gap: '12px' }}
                  >
                    <span>{faq.q}</span>
                    <span style={{ color: 'var(--accent)', fontSize: '18px', flexShrink: 0, transition: 'transform .2s', transform: open === i ? 'rotate(45deg)' : 'none' }}>+</span>
                  </button>
                  {open === i && (
                    <div style={{ padding: '0 20px 16px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.8, borderTop: '1px solid var(--border)' }}>
                      <div style={{ paddingTop: '12px' }}>{faq.a}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
       {/* Contact */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', marginTop: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✉️</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', marginBottom: '8px' }}>CONTACT US</div>
            <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.8, marginBottom: '20px' }}>
              Need help? Want to report a player, a bug, or just have a question? We read every email.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
              <a href="mailto:rebuttallive@gmail.com" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, rgba(230,57,70,0.15), rgba(255,107,53,0.1))', border: '1px solid rgba(230,57,70,0.3)', borderRadius: '12px', padding: '14px 28px', color: 'var(--accent)', fontSize: '15px', fontWeight: 700, textDecoration: 'none', boxShadow: '0 0 20px rgba(230,57,70,0.15)' }}>
                📧 rebuttallive@gmail.com
              </a>
              <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
                Report a bug · Report a player · General questions · Business inquiries
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}