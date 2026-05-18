'use client'
import { useState, useEffect } from 'react'
import Nav from './components/Nav'
import Link from 'next/link'
import AuthRedirect from './components/AuthRedirect'

export default function Home() {
  const [stats, setStats] = useState({ debatersOnline: 0, liveDebates: 0, argumentsMade: 0 })
  const [totdWinner, setTotdWinner] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('https://rebuttal-live-production-3388.up.railway.app/stats')
        const data = await res.json()
        setStats(data)
      } catch (e) {}
    }
    const fetchWinner = async () => {
      try {
        const res = await fetch('https://rebuttal-live-production-3388.up.railway.app/totd-winner')
        const data = await res.json()
        if (data.winner) setTotdWinner(data.winner)
      } catch (e) {}
    }
    fetchStats()
    fetchWinner()
    const interval = setInterval(fetchStats, 10000)
    return () => clearInterval(interval)
  }, [])

  const formatArgs = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(0) + 'K'
    return n.toString()
  }

  return (
    <>
      <Nav active="home" />
      <AuthRedirect />
      <div style={{ minHeight: 'calc(100vh - 56px)', overflowY: 'auto' }}>

        {/* Hero */}
        <div style={{ position: 'relative', padding: '80px 48px 64px', overflow: 'hidden', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(230,57,70,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(230,57,70,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px', zIndex: 0 }} />
          <div style={{ position: 'absolute', top: '-100px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', background: 'radial-gradient(ellipse, rgba(230,57,70,0.12) 0%, transparent 70%)', zIndex: 0 }} />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

            {/* Live badge */}
            <div className="animate-fade-up" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '5px 14px', marginBottom: '28px' }}>
              <div className="live-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 500, letterSpacing: '0.5px' }}>
                {stats.debatersOnline > 0 ? stats.debatersOnline.toLocaleString() : '—'} debaters online right now
              </span>
            </div>

            {/* Title */}
            <div className="animate-fade-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
              <h1 style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(64px, 10vw, 110px)', letterSpacing: '4px', lineHeight: 0.9, marginBottom: '24px' }}>
                <span style={{ display: 'block', color: 'var(--text)' }}>ARGUE.</span>
                <span style={{ display: 'block', color: 'var(--accent)' }}>DEBATE.</span>
                <span style={{ display: 'block', color: 'var(--text)' }}>RANK UP.</span>
              </h1>
            </div>

            {/* Subtitle */}
            <p className="animate-fade-up" style={{ fontSize: '16px', color: 'var(--text2)', marginBottom: '36px', lineHeight: 1.7, maxWidth: '480px', animationDelay: '0.2s', opacity: 0 }}>
              Real-time debate battles scored by AI. Make your case, destroy the opposition, climb the global leaderboard.
            </p>

            {/* Buttons */}
            <div className="animate-fade-up" style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center', animationDelay: '0.3s', opacity: 0 }}>
              <Link href="/rebut" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'var(--accent)', borderRadius: '10px', padding: '14px 32px', color: '#fff', fontFamily: 'var(--font-bebas)', fontSize: '20px', letterSpacing: '2px', border: '1px solid var(--accent)', transition: 'all 0.2s' }}>
                ⚡ DEBATE NOW
              </Link>
              <Link href="/rankings" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent', borderRadius: '10px', padding: '14px 24px', color: 'var(--text2)', fontSize: '14px', fontWeight: 500, border: '1px solid var(--border)', transition: 'all 0.2s' }}>
                View Rankings →
              </Link>
            </div>

            {/* Live Stats */}
            <div className="animate-fade-up" style={{ display: 'flex', gap: '48px', marginTop: '56px', justifyContent: 'center', animationDelay: '0.4s', opacity: 0 }}>
              {[
                [stats.liveDebates.toLocaleString(), 'Live Debates'],
                [formatArgs(stats.argumentsMade), 'Arguments Made'],
                ['100', 'Global Rankings'],
              ].map(([val, label]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '32px', letterSpacing: '2px', color: 'var(--text)' }}>{val}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', letterSpacing: '0.5px' }}>{label}</div>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* ✅ Debate of the Day Winner Banner */}
        {totdWinner && (
          <div style={{ padding: '32px 48px 0' }}>
            <div style={{ maxWidth: '720px', margin: '0 auto', background: 'linear-gradient(135deg, rgba(255,214,10,0.12), rgba(255,214,10,0.04))', border: '1px solid rgba(255,214,10,0.35)', borderRadius: '16px', padding: '24px 32px', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ fontSize: '40px' }}>👑</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,214,10,0.7)', marginBottom: '4px' }}>
                  Last Debate of the Day Winner
                </div>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '30px', letterSpacing: '3px', color: 'var(--gold)', lineHeight: 1 }}>
                  {totdWinner}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                  Crowned champion · Claimed 300 ELO
                </div>
              </div>
              <Link href="/topic" style={{ background: 'rgba(255,214,10,0.15)', border: '1px solid rgba(255,214,10,0.3)', borderRadius: '10px', padding: '10px 20px', color: 'var(--gold)', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                🔥 Join Today's Debate
              </Link>
            </div>
          </div>
        )}

        {/* How to Win */}
        <div style={{ padding: '48px 48px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap' }}>How to Win</span>
            <div style={{ height: '1px', flex: 1, background: 'var(--border)', marginLeft: '16px' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
            {[
              { icon: '⚔️', label: 'Use Evidence', text: 'Real examples and statistics earn up to +8 bonus points.' },
              { icon: '🎯', label: 'Stay On Topic', text: 'Off-topic arguments are flagged. Focus on the core issue.' },
              { icon: '🔥', label: 'Direct Rebuttals', text: 'Replying directly to someone earns a +3 engagement bonus.' },
              { icon: '📚', label: 'Vocabulary', text: 'Precise, sophisticated language signals strong argumentation.' },
              { icon: '⏱️', label: 'Go Early', text: 'Early strong arguments set the tone for the whole debate.' },
              { icon: '🧠', label: 'Structure', text: 'Claim → Reason → Example. AI rewards organized arguments.' },
            ].map(tip => (
              <div key={tip.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', minWidth: '180px', flexShrink: 0, transition: 'border-color 0.2s' }}>
                <div style={{ fontSize: '18px', marginBottom: '8px' }}>{tip.icon}</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>{tip.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.6 }}>{tip.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Featured Arguments */}
        <div style={{ padding: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Featured Arguments This Week</span>
            <div style={{ height: '1px', flex: 1, background: 'var(--border)', marginLeft: '16px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {[
              { type: 'serious', typeLabel: 'Philosophy', user: 'rhetorical_rex', pts: '+30', quote: '"Free will is an illusion crafted by a brain that narrates its own decisions after the fact — Libet\'s experiments make this undeniable."', ai: 'Exceptional neuroscience evidence. Strong logical structure.' },
              { type: 'serious', typeLabel: 'Politics', user: 'dialectic_dan', pts: '+28', quote: '"Finland\'s 2017 UBI pilot proved participants were more likely to seek employment. The assumption of laziness is ideologically driven, not empirical."', ai: 'Strong empirical grounding. Dismantles the opposition\'s premise.' },
              { type: 'casual', typeLabel: 'Food', user: 'spice_lord_99', pts: '+22', quote: '"Pizza has existed in some form for over 1,000 years across multiple civilizations. Burgers are barely 150 years old — pizza won the test of time."', ai: 'Creative historical framing. Memorable comparative argument.' },
            ].map(card => (
              <div key={card.user} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden', transition: 'border-color 0.2s' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: card.type === 'serious' ? 'var(--accent)' : 'var(--green)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', padding: '2px 8px', borderRadius: '4px', background: card.type === 'serious' ? 'rgba(230,57,70,.12)' : 'rgba(34,197,94,.12)', color: card.type === 'serious' ? 'var(--accent)' : 'var(--green)' }}>{card.typeLabel}</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>@{card.user}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-bebas)', fontSize: '16px', color: 'var(--gold)', letterSpacing: '1px' }}>{card.pts} PTS</span>
                </div>
                <p style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--text2)', fontStyle: 'italic', marginBottom: '14px' }}>{card.quote}</p>
                <div style={{ fontSize: '11px', color: 'var(--blue)', fontWeight: 500, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <span>🤖</span><span>{card.ai}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  )
}