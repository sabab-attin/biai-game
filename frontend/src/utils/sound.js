// C Major Pentatonic gentle wave (no half-steps/dissonance, zero octave cliff)
const SOOTHING_BELL_WAVE = [
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
  1046.5, // C6
  880.0,  // A5
  783.99, // G5
  659.25, // E5
  587.33, // D5
];

let audioCtx = null;
let dryBus = null;
let fxBus = null;
let lastTickTime = 0;
let waveStep = 0;

function buildWarmReverbImpulse(ctx, seconds = 1.25) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(2, length, rate);

  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i += 1) {
      const progress = i / length;
      const envelope = Math.pow(1 - progress, 2.8);
      // Warm one-pole damped noise creates a velvet concert-chime tail without hiss
      const white = Math.random() * 2 - 1;
      lp = lp * 0.72 + white * 0.28;
      data[i] = lp * envelope;
    }
  }
  return buffer;
}

function getAudioEngine() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;

  if (!audioCtx) {
    audioCtx = new Ctx();

    const masterFilter = audioCtx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.value = 3400;
    masterFilter.Q.value = 0.55;

    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 20;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.18;

    masterFilter.connect(compressor);
    compressor.connect(audioCtx.destination);

    dryBus = audioCtx.createGain();
    dryBus.gain.value = 0.85;
    dryBus.connect(masterFilter);

    fxBus = audioCtx.createGain();
    fxBus.gain.value = 1.0;

    // Gentle acoustic bloom via filtered slapback delay + warm hall reverb
    try {
      const convolver = audioCtx.createConvolver();
      convolver.buffer = buildWarmReverbImpulse(audioCtx, 1.25);
      const reverbWet = audioCtx.createGain();
      reverbWet.gain.value = 0.28;
      fxBus.connect(convolver);
      convolver.connect(reverbWet);
      reverbWet.connect(masterFilter);
    } catch {
      // Fall back cleanly if ConvolverNode is unavailable
    }

    try {
      const delay = audioCtx.createDelay(1.0);
      delay.delayTime.value = 0.145;
      const delayTone = audioCtx.createBiquadFilter();
      delayTone.type = 'lowpass';
      delayTone.frequency.value = 2100;
      const feedback = audioCtx.createGain();
      feedback.gain.value = 0.22;
      const delayWet = audioCtx.createGain();
      delayWet.gain.value = 0.16;

      fxBus.connect(delay);
      delay.connect(delayTone);
      delayTone.connect(delayWet);
      delayWet.connect(masterFilter);
      delayTone.connect(feedback);
      feedback.connect(delay);
    } catch {
      // Optional spatial delay
    }
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return { ctx: audioCtx, dryBus, fxBus };
}

function strikeSoothingBell(
  ctx,
  dryOut,
  fxOut,
  startTime,
  freq,
  { volume = 0.048, decay = 0.45, shimmer = 0.22 } = {}
) {
  // Primary pure bell voice with subtle decaying FM mallet kiss (celesta character)
  const carrier = ctx.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.setValueAtTime(freq, startTime);

  const modulator = ctx.createOscillator();
  modulator.type = 'sine';
  modulator.frequency.setValueAtTime(freq * 2.756, startTime);

  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(freq * shimmer, startTime);
  modGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.045);

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, startTime);
  env.gain.linearRampToValueAtTime(volume, startTime + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);

  carrier.connect(env);
  env.connect(dryOut);
  env.connect(fxOut);

  // Soft octave harmonic bloom for natural bell resonance
  const overtone = ctx.createOscillator();
  overtone.type = 'sine';
  overtone.frequency.setValueAtTime(freq * 2, startTime);

  const overEnv = ctx.createGain();
  overEnv.gain.setValueAtTime(0.0001, startTime);
  overEnv.gain.linearRampToValueAtTime(volume * 0.18, startTime + 0.005);
  overEnv.gain.exponentialRampToValueAtTime(0.0001, startTime + decay * 0.58);

  overtone.connect(overEnv);
  overEnv.connect(dryOut);
  overEnv.connect(fxOut);

  const stopAt = startTime + decay + 0.03;
  carrier.start(startTime);
  modulator.start(startTime);
  overtone.start(startTime);

  carrier.stop(stopAt);
  modulator.stop(stopAt);
  overtone.stop(stopAt);
}

export function unlockAudio() {
  getAudioEngine();
}

export function resetSpinSound() {
  waveStep = 0;
  lastTickTime = 0;
}

export function playPegTick({ speed = 0.5, progress = 0 } = {}) {
  const engine = getAudioEngine();
  if (!engine) return;

  try {
    const { ctx, dryBus: dryOut, fxBus: fxOut } = engine;
    const now = ctx.currentTime;

    // Gentle minimum spacing prevents rapid early ticks from sounding hectic
    if (now - lastTickTime < 0.062) return;
    lastTickTime = now;

    const clampedSpeed = Math.max(0, Math.min(1, speed));
    const clampedProgress = Math.max(0, Math.min(1, progress));

    const freq = SOOTHING_BELL_WAVE[waveStep % SOOTHING_BELL_WAVE.length];
    waveStep += 1;

    // Decay opens gracefully as the wheel slows down for calm anticipation
    const decay = 0.28 + clampedProgress * 0.36;
    const volume = 0.032 + (1 - clampedSpeed) * 0.012;
    const shimmer = 0.16 + (1 - clampedSpeed) * 0.08;

    strikeSoothingBell(ctx, dryOut, fxOut, now, freq, {
      volume,
      decay,
      shimmer,
    });
  } catch {
    // Audio playback is optional enhancement
  }
}

export function playWinFanfare() {
  const engine = getAudioEngine();
  if (!engine) return;

  try {
    const { ctx, dryBus: dryOut, fxBus: fxOut } = engine;
    const now = ctx.currentTime;
    const chimeNotes = [523.25, 659.25, 783.99, 1046.5];

    chimeNotes.forEach((freq, idx) => {
      const start = now + idx * 0.09;
      const isFinal = idx === chimeNotes.length - 1;
      strikeSoothingBell(ctx, dryOut, fxOut, start, freq, {
        volume: isFinal ? 0.062 : 0.048,
        decay: isFinal ? 1.1 : 0.65,
        shimmer: isFinal ? 0.26 : 0.2,
      });
    });
  } catch {
    // Audio playback is optional enhancement
  }
}

export function playCountdownTick(step = 3) {
  const engine = getAudioEngine();
  if (!engine) return;

  try {
    const { ctx, dryBus: dryOut, fxBus: fxOut } = engine;
    const freqMap = { 3: 659.25, 2: 783.99, 1: 880.0 };
    const freq = freqMap[step] || 659.25;
    strikeSoothingBell(ctx, dryOut, fxOut, ctx.currentTime, freq, {
      volume: 0.045,
      decay: 0.35,
      shimmer: 0.2,
    });
  } catch {
    // Audio playback is optional enhancement
  }
}

export function playShutterChime() {
  const engine = getAudioEngine();
  if (!engine) return;

  try {
    const { ctx, dryBus: dryOut, fxBus: fxOut } = engine;
    const now = ctx.currentTime;
    strikeSoothingBell(ctx, dryOut, fxOut, now, 783.99, {
      volume: 0.05,
      decay: 0.4,
      shimmer: 0.24,
    });
    strikeSoothingBell(ctx, dryOut, fxOut, now + 0.065, 1046.5, {
      volume: 0.06,
      decay: 0.85,
      shimmer: 0.26,
    });
  } catch {
    // Audio playback is optional enhancement
  }
}
