'use client'
import Nav from '../components/Nav'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Link from 'next/link'

interface RankedUser {
  id: string
  username: string
  elo: number
  wins: number
  debates: number
}

const medalColor = (i: number) =>
  i === 0 ? 'var(--gold)' : i === 1 ? 'var(--silver)' : i === 2 ? 'var(--bronze)' : 'var(--muted)'

const avatarGrad = (i: number) => {
  const grads = [
    'linear-gradient(135deg,#ffd60a,#f4a261)',
    'linear-gradient(135deg,#c0c0c0,#888)',
    'linear-gradient(135deg,#cd7f32,#f4a261)',
    'linear-gradient(135deg,#9b59b6,#4a9eff)',
    'linear-gradient(135deg,#2ecc71,#4a9eff)',
    'linear-gradient(135deg,#e63946,#9b59b6)',
    'linear-gradient(135deg,#f4a261,#ffd60a)',
    'linear-gradient(135deg,#3498db,#9b59b6)',
    'linear-gradient(135deg,#2ecc71,#f4a261)',
    'linear-gradient(135deg,#e63946,#ffd60a)',
  ]
  return grads[i % grads.length]
}

export default function RankingsPage() {
  const { user, profile } = useAuth()
  const [players, setPlayers] = useState<RankedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set())
  const [totdWinner, setTotdWinner] = useState<string | null>(null)
  const prevPlayersRef = useRef<RankedUser[]>([])

  const fetchRankings = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, elo, wins, debates')
      .not('username', 'is', null)
      .order('elo', { ascending: false })
      .limit(100)

    if (error) { console.error(error); return }
    const newPlayers = data ?? []

    const prev = prevPlayersRef.current
    const changed = new Set<string>()
    newPlayers.forEach(p => {
      const old = prev.find(o => o.id === p.id)
      if (old && old.elo !== p.elo) changed.add(p.id)
    })

    if (changed.size > 0) {
      setAnimatingIds(changed)
      setTimeout(() => setAnimatingIds(new Set()), 1500)
    }

    prevPlayersRef.current = newPlayers
    setPlayers(newPlayers)
    setLastUpdated(new Date())
    setLoading(false)
  }

  useEffect(() => {
    fetchRankings()
    const interval = setInterval(fetchRankings, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetch('https://rebuttal-live-production-3388.up.railway.app/totd-winner')
      .then(r => r.json())
      .then(d => { if (d.winner) setTotdWinner(d.winner) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('rankings-live')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
      }, () => { fetchRankings() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const myRank = profile?.username
    ? players.findIndex(p => p.username === profile.username) + 1
    : null

  const top10 = players.slice(0, 10)
  const myPlayer = players.find(p => p.username === profile?.username)
  const isInTop10 = myRank !== null && myRank <= 10

  return (
    <>
      <Nav active="rankings" />
      <style>{`
        @keyframes eloFlash {
          0% { background: rgba(230,57,70,0.0); }
          30% { background: rgba(230,57,70,0.15); }
          100% { background: rgba(230,57,70,0.0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { opacity: 0.7; }
          50% { opacity: 1; }
          100% { opacity: 0.7; }
        }
        .rank-row { transition: all 0.4s ease; }
        .rank-row.animating { animation: eloFlash 1.5s ease; }
        .rank-entry { animation: slideIn 0.4s ease forwards; }
      `}</style>

      <div style={{ minHeight: 'calc(100vh - 56px)', overflowY: 'auto' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px' }}>

          {/* Header */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '42px', letterSpacing: '3px', marginBottom: '4px' }}>
              GLOBAL RANKINGS
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                {players.length} ranked debater{players.length !== 1 ? 's' : ''} worldwide
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 500 }}>LIVE</span>
              </div>
              {lastUpdated && (
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {/* ✅ Debate of the Day Winner Banner */}
          {totdWinner && (
            <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(255,214,10,0.12), rgba(230,57,70,0.06), rgba(255,214,10,0.04))', border: '1px solid rgba(255,214,10,0.35)', borderRadius: '20px', padding: '24px 28px', marginBottom: '28px' }}>
              <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', background: 'radial-gradient(ellipse, rgba(255,214,10,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: '-20px', left: '-20px', width: '120px', height: '120px', background: 'radial-gradient(ellipse, rgba(230,57,70,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', position: 'relative' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,214,10,0.3), rgba(255,214,10,0.08))', border: '2px solid rgba(255,214,10,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', flexShrink: 0, animation: 'shimmer 3s ease infinite' }}>
                  👑
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(255,214,10,0.65)', marginBottom: '4px' }}>
                    🔥 Debate of the Day — Reigning Champion
                  </div>
                  <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '32px', letterSpacing: '3px', color: 'var(--gold)', lineHeight: 1, marginBottom: '5px' }}>
                    {totdWinner}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    Won the 24-hour Debate of the Day · Earned <span style={{ color: 'var(--gold)', fontWeight: 700 }}>+300 ELO</span>
                  </div>
                </div>
                <Link href="/topic" style={{ background: 'rgba(255,214,10,0.15)', border: '1px solid rgba(255,214,10,0.4)', borderRadius: '12px', padding: '12px 20px', color: 'var(--gold)', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'center', display: 'block', flexShrink: 0 }}>
                  🔥 Compete Today
                </Link>
              </div>
            </div>
          )}

          {/* Your rank banner — if logged in and not in top 10 */}
          {user && myPlayer && !isInTop10 && myRank && (
            <div style={{ background: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.2)', borderRadius: '12px', padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', color: 'var(--accent)', width: '40px' }}>#{myRank}</div>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),#ff8c69)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                {myPlayer.username.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{myPlayer.username} <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 400 }}>← you</span></div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{myPlayer.wins ?? 0} wins · {myPlayer.debates ?? 0} debates</div>
              </div>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', color: 'var(--accent2)', letterSpacing: '1px' }}>{myPlayer.elo}</div>
            </div>
          )}

          {/* Top 3 Podium */}
          {!loading && top10.length >= 3 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '12px', marginBottom: '28px' }}>
              {/* 2nd place */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: avatarGrad(1), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#fff', border: '2px solid var(--silver)' }}>
                  {top10[1]?.username.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text2)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{top10[1]?.username}</div>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '14px', color: 'var(--silver)', letterSpacing: '1px' }}>{top10[1]?.elo} ELO</div>
                <div style={{ height: '60px', width: '80px', background: 'rgba(192,192,192,0.06)', border: '1px solid rgba(192,192,192,0.2)', borderBottom: 'none', borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-bebas)', fontSize: '30px', color: 'var(--silver)' }}>2</div>
              </div>
              {/* 1st place */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                <div style={{ fontSize: '22px', marginBottom: '2px' }}>👑</div>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: avatarGrad(0), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: '#000', border: '3px solid var(--gold)' }}>
                  {top10[0]?.username.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{top10[0]?.username}</div>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '15px', color: 'var(--gold)', letterSpacing: '1px' }}>{top10[0]?.elo} ELO</div>
                <div style={{ height: '90px', width: '90px', background: 'rgba(255,214,10,0.06)', border: '1px solid rgba(255,214,10,0.3)', borderBottom: 'none', borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-bebas)', fontSize: '40px', color: 'var(--gold)' }}>1</div>
              </div>
              {/* 3rd place */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: avatarGrad(2), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff', border: '2px solid var(--bronze)' }}>
                  {top10[2]?.username.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text2)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{top10[2]?.username}</div>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '14px', color: 'var(--bronze)', letterSpacing: '1px' }}>{top10[2]?.elo} ELO</div>
                <div style={{ height: '45px', width: '72px', background: 'rgba(205,127,50,0.06)', border: '1px solid rgba(205,127,50,0.2)', borderBottom: 'none', borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-bebas)', fontSize: '24px', color: 'var(--bronze)' }}>3</div>
              </div>
            </div>
          )}

          {/* Full leaderboard */}
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px', flexDirection: 'column' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading rankings...</div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : players.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏆</div>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', marginBottom: '8px' }}>NO RANKINGS YET</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Be the first to debate and claim the #1 spot.</div>
              <Link href="/rebut" style={{ background: 'var(--accent)', borderRadius: '8px', padding: '10px 24px', color: '#fff', fontSize: '14px', fontWeight: 700, fontFamily: 'DM Sans, sans-serif' }}>
                Start Debating →
              </Link>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
              {players.map((p, i) => {
                const isMe = p.username === profile?.username
                const isAnimating = animatingIds.has(p.id)
                return (
                  <div
                    key={p.id}
                    className={`rank-row rank-entry ${isAnimating ? 'animating' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '13px 20px',
                      borderBottom: i < players.length - 1 ? '1px solid var(--border)' : 'none',
                      background: isMe ? 'rgba(230,57,70,0.04)' : 'transparent',
                      animationDelay: `${i * 0.03}s`,
                      animationFillMode: 'both',
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '18px', width: '32px', textAlign: 'center', color: medalColor(i), flexShrink: 0 }}>
                      {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i + 1}`}
                    </div>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: isMe ? 'linear-gradient(135deg,var(--accent),#ff8c69)' : avatarGrad(i), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: i < 3 ? (i === 0 ? '#000' : '#fff') : '#fff', flexShrink: 0, border: isMe ? '2px solid rgba(230,57,70,0.5)' : 'none' }}>
                      {p.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: isMe ? 700 : 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.username}</span>
                        {isMe && <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 700, background: 'rgba(230,57,70,0.1)', padding: '1px 6px', borderRadius: '4px', flexShrink: 0 }}>YOU</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>
                        {p.wins ?? 0} wins · {p.debates ?? 0} debates
                        {p.debates > 0 && ` · ${Math.round((p.wins / p.debates) * 100)}% win rate`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '20px', letterSpacing: '1px', color: i === 0 ? 'var(--gold)' : i === 1 ? 'var(--silver)' : i === 2 ? 'var(--bronze)' : isMe ? 'var(--accent)' : 'var(--accent2)', animation: isAnimating ? 'countUp 0.4s ease' : 'none' }}>
                        {p.elo}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '1px' }}>ELO</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Logged out CTA */}
          {!user && (
            <div style={{ background: 'rgba(230,57,70,0.05)', border: '1px solid rgba(230,57,70,0.2)', borderRadius: '12px', padding: '32px', textAlign: 'center', marginTop: '20px' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>⚡</div>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '2px', marginBottom: '8px' }}>SIGN IN TO GAIN ELO!</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.7 }}>
                Create a free account to earn ELO, appear on this leaderboard,<br />and track your debate history.
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <Link href="/signup" style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '11px 24px', color: '#fff', fontSize: '14px', fontWeight: 700, fontFamily: 'DM Sans, sans-serif' }}>
                  Sign up free →
                </Link>
                <Link href="/login" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '11px 20px', color: 'var(--text2)', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
                  Log in
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </>
  )
}