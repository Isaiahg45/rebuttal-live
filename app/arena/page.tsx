'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'
import type { IAgoraRTCClient, ILocalVideoTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng'

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
const [phase, setPhase] = useState<'idle' | 'queueing' | 'matched' | 'voted' | 'side_select' | 'resolved'>('idle')  
const [queueSeconds, setQueueSeconds] = useState(0)
  const [matchId, setMatchId] = useState<string | null>(null)
  const [topics, setTopics] = useState<string[]>([])
  const [opponent, setOpponent] = useState<Opponent | null>(null)
  const [myVote, setMyVote] = useState<number | null>(null)
  const [opponentVoted, setOpponentVoted] = useState(false)
  const [firstVote, setFirstVote] = useState<{ username: string; topicIndex: number } | null>(null)
const [resolvedTopic, setResolvedTopic] = useState<string | null>(null)
  const [resolvedRoomId, setResolvedRoomId] = useState<string | null>(null)
  const [sideSelectMatchId, setSideSelectMatchId] = useState<string | null>(null)
  const [mySideChoice, setMySideChoice] = useState<'pro' | 'con' | null>(null)
 const [arenaSidesMap, setArenaSidesMap] = useState<Record<string, 'pro' | 'con'>>({})
  const [partialSides, setPartialSides] = useState<Record<string, 'pro' | 'con'>>({})
  const queueTimerRef = useRef<any>(null)
 const localVideoRef = useRef<HTMLVideoElement>(null)
  const localPreviewRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const [camGranted, setCamGranted] = useState(false)
const lobbyAudioRef = useRef<HTMLAudioElement | null>(null)
  const [customTopicText, setCustomTopicText] = useState('')
  const [customTopicAdded, setCustomTopicAdded] = useState(false)
  const agoraClientRef = useRef<IAgoraRTCClient | null>(null)
  const localVideoTrackRef = useRef<ILocalVideoTrack | null>(null)
 const remoteVideoRef = useRef<HTMLDivElement | null>(null)
  const remoteVideoTrackRef = useRef<IRemoteVideoTrack | null>(null)
  const [remoteVideoReady, setRemoteVideoReady] = useState(false)
  const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID!

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

// Attach stream to every video element that's currently mounted.
  // On mobile (iOS Safari), fixed-position video elements need an explicit
  // play() call after srcObject is set — especially when phase transitions
  // mount new DOM elements.
  useEffect(() => {
    if (!localStreamRef.current) return
    const attach = (el: HTMLVideoElement | null) => {
      if (!el) return
      el.srcObject = localStreamRef.current
      el.play().catch(() => {})
    }
    // Small delay so the DOM element is fully mounted before we try to attach
    const t = setTimeout(() => {
      attach(localVideoRef.current)
      attach(localPreviewRef.current)
    }, 80)
    return () => clearTimeout(t)
  }, [camGranted, phase])

  useEffect(() => {
    if (remoteVideoRef.current && remoteVideoTrackRef.current) {
      remoteVideoTrackRef.current.play(remoteVideoRef.current)
    }
  }, [phase])
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
      setFirstVote(null)
      setResolvedTopic(null)
      setResolvedRoomId(null)
      setSideSelectMatchId(null)
     setMySideChoice(null)
      setArenaSidesMap({})
      setPartialSides({})
      // Join a temporary Agora channel so both players can see each other during voting
      joinAgoraPreview(`arena_preview_${mid}`)
    })

   socket.on('arena_vote_received', ({ socketId, topicIndex, username }: { socketId: string; topicIndex: number; username: string }) => {
      setOpponentVoted(true)
      setFirstVote({ username, topicIndex })
    })

   socket.on('arena_topic_resolved', ({ matchId: mid, topic, roomId }: { matchId: string; topic: string; roomId: string }) => {
      setPhase('side_select')
      setResolvedTopic(topic)
      setResolvedRoomId(roomId)
      setSideSelectMatchId(mid)
     setMySideChoice(null)
      setArenaSidesMap({})
      setPartialSides({})
    })

   socket.on('arena_side_selected', ({ sides }: { sides: Record<string, 'pro' | 'con'> }) => {
      setPartialSides(sides)
    })

    socket.on('arena_sides_locked', ({ sides, roomId }: { sides: Record<string, 'pro' | 'con'>; roomId: string }) => {
      setArenaSidesMap(sides)
      setPartialSides(sides)
      setPhase('resolved')
      const mySide = sides[myUsername] || 'pro'
      setTimeout(async () => {
        await leaveAgoraPreview()
        localStreamRef.current?.getTracks().forEach(t => t.stop())
        router.push(`/vc-debate/${roomId}?video=true&side=${mySide}`)
      }, 1200)
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
      leaveAgoraPreview()
      socket.disconnect()
    }
  }, [myUsername, router])

const joinAgoraPreview = useCallback(async (channelName: string) => {
    try {
      const { default: AgoraRTC } = await import('agora-rtc-sdk-ng')
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
      agoraClientRef.current = client
      const uid = Math.floor(Math.random() * 100000) + 1
      const tokenRes = await fetch(`${SERVER_URL}/api/agora-token?channelName=${channelName}&uid=${uid}`)
      const { token } = await tokenRes.json()
      await client.join(AGORA_APP_ID, channelName, token, uid)
      const localVideoTrack = await AgoraRTC.createCameraVideoTrack()
      localVideoTrackRef.current = localVideoTrack
      await client.publish([localVideoTrack])
      client.on('user-published', async (remoteUser, mediaType) => {
        if (mediaType === 'video') {
          await client.subscribe(remoteUser, 'video')
          remoteVideoTrackRef.current = remoteUser.videoTrack as IRemoteVideoTrack
          setRemoteVideoReady(true)
          let attempts = 0
          const tryPlay = () => {
            attempts++
            if (remoteVideoRef.current && remoteVideoTrackRef.current) {
              remoteVideoTrackRef.current.play(remoteVideoRef.current)
            } else if (attempts < 15) {
              setTimeout(tryPlay, 200)
            }
          }
          tryPlay()
        }
      })
    } catch (e) {
      console.error('Arena Agora preview failed:', e)
    }
  }, [AGORA_APP_ID])

  const leaveAgoraPreview = useCallback(async () => {
    try {
      await localVideoTrackRef.current?.close()
      await agoraClientRef.current?.leave()
      agoraClientRef.current = null
      localVideoTrackRef.current = null
      setRemoteVideoReady(false)
    } catch (e) {}
  }, [])

  function joinQueue() {
    socketRef.current?.emit('arena_join_queue', { username: myUsername, elo: myElo })
  }

function submitCustomTopic() {
    if (!customTopicText.trim() || customTopicText.trim().length < 10 || !matchId || customTopicAdded) return
    setCustomTopicAdded(true)
    socketRef.current?.emit('arena_add_custom_topic', { matchId, topic: customTopicText.trim() })
    setCustomTopicText('')
  }

  function leaveQueue() {
    socketRef.current?.emit('arena_leave_queue')
    clearInterval(queueTimerRef.current)
    lobbyAudioRef.current?.pause()
    if (lobbyAudioRef.current) lobbyAudioRef.current.currentTime = 0
    setPhase('idle')
    setQueueSeconds(0)
  }

  function pickSide(side: 'pro' | 'con') {
    if (mySideChoice || !sideSelectMatchId) return
    setMySideChoice(side)
    socketRef.current?.emit('arena_select_side', { matchId: sideSelectMatchId, side })
  }

  function castVote(i: number) {
    if (myVote !== null || !matchId) return
    setMyVote(i)
    setPhase('voted')
    setFirstVote({ username: myUsername, topicIndex: i })
    socketRef.current?.emit('arena_vote_topic', { matchId, topicIndex: i })
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60), sec = s % 60
    return `${m}:${sec < 10 ? '0' : ''}${sec}`
  }

  return (
    <>
     <Nav active="rebut" />
      {/* Persistent blurred camera background — always shown when cam is granted */}
      {camGranted && phase === 'queueing' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(28px) brightness(0.2)', transform: 'scaleX(-1) scale(1.1)' }} />
        </div>
      )}
      {camGranted && (phase === 'matched' || phase === 'voted') && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, display: 'flex', overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(28px) brightness(0.22)', transform: 'scaleX(-1) scale(1.1)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
            <div ref={remoteVideoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(28px) brightness(0.3)', transform: 'scale(1.1)' }} />
            {!remoteVideoReady && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,4,8,0.85)' }}>
                <div style={{ fontSize: '64px', opacity: 0.25 }}>👤</div>
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{ position: 'relative', zIndex: 1, minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
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
                  <video ref={localPreviewRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
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
            

              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '26px', letterSpacing: '2px', marginBottom: '4px' }}>
                OPPONENT FOUND
              </div>
              <div style={{ fontSize: '15px', color: 'var(--text2)', marginBottom: '24px' }}>
                <b style={{ color: 'var(--accent)' }}>{opponent.username}</b> · {opponent.elo} ELO
              </div>

             <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>
                Vote your topic
              </div>
              <div style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '12px', fontStyle: 'italic', padding: '0 4px' }}>
                ⚠️ If your opponent chooses a different topic than you, the debater with higher ELO gets priority.
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
                   {firstVote?.topicIndex === i && (
                      <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}>
                        ✓ {firstVote.username} voted for this topic
                      </div>
                    )}
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
                  {opponentVoted
                    ? 'Both voted — resolving the topic…'
                    : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s infinite', display: 'inline-block' }} />
                        Waiting on {opponent?.username} to vote…
                      </span>
                    )
                  }
                </div>
              )}
              {myVote === null && opponentVoted && opponent && (
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                  ⚡ {opponent.username} already voted — pick yours
                </div>
              )}
            </>
          )}
          {phase === 'side_select' && resolvedTopic && (
            <>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '20px', letterSpacing: '2px', marginBottom: '6px' }}>TOPIC LOCKED IN</div>
              <div style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.6, marginBottom: '16px', fontWeight: 600, padding: '0 8px' }}>{resolvedTopic}</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
                Pick your side — first to choose gets priority
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                {/* AGREE button */}
                {(() => {
                  const agreeUser = Object.entries(partialSides).find(([, s]) => s === 'pro')?.[0]
                  const isTaken = !!agreeUser
                  const iMine = agreeUser === myUsername
                  const canClick = !mySideChoice && !isTaken
                  return (
                    <button
                      onClick={() => canClick && pickSide('pro')}
                      style={{
                        flex: 1, padding: '18px 12px', borderRadius: '12px',
                        cursor: canClick ? 'pointer' : 'default',
                        border: `2px solid ${isTaken ? 'rgba(34,197,94,0.8)' : 'rgba(34,197,94,0.3)'}`,
                        background: isTaken ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.06)',
                        color: '#22c55e', fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px',
                        opacity: mySideChoice && mySideChoice !== 'pro' && !isTaken ? 0.3 : 1,
                      }}
                    >
                      ✅ AGREE
                      {agreeUser && (
                        <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '6px', fontFamily: 'DM Sans, sans-serif', color: '#22c55e' }}>
                          {iMine ? '✓ You selected this' : `${agreeUser} has selected this`}
                        </div>
                      )}
                      {!agreeUser && (
                        <div style={{ fontSize: '10px', fontWeight: 400, marginTop: '4px', fontFamily: 'DM Sans, sans-serif', color: 'rgba(34,197,94,0.5)' }}>
                          Available
                        </div>
                      )}
                    </button>
                  )
                })()}
                {/* DISAGREE button */}
                {(() => {
                  const disUser = Object.entries(partialSides).find(([, s]) => s === 'con')?.[0]
                  const isTaken = !!disUser
                  const iMine = disUser === myUsername
                  const canClick = !mySideChoice && !isTaken
                  return (
                    <button
                      onClick={() => canClick && pickSide('con')}
                      style={{
                        flex: 1, padding: '18px 12px', borderRadius: '12px',
                        cursor: canClick ? 'pointer' : 'default',
                        border: `2px solid ${isTaken ? 'rgba(230,57,70,0.8)' : 'rgba(230,57,70,0.3)'}`,
                        background: isTaken ? 'rgba(230,57,70,0.18)' : 'rgba(230,57,70,0.06)',
                        color: 'var(--accent)', fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px',
                        opacity: mySideChoice && mySideChoice !== 'con' && !isTaken ? 0.3 : 1,
                      }}
                    >
                      ❌ DISAGREE
                      {disUser && (
                        <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '6px', fontFamily: 'DM Sans, sans-serif', color: 'var(--accent)' }}>
                          {iMine ? '✓ You selected this' : `${disUser} has selected this`}
                        </div>
                      )}
                      {!disUser && (
                        <div style={{ fontSize: '10px', fontWeight: 400, marginTop: '4px', fontFamily: 'DM Sans, sans-serif', color: 'rgba(230,57,70,0.5)' }}>
                          Available
                        </div>
                      )}
                    </button>
                  )
                })()}
              </div>
              {mySideChoice && Object.keys(partialSides).length < 2 && (
                <div style={{ fontSize: '13px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s infinite', display: 'inline-block' }} />
                  Waiting for {opponent?.username} to pick a side…
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