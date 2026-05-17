'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function UsernamePage() {
  const router = useRouter()
  const { user, profile, loading, refreshProfile } = useAuth()
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/signup'); return }
    if (profile?.username) { router.push('/rebut'); return }
  }, [user, profile, loading])

  useEffect(() => {
    if (!username) { setAvailable(null); setError(''); return }
    const err = validate(username)
    if (err) { setError(err); setAvailable(null); return }
    setError('')
    const timer = setTimeout(async () => {
      setChecking(true)
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle()
      setAvailable(!data)
      setChecking(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [username])

  const validate = (val: string) => {
    if (val.length < 3) return 'At least 3 characters'
    if (val.length > 16) return 'Max 16 characters'
    if (/\s/.test(val)) return 'No spaces allowed'
    if (!/^[a-zA-Z0-9_]+$/.test(val)) return 'Letters, numbers, underscores only'
    const banned = ['fuck','shit','nigga','nigger','cunt','bitch','dick','cock','pussy','slut','whore','retard','fag']
    if (banned.some(w => val.toLowerCase().includes(w))) return 'Username not allowed'
    return ''
  }

  const handleSubmit = async () => {
    if (!available || !!error || !user) return
    setSaving(true)

    const { error: dbErr } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        username,
        elo: 0,
        wins: 0,
        losses: 0,
        debates: 0,
      }, { onConflict: 'id' })

    console.log('Save error:', dbErr)

    if (dbErr) {
      setError(`Failed: ${dbErr.message}`)
      setSaving(false)
      return
    }

    await refreshProfile()
    router.push('/rebut')
  }

  const statusColor = error ? 'var(--red)' : available === true ? 'var(--green)' : 'var(--muted)'
  const statusMsg = checking ? 'Checking...' : error ? error : available === true ? '✓ Available' : available === false ? '✗ Already taken' : ''

  // Show spinner while loading or redirecting
  if (loading || !user || profile?.username) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(230,57,70,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(230,57,70,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', background: 'radial-gradient(ellipse, rgba(230,57,70,0.08) 0%, transparent 70%)', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Link href="/" style={{ fontFamily: 'var(--font-bebas)', fontSize: '28px', letterSpacing: '3px' }}>
            <span style={{ color: 'var(--accent)' }}>REBUTTAL</span>
            <span style={{ color: 'var(--text)' }}>.LIVE</span>
          </Link>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '40px 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(230,57,70,0.1)', border: '2px solid rgba(230,57,70,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 16px' }}>🏷️</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '28px', letterSpacing: '2px', marginBottom: '8px' }}>CHOOSE YOUR NAME</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7 }}>
              This is how the world will know you<br />in every debate. Choose wisely.
            </div>
          </div>

          <div style={{ position: 'relative', marginBottom: '6px' }}>
            <input
              value={username}
              onChange={e => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setError(''); setAvailable(null) }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="your_username"
              maxLength={16}
              autoFocus
              style={{ width: '100%', background: 'var(--surface2)', border: `2px solid ${error ? 'var(--red)' : available === true ? 'var(--green)' : 'var(--border2)'}`, borderRadius: '10px', padding: '14px 52px 14px 16px', color: 'var(--text)', fontSize: '18px', outline: 'none', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.5px', transition: 'border-color 0.2s' }}
            />
            <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--muted)' }}>{username.length}/16</div>
          </div>

          <div style={{ fontSize: '13px', color: statusColor, minHeight: '22px', marginBottom: '20px', paddingLeft: '4px', transition: 'color 0.2s', fontWeight: 500 }}>
            {statusMsg}
          </div>

          <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '24px' }}>
            {['3–16 characters', 'Letters, numbers, underscores only', 'No spaces', 'Must be unique'].map(rule => (
              <div key={rule} style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 2.2, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--accent)', fontSize: '10px' }}>●</span> {rule}
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!available || saving || !!error}
            style={{ width: '100%', padding: '15px', borderRadius: '10px', border: 'none', background: available && !error ? 'var(--accent)' : 'var(--surface2)', color: available && !error ? '#fff' : 'var(--muted)', fontSize: '16px', fontWeight: 700, cursor: available && !error ? 'pointer' : 'not-allowed', transition: 'all 0.2s', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.5px' }}
          >
            {saving ? 'Saving...' : 'Claim Username →'}
          </button>
        </div>
      </div>
    </div>
  )
}