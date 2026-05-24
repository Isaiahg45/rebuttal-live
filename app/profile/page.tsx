'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'
import Nav from '../components/Nav'
import Link from 'next/link'

export default function ProfilePage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const [editing, setEditing] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [players, setPlayers] = useState<any[]>([])

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/signup'); return }
    if (!profile?.username) { router.push('/username'); return }
    setNewUsername(profile.username)
  }, [user, profile, loading])

  useEffect(() => {
    supabase.from('profiles').select('username, elo').order('elo', { ascending: false })
      .then(({ data }) => setPlayers(data ?? []))
  }, [])

  useEffect(() => {
    if (!newUsername || newUsername === profile?.username) { setUsernameAvailable(null); setUsernameError(''); return }
    if (newUsername.length < 3) { setUsernameError('At least 3 characters'); return }
    if (newUsername.length > 16) { setUsernameError('Max 16 characters'); return }
    if (!/^[a-z0-9_]+$/.test(newUsername)) { setUsernameError('Letters, numbers, underscores only'); return }
    setUsernameError('')
    const timer = setTimeout(async () => {
      setChecking(true)
      const { data } = await supabase.from('profiles').select('username').eq('username', newUsername).maybeSingle()
      setUsernameAvailable(!data)
      setChecking(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [newUsername])

  const handleSaveUsername = async () => {
    if (usernameError || (!usernameAvailable && newUsername !== profile?.username)) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ username: newUsername }).eq('id', user.id)
    if (error) { setUsernameError('Failed. Try again.'); setSaving(false); return }
    setEditing(false); setSaving(false)
    window.location.reload()
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return
    await supabase.from('profiles').delete().eq('id', user.id)
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading || !user || !profile?.username) {
    return (
      <>
        <Nav active="profile" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 56px)', flexDirection: 'column', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', boxShadow: '0 0 10px rgba(230,57,70,0.3)' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </>
    )
  }

  const initials = profile.username.slice(0, 2).toUpperCase()
  const myRank = players.findIndex(p => p.username === profile.username) + 1
  const winRate = profile.debates > 0 ? Math.round(((profile.wins ?? 0) / profile.debates) * 100) : 0

  const stats = [
    { val: String(profile.elo ?? 0), label: 'ELO', color: 'var(--accent)', glow: 'rgba(230,57,70,0.3)' },
    { val: String(profile.wins ?? 0), label: 'Wins', color: 'var(--green)', glow: 'rgba(34,197,94,0.2)' },
    { val: String(profile.debates ?? 0), label: 'Debates', color: 'var(--text)', glow: 'none' },
  ]

  const overlayBase: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, backdropFilter: 'blur(8px)', padding: '16px',
  }

  return (
    <>
      <Nav active="profile" />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <div style={{ minHeight: 'calc(100vh - 56px)', overflowY: 'auto', overflowX: 'hidden' }}>

        {/* Hero header */}
        <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, rgba(230,57,70,0.07) 0%, transparent 100%)', padding: 'clamp(28px, 5vw, 44px) clamp(16px, 4vw, 24px) clamp(24px, 4vw, 36px)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)', width: '400px', height: '300px', background: 'radial-gradient(ellipse, rgba(230,57,70,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: 'clamp(14px, 3vw, 24px)', position: 'relative', flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{ width: 'clamp(60px, 10vw, 80px)', height: 'clamp(60px, 10vw, 80px)', borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),#ff8c69)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 700, border: '3px solid rgba(230,57,70,0.35)', color: '#fff', flexShrink: 0, boxShadow: '0 0 30px rgba(230,57,70,0.25)' }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(22px, 5vw, 32px)', letterSpacing: '2px', textShadow: '0 0 20px rgba(255,255,255,0.05)' }}>{profile.username}</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                {profile.elo > 0 && myRank > 0 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.2)', borderRadius: '20px', padding: '3px 12px', fontSize: '12px', color: 'var(--gold)', fontWeight: 600, boxShadow: '0 0 10px rgba(255,214,10,0.1)' }}>
                    🌍 Rank #{myRank} Globally
                  </div>
                )}
                {winRate > 0 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '20px', padding: '3px 12px', fontSize: '12px', color: 'var(--green)', fontWeight: 600 }}>
                    {winRate}% win rate
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setEditing(true)}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s', flexShrink: 0 }}
              onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)'; (e.target as HTMLElement).style.color = 'var(--text)' }}
              onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--border2)'; (e.target as HTMLElement).style.color = 'var(--text2)' }}
            >
              Edit Username
            </button>
          </div>
        </div>

        <div style={{ maxWidth: '600px', margin: '0 auto', padding: 'clamp(20px, 4vw, 32px) clamp(16px, 4vw, 24px)', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {stats.map(s => (
              <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: 'clamp(14px, 3vw, 22px)', textAlign: 'center', transition: 'all 0.2s', boxShadow: s.glow !== 'none' ? `0 0 20px ${s.glow}` : 'none' }}>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(28px, 6vw, 40px)', letterSpacing: '2px', color: s.color, textShadow: s.glow !== 'none' ? `0 0 20px ${s.glow}` : 'none' }}>{s.val}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '4px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Create challenge CTA */}
          <div style={{ background: 'linear-gradient(135deg, rgba(230,57,70,0.08), rgba(255,107,53,0.04))', border: '1px solid rgba(230,57,70,0.2)', borderRadius: '14px', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', boxShadow: '0 0 20px rgba(230,57,70,0.05)' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>⚔️ Challenge someone</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>Create a custom debate room with your own topic and ELO stake.</div>
            </div>
            <Link href="/create-challenge" style={{ background: 'var(--accent)', borderRadius: '8px', padding: '10px 18px', color: '#fff', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 0 16px rgba(230,57,70,0.3)', transition: 'all 0.2s' }}>
              Create Challenge →
            </Link>
          </div>

          {/* Recent Debates */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)' }}>Recent Debates</div>
            <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
              No debates yet.{' '}
              <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }} onClick={() => router.push('/rebut')}>Start one →</span>
            </div>
          </div>

          {/* Account */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)' }}>Account</div>
            <button onClick={handleSignOut} style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontSize: '14px', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.target as HTMLElement).style.background = 'var(--surface2)'}
              onMouseLeave={e => (e.target as HTMLElement).style.background = 'none'}
            >
              → Sign out
            </button>
            <div style={{ padding: '12px 20px', display: 'flex', gap: '16px' }}>
              <Link href="/tos" style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'underline' }}>Terms of Service</Link>
              <Link href="/privacy" style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'underline' }}>Privacy Policy</Link>
            </div>
            <button onClick={() => setShowDeleteConfirm(true)} style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', color: 'var(--red)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif', opacity: 0.7 }}>
              🗑 Delete account
            </button>
          </div>

          <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--muted)', paddingTop: '8px' }}>
            © 2026 ViralBot AI LLC · New Jersey, USA
          </div>
        </div>
      </div>

      {/* Edit username modal */}
      {editing && (
        <div style={overlayBase}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: '18px', padding: '32px clamp(20px, 5vw, 32px)', width: '100%', maxWidth: '380px', boxShadow: '0 0 60px rgba(0,0,0,0.6)' }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', marginBottom: '6px' }}>CHANGE USERNAME</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Pick a new unique username.</div>
            <div style={{ position: 'relative', marginBottom: '6px' }}>
              <input
                value={newUsername}
                onChange={e => { setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setUsernameAvailable(null); setUsernameError('') }}
                maxLength={16}
                autoFocus
                style={{ width: '100%', background: 'var(--surface2)', border: `1px solid ${usernameError ? 'var(--red)' : usernameAvailable === true ? 'var(--green)' : 'var(--border2)'}`, borderRadius: '8px', padding: '12px 48px 12px 14px', color: 'var(--text)', fontSize: '15px', outline: 'none', fontFamily: 'DM Sans, sans-serif', transition: 'border-color 0.2s' }}
              />
              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--muted)' }}>{newUsername.length}/16</span>
            </div>
            <div style={{ fontSize: '12px', minHeight: '18px', marginBottom: '20px', paddingLeft: '4px', color: usernameError ? 'var(--red)' : usernameAvailable === true ? 'var(--green)' : 'var(--muted)' }}>
              {checking ? 'Checking...' : usernameError || (usernameAvailable === true ? '✓ Available' : usernameAvailable === false ? '✗ Already taken' : '')}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setEditing(false); setNewUsername(profile.username); setUsernameError(''); setUsernameAvailable(null) }} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
              <button onClick={handleSaveUsername} disabled={saving || !!usernameError || usernameAvailable === false} style={{ flex: 2, padding: '11px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: saving || !!usernameError ? 0.6 : 1, boxShadow: '0 0 16px rgba(230,57,70,0.3)' }}>
                {saving ? 'Saving...' : 'Save Username'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div style={overlayBase}>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '18px', padding: '32px clamp(20px, 5vw, 32px)', width: '100%', maxWidth: '380px', boxShadow: '0 0 40px rgba(239,68,68,0.1)' }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', color: 'var(--red)', marginBottom: '8px' }}>DELETE ACCOUNT</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7, marginBottom: '20px' }}>
              Permanently deletes your account, username, and all debate history.<br /><br />
              Type <b style={{ color: 'var(--text)' }}>DELETE</b> to confirm.
            </div>
            <input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              style={{ width: '100%', background: 'var(--surface2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '11px 14px', color: 'var(--text)', fontSize: '14px', outline: 'none', marginBottom: '16px', fontFamily: 'DM Sans, sans-serif' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
              <button onClick={handleDeleteAccount} disabled={deleteConfirmText !== 'DELETE'} style={{ flex: 2, padding: '11px', borderRadius: '8px', border: 'none', background: deleteConfirmText === 'DELETE' ? 'var(--red)' : 'var(--surface2)', color: deleteConfirmText === 'DELETE' ? '#fff' : 'var(--muted)', fontSize: '14px', fontWeight: 700, cursor: deleteConfirmText === 'DELETE' ? 'pointer' : 'not-allowed', fontFamily: 'DM Sans, sans-serif' }}>
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}