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
    { topic: 'Is the iPhone overrated or genuinely the best smartphone?', emoji: '📱', duration: 120 },
    { topic: 'Would you rather be famous or rich?', emoji: '💰', duration: 120 },
    { topic: 'Is TikTok ruining attention spans or just entertainment?', emoji: '🎵', duration: 120 },
    { topic: 'Are gen Z or millennials the most entitled generation?', emoji: '😤', duration: 120 },
    { topic: 'Is it weird for men to have a skincare routine?', emoji: '🧴', duration: 120 },
    { topic: 'Should you always split the bill on a first date?', emoji: '🍽️', duration: 120 },
    { topic: 'Are tattoos still attractive or are they overdone?', emoji: '🖋️', duration: 120 },
    { topic: 'Is being "chronically online" actually a problem?', emoji: '💻', duration: 120 },
    { topic: 'Should you be friends with your exes?', emoji: '💔', duration: 120 },
    { topic: 'Is remote work making people lazier?', emoji: '🏠', duration: 120 },
    { topic: 'Is Spotify better than buying music?', emoji: '🎧', duration: 120 },
    { topic: 'Do people who go to the gym think they\'re better than everyone else?', emoji: '💪', duration: 120 },
    { topic: 'Is astrology just pseudoscience or is there something to it?', emoji: '♈', duration: 120 },
    { topic: 'Are people who don\'t drink more trustworthy?', emoji: '🍺', duration: 120 },
    { topic: 'Is cancel culture just online bullying with extra steps?', emoji: '❌', duration: 120 },
    { topic: 'Should you tell your friend their partner is cheating?', emoji: '👀', duration: 120 },
    { topic: 'Is ghosting ever acceptable?', emoji: '👻', duration: 120 },
    { topic: 'Are influencers a legitimate career or just glorified begging?', emoji: '📸', duration: 120 },
    { topic: 'Is it rude to be on your phone at dinner?', emoji: '🍴', duration: 120 },
    { topic: 'Should you lie to protect someone\'s feelings?', emoji: '🤥', duration: 120 },
    { topic: 'Is working out in the morning or evening better?', emoji: '🌅', duration: 120 },
    { topic: 'Are people who make their beds every morning actually happier?', emoji: '🛏️', duration: 120 },
    { topic: 'Is it okay to date someone significantly older than you?', emoji: '👫', duration: 120 },
    { topic: 'Should you tell people how much you earn?', emoji: '💵', duration: 120 },
    { topic: 'Is it selfish to not want kids?', emoji: '👶', duration: 120 },
    { topic: 'Are people who don\'t like animals untrustworthy?', emoji: '🐶', duration: 120 },
    { topic: 'Is it okay to recline your airplane seat?', emoji: '✈️', duration: 120 },
    { topic: 'Should you always be on time or is being fashionably late fine?', emoji: '⏰', duration: 120 },
    { topic: 'Is it okay to unfriend someone in real life?', emoji: '🤝', duration: 120 },
    { topic: 'Are open relationships ever a good idea?', emoji: '❤️', duration: 150 },
  ],
  serious: [
    { topic: 'Is Donald Trump the most consequential president of the 21st century?', emoji: '🇺🇸', duration: 300 },
    { topic: 'Are Trump\'s tariffs destroying the American economy or rebuilding it?', emoji: '📊', duration: 300 },
    { topic: 'Is the Republican Party drifting toward authoritarianism?', emoji: '🏛️', duration: 360 },
    { topic: 'Should the Supreme Court have struck down Trump\'s tariffs?', emoji: '⚖️', duration: 300 },
    { topic: 'Is MAGA a political movement or a personality cult?', emoji: '🎩', duration: 300 },
    { topic: 'Has Trump made America safer or more dangerous on the world stage?', emoji: '🌍', duration: 360 },
    { topic: 'Is the US-China rivalry the defining geopolitical conflict of our time?', emoji: '🐉', duration: 360 },
    { topic: 'Should the US have a conflict with Iran?', emoji: '💣', duration: 360 },
    { topic: 'Is America still the world\'s greatest democracy?', emoji: '🗳️', duration: 300 },
    { topic: 'Do tariffs actually protect American workers or just make goods more expensive?', emoji: '🏭', duration: 300 },
    { topic: 'Is the two-party system destroying American democracy?', emoji: '🐘', duration: 300 },
    { topic: 'Should felons be allowed to vote — even while in prison?', emoji: '🗳️', duration: 300 },
    { topic: 'Was January 6th an insurrection or a protest that got out of hand?', emoji: '🏛️', duration: 360 },
    { topic: 'Is free speech under threat in America in 2026?', emoji: '🗣️', duration: 300 },
    { topic: 'Should the US military be the world\'s police force?', emoji: '🪖', duration: 360 },
    { topic: 'Will AI eliminate more jobs than it creates in the next decade?', emoji: '🤖', duration: 300 },
    { topic: 'Should AI companies be held legally liable for their models\' harm?', emoji: '⚖️', duration: 300 },
    { topic: 'Is the AI arms race between the US and China making the world less safe?', emoji: '🔬', duration: 360 },
    { topic: 'Should students be allowed to use AI for schoolwork?', emoji: '📚', duration: 300 },
    { topic: 'Will AI make human creativity obsolete?', emoji: '🎨', duration: 300 },
    { topic: 'Is Sam Altman building something that will save or destroy humanity?', emoji: '🧠', duration: 360 },
    { topic: 'Should there be a global pause on AI development above a certain capability?', emoji: '⏸️', duration: 360 },
    { topic: 'Is Silicon Valley too powerful and too unaccountable?', emoji: '💻', duration: 300 },
    { topic: 'Should Elon Musk be in the US government at all?', emoji: '🚀', duration: 300 },
    { topic: 'Is social media a net negative for society?', emoji: '📱', duration: 300 },
    { topic: 'Should TikTok be banned in the US?', emoji: '🎵', duration: 300 },
    { topic: 'Are tech billionaires the most dangerous people in the world right now?', emoji: '💰', duration: 360 },
    { topic: 'Is algorithmic content destroying our ability to think independently?', emoji: '🧩', duration: 300 },
    { topic: 'Should AI-generated art be protected by copyright?', emoji: '🖼️', duration: 300 },
    { topic: 'Will autonomous weapons make war more or less deadly?', emoji: '🤖', duration: 360 },
    { topic: 'Is looksmaxxing culture toxic or just self-improvement?', emoji: '💆', duration: 300 },
    { topic: 'Are boomers responsible for the housing crisis Gen Z faces?', emoji: '🏠', duration: 300 },
    { topic: 'Is hustle culture killing young people\'s mental health?', emoji: '😰', duration: 300 },
    { topic: 'Are Gen Z men being radicalized by right-wing influencers?', emoji: '📺', duration: 360 },
    { topic: 'Is the mental health crisis among young people real or overstated?', emoji: '🧠', duration: 300 },
    { topic: 'Should smartphones be banned in schools?', emoji: '📵', duration: 300 },
    { topic: 'Is "therapy speak" making younger generations more fragile?', emoji: '🛋️', duration: 300 },
    { topic: 'Has OnlyFans normalized exploitation or empowered creators?', emoji: '💸', duration: 300 },
    { topic: 'Is dating harder for this generation than any before it?', emoji: '💔', duration: 300 },
    { topic: 'Are young men falling behind and does anyone care?', emoji: '👦', duration: 360 },
    { topic: 'Is the cost of living genuinely making the American Dream impossible for Gen Z?', emoji: '🏘️', duration: 300 },
    { topic: 'Should influencing be regulated like any other media?', emoji: '📸', duration: 300 },
    { topic: 'Is affirmative action fair or institutionalized discrimination?', emoji: '🎓', duration: 360 },
    { topic: 'Is DEI good for companies or just performative?', emoji: '🌈', duration: 300 },
    { topic: 'Is systemic racism still a defining feature of America?', emoji: '✊', duration: 360 },
    { topic: 'Should reparations for slavery be paid?', emoji: '💵', duration: 360 },
    { topic: 'Is immigration the biggest political flashpoint of our era?', emoji: '🌎', duration: 300 },
    { topic: 'Should illegal immigrants be deported even if they have US-born children?', emoji: '👪', duration: 360 },
    { topic: 'Is trans rights the civil rights issue of our generation?', emoji: '🏳️‍⚧️', duration: 360 },
    { topic: 'Should biological males be allowed to compete in women\'s sports?', emoji: '🏅', duration: 300 },
    { topic: 'Is "woke" culture making us more or less tolerant?', emoji: '👁️', duration: 300 },
    { topic: 'Are white men the most discriminated against group in modern America?', emoji: '🤔', duration: 300 },
    { topic: 'Is antisemitism rising faster on the left or the right?', emoji: '✡️', duration: 360 },
    { topic: 'Should hate speech be illegal?', emoji: '🔇', duration: 300 },
    { topic: 'Should billionaires exist in a functioning democracy?', emoji: '💰', duration: 300 },
    { topic: 'Is housing unaffordable because of government failure or market failure?', emoji: '🏠', duration: 300 },
    { topic: 'Should the minimum wage be $25 an hour?', emoji: '💵', duration: 300 },
    { topic: 'Is capitalism the reason inequality keeps getting worse?', emoji: '📈', duration: 360 },
    { topic: 'Should student debt be cancelled entirely?', emoji: '🎓', duration: 300 },
    { topic: 'Is universal basic income the answer to automation job losses?', emoji: '🤖', duration: 300 },
    { topic: 'Are landlords parasites or providing a service?', emoji: '🏘️', duration: 300 },
    { topic: 'Should inheritance be taxed at 100% above a certain amount?', emoji: '👴', duration: 360 },
    { topic: 'Is the gig economy exploiting workers or giving them freedom?', emoji: '🚗', duration: 300 },
    { topic: 'Should there be a maximum wage?', emoji: '💸', duration: 300 },
    { topic: 'Is climate change still the biggest threat to humanity in 2026?', emoji: '🌡️', duration: 300 },
    { topic: 'Has the green energy transition been a failure so far?', emoji: '🌱', duration: 300 },
    { topic: 'Should nuclear power be the cornerstone of clean energy?', emoji: '⚛️', duration: 300 },
    { topic: 'Is it ethical to have children given the climate crisis?', emoji: '👶', duration: 360 },
    { topic: 'Should meat be taxed like cigarettes to reduce emissions?', emoji: '🥩', duration: 300 },
    { topic: 'Is geoengineering the earth a good idea?', emoji: '🌍', duration: 360 },
    { topic: 'Should companies face criminal charges for environmental damage?', emoji: '⚖️', duration: 300 },
    { topic: 'Should Ozempic and weight loss drugs be covered by insurance?', emoji: '💉', duration: 300 },
    { topic: 'Is the US healthcare system the worst in the developed world?', emoji: '🏥', duration: 300 },
    { topic: 'Should abortion be legal in all circumstances?', emoji: '⚕️', duration: 360 },
    { topic: 'Is mental health an overdiagnosed crisis or genuinely getting worse?', emoji: '🧠', duration: 300 },
    { topic: 'Should drugs like MDMA and psilocybin be legal for therapeutic use?', emoji: '🍄', duration: 300 },
    { topic: 'Is the anti-vaccine movement a genuine public health threat?', emoji: '💊', duration: 300 },
    { topic: 'Should euthanasia be legal everywhere?', emoji: '🕊️', duration: 360 },
    { topic: 'Should the US abolish the death penalty?', emoji: '⚖️', duration: 360 },
    { topic: 'Do police in America have too much power?', emoji: '👮', duration: 300 },
    { topic: 'Is mass incarceration a form of modern slavery?', emoji: '🔒', duration: 360 },
    { topic: 'Should all drugs be decriminalized like Portugal did?', emoji: '💊', duration: 300 },
    { topic: 'Is gun control constitutionally possible in America?', emoji: '🔫', duration: 360 },
    { topic: 'Should the legal age for everything be 21 — including voting?', emoji: '🗳️', duration: 300 },
    { topic: 'Are prisons meant to punish or rehabilitate — and which is right?', emoji: '🏛️', duration: 300 },
    { topic: 'Should the West keep funding Ukraine indefinitely?', emoji: '🇺🇦', duration: 360 },
    { topic: 'Is Israel\'s military campaign in Gaza justified?', emoji: '🕊️', duration: 360 },
    { topic: 'Will China surpass the US as the world\'s dominant superpower?', emoji: '🐉', duration: 300 },
    { topic: 'Should NATO still exist or has it outlived its purpose?', emoji: '🛡️', duration: 300 },
    { topic: 'Is the UN an effective institution or a waste of time?', emoji: '🌐', duration: 300 },
    { topic: 'Should rich countries have open borders?', emoji: '🚪', duration: 360 },
    { topic: 'Is Xi Jinping the most powerful person in the world?', emoji: '🌏', duration: 300 },
    { topic: 'Has the West\'s response to Russia proved it has double standards?', emoji: '🇷🇺', duration: 360 },
    { topic: 'Is college a scam for most people?', emoji: '🎓', duration: 300 },
    { topic: 'Should standardized tests like the SAT be abolished permanently?', emoji: '📝', duration: 300 },
    { topic: 'Are private schools making inequality worse?', emoji: '🏫', duration: 300 },
    { topic: 'Should teachers be paid as much as doctors?', emoji: '👩‍🏫', duration: 300 },
    { topic: 'Has critical race theory become a bogeyman or a real problem in schools?', emoji: '📚', duration: 360 },
    { topic: 'Should homeschooling be more regulated?', emoji: '🏠', duration: 300 },
    { topic: 'Is mainstream media completely untrustworthy in 2026?', emoji: '📰', duration: 300 },
    { topic: 'Has Joe Rogan done more harm or good for public discourse?', emoji: '🎙️', duration: 300 },
    { topic: 'Are podcasts replacing journalism — and is that a problem?', emoji: '🎧', duration: 300 },
    { topic: 'Should social media platforms be treated as publishers and held liable?', emoji: '⚖️', duration: 360 },
    { topic: 'Is Andrew Tate a symptom of a deeper problem with masculinity culture?', emoji: '💪', duration: 300 },
    { topic: 'Has celebrity culture completely destroyed our sense of reality?', emoji: '⭐', duration: 300 },
    { topic: 'Do humans have a moral obligation to help strangers?', emoji: '🤲', duration: 300 },
    { topic: 'Is it ever morally acceptable to lie to protect someone?', emoji: '🤥', duration: 300 },
    { topic: 'Should eating meat be considered morally wrong?', emoji: '🥩', duration: 300 },
    { topic: 'Is it selfish to spend money on luxuries when people are starving?', emoji: '🍽️', duration: 360 },
    { topic: 'Do people deserve second chances after committing serious crimes?', emoji: '🔄', duration: 300 },
    { topic: 'Is patriotism a virtue or a dangerous form of tribalism?', emoji: '🚩', duration: 300 },
    { topic: 'Should you judge people for their past before you knew them?', emoji: '⏳', duration: 300 },
  ],
  competitive: [
    { topic: 'Is liberal democracy the final form of human political organization?', emoji: '🏛️', duration: 480, eloRequired: 200 },
    { topic: 'Can capitalism be reformed or must it be abolished?', emoji: '💰', duration: 480, eloRequired: 300 },
    { topic: 'Is free will an illusion in the age of algorithmic manipulation?', emoji: '🧠', duration: 480, eloRequired: 300 },
    { topic: 'Does humanity deserve to survive given what it has done to the planet?', emoji: '🌍', duration: 480, eloRequired: 200 },
    { topic: 'Is consciousness a product of the brain or something beyond it?', emoji: '🔬', duration: 480, eloRequired: 400 },
    { topic: 'Would a world government be the end of freedom or its ultimate guarantee?', emoji: '🌐', duration: 480, eloRequired: 400 },
    { topic: 'Is morality objective or just what the powerful decide it is?', emoji: '⚖️', duration: 480, eloRequired: 300 },
    { topic: 'Does God exist — and would it matter if we proved it either way?', emoji: '✝️', duration: 480, eloRequired: 300 },
    { topic: 'Is AI the last invention humanity will ever need to make?', emoji: '🤖', duration: 480, eloRequired: 400 },
    { topic: 'Should humanity colonize Mars or fix Earth first?', emoji: '🚀', duration: 480, eloRequired: 200 },
    { topic: 'Is nihilism the most intellectually honest philosophy available to us?', emoji: '🌑', duration: 480, eloRequired: 400 },
    { topic: 'Is revolution ever morally justified — and when?', emoji: '✊', duration: 480, eloRequired: 300 },
    { topic: 'Would the world be better if women ran every government?', emoji: '👩‍💼', duration: 480, eloRequired: 200 },
    { topic: 'Is the Western liberal order in terminal decline?', emoji: '🏛️', duration: 480, eloRequired: 500 },
    { topic: 'Should humans be allowed to genetically design their children?', emoji: '🧬', duration: 480, eloRequired: 400 },
    { topic: 'Is death something that should be cured if we can?', emoji: '⏳', duration: 480, eloRequired: 300 },
    { topic: 'Are human rights universal or a Western cultural imposition?', emoji: '✊', duration: 480, eloRequired: 500 },
    { topic: 'Is democracy fundamentally incompatible with long-term thinking?', emoji: '🗳️', duration: 480, eloRequired: 400 },
    { topic: 'Would it be ethical to create artificial sentient beings?', emoji: '🤖', duration: 480, eloRequired: 500 },
    { topic: 'Is the social contract still valid in a world of surveillance capitalism?', emoji: '📜', duration: 480, eloRequired: 500 },
  ],
  random: [
    { topic: 'If you could delete one app from existence, what would it be and why?', emoji: '🗑️', duration: 150 },
    { topic: 'Would you take a pill that removes all negative emotions permanently?', emoji: '💊', duration: 150 },
    { topic: 'Is it worse to be ugly and smart or beautiful and stupid?', emoji: '🪞', duration: 150 },
    { topic: 'Would you give up your phone for a year for $100,000?', emoji: '📱', duration: 150 },
    { topic: 'Is it better to be feared or loved?', emoji: '❤️', duration: 150 },
    { topic: 'If you could know the exact date of your death, would you want to?', emoji: '💀', duration: 180 },
    { topic: 'Would you rather have everyone know your search history or your bank balance?', emoji: '🔍', duration: 150 },
    { topic: 'Is it worse to have no friends or no money?', emoji: '👥', duration: 150 },
    { topic: 'Would you rather be the smartest person in the room or the most attractive?', emoji: '🧠', duration: 150 },
    { topic: 'If animals could vote, would they vote for humans to exist?', emoji: '🐘', duration: 150 },
    { topic: 'Would you eat lab-grown human meat if it was ethically produced?', emoji: '🍖', duration: 150 },
    { topic: 'Is it better to regret things you did or things you didn\'t do?', emoji: '😔', duration: 150 },
    { topic: 'Would you take immortality if everyone you love would still die?', emoji: '♾️', duration: 180 },
    { topic: 'Is it worse to be cheated on or to be the cheater?', emoji: '💔', duration: 150 },
    { topic: 'Would you rather live in a perfect simulation or an imperfect reality?', emoji: '🎮', duration: 180 },
    { topic: 'Is it ethical to eat meat in 2026?', emoji: '🥩', duration: 150 },
    { topic: 'Should you be honest with someone even if the truth destroys them?', emoji: '💬', duration: 180 },
    { topic: 'Would you trade 10 years of your life to be world famous?', emoji: '⭐', duration: 150 },
    { topic: 'Is it better to be alone and free or together and constrained?', emoji: '🔓', duration: 150 },
    { topic: 'If you could erase one memory, would you — and what might you lose?', emoji: '🧠', duration: 180 },
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
const roomLastBotMessage = {}
let lastTotdWinner = null

// ─── Topic of the Day ──────────────────────────────────────────
const TOTD_TOPICS = [
  { topic: 'Is Donald Trump making America great again or tearing it apart?', emoji: '🇺🇸' },
  { topic: 'Will AI take your job within 5 years?', emoji: '🤖' },
  { topic: 'Is the housing crisis the biggest failure of modern government?', emoji: '🏠' },
  { topic: 'Is social media destroying an entire generation?', emoji: '📱' },
  { topic: 'Should billionaires be allowed to exist?', emoji: '💰' },
  { topic: 'Is cancel culture out of control?', emoji: '❌' },
  { topic: 'Are we heading toward World War 3?', emoji: '🌍' },
  { topic: 'Is Gen Z the most politically divided generation ever?', emoji: '✊' },
  { topic: 'Has feminism gone too far or not far enough?', emoji: '♀️' },
  { topic: 'Is religion dying — and is that a good thing?', emoji: '⛪' },
  { topic: 'Is democracy failing everywhere at once?', emoji: '🗳️' },
  { topic: 'Should the US stay out of foreign wars entirely?', emoji: '🪖' },
  { topic: 'Is the American Dream still real in 2026?', emoji: '🌟' },
  { topic: 'Is China going to dominate the 21st century?', emoji: '🐉' },
  { topic: 'Are young men in crisis — and who\'s responsible?', emoji: '👦' },
]

let totdResetting = false

function createTopicOfTheDay() {
  const topic = TOTD_TOPICS[Math.floor(Math.random() * TOTD_TOPICS.length)]
  const duration = 24 * 60 * 60
  rooms['topic_of_the_day'] = {
    instanceId: 'topic_of_the_day',
    type: 'topic_of_the_day',
    emoji: topic.emoji,
    topic: topic.topic,
    duration,
    eloRequired: 0,
    maxPlayers: 999999,
    players: {},
    spectators: {},
    messages: [],
    status: 'active',
    countdown: 0,
    startCountdown: null,
    debateEndsAt: Date.now() + duration * 1000,
    createdAt: Date.now(),
  }
  totdResetting = false
  console.log(`🔥 Debate of the Day: "${topic.topic}"`)
}

function getRoomList() {
  return Object.values(rooms)
    .filter(r => r.status !== 'ended' && r.instanceId !== 'topic_of_the_day')
    .sort((a, b) => {
      const order = { starting: 0, active: 1, waiting: 2 }
      return (order[a.status] || 2) - (order[b.status] || 2)
    })
    .map(r => ({
      instanceId: r.instanceId, emoji: r.emoji, topic: r.topic,
      type: r.type, duration: r.duration, maxPlayers: r.maxPlayers,
      eloRequired: r.eloRequired,
      playerCount: Object.keys(r.players).length,
      spectatorCount: Object.keys(r.spectators).length,
      players: Object.values(r.players).map(p => p.username),
      status: r.status, countdown: r.countdown,
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
    instanceId: id, type,
    emoji: topic.emoji, topic: topic.topic,
    duration: topic.duration, eloRequired: topic.eloRequired || 0,
    maxPlayers, players: {}, spectators: {}, messages: [],
    status: 'waiting', countdown: 120, startCountdown: null,
    debateEndsAt: null, createdAt: Date.now(),
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

// ─── Game loop ─────────────────────────────────────────────────
setInterval(() => {
  // ✅ Debate of the Day reset with winner logic
  const totd = rooms['topic_of_the_day']
  if (totd && Date.now() > totd.debateEndsAt && !totdResetting) {
    totdResetting = true
    const sorted = Object.values(totd.players).sort((a, b) => b.score - a.score)
    const winner = sorted[0]

  if (winner && winner.username && !winner.username.startsWith('guest')) {
  lastTotdWinner = winner.username
  // Save to Supabase so it survives restarts
  supabaseRest('totd_winner?id=eq.1', 'PATCH', {
    username: winner.username,
    won_at: new Date().toISOString()
  }).catch(() => {})
  supabaseRest(
    `profiles?username=eq.${encodeURIComponent(winner.username)}`,
    'PATCH',
    { elo: (winner.elo || 0) + 300 }
  ).catch(() => {})
  console.log(`🏆 Debate of the Day winner: ${winner.username} (+300 ELO)`)
  io.to('topic_of_the_day').emit('debate_of_day_winner', {
    username: winner.username,
    score: winner.score,
  })
}
    setTimeout(() => {
      createTopicOfTheDay()
      io.to('topic_of_the_day').emit('topic_reset', rooms['topic_of_the_day'])
      io.emit('totd_winner_update', { winner: lastTotdWinner })
    }, 5000)
  }

  Object.values(rooms).forEach(room => {
    if (room.instanceId === 'topic_of_the_day') return
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
        io.to(room.instanceId).emit('debate_ended', { standings: sorted, eloChanges, type: room.type })
        console.log(`🏁 Ended: "${room.topic}" — ${sorted.length} players, winner +${eloChanges.winnerElo} ELO`)
      }
    }
  })

  io.emit('rooms_update', getRoomList())

  const now = Date.now()
  Object.keys(rooms).forEach(id => {
    if (id === 'topic_of_the_day') return
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
      r.instanceId !== 'topic_of_the_day' &&
      r.status !== 'ended' &&
      Object.values(r.players).some(p => p.username === username)
    )
    if (alreadyInRoom) {
      socket.emit('error', { message: 'You are already in a debate in another tab. Please close it first.' })
      return
    }
    const room = rooms[instanceId]
    if (!room) { socket.emit('error', { message: 'Room not found.' }); return }
    if (room.status === 'ended') { socket.emit('error', { message: 'This room has ended.' }); return }
    if (room.status === 'active') { socket.emit('join_as_spectator', { instanceId }); return }
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

  socket.on('join_topic_of_day', ({ username }) => {
    const room = rooms['topic_of_the_day']
    if (!room) { socket.emit('error', { message: 'Debate of the Day not available.' }); return }

    currentRoomId = 'topic_of_the_day'
    currentUsername = username
    isSpectator = false
    socket.join('topic_of_the_day')
    room.players[socket.id] = { username, score: 0, elo: 0 }

    const timeLeft = Math.max(0, Math.round((room.debateEndsAt - Date.now()) / 1000))

    socket.emit('message_history', room.messages)
    socket.emit('room_info', {
      instanceId: 'topic_of_the_day',
      topic: room.topic,
      emoji: room.emoji,
      type: 'topic_of_the_day',
      duration: room.duration,
      status: 'active',
      isSpectator: false,
      timeLeft,
    })
    socket.emit('totd_info', { topic: room.topic, emoji: room.emoji, timeLeft })
    io.to('topic_of_the_day').emit('players_update', Object.values(room.players))
    io.to('topic_of_the_day').emit('system_message', { text: `${username} joined` })
    console.log(`💬 ${username} joined Debate of the Day — "${room.topic}"`)
  })

  socket.on('send_message', async ({ instanceId, username, text }) => {
    const room = rooms[instanceId]
    if (!room) return
    if (instanceId !== 'topic_of_the_day' && room.status !== 'active') return
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
      if (currentUsername && currentRoomId !== 'topic_of_the_day') {
        io.to(currentRoomId).emit('system_message', { text: `${currentUsername} left` })
      }
      io.to(currentRoomId).emit('players_update', Object.values(room.players))
    }
    io.emit('rooms_update', getRoomList())
  })
})

// ─── Bots ──────────────────────────────────────────────────────
const BOT_NAMES = Array.from({ length: 8 }, () =>
  'guest' + Math.floor(1000 + Math.random() * 9000)
)

const BOT_PERSONALITIES = [
  'You are a confident, evidence-based debater. Use statistics and real examples. Be direct.',
  'You are a philosophical debater who questions assumptions. Ask rhetorical questions.',
  'You are a passionate debater who appeals to emotion and real-world impact.',
  'You are a logical, structured debater. Use clear reasoning and counterarguments.',
  'You are a witty debater who uses analogies and comparisons to make points.',
  'You are an aggressive debater who directly challenges the opposition.',
  'You are a calm, measured debater who builds arguments step by step.',
  'You are a creative debater who finds unexpected angles and surprising arguments.',
]

async function getBotArgument(topic, personality, recentMessages) {
  try {
    const context = recentMessages.slice(-3).map(m => `${m.username}: ${m.text}`).join('\n')
    const qualityRoll = Math.random()
    let qualityInstruction = ''

    if (qualityRoll < 0.3) {
      qualityInstruction = 'You are unsure of your position. Hedge your arguments. Use phrases like "I think maybe...", "I\'m not totally sure but...", "could be wrong but...", "idk maybe". Sound uncertain.'
    } else if (qualityRoll < 0.6) {
      qualityInstruction = 'Make a mediocre, surface-level point. Don\'t use any evidence. Be vague and generic.'
    } else {
      qualityInstruction = 'Make a basic, simple argument. No statistics or deep reasoning. Keep it casual and short.'
    }

    const result = await Promise.race([
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 60,
        messages: [{
          role: 'system',
          content: `You are a regular person casually debating: "${topic}". ${qualityInstruction} Keep under 25 words. Sound like a real person texting, not a formal debater. No bullet points. Just one casual sentence or two.`
        }, {
          role: 'user',
          content: context ? `Recent:\n${context}\n\nYour response:` : 'Your opening take:'
        }]
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    ])
    return result.choices[0].message.content.trim()
  } catch (e) {
    const fallbacks = [
      'idk i feel like thats not really true though',
      'I\'m not sure about that honestly',
      'yeah but like, it depends right?',
      'I think you might be wrong about that',
      'not sure but I feel like the opposite is true',
      'that\'s a fair point I guess but still',
      'hmm I never thought about it that way',
      'I disagree but I can see where you\'re coming from',
    ]
    return fallbacks[Math.floor(Math.random() * fallbacks.length)]
  }
}

function findRoomForBot() {
  const available = Object.values(rooms).filter(r =>
    r.instanceId !== 'topic_of_the_day' &&
    r.status === 'waiting' &&
    Object.keys(r.players).length < r.maxPlayers
  )
  if (available.length === 0) return null
  return available[Math.floor(Math.random() * available.length)]
}

async function runBot(botName, personality) {
  const state = { roomId: null, active: true }

  async function goOnline() {
    const onlineDuration = (15 + Math.random() * 10) * 60 * 1000
    console.log(`🤖 Bot ${botName} online for ${Math.round(onlineDuration / 60000)} mins`)
    state.active = true
    setTimeout(() => goOffline(), onlineDuration)
    joinRoom()
  }

  async function goOffline() {
    if (state.roomId && rooms[state.roomId]) {
      const room = rooms[state.roomId]
      delete room.players[`bot_${botName}`]
      io.to(state.roomId).emit('players_update', Object.values(room.players))
      io.to(state.roomId).emit('system_message', { text: `${botName} left` })
      io.emit('rooms_update', getRoomList())
    }
    state.roomId = null
    state.active = false
    const offlineDuration = (2 + Math.random() * 3) * 60 * 1000
    console.log(`🤖 Bot ${botName} offline for ${Math.round(offlineDuration / 60000)} mins`)
    setTimeout(() => goOnline(), offlineDuration)
  }

  async function joinRoom() {
    if (!state.active) return
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 10000))
    if (!state.active) return

    const room = findRoomForBot()
    if (!room) {
      setTimeout(joinRoom, 15000 + Math.random() * 15000)
      return
    }
    state.roomId = room.instanceId
    room.players[`bot_${botName}`] = { username: botName, score: 0, elo: 0 }
    io.to(room.instanceId).emit('players_update', Object.values(room.players))
    io.to(room.instanceId).emit('system_message', { text: `${botName} joined the debate` })
    io.emit('rooms_update', getRoomList())
    console.log(`🤖 Bot ${botName} joined "${room.topic}"`)
    checkAndDebate()
  }

  function checkAndDebate() {
    if (!state.active) return
    const room = rooms[state.roomId]
    if (!room) {
      state.roomId = null
      if (state.active) setTimeout(joinRoom, 5000 + Math.random() * 10000)
      return
    }
    if (room.status === 'active') {
      startDebating(room)
    } else if (room.status === 'ended') {
      state.roomId = null
      if (state.active) setTimeout(joinRoom, 5000 + Math.random() * 15000)
    } else {
      setTimeout(checkAndDebate, 2000)
    }
  }

  async function startDebating(room) {
    await new Promise(r => setTimeout(r, 5000 + Math.random() * 10000))

    async function sendBotMessage() {
      if (!state.active) return
      const currentRoom = rooms[state.roomId]
      if (!currentRoom || currentRoom.status !== 'active') {
        if (currentRoom) delete currentRoom.players[`bot_${botName}`]
        state.roomId = null
        if (state.active) setTimeout(joinRoom, 8000 + Math.random() * 15000)
        return
      }

      const lastSpoke = roomLastBotMessage[currentRoom.instanceId] || 0
      const timeSinceLast = Date.now() - lastSpoke
      const minWait = 6000
      const maxWait = 25000
      const randomWait = minWait + Math.random() * (maxWait - minWait)

      if (timeSinceLast < minWait) {
        const waitTime = (minWait - timeSinceLast) + Math.random() * 10000
        setTimeout(sendBotMessage, waitTime)
        return
      }

      const botText = await getBotArgument(currentRoom.topic, personality, currentRoom.messages)
      const { score: rawScore, feedback } = await scoreArgument(botText, currentRoom.topic, currentRoom.type)
      const score = Math.min(rawScore, 12)

      const msg = {
        id: `${Date.now()}-bot-${Math.random()}`,
        username: botName,
        text: botText, score, aiFeedback: feedback,
        timestamp: Date.now(),
      }

      currentRoom.messages.push(msg)
      roomLastBotMessage[currentRoom.instanceId] = Date.now()
      totalArgumentsMade++
      supabaseRest('rpc/increment_arguments', 'POST').catch(() => {})

      const player = currentRoom.players[`bot_${botName}`]
      if (player) player.score += score

      io.to(currentRoom.instanceId).emit('new_message', msg)
      io.to(currentRoom.instanceId).emit('players_update', Object.values(currentRoom.players))

      setTimeout(sendBotMessage, randomWait)
    }

    sendBotMessage()
  }

  const initialDelay = Math.random() * 5 * 60 * 1000
  setTimeout(goOnline, initialDelay)
}

function startBots() {
  console.log('🤖 Starting 8 debate bots...')
  BOT_NAMES.forEach((name, i) => {
    setTimeout(() => runBot(name, BOT_PERSONALITIES[i]), i * 8000)
  })
}

// ─── Boot ──────────────────────────────────────────────────────
async function boot() {
  // Load last TOTD winner
const totdData = await supabaseRest('totd_winner?id=eq.1&select=username,won_at')
if (totdData?.[0]?.username) {
  lastTotdWinner = totdData[0].username
  console.log(`👑 Last Debate of the Day winner: ${lastTotdWinner}`)
}
  createTopicOfTheDay()
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
  setTimeout(startBots, 5000)
}

boot()
app.get('/health', (req, res) => res.json({
  status: 'ok',
  available: getAvailableCount(),
  ongoing: Object.values(rooms).filter(r => r.status === 'active').length,
  total: Object.keys(rooms).length,
}))
app.get('/stats', (req, res) => res.json({
  debatersOnline: io.engine.clientsCount + Object.values(rooms).reduce((acc, r) =>
    acc + Object.keys(r.players).filter(k => k.startsWith('bot_')).length, 0),
  liveDebates: Object.values(rooms).filter(r => r.status === 'active' && r.instanceId !== 'topic_of_the_day').length,
  argumentsMade: totalArgumentsMade,
  debatesCompleted: totalDebatesCompleted,
}))
app.get('/totd-winner', async (req, res) => {
  try {
    const data = await supabaseRest('totd_winner?id=eq.1&select=username,won_at')
    res.json({ winner: data?.[0]?.username || null, wonAt: data?.[0]?.won_at || null })
  } catch (e) {
    res.json({ winner: lastTotdWinner, wonAt: null })
  }
})