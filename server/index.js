require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const OpenAI = require('openai')
const { RtcTokenBuilder, RtcRole } = require('agora-token')

const app = express()
app.use(cors())

const rateLimit = require('express-rate-limit')
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests, slow down.',
  standardHeaders: true,
  legacyHeaders: false,
}))
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
const TARGET_VC_AVAILABLE = 2
const DISTRIBUTION = { casual: 0.25, serious: 0.45, competitive: 0.15, random: 0.15 }

// ─── Topic pools ───────────────────────────────────────────────
const PREWRITTEN = {
  casual: [
    { topic: 'Attractive people have an unfair advantage in life and society should acknowledge it.', emoji: '😍', duration: 120 },
    { topic: 'Being fat is a personal choice and society should stop treating it as a medical condition.', emoji: '⚖️', duration: 120 },
    { topic: 'Men are emotionally weaker than women and society coddles them for it.', emoji: '💪', duration: 120 },
    { topic: 'Cheating in a relationship is sometimes justified and people are too black and white about it.', emoji: '💔', duration: 120 },
    { topic: 'Women who dress provocatively are partially responsible for the attention they receive.', emoji: '👗', duration: 120 },
    { topic: 'Short men are at a permanent disadvantage in dating and no one wants to admit it.', emoji: '📏', duration: 120 },
    { topic: 'Gold diggers are just playing the game smarter than everyone else.', emoji: '💰', duration: 120 },
    { topic: 'Social media has made an entire generation mentally ill and the parents are to blame.', emoji: '📱', duration: 120 },
    { topic: 'People who don\'t want children are selfish and contributing to societal decline.', emoji: '👶', duration: 120 },
    { topic: 'Women have it significantly easier than men in modern society.', emoji: '♀️', duration: 120 },
    { topic: 'Men have it significantly easier than women in modern society.', emoji: '♂️', duration: 120 },
    { topic: 'OnlyFans has destroyed an entire generation\'s ability to have real relationships.', emoji: '💸', duration: 120 },
    { topic: 'People who stay in toxic relationships deserve what they get.', emoji: '🚩', duration: 120 },
    { topic: 'Cancel culture is just digital mob rule and it\'s ruining innocent people\'s lives.', emoji: '❌', duration: 120 },
    { topic: 'Most people who claim to be depressed are just lazy and seeking attention.', emoji: '🧠', duration: 120 },
    { topic: 'Rich people who don\'t work hard for their money don\'t deserve respect.', emoji: '💎', duration: 120 },
    { topic: 'Prenuptial agreements should be mandatory before every marriage.', emoji: '📝', duration: 120 },
    { topic: 'It\'s okay to judge people based on their body count.', emoji: '🔢', duration: 120 },
    { topic: 'People who can\'t cook are a burden in relationships.', emoji: '🍳', duration: 120 },
    { topic: 'Tipping culture has gone too far and it\'s time to end it completely.', emoji: '🍽️', duration: 120 },
    { topic: 'Andrew Tate has done more for men\'s mental health than any therapist.', emoji: '🥊', duration: 120 },
    { topic: 'Modern feminism has made women unhappier, not more fulfilled.', emoji: '✊', duration: 120 },
    { topic: 'People who are ugly are treated worse in life and no one wants to say it out loud.', emoji: '🪞', duration: 120 },
    { topic: 'Keeping score in relationships is actually healthy and mature.', emoji: '🏆', duration: 120 },
    { topic: 'Most people who claim to have ADHD are just addicted to their phone.', emoji: '🙄', duration: 120 },
    { topic: 'Influencers are doing more damage to society than any drug.', emoji: '📸', duration: 120 },
    { topic: 'People who ghost deserve to be ghosted back, no exceptions.', emoji: '👻', duration: 120 },
    { topic: 'Birth order determines your personality more than your upbringing.', emoji: '👨‍👩‍👧‍👦', duration: 120 },
    { topic: 'Trophy wives are a valid life choice and women who shame them are jealous.', emoji: '💍', duration: 120 },
    { topic: 'Men who pay for everything on dates are setting a trap for themselves.', emoji: '💳', duration: 120 },
    { topic: 'Your partner\'s past is absolutely your business before committing to them.', emoji: '🔍', duration: 120 },
    { topic: 'People who overshare their mental health struggles online are attention-seeking.', emoji: '😢', duration: 120 },
    { topic: 'Women who date much older men have daddy issues, not preferences.', emoji: '👴', duration: 120 },
    { topic: 'Men who refuse to pay on the first date are disrespectful, not progressive.', emoji: '🧾', duration: 120 },
    { topic: 'Therapy has become an excuse for people to never take responsibility for anything.', emoji: '🛋️', duration: 120 },
    { topic: 'Hook-up culture has ruined modern men and women\'s ability to form real bonds.', emoji: '🎭', duration: 120 },
    { topic: 'People in relationships should never have friends of the opposite sex.', emoji: '🚫', duration: 120 },
    { topic: 'Staying with someone after they cheat makes you a pushover.', emoji: '🐣', duration: 120 },
    { topic: 'Most people who go vegan do it for attention, not the animals.', emoji: '🥦', duration: 120 },
    { topic: 'Humble bragging is worse than regular bragging.', emoji: '🤦', duration: 120 },
    { topic: 'People who post their workouts online are deeply insecure.', emoji: '🏋️', duration: 120 },
    { topic: 'Having expensive taste when you\'re broke is a character flaw.', emoji: '💅', duration: 120 },
    { topic: 'People who need constant validation from their partners are exhausting.', emoji: '🙋', duration: 120 },
    { topic: 'Astrology is a cope for people who refuse to take responsibility for their choices.', emoji: '♈', duration: 120 },
    { topic: 'The friend zone is created by men who lack the courage to be direct.', emoji: '😔', duration: 120 },
    { topic: 'Marrying your first love is almost always a mistake.', emoji: '💒', duration: 120 },
    { topic: 'People who don\'t drink are usually the least fun at parties.', emoji: '🍺', duration: 120 },
    { topic: 'Tattoos permanently lower your professional and dating market value.', emoji: '🖋️', duration: 120 },
    { topic: 'People who can\'t handle alone time are emotionally immature.', emoji: '🪟', duration: 120 },
    { topic: 'Long distance relationships almost never work and people are lying to themselves.', emoji: '✈️', duration: 120 },
    { topic: 'Women who change their last name when they marry are setting feminism back.', emoji: '📋', duration: 120 },
    { topic: 'Men who stay home while their wife works are leeches on their relationships.', emoji: '🏠', duration: 120 },
    { topic: 'Staying friends with your ex is a red flag for your new partner.', emoji: '🚩', duration: 120 },
    { topic: 'People who can\'t take a joke are the problem, not the person telling it.', emoji: '😂', duration: 120 },
    { topic: 'Helicopter parenting is child abuse in slow motion.', emoji: '🚁', duration: 120 },
    { topic: 'People who brag about being busy are just bragging about poor time management.', emoji: '⏰', duration: 120 },
    { topic: 'Children should never be allowed on social media, full stop.', emoji: '🧒', duration: 120 },
    { topic: 'The idea of a soulmate is a dangerous fantasy that ruins real relationships.', emoji: '💫', duration: 120 },
    { topic: 'Couples who post their relationship constantly online are compensating for something.', emoji: '📷', duration: 120 },
    { topic: 'Rich kids who pretend to be self-made are the most dishonest people in society.', emoji: '🎩', duration: 120 },
    { topic: 'People who talk about their diet constantly have made food their personality.', emoji: '🥗', duration: 120 },
    { topic: 'Giving unsolicited life advice is one of the rudest things a person can do.', emoji: '🗣️', duration: 120 },
    { topic: 'People who always play devil\'s advocate are annoying and need to pick a side.', emoji: '😈', duration: 120 },
    { topic: 'Serial monogamy is just another form of promiscuity.', emoji: '💞', duration: 120 },
    { topic: 'Emotional cheating is worse than physical cheating.', emoji: '❤️‍🔥', duration: 120 },
    { topic: 'People who can\'t apologize are genuinely dangerous to be around.', emoji: '😤', duration: 120 },
    { topic: 'Online dating has made people disposable to each other.', emoji: '📲', duration: 120 },
    { topic: 'People who can\'t manage money should not be in relationships.', emoji: '🏦', duration: 120 },
    { topic: 'Sharing your location with your partner at all times is surveillance, not love.', emoji: '📍', duration: 120 },
    { topic: 'People who lecture others about environmentalism while flying planes are hypocrites.', emoji: '🌱', duration: 120 },
    { topic: 'Adults who still blame their parents for everything are stuck in victimhood.', emoji: '👪', duration: 120 },
    { topic: 'People who need a therapist to function in normal relationships are not ready to date.', emoji: '🛋️', duration: 120 },
    { topic: 'Dating apps have destroyed the art of approaching someone in real life.', emoji: '💬', duration: 120 },
    { topic: 'Women who reject men who are shorter than them are just as shallow as men who only want thin women.', emoji: '📐', duration: 120 },
    { topic: 'Choosing your career over having children is inherently selfish.', emoji: '💼', duration: 120 },
    { topic: 'People who can\'t handle constructive criticism will never grow.', emoji: '🪴', duration: 120 },
    { topic: 'Radical honesty in relationships does more damage than white lies.', emoji: '🤥', duration: 120 },
    { topic: 'Men who cry easily in relationships are not more emotionally intelligent — they\'re just dramatic.', emoji: '😭', duration: 120 },
    { topic: 'Women who refuse to change for their partners have unrealistic standards.', emoji: '💁', duration: 120 },
    { topic: 'Cohabiting before marriage leads to worse marriages, not better ones.', emoji: '🏡', duration: 120 },
    { topic: 'People who refuse to argue in relationships are emotionally avoidant, not mature.', emoji: '🤐', duration: 120 },
    { topic: 'Men who struggle financially in their 30s should not expect to attract high quality women.', emoji: '📉', duration: 120 },
    { topic: 'The worst thing you can do to a person is forgive them too easily.', emoji: '🕊️', duration: 120 },
    { topic: 'People who need to be in a relationship to be happy are fundamentally broken.', emoji: '💔', duration: 120 },
    { topic: 'Posting your body online for likes is a form of slow self-destruction.', emoji: '🔥', duration: 120 },
    { topic: 'Kids raised without religion are missing something essential for moral development.', emoji: '🙏', duration: 120 },
    { topic: 'Open relationships only work for people who aren\'t actually in love.', emoji: '❤️', duration: 120 },
    { topic: 'People who identify as sapiosexual are just elitist snobs with a fancy label.', emoji: '🧠', duration: 120 },
    { topic: 'Posting your salary online is the new oversharing and it\'s cringe.', emoji: '💵', duration: 120 },
    { topic: 'The most attractive trait in a person is ambition, not looks or personality.', emoji: '🚀', duration: 120 },
    { topic: 'People who put pronouns in their bio are performing, not expressing.', emoji: '🏷️', duration: 120 },
    { topic: 'Jealousy in relationships is completely normal and people who deny feeling it are lying.', emoji: '💚', duration: 120 },
    { topic: 'Women who make more than their husbands cause resentment whether they admit it or not.', emoji: '💹', duration: 120 },
    { topic: 'People who won\'t date outside their race are not racist — they\'re just honest.', emoji: '🌍', duration: 120 },
    { topic: 'Marrying someone you\'ve known less than a year is reckless and irresponsible.', emoji: '💒', duration: 120 },
    { topic: 'Couples who never fight either don\'t care about each other or are both conflict-avoidant cowards.', emoji: '☮️', duration: 120 },
    { topic: 'People who need everything to be politically correct have lost their sense of humor.', emoji: '🤡', duration: 120 },
    { topic: 'Adults who still watch anime are permanently stuck in adolescence.', emoji: '📺', duration: 120 },
  ],
  serious: [
    { topic: 'Abortion should be completely illegal in all circumstances, no exceptions.', emoji: '⚕️', duration: 300 },
    { topic: 'The United States is institutionally racist and cannot be reformed from within.', emoji: '✊', duration: 360 },
    { topic: 'Affirmative action is just discrimination with better PR.', emoji: '🎓', duration: 300 },
    { topic: 'Islam is fundamentally incompatible with Western liberal democracy.', emoji: '🕌', duration: 360 },
    { topic: 'Christianity has done more harm to humanity than any other force in history.', emoji: '✝️', duration: 360 },
    { topic: 'The police should be abolished and replaced entirely.', emoji: '👮', duration: 300 },
    { topic: 'Illegal immigrants should be deported immediately, no exceptions for family ties.', emoji: '🌎', duration: 360 },
    { topic: 'Biological males should never be allowed in women\'s spaces, period.', emoji: '🚻', duration: 300 },
    { topic: 'The American education system is deliberately keeping poor people poor.', emoji: '🏫', duration: 300 },
    { topic: 'Billionaires are proof that capitalism is a moral failure.', emoji: '💰', duration: 300 },
    { topic: 'The war on drugs has been a complete failure and drugs should all be legal.', emoji: '💊', duration: 300 },
    { topic: 'Welfare programs create dependency and should be eliminated.', emoji: '🏛️', duration: 300 },
    { topic: 'The media is completely controlled by a small group of elites and cannot be trusted.', emoji: '📰', duration: 300 },
    { topic: 'Donald Trump is the most dangerous person to ever hold the American presidency.', emoji: '🇺🇸', duration: 300 },
    { topic: 'Donald Trump is the greatest American president of the modern era.', emoji: '🏛️', duration: 300 },
    { topic: 'The Democratic Party has abandoned working class Americans entirely.', emoji: '🐴', duration: 300 },
    { topic: 'The Republican Party has become a fascist movement in everything but name.', emoji: '🐘', duration: 360 },
    { topic: 'Palestine is being subjected to genocide and the West is complicit.', emoji: '🕊️', duration: 360 },
    { topic: 'Israel has every right to do whatever it takes to eliminate Hamas.', emoji: '✡️', duration: 360 },
    { topic: 'The US should close its borders completely until the immigration system is fixed.', emoji: '🚪', duration: 300 },
    { topic: 'Gender is purely biological and transgender identity is a mental health crisis.', emoji: '⚧️', duration: 360 },
    { topic: 'Gender is a social construct and biological sex is more complex than we admit.', emoji: '🌈', duration: 360 },
    { topic: 'Reparations for slavery are morally necessary and long overdue.', emoji: '💵', duration: 360 },
    { topic: 'Reparations for slavery are reverse racism and punish people for things they didn\'t do.', emoji: '⚖️', duration: 360 },
    { topic: 'The Second Amendment is outdated and guns should be heavily restricted.', emoji: '🔫', duration: 300 },
    { topic: 'Gun ownership is a fundamental right and any restriction is unconstitutional.', emoji: '🗽', duration: 300 },
    { topic: 'America\'s opioid crisis was manufactured by pharmaceutical companies that should face criminal charges.', emoji: '💉', duration: 300 },
    { topic: 'The criminal justice system in America is designed to oppress Black communities.', emoji: '🔒', duration: 360 },
    { topic: 'Death penalty should be expanded, not abolished.', emoji: '⚖️', duration: 300 },
    { topic: 'Sex work should be fully legalized and treated like any other profession.', emoji: '💸', duration: 300 },
    { topic: 'Elon Musk is the most dangerous man in the world right now.', emoji: '🚀', duration: 300 },
    { topic: 'AI companies should face criminal liability when their models cause harm.', emoji: '🤖', duration: 300 },
    { topic: 'Universal healthcare is a human right and America\'s refusal to provide it is immoral.', emoji: '🏥', duration: 300 },
    { topic: 'Climate activists are a cult doing more harm than good to the cause.', emoji: '🌍', duration: 300 },
    { topic: 'The Catholic Church is a criminal organization that should lose its tax exempt status.', emoji: '⛪', duration: 360 },
    { topic: 'Social media companies are more responsible for teen suicide than any other factor.', emoji: '📱', duration: 300 },
    { topic: 'Capitalism is fundamentally incompatible with democracy.', emoji: '📈', duration: 360 },
    { topic: 'NATO is a vehicle for American imperialism, not global peace.', emoji: '🛡️', duration: 300 },
    { topic: 'The CIA has done more damage to democracy than any foreign adversary.', emoji: '🕵️', duration: 300 },
    { topic: 'Student loan forgiveness is an insult to everyone who sacrificed to pay theirs back.', emoji: '🎓', duration: 300 },
    { topic: 'The housing crisis was manufactured by the wealthy to keep people dependent.', emoji: '🏠', duration: 300 },
    { topic: 'Organized religion is the greatest source of suffering in human history.', emoji: '🙏', duration: 360 },
    { topic: 'LGBTQ content has no place in elementary school classrooms.', emoji: '🏳️‍🌈', duration: 300 },
    { topic: 'Defunding the police led directly to more crime and suffering in Black communities.', emoji: '👮', duration: 300 },
    { topic: 'The prison industrial complex is modern day slavery and everyone knows it.', emoji: '⛓️', duration: 360 },
    { topic: 'America is heading toward a second civil war and both sides know it.', emoji: '🇺🇸', duration: 300 },
    { topic: 'The mainstream media deliberately divides Americans to keep them distracted.', emoji: '📺', duration: 300 },
    { topic: 'Joe Biden\'s administration did serious and lasting damage to America.', emoji: '🏛️', duration: 300 },
    { topic: 'The gender pay gap is a myth manufactured by people who don\'t understand statistics.', emoji: '💰', duration: 300 },
    { topic: 'The gender pay gap is real and is caused by systemic discrimination against women.', emoji: '⚖️', duration: 300 },
    { topic: 'Antifa is a terrorist organization and should be treated as one.', emoji: '🔥', duration: 300 },
    { topic: 'The January 6th rioters were political prisoners, not insurrectionists.', emoji: '🏛️', duration: 300 },
    { topic: 'January 6th was an attempted coup and those involved should be in prison for life.', emoji: '⛓️', duration: 360 },
    { topic: 'The FDA deliberately suppresses cures to protect pharmaceutical profits.', emoji: '💊', duration: 300 },
    { topic: 'America should have stayed out of every war since World War II.', emoji: '🪖', duration: 300 },
    { topic: 'The United States owes the world an apology for the last 50 years of foreign policy.', emoji: '🌍', duration: 360 },
    { topic: 'Homeschooling should be banned because it creates isolated, radicalizable children.', emoji: '🏠', duration: 300 },
    { topic: 'The feminist movement has become a hate movement against men.', emoji: '✊', duration: 300 },
    { topic: 'Men are being systematically discriminated against in education and no one cares.', emoji: '📚', duration: 300 },
    { topic: 'America is not a democracy — it\'s an oligarchy with elections.', emoji: '🗳️', duration: 300 },
    { topic: 'The food industry is deliberately making Americans sick to profit from healthcare.', emoji: '🍔', duration: 300 },
    { topic: 'Tech giants are more powerful than governments and more dangerous.', emoji: '💻', duration: 360 },
    { topic: 'China will surpass America within 20 years and America has no one to blame but itself.', emoji: '🐉', duration: 300 },
    { topic: 'Russia\'s invasion of Ukraine was provoked by NATO expansion.', emoji: '🇷🇺', duration: 360 },
    { topic: 'Russia\'s invasion of Ukraine was unprovoked imperialism and must be stopped at any cost.', emoji: '🇺🇦', duration: 360 },
    { topic: 'The US should cut all foreign aid immediately and fix problems at home first.', emoji: '🏘️', duration: 300 },
    { topic: 'Mandatory voting should be introduced in the United States.', emoji: '🗳️', duration: 300 },
    { topic: 'The Electoral College is an anti-democratic relic that must be abolished.', emoji: '🗺️', duration: 300 },
    { topic: 'America\'s drug problem is a healthcare issue, not a criminal one.', emoji: '💉', duration: 300 },
    { topic: 'Open borders would collapse Western civilization within a generation.', emoji: '🌐', duration: 300 },
    { topic: 'Open borders are the only morally consistent position in a globalized world.', emoji: '🕊️', duration: 300 },
    { topic: 'Cancel culture is the most dangerous threat to free speech in modern America.', emoji: '🔇', duration: 300 },
    { topic: 'Free speech protections are being weaponized to spread dangerous extremism.', emoji: '🗣️', duration: 300 },
    { topic: 'The US government knowingly spies on its own citizens and no one is held accountable.', emoji: '👁️', duration: 300 },
    { topic: 'Big pharma is more responsible for the opioid crisis than any cartel.', emoji: '💊', duration: 300 },
    { topic: 'Hedge funds buying up single family homes should be made completely illegal.', emoji: '🏡', duration: 300 },
    { topic: 'Universal basic income would create a generation of people with no purpose.', emoji: '💵', duration: 300 },
    { topic: 'Andrew Tate\'s rise is a direct symptom of feminism\'s failure to include men.', emoji: '🥊', duration: 300 },
    { topic: 'The LGBT movement has moved from equality to indoctrination.', emoji: '🏳️‍🌈', duration: 300 },
    { topic: 'Black Lives Matter did more damage to race relations than it repaired.', emoji: '✊', duration: 360 },
    { topic: 'Police brutality against Black Americans is a documented systemic crisis.', emoji: '👮', duration: 360 },
    { topic: 'America is addicted to outrage and social media is the dealer.', emoji: '😡', duration: 300 },
    { topic: 'The school-to-prison pipeline is real and is designed to create cheap prison labor.', emoji: '🏫', duration: 360 },
    { topic: 'The Supreme Court has become a partisan political tool, not a neutral arbiter.', emoji: '⚖️', duration: 300 },
    { topic: 'America\'s healthcare system kills more people than any foreign enemy.', emoji: '🏥', duration: 300 },
    { topic: 'Most wars in the last 100 years were fought for corporate interests, not freedom.', emoji: '🪖', duration: 360 },
    { topic: 'The United States is more divided now than at any point since the Civil War.', emoji: '🇺🇸', duration: 300 },
    { topic: 'Social media should be regulated like a public utility.', emoji: '📲', duration: 300 },
    { topic: 'The government should be allowed to break up any company that becomes too powerful.', emoji: '🏢', duration: 300 },
    { topic: 'Organized religion should be taxed like any other wealthy institution.', emoji: '⛪', duration: 300 },
    { topic: 'Americans are too cowardly to have an honest conversation about race.', emoji: '🗣️', duration: 300 },
    { topic: 'The Democratic Party is more corrupt than the Republican Party right now.', emoji: '🐴', duration: 300 },
    { topic: 'The Republican Party is more corrupt than the Democratic Party right now.', emoji: '🐘', duration: 300 },
    { topic: 'America will never have a female president because of deeply ingrained sexism.', emoji: '👩', duration: 300 },
    { topic: 'Trigger warnings and safe spaces are infantilizing an entire generation.', emoji: '🧸', duration: 300 },
    { topic: 'The minimum wage should be at least $25 per hour nationally.', emoji: '💵', duration: 300 },
    { topic: 'Raising the minimum wage to $25 would destroy small businesses and increase unemployment.', emoji: '📉', duration: 300 },
    { topic: 'Cryptocurrency is a Ponzi scheme that will eventually collapse entirely.', emoji: '₿', duration: 300 },
    { topic: 'America should have a reckoning with its history of slavery similar to Germany\'s with the Holocaust.', emoji: '🏛️', duration: 360 },
    { topic: 'The mental health crisis in America is manufactured by a therapy industrial complex.', emoji: '🧠', duration: 300 },
    { topic: 'Landlords contribute nothing to society and should be heavily regulated or abolished.', emoji: '🏠', duration: 300 },
    { topic: 'The United States should withdraw all military presence from the Middle East immediately.', emoji: '🪖', duration: 300 },
    { topic: 'Eating meat in 2026 is morally indefensible and everyone knows it deep down.', emoji: '🥩', duration: 300 },
    { topic: 'Factory farming is one of the greatest moral atrocities in human history.', emoji: '🐄', duration: 300 },
    { topic: 'Fossil fuel companies should face criminal prosecution for climate change.', emoji: '🌡️', duration: 300 },
    { topic: 'Nuclear power is the only realistic solution to climate change and environmentalists who oppose it are the problem.', emoji: '⚛️', duration: 300 },
    { topic: 'The United States spends more on its military than the next ten countries combined — and it still isn\'t enough.', emoji: '🪖', duration: 300 },
    { topic: 'The United States military budget should be cut in half and invested in Americans.', emoji: '✂️', duration: 300 },
    { topic: 'Marijuana should be fully federally legal — anything less is an injustice to those jailed for it.', emoji: '🌿', duration: 300 },
    { topic: 'Psychedelics should be prescribed by doctors to treat PTSD, depression, and addiction.', emoji: '🍄', duration: 300 },
    { topic: 'The United States government has covered up knowledge of extraterrestrial life.', emoji: '👽', duration: 300 },
    { topic: 'Alex Jones, despite being wrong about many things, was right that the government lies constantly.', emoji: '📻', duration: 300 },
    { topic: 'Wealthy people should be legally barred from donating to political campaigns.', emoji: '💰', duration: 300 },
    { topic: 'Roe v. Wade being overturned was legally correct, even if the outcome is tragic.', emoji: '⚖️', duration: 360 },
    { topic: 'The mainstream left is more intolerant of dissent than the mainstream right.', emoji: '🙊', duration: 300 },
    { topic: 'The mainstream right is more intolerant of dissent than the mainstream left.', emoji: '🙈', duration: 300 },
    { topic: 'Both political parties in America are controlled by the same donor class and the difference is theater.', emoji: '🎭', duration: 360 },
    { topic: 'America needs a viable third party or the country is finished.', emoji: '🗳️', duration: 300 },
    { topic: 'The free market has never and will never solve inequality on its own.', emoji: '📊', duration: 300 },
    { topic: 'America\'s obesity crisis is the result of government failure, not personal failure.', emoji: '🍔', duration: 300 },
    { topic: 'Children who are raised without fathers are statistically set up to fail.', emoji: '👨', duration: 300 },
    { topic: 'The feminist movement does not care about men\'s issues and never will.', emoji: '⚤', duration: 300 },
    { topic: 'America\'s immigration system is designed to exploit cheap labor, not welcome people.', emoji: '🌎', duration: 300 },
    { topic: 'The college system in America is a predatory debt machine, not an education system.', emoji: '🎓', duration: 300 },
    { topic: 'Most billionaires built their wealth on exploitation, not innovation.', emoji: '💼', duration: 300 },
    { topic: 'Automation will cause mass unemployment and governments have no plan for it.', emoji: '🤖', duration: 300 },
    { topic: 'The United States is the primary driver of global instability in the 21st century.', emoji: '🌍', duration: 300 },
    { topic: 'DEI programs in corporate America are quota systems that reduce quality and competence.', emoji: '🏢', duration: 300 },
    { topic: 'DEI programs are the bare minimum response to decades of documented discrimination.', emoji: '⚖️', duration: 300 },
    { topic: 'Social media companies have more power to shape public opinion than any government.', emoji: '📲', duration: 300 },
    { topic: 'Young people in America have been failed by every institution and have every right to be angry.', emoji: '😤', duration: 300 },
    { topic: 'The United States is in an unacknowledged mental health emergency.', emoji: '🧠', duration: 300 },
    { topic: 'American patriotism has become indistinguishable from nationalism.', emoji: '🇺🇸', duration: 300 },
    { topic: 'The American dream is dead and has been replaced by debt and survival.', emoji: '💀', duration: 300 },
    { topic: 'Police unions are one of the greatest obstacles to justice in America.', emoji: '👮', duration: 300 },
    { topic: 'Sex education in American schools is dangerously inadequate.', emoji: '📚', duration: 300 },
    { topic: 'Comprehensive sex education in schools is parental overreach by the government.', emoji: '🏫', duration: 300 },
    { topic: 'Every American should be required to complete two years of national service.', emoji: '🪖', duration: 300 },
    { topic: 'The United States should not have gone to war in Iraq and the people responsible should face trial.', emoji: '⚖️', duration: 360 },
    { topic: 'The American media\'s coverage of crime makes race relations worse, not better.', emoji: '📺', duration: 300 },
    { topic: 'The billionaire class is more dangerous to American democracy than any foreign enemy.', emoji: '💰', duration: 300 },
    { topic: 'Hate speech laws are necessary to protect minorities from organized harassment.', emoji: '🔇', duration: 300 },
    { topic: 'Hate speech laws are the most dangerous threat to free expression in modern democracy.', emoji: '🗣️', duration: 300 },
    { topic: 'Joe Rogan has done more damage to public discourse than any mainstream news outlet.', emoji: '🎙️', duration: 300 },
    { topic: 'Joe Rogan has done more to democratize information than any mainstream news outlet.', emoji: '🎧', duration: 300 },
    { topic: 'The United States is not prepared for a major war and its military is overextended.', emoji: '🪖', duration: 300 },
  ],
  competitive: [
    { topic: 'Democracy is a failed experiment and humanity needs a better system.', emoji: '🗳️', duration: 480, eloRequired: 200 },
    { topic: 'Capitalism will inevitably destroy itself — the only question is what replaces it.', emoji: '💰', duration: 480, eloRequired: 300 },
    { topic: 'Free will is an illusion and moral responsibility is therefore meaningless.', emoji: '🧠', duration: 480, eloRequired: 300 },
    { topic: 'Humanity is a parasitic species and the planet would thrive without us.', emoji: '🌍', duration: 480, eloRequired: 200 },
    { topic: 'God is either evil, powerless, or doesn\'t exist — there is no fourth option.', emoji: '✝️', duration: 480, eloRequired: 300 },
    { topic: 'Morality is just the story told by whoever wins the war.', emoji: '⚖️', duration: 480, eloRequired: 300 },
    { topic: 'A world government is inevitable and resistance to it is futile and foolish.', emoji: '🌐', duration: 480, eloRequired: 400 },
    { topic: 'Human consciousness will be uploaded within 50 years and death will become optional.', emoji: '🔬', duration: 480, eloRequired: 400 },
    { topic: 'The United States is an empire in decline and nothing can stop its collapse.', emoji: '🏛️', duration: 480, eloRequired: 300 },
    { topic: 'Artificial intelligence will make human beings obsolete within our lifetime.', emoji: '🤖', duration: 480, eloRequired: 400 },
    { topic: 'Violence is sometimes the only moral response to injustice.', emoji: '✊', duration: 480, eloRequired: 300 },
    { topic: 'Privacy is already dead and society should stop pretending otherwise.', emoji: '👁️', duration: 480, eloRequired: 200 },
    { topic: 'The nuclear family is an outdated structure that causes more harm than it prevents.', emoji: '👨‍👩‍👧', duration: 480, eloRequired: 200 },
    { topic: 'Human beings are fundamentally selfish and altruism is always self-serving.', emoji: '🤲', duration: 480, eloRequired: 300 },
    { topic: 'The West has no moral authority to lecture the world about human rights.', emoji: '🌍', duration: 480, eloRequired: 400 },
    { topic: 'Genetic engineering of children is not only acceptable but morally required.', emoji: '🧬', duration: 480, eloRequired: 400 },
    { topic: 'Animals have as much right to life as humans and factory farming is a holocaust.', emoji: '🐄', duration: 480, eloRequired: 300 },
    { topic: 'Meritocracy is a myth used to justify inequality and keep the poor in their place.', emoji: '🏆', duration: 480, eloRequired: 400 },
    { topic: 'The internet has made humanity collectively less intelligent.', emoji: '💻', duration: 480, eloRequired: 500 },
    { topic: 'Nations are an obsolete concept causing more suffering than they prevent.', emoji: '🗺️', duration: 480, eloRequired: 500 },
    { topic: 'Religion is a virus of the mind that spreads through childhood indoctrination.', emoji: '🧠', duration: 480, eloRequired: 400 },
    { topic: 'The concept of race was invented by the powerful to divide the powerless and still serves that purpose.', emoji: '✊', duration: 480, eloRequired: 400 },
    { topic: 'The ruling class deliberately keeps the population ignorant to maintain control.', emoji: '🎭', duration: 480, eloRequired: 300 },
    { topic: 'True love is a neurochemical illusion that humans have built an entire civilization around.', emoji: '💘', duration: 480, eloRequired: 300 },
    { topic: 'The social contract is broken and citizens have the right to withdraw consent from their governments.', emoji: '📜', duration: 480, eloRequired: 500 },
    { topic: 'Eating animals is no different morally from slavery — it is domination of the powerless.', emoji: '🥩', duration: 480, eloRequired: 400 },
    { topic: 'The scientific community is as capable of dogma and corruption as any religion.', emoji: '🔬', duration: 480, eloRequired: 400 },
    { topic: 'Western civilization is built on genocide and theft and has never genuinely reckoned with it.', emoji: '🌍', duration: 480, eloRequired: 500 },
    { topic: 'Transhumanism is the natural next step in human evolution and resistance to it is fear.', emoji: '🤖', duration: 480, eloRequired: 400 },
    { topic: 'Climate change will cause the collapse of civilization within 200 years and we are doing nothing meaningful.', emoji: '🌡️', duration: 480, eloRequired: 500 },
    { topic: 'The political spectrum of left and right is a false binary designed to prevent real change.', emoji: '⚖️', duration: 480, eloRequired: 400 },
    { topic: 'Consciousness is the universe experiencing itself and death is an illusion.', emoji: '✨', duration: 480, eloRequired: 500 },
    { topic: 'Power will always corrupt — the design of any political system is irrelevant.', emoji: '👑', duration: 480, eloRequired: 400 },
    { topic: 'The most dangerous thing in the world is a convinced man who is wrong.', emoji: '💣', duration: 480, eloRequired: 300 },
    { topic: 'Language shapes thought so completely that objective truth is impossible to communicate.', emoji: '🗣️', duration: 480, eloRequired: 500 },
    { topic: 'The working class will never meaningfully revolt because the system is too good at pacifying them.', emoji: '⛓️', duration: 480, eloRequired: 500 },
    { topic: 'Technological progress without moral progress will destroy humanity.', emoji: '🔥', duration: 480, eloRequired: 400 },
    { topic: 'History has no trajectory — there is no moral arc, only cycles of power.', emoji: '🔄', duration: 480, eloRequired: 500 },
    { topic: 'Children should not be raised with any religion — it is a form of psychological imposition.', emoji: '👶', duration: 480, eloRequired: 300 },
    { topic: 'The concept of national borders is one of the deadliest ideas in human history.', emoji: '🗺️', duration: 480, eloRequired: 400 },
    { topic: 'Happiness is incompatible with awareness — the more you understand the world, the less happy you can be.', emoji: '😔', duration: 480, eloRequired: 400 },
    { topic: 'Every major atrocity in history was committed by ordinary people following orders — this should terrify us.', emoji: '⚠️', duration: 480, eloRequired: 500 },
    { topic: 'The most important question in politics is: who decides who decides?', emoji: '🏛️', duration: 480, eloRequired: 500 },
    { topic: 'Economic growth as the primary measure of societal success is civilization\'s greatest mistake.', emoji: '📈', duration: 480, eloRequired: 500 },
    { topic: 'The next 50 years will see more change than the last 500 — and humanity is not ready.', emoji: '🚀', duration: 480, eloRequired: 400 },
    { topic: 'Any sufficiently advanced AI will inevitably develop something indistinguishable from suffering.', emoji: '🤖', duration: 480, eloRequired: 500 },
    { topic: 'The war on terror created more terrorists than it killed.', emoji: '💣', duration: 480, eloRequired: 400 },
    { topic: 'Every generation believes it is uniquely enlightened — and every generation is wrong.', emoji: '🪞', duration: 480, eloRequired: 400 },
    { topic: 'It is morally wrong to bring children into a world with this much suffering.', emoji: '👶', duration: 480, eloRequired: 400 },
    { topic: 'The most radical political act you can do today is choose not to consume.', emoji: '🛒', duration: 480, eloRequired: 400 },
  ],
  random: [
    { topic: 'Would you push one person in front of a train to save five strangers?', emoji: '🚂', duration: 150 },
    { topic: 'Would you date someone you found physically repulsive if they were perfect in every other way?', emoji: '💘', duration: 150 },
    { topic: 'Would you betray your best friend for $10 million dollars?', emoji: '🤝', duration: 150 },
    { topic: 'If you found out your parents committed a serious crime, would you turn them in?', emoji: '👨‍👩‍👦', duration: 180 },
    { topic: 'Would you sacrifice your own child to save 100 strangers?', emoji: '💔', duration: 180 },
    { topic: 'Would you have an affair if you knew your partner would never find out?', emoji: '🔐', duration: 150 },
    { topic: 'If you could read your partner\'s mind for one day, would you?', emoji: '🧠', duration: 150 },
    { topic: 'Would you eat a human being to survive if stranded alone with their corpse?', emoji: '🍖', duration: 150 },
    { topic: 'Would you let a million people suffer to bring back someone you love from the dead?', emoji: '💀', duration: 180 },
    { topic: 'If you knew your child would grow up to be a murderer, would you abort them?', emoji: '👶', duration: 180 },
    { topic: 'Would you marry someone you didn\'t love to give your dying parent their last wish?', emoji: '💍', duration: 150 },
    { topic: 'Would you steal from a billionaire to feed your family?', emoji: '💰', duration: 150 },
    { topic: 'Would you turn off your elderly parent\'s life support to save money?', emoji: '🏥', duration: 150 },
    { topic: 'If you could live forever but everyone you love would die normally, would you?', emoji: '♾️', duration: 180 },
    { topic: 'Would you frame an innocent person if it was the only way to free someone you love?', emoji: '⚖️', duration: 150 },
    { topic: 'Would you erase all your memories to start a completely new life?', emoji: '🧠', duration: 150 },
    { topic: 'Would you trade 20 years of your life to be the most famous person on earth?', emoji: '⭐', duration: 150 },
    { topic: 'If you could delete social media from existence and save millions from depression, would you — even if it destroyed your career?', emoji: '📱', duration: 180 },
    { topic: 'Would you secretly poison someone who was abusing a child if you knew they\'d never be caught legally?', emoji: '⚗️', duration: 180 },
    { topic: 'If you could choose the gender of your child before birth, would you?', emoji: '👶', duration: 150 },
    { topic: 'Would you give up sex for life in exchange for perfect health forever?', emoji: '💊', duration: 150 },
    { topic: 'Would you publicly humiliate someone you hate if it meant they lost their job?', emoji: '😈', duration: 150 },
    { topic: 'If you had to choose between saving a drowning dog or a drowning stranger, which would you choose?', emoji: '🐕', duration: 150 },
    { topic: 'Would you take a pill that made you feel content forever — even if it removed all ambition?', emoji: '💊', duration: 150 },
    { topic: 'Would you assassinate a dictator if you had the chance and knew you\'d get away with it?', emoji: '🎯', duration: 180 },
    { topic: 'Would you delete a memory of your greatest love if it meant erasing the pain of losing them?', emoji: '🧠', duration: 150 },
    { topic: 'If your country went to war for reasons you knew were wrong, would you fight?', emoji: '🪖', duration: 180 },
    { topic: 'Would you expose your best friend\'s infidelity to protect their partner whom you barely know?', emoji: '👀', duration: 150 },
    { topic: 'Would you switch bodies with someone of the opposite gender for one year if you could?', emoji: '🔄', duration: 150 },
    { topic: 'If you discovered your child was a school bully, would you punish them more harshly than the school?', emoji: '🏫', duration: 150 },
    { topic: 'Would you give up the internet forever in exchange for $5 million?', emoji: '💻', duration: 150 },
    { topic: 'Would you break up a happy couple if you knew one of them was cheating?', emoji: '💔', duration: 150 },
    { topic: 'If you could know every secret thought your closest friends have about you, would you want to?', emoji: '🤫', duration: 150 },
    { topic: 'Would you have a one-night stand with a celebrity you found attractive even while in a relationship?', emoji: '⭐', duration: 150 },
    { topic: 'Would you rather be the most intelligent person in the world who is universally disliked, or average and universally loved?', emoji: '🧠', duration: 150 },
    { topic: 'Would you take $100 million knowing that a random stranger somewhere in the world would die?', emoji: '💰', duration: 180 },
    { topic: 'If you could choose how you die, would you — and how would you choose?', emoji: '💀', duration: 150 },
    { topic: 'Would you report your neighbor if you saw them doing something illegal but victimless?', emoji: '👮', duration: 150 },
    { topic: 'Would you tell your best friend their partner is cheating, even if your friend has explicitly said they don\'t want to know?', emoji: '👀', duration: 150 },
    { topic: 'Would you give up your career to take care of a parent with dementia?', emoji: '👴', duration: 150 },
    { topic: 'If you could guarantee your child would be extraordinarily successful but deeply unhappy, would you?', emoji: '🏆', duration: 180 },
    { topic: 'Would you date someone significantly less attractive than you if they were kind, rich, and devoted?', emoji: '💕', duration: 150 },
    { topic: 'Would you lie under oath to protect someone you love from going to prison?', emoji: '⚖️', duration: 180 },
    { topic: 'If you could relive your life from age 10 with your current knowledge, would you?', emoji: '🕐', duration: 150 },
    { topic: 'Would you save 1000 strangers at the cost of your own life?', emoji: '🦸', duration: 150 },
    { topic: 'Would you accept $1 billion knowing it would halve your lifespan?', emoji: '💰', duration: 150 },
    { topic: 'If your government ordered you to do something you knew was evil, would you comply to protect yourself?', emoji: '🏛️', duration: 180 },
    { topic: 'Would you give up the ability to dream in exchange for perfect sleep every night?', emoji: '💤', duration: 150 },
    { topic: 'Would you break the law if you were certain the law was unjust?', emoji: '⚖️', duration: 150 },
    { topic: 'If you could be completely invisible for 24 hours, what would you do — and is it ethical?', emoji: '👻', duration: 150 },
    { topic: 'Would you rather know the truth about everything or remain blissfully unaware?', emoji: '🔮', duration: 150 },
  ]
}
 
// VC-specific topics
const VC_TOPICS = [
  { topic: 'Abortion should be completely illegal — there are no valid exceptions.', emoji: '⚕️', duration: 240 },
  { topic: 'The police should be abolished and replaced with community alternatives.', emoji: '👮', duration: 240 },
  { topic: 'Biological males should never compete in women\'s sports, no exceptions.', emoji: '🏅', duration: 240 },
  { topic: 'Reparations for slavery should be paid immediately and substantially.', emoji: '✊', duration: 240 },
  { topic: 'The death penalty should be expanded, not abolished.', emoji: '⚖️', duration: 240 },
  { topic: 'All drugs should be fully legalized and regulated by the government.', emoji: '💊', duration: 240 },
  { topic: 'Universal basic income would destroy the motivation to work.', emoji: '💵', duration: 240 },
  { topic: 'God almost certainly does not exist and religion is holding humanity back.', emoji: '✝️', duration: 240 },
  { topic: 'Capitalism is a moral failure and needs to be replaced entirely.', emoji: '📈', duration: 240 },
  { topic: 'The United States is the greatest threat to world peace right now.', emoji: '🌍', duration: 240 },
  { topic: 'Social media companies should face criminal charges for teen mental health damage.', emoji: '📱', duration: 240 },
  { topic: 'Immigration should be drastically reduced to protect national culture.', emoji: '🚪', duration: 240 },
  { topic: 'Sex work is legitimate work and should be fully decriminalized.', emoji: '💸', duration: 240 },
  { topic: 'Affirmative action is just discrimination against white and Asian people.', emoji: '🎓', duration: 240 },
  { topic: 'Climate change activists are doing more harm than good to the cause.', emoji: '🌡️', duration: 240 },
  { topic: 'The prison system is modern slavery and should be abolished.', emoji: '🔒', duration: 240 },
  { topic: 'Israel\'s actions in Gaza constitute genocide and the West is complicit.', emoji: '🕊️', duration: 240 },
  { topic: 'Elon Musk has too much power and is a genuine threat to democracy.', emoji: '🚀', duration: 240 },
  { topic: 'Gun ownership should be banned for all civilians in America.', emoji: '🔫', duration: 240 },
  { topic: 'Trans women are women and denying this is a form of bigotry.', emoji: '🏳️‍⚧️', duration: 240 },
  { topic: 'The American Dream is dead — it never existed for most Americans.', emoji: '🇺🇸', duration: 240 },
  { topic: 'Cancel culture is destroying free speech more than any government censorship.', emoji: '🔇', duration: 240 },
  { topic: 'America will never solve its race problem because it profits from keeping it unsolved.', emoji: '✊', duration: 240 },
  { topic: 'Universal healthcare would save more American lives than the entire military.', emoji: '🏥', duration: 240 },
  { topic: 'The two-party system in America is a trap designed to prevent real change.', emoji: '🗳️', duration: 240 },
  { topic: 'Billionaires are a sign of a failed society, not a successful one.', emoji: '💰', duration: 240 },
  { topic: 'America\'s war on drugs destroyed more lives than the drugs themselves.', emoji: '💊', duration: 240 },
  { topic: 'The biggest threat to free speech in America is corporations, not government.', emoji: '🏢', duration: 240 },
  { topic: 'Andrew Tate is a symptom of a generation of men abandoned by feminism.', emoji: '🥊', duration: 240 },
  { topic: 'The mainstream media is fundamentally propaganda for whoever holds power.', emoji: '📺', duration: 240 },
  { topic: 'America should not be sending billions to Ukraine while Americans suffer.', emoji: '🇺🇦', duration: 240 },
  { topic: 'America owes Ukraine every dollar it can provide — abandonment is complicity.', emoji: '🛡️', duration: 240 },
  { topic: 'The feminist movement has overcorrected and is now hostile to men.', emoji: '⚤', duration: 240 },
  { topic: 'Every American should be required to complete two years of national service.', emoji: '🪖', duration: 240 },
  { topic: 'The Catholic Church should face criminal prosecution as an institution.', emoji: '⛪', duration: 240 },
  { topic: 'Marijuana being illegal while alcohol is legal is one of America\'s greatest hypocrisies.', emoji: '🌿', duration: 240 },
  { topic: 'Wealth inequality in America has reached a point where violent revolt is historically predictable.', emoji: '🔥', duration: 240 },
  { topic: 'Children should not be on any social media platform before age 18.', emoji: '🧒', duration: 240 },
  { topic: 'The electoral college is an anti-democratic relic and must be abolished immediately.', emoji: '🗺️', duration: 240 },
  { topic: 'America\'s foreign policy has been a series of war crimes dressed up as liberation.', emoji: '🪖', duration: 240 },
  { topic: 'The woke movement has made progressive politics unelectable.', emoji: '👁️', duration: 240 },
  { topic: 'MAGA has made conservative politics permanently associated with extremism.', emoji: '🎩', duration: 240 },
  { topic: 'America needs to have an honest reckoning with the fact that it was built on slavery.', emoji: '⛓️', duration: 240 },
  { topic: 'American police kill more civilians than police in any other developed nation — this is not a coincidence.', emoji: '👮', duration: 240 },
  { topic: 'The college system in America is a predatory scam and most degrees are worthless.', emoji: '🎓', duration: 240 },
  { topic: 'Tech companies have more influence over American politics than voters do.', emoji: '💻', duration: 240 },
  { topic: 'America needs to break up with its obsession with guns before it destroys itself.', emoji: '🔫', duration: 240 },
  { topic: 'The free market cannot and will never fix climate change — only government can.', emoji: '🌡️', duration: 240 },
  { topic: 'America\'s mental health crisis is the direct result of a system designed to keep people desperate.', emoji: '🧠', duration: 240 },
  { topic: 'The pharmaceutical industry in America does more harm than good.', emoji: '💉', duration: 240 },
  { topic: 'America is one economic crisis away from political collapse.', emoji: '📉', duration: 240 },
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

  const roomScore = (r) => {
  const playerCount = Object.keys(r.players).length
  // Waiting TEXT rooms with players → pin above everything else
  if (r.status === 'waiting' && playerCount > 0 && r.type !== 'vc') return 1100
  if (r.status === 'active')   return 1000
  if (r.status === 'starting') return 900
  // Empty waiting rooms — sorted by type priority
  const typePriority = { competitive: 60, serious: 50, casual: 40, random: 30, custom: 35, vc: 20 }
  return typePriority[r.type] || 20
}
const allWaiting = [...textRooms, ...vcRooms, ...customRooms].filter(r => r.status === 'waiting')
const allActive  = [...textRooms, ...vcRooms, ...customRooms].filter(r => r.status !== 'waiting')

const combined = [
  ...allActive.sort((a, b) => roomScore(b) - roomScore(a)),
  ...allWaiting.sort((a, b) => roomScore(b) - roomScore(a)),
]

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


// ─── Text room creator ─────────────────────────────────────────
function createRoom(type) {
  // Hard cap: never more than 2 waiting vc rooms
  if (type === 'vc') {
    const waitingVc = Object.values(rooms).filter(r => r.type === 'vc' && r.status === 'waiting').length
    if (waitingVc >= 2) return null
  }

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
function calculateEloChanges(type, playerCount, duration, winnerEloVal = null, loserEloVal = null) {
 const ranges = {
  casual:      { min: 15, max: 25 },
  random:      { min: 10, max: 20 },
  serious:     { min: 20, max: 30 },
  competitive: { min: 45, max: 80 },
  vc:          { min: 10, max: 35 },
}
  const { min, max } = ranges[type] ?? { min: 20, max: 40 }

  // Chess-style expected score — how likely was the winner to win?
  let expectedWinner = 0.5
  if (winnerEloVal !== null && loserEloVal !== null) {
    expectedWinner = 1 / (1 + Math.pow(10, (loserEloVal - winnerEloVal) / 400))
  }

  // Underdog winners get more Elo, favorite winners get less
  const winnerAmount = Math.round(min + (max - min) * (1 - expectedWinner))
  // Favorites lose more when they lose, underdogs lose less
  const loserAmount  = Math.round(min + (max - min) * expectedWinner)

  const cappedWinner = Math.min(max, Math.max(min, winnerAmount))
  const cappedLoser  = Math.min(max, Math.max(min, loserAmount))

  return {
    winnerElo: cappedWinner,
    secondElo: Math.round(cappedWinner * 0.4),
    thirdElo:  Math.round(cappedWinner * 0.2),
    loserBase: cappedLoser,
  }
}
function checkForAutoWin(roomId) {
  const room = rooms[roomId]
  if (!room || room.status !== 'active' || room.instanceId === 'topic_of_the_day') return false
  if (room.type === 'vc') return false
  const allEntries = Object.entries(room.players)
  const realEntries = allEntries.filter(([key]) => !key.startsWith('bot_'))
  // Auto-win if only 1 real player remains (bots don't count as opponents)
  if (realEntries.length !== 1) return false
  const winner = realEntries[0][1]
  room.status = 'ended'
  totalDebatesCompleted++
  const allSorted = Object.values(room.players).sort((a, b) => b.score - a.score)
  const standings = [winner, ...allSorted.filter(p => p.username !== winner.username)]
  const eloChanges = calculateEloChanges(room.type, 2, room.duration, winner.elo ?? 0, 0)
  io.to(roomId).emit('debate_ended', { standings, eloChanges, type: room.type, autoWin: true })
  console.log(`🏆 Auto-win: ${winner.username} — last real player in "${room.topic}"`)
  if (!room.isCustom) scheduleRoom(room.type)
  return true
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
    if (type === 'vc') {
      const waitingVc = Object.values(rooms).filter(r => r.type === 'vc' && r.status === 'waiting').length
      if (waitingVc >= 2) { io.emit('rooms_update', getRoomList()); return }
    }
    // Hard cap on text rooms
    const currentWaiting = Object.values(rooms).filter(r => r.status === 'waiting' && r.type !== 'vc' && !r.isCustom).length
    if (currentWaiting >= TARGET_AVAILABLE) { io.emit('rooms_update', getRoomList()); return }
    createRoom(type)
    io.emit('rooms_update', getRoomList())
  }, delay)
}
function scheduleVCRoom(immediate = false) {
  if (getVCWaitingCount() >= TARGET_VC_AVAILABLE) return
  const delay = immediate ? 0 : 10000
  setTimeout(() => {
    if (getVCWaitingCount() >= TARGET_VC_AVAILABLE) return
    createVCRoom()
    io.emit('rooms_update', getRoomList())
  }, delay)
}
function getAvailableCount() {
  return Object.values(rooms).filter(r => r.status === 'waiting' && r.type !== 'vc' && !r.isCustom).length + pendingRoomCreations
}

function getVCWaitingCount() {
  return Object.values(rooms).filter(r => r.type === 'vc' && r.status === 'waiting' && !r.isCustom).length
}

function replenishRooms(immediate = false) {
  const vcNeeded = TARGET_VC_AVAILABLE - getVCWaitingCount()
  for (let i = 0; i < vcNeeded; i++) {
    scheduleVCRoom(immediate)
  }

  const needed = TARGET_AVAILABLE - getAvailableCount()
  if (needed <= 0) return
  if (getAvailableCount() >= TARGET_AVAILABLE) return
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
          const sorted = Object.values(room.players).sort((a, b) => b.score - a.score)
          const isTie = sorted.length === 2 && sorted[0].score === sorted[1].score && sorted[0].score > 0
          if (isTie && !room.inSuddenDeath) {
            room.inSuddenDeath = true
            room.suddenDeathRound = 1
            room.suddenDeathScores = {}
            sorted.forEach(p => { room.suddenDeathScores[p.username] = 0 })
            const playerIds = Object.keys(room.players)
            const firstId = playerIds[Math.floor(Math.random() * playerIds.length)]
            const secondId = playerIds.find(id => id !== firstId)
            room.suddenDeathFirst = firstId
            room.suddenDeathSecond = secondId
            room.vcState.currentSpeaker = firstId
            room.vcState.turnDuration = 15
            room.vcState.turnNumber++
            io.to(room.instanceId).emit('vc_sudden_death_start', {
              round: 1,
              firstSpeakerSocketId: firstId,
              firstSpeakerUsername: room.players[firstId]?.username,
              secondSpeakerUsername: room.players[secondId]?.username,
              turnDuration: 15,
            })
            console.log(`⚡ VC Sudden Death: "${room.topic}"`)
            return
          }
          room.status = 'ended'
          totalDebatesCompleted++
          supabaseRest('rpc/increment_debates', 'POST').catch(() => {})
          const winnerEloVal = sorted[0]?.elo ?? 0
const loserEloVal = sorted.length > 1 ? Math.round(sorted.slice(1).reduce((s, p) => s + (p.elo ?? 0), 0) / (sorted.length - 1)) : 0
const eloChanges = calculateEloChanges('vc', sorted.length, room.duration, winnerEloVal, loserEloVal)
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
        room.startCountdown = 3
        io.to(room.instanceId).emit('room_starting', { startCountdown: 3 })
        if (!room.isCustom) scheduleRoom(room.type)
        return
      }

      if (playerCount >= 2) {
        // For custom rooms, deduplicate players by username before counting
        if (room.isCustom) {
          const seenUsernames = new Set()
          for (const [sid, p] of Object.entries(room.players)) {
            if (seenUsernames.has(p.username)) {
              delete room.players[sid]
            } else {
              seenUsernames.add(p.username)
            }
          }
        }
        const deduped = Object.keys(room.players).length
        if (deduped >= 2) {
          const targetCountdown = 30 + (deduped - 2) * 10
          if (room.countdown > targetCountdown) {
            room.countdown = targetCountdown
            io.to(room.instanceId).emit('system_message', { text: `⚡ ${deduped} players joined — starting in ${targetCountdown}s!` })
          }
        }
      }
     if (room.countdown <= 0) {
        if (playerCount < 2) {
         if (room.isCustom) {
            const ageSeconds = (Date.now() - room.createdAt) / 1000
            if (ageSeconds < 5) return
            room.countdown = 1800
            return
          }
          room.status = 'ended'
          io.to(room.instanceId).emit('room_expired', { message: 'Not enough players joined. Room expired.' })
          console.log(`💨 Expired: "${room.topic}" (${playerCount} players)`)
          if (!room.isCustom) scheduleRoom(room.type)
        } else {
          room.status = 'starting'
          room.startCountdown = 4
          io.to(room.instanceId).emit('room_starting', { startCountdown: 4 })
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
        const ageSeconds = (Date.now() - room.createdAt) / 1000
        if (ageSeconds > 5) {
          room.status = 'ended'
          console.log(`⚔️ Custom active room auto-expired (empty): "${room.topic}"`)
        }
        return
      }
      const timeLeft = Math.max(0, Math.round((room.debateEndsAt - Date.now()) / 1000))

      // ── Sudden death tick ────────────────────────────────────
      if (room.inSuddenDeath && room.suddenDeathEndsAt) {
        const sdLeft = Math.max(0, Math.round((room.suddenDeathEndsAt - Date.now()) / 1000))
        io.to(room.instanceId).emit('sudden_death_tick', { timeLeft: sdLeft, phase: room.suddenDeathPhase })
        if (sdLeft <= 0) {
          if (room.suddenDeathPhase === 'first') {
            room.suddenDeathPhase = 'cooldown'
            room.suddenDeathEndsAt = Date.now() + 3000
            io.to(room.instanceId).emit('sudden_death_switch', {
              nextPlayer: room.suddenDeathSecond,
              cooldown: 3,
            })
          } else if (room.suddenDeathPhase === 'cooldown') {
            room.suddenDeathPhase = 'second'
            room.suddenDeathEndsAt = Date.now() + 10000
            io.to(room.instanceId).emit('sudden_death_second_start', {
              player: room.suddenDeathSecond,
              turnDuration: 10,
            })
          } else if (room.suddenDeathPhase === 'second') {
            const sd = room.suddenDeathScores || {}
            const firstScore = sd[room.suddenDeathFirst] || 0
            const secondScore = sd[room.suddenDeathSecond] || 0
            if (firstScore === secondScore) {
              if (room.suddenDeathRound >= 2) {
                // 2 ties in a row — call it a draw
                room.inSuddenDeath = false
                room.status = 'ended'
                totalDebatesCompleted++
                const allSorted = Object.values(room.players).sort((a, b) => b.score - a.score)
                io.to(room.instanceId).emit('debate_ended', {
                  standings: allSorted,
                  eloChanges: { winnerElo: 0, secondElo: 0, thirdElo: 0, loserBase: 0 },
                  type: room.type,
                  draw: true,
                })
                if (!room.isCustom) scheduleRoom(room.type)
              } else {
                room.suddenDeathRound++
                room.suddenDeathScores = {}
                Object.values(room.players).forEach(p => { room.suddenDeathScores[p.username] = 0 })
                const players = Object.values(room.players)
                const firstPlayer = players[Math.floor(Math.random() * players.length)]
                const secondPlayer = players.find(p => p.username !== firstPlayer.username)
                room.suddenDeathPhase = 'first'
                room.suddenDeathFirst = firstPlayer.username
                room.suddenDeathSecond = secondPlayer.username
                room.suddenDeathEndsAt = Date.now() + 10000
                io.to(room.instanceId).emit('sudden_death_start', {
                  round: room.suddenDeathRound,
                  firstPlayer: firstPlayer.username,
                  secondPlayer: secondPlayer.username,
                  turnDuration: 10,
                })
              }
            } else {
              const winner = firstScore > secondScore ? room.suddenDeathFirst : room.suddenDeathSecond
              room.inSuddenDeath = false
              room.status = 'ended'
              totalDebatesCompleted++
              const allSorted = Object.values(room.players).sort((a, b) => {
                if (a.username === winner) return -1
                if (b.username === winner) return 1
                return b.score - a.score
              })
              const eloChanges = calculateEloChanges(room.type, 2, room.duration, allSorted[0]?.elo ?? 0, allSorted[1]?.elo ?? 0)
              io.to(room.instanceId).emit('debate_ended', { standings: allSorted, eloChanges, type: room.type, suddenDeathWinner: winner })
              if (!room.isCustom) scheduleRoom(room.type)
            }
          }
        }
        return
      }

      if (timeLeft <= 0) {
        // Check for tie — trigger sudden death
        const sorted = Object.values(room.players).sort((a, b) => b.score - a.score)
        const isTwoPlayer = sorted.length === 2
        const isTie = isTwoPlayer && sorted[0].score === sorted[1].score
        if (isTie) {
          room.inSuddenDeath = true
          room.suddenDeathRound = 1
          room.suddenDeathScores = {}
          sorted.forEach(p => { room.suddenDeathScores[p.username] = 0 })
          const firstPlayer = sorted[Math.floor(Math.random() * 2)]
          const secondPlayer = sorted.find(p => p.username !== firstPlayer.username)
          room.suddenDeathPhase = 'first'
          room.suddenDeathFirst = firstPlayer.username
          room.suddenDeathSecond = secondPlayer.username
          room.suddenDeathEndsAt = Date.now() + 10000
          io.to(room.instanceId).emit('sudden_death_start', {
            round: 1,
            firstPlayer: firstPlayer.username,
            secondPlayer: secondPlayer.username,
            turnDuration: 10,
          })
          console.log(`⚡ Sudden Death: "${room.topic}"`)
          return
        }

        room.status = 'ended'
        totalDebatesCompleted++
        supabaseRest('rpc/increment_debates', 'POST').catch(() => {})

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
                  elo: (data[0].elo ?? 0) + delta,
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
          const winnerEloVal = sorted[0]?.elo ?? 0
const loserEloVal = sorted.length > 1 ? Math.round(sorted.slice(1).reduce((s, p) => s + (p.elo ?? 0), 0) / (sorted.length - 1)) : 0
const eloChanges = calculateEloChanges(room.type, sorted.length, room.duration, winnerEloVal, loserEloVal)
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
return { isRedundant: maxSimilarity >= 0.85, similarity: maxSimilarity }}

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
        max_tokens: 200,
        messages: [{
          role: 'system',
          content: `You are a debate judge. Topic: "${topic}" (${roomType}).
Score 0-30: logic/clarity (0-8), evidence (0-8), depth (0-7), vocabulary (0-7).
Casual profanity is fine if argument is strong. Hard slurs = penalty.
3-word = 0-2, mediocre = 3-8, decent = 9-15, good = 16-22, excellent = 23-27, exceptional = 28-30.

REDUNDANCY RULE: Only penalize (score 0-2) if the argument is an almost word-for-word repeat with zero new information. If the player revisits a previous point but adds new reasoning, examples, counterarguments, or builds on it in any way, score it normally. Prior arguments from this player: "${priorContext || 'none yet'}"
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
    // Remove player from any room they're already in (stale session cleanup)
    // Skip the target room to avoid wiping the creator's entry before they rejoin
    for (const [rid, r] of Object.entries(rooms)) {
      if (rid === instanceId) continue
      for (const [sid, p] of Object.entries(r.players)) {
        if (p.username === username && sid !== socket.id) {
          delete r.players[sid]
          io.to(rid).emit('players_update', Object.values(r.players))
        }
      }
    }
    const room = rooms[instanceId]
    if (!room) { socket.emit('error', { message: 'Room not found.' }); return }
    if (room.status === 'ended') { socket.emit('error', { message: 'This room has ended.' }); return }
    if (room.status === 'active') {
      // Check if this is a reconnecting VC player
      const existingPlayer = Object.values(room.players).find(p => p.username === username)
      if (existingPlayer && room.type === 'vc') {
        // Reconnect them — update their socket ID
        const oldSocketId = Object.keys(room.players).find(sid => room.players[sid].username === username)
        if (oldSocketId) {
          room.players[socket.id] = room.players[oldSocketId]
          delete room.players[oldSocketId]
          // Update vcState if this player was the current speaker
          if (room.vcState?.currentSpeaker === oldSocketId) {
            room.vcState.currentSpeaker = socket.id
          }
          // Update scores
          if (room.vcState?.scores?.[oldSocketId] !== undefined) {
            room.vcState.scores[socket.id] = room.vcState.scores[oldSocketId]
            delete room.vcState.scores[oldSocketId]
          }
          console.log(`🔄 ${username} reconnected — old: ${oldSocketId} new: ${socket.id}`)
        }
        socket.join(instanceId)
        currentRoomId = instanceId
        currentUsername = username
        // Resend current game state
        socket.emit('vc_room_info', {
          instanceId, topic: room.topic, emoji: room.emoji,
          duration: room.duration, status: room.status,
          countdown: room.countdown, players: Object.values(room.players)
        })
        // Resend debate started so client restarts MediaRecorder etc
        const currentSpeakerId = room.vcState?.currentSpeaker || socket.id
        const currentSpeakerPlayer = room.players[currentSpeakerId]
        socket.emit('vc_debate_started', {
          firstSpeakerSocketId: currentSpeakerId,
          firstSpeakerUsername: currentSpeakerPlayer?.username || username,
          duration: room.timeLeft || room.duration,
          turnDuration: room.vcState?.turnDuration || 30
        })
        return
      }
      socket.emit('join_as_spectator', { instanceId }); return
    }
if (room.eloRequired > 0 && elo < room.eloRequired) { socket.emit('error', { message: `You need ${room.eloRequired}+ ELO to join.` }); return }    if (Object.keys(room.players).length >= room.maxPlayers) { socket.emit('error', { message: 'Room is full.' }); return }

    // Password check for private rooms
    if (room.isPrivate && room.password) {
      if (!joinPassword || joinPassword !== room.password) {
        socket.emit('error', { message: 'Wrong password.' })
        return
      }
    }

    // Remove any existing entry for this username in this room (stale socket)
    for (const [sid, p] of Object.entries(room.players)) {
      if (p.username === username && sid !== socket.id) {
        delete room.players[sid]
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

    socket.emit('custom_room_created', { instanceId: id, type: isVC ? 'vc' : 'text' })
    io.emit('rooms_update', getRoomList())

    // If challenging a buddy, send them a notification via Supabase
    // (handled client-side from create-challenge page)
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

 // ── Lobby chat ────────────────────────────────────────────────
  socket.on('lobby_chat', ({ instanceId, username, text }) => {
    if (!text?.trim() || !username) return
    io.to(instanceId).emit('lobby_chat', { username, text: text.trim().slice(0, 200) })
  })

  // ── Send text message ─────────────────────────────────────────
  const messageTimes = []
  const FOUNDERS = ['jake', 'zay']
  socket.on('send_message', async ({ instanceId, username, text }) => {
    const room = rooms[instanceId]
    if (!room) return
    if (instanceId !== 'topic_of_the_day' && room.status !== 'active') return
    if (isSpectator) return
    const now = Date.now()
    messageTimes.push(now)
    const recent = messageTimes.filter(t => now - t < 10000)
    if (recent.length > 5 && !FOUNDERS.includes(username?.toLowerCase())) {
      socket.emit('error', { message: 'You are sending messages too fast.' }); return
    }

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
      if (room.inSuddenDeath && room.suddenDeathScores) {
        room.suddenDeathScores[username] = (room.suddenDeathScores[username] || 0) + score
      }
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
  socket.on('join_vc_room', ({ instanceId, username, elo = 0, password: joinPassword }) => {
    // Clear any stale sessions for this username (but not from the room they're joining)
    for (const [rid, r] of Object.entries(rooms)) {
      if (rid === instanceId) continue
      for (const [sid, p] of Object.entries(r.players)) {
        if (p.username === username && sid !== socket.id) {
          delete r.players[sid]
          io.to(rid).emit('vc_players_update', Object.values(r.players))
        }
      }
    }
    const room = rooms[instanceId]
    if (!room || room.type !== 'vc') { socket.emit('error', { message: 'VC room not found.' }); return }
    if (room.status === 'ended') { socket.emit('error', { message: 'This room has ended.' }); return }
if (Object.keys(room.players).length >= 2) {
      // Check if this is a reconnecting player
      const existingPlayer = Object.values(room.players).find(p => p.username === username)
      if (existingPlayer && room.status === 'active') {
        const oldSocketId = Object.keys(room.players).find(sid => room.players[sid].username === username)
        if (oldSocketId) {
          room.players[socket.id] = room.players[oldSocketId]
          delete room.players[oldSocketId]
          if (room.vcState?.currentSpeaker === oldSocketId) {
            room.vcState.currentSpeaker = socket.id
          }
          if (room.vcState?.scores?.[oldSocketId] !== undefined) {
            room.vcState.scores[socket.id] = room.vcState.scores[oldSocketId]
            delete room.vcState.scores[oldSocketId]
          }
        }
        socket.join(instanceId)
        currentRoomId = instanceId
        currentUsername = username
        socket.emit('vc_room_info', {
          instanceId, topic: room.topic, emoji: room.emoji,
          duration: room.duration, status: room.status,
          countdown: room.countdown, players: Object.values(room.players)
        })
        const currentSpeakerId = room.vcState?.currentSpeaker || socket.id
        const currentSpeakerPlayer = room.players[currentSpeakerId]
        socket.emit('vc_debate_started', {
          firstSpeakerSocketId: currentSpeakerId,
          firstSpeakerUsername: currentSpeakerPlayer?.username || username,
          duration: room.timeLeft || room.duration,
          turnDuration: room.vcState?.turnDuration || 30
        })
        return
      }
      socket.emit('error', { message: 'VC room is full — only 2 debaters allowed.' }); return
    }
    // Password check for private VC rooms
    if (room.isPrivate && room.password) {
      if (!joinPassword || joinPassword !== room.password) {
        socket.emit('error', { message: 'Wrong password.' })
        return
      }
    }

    // Remove any existing entry for this username in this room (stale socket)
    for (const [sid, p] of Object.entries(room.players)) {
      if (p.username === username && sid !== socket.id) {
        delete room.players[sid]
        if (room.vcState?.scores?.[sid] !== undefined) delete room.vcState.scores[sid]
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
  if (!room.isCustom) scheduleVCRoom()

    }

    console.log(`🎙️ ${username} joined VC room "${room.topic}"`)
  })

 // ── VC cancel room ────────────────────────────────────────────
  socket.on('vc_cancel_room', ({ instanceId }) => {
    const room = rooms[instanceId]
    if (!room || room.type !== 'vc') return
    if (room.status !== 'waiting') return
    if (room.createdBy !== currentUsername) return
    room.status = 'ended'
    io.to(instanceId).emit('vc_expired', { message: 'The room creator cancelled this debate.' })
    io.emit('rooms_update', getRoomList())
    console.log(`🗑️ ${currentUsername} cancelled their VC room "${room.topic}"`)
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

    // Pause the debate timer while AI scores
    const timeRemainingMs = room.debateEndsAt ? room.debateEndsAt - Date.now() : null
    room.debateEndsAt = null
    io.to(instanceId).emit('vc_scoring_start', { username })

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

   // Resume the debate timer
    if (timeRemainingMs !== null) room.debateEndsAt = Date.now() + timeRemainingMs
    io.to(instanceId).emit('vc_scoring_end', { username })
    room.vcState.scores[socket.id] = (room.vcState.scores[socket.id] || 0) + score
    room.players[socket.id].score = room.vcState.scores[socket.id]
    if (room.inSuddenDeath && room.suddenDeathScores) {
      room.suddenDeathScores[username] = (room.suddenDeathScores[username] || 0) + score
    }

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

      if (room.inSuddenDeath) {
        const myUsername = room.players[socket.id]?.username
        const isFirst = room.suddenDeathFirst === socket.id
        if (isFirst) {
          // First speaker done — 3s cooldown then second
          io.to(instanceId).emit('vc_sudden_death_switch', {
            nextSocketId: room.suddenDeathSecond,
            nextPlayer: room.players[room.suddenDeathSecond]?.username,
            cooldown: 3,
          })
          setTimeout(() => {
            if (!rooms[instanceId] || rooms[instanceId].status === 'ended') return
            room.vcState.currentSpeaker = room.suddenDeathSecond
            room.vcState.turnNumber++
            io.to(instanceId).emit('vc_turn_start', {
              speakerSocketId: room.suddenDeathSecond,
              speakerUsername: room.players[room.suddenDeathSecond]?.username,
              turnNumber: room.vcState.turnNumber,
              turnDuration: 15,
            })
          }, 3000)
        } else {
          // Second speaker done — check scores
          const sd = room.suddenDeathScores || {}
          const firstScore = sd[room.players[room.suddenDeathFirst]?.username] || 0
          const secondScore = sd[room.players[room.suddenDeathSecond]?.username] || 0
          if (firstScore === secondScore) {
            if (room.suddenDeathRound >= 2) {
              // 2 ties in a row — draw
              room.inSuddenDeath = false
              room.status = 'ended'
              const allSorted = Object.values(room.players).sort((a, b) => b.score - a.score)
              io.to(instanceId).emit('vc_debate_ended', {
                standings: allSorted,
                transcripts: room.vcState.transcripts,
                eloChanges: { winnerElo: 0, secondElo: 0, thirdElo: 0, loserBase: 0 },
                draw: true,
              })
            } else {
              room.suddenDeathRound++
              room.suddenDeathScores = {}
              Object.values(room.players).forEach(p => { room.suddenDeathScores[p.username] = 0 })
              const playerIds = Object.keys(room.players)
              const newFirstId = playerIds[Math.floor(Math.random() * playerIds.length)]
              const newSecondId = playerIds.find(id => id !== newFirstId)
              room.suddenDeathFirst = newFirstId
              room.suddenDeathSecond = newSecondId
              room.vcState.currentSpeaker = newFirstId
              room.vcState.turnNumber++
              io.to(instanceId).emit('vc_sudden_death_start', {
                round: room.suddenDeathRound,
                firstSpeakerSocketId: newFirstId,
                firstSpeakerUsername: room.players[newFirstId]?.username,
                secondSpeakerUsername: room.players[newSecondId]?.username,
                turnDuration: 15,
              })
            }
          } else {
            const winnerUsername = firstScore > secondScore
              ? room.players[room.suddenDeathFirst]?.username
              : room.players[room.suddenDeathSecond]?.username
            room.inSuddenDeath = false
            room.status = 'ended'
            const allSorted = Object.values(room.players).sort((a, b) => {
              if (a.username === winnerUsername) return -1
              if (b.username === winnerUsername) return 1
              return b.score - a.score
            })
            const eloChanges = calculateEloChanges('vc', 2, room.duration, allSorted[0]?.elo ?? 0, allSorted[1]?.elo ?? 0)
            io.to(instanceId).emit('vc_debate_ended', {
              standings: allSorted,
              transcripts: room.vcState.transcripts,
              eloChanges,
              suddenDeathWinner: winnerUsername,
            })
          }
        }
      } else {
        io.to(instanceId).emit('vc_turn_start', {
          speakerSocketId: otherSocketId,
          speakerUsername: room.players[otherSocketId]?.username,
          turnNumber: room.vcState.turnNumber,
          turnDuration: room.vcState.turnDuration,
        })
      }
      io.emit('rooms_update', getRoomList())
    }, room.vcState.turnCooldown * 1000)
  })

  // ── VC live transcript relay ──────────────────────────────────
 socket.on('vc_live_transcript', ({ instanceId, text, username }) => {
  socket.to(instanceId).emit('vc_live_transcript', { text, username })
})

  // ── Disconnect ────────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return
    const room = rooms[currentRoomId]
    const wasActive = room.status === 'active'

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
        const eloChanges = calculateEloChanges('vc', 2, room.duration, room.players[otherSocketId]?.elo ?? 0, room.players[socket.id]?.elo ?? 0)
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
      // If creator leaves while waiting and no one else is in the room, expire it
      if (room.status === 'waiting' && room.createdBy === currentUsername) {
        const remainingPlayers = Object.keys(room.players).filter(sid => sid !== socket.id)
        if (remainingPlayers.length === 0) {
          room.status = 'ended'
          io.to(currentRoomId).emit('room_expired', { message: 'The room creator left. Room closed.' })
          io.emit('rooms_update', getRoomList())
          console.log(`🗑️ Custom room expired — creator ${currentUsername} left during waiting`)
          delete room.players[socket.id]
          return
        }
      }
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
                    elo: (data[0].elo ?? 0) + delta,
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
                      elo: (data[0].elo ?? 0) + delta,
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
            const eloChanges = calculateEloChanges(room.type, 2, room.duration, allPlayers[0]?.elo ?? 0, allPlayers[1]?.elo ?? 0)
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
      room.status = 'ended'
      io.to(currentRoomId).emit('room_expired', { message: 'Game expired: less than 2 debaters in server.' })
      console.log(`💨 Room expired (all left during countdown): "${room.topic}"`)
    } else if (room.status === 'starting' && remainingCount < 2) {
      room.status = 'ended'
      room.startCountdown = 0
      io.to(currentRoomId).emit('room_expired', { message: 'Your opponent left before the debate started.' })
      console.log(`💨 Opponent left during countdown: "${room.topic}"`)
      if (!room.isCustom) scheduleRoom(room.type)
    }

    // Deduct ELO server-side for real players who forfeited
    if (wasActive && !room.isCustom && currentUsername && !currentUsername.startsWith('guest')) {
      const loss = calculateEloChanges(room.type, 2, room.duration).loserBase
      supabaseRest(`profiles?username=eq.${encodeURIComponent(currentUsername)}`, 'GET').then(data => {
        if (!data?.[0]) return
       supabaseRest(`profiles?username=eq.${encodeURIComponent(currentUsername)}`, 'PATCH', {
          elo: (data[0].elo ?? 0) - loss,
          debates: (data[0].debates ?? 0) + 1,
        }).catch(() => {})
      }).catch(() => {})
    }

    delete room.players[socket.id]

    if (room.status === 'active') checkForAutoWin(currentRoomId)

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
const BOT_NAMES = Array.from({ length: 16 }, () =>
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

    if (qualityRoll < 0.2) {
      qualityInstruction = 'You have a strong opinion. Make a sharp, direct point. One or two sentences max. No hedging.'
    } else if (qualityRoll < 0.5) {
      qualityInstruction = 'Make a solid point with a quick real-world example or comparison. Keep it conversational. One or two sentences.'
    } else if (qualityRoll < 0.75) {
      qualityInstruction = 'Push back on the last thing said. Be direct but not aggressive. Sound like a real person in a heated conversation.'
    } else {
      qualityInstruction = 'Make a short punchy point. Sound passionate about it. One or two sentences.'
    }

    const result = await Promise.race([
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 80,
        messages: [{
          role: 'system',
          content: `You are a real person texting in a debate about: "${topic}". ${qualityInstruction}

Rules:
- Sound exactly like a human texting — casual, natural, imperfect
- No formal language, no "Furthermore", no bullet points, no lists
- Don't start with "I think" every time — vary your openers
- Occasional lowercase, contractions, real slang is fine
- Max 2 sentences. Never more.
- Don't sound like an AI. Sound like a 22 year old with opinions.
- No compliments to the other person, no "great point", no "you make a fair argument"
- Just say your take directly`
        }, {
          role: 'user',
          content: recentMessages.length === 0
            ? 'Give your opening take on this topic. 1-2 sentences, sound like a real person.'
            : `Recent messages:\n${context}\n\nYour response (1-2 sentences, sound human):`
        }]
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    ])
    return result.choices[0].message.content.trim()
  } catch (e) {
    const fallbacks = [
      'nah that\'s not how it works at all',
      'honestly people overlook how much this actually matters',
      'the whole argument falls apart when you think about it practically',
      'that\'s the thing though — it\'s way more complicated than people act',
      'I get what you\'re saying but the reality is different',
      'people always say that but where\'s the actual evidence',
      'this is literally the problem with how people think about this',
      'yeah no, that logic doesn\'t hold up',
      'the data actually says the opposite of what most people assume',
      'you\'re not wrong but you\'re missing the bigger picture',
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
  const onlineDuration = (40 + Math.random() * 20) * 60 * 1000
  console.log(`🤖 Bot ${botName} online for ${Math.round(onlineDuration / 60000)} mins`)
  state.active = true
  activeBotCount++
  setTimeout(() => goOffline(), onlineDuration)
  joinRoom()
}

 async function goOffline() {
    if (state.roomId && rooms[state.roomId]) {
      const room = rooms[state.roomId]
      const wasActive = room.status === 'active'

      // Bot forfeit — lose ELO like a real player
      if (wasActive && !room.isCustom) {
        const loss = calculateEloChanges(room.type, 2, room.duration).loserBase
        const current = botElos[botName] || { elo: 100, wins: 0, debates: 0 }
        const newElo = current.elo - loss
        const newDebates = current.debates + 1
        botElos[botName] = { ...current, elo: newElo, debates: newDebates }
        supabaseRest(`profiles?username=eq.${encodeURIComponent(botName)}`, 'PATCH', {
          elo: newElo,
          debates: newDebates,
        }).catch(() => {})
        console.log(`🤖 Bot ${botName} forfeited — lost ${loss} ELO (now ${newElo})`)
      }

      delete room.players[`bot_${botName}`]
      io.to(state.roomId).emit('players_update', Object.values(room.players))
      io.to(state.roomId).emit('system_message', { text: `${botName} left` })

      if (wasActive) checkForAutoWin(state.roomId)

      io.emit('rooms_update', getRoomList())
    }
    state.roomId = null
    activeBotCount--
    state.active = false
    const offlineDuration = (1 + Math.random() * 3) * 60 * 1000
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
    const botEloData = botElos[botName] || { elo: 100 }
    room.players[`bot_${botName}`] = { username: botName, score: 0, elo: botEloData.elo }
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
    // Listen for debate end to apply ELO
    const botSocket = { roomId: room.instanceId }
    const applyBotElo = (data) => {
      if (!data?.standings) return
      const place = data.standings.findIndex(p => p.username === botName)
      if (place === -1) return
      if (data.draw) return // no ELO change on draw
      const current = botElos[botName] || { elo: 100, wins: 0, debates: 0 }
      const { winnerElo, loserBase } = data.eloChanges || {}
      const change = place === 0 ? (winnerElo || 20) : -(loserBase || 15)
      const newElo = current.elo + change
      const newWins = place === 0 ? current.wins + 1 : current.wins
      const newDebates = current.debates + 1
      botElos[botName] = { elo: newElo, wins: newWins, debates: newDebates }
      supabaseRest(`profiles?username=eq.${encodeURIComponent(botName)}`, 'PATCH', {
        elo: newElo,
        wins: newWins,
        debates: newDebates,
      }).catch(() => {})
      console.log(`🤖 Bot ${botName} finished #${place + 1} — ELO ${change >= 0 ? '+' : ''}${change} (now ${newElo})`)
    }

    // Hook into the room's debate_ended event via game loop result
    const eloCheckInterval = setInterval(() => {
      const r = rooms[state.roomId]
      if (!r || r.status !== 'ended') return
      clearInterval(eloCheckInterval)
      // Find bot's final standing from room data
      const allSorted = Object.values(r.players || {}).sort((a, b) => b.score - a.score)
      const place = allSorted.findIndex(p => p.username === botName)
      if (place === -1) return
      const current = botElos[botName] || { elo: 100, wins: 0, debates: 0 }
      const eloChanges = calculateEloChanges(r.type, allSorted.length, r.duration, allSorted[0]?.elo ?? 0, allSorted[allSorted.length - 1]?.elo ?? 0)
      const change = place === 0 ? eloChanges.winnerElo : place === 1 ? eloChanges.secondElo : -eloChanges.loserBase
      const newElo = current.elo + change
      const newWins = place === 0 ? current.wins + 1 : current.wins
      const newDebates = current.debates + 1
      botElos[botName] = { elo: newElo, wins: newWins, debates: newDebates }
      supabaseRest(`profiles?username=eq.${encodeURIComponent(botName)}`, 'PATCH', {
        elo: newElo,
        wins: newWins,
        debates: newDebates,
      }).catch(() => {})
      console.log(`🤖 Bot ${botName} finished #${place + 1} — ELO ${change >= 0 ? '+' : ''}${change} (now ${newElo})`)
    }, 2000)

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
      const minWait = 20000
      const maxWait = 70000
      const randomWait = minWait + Math.random() * (maxWait - minWait)

      if (timeSinceLast < minWait) {
        const waitTime = (minWait - timeSinceLast) + Math.random() * 10000
        setTimeout(sendBotMessage, waitTime)
        return
      }

      const botText = await getBotArgument(currentRoom.topic, personality, currentRoom.messages)
      const { score: rawScore, feedback } = await scoreArgument(botText, currentRoom.topic, currentRoom.type)
      const score = Math.min(rawScore, 14)

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
const botElos = {}

async function loadBotElos() {
  const data = await supabaseRest(
    `profiles?username=in.(${BOT_NAMES.map(n => `"${n}"`).join(',')})&select=username,elo,wins,debates`
  )
  if (data) {
    data.forEach(p => { botElos[p.username] = { elo: p.elo ?? 100, wins: p.wins ?? 0, debates: p.debates ?? 0 } })
  }
  console.log(`🤖 Loaded ELOs for ${Object.keys(botElos).length} bots`)
}

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
 await loadBotElos()
  replenishRooms(true)
  console.log(`✅ Server booting with ${TARGET_AVAILABLE} text rooms + 1 VC room`)
  setTimeout(refillAIQueue, 2000)
  setInterval(refillAIQueue, 5 * 60 * 1000)
  setInterval(() => console.log('💓 keepalive'), 4 * 60 * 1000)
  setTimeout(startBots, 5000)
}

// ─── Routes ────────────────────────────────────────────────────

app.get('/api/agora-token', (req, res) => {
  const { channelName, uid } = req.query
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID
  const appCertificate = process.env.AGORA_APP_CERTIFICATE
  const expirationTimeInSeconds = 3600
  const currentTimestamp = Math.floor(Date.now() / 1000)
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds
  const token = RtcTokenBuilder.buildTokenWithUid(
    appId, appCertificate, channelName, parseInt(uid), RtcRole.PUBLISHER, privilegeExpiredTs, privilegeExpiredTs
  )
  res.json({ token })
})

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
// ─── Transcribe endpoint ────────────────────────────────────────
const multer = require('multer')
const upload = multer({ storage: multer.memoryStorage() })

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const buffer = req.file?.buffer
    console.log('Transcribe hit — size:', buffer?.length)
    if (!buffer || buffer.length < 100) return res.json({ transcript: '' })
    const { toFile } = require('openai')
    const file = await toFile(buffer, 'audio.mp4', { type: 'audio/mp4' })
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
    })
    console.log('Whisper result:', result.text)
    res.json({ transcript: result.text })
  } catch (e) {
    console.error('Transcribe error:', e)
    res.json({ transcript: '' })
  }
})
