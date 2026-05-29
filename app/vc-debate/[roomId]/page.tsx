'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Nav from '../../components/Nav'
import { useRouter } from 'next/navigation'

interface Player { username: string; score: number; elo: number }
interface TranscriptEntry {
  id: string
  username: string
  text: string
  score: number
  aiFeedback: string
  timestamp: number
  turnNumber: number
}
interface VCRoomInfo {
  instanceId: string
  topic: string
  emoji: string
  duration: number
  status: string
  countdown: number
  players: Player[]
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}

// ── Audio Visualizer Bar ──────────────────────────────────────
function AudioBar({ analyser, active, color = '#e63946' }: { analyser: AnalyserNode | null; active: boolean; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!analyser || !active || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height
        ctx.fillStyle = color
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
        x += barWidth + 1
      }
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser, active, color])

  if (!active) return (
    <div style={{ height: '40px', display: 'flex', alignItems: 'center', gap: '3px', padding: '0 4px' }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{ width: '3px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px' }} />
      ))}
    </div>
  )

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={40}
      style={{ display: 'block', borderRadius: '4px' }}
    />
  )
}

// ── Speech Recognition Hook ───────────────────────────────────
function useSpeechRecognition(onTranscriptUpdate: (t: string) => void) {
  const recognitionRef = useRef<any>(null)
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const transcriptRef = useRef('')

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      setSupported(true)
      const rec = new SpeechRecognition()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'
      rec.onresult = (e: any) => {
        let final = ''
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript
          else interim += e.results[i][0].transcript
        }
        if (final) transcriptRef.current += ' ' + final
        onTranscriptUpdate((transcriptRef.current + interim).trim())
      }
      rec.onerror = (e: any) => { console.warn('Speech recognition error:', e.error); setListening(false) }
      rec.onend = () => setListening(false)
      recognitionRef.current = rec
    }
  }, [])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return
    transcriptRef.current = ''
    onTranscriptUpdate('')
    try { recognitionRef.current.start() } catch (e) {}
    setListening(true)
  }, [])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return
    try { recognitionRef.current.stop() } catch (e) {}
    setListening(false)
  }, [])

  const getTranscript = useCallback(() => transcriptRef.current.trim(), [])
  return { supported, listening, startListening, stopListening, getTranscript }
}

// ── WebRTC Hook ───────────────────────────────────────────────
function useWebRTC(socketRef: React.MutableRefObject<Socket | null>, roomId: string) {
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const localAnalyserRef = useRef<AnalyserNode | null>(null)
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const [micGranted, setMicGranted] = useState(false)
  const [remoteAudioActive, setRemoteAudioActive] = useState(false)

  const initMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false })
      localStreamRef.current = stream
      setMicGranted(true)

      // Set up local audio analyser for visualizer
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)
      localAnalyserRef.current = analyser

      return stream
    } catch (e) {
      console.error('Mic access denied:', e)
      return null
    }
  }, [])

  const createPeer = useCallback((isInitiator: boolean) => {
    // Close any existing peer
    if (peerRef.current) {
      peerRef.current.close()
      peerRef.current = null
    }

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
      ]
    })

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peer.addTrack(track, localStreamRef.current!)
      })
    }

    peer.ontrack = (e) => {
      console.log('🔊 Got remote audio track')
      const remoteStream = e.streams[0]

      // Create or reuse audio element
      if (!remoteAudioRef.current) {
        const audio = document.createElement('audio')
        audio.autoplay = true
        audio.muted = false
        audio.volume = 1.0
        audio.style.position = 'fixed'
        audio.style.bottom = '-100px'
        document.body.appendChild(audio)
        remoteAudioRef.current = audio
      }

      remoteAudioRef.current.srcObject = remoteStream
      const playPromise = remoteAudioRef.current.play()
      if (playPromise) {
        playPromise.catch(() => {
          // Retry on next user interaction
          const retry = () => { remoteAudioRef.current?.play().catch(() => {}); document.removeEventListener('click', retry) }
          document.addEventListener('click', retry)
        })
      }

      // Set up remote audio analyser for visualizer
      if (audioCtxRef.current) {
        const remoteSource = audioCtxRef.current.createMediaStreamSource(remoteStream)
        const remoteAnalyser = audioCtxRef.current.createAnalyser()
        remoteAnalyser.fftSize = 64
        remoteSource.connect(remoteAnalyser)
        remoteAnalyserRef.current = remoteAnalyser
      }

      setRemoteAudioActive(true)
    }

    peer.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit('vc_ice_candidate', { instanceId: roomId, candidate: e.candidate })
      }
    }

    peer.onconnectionstatechange = () => {
      console.log('🔗 Peer connection state:', peer.connectionState)
    }

    peer.onicegatheringstatechange = () => {
      console.log('🧊 ICE gathering state:', peer.iceGatheringState)
    }

    peerRef.current = peer

    if (isInitiator) {
      peer.createOffer({ offerToReceiveAudio: true }).then(offer => {
        peer.setLocalDescription(offer)
        socketRef.current?.emit('vc_offer', { instanceId: roomId, offer })
      }).catch(e => console.error('Create offer error:', e))
    }

    return peer
  }, [roomId])

  const cleanup = useCallback(() => {
    peerRef.current?.close()
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
      remoteAudioRef.current.remove()
      remoteAudioRef.current = null
    }
    audioCtxRef.current?.close()
    peerRef.current = null
    localStreamRef.current = null
    localAnalyserRef.current = null
    remoteAnalyserRef.current = null
  }, [])

  // Enable or disable mic track (doesn't stop it, just mutes)
  const setMicActive = useCallback((active: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach(track => {
      track.enabled = active
    })
  }, [])

return { micGranted, remoteAudioActive, initMic, createPeer, peerRef, cleanup, setMicActive, localAnalyserRef, remoteAnalyserRef, localStreamRef }}

// ── Main Component ────────────────────────────────────────────
export default function VCDebatePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const instanceId = params.roomId as string
  const guestParam = searchParams.get('guest')

  const [myUsername, setMyUsername] = useState('')
  const [myElo, setMyElo] = useState(0)
  const [mySocketId, setMySocketId] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [roomInfo, setRoomInfo] = useState<VCRoomInfo | null>(null)
  const [status, setStatus] = useState<'waiting' | 'starting' | 'active' | 'ended' | 'expired'>('waiting')
  const [players, setPlayers] = useState<Player[]>([])
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [startCountdown, setStartCountdown] = useState(10)
  const [lobbyCountdown, setLobbyCountdown] = useState(1200)
  const [timeLeft, setTimeLeft] = useState(0)
  const [connected, setConnected] = useState(false)
  const [currentSpeakerUsername, setCurrentSpeakerUsername] = useState<string | null>(null)
  const [isMyTurn, setIsMyTurn] = useState(false)
  const [turnTimeLeft, setTurnTimeLeft] = useState(30)
  const [inCooldown, setInCooldown] = useState(false)
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [turnNumber, setTurnNumber] = useState(0)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [turnEnded, setTurnEnded] = useState(false)
  const [paidToGoFirst, setPaidToGoFirst] = useState<string | null>(null)
  const [canOverride, setCanOverride] = useState(false)
  const [standings, setStandings] = useState<Player[]>([])
  const [eloChange, setEloChange] = useState<number | null>(null)
  const [showForfeitModal, setShowForfeitModal] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null)
  const tickingAudioRef = useRef<HTMLAudioElement | null>(null)
  const lobbyAudioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<any>(null)
  const turnTimerRef = useRef<any>(null)
  const cooldownTimerRef = useRef<any>(null)
  const myUsernameRef = useRef(myUsername)
  const mySocketIdRef = useRef(mySocketId)
  const profileRef = useRef(profile)
  const userRef = useRef(user)
  const turnEndedRef = useRef(false)
  const isMyTurnRef = useRef(false)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => { myUsernameRef.current = myUsername }, [myUsername])
  useEffect(() => { mySocketIdRef.current = mySocketId }, [mySocketId])
  useEffect(() => { profileRef.current = profile }, [profile])
  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { turnEndedRef.current = turnEnded }, [turnEnded])
  useEffect(() => { isMyTurnRef.current = isMyTurn }, [isMyTurn])

  const { supported: speechSupported, listening, startListening, stopListening, getTranscript } =
    useSpeechRecognition(setLiveTranscript)

  const { micGranted, remoteAudioActive, initMic, createPeer, peerRef, cleanup, setMicActive, localAnalyserRef, remoteAnalyserRef, localStreamRef } =
  useWebRTC(socketRef, instanceId)

  useEffect(() => {
    if (loading) return
    if (guestParam) { setMyUsername(guestParam); return }
    if (profile?.username) { setMyUsername(profile.username); setMyElo(profile.elo ?? 0); return }
    if (!user) setMyUsername('guest' + Math.floor(1000 + Math.random() * 9000))
  }, [loading, profile, user, guestParam])

  useEffect(() => {
    if (!myUsername) return
    countdownAudioRef.current = new Audio('/sounds/countdown.mp3')
    countdownAudioRef.current.preload = 'auto'
    tickingAudioRef.current = new Audio('/sounds/ticking.mp3')
    tickingAudioRef.current.preload = 'auto'
    lobbyAudioRef.current = new Audio('/sounds/lobby.mp3')
    lobbyAudioRef.current.preload = 'auto'
    lobbyAudioRef.current.loop = true
    lobbyAudioRef.current.volume = 0.35
    const socket = io('https://rebuttal-live-production-3388.up.railway.app', { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', async () => {
      setConnected(true)
      setMySocketId(socket.id ?? '')
      // Init mic FIRST, then join room
      await initMic()
      socket.emit('join_vc_room', { instanceId, username: myUsername, elo: myElo })
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('vc_room_info', (info: any) => {
      setRoomInfo(info); setStatus(info.status); setPlayers(info.players || []); setLobbyCountdown(info.countdown || 1200)
      if (info.status === 'waiting' || info.status === 'starting') {
        try { lobbyAudioRef.current?.play() } catch (e) {}
      }
    })

    socket.on('vc_players_update', (p: Player[]) => setPlayers(p))

    socket.on('vc_starting', ({ startCountdown: sc, players: p }: any) => {
      setStatus('starting'); setStartCountdown(sc); setPlayers(p)
    })

socket.on('vc_start_countdown_tick', ({ count }: { count: number }) => {
      setStartCountdown(count)
      if (count === 3) {
        try { lobbyAudioRef.current?.pause() } catch (e) {}
        try {
          if (countdownAudioRef.current) {
            countdownAudioRef.current.currentTime = 0
            countdownAudioRef.current.play()
          }
        } catch (e) {}
      }
    })
    socket.on('vc_debate_started', ({ firstSpeakerSocketId, firstSpeakerUsername, duration, turnDuration }: any) => {
      try { lobbyAudioRef.current?.pause() } catch (e) {}
      setStatus('active')
      setTimeLeft(duration)
      setCurrentSpeakerUsername(firstSpeakerUsername)
      setTimeLeft(duration)
      setCurrentSpeakerUsername(firstSpeakerUsername)
      const isMine = firstSpeakerSocketId === socket.id
      setIsMyTurn(isMine)
      isMyTurnRef.current = isMine
      setTurnNumber(1)
      setTurnTimeLeft(turnDuration)

      clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timerRef.current); return 0 }
          if (prev === 30) {
            try { if (tickingAudioRef.current) { tickingAudioRef.current.currentTime = 0; tickingAudioRef.current.play() } } catch (e) {}
          }
          if (prev === 4) { try { tickingAudioRef.current?.pause() } catch (e) {} }
          return prev - 1
        })
      }, 1000)

      // Keep both mics on — only mute the non-speaker
      setMicActive(isMine)
      if (isMine && speechSupported) startListening()
      startTurnTimer(turnDuration, isMine, socket)
    })

    socket.on('vc_turn_start', ({ speakerSocketId, speakerUsername, turnNumber: tn, turnDuration }: any) => {
      setInCooldown(false)
      setCurrentSpeakerUsername(speakerUsername)
      const isMine = speakerSocketId === socket.id
      setIsMyTurn(isMine)
      isMyTurnRef.current = isMine
      setTurnNumber(tn)
      setTurnTimeLeft(turnDuration)
      setTurnEnded(false)
      turnEndedRef.current = false
      setLiveTranscript('')

      // Switch mic: enable for speaker, disable for listener
      setMicActive(isMine)
      if (isMine && speechSupported) startListening()
      else stopListening()

      startTurnTimer(turnDuration, isMine, socket)
    })

    socket.on('vc_cooldown_start', ({ duration }: { duration: number }) => {
      setInCooldown(true)
      setCooldownLeft(duration)
      // DON'T mute mic during cooldown — wait for vc_turn_start to switch
      clearInterval(cooldownTimerRef.current)
      cooldownTimerRef.current = setInterval(() => {
        setCooldownLeft(prev => { if (prev <= 1) { clearInterval(cooldownTimerRef.current); return 0 } return prev - 1 })
      }, 1000)
    })

    socket.on('vc_turn_scored', ({ entry, scores: s }: any) => {
      setTranscripts(prev => [...prev, entry]); setScores(s)
    })

    socket.on('vc_go_first_update', ({ paidUsername, socketId }: any) => {
      setPaidToGoFirst(paidUsername); setCanOverride(socketId !== socket.id)
    })

    socket.on('vc_system_message', ({ text }: { text: string }) => {
      setTranscripts(prev => [...prev, { id: `sys-${Date.now()}`, username: '— system —', text, score: 0, aiFeedback: '', timestamp: Date.now(), turnNumber: 0 }])
    })

    socket.on('vc_debate_ended', async ({ standings: s, eloChanges, customStake }: any) => {
      try { lobbyAudioRef.current?.pause() } catch (e) {}
      try { tickingAudioRef.current?.pause() } catch (e) {}
      setStatus('ended')
      setStandings(s)
      cleanup()
      const currentProfile = profileRef.current
      const currentUser = userRef.current
      if (!currentProfile?.username || !currentUser) return
      const myPlace = s.findIndex((p: Player) => p.username === myUsernameRef.current)
      if (myPlace === -1) return
      let change: number
      if (customStake) {
        change = myPlace === 0 ? customStake : -customStake
      } else {
        change = myPlace === 0 ? eloChanges.winnerElo : -Math.round(eloChanges.loserBase)
      }
      setEloChange(change)
      const newElo = Math.max(0, (currentProfile.elo ?? 0) + change)
      await supabase.from('profiles').update({
        elo: newElo,
        wins: myPlace === 0 ? (currentProfile.wins ?? 0) + 1 : (currentProfile.wins ?? 0),
        debates: (currentProfile.debates ?? 0) + 1,
      }).eq('id', currentUser.id)
    })

    // WebRTC signaling
    socket.on('vc_initiate_webrtc', () => {
      console.log('🔗 Initiating WebRTC as offerer')
      createPeer(true)
    })

    socket.on('vc_offer', async ({ offer }: any) => {
      console.log('📞 Got offer, creating answer')
      const peer = createPeer(false)
      await peer.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      socket.emit('vc_answer', { instanceId, answer })
    })

    socket.on('vc_answer', async ({ answer }: any) => {
      try {
        await peerRef.current?.setRemoteDescription(new RTCSessionDescription(answer))
        console.log('✅ Remote description set')
      } catch (e) { console.error('Set remote description error:', e) }
    })

    socket.on('vc_ice_candidate', async ({ candidate }: any) => {
      try {
        if (peerRef.current?.remoteDescription) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate))
        }
      } catch (e) {}
    })

    socket.on('error', ({ message }: { message: string }) => { alert(message); router.push('/rebut') })
socket.on('vc_expired', () => { try { lobbyAudioRef.current?.pause() } catch (e) {}; setStatus('expired'); router.push('/rebut') })
    return () => {
      socket.disconnect(); cleanup()
      clearInterval(timerRef.current); clearInterval(turnTimerRef.current); clearInterval(cooldownTimerRef.current)
    }
  }, [myUsername])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [transcripts, liveTranscript])

  function startTurnTimer(duration: number, isMine: boolean, socket: Socket) {
    clearInterval(turnTimerRef.current)
    let remaining = duration
    setTurnTimeLeft(remaining)
    setTurnEnded(false)
    turnEndedRef.current = false
    turnTimerRef.current = setInterval(() => {
      remaining--
      setTurnTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(turnTimerRef.current)
        if (isMine) endMyTurn(socket)
      }
    }, 1000)
  }

  function endMyTurn(socket: Socket) {
    if (turnEndedRef.current) return
    setTurnEnded(true)
    turnEndedRef.current = true
    stopListening()
    // Wait 600ms for Web Speech API to finalize
    setTimeout(() => {
      const transcript = getTranscript()
      socket.emit('vc_turn_complete', { instanceId, transcript })
      setLiveTranscript('')
      // Mute mic AFTER submitting transcript
      setMicActive(false)
    }, 600)
  }

  const handleEndTurnEarly = () => {
    if (!isMyTurn || turnEndedRef.current || !socketRef.current) return
    clearInterval(turnTimerRef.current)
    endMyTurn(socketRef.current)
  }
const handleToggleMute = () => {
  const newMuted = !isMuted
  setIsMuted(newMuted)
  localStreamRef.current?.getAudioTracks().forEach(track => {
    track.enabled = !newMuted
  })
}
  const handleForfeit = () => {
    setShowForfeitModal(false)
    router.push('/rebut')
  }

  const opponent = players.find(p => p.username !== myUsername)
  const myScore = scores[myUsername] ?? 0
  const opponentScore = scores[opponent?.username ?? ''] ?? 0

  // ── ENDED ──
  if (status === 'ended') {
    const myPlace = standings.findIndex(p => p.username === myUsername)
    return (
      <>
        <Nav active="rebut" />
        <div style={{ minHeight: 'calc(100vh - 56px)', overflowY: 'auto', padding: '32px 24px' }}>
          <div style={{ maxWidth: '520px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎙️</div>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '40px', letterSpacing: '3px', marginBottom: '4px' }}>DEBATE OVER</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{roomInfo?.topic}</div>
            </div>
            {eloChange !== null && (
              <div style={{ background: eloChange >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${eloChange >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '12px', padding: '14px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '13px', color: 'var(--text2)' }}>Placement: <b style={{ color: 'var(--text)' }}>#{myPlace + 1} of 2</b></div>
                <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', color: eloChange >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {eloChange >= 0 ? '+' : ''}{eloChange} ELO
                </div>
              </div>
            )}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)' }}>Final Standings</div>
              {standings.map((p, i) => (
                <div key={p.username} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderBottom: i === 0 ? '1px solid var(--border)' : 'none', background: p.username === myUsername ? 'rgba(230,57,70,0.04)' : 'transparent' }}>
                  <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', width: '28px', color: i === 0 ? 'var(--gold)' : 'var(--muted)' }}>{i === 0 ? '🥇' : '🥈'}</div>
                  <div style={{ flex: 1, fontSize: '15px', fontWeight: p.username === myUsername ? 600 : 400 }}>
                    {p.username}{p.username === myUsername && <span style={{ fontSize: '11px', color: 'var(--accent)', marginLeft: '6px' }}>(you)</span>}
                  </div>
                  <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '20px', color: 'var(--accent2)' }}>{p.score} pts</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)' }}>Debate Transcript</div>
              <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {transcripts.filter(t => t.username !== '— system —').map(t => (
                  <div key={t.id} style={{ fontSize: '13px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: t.username === myUsername ? 'var(--accent)' : 'var(--text2)' }}>{t.username}</span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Turn {t.turnNumber}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: t.score > 15 ? 'var(--green)' : t.score > 8 ? '#7dd3a8' : 'var(--muted)', marginLeft: 'auto' }}>+{t.score} pts</span>
                    </div>
                    <div style={{ color: 'var(--text)', lineHeight: 1.6 }}>{t.text}</div>
                    {t.aiFeedback && <div style={{ fontSize: '11px', color: 'var(--blue)', marginTop: '3px' }}>🤖 {t.aiFeedback}</div>}
                  </div>
                ))}
              </div>
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
          <div style={{ fontSize: '52px', marginBottom: '12px' }}>🎙️</div>
          <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '28px', letterSpacing: '2px', marginBottom: '4px' }}>
            {status === 'starting' ? 'GET READY!' : 'WAITING FOR OPPONENT'}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '24px' }}>{roomInfo?.topic}</div>
          {status === 'starting' ? (
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '96px', color: 'var(--accent)', lineHeight: 1, marginBottom: '20px' }}>{startCountdown}</div>
          ) : (
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '52px', color: 'var(--text)', marginBottom: '16px' }}>{fmt(lobbyCountdown)}</div>
          )}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
  <div style={{ fontSize: '13px', color: micGranted ? 'var(--green)' : 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
    <span>{micGranted ? '✅' : '⚠️'}</span>
    {micGranted ? 'Microphone ready' : 'Microphone access required — please allow when prompted'}
  </div>
  {micGranted && (
    <button onClick={handleToggleMute} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isMuted ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.1)', border: `1px solid ${isMuted ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.3)'}`, borderRadius: '10px', padding: '8px 18px', color: isMuted ? 'var(--red)' : 'var(--green)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
      <span style={{ fontSize: '16px' }}>{isMuted ? '🎙️✕' : '🎙️'}</span>
      {isMuted ? 'Unmute Mic' : 'Mute Mic'}
    </button>
  )}
</div>
            {!speechSupported && <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>⚠️ Speech recognition not supported. Try Chrome or Edge.</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
            {players.map((p) => (
              <div key={p.username} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: p.username === myUsername ? 'linear-gradient(135deg,var(--accent),#ff8c69)' : 'var(--surface2)', border: `2px solid ${p.username === myUsername ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                  {p.username.slice(0, 2).toUpperCase()}
                </div>
                <span style={{ fontSize: '13px', color: p.username === myUsername ? 'var(--text)' : 'var(--text2)' }}>
                  {p.username}{p.username === myUsername && <span style={{ color: 'var(--accent)', fontSize: '10px', marginLeft: '4px' }}>(you)</span>}
                </span>
              </div>
            ))}
            {players.length === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--surface2)', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>?</div>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Waiting...</span>
              </div>
            )}
          </div>
          {status === 'starting' && players.length === 2 && (
            <div style={{ background: 'rgba(255,214,10,0.06)', border: '1px solid rgba(255,214,10,0.2)', borderRadius: '12px', padding: '14px 20px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--gold)', fontWeight: 600, marginBottom: '8px' }}>⚡ Go First?</div>
              {!paidToGoFirst ? (
                <button onClick={() => socketRef.current?.emit('vc_pay_to_go_first', { instanceId })} style={{ background: 'rgba(255,214,10,0.15)', border: '1px solid rgba(255,214,10,0.4)', borderRadius: '8px', padding: '8px 20px', color: 'var(--gold)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  Go First (Free for now)
                </button>
              ) : paidToGoFirst === myUsername ? (
                <div style={{ fontSize: '13px', color: 'var(--green)' }}>✓ You're going first</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{paidToGoFirst} is going first</div>
                  {canOverride && (
                    <button onClick={() => socketRef.current?.emit('vc_override_go_first', { instanceId })} style={{ background: 'rgba(230,57,70,0.15)', border: '1px solid rgba(230,57,70,0.4)', borderRadius: '8px', padding: '8px 20px', color: 'var(--accent)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      Override — Go First Instead
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <button onClick={() => router.push('/rebut')} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 20px', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Leave
          </button>
        </div>
      </div>
    </>
  )

  // ── ACTIVE DEBATE ──
  return (
    <>
      <Nav active="rebut" />

      {showForfeitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(6px)', padding: '16px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '16px', padding: '32px', maxWidth: '380px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '2px', color: 'var(--red)', marginBottom: '8px' }}>FORFEIT DEBATE?</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7, marginBottom: '24px' }}>
              Leaving counts as a forfeit. You will <b style={{ color: 'var(--red)' }}>lose ELO</b> and your opponent wins automatically.
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowForfeitModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Stay & Fight</button>
              <button onClick={handleForfeit} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--red)', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Leave & Forfeit</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '18px' }}>🎙️</span>
            <div style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}>{roomInfo?.topic}</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '26px', color: timeLeft < 30 ? 'var(--red)' : 'var(--accent)' }}>{fmt(timeLeft)}</div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{myUsername} (you) — {myScore} pts</span>
              <span style={{ color: 'var(--text2)' }}>{opponent?.username} — {opponentScore} pts</span>
            </div>
            <div style={{ height: '6px', background: 'var(--surface2)', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
              {(myScore + opponentScore) > 0 && (
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(myScore / (myScore + opponentScore)) * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent2))', borderRadius: '3px', transition: 'width 0.5s' }} />
              )}
            </div>
          </div>
        </div>

        {/* Audio visualizers */}
        <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border)', padding: '10px 20px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          {/* My audio bar */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '10px', color: isMyTurn ? 'var(--accent)' : 'var(--muted)', fontWeight: 600, letterSpacing: '1px' }}>
              {isMyTurn ? '🎙️ YOU — SPEAKING' : '🔇 YOU — MUTED'}
            </div>
            <div style={{ background: 'rgba(230,57,70,0.06)', border: `1px solid ${isMyTurn ? 'rgba(230,57,70,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '8px', padding: '4px 8px', height: '48px', display: 'flex', alignItems: 'center' }}>
              <AudioBar analyser={localAnalyserRef.current} active={isMyTurn && !inCooldown} color="#e63946" />
            </div>
          </div>

          <div style={{ fontSize: '18px', flexShrink: 0 }}>⚔️</div>

          {/* Opponent audio bar */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '10px', color: !isMyTurn && !inCooldown ? 'var(--green)' : 'var(--muted)', fontWeight: 600, letterSpacing: '1px', textAlign: 'right' }}>
              {!isMyTurn && !inCooldown ? `🎙️ ${opponent?.username ?? 'OPPONENT'} — SPEAKING` : `🔇 ${opponent?.username ?? 'OPPONENT'} — MUTED`}
            </div>
            <div style={{ background: 'rgba(34,197,94,0.06)', border: `1px solid ${!isMyTurn && !inCooldown ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '8px', padding: '4px 8px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <AudioBar analyser={remoteAnalyserRef.current} active={!isMyTurn && !inCooldown && remoteAudioActive} color="#22c55e" />
            </div>
          </div>
        </div>

        {/* Turn indicator */}
        <div style={{ background: isMyTurn ? 'rgba(230,57,70,0.08)' : 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)', padding: '12px 20px', flexShrink: 0, textAlign: 'center' }}>
          {inCooldown ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Switching speakers in...</div>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '28px', color: 'var(--text2)', letterSpacing: '2px' }}>{cooldownLeft}</div>
              <button onClick={() => setShowForfeitModal(true)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '4px 12px', color: 'var(--red)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginTop: '4px' }}>🏳️ Forfeit</button>
            </div>
          ) : isMyTurn ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s infinite' }} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>YOUR TURN — SPEAK NOW</span>
              </div>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '48px', color: turnTimeLeft <= 10 ? 'var(--red)' : 'var(--accent)', letterSpacing: '2px', lineHeight: 1 }}>
                {turnTimeLeft}s
              </div>
              <button onClick={handleEndTurnEarly} style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.3)', borderRadius: '8px', padding: '6px 16px', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Done Speaking Early
              </button>
              <button onClick={handleToggleMute} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: isMuted ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isMuted ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius: '8px', padding: '6px 16px', color: isMuted ? 'var(--red)' : 'rgba(255,255,255,0.6)', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
  <span>{isMuted ? '🎙️✕' : '🎙️'}</span>
  {isMuted ? 'Unmute' : 'Mute'}
</button>
              <button onClick={() => setShowForfeitModal(true)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '5px 14px', color: 'var(--red)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                🏳️ Forfeit & Leave
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1s infinite' }} />
                <span style={{ fontSize: '14px', color: 'var(--text2)' }}>{currentSpeakerUsername} is speaking...</span>
              </div>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '36px', color: 'var(--text2)', letterSpacing: '2px' }}>{turnTimeLeft}s</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Listen carefully — you'll respond next</div>
              <button onClick={() => setShowForfeitModal(true)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '4px 12px', color: 'var(--red)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginTop: '4px' }}>
                🏳️ Forfeit
              </button>
            </div>
          )}
        </div>

        {/* Live transcript */}
        {isMyTurn && liveTranscript && !inCooldown && (
          <div style={{ background: 'rgba(230,57,70,0.04)', borderBottom: '1px solid rgba(230,57,70,0.2)', padding: '10px 20px', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '4px', fontWeight: 600 }}>🎙️ LIVE TRANSCRIPT</div>
            <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.6, fontStyle: 'italic' }}>"{liveTranscript}"</div>
          </div>
        )}

        {/* Transcripts feed */}
        <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {transcripts.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', marginTop: '40px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎙️</div>
              Voice debate started. {isMyTurn ? 'You go first — speak now!' : `${currentSpeakerUsername} goes first.`}
            </div>
          )}
          {transcripts.map(t => {
            if (t.username === '— system —') return (
              <div key={t.id} style={{ textAlign: 'center', fontSize: '11px', color: 'var(--muted)', padding: '4px 0' }}>— {t.text} —</div>
            )
            const isMe = t.username === myUsername
            return (
              <div key={t.id} style={{ display: 'flex', gap: '10px', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isMe ? 'linear-gradient(135deg,var(--accent),#ff8c69)' : 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {t.username.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ maxWidth: '75%' }}>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '3px', textAlign: isMe ? 'right' : 'left' }}>{t.username} · Turn {t.turnNumber}</div>
                  <div style={{ background: isMe ? 'rgba(230,57,70,0.1)' : 'var(--surface)', border: `1px solid ${isMe ? 'rgba(230,57,70,0.25)' : 'var(--border)'}`, borderRadius: '10px', padding: '10px 14px', fontSize: '13px', lineHeight: 1.6 }}>{t.text}</div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '5px', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: t.score > 15 ? 'rgba(34,197,94,0.15)' : t.score > 8 ? 'rgba(34,197,94,0.08)' : 'rgba(100,100,100,0.1)', color: t.score > 15 ? 'var(--green)' : t.score > 8 ? '#7dd3a8' : 'var(--muted)' }}>
                      +{t.score} pts{t.score >= 25 && ' 🔥'}
                    </span>
                    {t.aiFeedback && <span style={{ fontSize: '11px', color: 'var(--blue)' }}>🤖 {t.aiFeedback}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom status */}
        <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '10px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--red)' }} />
              {connected ? (isMyTurn ? '🎙️ Your mic is live' : '🔇 Mic muted — listening') : 'Reconnecting...'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Turn {turnNumber} · Voice Debate</div>
            <div style={{ fontSize: '12px', color: remoteAudioActive ? 'var(--green)' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {remoteAudioActive ? (
                <><div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1s infinite' }} /> Audio live</>
              ) : '⏳ Connecting audio...'}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </>
  )
}