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
  isSpectator: boolean
  timeLeft: number | null
}

interface EloChanges {
  winnerElo: number
  secondElo: number
  thirdElo: number
  loserBase: number
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}

function Avatar({ username, size = 30, fallbackGrad, avatarUrl }: {
  username: string
  size?: number
  fallbackGrad?: string
  avatarUrl?: string
}) {
  const grad = fallbackGrad || 'linear-gradient(135deg,#e63946,#ff8c69)'
  return (
    <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
      {avatarUrl
        ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ width: '100%', height: '100%', background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: `${Math.floor(size * 0.37)}px`, fontWeight: 700, color: '#fff' }}>
            {username.slice(0, 2).toUpperCase()}
          </div>
      }
    </div>
  )
}

export default function DebatePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const instanceId = params.roomId as string
  const guestParam = searchParams.get('guest')
  const spectateParam = searchParams.get('spectate') === 'true'

  const [myUsername, setMyUsername] = useState('')
  const [myElo, setMyElo] = useState(0)
  const [isSpectator, setIsSpectator] = useState(spectateParam)
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
  const [playerAvatars, setPlayerAvatars] = useState<Record<string, string>>({})
  const [gameStarted, setGameStarted] = useState(false)
  const [showLeaveWarning, setShowLeaveWarning] = useState(false)
 const [forfeitInfo, setForfeitInfo] = useState<{ username: string } | null>(null)
  const [isDraw, setIsDraw] = useState(false)
  const [lobbyMessages, setLobbyMessages] = useState<{ username: string; text: string; id: number }[]>([])
  const [lobbyInput, setLobbyInput] = useState('')
  const [suddenDeath, setSuddenDeath] = useState(false)
  const [suddenDeathRound, setSuddenDeathRound] = useState(0)
  const [suddenDeathFirst, setSuddenDeathFirst] = useState<string | null>(null)
  const [suddenDeathSecond, setSuddenDeathSecond] = useState<string | null>(null)
  const [suddenDeathPhase, setSuddenDeathPhase] = useState<'first' | 'cooldown' | 'second' | null>(null)
  const [suddenDeathTimeLeft, setSuddenDeathTimeLeft] = useState(0)
  const [suddenDeathCooldown, setSuddenDeathCooldown] = useState(0)
 const suddenDeathAudioRef = useRef<HTMLAudioElement | null>(null)
  const popAudioRef = useRef<HTMLAudioElement | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null)
  const tickingAudioRef = useRef<HTMLAudioElement | null>(null)
  const lobbyAudioRef = useRef<HTMLAudioElement | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const cooldownRef = useRef<any>(null)
  const timerRef = useRef<any>(null)
  const profileRef = useRef(profile)
  const userRef = useRef(user)
  const myUsernameRef = useRef(myUsername)
  const isSpectatorRef = useRef(isSpectator)
  const statusRef = useRef(status)
  const gameStartedRef = useRef(gameStarted)

  useEffect(() => { profileRef.current = profile }, [profile])
  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { myUsernameRef.current = myUsername }, [myUsername])
  useEffect(() => { isSpectatorRef.current = isSpectator }, [isSpectator])
  useEffect(() => { statusRef.current = status }, [status])
  useEffect(() => { gameStartedRef.current = gameStarted }, [gameStarted])

  // Fetch avatars for players
  useEffect(() => {
    const toFetch = players
      .map(p => p.username)
      .filter(u => !u.startsWith('guest') && !(u in playerAvatars))
    if (toFetch.length === 0) return
    supabase.from('profiles').select('username, avatar_url').in('username', toFetch).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {}
        data.forEach(p => { if (p.avatar_url) map[p.username] = p.avatar_url })
        setPlayerAvatars(prev => ({ ...prev, ...map }))
      }
    })
  }, [players])

  // Fetch avatars for message authors
  useEffect(() => {
    const authors = [...new Set(messages.map(m => m.username))]
      .filter(u => u !== '— system —' && !u.startsWith('guest') && !(u in playerAvatars))
    if (authors.length === 0) return
    supabase.from('profiles').select('username, avatar_url').in('username', authors).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {}
        data.forEach(p => { if (p.avatar_url) map[p.username] = p.avatar_url })
        setPlayerAvatars(prev => ({ ...prev, ...map }))
      }
    })
  }, [messages])

  const stopLobbyMusic = () => {
    try {
      if (lobbyAudioRef.current) {
        lobbyAudioRef.current.pause()
        lobbyAudioRef.current.currentTime = 0
      }
    } catch (e) {}
  }

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
  const myScore = players.find(p => p.username === myUsername)?.score ?? 0
  const cooldownTime = players.length <= 6 ? 15 : 30
  const pct = roomInfo ? (timeLeft / roomInfo.duration) * 100 : 0

  useEffect(() => {
    if (loading) return
    if (guestParam) { setMyUsername(guestParam); return }
    if (profile?.username) { setMyUsername(profile.username); setMyElo(profile.elo ?? 0); return }
    if (!user) { setMyUsername('guest' + Math.floor(1000 + Math.random() * 9000)) }
  }, [loading, profile, user, guestParam])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (gameStartedRef.current && statusRef.current === 'active' && !isSpectatorRef.current) {
        e.preventDefault()
        e.returnValue = 'Leaving will count as a forfeit. Are you sure?'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    if (!myUsername) return

    // Load sound prefs
    const rawPrefs = localStorage.getItem('rebuttal_sound_prefs')
    const soundPrefs = rawPrefs ? JSON.parse(rawPrefs) : {}
    const sfxOn = soundPrefs.soundEnabled ?? true
    const musicOn = soundPrefs.musicEnabled ?? true

    // Preload all audio
    countdownAudioRef.current = new Audio('/sounds/countdown.mp3')
    countdownAudioRef.current.preload = 'auto'

    suddenDeathAudioRef.current = new Audio('/sounds/suddendeath.mp3')
    suddenDeathAudioRef.current.preload = 'auto'

    popAudioRef.current = new Audio('/sounds/pop.mp3')
    popAudioRef.current.preload = 'auto'
    popAudioRef.current.volume = 0.5

    tickingAudioRef.current = new Audio('/sounds/ticking.mp3')
    tickingAudioRef.current.preload = 'auto'

    lobbyAudioRef.current = new Audio('/sounds/lobby.mp3')
    lobbyAudioRef.current.preload = 'auto'
    lobbyAudioRef.current.loop = true
    lobbyAudioRef.current.volume = 0.35

    // Unlock audio on first interaction
    const unlockAudio = () => {
      ;[countdownAudioRef, tickingAudioRef].forEach(ref => {
        if (!ref.current) return
        ref.current.play().then(() => {
          ref.current!.pause()
          ref.current!.currentTime = 0
        }).catch(() => {})
      })
    }
    setTimeout(() => {
      document.addEventListener('click', unlockAudio, { once: true })
      document.addEventListener('touchstart', unlockAudio, { once: true })
    }, 500)

    const socket = io('https://rebuttal-live-production-3388.up.railway.app', { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      if (spectateParam) {
        socket.emit('spectate_room', { instanceId, username: myUsername })
      } else {
        socket.emit('join_room', { instanceId, username: myUsername, elo: myElo })
      }
    })

    socket.on('join_as_spectator', ({ instanceId: rid }: { instanceId: string }) => {
      setIsSpectator(true)
      socket.emit('spectate_room', { instanceId: rid, username: myUsername })
    })

    socket.on('disconnect', () => setConnected(false))
    socket.on('message_history', (msgs: Message[]) => setMessages(msgs))

    socket.on('new_message', (msg: Message) => {
      setMessages(prev => {
        const filtered = prev.filter(m => !(m.pending && m.username === msg.username))
        return [...filtered, msg]
      })
      try {
        if (sfxOn && popAudioRef.current) {
          popAudioRef.current.currentTime = 0
          popAudioRef.current.play().catch(() => {})
        }
      } catch (e) {}
    })

    socket.on('players_update', (p: Player[]) => setPlayers(p))

    socket.on('room_info', (info: RoomInfo) => {
      setRoomInfo(info)
      setStatus(info.status as any)
      setLobbyCountdown(info.countdown)
      if (info.timeLeft) setTimeLeft(info.timeLeft)
      if (info.isSpectator) setIsSpectator(true)
      if (info.status === 'active') {
        setGameStarted(true)
        stopLobbyMusic()
      }
      // Start lobby jazz when joining a waiting room
      if ((info.status === 'waiting' || info.status === 'starting') && !info.isSpectator) {
        try { if (musicOn) lobbyAudioRef.current?.play() } catch (e) {}
      }
    })

    socket.on('room_starting', ({ startCountdown: sc }: { startCountdown: number }) => {
      setStatus('starting')
      setStartCountdown(sc)
    })

    socket.on('start_countdown_tick', ({ count }: { count: number }) => {
      setStartCountdown(count)
  if (count <= 4) setGameStarted(true)
      if (count === 4) {
        stopLobbyMusic()
        try {
          if (sfxOn && countdownAudioRef.current) {
            countdownAudioRef.current.currentTime = 0
            countdownAudioRef.current.play()
          }
        } catch (e) {}
      }
    })

    socket.on('debate_started', ({ duration }: { duration: number }) => {
      stopLobbyMusic() // safety stop in case countdown was skipped
      setStatus('active')
      setGameStarted(true)
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
      standings: s, eloChanges, forfeit, forfeitUsername, customStake, serverHandledElo, draw,
    }: {
      standings: Player[]
      eloChanges: EloChanges
      type: string
      forfeit?: boolean
      forfeitUsername?: string
      customStake?: number
      serverHandledElo?: boolean
      draw?: boolean
    }) => {
      stopLobbyMusic()
      try { tickingAudioRef.current?.pause() } catch (e) {}
      setStatus('ended')
      setStandings(s)
      if (forfeit && forfeitUsername) setForfeitInfo({ username: forfeitUsername })
      if (draw) setIsDraw(true)
      if (isSpectatorRef.current) return
      const currentProfile = profileRef.current
      const currentUser = userRef.current
      if (!currentProfile?.username || !currentUser) return
      const myPlace = s.findIndex(p => p.username === myUsernameRef.current)
      if (myPlace === -1) return
      const totalPlayers = s.length
      const { winnerElo, secondElo, thirdElo, loserBase } = eloChanges
      let change = 0
     const opponents = s.filter(p => p.username !== myUsernameRef.current).map(p => p.username)
      const labelFor = (c: number): 'win' | 'loss' | 'draw' | 'forfeit_by' | 'forfeit_against' => {
        if (draw) return 'draw'
        if (forfeit && forfeitUsername === myUsernameRef.current) return 'forfeit_by'
        if (forfeit && forfeitUsername && forfeitUsername !== myUsernameRef.current) return 'forfeit_against'
        return myPlace === 0 ? 'win' : 'loss'
      }
      const logResult = (c: number) => {
        const result = labelFor(c)
        const msgs = {
          win: `🏆 You won! +${c} ELO`,
          loss: `❌ You lost. ${c} ELO`,
          draw: `🤝 Draw — no ELO change`,
          forfeit_by: `🏳️ You forfeited. ${c} ELO`,
          forfeit_against: `🏳️ Opponent forfeited — you win! +${c} ELO`,
        }
        supabase.from('debate_history').insert({
          username: myUsernameRef.current, opponents,
          topic: roomInfo?.topic || '', room_type: roomInfo?.type || '',
          result, elo_change: c, instance_id: instanceId,
        }).then(() => {})
        supabase.from('notifications').insert({
          recipient_username: myUsernameRef.current,
          type: 'game_result',
          message: `${msgs[result]} — "${roomInfo?.topic || ''}"`,
        }).then(() => {})
      }

      if (serverHandledElo && customStake) {
        change = myPlace === 0 ? customStake : -customStake
        setEloChange(change)
        logResult(change)
        const newWins = myPlace === 0 ? (currentProfile.wins ?? 0) + 1 : (currentProfile.wins ?? 0)
        await supabase.from('profiles').update({ wins: newWins, debates: (currentProfile.debates ?? 0) + 1 }).eq('id', currentUser.id)
        return
      } else if (totalPlayers <= 6) {
        if (myPlace === 0) change = winnerElo
        else { const f = myPlace / (totalPlayers - 1); change = -Math.round(loserBase * (0.4 + f * 0.6)) }
      } else {
        if (myPlace === 0) change = winnerElo
        else if (myPlace === 1) change = secondElo
        else if (myPlace === 2) change = thirdElo
        else { const f = (myPlace - 2) / (totalPlayers - 3); change = -Math.round(loserBase * (0.3 + f * 0.7)) }
      }
     setEloChange(change)
      logResult(change)
      const newElo = (currentProfile.elo ?? 0) + change
      const { error } = await supabase.from('profiles').update({
        elo: newElo,
        wins: myPlace === 0 ? (currentProfile.wins ?? 0) + 1 : (currentProfile.wins ?? 0),
        debates: (currentProfile.debates ?? 0) + 1,
      }).eq('id', currentUser.id)
      if (error) console.error('ELO save error:', error)
    })

    socket.on('room_expired', ({ message }: { message: string }) => {
      stopLobbyMusic()
      try { tickingAudioRef.current?.pause() } catch (e) {}
      clearInterval(timerRef.current)
      setStatus('expired')
      setExpiredMsg(message)
    })

    socket.on('rooms_update', (rooms: any[]) => {
      const myRoom = rooms.find(r => r.instanceId === instanceId)
      if (myRoom) {
        const prevCountdown = myRoom.countdown
        setLobbyCountdown(prev => {
         if (prev === 30 && myRoom.countdown <= 30) {
            try {
              if (sfxOn && tickingAudioRef.current) {
                tickingAudioRef.current.currentTime = 0
                tickingAudioRef.current.play()
              }
            } catch (e) {}
          }
          return myRoom.countdown
        })
        if (myRoom.startCountdown !== null) setStartCountdown(myRoom.startCountdown)
        if (myRoom.status === 'starting') setStatus('starting')
        if (myRoom.timeLeft != null) setTimeLeft(myRoom.timeLeft)
      }
    })

    socket.on('error', ({ message }: { message: string }) => {
      stopLobbyMusic()
      alert(message)
      router.push('/rebut')
    })

    socket.on('sudden_death_start', ({ round, firstPlayer, secondPlayer, turnDuration }: any) => {
      setSuddenDeath(true)
      setSuddenDeathRound(round)
      setSuddenDeathFirst(firstPlayer)
      setSuddenDeathSecond(secondPlayer)
      setSuddenDeathPhase('first')
      setSuddenDeathTimeLeft(turnDuration)
      setSuddenDeathCooldown(0)
      try {
        if (sfxOn && suddenDeathAudioRef.current) {
          suddenDeathAudioRef.current.currentTime = 0
          suddenDeathAudioRef.current.play().then(() => {
            suddenDeathAudioRef.current!.onended = () => {
              try {
                if (sfxOn && countdownAudioRef.current) {
                  countdownAudioRef.current.currentTime = 0
                  countdownAudioRef.current.play()
                }
              } catch (e) {}
            }
          }).catch(() => {})
        }
      } catch (e) {}
    })

    socket.on('sudden_death_tick', ({ timeLeft, phase }: any) => {
      setSuddenDeathTimeLeft(timeLeft)
      setSuddenDeathPhase(phase)
    })

    socket.on('sudden_death_switch', ({ nextPlayer, cooldown: cd }: any) => {
      setSuddenDeathPhase('cooldown')
      setSuddenDeathCooldown(cd)
    })

    socket.on('sudden_death_second_start', ({ player }: any) => {
      setSuddenDeathPhase('second')
      setSuddenDeathTimeLeft(10)
    })

    socket.on('lobby_chat', ({ username, text }: { username: string; text: string }) => {
      const id = Date.now() + Math.random()
      setLobbyMessages(prev => [...prev, { username, text, id }])
      setTimeout(() => setLobbyMessages(prev => prev.filter(m => m.id !== id)), 8000)
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
      stopLobbyMusic()
      try { tickingAudioRef.current?.pause() } catch (e) {}
      try { countdownAudioRef.current?.pause() } catch (e) {}
     if (lobbyAudioRef.current) { lobbyAudioRef.current.pause(); lobbyAudioRef.current.src = '' }
      if (suddenDeathAudioRef.current) { suddenDeathAudioRef.current.pause(); suddenDeathAudioRef.current.src = '' }
      if (popAudioRef.current) { popAudioRef.current.pause(); popAudioRef.current.src = '' }
      if (tickingAudioRef.current) { tickingAudioRef.current.src = '' }
      if (countdownAudioRef.current) { countdownAudioRef.current.src = '' }
      socket.disconnect()
      socketRef.current = null
      clearInterval(timerRef.current)
      clearInterval(cooldownRef.current)
      document.removeEventListener('click', unlockAudio)
      document.removeEventListener('touchstart', unlockAudio)
    }
  }, [myUsername, instanceId])
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  const sendMessage = () => {
    if (!input.trim() || cooldown > 0 || status !== 'active' || !socketRef.current || !connected || isSpectator) return
    const text = input.trim()
    setMessages(prev => [...prev, {
      id: `pending-${Date.now()}`,
      username: myUsername, text, score: 0, aiFeedback: '',
      timestamp: Date.now(), pending: true,
    }])
    socketRef.current.emit('send_message', { instanceId, username: myUsername, text })
    setInput('')
    setCooldown(cooldownTime)
    clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => { if (prev <= 1) { clearInterval(cooldownRef.current); return 0 } return prev - 1 })
    }, 1000)
  }

  const handleLeaveClick = () => {
    if (gameStarted && status === 'active' && !isSpectator) setShowLeaveWarning(true)
    else { stopLobbyMusic(); router.push('/rebut') }
  }

  // ── EXPIRED ──
  if (status === 'expired') return (
    <>
      <Nav active="rebut" />
      <div style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>💨</div>
          <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '32px', letterSpacing: '2px', marginBottom: '8px' }}>ROOM EXPIRED</div>
          <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '28px', lineHeight: 1.6 }}>{expiredMsg || 'Not enough players joined in time.'}</div>
          <button onClick={() => router.push('/rebut')} style={{ background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '12px 28px', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Back to Lobby
          </button>
        </div>
      </div>
    </>
  )

  // ── ENDED ──
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
              {isSpectator && <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>You watched as a spectator</div>}
             {forfeitInfo && (
                <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--red)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '8px 14px' }}>
                  🏳️ {forfeitInfo.username} forfeited the debate
                </div>
              )}
              {isDraw && (
                <div style={{ marginTop: '10px', fontSize: '13px', color: '#ffd60a', background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.25)', borderRadius: '8px', padding: '8px 14px' }}>
                  🤝 Both players tied twice — it's a draw! No ELO gained or lost.
                </div>
              )}
            </div>

            {eloChange !== null && !isSpectator && (
              <div style={{ background: eloChange >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${eloChange >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '12px', padding: '14px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
                  Placement: <b style={{ color: 'var(--text)' }}>#{myPlace + 1} of {final.length}</b>
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
                  <Avatar username={p.username} size={32} fallbackGrad={`hsl(${i * 60 + 10}, 65%, 55%)`} avatarUrl={playerAvatars[p.username]} />
                  <div style={{ flex: 1, fontSize: '14px', fontWeight: p.username === myUsername ? 600 : 400 }}>
                    {p.username}
                    {p.username === myUsername && !isSpectator && <span style={{ fontSize: '11px', color: 'var(--accent)', marginLeft: '6px' }}>(you)</span>}
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

  // ── WAITING / STARTING ──
  if (status === 'waiting' || status === 'starting') return (
    <>
      <Nav active="rebut" />
      <div style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '480px', width: '100%' }}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>{roomInfo?.emoji ?? '💬'}</div>
          <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '30px', letterSpacing: '2px', marginBottom: '8px' }}>
            {status === 'starting' ? 'DEBATE STARTING!' : 'WAITING FOR PLAYERS'}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '28px', lineHeight: 1.6 }}>{roomInfo?.topic}</div>

          {status === 'starting' ? (
            <>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '96px', color: '#8b0000', lineHeight: 1, marginBottom: '16px', animation: 'pulse 0.6s infinite', textShadow: '0 0 30px rgba(200,0,0,0.9), 0 0 60px rgba(180,0,0,0.6), 0 0 90px rgba(150,0,0,0.4)' }}>
                {startCountdown}
              </div>
              <div style={{ background: 'rgba(120,0,0,0.3)', border: '1px solid rgba(200,0,0,0.6)', borderRadius: '10px', padding: '10px 16px', marginBottom: '20px', fontSize: '12px', color: '#ff4444', lineHeight: 1.6, boxShadow: '0 0 18px rgba(200,0,0,0.4), inset 0 0 12px rgba(180,0,0,0.2)' }}>
                ⚠️ Leaving from this point will result in an ELO loss
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '52px', color: lobbyCountdown <= 30 ? 'var(--accent)' : 'var(--text)', marginBottom: '6px', letterSpacing: '2px' }}>
                {fmt(lobbyCountdown)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '24px' }}>
                {players.length < 2 ? `Need ${2 - players.length} more player to start` : '✓ Ready to start when timer ends'}
              </div>
            </>
          )}

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
              Players in Lobby ({players.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              {players.map((p, i) => (
                <div key={p.username} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface2)', border: `1px solid ${p.username === myUsername ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '10px', padding: '7px 12px', boxShadow: p.username === myUsername ? '0 0 10px rgba(230,57,70,0.15)' : 'none' }}>
                  <Avatar username={p.username} size={26} fallbackGrad={`hsl(${i * 60}, 65%, 55%)`} avatarUrl={playerAvatars[p.username]} />
                  <span style={{ fontSize: '13px', color: p.username === myUsername ? 'var(--text)' : 'var(--text2)' }}>
                    {p.username}
                    {p.username === myUsername && <span style={{ fontSize: '10px', color: 'var(--accent)', marginLeft: '4px' }}>(you)</span>}
                  </span>
                </div>
              ))}
              {players.length === 0 && <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Waiting for others to join...</div>}
            </div>
          </div>

          {/* Lobby chat */}
          {players.length >= 1 && (
            <div style={{ width: '100%', marginTop: '8px', marginBottom: '8px' }}>
              {/* Speech bubbles */}
              <div style={{ minHeight: '60px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {lobbyMessages.map(msg => {
                  const isMe = msg.username === myUsername
                  return (
                    <div key={msg.id} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', justifyContent: isMe ? 'flex-end' : 'flex-start', animation: 'lobbyFadeIn 0.3s ease' }}>
                      {!isMe && (
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {msg.username.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div style={{ maxWidth: '70%' }}>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '3px', textAlign: isMe ? 'right' : 'left' }}>{msg.username}</div>
                        <div style={{ background: isMe ? 'rgba(230,57,70,0.15)' : 'var(--surface)', border: `1px solid ${isMe ? 'rgba(230,57,70,0.3)' : 'var(--border)'}`, borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', padding: '8px 12px', fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>
                          {msg.text}
                        </div>
                      </div>
                      {isMe && (
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),#ff8c69)', border: '1px solid rgba(230,57,70,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {myUsername.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* Input */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '8px 12px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),#ff8c69)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {myUsername.slice(0, 2).toUpperCase()}
                </div>
                <input
                  value={lobbyInput}
                  onChange={e => setLobbyInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && lobbyInput.trim() && socketRef.current) {
                      socketRef.current.emit('lobby_chat', { instanceId, username: myUsername, text: lobbyInput.trim() })
                      setLobbyInput('')
                    }
                  }}
                  placeholder="Say a few words to your opponent..."
                  maxLength={200}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}
                />
                <button
                  onClick={() => {
                    if (lobbyInput.trim() && socketRef.current) {
                      socketRef.current.emit('lobby_chat', { instanceId, username: myUsername, text: lobbyInput.trim() })
                      setLobbyInput('')
                    }
                  }}
                  style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '6px 12px', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}
                >
                  Send
                </button>
              </div>
            </div>
          )}

          <button onClick={handleLeaveClick} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 20px', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Leave Room
          </button>
        </div>
      </div>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes lobbyFadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </>
  )

  // ── ACTIVE DEBATE ──
  return (
    <>
      {showLeaveWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(6px)' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '16px', padding: '32px', maxWidth: '380px', width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '2px', color: 'var(--red)', marginBottom: '8px' }}>FORFEIT DEBATE?</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7, marginBottom: '24px' }}>
              Leaving now counts as a forfeit. You will <b style={{ color: 'var(--red)' }}>lose ELO</b> and your opponent wins automatically.
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowLeaveWarning(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Stay & Fight
              </button>
              <button onClick={() => { setShowLeaveWarning(false); stopLobbyMusic(); router.push('/rebut') }} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--red)', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Leave & Forfeit
              </button>
            </div>
          </div>
        </div>
      )}

      <Nav active="rebut" />
      <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '18px' }}>{roomInfo?.emoji}</span>
            <div style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{roomInfo?.topic}</div>
            {isSpectator && (
              <div style={{ background: 'rgba(155,89,182,0.15)', border: '1px solid rgba(155,89,182,0.3)', borderRadius: '20px', padding: '2px 10px', fontSize: '11px', color: '#c39bd3', fontWeight: 600 }}>
                👁 Spectating
              </div>
            )}
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
              {connected ? `${players.length} debating` : 'Reconnecting...'}
            </span>
            {!isSpectator && (
              <button onClick={handleLeaveClick} style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 12px', color: 'var(--red)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                🏳️ Forfeit
              </button>
            )}
          </div>
        </div>

       {/* Sudden Death Banner */}
        {suddenDeath && (
          <div style={{ background: 'linear-gradient(135deg, rgba(255,0,0,0.15), rgba(180,0,0,0.1))', borderBottom: '2px solid rgba(255,50,0,0.7)', padding: '10px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'sdFlicker 0.8s ease-in-out infinite' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>⚡</span>
              <div>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '15px', letterSpacing: '3px', color: '#ff3300' }}>
                  SUDDEN DEATH{suddenDeathRound > 1 ? ` — ROUND ${suddenDeathRound}` : ''}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,120,80,0.9)' }}>
                  {suddenDeathPhase === 'first'
                    ? `${suddenDeathFirst} is arguing — ${suddenDeathTimeLeft}s left`
                    : suddenDeathPhase === 'cooldown'
                    ? `${suddenDeathSecond} gets ready in ${suddenDeathCooldown}s...`
                    : suddenDeathPhase === 'second'
                    ? `${suddenDeathSecond} is arguing — ${suddenDeathTimeLeft}s left`
                    : 'Calculating winner...'}
                </div>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '32px', color: '#ff3300', letterSpacing: '2px', textShadow: '0 0 16px rgba(255,50,0,0.7)' }}>
              {suddenDeathPhase === 'cooldown' ? suddenDeathCooldown : suddenDeathTimeLeft}
            </div>
          </div>
        )}

        {/* Score bar */}
        <div style={{ display: 'flex', gap: '8px', padding: '8px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
          {sortedPlayers.map((p, i) => (
            <div key={p.username} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface2)', border: `1px solid ${p.username === myUsername && !isSpectator ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', padding: '5px 10px', flexShrink: 0 }}>
              <Avatar username={p.username} size={20} fallbackGrad={`hsl(${i * 60 + 10}, 65%, 55%)`} avatarUrl={playerAvatars[p.username]} />
              <span style={{ fontSize: '11px', color: p.username === myUsername && !isSpectator ? 'var(--text)' : 'var(--muted)' }}>
                {p.username === myUsername && !isSpectator ? 'You' : p.username}
              </span>
              <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '13px', color: p.username === myUsername && !isSpectator ? 'var(--gold)' : 'var(--text2)', letterSpacing: '0.5px' }}>
                {p.score > 0 ? '+' : ''}{p.score}
              </span>
            </div>
          ))}
        </div>

      {/* Chat */}
        <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', background: suddenDeath ? 'linear-gradient(180deg, rgba(180,0,0,0.07) 0%, transparent 50%)' : 'transparent', transition: 'background 1s' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', marginTop: '40px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>{isSpectator ? '👁' : '⚡'}</div>
              {isSpectator ? 'Watching the debate...' : 'Debate started! Make your first argument.'}
            </div>
          )}

          {messages.map(msg => {
            const isSystem = msg.username === '— system —'
            const isMe = msg.username === myUsername && !isSpectator
            const isPending = msg.pending === true

            if (isSystem) return (
              <div key={msg.id} style={{ textAlign: 'center', fontSize: '11px', color: msg.text.includes('NO COPY') ? 'var(--red)' : 'var(--muted)', fontWeight: msg.text.includes('NO COPY') ? 700 : 400, padding: '4px 0' }}>
                — {msg.text} —
              </div>
            )

            return (
              <div key={msg.id} style={{ display: 'flex', gap: '10px', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start', opacity: isPending ? 0.75 : 1 }}>
                <Avatar username={msg.username} size={32} fallbackGrad={isMe ? 'linear-gradient(135deg,var(--accent),#ff8c69)' : 'var(--surface2)'} avatarUrl={playerAvatars[msg.username]} />
                <div style={{ maxWidth: '72%' }}>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '3px', textAlign: isMe ? 'right' : 'left' }}>
                    {msg.username}
                  </div>
                  <div style={{ background: isMe ? 'rgba(230,57,70,0.1)' : 'var(--surface)', border: `1px solid ${isMe ? 'rgba(230,57,70,0.25)' : 'var(--border)'}`, borderRadius: '10px', padding: '10px 14px', fontSize: '13px', lineHeight: 1.6, color: 'var(--text)' }}>
                    {msg.text.split('\n').map((line, i, arr) => (
                      <span key={i}>
                        {line}
                        {i < arr.length - 1 && <br />}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    {isPending ? (
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', border: '1.5px solid var(--muted)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
                        AI scoring...
                      </span>
                    ) : (
                      <>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: msg.score > 15 ? 'rgba(34,197,94,0.15)' : msg.score > 8 ? 'rgba(34,197,94,0.08)' : msg.score > 0 ? 'rgba(100,100,100,0.1)' : 'rgba(239,68,68,0.1)', color: msg.score > 15 ? 'var(--green)' : msg.score > 8 ? '#7dd3a8' : msg.score > 0 ? 'var(--muted)' : 'var(--red)', border: msg.score >= 25 ? '1px solid rgba(34,197,94,0.3)' : 'none' }}>
                          {msg.score > 0 ? '+' : ''}{msg.score} pts{msg.score >= 25 && ' 🔥'}{msg.score >= 28 && ' 🏆'}
                        </span>
                        {msg.aiFeedback && (
                          <span style={{ fontSize: '11px', color: 'var(--blue)', lineHeight: 1.5 }}>
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
        {isSpectator ? (
          <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '16px 20px', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>👁 You are spectating — arguments are scored in real time</div>
            <button onClick={() => router.push('/rebut')} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 20px', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              ← Back to Lobby
            </button>
          </div>
        ) : (
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
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                }}
                onPaste={e => {
                  e.preventDefault()
                }}
                disabled={!connected || (suddenDeath && suddenDeathPhase === 'first' && suddenDeathFirst !== myUsername) || (suddenDeath && suddenDeathPhase === 'second' && suddenDeathSecond !== myUsername) || (suddenDeath && suddenDeathPhase === 'cooldown')}
                placeholder={
                  !connected ? 'Reconnecting...' :
                  suddenDeath && suddenDeathPhase === 'cooldown' ? 'Wait for your turn...' :
                  suddenDeath && suddenDeathPhase === 'first' && suddenDeathFirst !== myUsername ? 'Wait — opponent is arguing...' :
                  suddenDeath && suddenDeathPhase === 'second' && suddenDeathSecond !== myUsername ? 'Wait — opponent is arguing...' :
                  suddenDeath ? '⚡ SUDDEN DEATH — argue now!' :
                  cooldown > 0 ? 'Type your next argument — sends when cooldown ends...' :
                  'Make your argument. Shift+Enter for new lines.'
                }
                rows={3}
                style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text)', fontSize: '13px', outline: 'none', opacity: cooldown > 0 ? 0.5 : 1, fontFamily: 'DM Sans, sans-serif', resize: 'none', lineHeight: 1.5 }}
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
        )}
      </div>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes sdFlicker { 0%,100%{ box-shadow: 0 2px 12px rgba(255,50,0,0.3); border-color: rgba(255,50,0,0.7); } 50%{ box-shadow: 0 2px 24px rgba(255,80,0,0.5); border-color: rgba(255,100,0,1); } }
      `}</style>
    </>
  )
}