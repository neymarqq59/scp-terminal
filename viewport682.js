(function () {
  'use strict';

  /**
   * Dedicated SCP-682 Containment Vat Surveillance Module (`Viewport682`)
   * 100% Pure Canvas 2D renderer:
   * - Pseudo-color FLIR infrared thermography + acoustic sonar sweep
   * - Deep-blue concentrated HCl vat with rising yellow-green corrosive bubbles
   * - Abstract multi-lobe submerged reptilian heat signature (strictly non-cartoon)
   * - Interactive [注入高浓盐酸] & [高能激光处决测试] with 1s laser strike,
   *   4s adaptation rampage (procedural spiderweb glass cracks, camera shake, RGB glitch,
   *   KANT-01 CRIT spike, SoundEngine alerts, SYS-LOG error flood), and 2s auto self-healing.
   */
  const HEAT_W = 200;
  const HEAT_H = 112;
  const GLITCH_W = 320;
  const GLITCH_H = 180;
  const NOISE_SIZE = 128;

  const LASER_MS = 1000;
  const RAMPAGE_MS = 4000;
  const HEAL_MS = 2600;
  const REFLECT_MS = 2200;

  const store = window.SessionStore || null;
  const bootSnapshot = store ? store.load() : null;
  const hadPersistedAdaptationAtBoot = Boolean(
    bootSnapshot && bootSnapshot.scp682 && bootSnapshot.scp682.adaptedLaser
  );
  let persistedAdaptedLaser = hadPersistedAdaptationAtBoot;
  let persistedLaserTestCount = Math.max(
    0,
    Number(bootSnapshot && bootSnapshot.scp682 && bootSnapshot.scp682.laserTestCount) || 0
  );
  let rebootAdaptationWarningLogged = false;

  function sync682Store() {
    if (!store) return;
    store.save({
      scp682: {
        adaptedLaser: persistedAdaptedLaser,
        laserTestCount: persistedLaserTestCount
      }
    });
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function buildNoiseGrid() {
    const rand = mulberry32(68201988);
    const raw = new Float32Array(NOISE_SIZE * NOISE_SIZE);
    for (let i = 0; i < raw.length; i++) {
      raw[i] = rand();
    }
    // Two periodic 3x3 smoothing passes for organic thermal convection
    const passA = new Float32Array(NOISE_SIZE * NOISE_SIZE);
    const passB = new Float32Array(NOISE_SIZE * NOISE_SIZE);
    const mask = NOISE_SIZE - 1;

    function smooth(src, dst) {
      for (let y = 0; y < NOISE_SIZE; y++) {
        for (let x = 0; x < NOISE_SIZE; x++) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const yy = (y + dy) & mask;
            const row = yy * NOISE_SIZE;
            for (let dx = -1; dx <= 1; dx++) {
              const xx = (x + dx) & mask;
              sum += src[row + xx];
            }
          }
          dst[y * NOISE_SIZE + x] = sum / 9;
        }
      }
    }

    smooth(raw, passA);
    smooth(passA, passB);
    return passB;
  }

  const NOISE_GRID = buildNoiseGrid();

  function sampleNoise(u, v) {
    const mask = NOISE_SIZE - 1;
    const fx = u * NOISE_SIZE;
    const fy = v * NOISE_SIZE;
    const x0 = Math.floor(fx) & mask;
    const y0 = Math.floor(fy) & mask;
    const x1 = (x0 + 1) & mask;
    const y1 = (y0 + 1) & mask;
    const tx = fx - Math.floor(fx);
    const ty = fy - Math.floor(fy);

    const a = NOISE_GRID[y0 * NOISE_SIZE + x0];
    const b = NOISE_GRID[y0 * NOISE_SIZE + x1];
    const c = NOISE_GRID[y1 * NOISE_SIZE + x0];
    const d = NOISE_GRID[y1 * NOISE_SIZE + x1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
  }

  function buildColorLut(stops) {
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let s0 = stops[0];
      let s1 = stops[stops.length - 1];
      for (let k = 0; k < stops.length - 1; k++) {
        if (t >= stops[k].t && t <= stops[k + 1].t) {
          s0 = stops[k];
          s1 = stops[k + 1];
          break;
        }
      }
      const span = Math.max(0.0001, s1.t - s0.t);
      const local = clamp((t - s0.t) / span, 0, 1);
      lut[i * 3] = Math.round(lerp(s0.c[0], s1.c[0], local));
      lut[i * 3 + 1] = Math.round(lerp(s0.c[1], s1.c[1], local));
      lut[i * 3 + 2] = Math.round(lerp(s0.c[2], s1.c[2], local));
    }
    return lut;
  }

  // Deep-blue cold acid pool -> teal boundary -> blazing orange/crimson/white-hot bio core
  const NORMAL_LUT = buildColorLut([
    { t: 0.0, c: [4, 10, 32] },
    { t: 0.18, c: [7, 28, 78] },
    { t: 0.34, c: [12, 68, 122] },
    { t: 0.46, c: [22, 114, 116] },
    { t: 0.56, c: [108, 146, 44] },
    { t: 0.67, c: [220, 108, 16] },
    { t: 0.79, c: [255, 56, 14] },
    { t: 0.90, c: [255, 178, 48] },
    { t: 1.0, c: [255, 252, 236] }
  ]);

  // Saturated crimson thermal overload during ADAPTATION rampage
  const RAMPAGE_LUT = buildColorLut([
    { t: 0.0, c: [14, 2, 6] },
    { t: 0.22, c: [58, 4, 12] },
    { t: 0.42, c: [142, 8, 18] },
    { t: 0.62, c: [224, 14, 24] },
    { t: 0.80, c: [255, 42, 34] },
    { t: 0.92, c: [255, 118, 86] },
    { t: 1.0, c: [255, 224, 214] }
  ]);

  // Anatomical submerged giant reptilian heat signature: skull, segmented spine, lateral ribs, undulating tail & tucked limbs
  const BIO_LOBES = [
    // Elongated reptilian snout, skull & occipital cranium (anterior left)
    { bx: -0.278, by: -0.095, rx: 0.042, ry: 0.015, rot: -0.34, weight: 0.56, waveAmp: 0.016, wavePhase: 2.3 },
    { bx: -0.225, by: -0.072, rx: 0.056, ry: 0.022, rot: -0.28, weight: 0.72, waveAmp: 0.014, wavePhase: 2.0 },
    { bx: -0.172, by: -0.050, rx: 0.052, ry: 0.024, rot: -0.24, weight: 0.78, waveAmp: 0.011, wavePhase: 1.7 },
    // Narrow segmented cervical, thoracic & lumbar vertebral core
    { bx: -0.118, by: -0.026, rx: 0.044, ry: 0.019, rot: -0.18, weight: 0.74, waveAmp: 0.009, wavePhase: 1.3 },
    { bx: -0.062, by: -0.006, rx: 0.048, ry: 0.021, rot: -0.08, weight: 0.84, waveAmp: 0.008, wavePhase: 0.9 },
    { bx: -0.004, by: 0.008, rx: 0.052, ry: 0.022, rot: 0.04, weight: 0.88, waveAmp: 0.007, wavePhase: 0.5 },
    { bx: 0.054, by: 0.020, rx: 0.048, ry: 0.020, rot: 0.14, weight: 0.82, waveAmp: 0.009, wavePhase: 0.2 },
    { bx: 0.110, by: 0.036, rx: 0.042, ry: 0.017, rot: 0.18, weight: 0.72, waveAmp: 0.012, wavePhase: 2.6 },
    // 4 pairs of distinct angled lateral rib arches radiating off thoracic spine
    { bx: -0.064, by: -0.046, rx: 0.013, ry: 0.034, rot: 0.42, weight: 0.44, waveAmp: 0.008, wavePhase: 0.9 },
    { bx: -0.072, by: 0.034, rx: 0.013, ry: 0.034, rot: -0.45, weight: 0.44, waveAmp: 0.008, wavePhase: 0.9 },
    { bx: -0.012, by: -0.038, rx: 0.014, ry: 0.040, rot: 0.36, weight: 0.48, waveAmp: 0.007, wavePhase: 0.5 },
    { bx: -0.020, by: 0.052, rx: 0.014, ry: 0.040, rot: -0.40, weight: 0.48, waveAmp: 0.007, wavePhase: 0.5 },
    { bx: 0.042, by: -0.026, rx: 0.014, ry: 0.038, rot: 0.32, weight: 0.44, waveAmp: 0.009, wavePhase: 0.2 },
    { bx: 0.034, by: 0.064, rx: 0.014, ry: 0.038, rot: -0.35, weight: 0.44, waveAmp: 0.009, wavePhase: 0.2 },
    { bx: 0.092, by: -0.008, rx: 0.012, ry: 0.030, rot: 0.28, weight: 0.36, waveAmp: 0.011, wavePhase: 2.6 },
    { bx: 0.086, by: 0.074, rx: 0.012, ry: 0.030, rot: -0.32, weight: 0.36, waveAmp: 0.011, wavePhase: 2.6 },
    // Tapering undulating caudal tail vertebrae
    { bx: 0.162, by: 0.044, rx: 0.038, ry: 0.014, rot: 0.08, weight: 0.58, waveAmp: 0.016, wavePhase: 3.1 },
    { bx: 0.212, by: 0.036, rx: 0.035, ry: 0.012, rot: -0.14, weight: 0.46, waveAmp: 0.024, wavePhase: 3.6 },
    { bx: 0.260, by: 0.018, rx: 0.032, ry: 0.010, rot: -0.26, weight: 0.36, waveAmp: 0.032, wavePhase: 4.1 },
    { bx: 0.305, by: -0.006, rx: 0.028, ry: 0.008, rot: -0.32, weight: 0.28, waveAmp: 0.040, wavePhase: 4.6 },
    { bx: 0.346, by: -0.032, rx: 0.024, ry: 0.007, rot: -0.36, weight: 0.20, waveAmp: 0.048, wavePhase: 5.1 },
    // Faint submerged crouched limb thermal joints
    { bx: -0.105, by: 0.078, rx: 0.034, ry: 0.016, rot: 0.65, weight: 0.28, waveAmp: 0.010, wavePhase: 1.5 },
    { bx: -0.082, by: -0.082, rx: 0.032, ry: 0.015, rot: -0.58, weight: 0.26, waveAmp: 0.010, wavePhase: 1.8 },
    { bx: 0.078, by: 0.098, rx: 0.036, ry: 0.017, rot: 0.52, weight: 0.30, waveAmp: 0.012, wavePhase: 2.4 },
    { bx: 0.108, by: -0.048, rx: 0.032, ry: 0.015, rot: -0.48, weight: 0.26, waveAmp: 0.012, wavePhase: 2.8 }
  ];

  function create(stageEl, ctx) {
    let phase = 'idle'; // 'idle' | 'laser' | 'rampage' | 'reflect' | 'healing'
    let isBreach = Boolean(ctx.isBreach);
    let clearance = Number(ctx.clearance) || 1;
    const deniedTimers = new WeakMap();
    let width = 640;
    let height = 350;

    if (store) {
      const snap = store.load();
      if (snap && snap.scp682) {
        persistedAdaptedLaser = Boolean(snap.scp682.adaptedLaser);
        persistedLaserTestCount = Math.max(0, Number(snap.scp682.laserTestCount) || 0);
      }
    }

    // Simulation state
    let acidBoost = 0;       // 0..1 bubble & turbulence surge
    let acidCool = 0;        // 0..1 temporary thermal suppression from cold HCl
    let acidLevel = 0.76;    // 0..1 vat liquid fill ratio
    let bioScale = persistedAdaptedLaser ? 1.06 : 1.0;
    let bioHeat = persistedAdaptedLaser ? 1.16 : 1.0;
    let bioOffsetX = 0;
    let bioOffsetY = 0;
    let rampageBlend = persistedAdaptedLaser ? 0.14 : 0; // 0..1 normal FLIR -> crimson overload
    let shakeMag = 0;
    let glitchIntensity = 0;
    let crackOpacity = 0;
    let healSweep = 0;
    let currentCoreTemp = persistedAdaptedLaser ? 94 : 76;
    let currentHclPct = 36.8;

    let laserTargetX = 0.48;
    let laserTargetY = 0.48;
    let sonarTimer = 0.6;
    let healStartTs = 0;
    let rampageStartTs = 0;
    let reflectStartTs = 0;
    let phaseEndTs = 0;
    let lastFrameTs = performance.now();
    let lastReadoutSyncTs = 0;
    let lastHumeOffsetSent = 0;

    let rafId = null;
    let resizeObserver = null;
    const timers = new Set();
    const intervals = new Set();

    const bubbles = [];
    const ripples = [];
    const sonarRings = [];
    const sparks = [];
    const cracks = [];

    // Offscreen thermal & RGB-glitch buffers (zero per-frame canvas allocations)
    const heatCanvas = document.createElement('canvas');
    heatCanvas.width = HEAT_W;
    heatCanvas.height = HEAT_H;
    const heatCtx = heatCanvas.getContext('2d');
    const heatImg = heatCtx.createImageData(HEAT_W, HEAT_H);

    const glitchCanvas = document.createElement('canvas');
    glitchCanvas.width = GLITCH_W;
    glitchCanvas.height = GLITCH_H;
    const glitchCtx = glitchCanvas.getContext('2d');

    const redChCanvas = document.createElement('canvas');
    redChCanvas.width = GLITCH_W;
    redChCanvas.height = GLITCH_H;
    const redChCtx = redChCanvas.getContext('2d');

    const cyanChCanvas = document.createElement('canvas');
    cyanChCanvas.width = GLITCH_W;
    cyanChCanvas.height = GLITCH_H;
    const cyanChCtx = cyanChCanvas.getContext('2d');

    if (ctx.hostEl) {
      ctx.hostEl.classList.add('has-bottom-bar');
    }

    const rootEl = document.createElement('div');
    rootEl.className = 'vp682-root';
    rootEl.innerHTML = `
      <canvas class="vp682-canvas"></canvas>
      <div class="vp682-status-tag mono" data-status-tag>IR-FLIR // VAT-09 SUBMERGED [36.8% HCl]</div>
      <div class="vp682-adapt-badge mono" data-adapt-badge title="目标已完成对高能光子的永久晶体化适应">◈ ADAPTED: PHOTONIC</div>
      <div class="vp682-reflect-flash" data-reflect-flash aria-hidden="true"></div>
      <div class="vp682-bottom-bar">
        <div class="vp682-readout mono">
          <span class="vp682-readout-dot" data-readout-dot></span>
          <span data-readout-text>CORE 76°C // HCl 36.8% // CONTAINMENT NOMINAL</span>
        </div>
        <div class="vp682-actions">
          <button type="button" class="vp682-btn vp682-btn-acid mono" data-acid-btn>注入高浓盐酸</button>
          <button type="button" class="vp682-btn vp682-btn-laser mono" data-laser-btn>高能激光处决测试</button>
        </div>
      </div>
    `;
    stageEl.appendChild(rootEl);

    const canvas = rootEl.querySelector('.vp682-canvas');
    const g = canvas.getContext('2d');
    const statusTagEl = rootEl.querySelector('[data-status-tag]');
    const adaptBadgeEl = rootEl.querySelector('[data-adapt-badge]');
    const reflectFlashEl = rootEl.querySelector('[data-reflect-flash]');
    const readoutDotEl = rootEl.querySelector('[data-readout-dot]');
    const readoutTextEl = rootEl.querySelector('[data-readout-text]');
    const acidBtn = rootEl.querySelector('[data-acid-btn]');
    const laserBtn = rootEl.querySelector('[data-laser-btn]');

    function scheduleTimeout(fn, ms) {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    }

    function scheduleInterval(fn, ms) {
      const id = setInterval(fn, ms);
      intervals.add(id);
      return id;
    }

    function clearAllTimers() {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      intervals.forEach((id) => clearInterval(id));
      intervals.clear();
    }

    function handleResize() {
      const rect = rootEl.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(240, Math.floor(rect.width));
      height = Math.max(180, Math.floor(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seedInitialBubbles() {
      const rand = mulberry32(68277);
      for (let i = 0; i < 36; i++) {
        bubbles.push({
          x: 0.08 + rand() * 0.84,
          y: 0.14 + rand() * 0.84,
          r: 1.4 + rand() * 3.8,
          vy: 0.06 + rand() * 0.11,
          phase: rand() * Math.PI * 2,
          amp: 0.004 + rand() * 0.009,
          alpha: 0.35 + rand() * 0.45
        });
      }
    }

    function setButtonsLocked(locked) {
      acidBtn.disabled = locked;
      laserBtn.disabled = locked;
      laserBtn.classList.toggle('is-running', locked);
    }

    function flashDeniedBtn(el) {
      if (!el) return;
      const prevTimer = deniedTimers.get(el);
      if (prevTimer) clearTimeout(prevTimer);
      el.classList.remove('vp-denied-shake');
      void el.offsetWidth;
      el.classList.add('vp-denied-shake');
      deniedTimers.set(
        el,
        setTimeout(() => {
          el.classList.remove('vp-denied-shake');
          deniedTimers.delete(el);
        }, 380)
      );
    }

    function updateAdaptBadgeUi() {
      if (adaptBadgeEl) {
        adaptBadgeEl.classList.toggle('visible', persistedAdaptedLaser);
      }
    }

    function updateClearanceUi() {
      if (phase !== 'idle') return;
      const locked = clearance < 3;
      laserBtn.classList.toggle('is-locked', locked);
      laserBtn.textContent = locked
        ? '🔒 激光处决测试 [LVL-3]'
        : persistedAdaptedLaser
        ? '高能激光测试 [已适应]'
        : '高能激光处决测试';
      laserBtn.title = locked
        ? '需要 LEVEL 3 安全权限解锁'
        : persistedAdaptedLaser
        ? '警告：目标已获得 [ADAPTED: PHOTONIC] 镜面反射适应性'
        : '启动 420kW 高能激光处决测试';
    }

    function updateHudLabels(nowMs) {
      if (nowMs - lastReadoutSyncTs < 95) return;
      lastReadoutSyncTs = nowMs;

      if (phase !== 'idle') {
        const rem = Math.max(0, (phaseEndTs - nowMs) / 1000).toFixed(1);
        if (phase === 'laser') {
          laserBtn.textContent = `激光照射中 ${rem}s`;
        } else if (phase === 'rampage') {
          laserBtn.textContent = `适应暴走中 ${rem}s`;
        } else if (phase === 'reflect') {
          laserBtn.textContent = `镜面折射反噬 ${rem}s`;
        } else if (phase === 'healing') {
          laserBtn.textContent = `镇静压制中 ${rem}s`;
        }
      }

      if (phase === 'idle') {
        const cooling = acidCool > 0.12;
        if (cooling) {
          statusTagEl.textContent = `IR-FLIR // HCl REFILL SUPPRESSION [${currentHclPct.toFixed(1)}%]`;
          statusTagEl.className = 'vp682-status-tag mono acid';
          readoutDotEl.className = 'vp682-readout-dot acid';
          readoutTextEl.textContent = `CORE ${Math.round(currentCoreTemp)}°C // HCl ${currentHclPct.toFixed(1)}% // THERMAL SUPPRESSED`;
        } else if (persistedAdaptedLaser) {
          statusTagEl.textContent = `IR-FLIR // VAT-09 ALERT [${currentHclPct.toFixed(1)}% HCl]`;
          statusTagEl.className = 'vp682-status-tag mono alert';
          readoutDotEl.className = 'vp682-readout-dot crit';
          readoutTextEl.textContent = `CORE ${Math.round(currentCoreTemp)}°C // HCl ${currentHclPct.toFixed(1)}% // PHOTONIC ALERT [TESTS:${Math.max(1, persistedLaserTestCount)}]`;
        } else {
          statusTagEl.textContent = `IR-FLIR // VAT-09 SUBMERGED [${currentHclPct.toFixed(1)}% HCl]`;
          statusTagEl.className = 'vp682-status-tag mono';
          readoutDotEl.className = 'vp682-readout-dot';
          readoutTextEl.textContent = `CORE ${Math.round(currentCoreTemp)}°C // HCl ${currentHclPct.toFixed(1)}% // SUBMERGED`;
        }
      } else if (phase === 'laser') {
        statusTagEl.textContent = 'EXECUTION // 420kW LASER ARRAY FIRING';
        statusTagEl.className = 'vp682-status-tag mono laser';
        readoutDotEl.className = 'vp682-readout-dot crit';
        readoutTextEl.textContent = `CORE ${Math.round(currentCoreTemp)}°C // LASER ABLATION ACTIVE`;
      } else if (phase === 'rampage') {
        statusTagEl.textContent = '⚠ ADAPTATION // 异常适应暴走 — BREACH RISK';
        statusTagEl.className = 'vp682-status-tag mono crit';
        readoutDotEl.className = 'vp682-readout-dot crit';
        readoutTextEl.textContent = `CORE ${Math.round(currentCoreTemp)}°C // HCl ${currentHclPct.toFixed(1)}% // GLASS FRACTURE!`;
      } else if (phase === 'reflect') {
        statusTagEl.textContent = '⚠ REFLECT // 背甲晶体化镜面折射 — PHOTONIC IMMUNE';
        statusTagEl.className = 'vp682-status-tag mono crit';
        readoutDotEl.className = 'vp682-readout-dot crit';
        readoutTextEl.textContent = `CORE ${Math.round(currentCoreTemp)}°C // 99.4% SPECULAR REFLECT!`;
      } else if (phase === 'healing') {
        statusTagEl.textContent = 'SEDATION // 紧急镇静与观测窗纳米自愈';
        statusTagEl.className = 'vp682-status-tag mono healing';
        readoutDotEl.className = 'vp682-readout-dot acid';
        readoutTextEl.textContent = `CORE ${Math.round(currentCoreTemp)}°C // SELF-HEALING ${(healSweep * 100).toFixed(0)}%`;
      }
    }

    function pushHumeOffsetIfChanged(val) {
      if (Math.abs(val - lastHumeOffsetSent) > 0.015) {
        lastHumeOffsetSent = val;
        ctx.setHumeOffset(val);
      }
    }

    /* ======================================================================
       PROCEDURAL BULLETPROOF GLASS SPIDERWEB CRACKS
       ====================================================================== */
    function spawnSpiderwebCrack(nx, ny, radiusScale = 1.0) {
      const rayCount = 12 + Math.floor(Math.random() * 4);
      const rays = [];
      const baseAngle = Math.random() * Math.PI * 2;

      for (let i = 0; i < rayCount; i++) {
        const angle = baseAngle + (i / rayCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.24;
        const maxLen = (95 + Math.random() * 145) * radiusScale;
        const segs = 5 + Math.floor(Math.random() * 4);
        const pts = [{ dx: 0, dy: 0 }];
        const branches = [];

        let curA = angle;
        let curDist = 0;
        for (let s = 1; s <= segs; s++) {
          curA += (Math.random() - 0.5) * 0.34;
          curDist = (s / segs) * maxLen;
          const px = Math.cos(curA) * curDist;
          const py = Math.sin(curA) * curDist;
          pts.push({ dx: px, dy: py });

          // Sub-branch bifurcation
          if (s >= 2 && s < segs && Math.random() < 0.58) {
            const bAngle = curA + (Math.random() > 0.5 ? 1 : -1) * (0.38 + Math.random() * 0.45);
            const bLen = (24 + Math.random() * 52) * radiusScale;
            const midX = px + Math.cos(bAngle) * bLen * 0.52;
            const midY = py + Math.sin(bAngle) * bLen * 0.52;
            const endX = midX + Math.cos(bAngle + (Math.random() - 0.5) * 0.28) * bLen * 0.48;
            const endY = midY + Math.sin(bAngle + (Math.random() - 0.5) * 0.28) * bLen * 0.48;
            branches.push([
              { dx: px, dy: py },
              { dx: midX, dy: midY },
              { dx: endX, dy: endY }
            ]);
          }
        }
        rays.push({ pts, branches, angle, maxLen });
      }

      // Concentric spiderweb rings linking neighboring radial rays
      const rings = [];
      const ringRadii = [22, 46, 78, 118].map((r) => r * radiusScale * (0.85 + Math.random() * 0.25));
      ringRadii.forEach((rr) => {
        const ringPts = [];
        for (let i = 0; i < rays.length; i++) {
          const ray = rays[i];
          if (rr < ray.maxLen * 0.92) {
            const jitterR = rr * (0.88 + Math.random() * 0.24);
            const a = ray.angle + (Math.random() - 0.5) * 0.08;
            ringPts.push({
              dx: Math.cos(a) * jitterR,
              dy: Math.sin(a) * jitterR
            });
          } else {
            ringPts.push(null);
          }
        }
        rings.push({ radius: rr, pts: ringPts });
      });

      cracks.push({
        nx,
        ny,
        rays,
        rings,
        progress: 0,
        bornAt: performance.now()
      });
      crackOpacity = 1.0;
    }

    function drawSpiderwebCracks(viewH) {
      if (cracks.length === 0 || crackOpacity <= 0.01) return;

      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';

      cracks.forEach((c) => {
        const cx = c.nx * width;
        const cy = c.ny * viewH;
        const p = c.progress;

        // Helper to trace visible portion of a polyline at normalized progress p
        const traceVisible = (pts, scaleP) => {
          if (pts.length < 2 || scaleP <= 0.01) return;
          const totalSegs = pts.length - 1;
          const exact = scaleP * totalSegs;
          const full = Math.floor(exact);
          const frac = exact - full;

          g.moveTo(cx + pts[0].dx, cy + pts[0].dy);
          for (let i = 1; i <= full && i < pts.length; i++) {
            g.lineTo(cx + pts[i].dx, cy + pts[i].dy);
          }
          if (full < totalSegs && frac > 0.01) {
            const a = pts[full];
            const b = pts[full + 1];
            g.lineTo(cx + lerp(a.dx, b.dx, frac), cy + lerp(a.dy, b.dy, frac));
          }
        };

        const traceCluster = (scaleP) => {
          g.beginPath();
          for (let i = 0; i < c.rays.length; i++) {
            const ray = c.rays[i];
            traceVisible(ray.pts, scaleP);
            if (scaleP > 0.45) {
              const bProg = clamp((scaleP - 0.45) / 0.55, 0, 1);
              for (let j = 0; j < ray.branches.length; j++) {
                traceVisible(ray.branches[j], bProg);
              }
            }
          }
          for (let r = 0; r < c.rings.length; r++) {
            const ring = c.rings[r];
            const threshold = 0.22 + r * 0.18;
            if (scaleP < threshold) continue;
            const pts = ring.pts;
            for (let i = 0; i < pts.length; i++) {
              const a = pts[i];
              const b = pts[(i + 1) % pts.length];
              if (a && b) {
                g.moveTo(cx + a.dx, cy + a.dy);
                g.lineTo(cx + b.dx, cy + b.dy);
              }
            }
          }
        };

        // Pass 1: dark glass fracture shadow
        traceCluster(p);
        g.strokeStyle = `rgba(3, 5, 9, ${(0.88 * crackOpacity).toFixed(3)})`;
        g.lineWidth = 2.6;
        g.stroke();

        // Pass 2: crimson internal refraction glow
        traceCluster(p);
        g.strokeStyle = `rgba(255, 42, 42, ${(0.52 * crackOpacity).toFixed(3)})`;
        g.lineWidth = 1.65;
        g.stroke();

        // Pass 3: razor-sharp quartz-white specular fracture highlight
        traceCluster(p);
        g.strokeStyle = `rgba(240, 248, 255, ${(0.92 * crackOpacity).toFixed(3)})`;
        g.lineWidth = 0.85;
        g.stroke();

        // Shattered impact crater core
        const craterR = 7.5 * p;
        const craterGrad = g.createRadialGradient(cx, cy, 0, cx, cy, craterR * 2.4);
        craterGrad.addColorStop(0, `rgba(255, 255, 255, ${(0.85 * crackOpacity).toFixed(3)})`);
        craterGrad.addColorStop(0.45, `rgba(255, 65, 65, ${(0.45 * crackOpacity).toFixed(3)})`);
        craterGrad.addColorStop(1, 'rgba(255, 30, 30, 0)');
        g.fillStyle = craterGrad;
        g.beginPath();
        g.arc(cx, cy, craterR * 2.4, 0, Math.PI * 2);
        g.fill();
      });

      g.restore();
    }

    /* ======================================================================
       INTERACTION ACTIONS: ACID INJECTION & HIGH-ENERGY LASER EXECUTION TEST
       ====================================================================== */
    function injectHydrochloricAcid() {
      if (phase !== 'idle') return;

      acidBoost = 1.0;
      acidCool = 1.0;
      acidLevel = Math.min(0.92, acidLevel + 0.1);
      currentHclPct = 42.6;
      currentCoreTemp = 34;

      if (ctx.sound) {
        ctx.sound.playClick();
        if (typeof ctx.sound.playAcidHiss === 'function') {
          ctx.sound.playAcidHiss(1.15);
        }
      }

      // Burst rising corrosive bubbles
      for (let i = 0; i < 42 && bubbles.length < 160; i++) {
        bubbles.push({
          x: 0.1 + Math.random() * 0.8,
          y: 0.15 + Math.random() * 0.85,
          r: 1.8 + Math.random() * 4.8,
          vy: 0.14 + Math.random() * 0.2,
          phase: Math.random() * Math.PI * 2,
          amp: 0.008 + Math.random() * 0.015,
          alpha: 0.55 + Math.random() * 0.4
        });
      }

      ctx.updateEnvMetric('hcl', 42.6, 4000);
      ctx.updateEnvMetric('temp', 33.8, 4000);
      ctx.updateEnvMetric('biomass', 8.4, 4000);
      ctx.setSpecialStatus('HCl INJECT // THERMAL DROP', false, 2800);
      pushHumeOffsetIfChanged(-0.24);

      const liters = 280 + Math.floor(Math.random() * 75);
      ctx.pushLog(
        `SYS [VAT-09]: 注入高浓盐酸 (+${liters}L / 38.5% HCl) — 强酸液位补充完成，SCP-682 热源活性短暂压低`,
        'info'
      );
    }

    function startHealingPhase(fromReflect = false) {
      clearAllTimers();
      phase = 'healing';
      healStartTs = performance.now();
      phaseEndTs = healStartTs + HEAL_MS;
      healSweep = 0;
      glitchIntensity = 0;
      shakeMag = 0;
      lastReadoutSyncTs = 0;
      updateHudLabels(healStartTs);

      if (ctx.hostEl) {
        ctx.hostEl.classList.remove('vp682-rampage');
      }
      if (ctx.sound) {
        if (typeof ctx.sound.stopTransientAlarms === 'function') {
          ctx.sound.stopTransientAlarms();
        }
        if (typeof ctx.sound.playAcidHiss === 'function') {
          ctx.sound.playAcidHiss(1.3);
        }
      }

      ctx.setSpecialStatus('SEDATION // SELF-HEALING', false, 2800);
      ctx.pushLog(
        fromReflect
          ? 'SYS [VAT-09]: 激光阵列紧急切断 — 观测窗纳米自愈与过冷强酸压制介入'
          : 'SYS [VAT-09]: 紧急镇静协议已介入 — 过冷强酸压制与防弹观察窗纳米自愈启动',
        'warn'
      );

      scheduleTimeout(() => {
        phase = 'idle';
        const newlyAdapted = !persistedAdaptedLaser;
        persistedAdaptedLaser = true;
        sync682Store();
        updateAdaptBadgeUi();

        cracks.length = 0;
        crackOpacity = 0;
        rampageBlend = 0.14;
        bioScale = 1.06;
        bioHeat = 1.16;
        bioOffsetX = 0;
        bioOffsetY = 0;
        acidLevel = 0.76;
        currentHclPct = 36.8;
        currentCoreTemp = 94;

        if (newlyAdapted) {
          ctx.pushLog(
            'ADAPTATION LOCK [SCP-682]: 永久适应性记忆固化 — 标记 [ADAPTED: PHOTONIC]，背甲表皮已完成光学晶格重排！',
            'crit'
          );
        }

        pushHumeOffsetIfChanged(0);
        ctx.clearSpecialStatus();
        ctx.updateEnvMetric('hcl', 36.8, 0);
        ctx.updateEnvMetric('temp', 44.6, 0);
        ctx.updateEnvMetric('biomass', 19.4, 0);
        ctx.updateEnvMetric('integrity', 86.2, 0);

        setButtonsLocked(false);
        updateClearanceUi();
        lastReadoutSyncTs = 0;
        updateHudLabels(performance.now());
        if (ctx.sound) ctx.sound.playClick();
        ctx.pushLog('SYS [SCP-682]: 紧急镇静完成 — 观测窗自愈完毕，KANT-01 曲线回归常态，控制锁已解除', 'info');
      }, HEAL_MS);
    }

    function startRampagePhase() {
      phase = 'rampage';
      rampageStartTs = performance.now();
      phaseEndTs = rampageStartTs + RAMPAGE_MS;
      shakeMag = 1.35;
      glitchIntensity = 0.9;
      currentHclPct = 25.8;
      lastReadoutSyncTs = 0;
      updateHudLabels(rampageStartTs);

      if (store) {
        store.save({
          scp682: {
            adaptedLaser: true,
            laserTestCount: persistedLaserTestCount
          }
        });
      }

      if (ctx.hostEl) {
        ctx.hostEl.classList.add('vp682-rampage');
      }

      ctx.updateEnvMetric('temp', 86.4, 5200);
      ctx.updateEnvMetric('biomass', 94.2, 5200);
      ctx.updateEnvMetric('integrity', 46.5, 5200);
      ctx.updateEnvMetric('hcl', 25.8, 5200);
      ctx.setSpecialStatus('ADAPTATION // BREACH RISK', true, 4600);

      // Bidirectional BREACH linkage when SCP-682 adaptation rampage erupts
      if (!isBreach && typeof ctx.setBreach === 'function') {
        ctx.setBreach(true);
      }

      // Immediate impact + spiderweb crack #1
      spawnSpiderwebCrack(0.43, 0.46, 1.05);
      if (ctx.sound) {
        if (typeof ctx.sound.playCrackImpact === 'function') ctx.sound.playCrackImpact();
        if (!isBreach && typeof ctx.sound.playAlarmPulse === 'function') ctx.sound.playAlarmPulse(true);
      }
      ctx.pushLog('CRITICAL [SCP-682]: ADAPTATION // 检测到急速表皮晶格重构 — 激光折射率飙升至 96%！', 'crit');

      // Continuous KANT-01 Hume oscillation breaking CRIT red line (2.05 Hm)
      scheduleInterval(() => {
        if (phase !== 'rampage') return;
        const t = (performance.now() - rampageStartTs) / 1000;
        const surgeOffset = 0.62 + Math.random() * 0.44 + Math.sin(t * 20) * 0.2;
        pushHumeOffsetIfChanged(surgeOffset);
        ctx.triggerHumeSpike(0.48 + Math.random() * 0.42, '682 ADAPT // CRIT');
      }, 145);

      // Staggered glass impacts & spiderweb crack propagation
      scheduleTimeout(() => {
        if (phase !== 'rampage') return;
        shakeMag = 1.6;
        glitchIntensity = 1.0;
        spawnSpiderwebCrack(0.64, 0.39, 0.92);
        if (ctx.sound && typeof ctx.sound.playCrackImpact === 'function') ctx.sound.playCrackImpact();
      }, 950);

      scheduleTimeout(() => {
        if (phase !== 'rampage') return;
        shakeMag = 1.7;
        glitchIntensity = 1.0;
        spawnSpiderwebCrack(0.32, 0.58, 0.88);
        if (ctx.sound && typeof ctx.sound.playCrackImpact === 'function') ctx.sound.playCrackImpact();
      }, 2050);

      scheduleTimeout(() => {
        if (phase !== 'rampage') return;
        shakeMag = 1.35;
        glitchIntensity = 0.88;
        if (ctx.sound && typeof ctx.sound.playCrackImpact === 'function') ctx.sound.playCrackImpact();
      }, 3150);

      // Periodic alarm pulses during rampage (suppressed when global breach klaxon is active)
      [1150, 2300, 3350].forEach((delay) => {
        scheduleTimeout(() => {
          if (phase === 'rampage' && !isBreach && ctx.sound && typeof ctx.sound.playAlarmPulse === 'function') {
            ctx.sound.playAlarmPulse(true);
          }
        }, delay);
      });

      // Continuous red adaptation error spam in SYS-LOG
      const errorLogs = [
        [620, 'ERR-682-THERM: 目标热源体积异常暴涨 (+185%) — 进入极端敌意冲撞状态！'],
        [1250, 'ALERT [VAT-09]: 实体重击防弹石英观察窗 — 蜘蛛网状结构裂纹正在蔓延！'],
        [1950, 'CRITICAL [KANT-01]: 局部本体论排斥爆发 — 休谟指数剧烈震荡并飙破 CRIT 红线！'],
        [2650, 'ERR-682-OPTIC: 强电磁反噬干扰 — 监控通道发生 RGB 色差撕裂与信号失真！'],
        [3350, 'FATAL [EXECUTION]: 高能激光处决彻底失败 — 目标已获高能光子抗性！启动紧急镇静！']
      ];
      errorLogs.forEach(([delay, msg]) => {
        scheduleTimeout(() => {
          if (phase === 'rampage') ctx.pushLog(msg, 'crit');
        }, delay);
      });

      // Auto transition after 4 seconds into Emergency Sedation & Self-Healing
      scheduleTimeout(() => {
        if (phase === 'rampage') {
          startHealingPhase();
        }
      }, RAMPAGE_MS);
    }

    function triggerPhotonicReflection() {
      clearAllTimers();
      phase = 'reflect';
      reflectStartTs = performance.now();
      phaseEndTs = reflectStartTs + REFLECT_MS;
      acidCool = 0;
      setButtonsLocked(true);
      laserTargetX = 0.48;
      laserTargetY = 0.50;
      shakeMag = 1.65;
      glitchIntensity = 0.95;
      rampageBlend = 0.85;
      currentCoreTemp = 310;
      lastReadoutSyncTs = 0;
      updateHudLabels(reflectStartTs);

      if (ctx.hostEl) {
        ctx.hostEl.classList.add('vp682-rampage');
      }
      if (reflectFlashEl) {
        reflectFlashEl.classList.remove('is-flashing');
        void reflectFlashEl.offsetWidth;
        reflectFlashEl.classList.add('is-flashing');
        scheduleTimeout(() => {
          if (reflectFlashEl) reflectFlashEl.classList.remove('is-flashing');
        }, 650);
      }

      spawnSpiderwebCrack(0.28, 0.34, 0.96);
      if (ctx.sound) {
        ctx.sound.playClick();
        if (typeof ctx.sound.playLaser === 'function') ctx.sound.playLaser(0.85);
      }

      ctx.updateEnvMetric('integrity', 52.0, 4200);
      ctx.updateEnvMetric('temp', 79.4, 4200);
      ctx.setSpecialStatus('PHOTONIC REFLECT // ABORT', true, 3200);
      pushHumeOffsetIfChanged(0.55);
      ctx.triggerHumeSpike(0.68, 'PHOTONIC REFLECT!');
      ctx.pushLog(
        'CRITICAL [SCP-682]: [ADAPTED: PHOTONIC] 触发 — 背甲瞬间晶体化，形成 99.4% 镜面反射装甲！',
        'crit'
      );

      scheduleTimeout(() => {
        if (phase !== 'reflect') return;
        if (ctx.sound) {
          if (typeof ctx.sound.playCrackImpact === 'function') ctx.sound.playCrackImpact();
          if (!isBreach && typeof ctx.sound.playAlarmPulse === 'function') ctx.sound.playAlarmPulse(true);
        }
      }, 120);

      scheduleTimeout(() => {
        if (phase !== 'reflect') return;
        ctx.pushLog('FATAL [VAT-09]: 高能激光束经背甲全反射弹射至防弹观察窗！激光阵列已紧急熔断！', 'crit');
      }, 240);

      scheduleTimeout(() => {
        if (phase !== 'reflect') return;
        shakeMag = 1.45;
        spawnSpiderwebCrack(0.74, 0.38, 0.88);
        if (ctx.sound && typeof ctx.sound.playCrackImpact === 'function') ctx.sound.playCrackImpact();
      }, 380);

      scheduleTimeout(() => {
        if (phase === 'reflect') {
          startHealingPhase(true);
        }
      }, REFLECT_MS);
    }

    function triggerLaserTest() {
      if (phase !== 'idle') return;
      if (clearance < 3) {
        flashDeniedBtn(laserBtn);
        if (typeof ctx.denyAccess === 'function') {
          ctx.denyAccess(
            3,
            'ACCESS DENIED // 420kW 高能激光处决测试需要 LEVEL 3 安全权限',
            'ACCESS DENIED [SCP-682]: 高能激光测试需要 LVL-3 权限'
          );
        }
        return;
      }
      persistedLaserTestCount += 1;
      sync682Store();
      if (persistedAdaptedLaser) {
        triggerPhotonicReflection();
        return;
      }
      clearAllTimers();

      phase = 'laser';
      phaseEndTs = performance.now() + LASER_MS;
      acidCool = 0;
      setButtonsLocked(true);
      laserTargetX = 0.48;
      laserTargetY = 0.49;
      lastReadoutSyncTs = 0;
      updateHudLabels(performance.now());

      if (ctx.sound) {
        ctx.sound.playClick();
        if (typeof ctx.sound.playLaser === 'function') {
          ctx.sound.playLaser(1.0);
        }
      }

      ctx.updateEnvMetric('temp', 73.5, 1400);
      ctx.updateEnvMetric('biomass', 6.8, 1400);
      ctx.setSpecialStatus('LASER ARRAY // FIRING', true, 1400);
      pushHumeOffsetIfChanged(0.18);
      ctx.triggerHumeSpike(0.38, 'LASER STRIKE // 682');
      ctx.pushLog('EXECUTION TEST [SCP-682]: 420kW 高能激光阵列启动照射 — 目标表层生物质急剧汽化', 'warn');

      scheduleTimeout(() => {
        if (phase === 'laser') {
          startRampagePhase();
        }
      }, LASER_MS);
    }

    /* ======================================================================
       CANVAS 2D THERMAL FIELD, ACID BUBBLES, SONAR, LASER & GLITCH RENDERING
       ====================================================================== */
    function renderThermalField(timeSec) {
      const data = heatImg.data;
      const breath = 1.0 + Math.sin(timeSec * 1.25) * 0.065 + Math.sin(timeSec * 2.5) * 0.022;
      const scaleEff = bioScale * breath;
      const invScale = 1 / Math.max(0.32, scaleEff);

      const flowSpeed = 0.045 + acidBoost * 0.09 + rampageBlend * 0.08;
      const noiseShiftU = timeSec * flowSpeed;
      const noiseShiftV = -timeSec * flowSpeed * 0.68;

      const isLaser = phase === 'laser';
      const laserJitter = isLaser ? 0.65 + 0.55 * Math.sin(timeSec * 72) * Math.cos(timeSec * 47) : 1.0;

      // Precompute lobe transforms once per frame
      const lobes = new Array(BIO_LOBES.length);
      for (let k = 0; k < BIO_LOBES.length; k++) {
        const L = BIO_LOBES[k];
        const waveY = Math.sin(timeSec * (1.05 + rampageBlend * 2.4) - L.wavePhase) * L.waveAmp;
        const cx = 0.5 + bioOffsetX + L.bx * scaleEff;
        const cy = 0.5 + bioOffsetY + (L.by + waveY) * scaleEff;
        const rot = L.rot + Math.sin(timeSec * 0.7 + L.wavePhase) * 0.06;
        lobes[k] = {
          cx,
          cy,
          cos: Math.cos(rot),
          sin: Math.sin(rot),
          invRxSq: (invScale * invScale) / (L.rx * L.rx),
          invRySq: (invScale * invScale) / (L.ry * L.ry),
          w: L.weight
        };
      }

      let idx = 0;
      for (let py = 0; py < HEAT_H; py++) {
        const ny = py / HEAT_H;
        const dyEdge = (ny - 0.5) * 2;
        for (let px = 0; px < HEAT_W; px++) {
          const nx = px / HEAT_W;
          const dxEdge = (nx - 0.5) * 2;

          // Multi-octave convective acid fluid distortion
          const n1 = sampleNoise(nx * 1.35 + noiseShiftU, ny * 1.15 + noiseShiftV);
          const n2 = sampleNoise(nx * 3.1 - noiseShiftU * 1.4, ny * 2.8 + noiseShiftV * 0.9);
          const n3 = sampleNoise(nx * 6.5 + timeSec * 0.14, ny * 6.0 - timeSec * 0.11);
          const turb = n1 * 0.56 + n2 * 0.3 + n3 * 0.14;

          // Cold deep-blue acid vat base temperature
          const vatFalloff = Math.max(0, 1 - (dxEdge * dxEdge * 0.45 + dyEdge * dyEdge * 0.52));
          let heat = 0.09 + turb * 0.15 + vatFalloff * 0.06 - acidCool * 0.065;

          // Domain-warped sample coords kept crisp so skeletal ribs & vertebrae stay legible
          const wx = nx + (n1 - 0.5) * (0.018 + rampageBlend * 0.020) + (n2 - 0.5) * 0.010;
          const wy = ny + (n2 - 0.5) * (0.016 + rampageBlend * 0.020) + (n3 - 0.5) * 0.008;

          let bioSum = 0;
          let bioPeak = 0;
          for (let k = 0; k < lobes.length; k++) {
            const lb = lobes[k];
            const ddx = wx - lb.cx;
            const ddy = (wy - lb.cy) * 0.56; // aspect compensation (~16:9)
            // Fast bounding skip
            if (ddx * ddx + ddy * ddy > 0.14) continue;
            const rx = ddx * lb.cos + ddy * lb.sin;
            const ry = -ddx * lb.sin + ddy * lb.cos;
            const q = rx * rx * lb.invRxSq + ry * ry * lb.invRySq;
            if (q < 3.6) {
              const contrib = lb.w * Math.exp(-q);
              bioSum += contrib;
              if (contrib > bioPeak) bioPeak = contrib;
            }
          }

          if (bioSum > 0.005) {
            const organicMod = 0.84 + turb * 0.28;
            const bioField = (bioPeak * 0.68 + Math.tanh(bioSum * 0.58) * 0.32) * organicMod * bioHeat * laserJitter;
            heat += bioField * 0.62;
          }

          // Laser thermal strike bloom at impact target
          if (isLaser) {
            const ldx = nx - laserTargetX;
            const ldy = (ny - laserTargetY) * 0.56;
            const lDistSq = ldx * ldx + ldy * ldy;
            if (lDistSq < 0.045) {
              heat += Math.exp(-lDistSq * 110) * 0.62;
            }
          }

          // Micro-bolometer sensor grain
          heat += (n3 - 0.5) * 0.042;
          const lutIdx = clamp(Math.round(heat * 255), 0, 255) * 3;

          if (rampageBlend <= 0.01) {
            data[idx] = NORMAL_LUT[lutIdx];
            data[idx + 1] = NORMAL_LUT[lutIdx + 1];
            data[idx + 2] = NORMAL_LUT[lutIdx + 2];
          } else if (rampageBlend >= 0.99) {
            data[idx] = RAMPAGE_LUT[lutIdx];
            data[idx + 1] = RAMPAGE_LUT[lutIdx + 1];
            data[idx + 2] = RAMPAGE_LUT[lutIdx + 2];
          } else {
            data[idx] = lerp(NORMAL_LUT[lutIdx], RAMPAGE_LUT[lutIdx], rampageBlend);
            data[idx + 1] = lerp(NORMAL_LUT[lutIdx + 1], RAMPAGE_LUT[lutIdx + 1], rampageBlend);
            data[idx + 2] = lerp(NORMAL_LUT[lutIdx + 2], RAMPAGE_LUT[lutIdx + 2], rampageBlend);
          }
          data[idx + 3] = 255;
          idx += 4;
        }
      }

      heatCtx.putImageData(heatImg, 0, 0);
    }

    function drawAcidLiquidAndBubbles(dt, timeSec, viewH) {
      // Deep cold blue-indigo acid tint + meniscus surface shimmer near top of vat
      const surfaceY = viewH * (1 - acidLevel * 0.78);
      const vatGrad = g.createLinearGradient(0, 0, 0, viewH);
      if (rampageBlend > 0.25) {
        vatGrad.addColorStop(0, `rgba(28, 6, 12, ${(0.36 * rampageBlend).toFixed(2)})`);
        vatGrad.addColorStop(0.5, 'rgba(6, 20, 48, 0.14)');
        vatGrad.addColorStop(1, 'rgba(4, 10, 28, 0.34)');
      } else {
        vatGrad.addColorStop(0, 'rgba(3, 12, 34, 0.44)');
        vatGrad.addColorStop(0.3, 'rgba(6, 30, 68, 0.16)');
        vatGrad.addColorStop(1, 'rgba(2, 8, 24, 0.32)');
      }
      g.fillStyle = vatGrad;
      g.fillRect(0, 0, width, viewH);

      // Subtle undulating acid surface line
      g.save();
      g.beginPath();
      for (let x = 0; x <= width; x += 18) {
        const wy =
          surfaceY +
          Math.sin(x * 0.025 + timeSec * 1.9) * (2.2 + acidBoost * 4.5 + rampageBlend * 4.2) +
          Math.cos(x * 0.06 - timeSec * 2.7) * 1.1;
        if (x === 0) g.moveTo(x, wy);
        else g.lineTo(x, wy);
      }
      g.strokeStyle =
        rampageBlend > 0.5
          ? 'rgba(255, 95, 95, 0.35)'
          : `rgba(72, 198, 224, ${(0.28 + acidBoost * 0.3).toFixed(2)})`;
      g.lineWidth = 1.25;
      g.stroke();

      // Pressurized HCl injection jets from top manifolds
      if (acidBoost > 0.06) {
        const streamAlpha = Math.min(0.65, acidBoost * 0.7);
        [0.16, 0.84].forEach((nx, sideIdx) => {
          const sx = width * nx;
          const endX = width * (nx + (sideIdx === 0 ? 0.09 : -0.09));
          const grad = g.createLinearGradient(sx, 0, endX, surfaceY + 75);
          grad.addColorStop(0, `rgba(182, 255, 78, ${streamAlpha.toFixed(2)})`);
          grad.addColorStop(0.6, `rgba(74, 232, 150, ${(streamAlpha * 0.65).toFixed(2)})`);
          grad.addColorStop(1, 'rgba(42, 190, 210, 0)');
          g.strokeStyle = grad;
          g.lineWidth = 4 + acidBoost * 6;
          g.beginPath();
          g.moveTo(sx, 0);
          g.quadraticCurveTo(sx + (sideIdx === 0 ? 12 : -12), surfaceY * 0.6, endX, surfaceY + 75);
          g.stroke();
        });
      }

      // Target bubble population (36 idle -> ~140 on HCl injection -> ~80 boiling in rampage)
      const desiredCount = Math.round(36 + acidBoost * 106 + rampageBlend * 44);
      while (bubbles.length < desiredCount) {
        bubbles.push({
          x: 0.08 + Math.random() * 0.84,
          y: 0.88 + Math.random() * 0.14,
          r: 1.4 + Math.random() * 4.0,
          vy: 0.08 + Math.random() * 0.15,
          phase: Math.random() * Math.PI * 2,
          amp: 0.004 + Math.random() * 0.012,
          alpha: 0.38 + Math.random() * 0.45
        });
      }
      if (bubbles.length > desiredCount + 8 && Math.random() < 0.25) {
        bubbles.pop();
      }

      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        const speedMult = 1 + acidBoost * 1.4 + rampageBlend * 1.25;
        b.y -= b.vy * speedMult * dt;
        const wobbleX = Math.sin(timeSec * 3.1 + b.phase) * b.amp;
        const px = (b.x + wobbleX) * width;
        const py = b.y * viewH;

        if (py < surfaceY - 4) {
          if (ripples.length < 28 && Math.random() < 0.45) {
            ripples.push({ x: px, y: surfaceY, r: b.r, maxR: b.r * 4.2, life: 0, maxLife: 0.55 });
          }
          if (bubbles.length > desiredCount) {
            bubbles.splice(i, 1);
            continue;
          }
          b.y = 0.94 + Math.random() * 0.08;
          b.x = 0.08 + Math.random() * 0.84;
          continue;
        }

        const fillA = b.alpha * (0.12 + acidBoost * 0.14);
        const strokeA = Math.min(0.42, b.alpha * (0.34 + acidBoost * 0.18));
        g.fillStyle = `rgba(112, 176, 68, ${fillA.toFixed(2)})`;
        g.strokeStyle = `rgba(156, 210, 96, ${strokeA.toFixed(2)})`;
        g.lineWidth = 0.75;
        g.beginPath();
        g.arc(px, py, b.r, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }

      // Surface pop rings
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.life += dt;
        if (rp.life >= rp.maxLife) {
          ripples.splice(i, 1);
          continue;
        }
        const t = rp.life / rp.maxLife;
        const rr = lerp(rp.r, rp.maxR, t);
        g.strokeStyle = `rgba(188, 252, 92, ${((1 - t) * 0.42).toFixed(2)})`;
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(rp.x, rp.y, rr, rr * 0.35, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }

    function drawStrokedText(text, x, y, fillStyle) {
      g.save();
      g.lineWidth = 2;
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(3, 6, 12, 0.94)';
      g.strokeText(text, x, y);
      g.fillStyle = fillStyle;
      g.fillText(text, x, y);
      g.restore();
    }

    function drawCrystallineCarapace(timeSec, viewH) {
      if (!persistedAdaptedLaser) return;
      const isReflect = phase === 'reflect';
      const spinePoints = [
        [-0.10, -0.02],
        [-0.04, 0.00],
        [0.02, 0.015],
        [0.08, 0.03]
      ];
      g.save();
      for (let i = 0; i < spinePoints.length; i++) {
        const [bx, by] = spinePoints[i];
        const px = (0.5 + bioOffsetX + bx * bioScale) * width;
        const py = (0.5 + bioOffsetY + by * bioScale) * viewH;
        const r = (isReflect ? 16 : 9.5) * bioScale;
        const shimmer = 0.28 + 0.16 * Math.sin(timeSec * (isReflect ? 26 : 3.8) + i * 1.4);
        const alpha = isReflect ? Math.min(0.9, shimmer * 2.1) : shimmer;

        g.strokeStyle = isReflect
          ? `rgba(210, 252, 255, ${alpha.toFixed(2)})`
          : `rgba(255, 110, 96, ${Math.min(0.75, alpha * 1.35).toFixed(2)})`;
        g.fillStyle = isReflect
          ? `rgba(180, 244, 255, ${(alpha * 0.34).toFixed(2)})`
          : `rgba(255, 68, 68, ${(alpha * 0.24).toFixed(2)})`;
        g.lineWidth = isReflect ? 1.4 : 1.0;
        g.beginPath();
        g.moveTo(px - r * 0.9, py);
        g.lineTo(px, py - r * 0.55);
        g.lineTo(px + r * 0.9, py);
        g.lineTo(px, py + r * 0.55);
        g.closePath();
        g.fill();
        g.stroke();
      }
      g.restore();
    }

    function drawSonarAndScales(dt, timeSec, viewH) {
      const cx = width * 0.5;
      const cy = viewH * 0.5;
      const meterPx = Math.max(24, viewH * 0.145);
      const isCrit = phase === 'rampage' || phase === 'reflect' || isBreach;
      const sonarRgb = isCrit ? '255, 62, 62' : '56, 224, 208';
      const gridRgb = isCrit ? '255, 72, 72' : '112, 188, 214';

      g.save();

      // 1. Concentric range circles (1.0m, 2.0m, 3.0m, 4.0m) + axes ticks
      g.strokeStyle = `rgba(${gridRgb}, 0.22)`;
      g.lineWidth = 1;
      g.setLineDash([3, 5]);
      for (let m = 1; m <= 4; m++) {
        const r = m * meterPx;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.stroke();
      }
      g.setLineDash([]);

      // Distance cross-axis ticks
      g.strokeStyle = `rgba(${gridRgb}, 0.26)`;
      g.beginPath();
      for (let d = -4; d <= 4; d += 0.5) {
        if (d === 0) continue;
        const tx = cx + d * meterPx;
        const ty = cy + d * meterPx;
        const tickLen = Number.isInteger(d) ? 5 : 2.5;
        if (tx > 55 && tx < width - 58) {
          g.moveTo(tx, cy - tickLen);
          g.lineTo(tx, cy + tickLen);
        }
        if (ty > 42 && ty < viewH - 28) {
          g.moveTo(cx - tickLen, ty);
          g.lineTo(cx + tickLen, ty);
        }
      }
      g.stroke();

      g.font = '9px "JetBrains Mono", monospace';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      for (let m = 1; m <= 3; m++) {
        const labelX = cx + m * meterPx + 4;
        if (labelX < width - 78) {
          drawStrokedText(`${m}.0m`, labelX, cy - 8, `rgba(${gridRgb}, 0.88)`);
        }
      }

      // 2. Periodic expanding circular sonar echo pings
      sonarTimer -= dt;
      if (sonarTimer <= 0) {
        sonarTimer = phase === 'rampage' ? 1.05 : 2.55;
        sonarRings.push({
          r: 10,
          maxR: Math.max(width, viewH) * 0.62,
          speed: phase === 'rampage' ? 240 : 145
        });
      }

      const bioCx = (0.5 + bioOffsetX) * width;
      const bioCy = (0.5 + bioOffsetY) * viewH;
      const bioEchoR = 54 * bioScale;

      for (let i = sonarRings.length - 1; i >= 0; i--) {
        const sr = sonarRings[i];
        sr.r += sr.speed * dt;
        if (sr.r >= sr.maxR) {
          sonarRings.splice(i, 1);
          continue;
        }
        const progress = sr.r / sr.maxR;
        const alpha = (1 - progress) * 0.55;

        g.strokeStyle = `rgba(${sonarRgb}, ${alpha.toFixed(3)})`;
        g.lineWidth = 1.4;
        g.beginPath();
        g.arc(cx, cy, sr.r, 0, Math.PI * 2);
        g.stroke();

        // Acoustic target backscatter arcs when ring intersects submerged SCP-682 mass
        const targetDist = Math.hypot(bioCx - cx, bioCy - cy);
        if (Math.abs(sr.r - (targetDist + bioEchoR)) < 28 || sr.r < bioEchoR * 1.35) {
          const baseAng = Math.atan2(bioCy - cy, bioCx - cx);
          const echoAlpha = Math.min(0.85, alpha * 1.45);
          g.strokeStyle = isCrit
            ? `rgba(255, 118, 92, ${echoAlpha.toFixed(3)})`
            : `rgba(170, 255, 224, ${echoAlpha.toFixed(3)})`;
          g.lineWidth = 2.1;
          g.beginPath();
          g.arc(bioCx, bioCy, Math.min(sr.r, bioEchoR * 1.15), baseAng - 0.85, baseAng + 0.85);
          g.stroke();
        }
      }

      // 3. Target thermal centroid lock bracket
      const boxW = Math.min(width * 0.36, 98 * bioScale);
      const boxH = Math.min(viewH * 0.36, 56 * bioScale);
      const bl = 10;
      g.strokeStyle = isCrit
        ? 'rgba(255, 58, 58, 0.82)'
        : persistedAdaptedLaser
        ? `rgba(255, 76, 66, ${(0.62 + 0.18 * Math.sin(timeSec * 4)).toFixed(2)})`
        : 'rgba(255, 186, 48, 0.52)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(bioCx - boxW, bioCy - boxH + bl);
      g.lineTo(bioCx - boxW, bioCy - boxH);
      g.lineTo(bioCx - boxW + bl, bioCy - boxH);
      g.moveTo(bioCx + boxW - bl, bioCy - boxH);
      g.lineTo(bioCx + boxW, bioCy - boxH);
      g.lineTo(bioCx + boxW, bioCy - boxH + bl);
      g.moveTo(bioCx - boxW, bioCy + boxH - bl);
      g.lineTo(bioCx - boxW, bioCy + boxH);
      g.lineTo(bioCx - boxW + bl, bioCy + boxH);
      g.moveTo(bioCx + boxW - bl, bioCy + boxH);
      g.lineTo(bioCx + boxW, bioCy + boxH);
      g.lineTo(bioCx + boxW, bioCy + boxH - bl);
      g.stroke();

      // 4. Left Vat Acid Depth / Level Ruler (y = 66 .. viewH - 42, avoids HUD tags)
      const scaleTop = 66;
      const scaleBot = Math.max(scaleTop + 80, viewH - 42);
      const scaleH = scaleBot - scaleTop;
      const lx = 16;

      g.strokeStyle = `rgba(${gridRgb}, 0.45)`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(lx, scaleTop);
      g.lineTo(lx, scaleBot);
      for (let t = 0; t <= 5; t++) {
        const ty = scaleTop + (scaleH / 5) * t;
        g.moveTo(lx, ty);
        g.lineTo(lx + (t % 2 === 0 ? 7 : 4), ty);
      }
      g.stroke();

      const fillY = scaleBot - scaleH * clamp(acidLevel, 0.15, 0.98);
      g.fillStyle = acidBoost > 0.1 ? 'rgba(178, 255, 86, 0.85)' : 'rgba(56, 224, 208, 0.8)';
      g.fillRect(lx - 2, fillY - 1.5, 11, 3);
      g.font = '8.5px "JetBrains Mono", monospace';
      drawStrokedText(`HCl ${(acidLevel * 5).toFixed(1)}m`, lx + 11, fillY, 'rgba(176, 236, 248, 0.92)');

      // 5. Right FLIR Thermal Color Scale Bar (x = width - 36, y = 54 .. viewH - 42)
      const barTop = 54;
      const barBot = Math.max(barTop + 80, viewH - 42);
      const barH = barBot - barTop;
      const barX = width - 34;
      const barW = 10;

      for (let py = 0; py < barH; py += 2) {
        const frac = 1 - py / barH; // top = hottest
        const lutIdx = clamp(Math.round(frac * 255), 0, 255) * 3;
        const r = Math.round(lerp(NORMAL_LUT[lutIdx], RAMPAGE_LUT[lutIdx], rampageBlend));
        const gr = Math.round(lerp(NORMAL_LUT[lutIdx + 1], RAMPAGE_LUT[lutIdx + 1], rampageBlend));
        const b = Math.round(lerp(NORMAL_LUT[lutIdx + 2], RAMPAGE_LUT[lutIdx + 2], rampageBlend));
        g.fillStyle = `rgb(${r},${gr},${b})`;
        g.fillRect(barX, barTop + py, barW, 2.5);
      }

      g.strokeStyle = 'rgba(226, 232, 240, 0.45)';
      g.lineWidth = 1;
      g.strokeRect(barX - 0.5, barTop - 0.5, barW + 1, barH + 1);

      const maxTempScale = phase === 'laser' ? 920 : phase === 'rampage' || phase === 'reflect' ? 460 : 120;
      const minTempScale = 15;
      g.textAlign = 'right';
      [0, 0.5, 1].forEach((f) => {
        const ty = barBot - barH * f;
        const tempVal = Math.round(lerp(minTempScale, maxTempScale, f));
        g.beginPath();
        g.moveTo(barX - 4, ty);
        g.lineTo(barX, ty);
        g.stroke();
        drawStrokedText(`${tempVal}°`, barX - 6, ty, 'rgba(226, 232, 240, 0.92)');
      });

      // Dynamic peak temperature marker
      const peakRatio = clamp((currentCoreTemp - minTempScale) / (maxTempScale - minTempScale), 0.04, 0.98);
      const ptrY = barBot - barH * peakRatio;
      g.fillStyle = isCrit ? '#FF3B3B' : '#FFB000';
      g.beginPath();
      g.moveTo(barX + barW + 2, ptrY);
      g.lineTo(barX + barW + 8, ptrY - 3.5);
      g.lineTo(barX + barW + 8, ptrY + 3.5);
      g.closePath();
      g.fill();

      // Subtle rampage / reflection warning strip inside canvas
      if ((phase === 'rampage' || phase === 'reflect') && Math.sin(timeSec * 18) > -0.2) {
        const stripW = phase === 'reflect' ? 378 : 330;
        g.fillStyle = 'rgba(120, 8, 14, 0.78)';
        g.fillRect(width * 0.5 - stripW * 0.5, 38, stripW, 20);
        g.strokeStyle = '#FF3B3B';
        g.strokeRect(width * 0.5 - stripW * 0.5, 38, stripW, 20);
        g.fillStyle = '#FFE4E4';
        g.font = 'bold 10px "JetBrains Mono", monospace';
        g.textAlign = 'center';
        g.fillText(
          phase === 'reflect'
            ? '⚠ PHOTONIC REFLECTION // 背甲晶体化镜面折射 — 激光反噬观测窗'
            : '⚠ ADAPTATION // 异常适应暴走 — CONTAINMENT GLASS CRITICAL',
          width * 0.5,
          48
        );
      }

      g.restore();
    }

    function renderLaserBeam(dt, timeSec, viewH) {
      const tx = laserTargetX * width;
      const ty = laserTargetY * viewH;

      // Spawn intense white-hot ablation sparks at laser strike site
      if (phase === 'laser' || phase === 'reflect') {
        const count = phase === 'reflect' ? 6 : 4;
        for (let i = 0; i < count && sparks.length < 72; i++) {
          const ang = -Math.PI * 0.1 - Math.random() * Math.PI * 0.8;
          const spd = 90 + Math.random() * 260;
          sparks.push({
            x: tx + (Math.random() - 0.5) * 16,
            y: ty + (Math.random() - 0.5) * 12,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 35,
            life: 0,
            maxLife: 0.18 + Math.random() * 0.25
          });
        }
      }

      if (phase === 'laser' || phase === 'reflect') {
        g.save();
        g.globalCompositeOperation = 'screen';
        const isReflect = phase === 'reflect';
        const pulse = 0.86 + 0.14 * Math.sin(timeSec * 85);

        // Outer crimson/cyan plasma sheath
        const outerW = (isReflect ? 18 : 24 + Math.sin(timeSec * 60) * 5) * pulse;
        const beamGrad = g.createLinearGradient(tx - outerW, 0, tx + outerW, 0);
        beamGrad.addColorStop(0, 'rgba(255, 20, 20, 0)');
        beamGrad.addColorStop(0.5, isReflect ? 'rgba(130, 235, 255, 0.72)' : 'rgba(255, 45, 25, 0.65)');
        beamGrad.addColorStop(1, 'rgba(255, 20, 20, 0)');
        g.fillStyle = beamGrad;
        g.fillRect(tx - outerW, 0, outerW * 2, ty + 14);

        // Mid intense red-orange / cyan column
        g.fillStyle = isReflect ? 'rgba(180, 248, 255, 0.92)' : 'rgba(255, 110, 48, 0.92)';
        g.fillRect(tx - 4.5, 0, 9, ty + 6);

        // Blinding pure white core
        g.fillStyle = 'rgba(255, 255, 255, 0.98)';
        g.fillRect(tx - 1.8, 0, 3.6, ty + 2);

        // Impact flash & crystalline specular bounce beams in reflect mode
        const flashR = (isReflect ? 44 : 34) + Math.sin(timeSec * 70) * 12;
        const flash = g.createRadialGradient(tx, ty, 2, tx, ty, flashR);
        flash.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
        flash.addColorStop(0.32, isReflect ? 'rgba(120, 245, 255, 0.88)' : 'rgba(255, 140, 60, 0.85)');
        flash.addColorStop(0.7, isReflect ? 'rgba(255, 45, 75, 0.45)' : 'rgba(255, 25, 25, 0.42)');
        flash.addColorStop(1, 'rgba(255, 0, 0, 0)');
        g.fillStyle = flash;
        g.beginPath();
        g.arc(tx, ty, flashR, 0, Math.PI * 2);
        g.fill();

        if (isReflect) {
          const bounceTargets = [
            { x: width * 0.28, y: viewH * 0.34 },
            { x: width * 0.74, y: viewH * 0.38 }
          ];
          bounceTargets.forEach((bt, bIdx) => {
            const flicker = 0.78 + 0.22 * Math.sin(timeSec * 92 + bIdx * 1.9);
            g.strokeStyle = `rgba(255, 48, 68, ${(0.55 * flicker).toFixed(2)})`;
            g.lineWidth = 10;
            g.beginPath();
            g.moveTo(tx, ty);
            g.lineTo(bt.x, bt.y);
            g.stroke();

            g.strokeStyle = `rgba(170, 248, 255, ${(0.88 * flicker).toFixed(2)})`;
            g.lineWidth = 4.2;
            g.beginPath();
            g.moveTo(tx, ty);
            g.lineTo(bt.x, bt.y);
            g.stroke();

            g.strokeStyle = 'rgba(255, 255, 255, 0.96)';
            g.lineWidth = 1.6;
            g.beginPath();
            g.moveTo(tx, ty);
            g.lineTo(bt.x, bt.y);
            g.stroke();

            const hitGrad = g.createRadialGradient(bt.x, bt.y, 1, bt.x, bt.y, 26);
            hitGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            hitGrad.addColorStop(0.4, 'rgba(255, 70, 70, 0.7)');
            hitGrad.addColorStop(1, 'rgba(255, 20, 20, 0)');
            g.fillStyle = hitGrad;
            g.beginPath();
            g.arc(bt.x, bt.y, 26, 0, Math.PI * 2);
            g.fill();
          });
        }
        g.restore();
      }

      // Render flying laser sparks (also finishes trailing out into start of rampage)
      if (sparks.length > 0) {
        g.save();
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];
          s.life += dt;
          if (s.life >= s.maxLife) {
            sparks.splice(i, 1);
            continue;
          }
          const px = s.x;
          const py = s.y;
          s.vy += 320 * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          const a = 1 - s.life / s.maxLife;
          g.strokeStyle = `rgba(255, 224, 165, ${a.toFixed(2)})`;
          g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(s.x, s.y);
          g.stroke();
        }
        g.restore();
      }
    }

    function drawHealingSweep(viewH) {
      if (phase !== 'healing') return;
      const sweepY = healSweep * viewH;
      g.save();
      const grad = g.createLinearGradient(0, sweepY - 22, 0, sweepY + 22);
      grad.addColorStop(0, 'rgba(46, 232, 186, 0)');
      grad.addColorStop(0.5, 'rgba(92, 255, 212, 0.24)');
      grad.addColorStop(1, 'rgba(46, 232, 186, 0)');
      g.fillStyle = grad;
      g.fillRect(0, sweepY - 22, width, 44);
      g.strokeStyle = 'rgba(130, 255, 222, 0.55)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, sweepY);
      g.lineTo(width, sweepY);
      g.stroke();
      g.restore();
    }

    function applyRgbGlitch(viewH) {
      if (glitchIntensity <= 0.04) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const srcH = Math.max(1, Math.round(viewH * dpr));

      // Capture current rendered viewport frame into dedicated offscreen buffer
      glitchCtx.clearRect(0, 0, GLITCH_W, GLITCH_H);
      glitchCtx.drawImage(canvas, 0, 0, canvas.width, srcH, 0, 0, GLITCH_W, GLITCH_H);

      // Tint red & cyan channels cleanly via multiply
      redChCtx.globalCompositeOperation = 'source-over';
      redChCtx.drawImage(glitchCanvas, 0, 0);
      redChCtx.globalCompositeOperation = 'multiply';
      redChCtx.fillStyle = '#FF2020';
      redChCtx.fillRect(0, 0, GLITCH_W, GLITCH_H);

      cyanChCtx.globalCompositeOperation = 'source-over';
      cyanChCtx.drawImage(glitchCanvas, 0, 0);
      cyanChCtx.globalCompositeOperation = 'multiply';
      cyanChCtx.fillStyle = '#18F0FF';
      cyanChCtx.fillRect(0, 0, GLITCH_W, GLITCH_H);

      const shiftX = (5 + Math.random() * 14) * glitchIntensity;
      g.save();
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = Math.min(0.68, 0.45 * glitchIntensity);
      g.drawImage(redChCanvas, 0, 0, GLITCH_W, GLITCH_H, -shiftX, 0, width, viewH);
      g.drawImage(cyanChCanvas, 0, 0, GLITCH_W, GLITCH_H, shiftX, 0, width, viewH);

      // Horizontal RGB scan-tear slices
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 0.82;
      const sliceCount = 4 + Math.floor(Math.random() * 5);
      for (let i = 0; i < sliceCount; i++) {
        const syNorm = Math.random() * 0.9;
        const shNorm = 0.02 + Math.random() * 0.055;
        const dx = (Math.random() - 0.5) * 32 * glitchIntensity;
        g.drawImage(
          glitchCanvas,
          0,
          syNorm * GLITCH_H,
          GLITCH_W,
          shNorm * GLITCH_H,
          dx,
          syNorm * viewH,
          width,
          shNorm * viewH
        );
      }
      g.restore();
    }

    function updateSimulation(dt, nowMs) {
      const timeSec = nowMs * 0.001;

      if (acidBoost > 0.005) acidBoost *= Math.pow(0.32, dt);
      else acidBoost = 0;

      if (acidCool > 0.005) {
        acidCool *= Math.pow(0.42, dt);
        if (phase === 'idle') {
          pushHumeOffsetIfChanged(-0.24 * acidCool);
        }
      } else {
        acidCool = 0;
        if (phase === 'idle') pushHumeOffsetIfChanged(0);
      }

      if (phase === 'idle') {
        acidLevel = lerp(acidLevel, 0.76, Math.min(1, dt * 0.25));
        currentHclPct = lerp(currentHclPct, 36.8, Math.min(1, dt * 0.35));
        const alertActive = persistedAdaptedLaser;
        const targetScale = (alertActive ? 1.06 + Math.sin(timeSec * 2.6) * 0.025 : 1.0) - acidCool * 0.24;
        const targetHeat = (alertActive ? 1.16 + Math.sin(timeSec * 3.4) * 0.055 : 1.0) - acidCool * 0.42;
        bioScale = lerp(bioScale, targetScale, Math.min(1, dt * 3.5));
        bioHeat = lerp(bioHeat, targetHeat, Math.min(1, dt * 3.5));
        bioOffsetX = Math.sin(timeSec * (alertActive ? 0.72 : 0.42)) * (alertActive ? 0.02 : 0.015);
        bioOffsetY = Math.cos(timeSec * (alertActive ? 0.88 : 0.58)) * (alertActive ? 0.016 : 0.012);
        const idleRampageTarget = isBreach
          ? alertActive
            ? 0.36
            : 0.28
          : alertActive
          ? 0.14 + Math.sin(timeSec * 2.5) * 0.04
          : 0;
        rampageBlend = lerp(rampageBlend, idleRampageTarget, Math.min(1, dt * 4));
        shakeMag = 0;
        glitchIntensity = 0;
        const baseIdleTemp = alertActive ? 94 + Math.sin(timeSec * 2.8) * 3 : 76;
        currentCoreTemp = lerp(currentCoreTemp, baseIdleTemp - acidCool * 42, Math.min(1, dt * 3.5));
      } else if (phase === 'laser') {
        bioScale = lerp(bioScale, 0.54, Math.min(1, dt * 7.5));
        bioHeat = lerp(bioHeat, 1.18, Math.min(1, dt * 6.0));
        bioOffsetX = (Math.random() - 0.5) * 0.018;
        bioOffsetY = (Math.random() - 0.5) * 0.014;
        rampageBlend = lerp(rampageBlend, 0.22, Math.min(1, dt * 5));
        shakeMag = 0.32;
        glitchIntensity = 0.14;
        currentCoreTemp = lerp(currentCoreTemp, 860, Math.min(1, dt * 8));
      } else if (phase === 'rampage') {
        const rampT = (nowMs - rampageStartTs) * 0.001;
        bioScale = lerp(bioScale, 1.68 + Math.sin(rampT * 14) * 0.15, Math.min(1, dt * 8.5));
        bioHeat = lerp(bioHeat, 1.56, Math.min(1, dt * 8));
        bioOffsetX = Math.sin(rampT * 11.5) * 0.095 + (Math.random() - 0.5) * 0.04;
        bioOffsetY = Math.cos(rampT * 14.2) * 0.07 + (Math.random() - 0.5) * 0.035;
        rampageBlend = lerp(rampageBlend, 1.0, Math.min(1, dt * 7.5));
        acidLevel = lerp(acidLevel, 0.62, Math.min(1, dt * 0.8));
        currentCoreTemp = lerp(currentCoreTemp, 420 + Math.sin(rampT * 18) * 35, Math.min(1, dt * 6));

        shakeMag = Math.max(0.45, shakeMag * Math.pow(0.18, dt));
        glitchIntensity = Math.max(0.28, glitchIntensity * Math.pow(0.24, dt));
        if (Math.random() < 0.18) glitchIntensity = 0.85;
      } else if (phase === 'reflect') {
        const refT = (nowMs - reflectStartTs) * 0.001;
        bioScale = lerp(bioScale, 1.18, Math.min(1, dt * 6));
        bioHeat = lerp(bioHeat, 1.24, Math.min(1, dt * 6));
        bioOffsetX = Math.sin(refT * 16) * 0.028;
        bioOffsetY = Math.cos(refT * 19) * 0.022;
        rampageBlend = lerp(rampageBlend, 0.88, Math.min(1, dt * 8));
        currentCoreTemp = lerp(currentCoreTemp, 340 + Math.sin(refT * 24) * 24, Math.min(1, dt * 7));
        shakeMag = Math.max(0.45, shakeMag * Math.pow(0.24, dt));
        glitchIntensity = Math.max(0.32, glitchIntensity * Math.pow(0.28, dt));
        if (Math.random() < 0.22) glitchIntensity = 0.92;
      } else if (phase === 'healing') {
        const hProg = clamp((nowMs - healStartTs) / HEAL_MS, 0, 1);
        healSweep = hProg;
        crackOpacity = Math.max(0, 1 - hProg * 1.08);
        rampageBlend = lerp(rampageBlend, 0, Math.min(1, dt * 3.5));
        bioScale = lerp(bioScale, 1.0, Math.min(1, dt * 3.5));
        bioHeat = lerp(bioHeat, 1.0, Math.min(1, dt * 3.5));
        bioOffsetX = lerp(bioOffsetX, 0, Math.min(1, dt * 4));
        bioOffsetY = lerp(bioOffsetY, 0, Math.min(1, dt * 4));
        acidLevel = lerp(acidLevel, 0.76, Math.min(1, dt * 1.4));
        currentHclPct = lerp(currentHclPct, 36.8, Math.min(1, dt * 1.6));
        currentCoreTemp = lerp(currentCoreTemp, 76, Math.min(1, dt * 2.5));
        pushHumeOffsetIfChanged(0.68 * (1 - hProg));
      }

      // Animate spiderweb cracks growing outward over ~0.24s
      for (let i = 0; i < cracks.length; i++) {
        if (cracks[i].progress < 1) {
          cracks[i].progress = Math.min(1, cracks[i].progress + dt * 4.2);
        }
      }
    }

    function tick(nowMs) {
      const dt = Math.min(0.1, Math.max(0.001, (nowMs - lastFrameTs) / 1000));
      lastFrameTs = nowMs;
      const timeSec = nowMs * 0.001;

      updateSimulation(dt, nowMs);
      updateHudLabels(nowMs);

      const viewH = Math.max(120, height - 46);
      const sx = shakeMag > 0.01 ? (Math.random() - 0.5) * 18 * shakeMag : 0;
      const sy = shakeMag > 0.01 ? (Math.random() - 0.5) * 13 * shakeMag : 0;

      g.clearRect(0, 0, width, height);
      g.fillStyle = '#030816';
      g.fillRect(0, 0, width, height);

      g.save();
      g.beginPath();
      g.rect(0, 0, width, viewH);
      g.clip();
      g.translate(sx, sy);

      renderThermalField(timeSec);
      g.imageSmoothingEnabled = true;
      g.drawImage(heatCanvas, -14, -14, width + 28, viewH + 28);

      drawAcidLiquidAndBubbles(dt, timeSec, viewH);
      drawCrystallineCarapace(timeSec, viewH);
      drawSonarAndScales(dt, timeSec, viewH);
      renderLaserBeam(dt, timeSec, viewH);
      drawSpiderwebCracks(viewH);
      drawHealingSweep(viewH);

      g.restore();

      // Post-process RGB chromatic aberration + horizontal scan tear
      applyRgbGlitch(viewH);

      rafId = requestAnimationFrame(tick);
    }

    /* ======================================================================
       EVENT LISTENERS & CLEANUP
       ====================================================================== */
    acidBtn.addEventListener('click', injectHydrochloricAcid);
    laserBtn.addEventListener('click', triggerLaserTest);
    window.addEventListener('resize', handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(rootEl);
    }

    seedInitialBubbles();
    handleResize();
    updateAdaptBadgeUi();
    updateClearanceUi();
    updateHudLabels(performance.now());
    if (hadPersistedAdaptationAtBoot && persistedAdaptedLaser && !rebootAdaptationWarningLogged) {
      rebootAdaptationWarningLogged = true;
      const countForLog = Math.max(1, persistedLaserTestCount);
      ctx.pushLog(
        `WARNING: SUBJECT SCP-682 RETAINS PHOTONIC ADAPTATION ACROSS TERMINAL REBOOT [TESTS: ${countForLog}]`,
        'crit'
      );
    }
    rafId = requestAnimationFrame(tick);

    return {
      unmount() {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        clearAllTimers();
        if (resizeObserver) {
          resizeObserver.disconnect();
          resizeObserver = null;
        }
        window.removeEventListener('resize', handleResize);
        acidBtn.removeEventListener('click', injectHydrochloricAcid);
        laserBtn.removeEventListener('click', triggerLaserTest);
        ctx.setHumeOffset(0);
        ctx.clearSpecialStatus();
        if (ctx.sound && typeof ctx.sound.stopTransientAlarms === 'function') {
          ctx.sound.stopTransientAlarms();
        }
        if (ctx.hostEl) {
          ctx.hostEl.classList.remove('has-bottom-bar', 'vp682-rampage');
        }
        rootEl.remove();
      },
      onBreachChange(active) {
        isBreach = Boolean(active);
      },
      onClearanceChange(level) {
        clearance = Number(level) || 1;
        updateClearanceUi();
      }
    };
  }

  window.Viewport682 = { create };

  if (window.LiveViewport) {
    window.LiveViewport.registerModule('SCP-682', create);
  }
})();
