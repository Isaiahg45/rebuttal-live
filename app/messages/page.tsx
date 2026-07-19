'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'
import Link from 'next/link'

interface Message {
  id: string
  sender_username: string
  recipient_username: string
  text: string
  seen: boolean
  created_at: string
}

interface Conversation {
  username: string
  avatar_url?: string
  lastMessage: string
  lastTime: string
  unread: number
  isBuddy: boolean
}

function fmt(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function MessagesInner() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const withParam = searchParams.get('with')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvo, setActiveConvo] = useState<string | null>(withParam)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [buddies, setBuddies] = useState<string[]>([])
  const [avatars, setAvatars] = useState<Record<string, string>>({})
  const [newRecipient, setNewRecipient] = useState('')
  const [showNewMsg, setShowNewMsg] = useState(false)
  const [userSuggestions, setUserSuggestions] = useState<{ username: string; avatar_url?: string }[]>([])
  const [sending, setSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const avatarsRef = useRef<Record<string, string>>({})

  useEffect(() => { avatarsRef.current = avatars }, [avatars])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user])

  // Load buddies
  useEffect(() => {
    if (!profile?.username) return
    supabase.from('buddies')
      .select('user_a, user_b')
      .or(`user_a.eq.${profile.username},user_b.eq.${profile.username}`)
      .then(({ data }) => {
        if (data) {
          const list = data.map((b: any) => b.user_a === profile.username ? b.user_b : b.user_a)
          setBuddies(list)
        }
      })
  }, [profile?.username])

  // Search users as you type
  useEffect(() => {
    if (!newRecipient.trim()) { setUserSuggestions([]); return }
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from('profiles')
        .select('username, avatar_url')
        .ilike('username', `${newRecipient}%`)
        .neq('username', profile?.username ?? '')
        .limit(6)
      if (data) setUserSuggestions(data)
    }, 200)
    return () => clearTimeout(timeout)
  }, [newRecipient])

  // Load conversations
  const loadConversations = async () => {
    if (!profile?.username) return
    const { data } = await supabase.from('messages')
      .select('*')
      .or(`sender_username.eq.${profile.username},recipient_username.eq.${profile.username}`)
      .order('created_at', { ascending: false })

    if (!data) return

    const map: Record<string, { msgs: Message[]; unread: number }> = {}
    data.forEach((m: Message) => {
      const partner = m.sender_username === profile.username ? m.recipient_username : m.sender_username
      if (!map[partner]) map[partner] = { msgs: [], unread: 0 }
      map[partner].msgs.push(m)
      if (m.recipient_username === profile.username && !m.seen) map[partner].unread++
    })

    // Fetch avatars for all partners
    const usernames = Object.keys(map)
    if (usernames.length > 0) {
      const { data: profileData } = await supabase.from('profiles')
        .select('username, avatar_url').in('username', usernames)
      if (profileData) {
        const av: Record<string, string> = { ...avatarsRef.current }
        profileData.forEach((p: any) => { if (p.avatar_url) av[p.username] = p.avatar_url })
        setAvatars(av)
        avatarsRef.current = av
      }
    }

    const convos: Conversation[] = Object.entries(map).map(([username, { msgs, unread }]) => ({
      username,
      avatar_url: avatarsRef.current[username],
      lastMessage: msgs[0]?.text ?? '',
      lastTime: msgs[0]?.created_at ?? '',
      unread,
      isBuddy: buddies.includes(username),
    })).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime())

    setConversations(convos)
  }

  useEffect(() => {
    loadConversations()
    const interval = setInterval(loadConversations, 4000)
    return () => clearInterval(interval)
  }, [profile?.username, buddies])

  // Load messages for active convo + fetch their avatar
  const loadMessages = async () => {
    if (!profile?.username || !activeConvo) return
    const { data } = await supabase.from('messages')
      .select('*')
      .or(
        `and(sender_username.eq.${profile.username},recipient_username.eq.${activeConvo}),and(sender_username.eq.${activeConvo},recipient_username.eq.${profile.username})`
      )
      .order('created_at', { ascending: true })
    if (data) setMessages(data)

    // Fetch avatar for active convo partner if not cached
    if (!avatarsRef.current[activeConvo]) {
      const { data: pd } = await supabase.from('profiles').select('username, avatar_url').eq('username', activeConvo).maybeSingle()
      if (pd?.avatar_url) {
        const av = { ...avatarsRef.current, [activeConvo]: pd.avatar_url }
        setAvatars(av)
        avatarsRef.current = av
      }
    }

    // Mark as seen
    await supabase.from('messages')
      .update({ seen: true })
      .eq('recipient_username', profile.username)
      .eq('sender_username', activeConvo)
      .eq('seen', false)
  }

  useEffect(() => {
    setMessages([])
    loadMessages()
    const interval = setInterval(loadMessages, 3000)
    return () => clearInterval(interval)
  }, [activeConvo, profile?.username])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || !profile?.username || !activeConvo || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      sender_username: profile.username,
      recipient_username: activeConvo,
      text,
      seen: false,
    })
    setSending(false)
    if (error) {
      console.error('Message send error:', error)
      alert('Failed to send message. Please try again.')
      setInput(text)
      return
    }
    loadMessages()
    loadConversations()
  }

  const startNewConvo = async (username?: string) => {
    const target = (username ?? newRecipient).trim().toLowerCase()
    if (!target || target === profile?.username) return
    if (!username) {
      const { data } = await supabase.from('profiles').select('username').eq('username', target).maybeSingle()
      if (!data) { alert('User not found'); return }
    }
    setActiveConvo(target)
    setShowNewMsg(false)
    setNewRecipient('')
    setUserSuggestions([])
  }

  if (loading) return null

  return (
    <>
      <Nav active="messages" />
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .msg-bubble { animation: fadeIn 0.15s ease }
        .convo-row:hover { background: rgba(255,255,255,0.04) !important; }
        .convo-row.active { background: rgba(230,57,70,0.08) !important; border-left: 3px solid var(--accent) !important; }
        .suggestion-row:hover { background: rgba(255,255,255,0.08) !important; }
      `}</style>

      <div style={{ height: 'calc(100vh - 56px)', display: 'flex', overflow: 'hidden' }}>

        {/* Left sidebar */}
        <div style={{ width: '320px', flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>

          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px' }}>MESSAGES</div>
            <button onClick={() => { setShowNewMsg(o => !o); setNewRecipient(''); setUserSuggestions([]) }} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '6px 12px', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              + New
            </button>
          </div>

          {/* New message search */}
          {showNewMsg && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(230,57,70,0.06)', position: 'relative' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', fontWeight: 600 }}>Search by username:</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  value={newRecipient}
                  onChange={e => setNewRecipient(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && startNewConvo()}
                  placeholder="Type a username..."
                  autoFocus
                  style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', color: 'var(--text)', fontSize: '13px', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}
                />
                <button onClick={() => { setShowNewMsg(false); setNewRecipient(''); setUserSuggestions([]) }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
              </div>
              {/* Dropdown suggestions */}
              {userSuggestions.length > 0 && (
                <div style={{ position: 'absolute', left: '16px', right: '16px', top: '72px', background: '#111', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                  {userSuggestions.map(u => (
                    <div
                      key={u.username}
                      className="suggestion-row"
                      onClick={() => startNewConvo(u.username)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'transparent', transition: 'background 0.1s' }}
                    >
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,var(--accent),#ff8c69)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {u.avatar_url
                          ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : u.username.slice(0, 2).toUpperCase()
                        }
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                        {u.username}
                        {buddies.includes(u.username) && <span style={{ fontSize: '9px', color: '#a855f7', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', padding: '1px 5px', fontWeight: 700, marginLeft: '6px' }}>BUDDY</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>✉️</div>
                No messages yet.<br />Hit + New to start a conversation.
              </div>
            )}
            {conversations.map(convo => (
              <div
                key={convo.username}
                onClick={() => setActiveConvo(convo.username)}
                className={`convo-row${activeConvo === convo.username ? ' active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', borderLeft: '3px solid transparent', transition: 'background 0.15s', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: 'linear-gradient(135deg,var(--accent),#ff8c69)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                  {avatars[convo.username]
                    ? <img src={avatars[convo.username]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : convo.username.slice(0, 2).toUpperCase()
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <div style={{ fontSize: '13px', fontWeight: convo.unread > 0 ? 700 : 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {convo.username}
                      {convo.isBuddy && <span style={{ fontSize: '9px', color: '#a855f7', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>BUDDY</span>}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', flexShrink: 0 }}>{fmt(convo.lastTime)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '12px', color: convo.unread > 0 ? 'var(--text)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px', fontWeight: convo.unread > 0 ? 600 : 400 }}>
                      {convo.lastMessage}
                    </div>
                    {convo.unread > 0 && (
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--accent)', fontSize: '10px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {convo.unread}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — active chat */}
        {activeConvo ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

            {/* Chat header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--surface)', flexShrink: 0 }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,var(--accent),#ff8c69)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {avatars[activeConvo]
                  ? <img src={avatars[activeConvo]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : activeConvo.slice(0, 2).toUpperCase()
                }
              </div>
              <div style={{ flex: 1 }}>
                <Link href={`/profile/${activeConvo}`} style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {activeConvo}
                  {buddies.includes(activeConvo) && <span style={{ fontSize: '9px', color: '#a855f7', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>BUDDY</span>}
                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>→ view profile</span>
                </Link>
              </div>
              <button onClick={() => setActiveConvo(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '4px' }}>✕</button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', marginTop: '60px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>👋</div>
                  Start the conversation with {activeConvo}
                </div>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.sender_username === profile?.username
                const showAvatar = i === 0 || messages[i - 1].sender_username !== msg.sender_username
                return (
                  <div key={msg.id} className="msg-bubble" style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '8px' }}>
                    {!isMe && showAvatar && (
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,#a855f7,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {avatars[msg.sender_username]
                          ? <img src={avatars[msg.sender_username]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : msg.sender_username.slice(0, 2).toUpperCase()
                        }
                      </div>
                    )}
                    {!isMe && !showAvatar && <div style={{ width: '28px', flexShrink: 0 }} />}
                    <div style={{ maxWidth: '65%' }}>
                      {showAvatar && !isMe && (
                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '3px', paddingLeft: '2px' }}>{msg.sender_username}</div>
                      )}
                      <div style={{
                        background: isMe ? 'var(--accent)' : 'var(--surface)',
                        border: isMe ? 'none' : '1px solid var(--border)',
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        padding: '10px 14px',
                        fontSize: '13px',
                        color: isMe ? '#fff' : 'var(--text)',
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                      }}>
                        {msg.text}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px', textAlign: isMe ? 'right' : 'left', paddingLeft: '2px', paddingRight: '2px' }}>
                        {fmt(msg.created_at)}
                        {isMe && msg.seen && <span style={{ marginLeft: '4px', color: '#22c55e' }}>· Seen</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0, display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder={`Message ${activeConvo}...`}
                rows={1}
                style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '10px 16px', color: 'var(--text)', fontSize: '13px', outline: 'none', fontFamily: 'DM Sans, sans-serif', resize: 'none', lineHeight: 1.5, maxHeight: '120px', overflowY: 'auto' }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: '#fff', fontSize: '16px', cursor: input.trim() && !sending ? 'pointer' : 'not-allowed', opacity: input.trim() && !sending ? 1 : 0.4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ➤
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '48px' }}>✉️</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px' }}>SELECT A CONVERSATION</div>
            <div style={{ fontSize: '13px' }}>Or hit + New to message anyone</div>
          </div>
        )}
      </div>
    </>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesInner />
    </Suspense>
  )
}