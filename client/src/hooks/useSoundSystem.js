import { useRef, useCallback, useEffect } from 'react';

export function useSoundSystem(windSpeed = 15, enabled = true) {
  const ctxRef = useRef(null);
  const windGainRef = useRef(null);
  const initedRef = useRef(false);

  const init = useCallback(() => {
    if (initedRef.current) return;
    initedRef.current = true;

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;

      // White noise buffer for wind ambiance
      const bufSize = ctx.sampleRate * 3;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 350;
      lowpass.Q.value = 0.5;

      const gain = ctx.createGain();
      gain.gain.value = 0;
      windGainRef.current = gain;

      src.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch (e) {
      console.warn('Web Audio not available:', e);
    }
  }, []);

  // Adjust wind volume based on Beaufort
  useEffect(() => {
    if (!windGainRef.current || !ctxRef.current) return;
    const vol = enabled ? Math.min(0.22, (windSpeed / 35) * 0.22) : 0;
    windGainRef.current.gain.setTargetAtTime(vol, ctxRef.current.currentTime, 1.2);
  }, [windSpeed, enabled]);

  // Short noise burst = sail cloth flapping
  const playSailFlap = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const bufSize = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.5);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    src.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }, []);

  // Three ascending tones = nautical bell for waypoint
  const playWaypointReached = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + i * 0.2;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  }, []);

  // Rising sweep = boost activated
  const playBoostActivate = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.28);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }, []);

  // Whoosh = wind shift notification
  const playWindShift = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const bufSize = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      const env = Math.sin((i / bufSize) * Math.PI);
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, now);
    lp.frequency.exponentialRampToValueAtTime(200, now + 0.6);
    const gain = ctx.createGain();
    gain.gain.value = 0.14;
    src.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }, []);

  return { init, playSailFlap, playWaypointReached, playBoostActivate, playWindShift };
}
