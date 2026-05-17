require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const OpenAI = require('openai')

const app = express()
app.use(cors())
const httpServer = http.createServer(app)
const openai = new OpenAI.OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

// ─── Supabase REST helper (no client needed — works on Node 18) ─
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function supabaseRest(path, method = 'GET', body = null) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: body ? JSON.stringify(body) : null
    })
    if (method === 'GET') return res.json()
    return res
  } catch (e) {
    console.log('Supabase REST error:', e.message)
    return null
  }
}

const TARGET_AVAILABLE = 4
const DISTRIBUTION = { casual: 0.25, serious: 0.50, competitive: 0.15, random: 0.10 }

const PREWRITTEN = {
  casual: [
    { topic: 'Pizza vs. Burgers: Which is the superior comfort food?', emoji: '🍕', duration: 120 },
    { topic: 'Cats or dogs — which makes a better companion?', emoji: '🐾', duration: 120 },
    { topic: 'Is a hot dog a sandwich?', emoji: '🌭', duration: 120 },
    { topic: 'Pineapple on pizza: culinary crime or bold choice?', emoji: '🍍', duration: 120 },
    { topic: 'Morning people vs night owls: who has the better life?', emoji: '🌙', duration: 120 },
    { topic: 'Does money actually buy happiness?', emoji: '💰', duration: 150 },
    { topic: 'Is cereal a soup?', emoji: '🥣', duration: 120 },
    { topic: 'Which is better: summer or winter?', emoji: '❄️', duration: 120 },
    { topic: 'Marvel vs DC: which universe is better?', emoji: '🦸', duration: 150 },
    { topic: 'Is streaming better than going to the cinema?', emoji: '🎬', duration: 120 },
    { topic: 'TikTok vs YouTube: which platform wins?', emoji: '📱', duration: 120 },
    { topic: 'Is coffee better than tea?', emoji: '☕', duration: 120 },
    { topic: 'Should subscriptions be banned?', emoji: '💳', duration: 120 },
    { topic: 'Music vs drama: which is the superior art form?', emoji: '🎭', duration: 120 },
    { topic: 'Is politics about pledges or charisma?', emoji: '🎤', duration: 150 },
    { topic: 'Balloon debate: writers, musicians, or artists — who stays?', emoji: '🎈', duration: 150 },
    { topic: 'Should food companies be liable for unhealthy products?', emoji: '🍔', duration: 150 },
    { topic: 'Best form of art — what wins?', emoji: '🎨', duration: 120 },
    { topic: 'Who has it harder: younger or older students?', emoji: '🎒', duration: 120 },
    { topic: 'Should the public be allowed to own and carry guns?', emoji: '🔫', duration: 150 },
    { topic: 'Are video games a sport?', emoji: '🎮', duration: 150 },
    { topic: 'Should homework be abolished?', emoji: '📝', duration: 120 },
    { topic: 'Should school uniforms be mandatory?', emoji: '👔', duration: 120 },
    { topic: 'Is it better to be book smart or street smart?', emoji: '📚', duration: 150 },
    { topic: 'Should tipping culture be abolished?', emoji: '💵', duration: 150 },
    { topic: 'Is online dating better than meeting in person?', emoji: '💑', duration: 150 },
    { topic: 'Should PE be mandatory in schools?', emoji: '🏃', duration: 120 },
    { topic: 'Is social media making us lonelier?', emoji: '😔', duration: 150 },
    { topic: 'Fast food vs home cooking: which wins?', emoji: '🍟', duration: 120 },
    { topic: 'Beach vacation vs mountain vacation?', emoji: '🏖️', duration: 120 },
  ],
  serious: [
    { topic: 'Is social media doing more harm than good to society?', emoji: '📱', duration: 300 },
    { topic: 'Should college education be free for everyone?', emoji: '🎓', duration: 300 },
    { topic: 'Is climate change policy moving fast enough?', emoji: '🌍', duration: 300 },
    { topic: 'Will AI make humanity better or worse off in the long run?', emoji: '🤖', duration: 300 },
    { topic: 'Is universal basic income a good idea?', emoji: '💵', duration: 300 },
    { topic: 'Should voting be mandatory in democratic countries?', emoji: '🗳️', duration: 300 },
    { topic: 'Is cancel culture good or bad for society?', emoji: '🚫', duration: 300 },
    { topic: 'Is the death penalty ever justified?', emoji: '⚖️', duration: 360 },
    { topic: 'Should drugs be decriminalized?', emoji: '💊', duration: 300 },
    { topic: 'Is nuclear energy the answer to climate change?', emoji: '⚛️', duration: 300 },
    { topic: 'Should billionaires be taxed out of existence?', emoji: '💰', duration: 300 },
    { topic: 'Should the US have universal healthcare?', emoji: '🏥', duration: 360 },
    { topic: 'Is capitalism the best economic system available?', emoji: '📊', duration: 360 },
    { topic: 'Should animal testing be banned?', emoji: '🐁', duration: 300 },
    { topic: 'Should gene editing in humans be allowed?', emoji: '🧬', duration: 360 },
    { topic: 'Is mass surveillance ever justified?', emoji: '👁️', duration: 360 },
    { topic: 'Should standardized testing be abolished?', emoji: '📝', duration: 300 },
    { topic: 'Is the housing crisis a government failure?', emoji: '🏠', duration: 360 },
    { topic: 'Should single-use plastics be banned globally?', emoji: '♻️', duration: 300 },
    { topic: 'Is the opioid crisis primarily a government failure?', emoji: '💊', duration: 360 },
    { topic: 'Should Big Tech be broken up?', emoji: '💻', duration: 360 },
    { topic: 'Is religion doing more harm than good in modern society?', emoji: '⛪', duration: 420 },
    { topic: 'Should the police be defunded and reformed?', emoji: '👮', duration: 360 },
    { topic: 'Is fast fashion destroying the planet?', emoji: '👗', duration: 300 },
    { topic: 'Should there be term limits for all politicians?', emoji: '🏛️', duration: 360 },
    { topic: 'Balloon debate: things we should be taught in school', emoji: '🎈', duration: 300 },
    { topic: 'Are humans inherently good or bad?', emoji: '👤', duration: 300 },
    { topic: 'Should tests be banned?', emoji: '📝', duration: 300 },
    { topic: 'Is it moral to kill baby Hitler?', emoji: '⏳', duration: 360 },
    { topic: 'Should the voting age be increased or decreased?', emoji: '🗳️', duration: 300 },
    { topic: 'Should nuclear weapons be banned globally?', emoji: '☢️', duration: 360 },
    { topic: 'Is the military a net positive for society?', emoji: '🪖', duration: 360 },
    { topic: 'Should we do more to identify and treat antisocial personality disorders?', emoji: '🧠', duration: 360 },
    { topic: 'Should food companies be liable for unhealthy products?', emoji: '🍔', duration: 300 },
    { topic: 'GCSE vs A-Level: which is harder?', emoji: '📚', duration: 300 },
    { topic: 'Is income inequality the defining challenge of our time?', emoji: '📊', duration: 420 },
    { topic: 'Should organ donation be opt-out rather than opt-in?', emoji: '❤️', duration: 300 },
    { topic: 'Should hate speech be legally protected?', emoji: '💬', duration: 360 },
    { topic: 'Is the criminal justice system fundamentally broken?', emoji: '⚖️', duration: 360 },
    { topic: 'Should corporations be held criminally liable for environmental damage?', emoji: '🌿', duration: 360 },
  ],
  competitive: [
    { topic: 'Does free will actually exist, or is every decision predetermined?', emoji: '🧠', duration: 480, eloRequired: 200 },
    { topic: 'Is democracy still the optimal system of governance?', emoji: '🏛️', duration: 480, eloRequired: 200 },
    { topic: 'Is morality objective or entirely subjective?', emoji: '⚖️', duration: 480, eloRequired: 300 },
    { topic: 'Should artificial general intelligence be developed at all?', emoji: '🔬', duration: 480, eloRequired: 400 },
    { topic: 'Is capitalism fundamentally incompatible with addressing climate change?', emoji: '🏭', duration: 480, eloRequired: 400 },
    { topic: 'Can absolute morality exist without religion?', emoji: '🕊️', duration: 480, eloRequired: 500 },
    { topic: 'Is consciousness an illusion?', emoji: '🧠', duration: 480, eloRequired: 300 },
    { topic: 'Would a world government be utopian or dystopian?', emoji: '🌍', duration: 480, eloRequired: 300 },
    { topic: 'Is it ever moral to sacrifice the few for the many?', emoji: '⚖️', duration: 480, eloRequired: 200 },
    { topic: 'Does God exist — and can it be proven either way?', emoji: '✝️', duration: 480, eloRequired: 300 },
    { topic: 'Is revolution ever morally justified?', emoji: '✊', duration: 480, eloRequired: 300 },
    { topic: 'Is nihilism the most intellectually honest philosophy?', emoji: '🌑', duration: 480, eloRequired: 400 },
    { topic: 'Is Western liberalism in terminal decline?', emoji: '🏛️', duration: 480, eloRequired: 500 },
    { topic: 'Can true equality ever be achieved in a capitalist system?', emoji: '⚖️', duration: 480, eloRequired: 400 },
    { topic: 'Is the social contract still valid in the 21st century?', emoji: '📜', duration: 480, eloRequired: 500 },
    { topic: 'Should nuclear weapons be banned — and is that even enforceable?', emoji: '☢️', duration: 480, eloRequired: 400 },
  ],
  random: [
    { topic: 'Are zoos ethical in the modern world?', emoji: '🦁', duration: 180 },
    { topic: 'Is it okay to ghost someone you\'re dating?', emoji: '👻', duration: 150 },
    { topic: 'Should we eat insects to save the planet?', emoji: '🦗', duration: 150 },
    { topic: 'Would you rather be smart or attractive?', emoji: '🧠', duration: 150 },
    { topic: 'Is nostalgia holding society back?', emoji: '⏳', duration: 180 },
    { topic: 'Is true altruism possible?', emoji: '🤲', duration: 180 },
    { topic: 'Is loyalty overrated as a virtue?', emoji: '🤝', duration: 180 },
    { topic: 'Is ambition a virtue or a vice?', emoji: '🏆', duration: 180 },
    { topic: 'Is it ethical to use AI-generated art?', emoji: '🎨', duration: 180 },
    { topic: 'Is optimism naive?', emoji: '☀️', duration: 150 },
    { topic: 'Is fame worth the loss of privacy?', emoji: '⭐', duration: 150 },
    { topic: 'Is forgiveness always the right choice?', emoji: '🕊️', duration: 150 },
    { topic: 'Is the internet making us dumber?', emoji: '🌐', duration: 180 },
    { topic: 'Is celebrity culture toxic?', emoji: '⭐', duration: 150 },
    { topic: 'Is success mostly luck or mostly effort?', emoji: '🍀', duration: 180 },
    { topic: 'Who has it harder: younger or older students?', emoji: '🎒', duration: 150 },
    { topic: 'Is it moral to kill baby Hitler?', emoji: '⏳', duration: 180 },
    { topic: 'Balloon debate: writers, musicians, or artists — who stays?', emoji: '🎈', duration: 180 },
    { topic: 'Music vs drama: which is the superior art form?', emoji: '🎭', duration: 150 },
    { topic: 'Should we have a four-day work week?', emoji: '📅', duration: 180 },
  ]
}

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

const topicPool = {
  casual: shuffle(PREWRITTEN.casual),
  serious: shuffle(PREWRITTEN.serious),
  competitive: shuffle(PREWRITTEN.competitive),
  random: shuffle(PREWRITTEN.random),
}
const usedTopics = new Set()

function getTopicFromPool(type) {
  const pool = topicPool[type]
  for (let i = 0; i < pool.length; i++) {
    if (!usedTopics.has(pool[i].topic)) {
      usedTopics.add(pool[i].topic)
      if (usedTopics.size > pool.length * 0.8) usedTopics.clear()
      return pool[i]
    }
  }
  topicPool[type] = shuffle(PREWRITTEN[type])
  usedTopics.clear()
  return topicPool[type][0]
}

const aiQueue = { casual: [], serious: [], competitive: [], random: [] }
let isGenerating = false

async function generateAITopics(type, count = 3) {
  const prompts = {
    casual: `Generate ${count} fun punchy debate topics. Food, lifestyle, pop culture. Keep short.`,
    serious: `Generate ${count} controversial real-world debate topics about politics, society, or tech. Both sides strong.`,
    competitive: `Generate ${count} deep philosophical debate topics for advanced debaters.`,
    random: `Generate ${count} surprising unexpected debate topics, silly to thought-provoking.`
  }
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 600,
      messages: [{ role: 'user', content: `${prompts[type]}\n\nReturn ONLY JSON array:\n[{"topic":"...","emoji":"..."}]` }]
    })
    const text = res.choices[0].message.content.trim()
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON')
    const parsed = JSON.parse(match[0])
    const durations = { casual: 120, serious: 300, competitive: 480, random: 180 }
    return parsed.slice(0, count).map(t => ({
      topic: t.topic, emoji: t.emoji || '💬',
      duration: durations[type],
      eloRequired: type === 'competitive' ? [200, 300, 400][Math.floor(Math.random() * 3)] : 0
    }))
  } catch (e) {
    console.log(`AI gen failed for ${type}:`, e.message)
    return []
  }
}

async function refillAIQueue() {
  if (isGenerating) return
  isGenerating = true
  try {
    for (const type of ['casual', 'serious', 'competitive', 'random']) {
      if (aiQueue[type].length < 2) {
        const topics = await generateAITopics(type, 3)
        if (topics.length > 0) aiQueue[type].push(...topics)
      }
    }
  } finally { isGenerating = false }
}

function getTopicForType(type) {
  if (aiQueue[type].length > 0 && Math.random() < 0.3) return aiQueue[type].shift()
  return getTopicFromPool(type)
}

// ─── Room management ───────────────────────────────────────────
const rooms = {}
let roomCounter = 0
let pendingRoomCreations = 0
let totalArgumentsMade = 0
let totalDebatesCompleted = 0

function createRoom(type) {
  const topic = getTopicForType(type)
  const id = `room_${++roomCounter}_${Date.now()}`
  const maxPlayers = {
    casual: Math.floor(Math.random() * 6) + 5,
    random: Math.floor(Math.random() * 6) + 5,
    serious: Math.floor(Math.random() * 6) + 10,
    competitive: Math.floor(Math.random() * 6) + 15,
  }[type] ?? 10

  rooms[id] = {
    instanceId: id,
    type,
    emoji: topic.emoji,
    topic: topic.topic,
    duration: topic.duration,
    eloRequired: topic.eloRequired || 0,
    maxPlayers,
    players: {},
    spectators: {},
    messages: [],
    status: 'waiting',
    countdown: 120,
    startCountdown: null,
    debateEndsAt: null,
    createdAt: Date.now(),
  }
  console.log(`🏠 Created ${type} room (max ${maxPlayers}): "${topic.topic}"`)
  return id
}

function scheduleRoom(type, immediate = false) {
  const delay = immediate ? 0 : (5 + Math.random() * 20) * 1000
  pendingRoomCreations++
  setTimeout(() => {
    pendingRoomCreations--
    createRoom(type)
    io.emit('rooms_update', getRoomList())
  }, delay)
}

function getAvailableCount() {
  return Object.values(rooms).filter(r => r.status === 'waiting').length + pendingRoomCreations
}

function replenishRooms(immediate = false) {
  const needed = TARGET_AVAILABLE - getAvailableCount()
  if (needed <= 0) return
  for (let i = 0; i < needed; i++) {
    const rand = Math.random()
    let cumulative = 0
    let chosenType = 'serious'
    for (const [type, weight] of Object.entries(DISTRIBUTION)) {
      cumulative += weight
      if (rand <= cumulative) { chosenType = type; break }
    }
    const staggerDelay = immediate ? 0 : i * (10 + Math.random() * 15) * 1000
    setTimeout(() => scheduleRoom(chosenType, immediate), staggerDelay)
  }
  refillAIQueue()
}

function getRoomList() {
  return Object.values(rooms)
    .filter(r => r.status !== 'ended')
    .sort((a, b) => {
      const order = { starting: 0, active: 1, waiting: 2 }
      return (order[a.status] || 2) - (order[b.status] || 2)
    })
    .map(r => ({
      instanceId: r.instanceId,
      emoji: r.emoji,
      topic: r.topic,
      type: r.type,
      duration: r.duration,
      maxPlayers: r.maxPlayers,
      eloRequired: r.eloRequired,
      playerCount: Object.keys(r.players).length,
      spectatorCount: Object.keys(r.spectators).length,
      players: Object.values(r.players).map(p => p.username),
      status: r.status,
      countdown: r.countdown,
      startCountdown: r.startCountdown,
      timeLeft: r.debateEndsAt ? Math.max(0, Math.round((r.debateEndsAt - Date.now()) / 1000)) : null,
    }))
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function calculateEloChanges(type, playerCount, duration) {
  const baseRanges = {
    casual:      { min: 5,   max: 10  },
    random:      { min: 8,   max: 18  },
    serious:     { min: 15,  max: 40  },
    competitive: { min: 50,  max: 120 },
  }
  const base = baseRanges[type] ?? { min: 8, max: 18 }
  const maxDuration = 480
  const durationMult = 0.7 + (Math.min(duration, maxDuration) / maxDuration) * 0.6
  const playerMult = 0.4 + (Math.min(playerCount, 15) / 15) * 1.1
  const scaledMin = Math.round(base.min * durationMult * playerMult)
  const scaledMax = Math.round(base.max * durationMult * playerMult)
  const winnerElo = randInt(scaledMin, scaledMax)
  const caps = { casual: 20, random: 25, serious: 90, competitive: 200 }
  const cappedWinner = Math.min(winnerElo, caps[type] ?? 35)
  const secondElo = Math.round(cappedWinner * randInt(35, 50) / 100)
  const thirdElo  = Math.round(cappedWinner * randInt(15, 25) / 100)
  const loserBase = Math.round(cappedWinner * 0.4)
  return { winnerElo: cappedWinner, secondElo, thirdElo, loserBase }
}

// ─── Game loop ─────────────────────────────────────────────────
setInterval(() => {
  Object.values(rooms).forEach(room => {
    if (room.status === 'ended') return
    const playerCount = Object.keys(room.players).length

    if (room.status === 'waiting') {
      room.countdown = Math.max(0, room.countdown - 1)

      if (playerCount >= room.maxPlayers) {
        room.status = 'starting'
        room.startCountdown = 5
        io.to(room.instanceId).emit('room_starting', { startCountdown: 5 })
        scheduleRoom(room.type)
        return
      }

      if (room.countdown <= 0) {
        if (playerCount < 2) {
          room.status = 'ended'
          io.to(room.instanceId).emit('room_expired', { message: 'Not enough players joined. Room expired.' })
          console.log(`💨 Expired: "${room.topic}" (${playerCount} players)`)
          scheduleRoom(room.type)
        } else {
          room.status = 'starting'
          room.startCountdown = 5
          io.to(room.instanceId).emit('room_starting', { startCountdown: 5 })
          scheduleRoom(room.type)
        }
      }
    }

    if (room.status === 'starting') {
      room.startCountdown = Math.max(0, room.startCountdown - 1)
      io.to(room.instanceId).emit('start_countdown_tick', { count: room.startCountdown })
      if (room.startCountdown <= 0) {
        room.status = 'active'
        room.debateEndsAt = Date.now() + room.duration * 1000
        io.to(room.instanceId).emit('debate_started', { duration: room.duration })
        console.log(`⚡ Started: "${room.topic}" (${playerCount} players)`)
      }
    }

    if (room.status === 'active') {
      const timeLeft = Math.max(0, Math.round((room.debateEndsAt - Date.now()) / 1000))
      if (timeLeft <= 0) {
        room.status = 'ended'
        totalDebatesCompleted++
        supabaseRest('rpc/increment_debates', 'POST').catch(() => {})
        const sorted = Object.values(room.players).sort((a, b) => b.score - a.score)
        const eloChanges = calculateEloChanges(room.type, sorted.length, room.duration)
        io.to(room.instanceId).emit('debate_ended', {
          standings: sorted,
          eloChanges,
          type: room.type,
        })
        console.log(`🏁 Ended: "${room.topic}" — ${sorted.length} players, winner +${eloChanges.winnerElo} ELO`)
      }
    }
  })

  io.emit('rooms_update', getRoomList())

  const now = Date.now()
  Object.keys(rooms).forEach(id => {
    if (rooms[id].status === 'ended' && now - rooms[id].createdAt > 30000) delete rooms[id]
  })

  if (Math.random() < 0.1) replenishRooms()
}, 1000)

// ─── Argument scoring ──────────────────────────────────────────
async function scoreArgument(text, topic, roomType) {
  const hardSlurs = /\b(nigger|nigga|faggot|chink|spic|kike|wetback|tranny)\b/i.test(text)
  if (hardSlurs) return { score: -10, feedback: 'Slur detected. Hard penalty applied.' }
  const hasCasualProfanity = /\b(fuck|shit|ass|bitch|damn|crap|hell|bastard)\b/i.test(text)
  if (text.trim().length < 15) return { score: 0, feedback: 'Too brief to evaluate.' }

  try {
    const result = await Promise.race([
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 100,
        messages: [{
          role: 'system',
          content: `You are a debate judge. Topic: "${topic}" (${roomType}).
Score 0-30: logic/clarity (0-8), evidence (0-8), depth (0-7), vocabulary (0-7).
Casual profanity is fine if argument is strong. Hard slurs = penalty.
3-word = 0-2, mediocre = 3-8, decent = 9-15, good = 16-22, excellent = 23-27, exceptional = 28-30.
Return ONLY JSON: {"score": number, "feedback": "one short sentence"}`
        }, { role: 'user', content: text }]
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))
    ])
    const parsed = JSON.parse(result.choices[0].message.content.trim())
    let score = Math.max(0, Math.min(30, Math.round(parsed.score)))
    if (hasCasualProfanity && score < 10) score = Math.max(0, score - 2)
    return { score, feedback: parsed.feedback || '' }
  } catch (e) {
    console.log('Scoring fallback:', e.message)
    return fallbackScore(text, hasCasualProfanity)
  }
}

function fallbackScore(text, hasProfanity) {
  const wordCount = text.trim().split(/\s+/).length
  let score = wordCount < 5 ? 1 : wordCount < 15 ? Math.floor(Math.random() * 4) + 3
    : wordCount < 30 ? Math.floor(Math.random() * 6) + 7
    : wordCount < 60 ? Math.floor(Math.random() * 7) + 12
    : Math.floor(Math.random() * 8) + 18
  if (/\b(study|research|statistics|data|evidence|example|proves|according|percent)\b/i.test(text)) score = Math.min(30, score + 3)
  if (hasProfanity && score < 10) score = Math.max(0, score - 2)
  return { score: Math.min(30, score), feedback: 'AI scoring unavailable.' }
}

// ─── Socket events ─────────────────────────────────────────────
io.on('connection', (socket) => {
  let currentRoomId = null
  let currentUsername = null
  let isSpectator = false

  socket.emit('rooms_update', getRoomList())

  socket.on('join_room', ({ instanceId, username, elo = 0 }) => {
    const alreadyInRoom = Object.values(rooms).some(r =>
      r.status !== 'ended' && Object.values(r.players).some(p => p.username === username)
    )
    if (alreadyInRoom) {
      socket.emit('error', { message: 'You are already in a debate in another tab. Please close it first.' })
      return
    }

    const room = rooms[instanceId]
    if (!room) { socket.emit('error', { message: 'Room not found.' }); return }
    if (room.status === 'ended') { socket.emit('error', { message: 'This room has ended.' }); return }
    if (room.status === 'active') {
      socket.emit('join_as_spectator', { instanceId })
      return
    }
    if (elo < room.eloRequired) { socket.emit('error', { message: `You need ${room.eloRequired}+ ELO to join.` }); return }
    if (Object.keys(room.players).length >= room.maxPlayers) { socket.emit('error', { message: 'Room is full.' }); return }

    currentRoomId = instanceId
    currentUsername = username
    isSpectator = false
    socket.join(instanceId)
    room.players[socket.id] = { username, score: 0, elo }

    socket.emit('message_history', room.messages)
    socket.emit('room_info', {
      instanceId: room.instanceId, topic: room.topic, emoji: room.emoji,
      type: room.type, duration: room.duration, status: room.status,
      countdown: room.countdown, startCountdown: room.startCountdown,
      eloRequired: room.eloRequired, isSpectator: false,
    })

    io.to(instanceId).emit('players_update', Object.values(room.players))
    io.to(instanceId).emit('system_message', { text: `${username} joined the debate` })
    io.emit('rooms_update', getRoomList())
    console.log(`👤 ${username} joined "${room.topic}"`)
  })

  socket.on('spectate_room', ({ instanceId, username }) => {
    const room = rooms[instanceId]
    if (!room) { socket.emit('error', { message: 'Room not found.' }); return }
    if (room.status === 'ended') { socket.emit('error', { message: 'This debate has ended.' }); return }

    currentRoomId = instanceId
    currentUsername = username
    isSpectator = true
    socket.join(instanceId)
    room.spectators[socket.id] = username

    socket.emit('message_history', room.messages)
    socket.emit('room_info', {
      instanceId: room.instanceId, topic: room.topic, emoji: room.emoji,
      type: room.type, duration: room.duration, status: room.status,
      countdown: room.countdown, startCountdown: room.startCountdown,
      eloRequired: room.eloRequired, isSpectator: true,
      timeLeft: room.debateEndsAt ? Math.max(0, Math.round((room.debateEndsAt - Date.now()) / 1000)) : null,
    })
    socket.emit('players_update', Object.values(room.players))
    socket.emit('system_message', { text: `👁 ${username} is spectating` })
    io.emit('rooms_update', getRoomList())
    console.log(`👁 ${username} spectating "${room.topic}"`)
  })

  socket.on('send_message', async ({ instanceId, username, text }) => {
    const room = rooms[instanceId]
    if (!room || room.status !== 'active') return
    if (isSpectator) return

    totalArgumentsMade++
    supabaseRest('rpc/increment_arguments', 'POST').catch(() => {})

    const { score, feedback } = await scoreArgument(text, room.topic, room.type)
    const msg = {
      id: `${Date.now()}-${Math.random()}`,
      username, text, score, aiFeedback: feedback,
      timestamp: Date.now(),
    }
    room.messages.push(msg)
    const player = room.players[socket.id]
    if (player) player.score += score
    io.to(instanceId).emit('new_message', msg)
    io.to(instanceId).emit('players_update', Object.values(room.players))
  })

  socket.on('disconnect', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return
    const room = rooms[currentRoomId]
    if (isSpectator) {
      delete room.spectators[socket.id]
    } else {
      delete room.players[socket.id]
      if (currentUsername) io.to(currentRoomId).emit('system_message', { text: `${currentUsername} left` })
      io.to(currentRoomId).emit('players_update', Object.values(room.players))
    }
    io.emit('rooms_update', getRoomList())
  })
})

// ─── Boot ──────────────────────────────────────────────────────
async function boot() {
  try {
    const data = await supabaseRest('stats?id=eq.1&select=arguments_made,debates_completed')
    if (data?.[0]) {
      totalArgumentsMade = Number(data[0].arguments_made)
      totalDebatesCompleted = Number(data[0].debates_completed)
      console.log(`📊 Loaded stats: ${totalArgumentsMade} arguments, ${totalDebatesCompleted} debates`)
    }
  } catch (e) {
    console.log('Could not load stats:', e.message)
  }
  replenishRooms(true)
  console.log(`✅ Server booting with ${TARGET_AVAILABLE} available rooms`)
  setTimeout(refillAIQueue, 2000)
  setInterval(refillAIQueue, 5 * 60 * 1000)
  setInterval(() => console.log('💓 keepalive'), 4 * 60 * 1000)
}

boot()
app.get('/health', (req, res) => res.json({
  status: 'ok',
  available: getAvailableCount(),
  ongoing: Object.values(rooms).filter(r => r.status === 'active').length,
  total: Object.keys(rooms).length,
}))
app.get('/stats', (req, res) => res.json({
  debatersOnline: io.engine.clientsCount,
  liveDebates: Object.values(rooms).filter(r => r.status === 'active').length,
  argumentsMade: totalArgumentsMade,
  debatesCompleted: totalDebatesCompleted,
}))
httpServer.listen(3001, () => console.log('🚀 Socket server on port 3001'))