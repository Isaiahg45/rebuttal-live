'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Nav from '../../components/Nav'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getTier, TIERS } from '../../../lib/tiers'
import { useBuddies } from '../../hooks/useBuddies'
export default function PublicProfilePage() {
  const { username } = useParams() as { username: string }
  const { profile: myProfile } = useAuth()
  const router = useRouter()
  const [player, setPlayer] = useState<any>(null)
  const [rank, setRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const { buddies, pendingSent, pendingReceived, sendRequest, acceptRequest, declineRequest, removeBuddy } = useBuddies(myProfile?.username ?? '')

  const isBuddy = buddies.includes(decodeURIComponent(username))
  const sentPending = pendingSent.includes(decodeURIComponent(username))
  const receivedPending = pendingReceived.includes(decodeURIComponent(username))
  const viewedUsername = decodeURIComponent(username)

  useEffect(() => {
    if (!username) return
    // If viewing own profile, redirect
    if (myProfile?.username && myProfile.username === decodeURIComponent(username)) {
      router.replace('/profile')
      return
    }
    const fetch = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('username', decodeURIComponent(username)).maybeSingle()
      if (!data) { setLoading(false); return }
      setPlayer(data)
      // Get rank
      const { data: ranked } = await supabase.from('profiles').select('username').order('elo', { ascending: false })
      if (ranked) {
        const idx = ranked.findIndex(p => p.username === data.username)
        setRank(idx >= 0 ? idx + 1 : null)
      }
      setLoading(false)
    }
    fetch()
  }, [username, myProfile])

  if (loading) {
    return (
      <>
        <Nav active="" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 56px)', flexDirection: 'column', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid rgba(230,57,70,0.5)', borderTopColor: '#e63946', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </>
    )
  }

  if (!player) {
    return (
      <>
        <Nav active="" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 56px)', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '48px' }}>🔍</div>
          <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '28px', letterSpacing: '3px' }}>USER NOT FOUND</div>
          <Link href="/rankings" style={{ background: 'linear-gradient(135deg,#e63946,#c1121f)', borderRadius: '10px', padding: '12px 24px', color: '#fff', fontSize: '14px', fontWeight: 700, display: 'inline-block' }}>View Rankings</Link>
        </div>
      </>
    )
  }

  const elo = player.elo ?? 0
  const wins = player.wins ?? 0
  const debates = player.debates ?? 0
  const winRate = debates > 0 ? Math.round((wins / debates) * 100) : 0
  const tier = getTier(elo)
  const initials = player.username.slice(0, 2).toUpperCase()

  return (
    <>
      <Nav active="" />
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes rebutterDiamond{0%,100%{text-shadow:0 0 8px #ffd60a,0 0 16px rgba(255,214,10,0.5)}50%{text-shadow:0 0 20px #ffd60a,0 0 40px rgba(255,214,10,0.8)}}
        @keyframes diamondSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        .rebutter-special{animation:rebutterDiamond 2s ease infinite}
      `}</style>
      <div style={{ minHeight: 'calc(100vh - 56px)', overflowY: 'auto' }}>

        {/* Hero */}
        <div style={{ position: 'relative', overflow: 'hidden', background: `linear-gradient(180deg, ${tier.bg} 0%, transparent 100%)`, padding: 'clamp(36px,6vw,56px) clamp(16px,4vw,24px) clamp(28px,4vw,44px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ position: 'absolute', top: '-80px', left: '50%', transform: 'translateX(-50%)', width: '500px', height: '400px', background: `radial-gradient(ellipse, ${tier.glow.replace(')', ', 0.08)')} 0%, transparent 70%)`, pointerEvents: 'none' }} />

          {tier.special && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{ position: 'absolute', top: `${(i * 17) % 100}%`, left: `${(i * 23) % 100}%`, fontSize: '14px', opacity: 0.25, animation: `diamondSpin ${4 + i * 0.4}s linear infinite`, animationDelay: `${i * 0.2}s` }}>💎</div>
              ))}
            </div>
          )}

          <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative', textAlign: 'center' }}>
            {/* Avatar */}
            <div style={{ width: 'clamp(80px,14vw,112px)', height: 'clamp(80px,14vw,112px)', borderRadius: '50%', overflow: 'hidden', border: `4px solid ${tier.color}`, boxShadow: `0 0 32px ${tier.glow}, 0 0 64px ${tier.glow}50`, margin: '0 auto 16px' }}>
              {player.avatar_url ? (
                <img src={player.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#e63946,#ff8c69)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(26px,5vw,36px)', fontWeight: 700, color: '#fff' }}>{initials}</div>
              )}
            </div>

            {/* Tier badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: tier.bg, border: `1px solid ${tier.color}50`, borderRadius: '20px', padding: '4px 14px', fontSize: '11px', fontWeight: 700, color: tier.color, letterSpacing: '1.5px', marginBottom: '12px' }}>
              {tier.special ? '💎 ' : ''}{tier.label.toUpperCase()}
            </div>

            <div className={tier.special ? 'rebutter-special' : ''} style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(28px,6vw,48px)', letterSpacing: '3px', color: '#fff', lineHeight: 1, marginBottom: '12px' }}>
              {player.username}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {rank && rank > 0 && <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.2)', borderRadius: '20px', padding: '4px 14px', fontSize: '12px', color: '#ffd60a', fontWeight: 600 }}>🌍 Rank #{rank} Globally</div>}
              {winRate > 0 && <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '20px', padding: '4px 14px', fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>{winRate}% win rate</div>}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '600px', margin: '0 auto', padding: 'clamp(20px,4vw,32px) clamp(16px,4vw,24px)', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {[
              { val: String(elo), label: 'ELO', color: '#e63946', bg: 'rgba(230,57,70,0.05)' },
              { val: String(wins), label: 'WINS', color: '#22c55e', bg: 'rgba(34,197,94,0.05)' },
              { val: String(debates), label: 'DEBATES', color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.03)' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color === 'rgba(255,255,255,0.5)' ? 'rgba(255,255,255,0.07)' : `${s.color}20`}`, borderRadius: '14px', padding: '20px 16px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(28px,6vw,40px)', letterSpacing: '2px', color: s.color, lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '6px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tier info */}
          <div style={{ background: tier.bg, border: `1px solid ${tier.color}30`, borderRadius: '14px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: tier.color, boxShadow: `0 0 10px ${tier.glow}`, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: tier.color }}>{(tier as any).emoji}{' '}{tier.label}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                {tier.min === 0 ? '0–99 ELO' : tier.min === 100 ? '100–199 ELO' : tier.min === 200 ? '200–299 ELO' : tier.min === 300 ? '300–399 ELO' : tier.min === 400 ? '400–499 ELO' : tier.min === 500 ? '500–699 ELO' : tier.min === 700 ? '700–999 ELO' : '1000+ ELO'} bracket
              </div>
            </div>
          </div>

        {/* Buddy status + action */}
          {myProfile?.username && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ fontSize: '13px', color: isBuddy ? 'var(--green)' : 'var(--muted)' }}>
                {isBuddy ? `🤝 ${viewedUsername} is your buddy` : `🤝 ${player.buddy_count ?? 0} ${(player.buddy_count ?? 0) === 1 ? 'buddy' : 'buddies'}`}
              </div>
              {isBuddy ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => router.push(`/create-challenge?challenge=${viewedUsername}`)} style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.3)', borderRadius: '8px', padding: '8px 14px', color: 'var(--accent)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>⚔️ Challenge</button>
                  <button onClick={() => removeBuddy(viewedUsername)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 14px', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Remove Buddy</button>
                </div>
              ) : receivedPending ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => acceptRequest(viewedUsername)} style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '8px', padding: '8px 14px', color: 'var(--green)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>✅ Accept Request</button>
                  <button onClick={() => declineRequest(viewedUsername)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '8px 14px', color: 'var(--red)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>✕</button>
                </div>
              ) : sentPending ? (
                <button disabled style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 14px', color: 'var(--muted)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>⏳ Request Sent</button>
              ) : (
                <button onClick={() => sendRequest(viewedUsername)} style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.3)', borderRadius: '8px', padding: '8px 14px', color: 'var(--accent)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>🤝 Add Buddy</button>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link href="/rankings" style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '13px', color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: 600, textAlign: 'center', display: 'block' }}>← Rankings</Link>
            <Link href="/rebut" style={{ flex: 2, background: 'linear-gradient(135deg,#e63946,#c1121f)', borderRadius: '12px', padding: '13px', color: '#fff', fontSize: '14px', fontWeight: 700, textAlign: 'center', display: 'block', boxShadow: '0 0 16px rgba(230,57,70,0.3)' }}>Debate Now ⚡</Link>
          </div>
        </div>
      </div>
    </>
  )
}