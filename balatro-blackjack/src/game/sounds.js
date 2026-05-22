// =============================================
// BALATRO BLACKJACK - Sound Effects (Web Audio API)
// =============================================

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq, duration, type = 'sine', volume = 0.15) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Ignore audio errors
  }
}

export function sfxCardDeal() {
  playTone(800, 0.08, 'triangle', 0.1);
  setTimeout(() => playTone(600, 0.06, 'triangle', 0.08), 40);
}

export function sfxCardFlip() {
  playTone(1200, 0.06, 'triangle', 0.12);
}

export function sfxHit() {
  playTone(500, 0.1, 'square', 0.08);
}

export function sfxBust() {
  playTone(200, 0.3, 'sawtooth', 0.15);
  setTimeout(() => playTone(150, 0.4, 'sawtooth', 0.1), 150);
}

export function sfxWin() {
  playTone(523, 0.15, 'sine', 0.12);
  setTimeout(() => playTone(659, 0.15, 'sine', 0.12), 100);
  setTimeout(() => playTone(784, 0.2, 'sine', 0.15), 200);
  setTimeout(() => playTone(1047, 0.3, 'sine', 0.12), 350);
}

export function sfxLose() {
  playTone(400, 0.2, 'sawtooth', 0.1);
  setTimeout(() => playTone(300, 0.3, 'sawtooth', 0.08), 200);
}

export function sfxBuy() {
  playTone(880, 0.1, 'sine', 0.1);
  setTimeout(() => playTone(1100, 0.15, 'sine', 0.12), 80);
}

export function sfxChips() {
  for (let i = 0; i < 5; i++) {
    setTimeout(() => playTone(2000 + Math.random() * 1000, 0.04, 'triangle', 0.06), i * 30);
  }
}

export function sfxBlackjack() {
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((n, i) => {
    setTimeout(() => playTone(n, 0.2, 'sine', 0.15), i * 80);
  });
}
