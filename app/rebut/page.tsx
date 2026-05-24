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
  isCustom?: boolean
  isPrivate?: boolean
  createdBy?: string
  eloStake?: number
  requiresPassword?: boolean
  vcState?: {
    currentSpeakerUsername: string | null
    turnNumber: number
    inCooldown: boolean
  } | null
}

const typeColor = (type: string) => {
  if (type === 'competitive') return 'linear-gradient(90deg,#ffd60a,#ff6b6b)'
  if (type === 'serious') return 'linear-gradient(90deg,#e63946,#ff6b6b)'
  if (type === 'random') return 'linear-gradient(90deg,#9b59b6,#3b82f6)'
  if (type === 'vc') return 'linear-gradient(90deg,#00b4d8,#0077b6)'
  if (type === 'custom') return 'linear-gradient(90deg,#ff6b35,#e63946)'
  return 'linear-gradient(90deg,#22c55e,#3b82f6)'
}

const typeBadge = (type: string) => {
  if (type === 'competitive') return { bg: 'rgba(255,214,10,.15)', color: '#ffd60a', label: '★ Competitive' }
  if (type === 'serious') return { bg: 'rgba(230,57,70,.15)', color: '#e63946', label: '⚖️ Serious' }
  if (type === 'random') return { bg: 'rgba(155,89,182,.15)', color: '#c39bd3', label: '🎲 Random' }
  if (type === 'vc') return { bg: 'rgba(0,180,216,.15)', color: '#00b4d8', label: '🎙️ Voice' }
  if (type === 'custom') return { bg: 'rgba(255,107,53,.15)', color: '#ff6b35', label: '⚔️ Custom' }
  return { bg: 'rgba(34,197,94,.15)', color: '#22c55e', label: '😄 Casual' }
}

const eloLabel = (type: string, stake?: number) => {
  if (type === 'custom' && stake) return `🏆 ±${stake} ELO`
  if (type === 'vc') return '🏆 +20–80 ELO'
  if (type === 'casual') return '🏆 +5–20 ELO'
  if (type === 'random') return '🏆 +8–25 ELO'
  if (type === 'serious') return '🏆 +15–90 ELO'
  if (type === 'competitive') return '🏆 +50–200 ELO'
  return ''
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}

const filters = ['All', 'Casual', 'Serious', 'Competitive', 'Random', 'Voice', 'Custom']

export default function RebutPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const [rooms, setRooms] = useState<RoomData[]>([])
  const [activeFilter, setActiveFilter] = useState('All')
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null)
  const [spectateRoom, setSpectateRoom] = useState<RoomData | null>(null)
  const [passwordModal, setPasswordModal] = useState<{ room: RoomData } | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
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
    if (activeFilter === 'Custom') return r.isCustom === true
    return r.type.toLowerCase() === activeFilter.toLowerCase()
  }

  const filteredAvailable = availableRooms.filter(matchesFilter)
  const filteredOngoing = ongoingRooms.filter(matchesFilter)

  const routeToRoom = (room: RoomData, password?: string) => {
    const path = room.type === 'vc' ? `/vc-debate/${room.instanceId}` : `/debate/${room.instanceId}`
    const query = password ? `?password=${encodeURIComponent(password)}` : ''
    router.push(path + query)
  }

  const handleJoinClick = (room: RoomData) => {
    if (loading) return
    const myElo = profile?.elo ?? 0
    if (myElo < room.eloRequired) {
      alert(`You need ${room.eloRequired}+ ELO to join. You have ${myElo}.`)
      return
    }
    if (user) {
      if (room.requiresPassword) {
        setPasswordModal({ room })
        setPasswordInput('')
      } else {
        routeToRoom(room)
      }
    } else {
      setSelectedRoom(room)
    }
  }

  const handleSpectateClick = (room: RoomData) => {
    if (loading || room.type === 'vc') return
    if (user) {
      router.push(`/debate/${room.instanceId}?spectate=true`)
    } else {
      setSpectateRoom(room)
    }
  }

  const handleGuestJoin = () => {
    if (!selectedRoom) return
    if (selectedRoom.requiresPassword) {
      setPasswordModal({ room: selectedRoom })
      setPasswordInput('')
      setSelectedRoom(null)
    } else {
      const path = selectedRoom.type === 'vc' ? `/vc-debate/${selectedRoom.instanceId}` : `/debate/${selectedRoom.instanceId}`
      router.push(`${path}?guest=${guestName}`)
      setSelectedRoom(null)
    }
  }

  const handlePasswordSubmit = () => {
    if (!passwordModal || !passwordInput.trim()) return
    routeToRoom(passwordModal.room, passwordInput.trim())
    setPasswordModal(null)
    setPasswordInput('')
  }

  const modalBase: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, backdropFilter: 'blur(8px)', padding: '16px',
  }
  const modalCard: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border2)',
    borderRadius: '20px', padding: '28px 24px', maxWidth: '380px', width: '100%', textAlign: 'center',
    boxShadow: '0 0 60px rgba(0,0,0,0.6)',
  }

  return (
    <>
      <Nav active="rebut" />

      {/* Password modal */}
      {passwordModal && (
        <div style={modalBase}>
          <div style={modalCard}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔒</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', marginBottom: '8px' }}>PRIVATE ROOM</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.6 }}>
              Created by <b style={{ color: 'var(--text)' }}>{passwordModal.room.createdBy}</b>. Enter the password to join.
            </div>
            <input
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="Enter password..."
              autoFocus
              type="password"
              style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '12px 14px', color: 'var(--text)', fontSize: '15px', outline: 'none', marginBottom: '12px', fontFamily: 'DM Sans, sans-serif' }}
            />
            <button onClick={handlePasswordSubmit} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: '8px', boxShadow: '0 0 20px rgba(230,57,70,0.3)' }}>
              Join Room →
            </button>
            <button onClick={() => setPasswordModal(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Join modal */}
      {!loading && selectedRoom && (
        <div style={modalBase}>
          <div style={modalCard}>
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
            <button onClick={() => { setSelectedRoom(null); router.push('/signup') }} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: '10px', boxShadow: '0 0 20px rgba(230,57,70,0.3)' }}>
              🏆 Sign Up & Earn ELO
            </button>
            <button onClick={handleGuestJoin} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: '10px' }}>
              Skip — join as <b style={{ color: 'var(--text2)' }}>{guestName}</b>
            </button>
            <button onClick={() => setSelectedRoom(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Spectate modal */}
      {!loading && spectateRoom && (
        <div style={modalBase}>
          <div style={modalCard}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>{spectateRoom.emoji}</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', marginBottom: '8px' }}>WATCH THIS DEBATE</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.6 }}>{spectateRoom.topic}</div>
            <button onClick={() => { setSpectateRoom(null); router.push('/signup') }} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: '10px' }}>
              Sign Up to Track ELO
            </button>
            <button onClick={() => { router.push(`/debate/${spectateRoom.instanceId}?spectate=true&guest=${guestName}`); setSpectateRoom(null) }} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: '10px' }}>
              👁 Spectate as guest
            </button>
            <button onClick={() => setSpectateRoom(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: 'clamp(10px, 2vw, 16px) clamp(12px, 3vw, 24px) clamp(8px, 1.5vw, 12px)', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'linear-gradient(180deg, rgba(230,57,70,0.03) 0%, transparent 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(18px, 3vw, 24px)', letterSpacing: '2px', textShadow: '0 0 30px rgba(230,57,70,0.3)' }}>CHOOSE YOUR BATTLE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '4px 10px', flexShrink: 0 }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--red)', boxShadow: connected ? '0 0 6px var(--green)' : 'none', animation: connected ? 'pulse 2s infinite' : 'none', flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{connected ? `${rooms.length} live` : 'Connecting...'}</span>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', paddingTop: '8px', paddingBottom: '2px' }}>
            {filters.map(f => (
              <button key={f} onClick={() => setActiveFilter(f)} style={{
                background: activeFilter === f
                  ? f === 'Voice' ? 'rgba(0,180,216,.15)' : f === 'Custom' ? 'rgba(255,107,53,.15)' : 'rgba(230,57,70,.12)'
                  : 'var(--surface2)',
                border: `1px solid ${activeFilter === f
                  ? f === 'Voice' ? '#00b4d8' : f === 'Custom' ? '#ff6b35' : 'var(--accent)'
                  : 'var(--border)'}`,
                borderRadius: '20px', padding: '4px 12px', fontSize: '12px',
                color: activeFilter === f
                  ? f === 'Voice' ? '#00b4d8' : f === 'Custom' ? '#ff6b35' : 'var(--accent)'
                  : 'var(--muted)',
                whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', flexShrink: 0,
                transition: 'all 0.15s',
                boxShadow: activeFilter === f ? `0 0 10px ${f === 'Voice' ? 'rgba(0,180,216,0.2)' : f === 'Custom' ? 'rgba(255,107,53,0.2)' : 'rgba(230,57,70,0.2)'}` : 'none',
              }}>
                {f === 'Voice' ? '🎙️ Voice' : f}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!connected && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔌</div>
              <div style={{ fontSize: '14px' }}>Connecting to debate servers...</div>
            </div>
          )}

          {/* LIVE NOW */}
          {connected && filteredOngoing.length > 0 && (
            <div>
              <div className="rebut-section-header">
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s infinite', boxShadow: '0 0 8px var(--accent)', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent)' }}>
                  Live ({filteredOngoing.length})
                </span>
              </div>
              <div className="rebut-grid">
                {filteredOngoing.map(room => {
                  const badge = typeBadge(room.type)
                  const isVC = room.type === 'vc'
                  const isStarting = room.status === 'starting'
                  return (
                    <div
                      key={room.instanceId}
                      className="rebut-card"
                      onClick={() => !isVC && handleSpectateClick(room)}
                      style={{
                        background: isVC ? 'rgba(0,180,216,0.04)' : 'rgba(230,57,70,0.03)',
                        border: `1px solid ${isVC ? 'rgba(0,180,216,0.25)' : 'rgba(230,57,70,0.2)'}`,
                        cursor: isVC ? 'default' : 'pointer',
                        boxShadow: isVC ? '0 0 20px rgba(0,180,216,0.05)' : '0 0 20px rgba(230,57,70,0.05)',
                      }}
                    >
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: typeColor(room.type), boxShadow: `0 0 8px ${isVC ? 'rgba(0,180,216,0.5)' : 'rgba(230,57,70,0.5)'}` }} />
                      <div style={{ position: 'absolute', top: '8px', right: '8px', background: isVC ? 'rgba(0,180,216,.2)' : 'rgba(230,57,70,.2)', border: `1px solid ${isVC ? '#00b4d8' : 'var(--accent)'}`, borderRadius: '20px', padding: '2px 6px', fontSize: '9px', color: isVC ? '#00b4d8' : 'var(--accent)', fontWeight: 700 }}>
                        {isStarting ? 'START' : 'LIVE'}
                      </div>
                      <div>
                        <div style={{ fontSize: '20px', marginBottom: '4px' }}>{room.emoji}</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: 1.4, color: 'var(--text)', marginBottom: '6px' }}>{room.topic}</div>
                        <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', background: badge.bg, color: badge.color }}>{badge.label}</span>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{room.playerCount} debating</span>
                          <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '12px', color: isVC ? '#00b4d8' : 'var(--accent)' }}>
                            {room.timeLeft != null ? fmt(room.timeLeft) : '—'}
                          </span>
                        </div>
                        {!isVC ? (
                          <div style={{ background: 'rgba(230,57,70,0.12)', border: '1px solid rgba(230,57,70,0.3)', borderRadius: '6px', padding: '5px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--accent)', boxShadow: '0 0 8px rgba(230,57,70,0.1)' }}>
                            👁 Watch
                          </div>
                        ) : (
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
                  {activeFilter === 'Voice' ? '— 1v1 voice battle' : '— needs 2+ players'}
                </span>
              </div>

              {filteredAvailable.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--muted)' }}>
                  <div style={{ fontSize: '28px', marginBottom: '10px' }}>⏳</div>
                  <div style={{ fontSize: '14px' }}>Rooms spawning soon...</div>
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
                    const vcColor = '#00b4d8'

                    return (
                      <div
                        key={room.instanceId}
                        className="rebut-card"
                        onClick={() => handleJoinClick(room)}
                        style={{
                          background: isVC
                            ? (isStarting ? 'rgba(0,180,216,0.08)' : 'var(--surface)')
                            : (isStarting ? 'rgba(230,57,70,0.06)' : 'var(--surface)'),
                          border: `1px solid ${
                            isVC
                              ? (isStarting ? vcColor : urgent ? `rgba(0,180,216,.5)` : `rgba(0,180,216,.2)`)
                              : (isStarting ? 'var(--accent)' : urgent ? 'rgba(244,162,97,.5)' : locked ? 'rgba(255,214,10,.2)' : 'var(--border)')
                          }`,
                          boxShadow: isStarting
                            ? `0 0 20px ${isVC ? 'rgba(0,180,216,0.15)' : 'rgba(230,57,70,0.15)'}`
                            : 'none',
                        }}
                      >
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: typeColor(room.type) }} />

                        {isStarting && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '14px', backdropFilter: 'blur(2px)' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: isVC ? vcColor : 'var(--accent)', marginBottom: '2px', letterSpacing: '2px' }}>Starting</div>
                            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '52px', color: '#fff', lineHeight: 1, textShadow: `0 0 20px ${isVC ? vcColor : 'var(--accent)'}` }}>{room.startCountdown}</div>
                          </div>
                        )}

                        {locked && !isVC && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '14px', backdropFilter: 'blur(2px)' }}>
                            <div style={{ fontSize: '22px', marginBottom: '4px' }}>🔒</div>
                            <div style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: 700 }}>{room.eloRequired}+ ELO</div>
                          </div>
                        )}

                        <div>
                          <div style={{ fontSize: '20px', marginBottom: '4px' }}>{room.emoji}</div>
                          <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: 1.4, color: 'var(--text)', marginBottom: '5px' }}>{room.topic}</div>
                          <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', background: badge.bg, color: badge.color }}>{badge.label}</span>
                          <div style={{ fontSize: '9px', color: 'var(--gold)', fontWeight: 600, marginTop: '4px' }}>
                            {eloLabel(room.type, room.eloStake)}
                          </div>
                          {room.isPrivate && (
                            <div style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '2px' }}>🔒 Private · by {room.createdBy}</div>
                          )}
                        </div>

                        <div>
                          {isVC ? (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: room.playerCount >= 1 ? vcColor : 'var(--muted)', marginBottom: '4px' }}>
                                <span>{room.playerCount}/2{room.playerCount === 1 ? ' 🔥' : ''}</span>
                                <span style={{ fontFamily: 'var(--font-bebas)', color: 'var(--muted)' }}>{fmt(room.countdown)}</span>
                              </div>
                              <div style={{ height: '3px', background: 'var(--surface2)', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' }}>
                                <div style={{ height: '100%', width: `${room.playerCount * 50}%`, background: `linear-gradient(90deg,${vcColor},#0077b6)`, borderRadius: '2px', boxShadow: room.playerCount > 0 ? `0 0 8px ${vcColor}` : 'none' }} />
                              </div>
                              <div style={{ background: `rgba(0,180,216,0.12)`, border: `1px solid rgba(0,180,216,0.35)`, borderRadius: '6px', padding: '5px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: vcColor, boxShadow: '0 0 8px rgba(0,180,216,0.1)' }}>
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
                                <div style={{ height: '100%', width: `${pct}%`, background: almostFull ? 'linear-gradient(90deg,var(--accent),var(--accent2))' : 'linear-gradient(90deg,var(--green),var(--blue))', borderRadius: '2px', boxShadow: almostFull ? '0 0 6px rgba(230,57,70,0.5)' : 'none', transition: 'width 0.5s' }} />
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