'use client'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'
import Nav from '../components/Nav'
import { io } from 'socket.io-client'

export default function CreateChallengePage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  const [topic, setTopic] = useState('')
  const [duration, setDuration] = useState(300)
  const [eloStake, setEloStake] = useState(25)
  const [debateType, setDebateType] = useState<'text' | 'vc'>('text')
  const [isPrivate, setIsPrivate] = useState(false)
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  if (loading) return (
    <>
      <Nav active="rebut" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 56px)' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </>
  )

  if (!user || !profile?.username) {
    return (
      <>
        <Nav active="rebut" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 56px)', flexDirection: 'column', gap: '16px', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px' }}>🔒</div>
          <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '2px' }}>SIGN IN TO CHALLENGE</div>
          <div style={{ fontSize: '14px', color: 'var(--muted)' }}>You need an account to create a custom debate room.</div>
          <button onClick={() => router.push('/signup')} style={{ background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '12px 28px', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 0 20px rgba(230,57,70,0.3)' }}>
            Sign Up Free →
          </button>
        </div>
      </>
    )
  }

  const handleCreate = () => {
    if (!topic.trim() || topic.trim().length < 10) {
      setError('Topic must be at least 10 characters.')
      return
    }
    if (isPrivate && !password.trim()) {
      setError('Private rooms need a password.')
      return
    }
    setError('')
    setCreating(true)

    const socket = io('https://rebuttal-live-production-3388.up.railway.app', {
      transports: ['websocket', 'polling']
    })

    socket.on('connect', () => {
      socket.emit('create_custom_room', {
        username: profile.username,
        topic: topic.trim(),
        duration,
        eloStake,
        isPrivate,
        password: isPrivate ? password.trim() : undefined,
        debateType,
      })
    })

    socket.on('custom_room_created', ({ instanceId, type }: { instanceId: string; type: string }) => {
      socket.disconnect()
      if (type === 'vc') {
        router.push(`/vc-debate/${instanceId}${isPrivate && password ? `?password=${encodeURIComponent(password)}` : ''}`)
      } else {
        router.push(`/debate/${instanceId}`)
      }
    })

    socket.on('error', ({ message }: { message: string }) => {
      setError(message)
      setCreating(false)
      socket.disconnect()
    })
  }

  const durationOptions = [
    { label: '2 min', value: 120 },
    { label: '3 min', value: 180 },
    { label: '5 min', value: 300 },
    { label: '8 min', value: 480 },
    { label: '10 min', value: 600 },
  ]

  const eloOptions = [5, 10, 25, 50, 75, 100]

  return (
    <>
      <Nav active="rebut" />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ minHeight: 'calc(100vh - 56px)', overflowY: 'auto', padding: 'clamp(24px, 5vw, 48px) clamp(16px, 4vw, 24px)' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: '32px' }}>
            <button onClick={() => router.push('/rebut')} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', padding: 0, fontFamily: 'DM Sans, sans-serif' }}>
              ← Back to Lobby
            </button>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(28px, 6vw, 40px)', letterSpacing: '3px', marginBottom: '6px', textShadow: '0 0 30px rgba(230,57,70,0.2)' }}>
              ⚔️ CREATE CHALLENGE
            </div>
            <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6 }}>
              Set your topic, stake your ELO, and let anyone on Rebuttal challenge you. Room is limited to 2 debaters only.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Topic */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>Debate Topic</div>
              <textarea
                value={topic}
                onChange={e => { setTopic(e.target.value); setError('') }}
                placeholder="e.g. Is social media doing more harm than good to society?"
                maxLength={200}
                rows={3}
                style={{ width: '100%', background: 'var(--surface2)', border: `1px solid ${error && topic.trim().length < 10 ? 'var(--red)' : 'var(--border2)'}`, borderRadius: '8px', padding: '12px 14px', color: 'var(--text)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6, transition: 'border-color 0.2s' }}
              />
              <div style={{ fontSize: '11px', color: topic.length < 10 && topic.length > 0 ? 'var(--red)' : 'var(--muted)', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>{topic.length > 0 && topic.length < 10 ? `${10 - topic.length} more characters needed` : ''}</span>
                <span>{topic.length}/200</span>
              </div>
            </div>

            {/* Debate type */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>Debate Type</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {([
                  { value: 'text' as const, icon: '💬', label: 'Text Debate', desc: 'Type your arguments. 1v1 only for custom rooms.' },
                  { value: 'vc' as const, icon: '🎙️', label: 'Voice Debate', desc: '1v1 live voice. Speak your argument. Chrome/Edge only.' },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDebateType(opt.value)}
                    style={{
                      background: debateType === opt.value ? (opt.value === 'vc' ? 'rgba(0,180,216,0.1)' : 'rgba(230,57,70,0.08)') : 'var(--surface2)',
                      border: `1px solid ${debateType === opt.value ? (opt.value === 'vc' ? '#00b4d8' : 'var(--accent)') : 'var(--border)'}`,
                      borderRadius: '10px', padding: '14px', cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.15s', fontFamily: 'DM Sans, sans-serif',
                      boxShadow: debateType === opt.value ? `0 0 12px ${opt.value === 'vc' ? 'rgba(0,180,216,0.15)' : 'rgba(230,57,70,0.15)'}` : 'none',
                    }}
                  >
                    <div style={{ fontSize: '20px', marginBottom: '6px' }}>{opt.icon}</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: debateType === opt.value ? (opt.value === 'vc' ? '#00b4d8' : 'var(--accent)') : 'var(--text)', marginBottom: '3px' }}>{opt.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>Debate Duration</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {durationOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDuration(opt.value)}
                    style={{
                      background: duration === opt.value ? 'rgba(230,57,70,0.1)' : 'var(--surface2)',
                      border: `1px solid ${duration === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: '8px', padding: '8px 16px',
                      color: duration === opt.value ? 'var(--accent)' : 'var(--text2)',
                      fontSize: '13px', fontWeight: duration === opt.value ? 700 : 400,
                      cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ELO stake */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>ELO Stake</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>Winner gains this amount, loser loses it. Min 5, max 100.</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {eloOptions.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setEloStake(opt)}
                    style={{
                      background: eloStake === opt ? 'rgba(255,214,10,0.12)' : 'var(--surface2)',
                      border: `1px solid ${eloStake === opt ? 'rgba(255,214,10,0.5)' : 'var(--border)'}`,
                      borderRadius: '8px', padding: '8px 14px',
                      color: eloStake === opt ? 'var(--gold)' : 'var(--text2)',
                      fontSize: '13px', fontWeight: eloStake === opt ? 700 : 400,
                      cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
                      boxShadow: eloStake === opt ? '0 0 8px rgba(255,214,10,0.15)' : 'none',
                    }}
                  >
                    {opt} ELO
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="number"
                  value={eloStake}
                  min={5}
                  max={100}
                  onChange={e => setEloStake(Math.max(5, Math.min(100, Number(e.target.value))))}
                  style={{ width: '90px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>custom amount</span>
              </div>
            </div>

            {/* Privacy */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>Room Visibility</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: isPrivate ? '14px' : '0' }}>
                {([
                  { value: false, icon: '🌍', label: 'Public', desc: 'Anyone can see and join from the lobby.' },
                  { value: true, icon: '🔒', label: 'Private', desc: 'Topic blurred in lobby. Password required to join.' },
                ] as const).map(opt => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setIsPrivate(opt.value)}
                    style={{
                      background: isPrivate === opt.value ? 'rgba(230,57,70,0.08)' : 'var(--surface2)',
                      border: `1px solid ${isPrivate === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: '10px', padding: '14px', cursor: 'pointer',
                      textAlign: 'left', transition: 'all 0.15s', fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    <div style={{ fontSize: '18px', marginBottom: '5px' }}>{opt.icon}</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: isPrivate === opt.value ? 'var(--accent)' : 'var(--text)', marginBottom: '3px' }}>{opt.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
              {isPrivate && (
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>Room password:</div>
                  <input
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    placeholder="Enter a password..."
                    style={{ width: '100%', background: 'var(--surface2)', border: `1px solid ${error && !password.trim() ? 'var(--red)' : 'var(--border2)'}`, borderRadius: '8px', padding: '11px 14px', color: 'var(--text)', fontSize: '14px', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}
                  />
                </div>
              )}
            </div>

            {/* Summary */}
            <div style={{ background: 'linear-gradient(135deg, rgba(230,57,70,0.06), rgba(255,107,53,0.03))', border: '1px solid rgba(230,57,70,0.2)', borderRadius: '14px', padding: '18px 20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>Room Preview</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Created by</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>@{profile.username}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Type</span>
                  <span style={{ color: 'var(--text)' }}>{debateType === 'vc' ? '🎙️ Voice' : '💬 Text'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Duration</span>
                  <span style={{ color: 'var(--text)' }}>{durationOptions.find(d => d.value === duration)?.label}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>ELO Stake</span>
                  <span style={{ color: 'var(--gold)', fontWeight: 700 }}>±{eloStake} ELO</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Visibility</span>
                  <span style={{ color: 'var(--text)' }}>{isPrivate ? '🔒 Private' : '🌍 Public'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Max players</span>
                  <span style={{ color: 'var(--text)' }}>2 (1v1 only)</span>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: 'var(--red)' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Create button */}
            <button
              onClick={handleCreate}
              disabled={creating || topic.trim().length < 10}
              style={{
                width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                background: creating || topic.trim().length < 10 ? 'var(--surface2)' : 'var(--accent)',
                color: creating || topic.trim().length < 10 ? 'var(--muted)' : '#fff',
                fontSize: '16px', fontWeight: 700,
                cursor: creating || topic.trim().length < 10 ? 'not-allowed' : 'pointer',
                fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s',
                boxShadow: creating || topic.trim().length < 10 ? 'none' : '0 0 24px rgba(230,57,70,0.35)',
              }}
            >
              {creating ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Creating room...
                </span>
              ) : '⚔️ Create Challenge Room'}
            </button>

            <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--muted)', paddingBottom: '24px', lineHeight: 1.6 }}>
              You'll be placed in the room immediately. Your room will appear in the Rebuttal lobby under the Custom tab so opponents can find and join you.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}