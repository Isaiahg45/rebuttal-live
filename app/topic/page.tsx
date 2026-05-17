'use client'
import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'

function fmt(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}

export default function TopicPage() {
  const { user, profile } = useAuth()
  const [topic, setTopic] = useState('')
  const [emoji, setEmoji] = useState('🔥')
  const [timeLeft, setTimeLeft] = useState(0)
  const [messages, setMessages] = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const cooldownRef = useRef<any>(null)
  const usernameRef = useRef<string>(
    profile?.username || ('guest' + Math.floor(1000 + Math.random() * 9000))
  )
  const username = usernameRef.current

  useEffect(() => {
    const s = io('https://rebuttal-live-production-3388.up.railway.app', {
      transports: ['websocket', 'polling']
    })
    socketRef.current = s

    s.on('connect', () => {
      setConnected(true)
      s.emit('join_topic_of_day', { username })
    })
    s.on('disconnect', () => setConnected(false))

    s.on('message_history', (msgs: any[]) => setMessages(msgs))
    s.on('new_message', (msg: any) => setMessages(prev => [...prev, msg]))
    s.on('players_update', (p: any[]) => setPlayers(p))
    s.on('system_message', ({ text }: any) => {
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        username: '— system —',
        text, score: 0, aiFeedback: '', timestamp: Date.now(),
      }])
    })
    s.on('room_info', (info: any) => {
      if (info.topic) setTopic(info.topic)
      if (info.emoji) setEmoji(info.emoji)
      if (info.timeLeft) setTimeLeft(info.timeLeft)
    })
    s.on('totd_info', ({ topic, emoji, timeLeft }: any) => {
      setTopic(topic)
      setEmoji(emoji)
      setTimeLeft(timeLeft)
    })
    s.on('topic_reset', (room: any) => {
      setTopic(room.topic)
      setEmoji(room.emoji)
      setTimeLeft(Math.round((room.debateEndsAt - Date.now()) / 1000))
      setMessages([])
      setPlayers([])
    })

    return () => { s.disconnect() }
  }, [])

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(t => Math.max(0, t - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Cooldown
  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setTimeout(() => setCooldown(c => Math.max(0, c - 1)), 1000)
    }
    return () => clearTimeout(cooldownRef.current)
  }, [cooldown])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    if (!input.trim() || cooldown > 0 || !connected) return
    socketRef.current?.emit('send_message', {
      instanceId: 'topic_of_the_day',
      username,
      text: input.trim(),
    })
    setInput('')
    setCooldown(15)
  }

  const sorted = [...players].sort((a, b) => b.score - a.score)

  return (
    <>
      <Nav active="topic" />
      <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', maxWidth: '1200px', margin: '0 auto', padding: '0 16px' }}>

        {/* Header */}
        <div style={{ padding: '16px 0 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{
              fontFamily: 'var(--font-bebas)', fontSize: '28px', letterSpacing: '3px',
              color: 'var(--accent)',
              animation: 'glow 2s ease-in-out infinite alternate'
            }}>
              🔥 TOPIC OF THE DAY
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', color: timeLeft < 3600 ? 'var(--accent)' : 'var(--green)', letterSpacing: '2px' }}>
                {fmt(timeLeft)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '3px 10px' }}>
                {players.length}/40 debating
              </div>
            </div>
          </div>
          {topic ? (
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>
              {emoji} {topic}
            </div>
          ) : (
            <div style={{ fontSize: '14px', color: 'var(--muted)' }}>Connecting...</div>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', gap: '16px', overflow: 'hidden', paddingTop: '12px', paddingBottom: '12px' }}>

          {/* Chat */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '8px' }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '40px 0' }}>
                  No arguments yet — be the first to weigh in!
                </div>
              )}
              {messages.map(msg => {
                const isSystem = msg.username === '— system —'
                if (isSystem) return (
                  <div key={msg.id} style={{
                    textAlign: 'center', fontSize: '11px',
                    color: msg.text.includes('NO COPY') ? 'var(--red)' : 'var(--muted)',
                    fontWeight: msg.text.includes('NO COPY') ? 700 : 400,
                    padding: '2px 0'
                  }}>
                    — {msg.text} —
                  </div>
                )
                const isMe = msg.username === username
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: isMe ? 'var(--accent)' : 'var(--text2)' }}>
                        {msg.username}
                      </span>
                      {msg.score !== undefined && msg.score !== 0 && (
                        <span style={{ fontSize: '10px', color: msg.score > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                          +{msg.score} pts
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5, background: isMe ? 'rgba(230,57,70,0.06)' : 'var(--surface)', border: `1px solid ${isMe ? 'rgba(230,57,70,0.2)' : 'var(--border)'}`, borderRadius: '10px', padding: '8px 12px' }}>
                      {msg.text}
                    </div>
                    {msg.aiFeedback && (
                      <div style={{ fontSize: '11px', color: 'var(--muted)', paddingLeft: '4px' }}>
                        💬 {msg.aiFeedback}
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                onPaste={e => {
                  e.preventDefault()
                  setMessages(prev => [...prev, {
                    id: `paste-${Date.now()}`,
                    username: '— system —',
                    text: '🚫 NO COPY AND PASTING!',
                    score: 0, aiFeedback: '', timestamp: Date.now(),
                  }])
                }}
                disabled={cooldown > 0 || !connected}
                placeholder={!connected ? 'Connecting...' : cooldown > 0 ? `Cooldown — ${cooldown}s` : 'Make your argument...'}
                style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text)', fontSize: '13px', outline: 'none', opacity: cooldown > 0 ? 0.5 : 1, fontFamily: 'DM Sans, sans-serif' }}
              />
              <button
                onClick={sendMessage}
                disabled={cooldown > 0 || !input.trim() || !connected}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '10px 18px', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: cooldown > 0 ? 'not-allowed' : 'pointer', opacity: cooldown > 0 || !input.trim() ? 0.4 : 1, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}
              >
                Rebut ⚡
              </button>
            </div>
          </div>

          {/* Leaderboard */}
          <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)' }}>
              🏆 Leaderboard
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {sorted.slice(0, 20).map((p, i) => (
                <div key={p.username} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: p.username === username ? 'rgba(230,57,70,0.08)' : 'var(--surface)', border: `1px solid ${p.username === username ? 'rgba(230,57,70,0.3)' : 'var(--border)'}`, borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '16px', color: i === 0 ? 'var(--gold)' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--muted)', width: '20px' }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.username}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 700 }}>
                    {p.score}
                  </div>
                </div>
              ))}
              {players.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>
                  No one yet — be first!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes glow {
          from { text-shadow: 0 0 10px rgba(230,57,70,0.4), 0 0 20px rgba(230,57,70,0.2); }
          to { text-shadow: 0 0 20px rgba(230,57,70,0.8), 0 0 40px rgba(230,57,70,0.4), 0 0 60px rgba(230,57,70,0.2); }
        }
      `}</style>
    </>
  )
}