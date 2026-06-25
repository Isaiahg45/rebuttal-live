'use client'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'

const SERVER_URL = 'https://rebuttal-live-production-3388.up.railway.app'

interface AdminSettings {
  adminUsernames: string[]
  allowUnlimitedForAll: boolean
  multiplayerMaxCap: number
  skitDefaultEmoji: string
  skitDefaultProLabel: string
  skitDefaultConLabel: string
}

interface RoomSummary {
  instanceId: string
  topic: string
  type: string
  status: string
  playerCount: number
  players: string[]
}

interface SkitMessage {
  id: string
  username: string
  text: string
  score: number
  aiFeedback: string
}

const DEFAULT_SETTINGS: AdminSettings = {
  adminUsernames: ['jake', 'zay'],
  allowUnlimitedForAll: false,
  multiplayerMaxCap: 20,
  skitDefaultEmoji: '🎭',
  skitDefaultProLabel: 'Pro',
  skitDefaultConLabel: 'Con',
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '18px', letterSpacing: '1px' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{subtitle}</div>}
      </div>
      <div style={{ padding: '18px 20px' }}>{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle: CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.03)', color: 'var(--text)', fontSize: '13px',
  fontFamily: 'DM Sans, sans-serif', outline: 'none',
}

function Button({ children, onClick, variant = 'default', disabled }: { children: ReactNode; onClick: () => void; variant?: 'default' | 'accent' | 'green' | 'red'; disabled?: boolean }) {
  const colors: Record<string, { bg: string; border: string; color: string }> = {
    default: { bg: 'rgba(255,255,255,0.04)', border: 'var(--border)', color: 'var(--text2)' },
    accent: { bg: 'rgba(230,57,70,0.15)', border: 'rgba(230,57,70,0.4)', color: 'var(--accent)' },
    green: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', color: 'var(--green)' },
    red: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', color: 'var(--red)' },
  }
  const c = colors[variant]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '9px 16px', borderRadius: '8px', border: `1px solid ${c.border}`, background: c.bg,
        color: c.color, fontSize: '13px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'DM Sans, sans-serif', opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

export default function AdminPanel() {
  const { profile, user } = useAuth()
  const myUsername = profile?.username || ''
  const socketRef = useRef<Socket | null>(null)

  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS)
  const [adminUsernamesInput, setAdminUsernamesInput] = useState('')
  const [saveMsg, setSaveMsg] = useState('')

  const [rooms, setRooms] = useState<RoomSummary[]>([])

  // Skit mode
  const [skitTopic, setSkitTopic] = useState('')
  const [skitEmoji, setSkitEmoji] = useState('')
  const [skitProLabel, setSkitProLabel] = useState('')
  const [skitConLabel, setSkitConLabel] = useState('')
  const [activeSkitRoomId, setActiveSkitRoomId] = useState<string | null>(null)
  const [skitMessages, setSkitMessages] = useState<SkitMessage[]>([])
  const [skitText, setSkitText] = useState('')
  const [skitScore, setSkitScore] = useState('15')
  const [skitFeedback, setSkitFeedback] = useState('')

  // Multiplayer / unlimited room creator
  const [mpTopic, setMpTopic] = useState('')
  const [mpMaxPlayers, setMpMaxPlayers] = useState('4')
  const [mpUnlimited, setMpUnlimited] = useState(false)
  const [mpDurationSec, setMpDurationSec] = useState('300')
  const [mpDebateType, setMpDebateType] = useState<'text' | 'vc'>('text')

  // Live room actions
  const [actionRoomId, setActionRoomId] = useState('')
  const [deleteMessageId, setDeleteMessageId] = useState('')
  const [resultWinner, setResultWinner] = useState('')
  const [resultWinnerElo, setResultWinnerElo] = useState('25')
  const [resultLoserElo, setResultLoserElo] = useState('25')

  useEffect(() => {
    if (!myUsername) return
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('admin_get_settings', { username: myUsername })
    })

    socket.on('admin_settings', (s: AdminSettings) => {
      clearTimeout(timeoutId)
      setSettings(s)
      setAdminUsernamesInput(s.adminUsernames.join(', '))
      setAuthorized(true) // server only replies to admins, so receiving this proves access
    })

    socket.on('rooms_update', (r: RoomSummary[]) => setRooms(r))

    socket.on('admin_skit_created', ({ instanceId, topic }: { instanceId: string; topic: string }) => {
      setActiveSkitRoomId(instanceId)
      setSkitMessages([])
    })

    socket.on('new_message', (msg: SkitMessage) => {
      setSkitMessages(prev => [...prev, msg])
    })

    socket.on('error', ({ message }: { message: string }) => {
      alert(message)
    })

    // If nothing comes back within 2s, this account isn't an admin.
    // Cleared above as soon as admin_settings actually arrives.
    const timeoutId = setTimeout(() => setAuthorized(false), 2000)

    return () => {
      clearTimeout(timeoutId)
      socket.disconnect()
    }
  }, [myUsername])

  function saveSettings() {
    const parsedUsernames = adminUsernamesInput.split(',').map(u => u.trim()).filter(Boolean)
    const updated: AdminSettings = {
      ...settings,
      adminUsernames: parsedUsernames.length > 0 ? parsedUsernames : settings.adminUsernames,
    }
    socketRef.current?.emit('admin_update_settings', { username: myUsername, settings: updated })
    setSaveMsg('Saved ✓')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  function createSkitRoom() {
    if (!skitTopic.trim()) { alert('Give the skit a topic first.'); return }
    socketRef.current?.emit('admin_create_skit_room', {
      username: myUsername,
      topic: skitTopic.trim(),
      emoji: skitEmoji.trim() || undefined,
      proLabel: skitProLabel.trim() || undefined,
      conLabel: skitConLabel.trim() || undefined,
    })
  }

  function sendSkit(side: 'pro' | 'con') {
    if (!activeSkitRoomId || !skitText.trim()) return
    socketRef.current?.emit('admin_skit_message', {
      instanceId: activeSkitRoomId,
      username: myUsername,
      side,
      text: skitText.trim(),
      score: Number(skitScore) || 0,
      feedback: skitFeedback.trim(),
    })
    setSkitText('')
    setSkitFeedback('')
  }

  function createMultiplayerRoom() {
    if (!mpTopic.trim() || mpTopic.trim().length < 10) { alert('Topic needs to be at least 10 characters.'); return }
    socketRef.current?.emit('create_custom_room', {
      username: myUsername,
      topic: mpTopic.trim(),
      duration: mpUnlimited ? 'unlimited' : Number(mpDurationSec) || 300,
      isPrivate: false,
      debateType: mpDebateType,
      maxPlayers: Number(mpMaxPlayers) || 2,
    })
    setMpTopic('')
  }

  function endDebate() {
    if (!actionRoomId) { alert('Pick a room first.'); return }
    socketRef.current?.emit('admin_end_debate', { instanceId: actionRoomId, username: myUsername })
  }

  function deleteMessage() {
    if (!actionRoomId || !deleteMessageId.trim()) { alert('Need both a room and a message ID.'); return }
    socketRef.current?.emit('admin_delete_message', { instanceId: actionRoomId, messageId: deleteMessageId.trim(), username: myUsername })
    setDeleteMessageId('')
  }

  function setCustomResult() {
    if (!actionRoomId || !resultWinner.trim()) { alert('Need a room and a winner username.'); return }
    socketRef.current?.emit('admin_set_custom_result', {
      instanceId: actionRoomId,
      username: myUsername,
      winnerUsername: resultWinner.trim(),
      eloChanges: {
        winnerElo: Number(resultWinnerElo) || 0,
        secondElo: 0,
        thirdElo: 0,
        loserBase: Number(resultLoserElo) || 0,
      },
    })
  }

  if (!user) {
    return (
      <>
        <Nav active="admin" />
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>Log in to access this page.</div>
      </>
    )
  }

  if (authorized === null) {
    return (
      <>
        <Nav active="admin" />
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>Checking access…</div>
      </>
    )
  }

  if (authorized === false) {
    return (
      <>
        <Nav active="admin" />
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
          <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', color: 'var(--red)' }}>Not authorized</div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>This account isn't on the admin list.</div>
        </div>
      </>
    )
  }

  const activeSkitTopic = rooms.find(r => r.instanceId === activeSkitRoomId)?.topic

  return (
    <>
      <Nav active="admin" />
      <div style={{ minHeight: 'calc(100vh - 56px)', overflowY: 'auto', padding: '28px 20px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '32px', letterSpacing: '2px' }}>ADMIN PANEL</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Signed in as <b style={{ color: 'var(--accent)' }}>{myUsername}</b></div>
          </div>

          {/* ── Runtime settings ───────────────────────────── */}
          <Card title="Settings" subtitle="Persisted to Supabase — changes apply immediately, no redeploy needed">
            <Field label="Admin usernames (comma-separated)">
              <input style={inputStyle} value={adminUsernamesInput} onChange={e => setAdminUsernamesInput(e.target.value)} placeholder="jake, zay" />
            </Field>
            <Field label="Allow unlimited-duration rooms for every user (not just admins)">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.allowUnlimitedForAll} onChange={e => setSettings(s => ({ ...s, allowUnlimitedForAll: e.target.checked }))} />
                Enabled for everyone
              </label>
            </Field>
            <Field label="Multiplayer custom room cap (max players)">
              <input style={inputStyle} type="number" min={2} max={50} value={settings.multiplayerMaxCap} onChange={e => setSettings(s => ({ ...s, multiplayerMaxCap: Number(e.target.value) }))} />
            </Field>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Field label="Skit default emoji">
                <input style={inputStyle} value={settings.skitDefaultEmoji} onChange={e => setSettings(s => ({ ...s, skitDefaultEmoji: e.target.value }))} />
              </Field>
              <Field label="Skit default pro label">
                <input style={inputStyle} value={settings.skitDefaultProLabel} onChange={e => setSettings(s => ({ ...s, skitDefaultProLabel: e.target.value }))} />
              </Field>
              <Field label="Skit default con label">
                <input style={inputStyle} value={settings.skitDefaultConLabel} onChange={e => setSettings(s => ({ ...s, skitDefaultConLabel: e.target.value }))} />
              </Field>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
              <Button onClick={saveSettings} variant="accent">Save settings</Button>
              {saveMsg && <span style={{ fontSize: '13px', color: 'var(--green)' }}>{saveMsg}</span>}
            </div>
          </Card>

          {/* ── Skit mode ───────────────────────────────────── */}
          <Card title="Skit mode" subtitle="Script both sides of a debate without real accounts">
            {!activeSkitRoomId ? (
              <>
                <Field label="Topic"><input style={inputStyle} value={skitTopic} onChange={e => setSkitTopic(e.target.value)} placeholder="Is pineapple on pizza a crime?" /></Field>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Field label="Emoji (optional)"><input style={inputStyle} value={skitEmoji} onChange={e => setSkitEmoji(e.target.value)} placeholder={settings.skitDefaultEmoji} /></Field>
                  <Field label="Pro label (optional)"><input style={inputStyle} value={skitProLabel} onChange={e => setSkitProLabel(e.target.value)} placeholder={settings.skitDefaultProLabel} /></Field>
                  <Field label="Con label (optional)"><input style={inputStyle} value={skitConLabel} onChange={e => setSkitConLabel(e.target.value)} placeholder={settings.skitDefaultConLabel} /></Field>
                </div>
                <Button onClick={createSkitRoom} variant="accent">Create skit room</Button>
              </>
            ) : (
              <>
                <div style={{ fontSize: '13px', color: 'var(--green)', marginBottom: '12px' }}>
                  🎬 Live: <b>{activeSkitTopic}</b> ({activeSkitRoomId})
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '10px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {skitMessages.length === 0 && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>No lines yet — write the first one below.</div>}
                  {skitMessages.map(m => (
                    <div key={m.id} style={{ fontSize: '13px' }}>
                      <b style={{ color: 'var(--accent)' }}>{m.username}:</b> {m.text}
                      <span style={{ color: 'var(--muted)', fontSize: '11px', marginLeft: '6px' }}>+{m.score} pts{m.aiFeedback ? ` — ${m.aiFeedback}` : ''}</span>
                    </div>
                  ))}
                </div>
                <Field label="Line"><textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={skitText} onChange={e => setSkitText(e.target.value)} /></Field>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Field label="Score"><input style={inputStyle} type="number" min={0} max={30} value={skitScore} onChange={e => setSkitScore(e.target.value)} /></Field>
                  <Field label="AI feedback (optional)"><input style={inputStyle} value={skitFeedback} onChange={e => setSkitFeedback(e.target.value)} /></Field>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Button onClick={() => sendSkit('pro')} variant="green">Send as Pro</Button>
                  <Button onClick={() => sendSkit('con')} variant="red">Send as Con</Button>
                  <Button onClick={() => { setActiveSkitRoomId(null); setSkitMessages([]) }}>Close skit</Button>
                </div>
              </>
            )}
          </Card>

          {/* ── Multiplayer / unlimited room creator ─────────── */}
          <Card title="Create a custom room" subtitle="Multiplayer (3+) and unlimited-duration options, admin-only unless enabled above">
            <Field label="Topic"><input style={inputStyle} value={mpTopic} onChange={e => setMpTopic(e.target.value)} placeholder="At least 10 characters" /></Field>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Field label="Max players">
                <input style={inputStyle} type="number" min={2} max={settings.multiplayerMaxCap} value={mpMaxPlayers} onChange={e => setMpMaxPlayers(e.target.value)} />
              </Field>
              <Field label="Type">
                <select style={inputStyle} value={mpDebateType} onChange={e => setMpDebateType(e.target.value as 'text' | 'vc')}>
                  <option value="text">Text</option>
                  <option value="vc">Voice</option>
                </select>
              </Field>
              <Field label="Duration (sec)">
                <input style={{ ...inputStyle, opacity: mpUnlimited ? 0.4 : 1 }} type="number" disabled={mpUnlimited} value={mpDurationSec} onChange={e => setMpDurationSec(e.target.value)} />
              </Field>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text2)', cursor: 'pointer', marginBottom: '12px' }}>
              <input type="checkbox" checked={mpUnlimited} onChange={e => setMpUnlimited(e.target.checked)} />
              Unlimited duration (never auto-ends — end manually below)
            </label>
            <Button onClick={createMultiplayerRoom} variant="accent">Create room</Button>
          </Card>

          {/* ── Live room actions ─────────────────────────────── */}
          <Card title="Live room actions" subtitle="End a debate, delete a message, or force a result on a custom/skit room">
            <Field label="Room">
              <select style={inputStyle} value={actionRoomId} onChange={e => setActionRoomId(e.target.value)}>
                <option value="">Select a room…</option>
                {rooms.map(r => (
                  <option key={r.instanceId} value={r.instanceId}>
                    [{r.status}] {r.topic} ({r.playerCount} in room)
                  </option>
                ))}
              </select>
            </Field>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '6px' }}>
              <Button onClick={endDebate} variant="red">End this debate now</Button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '14px' }}>
              <Field label="Message ID to delete">
                <input style={inputStyle} value={deleteMessageId} onChange={e => setDeleteMessageId(e.target.value)} placeholder="Copy from message_history / new_message payload" />
              </Field>
              <Button onClick={deleteMessage} variant="red">Delete message</Button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '14px' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                Custom results only work on <b>custom</b> or <b>skit</b> rooms — not standard matchmaking rooms.
              </div>
              <Field label="Winner username"><input style={inputStyle} value={resultWinner} onChange={e => setResultWinner(e.target.value)} /></Field>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Field label="Winner ELO gain"><input style={inputStyle} type="number" value={resultWinnerElo} onChange={e => setResultWinnerElo(e.target.value)} /></Field>
                <Field label="Loser ELO loss"><input style={inputStyle} type="number" value={resultLoserElo} onChange={e => setResultLoserElo(e.target.value)} /></Field>
              </div>
              <Button onClick={setCustomResult} variant="accent">Force result</Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}