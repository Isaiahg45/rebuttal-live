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
 const lobbyAudioRef = useRef<HTMLAudioElement | null>(null)
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null)
  const [customTopicText, setCustomTopicText] = useState('')
  const [customTopicAdded, setCustomTopicAdded] = useState(false)

  // Ask for camera + mic as soon as we know who's asking, so by the time
  // a match is found there's no permission prompt blocking the vote.
 useEffect(() => {
    if (!myUsername) return
    let cancelled = false
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        localStreamRef.current = stream
        setCamGranted(true)
      })
      .catch(e => console.error('Camera/mic permission denied:', e))
    return () => {
      cancelled = true
      localStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [myUsername])

  // Re-attach the stream whenever the video element remounts. The idle and
  // matched phases use the SAME ref but DIFFERENT DOM elements — every phase
  // transition unmounts one and mounts another, so we must reattach each time.
  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current
    }
  }, [camGranted, phase])
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
      // Play lobby music while searching
      if (!lobbyAudioRef.current) {
        lobbyAudioRef.current = new Audio('/sounds/lobby.mp3')
        lobbyAudioRef.current.loop = true
        lobbyAudioRef.current.volume = 0.35
      }
      lobbyAudioRef.current.play().catch(() => {})
    })

    socket.on('arena_matched', ({ matchId: mid, topics: t, opponents }: { matchId: string; topics: string[]; opponents: Record<string, Opponent> }) => {
      clearInterval(queueTimerRef.current)
      lobbyAudioRef.current?.pause()
      setPhase('matched')
      setCustomTopicText('')
      setCustomTopicAdded(false)
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
      // Play the 3-2-1 countdown audio then navigate
      if (!countdownAudioRef.current) {
        countdownAudioRef.current = new Audio('/sounds/countdown.mp3')
      }
      countdownAudioRef.current.currentTime = 0
      countdownAudioRef.current.play().catch(() => {})
      setTimeout(() => {
        countdownAudioRef.current?.pause()
        localStreamRef.current?.getTracks().forEach(t => t.stop())
        router.push(`/vc-debate/${roomId}?video=true`)
      }, 3200)
    })

socket.on('arena_topics_updated', ({ topics: t }: { topics: string[] }) => {
      setTopics(t)
    })

    socket.on('arena_expired', ({ message }: { message: string }) => {      alert(message)
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
      lobbyAudioRef.current?.pause()
      countdownAudioRef.current?.pause()
      socket.disconnect()
    }
  }, [myUsername, router])

  function joinQueue() {
    socketRef.current?.emit('arena_join_queue', { username: myUsername, elo: myElo })
  }

function submitCustomTopic() {
    if (!customTopicText.trim() || customTopicText.trim().length < 10 || !matchId || customTopicAdded) return
    setCustomTopicAdded(true)
    socketRef.current?.emit('arena_add_custom_topic', { matchId, topic: customTopicText.trim() })
    setCustomTopicText('')
  }

  function leaveQueue() {    socketRef.current?.emit('arena_leave_queue')
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
             {camGranted && (
                <div style={{ width: '180px', height: '140px', margin: '0 auto 20px', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--accent)', boxShadow: '0 0 16px rgba(230,57,70,0.4)' }}>
                  <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                </div>
              )}
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
              {/* Blurred cam background */}
              {camGranted && (
                <div style={{ position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden' }}>
                 <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(24px) brightness(0.25)', transform: 'scaleX(-1) scale(1.1)' }} />
                </div>
              )}

              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '26px', letterSpacing: '2px', marginBottom: '4px' }}>
                OPPONENT FOUND
              </div>
              <div style={{ fontSize: '15px', color: 'var(--text2)', marginBottom: '24px' }}>
                <b style={{ color: 'var(--accent)' }}>{opponent.username}</b> · {opponent.elo} ELO
              </div>

              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
                Pick your topic
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                {topics.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => castVote(i)}
                    disabled={myVote !== null}
                    style={{
                      textAlign: 'left', padding: '14px 18px', borderRadius: '10px',
                      border: `1px solid ${myVote === i ? 'var(--accent)' : 'var(--border)'}`,
                      background: myVote === i ? 'rgba(230,57,70,0.1)' : 'rgba(10,10,10,0.8)',
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

              {/* Custom topic — one shot per player */}
              {!customTopicAdded && myVote === null && (
                <div style={{ background: 'rgba(10,10,10,0.8)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
                    + Add your own topic (once only)
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      value={customTopicText}
                      onChange={e => setCustomTopicText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && submitCustomTopic()}
                      placeholder="Type a political topic (min 10 chars)…"
                      style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
                    />
                    <button
                      onClick={submitCustomTopic}
                      disabled={customTopicText.trim().length < 10}
                      style={{ background: 'rgba(230,57,70,0.15)', border: '1px solid rgba(230,57,70,0.4)', borderRadius: '8px', padding: '8px 14px', color: 'var(--accent)', fontSize: '12px', fontWeight: 700, cursor: customTopicText.trim().length < 10 ? 'not-allowed' : 'pointer', opacity: customTopicText.trim().length < 10 ? 0.4 : 1, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>
                      Add
                    </button>
                  </div>
                </div>
              )}
              {customTopicAdded && myVote === null && (
                <div style={{ fontSize: '12px', color: 'var(--green)', marginBottom: '12px' }}>✓ Your topic was added — now vote on one above</div>
              )}

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

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </>
  )
}