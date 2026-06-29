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
// This file is frontend-only. It assumes these server-side events exist:
//   admin_get_settings / admin_update_settings
//   admin_create_skit_room   { username, topic, debateType, maxPlayers,
//                              unlimitedPlayers, duration, bots, token }
//     -> emit back: admin_skit_created { instanceId, topic }
//   admin_skit_message      { instanceId, speakerName, text, score, feedback, token }
//   admin_broadcast_message { username, message, token } — notifies every
//     non-guest user, attributed to "Rebuttal Live"
//   admin_end_debate        { instanceId, username, token }
//   admin_set_custom_result { instanceId, username, winnerUsername, eloChanges, token }
//   admin_end_all_skits     { username, token }  — kill switch, force-ends every active skit
//   admin_list_users  { token } -> admin_users_list  RebuttalUser[]
//   admin_ban_user    { username, banned, token }
//   admin_send_warning { username, recipientUsername, message, token } —
//     writes a notification attributed to "Rebuttal Live", not the admin's account
//   rooms_update / new_message — new_message payloads should include an
//   `instanceId` field so this panel can route incoming lines to the right
//   room's log.
//   Bot config shape sent on room creation:
//     bots: { name: string; mode: 'auto' | 'scripted'; script?: { text: string; atSeconds: number }[] }[]
// ─────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────

interface AdminSettings {
  adminEmails: string[]
  multiplayerMaxCap: number
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
  online?: boolean
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
type Tab = 'settings' | 'skits' | 'users'

const DEFAULT_SETTINGS: AdminSettings = {
  adminEmails: ['lg@isaiahlive.com', 'zachariussong@gmail.com'],
  multiplayerMaxCap: 20,
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
  const [activeSkitRoomId, setActiveSkitRoomId] = useState<string | null>(null)
  const activeSkitRoomIdRef = useRef<string | null>(null)
  useEffect(() => { activeSkitRoomIdRef.current = activeSkitRoomId }, [activeSkitRoomId])
  const [skitMessages, setSkitMessages] = useState<SkitMessage[]>([])
const [skitSpeakerName, setSkitSpeakerName] = useState('')
  const [skitText, setSkitText] = useState('')
  const [skitScore, setSkitScore] = useState('15')
  const [skitFeedback, setSkitFeedback] = useState('')

  // Capacity, duration, and bots — folded in from the old Advanced Custom
  // Games tab, since a skit is just a "pretend game" with the same needs.
  const [skitMaxPlayers, setSkitMaxPlayers] = useState('10')
  const [skitUnlimitedPlayers, setSkitUnlimitedPlayers] = useState(true)
  const [skitDurationValue, setSkitDurationValue] = useState('5')
  const [skitDurationUnit, setSkitDurationUnit] = useState<DurationUnit>('minutes')
  const [skitUnlimitedDuration, setSkitUnlimitedDuration] = useState(true)
  const [skitBots, setSkitBots] = useState<BotConfig[]>([])
  const [skitCreating, setSkitCreating] = useState(false)
  const [skitError, setSkitError] = useState('')
  const [endingAllSkits, setEndingAllSkits] = useState(false)

  // Force-result controls for the currently open skit
  const [skitWinner, setSkitWinner] = useState('')
  const [skitWinnerElo, setSkitWinnerElo] = useState('25')
  const [skitLoserElo, setSkitLoserElo] = useState('25')

  // ── Rebuttal users state ─────────────────────────────────────────
  const [users, setUsers] = useState<RebuttalUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [warnTarget, setWarnTarget] = useState<string | null>(null)
  const [warnText, setWarnText] = useState('')
  const [warnSending, setWarnSending] = useState(false)

  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastSending, setBroadcastSending] = useState(false)

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
      setSkitCreating(false)
      setActiveSkitRoomId(instanceId)
      setSkitMessages([])
    })

    socket.on('new_message', (msg: SkitMessage) => {
      const currentSkitId = activeSkitRoomIdRef.current
      if (currentSkitId && (!msg.instanceId || msg.instanceId === currentSkitId)) {
        setSkitMessages(prev => [...prev, msg])
      }
    })

    socket.on('admin_users_list', (list: RebuttalUser[]) => {
      setUsers(list)
      setUsersLoading(false)
    })

    socket.on('error', ({ message }: { message: string }) => {
      alert(message)
      setSkitCreating(false)
      setEndingAllSkits(false)
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
  function addBot() {
    if (skitBots.length >= 10) return
    setSkitBots(prev => [...prev, { id: uid(), name: `Bot ${prev.length + 1}`, mode: 'auto', scriptedLines: [] }])
  }

  function removeBot(id: string) {
    setSkitBots(prev => prev.filter(b => b.id !== id))
  }

  function updateBot(id: string, patch: Partial<BotConfig>) {
    setSkitBots(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)))
  }

  function addScriptedLine(botId: string) {
    setSkitBots(prev => prev.map(b => b.id === botId
      ? { ...b, scriptedLines: [...b.scriptedLines, { id: uid(), text: '', atSeconds: 20 }] }
      : b))
  }

  function updateScriptedLine(botId: string, lineId: string, patch: Partial<ScriptedLine>) {
    setSkitBots(prev => prev.map(b => b.id === botId
      ? { ...b, scriptedLines: b.scriptedLines.map(l => (l.id === lineId ? { ...l, ...patch } : l)) }
      : b))
  }

  function removeScriptedLine(botId: string, lineId: string) {
    setSkitBots(prev => prev.map(b => b.id === botId
      ? { ...b, scriptedLines: b.scriptedLines.filter(l => l.id !== lineId) }
      : b))
  }

  async function createSkitRoom() {
    if (!skitTopic.trim() || skitTopic.trim().length < 10) { setSkitError('Topic needs to be at least 10 characters.'); return }
    const isVoice = skitDebateType === 'voice'
    const maxPlayers = Number(skitMaxPlayers)
    if (!isVoice && !skitUnlimitedPlayers && (!maxPlayers || maxPlayers < 1)) { setSkitError('Max players must be at least 1.'); return }
    const durationValue = Number(skitDurationValue)
    if (!skitUnlimitedDuration && (!durationValue || durationValue < 1)) { setSkitError('Duration must be at least 1 second.'); return }
    if (!isVoice) {
      for (const bot of skitBots) {
        if (bot.mode === 'scripted' && bot.scriptedLines.some(l => !l.text.trim())) {
          setSkitError(`${bot.name} has a scripted line with no text.`)
          return
        }
      }
    }
    setSkitError('')
    setSkitCreating(true)
    const token = await getFreshToken()
    const duration = skitUnlimitedDuration ? 'unlimited' : unitToSeconds(durationValue, skitDurationUnit)
   socketRef.current?.emit('admin_create_skit_room', {
      username: myUsername,
      topic: skitTopic.trim(),
      debateType: skitDebateType,
     maxPlayers, unlimitedPlayers: skitUnlimitedPlayers,
      duration,
      bots: isVoice ? [] : skitBots.map(b => ({
        name: b.name.trim() || 'Bot',
        mode: b.mode,
        script: b.mode === 'scripted'
          ? b.scriptedLines.map(l => ({ text: l.text.trim(), atSeconds: Math.max(0, Math.round(l.atSeconds)) }))
          : undefined,
      })),
      token,
    })
  }

  async function sendSkit() {
    if (!activeSkitRoomId || !skitSpeakerName.trim() || !skitText.trim()) return
    const token = await getFreshToken()
    socketRef.current?.emit('admin_skit_message', {
      instanceId: activeSkitRoomId,
      speakerName: skitSpeakerName.trim(),
      text: skitText.trim(),
      score: Number(skitScore) || 0,
      feedback: skitFeedback.trim(),
      token,
    })
    setSkitText('')
    setSkitFeedback('')
  }

  function resetSkitCreationForm() {
    setSkitTopic(''); setSkitBots([])
    setSkitMaxPlayers('10'); setSkitUnlimitedPlayers(true)
    setSkitDurationValue('5'); setSkitUnlimitedDuration(true)
    setSkitWinner(''); setSkitWinnerElo('25'); setSkitLoserElo('25')
    setSkitSpeakerName(''); setSkitText(''); setSkitFeedback('')
  }

  async function closeSkit() {
    if (!activeSkitRoomId) return
    const token = await getFreshToken()
    // Actually end the room server-side — closing it locally only hid it from
    // this panel, it never told the server, so the room (and its empty-room
    // exemption) stayed alive forever in the lobby.
    socketRef.current?.emit('admin_end_debate', { instanceId: activeSkitRoomId, username: myUsername, token })
    setActiveSkitRoomId(null)
    setSkitMessages([])
    resetSkitCreationForm()
  }

  // Manual winner + ELO declaration for the currently open skit. This is the
  // primary way a skit ends — pick who "won" (the host, a bot, or anyone
  // else currently in the room) and how much ELO they gain/lose.
  // Note: since nobody in a skit is a real connected player, these ELO
  // numbers are cosmetic/declarative — they're broadcast with the result but
  // don't get written to any real Supabase profile.
  async function forceSkitResult() {
    if (!activeSkitRoomId || !skitWinner.trim()) { alert('Need a winner.'); return }
    const token = await getFreshToken()
    socketRef.current?.emit('admin_set_custom_result', {
      instanceId: activeSkitRoomId,
      username: myUsername,
      winnerUsername: skitWinner.trim(),
      eloChanges: {
        winnerElo: Number(skitWinnerElo) || 0,
        secondElo: 0,
        thirdElo: 0,
        loserBase: Number(skitLoserElo) || 0,
      },
      token,
    })
    setActiveSkitRoomId(null)
    setSkitMessages([])
    resetSkitCreationForm()
  }

  // Kill switch — force-ends every skit room this admin has created, in
  // case one (or several) got left running and needs cleaning up fast.
  async function endAllSkits() {
    if (!confirm('Force-end every active skit room? This cannot be undone.')) return
    setEndingAllSkits(true)
    const token = await getFreshToken()
    socketRef.current?.emit('admin_end_all_skits', { username: myUsername, token })
    setActiveSkitRoomId(null)
    setSkitMessages([])
    setTimeout(() => setEndingAllSkits(false), 1500)
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

  async function toggleBan(u: RebuttalUser) {
    const next = !u.banned
    if (!confirm(next ? `Ban ${u.username}? They won't be able to play until unbanned.` : `Unban ${u.username}?`)) return
    const token = await getFreshToken()
    socketRef.current?.emit('admin_ban_user', { username: u.username, banned: next, token })
    setUsers(prev => prev.map(x => (x.username === u.username ? { ...x, banned: next } : x)))
  }

  async function sendWarning() {
    if (!warnTarget || !warnText.trim()) return
    setWarnSending(true)
    const token = await getFreshToken()
    // recipientUsername is who gets it — `username` here is just for server
    // logs, the recipient only ever sees it attributed to "Rebuttal Live."
    socketRef.current?.emit('admin_send_warning', { username: myUsername, recipientUsername: warnTarget, message: warnText.trim(), token })
    setWarnTarget(null)
    setWarnText('')
    setWarnSending(false)
  }

  async function sendBroadcast() {
    if (!broadcastText.trim()) return
    if (!confirm(`Send this to every registered user?\n\n"${broadcastText.trim()}"`)) return
    setBroadcastSending(true)
    const token = await getFreshToken()
    socketRef.current?.emit('admin_broadcast_message', { username: myUsername, message: broadcastText.trim(), token })
    setBroadcastOpen(false)
    setBroadcastText('')
    setBroadcastSending(false)
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
  const filteredUsers = users.filter(u => u && typeof u.username === 'string' && u.username.toLowerCase().includes(userSearch.trim().toLowerCase()))

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
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                <Button onClick={saveSettings} variant="accent">Save settings</Button>
                {saveMsg && <span style={{ fontSize: '13px', color: 'var(--green)' }}>{saveMsg}</span>}
              </div>
            </Card>
          )}

          {/* ── Skit mode tab ───────────────────────────────────── */}
          {tab === 'skits' && (() => {
            const activeSkitRoom = rooms.find(r => r.instanceId === activeSkitRoomId)
            const skitParticipants = activeSkitRoom?.players || []
            return (
              <>
                <Card title="Pretend games" subtitle="Script a debate with optional bots, capacity, and duration — for marketing clips and demos. No real accounts are touched.">
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                    <Button small variant="red" onClick={endAllSkits} disabled={endingAllSkits}>
                      {endingAllSkits ? 'Ending…' : '🛑 End ALL skits (kill switch)'}
                    </Button>
                  </div>

                  {!activeSkitRoomId ? (
                    <>
                      <Field label="Topic"><input style={inputStyle} value={skitTopic} onChange={e => setSkitTopic(e.target.value)} placeholder="At least 10 characters" /></Field>

                      <Field label="Debate type">
                        <select style={inputStyle} value={skitDebateType} onChange={e => setSkitDebateType(e.target.value as 'text' | 'voice')}>
                          <option value="text">Text (1 to unlimited players)</option>
                          <option value="voice">Voice</option>
                        </select>
                        {skitDebateType === 'voice' && (
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
                            Voice just changes the room's label/emoji for now — your scripted lines still show as text, and bots aren't available since there's no audio synthesis wired up yet.
                          </div>
                        )}
                      </Field>

                      {skitDebateType === 'text' ? (
                        <Field label="Max players">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                              style={{ ...inputStyle, opacity: skitUnlimitedPlayers ? 0.4 : 1, width: '120px' }}
                              type="number" min={1} disabled={skitUnlimitedPlayers}
                              value={skitMaxPlayers} onChange={e => setSkitMaxPlayers(e.target.value)}
                            />
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text2)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={skitUnlimitedPlayers} onChange={e => setSkitUnlimitedPlayers(e.target.checked)} />
                              Unlimited players
                            </label>
                          </div>
                        </Field>
                      ) : (
                        <Field label="Max players">
                          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Cosmetic only for voice skits — no real mic flow is involved.</div>
                        </Field>
                      )}

                      <Field label="Duration">
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input
                            style={{ ...inputStyle, opacity: skitUnlimitedDuration ? 0.4 : 1, width: '110px' }}
                            type="number" min={1} disabled={skitUnlimitedDuration}
                            value={skitDurationValue} onChange={e => setSkitDurationValue(e.target.value)}
                          />
                          <select
                            style={{ ...inputStyle, opacity: skitUnlimitedDuration ? 0.4 : 1, width: '130px' }}
                            disabled={skitUnlimitedDuration} value={skitDurationUnit}
                            onChange={e => setSkitDurationUnit(e.target.value as DurationUnit)}
                          >
                            <option value="seconds">Seconds</option>
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                          </select>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text2)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={skitUnlimitedDuration} onChange={e => setSkitUnlimitedDuration(e.target.checked)} />
                            Unlimited (never auto-ends)
                          </label>
                        </div>
                        {!skitUnlimitedDuration && Number(skitDurationValue) > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
                            = {formatSeconds(unitToSeconds(Number(skitDurationValue), skitDurationUnit))}. If time runs out before you force a result, it'll auto-end ranked by bot score — use the winner controls below to end it on your terms instead.
                          </div>
                        )}
                      </Field>
                      {/* ── Bots — text skits only, no audio synthesis for voice ── */}
                      {skitDebateType === 'text' && (
                        <Field label={`Bots (${skitBots.length}/10)`}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {skitBots.map(bot => (
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
                              <Button onClick={addBot} disabled={skitBots.length >= 10}>+ Add bot</Button>
                            </div>
                          </div>
                        </Field>
                      )}

                      {skitError && (
                        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: '12px' }}>
                          ⚠️ {skitError}
                        </div>
                      )}

                      <Button onClick={createSkitRoom} variant="accent" disabled={skitCreating}>
                        {skitCreating ? 'Creating…' : 'Create skit room'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '13px', color: 'var(--green)', marginBottom: '12px' }}>
                        🎬 Live: <b>{activeSkitTopic}</b> ({activeSkitRoomId})
                      </div>
                      <div style={{ maxHeight: '220px', overflowY: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '10px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {skitMessages.length === 0 && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>No lines yet — write the first one below, or wait for any bots you added.</div>}
                        {skitMessages.map(m => (
                          <div key={m.id} style={{ fontSize: '13px' }}>
                            <b style={{ color: 'var(--accent)' }}>{m.username}:</b> {m.text}
                            <span style={{ color: 'var(--muted)', fontSize: '11px', marginLeft: '6px' }}>+{m.score} pts{m.aiFeedback ? ` — ${m.aiFeedback}` : ''}</span>
                          </div>
                        ))}
                      </div>
                      <Field label="Speaker name"><input style={inputStyle} value={skitSpeakerName} onChange={e => setSkitSpeakerName(e.target.value)} placeholder="Whatever name this line should show under" /></Field>
                      <Field label="Line"><textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={skitText} onChange={e => setSkitText(e.target.value)} /></Field>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <Field label="Score"><input style={inputStyle} type="number" min={0} max={30} value={skitScore} onChange={e => setSkitScore(e.target.value)} /></Field>
                        <Field label="AI feedback (optional)"><input style={inputStyle} value={skitFeedback} onChange={e => setSkitFeedback(e.target.value)} /></Field>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
                        <Button onClick={sendSkit} variant="accent" disabled={!skitSpeakerName.trim() || !skitText.trim()}>Send line</Button>
                        <Button onClick={closeSkit}>End without a winner</Button>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Declare a winner & end it</div>
                        <Field label="Winner">
                          <select
                            style={inputStyle}
                            value={skitParticipants.includes(skitWinner) ? skitWinner : ''}
                            onChange={e => setSkitWinner(e.target.value)}
                          >
                            <option value="">Select…</option>
                            {skitParticipants.map(p => (
                              <option key={p} value={p}>{p}{p === myUsername ? ' (you, the host)' : ''}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Or type any other username">
                          <input style={inputStyle} value={skitWinner} onChange={e => setSkitWinner(e.target.value)} placeholder="e.g. a guest who joined" />
                        </Field>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <Field label="Winner ELO gain"><input style={inputStyle} type="number" value={skitWinnerElo} onChange={e => setSkitWinnerElo(e.target.value)} /></Field>
                          <Field label="Everyone else ELO loss"><input style={inputStyle} type="number" value={skitLoserElo} onChange={e => setSkitLoserElo(e.target.value)} /></Field>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>
                          These ELO numbers are declarative for the skit's outcome — nobody here is a real connected player, so no real Supabase profile gets touched.
                        </div>
                        <Button onClick={forceSkitResult} variant="accent">Force result & end</Button>
                      </div>
                    </>
                  )}
                </Card>
              </>
            )
          })()}

          {/* ── Rebuttal users tab ──────────────────────────────── */}
          {tab === 'users' && (
            <Card title="Rebuttal users" subtitle="Search, send a warning/comment, or ban/unban an account">
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <input style={inputStyle} placeholder="Search username…" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                <Button onClick={loadUsers}>{usersLoading ? 'Loading…' : 'Refresh'}</Button>
                <Button variant="gold" onClick={() => setBroadcastOpen(o => !o)}>📢 Message all users</Button>
              </div>

              {broadcastOpen && (
                <div style={{ border: '1px solid rgba(255,214,10,0.35)', background: 'rgba(255,214,10,0.06)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gold)', marginBottom: '8px' }}>
                    Sending to every registered user — they'll see it as from <b>Rebuttal Live</b>, not your account
                  </div>
                  <textarea
                    style={{ ...inputStyle, minHeight: '70px', resize: 'vertical', marginBottom: '10px' }}
                    placeholder="Type the announcement…"
                    value={broadcastText}
                    onChange={e => setBroadcastText(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button small variant="gold" onClick={sendBroadcast} disabled={broadcastSending || !broadcastText.trim()}>
                      {broadcastSending ? 'Sending…' : 'Send to all'}
                    </Button>
                    <Button small onClick={() => { setBroadcastOpen(false); setBroadcastText('') }}>Cancel</Button>
                  </div>
                </div>
              )}

              {warnTarget && (
                <div style={{ border: '1px solid rgba(255,214,10,0.35)', background: 'rgba(255,214,10,0.06)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gold)', marginBottom: '8px' }}>
                    Sending to @{warnTarget} — they'll see it as from <b>Rebuttal Live</b>, not your account
                  </div>
                  <textarea
                    style={{ ...inputStyle, minHeight: '70px', resize: 'vertical', marginBottom: '10px' }}
                    placeholder="Type the warning or comment…"
                    value={warnText}
                    onChange={e => setWarnText(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button small variant="gold" onClick={sendWarning} disabled={warnSending || !warnText.trim()}>
                      {warnSending ? 'Sending…' : 'Send'}
                    </Button>
                    <Button small onClick={() => { setWarnTarget(null); setWarnText('') }}>Cancel</Button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredUsers.length === 0 && (
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    {usersLoading ? 'Loading users…' : 'No users found. If this persists, check the Railway logs for an admin_list_users error.'}
                  </div>
                )}
                {filteredUsers.map(u => (
                  <div key={u.username} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: u.online ? 'var(--green)' : 'rgba(255,255,255,0.2)', boxShadow: u.online ? '0 0 6px rgba(34,197,94,0.7)' : 'none', flexShrink: 0 }} />
                        @{u.username} {u.banned ? <Badge tone="red">Banned</Badge> : isUserInRoom(u.username) ? <Badge tone="green">In room</Badge> : u.online ? <Badge tone="green">Online</Badge> : <Badge>Offline</Badge>}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {u.email ? `${u.email} · ` : ''}{u.elo !== undefined ? `${u.elo} ELO` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button small variant="gold" onClick={() => { setWarnTarget(u.username); setWarnText('') }}>Message</Button>
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