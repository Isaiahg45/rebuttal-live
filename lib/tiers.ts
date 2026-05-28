export const TIERS = [
  { min: 1000, label: 'Rebutter', short: 'REBUTTER', emoji: '💎', color: '#ffd60a', glow: 'rgba(255,214,10,0.6)', bg: 'rgba(255,214,10,0.1)', special: true },
  { min: 700,  label: 'Competitive Debater', short: 'COMP DEBATER', emoji: '🏆', color: '#a855f7', glow: 'rgba(168,85,247,0.5)', bg: 'rgba(168,85,247,0.08)' },
  { min: 500,  label: 'Debater', short: 'DEBATER', emoji: '⚔️', color: '#e63946', glow: 'rgba(230,57,70,0.4)', bg: 'rgba(230,57,70,0.08)' },
  { min: 400,  label: 'Competitive Arguer', short: 'COMP ARGUER', emoji: '🔥', color: '#ff6b35', glow: 'rgba(255,107,53,0.35)', bg: 'rgba(255,107,53,0.08)' },
  { min: 300,  label: 'Arguer', short: 'ARGUER', emoji: '💬', color: '#ff9500', glow: 'rgba(255,149,0,0.35)', bg: 'rgba(255,149,0,0.08)' },
  { min: 200,  label: 'Competitive Talker', short: 'COMP TALKER', emoji: '🗣️', color: '#22c55e', glow: 'rgba(34,197,94,0.35)', bg: 'rgba(34,197,94,0.08)' },
  { min: 100,  label: 'Casual Talker', short: 'CASUAL TALKER', emoji: '😄', color: '#00d4ff', glow: 'rgba(0,212,255,0.35)', bg: 'rgba(0,212,255,0.08)' },
  { min: 0,    label: 'Incompetent', short: 'INCOMPETENT', emoji: '🤔', color: '#666', glow: 'rgba(100,100,100,0.3)', bg: 'rgba(100,100,100,0.05)' },
]

export function getTier(elo: number) {
  return TIERS.find(t => elo >= t.min) || TIERS[TIERS.length - 1]
}

export function getNextTier(elo: number) {
  const idx = TIERS.findIndex(t => elo >= t.min)
  return idx > 0 ? TIERS[idx - 1] : null
}