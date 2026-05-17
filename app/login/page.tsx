'use client'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  const handleEmail = async () => {
    if (!email.includes('@')) { setError('Enter a valid email'); return }
    setSending(true)
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    })
    if (err) { setError(err.message); setSending(false); return }
    setSent(true)
    setSending(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(230,57,70,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(230,57,70,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: '500px', height: '500px', background: 'radial-gradient(ellipse, rgba(230,57,70,0.07) 0%, transparent 70%)', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ fontFamily: 'var(--font-bebas)', fontSize: '28px', letterSpacing: '3px' }}>
            <span style={{ color: 'var(--accent)' }}>REBUTTAL</span>
            <span style={{ color: 'var(--text)' }}>.LIVE</span>
          </Link>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px' }}>
          {!sent ? (
            <>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '2px', marginBottom: '6px', textAlign: 'center' }}>WELCOME BACK</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '28px', textAlign: 'center' }}>Sign in to your account</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <button onClick={handleGoogle} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.4-4z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-3-11.3-7.3l-6.5 5C9.6 39.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.6-4.8 6l6.2 5.2C40.7 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"/></svg>
                  Continue with Google
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>or email</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>

              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="you@example.com"
                onKeyDown={e => e.key === 'Enter' && handleEmail()}
                style={{ width: '100%', background: 'var(--surface2)', border: `1px solid ${error ? 'var(--red)' : 'var(--border2)'}`, borderRadius: '8px', padding: '12px 16px', color: 'var(--text)', fontSize: '15px', outline: 'none', marginBottom: '8px', fontFamily: 'DM Sans, sans-serif' }}
              />
              {error && <div style={{ fontSize: '12px', color: 'var(--red)', marginBottom: '8px' }}>{error}</div>}
              <button onClick={handleEmail} disabled={sending} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginTop: '4px', opacity: sending ? 0.7 : 1 }}>
                {sending ? 'Sending...' : 'Send Magic Link →'}
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📬</div>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', marginBottom: '8px' }}>CHECK YOUR EMAIL</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7 }}>
                Magic link sent to <b style={{ color: 'var(--text)' }}>{email}</b>.<br />Click it to sign in.
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--muted)' }}>
          No account?{' '}
          <Link href="/signup" style={{ color: 'var(--accent)', fontWeight: 500 }}>Sign up free</Link>
        </div>
      </div>
    </div>
  )
}