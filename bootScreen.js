(function () {
  'use strict';

  const HOLD_DURATION_MS = 1500;
  const ABORT_DECAY_RATE = 4.2;
  const CONFIRM_HOLD_MS = 350;
  const REVEAL_DURATION_MS = 420;
  const BYPASS_REVEAL_MS = 260;
  const ECG_POINTS = 180;
  const ECG_SAMPLE_DT = 1 / 90;
  const FALLBACK_RES = 168;
  const MAX_KERNEL_LINES = 26;

  const DEFAULT_STATUS_TEXT =
    'BIOMETRIC LOCK ENGAGED // HOLD 1.5s TO CONFIRM CARDIAC ACTIVITY & UNLOCK AUDIO';
  const ABORT_STATUS_TEXT =
    '⚠ VERIFICATION ABORTED // 中途松手，生命体征校验中断 — 请重新按住 1.5s';

  const KERNEL_IDLE_POOL = [
    ['HEX', '0x7F4A..E901 :: BL-001 OPTIC VECTOR LOCKED [14.2 Hz]'],
    ['SYS', 'MEMETIC BARRIER // SITE-19 GATEWAY PORT 04 ARMED'],
    ['HEX', '0x3B91..10C4 :: COGNITOHAZARD ENTROPY CHECK -> NOMINAL'],
    ['BIO', 'RETINAL REFLEX PASSIVE MONITOR // STANDBY'],
    ['HEX', '0xA20D..88F2 :: AES-512 CRYPTO TUNNEL KEY ROTATION OK'],
    ['VAX', 'BERRYMAN-LANGFORD COUNTER-AGENT PRELOADED IN SRAM'],
    ['HEX', '0x99C0..44A1 :: CORTEX BASELINE SYNC DELTA +0.18 mV'],
    ['SEC', 'UNAUTHORIZED BIOMETRIC ABSENCE -> CARDIAC LOCK ARMED']
  ];

  const KERNEL_HOLD_POOL = [
    ['INJ', 'COUNTER-MEME INJECTING... [VAX-BL001 STREAM ACTIVE]'],
    ['BIO', 'CARDIAC ACCELERATION DETECTED -> SYMPATHETIC SURGE'],
    ['INJ', 'COUNTER-MEME INJECTING... NEURAL SHIELD AMPLIFYING'],
    ['HEX', '0xFF19..D804 :: REWRITING OPTIC CHIASM FILTER MATRIX'],
    ['VAX', 'ANTI-MEMETIC PHOSPHOR PULSE -> SUPPRESSING LETHAL FRACTAL'],
    ['INJ', 'COUNTER-MEME INJECTING... CORTEX BARRIER REINFORCED']
  ];

  const sound = window.SoundEngine || {
    unlock() {},
    setEnabled() { return false; },
    isEnabled() { return false; },
    playClick() {},
    startBioScan() {},
    updateBioScan() {},
    stopBioScan() {},
    playBioPip() {},
    playScanAbort() {},
    playHandshakeConfirm() {}
  };

  let dom = {};
  let ecgCtx = null;
  let memeticSize = { w: 360, h: 360 };
  let ecgSize = { w: 540, h: 52 };

  // Memetic Renderer State (WebGL primary + Canvas 2D fractal fallback)
  let rendererMode = 'none'; // 'webgl' | '2d' | 'none'
  let gl = null;
  let glProgram = null;
  let glVertShader = null;
  let glFragShader = null;
  let glPosBuffer = null;
  let glUniforms = {};
  let fallbackCtx = null;
  let fallbackOffscreen = null;
  let fallbackOffCtx = null;
  let fallbackImg = null;
  let fallbackNoiseGrid = null;

  let phase = 'CLOSED'; // 'IDLE' | 'HOLDING' | 'ABORTING' | 'CONFIRMED' | 'REVEALING' | 'CLOSED'
  let isOpenFlag = false;
  let rafId = null;
  let holdProgress = 0;
  let visualPhase = 0;
  let lastFrameTs = 0;
  let activePointerId = null;
  let activeKeyHold = false;
  let abortFlashUntil = 0;
  let confirmFlash = 0;
  let glitchTimer = 2.2;
  let glitchBurst = 0;
  let kernelAccum = 0;
  let telemetryAccum = 0;
  let kernelPoolIdx = 0;
  let holdPoolIdx = 0;
  let opticLoad = 38.4;
  let cogResistance = 84.2;
  const opticBars = new Float32Array(24);
  let callbacks = {};
  const timers = new Set();

  // ECG rolling state
  let ecgSamples = [];
  let ecgBeatPhase = 0;
  let ecgSampleAccum = 0;
  let currentBpm = 72;

  function scheduleTimer(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  }

  function clearAllTimers() {
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function formatUtcShort(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss} UTC`;
  }

  function cacheDom() {
    dom = {
      screen: document.getElementById('boot-screen'),
      stage: document.getElementById('boot-stage'),
      confirmFlashEl: document.getElementById('boot-confirm-flash'),
      bypassBtn: document.getElementById('boot-bypass-btn'),
      memeticFrame: document.getElementById('boot-memetic-frame'),
      canvasSlot: document.getElementById('boot-canvas-slot'),
      memeticCanvas: document.getElementById('boot-memetic-canvas'),
      memeticFreq: document.getElementById('boot-memetic-freq'),
      inocStatus: document.getElementById('boot-inoc-status'),
      rendererTag: document.getElementById('boot-renderer-tag'),
      apertureProgress: document.getElementById('boot-aperture-progress'),
      confirmStamp: document.getElementById('boot-confirm-stamp'),
      confirmMeta: document.getElementById('boot-confirm-meta'),
      kernelStream: document.getElementById('boot-kernel-stream'),
      kernelRate: document.getElementById('boot-kernel-rate'),
      ecgBpm: document.getElementById('boot-ecg-bpm'),
      ecgState: document.getElementById('boot-ecg-state'),
      ecgCanvas: document.getElementById('boot-ecg-canvas'),
      holdBtn: document.getElementById('boot-hold-btn'),
      holdFill: document.getElementById('boot-hold-fill'),
      holdRingProgress: document.getElementById('boot-hold-ring-progress'),
      holdLabel: document.getElementById('boot-hold-label'),
      holdPct: document.getElementById('boot-hold-pct'),
      statusLine: document.getElementById('boot-status-line'),
      opticVal: document.getElementById('boot-optic-val'),
      opticState: document.getElementById('boot-optic-state'),
      opticLedBar: document.getElementById('boot-optic-led-bar'),
      opticBarsEl: document.getElementById('boot-optic-bars'),
      cogVal: document.getElementById('boot-cog-val'),
      cogState: document.getElementById('boot-cog-state'),
      cogBarBase: document.getElementById('boot-cog-bar-base'),
      cogBarShield: document.getElementById('boot-cog-bar-shield'),
      inocBadge: document.getElementById('boot-inoc-badge'),
      inocBar: document.getElementById('boot-inoc-bar'),
      inocPct: document.getElementById('boot-inoc-pct'),
      cortexSync: document.getElementById('boot-cortex-sync'),
      pupilVal: document.getElementById('boot-pupil-val'),
      synapticVal: document.getElementById('boot-synaptic-val'),
      gwSession: document.getElementById('boot-gw-session'),
      gwLatency: document.getElementById('boot-gw-latency'),
      bottomClock: document.getElementById('boot-bottom-clock')
    };

    if (dom.ecgCanvas) {
      ecgCtx = dom.ecgCanvas.getContext('2d');
    }
    initTelemetryDom();
  }

  function initTelemetryDom() {
    if (dom.opticLedBar && dom.opticLedBar.children.length === 0) {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 20; i++) {
        const seg = document.createElement('span');
        seg.className = 'boot-led-seg';
        frag.appendChild(seg);
      }
      dom.opticLedBar.appendChild(frag);
    }

    if (dom.opticBarsEl && dom.opticBarsEl.children.length === 0) {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 24; i++) {
        const bar = document.createElement('span');
        bar.className = 'boot-optic-bar';
        bar.style.height = '30%';
        frag.appendChild(bar);
        opticBars[i] = 0.3;
      }
      dom.opticBarsEl.appendChild(frag);
    }
  }

  function setStageShake(x, y) {
    if (!dom.stage) return;
    dom.stage.style.setProperty('--boot-shake-x', `${x.toFixed(2)}px`);
    dom.stage.style.setProperty('--boot-shake-y', `${y.toFixed(2)}px`);
  }

  /* ========================================================================
     WEBGL ORGANIC DOMAIN-WARPED FBM FRACTAL + PIXEL 2D FALLBACK
     ======================================================================== */
  const VERT_SHADER_SRC = [
    'attribute vec2 a_pos;',
    'void main() {',
    '  gl_Position = vec4(a_pos, 0.0, 1.0);',
    '}'
  ].join('\n');

  const FRAG_SHADER_SRC = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 u_resolution;',
    'uniform float u_time;',
    'uniform float u_hold;',
    'uniform float u_abort;',
    'uniform float u_glitch;',
    'uniform float u_flash;',
    '',
    'float hash(vec2 p) {',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',
    '',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  float a = hash(i);',
    '  float b = hash(i + vec2(1.0, 0.0));',
    '  float c = hash(i + vec2(0.0, 1.0));',
    '  float d = hash(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',
    '',
    'float fbm(vec2 p) {',
    '  float val = 0.0;',
    '  float amp = 0.5;',
    '  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);',
    '  for (int i = 0; i < 4; i++) {',
    '    val += amp * noise(p);',
    '    p = rot * p * 2.04 + vec2(1.7, 9.2);',
    '    amp *= 0.5;',
    '  }',
    '  return val;',
    '}',
    '',
    'float evalFractal(vec2 uv, float t, float hold) {',
    '  float r = length(uv);',
    '  float ang = atan(uv.y, uv.x + 1e-5);',
    '  float swirl = ang + (2.6 + hold * 4.4) * exp(-r * 1.15) + sin(r * 5.2 - t * 1.4) * (0.42 + hold * 0.55);',
    '  float logR = log(max(r, 0.045));',
    '  vec2 warpedPolar = vec2(cos(swirl), sin(swirl)) * (0.85 + r * 1.65) + vec2(logR * 0.42, sin(swirl * 3.0) * 0.25);',
    '  vec2 p = mix(uv * 2.35, warpedPolar * 1.55, 0.62);',
    '',
    '  vec2 q = vec2(',
    '    fbm(p + vec2(t * 0.24, -t * 0.19)),',
    '    fbm(p + vec2(-t * 0.21, t * 0.27) + vec2(5.2, 1.3))',
    '  );',
    '  vec2 w = vec2(',
    '    fbm(p + 3.1 * q + vec2(1.7, 9.2) + t * 0.16),',
    '    fbm(p + 3.1 * q + vec2(8.3, 2.8) - t * 0.18)',
    '  );',
    '',
    '  float f = fbm(p + 2.65 * w + vec2(sin(t * 0.4) * 0.4, cos(t * 0.35) * 0.4));',
    '  float ridge = 1.0 - abs(f * 2.0 - 1.0);',
    '  ridge = pow(max(ridge, 0.0001), 2.15 - hold * 0.55);',
    '  float veins = 1.0 - abs(sin((q.x + w.y) * 9.5 + logR * 3.6 - t * 2.1));',
    '  veins = pow(max(veins, 0.0001), 3.4);',
    '  float fissure = smoothstep(0.18, 0.72, dot(q, w));',
    '  return clamp(f * 0.48 + ridge * 0.62 + veins * 0.42 - (1.0 - fissure) * 0.28, 0.0, 1.35);',
    '}',
    '',
    'vec3 paletteRamp(float v, float hold) {',
    '  vec3 cVoid = vec3(0.014, 0.010, 0.015);',
    '  vec3 cBlood = vec3(0.46, 0.02, 0.035);',
    '  vec3 cCrimson = vec3(0.88, 0.08, 0.07);',
    '  vec3 cAmber = vec3(0.96, 0.58, 0.04);',
    '  vec3 cBone = vec3(0.97, 0.94, 0.87);',
    '',
    '  vec3 col = mix(cVoid, cBlood, smoothstep(0.08, 0.34, v));',
    '  col = mix(col, cCrimson, smoothstep(0.32, 0.62, v));',
    '  col = mix(col, cAmber, smoothstep(0.58, 0.86, v) * (0.85 + hold * 0.25));',
    '  col = mix(col, cBone, smoothstep(0.86, 1.18, v));',
    '  return col;',
    '}',
    '',
    'void main() {',
    '  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);',
    '  float rawR = length(uv);',
    '',
    '  // Horizontal tear glitch bands',
    '  float band = floor(gl_FragCoord.y * 0.14);',
    '  float bandNoise = hash(vec2(band, floor(u_time * 18.0)));',
    '  float tearMask = step(0.84 - u_glitch * 0.28 - u_hold * 0.22, bandNoise);',
    '  float tearShift = (hash(vec2(band + 13.0, floor(u_time * 24.0))) - 0.5) * (0.04 + u_glitch * 0.14 + u_hold * 0.12) * tearMask;',
    '  uv.x += tearShift;',
    '',
    '  // Lens swallow tension & barrel warp during biometric hold',
    '  float zoom = mix(1.0, 0.54, pow(max(u_hold, 0.0), 1.25));',
    '  float barrel = 1.0 + rawR * rawR * (0.18 + u_hold * 0.48);',
    '  vec2 wuv = uv * zoom * barrel;',
    '',
    '  float t = u_time * (0.85 + u_hold * 2.6);',
    '  float caAmt = 0.008 + u_hold * 0.048 + u_glitch * 0.036 + tearMask * 0.018;',
    '  vec2 caDir = normalize(uv + vec2(1e-4, 1e-4)) * caAmt + vec2(caAmt * 0.45, 0.0);',
    '',
    '  float vR = evalFractal(wuv + caDir, t, u_hold);',
    '  float vG = evalFractal(wuv, t, u_hold);',
    '  float vB = evalFractal(wuv - caDir, t, u_hold);',
    '',
    '  vec3 colR = paletteRamp(vR, u_hold);',
    '  vec3 colG = paletteRamp(vG, u_hold);',
    '  vec3 colB = paletteRamp(vB, u_hold);',
    '  vec3 col = vec3(colR.r, colG.g, colB.b);',
    '',
    '  // Dark abyssal pupil fissures near singularity core',
    '  float pupil = smoothstep(0.055, 0.22, rawR);',
    '  col *= mix(0.22, 1.0, pupil);',
    '',
    '  // Soft edge vignette blending into armored aperture bezel',
    '  float vig = smoothstep(1.16, 0.44, rawR);',
    '  col *= vig;',
    '',
    '  // Subtle organic scanline interference',
    '  float scan = 0.93 + 0.07 * sin(gl_FragCoord.y * 1.45 + u_time * 10.0);',
    '  col *= scan;',
    '',
    '  // Abort crimson surge',
    '  col = mix(col, vec3(0.88, 0.07, 0.08) * (0.45 + 0.55 * vG), clamp(u_abort, 0.0, 1.0) * 0.72);',
    '',
    '  // Confirmation CRT flash surge',
    '  col = mix(col, vec3(0.86, 1.0, 0.95), clamp(u_flash, 0.0, 1.0) * 0.88);',
    '',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compileShader(context, type, source) {
    const shader = context.createShader(type);
    if (!shader) return null;
    context.shaderSource(shader, source);
    context.compileShader(shader);
    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
      context.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function buildFallbackNoiseGrid() {
    if (fallbackNoiseGrid) return fallbackNoiseGrid;
    const size = 64;
    const grid = new Float32Array(size * size);
    let seed = 19001682;
    for (let i = 0; i < grid.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      grid[i] = seed / 4294967296;
    }
    fallbackNoiseGrid = grid;
    return grid;
  }

  function sampleGridNoise(grid, x, y) {
    const size = 64;
    const mask = size - 1;
    const x0 = Math.floor(x) & mask;
    const y0 = Math.floor(y) & mask;
    const x1 = (x0 + 1) & mask;
    const y1 = (y0 + 1) & mask;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);

    const a = grid[y0 * size + x0];
    const b = grid[y0 * size + x1];
    const c = grid[y1 * size + x0];
    const d = grid[y1 * size + x1];
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
  }

  function fbm2D(grid, x, y) {
    let val = 0;
    let amp = 0.5;
    let px = x;
    let py = y;
    for (let i = 0; i < 3; i++) {
      val += amp * sampleGridNoise(grid, px, py);
      const nx = px * 0.8 + py * 0.6;
      const ny = -px * 0.6 + py * 0.8;
      px = nx * 2.02 + 1.7;
      py = ny * 2.02 + 9.2;
      amp *= 0.5;
    }
    return val;
  }

  function initMemeticRenderer() {
    destroyMemeticRenderer(false);
    const canvas = dom.memeticCanvas;
    if (!canvas) return;

    let glCtx = null;
    try {
      const attrs = { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false };
      glCtx = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    } catch (_) {
      glCtx = null;
    }

    if (glCtx) {
      const vs = compileShader(glCtx, glCtx.VERTEX_SHADER, VERT_SHADER_SRC);
      const fs = compileShader(glCtx, glCtx.FRAGMENT_SHADER, FRAG_SHADER_SRC);
      if (vs && fs) {
        const prog = glCtx.createProgram();
        glCtx.attachShader(prog, vs);
        glCtx.attachShader(prog, fs);
        glCtx.linkProgram(prog);
        if (glCtx.getProgramParameter(prog, glCtx.LINK_STATUS)) {
          const buf = glCtx.createBuffer();
          glCtx.bindBuffer(glCtx.ARRAY_BUFFER, buf);
          glCtx.bufferData(
            glCtx.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
            glCtx.STATIC_DRAW
          );
          const posLoc = glCtx.getAttribLocation(prog, 'a_pos');
          glCtx.enableVertexAttribArray(posLoc);
          glCtx.vertexAttribPointer(posLoc, 2, glCtx.FLOAT, false, 0, 0);

          gl = glCtx;
          glProgram = prog;
          glVertShader = vs;
          glFragShader = fs;
          glPosBuffer = buf;
          glUniforms = {
            resolution: glCtx.getUniformLocation(prog, 'u_resolution'),
            time: glCtx.getUniformLocation(prog, 'u_time'),
            hold: glCtx.getUniformLocation(prog, 'u_hold'),
            abort: glCtx.getUniformLocation(prog, 'u_abort'),
            glitch: glCtx.getUniformLocation(prog, 'u_glitch'),
            flash: glCtx.getUniformLocation(prog, 'u_flash')
          };
          glCtx.useProgram(prog);
          rendererMode = 'webgl';
          if (dom.rendererTag) dom.rendererTag.textContent = 'OPTIC LOCK // GLSL';
          return;
        }
        glCtx.deleteProgram(prog);
      }
      if (vs) glCtx.deleteShader(vs);
      if (fs) glCtx.deleteShader(fs);
    }

    // Pixel-level Canvas 2D Fractal Fallback
    fallbackCtx = canvas.getContext('2d');
    if (fallbackCtx) {
      fallbackOffscreen = document.createElement('canvas');
      fallbackOffscreen.width = FALLBACK_RES;
      fallbackOffscreen.height = FALLBACK_RES;
      fallbackOffCtx = fallbackOffscreen.getContext('2d');
      fallbackImg = fallbackOffCtx.createImageData(FALLBACK_RES, FALLBACK_RES);
      buildFallbackNoiseGrid();
      rendererMode = '2d';
      if (dom.rendererTag) dom.rendererTag.textContent = 'OPTIC LOCK // FBM-2D';
    }
  }

  function destroyMemeticRenderer(recreateCanvas = true) {
    if (gl) {
      try {
        if (glPosBuffer) gl.deleteBuffer(glPosBuffer);
        if (glProgram) gl.deleteProgram(glProgram);
        if (glVertShader) gl.deleteShader(glVertShader);
        if (glFragShader) gl.deleteShader(glFragShader);
        const loseExt = gl.getExtension('WEBGL_lose_context');
        if (loseExt) loseExt.loseContext();
      } catch (_) {}
    }
    gl = null;
    glProgram = null;
    glVertShader = null;
    glFragShader = null;
    glPosBuffer = null;
    glUniforms = {};
    fallbackCtx = null;
    fallbackOffscreen = null;
    fallbackOffCtx = null;
    fallbackImg = null;
    rendererMode = 'none';

    if (recreateCanvas && dom.canvasSlot) {
      const fresh = document.createElement('canvas');
      fresh.id = 'boot-memetic-canvas';
      fresh.setAttribute('aria-label', 'Berryman-Langford 模因抹杀触媒有机分形图案');
      dom.canvasSlot.innerHTML = '';
      dom.canvasSlot.appendChild(fresh);
      dom.memeticCanvas = fresh;
    }
  }

  function renderMemetic2D(now, p, abortAmt, glitchAmt, flashAmt) {
    if (!fallbackCtx || !fallbackOffCtx || !fallbackImg || !dom.memeticCanvas) return;
    const grid = fallbackNoiseGrid;
    const data = fallbackImg.data;
    const t = visualPhase * 0.72;
    const zoom = lerp(1.0, 0.56, Math.pow(p, 1.2));
    const caShift = Math.round(1 + p * 5 + glitchAmt * 4);
    const stride = FALLBACK_RES * 4;
    const rowValues = new Float32Array(FALLBACK_RES * FALLBACK_RES);

    for (let py = 0; py < FALLBACK_RES; py++) {
      const ny = (py / FALLBACK_RES - 0.5) * 2.0;
      const bandTear =
        Math.sin(py * 0.45 + now * 0.04) > 0.92 - glitchAmt * 0.3
          ? (Math.sin(py * 1.9 + now * 0.09) * (0.06 + glitchAmt * 0.12))
          : 0;

      for (let px = 0; px < FALLBACK_RES; px++) {
        const nx = (px / FALLBACK_RES - 0.5) * 2.0 + bandTear;
        const r = Math.hypot(nx, ny);
        const ang = Math.atan2(ny, nx + 1e-5);
        const swirl = ang + (2.4 + p * 4.0) * Math.exp(-r * 1.2) + Math.sin(r * 5.0 - t * 1.3) * (0.4 + p * 0.5);
        const logR = Math.log(Math.max(0.05, r));
        const wx = Math.cos(swirl) * (0.9 + r * 1.5) * zoom + logR * 0.35;
        const wy = Math.sin(swirl) * (0.9 + r * 1.5) * zoom + Math.sin(swirl * 3.0) * 0.25;

        const qx = fbm2D(grid, wx * 2.2 + t * 0.25, wy * 2.2 - t * 0.2);
        const qy = fbm2D(grid, wx * 2.2 - t * 0.2 + 5.2, wy * 2.2 + t * 0.26 + 1.3);
        const f = fbm2D(grid, wx * 2.0 + qx * 2.8, wy * 2.0 + qy * 2.8);
        const ridge = Math.pow(Math.max(0.001, 1 - Math.abs(f * 2 - 1)), 2.0 - p * 0.45);
        const vig = Math.max(0, Math.min(1, (1.14 - r) / 0.68));
        rowValues[py * FALLBACK_RES + px] = Math.min(1.25, (f * 0.5 + ridge * 0.65) * (0.35 + 0.65 * vig)) * vig;
      }
    }

    for (let py = 0; py < FALLBACK_RES; py++) {
      const rowOffset = py * FALLBACK_RES;
      for (let px = 0; px < FALLBACK_RES; px++) {
        const rx = Math.min(FALLBACK_RES - 1, Math.max(0, px + caShift));
        const bx = Math.min(FALLBACK_RES - 1, Math.max(0, px - caShift));
        const vR = rowValues[rowOffset + rx];
        const vG = rowValues[rowOffset + px];
        const vB = rowValues[rowOffset + bx];

        const mapR = Math.min(255, Math.round(vR < 0.35 ? vR * 320 : vR < 0.72 ? 112 + (vR - 0.35) * 370 : 248));
        const mapG = Math.min(255, Math.round(vG < 0.52 ? vG * 28 : vG < 0.88 ? 14 + (vG - 0.52) * 380 : 150 + (vG - 0.88) * 340));
        const mapB = Math.min(255, Math.round(vB < 0.82 ? vB * 18 : 15 + (vB - 0.82) * 650));

        const idx = py * stride + px * 4;
        let rr = mapR;
        let gg = mapG;
        let bb = mapB;

        if (abortAmt > 0.01) {
          rr = Math.round(lerp(rr, 224 * (0.4 + 0.6 * vG), abortAmt * 0.7));
          gg = Math.round(lerp(gg, 18, abortAmt * 0.6));
          bb = Math.round(lerp(bb, 22, abortAmt * 0.6));
        }
        if (flashAmt > 0.01) {
          rr = Math.round(lerp(rr, 220, flashAmt * 0.88));
          gg = Math.round(lerp(gg, 255, flashAmt * 0.88));
          bb = Math.round(lerp(bb, 242, flashAmt * 0.88));
        }

        data[idx] = rr;
        data[idx + 1] = gg;
        data[idx + 2] = bb;
        data[idx + 3] = 255;
      }
    }

    fallbackOffCtx.putImageData(fallbackImg, 0, 0);
    fallbackCtx.save();
    fallbackCtx.setTransform(1, 0, 0, 1, 0, 0);
    fallbackCtx.imageSmoothingEnabled = true;
    fallbackCtx.drawImage(fallbackOffscreen, 0, 0, dom.memeticCanvas.width, dom.memeticCanvas.height);
    fallbackCtx.restore();
  }

  function drawMemetic(now, dt) {
    const p = phase === 'CONFIRMED' || phase === 'REVEALING' ? 1 : holdProgress;
    const isAbortFlash = now < abortFlashUntil;
    const abortAmt = isAbortFlash ? clamp01((abortFlashUntil - now) / 1100) : 0;

    visualPhase += dt * (1.0 + p * p * 4.8);

    glitchTimer -= dt * (1.0 + p * 3.8);
    if (glitchTimer <= 0) {
      glitchBurst = 0.75 + Math.random() * 0.25;
      glitchTimer = phase === 'HOLDING' ? 0.16 + Math.random() * 0.35 : 1.4 + Math.random() * 2.2;
    } else {
      glitchBurst = Math.max(0, glitchBurst - dt * 4.5);
    }
    const glitchAmt = clamp01(glitchBurst + (phase === 'HOLDING' ? p * 0.45 : 0));

    if (confirmFlash > 0) {
      confirmFlash = Math.max(0, confirmFlash - dt * 2.6);
    }

    if (rendererMode === 'webgl' && gl && glProgram) {
      gl.viewport(0, 0, dom.memeticCanvas.width, dom.memeticCanvas.height);
      gl.uniform2f(glUniforms.resolution, dom.memeticCanvas.width, dom.memeticCanvas.height);
      gl.uniform1f(glUniforms.time, visualPhase);
      gl.uniform1f(glUniforms.hold, p);
      gl.uniform1f(glUniforms.abort, abortAmt);
      gl.uniform1f(glUniforms.glitch, glitchAmt);
      gl.uniform1f(glUniforms.flash, confirmFlash);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else if (rendererMode === '2d') {
      renderMemetic2D(now, p, abortAmt, glitchAmt, confirmFlash);
    }

    if (dom.apertureProgress) {
      dom.apertureProgress.style.strokeDashoffset = String((1 - p) * 100);
    }

    if (dom.memeticFreq) {
      const freq = 14.2 + p * 54.2 + (phase === 'HOLDING' ? Math.sin(now * 0.03) * 1.1 : 0);
      dom.memeticFreq.textContent = `FREQ: ${freq.toFixed(1)} Hz`;
    }
    if (dom.inocStatus) {
      if (phase === 'CONFIRMED' || phase === 'REVEALING') {
        dom.inocStatus.textContent = 'INOCULATION: CONFIRMED';
      } else if (phase === 'HOLDING') {
        dom.inocStatus.textContent = `INOCULATION: INJECTING ${Math.round(p * 100)}%`;
      } else if (isAbortFlash) {
        dom.inocStatus.textContent = 'INOCULATION: INTERRUPTED';
      } else {
        dom.inocStatus.textContent = 'INOCULATION: STANDBY';
      }
    }
  }

  /* ========================================================================
     ECG WAVEFORM SYNTHESIS & RENDERING
     ======================================================================== */
  function evalEcgWave(p) {
    let v = 0;
    v += 0.14 * Math.exp(-Math.pow((p - 0.16) / 0.032, 2));
    v -= 0.17 * Math.exp(-Math.pow((p - 0.255) / 0.011, 2));
    v += 0.94 * Math.exp(-Math.pow((p - 0.285) / 0.0125, 2));
    v -= 0.28 * Math.exp(-Math.pow((p - 0.315) / 0.013, 2));
    v += 0.23 * Math.exp(-Math.pow((p - 0.48) / 0.052, 2));
    v += Math.sin(p * Math.PI * 18) * 0.012;
    return v;
  }

  function resetEcgBuffer() {
    ecgSamples = [];
    ecgBeatPhase = 0;
    ecgSampleAccum = 0;
    currentBpm = 72;
    for (let i = 0; i < ECG_POINTS; i++) {
      const p = (i * (72 / 60) * ECG_SAMPLE_DT) % 1;
      ecgSamples.push(evalEcgWave(p));
    }
    ecgBeatPhase = (ECG_POINTS * (72 / 60) * ECG_SAMPLE_DT) % 1;
  }

  function stepEcgSamples(dt, now) {
    const isAbortFlash = now < abortFlashUntil;
    const idleBpm = 72 + Math.sin(now * 0.0011) * 1.8;
    const targetBpm = phase === 'CONFIRMED' || phase === 'REVEALING'
      ? 148
      : phase === 'HOLDING'
        ? 72 + Math.pow(holdProgress, 0.85) * 78
        : isAbortFlash
          ? 112
          : idleBpm;

    currentBpm += (targetBpm - currentBpm) * Math.min(1, dt * 8.5);

    ecgSampleAccum += dt;
    let guard = 0;
    while (ecgSampleAccum >= ECG_SAMPLE_DT && guard < 12) {
      ecgSampleAccum -= ECG_SAMPLE_DT;
      guard++;

      const prevPhase = ecgBeatPhase;
      ecgBeatPhase = (ecgBeatPhase + (currentBpm / 60) * ECG_SAMPLE_DT) % 1;

      const crossedR =
        (prevPhase < 0.285 && ecgBeatPhase >= 0.285) ||
        (prevPhase > ecgBeatPhase && ecgBeatPhase >= 0.285);
      if (crossedR && phase === 'HOLDING') {
        sound.playBioPip(holdProgress);
      }

      const noise = (Math.random() - 0.5) * (0.02 + holdProgress * 0.032);
      ecgSamples.push(evalEcgWave(ecgBeatPhase) + noise);
      if (ecgSamples.length > ECG_POINTS) {
        ecgSamples.shift();
      }
    }
  }

  function drawEcg(now) {
    if (!ecgCtx) return;
    const w = ecgSize.w;
    const h = ecgSize.h;
    if (w < 20 || h < 16) return;

    const isAbortFlash = now < abortFlashUntil;
    const p = phase === 'CONFIRMED' || phase === 'REVEALING' ? 1 : holdProgress;

    // Color progression: Amber -> Alarm Red -> Incandescent White-Hot (or Confirmed Emerald-White)
    let r;
    let g;
    let b;
    if (phase === 'CONFIRMED' || phase === 'REVEALING') {
      r = 120;
      g = 255;
      b = 210;
    } else if (isAbortFlash) {
      r = 217;
      g = 35;
      b = 35;
    } else if (p <= 0.55) {
      const t = p / 0.55;
      r = Math.round(lerp(255, 255, t));
      g = Math.round(lerp(176, 36, t));
      b = Math.round(lerp(0, 36, t));
    } else {
      const t = (p - 0.55) / 0.45;
      r = 255;
      g = Math.round(lerp(36, 245, t));
      b = Math.round(lerp(36, 245, t));
    }

    const traceRgb = `${r}, ${g}, ${b}`;
    const traceColor = `rgb(${traceRgb})`;

    ecgCtx.fillStyle = '#07090C';
    ecgCtx.fillRect(0, 0, w, h);

    ecgCtx.strokeStyle = '#131820';
    ecgCtx.lineWidth = 1;
    ecgCtx.beginPath();
    const cols = 18;
    for (let i = 1; i < cols; i++) {
      const x = Math.floor((w / cols) * i) + 0.5;
      ecgCtx.moveTo(x, 0);
      ecgCtx.lineTo(x, h);
    }
    const rows = 4;
    for (let j = 1; j < rows; j++) {
      const y = Math.floor((h / rows) * j) + 0.5;
      ecgCtx.moveTo(0, y);
      ecgCtx.lineTo(w, y);
    }
    ecgCtx.stroke();

    const baseY = h * 0.65;
    ecgCtx.strokeStyle = 'rgba(90, 100, 117, 0.25)';
    ecgCtx.beginPath();
    ecgCtx.moveTo(0, Math.floor(baseY) + 0.5);
    ecgCtx.lineTo(w, Math.floor(baseY) + 0.5);
    ecgCtx.stroke();

    if (ecgSamples.length < 2) return;

    const stepX = w / (ECG_POINTS - 1);
    const ampScale = h * (0.48 + p * 0.28);
    const mapY = (val) => Math.max(3, Math.min(h - 3, baseY - val * ampScale));

    const grad = ecgCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(${traceRgb}, 0.28)`);
    grad.addColorStop(1, `rgba(${traceRgb}, 0.01)`);

    ecgCtx.beginPath();
    for (let i = 0; i < ecgSamples.length; i++) {
      const x = i * stepX;
      const y = mapY(ecgSamples[i]);
      if (i === 0) ecgCtx.moveTo(x, y);
      else ecgCtx.lineTo(x, y);
    }
    ecgCtx.lineTo(w, h);
    ecgCtx.lineTo(0, h);
    ecgCtx.closePath();
    ecgCtx.fillStyle = grad;
    ecgCtx.fill();

    ecgCtx.save();
    ecgCtx.strokeStyle = traceColor;
    ecgCtx.lineWidth = 1.85;
    ecgCtx.shadowColor = `rgba(${traceRgb}, 0.78)`;
    ecgCtx.shadowBlur = 8;
    ecgCtx.beginPath();
    for (let i = 0; i < ecgSamples.length; i++) {
      const x = i * stepX;
      const y = mapY(ecgSamples[i]);
      if (i === 0) ecgCtx.moveTo(x, y);
      else ecgCtx.lineTo(x, y);
    }
    ecgCtx.stroke();
    ecgCtx.restore();

    const headY = mapY(ecgSamples[ecgSamples.length - 1]);
    ecgCtx.fillStyle = '#FFFFFF';
    ecgCtx.fillRect(w - 4, headY - 2, 4, 4);

    if (dom.ecgBpm) {
      dom.ecgBpm.textContent = `${Math.round(currentBpm)} BPM`;
      dom.ecgBpm.style.color = traceColor;
    }
    if (dom.ecgState) {
      let stateText = 'STANDBY';
      let stateCls = 'boot-ecg-state';
      if (phase === 'CONFIRMED' || phase === 'REVEALING') {
        stateText = 'CONFIRMED';
        stateCls = 'boot-ecg-state is-ok';
      } else if (phase === 'HOLDING') {
        stateText = holdProgress > 0.45 ? 'OVERDRIVE' : 'SCANNING';
        stateCls = holdProgress > 0.35 ? 'boot-ecg-state is-red' : 'boot-ecg-state is-amber';
      } else if (isAbortFlash) {
        stateText = 'ABORTED';
        stateCls = 'boot-ecg-state is-red';
      }
      dom.ecgState.textContent = stateText;
      dom.ecgState.className = stateCls;
    }
  }

  /* ========================================================================
     LEFT KERNEL STREAM & RIGHT BIO-COG TELEMETRY
     ======================================================================== */
  function pushKernelLine(tag, text, tone = 'hex') {
    if (!dom.kernelStream) return;
    const row = document.createElement('div');
    row.className = `boot-kernel-line is-${tone}`;

    const t = document.createElement('span');
    t.className = 'boot-kernel-tag';
    t.textContent = `[${tag}]`;

    const msg = document.createElement('span');
    msg.className = 'boot-kernel-msg';
    msg.textContent = text;

    row.appendChild(t);
    row.appendChild(msg);
    dom.kernelStream.appendChild(row);

    while (dom.kernelStream.children.length > MAX_KERNEL_LINES) {
      dom.kernelStream.removeChild(dom.kernelStream.firstChild);
    }
    dom.kernelStream.scrollTop = dom.kernelStream.scrollHeight;
  }

  function seedKernelStream() {
    if (!dom.kernelStream) return;
    dom.kernelStream.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const [tag, msg] = KERNEL_IDLE_POOL[i % KERNEL_IDLE_POOL.length];
      pushKernelLine(tag, msg, tag === 'VAX' ? 'amber' : tag === 'SEC' ? 'crit' : 'hex');
    }
    kernelPoolIdx = 2;
    holdPoolIdx = 0;
  }

  function updateKernelStream(dt) {
    kernelAccum += dt;
    const cadence = phase === 'HOLDING' ? 0.062 : 0.42;
    if (kernelAccum < cadence) return;
    kernelAccum = 0;

    if (phase === 'HOLDING') {
      const [tag, msg] = KERNEL_HOLD_POOL[holdPoolIdx % KERNEL_HOLD_POOL.length];
      holdPoolIdx += 1;
      const pct = Math.round(holdProgress * 100);
      const hex = Math.floor(Math.random() * 0xffff)
        .toString(16)
        .toUpperCase()
        .padStart(4, '0');
      pushKernelLine(tag, `${msg} [${pct}% :: 0x${hex}]`, tag === 'INJ' ? 'inject' : 'amber');
      if (dom.kernelRate) dom.kernelRate.textContent = `INJECT // ${pct}%`;
    } else if (phase === 'IDLE' || phase === 'ABORTING') {
      const [tag, msg] = KERNEL_IDLE_POOL[kernelPoolIdx % KERNEL_IDLE_POOL.length];
      kernelPoolIdx += 1;
      pushKernelLine(tag, msg, tag === 'VAX' ? 'amber' : tag === 'SEC' ? 'crit' : 'hex');
      if (dom.kernelRate) dom.kernelRate.textContent = 'HEX-SYNC';
    }
  }

  function updateRightTelemetry(dt, now) {
    telemetryAccum += dt;
    if (telemetryAccum < 0.065) return;
    telemetryAccum = 0;

    const p = phase === 'CONFIRMED' || phase === 'REVEALING' ? 1 : holdProgress;
    const isHolding = phase === 'HOLDING';
    const isConfirmed = phase === 'CONFIRMED' || phase === 'REVEALING';

    const targetOptic = isConfirmed
      ? 24.0
      : isHolding
        ? 85.0 + p * 14.6 + (Math.random() - 0.5) * 2.4
        : 39.0 + Math.sin(now * 0.0022) * 4.5 + (Math.random() - 0.5) * 3.2;
    opticLoad = lerp(opticLoad, Math.max(8, Math.min(99.8, targetOptic)), 0.38);

    const targetCog = isConfirmed
      ? 99.4
      : isHolding
        ? 72.0 + p * 26.5 + (Math.random() - 0.5) * 3.5
        : 84.0 + Math.cos(now * 0.0017) * 2.2 + (Math.random() - 0.5) * 1.4;
    cogResistance = lerp(cogResistance, Math.max(20, Math.min(99.8, targetCog)), 0.34);

    if (dom.opticVal) dom.opticVal.textContent = `${opticLoad.toFixed(1)}%`;
    if (dom.opticState) {
      if (isConfirmed) {
        dom.opticState.textContent = 'SHIELDED';
        dom.opticState.className = 'boot-telem-state is-ok';
      } else if (opticLoad >= 75) {
        dom.opticState.textContent = 'CRITICAL';
        dom.opticState.className = 'boot-telem-state is-red';
      } else {
        dom.opticState.textContent = 'ELEVATED';
        dom.opticState.className = 'boot-telem-state is-amber';
      }
    }

    if (dom.opticLedBar) {
      const lit = Math.round((opticLoad / 100) * 20);
      const segs = dom.opticLedBar.children;
      for (let i = 0; i < segs.length; i++) {
        if (i < lit) {
          segs[i].className =
            isConfirmed ? 'boot-led-seg on-ok' : i >= 14 || opticLoad >= 75 ? 'boot-led-seg on-red' : 'boot-led-seg on-amber';
        } else {
          segs[i].className = 'boot-led-seg';
        }
      }
    }

    if (dom.opticBarsEl) {
      const children = dom.opticBarsEl.children;
      for (let i = 0; i < children.length; i++) {
        const wave = 0.5 + 0.5 * Math.sin(now * (isHolding ? 0.018 : 0.005) + i * 0.65);
        const tgt = isConfirmed
          ? 0.22 + wave * 0.16
          : isHolding
            ? 0.52 + wave * 0.46
            : 0.22 + wave * 0.38;
        opticBars[i] = lerp(opticBars[i], tgt, 0.45);
        const pctH = Math.round(clamp01(opticBars[i]) * 100);
        const barEl = children[i];
        barEl.style.height = `${pctH}%`;
        barEl.className = isConfirmed
          ? 'boot-optic-bar is-ok'
          : isHolding || pctH > 72
            ? 'boot-optic-bar is-red'
            : 'boot-optic-bar';
      }
    }

    if (dom.cogVal) dom.cogVal.textContent = `${cogResistance.toFixed(1)}%`;
    if (dom.cogState) {
      if (isConfirmed) {
        dom.cogState.textContent = 'SHIELDED';
        dom.cogState.className = 'boot-telem-state is-ok';
      } else if (isHolding) {
        dom.cogState.textContent = p > 0.6 ? 'REINFORCING' : 'STRESSED';
        dom.cogState.className = p > 0.6 ? 'boot-telem-state is-ok' : 'boot-telem-state is-amber';
      } else {
        dom.cogState.textContent = 'NOMINAL';
        dom.cogState.className = 'boot-telem-state';
      }
    }

    if (dom.cogBarBase) {
      dom.cogBarBase.style.width = `${Math.round(cogResistance)}%`;
    }
    if (dom.cogBarShield) {
      const shieldPct = isConfirmed ? 100 : isHolding ? Math.round(14 + p * 86) : 12;
      dom.cogBarShield.style.width = `${shieldPct}%`;
    }

    const inocPctVal = isConfirmed ? 100 : isHolding ? Math.round(p * 100) : 0;
    if (dom.inocBar) dom.inocBar.style.width = `${inocPctVal}%`;
    if (dom.inocPct) dom.inocPct.textContent = `${String(inocPctVal).padStart(2, '0')}%`;
    if (dom.inocBadge) {
      if (isConfirmed) {
        dom.inocBadge.textContent = 'CONFIRMED';
        dom.inocBadge.className = 'boot-telem-state is-ok';
      } else if (isHolding) {
        dom.inocBadge.textContent = 'INJECTING';
        dom.inocBadge.className = 'boot-telem-state is-amber';
      } else if (now < abortFlashUntil) {
        dom.inocBadge.textContent = 'ABORTED';
        dom.inocBadge.className = 'boot-telem-state is-red';
      } else {
        dom.inocBadge.textContent = 'STANDBY';
        dom.inocBadge.className = 'boot-telem-state';
      }
    }

    if (dom.cortexSync) {
      const hz = 14.2 + p * 54.2 + Math.sin(now * 0.008) * 0.3;
      dom.cortexSync.textContent = `${hz.toFixed(1)} Hz`;
    }
    if (dom.pupilVal) {
      const mm = isConfirmed ? 3.2 : 3.4 + p * 2.1 + Math.sin(now * 0.01) * 0.1;
      dom.pupilVal.textContent = `${mm.toFixed(1)} mm`;
    }
    if (dom.synapticVal) {
      const mv = isConfirmed ? 0.04 : 0.18 + p * 1.45 + Math.cos(now * 0.013) * 0.06;
      dom.synapticVal.textContent = `+${mv.toFixed(2)} mV`;
    }
    if (dom.gwLatency) {
      const ms = (10.4 + Math.sin(now * 0.003) * 1.2 + (isHolding ? 2.8 : 0)).toFixed(1);
      dom.gwLatency.textContent = `${ms} ms`;
    }
    if (dom.bottomClock) {
      dom.bottomClock.textContent = formatUtcShort(new Date());
    }
  }

  function resizeCanvases() {
    if (!isOpenFlag) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const memeticParent = dom.canvasSlot || (dom.memeticCanvas && dom.memeticCanvas.parentElement);
    if (dom.memeticCanvas && memeticParent) {
      const rect = memeticParent.getBoundingClientRect();
      if (rect.width > 10 && rect.height > 10) {
        const w = Math.floor(rect.width);
        const h = Math.floor(rect.height);
        memeticSize = { w, h };
        const glDpr = Math.min(dpr, 1.75);
        dom.memeticCanvas.width = Math.floor(w * glDpr);
        dom.memeticCanvas.height = Math.floor(h * glDpr);
      }
    }

    if (dom.ecgCanvas && ecgCtx && dom.ecgCanvas.parentElement) {
      const rect = dom.ecgCanvas.parentElement.getBoundingClientRect();
      if (rect.width > 10 && rect.height > 10) {
        const w = Math.floor(rect.width);
        const h = Math.floor(rect.height);
        ecgSize = { w, h };
        dom.ecgCanvas.width = Math.floor(w * dpr);
        dom.ecgCanvas.height = Math.floor(h * dpr);
        ecgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
  }

  /* ========================================================================
     PROGRESS UI & BIOMETRIC HOLD LIFECYCLE
     ======================================================================== */
  function syncHoldUi() {
    const p = clamp01(holdProgress);
    if (dom.holdFill) {
      dom.holdFill.style.transform = `scaleX(${p})`;
    }
    if (dom.holdRingProgress) {
      dom.holdRingProgress.style.strokeDashoffset = String((1 - p) * 100);
    }
    if (dom.holdPct) {
      dom.holdPct.textContent = `${String(Math.round(p * 100)).padStart(2, '0')}%`;
    }
  }

  function startHold() {
    if (!isOpenFlag) return;
    if (phase !== 'IDLE' && phase !== 'ABORTING') return;

    sound.unlock();
    if (!sound.isEnabled()) {
      sound.setEnabled(true);
    }
    sound.startBioScan();

    holdProgress = 0;
    abortFlashUntil = 0;
    phase = 'HOLDING';

    if (dom.screen) {
      dom.screen.classList.remove('is-aborted', 'is-confirmed');
      dom.screen.classList.add('is-holding');
    }
    if (dom.holdBtn) {
      dom.holdBtn.classList.remove('is-aborted');
      dom.holdBtn.classList.add('is-holding');
    }
    if (dom.statusLine) {
      dom.statusLine.textContent = 'COUNTER-MEME INJECTING // 正在对抗认知危害并校验心率波形...';
    }
    pushKernelLine('BIO', 'BIOMETRIC HOLD ENGAGED // INJECTING ANTI-MEMETIC PULSE', 'inject');
    syncHoldUi();
  }

  function abortHold() {
    if (phase !== 'HOLDING' || holdProgress >= 1) return;

    phase = 'ABORTING';
    abortFlashUntil = performance.now() + 1100;
    activePointerId = null;
    activeKeyHold = false;
    setStageShake(0, 0);

    sound.playScanAbort();

    if (dom.screen) {
      dom.screen.classList.remove('is-holding');
      dom.screen.classList.add('is-aborted');
    }
    if (dom.holdBtn) {
      dom.holdBtn.classList.remove('is-holding');
      dom.holdBtn.classList.add('is-aborted');
    }
    if (dom.statusLine) {
      dom.statusLine.textContent = ABORT_STATUS_TEXT;
    }
    pushKernelLine('ABORT', 'BIOMETRIC LINK SEVERED // COUNTER-MEME HALTED', 'crit');
  }

  function completeVerification() {
    if (phase !== 'HOLDING') return;
    phase = 'CONFIRMED';
    holdProgress = 1;
    confirmFlash = 1.0;
    activePointerId = null;
    activeKeyHold = false;
    setStageShake(0, 0);
    syncHoldUi();

    sound.unlock();
    if (!sound.isEnabled()) {
      sound.setEnabled(true);
    }
    sound.playHandshakeConfirm();

    if (dom.screen) {
      dom.screen.classList.remove('is-holding', 'is-aborted');
      dom.screen.classList.add('is-confirmed');
    }
    if (dom.confirmFlashEl) {
      dom.confirmFlashEl.classList.remove('active');
      void dom.confirmFlashEl.offsetWidth;
      dom.confirmFlashEl.classList.add('active');
    }
    if (dom.confirmMeta) {
      dom.confirmMeta.textContent = `CARDIAC: ${Math.max(145, Math.round(currentBpm))} BPM // INOCULATION: CONFIRMED // AUDIO: ON`;
    }
    if (dom.holdBtn) {
      dom.holdBtn.classList.remove('is-holding', 'is-aborted');
      dom.holdBtn.disabled = true;
    }
    if (dom.statusLine) {
      dom.statusLine.textContent = 'LIFE SIGNS CONFIRMED // 生命体征已确认 — 欢迎接入 SITE-19';
    }
    if (dom.kernelRate) {
      dom.kernelRate.textContent = 'LOCK // GRANTED';
    }
    pushKernelLine('CONFIRMED', 'LIFE SIGNS CONFIRMED // ACCESS GRANTED -> SITE-19', 'ok');

    scheduleTimer(() => {
      beginReveal('verified');
    }, CONFIRM_HOLD_MS);
  }

  function beginReveal(reason) {
    if (phase === 'REVEALING' || phase === 'CLOSED') return;
    phase = 'REVEALING';
    setStageShake(0, 0);

    const isFast = reason === 'bypass';
    const duration = isFast ? BYPASS_REVEAL_MS : REVEAL_DURATION_MS;

    if (dom.screen) {
      dom.screen.classList.remove('is-holding', 'is-aborted', 'is-confirmed');
      if (isFast) dom.screen.classList.add('is-fast');
      dom.screen.classList.add('is-revealing');
    }
    if (!isFast) {
      document.body.classList.add('terminal-crt-wake');
    }

    scheduleTimer(() => {
      finalizeClose(reason);
    }, duration);
  }

  function finalizeClose(reason) {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    clearAllTimers();
    sound.stopBioScan(false);
    detachRuntimeListeners();
    destroyMemeticRenderer(true);
    setStageShake(0, 0);

    activePointerId = null;
    activeKeyHold = false;
    holdProgress = 0;
    confirmFlash = 0;
    phase = 'CLOSED';
    isOpenFlag = false;

    document.body.classList.remove('terminal-crt-wake');

    if (dom.confirmFlashEl) {
      dom.confirmFlashEl.classList.remove('active');
    }
    if (dom.screen) {
      dom.screen.classList.remove('is-holding', 'is-aborted', 'is-confirmed', 'is-revealing', 'is-fast');
      dom.screen.classList.add('is-hidden');
      dom.screen.setAttribute('aria-hidden', 'true');
    }
    if (dom.holdBtn) {
      dom.holdBtn.disabled = false;
      dom.holdBtn.classList.remove('is-holding', 'is-aborted');
    }

    if (reason === 'verified' && typeof callbacks.onVerified === 'function') {
      callbacks.onVerified();
    } else if (reason === 'bypass' && typeof callbacks.onBypass === 'function') {
      callbacks.onBypass();
    }
  }

  function tick(now) {
    if (!isOpenFlag) {
      rafId = null;
      return;
    }

    if (!lastFrameTs) lastFrameTs = now;
    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTs) / 1000));
    lastFrameTs = now;

    if (phase === 'HOLDING') {
      holdProgress = Math.min(1, holdProgress + dt / (HOLD_DURATION_MS / 1000));
      syncHoldUi();
      sound.updateBioScan(holdProgress);

      const amp = holdProgress * holdProgress * 2.6;
      const sx = (Math.sin(now * 0.14) * 0.6 + (Math.random() - 0.5) * 0.8) * amp;
      const sy = (Math.cos(now * 0.17) * 0.6 + (Math.random() - 0.5) * 0.8) * amp;
      setStageShake(sx, sy);

      if (holdProgress >= 1) {
        completeVerification();
      }
    } else if (phase === 'ABORTING') {
      setStageShake(0, 0);
      if (holdProgress > 0) {
        holdProgress = Math.max(0, holdProgress - dt * ABORT_DECAY_RATE);
        syncHoldUi();
      }
      if (holdProgress === 0 && now >= abortFlashUntil) {
        phase = 'IDLE';
        if (dom.screen) dom.screen.classList.remove('is-aborted');
        if (dom.holdBtn) dom.holdBtn.classList.remove('is-aborted');
        if (dom.statusLine) dom.statusLine.textContent = DEFAULT_STATUS_TEXT;
      }
    }

    stepEcgSamples(dt, now);
    drawMemetic(now, dt);
    drawEcg(now);
    updateKernelStream(dt);
    updateRightTelemetry(dt, now);

    if (isOpenFlag) {
      rafId = requestAnimationFrame(tick);
    }
  }

  /* ========================================================================
     EVENT WIRING & PUBLIC API
     ======================================================================== */
  function handleWindowBlurOrHide() {
    if (phase === 'HOLDING') {
      abortHold();
    }
  }

  function attachRuntimeListeners() {
    window.addEventListener('resize', resizeCanvases);
    window.addEventListener('blur', handleWindowBlurOrHide);
    document.addEventListener('visibilitychange', handleWindowBlurOrHide);
  }

  function detachRuntimeListeners() {
    window.removeEventListener('resize', resizeCanvases);
    window.removeEventListener('blur', handleWindowBlurOrHide);
    document.removeEventListener('visibilitychange', handleWindowBlurOrHide);
  }

  function bindStaticEvents() {
    if (dom.bypassBtn) {
      dom.bypassBtn.addEventListener('click', () => {
        bypass();
      });
    }

    if (dom.holdBtn) {
      dom.holdBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });

      dom.holdBtn.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        if (activePointerId !== null) return;
        activePointerId = e.pointerId;
        try {
          dom.holdBtn.setPointerCapture(e.pointerId);
        } catch (_) {}
        startHold();
      });

      const endPointerHold = (e) => {
        if (activePointerId === null || e.pointerId !== activePointerId) return;
        activePointerId = null;
        try {
          if (dom.holdBtn.hasPointerCapture(e.pointerId)) {
            dom.holdBtn.releasePointerCapture(e.pointerId);
          }
        } catch (_) {}
        if (phase === 'HOLDING') {
          abortHold();
        }
      };

      dom.holdBtn.addEventListener('pointerup', endPointerHold);
      dom.holdBtn.addEventListener('pointercancel', endPointerHold);
      dom.holdBtn.addEventListener('lostpointercapture', endPointerHold);

      dom.holdBtn.addEventListener('keydown', (e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        if (e.repeat || activeKeyHold) return;
        activeKeyHold = true;
        startHold();
      });

      dom.holdBtn.addEventListener('keyup', (e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        if (!activeKeyHold) return;
        activeKeyHold = false;
        if (phase === 'HOLDING') {
          abortHold();
        }
      });
    }
  }

  function open(isInitial = false) {
    if (!dom.screen) return;

    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    clearAllTimers();
    sound.stopBioScan(false);
    detachRuntimeListeners();
    setStageShake(0, 0);

    phase = 'IDLE';
    holdProgress = 0;
    visualPhase = 0;
    lastFrameTs = 0;
    activePointerId = null;
    activeKeyHold = false;
    abortFlashUntil = 0;
    confirmFlash = 0;
    glitchTimer = 2.0;
    glitchBurst = 0;
    kernelAccum = 0;
    telemetryAccum = 1;
    opticLoad = 38.4;
    cogResistance = 84.2;
    isOpenFlag = true;

    resetEcgBuffer();
    seedKernelStream();

    if (dom.gwSession) {
      const saved = window.SessionStore ? window.SessionStore.load() : null;
      const sessNum = saved && saved.sessionCount ? saved.sessionCount : 1;
      dom.gwSession.textContent = `S#${String(sessNum).padStart(2, '0')}`;
    }

    dom.screen.classList.remove(
      'is-hidden',
      'is-revealing',
      'is-fast',
      'is-holding',
      'is-aborted',
      'is-confirmed'
    );
    dom.screen.setAttribute('aria-hidden', 'false');

    if (dom.confirmFlashEl) {
      dom.confirmFlashEl.classList.remove('active');
    }
    if (dom.holdBtn) {
      dom.holdBtn.disabled = false;
      dom.holdBtn.classList.remove('is-holding', 'is-aborted');
    }
    if (dom.statusLine) {
      dom.statusLine.textContent = DEFAULT_STATUS_TEXT;
    }
    if (dom.kernelRate) {
      dom.kernelRate.textContent = 'HEX-SYNC';
    }
    syncHoldUi();

    attachRuntimeListeners();
    initMemeticRenderer();
    resizeCanvases();
    updateRightTelemetry(0.1, performance.now());
    rafId = requestAnimationFrame(tick);

    if (!isInitial && typeof callbacks.onLock === 'function') {
      callbacks.onLock();
    }
  }

  function bypass() {
    if (!isOpenFlag || phase === 'REVEALING' || phase === 'CLOSED') return;
    sound.stopBioScan(false);
    sound.playClick();
    clearAllTimers();
    activePointerId = null;
    activeKeyHold = false;
    beginReveal('bypass');
  }

  function close() {
    if (!isOpenFlag && phase === 'CLOSED') return;
    finalizeClose('manual');
  }

  function isOpen() {
    return isOpenFlag;
  }

  function init(opts = {}) {
    callbacks = opts || {};
    cacheDom();
    if (!dom.screen) return;
    bindStaticEvents();
    open(true);
  }

  window.BootScreen = {
    init,
    open,
    close,
    bypass,
    isOpen
  };
})();
