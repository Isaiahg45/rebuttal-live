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

const MAX_ROOMS = 75
const DISTRIBUTION = { casual: 0.15, serious: 0.55, competitive: 0.15, random: 0.15 }

// ─── 500 Prewritten Topics ─────────────────────────────────────
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
    { topic: 'Dogs are smarter than cats — true or false?', emoji: '🧠', duration: 120 },
    { topic: 'Is breakfast the most important meal of the day?', emoji: '🍳', duration: 120 },
    { topic: 'Beach vacation vs mountain vacation?', emoji: '🏖️', duration: 120 },
    { topic: 'Are video games a sport?', emoji: '🎮', duration: 150 },
    { topic: 'Is Spotify better than Apple Music?', emoji: '🎵', duration: 120 },
    { topic: 'Night in vs night out: which is better?', emoji: '🏠', duration: 120 },
    { topic: 'Is social media making us lonelier?', emoji: '😔', duration: 150 },
    { topic: 'Fast food vs home cooking: which wins?', emoji: '🍟', duration: 120 },
    { topic: 'Is remote work better than office work?', emoji: '💻', duration: 150 },
    { topic: 'Are zoos good or bad for animals?', emoji: '🦁', duration: 150 },
    { topic: 'Should everyone learn to code?', emoji: '👨‍💻', duration: 150 },
    { topic: 'Is space exploration worth the cost?', emoji: '🚀', duration: 150 },
    { topic: 'Should junk food be taxed?', emoji: '🍔', duration: 120 },
    { topic: 'Is graffiti art or vandalism?', emoji: '🎨', duration: 120 },
    { topic: 'Android vs iPhone: which is better?', emoji: '📱', duration: 120 },
    { topic: 'Is print media dead?', emoji: '📰', duration: 120 },
    { topic: 'Should school uniforms be mandatory?', emoji: '👔', duration: 120 },
    { topic: 'Are superhero movies getting boring?', emoji: '🦸', duration: 120 },
    { topic: 'Is it okay to recline your seat on a plane?', emoji: '✈️', duration: 120 },
    { topic: 'Should tipping culture be abolished?', emoji: '💵', duration: 150 },
    { topic: 'Is reality TV ruining television?', emoji: '📺', duration: 120 },
    { topic: 'Chocolate ice cream vs vanilla: which is better?', emoji: '🍦', duration: 120 },
    { topic: 'Is social media more entertaining than TV?', emoji: '📲', duration: 120 },
    { topic: 'Should PE be mandatory in schools?', emoji: '🏃', duration: 120 },
    { topic: 'Is it better to be book smart or street smart?', emoji: '📚', duration: 150 },
    { topic: 'Should homework be abolished?', emoji: '📝', duration: 120 },
    { topic: 'Are tattoos still taboo in the workplace?', emoji: '💉', duration: 120 },
    { topic: 'Is it ever okay to lie to protect someone?', emoji: '🤥', duration: 150 },
    { topic: 'Should alcohol be treated like cigarettes?', emoji: '🍺', duration: 150 },
    { topic: 'Is working from home more productive?', emoji: '🏡', duration: 150 },
    { topic: 'Should sports stars be paid less?', emoji: '⚽', duration: 150 },
    { topic: 'Should college athletes be paid?', emoji: '🏈', duration: 150 },
    { topic: 'Is social media a net positive for society?', emoji: '🌐', duration: 150 },
    { topic: 'Are electric cars actually better for the environment?', emoji: '🚗', duration: 150 },
    { topic: 'Should the drinking age be lowered?', emoji: '🍻', duration: 150 },
    { topic: 'Is it rude to be on your phone during dinner?', emoji: '📵', duration: 120 },
    { topic: 'Should violent video games be banned for minors?', emoji: '🎮', duration: 150 },
    { topic: 'Is online dating better than meeting in person?', emoji: '💑', duration: 150 },
  ],
  serious: [
    { topic: 'Is social media doing more harm than good to society?', emoji: '📱', duration: 240 },
    { topic: 'Should college education be free for everyone?', emoji: '🎓', duration: 240 },
    { topic: 'Is climate change policy moving fast enough?', emoji: '🌍', duration: 240 },
    { topic: 'Should social media companies be liable for mental health harms?', emoji: '⚖️', duration: 240 },
    { topic: 'Will AI make humanity better or worse off in the long run?', emoji: '🤖', duration: 270 },
    { topic: 'Should we prioritize space exploration or fixing problems on Earth?', emoji: '🚀', duration: 240 },
    { topic: 'Is universal basic income a good idea?', emoji: '💵', duration: 240 },
    { topic: 'Should voting be mandatory in democratic countries?', emoji: '🗳️', duration: 240 },
    { topic: 'Is cancel culture good or bad for society?', emoji: '🚫', duration: 240 },
    { topic: 'Should the minimum wage be significantly increased?', emoji: '📈', duration: 240 },
    { topic: 'Should wealthy nations accept more refugees?', emoji: '🌍', duration: 240 },
    { topic: 'Is the death penalty ever justified?', emoji: '⚖️', duration: 270 },
    { topic: 'Should drugs be decriminalized?', emoji: '💊', duration: 240 },
    { topic: 'Is nuclear energy the answer to climate change?', emoji: '⚛️', duration: 240 },
    { topic: 'Should the voting age be lowered to 16?', emoji: '🗳️', duration: 240 },
    { topic: 'Is affirmative action still necessary?', emoji: '🏛️', duration: 270 },
    { topic: 'Should billionaires be taxed out of existence?', emoji: '💰', duration: 240 },
    { topic: 'Is the media more harmful than helpful to democracy?', emoji: '📰', duration: 240 },
    { topic: 'Should the US have universal healthcare?', emoji: '🏥', duration: 270 },
    { topic: 'Is capitalism the best economic system available?', emoji: '📊', duration: 270 },
    { topic: 'Should citizens be required to perform national service?', emoji: '🪖', duration: 240 },
    { topic: 'Is globalization good for developing nations?', emoji: '🌐', duration: 240 },
    { topic: 'Should private prisons be abolished?', emoji: '🔒', duration: 240 },
    { topic: 'Is the war on drugs a failure?', emoji: '💊', duration: 240 },
    { topic: 'Should sex education be more comprehensive in schools?', emoji: '📚', duration: 240 },
    { topic: 'Is the gig economy exploiting workers?', emoji: '🚗', duration: 240 },
    { topic: 'Should gene editing in humans be allowed?', emoji: '🧬', duration: 270 },
    { topic: 'Is automation creating more jobs than it destroys?', emoji: '🤖', duration: 240 },
    { topic: 'Should the internet be considered a human right?', emoji: '🌐', duration: 240 },
    { topic: 'Is mass surveillance ever justified?', emoji: '👁️', duration: 270 },
    { topic: 'Should animal testing be banned?', emoji: '🐁', duration: 240 },
    { topic: 'Is veganism the most ethical diet?', emoji: '🥗', duration: 240 },
    { topic: 'Should unpaid internships be made illegal?', emoji: '💼', duration: 240 },
    { topic: 'Is the two-party political system failing Americans?', emoji: '🏛️', duration: 270 },
    { topic: 'Should AI be regulated by governments?', emoji: '🤖', duration: 240 },
    { topic: 'Is remote work permanently changing office culture for the better?', emoji: '💻', duration: 240 },
    { topic: 'Should high schools teach financial literacy?', emoji: '💰', duration: 240 },
    { topic: 'Is the criminal justice system fundamentally broken?', emoji: '⚖️', duration: 270 },
    { topic: 'Should single-use plastics be banned globally?', emoji: '♻️', duration: 240 },
    { topic: 'Is immigration net positive for receiving countries?', emoji: '✈️', duration: 270 },
    { topic: 'Should social media have age verification?', emoji: '📱', duration: 240 },
    { topic: 'Is it ethical to have children in today\'s world?', emoji: '👶', duration: 270 },
    { topic: 'Should the US military budget be significantly reduced?', emoji: '🪖', duration: 270 },
    { topic: 'Is the pharmaceutical industry doing more harm than good?', emoji: '💊', duration: 270 },
    { topic: 'Should standardized testing be abolished?', emoji: '📝', duration: 240 },
    { topic: 'Is the housing crisis a government failure?', emoji: '🏠', duration: 270 },
    { topic: 'Should there be limits on political campaign spending?', emoji: '🗳️', duration: 270 },
    { topic: 'Is privacy dead in the digital age?', emoji: '👁️', duration: 240 },
    { topic: 'Should corporations be held criminally liable for environmental damage?', emoji: '🌿', duration: 270 },
    { topic: 'Is the United Nations still relevant?', emoji: '🌍', duration: 270 },
    { topic: 'Should cryptocurrency replace traditional currency?', emoji: '₿', duration: 240 },
    { topic: 'Is the mental health crisis a result of modern society?', emoji: '🧠', duration: 270 },
    { topic: 'Should there be a global minimum wage?', emoji: '💵', duration: 270 },
    { topic: 'Is the education system preparing students for the real world?', emoji: '🎓', duration: 240 },
    { topic: 'Should hate speech be legally protected?', emoji: '💬', duration: 270 },
    { topic: 'Is the stock market rigged against ordinary investors?', emoji: '📈', duration: 240 },
    { topic: 'Should the wealthy have obligations to give to charity?', emoji: '💝', duration: 240 },
    { topic: 'Is cancel culture a form of censorship?', emoji: '🚫', duration: 240 },
    { topic: 'Should the police be defunded and reformed?', emoji: '👮', duration: 270 },
    { topic: 'Is fast fashion destroying the planet?', emoji: '👗', duration: 240 },
    { topic: 'Should there be term limits for all politicians?', emoji: '🏛️', duration: 270 },
    { topic: 'Is the opioid crisis primarily a government failure?', emoji: '💊', duration: 270 },
    { topic: 'Should Big Tech be broken up?', emoji: '💻', duration: 270 },
    { topic: 'Is religion doing more harm than good in modern society?', emoji: '⛪', duration: 300 },
    { topic: 'Should there be a wealth cap?', emoji: '💰', duration: 270 },
    { topic: 'Is patriotism dangerous in the modern world?', emoji: '🏳️', duration: 270 },
    { topic: 'Should the death penalty be abolished worldwide?', emoji: '⚖️', duration: 300 },
    { topic: 'Is censorship ever justified in a democracy?', emoji: '📵', duration: 270 },
    { topic: 'Should organ donation be opt-out rather than opt-in?', emoji: '❤️', duration: 240 },
    { topic: 'Is the UN Security Council veto system undemocratic?', emoji: '🌍', duration: 270 },
    { topic: 'Should the internet be nationalized?', emoji: '🌐', duration: 270 },
    { topic: 'Is journalism dead in the age of social media?', emoji: '📰', duration: 240 },
    { topic: 'Should there be mandatory military service for all citizens?', emoji: '🪖', duration: 270 },
    { topic: 'Is income inequality the defining challenge of our time?', emoji: '📊', duration: 300 },
  ],
  competitive: [
    { topic: 'Does free will actually exist, or is every decision predetermined?', emoji: '🧠', duration: 360, eloRequired: 200 },
    { topic: 'Is democracy still the optimal system of governance?', emoji: '🏛️', duration: 360, eloRequired: 200 },
    { topic: 'Is morality objective or entirely subjective?', emoji: '⚖️', duration: 360, eloRequired: 300 },
    { topic: 'What is the meaning of life — and can it be rationally determined?', emoji: '✨', duration: 360, eloRequired: 300 },
    { topic: 'Should artificial general intelligence be developed at all?', emoji: '🔬', duration: 360, eloRequired: 400 },
    { topic: 'Is capitalism fundamentally incompatible with addressing climate change?', emoji: '🏭', duration: 360, eloRequired: 400 },
    { topic: 'Can absolute morality exist without religion?', emoji: '🕊️', duration: 360, eloRequired: 500 },
    { topic: 'Is consciousness an illusion?', emoji: '🧠', duration: 360, eloRequired: 300 },
    { topic: 'Would a world government be utopian or dystopian?', emoji: '🌍', duration: 360, eloRequired: 300 },
    { topic: 'Is it ever moral to sacrifice the few for the many?', emoji: '⚖️', duration: 360, eloRequired: 200 },
    { topic: 'Does God exist — and can it be proven either way?', emoji: '✝️', duration: 360, eloRequired: 300 },
    { topic: 'Is human nature fundamentally good or evil?', emoji: '👤', duration: 360, eloRequired: 200 },
    { topic: 'Should there be limits on free speech even in democracies?', emoji: '💬', duration: 360, eloRequired: 200 },
    { topic: 'Is revolution ever morally justified?', emoji: '✊', duration: 360, eloRequired: 300 },
    { topic: 'Does science make religion obsolete?', emoji: '🔭', duration: 360, eloRequired: 300 },
    { topic: 'Is civil disobedience a moral obligation in unjust societies?', emoji: '✊', duration: 360, eloRequired: 400 },
    { topic: 'Is the pursuit of happiness a selfish goal?', emoji: '😊', duration: 360, eloRequired: 200 },
    { topic: 'Should we colonize Mars even if it means abandoning Earth?', emoji: '🪐', duration: 360, eloRequired: 300 },
    { topic: 'Is privacy more important than security in the digital age?', emoji: '🔐', duration: 360, eloRequired: 200 },
    { topic: 'Should we create artificial life if we have the capability?', emoji: '🧬', duration: 360, eloRequired: 400 },
    { topic: 'Is nihilism the most intellectually honest philosophy?', emoji: '🌑', duration: 360, eloRequired: 400 },
    { topic: 'Does democracy inevitably lead to mediocrity?', emoji: '🗳️', duration: 360, eloRequired: 300 },
    { topic: 'Is Western liberalism in terminal decline?', emoji: '🏛️', duration: 360, eloRequired: 500 },
    { topic: 'Can true equality ever be achieved in a capitalist system?', emoji: '⚖️', duration: 360, eloRequired: 400 },
    { topic: 'Is the social contract still valid in the 21st century?', emoji: '📜', duration: 360, eloRequired: 500 },
  ],
  random: [
    { topic: 'Are zoos ethical in the modern world?', emoji: '🦁', duration: 180 },
    { topic: 'Should unpaid internships be banned?', emoji: '💼', duration: 180 },
    { topic: 'Is the gig economy good for workers?', emoji: '🚗', duration: 180 },
    { topic: 'Should junk food be taxed like cigarettes?', emoji: '🍔', duration: 180 },
    { topic: 'Is graffiti art or vandalism?', emoji: '🎨', duration: 180 },
    { topic: 'Should parents be allowed to choose their children\'s genetics?', emoji: '🧬', duration: 210 },
    { topic: 'Is it ethical to eat meat in the modern world?', emoji: '🥩', duration: 180 },
    { topic: 'Should professional athletes be considered role models?', emoji: '🏆', duration: 180 },
    { topic: 'Is space tourism ethical when people are starving?', emoji: '🚀', duration: 180 },
    { topic: 'Should all drugs be legal for personal use?', emoji: '💊', duration: 210 },
    { topic: 'Is it okay to ghost someone you\'re dating?', emoji: '👻', duration: 150 },
    { topic: 'Should we eat insects to save the planet?', emoji: '🦗', duration: 150 },
    { topic: 'Is it ethical to keep pets?', emoji: '🐕', duration: 150 },
    { topic: 'Should billionaires go to space or solve poverty?', emoji: '💰', duration: 180 },
    { topic: 'Would you rather be smart or attractive?', emoji: '🧠', duration: 150 },
    { topic: 'Is it rude to correct someone\'s grammar?', emoji: '✏️', duration: 150 },
    { topic: 'Should social media likes be removed?', emoji: '❤️', duration: 150 },
    { topic: 'Is nostalgia holding society back?', emoji: '⏳', duration: 180 },
    { topic: 'Should we colonize the ocean before space?', emoji: '🌊', duration: 180 },
    { topic: 'Is true altruism possible?', emoji: '🤲', duration: 180 },
    { topic: 'Should there be a limit on how many children you can have?', emoji: '👶', duration: 210 },
    { topic: 'Is cancel culture more harmful than helpful?', emoji: '🚫', duration: 180 },
    { topic: 'Should voting be gamified to increase turnout?', emoji: '🎮', duration: 180 },
    { topic: 'Is it selfish to not want children?', emoji: '🚫', duration: 150 },
    { topic: 'Should historical monuments of controversial figures be removed?', emoji: '🗿', duration: 210 },
    { topic: 'Is it okay to be friends with your ex?', emoji: '💔', duration: 150 },
    { topic: 'Should we have a four-day work week?', emoji: '📅', duration: 180 },
    { topic: 'Is loyalty overrated as a virtue?', emoji: '🤝', duration: 180 },
    { topic: 'Should we terraform other planets?', emoji: '🪐', duration: 210 },
    { topic: 'Is ambition a virtue or a vice?', emoji: '🏆', duration: 180 },
    { topic: 'Should social media influencers pay higher taxes?', emoji: '📸', duration: 180 },
    { topic: 'Is it ethical to use AI-generated art?', emoji: '🎨', duration: 180 },
    { topic: 'Should we preserve dying languages?', emoji: '💬', duration: 180 },
    { topic: 'Is optimism naive?', emoji: '☀️', duration: 150 },
    { topic: 'Should we have open borders?', emoji: '🌍', duration: 210 },
    { topic: 'Is fame worth the loss of privacy?', emoji: '⭐', duration: 150 },
    { topic: 'Should violent sports like boxing be banned?', emoji: '🥊', duration: 180 },
    { topic: 'Is forgiveness always the right choice?', emoji: '🕊️', duration: 150 },
    { topic: 'Should the wealthy be required to mentor the poor?', emoji: '🤝', duration: 180 },
    { topic: 'Is the internet making us dumber?', emoji: '🌐', duration: 180 },
    { topic: 'Should we genetically engineer humans to be more empathetic?', emoji: '🧬', duration: 210 },
    { topic: 'Is boredom good for creativity?', emoji: '🎭', duration: 150 },
    { topic: 'Should social media be free or subscription-based?', emoji: '💳', duration: 150 },
    { topic: 'Is it ethical to eat at fast food restaurants?', emoji: '🍔', duration: 150 },
    { topic: 'Should AI have rights?', emoji: '🤖', duration: 210 },
    { topic: 'Is celebrity culture toxic?', emoji: '⭐', duration: 150 },
    { topic: 'Should we resurrect extinct species?', emoji: '🦕', duration: 210 },
    { topic: 'Is success mostly luck or mostly effort?', emoji: '🍀', duration: 180 },
    { topic: 'Should schools teach meditation?', emoji: '🧘', duration: 150 },
    { topic: 'Is it ethical to have a child knowing the planet is in crisis?', emoji: '🌍', duration: 210 },
  ]
}

// Shuffle a copy of an array
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

// Build a pool of all prewritten topics per type, shuffled
const topicPool = {
  casual: shuffle(PREWRITTEN.casual),
  serious: shuffle(PREWRITTEN.serious),
  competitive: shuffle(PREWRITTEN.competitive),
  random: shuffle(PREWRITTEN.random),
}

// Keep track of used topics to avoid immediate repeats
const usedTopics = new Set()

function getTopicFromPool(type) {
  const pool = topicPool[type]
  // Find first unused topic
  for (let i = 0; i < pool.length; i++) {
    if (!usedTopics.has(pool[i].topic)) {
      usedTopics.add(pool[i].topic)
      // Once we've used more than 80% of pool, start clearing used set
      if (usedTopics.size > pool.length * 0.8) usedTopics.clear()
      return pool[i]
    }
  }
  // All used — reshuffle and return first
  topicPool[type] = shuffle(PREWRITTEN[type])
  usedTopics.clear()
  return topicPool[type][0]
}

// AI-generated topics queue (bonus fresh topics)
const aiQueue = { casual: [], serious: [], competitive: [], random: [] }
let isGenerating = false

async function generateAITopics(type, count = 5) {
  const prompts = {
    casual: `Generate ${count} fun, punchy debate topics people will argue about passionately. Food, lifestyle, pop culture, fun hypotheticals. Keep them short.`,
    serious: `Generate ${count} controversial real-world debate topics about politics, society, technology, or the environment. Both sides should have strong arguments.`,
    competitive: `Generate ${count} deep philosophical or political debate topics for advanced debaters. Require knowledge and skill to argue well.`,
    random: `Generate ${count} surprising, unexpected debate topics ranging from silly to thought-provoking.`
  }
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `${prompts[type]}\n\nReturn ONLY a JSON array:\n[{"topic":"...","emoji":"..."}]`
      }]
    })
    const text = res.choices[0].message.content.trim()
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON')
    const parsed = JSON.parse(match[0])
    const durations = { casual: 120, serious: 240, competitive: 360, random: 180 }
    return parsed.slice(0, count).map(t => ({
      topic: t.topic,
      emoji: t.emoji || '💬',
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
        if (topics.length > 0) {
          aiQueue[type].push(...topics)
          console.log(`🤖 AI generated ${topics.length} ${type} topics`)
        }
      }
    }
  } finally {
    isGenerating = false
  }
}

function getTopicForType(type) {
  // 30% chance to use AI topic if available, otherwise use prewritten
  if (aiQueue[type].length > 0 && Math.random() < 0.3) {
    return aiQueue[type].shift()
  }
  return getTopicFromPool(type)
}

// ─── Room management ───────────────────────────────────────────
const rooms = {}
let roomCounter = 0

function createRoom(type) {
  const topic = getTopicForType(type)
  const id = `room_${++roomCounter}_${Date.now()}`
  rooms[id] = {
    instanceId: id,
    type,
    emoji: topic.emoji,
    topic: topic.topic,
    duration: topic.duration,
    eloRequired: topic.eloRequired || 0,
    maxPlayers: type === 'competitive' ? 10 : 15,
    players: {},
    messages: [],
    status: 'waiting',
    countdown: 120,
    startCountdown: null,
    debateEndsAt: null,
    createdAt: Date.now(),
  }
  return id
}

function getRoomCounts() {
  const active = Object.values(rooms).filter(r => r.status !== 'ended')
  return {
    total: active.length,
    casual: active.filter(r => r.type === 'casual').length,
    serious: active.filter(r => r.type === 'serious').length,
    competitive: active.filter(r => r.type === 'competitive').length,
    random: active.filter(r => r.type === 'random').length,
  }
}

function replenishRooms() {
  const counts = getRoomCounts()
  if (counts.total >= MAX_ROOMS) return
  const targets = {
    casual: Math.floor(MAX_ROOMS * DISTRIBUTION.casual),
    serious: Math.floor(MAX_ROOMS * DISTRIBUTION.serious),
    competitive: Math.floor(MAX_ROOMS * DISTRIBUTION.competitive),
    random: Math.floor(MAX_ROOMS * DISTRIBUTION.random),
  }
  let created = 0
  const types = ['serious', 'casual', 'competitive', 'random']
  for (const type of types) {
    const needed = targets[type] - counts[type]
    for (let i = 0; i < needed && counts.total + created < MAX_ROOMS; i++) {
      createRoom(type)
      created++
    }
  }
  if (created > 0) {
    console.log(`🏠 Created ${created} rooms. Total: ${counts.total + created}`)
    refillAIQueue()
  }
}

function getRoomList() {
  return Object.values(rooms)
    .filter(r => r.status !== 'ended')
    .sort((a, b) => {
      const ap = Object.keys(a.players).length
      const bp = Object.keys(b.players).length
      if (bp !== ap) return bp - ap
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
      players: Object.values(r.players).map(p => p.username),
      status: r.status,
      countdown: r.countdown,
      startCountdown: r.startCountdown,
    }))
}

function getEloReward(type, playerCount) {
  const base = { casual: 10, serious: 35, competitive: 100, random: 20 }[type] || 10
  return Math.round(base * Math.min(2, 1 + (playerCount - 3) * 0.1))
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
        room.startCountdown = 10
        io.to(room.instanceId).emit('room_starting', { startCountdown: 10 })
        return
      }
      if (room.countdown <= 0) {
        if (playerCount < 3) {
          room.status = 'ended'
          io.to(room.instanceId).emit('room_expired', { message: 'Not enough players joined. Room expired.' })
          console.log(`💨 Expired: "${room.topic}" (${playerCount} players)`)
        } else {
          room.status = 'starting'
          room.startCountdown = 10
          io.to(room.instanceId).emit('room_starting', { startCountdown: 10 })
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
        const sorted = Object.values(room.players).sort((a, b) => b.score - a.score)
        io.to(room.instanceId).emit('debate_ended', {
          standings: sorted,
          eloReward: getEloReward(room.type, sorted.length),
          type: room.type,
        })
        console.log(`🏁 Ended: "${room.topic}"`)
      }
    }
  })

  io.emit('rooms_update', getRoomList())

  const now = Date.now()
  Object.keys(rooms).forEach(id => {
    if (rooms[id].status === 'ended' && now - rooms[id].createdAt > 30000) delete rooms[id]
  })

  if (Math.random() < 0.05) replenishRooms()
}, 1000)
async function scoreArgument(text, topic, roomType) {
  // Check for slurs first — these always get penalized regardless
  const hardSlurs = /\b(nigger|nigga|faggot|chink|spic|kike|wetback|tranny)\b/i.test(text)
  if (hardSlurs) {
    return { score: -10, feedback: 'Slur detected. Hard penalty applied.' }
  }

  // Casual profanity check — only penalize if the message is ALSO low quality
  const hasCasualProfanity = /\b(fuck|shit|ass|bitch|damn|crap|hell|bastard)\b/i.test(text)

  // Too short to score meaningfully
  if (text.trim().length < 15) {
    return { score: 0, feedback: 'Too brief to evaluate.' }
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      messages: [{
        role: 'system',
        content: `You are a debate judge scoring arguments. The debate topic is: "${topic}" (type: ${roomType}).

Score the argument from 0 to 30 based on:
- Logical structure and clarity (0-8 pts)
- Use of evidence, examples, or facts (0-8 pts)  
- Depth of reasoning and insight (0-7 pts)
- Vocabulary and articulation (0-7 pts)

Important rules:
- Casual profanity ("this pizza is ass but here's why...") does NOT automatically lower the score if the argument is strong
- Only hard slurs (racial/sexual) warrant a score penalty
- A 3-word message scores 0-2
- A mediocre point scores 3-8
- A decent point scores 9-15
- A good point scores 16-22
- An excellent point scores 23-27
- A truly exceptional, well-structured argument scores 28-30

Return ONLY valid JSON: {"score": number, "feedback": "one short sentence about what they did well or poorly"}`
      }, {
        role: 'user',
        content: text
      }]
    })

    const raw = response.choices[0].message.content.trim()
    const parsed = JSON.parse(raw)
    let score = Math.max(0, Math.min(30, Math.round(parsed.score)))

    // If casual profanity AND low score, dock 2 extra points
    if (hasCasualProfanity && score < 10) score = Math.max(0, score - 2)

    return { score, feedback: parsed.feedback || '' }
  } catch (e) {
    console.error('Scoring error:', e.message)
    // Fallback scoring if AI fails
    return fallbackScore(text, hasCasualProfanity)
  }
}

function fallbackScore(text, hasProfanity) {
  const len = text.trim().length
  const wordCount = text.trim().split(/\s+/).length
  let score = 0

  if (wordCount < 5) score = 1
  else if (wordCount < 15) score = Math.floor(Math.random() * 4) + 3
  else if (wordCount < 30) score = Math.floor(Math.random() * 6) + 7
  else if (wordCount < 60) score = Math.floor(Math.random() * 7) + 12
  else score = Math.floor(Math.random() * 8) + 18

  // Bonus for evidence words
  const evidenceWords = /\b(study|research|statistics|data|evidence|example|instance|shows|proves|according|percent|million|billion)\b/i
  if (evidenceWords.test(text)) score = Math.min(30, score + 3)

  if (hasProfanity && score < 10) score = Math.max(0, score - 2)

  return { score: Math.min(30, score), feedback: 'AI scoring unavailable. Scored by length and content.' }
}
// ─── Socket events ─────────────────────────────────────────────
io.on('connection', (socket) => {
  let currentRoomId = null
  let currentUsername = null

  socket.emit('rooms_update', getRoomList())

  socket.on('join_room', ({ instanceId, username, elo = 0 }) => {
    const room = rooms[instanceId]
    if (!room) { socket.emit('error', { message: 'Room not found.' }); return }
    if (room.status === 'ended') { socket.emit('error', { message: 'This room has ended.' }); return }
    if (room.status === 'active') { socket.emit('error', { message: 'Debate already in progress.' }); return }
    if (elo < room.eloRequired) { socket.emit('error', { message: `You need ${room.eloRequired}+ ELO to join.` }); return }
    if (Object.keys(room.players).length >= room.maxPlayers) { socket.emit('error', { message: 'Room is full.' }); return }

    currentRoomId = instanceId
    currentUsername = username
    socket.join(instanceId)
    room.players[socket.id] = { username, score: 0, elo }

    socket.emit('message_history', room.messages)
    socket.emit('room_info', {
      instanceId: room.instanceId,
      topic: room.topic,
      emoji: room.emoji,
      type: room.type,
      duration: room.duration,
      status: room.status,
      countdown: room.countdown,
      startCountdown: room.startCountdown,
      eloRequired: room.eloRequired,
    })

    io.to(instanceId).emit('players_update', Object.values(room.players))
    io.to(instanceId).emit('system_message', { text: `${username} joined the debate` })
    io.emit('rooms_update', getRoomList())
    console.log(`👤 ${username} joined "${room.topic}"`)
  })

 socket.on('send_message', async ({ instanceId, username, text }) => {
  const room = rooms[instanceId]
  if (!room || room.status !== 'active') return

  // Score the message with AI
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
    delete room.players[socket.id]
    io.to(currentRoomId).emit('players_update', Object.values(room.players))
    if (currentUsername) io.to(currentRoomId).emit('system_message', { text: `${currentUsername} left` })
    io.emit('rooms_update', getRoomList())
  })
})

// ─── Boot ──────────────────────────────────────────────────────
function boot() {
  replenishRooms()
  console.log(`✅ Server ready with ${Object.keys(rooms).length} rooms`)
  // Start generating AI topics in background after 2 seconds
  setTimeout(refillAIQueue, 2000)
  // Refill AI queue every 5 minutes
  setInterval(refillAIQueue, 5 * 60 * 1000)
}

boot()
app.get('/health', (req, res) => res.json({ status: 'ok', rooms: Object.keys(rooms).length, distribution: getRoomCounts() }))
httpServer.listen(3001, () => console.log('🚀 Socket server running on port 3001'))