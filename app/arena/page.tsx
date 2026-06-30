'use client'
import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'

const SERVER_URL = 'https://rebuttal-live-production-3388.up.railway.app'

interface Opponent {
  username: string
  elo: number
}

export default function ArenaPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const socketRef = useRef<Socket | null>(null)

  const [myUsername, setMyUsername] = useState('')
  const [myElo, setMyElo] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'queueing' | 'matched' | 'voted' | 'resolved'>('idle')
  const [queueSeconds, setQueueSeconds] = useState(0)
  const [matchId, setMatchId] = useState<string | null>(null)
  const [topics, setTopics] = useState<string[]>([])
  const [opponent, setOpponent] = useState<Opponent | null>(null)
  const [myVote, setMyVote] = useState<number | null>(null)
  const [opponentVoted, setOpponentVoted] = useState(false)
  const [resolvedTopic, setResolvedTopic] = useState<string | null>(null)
const queueTimerRef = useRef<any>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const [camGranted, setCamGranted] = useState(false)

  // Ask for camera + mic as soon as we know who's asking, so by the time
  // a match is found there's no permission prompt blocking the vote.
  useEffect(() => {
    if (!myUsername) return
    let cancelled = false
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
        setCamGranted(true)
      })
      .catch(e => console.error('Camera/mic permission denied:', e))
    return () => {
      cancelled = true
      localStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [myUsername])

  useEffect(() => {
    if (loading) return
    if (profile?.username) { setMyUsername(profile.username); setMyElo(profile.elo ?? 0); return }
    if (!user) setMyUsername('guest' + Math.floor(1000 + Math.random() * 9000))
  }, [loading, profile, user])

  useEffect(() => {
    if (!myUsername) return
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('arena_queue_joined', () => {
      setPhase('queueing')
      setQueueSeconds(0)
      clearInterval(queueTimerRef.current)
      queueTimerRef.current = setInterval(() => setQueueSeconds(s => s + 1), 1000)
    })

    socket.on('arena_matched', ({ matchId: mid, topics: t, opponents }: { matchId: string; topics: string[]; opponents: Record<string, Opponent> }) => {
      clearInterval(queueTimerRef.current)
      setPhase('matched')
      setMatchId(mid)
      setTopics(t)
     const opp = socket.id ? opponents[socket.id] : undefined
      setOpponent(opp || null)
      setMyVote(null)
      setOpponentVoted(false)
      setResolvedTopic(null)
    })

    socket.on('arena_vote_received', () => {
      setOpponentVoted(true)
    })

   socket.on('arena_topic_resolved', ({ matchId: mid, topic, roomId }: { matchId: string; topic: string; roomId: string }) => {
      setPhase('resolved')
      setResolvedTopic(topic)
      // Brief pause so the player sees which topic won before being dropped
      // into the room — same beat as the rest of the app's transition screens.
      setTimeout(() => {
        // Release the preview camera/mic before navigating — the VC room
        // grabs its own via Agora, and holding both open at once is what
        // causes "camera already in use" hiccups on some browsers.
        localStreamRef.current?.getTracks().forEach(t => t.stop())
        router.push(`/vc-debate/${roomId}?video=true`)
      }, 1800)
    })

    socket.on('arena_expired', ({ message }: { message: string }) => {
      alert(message)
      setPhase('idle')
      setMatchId(null)
      setTopics([])
      setOpponent(null)
    })

    socket.on('error', ({ message }: { message: string }) => {
      alert(message)
      setPhase('idle')
    })

    return () => {
      clearInterval(queueTimerRef.current)
      socket.disconnect()
    }
  }, [myUsername, router])

  function joinQueue() {
    socketRef.current?.emit('arena_join_queue', { username: myUsername, elo: myElo })
  }

  function leaveQueue() {
    socketRef.current?.emit('arena_leave_queue')
    clearInterval(queueTimerRef.current)
    setPhase('idle')
  }

  function castVote(i: number) {
    if (myVote !== null || !matchId) return
    setMyVote(i)
    setPhase('voted')
    socketRef.current?.emit('arena_vote_topic', { matchId, topicIndex: i })
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60), sec = s % 60
    return `${m}:${sec < 10 ? '0' : ''}${sec}`
  }

  return (
    <>
      <Nav active="rebut" />
      <div style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '560px', width: '100%' }}>

          {phase === 'idle' && (
            <>
              <div style={{ fontSize: '52px', marginBottom: '12px' }}>🎥⚔️</div>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '34px', letterSpacing: '2px', marginBottom: '8px' }}>
                REBUTTAL LIVE ARENA
              </div>
              <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '28px', lineHeight: 1.6 }}>
                Face-to-face video debate. You'll be matched with a random opponent, vote on one of three political topics, and go live on camera.
              </div>
              <button
                onClick={joinQueue}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: '12px', padding: '16px 36px', color: '#fff', fontSize: '16px', fontWeight: 800, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 0 24px rgba(230,57,70,0.35)' }}
              >
                Enter the Arena
              </button>
            </>
          )}

          {phase === 'queueing' && (
            <>
              <div style={{ fontSize: '52px', marginBottom: '12px', animation: 'pulse 1.2s infinite' }}>🔍</div>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '30px', letterSpacing: '2px', marginBottom: '8px' }}>
                FINDING YOUR OPPONENT
              </div>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '40px', color: 'var(--accent)', marginBottom: '24px' }}>
                {fmt(queueSeconds)}
              </div>
              <button onClick={leaveQueue} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 24px', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Cancel
              </button>
            </>
          )}

          {(phase === 'matched' || phase === 'voted') && opponent && (
            <>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '26px', letterSpacing: '2px', marginBottom: '4px' }}>
                OPPONENT FOUND
              </div>
              <div style={{ fontSize: '15px', color: 'var(--text2)', marginBottom: '24px' }}>
                <b style={{ color: 'var(--accent)' }}>{opponent.username}</b> · {opponent.elo} ELO
              </div>

              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
                Pick your topic
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {topics.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => castVote(i)}
                    disabled={myVote !== null}
                    style={{
                      textAlign: 'left', padding: '14px 18px', borderRadius: '10px',
                      border: `1px solid ${myVote === i ? 'var(--accent)' : 'var(--border)'}`,
                      background: myVote === i ? 'rgba(230,57,70,0.1)' : 'var(--surface)',
                      color: 'var(--text)', fontSize: '13px', lineHeight: 1.5,
                      cursor: myVote !== null ? 'default' : 'pointer',
                      opacity: myVote !== null && myVote !== i ? 0.4 : 1,
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {myVote !== null && (
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  {opponentVoted ? 'Resolving the topic…' : `Waiting on ${opponent.username} to vote…`}
                </div>
              )}
            </>
          )}

          {phase === 'resolved' && resolvedTopic && (
            <>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎬</div>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '26px', letterSpacing: '2px', marginBottom: '12px' }}>
                TOPIC LOCKED IN
              </div>
              <div style={{ fontSize: '15px', color: 'var(--text)', lineHeight: 1.6, marginBottom: '8px' }}>
                {resolvedTopic}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Entering the arena…</div>
            </>
          )}

       </div>
      </div>

      {camGranted && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', width: '120px', height: '90px', borderRadius: '10px', overflow: 'hidden', border: '2px solid var(--accent)', boxShadow: '0 0 16px rgba(230,57,70,0.4)', zIndex: 50 }}>
          <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </>
  )
}