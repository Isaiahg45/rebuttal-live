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
  const viewedUsername = decodeURIComponent(username as string)
const { buddies, pendingSent, pendingReceived, sendRequest, acceptRequest, declineRequest, removeBuddy, refresh, atLimit } = useBuddies(myProfile?.username ?? '', myProfile?.is_pro ?? false)
  const [buddyError, setBuddyError] = useState('')
  const isBuddy = buddies.includes(viewedUsername)
  const sentPending = pendingSent.includes(viewedUsername)
  const receivedPending = pendingReceived.includes(viewedUsername)

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
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '4px 14px', fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>🤝 {player.buddy_count ?? 0} {(player.buddy_count ?? 0) === 1 ? 'buddy' : 'buddies'}</div>
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
                {tier.min === -Infinity ? '−∞–99 ELO' : tier.min === 100 ? '100–199 ELO' : tier.min === 200 ? '200–299 ELO' : tier.min === 300 ? '300–399 ELO' : tier.min === 400 ? '400–499 ELO' : tier.min === 500 ? '500–699 ELO' : tier.min === 700 ? '700–999 ELO' : '1000+ ELO'} bracket
              </div>
            </div>
          </div>

      {/* Bio */}
          {player.bio && player.bio.trim().length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px 20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '10px' }}>About</div>
              <p style={{ fontSize: '13.5px', color: 'var(--text2)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{player.bio}</p>
            </div>
          )}

          {/* Badges */}
          {Array.isArray(player.badges) && player.badges.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px 20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Badges</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {player.badges.map((badge: string) => (
                  <span key={badge} style={{ fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '20px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc' }}>{badge}</span>
                ))}
              </div>
            </div>
          )}

          {/* Buddy status + action */}
          {myProfile?.username && (
            <div style={{ background: isBuddy ? 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.08))' : sentPending ? 'rgba(255,255,255,0.02)' : 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.08))', border: `1px solid ${isBuddy ? 'rgba(34,197,94,0.35)' : sentPending ? 'rgba(255,255,255,0.08)' : 'rgba(168,85,247,0.35)'}`, borderRadius: '16px', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', boxShadow: isBuddy ? '0 0 20px rgba(34,197,94,0.1)' : sentPending ? 'none' : '0 0 20px rgba(168,85,247,0.08)' }}>
              <div>
                {isBuddy ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '22px' }}>🤝</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#22c55e' }}>{viewedUsername} is your buddy!</div>
                      <div style={{ fontSize: '11px', color: 'rgba(34,197,94,0.6)', marginTop: '2px' }}>You two are connected on Rebuttal</div>
                    </div>
                  </div>
                ) : sentPending ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>⏳</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text2)' }}>Buddy request sent</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Waiting for {viewedUsername} to accept</div>
                    </div>
                  </div>
                ) : receivedPending ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>🤝</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#a855f7' }}>{viewedUsername} wants to be your buddy!</div>
                      <div style={{ fontSize: '11px', color: 'rgba(168,85,247,0.7)', marginTop: '2px' }}>Accept to connect and challenge each other</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>🤝</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#a855f7' }}>Add {viewedUsername} as a buddy</div>
                      <div style={{ fontSize: '11px', color: 'rgba(168,85,247,0.6)', marginTop: '2px' }}>{player.buddy_count ?? 0} {(player.buddy_count ?? 0) === 1 ? 'buddy' : 'buddies'} · Challenge them to private debates</div>
                    </div>
                  </div>
                )}
              </div>

              {isBuddy ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => router.push(`/create-challenge?challenge=${viewedUsername}`)} style={{ background: 'linear-gradient(135deg, #e63946, #c1121f)', border: 'none', borderRadius: '10px', padding: '10px 18px', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 0 16px rgba(230,57,70,0.35)', display: 'flex', alignItems: 'center', gap: '6px' }}>⚔️ Challenge</button>
                  <button onClick={() => removeBuddy(viewedUsername)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 16px', color: 'rgba(255,255,255,0.35)', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Remove</button>
                </div>
              ) : receivedPending ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => acceptRequest(viewedUsername)} style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: '10px', padding: '10px 18px', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 0 16px rgba(34,197,94,0.3)' }}>✅ Accept</button>
                  <button onClick={() => declineRequest(viewedUsername)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px 14px', color: 'var(--red)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>✕ Decline</button>
                </div>
              ) : sentPending ? (
                <button disabled style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 16px', color: 'var(--muted)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', cursor: 'not-allowed' }}>⏳ Pending</button>
             ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                  {atLimit ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                      <div style={{ fontSize: '11px', color: 'rgba(239,68,68,0.8)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '6px 10px', maxWidth: '220px', textAlign: 'right', lineHeight: 1.4 }}>
                        Buddy limit reached (25/25).<br />Upgrade to Pro for unlimited.
                      </div>
                      <Link href="/shop" style={{ background: 'linear-gradient(100deg, #ef3b56, #6f6bff, #2e6cf6)', border: 'none', borderRadius: '10px', padding: '10px 18px', color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 0 22px rgba(111,107,255,0.35)', display: 'inline-block' }}>👑 Get Pro</Link>
                    </div>
                  ) : (
                    <button onClick={async () => {
                      const result = await sendRequest(viewedUsername)
                      if (result?.error) setBuddyError(result.error)
                    }} style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', border: 'none', borderRadius: '10px', padding: '10px 20px', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 0 20px rgba(168,85,247,0.4)', display: 'flex', alignItems: 'center', gap: '6px' }}>🤝 Add Buddy</button>
                  )}
                  {buddyError && <div style={{ fontSize: '11px', color: 'rgba(239,68,68,0.8)', textAlign: 'right' }}>{buddyError}</div>}
                </div>
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