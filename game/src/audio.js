// Tiny synthesized sound effects with the Web Audio API: no audio files,
// everything is an oscillator blip. Audio starts only after a user gesture.
export function createAudio() {
  let context = null;
  let alarmOsc = null;
  let alarmGain = null;

  function ensure() {
    if (context === null) {
      try {
        const Ctor = window.AudioContext ?? window.webkitAudioContext;
        if (!Ctor) return null;
        context = new Ctor();
      } catch {
        return null;
      }
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function blip(freq, at, duration, type, volume) {
    const ctx = ensure();
    if (ctx === null) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime + at);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + at);
    osc.stop(ctx.currentTime + at + duration + 0.05);
  }

  return {
    unlock() {
      ensure();
    },
    grab() {
      blip(880, 0, 0.12, 'sine', 0.18);
      blip(1318, 0.08, 0.18, 'sine', 0.18);
    },
    diamond() {
      blip(659, 0, 0.12, 'triangle', 0.2);
      blip(988, 0.1, 0.12, 'triangle', 0.2);
      blip(1318, 0.2, 0.3, 'triangle', 0.2);
    },
    caught() {
      blip(320, 0, 0.25, 'sawtooth', 0.16);
      blip(180, 0.2, 0.4, 'sawtooth', 0.16);
    },
    win() {
      [523, 659, 784, 1046].forEach((freq, i) => blip(freq, i * 0.12, 0.25, 'triangle', 0.2));
    },
    level() {
      [392, 523, 659].forEach((freq, i) => blip(freq, i * 0.1, 0.2, 'triangle', 0.18));
    },
    alarm(on) {
      const ctx = ensure();
      if (ctx === null) return;
      if (on && alarmOsc === null) {
        alarmOsc = ctx.createOscillator();
        alarmGain = ctx.createGain();
        alarmOsc.type = 'square';
        alarmOsc.frequency.value = 620;
        alarmGain.gain.value = 0.03;
        alarmOsc.connect(alarmGain).connect(ctx.destination);
        alarmOsc.start();
      } else if (!on && alarmOsc !== null) {
        try { alarmOsc.stop(); } catch { /* already stopped */ }
        alarmOsc = null;
        alarmGain = null;
      }
    },
  };
}
