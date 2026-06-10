'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Nav from '../../components/Nav'
import { useRouter } from 'next/navigation'
import AgoraRTC from 'agora-rtc-sdk-ng'
import type { IAgoraRTCClient, ILocalAudioTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng'

function getTierName(elo: number): string {
  if (elo >= 1000) return 'Rebutter'
  if (elo >= 700) return 'Competitive Debater'
  if (elo >= 500) return 'Debater'
  if (elo >= 400) return 'Competitive Arguer'
  if (elo >= 300) return 'Arguer'
  if (elo >= 200) return 'Competitive Talker'
  if (elo >= 100) return 'Casual Talker'
  if (elo >= 0) return 'Incompetent'
  return 'Incompetent'
}
const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID!
const SERVER_URL = 'https://rebuttal-live-production-3388.up.railway.app'

interface Player { username: string; score: number; elo: number }
interface TranscriptEntry {
  id: string; username: string; text: string; score: number
  aiFeedback: string; timestamp: number; turnNumber: number
}
interface VCRoomInfo {
  instanceId: string; topic: string; emoji: string
  duration: number; status: string; countdown: number; players: Player[]
  createdBy?: string
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
  return <canvas ref={canvasRef} width={120} height={40} style={{ display: 'block', borderRadius: '4px' }} />
}

// ── Speech Recognition Hook ───────────────────────────────────
function useSpeechRecognition(onTranscriptUpdate: (t: string) => void) {
  const [listening, setListening] = useState(false)
  const finalTranscriptRef = useRef('')
  const recognitionRef = useRef<any>(null)
  const onTranscriptUpdateRef = useRef(onTranscriptUpdate)
  useEffect(() => { onTranscriptUpdateRef.current = onTranscriptUpdate }, [onTranscriptUpdate])

  const startListening = useCallback(() => {
    finalTranscriptRef.current = ''
    onTranscriptUpdateRef.current('')
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch (e) {} }
    try {
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'
      rec.onresult = (e: any) => {
        let final = '', interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript
          else interim += e.results[i][0].transcript
        }
        if (final) finalTranscriptRef.current += ' ' + final
        onTranscriptUpdateRef.current((finalTranscriptRef.current + interim).trim())
      }
      rec.onerror = () => {}
      rec.onend = () => setListening(false)
      rec.start()
      recognitionRef.current = rec
      setListening(true)
    } catch (e) {}
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch (e) {} }
    recognitionRef.current = null
    setListening(false)
  }, [])

  return { listening, startListening, stopListening, finalTranscriptRef }
}

// ── Main Component ────────────────────────────────────────────
export default function VCDebatePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const instanceId = params.roomId as string
  const guestParam = searchParams.get('guest')
const passwordParam = searchParams.get('password')
const agoraInitializedRef = useRef(false)
  const [myUsername, setMyUsername] = useState('')
  const [myElo, setMyElo] = useState(0)
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
  const [opponentLiveTranscript, setOpponentLiveTranscript] = useState('')
  const [turnEnded, setTurnEnded] = useState(false)
  const [paidToGoFirst, setPaidToGoFirst] = useState<string | null>(null)
  const [canOverride, setCanOverride] = useState(false)
  const [standings, setStandings] = useState<Player[]>([])
  const [eloChange, setEloChange] = useState<number | null>(null)
  const [showForfeitModal, setShowForfeitModal] = useState(false)
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null)
  const [opponentAvatarUrl, setOpponentAvatarUrl] = useState<string | null>(null)
  const [voiceReady, setVoiceReady] = useState(false)
  const [remoteAudioActive, setRemoteAudioActive] = useState(false)
  const [remoteAnalyserReady, setRemoteAnalyserReady] = useState(false)
const [micGranted, setMicGranted] = useState(false)
  const [audioTooLow, setAudioTooLow] = useState(false)
 const [suddenDeath, setSuddenDeath] = useState(false)
  const [suddenDeathRound, setSuddenDeathRound] = useState(0)
  const [isDraw, setIsDraw] = useState(false)
 const suddenDeathAudioRef = useRef<HTMLAudioElement | null>(null)
  const popAudioRef = useRef<HTMLAudioElement | null>(null)

  // Agora refs
  const agoraClientRef = useRef<IAgoraRTCClient | null>(null)
  const localAudioTrackRef = useRef<ILocalAudioTrack | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const localAnalyserRef = useRef<AnalyserNode | null>(null)
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)// Don't leave Agora here — only leave on debate end or forfeit
  // Other refs
  const socketRef = useRef<Socket | null>(null)
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null)
  const lobbyAudioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const turnTimerRef = useRef<any>(null)
  const cooldownTimerRef = useRef<any>(null)
  const myUsernameRef = useRef(myUsername)
  const agoraUidRef = useRef<number>(0)
  const profileRef = useRef(profile)
  const userRef = useRef(user)
  const turnEndedRef = useRef(false)
  const isMyTurnRef = useRef(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const speakingIntervalRef = useRef<any>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [opponentSpeaking, setOpponentSpeaking] = useState(false)
  const [scoringUsername, setScoringUsername] = useState<string | null>(null)

  useEffect(() => { myUsernameRef.current = myUsername }, [myUsername])
  useEffect(() => { profileRef.current = profile }, [profile])
  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { turnEndedRef.current = turnEnded }, [turnEnded])
  useEffect(() => { isMyTurnRef.current = isMyTurn }, [isMyTurn])

  // Avatar fetches
  useEffect(() => {
    if (!myUsername || myUsername.startsWith('guest')) return
    supabase.from('profiles').select('avatar_url').eq('username', myUsername).single()
      .then(({ data }) => { if (data?.avatar_url) setMyAvatarUrl(data.avatar_url) })
  }, [myUsername])

  const playersRef = useRef<Player[]>([])
  useEffect(() => {
    playersRef.current = players
    if (!myUsername || players.length < 2) return
    const opp = players.find(p => p.username !== myUsername)
    if (!opp?.username) return
    supabase.from('profiles').select('avatar_url').eq('username', opp.username).single()
      .then(({ data }) => { if (data?.avatar_url) setOpponentAvatarUrl(data.avatar_url) })
  }, [players, myUsername])

  // Speech recognition
const { listening, startListening, stopListening, finalTranscriptRef } = useSpeechRecognition((t) => {
  setLiveTranscript(t)
  socketRef.current?.emit('vc_live_transcript', { instanceId, text: t, username: myUsernameRef.current })
})
  // Init Agora
const initAgora = useCallback(async (channelName: string, uid: string) => {
  try {
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
    try {
  await client.startProxyServer(3)
  console.log('✅ Agora proxy enabled')
} catch (e) {
  console.warn('⚠️ Proxy failed, connecting directly:', e)
}
agoraClientRef.current = client
const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream
      setMicGranted(true)

      // Set up local analyser
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)
      localAnalyserRef.current = analyser

      // Create Agora audio track from same mic
      const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack()
      localAudioTrackRef.current = localAudioTrack

      // Join Agora channel — use socket ID as uid (numeric hash)
     if (!agoraUidRef.current) agoraUidRef.current = Math.floor(Math.random() * 100000) + 1
const numericUid = agoraUidRef.current
     const tokenRes = await fetch(`${SERVER_URL}/api/agora-token?channelName=${channelName}&uid=${numericUid}`)
const { token } = await tokenRes.json()
await client.join(AGORA_APP_ID, channelName, token, numericUid)
      console.log('✅ Agora joined, uid:', numericUid, 'channel:', channelName)
     await client.publish([localAudioTrack])

      // Handle remote user publishing audio
   client.on('user-published', async (remoteUser, mediaType) => {
  if (mediaType === 'audio') {
    await client.subscribe(remoteUser, 'audio')
   const remoteTrack = remoteUser.audioTrack as IRemoteAudioTrack
    if (audioCtxRef.current?.state === 'suspended') {
      await audioCtxRef.current.resume()
    }
    remoteTrack.play()
    // Force audio output on iOS
    const audioEl = document.querySelector('audio')
    if (audioEl) audioEl.setAttribute('playsinline', 'true')
    setRemoteAudioActive(true)

    const connectRemoteAnalyser = async (retries = 5) => {
      try {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
        if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume()

        // Try getMediaStreamTrack first, fall back to creating silence analyser
        const mediaStreamTrack = remoteTrack.getMediaStreamTrack()
        if (!mediaStreamTrack) throw new Error('No MediaStreamTrack yet')

        const remoteStream = new MediaStream([mediaStreamTrack])
        const source = audioCtxRef.current.createMediaStreamSource(remoteStream)
        const remoteAnalyser = audioCtxRef.current.createAnalyser()
        remoteAnalyser.fftSize = 64
        source.connect(remoteAnalyser)
        remoteAnalyserRef.current = remoteAnalyser
setRemoteAnalyserReady(true)
console.log('✅ Remote analyser connected')
      } catch (e) {
        console.warn(`⚠️ Retry ${retries}:`, e)
        if (retries > 0) {
          setTimeout(() => connectRemoteAnalyser(retries - 1), 1500)
        } else {
          // Final fallback — use volume level polling instead of Web Audio
          console.log('🔄 Falling back to volume polling')
          const pollVolume = setInterval(() => {
            if (!remoteUser.audioTrack) { clearInterval(pollVolume); return }
            const level = remoteUser.audioTrack.getVolumeLevel()
            // level is 0-1, simulate analyser data
            if (remoteAnalyserRef.current === null) {
              const ctx = audioCtxRef.current || new AudioContext()
              const analyser = ctx.createAnalyser()
              analyser.fftSize = 64
              remoteAnalyserRef.current = analyser
            }
          }, 100)
        }
      }
    }

    // Wait 500ms for mobile to fully initialize the track
    setTimeout(() => connectRemoteAnalyser(), 500)
  }
})
     client.on('user-unpublished', () => setRemoteAudioActive(false))

      client.on('exception', (evt: any) => {
        if (evt.code === 2001) setAudioTooLow(true)
        if (evt.code === 4001) setAudioTooLow(false)
      })

      console.log('✅ Agora joined channel:', channelName)
    } catch (e) {
      console.error('Agora init error:', e)
    }
  }, [])

  // MediaRecorder
  const startMediaRecorder = useCallback((stream: MediaStream) => {
    audioChunksRef.current = []
    let mimeType = ''
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus'
    else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm'
    else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4'
    else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg'
    const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
    mr.start(250)
    mediaRecorderRef.current = mr
    console.log('🎙️ MediaRecorder started, mimeType:', mimeType || 'default')
  }, [])

  const stopMediaRecorderAndTranscribe = useCallback(async (): Promise<string> => {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current
      if (!mr || mr.state === 'inactive') { resolve(''); return }
      mr.onstop = async () => {
        const mimeType = mr.mimeType || 'audio/webm'
        let ext = 'webm'
        if (mimeType.includes('mp4')) ext = 'mp4'
        else if (mimeType.includes('ogg')) ext = 'ogg'
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        console.log('🎤 Blob size:', blob.size, 'chunks:', audioChunksRef.current.length, 'type:', mimeType)
        if (blob.size < 100) { console.warn('🎤 Blob too small'); resolve(''); return }
        const fd = new FormData()
        fd.append('audio', blob, `recording.${ext}`)
        try {
          const res = await fetch(`${SERVER_URL}/api/transcribe`, { method: 'POST', body: fd })
          const data = await res.json()
          console.log('🎤 Whisper response:', data)
          resolve(data.transcript || '')
        } catch (e) {
          console.error('🎤 Whisper error:', e)
          resolve('')
        }
      }
      mr.requestData()
      setTimeout(() => mr.stop(), 200)
    })
  }, [])

  // Username setup
  useEffect(() => {
    if (loading) return
    if (guestParam) { setMyUsername(guestParam); return }
    if (profile?.username) { setMyUsername(profile.username); setMyElo(profile.elo ?? 0); return }
    if (!user) setMyUsername('guest' + Math.floor(1000 + Math.random() * 9000))
  }, [loading, profile, user, guestParam])

  // Socket + Agora setup
  useEffect(() => {
    if (!myUsername) return

    const rawPrefs = localStorage.getItem('rebuttal_sound_prefs')
    const soundPrefs = rawPrefs ? JSON.parse(rawPrefs) : {}
    const sfxOn = soundPrefs.soundEnabled ?? true
    const musicOn = soundPrefs.musicEnabled ?? true

    countdownAudioRef.current = new Audio('/sounds/countdown.mp3')
    countdownAudioRef.current.preload = 'auto'
    suddenDeathAudioRef.current = new Audio('/sounds/suddendeath.mp3')
    suddenDeathAudioRef.current.preload = 'auto'

    popAudioRef.current = new Audio('/sounds/pop.mp3')
    popAudioRef.current.preload = 'auto'
    popAudioRef.current.volume = 0.5

    lobbyAudioRef.current = new Audio('/sounds/lobby.mp3')
    lobbyAudioRef.current.preload = 'auto'
    lobbyAudioRef.current.loop = true
    lobbyAudioRef.current.volume = 0.35

    const unlockAudio = () => {
      [countdownAudioRef].forEach(ref => {
        if (!ref.current) return
        ref.current.play().then(() => { ref.current!.pause(); ref.current!.currentTime = 0 }).catch(() => {})
      })
    }
    document.addEventListener('click', unlockAudio, { once: true })
    document.addEventListener('touchstart', unlockAudio, { once: true })

    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

   socket.on('connect', async () => {
  setConnected(true)
  if (!agoraInitializedRef.current) {
    agoraInitializedRef.current = true
    await initAgora(instanceId, socket.id ?? '')
  }
  socket.emit('join_vc_room', { instanceId, username: myUsername, elo: myElo, password: passwordParam })
})
    socket.on('reconnect', () => {
      setConnected(true)
      socket.emit('join_vc_room', { instanceId, username: myUsername, elo: myElo, password: passwordParam })
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('vc_room_info', (info: any) => {
      setRoomInfo(info); setStatus(info.status); setPlayers(info.players || [])
      setLobbyCountdown(info.countdown || 1200)
      if (info.status === 'waiting' || info.status === 'starting') {
        try { if (musicOn) lobbyAudioRef.current?.play() } catch (e) {}
      }
    })

    socket.on('vc_players_update', (p: Player[]) => {
      setPlayers(p)
      const opp = p.find(pl => pl.username !== myUsername)
      if (opp?.username) {
        supabase.from('profiles').select('avatar_url').eq('username', opp.username).single()
          .then(({ data }) => { if (data?.avatar_url) setOpponentAvatarUrl(data.avatar_url) })
      }
    })

    socket.on('vc_starting', ({ startCountdown: sc, players: p }: any) => {
      setStatus('starting'); setStartCountdown(sc); setPlayers(p)
    })

    socket.on('vc_start_countdown_tick', ({ count }: { count: number }) => {
      setStartCountdown(count)
      if (count === 4) { try { lobbyAudioRef.current?.pause() } catch (e) {} }
      if (count === 3) {
        try {
          if (sfxOn && countdownAudioRef.current) {
            countdownAudioRef.current.currentTime = 0
            countdownAudioRef.current.play()
          }
        } catch (e) {}
      }
    })

    socket.on('vc_debate_started', ({ firstSpeakerSocketId, firstSpeakerUsername, duration, turnDuration }: any) => {
      console.log('🎯 vc_debate_started — firstSpeakerSocketId:', firstSpeakerSocketId, 'socket.id:', socket.id)
      try { lobbyAudioRef.current?.pause() } catch (e) {}

      // Fetch opponent avatar
      const opp = playersRef.current.find(p => p.username !== myUsername)
      if (opp?.username) {
        supabase.from('profiles').select('avatar_url').eq('username', opp.username).single()
          .then(({ data }) => { if (data?.avatar_url) setOpponentAvatarUrl(data.avatar_url) })
      }

      setStatus('active')
      setTimeLeft(duration)
      setCurrentSpeakerUsername(firstSpeakerUsername)
      const isMine = firstSpeakerSocketId === socket.id
      console.log('🎯 isMine:', isMine)
      setIsMyTurn(isMine)
      isMyTurnRef.current = isMine
      setTurnNumber(1)
      setTurnTimeLeft(turnDuration)

      clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => { if (prev <= 1) { clearInterval(timerRef.current); return 0 } return prev - 1 })
      }, 1000)

      if (isMine) {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (SR) startListening()
        if (localStreamRef.current) startMediaRecorder(localStreamRef.current)
        localAudioTrackRef.current?.setEnabled(true)
      } else {
        // Manually subscribe to any already-publishing remote users
        if (agoraClientRef.current) {
          agoraClientRef.current.remoteUsers.forEach(async (remoteUser) => {
            if (remoteUser.hasAudio) {
              await agoraClientRef.current!.subscribe(remoteUser, 'audio')
              remoteUser.audioTrack?.play()
              setRemoteAudioActive(true)
            }
          })
        }
      }
      startTurnTimer(turnDuration, isMine, socket)
    })
    socket.on('vc_turn_start', ({ speakerSocketId, speakerUsername, turnNumber: tn, turnDuration }: any) => {
      console.log('🎯 vc_turn_start — speakerSocketId:', speakerSocketId, 'socket.id:', socket.id)
      setInCooldown(false)
      setCurrentSpeakerUsername(speakerUsername)
      const isMine = speakerSocketId === socket.id
      console.log('🎯 isMine:', isMine)
      setIsMyTurn(isMine)
      isMyTurnRef.current = isMine
      setTurnNumber(tn)
      setTurnTimeLeft(turnDuration)
      setTurnEnded(false)
      turnEndedRef.current = false
      setLiveTranscript('')
      setOpponentLiveTranscript('')

      if (isMine) {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (SR) startListening()
        if (localStreamRef.current) startMediaRecorder(localStreamRef.current)
localAudioTrackRef.current?.setEnabled(true) 
        } else {
        stopListening()
        if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
        // Manually subscribe to any already-publishing remote users
        if (agoraClientRef.current) {
          agoraClientRef.current.remoteUsers.forEach(async (remoteUser) => {
            if (remoteUser.hasAudio) {
              await agoraClientRef.current!.subscribe(remoteUser, 'audio')
              remoteUser.audioTrack?.play()
              setRemoteAudioActive(true)
            }
          })
        }
      }
      startTurnTimer(turnDuration, isMine, socket)
    })
    socket.on('vc_cooldown_start', ({ duration }: { duration: number }) => {
      setInCooldown(true)
      setCooldownLeft(duration)
      clearInterval(cooldownTimerRef.current)
      cooldownTimerRef.current = setInterval(() => {
        setCooldownLeft(prev => { if (prev <= 1) { clearInterval(cooldownTimerRef.current); return 0 } return prev - 1 })
      }, 1000)
    })
socket.on('vc_live_transcript', ({ text, username }: { text: string; username: string }) => {
  if (username !== myUsernameRef.current) {
    setOpponentLiveTranscript(text)
  }
})
    socket.on('vc_turn_scored', ({ entry, scores: s }: any) => {
      setTranscripts(prev => [...prev, entry]); setScores(s)
      try {
        if (sfxOn && popAudioRef.current) {
          popAudioRef.current.currentTime = 0
          popAudioRef.current.play().catch(() => {})
        }
      } catch (e) {}
    })
socket.on('vc_scoring_start', ({ username }: { username: string }) => {
      setScoringUsername(username)
      clearInterval(timerRef.current)
    })
    socket.on('vc_scoring_end', ({ username }: { username: string }) => {
      setScoringUsername(null)
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => { if (prev <= 1) { clearInterval(timerRef.current); return 0 } return prev - 1 })
      }, 1000)
    })
    socket.on('vc_go_first_update', ({ paidUsername, socketId }: any) => {
      setPaidToGoFirst(paidUsername); setCanOverride(socketId !== socket.id)
    })

    socket.on('vc_sudden_death_start', ({ round, firstSpeakerSocketId, firstSpeakerUsername, secondSpeakerUsername, turnDuration }: any) => {
      setSuddenDeath(true)
      setSuddenDeathRound(round)
      setInCooldown(false)
      setTurnEnded(false)
      turnEndedRef.current = false
      setLiveTranscript('')
      setOpponentLiveTranscript('')
      setCurrentSpeakerUsername(firstSpeakerUsername)
      const isMine = firstSpeakerSocketId === socket.id
      setIsMyTurn(isMine)
      isMyTurnRef.current = isMine
      setTurnTimeLeft(turnDuration)
      // Play sudden death audio then GO
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
              if (isMine) {
                const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
                if (SR) startListening()
                if (localStreamRef.current) startMediaRecorder(localStreamRef.current)
localAudioTrackRef.current?.setEnabled(true)              } else {
              }
              startTurnTimer(turnDuration, isMine, socket)
            }
          }).catch(() => {})
        } else {
          // SFX off — skip audio, start turn immediately
          if (isMine) {
            const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
            if (SR) startListening()
            if (localStreamRef.current) startMediaRecorder(localStreamRef.current)
localAudioTrackRef.current?.setEnabled(true)          } else {
          }
          startTurnTimer(turnDuration, isMine, socket)
        }
      } catch (e) {}
    })

    socket.on('vc_sudden_death_switch', ({ nextSocketId, cooldown: cd }: any) => {
      setInCooldown(true)
      setCooldownLeft(cd)
      clearInterval(cooldownTimerRef.current)
      cooldownTimerRef.current = setInterval(() => {
        setCooldownLeft(prev => { if (prev <= 1) { clearInterval(cooldownTimerRef.current); return 0 } return prev - 1 })
      }, 1000)
    })

    socket.on('vc_system_message', ({ text }: { text: string }) => {
      setTranscripts(prev => [...prev, {
        id: `sys-${Date.now()}`, username: '— system —', text,
        score: 0, aiFeedback: '', timestamp: Date.now(), turnNumber: 0
      }])
    })
socket.on('vc_debate_ended', async ({ standings: s, eloChanges, customStake, serverHandledElo, draw }: any) => {    
      try { lobbyAudioRef.current?.pause() } catch (e) {}
      setStatus('ended')
      setStandings(s)
      if (draw) setIsDraw(true)
      // Clean up Agora after a short delay to allow final audio
      setTimeout(async () => {
        try {
          await localAudioTrackRef.current?.close()
          await agoraClientRef.current?.leave()
          agoraClientRef.current = null
        } catch (e) {}
        if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close()
      }, 1000)

      const currentProfile = profileRef.current
      const currentUser = userRef.current
      if (!currentProfile?.username || !currentUser) return
      const myPlace = s.findIndex((p: Player) => p.username === myUsernameRef.current)
      if (myPlace === -1) return
      let change: number
      if (serverHandledElo && customStake) {
        change = myPlace === 0 ? customStake : -customStake
        setEloChange(change)
        await supabase.from('profiles').update({
          wins: myPlace === 0 ? (currentProfile.wins ?? 0) + 1 : (currentProfile.wins ?? 0),
          debates: (currentProfile.debates ?? 0) + 1,
        }).eq('id', currentUser.id)
        return
      }
      if (customStake) {
        change = myPlace === 0 ? customStake : -customStake
      } else {
        change = myPlace === 0 ? eloChanges.winnerElo : -Math.round(eloChanges.loserBase)
      }
      setEloChange(change)
      const oldElo = currentProfile.elo ?? 0
      const newElo = oldElo + change
      await supabase.from('profiles').update({
        elo: newElo,
        wins: myPlace === 0 ? (currentProfile.wins ?? 0) + 1 : (currentProfile.wins ?? 0),
        debates: (currentProfile.debates ?? 0) + 1,
      }).eq('id', currentUser.id)

      // ELO notification
      await supabase.from('notifications').insert({
        recipient_username: currentProfile.username,
        type: 'elo_change',
        message: change >= 0
          ? `📈 You gained ${change} ELO in your last debate! You now have ${newElo} ELO.`
          : `📉 You lost ${Math.abs(change)} ELO in your last debate. You now have ${newElo} ELO.`,
      })

      // Tier up notification
      const oldTierName = getTierName(oldElo)
      const newTierName = getTierName(newElo)
      if (newTierName !== oldTierName && newElo > oldElo) {
        await supabase.from('notifications').insert({
          recipient_username: currentProfile.username,
          type: 'tier_up',
          message: `🏆 You ranked up! You are now a ${newTierName}. Keep debating!`,
        })
      }
    })

    socket.on('error', ({ message }: { message: string }) => { alert(message); router.push('/rebut') })
    socket.on('vc_expired', () => {
      try { lobbyAudioRef.current?.pause() } catch (e) {}
      setStatus('expired'); router.push('/rebut')
    })

    return () => {
      try { lobbyAudioRef.current?.pause() } catch (e) {}
      try { countdownAudioRef.current?.pause() } catch (e) {}
      if (lobbyAudioRef.current) lobbyAudioRef.current.src = ''
      if (countdownAudioRef.current) countdownAudioRef.current.src = ''
      if (suddenDeathAudioRef.current) { suddenDeathAudioRef.current.pause(); suddenDeathAudioRef.current.src = '' }
      if (popAudioRef.current) { popAudioRef.current.pause(); popAudioRef.current.src = '' }
      socket.disconnect()
      clearInterval(timerRef.current)
      clearInterval(turnTimerRef.current)
      clearInterval(cooldownTimerRef.current)
      clearInterval(speakingIntervalRef.current)
      document.removeEventListener('click', unlockAudio)
      document.removeEventListener('touchstart', unlockAudio)
      // Clean up Agora
     // Clean up Agora
agoraInitializedRef.current = false
    // Don't leave Agora here — only leave on debate end or forfeit
      if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close()
      localStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [myUsername])

  // Speaking detection
  useEffect(() => {
    if (!micGranted) return
    let speaking = false
    speakingIntervalRef.current = setInterval(() => {
      if (!localAnalyserRef.current) return
      const data = new Uint8Array(localAnalyserRef.current.frequencyBinCount)
      localAnalyserRef.current.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length
      const nowSpeaking = avg > 10
      if (nowSpeaking !== speaking) { speaking = nowSpeaking; setIsSpeaking(nowSpeaking) }
    }, 80)
    return () => clearInterval(speakingIntervalRef.current)
  }, [micGranted])

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
      if (remaining <= 0) { clearInterval(turnTimerRef.current); if (isMine) endMyTurn(socket) }
    }, 1000)
  }

  function endMyTurn(socket: Socket) {
    if (turnEndedRef.current) return
    setTurnEnded(true)
    turnEndedRef.current = true
    stopListening()
    setTimeout(async () => {
      const transcript = await stopMediaRecorderAndTranscribe()
      console.log('🏁 Whisper transcript:', transcript)
      socket.emit('vc_turn_complete', { instanceId, transcript })
      setLiveTranscript('')
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
    if (localAudioTrackRef.current) {
      if (newMuted) localAudioTrackRef.current.setMuted(true)
      else localAudioTrackRef.current.setMuted(false)
    }
  }

  const handleForfeit = () => { setShowForfeitModal(false); router.push('/rebut') }

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
              {isDraw && (
                <div style={{ marginTop: '10px', fontSize: '13px', color: '#ffd60a', background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.25)', borderRadius: '8px', padding: '8px 14px' }}>
                  🤝 Both players tied twice — it's a draw! No ELO gained or lost.
                </div>
              )}
            </div>
            {eloChange !== null && !isDraw && (
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
<div style={{
              fontFamily: 'var(--font-bebas)',
              fontSize: '96px',
              lineHeight: 1,
              marginBottom: '20px',
              color: '#ff0000',
              textShadow: '0 0 20px #ff0000, 0 0 40px #cc0000, 0 0 80px #990000',
              animation: 'sinisterPulse 0.8s ease-in-out infinite',
            }}>{startCountdown}</div>          ) : (
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '52px', color: 'var(--text)', marginBottom: '16px' }}>{fmt(lobbyCountdown)}</div>
          )}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '13px', color: micGranted ? 'var(--green)' : 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{micGranted ? '✅' : '⏳'}</span>
                {micGranted ? 'Microphone ready' : 'Connecting microphone...'}
              </div>
               
              {micGranted && (
                <>
                <div style={{ fontSize: '14px', fontWeight: 700, textAlign: 'center', lineHeight: 1.6, color: '#ff8c00', textShadow: '0 0 12px rgba(255,140,0,0.4)', animation: 'orangePulse 1.2s ease-in-out infinite', padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(255,140,0,0.3)', background: 'rgba(255,140,0,0.08)' }}>
                  ⚠️ Speak clearly and at a normal volume so the AI can transcribe you accurately — no mumbling <span style={{ color: 'var(--red)' }}>!</span>
                </div>
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
            {players.map((p) => {
              const isMe = p.username === myUsername
              const speaking = isMe ? isSpeaking : opponentSpeaking
              return (
                <div key={p.username} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: `2px solid ${speaking ? '#22c55e' : isMe ? 'var(--accent)' : 'var(--border)'}`, flexShrink: 0 }}>
                    {(isMe ? myAvatarUrl : opponentAvatarUrl)
                      ? <img src={(isMe ? myAvatarUrl : opponentAvatarUrl)!} alt={p.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      : <div style={{ width: '100%', height: '100%', background: isMe ? 'linear-gradient(135deg,var(--accent),#ff8c69)' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                          {p.username.slice(0, 2).toUpperCase()}
                        </div>
                    }
                  </div>
                  <span style={{ fontSize: '13px', color: isMe ? 'var(--text)' : 'var(--text2)' }}>
                    {p.username}{isMe && <span style={{ color: 'var(--accent)', fontSize: '10px', marginLeft: '4px' }}>(you)</span>}
                  </span>
                </div>
              )
            })}
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
          {roomInfo && (roomInfo as any).createdBy === myUsername && status === 'waiting' && (
            <button onClick={() => {
              socketRef.current?.emit('vc_cancel_room', { instanceId })
              router.push('/rebut')
            }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 20px', color: 'var(--red)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: '8px' }}>
              🗑️ Cancel Room
            </button>
          )}
          <button onClick={() => router.push('/rebut')} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 20px', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Leave
          </button>
        </div>
      </div>
      <style>{`@keyframes orangePulse { 0%,100%{ opacity:1; text-shadow: 0 0 12px rgba(255,140,0,0.4); } 50%{ opacity:0.75; text-shadow: 0 0 24px rgba(255,140,0,0.8); } }`}</style>
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

        {/* Sudden Death Banner */}
        {suddenDeath && (
          <div style={{ background: 'linear-gradient(135deg, rgba(255,0,0,0.15), rgba(180,0,0,0.1))', borderBottom: '2px solid rgba(255,50,0,0.7)', padding: '10px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', animation: 'sdFlicker 0.8s ease-in-out infinite' }}>
            <span style={{ fontSize: '20px' }}>⚡</span>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '16px', letterSpacing: '3px', color: '#ff3300', textAlign: 'center' }}>
              SUDDEN DEATH{suddenDeathRound > 1 ? ` — ROUND ${suddenDeathRound}` : ''} · 15 SECONDS EACH
            </div>
            <span style={{ fontSize: '20px' }}>⚡</span>
          </div>
        )}

        {/* Audio visualizers */}
        <div style={{ background: suddenDeath ? 'rgba(180,0,0,0.08)' : 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border)', padding: '10px 20px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '10px', color: isMyTurn ? 'var(--accent)' : 'var(--muted)', fontWeight: 600, letterSpacing: '1px' }}>
              {isMyTurn ? '🎙️ YOU — SPEAKING' : '🔇 YOU — LISTENING'}
            </div>
            <div style={{ background: 'rgba(230,57,70,0.06)', border: `1px solid ${isMyTurn ? 'rgba(230,57,70,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '8px', padding: '4px 8px', height: '48px', display: 'flex', alignItems: 'center' }}>
              <AudioBar analyser={localAnalyserRef.current} active={isMyTurn && !inCooldown} color="#e63946" />
            </div>
          </div>
          <div style={{ fontSize: '18px', flexShrink: 0 }}>⚔️</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '10px', color: !isMyTurn && !inCooldown ? 'var(--green)' : 'var(--muted)', fontWeight: 600, letterSpacing: '1px', textAlign: 'right' }}>
              {!isMyTurn && !inCooldown ? `🎙️ ${opponent?.username ?? 'OPPONENT'} — SPEAKING` : `🔇 ${opponent?.username ?? 'OPPONENT'} — LISTENING`}
            </div>
            <div style={{ background: 'rgba(34,197,94,0.06)', border: `1px solid ${!isMyTurn && !inCooldown ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '8px', padding: '4px 8px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <AudioBar analyser={remoteAnalyserReady ? remoteAnalyserRef.current : null} active={!isMyTurn && !inCooldown && remoteAudioActive} color="#22c55e" />
            </div>
          </div>
        </div>

       {/* Turn indicator */}
        <div style={{ background: isMyTurn ? 'rgba(230,57,70,0.08)' : 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)', padding: '12px 20px', flexShrink: 0, textAlign: 'center' }}>
          {scoringUsername && (
            <div style={{ background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.3)', borderRadius: '8px', padding: '8px 16px', marginBottom: '8px', fontSize: '13px', color: '#ffd60a', animation: 'pulse 1s infinite' }}>
              ⚖️ AI Judge is scoring {scoringUsername}'s argument...
            </div>
          )}
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

       {/* Audio too low warning */}
        {audioTooLow && isMyTurn && !inCooldown && (
          <div style={{ background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.4)', padding: '10px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', animation: 'pulse 1s infinite' }}>
            <span style={{ fontSize: '20px' }}>📢</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--red)' }}>Speak up — the AI can't hear you clearly!</span>
          </div>
        )}

        {/* Live transcript */}
        {isMyTurn && liveTranscript && !inCooldown && (
  <div style={{ background: isMyTurn ? 'rgba(230,57,70,0.04)' : 'rgba(34,197,94,0.04)', borderBottom: `1px solid ${isMyTurn ? 'rgba(230,57,70,0.2)' : 'rgba(34,197,94,0.2)'}`, padding: '10px 20px', flexShrink: 0 }}>
    <div style={{ fontSize: '11px', color: isMyTurn ? 'var(--accent)' : 'var(--green)', marginBottom: '4px', fontWeight: 600 }}>
      🎙️ {isMyTurn ? 'YOU' : (opponent?.username?.toUpperCase() ?? 'OPPONENT')} — LIVE
    </div>
    <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.6, fontStyle: 'italic' }}>"{isMyTurn ? liveTranscript : opponentLiveTranscript}"</div>
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
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                  {(isMe ? myAvatarUrl : opponentAvatarUrl)
                    ? <img src={(isMe ? myAvatarUrl : opponentAvatarUrl)!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', background: isMe ? 'linear-gradient(135deg,var(--accent),#ff8c69)' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff' }}>
                        {t.username.slice(0, 2).toUpperCase()}
                      </div>
                  }
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
              {connected ? (isMyTurn ? '🎙️ Your mic is live' : '🔇 Listening') : 'Reconnecting...'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Turn {turnNumber} · Voice Debate</div>
            <div style={{ fontSize: '12px', color: remoteAudioActive ? 'var(--green)' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {remoteAudioActive
                ? <><div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1s infinite' }} /> Audio live</>
                : '⏳ Connecting audio...'}
            </div>
          </div>
        </div>
      </div>
<style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
       @keyframes sinisterPulse { 0%,100%{ text-shadow: 0 0 20px #ff0000, 0 0 40px #cc0000, 0 0 80px #990000; } 50%{ text-shadow: 0 0 40px #ff0000, 0 0 80px #cc0000, 0 0 120px #990000; } }
        @keyframes sdFlicker { 0%,100%{ box-shadow: 0 2px 12px rgba(255,50,0,0.3); border-color: rgba(255,50,0,0.7); } 50%{ box-shadow: 0 2px 24px rgba(255,80,0,0.5); border-color: rgba(255,100,0,1); } }
        @keyframes orangePulse { 0%,100%{ opacity:1; text-shadow: 0 0 12px rgba(255,140,0,0.4); } 50%{ opacity:0.75; text-shadow: 0 0 24px rgba(255,140,0,0.8); } }
      `}</style>   </>
  )
}
//Have fun!