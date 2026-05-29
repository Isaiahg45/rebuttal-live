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

// ─── Constants ─────────────────────────────────────────────────
const TARGET_AVAILABLE = 4
const TARGET_VC_AVAILABLE = 3
const DISTRIBUTION = { casual: 0.25, serious: 0.45, competitive: 0.15, random: 0.15 }

// ─── Topic pools ───────────────────────────────────────────────
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

// VC-specific topics
const VC_TOPICS = [
  { topic: 'Is social media doing more harm than good to society?', emoji: '📱', duration: 240 },
  { topic: 'Should universal basic income replace the welfare state?', emoji: '💵', duration: 240 },
  { topic: 'Is capitalism the best economic system humanity has found?', emoji: '📈', duration: 240 },
  { topic: 'Should college education be free for everyone?', emoji: '🎓', duration: 240 },
  { topic: 'Is cancel culture a threat to free speech?', emoji: '🗣️', duration: 240 },
  { topic: 'Should billionaires be allowed to exist?', emoji: '💰', duration: 240 },
  { topic: 'Is AI going to be humanity\'s greatest achievement or biggest mistake?', emoji: '🤖', duration: 240 },
  { topic: 'Should voting be mandatory?', emoji: '🗳️', duration: 240 },
  { topic: 'Is religion a net positive or negative for society?', emoji: '⛪', duration: 240 },
  { topic: 'Should the US have stricter gun control laws?', emoji: '🔫', duration: 240 },
  { topic: 'Is the death penalty ever justified?', emoji: '⚖️', duration: 240 },
  { topic: 'Should drugs be fully legalized and regulated?', emoji: '💊', duration: 240 },
  { topic: 'Is remote work better than working in an office?', emoji: '🏠', duration: 240 },
  { topic: 'Should the voting age be lowered to 16?', emoji: '🗳️', duration: 240 },
  { topic: 'Is the American Dream still achievable in 2026?', emoji: '🌟', duration: 240 },
  { topic: 'Should tech companies be broken up to prevent monopolies?', emoji: '💻', duration: 240 },
  { topic: 'Is democracy the best form of government?', emoji: '🏛️', duration: 240 },
  { topic: 'Should there be a wealth tax on the ultra-rich?', emoji: '💸', duration: 240 },
  { topic: 'Is nuclear energy the solution to climate change?', emoji: '⚛️', duration: 240 },
  { topic: 'Should athletes be allowed to use performance-enhancing drugs?', emoji: '🏃', duration: 240 },
]

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

const topicPool = {
  casual: shuffle(PREWRITTEN.casual),
  serious: shuffle(PREWRITTEN.serious),
  competitive: shuffle(PREWRITTEN.competitive),
  random: shuffle(PREWRITTEN.random),
  vc: shuffle(VC_TOPICS),
}
const usedTopics = new Set()

function getTopicFromPool(type) {
  const pool = topicPool[type]
  if (!pool) return { topic: 'Is AI good or bad for society?', emoji: '🤖', duration: 240 }
  for (let i = 0; i < pool.length; i++) {
    if (!usedTopics.has(pool[i].topic)) {
      usedTopics.add(pool[i].topic)
      if (usedTopics.size > pool.length * 0.8) usedTopics.clear()
      return pool[i]
    }
  }
  topicPool[type] = shuffle(type === 'vc' ? VC_TOPICS : PREWRITTEN[type])
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
  if (type !== 'vc' && aiQueue[type] && aiQueue[type].length > 0 && Math.random() < 0.3) return aiQueue[type].shift()
  return getTopicFromPool(type)
}

// ─── Room management ───────────────────────────────────────────
const rooms = {}
const totdScores = {}
let roomCounter = 0
let pendingRoomCreations = 0
let totalArgumentsMade = 0
let totalDebatesCompleted = 0
const roomLastBotMessage = {}
let lastTotdWinner = null
let activeBotCount = 0
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
  Object.keys(totdScores).forEach(k => delete totdScores[k])
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

// ─── Room list builder ─────────────────────────────────────────
function getRoomList() {
  const allRooms = Object.values(rooms).filter(
    r => r.status !== 'ended' && r.instanceId !== 'topic_of_the_day'
  )

  const vcRooms = allRooms.filter(r => r.type === 'vc')
  const customRooms = allRooms.filter(r => r.isCustom)
  const textRooms = allRooms.filter(r => r.type !== 'vc' && !r.isCustom)

  const sortFn = (a, b) => {
    const order = { starting: 0, active: 1, waiting: 2 }
    return (order[a.status] || 2) - (order[b.status] || 2)
  }

  const activeText = textRooms.filter(r => r.status !== 'waiting').sort(sortFn)
  const waitingText = textRooms.filter(r => r.status === 'waiting').sort(sortFn).slice(0, 4)
  const activeVC = vcRooms.filter(r => r.status !== 'waiting').sort(sortFn)
  const waitingVC = vcRooms.filter(r => r.status === 'waiting').sort(sortFn).slice(0, TARGET_VC_AVAILABLE)
  const activeCustom = customRooms.filter(r => r.status !== 'waiting').sort(sortFn)
  const waitingCustom = customRooms.filter(r => r.status === 'waiting').sort(sortFn)

  const combined = [...activeText, ...activeVC, ...activeCustom, ...waitingText, ...waitingVC, ...waitingCustom]

  return combined.map(r => ({
    instanceId: r.instanceId,
    emoji: r.isPrivate ? '🔒' : r.emoji,
    topic: r.isPrivate ? '???' : r.topic,
    type: r.type,
    duration: r.isPrivate ? 0 : r.duration,
    maxPlayers: r.maxPlayers,
    eloRequired: r.eloRequired,
    playerCount: Object.keys(r.players).length,
    spectatorCount: Object.keys(r.spectators || {}).length,
    players: r.isPrivate ? [] : Object.values(r.players).map(p => p.username),
    status: r.status,
    countdown: r.countdown,
    startCountdown: r.startCountdown,
    timeLeft: r.debateEndsAt ? Math.max(0, Math.round((r.debateEndsAt - Date.now()) / 1000)) : null,
    isCustom: r.isCustom || false,
    isPrivate: r.isPrivate || false,
    createdBy: r.createdBy || null,
    eloStake: r.eloStake || 0,
    requiresPassword: !!(r.isPrivate && r.password),
    vcState: r.type === 'vc' && r.vcState ? {
      currentSpeakerUsername: r.vcState.currentSpeaker ? r.players[r.vcState.currentSpeaker]?.username : null,
      turnNumber: r.vcState.turnNumber,
      inCooldown: r.vcState.inCooldown,
    } : null,
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
    vc:          { min: 20,  max: 60  },
    custom:      { min: 10,  max: 30  },
  }
  const base = baseRanges[type] ?? { min: 8, max: 18 }
  const maxDuration = 480
  const durationMult = 0.7 + (Math.min(duration, maxDuration) / maxDuration) * 0.6
  const playerMult = 0.4 + (Math.min(playerCount, 15) / 15) * 1.1
  const scaledMin = Math.round(base.min * durationMult * playerMult)
  const scaledMax = Math.round(base.max * durationMult * playerMult)
  const winnerElo = randInt(scaledMin, scaledMax)
  const caps = { casual: 20, random: 25, serious: 90, competitive: 200, vc: 80, custom: 50 }
  const cappedWinner = Math.min(winnerElo, caps[type] ?? 35)
  const secondElo = Math.round(cappedWinner * randInt(35, 50) / 100)
  const thirdElo  = Math.round(cappedWinner * randInt(15, 25) / 100)
  const loserBase = Math.round(cappedWinner * 0.4)
  return { winnerElo: cappedWinner, secondElo, thirdElo, loserBase }
}

// ─── Text room creator ─────────────────────────────────────────
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
    status: 'waiting', countdown: 1200, startCountdown: null,
    createdAt: Date.now(),
  }
  console.log(`🏠 Created ${type} room (max ${maxPlayers}): "${topic.topic}"`)
  return id
}

// ─── VC room creator ───────────────────────────────────────────
function createVCRoom() {
  const topic = getTopicForType('vc')
  const id = `vc_${++roomCounter}_${Date.now()}`

  rooms[id] = {
    instanceId: id,
    type: 'vc',
    emoji: '🎙️',
    topic: topic.topic,
    duration: 4 * 60,
    eloRequired: 0,
    maxPlayers: 2,
    players: {},
    spectators: {},
    messages: [],
    status: 'waiting',
    countdown: 1200,
    startCountdown: null,
    createdAt: Date.now(),
    vcState: {
      currentSpeaker: null,
      turnNumber: 0,
      turnStartTime: null,
      turnDuration: 30,
      turnCooldown: 10,
      inCooldown: false,
      scores: {},
      paidToGoFirst: null,
      firstSpeakerLocked: false,
      transcripts: [],
    }
  }
  console.log(`🎙️ Created VC room: "${topic.topic}"`)
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

function scheduleVCRoom(immediate = false) {
  const delay = immediate ? 0 : 10000
  setTimeout(() => {
    createVCRoom()
    io.emit('rooms_update', getRoomList())
  }, delay)
}

function getAvailableCount() {
  return Object.values(rooms).filter(r => r.status === 'waiting' && r.type !== 'vc').length + pendingRoomCreations
}

function getVCWaitingCount() {
  return Object.values(rooms).filter(r => r.type === 'vc' && r.status === 'waiting').length
}

function replenishRooms(immediate = false) {
  const vcNeeded = TARGET_VC_AVAILABLE - getVCWaitingCount()
  for (let i = 0; i < vcNeeded; i++) {
    scheduleVCRoom(immediate)
  }

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
  // Debate of the Day reset
  const totd = rooms['topic_of_the_day']
  if (totd && Date.now() > totd.debateEndsAt && !totdResetting) {
    totdResetting = true
    const sorted = Object.values(totd.players).sort((a, b) => b.score - a.score)
    const winner = sorted[0]

    if (winner && winner.username && !winner.username.startsWith('guest')) {
      lastTotdWinner = winner.username
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

    // ─── VC room game loop ──────────────────────────────────────
    if (room.type === 'vc') {
      if (room.status === 'waiting') {
        room.countdown = Math.max(0, room.countdown - 1)

        if (playerCount >= 2 && room.countdown > 30) {
          room.countdown = 30
        }

        if (room.countdown <= 0) {
          if (playerCount < 2) {
            room.status = 'ended'
            io.to(room.instanceId).emit('vc_expired', { message: 'No opponent joined in time.' })
            console.log(`💨 VC Expired: "${room.topic}"`)
            const vcNeeded = TARGET_VC_AVAILABLE - getVCWaitingCount()
            for (let i = 0; i < Math.max(1, vcNeeded); i++) scheduleVCRoom()
          } else {
            room.status = 'starting'
            room.startCountdown = 10
            io.to(room.instanceId).emit('vc_starting', {
              startCountdown: 10,
              players: Object.values(room.players),
            })
          }
        }
      }

      if (room.status === 'starting') {
        room.startCountdown = Math.max(0, room.startCountdown - 1)
        io.to(room.instanceId).emit('vc_start_countdown_tick', { count: room.startCountdown })

        if (room.startCountdown <= 0) {
          room.status = 'active'
          room.debateEndsAt = Date.now() + room.duration * 1000

          const playerIds = Object.keys(room.players)
          const firstSpeakerId = room.vcState.paidToGoFirst || playerIds[0]
          room.vcState.currentSpeaker = firstSpeakerId
          room.vcState.firstSpeakerLocked = true
          room.vcState.turnStartTime = Date.now()
          room.vcState.turnNumber = 1

          io.to(room.instanceId).emit('vc_debate_started', {
            firstSpeakerSocketId: firstSpeakerId,
            firstSpeakerUsername: room.players[firstSpeakerId]?.username,
            duration: room.duration,
            turnDuration: room.vcState.turnDuration,
          })
          console.log(`🎙️ VC Started: "${room.topic}"`)
        }
      }

      if (room.status === 'active') {
        const timeLeft = Math.max(0, Math.round((room.debateEndsAt - Date.now()) / 1000))
        if (timeLeft <= 0) {
          room.status = 'ended'
          totalDebatesCompleted++
          supabaseRest('rpc/increment_debates', 'POST').catch(() => {})
          const sorted = Object.values(room.players).sort((a, b) => b.score - a.score)
          const eloChanges = calculateEloChanges('vc', sorted.length, room.duration)
          io.to(room.instanceId).emit('vc_debate_ended', {
            standings: sorted,
            transcripts: room.vcState.transcripts,
            eloChanges,
          })
          console.log(`🎙️ VC Ended: "${room.topic}" — winner: ${sorted[0]?.username}`)
          const vcNeeded = TARGET_VC_AVAILABLE - getVCWaitingCount()
          for (let i = 0; i < Math.max(1, vcNeeded); i++) scheduleVCRoom()
        }
      }
      return // skip text room logic
    }

    // ─── Text / Custom room game loop ───────────────────────────
    if (room.status === 'waiting') {
      room.countdown = Math.max(0, room.countdown - 1)

      if (playerCount >= room.maxPlayers) {
        room.status = 'starting'
        room.startCountdown = 5
        io.to(room.instanceId).emit('room_starting', { startCountdown: 5 })
        if (!room.isCustom) scheduleRoom(room.type)
        return
      }

      if (playerCount >= 2) {
        const targetCountdown = 30 + (playerCount - 2) * 10
        if (room.countdown > targetCountdown) {
          room.countdown = targetCountdown
          io.to(room.instanceId).emit('system_message', { text: `⚡ ${playerCount} players joined — starting in ${targetCountdown}s!` })
        }
      }

      if (room.countdown <= 0) {
        if (playerCount < 2) {
          room.status = 'ended'
          io.to(room.instanceId).emit('room_expired', { message: 'Not enough players joined. Room expired.' })
          console.log(`💨 Expired: "${room.topic}" (${playerCount} players)`)
          if (!room.isCustom) scheduleRoom(room.type)
        } else {
          room.status = 'starting'
          room.startCountdown = 5
          io.to(room.instanceId).emit('room_starting', { startCountdown: 5 })
          if (!room.isCustom) scheduleRoom(room.type)
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
      // End immediately if room is completely empty
      // But skip custom waiting rooms — they stay open until someone joins
      if (playerCount === 0 && !room.isCustom) {
        room.status = 'ended'
        console.log(`🏁 Active room auto-expired (empty): "${room.topic}"`)
        return
      }
      if (playerCount === 0 && room.isCustom) {
        room.status = 'ended'
        console.log(`⚔️ Custom active room auto-expired (empty): "${room.topic}"`)
        return
      }
      const timeLeft = Math.max(0, Math.round((room.debateEndsAt - Date.now()) / 1000))
      if (timeLeft <= 0) {
        room.status = 'ended'
        totalDebatesCompleted++
        supabaseRest('rpc/increment_debates', 'POST').catch(() => {})
        const sorted = Object.values(room.players).sort((a, b) => b.score - a.score)

        // Custom rooms: server applies ELO directly to Supabase
        if (room.isCustom && room.eloStake) {
          const stake = room.eloStake
          const eloChanges = { winnerElo: stake, secondElo: 0, thirdElo: 0, loserBase: stake }

          // Apply ELO server-side for each player
          for (let i = 0; i < sorted.length; i++) {
            const player = sorted[i]
            if (!player.username || player.username.startsWith('guest')) continue
            const delta = i === 0 ? stake : -stake
            const currentElo = player.elo ?? 0
            const newElo = Math.max(0, currentElo + delta)
            const isWinner = i === 0
            supabaseRest(
              `profiles?username=eq.${encodeURIComponent(player.username)}`,
              'GET'
            ).then(data => {
              if (!data?.[0]) return
              supabaseRest(
                `profiles?username=eq.${encodeURIComponent(player.username)}`,
                'PATCH',
                {
                  elo: Math.max(0, (data[0].elo ?? 0) + delta),
                  wins: isWinner ? (data[0].wins ?? 0) + 1 : (data[0].wins ?? 0),
                  debates: (data[0].debates ?? 0) + 1,
                }
              ).catch(() => {})
            }).catch(() => {})
          }

          io.to(room.instanceId).emit('debate_ended', {
            standings: sorted,
            eloChanges,
            type: room.type,
            customStake: stake,
            serverHandledElo: true, // tell client not to recalculate
          })
          console.log(`🏁 Custom ended: "${room.topic}" — winner +${stake}, loser -${stake} ELO`)
        } else {
          const eloChanges = calculateEloChanges(room.type, sorted.length, room.duration)
          io.to(room.instanceId).emit('debate_ended', {
            standings: sorted,
            eloChanges,
            type: room.type,
          })
          console.log(`🏁 Ended: "${room.topic}" — ${sorted.length} players, winner +${eloChanges.winnerElo} ELO`)
        }
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

// ─── Redundancy check ──────────────────────────────────────────
// Returns similarity 0-1 between two strings using word overlap (Jaccard)
function jaccardSimilarity(a, b) {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  if (setA.size === 0 || setB.size === 0) return 0
  const intersection = new Set([...setA].filter(w => setB.has(w)))
  const union = new Set([...setA, ...setB])
  return intersection.size / union.size
}

function checkRedundancy(text, priorMessages) {
  if (!priorMessages || priorMessages.length === 0) return { isRedundant: false, similarity: 0 }
  // Check against last 5 messages from this player
  let maxSimilarity = 0
  for (const prior of priorMessages.slice(-5)) {
    const sim = jaccardSimilarity(text, prior)
    if (sim > maxSimilarity) maxSimilarity = sim
  }
  // 0.65+ = very redundant, 0.45+ = somewhat redundant
  return { isRedundant: maxSimilarity >= 0.65, similarity: maxSimilarity }
}

// ─── Argument scoring ──────────────────────────────────────────
// priorMessages: array of strings (this player's previous argument texts in this room)
async function scoreArgument(text, topic, roomType, priorMessages = []) {
  const hardSlurs = /\b(nigger|nigga|faggot|chink|spic|kike|wetback|tranny)\b/i.test(text)
  if (hardSlurs) return { score: -10, feedback: 'Slur detected. Hard penalty applied.' }
  if (text.trim().length < 15) return { score: 0, feedback: 'Too brief to evaluate.' }

  // Fast local redundancy check before hitting the API
  const { isRedundant, similarity } = checkRedundancy(text, priorMessages)
  if (isRedundant) {
    const score = similarity >= 0.85 ? 0 : 1
    return {
      score,
      feedback: score === 0
        ? 'Exact repeat of a previous argument. Zero points.'
        : 'Nearly identical to a previous argument — add something new.',
      redundant: true,
    }
  }

  try {
    const priorContext = priorMessages.slice(-3).join(' | ')
    const result = await Promise.race([
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 120,
        messages: [{
          role: 'system',
          content: `You are a debate judge. Topic: "${topic}" (${roomType}).
Score 0-30: logic/clarity (0-8), evidence (0-8), depth (0-7), vocabulary (0-7).
Casual profanity is fine if argument is strong. Hard slurs = penalty.
3-word = 0-2, mediocre = 3-8, decent = 9-15, good = 16-22, excellent = 23-27, exceptional = 28-30.

REDUNDANCY RULE: If this argument is saying the same thing as the player's prior arguments without adding anything new, score it 0-2 regardless of quality. Prior arguments from this player: "${priorContext || 'none yet'}"

Return ONLY JSON: {"score": number, "feedback": "one short sentence", "redundant": boolean}`
        }, { role: 'user', content: text }]
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
    ])
    const parsed = JSON.parse(result.choices[0].message.content.trim())
    const score = Math.max(0, Math.min(30, Math.round(parsed.score)))
    return { score, feedback: parsed.feedback || '', redundant: parsed.redundant || false }
  } catch (e) {
    console.log('Scoring fallback:', e.message)
    return fallbackScore(text)
  }
}

function fallbackScore(text) {
  const wordCount = text.trim().split(/\s+/).length
  let score = wordCount < 5 ? 1 : wordCount < 15 ? Math.floor(Math.random() * 4) + 3
    : wordCount < 30 ? Math.floor(Math.random() * 6) + 7
    : wordCount < 60 ? Math.floor(Math.random() * 7) + 12
    : Math.floor(Math.random() * 8) + 18
  if (/\b(study|research|statistics|data|evidence|example|proves|according|percent)\b/i.test(text)) score = Math.min(30, score + 3)
  const fallbackFeedbacks = [
    'Keep developing your argument.',
    'Try adding more evidence.',
    'Good start, go deeper.',
    'Make your point more specific.',
    'Build on this with an example.',
  ]
  return {
    score: Math.min(30, score),
    feedback: fallbackFeedbacks[Math.floor(Math.random() * fallbackFeedbacks.length)]
  }
}

// ─── Socket events ─────────────────────────────────────────────
io.on('connection', (socket) => {
  let currentRoomId = null
  let currentUsername = null
  let isSpectator = false

  socket.emit('rooms_update', getRoomList())

  // ── Join text room ────────────────────────────────────────────
  socket.on('join_room', ({ instanceId, username, elo = 0, password: joinPassword }) => {
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

    // Password check for private rooms
    if (room.isPrivate && room.password) {
      if (!joinPassword || joinPassword !== room.password) {
        socket.emit('error', { message: 'Wrong password.' })
        return
      }
    }

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

  // ── Create custom room ────────────────────────────────────────
  socket.on('create_custom_room', ({ username, topic, duration, eloStake, isPrivate, password, debateType }) => {
    if (!username) { socket.emit('error', { message: 'Must be logged in.' }); return }
    if (!topic || topic.trim().length < 10) { socket.emit('error', { message: 'Topic must be at least 10 characters.' }); return }
    if (isPrivate && !password) { socket.emit('error', { message: 'Private rooms need a password.' }); return }

    const isVC = debateType === 'vc'
    const id = isVC
      ? `vc_custom_${++roomCounter}_${Date.now()}`
      : `custom_${++roomCounter}_${Date.now()}`

    const baseRoom = {
      instanceId: id,
      emoji: isPrivate ? '🔒' : '⚔️',
      topic: topic.trim(),
      duration: duration || (isVC ? 240 : 300),
      eloRequired: 0,
      eloStake: eloStake || 25,
      maxPlayers: 2,
      players: {},
      spectators: {},
      messages: [],
      status: 'waiting',
      countdown: 1800,
      startCountdown: null,
      createdAt: Date.now(),
      isCustom: true,
      isPrivate: isPrivate || false,
      password: isPrivate ? password : null,
      createdBy: username,
    }

    if (isVC) {
      rooms[id] = {
        ...baseRoom,
        type: 'vc',
        vcState: {
          currentSpeaker: null, turnNumber: 0, turnStartTime: null,
          turnDuration: 30, turnCooldown: 10, inCooldown: false,
          scores: {}, paidToGoFirst: null, firstSpeakerLocked: false, transcripts: [],
        }
      }
    } else {
      rooms[id] = { ...baseRoom, type: 'custom' }
    }

    console.log(`⚔️ Custom room by ${username}: "${topic.trim()}" (${isPrivate ? 'private' : 'public'}, ${isVC ? 'vc' : 'text'})`)

    // Auto-join the creator
    currentRoomId = id
    currentUsername = username
    isSpectator = false
    socket.join(id)
    rooms[id].players[socket.id] = { username, score: 0, elo: 0 }
    if (isVC) rooms[id].vcState.scores[socket.id] = 0

    socket.emit('custom_room_created', { instanceId: id, type: isVC ? 'vc' : 'text' })
    io.emit('rooms_update', getRoomList())
  })

  // ── Spectate text room ────────────────────────────────────────
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

  // ── Join topic of day ─────────────────────────────────────────
  socket.on('join_topic_of_day', ({ username }) => {
    const room = rooms['topic_of_the_day']
    if (!room) { socket.emit('error', { message: 'Debate of the Day not available.' }); return }

    currentRoomId = 'topic_of_the_day'
    currentUsername = username
    isSpectator = false
    socket.join('topic_of_the_day')
    if (!(username in totdScores)) totdScores[username] = 0
    Object.keys(room.players).forEach(key => {
      if (room.players[key].username === username) delete room.players[key]
    })
    room.players[socket.id] = { username, score: totdScores[username], elo: 0 }
    const timeLeft = Math.max(0, Math.round((room.debateEndsAt - Date.now()) / 1000))

    socket.emit('message_history', room.messages)
    socket.emit('room_info', {
      instanceId: 'topic_of_the_day', topic: room.topic, emoji: room.emoji,
      type: 'topic_of_the_day', duration: room.duration, status: 'active',
      isSpectator: false, timeLeft,
    })
    socket.emit('totd_info', { topic: room.topic, emoji: room.emoji, timeLeft })
    const leaderboard = Object.entries(totdScores)
      .map(([username, score]) => ({ username, score, elo: 0 }))
      .sort((a, b) => b.score - a.score)
    io.to('topic_of_the_day').emit('players_update', leaderboard)
    io.to('topic_of_the_day').emit('system_message', { text: `${username} joined` })
    console.log(`💬 ${username} joined Debate of the Day — "${room.topic}"`)
  })

  // ── Send text message ─────────────────────────────────────────
  socket.on('send_message', async ({ instanceId, username, text }) => {
    const room = rooms[instanceId]
    if (!room) return
    if (instanceId !== 'topic_of_the_day' && room.status !== 'active') return
    if (isSpectator) return

    totalArgumentsMade++
    supabaseRest('rpc/increment_arguments', 'POST').catch(() => {})

    // Collect this player's prior arguments for redundancy checking
    const priorMessages = room.messages
      .filter(m => m.username === username)
      .map(m => m.text)

    const { score, feedback } = await scoreArgument(text, room.topic, room.type, priorMessages)
    const msg = {
      id: `${Date.now()}-${Math.random()}`,
      username, text, score, aiFeedback: feedback,
      timestamp: Date.now(),
    }
    room.messages.push(msg)
    const player = room.players[socket.id]
    if (player) {
      player.score += score
      if (instanceId === 'topic_of_the_day') totdScores[player.username] = player.score
    }
    if (score >= 20 && !username.startsWith('guest')) {
      supabaseRest('top_arguments', 'POST', {
        username, text, score,
        ai_feedback: feedback,
        topic: room.topic,
        room_type: room.type,
      }).catch(() => {})
    }

    io.to(instanceId).emit('new_message', msg)
io.emit('room_message', { instanceId, username: msg.username, text: msg.text })
    if (instanceId === 'topic_of_the_day') {
      const leaderboard = Object.entries(totdScores)
        .map(([username, score]) => ({ username, score, elo: 0 }))
        .sort((a, b) => b.score - a.score)
      io.to(instanceId).emit('players_update', leaderboard)
    } else {
      io.to(instanceId).emit('players_update', Object.values(room.players))
    }
  })

  // ── Join VC room ──────────────────────────────────────────────
  socket.on('join_vc_room', ({ instanceId, username, elo = 0 }) => {
    const alreadyInRoom = Object.values(rooms).some(r =>
      r.instanceId !== 'topic_of_the_day' &&
      r.status !== 'ended' &&
      Object.values(r.players).some(p => p.username === username)
    )
    if (alreadyInRoom) {
      socket.emit('error', { message: 'You are already in a debate in another tab.' })
      return
    }
    const room = rooms[instanceId]
    if (!room || room.type !== 'vc') { socket.emit('error', { message: 'VC room not found.' }); return }
    if (room.status === 'ended') { socket.emit('error', { message: 'This room has ended.' }); return }
    if (Object.keys(room.players).length >= 2) { socket.emit('error', { message: 'VC room is full — only 2 debaters allowed.' }); return }

    // Password check for private VC rooms
    if (room.isPrivate && room.password) {
      const joinPassword = arguments[0]?.password
      if (!joinPassword || joinPassword !== room.password) {
        socket.emit('error', { message: 'Wrong password.' })
        return
      }
    }

    currentRoomId = instanceId
    currentUsername = username
    isSpectator = false
    socket.join(instanceId)
    room.players[socket.id] = { username, score: 0, elo }
    room.vcState.scores[socket.id] = 0

    socket.emit('message_history', room.messages)
    socket.emit('vc_room_info', {
      instanceId: room.instanceId,
      topic: room.topic,
      emoji: room.emoji,
      duration: room.duration,
      status: room.status,
      countdown: room.countdown,
      eloRequired: room.eloRequired,
      players: Object.values(room.players),
    })

    io.to(instanceId).emit('vc_players_update', Object.values(room.players))
    io.to(instanceId).emit('vc_system_message', { text: `${username} joined` })
    io.emit('rooms_update', getRoomList())

    if (Object.keys(room.players).length === 2) {
      room.status = 'starting'
      room.startCountdown = 10
      io.to(instanceId).emit('vc_starting', {
        startCountdown: 10,
        players: Object.values(room.players),
      })
      scheduleVCRoom()

      const allIds = Object.keys(room.players)
      const firstPlayerId = allIds.find(sid => sid !== socket.id)
      if (firstPlayerId) {
        io.to(firstPlayerId).emit('vc_initiate_webrtc', { instanceId })
      }
    }

    console.log(`🎙️ ${username} joined VC room "${room.topic}"`)
  })

  // ── VC pay to go first ────────────────────────────────────────
  socket.on('vc_pay_to_go_first', ({ instanceId }) => {
    const room = rooms[instanceId]
    if (!room || room.type !== 'vc') return
    if (room.vcState.firstSpeakerLocked) {
      socket.emit('vc_error', { message: 'First speaker already locked.' })
      return
    }
    room.vcState.paidToGoFirst = socket.id
    const username = room.players[socket.id]?.username
    io.to(instanceId).emit('vc_go_first_update', {
      paidUsername: username,
      paidSocketId: socket.id,
    })
    io.to(instanceId).emit('vc_system_message', { text: `${username} chose to go first` })
  })

  // ── VC override go first ──────────────────────────────────────
  socket.on('vc_override_go_first', ({ instanceId }) => {
    const room = rooms[instanceId]
    if (!room || room.type !== 'vc') return
    const prevPayer = room.players[room.vcState.paidToGoFirst]?.username
    room.vcState.paidToGoFirst = socket.id
    const username = room.players[socket.id]?.username
    io.to(instanceId).emit('vc_go_first_update', {
      paidUsername: username,
      paidSocketId: socket.id,
    })
    io.to(instanceId).emit('vc_system_message', { text: `${username} overrode ${prevPayer} — going first` })
  })

  // ── VC turn complete ──────────────────────────────────────────
  socket.on('vc_turn_complete', async ({ instanceId, transcript }) => {
    const room = rooms[instanceId]
    if (!room || room.type !== 'vc') return
    if (room.vcState.currentSpeaker !== socket.id) return

    const username = room.players[socket.id]?.username
    if (!username) return

    // Collect this player's prior VC transcripts for redundancy checking
    const priorVC = room.vcState.transcripts
      .filter(t => t.username === username)
      .map(t => t.text)

    const { score, feedback } = await scoreArgument(
      transcript || '[no speech detected]',
      room.topic,
      'vc',
      priorVC
    )

    room.vcState.scores[socket.id] = (room.vcState.scores[socket.id] || 0) + score
    room.players[socket.id].score = room.vcState.scores[socket.id]

    const entry = {
      id: `${Date.now()}-${Math.random()}`,
      username,
      text: transcript || '[no speech detected]',
      score,
      aiFeedback: feedback,
      timestamp: Date.now(),
      turnNumber: room.vcState.turnNumber,
    }
    room.vcState.transcripts.push(entry)
    room.messages.push(entry)

    const scoresMap = {}
    Object.entries(room.vcState.scores).forEach(([sid, s]) => {
      const p = room.players[sid]
      if (p) scoresMap[p.username] = s
    })

    io.to(instanceId).emit('vc_turn_scored', { entry, scores: scoresMap })

    room.vcState.inCooldown = true
    room.vcState.currentSpeaker = null
    io.to(instanceId).emit('vc_cooldown_start', { duration: room.vcState.turnCooldown })

    setTimeout(() => {
      if (!rooms[instanceId] || rooms[instanceId].status === 'ended') return
      room.vcState.inCooldown = false

      const otherSocketId = Object.keys(room.players).find(sid => sid !== socket.id)
      if (!otherSocketId) return

      room.vcState.currentSpeaker = otherSocketId
      room.vcState.turnNumber++
      room.vcState.turnStartTime = Date.now()

      io.to(instanceId).emit('vc_turn_start', {
        speakerSocketId: otherSocketId,
        speakerUsername: room.players[otherSocketId]?.username,
        turnNumber: room.vcState.turnNumber,
        turnDuration: room.vcState.turnDuration,
      })
      io.emit('rooms_update', getRoomList())
    }, room.vcState.turnCooldown * 1000)
  })

  // ── WebRTC signaling ──────────────────────────────────────────
  socket.on('vc_offer', ({ instanceId, offer }) => {
    socket.to(instanceId).emit('vc_offer', { offer })
  })
  socket.on('vc_answer', ({ instanceId, answer }) => {
    socket.to(instanceId).emit('vc_answer', { answer })
  })
  socket.on('vc_ice_candidate', ({ instanceId, candidate }) => {
    socket.to(instanceId).emit('vc_ice_candidate', { candidate })
  })

  // ── Disconnect ────────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return
    const room = rooms[currentRoomId]

    if (isSpectator) {
      delete room.spectators[socket.id]
      io.emit('rooms_update', getRoomList())
      return
    }

    const remainingCount = Object.keys(room.players).length - 1 // after this player leaves

    // ── VC disconnect: opponent wins automatically if active ──────
    if (room.type === 'vc' && room.status === 'active') {
      const otherSocketId = Object.keys(room.players).find(sid => sid !== socket.id)
      if (otherSocketId && room.players[otherSocketId]) {
        const winner = room.players[otherSocketId]
        const loser = room.players[socket.id]
        room.status = 'ended'
        const eloChanges = calculateEloChanges('vc', 2, room.duration)
        io.to(currentRoomId).emit('vc_debate_ended', {
          standings: [winner, loser].filter(Boolean),
          transcripts: room.vcState.transcripts,
          eloChanges,
          forfeit: true,
          forfeitUsername: currentUsername,
        })
        console.log(`🎙️ VC forfeit: ${currentUsername} left — ${winner.username} wins`)
        const vcNeeded = TARGET_VC_AVAILABLE - getVCWaitingCount()
        for (let i = 0; i < Math.max(1, vcNeeded); i++) scheduleVCRoom()
      } else {
        // No opponent — just expire the room
        room.status = 'ended'
        io.to(currentRoomId).emit('vc_expired', { message: 'Your opponent left. Room closed.' })
        const vcNeeded = TARGET_VC_AVAILABLE - getVCWaitingCount()
        for (let i = 0; i < Math.max(1, vcNeeded); i++) scheduleVCRoom()
      }
      delete room.players[socket.id]
      io.emit('rooms_update', getRoomList())
      return
    }

    // ── Custom room disconnect ────────────────────────────────────
    if (room.isCustom) {
      if (room.status === 'active') {
        const otherSocketId = Object.keys(room.players).find(sid => sid !== socket.id)
        if (otherSocketId && room.players[otherSocketId]) {
          const winner = room.players[otherSocketId]
          const loser = room.players[socket.id]
          room.status = 'ended'
          const stake = room.eloStake || 25
          const eloChanges = { winnerElo: stake, secondElo: 0, thirdElo: 0, loserBase: stake }

          // Apply ELO server-side directly
          for (const [p, delta] of [[winner, stake], [loser, -stake]]) {
            if (!p.username || p.username.startsWith('guest')) continue
            supabaseRest(`profiles?username=eq.${encodeURIComponent(p.username)}`, 'GET')
              .then(data => {
                if (!data?.[0]) return
                supabaseRest(
                  `profiles?username=eq.${encodeURIComponent(p.username)}`,
                  'PATCH',
                  {
                    elo: Math.max(0, (data[0].elo ?? 0) + delta),
                    wins: delta > 0 ? (data[0].wins ?? 0) + 1 : (data[0].wins ?? 0),
                    debates: (data[0].debates ?? 0) + 1,
                  }
                ).catch(() => {})
              }).catch(() => {})
          }

          io.to(currentRoomId).emit('debate_ended', {
            standings: [winner, loser].filter(Boolean),
            eloChanges,
            type: room.type,
            forfeit: true,
            forfeitUsername: currentUsername,
            customStake: stake,
            serverHandledElo: true,
          })
          console.log(`⚔️ Custom forfeit: ${currentUsername} left — ${winner.username} wins ±${stake} ELO`)
        } else {
          // Last player left during active game — expire
          room.status = 'ended'
          io.to(currentRoomId).emit('room_expired', { message: 'All players left. Room closed.' })
          console.log(`⚔️ Custom room empty during active: "${room.topic}" — expired`)
        }
      }
      // During waiting/starting: just remove the player, keep room open
      // Room will auto-expire via the countdown in the game loop if nobody joins
      delete room.players[socket.id]
      if (currentUsername) {
        io.to(currentRoomId).emit('system_message', { text: `${currentUsername} left` })
      }
      io.to(currentRoomId).emit('players_update', Object.values(room.players))
      io.emit('rooms_update', getRoomList())
      return
    }

    // ── Standard text room disconnect ─────────────────────────────
    if (room.status === 'active') {
      const playersAfter = remainingCount
      if (playersAfter === 0) {
        // Last player left — end the room silently
        room.status = 'ended'
        console.log(`🏁 Room empty after disconnect: "${room.topic}"`)
      } else if (playersAfter === 1) {
        // Only 1 player left in a 2-player room — end with forfeit
        const sorted = Object.values(room.players)
          .filter((p) => p.username !== currentUsername)
          .sort((a, b) => b.score - a.score)
        if (sorted.length > 0 && Object.keys(room.players).length <= 2) {
          room.status = 'ended'
          const allPlayers = Object.values(room.players).sort((a, b) => b.score - a.score)

          if (room.isCustom && room.eloStake) {
            const stake = room.eloStake
            const eloChanges = { winnerElo: stake, secondElo: 0, thirdElo: 0, loserBase: stake }
            // Apply ELO server-side
            for (const [p, delta] of [[allPlayers[0], stake], [allPlayers[1], -stake]]) {
              if (!p || !p.username || p.username.startsWith('guest')) continue
              supabaseRest(`profiles?username=eq.${encodeURIComponent(p.username)}`, 'GET')
                .then(data => {
                  if (!data?.[0]) return
                  supabaseRest(
                    `profiles?username=eq.${encodeURIComponent(p.username)}`,
                    'PATCH',
                    {
                      elo: Math.max(0, (data[0].elo ?? 0) + delta),
                      wins: delta > 0 ? (data[0].wins ?? 0) + 1 : (data[0].wins ?? 0),
                      debates: (data[0].debates ?? 0) + 1,
                    }
                  ).catch(() => {})
                }).catch(() => {})
            }
            io.to(currentRoomId).emit('debate_ended', {
              standings: allPlayers,
              eloChanges,
              type: room.type,
              forfeit: true,
              forfeitUsername: currentUsername,
              customStake: stake,
              serverHandledElo: true,
            })
          } else {
            const eloChanges = calculateEloChanges(room.type, 2, room.duration)
            io.to(currentRoomId).emit('debate_ended', {
              standings: allPlayers,
              eloChanges,
              type: room.type,
              forfeit: true,
              forfeitUsername: currentUsername,
            })
          }
          console.log(`🏁 2-player forfeit: ${currentUsername} left — ${sorted[0].username} wins`)
        }
        // 3+ player rooms: debate continues, leaver just loses ELO (handled client-side via standings)
      }
    } else if ((room.status === 'waiting' || room.status === 'starting') && remainingCount === 0) {
      // Room empty during countdown — expire it
      room.status = 'ended'
      io.to(currentRoomId).emit('room_expired', { message: 'Game expired: less than 2 debaters in server.' })
      console.log(`💨 Room expired (all left during countdown): "${room.topic}"`)
    }

    delete room.players[socket.id]

    if (currentUsername && currentRoomId !== 'topic_of_the_day') {
      io.to(currentRoomId).emit('system_message', { text: `${currentUsername} left` })
    }

    if (currentRoomId === 'topic_of_the_day') {
      const leaderboard = Object.entries(totdScores)
        .map(([username, score]) => ({ username, score, elo: 0 }))
        .sort((a, b) => b.score - a.score)
      io.to('topic_of_the_day').emit('players_update', leaderboard)
    } else {
      io.to(currentRoomId).emit('players_update', Object.values(room.players))
    }

    io.emit('rooms_update', getRoomList())
  })
})

// ─── Bots ──────────────────────────────────────────────────────
const BOT_NAMES = Array.from({ length: 18
 }, () =>
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
          content: recentMessages.length === 0
            ? 'State your opening position on this topic in one casual sentence. Do NOT reference anyone else or say "I agree/disagree". Just state your own take.'
            : `Recent:\n${context}\n\nYour response:`
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
    r.type !== 'vc' &&
    r.type !== 'custom' &&
    r.status === 'waiting' &&
    Object.keys(r.players).length < r.maxPlayers
  )
  if (available.length === 0) return null
  return available[Math.floor(Math.random() * available.length)]
}

async function runBot(botName, personality) {
  const state = { roomId: null, active: true }

  async function goOnline() {
  const onlineDuration = (10 + Math.random() * 10) * 60 * 1000
  console.log(`🤖 Bot ${botName} online for ${Math.round(onlineDuration / 60000)} mins`)
  state.active = true
  activeBotCount++
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
    activeBotCount--
    state.active = false
    const offlineDuration = (2 + Math.random() * 9) * 60 * 1000
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
      const minWait = 100000
      const maxWait = 170000
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
io.emit('room_message', { instanceId: currentRoom.instanceId, username: botName, text: botText })

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
  console.log(`✅ Server booting with ${TARGET_AVAILABLE} text rooms + 1 VC room`)
  setTimeout(refillAIQueue, 2000)
  setInterval(refillAIQueue, 5 * 60 * 1000)
  setInterval(() => console.log('💓 keepalive'), 4 * 60 * 1000)
  setTimeout(startBots, 5000)
}

// ─── Routes ────────────────────────────────────────────────────
app.get('/top-arguments', async (req, res) => {
  try {
    const data = await supabaseRest('top_arguments?select=*&order=score.desc&limit=3')
    res.json(data || [])
  } catch (e) { res.json([]) }
})

app.get('/health', (req, res) => res.json({
  status: 'ok',
  available: getAvailableCount(),
  vcWaiting: getVCWaitingCount(),
  ongoing: Object.values(rooms).filter(r => r.status === 'active').length,
  total: Object.keys(rooms).length,
}))

app.get('/stats', (req, res) => res.json({
  debatersOnline: io.engine.clientsCount + activeBotCount,
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

boot()
httpServer.listen(3001, () => console.log('🚀 Socket server running on port 3001'))