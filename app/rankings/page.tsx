'use client'
import Nav from '../components/Nav'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TIERS, getTier } from '../../lib/tiers'
import Link from 'next/link'

interface RankedUser {
  id: string
  username: string
  elo: number
  wins: number
  debates: number
  avatar_url?: string
}

const RANK_COLORS = ['#ffd60a', '#c0c0c0', '#cd7f32']
const RANK_GLOWS = ['rgba(255,214,10,0.4)', 'rgba(192,192,192,0.3)', 'rgba(205,127,50,0.3)']

function getAvatarGrad(i: number) {
  const g = ['linear-gradient(135deg,#ffd60a,#ff9500)','linear-gradient(135deg,#c0c0c0,#888)','linear-gradient(135deg,#cd7f32,#f4a261)','linear-gradient(135deg,#a855f7,#4a9eff)','linear-gradient(135deg,#22c55e,#4a9eff)','linear-gradient(135deg,#e63946,#a855f7)','linear-gradient(135deg,#f4a261,#ffd60a)','linear-gradient(135deg,#3498db,#a855f7)','linear-gradient(135deg,#22c55e,#f4a261)','linear-gradient(135deg,#e63946,#ffd60a)']
  return g[i % g.length]
}

export default function RankingsPage() {
  const { user, profile } = useAuth()
  const [players, setPlayers] = useState<RankedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set())
  const [totdWinner, setTotdWinner] = useState<string | null>(null)
  const [hoveredRank, setHoveredRank] = useState<string | null>(null)
  const prevRef = useRef<RankedUser[]>([])

  const fetchRankings = async () => {
    const { data, error } = await supabase.from('profiles').select('id, username, elo, wins, debates, avatar_url').not('username', 'is', null).order('elo', { ascending: false }).limit(100)
    if (error) { console.error(error); return }
    const newPlayers = data ?? []
    const changed = new Set<string>()
    newPlayers.forEach(p => { const old = prevRef.current.find(o => o.id === p.id); if (old && old.elo !== p.elo) changed.add(p.id) })
    if (changed.size > 0) { setAnimatingIds(changed); setTimeout(() => setAnimatingIds(new Set()), 2000) }
    prevRef.current = newPlayers
    setPlayers(newPlayers)
    setLastUpdated(new Date())
    setLoading(false)
  }

  useEffect(() => { fetchRankings(); const i = setInterval(fetchRankings, 10000); return () => clearInterval(i) }, [])
  useEffect(() => { fetch('https://rebuttal-live-production-3388.up.railway.app/totd-winner').then(r => r.json()).then(d => { if (d.winner) setTotdWinner(d.winner) }).catch(() => {}) }, [])
  useEffect(() => {
    const ch = supabase.channel('rl').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => fetchRankings()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const myRank = profile?.username ? players.findIndex(p => p.username === profile.username) + 1 : null
  const myPlayer = players.find(p => p.username === profile?.username)
  const isInTop10 = myRank !== null && myRank > 0 && myRank <= 10
  const top3 = players.slice(0, 3)

  return (
    <>
     <Nav active="rankings" />
      <div style={{ background: 'linear-gradient(100deg, #7a1726 0%, #5a1740 28%, #15275e 55%, #0f3d52 75%, #0c4a30 100%)', borderBottom: '1px solid #2a2230' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>
          <span style={{ width: '28px', height: '8px', borderRadius: '4px', background: 'linear-gradient(90deg, #ff4d68 0 33%, #5b8cff 33% 66%, #3fe07f 66% 100%)', flexShrink: 0, display: 'inline-block' }} />
          ⚽ <b style={{ color: '#fff' }}>World Cup Event</b> is live — climb the leaderboard through July 19.
        </div>
      </div>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes eloFlash{0%{background:rgba(230,57,70,0)}40%{background:rgba(230,57,70,0.12)}100%{background:rgba(230,57,70,0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes goldPulse{0%,100%{box-shadow:0 0 20px rgba(255,214,10,0.2)}50%{box-shadow:0 0 40px rgba(255,214,10,0.5),0 0 60px rgba(255,214,10,0.15)}}
        @keyframes rebutterDiamond{0%,100%{text-shadow:0 0 8px #ffd60a,0 0 16px rgba(255,214,10,0.5)}50%{text-shadow:0 0 16px #ffd60a,0 0 32px rgba(255,214,10,0.8),0 0 48px rgba(255,214,10,0.3)}}
        .rank-row{animation:slideUp 0.4s ease forwards;opacity:0}
        .rank-row.flashing{animation:eloFlash 2s ease!important;opacity:1}
        .rebutter-name{animation:rebutterDiamond 2s ease infinite}
      `}</style>

      <div style={{ minHeight: 'calc(100vh - 56px)', overflowY: 'auto', overflowX: 'hidden' }}>

        {/* Hero */}
        <div style={{ position: 'relative', overflow: 'hidden', padding: '36px 24px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(180deg, rgba(255,214,10,0.04) 0%, transparent 100%)' }}>
          <div style={{ position: 'absolute', top: '-80px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', background: 'radial-gradient(ellipse, rgba(255,214,10,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(32px,6vw,52px)', letterSpacing: '4px', lineHeight: 1, marginBottom: '6px', background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.6) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>GLOBAL RANKINGS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite', boxShadow: '0 0 8px #22c55e' }} />
                <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 700, letterSpacing: '1px' }}>LIVE</span>
              </div>
              {lastUpdated && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>Updated {lastUpdated.toLocaleTimeString()}</span>}
              {myRank && myRank > 0 && <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '3px 12px' }}>You are <b style={{ color: '#fff' }}>#{myRank}</b></span>}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: 'clamp(20px,4vw,32px) clamp(16px,4vw,24px)' }}>

          {/* TOTD Winner */}
          {totdWinner && (
            <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(255,214,10,0.08) 0%, rgba(255,149,0,0.04) 50%, transparent 100%)', border: '1px solid rgba(255,214,10,0.3)', borderRadius: '20px', padding: '24px 28px', marginBottom: '28px', animation: 'goldPulse 4s ease infinite' }}>
              <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', background: 'radial-gradient(ellipse, rgba(255,214,10,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '40px', filter: 'drop-shadow(0 0 12px rgba(255,214,10,0.6))' }}>👑</div>
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '3px', color: 'rgba(255,214,10,0.5)', marginBottom: '4px' }}>DEBATE OF THE DAY CHAMPION</div>
                  <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(22px,4vw,34px)', letterSpacing: '3px', color: '#ffd60a', textShadow: '0 0 24px rgba(255,214,10,0.5)', lineHeight: 1, marginBottom: '4px' }}>{totdWinner}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>Outlasted all opponents · Earned <span style={{ color: '#ffd60a', fontWeight: 700 }}>+300 ELO</span></div>
                </div>
                <Link href="/topic" style={{ background: 'rgba(255,214,10,0.12)', border: '1px solid rgba(255,214,10,0.35)', borderRadius: '12px', padding: '12px 20px', color: '#ffd60a', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', display: 'block' }}>🔥 Compete Today</Link>
              </div>
            </div>
          )}

          {/* My rank outside top 10 */}
          {user && myPlayer && !isInTop10 && myRank && (
            <div style={{ background: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.2)', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '28px', color: '#e63946', width: '44px', textShadow: '0 0 16px rgba(230,57,70,0.5)', flexShrink: 0 }}>#{myRank}</div>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(230,57,70,0.4)', flexShrink: 0, boxShadow: '0 0 12px rgba(230,57,70,0.3)' }}>
                {myPlayer.avatar_url ? <img src={myPlayer.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#e63946,#ff8c69)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#fff' }}>{myPlayer.username.slice(0,2).toUpperCase()}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '2px' }}>{myPlayer.username} <span style={{ fontSize: '11px', color: 'rgba(230,57,70,0.7)' }}>← you</span></div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{myPlayer.wins ?? 0} wins · {myPlayer.debates ?? 0} debates · <span style={{ color: getTier(myPlayer.elo).color }}>{getTier(myPlayer.elo).label}</span></div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', color: '#e63946', letterSpacing: '1px' }}>{myPlayer.elo}</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px' }}>ELO</div>
              </div>
            </div>
          )}

          {/* Main layout: rankings + tier sidebar */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

            {/* Rankings */}
            <div style={{ flex: 1, minWidth: 0 }}>

              {/* Podium */}
              {!loading && top3.length >= 3 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 'clamp(10px,2vw,20px)', marginBottom: '32px', padding: '0 10px' }}>
                  {[{ p: top3[1], rank: 2, height: '80px', size: '52px' }, { p: top3[0], rank: 1, height: '110px', size: '64px' }, { p: top3[2], rank: 3, height: '60px', size: '44px' }].map(({ p, rank, height, size }) => {
                    const color = RANK_COLORS[rank - 1]
                    const glow = RANK_GLOWS[rank - 1]
                    const tier = getTier(p?.elo ?? 0)
                    return (
                      <Link key={rank} href={`/profile/${p?.username}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flex: rank === 1 ? 1.2 : 1, textDecoration: 'none', cursor: 'pointer' }}>
                        {rank === 1 && <div style={{ fontSize: 'clamp(20px,3vw,28px)', filter: `drop-shadow(0 0 12px ${glow})` }}>👑</div>}
                        <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${color}`, boxShadow: `0 0 16px ${glow}`, flexShrink: 0 }}>
                          {p?.avatar_url ? <img src={p.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: getAvatarGrad(rank - 1), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: rank === 1 ? '20px' : '14px', fontWeight: 700, color: rank === 1 ? '#000' : '#fff' }}>{p?.username.slice(0, 2).toUpperCase()}</div>}
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center', ...(tier.special ? { animation: 'rebutterDiamond 2s ease infinite' } : {}) }}>{p?.username}</div>
                        <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '12px', color, letterSpacing: '1px', textShadow: `0 0 8px ${glow}` }}>{p?.elo} ELO</div>
                        <div style={{ fontSize: '9px', fontWeight: 700, color: tier.color, letterSpacing: '1px' }}>{tier.short}</div>
                        <div style={{ height, width: 'clamp(64px,10vw,96px)', background: `${color}10`, border: `1px solid ${color}40`, borderBottom: 'none', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-bebas)', fontSize: rank === 1 ? '44px' : rank === 2 ? '32px' : '24px', color, textShadow: `0 0 20px ${glow}` }}>{rank}</div>
                      </Link>
                    )
                  })}
                </div>
              )}

              {/* Full list */}
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px', gap: '16px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid rgba(230,57,70,0.5)', borderTopColor: '#e63946', animation: 'spin 0.8s linear infinite' }} />
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px' }}>LOADING...</div>
                </div>
              ) : players.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏆</div>
                  <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', marginBottom: '16px' }}>NO RANKINGS YET</div>
                  <Link href="/rebut" style={{ background: 'linear-gradient(135deg,#e63946,#c1121f)', borderRadius: '10px', padding: '12px 28px', color: '#fff', fontSize: '14px', fontWeight: 700, display: 'inline-block' }}>Start Debating →</Link>
                </div>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden' }}>
                  {players.map((p, i) => {
                    const isMe = p.username === profile?.username
                    const isFlashing = animatingIds.has(p.id)
                    const isHovered = hoveredRank === p.id
                    const tier = getTier(p.elo)
                    const rankColor = i < 3 ? RANK_COLORS[i] : 'rgba(255,255,255,0.3)'
                    return (
                      <Link
                        key={p.id} href={`/profile/${p.username}`}
                        className={`rank-row ${isFlashing ? 'flashing' : ''}`}
                        onMouseEnter={() => setHoveredRank(p.id)}
                        onMouseLeave={() => setHoveredRank(null)}
                        style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,2vw,16px)', padding: 'clamp(12px,2vw,15px) clamp(14px,3vw,22px)', borderBottom: i < players.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: isMe ? 'rgba(230,57,70,0.06)' : isHovered ? 'rgba(255,255,255,0.02)' : 'transparent', animationDelay: `${Math.min(i * 0.025, 0.5)}s`, transition: 'background 0.2s', textDecoration: 'none' }}
                      >
                        <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(14px,2.5vw,20px)', width: '36px', textAlign: 'center', color: rankColor, flexShrink: 0, textShadow: i < 3 ? `0 0 12px ${RANK_GLOWS[i]}` : 'none' }}>
                          {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}
                        </div>
                        <div style={{ width: 'clamp(30px,5vw,38px)', height: 'clamp(30px,5vw,38px)', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: i < 3 ? `2px solid ${RANK_COLORS[i]}` : isMe ? '2px solid rgba(230,57,70,0.4)' : 'none', boxShadow: i < 3 ? `0 0 10px ${RANK_GLOWS[i]}` : isMe ? '0 0 8px rgba(230,57,70,0.25)' : 'none' }}>
                          {p.avatar_url ? <img src={p.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: isMe ? 'linear-gradient(135deg,#e63946,#ff8c69)' : getAvatarGrad(i), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(9px,1.5vw,12px)', fontWeight: 700, color: i === 0 ? '#000' : '#fff' }}>{p.username.slice(0,2).toUpperCase()}</div>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'clamp(12px,2vw,14px)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff', ...(tier.special ? { animation: 'rebutterDiamond 2s ease infinite' } : {}) }}>{p.username}</span>
                            {isMe && <span style={{ fontSize: '10px', color: '#e63946', fontWeight: 700, background: 'rgba(230,57,70,0.12)', padding: '1px 8px', borderRadius: '4px', flexShrink: 0, letterSpacing: '1px' }}>YOU</span>}
                            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: tier.color, flexShrink: 0 }}>{tier.special ? '💎 ' : ''}{tier.short}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>
                            {p.wins ?? 0} wins · {p.debates ?? 0} debates{p.debates > 0 ? ` · ${Math.round(((p.wins ?? 0) / p.debates) * 100)}% win rate` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(18px,3vw,24px)', letterSpacing: '1px', color: i === 0 ? '#ffd60a' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : isMe ? '#e63946' : 'rgba(255,255,255,0.5)', textShadow: i < 3 ? `0 0 12px ${RANK_GLOWS[i]}` : 'none' }}>{p.elo}</div>
                          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', letterSpacing: '1.5px' }}>ELO</div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
            {/* close rankings column */}

            {/* Tier sidebar */}
            <div style={{ width: '260px', flexShrink: 0, position: 'sticky', top: '72px' }} className="tier-sidebar">
              <div style={{ background: 'rgba(10,10,10,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden', backdropFilter: 'blur(12px)' }}>
                <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '10px', fontWeight: 700, letterSpacing: '3px', color: 'rgba(255,255,255,0.25)' }}>ELO TIERS</div>
                {[...TIERS].reverse().map((tier, i) => {
                  const isMe = myPlayer && getTier(myPlayer.elo).label === tier.label
                  return (
                    <div key={tier.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 16px', borderBottom: i < TIERS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: isMe ? tier.bg : 'transparent', position: 'relative', transition: 'background 0.2s' }}>
                      {isMe && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: tier.color, boxShadow: `0 0 8px ${tier.glow}` }} />}
                      <div style={{ fontSize: '20px', flexShrink: 0, filter: `drop-shadow(0 0 6px ${tier.glow})` }}>{(tier as any).emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: tier.color, textShadow: isMe ? `0 0 12px ${tier.glow}, 0 0 24px ${tier.glow}` : `0 0 8px ${tier.glow}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tier.label}
                        </div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>
                          {tier.min === -Infinity ? '−∞–99' : tier.min === 100 ? '100–199' : tier.min === 200 ? '200–299' : tier.min === 300 ? '300–399' : tier.min === 400 ? '400–499' : tier.min === 500 ? '500–699' : tier.min === 700 ? '700–999' : '1000+'} ELO
                        </div>
                      </div>
                      {isMe && (
                        <div style={{ fontSize: '9px', fontWeight: 800, color: tier.color, background: tier.bg, border: `1px solid ${tier.color}60`, borderRadius: '6px', padding: '2px 6px', flexShrink: 0, textShadow: `0 0 8px ${tier.glow}`, boxShadow: `0 0 8px ${tier.glow}`, letterSpacing: '1px' }}>YOU</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

          </div> {/* close flex row */}
        </div> {/* close maxWidth wrapper */}
      </div> {/* close page */}
      <style>{`.tier-sidebar{display:none} @media(min-width:768px){.tier-sidebar{display:block!important}}`}</style>
    </>
  )
}