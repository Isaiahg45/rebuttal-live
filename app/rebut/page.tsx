'use client'
import Nav from '../components/Nav'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'
import { io } from 'socket.io-client'
import { supabase } from '../../lib/supabase'

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
    sides: Record<string, 'pro' | 'con'>
  } | null
}

interface ChatMsg { user: string; text: string }
interface EndedRoom { winner: string; place: number; timestamp: number; room: RoomData }

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}

const TYPE_CONFIG: Record<string, { gradient: string; glow: string; border: string; badge: string; badgeBg: string; label: string; scanline?: boolean }> = {
  competitive: {
    gradient: 'linear-gradient(135deg, #ffd60a 0%, #ff9500 50%, #ff3b30 100%)',
    glow: '0 0 40px rgba(255,214,10,0.25), 0 0 80px rgba(255,149,0,0.1)',
    border: 'rgba(255,214,10,0.5)',
    badge: '#ffd60a',
    badgeBg: 'rgba(255,214,10,0.12)',
    label: '★ COMPETITIVE',
  },
  serious: {
    gradient: 'linear-gradient(135deg, #e63946 0%, #c1121f 50%, #7d0a00 100%)',
    glow: '0 0 40px rgba(230,57,70,0.35), 0 0 80px rgba(193,18,31,0.15)',
    border: 'rgba(230,57,70,0.6)',
    badge: '#ff4d58',
    badgeBg: 'rgba(230,57,70,0.15)',
    label: '⚖ SERIOUS',
    scanline: true,
  },
  vc: {
    gradient: 'linear-gradient(135deg, #00d4ff 0%, #0077b6 50%, #023e8a 100%)',
    glow: '0 0 40px rgba(0,212,255,0.3), 0 0 80px rgba(0,119,182,0.15)',
    border: 'rgba(0,212,255,0.5)',
    badge: '#00d4ff',
    badgeBg: 'rgba(0,212,255,0.12)',
    label: '🎙 VOICE',
  },
  casual: {
    gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
    glow: '0 0 30px rgba(34,197,94,0.2)',
    border: 'rgba(34,197,94,0.35)',
    badge: '#22c55e',
    badgeBg: 'rgba(34,197,94,0.1)',
    label: '😄 CASUAL',
  },
  random: {
    gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #4c1d95 100%)',
    glow: '0 0 30px rgba(168,85,247,0.2)',
    border: 'rgba(168,85,247,0.35)',
    badge: '#a855f7',
    badgeBg: 'rgba(168,85,247,0.1)',
    label: '🎲 RANDOM',
  },
  custom: {
    gradient: 'linear-gradient(135deg, #ff6b35 0%, #e63946 50%, #9b2226 100%)',
    glow: '0 0 30px rgba(255,107,53,0.25)',
    border: 'rgba(255,107,53,0.45)',
    badge: '#ff6b35',
    badgeBg: 'rgba(255,107,53,0.12)',
    label: '⚔ CUSTOM',
  },
  worldcup: {
    gradient: 'linear-gradient(90deg, #ff4d68 0 33%, #5b8cff 33% 66%, #3fe07f 66% 100%)',
    glow: '0 0 40px rgba(91,140,255,0.25), 0 0 80px rgba(255,77,104,0.1)',
    border: 'rgba(91,140,255,0.55)',
    badge: '#fff',
    badgeBg: 'rgba(255,255,255,0.1)',
    label: '⚽ WORLD CUP',
  },
}

const ELO_LABELS: Record<string, string> = {
  casual: '+15–25 ELO',
  random: '+10–20 ELO',
  serious: '+20-30 ELO',
  competitive: '+25–35 ELO',
  vc: '+10–30 ELO',
  worldcup: '+80 ELO to winner',
}

const FILTERS = ['All', 'World Cup', 'Casual', 'Serious', 'Competitive', 'Random', 'Voice', 'Custom']

export default function RebutPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const [rooms, setRooms] = useState<RoomData[]>([])
  const [filter, setFilter] = useState('All')
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null)
  const [spectateRoom, setSpectateRoom] = useState<RoomData | null>(null)
  const [passwordModal, setPasswordModal] = useState<RoomData | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hoveredPlayer, setHoveredPlayer] = useState<{ username: string; elo?: number; x: number; y: number } | null>(null)
  const [playerElos, setPlayerElos] = useState<Record<string, number>>({})
  const [creatorAvatars, setCreatorAvatars] = useState<Record<string, string>>({})
  const [roomMessages, setRoomMessages] = useState<Record<string, ChatMsg[]>>({})
  const [endedRooms, setEndedRooms] = useState<Record<string, EndedRoom>>({})
  const prevLiveRef = useRef<Map<string, RoomData>>(new Map())
  const guestName = useRef('guest' + Math.floor(1000 + Math.random() * 9000)).current

  useEffect(() => {
    const s = io('https://rebuttal-live-production-3388.up.railway.app', { transports: ['websocket', 'polling'] })
    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    s.on('rooms_update', (data: RoomData[]) => {
      setRooms(data)
      const currentLiveIds = new Set(data.filter(r => r.status === 'active' || r.status === 'starting').map(r => r.instanceId))
      prevLiveRef.current.forEach((room, id) => {
        if (!currentLiveIds.has(id)) {
          setEndedRooms(prev => ({ ...prev, [id]: { winner: '', place: 1, timestamp: Date.now(), room } }))
          setTimeout(() => setEndedRooms(prev => { const next = { ...prev }; delete next[id]; return next }), 3500)
        }
      })
      const newMap = new Map<string, RoomData>()
      data.filter(r => r.status === 'active' || r.status === 'starting').forEach(r => newMap.set(r.instanceId, r))
      prevLiveRef.current = newMap
    })
    s.on('room_message', (data: { instanceId: string; username: string; text: string }) => {
      setRoomMessages(prev => ({ ...prev, [data.instanceId]: [...(prev[data.instanceId] || []).slice(-5), { user: data.username, text: data.text }] }))
    })
    s.on('chat_message', (data: { instanceId: string; username: string; text: string }) => {
      setRoomMessages(prev => ({ ...prev, [data.instanceId]: [...(prev[data.instanceId] || []).slice(-5), { user: data.username, text: data.text }] }))
    })
    s.on('debate_ended', (data: { instanceId: string; winner: string; place?: number }) => {
      setEndedRooms(prev => ({ ...prev, [data.instanceId]: { winner: data.winner, place: data.place ?? 1, timestamp: Date.now(), room: prevLiveRef.current.get(data.instanceId) || prev[data.instanceId]?.room || ({} as RoomData) } }))
      setTimeout(() => setEndedRooms(prev => { const next = { ...prev }; delete next[data.instanceId]; return next }), 3500)
    })
    return () => { s.disconnect() }
  }, [])

  useEffect(() => {
    const allUsernames = [...new Set(rooms.flatMap(r => r.players))].filter(u => !u.startsWith('guest') && !(u in playerElos))
    if (allUsernames.length === 0) return
    supabase.from('profiles').select('username, elo').in('username', allUsernames).then(({ data }) => {
      if (data) {
        const map: Record<string, number> = {}
        data.forEach(p => { map[p.username] = p.elo })
        setPlayerElos(prev => ({ ...prev, ...map }))
      }
    })
  }, [rooms])

  useEffect(() => {
    const creators = [...new Set(rooms.filter(r => r.createdBy && !(r.createdBy in creatorAvatars)).map(r => r.createdBy!))]
    if (creators.length === 0) return
    supabase.from('profiles').select('username, avatar_url').in('username', creators).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {}
        data.forEach(p => { if (p.avatar_url) map[p.username] = p.avatar_url })
        setCreatorAvatars(prev => ({ ...prev, ...map }))
      }
    })
  }, [rooms])

  const matchFilter = (r: RoomData) => {
    if (filter === 'All') return true
    if (filter === 'Voice') return r.type === 'vc'
    if (filter === 'Custom') return !!r.isCustom
    if (filter === 'World Cup') return r.type === 'worldcup'
    return r.type.toLowerCase() === filter.toLowerCase()
  }

  const hasRealUser = (r: RoomData) => r.players.some(p => !p.startsWith('guest'))
const sortRooms = (arr: RoomData[]) => [...arr].sort((a, b) => {
  const score = (r: RoomData) => {
    if (r.type !== 'vc' && hasRealUser(r)) return 3  // real user in text room — top
    if (r.type === 'vc' && hasRealUser(r)) return 2  // real user in VC — second
    if (r.type === 'vc') return 1                     // empty VC — third
    return 0                                          // empty text room — last
  }
  return score(b) - score(a)
})

  const available = sortRooms(rooms.filter(r => r.status === 'waiting' && matchFilter(r)))
  const live = sortRooms(rooms.filter(r => (r.status === 'active' || r.status === 'starting') && matchFilter(r)))

  const routeRoom = (room: RoomData, pw?: string) => {
    const base = room.type === 'vc' ? `/vc-debate/${room.instanceId}` : `/debate/${room.instanceId}`
    router.push(base + (pw ? `?password=${encodeURIComponent(pw)}` : ''))
  }

  const handleJoin = (room: RoomData) => {
    if (loading) return
if (room.eloRequired > 0 && (profile?.elo ?? 0) < room.eloRequired) { alert(`Need ${room.eloRequired}+ ELO. You have ${profile?.elo ?? 0}.`); return }    if (user) { room.requiresPassword ? (setPasswordModal(room), setPasswordInput('')) : routeRoom(room) }
    else setSelectedRoom(room)
  }

  const handleSpectate = (room: RoomData) => {
    if (room.type === 'vc') return
    if (user) router.push(`/debate/${room.instanceId}?spectate=true`)
    else setSpectateRoom(room)
  }

  const cfg = (type: string) => TYPE_CONFIG[type] || TYPE_CONFIG.casual
  const placeLabel = (n: number) => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`

  const OVERLAY: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(12px)', padding: '20px' }
  const MODAL: React.CSSProperties = { background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '32px 28px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 0 80px rgba(0,0,0,0.8)' }

  return (
    <>
     <Nav active="rebut" />
      <div style={{ background: 'linear-gradient(100deg, #7a1726 0%, #5a1740 28%, #15275e 55%, #0f3d52 75%, #0c4a30 100%)', borderBottom: '1px solid #2a2230' }}>
        <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>
          <span style={{ width: '28px', height: '8px', borderRadius: '4px', background: 'linear-gradient(90deg, #ff4d68 0 33%, #5b8cff 33% 66%, #3fe07f 66% 100%)', flexShrink: 0, display: 'inline-block' }} />
          ⚽ <b style={{ color: '#fff' }}>World Cup Room</b> is live in the lobby — win it for <b style={{ color: '#fff' }}>+80 ELO</b>.
        </div>
      </div>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes vcPulse { 0%,100%{box-shadow:0 0 0 1px rgba(0,212,255,0.15), 0 0 16px rgba(0,212,255,0.08)} 50%{box-shadow:0 0 0 1px rgba(0,212,255,0.3), 0 0 24px rgba(0,212,255,0.15)} }
        @keyframes seriousPulse { 0%,100%{box-shadow:0 0 0 1px rgba(230,57,70,0.2), 0 0 20px rgba(230,57,70,0.08)} 50%{box-shadow:0 0 0 1px rgba(230,57,70,0.4), 0 0 30px rgba(230,57,70,0.12)} }
        @keyframes liveFlash { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes countdownPop { 0%{transform:scale(1.3)} 100%{transform:scale(1)} }
        @keyframes winnerPop { 0%{transform:scale(0.85);opacity:0} 60%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
        @keyframes fadeOut { 0%{opacity:1} 80%{opacity:1} 100%{opacity:0} }
        @keyframes fireFlicker {
          0%,100%{box-shadow: 0 0 6px 1px rgba(255,100,0,0.2), 0 0 16px 3px rgba(255,50,0,0.12);}
          50%{box-shadow: 0 0 10px 2px rgba(255,140,0,0.28), 0 0 24px 5px rgba(255,60,0,0.16);}
        }
        @keyframes borderFire {
          0%,100%{border-color: rgba(255,100,0,0.7);}
          33%{border-color: rgba(255,50,0,0.9);}
          66%{border-color: rgba(255,160,0,0.8);}
        }
        @keyframes cardFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .rebut-card-3d { transform-style: preserve-3d; transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .rebut-card-3d:hover { transform: translateY(-6px) scale(1.015); }
        .vc-card { animation: vcPulse 2.5s ease-in-out infinite; }
        .serious-card { animation: seriousPulse 3s ease-in-out infinite; }
        .fire-card { animation: fireFlicker 1.8s ease-in-out infinite, borderFire 1.8s ease-in-out infinite, cardFloat 4s ease-in-out infinite !important; }
        .scanline-overlay::after { content:''; position:absolute; inset:0; background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.06) 2px,rgba(0,0,0,0.06) 4px); pointer-events:none; border-radius:inherit; }
        .ended-card { animation: fadeOut 3.5s ease forwards; }
        .chat-scroll { scrollbar-width: none; }
        .chat-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Password modal */}
      {passwordModal && (
        <div style={OVERLAY}>
          <div style={MODAL}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '3px', marginBottom: '8px' }}>PRIVATE ROOM</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '20px' }}>Created by <b style={{ color: '#fff' }}>{passwordModal.createdBy}</b></div>
            <input value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (routeRoom(passwordModal, passwordInput), setPasswordModal(null))} placeholder="Enter password..." type="password" autoFocus style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '13px 16px', color: '#fff', fontSize: '15px', outline: 'none', marginBottom: '12px', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
            <button onClick={() => { routeRoom(passwordModal, passwordInput); setPasswordModal(null) }} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#e63946,#c1121f)', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', marginBottom: '8px', boxShadow: '0 0 20px rgba(230,57,70,0.4)' }}>Join Room →</button>
            <button onClick={() => setPasswordModal(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Join modal */}
      {!loading && selectedRoom && (
        <div style={OVERLAY}>
          <div style={{ ...MODAL, borderColor: cfg(selectedRoom.type).border, boxShadow: cfg(selectedRoom.type).glow }}>
            <div style={{ fontSize: '44px', marginBottom: '12px' }}>{selectedRoom.emoji}</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '3px', marginBottom: '8px', color: cfg(selectedRoom.type).badge }}>{cfg(selectedRoom.type).label}</div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '20px', lineHeight: 1.6 }}>{selectedRoom.topic}</div>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px 14px', marginBottom: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
              ⚡ Sign up to <b style={{ color: '#fff' }}>earn ELO</b> and appear on the global leaderboard
            </div>
            <button onClick={() => { setSelectedRoom(null); router.push('/signup') }} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#e63946,#c1121f)', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', marginBottom: '10px', boxShadow: '0 0 24px rgba(230,57,70,0.4)' }}>🏆 Sign Up & Earn ELO</button>
            <button onClick={() => { const p = selectedRoom.type === 'vc' ? `/vc-debate/${selectedRoom.instanceId}` : `/debate/${selectedRoom.instanceId}`; router.push(`${p}?guest=${guestName}`); setSelectedRoom(null) }} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: '13px', cursor: 'pointer', marginBottom: '10px' }}>
              Skip — join as <b style={{ color: 'rgba(255,255,255,0.7)' }}>{guestName}</b>
            </button>
            <button onClick={() => setSelectedRoom(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Spectate modal */}
      {!loading && spectateRoom && (
        <div style={OVERLAY}>
          <div style={MODAL}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>{spectateRoom.emoji}</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '3px', marginBottom: '8px' }}>WATCH THIS DEBATE</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '20px' }}>{spectateRoom.topic}</div>
            <button onClick={() => { setSpectateRoom(null); router.push('/signup') }} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#e63946,#c1121f)', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', marginBottom: '10px', boxShadow: '0 0 20px rgba(230,57,70,0.3)' }}>Sign Up to Track ELO</button>
            <button onClick={() => { router.push(`/debate/${spectateRoom.instanceId}?spectate=true&guest=${guestName}`); setSpectateRoom(null) }} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: '13px', cursor: 'pointer', marginBottom: '8px' }}>👁 Spectate as guest</button>
            <button onClick={() => setSpectateRoom(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, background: 'linear-gradient(180deg, rgba(230,57,70,0.04) 0%, transparent 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '28px', letterSpacing: '3px', lineHeight: 1, background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CHOOSE YOUR BATTLE</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', marginTop: '2px' }}>SELECT A DEBATE ROOM · AI SCORES EVERY ARGUMENT</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', background: connected ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${connected ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '20px', padding: '5px 12px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? '#22c55e' : '#666', boxShadow: connected ? '0 0 8px #22c55e' : 'none', animation: connected ? 'pulse 2s infinite' : 'none' }} />
              <span style={{ fontSize: '11px', color: connected ? '#22c55e' : 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.5px' }}>{connected ? `${rooms.length} LIVE` : 'CONNECTING...'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {FILTERS.map(f => {
              const isActive = filter === f
              const accentMap: Record<string, string> = { 'World Cup': '#5b8cff', Voice: '#00d4ff', Custom: '#ff6b35', Serious: '#e63946', Competitive: '#ffd60a', Random: '#a855f7', Casual: '#22c55e' }
              const accent = accentMap[f] || '#e63946'
              return (
                <button key={f} onClick={() => setFilter(f)} style={{ background: isActive ? `${accent}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${isActive ? accent : 'rgba(255,255,255,0.08)'}`, borderRadius: '20px', padding: '5px 14px', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: isActive ? accent : 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.15s', boxShadow: isActive ? `0 0 12px ${accent}40` : 'none' }}>
                  {f === 'Voice' ? '🎙 VOICE' : f.toUpperCase()}
                </button>
              )
            })}
          </div>
        </div>

        {/* Rooms */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>

          {!connected && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid rgba(230,57,70,0.5)', borderTopColor: '#e63946', animation: 'spin 0.8s linear infinite', boxShadow: '0 0 16px rgba(230,57,70,0.3)' }} />
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px' }}>CONNECTING TO SERVERS...</div>
            </div>
          )}

          {/* LIVE NOW */}
          {connected && (live.length > 0 || Object.keys(endedRooms).length > 0) && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e63946', animation: 'liveFlash 1s infinite', boxShadow: '0 0 8px #e63946' }} />
                <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '13px', letterSpacing: '3px', color: '#e63946' }}>LIVE NOW — {live.length} DEBATE{live.length !== 1 ? 'S' : ''}</span>
                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(230,57,70,0.4) 0%, transparent 100%)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>

                {/* Ended ghost cards */}
                {Object.entries(endedRooms).map(([id, ended]) => (
                  <div key={`ended-${id}`} className="ended-card" style={{ position: 'relative', borderRadius: '18px', padding: '24px', border: '1px solid rgba(255,214,10,0.4)', background: 'linear-gradient(135deg, rgba(255,214,10,0.06) 0%, rgba(0,0,0,0.95) 100%)', overflow: 'hidden', minHeight: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 0 30px rgba(255,214,10,0.15)' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #ffd60a, #ff9500)' }} />
                    <div style={{ fontSize: '40px', animation: 'winnerPop 0.4s ease forwards' }}>🏆</div>
                    <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '20px', letterSpacing: '2px', color: '#ffd60a', textAlign: 'center', textShadow: '0 0 16px rgba(255,214,10,0.6)' }}>
                      {ended.winner ? `${ended.winner} got #${placeLabel(ended.place)}!` : 'Debate Ended!'}
                    </div>
                    {ended.room?.topic && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', maxWidth: '200px', lineHeight: 1.4 }}>{ended.room.topic}</div>}
                    <div style={{ fontSize: '9px', color: 'rgba(255,214,10,0.5)', letterSpacing: '2px', fontWeight: 700 }}>DEBATE OVER</div>
                  </div>
                ))}

                {/* Live debate cards */}
                {live.map(room => {
                  const c = cfg(room.type)
                  const isVC = room.type === 'vc'
                  const msgs = roomMessages[room.instanceId] || []
                  const p1 = room.players[0] || '?'
                  const p2 = room.players[1] || '?'
                  const showVs = room.players.length >= 2

                  return (
                    <div
                      key={room.instanceId}
                      onClick={() => !isVC && handleSpectate(room)}
                      className="rebut-card-3d fire-card scanline-overlay"
                      style={{
                        position: 'relative', borderRadius: '18px',
                        border: '1px solid rgba(255,80,0,0.7)',
                        background: 'linear-gradient(160deg, rgba(20,5,0,0.98) 0%, rgba(10,0,0,0.99) 100%)',
                        cursor: isVC ? 'default' : 'pointer',
                        overflow: 'hidden',
                        display: 'flex', flexDirection: 'column',
                      }}
                    >
                      {/* Top shimmer bar */}
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #ff4500, #ff8c00, #ff4500)', backgroundSize: '200% 100%', animation: 'shimmer 2s linear infinite' }} />

                      {/* LIVE badge */}
                      <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,50,0,0.2)', border: '1px solid rgba(255,80,0,0.6)', borderRadius: '20px', padding: '2px 8px', fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', color: '#ff6030', animation: 'liveFlash 1.2s infinite', zIndex: 2 }}>
                        🔴 LIVE
                      </div>

                      {/* VS Header */}
<div style={{ padding: '14px 14px 4px', paddingRight: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {showVs ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 800 }}>
                            <span style={{ color: '#ff8c00', textShadow: '0 0 8px rgba(255,140,0,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85px', whiteSpace: 'nowrap' }}>{p1}</span>
                            <span style={{ fontSize: '14px', filter: 'drop-shadow(0 0 4px rgba(255,100,0,0.6))' }}>⚔️</span>
                            <span style={{ color: 'rgba(255,80,0,0.8)', fontFamily: 'var(--font-bebas)', fontSize: '13px', letterSpacing: '2px' }}>VS</span>
                            <span style={{ fontSize: '14px', filter: 'drop-shadow(0 0 4px rgba(255,100,0,0.6))' }}>⚔️</span>
                            <span style={{ color: 'rgba(255,200,150,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85px', whiteSpace: 'nowrap' }}>{p2}</span>
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                            {room.players.length > 2 ? `${room.players.length} debaters` : 'Debate in progress...'}
                          </div>
                        )}
                      </div>

                      {/* Topic */}
                      <div style={{ padding: '6px 14px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', lineHeight: 1.4, textShadow: '0 1px 8px rgba(255,80,0,0.2)' }}>{room.topic}</div>
                      </div>

                      {/* Live chat preview */}
                      <div style={{ margin: '0 10px 8px', borderRadius: '10px', overflow: 'hidden', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,80,0,0.12)', minHeight: '72px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '20px', background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)', zIndex: 1, pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '20px', background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)', zIndex: 1, pointerEvents: 'none' }} />
                        <div className="chat-scroll" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', flex: 1 }}>
                          {msgs.length === 0 ? (
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                              {isVC ? '🎙 Voice debate in progress...' : '💬 Arguments loading...'}
                            </div>
                          ) : msgs.map((m, i) => (
                            <div key={i} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span style={{ color: '#ff8c00', fontWeight: 700, marginRight: '4px' }}>{m.user}:</span>
                              <span>{m.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Footer */}
                      <div style={{ padding: '4px 12px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          {room.players.slice(0, 5).map((username, i) => (
                            <div
                              key={i}
                              onMouseEnter={e => setHoveredPlayer({ username, elo: playerElos[username], x: e.clientX, y: e.clientY })}
                              onMouseLeave={() => setHoveredPlayer(null)}
                              style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1px solid rgba(255,80,0,0.4)', background: `hsl(${i * 47 + room.instanceId.length * 7}, 65%, 55%)`, marginLeft: i === 0 ? 0 : '-4px', cursor: 'default', flexShrink: 0 }}
                            />
                          ))}
                          {room.playerCount > 5 && <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', marginLeft: '4px' }}>+{room.playerCount - 5}</div>}
                          {room.spectatorCount > 0 && <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', marginLeft: '5px' }}>· {room.spectatorCount} 👁</span>}
                        </div>
                        <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '14px', color: '#ff6030', letterSpacing: '1px', textShadow: '0 0 8px rgba(255,80,0,0.5)' }}>
                          {room.timeLeft != null ? fmt(room.timeLeft) : '—'}
                        </span>
                      </div>

                      {!isVC && (
                        <div style={{ margin: '0 10px 10px', background: 'rgba(255,60,0,0.08)', border: '1px solid rgba(255,80,0,0.3)', borderRadius: '8px', padding: '6px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#ff6030', letterSpacing: '1px' }}>
                          👁 WATCH LIVE
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* JOIN */}
          {connected && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '13px', letterSpacing: '3px', color: 'rgba(255,255,255,0.4)' }}>OPEN ROOMS — {available.length} AVAILABLE</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              </div>

              {available.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.2)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
                  <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '16px', letterSpacing: '2px' }}>ROOMS SPAWNING...</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {available.map(room => {
                    const c = cfg(room.type)
                    const isVC = room.type === 'vc'
                    const isStarting = room.status === 'starting'
                    const urgent = room.countdown <= 30
                    const pct = Math.round((room.playerCount / room.maxPlayers) * 100)
                    const isHovered = hoveredId === room.instanceId

                    return (
                      <div
                        key={room.instanceId}
                        onClick={() => handleJoin(room)}
                        onMouseEnter={() => setHoveredId(room.instanceId)}
                        onMouseLeave={() => setHoveredId(null)}
                        className={`rebut-card-3d ${isVC ? 'vc-card' : ''} ${room.type === 'serious' ? 'serious-card scanline-overlay' : ''}`}
                        style={{
                          position: 'relative', borderRadius: '18px', padding: '18px', cursor: 'pointer',
                          border: `1px solid ${isStarting ? c.badge : isHovered ? c.border : 'rgba(255,255,255,0.07)'}`,
                          background: isHovered
                            ? `linear-gradient(160deg, ${room.type === 'serious' ? 'rgba(230,57,70,0.1)' : room.type === 'vc' ? 'rgba(0,212,255,0.07)' : room.type === 'competitive' ? 'rgba(255,214,10,0.06)' : 'rgba(255,255,255,0.04)'} 0%, rgba(0,0,0,0.95) 100%)`
                            : 'linear-gradient(160deg, rgba(10,10,10,0.97) 0%, rgba(5,5,5,0.99) 100%)',
                          boxShadow: isHovered ? c.glow : isStarting ? c.glow : '0 4px 24px rgba(0,0,0,0.4)',
                          overflow: 'hidden', minHeight: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                          transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
                        }}
                      >
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: c.gradient, opacity: isHovered || isStarting ? 1 : 0.4, transition: 'opacity 0.2s' }} />
                        {isHovered && <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${c.badge}08 0%, transparent 70%)`, pointerEvents: 'none', borderRadius: '18px' }} />}

                        {isStarting && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '18px', backdropFilter: 'blur(4px)' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '3px', color: c.badge, marginBottom: '4px' }}>STARTING IN</div>
                            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '80px', color: '#fff', lineHeight: 1, textShadow: `0 0 40px ${c.badge}`, animation: 'countdownPop 0.5s ease' }}>{room.startCountdown}</div>
                          </div>
                        )}

                        {!loading && !user && room.eloRequired > 0 && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '18px', backdropFilter: 'blur(4px)' }}>
                            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔒</div>
                            <div style={{ fontSize: '13px', color: '#ffd60a', fontWeight: 700, letterSpacing: '1px' }}>{room.eloRequired}+ ELO REQUIRED</div>
                          </div>
                        )}

                        <div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <div style={{ fontSize: '26px', filter: isHovered ? `drop-shadow(0 0 8px ${c.badge})` : 'none', transition: 'filter 0.2s' }}>{room.emoji}</div>
                            <div style={{ display: 'flex', gap: '4px', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', padding: '3px 8px', borderRadius: '4px', background: c.badgeBg, color: c.badge, boxShadow: isHovered ? `0 0 8px ${c.badge}40` : 'none' }}>{c.label}</span>
                              {room.isPrivate && <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>PRIVATE</span>}
                            </div>
                          </div>

                          <div style={{ fontSize: '13px', fontWeight: 700, color: isHovered ? '#fff' : 'rgba(255,255,255,0.9)', lineHeight: 1.45, marginBottom: '8px', filter: room.isPrivate ? 'blur(4px)' : 'none', transition: 'color 0.2s' }}>{room.topic}</div>

                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: c.badge, textShadow: isHovered ? `0 0 6px ${c.badge}` : 'none' }}>{room.eloStake ? `±${room.eloStake} ELO` : ELO_LABELS[room.type] || ''}</span>
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>·</span>
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{Math.floor(room.duration / 60)}min</span>
                          </div>

                          {room.createdBy && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <div style={{ width: '18px', height: '18px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${c.border}`, flexShrink: 0 }}>
                                {creatorAvatars[room.createdBy] ? (
                                  <img src={creatorAvatars[room.createdBy]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,var(--accent),#ff8c69)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: '#fff' }}>
                                    {room.createdBy.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>by <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{room.createdBy}</span></span>
                            </div>
                          )}
                        </div>

                        <div style={{ marginTop: '12px' }}>
                          {isVC ? (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontSize: '10px', color: room.playerCount >= 1 ? '#00d4ff' : 'rgba(255,255,255,0.3)' }}>
                                  {room.playerCount}/2 {room.playerCount === 1 ? '🔥 opponent ready!' : ''}
                                </span>
                                <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '12px', color: urgent ? '#e63946' : 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>{fmt(room.countdown)}</span>
                              </div>
                              <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', marginBottom: '8px' }}>
                                <div style={{ height: '100%', width: `${room.playerCount * 50}%`, background: 'linear-gradient(90deg,#00d4ff,#0077b6)', boxShadow: room.playerCount > 0 ? '0 0 8px #00d4ff' : 'none', transition: 'width 0.5s' }} />
                              </div>
                             {room.vcState?.sides && Object.keys(room.vcState.sides).length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                  {(['pro', 'con'] as const).map(side => {
                    const username = Object.entries(room.vcState!.sides).find(([, s]) => s === side)?.[0]
                    return (
                      <div key={side} style={{ flex: 1, padding: '5px 8px', borderRadius: '6px', border: `1px solid ${username ? (side === 'pro' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)') : 'rgba(255,255,255,0.08)'}`, background: username ? (side === 'pro' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)') : 'transparent', textAlign: 'center' }}>
                        <div style={{ fontSize: '9px', fontWeight: 700, color: username ? (side === 'pro' ? '#22c55e' : '#e63946') : 'rgba(255,255,255,0.25)', letterSpacing: '1px' }}>{side === 'pro' ? '👍 PRO' : '👎 CON'}</div>
                        <div style={{ fontSize: '10px', color: username ? '#fff' : 'rgba(255,255,255,0.2)', marginTop: '2px' }}>{username || 'Open'}</div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: '10px', padding: '9px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#00d4ff', letterSpacing: '1.5px' }}>
                🎙 {room.playerCount === 0 ? 'JOIN VOICE BATTLE' : 'CHALLENGE ACCEPTED'}
              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{room.playerCount}/{room.maxPlayers} debaters</span>
                                <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '13px', letterSpacing: '1px', color: urgent ? '#e63946' : room.countdown <= 60 ? '#ff9500' : 'rgba(255,255,255,0.3)' }}>
                                  {fmt(room.countdown)}
                                </span>
                              </div>
                              <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', marginBottom: '10px' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: c.gradient, boxShadow: pct > 60 ? `0 0 8px ${c.badge}` : 'none', transition: 'width 0.5s' }} />
                              </div>
                              <div style={{ background: isHovered ? `${c.badge}15` : 'rgba(255,255,255,0.03)', border: `1px solid ${isHovered ? c.border : 'rgba(255,255,255,0.07)'}`, borderRadius: '10px', padding: '9px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: isHovered ? c.badge : 'rgba(255,255,255,0.35)', letterSpacing: '1.5px', transition: 'all 0.15s', boxShadow: isHovered ? `0 0 16px ${c.badge}30` : 'none' }}>
                                ENTER THE DEBATE →
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

      {/* Player tooltip */}
      {hoveredPlayer && (
        <div style={{ position: 'fixed', left: hoveredPlayer.x + 10, top: hoveredPlayer.y - 40, background: 'rgba(10,10,10,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '6px 10px', zIndex: 1000, pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{hoveredPlayer.username}</div>
          {hoveredPlayer.elo !== undefined && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' }}>{hoveredPlayer.elo} ELO</div>}
        </div>
      )}
    </>
  )
}