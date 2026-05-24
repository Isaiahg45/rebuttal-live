'use client'
import Nav from '../components/Nav'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'
import { io } from 'socket.io-client'

interface RoomData {
  instanceId: string
  emoji: string
  topic: string
  type: string
  duration: number
  maxPlayers: number
  eloRequired: number
  playerCount: number
  spectatorCount: number
  players: string[]
  status: string
  countdown: number
  startCountdown: number | null
  timeLeft: number | null
  vcState?: {
    currentSpeakerUsername: string | null
    turnNumber: number
    inCooldown: boolean
  } | null
}

const typeColor = (type: string) => {
  if (type === 'competitive') return 'linear-gradient(90deg,var(--gold),var(--accent2))'
  if (type === 'serious') return 'linear-gradient(90deg,var(--accent),var(--accent2))'
  if (type === 'random') return 'linear-gradient(90deg,#9b59b6,var(--blue))'
  if (type === 'vc') return 'linear-gradient(90deg,#00b4d8,#0077b6)'
  return 'linear-gradient(90deg,var(--green),var(--blue))'
}

const typeBadge = (type: string) => {
  if (type === 'competitive') return { bg: 'rgba(255,214,10,.15)', color: 'var(--gold)', label: '★ Competitive' }
  if (type === 'serious') return { bg: 'rgba(230,57,70,.15)', color: 'var(--accent)', label: '⚖️ Serious' }
  if (type === 'random') return { bg: 'rgba(155,89,182,.15)', color: '#c39bd3', label: '🎲 Random' }
  if (type === 'vc') return { bg: 'rgba(0,180,216,.15)', color: '#00b4d8', label: '🎙️ Voice' }
  return { bg: 'rgba(46,204,113,.15)', color: 'var(--green)', label: '😄 Casual' }
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}

const filters = ['All', 'Casual', 'Serious', 'Competitive', 'Random', 'Voice']

export default function RebutPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const [rooms, setRooms] = useState<RoomData[]>([])
  const [activeFilter, setActiveFilter] = useState('All')
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null)
  const [spectateRoom, setSpectateRoom] = useState<RoomData | null>(null)
  const guestName = useRef('guest' + Math.floor(1000 + Math.random() * 9000)).current
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const s = io('https://rebuttal-live-production-3388.up.railway.app', { transports: ['websocket', 'polling'] })
    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    s.on('rooms_update', (data: RoomData[]) => setRooms(data))
    return () => { s.disconnect() }
  }, [])

  const ongoingRooms = rooms.filter(r => r.status === 'active' || r.status === 'starting')
  const availableRooms = rooms.filter(r => r.status === 'waiting')

  const matchesFilter = (r: RoomData) => {
    if (activeFilter === 'All') return true
    if (activeFilter === 'Voice') return r.type === 'vc'
    return r.type.toLowerCase() === activeFilter.toLowerCase()
  }

  const filteredAvailable = availableRooms.filter(matchesFilter)
  const filteredOngoing = ongoingRooms.filter(matchesFilter)

  const handleJoinClick = (room: RoomData) => {
    if (loading) return
    const myElo = profile?.elo ?? 0
    if (myElo < room.eloRequired) {
      alert(`You need ${room.eloRequired}+ ELO to join this room. You have ${myElo}.`)
      return
    }
    if (user) {
      if (room.type === 'vc') {
        router.push(`/vc-debate/${room.instanceId}`)
      } else {
        router.push(`/debate/${room.instanceId}`)
      }
    } else {
      setSelectedRoom(room)
    }
  }

  const handleSpectateClick = (room: RoomData) => {
    if (loading) return
    if (room.type === 'vc') return
    if (user) {
      router.push(`/debate/${room.instanceId}?spectate=true`)
    } else {
      setSpectateRoom(room)
    }
  }

  const handleGuestJoin = () => {
    if (!selectedRoom) return
    if (selectedRoom.type === 'vc') {
      router.push(`/vc-debate/${selectedRoom.instanceId}?guest=${guestName}`)
    } else {
      router.push(`/debate/${selectedRoom.instanceId}?guest=${guestName}`)
    }
    setSelectedRoom(null)
  }

  const handleGuestSpectate = () => {
    if (spectateRoom) {
      router.push(`/debate/${spectateRoom.instanceId}?spectate=true&guest=${guestName}`)
      setSpectateRoom(null)
    }
  }

  return (
    <>
      <style>{`
        .rebut-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          padding: 12px 24px 20px;
        }
        .rebut-card {
          border-radius: 14px;
          padding: 14px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          aspect-ratio: 1/1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: border-color .2s, transform .15s;
        }
        .rebut-section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 24px 10px;
          border-bottom: 1px solid var(--border);
        }
        @media (max-width: 900px) {
          .rebut-grid { grid-template-columns: repeat(3, 1fr); padding: 10px 16px 16px; }
        }
        @media (max-width: 600px) {
          .rebut-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 8px 12px 12px; }
          .rebut-card { padding: 10px; }
          .rebut-section-header { padding: 10px 12px 8px; }
          .rebut-header { padding: 12px 12px 10px !important; }
          .rebut-filters { padding-top: 6px !important; }
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      <Nav active="rebut" />

      {/* Join modal */}
      {!loading && selectedRoom && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(6px)', padding: '16px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: '20px', padding: '28px 24px', maxWidth: '380px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>{selectedRoom.emoji}</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', marginBottom: '8px' }}>
              {selectedRoom.type === 'vc' ? 'JOIN VOICE DEBATE' : 'JOIN THE DEBATE'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.6 }}>{selectedRoom.topic}</div>
            {selectedRoom.type === 'vc' && (
              <div style={{ background: 'rgba(0,180,216,0.06)', border: '1px solid rgba(0,180,216,0.2)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', fontSize: '12px', color: '#00b4d8', lineHeight: 1.7 }}>
                🎙️ Voice debate — microphone required. Chrome/Edge only.
              </div>
            )}
            <div style={{ background: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.15)', borderRadius: '10px', padding: '12px', marginBottom: '20px', fontSize: '12px', color: 'var(--text2)', lineHeight: 1.7 }}>
              ⚡ Sign up to <b style={{ color: 'var(--text)' }}>earn ELO</b> and climb the leaderboard.
            </div>
            <button onClick={() => { setSelectedRoom(null); router.push('/signup') }} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: '10px' }}>
              🏆 Sign Up & Earn ELO
            </button>
            <button onClick={handleGuestJoin} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: '12px' }}>
              Skip — join as <b style={{ color: 'var(--text2)' }}>{guestName}</b>
            </button>
            <button onClick={() => setSelectedRoom(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Spectate modal */}
      {!loading && spectateRoom && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(6px)', padding: '16px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: '20px', padding: '28px 24px', maxWidth: '380px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>{spectateRoom.emoji}</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', marginBottom: '8px' }}>WATCH THIS DEBATE</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.6 }}>{spectateRoom.topic}</div>
            <button onClick={() => { setSpectateRoom(null); router.push('/signup') }} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: '10px' }}>
              Sign Up to Track ELO
            </button>
            <button onClick={handleGuestSpectate} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: '12px' }}>
              👁 Spectate as guest
            </button>
            <button onClick={() => setSpectateRoom(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="rebut-header" style={{ padding: '16px 24px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '2px' }}>CHOOSE YOUR BATTLE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '4px 10px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--red)', animation: connected ? 'pulse 2s infinite' : 'none', flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{connected ? `${rooms.length} live` : 'Connecting...'}</span>
            </div>
          </div>

          <div className="rebut-filters" style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', paddingTop: '8px' }}>
            {filters.map(f => (
              <button key={f} onClick={() => setActiveFilter(f)} style={{
                background: activeFilter === f ? (f === 'Voice' ? 'rgba(0,180,216,.12)' : 'rgba(230,57,70,.12)') : 'var(--surface2)',
                border: `1px solid ${activeFilter === f ? (f === 'Voice' ? '#00b4d8' : 'var(--accent)') : 'var(--border)'}`,
                borderRadius: '20px', padding: '4px 12px', fontSize: '12px',
                color: activeFilter === f ? (f === 'Voice' ? '#00b4d8' : 'var(--accent)') : 'var(--muted)',
                whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', flexShrink: 0,
              }}>
                {f === 'Voice' ? '🎙️' : f}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!connected && (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)', fontSize: '14px' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔌</div>
              Connecting to debate servers...
            </div>
          )}

          {/* LIVE NOW */}
          {connected && filteredOngoing.length > 0 && (
            <div>
              <div className="rebut-section-header">
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s infinite', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent)' }}>
                  Live ({filteredOngoing.length})
                </span>
              </div>
              <div className="rebut-grid">
                {filteredOngoing.map(room => {
                  const badge = typeBadge(room.type)
                  const isStarting = room.status === 'starting'
                  const isVC = room.type === 'vc'
                  return (
                    <div
                      key={room.instanceId}
                      className="rebut-card"
                      onClick={() => !isVC && handleSpectateClick(room)}
                      style={{
                        background: isVC ? 'rgba(0,180,216,0.04)' : 'rgba(230,57,70,0.03)',
                        border: `1px solid ${isVC ? 'rgba(0,180,216,0.25)' : 'rgba(230,57,70,0.2)'}`,
                        cursor: isVC ? 'default' : 'pointer',
                      }}
                    >
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: typeColor(room.type) }} />
                      <div style={{ position: 'absolute', top: '8px', right: '8px', background: isVC ? 'rgba(0,180,216,.15)' : 'rgba(230,57,70,.15)', border: `1px solid ${isVC ? '#00b4d8' : 'var(--accent)'}`, borderRadius: '20px', padding: '2px 6px', fontSize: '9px', color: isVC ? '#00b4d8' : 'var(--accent)', fontWeight: 700 }}>
                        {isStarting ? 'START' : 'LIVE'}
                      </div>
                      <div>
                        <div style={{ fontSize: '20px', marginBottom: '4px' }}>{room.emoji}</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: 1.4, color: 'var(--text)', marginBottom: '6px' }}>{room.topic}</div>
                        <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', padding: '2px 5px', borderRadius: '4px', background: badge.bg, color: badge.color }}>{badge.label}</span>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{room.playerCount} debating</span>
                          <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '12px', color: isVC ? '#00b4d8' : 'var(--accent)' }}>
                            {room.timeLeft != null ? fmt(room.timeLeft) : '—'}
                          </span>
                        </div>
                        {!isVC && (
                          <div style={{ background: 'rgba(230,57,70,0.15)', border: '1px solid rgba(230,57,70,0.3)', borderRadius: '6px', padding: '5px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--accent)' }}>
                            👁 Watch
                          </div>
                        )}
                        {isVC && (
                          <div style={{ background: 'rgba(0,180,216,0.08)', border: '1px solid rgba(0,180,216,0.15)', borderRadius: '6px', padding: '5px', textAlign: 'center', fontSize: '10px', color: 'var(--muted)' }}>
                            🎙️ In progress
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* AVAILABLE */}
          {connected && (
            <div>
              <div className="rebut-section-header">
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  Join ({filteredAvailable.length})
                </span>
                <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '4px' }}>
                  {activeFilter === 'Voice' ? '— 1v1 voice' : '— needs 2+ players'}
                </span>
              </div>

              {filteredAvailable.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '14px' }}>
                  <div style={{ fontSize: '28px', marginBottom: '10px' }}>⏳</div>
                  Rooms spawning soon...
                </div>
              ) : (
                <div className="rebut-grid">
                  {filteredAvailable.map(room => {
                    const pct = Math.round((room.playerCount / room.maxPlayers) * 100)
                    const almostFull = room.playerCount >= room.maxPlayers - 2
                    const urgent = room.countdown <= 30
                    const badge = typeBadge(room.type)
                    const isStarting = room.status === 'starting'
                    const isVC = room.type === 'vc'
                    const locked = !loading && !user && room.eloRequired > 0

                    return (
                      <div
                        key={room.instanceId}
                        className="rebut-card"
                        onClick={() => handleJoinClick(room)}
                        style={{
                          background: isVC ? (isStarting ? 'rgba(0,180,216,0.08)' : 'var(--surface)') : (isStarting ? 'rgba(230,57,70,0.06)' : 'var(--surface)'),
                          border: `1px solid ${isVC ? (isStarting ? '#00b4d8' : urgent ? 'rgba(0,180,216,.4)' : 'rgba(0,180,216,.2)') : (isStarting ? 'var(--accent)' : urgent ? 'rgba(244,162,97,.4)' : locked ? 'rgba(255,214,10,.2)' : 'var(--border)')}`,
                        }}
                      >
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: typeColor(room.type) }} />

                        {isStarting && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '14px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: isVC ? '#00b4d8' : 'var(--accent)', marginBottom: '2px' }}>Starting</div>
                            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '44px', color: '#fff', lineHeight: 1 }}>{room.startCountdown}</div>
                          </div>
                        )}

                        {locked && !isVC && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '14px' }}>
                            <div style={{ fontSize: '22px', marginBottom: '2px' }}>🔒</div>
                            <div style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: 700 }}>{room.eloRequired}+ ELO</div>
                          </div>
                        )}

                        <div>
                          <div style={{ fontSize: '20px', marginBottom: '4px' }}>{room.emoji}</div>
                          <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: 1.4, color: 'var(--text)', marginBottom: '5px' }}>{room.topic}</div>
                          <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', padding: '2px 5px', borderRadius: '4px', background: badge.bg, color: badge.color }}>{badge.label}</span>
                          <div style={{ fontSize: '9px', color: 'var(--gold)', fontWeight: 600, marginTop: '4px' }}>
                            {isVC && '🏆 +20–80 ELO'}
                            {room.type === 'casual' && '🏆 +5–20 ELO'}
                            {room.type === 'random' && '🏆 +8–25 ELO'}
                            {room.type === 'serious' && '🏆 +15–90 ELO'}
                            {room.type === 'competitive' && '🏆 +50–200 ELO'}
                          </div>
                        </div>

                        <div>
                          {isVC ? (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: room.playerCount >= 1 ? '#00b4d8' : 'var(--muted)', marginBottom: '4px' }}>
                                <span>{room.playerCount}/2{room.playerCount === 1 ? ' 🔥' : ''}</span>
                                <span style={{ fontFamily: 'var(--font-bebas)', color: 'var(--muted)' }}>{fmt(room.countdown)}</span>
                              </div>
                              <div style={{ height: '3px', background: 'var(--surface2)', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' }}>
                                <div style={{ height: '100%', width: `${room.playerCount * 50}%`, background: 'linear-gradient(90deg,#00b4d8,#0077b6)', borderRadius: '2px' }} />
                              </div>
                              <div style={{ background: 'rgba(0,180,216,0.1)', border: '1px solid rgba(0,180,216,0.3)', borderRadius: '6px', padding: '5px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#00b4d8' }}>
                                🎙️ {room.playerCount === 0 ? 'Join' : 'Challenge'}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '3px' }}>
                                <span style={{ color: almostFull ? 'var(--accent)' : 'var(--muted)' }}>
                                  {room.playerCount}/{room.maxPlayers}{almostFull && !isStarting ? ' 🔥' : ''}
                                </span>
                                <span style={{ fontFamily: 'var(--font-bebas)', color: urgent ? 'var(--accent)' : room.countdown <= 60 ? 'var(--accent2)' : 'var(--green)' }}>
                                  {fmt(room.countdown)}
                                </span>
                              </div>
                              <div style={{ height: '3px', background: 'var(--surface2)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: almostFull ? 'linear-gradient(90deg,var(--accent),var(--accent2))' : 'linear-gradient(90deg,var(--green),var(--blue))', borderRadius: '2px' }} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}