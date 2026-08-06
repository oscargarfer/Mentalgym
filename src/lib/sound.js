let ctx = null
let enabled = true

const ac = () => {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export const setSoundEnabled = (v) => {
  enabled = !!v
}

const tone = (freq, ms, gain = 0.05, type = 'sine') => {
  if (!enabled) return
  const c = ac()
  if (!c) return
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, c.currentTime)
  g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ms / 1000)
  osc.connect(g).connect(c.destination)
  osc.start()
  osc.stop(c.currentTime + ms / 1000 + 0.02)
}

export const sfx = {
  tick: () => tone(880, 40, 0.025, 'square'),
  hook: () => tone(1320, 55, 0.04, 'triangle'),
  ok: () => tone(1046, 90, 0.05, 'sine'),
  fail: () => tone(180, 160, 0.05, 'sawtooth'),
  start: () => tone(660, 120, 0.05, 'sine'),
  finish: () => {
    tone(660, 100, 0.05)
    setTimeout(() => tone(880, 100, 0.05), 110)
    setTimeout(() => tone(1320, 220, 0.05), 220)
  },
}
