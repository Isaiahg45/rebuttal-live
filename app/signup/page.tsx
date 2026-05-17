'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Step = 'choose' | 'email' | 'verify' | 'username'

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('choose')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [guestName] = useState('guest' + Math.floor(1000 + Math.random() * 9000))

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('username').eq('id', session.user.id).single()
        if (!data?.username) setStep('username')
        else router.push('/')
      }
    })
  }, [])

  useEffect(() => {
    if (!username) { setAvailable(null); setError(''); return }
    const err = validateUsername(username)
    if (err) { setError(err); setAvailable(null); return }
    setError('')
    const timer = setTimeout(async () => {
      setChecking(true)
      const { data } = await supabase.from('profiles').select('username').eq('username', username).single()
      setAvailable(!data)
      setChecking(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [username])

  const validateUsername = (val: string) => {
    if (val.length < 3) return 'At least 3 characters'
    if (val.length > 16) return 'Max 16 characters'
    if (/\s/.test(val)) return 'No spaces allowed'
    if (!/^[a-zA-Z0-9_]+$/.test(val)) return 'Letters, numbers, underscores only'
    const banned = ['fuck','shit','nigga','nigger','cunt','bitch','dick','cock','pussy','slut','whore','retard','fag']
    if (banned.some(w => val.toLowerCase().includes(w))) return 'Username not allowed'
    return ''
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  const handleEmailSignup = async () => {
    if (!email || !email.includes('@')) { setError('Enter a valid email'); return }
    setSending(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    })
    if (err) { setError(err.message); setSending(false); return }
    setStep('verify')
    setSending(false)
  }

  const handleClaimUsername = async () => {
    if (!available || !!validateUsername(username)) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/signup'); return }
    const { error: dbErr } = await supabase.from('profiles').upsert({ id: user.id, username, elo: 0 })
    if (dbErr) { setError('Something went wrong. Try again.'); setSaving(false); return }
    router.push('/')
  }

  const handleGuest = () => router.push(`/rebut?guest=${guestName}`)

  const openEmailApp = () => {
    const domain = email.split('@')[1]
    const urls: Record<string, string> = {
      'gmail.com': 'https://mail.google.com',
      'yahoo.com': 'https://mail.yahoo.com',
      'outlook.com': 'https://outlook.live.com',
      'hotmail.com': 'https://outlook.live.com',
      'icloud.com': 'https://www.icloud.com/mail',
    }
    window.open(urls[domain] ?? `https://${domain}`, '_blank')
  }

  const statusColor = error ? 'var(--red)' : available === true ? 'var(--green)' : 'var(--muted)'
  const statusMsg = checking ? 'Checking availability...' : error ? error : available === true ? '✓ Available' : available === false ? '✗ Already taken' : ''

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(230,57,70,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(230,57,70,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', background: 'radial-gradient(ellipse, rgba(230,57,70,0.07) 0%, transparent 70%)', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px' }}>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Link href="/" style={{ fontFamily: 'var(--font-bebas)', fontSize: '28px', letterSpacing: '3px' }}>
            <span style={{ color: 'var(--accent)' }}>REBUTTAL</span>
            <span style={{ color: 'var(--text)' }}>.LIVE</span>
          </Link>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>

          {/* STEP: choose */}
          {step === 'choose' && (
            <div style={{ padding: '32px' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '26px', letterSpacing: '2px', marginBottom: '6px' }}>CREATE ACCOUNT</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>Earn ELO and climb the global leaderboard.</div>
              </div>

              <div style={{ background: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.15)', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>⚡</span>
                <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.7 }}>
                  Signed-in users <b style={{ color: 'var(--text)' }}>earn and lose ELO</b> and appear on the global leaderboard. Guests debate for fun only — no ELO, no history.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <button onClick={handleGoogle} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s' }}>
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.4-4z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-3-11.3-7.3l-6.5 5C9.6 39.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.6-4.8 6l6.2 5.2C40.7 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"/></svg>
                  Continue with Google
                </button>

                <button onClick={() => { setError(''); setStep('email') }} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s' }}>
                  ✉️ Continue with Email
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>

              <button onClick={handleGuest} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Skip — join as <b style={{ color: 'var(--text2)' }}>{guestName}</b> (no ELO)
              </button>
            </div>
          )}

          {/* STEP: email */}
          {step === 'email' && (
            <div style={{ padding: '32px' }}>
              <button onClick={() => setStep('choose')} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px', padding: 0 }}>← Back</button>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', marginBottom: '6px' }}>ENTER YOUR EMAIL</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px', lineHeight: 1.6 }}>We'll send a magic link — no password needed, ever.</div>

              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="you@example.com"
                onKeyDown={e => e.key === 'Enter' && handleEmailSignup()}
                autoFocus
                style={{ width: '100%', background: 'var(--surface2)', border: `1px solid ${error ? 'var(--red)' : 'var(--border2)'}`, borderRadius: '8px', padding: '13px 16px', color: 'var(--text)', fontSize: '15px', outline: 'none', marginBottom: '8px', fontFamily: 'DM Sans, sans-serif', transition: 'border-color 0.2s' }}
              />
              {error && <div style={{ fontSize: '12px', color: 'var(--red)', marginBottom: '12px', paddingLeft: '4px' }}>{error}</div>}

              <button onClick={handleEmailSignup} disabled={sending} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1, fontFamily: 'DM Sans, sans-serif', marginTop: error ? '0' : '8px', transition: 'opacity 0.2s' }}>
                {sending ? 'Sending...' : 'Send Magic Link →'}
              </button>
            </div>
          )}

          {/* STEP: verify */}
          {step === 'verify' && (
            <div style={{ padding: '36px 32px', textAlign: 'center' }}>

              {/* Icon */}
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', margin: '0 auto 20px' }}>
                📬
              </div>

              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '26px', letterSpacing: '2px', marginBottom: '8px' }}>CHECK YOUR EMAIL</div>

              <div style={{ fontSize: '14px', color: 'var(--text2)', marginBottom: '8px' }}>We sent a magic link to</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 16px', marginBottom: '24px', wordBreak: 'break-all' }}>
                {email}
              </div>

              <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.8, marginBottom: '28px' }}>
                Click the link in the email to verify your account.<br />
                After that, you'll choose your username.<br />
                <span style={{ fontSize: '12px' }}>No password needed — ever.</span>
              </div>

              {/* Progress steps */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '0', marginBottom: '28px' }}>
                {[
                  { num: '✓', label: 'Email sent', done: true },
                  { num: '2', label: 'Verify email', done: false },
                  { num: '3', label: 'Pick username', done: false },
                ].map((s, i) => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '80px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: s.done ? 'var(--accent)' : 'var(--surface2)', border: `1px solid ${s.done ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: s.done ? '#fff' : 'var(--muted)', flexShrink: 0 }}>{s.num}</div>
                      <span style={{ fontSize: '10px', color: s.done ? 'var(--text2)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{s.label}</span>
                    </div>
                    {i < 2 && <div style={{ width: '32px', height: '1px', background: 'var(--border)', marginTop: '15px', flexShrink: 0 }} />}
                  </div>
                ))}
              </div>

              {/* Open email button */}
              <button onClick={openEmailApp} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                📧 Open Email App
              </button>

              <button onClick={() => setStep('email')} style={{ width: '100%', padding: '11px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Use a different email
              </button>

              <div style={{ marginTop: '20px', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.7 }}>
                Didn't get it? Check your spam folder.<br />
                The link expires in 1 hour.
              </div>
            </div>
          )}

          {/* STEP: username */}
          {step === 'username' && (
            <div style={{ padding: '32px' }}>
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>🏷️</div>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '2px', marginBottom: '6px' }}>CHOOSE YOUR NAME</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
                  This is how the world will know you in every debate.
                </div>
              </div>

              <div style={{ position: 'relative', marginBottom: '6px' }}>
                <input
                  value={username}
                  onChange={e => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setError(''); setAvailable(null) }}
                  onKeyDown={e => e.key === 'Enter' && handleClaimUsername()}
                  placeholder="your_username"
                  maxLength={16}
                  autoFocus
                  style={{ width: '100%', background: 'var(--surface2)', border: `1px solid ${error ? 'var(--red)' : available === true ? 'var(--green)' : 'var(--border2)'}`, borderRadius: '8px', padding: '13px 48px 13px 16px', color: 'var(--text)', fontSize: '16px', outline: 'none', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.5px', transition: 'border-color 0.2s' }}
                />
                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--muted)' }}>{username.length}/16</div>
              </div>

              <div style={{ fontSize: '12px', color: statusColor, marginBottom: '20px', paddingLeft: '4px', minHeight: '18px', transition: 'color 0.2s' }}>
                {statusMsg}
              </div>

              <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px' }}>
                {['3–16 characters', 'Letters, numbers, underscores only', 'No spaces', 'Must be unique — no one else can have it'].map(rule => (
                  <div key={rule} style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 2 }}>· {rule}</div>
                ))}
              </div>

              <button
                onClick={handleClaimUsername}
                disabled={!available || saving || !!error}
                style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: available && !error ? 'var(--accent)' : 'var(--surface2)', color: available && !error ? '#fff' : 'var(--muted)', fontSize: '15px', fontWeight: 700, cursor: available && !error ? 'pointer' : 'not-allowed', transition: 'all 0.2s', fontFamily: 'DM Sans, sans-serif' }}
              >
                {saving ? 'Claiming...' : 'Claim Username →'}
              </button>
            </div>
          )}

        </div>

        {step !== 'username' && step !== 'verify' && (
          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--muted)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Log in</Link>
          </div>
        )}
      </div>
    </div>
  )
}