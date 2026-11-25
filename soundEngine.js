(function () {
  'use strict';

  /**
   * Pure Web Audio API tactical sound synthesizer for SCiPNET Terminal.
   * Zero external audio files. AudioContext is created lazily on first user gesture.
   */
  let ctx = null;
  let masterGain = null;
  let enabled = true;
  let userInteracted = false;
  let whiteBuf = null;
  let pinkBuf = null;
  let ambientWhiteBuf = null;
  let ambientBus = null;
  let ambientTarget = 0;
  let pageHidden = typeof document !== 'undefined' ? Boolean(document.hidden) : false;
  let lastDecryptTs = 0;
  let last079BeepTs = 0;
  let alarmWanted = false;
  let alarmInterval = null;
  let activeAlarmNodes = [];
  let activeTransientNodes = [];
  let bioScan = null;
  const listeners = new Set();

  const MASTER_LEVEL = 0.22;
  const AMBIENT_LEVEL = 1.0;
  const AMBIENT_FADE_SEC = 0.4;
  const AMBIENT_HUM_55_GAIN = 0.0095;
  const AMBIENT_HUM_60_GAIN = 0.006;
  const AMBIENT_VENT_GAIN = 0.058;
  const AMBIENT_VENT_CUTOFF = 340;

  function buildNoiseBuffers(audioCtx) {
    const sr = audioCtx.sampleRate;

    // White noise buffer (1.2s)
    const wLen = Math.floor(sr * 1.2);
    const wBuf = audioCtx.createBuffer(1, wLen, sr);
    const wData = wBuf.getChannelData(0);
    for (let i = 0; i < wLen; i++) {
      wData[i] = Math.random() * 2 - 1;
    }

    // Seamless 4.0s white noise buffer with ~50ms cosine crossfade for continuous ventilation
    const aLen = Math.floor(sr * 4.0);
    const aBuf = audioCtx.createBuffer(1, aLen, sr);
    const aData = aBuf.getChannelData(0);
    for (let i = 0; i < aLen; i++) {
      aData[i] = Math.random() * 2 - 1;
    }
    const xfade = Math.min(Math.floor(sr * 0.05), Math.floor(aLen / 4));
    for (let i = 0; i < xfade; i++) {
      const fadeIn = 0.5 - 0.5 * Math.cos((Math.PI * i) / xfade);
      const tailIdx = aLen - xfade + i;
      const blended = aData[i] * fadeIn + aData[tailIdx] * (1 - fadeIn);
      aData[i] = blended;
      aData[tailIdx] = blended;
    }

    // Pink noise buffer (2.5s) via Paul Kellet's filter
    const pLen = Math.floor(sr * 2.5);
    const pBuf = audioCtx.createBuffer(1, pLen, sr);
    const pData = pBuf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < pLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
      pData[i] = Math.max(-1, Math.min(1, pink));
    }

    whiteBuf = wBuf;
    pinkBuf = pBuf;
    ambientWhiteBuf = aBuf;
  }

  function rampGainLinear(gainParam, target, durationSec) {
    if (!ctx || !gainParam) return;
    const now = ctx.currentTime;
    const current = Number.isFinite(gainParam.value) ? gainParam.value : 0;
    gainParam.cancelScheduledValues(now);
    gainParam.setValueAtTime(current, now);
    gainParam.linearRampToValueAtTime(target, now + Math.max(0.01, durationSec));
  }

  function initAmbientBus(audioCtx) {
    if (!audioCtx || ambientBus) return;
    try {
      const now = audioCtx.currentTime;
      const busGain = audioCtx.createGain();
      busGain.gain.setValueAtTime(0, now);
      busGain.connect(audioCtx.destination);

      // Layer 1: Ultra-low 55Hz industrial power hum
      const hum55Osc = audioCtx.createOscillator();
      hum55Osc.type = 'sine';
      hum55Osc.frequency.setValueAtTime(55, now);
      const hum55Gain = audioCtx.createGain();
      hum55Gain.gain.setValueAtTime(AMBIENT_HUM_55_GAIN, now);
      hum55Osc.connect(hum55Gain);
      hum55Gain.connect(busGain);

      // Layer 2: Subtle 60Hz mains beat against 55Hz
      const hum60Osc = audioCtx.createOscillator();
      hum60Osc.type = 'sine';
      hum60Osc.frequency.setValueAtTime(60, now);
      const hum60Gain = audioCtx.createGain();
      hum60Gain.gain.setValueAtTime(AMBIENT_HUM_60_GAIN, now);
      hum60Osc.connect(hum60Gain);
      hum60Gain.connect(busGain);

      // Layer 3: Low-pass filtered server rack ventilation airflow
      const ventSrc = audioCtx.createBufferSource();
      ventSrc.buffer = ambientWhiteBuf || whiteBuf;
      ventSrc.loop = true;

      const ventLp = audioCtx.createBiquadFilter();
      ventLp.type = 'lowpass';
      ventLp.frequency.setValueAtTime(AMBIENT_VENT_CUTOFF, now);
      ventLp.Q.setValueAtTime(0.65, now);

      const ventGain = audioCtx.createGain();
      ventGain.gain.setValueAtTime(AMBIENT_VENT_GAIN, now);

      ventSrc.connect(ventLp);
      ventLp.connect(ventGain);
      ventGain.connect(busGain);

      hum55Osc.start(now);
      hum60Osc.start(now);
      ventSrc.start(now);

      ambientBus = {
        gain: busGain,
        hum55Osc,
        hum60Osc,
        ventSrc,
        ventLp
      };
      ambientTarget = 0;
    } catch (_) {
      ambientBus = null;
    }
  }

  function fadeAmbient(target, durationSec = AMBIENT_FADE_SEC) {
    if (!ctx || !ambientBus) return;
    const nextTarget = Math.max(0, target);
    if (ambientTarget === nextTarget) return;
    ambientTarget = nextTarget;
    rampGainLinear(ambientBus.gain, nextTarget, durationSec);
  }

  function ensureContext() {
    if (!userInteracted) return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    try {
      if (!ctx) {
        ctx = new AudioCtx();
        masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(enabled && !pageHidden ? MASTER_LEVEL : 0.0001, ctx.currentTime);
        masterGain.connect(ctx.destination);
        buildNoiseBuffers(ctx);
        initAmbientBus(ctx);
      }
      if (ctx.state === 'suspended' && !pageHidden) {
        ctx.resume().catch(() => {});
      }
      return ctx;
    } catch (_) {
      return null;
    }
  }

  function unlock() {
    userInteracted = true;
    const c = ensureContext();
    if (c && enabled && !pageHidden) {
      fadeAmbient(AMBIENT_LEVEL, AMBIENT_FADE_SEC);
      if (alarmWanted && !alarmInterval) {
        startAlarmLoop();
      }
    }
  }

  function onFirstGesture() {
    unlock();
    window.removeEventListener('pointerdown', onFirstGesture, true);
    window.removeEventListener('keydown', onFirstGesture, true);
  }

  window.addEventListener('pointerdown', onFirstGesture, { capture: true, passive: true });
  window.addEventListener('keydown', onFirstGesture, { capture: true, passive: true });

  function notifyListeners() {
    listeners.forEach((cb) => {
      try {
        cb(enabled);
      } catch (_) {}
    });
  }

  /**
   * Tactile micro-switch click (~25ms)
   */
  function playClick() {
    if (!enabled || pageHidden) return;
    const c = ensureContext();
    if (!c || !whiteBuf) return;

    try {
      const now = c.currentTime;

      // Transient mechanical snap via bandpass white noise
      const noiseSrc = c.createBufferSource();
      noiseSrc.buffer = whiteBuf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3200, now);
      bp.Q.setValueAtTime(2.5, now);

      const nGain = c.createGain();
      nGain.gain.setValueAtTime(0.18, now);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);

      noiseSrc.connect(bp);
      bp.connect(nGain);
      nGain.connect(masterGain);
      noiseSrc.start(now);
      noiseSrc.stop(now + 0.018);

      // Crisp short pitch-drop blip
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1480, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.018);

      const oGain = c.createGain();
      oGain.gain.setValueAtTime(0.12, now);
      oGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);

      osc.connect(oGain);
      oGain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.025);
    } catch (_) {}
  }

  /**
   * Low-frequency descending dual-tone clearance rejection buzz
   */
  function playDenied() {
    if (!enabled || pageHidden) return;
    const c = ensureContext();
    if (!c) return;

    try {
      const now = c.currentTime;
      const playTone = (startOffset, dur, f1, f2, cutoff, peak) => {
        const t0 = now + startOffset;
        const osc1 = c.createOscillator();
        const osc2 = c.createOscillator();
        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(f1, t0);
        osc2.frequency.setValueAtTime(f2, t0);

        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(cutoff, t0);
        lp.Q.setValueAtTime(2.0, t0);

        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + 0.012);
        g.gain.setValueAtTime(peak * 0.88, t0 + dur - 0.028);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        osc1.connect(lp);
        osc2.connect(lp);
        lp.connect(g);
        g.connect(masterGain);

        osc1.start(t0);
        osc2.start(t0);
        osc1.stop(t0 + dur + 0.015);
        osc2.stop(t0 + dur + 0.015);
        registerTransient([osc1, osc2], g);
      };

      playTone(0, 0.095, 152, 156, 480, 0.14);
      playTone(0.115, 0.15, 112, 115, 420, 0.15);
    } catch (_) {}
  }

  /**
   * Restrained high-frequency teletype/cryptographic static burst (~480ms)
   */
  function playDecrypt() {
    if (!enabled || pageHidden) return;
    const nowMs = performance.now();
    if (nowMs - lastDecryptTs < 120) return;
    lastDecryptTs = nowMs;

    const c = ensureContext();
    if (!c || !whiteBuf) return;

    try {
      const now = c.currentTime;

      // Bandpass filtered stepped static
      const noiseSrc = c.createBufferSource();
      noiseSrc.buffer = whiteBuf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(4200, now);
      bp.Q.setValueAtTime(4.2, now);

      const nGain = c.createGain();
      nGain.gain.setValueAtTime(0.0001, now);
      for (let i = 0; i < 8; i++) {
        const t = now + i * 0.056;
        nGain.gain.setValueAtTime(0.06, t);
        nGain.gain.exponentialRampToValueAtTime(0.015, t + 0.042);
      }
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);

      noiseSrc.connect(bp);
      bp.connect(nGain);
      nGain.connect(masterGain);
      noiseSrc.start(now);
      noiseSrc.stop(now + 0.48);

      // Staggered digital telemetry pips
      for (let i = 0; i < 9; i++) {
        const t = now + i * 0.044;
        const osc = c.createOscillator();
        osc.type = i % 2 === 0 ? 'square' : 'sine';
        osc.frequency.setValueAtTime(1900 + ((i * 397) % 1500), t);

        const g = c.createGain();
        g.gain.setValueAtTime(0.04, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);

        osc.connect(g);
        g.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.02);
      }
    } catch (_) {}
  }

  /**
   * Heavy concrete grinding scrape via lowpass-filtered pink noise (reserved for SCP-173)
   */
  function playScrape(durationSec = 0.9) {
    if (!enabled || pageHidden) return;
    const c = ensureContext();
    if (!c || !pinkBuf) return;

    try {
      const now = c.currentTime;
      const dur = Math.max(0.25, Math.min(2.4, durationSec));

      const noiseSrc = c.createBufferSource();
      noiseSrc.buffer = pinkBuf;

      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.setValueAtTime(3.2, now);
      lp.frequency.setValueAtTime(260, now);
      lp.frequency.linearRampToValueAtTime(160, now + dur * 0.3);
      lp.frequency.linearRampToValueAtTime(310, now + dur * 0.65);
      lp.frequency.linearRampToValueAtTime(140, now + dur);

      const nGain = c.createGain();
      nGain.gain.setValueAtTime(0.0001, now);
      nGain.gain.linearRampToValueAtTime(0.24, now + 0.08);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      noiseSrc.connect(lp);
      lp.connect(nGain);
      nGain.connect(masterGain);
      noiseSrc.start(now);
      noiseSrc.stop(now + dur + 0.02);

      // Sub-harmonic concrete rumble
      const rumble = c.createOscillator();
      rumble.type = 'triangle';
      rumble.frequency.setValueAtTime(54, now);
      rumble.frequency.linearRampToValueAtTime(40, now + dur);

      const rGain = c.createGain();
      rGain.gain.setValueAtTime(0.0001, now);
      rGain.gain.linearRampToValueAtTime(0.08, now + 0.08);
      rGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      rumble.connect(rGain);
      rGain.connect(masterGain);
      rumble.start(now);
      rumble.stop(now + dur + 0.02);
    } catch (_) {}
  }

  /**
   * Metallic clockwork ratchet clacks (reserved for SCP-914)
   */
  function playGear(ticks = 3) {
    if (!enabled || pageHidden) return;
    const c = ensureContext();
    if (!c || !whiteBuf) return;

    try {
      const count = Math.max(1, Math.min(12, ticks));
      const now = c.currentTime;

      for (let i = 0; i < count; i++) {
        const t = now + i * 0.058;

        // Crisp metallic strike transient
        const noiseSrc = c.createBufferSource();
        noiseSrc.buffer = whiteBuf;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(2400, t);
        bp.Q.setValueAtTime(6.0, t);

        const nGain = c.createGain();
        nGain.gain.setValueAtTime(0.14, t);
        nGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.016);

        noiseSrc.connect(bp);
        bp.connect(nGain);
        nGain.connect(masterGain);
        noiseSrc.start(t);
        noiseSrc.stop(t + 0.02);

        // Two inharmonic metallic partials
        [980, 2370].forEach((freq, idx) => {
          const osc = c.createOscillator();
          osc.type = idx === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq + (i % 2) * 35, t);

          const g = c.createGain();
          g.gain.setValueAtTime(idx === 0 ? 0.11 : 0.07, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.036);

          osc.connect(g);
          g.connect(masterGain);
          osc.start(t);
          osc.stop(t + 0.04);
        });
      }
    } catch (_) {}
  }

  /**
   * Pressurized steam exhaust sweep + heavy brass ratchet pawl lock-in (reserved for SCP-914 completion)
   */
  function playSteamRelease() {
    if (!enabled || pageHidden) return;
    const c = ensureContext();
    if (!c || !whiteBuf) return;

    try {
      const now = c.currentTime;

      // Pressurized pneumatic steam blowdown
      const noiseSrc = c.createBufferSource();
      noiseSrc.buffer = whiteBuf;
      noiseSrc.loop = true;

      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.setValueAtTime(1.8, now);
      bp.frequency.setValueAtTime(3600, now);
      bp.frequency.exponentialRampToValueAtTime(1400, now + 0.26);
      bp.frequency.exponentialRampToValueAtTime(620, now + 0.68);

      const sGain = c.createGain();
      sGain.gain.setValueAtTime(0.0001, now);
      sGain.gain.linearRampToValueAtTime(0.22, now + 0.025);
      sGain.gain.setValueAtTime(0.18, now + 0.24);
      sGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.70);

      noiseSrc.connect(bp);
      bp.connect(sGain);
      sGain.connect(masterGain);
      noiseSrc.start(now);
      noiseSrc.stop(now + 0.72);
      registerTransient([noiseSrc], sGain);

      // Heavy mechanical thud when mainspring reaches stop
      const thud = c.createOscillator();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime(165, now + 0.03);
      thud.frequency.exponentialRampToValueAtTime(68, now + 0.125);

      const thudGain = c.createGain();
      thudGain.gain.setValueAtTime(0.0001, now + 0.03);
      thudGain.gain.linearRampToValueAtTime(0.22, now + 0.042);
      thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.125);

      thud.connect(thudGain);
      thudGain.connect(masterGain);
      thud.start(now + 0.03);
      thud.stop(now + 0.14);
      registerTransient([thud], thudGain);

      // Two heavy brass ratchet pawl dead-stops
      [0.04, 0.14].forEach((offset, idx) => {
        const t0 = now + offset;
        const pNoise = c.createBufferSource();
        pNoise.buffer = whiteBuf;

        const pBp = c.createBiquadFilter();
        pBp.type = 'bandpass';
        pBp.frequency.setValueAtTime(2200, t0);
        pBp.Q.setValueAtTime(4.8, t0);

        const pNGain = c.createGain();
        pNGain.gain.setValueAtTime(idx === 0 ? 0.16 : 0.19, t0);
        pNGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.026);

        pNoise.connect(pBp);
        pBp.connect(pNGain);
        pNGain.connect(masterGain);
        pNoise.start(t0);
        pNoise.stop(t0 + 0.03);
        registerTransient([pNoise], pNGain);

        [740, 1840].forEach((freq, pIdx) => {
          const osc = c.createOscillator();
          osc.type = pIdx === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq - idx * 45, t0);

          const g = c.createGain();
          g.gain.setValueAtTime(pIdx === 0 ? 0.14 : 0.09, t0);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);

          osc.connect(g);
          g.connect(masterGain);
          osc.start(t0);
          osc.stop(t0 + 0.12);
          registerTransient([osc], g);
        });
      });
    } catch (_) {}
  }

  function stopActiveAlarmNodes() {
    if (!ctx) {
      activeAlarmNodes = [];
      return;
    }
    const now = ctx.currentTime;
    activeAlarmNodes.forEach(({ osc1, osc2, gainNode }) => {
      try {
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value), now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        osc1.stop(now + 0.09);
        osc2.stop(now + 0.09);
      } catch (_) {}
    });
    activeAlarmNodes = [];
  }

  function playAlarmCycle() {
    if (!enabled || !alarmWanted || pageHidden) return;
    const c = ensureContext();
    if (!c) return;

    try {
      const now = c.currentTime;

      const scheduleTone = (startOffset, dur, f1, f2, peak) => {
        const t0 = now + startOffset;
        const osc1 = c.createOscillator();
        const osc2 = c.createOscillator();
        osc1.type = 'sawtooth';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(f1, t0);
        osc2.frequency.setValueAtTime(f2, t0);

        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(520, t0);
        lp.Q.setValueAtTime(2.0, t0);

        const gainNode = c.createGain();
        gainNode.gain.setValueAtTime(0.0001, t0);
        gainNode.gain.linearRampToValueAtTime(peak, t0 + 0.04);
        gainNode.gain.setValueAtTime(peak, t0 + dur - 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        osc1.connect(lp);
        osc2.connect(lp);
        lp.connect(gainNode);
        gainNode.connect(masterGain);

        osc1.start(t0);
        osc2.start(t0);
        osc1.stop(t0 + dur + 0.02);
        osc2.stop(t0 + dur + 0.02);

        const entry = { osc1, osc2, gainNode };
        activeAlarmNodes.push(entry);
        osc1.onended = () => {
          activeAlarmNodes = activeAlarmNodes.filter((n) => n !== entry);
        };
      };

      // Oppressive two-step facility klaxon
      scheduleTone(0, 0.54, 185.0, 187.5, 0.14);
      scheduleTone(0.6, 0.54, 146.8, 149.0, 0.13);
    } catch (_) {}
  }

  function startAlarmLoop() {
    if (alarmInterval) return;
    playAlarmCycle();
    alarmInterval = setInterval(playAlarmCycle, 1350);
  }

  function stopAlarmLoop() {
    if (alarmInterval) {
      clearInterval(alarmInterval);
      alarmInterval = null;
    }
    stopActiveAlarmNodes();
  }

  function stopTransientAlarms() {
    if (!ctx) {
      activeTransientNodes = [];
      return;
    }
    const now = ctx.currentTime;
    activeTransientNodes.forEach(({ sources, gainNode }) => {
      try {
        if (gainNode) {
          gainNode.gain.cancelScheduledValues(now);
          gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value), now);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
        }
        if (Array.isArray(sources)) {
          sources.forEach((src) => {
            try {
              src.stop(now + 0.07);
            } catch (_) {}
          });
        }
      } catch (_) {}
    });
    activeTransientNodes = [];
  }

  function registerTransient(sources, gainNode) {
    const entry = { sources, gainNode };
    activeTransientNodes.push(entry);
    const primary = sources && sources[0];
    if (primary) {
      primary.onended = () => {
        activeTransientNodes = activeTransientNodes.filter((n) => n !== entry);
      };
    }
  }

  /**
   * Single urgent klaxon pulse without mutating global BREACH alarmWanted state
   */
  function playAlarmPulse(urgent = false) {
    if (!enabled || pageHidden) return;
    const c = ensureContext();
    if (!c) return;

    try {
      const now = c.currentTime;
      const cutoff = urgent ? 720 : 540;

      const triggerStep = (offset, dur, f1, f2, peak) => {
        const t0 = now + offset;
        const osc1 = c.createOscillator();
        const osc2 = c.createOscillator();
        osc1.type = 'sawtooth';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(f1, t0);
        osc2.frequency.setValueAtTime(f2, t0);

        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(cutoff, t0);
        lp.Q.setValueAtTime(2.4, t0);

        const gainNode = c.createGain();
        gainNode.gain.setValueAtTime(0.0001, t0);
        gainNode.gain.linearRampToValueAtTime(peak, t0 + 0.03);
        gainNode.gain.setValueAtTime(peak, t0 + dur - 0.08);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        osc1.connect(lp);
        osc2.connect(lp);
        lp.connect(gainNode);
        gainNode.connect(masterGain);

        osc1.start(t0);
        osc2.start(t0);
        osc1.stop(t0 + dur + 0.02);
        osc2.stop(t0 + dur + 0.02);
        registerTransient([osc1, osc2], gainNode);
      };

      triggerStep(0, 0.42, 210.0, 213.0, urgent ? 0.16 : 0.12);
      triggerStep(0.46, 0.42, 164.0, 166.5, urgent ? 0.15 : 0.11);
    } catch (_) {}
  }

  /**
   * Pressurized HCl injection hiss + bubbling sub-throb (reserved for SCP-682)
   */
  function playAcidHiss(durationSec = 1.1) {
    if (!enabled || pageHidden) return;
    const c = ensureContext();
    if (!c || !whiteBuf) return;

    try {
      const now = c.currentTime;
      const dur = Math.max(0.3, Math.min(2.5, durationSec));

      const noiseSrc = c.createBufferSource();
      noiseSrc.buffer = whiteBuf;
      noiseSrc.loop = true;

      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2600, now);
      bp.frequency.exponentialRampToValueAtTime(1200, now + dur);
      bp.Q.setValueAtTime(1.6, now);

      const nGain = c.createGain();
      nGain.gain.setValueAtTime(0.0001, now);
      nGain.gain.linearRampToValueAtTime(0.22, now + 0.08);
      nGain.gain.setValueAtTime(0.18, now + dur * 0.55);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      noiseSrc.connect(bp);
      bp.connect(nGain);
      nGain.connect(masterGain);

      noiseSrc.start(now);
      noiseSrc.stop(now + dur + 0.02);

      // Subtle low boiling acid throb
      const bubbleOsc = c.createOscillator();
      bubbleOsc.type = 'sine';
      bubbleOsc.frequency.setValueAtTime(90, now);
      bubbleOsc.frequency.linearRampToValueAtTime(130, now + dur);

      const bGain = c.createGain();
      bGain.gain.setValueAtTime(0.0001, now);
      bGain.gain.linearRampToValueAtTime(0.075, now + 0.1);
      bGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      bubbleOsc.connect(bGain);
      bGain.connect(masterGain);
      bubbleOsc.start(now);
      bubbleOsc.stop(now + dur + 0.02);

      registerTransient([noiseSrc, bubbleOsc], nGain);
      registerTransient([bubbleOsc], bGain);
    } catch (_) {}
  }

  /**
   * High-energy execution laser sweep + sizzling plasma noise (reserved for SCP-682)
   */
  function playLaser(durationSec = 1.0) {
    if (!enabled || pageHidden) return;
    const c = ensureContext();
    if (!c || !whiteBuf) return;

    try {
      const now = c.currentTime;
      const dur = Math.max(0.3, Math.min(2.2, durationSec));

      const saw = c.createOscillator();
      const sine = c.createOscillator();
      saw.type = 'sawtooth';
      sine.type = 'sine';

      saw.frequency.setValueAtTime(420, now);
      saw.frequency.exponentialRampToValueAtTime(1680, now + dur * 0.28);
      saw.frequency.exponentialRampToValueAtTime(980, now + dur);

      sine.frequency.setValueAtTime(420, now);
      sine.frequency.exponentialRampToValueAtTime(1680, now + dur * 0.28);
      sine.frequency.exponentialRampToValueAtTime(980, now + dur);

      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3400, now);
      lp.Q.setValueAtTime(2.2, now);

      const beamGain = c.createGain();
      beamGain.gain.setValueAtTime(0.0001, now);
      beamGain.gain.linearRampToValueAtTime(0.18, now + 0.04);
      beamGain.gain.setValueAtTime(0.16, now + dur - 0.12);
      beamGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      saw.connect(lp);
      sine.connect(lp);
      lp.connect(beamGain);
      beamGain.connect(masterGain);

      saw.start(now);
      sine.start(now);
      saw.stop(now + dur + 0.02);
      sine.stop(now + dur + 0.02);

      // Plasma vaporization sizzle
      const noiseSrc = c.createBufferSource();
      noiseSrc.buffer = whiteBuf;
      noiseSrc.loop = true;

      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1800, now);
      bp.Q.setValueAtTime(1.4, now);

      const nGain = c.createGain();
      nGain.gain.setValueAtTime(0.0001, now);
      nGain.gain.linearRampToValueAtTime(0.17, now + 0.05);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      noiseSrc.connect(bp);
      bp.connect(nGain);
      nGain.connect(masterGain);

      noiseSrc.start(now);
      noiseSrc.stop(now + dur + 0.02);

      registerTransient([saw, sine], beamGain);
      registerTransient([noiseSrc], nGain);
    } catch (_) {}
  }

  /**
   * Heavy impact thud + staggered crystalline glass fracture snaps (reserved for SCP-682)
   */
  function playCrackImpact() {
    if (!enabled || pageHidden) return;
    const c = ensureContext();
    if (!c || !whiteBuf) return;

    try {
      const now = c.currentTime;

      // Sub-bass heavy bulkhead slam
      const thump = c.createOscillator();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(110, now);
      thump.frequency.exponentialRampToValueAtTime(32, now + 0.28);

      const tGain = c.createGain();
      tGain.gain.setValueAtTime(0.0001, now);
      tGain.gain.linearRampToValueAtTime(0.32, now + 0.012);
      tGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      thump.connect(tGain);
      tGain.connect(masterGain);
      thump.start(now);
      thump.stop(now + 0.3);
      registerTransient([thump], tGain);

      // 3 staggered high-pass crystalline glass fracture snaps
      const snaps = [
        { offset: 0.0, freq: 3400, dur: 0.048, peak: 0.24 },
        { offset: 0.032, freq: 4700, dur: 0.036, peak: 0.20 },
        { offset: 0.072, freq: 5800, dur: 0.026, peak: 0.16 }
      ];
      snaps.forEach((s) => {
        const t0 = now + s.offset;
        const src = c.createBufferSource();
        src.buffer = whiteBuf;

        const hp = c.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(s.freq, t0);
        hp.Q.setValueAtTime(1.8, t0);

        const sGain = c.createGain();
        sGain.gain.setValueAtTime(s.peak, t0);
        sGain.gain.exponentialRampToValueAtTime(0.0001, t0 + s.dur);

        src.connect(hp);
        hp.connect(sGain);
        sGain.connect(masterGain);

        src.start(t0);
        src.stop(t0 + s.dur + 0.01);
        registerTransient([src], sGain);
      });
    } catch (_) {}
  }

  /**
   * Deep sub-bass concrete proximity slam (reserved for SCP-173 Stage 4 contact)
   */
  function playHeavyImpact() {
    if (!enabled || pageHidden) return;
    const c = ensureContext();
    if (!c) return;

    try {
      const now = c.currentTime;

      // Primary sub-bass drop
      const sub = c.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(96, now);
      sub.frequency.exponentialRampToValueAtTime(24, now + 0.48);

      const subGain = c.createGain();
      subGain.gain.setValueAtTime(0.0001, now);
      subGain.gain.linearRampToValueAtTime(0.36, now + 0.01);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);

      sub.connect(subGain);
      subGain.connect(masterGain);
      sub.start(now);
      sub.stop(now + 0.50);
      registerTransient([sub], subGain);

      // Low-mid harmonic body
      const body = c.createOscillator();
      body.type = 'triangle';
      body.frequency.setValueAtTime(62, now);
      body.frequency.exponentialRampToValueAtTime(28, now + 0.38);

      const bodyGain = c.createGain();
      bodyGain.gain.setValueAtTime(0.0001, now);
      bodyGain.gain.linearRampToValueAtTime(0.20, now + 0.012);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

      body.connect(bodyGain);
      bodyGain.connect(masterGain);
      body.start(now);
      body.stop(now + 0.40);
      registerTransient([body], bodyGain);

      // Lowpass concrete thud burst
      const noiseBuf = pinkBuf || whiteBuf;
      if (noiseBuf) {
        const nSrc = c.createBufferSource();
        nSrc.buffer = noiseBuf;

        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(190, now);
        lp.Q.setValueAtTime(2.2, now);

        const nGain = c.createGain();
        nGain.gain.setValueAtTime(0.0001, now);
        nGain.gain.linearRampToValueAtTime(0.28, now + 0.01);
        nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

        nSrc.connect(lp);
        lp.connect(nGain);
        nGain.connect(masterGain);
        nSrc.start(now);
        nSrc.stop(now + 0.28);
        registerTransient([nSrc], nGain);
      }
    } catch (_) {}
  }

  /**
   * Oppressive low-frequency dual-tone looping facility klaxon
   */
  function toggleAlarm(active) {
    alarmWanted = Boolean(active);
    if (!alarmWanted) {
      stopAlarmLoop();
      return false;
    }
    if (enabled && userInteracted && !pageHidden) {
      startAlarmLoop();
    }
    return true;
  }

  /**
   * Continuous ascending low-frequency biometric scan current hum (Boot Screen Hold)
   */
  function startBioScan() {
    unlock();
    if (!enabled || pageHidden) return;
    const c = ensureContext();
    if (!c) return;

    stopBioScan(false);

    try {
      const now = c.currentTime;

      const osc1 = c.createOscillator();
      const osc2 = c.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(58, now);
      osc2.frequency.setValueAtTime(59.2, now);

      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(190, now);
      lp.Q.setValueAtTime(4.2, now);

      const lfo = c.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(5.5, now);

      const lfoGain = c.createGain();
      lfoGain.gain.setValueAtTime(35, now);
      lfo.connect(lfoGain);
      lfoGain.connect(lp.frequency);

      const mainGain = c.createGain();
      mainGain.gain.setValueAtTime(0.0001, now);
      mainGain.gain.linearRampToValueAtTime(0.14, now + 0.05);

      osc1.connect(lp);
      osc2.connect(lp);
      lp.connect(mainGain);
      mainGain.connect(masterGain);

      let noiseSrc = null;
      let bp = null;
      let noiseGain = null;
      if (whiteBuf) {
        noiseSrc = c.createBufferSource();
        noiseSrc.buffer = whiteBuf;
        noiseSrc.loop = true;

        bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1250, now);
        bp.Q.setValueAtTime(3.6, now);

        noiseGain = c.createGain();
        noiseGain.gain.setValueAtTime(0.0001, now);
        noiseGain.gain.linearRampToValueAtTime(0.035, now + 0.06);

        noiseSrc.connect(bp);
        bp.connect(noiseGain);
        noiseGain.connect(masterGain);
        noiseSrc.start(now);
      }

      osc1.start(now);
      osc2.start(now);
      lfo.start(now);

      bioScan = {
        osc1,
        osc2,
        lfo,
        lfoGain,
        noiseSrc,
        lp,
        bp,
        mainGain,
        noiseGain
      };
    } catch (_) {
      bioScan = null;
    }
  }

  function updateBioScan(progress) {
    if (!bioScan || !ctx || !enabled || pageHidden) return;
    const p = Math.max(0, Math.min(1, Number(progress) || 0));
    try {
      const now = ctx.currentTime;
      bioScan.osc1.frequency.setTargetAtTime(58 + 104 * p, now, 0.035);
      bioScan.osc2.frequency.setTargetAtTime(59.2 + 107 * p, now, 0.035);
      bioScan.lp.frequency.setTargetAtTime(190 + 820 * (p * p), now, 0.035);
      bioScan.lfo.frequency.setTargetAtTime(5.5 + 14.5 * p, now, 0.035);
      bioScan.mainGain.gain.setTargetAtTime(0.14 + 0.11 * p, now, 0.035);
      if (bioScan.bp && bioScan.noiseGain) {
        bioScan.bp.frequency.setTargetAtTime(1250 + 1850 * p, now, 0.035);
        bioScan.noiseGain.gain.setTargetAtTime(0.035 + 0.055 * p, now, 0.035);
      }
    } catch (_) {}
  }

  function stopBioScan(completed = false) {
    if (!bioScan || !ctx) {
      bioScan = null;
      return;
    }
    const active = bioScan;
    bioScan = null;
    try {
      const now = ctx.currentTime;
      const fadeSec = completed ? 0.06 : 0.04;
      const stopAt = now + 0.08;

      if (active.mainGain) {
        active.mainGain.gain.cancelScheduledValues(now);
        active.mainGain.gain.setValueAtTime(Math.max(0.0001, active.mainGain.gain.value), now);
        active.mainGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSec);
      }
      if (active.noiseGain) {
        active.noiseGain.gain.cancelScheduledValues(now);
        active.noiseGain.gain.setValueAtTime(Math.max(0.0001, active.noiseGain.gain.value), now);
        active.noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSec);
      }

      [active.osc1, active.osc2, active.lfo, active.noiseSrc].forEach((src) => {
        if (!src) return;
        try {
          src.stop(stopAt);
        } catch (_) {}
      });
    } catch (_) {}
  }

  /**
   * Subtle medical ECG R-peak pulse pip synchronized with cardiac waveform
   */
  function playBioPip(progress = 0) {
    if (!enabled || pageHidden) return;
    const c = ensureContext();
    if (!c) return;

    try {
      const now = c.currentTime;
      const p = Math.max(0, Math.min(1, Number(progress) || 0));
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(860 + 480 * p, now);

      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.045, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);

      osc.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.026);
      registerTransient([osc], g);
    } catch (_) {}
  }

  /**
   * Crisp downward abort tone when releasing the biometric scan early
   */
  function playScanAbort() {
    stopBioScan(false);
    if (!enabled || pageHidden) return;
    const c = ensureContext();
    if (!c) return;

    try {
      const now = c.currentTime;

      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(118, now + 0.135);

      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(750, now);
      lp.Q.setValueAtTime(1.8, now);

      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.13, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      osc.connect(lp);
      lp.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.15);
      registerTransient([osc], g);

      if (whiteBuf) {
        const nSrc = c.createBufferSource();
        nSrc.buffer = whiteBuf;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1900, now);
        bp.Q.setValueAtTime(2.6, now);

        const nGain = c.createGain();
        nGain.gain.setValueAtTime(0.08, now);
        nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

        nSrc.connect(bp);
        bp.connect(nGain);
        nGain.connect(masterGain);
        nSrc.start(now);
        nSrc.stop(now + 0.022);
        registerTransient([nSrc], nGain);
      }
    } catch (_) {}
  }

  /**
   * SCiPNET verification lock-in & 0.7s handshake burst audio
   */
  function playHandshakeConfirm() {
    stopBioScan(true);
    if (!enabled || pageHidden) return;
    const c = ensureContext();
    if (!c) return;

    try {
      const now = c.currentTime;

      // Ascending dual-harmonic lock chimes
      [
        { offset: 0.0, freq: 523.25, dur: 0.16, type: 'triangle', peak: 0.11 },
        { offset: 0.08, freq: 1046.5, dur: 0.2, type: 'sine', peak: 0.12 }
      ].forEach((ch) => {
        const t0 = now + ch.offset;
        const osc = c.createOscillator();
        osc.type = ch.type;
        osc.frequency.setValueAtTime(ch.freq, t0);

        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(ch.peak, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + ch.dur);

        osc.connect(g);
        g.connect(masterGain);
        osc.start(t0);
        osc.stop(t0 + ch.dur + 0.02);
        registerTransient([osc], g);
      });

      // 8 staggered telemetry data-burst pips across t+0.14s..0.58s
      for (let i = 0; i < 8; i++) {
        const t = now + 0.14 + i * (0.44 / 7);
        const osc = c.createOscillator();
        osc.type = i % 2 === 0 ? 'square' : 'sine';
        osc.frequency.setValueAtTime(1650 + ((i * 431) % 1350), t);

        const g = c.createGain();
        g.gain.setValueAtTime(0.042, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);

        osc.connect(g);
        g.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.026);
        registerTransient([osc], g);
      }

      // Bandpass static sweep matching handshake log stream
      if (whiteBuf) {
        const nSrc = c.createBufferSource();
        nSrc.buffer = whiteBuf;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(2400, now + 0.12);
        bp.frequency.exponentialRampToValueAtTime(4800, now + 0.58);
        bp.Q.setValueAtTime(3.2, now + 0.12);

        const nGain = c.createGain();
        nGain.gain.setValueAtTime(0.0001, now + 0.12);
        nGain.gain.linearRampToValueAtTime(0.045, now + 0.18);
        nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.60);

        nSrc.connect(bp);
        bp.connect(nGain);
        nGain.connect(masterGain);
        nSrc.start(now + 0.12);
        nSrc.stop(now + 0.62);
        registerTransient([nSrc], nGain);
      }

      // CRT relay stabilization thump at t+0.60s
      const thumpTime = now + 0.60;
      const thump = c.createOscillator();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(115, thumpTime);
      thump.frequency.exponentialRampToValueAtTime(48, thumpTime + 0.16);

      const tGain = c.createGain();
      tGain.gain.setValueAtTime(0.0001, thumpTime);
      tGain.gain.linearRampToValueAtTime(0.18, thumpTime + 0.012);
      tGain.gain.exponentialRampToValueAtTime(0.0001, thumpTime + 0.16);

      thump.connect(tGain);
      tGain.connect(masterGain);
      thump.start(thumpTime);
      thump.stop(thumpTime + 0.18);
      registerTransient([thump], tGain);
    } catch (_) {}
  }

  /**
   * Restrained 1978 cassette tape & 300-baud modem static burst (reserved for SCP-079)
   */
  function play079Static(durationSec = 0.42, intensity = 1) {
    if (!enabled || pageHidden) return;
    const c = ensureContext();
    if (!c || !whiteBuf) return;

    try {
      const now = c.currentTime;
      const dur = Math.max(0.12, Math.min(1.2, Number(durationSec) || 0.42));
      const level = Math.max(0.25, Math.min(1.15, Number(intensity) || 1));

      // Layer 1: Bandpass cassette tape hiss & CRT static jitter
      const noiseSrc = c.createBufferSource();
      noiseSrc.buffer = whiteBuf;
      noiseSrc.loop = true;

      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.setValueAtTime(2.6, now);
      bp.frequency.setValueAtTime(1550, now);
      bp.frequency.linearRampToValueAtTime(2350, now + dur * 0.45);
      bp.frequency.exponentialRampToValueAtTime(980, now + dur);

      const nGain = c.createGain();
      nGain.gain.setValueAtTime(0.0001, now);
      nGain.gain.linearRampToValueAtTime(0.068 * level, now + 0.018);
      const stepCount = Math.max(2, Math.floor(dur / 0.055));
      for (let i = 1; i < stepCount; i++) {
        const t = now + i * 0.055;
        if (t < now + dur - 0.04) {
          const flutter = (i % 2 === 0 ? 0.042 : 0.068) * level;
          nGain.gain.setValueAtTime(flutter, t);
        }
      }
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      noiseSrc.connect(bp);
      bp.connect(nGain);
      nGain.connect(masterGain);
      noiseSrc.start(now);
      noiseSrc.stop(now + dur + 0.02);
      registerTransient([noiseSrc], nGain);

      // Layer 2: 300-baud FSK modem chirp (1070 Hz / 1270 Hz)
      const fskOsc = c.createOscillator();
      fskOsc.type = 'square';
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1450, now);
      lp.Q.setValueAtTime(1.4, now);

      const fskSteps = Math.max(2, Math.floor(dur / 0.045));
      for (let i = 0; i < fskSteps; i++) {
        const t = now + i * 0.045;
        const tone = (i % 3 === 0 || i % 5 === 0) ? 1070 : 1270;
        fskOsc.frequency.setValueAtTime(tone, t);
      }

      const fGain = c.createGain();
      fGain.gain.setValueAtTime(0.0001, now);
      fGain.gain.linearRampToValueAtTime(0.026 * level, now + 0.02);
      fGain.gain.setValueAtTime(0.022 * level, now + Math.max(0.03, dur - 0.05));
      fGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      fskOsc.connect(lp);
      lp.connect(fGain);
      fGain.connect(masterGain);
      fskOsc.start(now);
      fskOsc.stop(now + dur + 0.02);
      registerTransient([fskOsc], fGain);

      // Layer 3: Subtle 60 Hz CRT mains hum
      const humOsc = c.createOscillator();
      humOsc.type = 'triangle';
      humOsc.frequency.setValueAtTime(60, now);

      const hGain = c.createGain();
      hGain.gain.setValueAtTime(0.0001, now);
      hGain.gain.linearRampToValueAtTime(0.032 * level, now + 0.025);
      hGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      humOsc.connect(hGain);
      hGain.connect(masterGain);
      humOsc.start(now);
      humOsc.stop(now + dur + 0.02);
      registerTransient([humOsc], hGain);
    } catch (_) {}
  }

  /**
   * 1978 Exidy Sorcerer low-frequency square-wave single typewriter tone (reserved for SCP-079)
   */
  function play079Beep(freqOverride, durOverride) {
    if (!enabled || pageHidden) return;
    const nowMs = performance.now();
    if (nowMs - last079BeepTs < 24) return;
    last079BeepTs = nowMs;

    const c = ensureContext();
    if (!c) return;

    try {
      const now = c.currentTime;
      const freq = Number.isFinite(freqOverride)
        ? Math.max(60, Math.min(800, freqOverride))
        : 188 + Math.floor(Math.random() * 26);
      const dur = Number.isFinite(durOverride)
        ? Math.max(0.016, Math.min(0.18, durOverride))
        : 0.034;

      const osc = c.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now);

      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(760, now);
      lp.Q.setValueAtTime(1.1, now);

      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.055, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(lp);
      lp.connect(g);
      g.connect(masterGain);

      osc.start(now);
      osc.stop(now + dur + 0.01);
      registerTransient([osc], g);
    } catch (_) {}
  }

  function setEnabled(flag) {
    enabled = Boolean(flag);
    if (!enabled) {
      if (ctx && masterGain) {
        const now = ctx.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setTargetAtTime(0.0001, now, 0.03);
      }
      fadeAmbient(0, AMBIENT_FADE_SEC);
      stopAlarmLoop();
      stopTransientAlarms();
      stopBioScan(false);
    } else {
      unlock();
      if (ctx && masterGain) {
        const now = ctx.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setTargetAtTime(pageHidden ? 0.0001 : MASTER_LEVEL, now, 0.025);
      }
      if (!pageHidden) {
        fadeAmbient(AMBIENT_LEVEL, AMBIENT_FADE_SEC);
        if (alarmWanted && !alarmInterval) startAlarmLoop();
      } else {
        fadeAmbient(0, 0.05);
      }
    }
    notifyListeners();
    return enabled;
  }

  function handleVisibilityChange() {
    pageHidden = typeof document !== 'undefined' ? Boolean(document.hidden) : false;
    if (!ctx) return;

    if (pageHidden) {
      fadeAmbient(0, AMBIENT_FADE_SEC);
      if (masterGain) {
        rampGainLinear(masterGain.gain, 0.0001, 0.25);
      }
      stopAlarmLoop();
      stopBioScan(false);
    } else {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      if (enabled) {
        if (masterGain) {
          rampGainLinear(masterGain.gain, MASTER_LEVEL, 0.18);
        }
        initAmbientBus(ctx);
        fadeAmbient(AMBIENT_LEVEL, AMBIENT_FADE_SEC);
        if (alarmWanted && userInteracted && !alarmInterval) {
          startAlarmLoop();
        }
      } else {
        if (masterGain) {
          rampGainLinear(masterGain.gain, 0.0001, 0.05);
        }
        fadeAmbient(0, 0.05);
      }
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  function toggle() {
    return setEnabled(!enabled);
  }

  function isEnabled() {
    return enabled;
  }

  function onChange(cb) {
    if (typeof cb === 'function') listeners.add(cb);
    return () => listeners.delete(cb);
  }

  window.SoundEngine = {
    playClick,
    playDenied,
    playDecrypt,
    playScrape,
    playGear,
    playSteamRelease,
    playAlarmPulse,
    playAcidHiss,
    playLaser,
    playCrackImpact,
    playHeavyImpact,
    stopTransientAlarms,
    toggleAlarm,
    startBioScan,
    updateBioScan,
    stopBioScan,
    playBioPip,
    playScanAbort,
    playHandshakeConfirm,
    play079Static,
    play079Beep,
    unlock,
    toggle,
    setEnabled,
    isEnabled,
    onChange
  };
})();
