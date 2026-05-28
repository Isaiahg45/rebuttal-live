'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'
import Nav from '../components/Nav'
import Link from 'next/link'

const TIER_LABELS = [
  { min: 1000, label: 'GRANDMASTER', color: '#ff3b30', glow: 'rgba(255,59,48,0.5)', bg: 'rgba(255,59,48,0.1)' },
  { min: 800, label: 'MASTER', color: '#ff9500', glow: 'rgba(255,149,0,0.4)', bg: 'rgba(255,149,0,0.1)' },
  { min: 600, label: 'DIAMOND', color: '#00d4ff', glow: 'rgba(0,212,255,0.4)', bg: 'rgba(0,212,255,0.08)' },
  { min: 400, label: 'PLATINUM', color: '#a855f7', glow: 'rgba(168,85,247,0.4)', bg: 'rgba(168,85,247,0.08)' },
  { min: 200, label: 'GOLD', color: '#ffd60a', glow: 'rgba(255,214,10,0.4)', bg: 'rgba(255,214,10,0.08)' },
  { min: 0, label: 'BRONZE', color: '#cd7f32', glow: 'rgba(205,127,50,0.3)', bg: 'rgba(205,127,50,0.08)' },
]

function getTier(elo: number) {
  return TIER_LABELS.find(t => elo >= t.min) || TIER_LABELS[TIER_LABELS.length - 1]
}

function getNextTier(elo: number) {
  const idx = TIER_LABELS.findIndex(t => elo >= t.min)
  return idx > 0 ? TIER_LABELS[idx - 1] : null
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const [editing, setEditing] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [players, setPlayers] = useState<any[]>([])

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/signup'); return }
    if (!profile?.username) { router.push('/username'); return }
    setNewUsername(profile.username)
  }, [user, profile, loading])

  useEffect(() => {
    supabase.from('profiles').select('username, elo').order('elo', { ascending: false }).then(({ data }) => setPlayers(data ?? []))
  }, [])

  useEffect(() => {
    if (!newUsername || newUsername === profile?.username) { setUsernameAvailable(null); setUsernameError(''); return }
    if (newUsername.length < 3) { setUsernameError('At least 3 characters'); return }
    if (newUsername.length > 16) { setUsernameError('Max 16 characters'); return }
    if (!/^[a-z0-9_]+$/.test(newUsername)) { setUsernameError('Letters, numbers, underscores only'); return }
    setUsernameError('')
    const t = setTimeout(async () => {
      setChecking(true)
      const { data } = await supabase.from('profiles').select('username').eq('username', newUsername).maybeSingle()
      setUsernameAvailable(!data)
      setChecking(false)
    }, 400)
    return () => clearTimeout(t)
  }, [newUsername])

  const saveUsername = async () => {
    if (usernameError || (!usernameAvailable && newUsername !== profile?.username)) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ username: newUsername }).eq('id', user.id)
    if (error) { setUsernameError('Failed. Try again.'); setSaving(false); return }
    setEditing(false); setSaving(false); window.location.reload()
  }

  const deleteAccount = async () => {
    if (deleteText !== 'DELETE') return
    await supabase.from('profiles').delete().eq('id', user.id)
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading || !user || !profile?.username) {
    return (
      <>
        <Nav active="profile" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 56px)', flexDirection: 'column', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid rgba(230,57,70,0.5)', borderTopColor: '#e63946', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </>
    )
  }

  const initials = profile.username.slice(0, 2).toUpperCase()
  const myRank = players.findIndex(p => p.username === profile.username) + 1
  const elo = profile.elo ?? 0
  const wins = profile.wins ?? 0
  const debates = profile.debates ?? 0
  const winRate = debates > 0 ? Math.round((wins / debates) * 100) : 0
  const tier = getTier(elo)
  const nextTier = getNextTier(elo)
  const currentTierMin = tier.min
  const nextTierMin = nextTier?.min ?? currentTierMin + 1
  const progress = nextTier ? Math.min(100, Math.round(((elo - currentTierMin) / (nextTierMin - currentTierMin)) * 100)) : 100

  const OVERLAY: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(12px)', padding: '16px' }
  const MODAL: React.CSSProperties = { background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '32px 28px', width: '100%', maxWidth: '380px', boxShadow: '0 0 80px rgba(0,0,0,0.8)' }

  return (
    <>
      <Nav active="profile" />
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes tierGlow{0%,100%{opacity:0.7}50%{opacity:1}}
      `}</style>

      <div style={{ minHeight: 'calc(100vh - 56px)', overflowY: 'auto', overflowX: 'hidden' }}>

        {/* Hero banner */}
        <div style={{ position: 'relative', overflow: 'hidden', background: `linear-gradient(180deg, ${tier.bg} 0%, rgba(0,0,0,0) 100%)`, padding: 'clamp(28px,5vw,48px) clamp(16px,4vw,24px) clamp(24px,4vw,40px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ position: 'absolute', top: '-80px', left: '50%', transform: 'translateX(-50%)', width: '500px', height: '400px', background: `radial-gradient(ellipse, ${tier.glow.replace(')', ', 0.12)')} 0%, transparent 70%)`, pointerEvents: 'none' }} />

          <div style={{ maxWidth: '640px', margin: '0 auto', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px,3vw,28px)', flexWrap: 'wrap', marginBottom: '28px' }}>
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 'clamp(72px,12vw,96px)', height: 'clamp(72px,12vw,96px)', borderRadius: '50%', background: 'linear-gradient(135deg,#e63946,#ff8c69)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(22px,4vw,32px)', fontWeight: 700, color: '#fff', border: `3px solid ${tier.color}`, boxShadow: `0 0 24px ${tier.glow}, 0 0 48px ${tier.glow}50` }}>
                  {initials}
                </div>
                <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', background: tier.bg, border: `1px solid ${tier.color}50`, borderRadius: '20px', padding: '2px 10px', fontSize: '9px', fontWeight: 700, color: tier.color, letterSpacing: '1.5px', whiteSpace: 'nowrap', textShadow: `0 0 8px ${tier.glow}`, animation: 'tierGlow 3s ease infinite' }}>
                  {tier.label}
                </div>
              </div>

              <div style={{ flex: 1, minWidth: '150px', paddingTop: '8px' }}>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(24px,5vw,38px)', letterSpacing: '2px', color: '#fff', lineHeight: 1, marginBottom: '8px' }}>
                  {profile.username}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {myRank > 0 && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.2)', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: '#ffd60a', fontWeight: 600 }}>
                      🌍 Rank #{myRank}
                    </div>
                  )}
                  {winRate > 0 && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>
                      {winRate}% win rate
                    </div>
                  )}
                </div>
              </div>

              <button onClick={() => setEditing(true)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 18px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0, transition: 'all 0.2s' }}>
                Edit Username
              </button>
            </div>

            {/* Tier progress */}
            {nextTier && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px' }}>
                  <span style={{ color: tier.color, fontWeight: 700, letterSpacing: '1px' }}>{tier.label}</span>
                  <span style={{ color: nextTier.color, fontWeight: 700, letterSpacing: '1px' }}>{nextTier.label} at {nextTier.min} ELO</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${tier.color}, ${nextTier.color})`, borderRadius: '3px', boxShadow: `0 0 8px ${tier.glow}`, transition: 'width 0.8s ease' }} />
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '6px' }}>
                  {nextTier.min - elo} ELO to reach {nextTier.label}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ maxWidth: '640px', margin: '0 auto', padding: 'clamp(20px,4vw,32px) clamp(16px,4vw,24px)', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {[
              { val: String(elo), label: 'ELO', color: '#e63946', glow: 'rgba(230,57,70,0.3)', bg: 'rgba(230,57,70,0.05)' },
              { val: String(wins), label: 'WINS', color: '#22c55e', glow: 'rgba(34,197,94,0.25)', bg: 'rgba(34,197,94,0.05)' },
              { val: String(debates), label: 'DEBATES', color: 'rgba(255,255,255,0.5)', glow: 'none', bg: 'rgba(255,255,255,0.03)' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color === 'rgba(255,255,255,0.5)' ? 'rgba(255,255,255,0.07)' : `${s.color}25`}`, borderRadius: '14px', padding: 'clamp(16px,3vw,24px)', textAlign: 'center', boxShadow: s.glow !== 'none' ? `0 0 24px ${s.glow}` : 'none' }}>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(32px,6vw,44px)', letterSpacing: '2px', color: s.color, textShadow: s.glow !== 'none' ? `0 0 20px ${s.glow}` : 'none', lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '6px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Challenge CTA */}
          <div style={{ background: 'linear-gradient(135deg, rgba(230,57,70,0.08) 0%, rgba(255,107,53,0.04) 100%)', border: '1px solid rgba(230,57,70,0.2)', borderRadius: '14px', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', boxShadow: '0 0 24px rgba(230,57,70,0.05)' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>⚔️ Challenge Someone</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>Create a custom debate room · Set your own topic · Stake ELO</div>
            </div>
            <Link href="/create-challenge" style={{ background: 'linear-gradient(135deg,#e63946,#c1121f)', borderRadius: '10px', padding: '11px 20px', color: '#fff', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', display: 'block', boxShadow: '0 0 16px rgba(230,57,70,0.35)', transition: 'all 0.2s' }}>
              Create →
            </Link>
          </div>

          {/* Recent debates placeholder */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: 'rgba(255,255,255,0.3)' }}>RECENT DEBATES</div>
            <div style={{ padding: '28px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>
              No debates yet.{' '}
              <span onClick={() => router.push('/rebut')} style={{ color: '#e63946', cursor: 'pointer', fontWeight: 500 }}>Start one →</span>
            </div>
          </div>

          {/* Account */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: 'rgba(255,255,255,0.3)' }}>ACCOUNT</div>
            <button onClick={() => { supabase.auth.signOut(); window.location.href = '/' }} style={{ width: '100%', padding: '15px 20px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', fontSize: '14px', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif', transition: 'background 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >→ Sign out</button>
            <div style={{ padding: '12px 20px', display: 'flex', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <Link href="/tos" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', textDecoration: 'underline' }}>Terms of Service</Link>
              <Link href="/privacy" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', textDecoration: 'underline' }}>Privacy Policy</Link>
            </div>
            <button onClick={() => setShowDelete(true)} style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', color: 'rgba(239,68,68,0.5)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif' }}>
              🗑 Delete account
            </button>
          </div>

          <div style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.15)', paddingTop: '8px' }}>
            © 2026 ViralBot AI LLC · New Jersey, USA
          </div>
        </div>
      </div>

      {/* Edit username modal */}
      {editing && (
        <div style={OVERLAY}>
          <div style={MODAL}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '3px', marginBottom: '6px', color: '#fff' }}>CHANGE USERNAME</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginBottom: '20px' }}>Pick a new unique username.</div>
            <div style={{ position: 'relative', marginBottom: '6px' }}>
              <input value={newUsername} onChange={e => { setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setUsernameAvailable(null); setUsernameError('') }} maxLength={16} autoFocus style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${usernameError ? '#ef4444' : usernameAvailable === true ? '#22c55e' : 'rgba(255,255,255,0.12)'}`, borderRadius: '10px', padding: '13px 50px 13px 16px', color: '#fff', fontSize: '15px', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box', transition: 'border-color 0.2s' }} />
              <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{newUsername.length}/16</span>
            </div>
            <div style={{ fontSize: '12px', minHeight: '18px', marginBottom: '20px', paddingLeft: '4px', color: usernameError ? '#ef4444' : usernameAvailable === true ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>
              {checking ? 'Checking...' : usernameError || (usernameAvailable === true ? '✓ Available' : usernameAvailable === false ? '✗ Already taken' : '')}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setEditing(false); setNewUsername(profile.username); setUsernameError(''); setUsernameAvailable(null) }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: '14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
              <button onClick={saveUsername} disabled={saving || !!usernameError || usernameAvailable === false} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#e63946,#c1121f)', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: saving || !!usernameError ? 0.5 : 1, boxShadow: '0 0 16px rgba(230,57,70,0.3)' }}>
                {saving ? 'Saving...' : 'Save Username'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDelete && (
        <div style={OVERLAY}>
          <div style={{ ...MODAL, borderColor: 'rgba(239,68,68,0.25)', boxShadow: '0 0 40px rgba(239,68,68,0.1)' }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '3px', color: '#ef4444', marginBottom: '8px' }}>DELETE ACCOUNT</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, marginBottom: '20px' }}>
              Permanently deletes your account, username, and all debate history.<br /><br />
              Type <b style={{ color: '#fff' }}>DELETE</b> to confirm.
            </div>
            <input value={deleteText} onChange={e => setDeleteText(e.target.value)} placeholder="Type DELETE" style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 16px', color: '#fff', fontSize: '14px', outline: 'none', marginBottom: '16px', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setShowDelete(false); setDeleteText('') }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: '14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
              <button onClick={deleteAccount} disabled={deleteText !== 'DELETE'} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: deleteText === 'DELETE' ? '#ef4444' : 'rgba(255,255,255,0.06)', color: deleteText === 'DELETE' ? '#fff' : 'rgba(255,255,255,0.2)', fontSize: '14px', fontWeight: 700, cursor: deleteText === 'DELETE' ? 'pointer' : 'not-allowed', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s' }}>
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}