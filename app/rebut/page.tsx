'use client'
import Nav from '../components/Nav'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'

interface RoomData {
  instanceId: string
  templateId: string
  emoji: string
  topic: string
  type: string
  duration: string
  maxPlayers: number
  eloRequired: number
  playerCount: number
  players: string[]
  status: string
  countdown: number
  startCountdown: number | null
}

const typeColor = (type: string) => {
  if (type === 'competitive') return 'linear-gradient(90deg,var(--gold),var(--accent2))'
  if (type === 'philosophy') return 'linear-gradient(90deg,var(--purple),var(--accent))'
  if (type === 'serious') return 'linear-gradient(90deg,var(--accent),var(--accent2))'
  return 'linear-gradient(90deg,var(--green),var(--blue))'
}

const typeBadge = (type: string) => {
  if (type === 'competitive') return { bg: 'rgba(255,214,10,.15)', color: 'var(--gold)', label: '★ Competitive' }
  if (type === 'philosophy') return { bg: 'rgba(155,89,182,.15)', color: '#c39bd3', label: '🧠 Philosophy' }
  if (type === 'serious') return { bg: 'rgba(230,57,70,.15)', color: 'var(--accent)', label: '⚖️ Serious' }
  return { bg: 'rgba(46,204,113,.15)', color: 'var(--green)', label: '😄 Casual' }
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}

const filters = ['All', 'Casual', 'Serious', 'Philosophy', 'Competitive']

export default function RebutPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const [rooms, setRooms] = useState<RoomData[]>([])
  const [activeFilter, setActiveFilter] = useState('All')
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null)
  const [guestName] = useState('guest' + Math.floor(1000 + Math.random() * 9000))
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const s = io('http://localhost:3001', { transports: ['websocket', 'polling'] })
    s.on('connect', () => { setConnected(true); console.log('Connected to lobby') })
    s.on('disconnect', () => setConnected(false))
    s.on('rooms_update', (data: RoomData[]) => setRooms(data))
    setSocket(s)
    return () => { s.disconnect() }
  }, [])

  const handleRoomClick = (room: RoomData) => {
    if (room.status === 'active') return // can't join active debate
    const myElo = profile?.elo ?? 0
    if (myElo < room.eloRequired) {
      alert(`You need ${room.eloRequired}+ ELO to join this room. You have ${myElo}.`)
      return
    }
    if (user) {
      joinRoom(room)
    } else {
      setSelectedRoom(room)
    }
  }

  const joinRoom = (room: RoomData) => {
    router.push(`/debate/${room.instanceId}`)
  }

  const handleGuest = () => {
    if (selectedRoom) {
      router.push(`/debate/${selectedRoom.instanceId}?guest=${guestName}`)
      setSelectedRoom(null)
    }
  }

  const handleSignUp = () => {
    setSelectedRoom(null)
    router.push('/signup')
  }

  const filtered = rooms.filter(r => {
    if (activeFilter === 'All') return true
    return r.type.toLowerCase() === activeFilter.toLowerCase()
  })

  return (
    <>
      <Nav active="rebut" />

      {/* Auth modal */}
      {selectedRoom && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(6px)' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: '20px', padding: '36px', maxWidth: '380px', width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>{selectedRoom.emoji}</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '2px', marginBottom: '8px' }}>JOIN THE DEBATE</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.6 }}>{selectedRoom.topic}</div>
            <div style={{ background: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.15)', borderRadius: '10px', padding: '12px', marginBottom: '20px', fontSize: '12px', color: 'var(--text2)', lineHeight: 1.7 }}>
              ⚡ Sign up to <b style={{ color: 'var(--text)' }}>earn ELO</b> and appear on the global leaderboard. Guests can debate but won't gain ELO.
            </div>
            <button onClick={handleSignUp} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: '10px' }}>
              🏆 Sign Up & Earn ELO
            </button>
            <button onClick={handleGuest} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: '12px' }}>
              Skip — join as <b style={{ color: 'var(--text2)' }}>{guestName}</b>
            </button>
            <button onClick={() => setSelectedRoom(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '32px', letterSpacing: '2px' }}>CHOOSE YOUR BATTLE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '4px 12px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--red)', animation: connected ? 'pulse 2s infinite' : 'none' }} />
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{connected ? `${rooms.length} rooms live` : 'Connecting...'}</span>
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Rooms need <b style={{ color: 'var(--text2)' }}>3+ players</b> to start. Rooms with fewer expire after 2 minutes.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', padding: '12px 24px', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
          {filters.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)} style={{ background: activeFilter === f ? 'rgba(230,57,70,.12)' : 'var(--surface2)', border: `1px solid ${activeFilter === f ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '20px', padding: '5px 14px', fontSize: '12px', color: activeFilter === f ? 'var(--accent)' : 'var(--muted)', whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>{f}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          {!connected && (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)', fontSize: '14px' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔌</div>
              Connecting to debate servers...
            </div>
          )}

          {connected && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)', fontSize: '14px' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🕳️</div>
              No rooms available right now. Check back soon!
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', paddingTop: '4px' }}>
            {filtered.map(room => {
              const pct = Math.round((room.playerCount / room.maxPlayers) * 100)
              const almostFull = room.playerCount >= room.maxPlayers - 2
              const urgent = room.countdown <= 30 && room.status === 'waiting'
              const badge = typeBadge(room.type)
              const isActive = room.status === 'active'
              const isStarting = room.status === 'starting'
              const myElo = profile?.elo ?? 0
              const locked = myElo < room.eloRequired

              return (
                <div
                  key={room.instanceId}
                  onClick={() => !isActive && !locked && handleRoomClick(room)}
                  style={{ background: isStarting ? 'rgba(230,57,70,0.06)' : 'var(--surface)', border: `1px solid ${isStarting ? 'var(--accent)' : urgent ? 'rgba(244,162,97,.4)' : locked ? 'rgba(255,214,10,.2)' : 'var(--border)'}`, borderRadius: '14px', padding: '14px', cursor: isActive || locked ? 'not-allowed' : 'pointer', position: 'relative', overflow: 'hidden', aspectRatio: '1/1', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'border-color .2s, transform .15s', opacity: isActive ? 0.6 : 1 }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: typeColor(room.type) }} />

                  {/* Starting overlay */}
                  {isStarting && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '4px' }}>Starting in</div>
                      <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '52px', color: '#fff', lineHeight: 1 }}>{room.startCountdown}</div>
                    </div>
                  )}

                  {/* Locked overlay */}
                  {locked && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '14px' }}>
                      <div style={{ fontSize: '24px', marginBottom: '4px' }}>🔒</div>
                      <div style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 700 }}>{room.eloRequired}+ ELO</div>
                    </div>
                  )}

                  {/* Active overlay */}
                  {isActive && (
                    <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(230,57,70,.15)', border: '1px solid var(--accent)', borderRadius: '20px', padding: '2px 8px', fontSize: '10px', color: 'var(--accent)', fontWeight: 700, zIndex: 5 }}>LIVE</div>
                  )}

                  <div>
                    <div style={{ fontSize: '22px', marginBottom: '5px' }}>{room.emoji}</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.4, color: 'var(--text)', marginBottom: '7px' }}>{room.topic}</div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '5px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', background: badge.bg, color: badge.color }}>{badge.label}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
                      {Math.floor(Number(room.duration) / 60)} min debate · {room.playerCount <= 6 ? '15s' : '30s'} cooldown
                    </div>
                  </div>

                  <div>
                    <div style={{ marginBottom: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10px', color: almostFull ? 'var(--accent)' : 'var(--muted)' }}>
                          {room.playerCount}/{room.maxPlayers}
                          {almostFull && !isStarting && <span style={{ marginLeft: '4px' }}>🔥</span>}
                        </span>
                        <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '13px', letterSpacing: '1px', color: isStarting ? 'var(--accent)' : urgent ? 'var(--accent)' : room.countdown <= 60 ? 'var(--accent2)' : 'var(--green)' }}>
                          {isStarting ? `▶ ${room.startCountdown}s` : isActive ? '●' : fmt(room.countdown)}
                        </span>
                      </div>
                      <div style={{ height: '3px', background: 'var(--surface2)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: almostFull ? 'linear-gradient(90deg,var(--accent),var(--accent2))' : 'linear-gradient(90deg,var(--green),var(--blue))', borderRadius: '2px', transition: 'width .5s' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ display: 'flex' }}>
                        {Array.from({ length: Math.min(room.playerCount, 5) }).map((_, i) => (
                          <div key={i} style={{ width: '16px', height: '16px', borderRadius: '50%', border: '1px solid var(--surface)', background: `hsl(${i * 47 + (room.instanceId.length * 7)}, 65%, 55%)`, marginLeft: i === 0 ? 0 : '-3px' }} />
                        ))}
                        {room.playerCount > 5 && <div style={{ fontSize: '9px', color: 'var(--muted)', marginLeft: '4px', lineHeight: '16px' }}>+{room.playerCount - 5}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </>
  )
}