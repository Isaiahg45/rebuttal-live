'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'
import Nav from '../components/Nav'

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

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/signup'); return }
    if (!profile?.username) { router.push('/username'); return }
    setNewUsername(profile.username)
  }, [user, profile, loading])

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
    setEditing(false)
    setSaving(false)
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
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </>
    )
  }

  const initials = profile.username.slice(0, 2).toUpperCase()
  const stats = [
    { val: String(profile.elo ?? 0), label: 'ELO', color: 'var(--accent)' },
    { val: String(profile.wins ?? 0), label: 'Wins', color: 'var(--green)' },
    { val: String(profile.debates ?? 0), label: 'Debates', color: 'var(--text)' },
  ]

  return (
    <>
      <Nav active="profile" />
      <div style={{ minHeight: 'calc(100vh - 56px)', overflowY: 'auto' }}>

        <div style={{ background: 'linear-gradient(180deg,rgba(230,57,70,0.06),transparent)', padding: '40px 24px 32px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),#ff8c69)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 700, border: '3px solid rgba(230,57,70,0.3)', color: '#fff', flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '30px', letterSpacing: '2px' }}>{profile.username}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,214,10,.08)', border: '1px solid rgba(255,214,10,.2)', borderRadius: '20px', padding: '3px 12px', fontSize: '12px', color: 'var(--gold)', fontWeight: 600, marginTop: '6px' }}>
                🌍 Rank #214 Globally
              </div>
            </div>
            <button onClick={() => setEditing(true)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              Edit Username
            </button>
          </div>
        </div>

        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {stats.map(s => (
              <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '36px', letterSpacing: '2px', color: s.color }}>{s.val}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)' }}>Recent Debates</div>
            <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
              No debates yet.{' '}
              <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => router.push('/rebut')}>Start one →</span>
            </div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)' }}>Account</div>
            <button onClick={handleSignOut} style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontSize: '14px', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif' }}>
              → Sign out
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', color: 'var(--red)', fontSize: '14px', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif' }}>
              🗑 Delete account
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(6px)' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: '16px', padding: '32px', width: '380px' }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', marginBottom: '6px' }}>CHANGE USERNAME</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Pick a new unique username.</div>
            <div style={{ position: 'relative', marginBottom: '6px' }}>
              <input value={newUsername} onChange={e => { setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setUsernameAvailable(null); setUsernameError('') }} maxLength={16} autoFocus style={{ width: '100%', background: 'var(--surface2)', border: `1px solid ${usernameError ? 'var(--red)' : usernameAvailable === true ? 'var(--green)' : 'var(--border2)'}`, borderRadius: '8px', padding: '12px 48px 12px 14px', color: 'var(--text)', fontSize: '15px', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--muted)' }}>{newUsername.length}/16</span>
            </div>
            <div style={{ fontSize: '12px', minHeight: '18px', marginBottom: '20px', paddingLeft: '4px', color: usernameError ? 'var(--red)' : usernameAvailable === true ? 'var(--green)' : 'var(--muted)' }}>
              {checking ? 'Checking...' : usernameError || (usernameAvailable === true ? '✓ Available' : usernameAvailable === false ? '✗ Already taken' : '')}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setEditing(false); setNewUsername(profile.username); setUsernameError(''); setUsernameAvailable(null) }} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
              <button onClick={handleSaveUsername} disabled={saving || !!usernameError || usernameAvailable === false} style={{ flex: 2, padding: '11px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: saving || !!usernameError ? 0.6 : 1 }}>
                {saving ? 'Saving...' : 'Save Username'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(6px)' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '16px', padding: '32px', width: '380px' }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', color: 'var(--red)', marginBottom: '8px' }}>DELETE ACCOUNT</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7, marginBottom: '20px' }}>
              Permanently deletes your account, username, and all debate history.<br /><br />
              Type <b style={{ color: 'var(--text)' }}>DELETE</b> to confirm.
            </div>
            <input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="Type DELETE" style={{ width: '100%', background: 'var(--surface2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '11px 14px', color: 'var(--text)', fontSize: '14px', outline: 'none', marginBottom: '16px', fontFamily: 'DM Sans, sans-serif' }} />
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