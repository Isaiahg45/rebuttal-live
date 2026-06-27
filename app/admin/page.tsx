'use client'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Nav from '../components/Nav'

const SERVER_URL = 'https://rebuttal-live-production-3388.up.railway.app'

// ─────────────────────────────────────────────────────────────────────────
// NOTE ON BACKEND DEPENDENCIES
// This file is frontend-only. The events below are NEW and assume matching
// handlers exist (or will be added) on the Socket.io server. Anything
// already in your server today (admin_get_settings, admin_update_settings,
// admin_create_skit_room, admin_skit_message, create_custom_room,
// admin_end_debate, admin_delete_message, admin_set_custom_result,
// rooms_update, new_message) is untouched in behavior.
//
// NEW events this file emits/listens for — you'll need to add these server-side:
//   admin_create_advanced_room   { username, topic, maxPlayers, duration, debateType, bots, token }
//     -> emit back: advanced_room_created { instanceId }
//   admin_list_users             { token }
//     -> emit back: admin_users_list  RebuttalUser[]
//   admin_kick_user              { username, token }
//   admin_ban_user               { username, banned, token }
//   admin_watch_room             { instanceId, token }   (start forwarding new_message/room_message_history for a room the admin isn't playing in)
//     -> emit back: room_message_history { instanceId, messages: SkitMessage[] }
//   new_message payloads should include an `instanceId` field so the admin
//   panel can route incoming lines to the right room's log.
//   Bot config shape sent on room creation:
//     bots: { name: string; mode: 'auto' | 'scripted'; script?: { text: string; atSeconds: number }[] }[]
// ─────────────────────────────────────────────────────────────────────────

interface AdminSettings {
  adminEmails: string[]
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
  instanceId?: string
}

interface RebuttalUser {
  username: string
  email?: string
  elo?: number
  banned: boolean
  createdAt?: string
}

interface ScriptedLine {
  id: string
  text: string
  atSeconds: number
}

interface BotConfig {
  id: string
  name: string
  mode: 'auto' | 'scripted'
  scriptedLines: ScriptedLine[]
}

type DurationUnit = 'seconds' | 'minutes' | 'hours'
type Tab = 'settings' | 'skits' | 'games' | 'users'

const DEFAULT_SETTINGS: AdminSettings = {
  adminEmails: ['lg@isaiahlive.com', 'zachariussong@gmail.com'],
  allowUnlimitedForAll: false,
  multiplayerMaxCap: 20,
  skitDefaultEmoji: '🎭',
  skitDefaultProLabel: 'Pro',
  skitDefaultConLabel: 'Con',
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function unitToSeconds(value: number, unit: DurationUnit) {
  if (unit === 'minutes') return value * 60
  if (unit === 'hours') return value * 3600
  return value
}

function formatSeconds(total: number) {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const parts = []
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  if (s || parts.length === 0) parts.push(`${s}s`)
  return parts.join(' ')
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

function Button({ children, onClick, variant = 'default', disabled, small }: { children: ReactNode; onClick: () => void; variant?: 'default' | 'accent' | 'green' | 'red' | 'gold'; disabled?: boolean; small?: boolean }) {
  const colors: Record<string, { bg: string; border: string; color: string }> = {
    default: { bg: 'rgba(255,255,255,0.04)', border: 'var(--border)', color: 'var(--text2)' },
    accent: { bg: 'rgba(230,57,70,0.15)', border: 'rgba(230,57,70,0.4)', color: 'var(--accent)' },
    green: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', color: 'var(--green)' },
    red: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', color: 'var(--red)' },
    gold: { bg: 'rgba(255,214,10,0.12)', border: 'rgba(255,214,10,0.4)', color: 'var(--gold)' },
  }
  const c = colors[variant]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? '6px 12px' : '9px 16px', borderRadius: '8px', border: `1px solid ${c.border}`, background: c.bg,
        color: c.color, fontSize: small ? '12px' : '13px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'DM Sans, sans-serif', opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'green' | 'red' }) {
  const colors: Record<string, { bg: string; color: string }> = {
    default: { bg: 'rgba(255,255,255,0.06)', color: 'var(--muted)' },
    green: { bg: 'rgba(34,197,94,0.12)', color: 'var(--green)' },
    red: { bg: 'rgba(239,68,68,0.12)', color: 'var(--red)' },
  }
  const c = colors[tone]
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', letterSpacing: '0.3px' }}>
      {children}
    </span>
  )
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'settings', label: 'Settings' },
  { id: 'skits', label: 'Skit Mode' },
  { id: 'games', label: 'Advanced Custom Games' },
  { id: 'users', label: 'Rebuttal Users' },
]

export default function AdminPanel() {
  const { profile, user } = useAuth()
  const myUsername = profile?.username || ''
  const socketRef = useRef<Socket | null>(null)

  const [tab, setTab] = useState<Tab>('settings')
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS)
  const [adminEmailsInput, setAdminEmailsInput] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const tokenRef = useRef<string | null>(null)

  const [rooms, setRooms] = useState<RoomSummary[]>([])

  // ── Skit mode state ──────────────────────────────────────────────
  const [skitTopic, setSkitTopic] = useState('')
  const [skitDebateType, setSkitDebateType] = useState<'text' | 'voice'>('text')
  const [skitEmoji, setSkitEmoji] = useState('')
  const [skitProLabel, setSkitProLabel] = useState('')
  const [skitConLabel, setSkitConLabel] = useState('')
  const [activeSkitRoomId, setActiveSkitRoomId] = useState<string | null>(null)
  const [skitMessages, setSkitMessages] = useState<SkitMessage[]>([])
  const [skitText, setSkitText] = useState('')
  const [skitScore, setSkitScore] = useState('15')
  const [skitFeedback, setSkitFeedback] = useState('')

  // ── Advanced custom games state ──────────────────────────────────
  const [advTopic, setAdvTopic] = useState('')
  const [advDebateType, setAdvDebateType] = useState<'text' | 'vc'>('text')
  const [advMaxPlayers, setAdvMaxPlayers] = useState('4')
  const [advUnlimitedPlayers, setAdvUnlimitedPlayers] = useState(false)
  const [advDurationValue, setAdvDurationValue] = useState('5')
  const [advDurationUnit, setAdvDurationUnit] = useState<DurationUnit>('minutes')
  const [advUnlimited, setAdvUnlimited] = useState(false)
  const [advBots, setAdvBots] = useState<BotConfig[]>([])
  const [advCreating, setAdvCreating] = useState(false)
  const [advError, setAdvError] = useState('')

  // Room-level moderation (end debate / force result)
  const [actionRoomId, setActionRoomId] = useState('')
  const [resultWinner, setResultWinner] = useState('')
  const [resultWinnerElo, setResultWinnerElo] = useState('25')
  const [resultLoserElo, setResultLoserElo] = useState('25')

  // ── Rebuttal users state ─────────────────────────────────────────
  const [users, setUsers] = useState<RebuttalUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => {
    if (!myUsername) return
    let cancelled = false

    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      tokenRef.current = data.session?.access_token ?? null
      socket.emit('admin_get_settings', { username: myUsername, token: tokenRef.current })
    })

    socket.on('admin_settings', (s: AdminSettings) => {
      clearTimeout(timeoutId)
      setSettings(s)
      setAdminEmailsInput(s.adminEmails.join(', '))
      setAuthorized(true)
    })

    socket.on('rooms_update', (r: RoomSummary[]) => setRooms(r))

    socket.on('admin_skit_created', ({ instanceId }: { instanceId: string; topic: string }) => {
      setActiveSkitRoomId(instanceId)
      setSkitMessages([])
    })

    socket.on('advanced_room_created', ({ instanceId }: { instanceId: string }) => {
      setAdvCreating(false)
      setActionRoomId(instanceId)
    })

    socket.on('new_message', (msg: SkitMessage) => {
      if (activeSkitRoomId && (!msg.instanceId || msg.instanceId === activeSkitRoomId)) {
        setSkitMessages(prev => [...prev, msg])
      }
    })

    socket.on('admin_users_list', (list: RebuttalUser[]) => {
      setUsers(list)
      setUsersLoading(false)
    })

    socket.on('error', ({ message }: { message: string }) => {
      alert(message)
      setAdvCreating(false)
    })

    const timeoutId = setTimeout(() => setAuthorized(false), 2000)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      socket.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUsername])

  async function getFreshToken() {
    const { data } = await supabase.auth.getSession()
    tokenRef.current = data.session?.access_token ?? null
    return tokenRef.current
  }

  // ── Settings ──────────────────────────────────────────────────────
  async function saveSettings() {
    const token = await getFreshToken()
    const parsedEmails = adminEmailsInput.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    const updated: AdminSettings = {
      ...settings,
      adminEmails: parsedEmails.length > 0 ? parsedEmails : settings.adminEmails,
    }
    socketRef.current?.emit('admin_update_settings', { username: myUsername, settings: updated, token })
    setSaveMsg('Saved ✓')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  // ── Skit mode ─────────────────────────────────────────────────────
  async function createSkitRoom() {
    if (!skitTopic.trim()) { alert('Give the skit a topic first.'); return }
    const token = await getFreshToken()
    socketRef.current?.emit('admin_create_skit_room', {
      username: myUsername,
      topic: skitTopic.trim(),
      debateType: skitDebateType,
      emoji: skitEmoji.trim() || undefined,
      proLabel: skitProLabel.trim() || undefined,
      conLabel: skitConLabel.trim() || undefined,
      token,
    })
  }

  async function sendSkit(side: 'pro' | 'con') {
    if (!activeSkitRoomId || !skitText.trim()) return
    const token = await getFreshToken()
    socketRef.current?.emit('admin_skit_message', {
      instanceId: activeSkitRoomId,
      username: myUsername,
      side,
      text: skitText.trim(),
      score: Number(skitScore) || 0,
      feedback: skitFeedback.trim(),
      token,
    })
    setSkitText('')
    setSkitFeedback('')
  }

  // ── Advanced custom games ────────────────────────────────────────
  function addBot() {
    if (advBots.length >= 10) return
    setAdvBots(prev => [...prev, { id: uid(), name: `Bot ${prev.length + 1}`, mode: 'auto', scriptedLines: [] }])
  }

  function removeBot(id: string) {
    setAdvBots(prev => prev.filter(b => b.id !== id))
  }

  function updateBot(id: string, patch: Partial<BotConfig>) {
    setAdvBots(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)))
  }

  function addScriptedLine(botId: string) {
    setAdvBots(prev => prev.map(b => b.id === botId
      ? { ...b, scriptedLines: [...b.scriptedLines, { id: uid(), text: '', atSeconds: 20 }] }
      : b))
  }

  function updateScriptedLine(botId: string, lineId: string, patch: Partial<ScriptedLine>) {
    setAdvBots(prev => prev.map(b => b.id === botId
      ? { ...b, scriptedLines: b.scriptedLines.map(l => (l.id === lineId ? { ...l, ...patch } : l)) }
      : b))
  }

  function removeScriptedLine(botId: string, lineId: string) {
    setAdvBots(prev => prev.map(b => b.id === botId
      ? { ...b, scriptedLines: b.scriptedLines.filter(l => l.id !== lineId) }
      : b))
  }

  async function createAdvancedRoom() {
    if (!advTopic.trim() || advTopic.trim().length < 10) { setAdvError('Topic needs to be at least 10 characters.'); return }
    const isVoice = advDebateType === 'vc'
    const maxPlayers = Number(advMaxPlayers)
    if (!isVoice && !advUnlimitedPlayers && (!maxPlayers || maxPlayers < 1)) { setAdvError('Max players must be at least 1.'); return }
    const durationValue = Number(advDurationValue)
    if (!advUnlimited && (!durationValue || durationValue < 1)) { setAdvError('Duration must be at least 1 second.'); return }
    if (!isVoice) {
      for (const bot of advBots) {
        if (bot.mode === 'scripted' && bot.scriptedLines.some(l => !l.text.trim())) {
          setAdvError(`${bot.name} has a scripted line with no text.`)
          return
        }
      }
    }
    setAdvError('')
    setAdvCreating(true)
    const token = await getFreshToken()
    const duration = advUnlimited ? 'unlimited' : unitToSeconds(durationValue, advDurationUnit)
    socketRef.current?.emit('admin_create_advanced_room', {
      username: myUsername,
      topic: advTopic.trim(),
      maxPlayers,
      unlimitedPlayers: advUnlimitedPlayers,
      duration,
      debateType: advDebateType,
      bots: isVoice ? [] : advBots.map(b => ({
        name: b.name.trim() || 'Bot',
        mode: b.mode,
        script: b.mode === 'scripted'
          ? b.scriptedLines.map(l => ({ text: l.text.trim(), atSeconds: Math.max(0, Math.round(l.atSeconds)) }))
          : undefined,
      })),
      token,
    })
  }

  // ── Room-level moderation ──────────────────────────────────────────
  async function endDebate() {
    if (!actionRoomId) { alert('Pick a room first.'); return }
    const token = await getFreshToken()
    socketRef.current?.emit('admin_end_debate', { instanceId: actionRoomId, username: myUsername, token })
  }

  async function setCustomResult() {
    if (!actionRoomId || !resultWinner.trim()) { alert('Need a room and a winner username.'); return }
    const token = await getFreshToken()
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
      token,
    })
  }

  // ── Rebuttal users ────────────────────────────────────────────────
  async function loadUsers() {
    setUsersLoading(true)
    const token = await getFreshToken()
    socketRef.current?.emit('admin_list_users', { token })
  }

  useEffect(() => {
    if (tab === 'users' && authorized) loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, authorized])

  async function kickUser(username: string) {
    if (!confirm(`Kick ${username} from their current room?`)) return
    const token = await getFreshToken()
    socketRef.current?.emit('admin_kick_user', { username, token })
  }

  async function toggleBan(u: RebuttalUser) {
    const next = !u.banned
    if (!confirm(next ? `Ban ${u.username}? They won't be able to play until unbanned.` : `Unban ${u.username}?`)) return
    const token = await getFreshToken()
    socketRef.current?.emit('admin_ban_user', { username: u.username, banned: next, token })
    setUsers(prev => prev.map(x => (x.username === u.username ? { ...x, banned: next } : x)))
  }

  function isUserInRoom(username: string) {
    return rooms.some(r => r.players.includes(username))
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
  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(userSearch.trim().toLowerCase()))

  return (
    <>
      <Nav active="admin" />
      <div style={{ minHeight: 'calc(100vh - 56px)', overflowY: 'auto', padding: '28px 20px' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '32px', letterSpacing: '2px' }}>ADMIN PANEL</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Signed in as <b style={{ color: 'var(--accent)' }}>{myUsername}</b></div>
          </div>

          {/* ── Tab nav ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '22px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 700,
                  color: tab === t.id ? 'var(--accent)' : 'var(--muted)',
                  borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Settings tab ────────────────────────────────────── */}
          {tab === 'settings' && (
            <Card title="Settings" subtitle="Persisted to Supabase — changes apply immediately, no redeploy needed">
              <Field label="Admin emails (comma-separated)">
                <input style={inputStyle} value={adminEmailsInput} onChange={e => setAdminEmailsInput(e.target.value)} placeholder="lg@isaiahlive.com, zachariussong@gmail.com" />
              </Field>
              <Field label="Allow unlimited-duration rooms for every user (not just admins)">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.allowUnlimitedForAll} onChange={e => setSettings(s => ({ ...s, allowUnlimitedForAll: e.target.checked }))} />
                  Enabled for everyone
                </label>
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
          )}

          {/* ── Skit mode tab ───────────────────────────────────── */}
          {tab === 'skits' && (
            <Card title="Skit mode" subtitle="Script both sides of a debate without real accounts — for marketing clips and demos">
              {!activeSkitRoomId ? (
                <>
                  <Field label="Topic"><input style={inputStyle} value={skitTopic} onChange={e => setSkitTopic(e.target.value)} placeholder="Is pineapple on pizza a crime?" /></Field>
                  <Field label="Debate type">
                    <select style={inputStyle} value={skitDebateType} onChange={e => setSkitDebateType(e.target.value as 'text' | 'voice')}>
                      <option value="text">Text</option>
                      <option value="voice">Voice</option>
                    </select>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
                      Voice just changes the room's label/emoji for now — your scripted lines still show as text, since there's no audio synthesis wired up yet.
                    </div>
                  </Field>
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
          )}

          {/* ── Advanced custom games tab ───────────────────────── */}
          {tab === 'games' && (
            <>
              <Card title="Create an advanced custom room" subtitle="Set the debate type, capacity, duration, and bot behavior before the game starts">
                <Field label="Topic"><input style={inputStyle} value={advTopic} onChange={e => setAdvTopic(e.target.value)} placeholder="At least 10 characters" /></Field>

                <Field label="Debate type">
                  <select style={inputStyle} value={advDebateType} onChange={e => setAdvDebateType(e.target.value as 'text' | 'vc')}>
                    <option value="text">Text (1 to unlimited players)</option>
                    <option value="vc">Voice (1v1 only)</option>
                  </select>
                </Field>

                {advDebateType === 'text' ? (
                  <Field label="Max players">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        style={{ ...inputStyle, opacity: advUnlimitedPlayers ? 0.4 : 1, width: '120px' }}
                        type="number" min={1} disabled={advUnlimitedPlayers}
                        value={advMaxPlayers} onChange={e => setAdvMaxPlayers(e.target.value)}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text2)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={advUnlimitedPlayers} onChange={e => setAdvUnlimitedPlayers(e.target.checked)} />
                        Unlimited players
                      </label>
                    </div>
                  </Field>
                ) : (
                  <Field label="Max players">
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>2 (voice debates are 1v1 only)</div>
                  </Field>
                )}

                <Field label="Duration">
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      style={{ ...inputStyle, opacity: advUnlimited ? 0.4 : 1, width: '110px' }}
                      type="number" min={1} disabled={advUnlimited}
                      value={advDurationValue} onChange={e => setAdvDurationValue(e.target.value)}
                    />
                    <select
                      style={{ ...inputStyle, opacity: advUnlimited ? 0.4 : 1, width: '130px' }}
                      disabled={advUnlimited} value={advDurationUnit}
                      onChange={e => setAdvDurationUnit(e.target.value as DurationUnit)}
                    >
                      <option value="seconds">Seconds</option>
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text2)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={advUnlimited} onChange={e => setAdvUnlimited(e.target.checked)} />
                      Unlimited (never auto-ends)
                    </label>
                  </div>
                  {!advUnlimited && Number(advDurationValue) > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
                      = {formatSeconds(unitToSeconds(Number(advDurationValue), advDurationUnit))}
                    </div>
                  )}
                </Field>

                {/* ── Bots — text rooms only, no audio synthesis exists for voice bots ── */}
                {advDebateType === 'text' && (
                <Field label={`Bots (${advBots.length}/10)`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {advBots.map(bot => (
                      <div key={bot.id} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                          <input
                            style={{ ...inputStyle, flex: 1 }}
                            value={bot.name}
                            onChange={e => updateBot(bot.id, { name: e.target.value })}
                          />
                          <select
                            style={{ ...inputStyle, width: '170px' }}
                            value={bot.mode}
                            onChange={e => updateBot(bot.id, { mode: e.target.value as 'auto' | 'scripted' })}
                          >
                            <option value="auto">Auto-debate topic</option>
                            <option value="scripted">Pre-scripted lines</option>
                          </select>
                          <Button small variant="red" onClick={() => removeBot(bot.id)}>Remove</Button>
                        </div>

                        {bot.mode === 'auto' ? (
                          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            This bot will argue normally based on the room's topic, like any standard AI debater.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {bot.scriptedLines.length === 0 && (
                              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>No scripted lines yet — add one below.</div>
                            )}
                            {bot.scriptedLines.map(line => (
                              <div key={line.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <textarea
                                  style={{ ...inputStyle, flex: 1, minHeight: '40px', resize: 'vertical' }}
                                  placeholder="What the bot will say…"
                                  value={line.text}
                                  onChange={e => updateScriptedLine(bot.id, line.id, { text: e.target.value })}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    style={{ ...inputStyle, width: '80px' }}
                                    type="number" min={0}
                                    value={line.atSeconds}
                                    onChange={e => updateScriptedLine(bot.id, line.id, { atSeconds: Number(e.target.value) })}
                                  />
                                  <span style={{ fontSize: '10px', color: 'var(--muted)' }}>sec into game</span>
                                </div>
                                <Button small variant="red" onClick={() => removeScriptedLine(bot.id, line.id)}>×</Button>
                              </div>
                            ))}
                            <div>
                              <Button small onClick={() => addScriptedLine(bot.id)}>+ Add line</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div>
                      <Button onClick={addBot} disabled={advBots.length >= 10}>+ Add bot</Button>
                    </div>
                  </div>
                </Field>
                )}

                {advError && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: '12px' }}>
                    ⚠️ {advError}
                  </div>
                )}

                <Button onClick={createAdvancedRoom} variant="accent" disabled={advCreating}>
                  {advCreating ? 'Creating…' : 'Create advanced room'}
                </Button>
              </Card>

              <Card title="Room controls" subtitle="End an unlimited-duration debate, or force a result on a custom room. Per-message delete now lives in the live debate room itself, not here.">
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

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                  <Button onClick={endDebate} variant="red">End this debate now</Button>
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
            </>
          )}

          {/* ── Rebuttal users tab ──────────────────────────────── */}
          {tab === 'users' && (
            <Card title="Rebuttal users" subtitle="Search, kick from a live room, or ban/unban an account">
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <input style={inputStyle} placeholder="Search username…" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                <Button onClick={loadUsers}>{usersLoading ? 'Loading…' : 'Refresh'}</Button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredUsers.length === 0 && (
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    {usersLoading ? 'Loading users…' : 'No users found. If this persists, check the Railway logs for an admin_list_users error.'}
                  </div>
                )}
                {filteredUsers.map(u => (
                  <div key={u.username} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>
                        @{u.username} {u.banned ? <Badge tone="red">Banned</Badge> : isUserInRoom(u.username) ? <Badge tone="green">In room</Badge> : <Badge>Active</Badge>}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {u.email ? `${u.email} · ` : ''}{u.elo !== undefined ? `${u.elo} ELO` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button small disabled={!isUserInRoom(u.username)} onClick={() => kickUser(u.username)}>Kick</Button>
                      <Button small variant={u.banned ? 'green' : 'red'} onClick={() => toggleBan(u)}>{u.banned ? 'Unban' : 'Ban'}</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}