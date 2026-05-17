'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Nav from '../../components/Nav'
import { useRouter } from 'next/navigation'

interface Message {
  id: string
  username: string
  text: string
  score: number
  aiFeedback: string
  timestamp: number
  pending?: boolean
}

interface Player {
  username: string
  score: number
  elo: number
}

interface RoomInfo {
  instanceId: string
  topic: string
  emoji: string
  type: string
  duration: number
  status: string
  countdown: number
  startCountdown: number | null
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}

export default function DebatePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const instanceId = params.roomId as string
  const guestParam = searchParams.get('guest')

  const [myUsername, setMyUsername] = useState('')
  const [myElo, setMyElo] = useState(0)
  const [messages, setMessages] = useState<Message[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [input, setInput] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [connected, setConnected] = useState(false)
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null)
  const [status, setStatus] = useState<'waiting' | 'starting' | 'active' | 'ended' | 'expired'>('waiting')
  const [startCountdown, setStartCountdown] = useState<number | null>(null)
  const [lobbyCountdown, setLobbyCountdown] = useState(120)
  const [standings, setStandings] = useState<Player[]>([])
  const [expiredMsg, setExpiredMsg] = useState('')
  const [eloChange, setEloChange] = useState<number | null>(null)
  const [pendingMsgId, setPendingMsgId] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const cooldownRef = useRef<any>(null)
  const timerRef = useRef<any>(null)
  const profileRef = useRef(profile)
  const userRef = useRef(user)
  const myUsernameRef = useRef(myUsername)

  useEffect(() => { profileRef.current = profile }, [profile])
  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { myUsernameRef.current = myUsername }, [myUsername])

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
  const myScore = players.find(p => p.username === myUsername)?.score ?? 0
  const cooldownTime = players.length <= 6 ? 15 : 30

  useEffect(() => {
    if (loading) return
    if (guestParam) { setMyUsername(guestParam); return }
    if (profile?.username) { setMyUsername(profile.username); setMyElo(profile.elo ?? 0); return }
    setMyUsername('guest' + Math.floor(1000 + Math.random() * 9000))
  }, [loading, profile, user, guestParam])

  useEffect(() => {
    if (!myUsername) return
  const socket = io('https://rebuttal-live-production-3388.up.railway.app', { transports: ['websocket', 'polling'] })
socket.on('connect', () => {
  setConnected(true)
  const username = myUsernameRef.current
  if (username) {
    socket.emit('join_room', { instanceId, username, elo: myElo })
    console.log('Joining as:', username)
  } else {
    // Username not ready yet — wait for it
    const interval = setInterval(() => {
      const u = myUsernameRef.current
      if (u) {
        clearInterval(interval)
        socket.emit('join_room', { instanceId, username: u, elo: myElo })
        console.log('Joining as (delayed):', u)
      }
    }, 100)
    // Clear after 3 seconds max
    setTimeout(() => clearInterval(interval), 3000)
  }
})
socket.on('connect', () => {
  setConnected(true)
  const username = myUsernameRef.current
  if (username) {
    socket.emit('join_room', { instanceId, username, elo: myElo })
    console.log('Joining room as:', username)
  }
})

// If already connected when username becomes available, join then
if (socket.connected && myUsernameRef.current) {
  socket.emit('join_room', { instanceId, username: myUsernameRef.current, elo: myElo })
}
    socket.on('disconnect', () => setConnected(false))

    socket.on('message_history', (msgs: Message[]) => {
      setMessages(msgs)
    })

    socket.on('new_message', (msg: Message) => {
      setMessages(prev => {
        // Remove any pending message from this user and replace with real scored one
        const filtered = prev.filter(m => !(m.pending && m.username === msg.username))
        return [...filtered, msg]
      })
      setPendingMsgId(null)
    })

    socket.on('players_update', (p: Player[]) => setPlayers(p))

    socket.on('room_info', (info: RoomInfo) => {
      setRoomInfo(info)
      setStatus(info.status as any)
      setLobbyCountdown(info.countdown)
    })

    socket.on('room_starting', ({ startCountdown: sc }: { startCountdown: number }) => {
      setStatus('starting')
      setStartCountdown(sc)
    })

    socket.on('start_countdown_tick', ({ count }: { count: number }) => {
      setStartCountdown(count)
    })

    socket.on('debate_started', ({ duration }: { duration: number }) => {
      setStatus('active')
      setTimeLeft(duration)
      clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timerRef.current); return 0 }
          return prev - 1
        })
      }, 1000)
    })

    socket.on('debate_ended', async ({
      standings: s,
      eloReward,
      type: debateType
    }: { standings: Player[], eloReward: number, type: string }) => {
      setStatus('ended')
      setStandings(s)

      const currentProfile = profileRef.current
      const currentUser = userRef.current
      if (!currentProfile?.username || !currentUser) return

      const myPlace = s.findIndex(p => p.username === myUsernameRef.current)
      if (myPlace === -1) return

      const totalPlayers = s.length
      let change = 0

      if (totalPlayers <= 6) {
        if (myPlace === 0) change = eloReward
        else change = -Math.round(eloReward * (myPlace / totalPlayers) * 0.5)
      } else {
        if (myPlace === 0) change = eloReward
        else if (myPlace === 1) change = Math.round(eloReward * 0.4)
        else if (myPlace === 2) change = Math.round(eloReward * 0.2)
        else change = -Math.round(eloReward * (myPlace / totalPlayers) * 0.4)
      }

      setEloChange(change)

      const newElo = Math.max(0, (currentProfile.elo ?? 0) + change)
      const newWins = myPlace === 0 ? (currentProfile.wins ?? 0) + 1 : (currentProfile.wins ?? 0)
      const newDebates = (currentProfile.debates ?? 0) + 1

      const { error } = await supabase
        .from('profiles')
        .update({ elo: newElo, wins: newWins, debates: newDebates })
        .eq('id', currentUser.id)

      if (error) console.error('ELO save error:', error)
      else console.log(`ELO: ${currentProfile.elo} → ${newElo} (${change >= 0 ? '+' : ''}${change})`)
    })

    socket.on('room_expired', ({ message }: { message: string }) => {
      setStatus('expired')
      setExpiredMsg(message)
    })

    socket.on('rooms_update', (rooms: any[]) => {
      const myRoom = rooms.find(r => r.instanceId === instanceId)
      if (myRoom) {
        setLobbyCountdown(myRoom.countdown)
        if (myRoom.startCountdown !== null) setStartCountdown(myRoom.startCountdown)
        if (myRoom.status === 'starting') setStatus('starting')
      }
    })

    socket.on('error', ({ message }: { message: string }) => {
      alert(message)
      router.push('/rebut')
    })

    socket.on('system_message', ({ text }: { text: string }) => {
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}-${Math.random()}`,
        username: '— system —',
        text, score: 0, aiFeedback: '',
        timestamp: Date.now()
      }])
    })

    return () => {
      socket.disconnect()
      clearInterval(timerRef.current)
      clearInterval(cooldownRef.current)
    }
  }, [myUsername, instanceId])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  const sendMessage = () => {
    if (!input.trim() || cooldown > 0 || status !== 'active' || !socketRef.current || !connected) return

    const text = input.trim()
    const pendingId = `pending-${Date.now()}`
    setPendingMsgId(pendingId)

    // Show pending message immediately
    setMessages(prev => [...prev, {
      id: pendingId,
      username: myUsername,
      text,
      score: 0,
      aiFeedback: '',
      timestamp: Date.now(),
      pending: true,
    }])

    // Server scores it with AI
    socketRef.current.emit('send_message', { instanceId, username: myUsername, text })

    setInput('')
    setCooldown(cooldownTime)
    clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const pct = roomInfo ? (timeLeft / roomInfo.duration) * 100 : 0

  // ── EXPIRED ──────────────────────────────────────────────────
  if (status === 'expired') {
    return (
      <>
        <Nav active="rebut" />
        <div style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>💨</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '32px', letterSpacing: '2px', marginBottom: '8px' }}>ROOM EXPIRED</div>
            <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '28px', lineHeight: 1.6 }}>
              {expiredMsg || 'Not enough players joined in time.'}
            </div>
            <button onClick={() => router.push('/rebut')} style={{ background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '12px 28px', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              Back to Lobby
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── ENDED ─────────────────────────────────────────────────────
  if (status === 'ended') {
    const final = standings.length > 0 ? standings : sortedPlayers
    const myPlace = final.findIndex(p => p.username === myUsername)
    return (
      <>
        <Nav active="rebut" />
        <div style={{ minHeight: 'calc(100vh - 56px)', overflowY: 'auto', padding: '32px 24px' }}>
          <div style={{ maxWidth: '520px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>🏁</div>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '40px', letterSpacing: '3px', marginBottom: '4px' }}>DEBATE OVER</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{roomInfo?.topic}</div>
            </div>

            {eloChange !== null && (
              <div style={{ background: eloChange >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${eloChange >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '12px', padding: '14px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
                  Your placement: <b style={{ color: 'var(--text)' }}>#{myPlace + 1} of {final.length}</b>
                </div>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '1px', color: eloChange >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {eloChange >= 0 ? '+' : ''}{eloChange} ELO
                </div>
              </div>
            )}

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)' }}>
                Final Standings
              </div>
              {final.map((p, i) => (
                <div key={p.username} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', borderBottom: i < final.length - 1 ? '1px solid var(--border)' : 'none', background: p.username === myUsername ? 'rgba(230,57,70,0.04)' : 'transparent' }}>
                  <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '20px', width: '28px', color: i === 0 ? 'var(--gold)' : i === 1 ? 'var(--silver)' : i === 2 ? 'var(--bronze)' : 'var(--muted)' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </div>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: `hsl(${i * 60 + 10}, 65%, 55%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff' }}>
                    {p.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, fontSize: '14px', fontWeight: p.username === myUsername ? 600 : 400 }}>
                    {p.username}
                    {p.username === myUsername && <span style={{ fontSize: '11px', color: 'var(--accent)', marginLeft: '6px' }}>(you)</span>}
                  </div>
                  <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '18px', color: 'var(--accent2)', letterSpacing: '1px' }}>
                    {p.score} pts
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => router.push('/rebut')} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              ← Back to Lobby
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── WAITING / STARTING ────────────────────────────────────────
  if (status === 'waiting' || status === 'starting') {
    return (
      <>
        <Nav active="rebut" />
        <div style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ textAlign: 'center', maxWidth: '480px', width: '100%' }}>
            <div style={{ fontSize: '52px', marginBottom: '16px' }}>{roomInfo?.emoji ?? '💬'}</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '30px', letterSpacing: '2px', marginBottom: '8px' }}>
              {status === 'starting' ? 'DEBATE STARTING!' : 'WAITING FOR PLAYERS'}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '28px', lineHeight: 1.6 }}>
              {roomInfo?.topic}
            </div>

            {status === 'starting' ? (
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '96px', color: 'var(--accent)', lineHeight: 1, marginBottom: '24px', animation: 'pulse 0.6s infinite' }}>
                {startCountdown}
              </div>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '52px', color: lobbyCountdown <= 30 ? 'var(--accent)' : 'var(--text)', marginBottom: '6px', letterSpacing: '2px' }}>
                  {fmt(lobbyCountdown)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '24px' }}>
                  {players.length < 3
                    ? `Need ${3 - players.length} more player${3 - players.length !== 1 ? 's' : ''} to start`
                    : '✓ Ready to start when timer ends'}
                </div>
              </>
            )}

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
                Players in Lobby ({players.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {players.map((p, i) => (
                  <div key={p.username} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface2)', border: `1px solid ${p.username === myUsername ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', padding: '6px 12px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: `hsl(${i * 60}, 65%, 55%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#fff' }}>
                      {p.username.slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ fontSize: '13px', color: p.username === myUsername ? 'var(--text)' : 'var(--text2)' }}>
                      {p.username}
                      {p.username === myUsername && <span style={{ fontSize: '10px', color: 'var(--accent)', marginLeft: '4px' }}>(you)</span>}
                    </span>
                  </div>
                ))}
                {players.length === 0 && (
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Waiting for others to join...</div>
                )}
              </div>
            </div>

            <button onClick={() => router.push('/rebut')} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 20px', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              Leave Room
            </button>
          </div>
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
      </>
    )
  }

  // ── ACTIVE DEBATE ─────────────────────────────────────────────
  return (
    <>
      <Nav active="rebut" />
      <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '18px' }}>{roomInfo?.emoji}</span>
            <div style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{roomInfo?.topic}</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '26px', letterSpacing: '1px', color: timeLeft < 30 ? 'var(--red)' : timeLeft < 60 ? 'var(--accent2)' : 'var(--accent)', flexShrink: 0 }}>
              {fmt(timeLeft)}
            </div>
          </div>
          <div style={{ height: '3px', background: 'var(--surface2)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius: '2px', transition: 'width 1s linear' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--red)' }} />
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              {connected ? `${players.length} debater${players.length !== 1 ? 's' : ''} live` : 'Reconnecting...'}
            </span>
          </div>
        </div>

        {/* Score bar */}
        <div style={{ display: 'flex', gap: '8px', padding: '8px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
          {sortedPlayers.map((p, i) => (
            <div key={p.username} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface2)', border: `1px solid ${p.username === myUsername ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', padding: '5px 10px', flexShrink: 0 }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: `hsl(${i * 60 + 10}, 65%, 55%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, color: '#fff' }}>
                {p.username.slice(0, 2).toUpperCase()}
              </div>
              <span style={{ fontSize: '11px', color: p.username === myUsername ? 'var(--text)' : 'var(--muted)' }}>
                {p.username === myUsername ? 'You' : p.username}
              </span>
              <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '13px', color: p.username === myUsername ? 'var(--gold)' : 'var(--text2)', letterSpacing: '0.5px' }}>
                {p.score > 0 ? '+' : ''}{p.score}
              </span>
            </div>
          ))}
        </div>

        {/* Chat */}
        <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', marginTop: '40px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚡</div>
              Debate started! Make your first argument.
            </div>
          )}

          {messages.map(msg => {
            const isSystem = msg.username === '— system —'
            const isMe = msg.username === myUsername
            const isPending = msg.pending === true

            if (isSystem) return (
              <div key={msg.id} style={{ textAlign: 'center', fontSize: '11px', color: 'var(--muted)', padding: '2px 0' }}>
                — {msg.text} —
              </div>
            )

            return (
              <div key={msg.id} style={{ display: 'flex', gap: '10px', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start', opacity: isPending ? 0.75 : 1, transition: 'opacity 0.3s' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: isMe ? 'linear-gradient(135deg,var(--accent),#ff8c69)' : 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: isMe ? '#fff' : 'var(--text2)', flexShrink: 0 }}>
                  {msg.username.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ maxWidth: '72%' }}>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '3px', textAlign: isMe ? 'right' : 'left' }}>
                    {msg.username}
                  </div>
                  <div style={{ background: isMe ? 'rgba(230,57,70,0.1)' : 'var(--surface)', border: `1px solid ${isMe ? 'rgba(230,57,70,0.25)' : 'var(--border)'}`, borderRadius: '10px', padding: '10px 14px', fontSize: '13px', lineHeight: 1.6, color: 'var(--text)' }}>
                    {msg.text}
                  </div>

                  {/* Score / pending indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    {isPending ? (
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', border: '1.5px solid var(--muted)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
                        AI scoring...
                      </span>
                    ) : (
                      <>
                        <span style={{
                          fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                          background: msg.score > 15 ? 'rgba(34,197,94,0.15)' : msg.score > 8 ? 'rgba(34,197,94,0.08)' : msg.score > 0 ? 'rgba(100,100,100,0.1)' : 'rgba(239,68,68,0.1)',
                          color: msg.score > 15 ? 'var(--green)' : msg.score > 8 ? '#7dd3a8' : msg.score > 0 ? 'var(--muted)' : 'var(--red)',
                          border: msg.score >= 25 ? '1px solid rgba(34,197,94,0.3)' : 'none',
                        }}>
                          {msg.score > 0 ? '+' : ''}{msg.score} pts
                          {msg.score >= 25 && ' 🔥'}
                          {msg.score >= 28 && ' 🏆'}
                        </span>
                        {msg.aiFeedback && (
                          <span style={{ fontSize: '11px', color: 'var(--blue)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            🤖 {msg.aiFeedback}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Input */}
        <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '12px 20px', flexShrink: 0 }}>
          {cooldown > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 500 }}>Cooldown — {cooldown}s</span>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Your score: {myScore > 0 ? '+' : ''}{myScore}</span>
              </div>
              <div style={{ height: '3px', background: 'var(--surface2)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(cooldown / cooldownTime) * 100}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 1s linear' }} />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              disabled={cooldown > 0 || !connected}
              placeholder={
                !connected ? 'Reconnecting...' :
                cooldown > 0 ? `Cooldown — ${cooldown}s` :
                'Make your argument. Be precise, use evidence, stay civil.'
              }
              style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text)', fontSize: '13px', outline: 'none', opacity: cooldown > 0 ? 0.5 : 1, fontFamily: 'DM Sans, sans-serif', transition: 'opacity 0.2s' }}
            />
            <button
              onClick={sendMessage}
              disabled={cooldown > 0 || !input.trim() || !connected}
              style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '10px 18px', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: cooldown > 0 ? 'not-allowed' : 'pointer', opacity: cooldown > 0 || !input.trim() ? 0.4 : 1, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap', transition: 'opacity 0.2s' }}
            >
              Rebut ⚡
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}