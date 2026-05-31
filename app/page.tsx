'use client'
import { useState, useEffect } from 'react'
import Nav from './components/Nav'
import Link from 'next/link'
import AuthRedirect from './components/AuthRedirect'

export default function Home() {
  const [stats, setStats] = useState({ liveDebates: 0, argumentsMade: 0, debatersOnline: 0 })
  const [totdWinner, setTotdWinner] = useState<string | null>(null)
  const [topArgs, setTopArgs] = useState<any[]>([])

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
    const fetchTopArgs = async () => {
      try {
        const res = await fetch('https://rebuttal-live-production-3388.up.railway.app/top-arguments')
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) setTopArgs(data)
      } catch (e) {}
    }
    fetchStats(); fetchWinner(); fetchTopArgs()
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
      <div style={{ minHeight: 'calc(100vh - 56px)', overflowY: 'auto', overflowX: 'hidden' }}>

        {/* Hero */}
        <div style={{ position: 'relative', padding: 'clamp(48px, 8vw, 90px) clamp(16px, 5vw, 48px) clamp(40px, 6vw, 64px)', overflow: 'hidden', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(230,57,70,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(230,57,70,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px', zIndex: 0 }} />
          <div style={{ position: 'absolute', top: '-80px', left: '50%', transform: 'translateX(-50%)', width: 'min(700px, 100vw)', height: '400px', background: 'radial-gradient(ellipse, rgba(230,57,70,0.15) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

            {/* Live badge */}
            <div className="animate-fade-up" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: '20px', padding: '5px 14px', marginBottom: '28px', boxShadow: '0 0 20px rgba(230,57,70,0.1)' }}>
              <div className="live-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 500, letterSpacing: '0.5px' }}>{stats?.debatersOnline ?? 0} debaters online</span>
            </div>

            {/* Title */}
            <div className="animate-fade-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
              <h1 style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(56px, 12vw, 120px)', letterSpacing: '4px', lineHeight: 0.9, marginBottom: '24px' }}>
                <span style={{ display: 'block', color: 'var(--text)' }}>ARGUE.</span>
                <span style={{ display: 'block', color: 'var(--accent)' }}>DEBATE.</span>
                <span style={{ display: 'block', color: 'var(--text)' }}>RANK UP.</span>
              </h1>
            </div>

            {/* Subtitle */}
            <p className="animate-fade-up" style={{ fontSize: 'clamp(14px, 2vw, 16px)', color: 'var(--text2)', marginBottom: '36px', lineHeight: 1.7, maxWidth: '480px', animationDelay: '0.2s', opacity: 0 }}>
              Real-time debate battles scored by AI. Make your case, destroy the opposition, climb the global leaderboard.
            </p>

            {/* Buttons */}
            <div className="animate-fade-up home-hero-buttons" style={{ animationDelay: '0.3s', opacity: 0 }}>
              <a
                href="https://discord.gg/v6csM2v2r"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#5865F2', borderRadius: '10px', padding: '14px 28px', color: '#fff', fontFamily: 'var(--font-bebas)', fontSize: '20px', letterSpacing: '2px', animation: 'pulseDiscord 2.5s ease-in-out infinite', border: '1px solid rgba(88,101,242,0.5)' }}
              >
                💬 JOIN DISCORD
              </a>
              <Link
                href="/rebut"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'var(--accent)', borderRadius: '10px', padding: '14px 28px', color: '#fff', fontFamily: 'var(--font-bebas)', fontSize: '20px', letterSpacing: '2px', animation: 'pulseRebut 2.5s ease-in-out infinite', border: '1px solid rgba(230,57,70,0.5)', boxShadow: '0 0 30px rgba(230,57,70,0.4)' }}
              >
                ⚔️ DEBATE NOW
              </Link>
              <Link
                href="/rankings"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent', borderRadius: '10px', padding: '14px 22px', color: 'var(--text2)', fontSize: '14px', fontWeight: 500, border: '1px solid var(--border2)', transition: 'all 0.2s' }}
              >
                Rankings →
              </Link>
            </div>

            {/* Stats row */}
            <div className="animate-fade-up home-stats-row" style={{ animationDelay: '0.4s', opacity: 0 }}>
              {[
                [stats.liveDebates.toLocaleString(), 'Live Debates'],
                [formatArgs(stats.argumentsMade), 'Arguments Made'],
                ['100', 'Global Rankings'],
              ].map(([val, label]) => (
                <div key={label as string} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(24px, 4vw, 34px)', letterSpacing: '2px', color: 'var(--text)' }}>{val}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', letterSpacing: '0.5px' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TOTD Winner banner */}
        {totdWinner && (
          <div style={{ padding: 'clamp(24px, 4vw, 40px) clamp(16px, 4vw, 48px) 0' }}>
            <div style={{ maxWidth: '860px', margin: '0 auto', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(255,214,10,0.1), rgba(230,57,70,0.05), rgba(255,214,10,0.03))', border: '1px solid rgba(255,214,10,0.3)', borderRadius: '20px', padding: 'clamp(18px, 3vw, 28px) clamp(16px, 3vw, 32px)', boxShadow: '0 0 40px rgba(255,214,10,0.05)' }}>
              <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', background: 'radial-gradient(ellipse, rgba(255,214,10,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <div className="totd-banner-inner" style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', flexWrap: 'wrap' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,214,10,0.25), rgba(255,214,10,0.06))', border: '2px solid rgba(255,214,10,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0, boxShadow: '0 0 20px rgba(255,214,10,0.2)' }}>👑</div>
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(255,214,10,0.6)', marginBottom: '4px' }}>🔥 Debate of the Day — Last Champion</div>
                  <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(26px, 5vw, 38px)', letterSpacing: '3px', color: 'var(--gold)', lineHeight: 1, marginBottom: '5px', textShadow: '0 0 20px rgba(255,214,10,0.4)' }}>{totdWinner}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Outlasted every debater · Earned <span style={{ color: 'var(--gold)', fontWeight: 700 }}>+300 ELO</span></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, width: 'clamp(140px, 20vw, 180px)' }}>
                  <Link href="/topic" style={{ background: 'rgba(255,214,10,0.15)', border: '1px solid rgba(255,214,10,0.35)', borderRadius: '10px', padding: '11px 18px', color: 'var(--gold)', fontSize: '13px', fontWeight: 700, textAlign: 'center', display: 'block', boxShadow: '0 0 16px rgba(255,214,10,0.1)' }}>
                    🔥 Join Today's Debate
                  </Link>
                  <Link href="/rankings" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '10px', padding: '9px 18px', color: 'var(--muted)', fontSize: '12px', textAlign: 'center', display: 'block' }}>
                    View Rankings →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* How to Win */}
        <div style={{ padding: 'clamp(32px, 5vw, 48px) clamp(16px, 4vw, 48px) 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap' }}>How to Win</span>
            <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, var(--border), transparent)', marginLeft: '16px' }} />
          </div>
          <div className="home-tips-row">
            {[
              { icon: '⚔️', label: 'Use Evidence', text: 'Real examples and statistics earn up to +8 bonus points.' },
              { icon: '🎯', label: 'Stay On Topic', text: 'Off-topic arguments are flagged. Focus on the core issue.' },
              { icon: '🔥', label: 'Direct Rebuttals', text: 'Replying directly to someone earns an engagement bonus.' },
              { icon: '📚', label: 'Vocabulary', text: 'Precise, sophisticated language signals strong argumentation.' },
              { icon: '⏱️', label: 'Go Early', text: 'Early strong arguments set the tone for the whole debate.' },
              { icon: '🧠', label: 'Structure', text: 'Claim → Reason → Example. AI rewards organized arguments.' },
            ].map(tip => (
              <div key={tip.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', minWidth: '180px', flexShrink: 0, transition: 'all 0.2s', cursor: 'default' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
              >
                <div style={{ fontSize: '18px', marginBottom: '8px' }}>{tip.icon}</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>{tip.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.6 }}>{tip.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Featured Arguments */}
        {topArgs.length > 0 && (
          <div style={{ padding: 'clamp(32px, 5vw, 48px) clamp(16px, 4vw, 48px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Featured Arguments</span>
              <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, var(--border), transparent)', marginLeft: '16px' }} />
            </div>
            <div className="home-featured-grid">
              {topArgs.map((card: any) => {
                const isSerious = card.room_type === 'serious' || card.room_type === 'competitive'
                return (
                  <div key={card.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px', position: 'relative', overflow: 'hidden', transition: 'all 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = isSerious ? 'rgba(230,57,70,0.4)' : 'rgba(34,197,94,0.4)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 24px ${isSerious ? 'rgba(230,57,70,0.1)' : 'rgba(34,197,94,0.1)'}` }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
                  >
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: isSerious ? 'linear-gradient(90deg, var(--accent), var(--accent2))' : 'linear-gradient(90deg, var(--green), #4ade80)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', padding: '2px 8px', borderRadius: '4px', background: isSerious ? 'rgba(230,57,70,.12)' : 'rgba(34,197,94,.12)', color: isSerious ? 'var(--accent)' : 'var(--green)' }}>
                        {card.room_type}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>@{card.username}</span>
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-bebas)', fontSize: '16px', color: 'var(--gold)', letterSpacing: '1px' }}>+{card.score} PTS</span>
                    </div>
                    <p style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--text2)', fontStyle: 'italic', marginBottom: '12px' }}>&ldquo;{card.text}&rdquo;</p>
                    {card.ai_feedback && (
                      <div style={{ fontSize: '11px', color: 'var(--blue)', fontWeight: 500, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <span>🤖</span><span>{card.ai_feedback}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '32px clamp(16px, 4vw, 48px)', borderTop: '1px solid var(--border)', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '16px', letterSpacing: '2px', color: 'var(--muted)' }}>
            <span style={{ color: 'var(--accent)' }}>REBUTTAL</span>.LIVE
          </span>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <a href="https://www.instagram.com/rebuttal.live/" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#e1306c'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--muted)'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              @rebuttal.live
            </a>
            <Link href="/tos" style={{ fontSize: '12px', color: 'var(--muted)' }}>Terms of Service</Link>
            <Link href="/privacy" style={{ fontSize: '12px', color: 'var(--muted)' }}>Privacy Policy</Link>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>© 2026 ViralBot AI LLC</span>
        </div>
//brahh
      </div>
      <style>{`
        @keyframes pulseDiscord {
          0%, 100% { box-shadow: 0 0 0 0 rgba(88,101,242,0.7); }
          50% { box-shadow: 0 0 20px 8px rgba(88,101,242,0.3); }
        }
        @keyframes pulseRebut {
          0%, 100% { box-shadow: 0 0 0 0 rgba(230,57,70,0.7); }
          50% { box-shadow: 0 0 20px 8px rgba(230,57,70,0.3); }
        }
      `}</style>
    </>
  )
}