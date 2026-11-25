(function () {
  'use strict';

  /**
   * Dedicated SCP-173 Surveillance Module (`Viewport173`)
   * Dual Canvas 2D renderer (LiDAR 3D Point Cloud + CCTV Night Vision)
   * with 4-stage blink-teleport mechanics synced to SoundEngine, ENV-02, KANT-01 & SYS-LOG.
   */
  const STAMINA_MAX = 6.0;
  const SWAP_WINDOW_SEC = 2.0;
  const ENGAGE_WINDOW_MS = 4500;

  const STAGE_CONFIG = {
    1: {
      code: 'FAR',
      label: '远景',
      dist: 5.2,
      camZ: -5.4,
      cctvScale: 0.32,
      offsetX: 0.16,
      offsetY: 0.0,
      tilt: 0.0,
      scrapeDb: 34.2,
      severity: 'info'
    },
    2: {
      code: 'MID',
      label: '中景',
      dist: 3.1,
      camZ: -3.35,
      cctvScale: 0.55,
      offsetX: -0.11,
      offsetY: 0.02,
      tilt: -0.025,
      scrapeDb: 88.6,
      severity: 'warn'
    },
    3: {
      code: 'CLOSE',
      label: '近距压迫',
      dist: 1.5,
      camZ: -1.78,
      cctvScale: 0.92,
      offsetX: 0.06,
      offsetY: 0.05,
      tilt: 0.038,
      scrapeDb: 94.4,
      severity: 'crit'
    },
    4: {
      code: 'CONTACT',
      label: '贴脸死角',
      dist: 0.4,
      camZ: -0.78,
      cctvScale: 1.56,
      offsetX: -0.03,
      offsetY: 0.14,
      tilt: -0.055,
      scrapeDb: 98.8,
      severity: 'crit'
    }
  };

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

  /**
   * Generates ~740 deterministic 3D LiDAR particles representing the concrete chamber
   * and an unsettling, monolithic concrete sculptural anomaly (SCP-173).
   */
  function generatePointCloud() {
    const rand = mulberry32(17301993);
    const points = [];

    // 1. Concrete containment chamber floor grid + central drain (~160 pts)
    for (let gx = -2.2; gx <= 2.21; gx += 0.44) {
      for (let gz = -1.6; gz <= 2.21; gz += 0.44) {
        points.push({
          x: gx + (rand() - 0.5) * 0.03,
          y: -1.15,
          z: gz + (rand() - 0.5) * 0.03,
          group: 'room',
          w: 0.72
        });
      }
    }

    // 2. Chamber corner concrete pillars & back wall structural ribs (~80 pts)
    const corners = [
      [-2.2, -1.6],
      [2.2, -1.6],
      [-2.2, 2.2],
      [2.2, 2.2]
    ];
    corners.forEach(([cx, cz]) => {
      for (let i = 0; i < 14; i++) {
        const py = -1.15 + (i / 13) * 2.85;
        points.push({
          x: cx + (rand() - 0.5) * 0.03,
          y: py,
          z: cz + (rand() - 0.5) * 0.03,
          group: 'room',
          w: 0.78
        });
      }
    });
    for (let i = 0; i < 24; i++) {
      points.push({
        x: -2.1 + (i / 23) * 4.2,
        y: 0.55 + (i % 2 === 0 ? 0.55 : -0.65),
        z: 2.2,
        group: 'room',
        w: 0.65
      });
    }

    // 3. Gaunt, asymmetrically leaning concrete torso (~220 pts, y in [-0.50, 0.72])
    for (let i = 0; i < 220; i++) {
      const t = rand();
      const y = -0.50 + t * 1.22;
      // Narrow waist pinch around t=0.35 expanding into hunched uneven shoulders
      const waistPinch = 0.095 + 0.055 * Math.sin(t * Math.PI);
      const shoulderFlare = t > 0.62 ? 0.11 * Math.sin(((t - 0.62) / 0.38) * Math.PI * 0.75) : 0;
      const radiusBase = waistPinch + shoulderFlare - (t > 0.88 ? 0.08 * ((t - 0.88) / 0.12) : 0);
      const ang = rand() * Math.PI * 2;
      const r = radiusBase * (0.76 + rand() * 0.28);
      const leanX = Math.sin(t * Math.PI) * -0.028 + (t - 0.5) * 0.042;
      const x = leanX + Math.cos(ang) * r * (1.0 + 0.12 * Math.sin(y * 6.0));
      const z = Math.sin(ang) * r * 0.78 + (t > 0.7 ? -0.03 : 0);
      points.push({ x, y, z, group: 'entity', w: 1.0 });
    }

    // 4. Asymmetrical planted concrete legs (~96 pts, y in [-1.15, -0.46])
    [
      { legX: -0.105, rBase: 0.092, bendZ: 0.04, kneeBias: -0.02 },
      { legX: 0.128, rBase: 0.076, bendZ: -0.03, kneeBias: 0.035 }
    ].forEach((leg) => {
      for (let i = 0; i < 48; i++) {
        const t = rand();
        const y = -1.15 + t * 0.69;
        const ang = rand() * Math.PI * 2;
        const r = (leg.rBase - t * 0.014) * (0.74 + rand() * 0.28);
        const kneeCurve = Math.sin(t * Math.PI) * leg.kneeBias;
        points.push({
          x: leg.legX + kneeCurve + Math.cos(ang) * r,
          y,
          z: Math.sin(ang) * r * 1.04 + leg.bendZ * (1 - t),
          group: 'entity',
          w: 0.95
        });
      }
    });

    // 5. Crooked asymmetrical concrete arms (~76 pts): drooping left vs raised jagged right
    for (let i = 0; i < 38; i++) {
      const t = rand();
      const baseX = -0.15 - t * 0.14;
      const baseY = 0.56 - t * 0.44;
      const baseZ = -0.04 - t * 0.18;
      const ang = rand() * Math.PI * 2;
      const r = (0.052 - t * 0.015) * (0.68 + rand() * 0.34);
      points.push({
        x: baseX + Math.cos(ang) * r,
        y: baseY + Math.sin(ang) * r,
        z: baseZ,
        group: 'entity',
        w: 1.0
      });
    }
    for (let i = 0; i < 38; i++) {
      const t = rand();
      const baseX = 0.14 + t * 0.16;
      const baseY = 0.62 + Math.sin(t * Math.PI) * 0.08 - t * 0.05;
      const baseZ = -0.05 - t * 0.32;
      const ang = rand() * Math.PI * 2;
      const r = (0.054 - t * 0.014) * (0.68 + rand() * 0.34);
      points.push({
        x: baseX + Math.cos(ang) * r,
        y: baseY + Math.sin(ang) * r,
        z: baseZ,
        group: 'entity',
        w: 1.0
      });
    }

    // 5.5 Constricted twisted neck (~24 pts, y in [0.70, 0.80])
    for (let i = 0; i < 24; i++) {
      const t = rand();
      const ang = rand() * Math.PI * 2;
      const r = (0.068 - t * 0.01) * (0.72 + rand() * 0.3);
      points.push({
        x: 0.015 + Math.cos(ang) * r,
        y: 0.70 + t * 0.11,
        z: -0.02 + Math.sin(ang) * r * 0.88,
        group: 'entity',
        w: 0.95
      });
    }

    // 6. Oversized, tilted asymmetric ovoid concrete cranium (~130 pts, y in [0.80, 1.44])
    const headTiltCos = Math.cos(0.18);
    const headTiltSin = Math.sin(0.18);
    for (let i = 0; i < 130; i++) {
      const u = rand() * 2 - 1;
      const theta = rand() * Math.PI * 2;
      const root = Math.sqrt(Math.max(0, 1 - u * u));
      const rx = 0.22 * (Math.cos(theta) < 0 ? 0.92 : 1.06);
      const ry = 0.33;
      const rz = 0.24;
      const surface = 0.85 + rand() * 0.17;
      const lx = root * Math.cos(theta) * rx * surface;
      const ly = u * ry * surface;
      const x = 0.025 + (lx * headTiltCos - ly * headTiltSin);
      const y = 1.10 + (lx * headTiltSin + ly * headTiltCos);
      const z = root * Math.sin(theta) * rz * surface - 0.02;

      const isFaceContour =
        z < -0.14 &&
        y > 0.90 &&
        y < 1.32 &&
        (Math.abs(x - 0.02) < 0.14 || Math.abs(y - 1.14) < 0.055);

      points.push({
        x,
        y,
        z,
        group: isFaceContour ? 'face' : 'entity',
        w: isFaceContour ? 1.18 : 1.05
      });
    }

    // 7. Floor residue cluster around base (~20 pts)
    for (let i = 0; i < 20; i++) {
      const ang = rand() * Math.PI * 2;
      const r = 0.12 + rand() * 0.36;
      points.push({
        x: Math.cos(ang) * r,
        y: -1.14,
        z: Math.sin(ang) * r,
        group: 'residue',
        w: 0.7
      });
    }

    return points;
  }

  /**
   * High-density close-range LiDAR points activated at Stage 3 (head/shoulders) and Stage 4 (facial hollows).
   */
  function generateCloseRangeDetailPoints() {
    const rand = mulberry32(17302026);
    const tier3 = [];
    const tier4 = [];
    const tiltCos = Math.cos(0.18);
    const tiltSin = Math.sin(0.18);

    // Tier 3 (~200 pts): cranium surface, constricted neck, hunched crooked shoulder ridges
    for (let i = 0; i < 140; i++) {
      const u = rand() * 2 - 1;
      const theta = rand() * Math.PI * 2;
      const root = Math.sqrt(Math.max(0, 1 - u * u));
      const rx = 0.22 * (Math.cos(theta) < 0 ? 0.92 : 1.06);
      const lx = root * Math.cos(theta) * rx * (0.95 + rand() * 0.07);
      const ly = u * 0.33 * (0.95 + rand() * 0.07);
      const x = 0.025 + (lx * tiltCos - ly * tiltSin);
      const y = 1.10 + (lx * tiltSin + ly * tiltCos);
      const z = root * Math.sin(theta) * 0.24 - 0.02;
      tier3.push({ x, y, z, group: z < -0.15 ? 'face' : 'entity', w: 1.0 });
    }
    for (let i = 0; i < 60; i++) {
      const side = i < 30 ? -1 : 1;
      const t = rand();
      const x = side * (0.08 + t * 0.20) + (rand() - 0.5) * 0.03;
      const y = (side < 0 ? 0.62 - t * 0.16 : 0.68 - t * 0.06) + (rand() - 0.5) * 0.03;
      const z = -0.06 - t * 0.16 + (rand() - 0.5) * 0.04;
      tier3.push({ x, y, z, group: 'entity', w: 0.95 });
    }

    // Tier 4 (~220 pts): dense sunken facial hollows, brow ridge, cheekbones, jawline & collarbone fissures
    for (let i = 0; i < 160; i++) {
      const isEyeHollow = i < 70;
      const side = i % 2 === 0 ? -1 : 1;
      let lx;
      let ly;
      let lz;
      if (isEyeHollow) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * 0.052;
        lx = side * 0.072 + Math.cos(a) * r;
        ly = 0.06 + (side > 0 ? 0.015 : -0.01) + Math.sin(a) * r * 1.3;
        lz = -0.22 - (1 - r / 0.052) * 0.03;
      } else {
        // Cheekbones, brow ridge & twisted mouth smear
        const band = rand();
        lx = (rand() - 0.5) * 0.22;
        ly = band < 0.4 ? 0.14 + (rand() - 0.5) * 0.05 : -0.10 + (rand() - 0.5) * 0.12;
        lz = -0.20 - Math.cos(lx * 5.0) * 0.04;
      }
      const x = 0.025 + (lx * tiltCos - ly * tiltSin);
      const y = 1.10 + (lx * tiltSin + ly * tiltCos);
      tier4.push({ x, y, z: lz, group: 'face', w: 1.15 });
    }
    for (let i = 0; i < 60; i++) {
      const t = rand();
      tier4.push({
        x: -0.18 + t * 0.38 + (rand() - 0.5) * 0.02,
        y: 0.64 + (t - 0.5) * 0.08 + (rand() - 0.5) * 0.025,
        z: -0.09 + (rand() - 0.5) * 0.04,
        group: 'entity',
        w: 1.05
      });
    }

    return { tier3, tier4 };
  }

  /**
   * Local 3D wireframe contour loops around SCP-173's tilted cranium & crooked shoulders (rendered at Stage 3/4).
   */
  const HEAD_WIREFRAME_LOOPS = (function () {
    const loops = [];
    const tiltCos = Math.cos(0.18);
    const tiltSin = Math.sin(0.18);
    const toHeadWorld = (lx, ly, lz) => ({
      x: 0.025 + (lx * tiltCos - ly * tiltSin),
      y: 1.10 + (lx * tiltSin + ly * tiltCos),
      z: lz - 0.02
    });

    // 3 cranial latitude rings
    [-0.45, 0.05, 0.52].forEach((u) => {
      const ring = [];
      const root = Math.sqrt(Math.max(0, 1 - u * u));
      for (let s = 0; s <= 18; s++) {
        const theta = (s / 18) * Math.PI * 2;
        const rx = 0.22 * (Math.cos(theta) < 0 ? 0.92 : 1.06);
        ring.push(toHeadWorld(root * Math.cos(theta) * rx, u * 0.33, root * Math.sin(theta) * 0.24));
      }
      loops.push(ring);
    });

    // 4 cranial meridian ribs
    [-Math.PI * 0.72, -Math.PI * 0.5, -Math.PI * 0.28, Math.PI * 0.5].forEach((theta) => {
      const rib = [];
      for (let s = 0; s <= 12; s++) {
        const u = -0.92 + (s / 12) * 1.84;
        const root = Math.sqrt(Math.max(0, 1 - u * u));
        const rx = 0.22 * (Math.cos(theta) < 0 ? 0.92 : 1.06);
        rib.push(toHeadWorld(root * Math.cos(theta) * rx, u * 0.33, root * Math.sin(theta) * 0.24));
      }
      loops.push(rib);
    });

    // Crooked shoulder-neck structural truss
    loops.push([
      { x: -0.26, y: 0.44, z: -0.14 },
      { x: -0.14, y: 0.58, z: -0.04 },
      { x: 0.01, y: 0.74, z: -0.02 },
      { x: 0.15, y: 0.66, z: -0.05 },
      { x: 0.27, y: 0.61, z: -0.22 }
    ]);

    return loops;
  })();

  /**
   * Deterministic weathered concrete mottling patches & fissures inside CCTV silhouette.
   */
  const CONCRETE_PATCHES = (function () {
    const rand = mulberry32(17309911);
    const list = [];
    for (let i = 0; i < 34; i++) {
      list.push({
        x: (rand() - 0.5) * 0.34,
        y: -0.10 - rand() * 1.04,
        rx: 0.015 + rand() * 0.042,
        ry: 0.012 + rand() * 0.048,
        rot: rand() * Math.PI,
        dark: rand() > 0.38,
        alpha: 0.18 + rand() * 0.24
      });
    }
    return list;
  })();

  const CONCRETE_FISSURES = (function () {
    const rand = mulberry32(17304477);
    const list = [];
    for (let i = 0; i < 9; i++) {
      const sx = (rand() - 0.5) * 0.22;
      const sy = -0.18 - rand() * 0.78;
      const pts = [{ x: sx, y: sy }];
      let cx = sx;
      let cy = sy;
      const segs = 3 + Math.floor(rand() * 3);
      for (let k = 0; k < segs; k++) {
        cx += (rand() - 0.5) * 0.036;
        cy += 0.045 + rand() * 0.06;
        pts.push({ x: cx, y: cy });
      }
      list.push(pts);
    }
    return list;
  })();

  function create(stageEl, ctx) {
    const points = generatePointCloud();
    const detailPoints = generateCloseRangeDetailPoints();
    const cellId = ctx.scp.sector.split('//').pop().trim();

    let viewMode = 'lidar'; // 'lidar' | 'cctv'
    let stage = 1;
    let stamina = STAMINA_MAX;
    let swapCount = 0;
    let isBlinking = false;
    let isPointerInside = false;
    let lastViewportInteractTs = 0;
    let shakeMag = 0;
    let isBreach = Boolean(ctx.isBreach);
    let scanY = 1.65;
    let targetYaw = 0;
    let targetPitch = 0;
    let yaw = 0;
    let pitch = 0;
    let width = 640;
    let height = 350;

    let rafId = null;
    let blinkMidTimer = null;
    let blinkEndTimer = null;
    let stage4BreachTimer = null;
    let resizeObserver = null;
    let lastFrameTs = performance.now();
    let lastTelemetrySyncTs = 0;

    if (ctx.hostEl) {
      ctx.hostEl.classList.add('has-bottom-bar');
    }

    // Build Viewport173 internal DOM inside LiveViewport stage
    const rootEl = document.createElement('div');
    rootEl.className = 'vp173-root';
    rootEl.innerHTML = `
      <canvas class="vp173-canvas"></canvas>
      <div class="vp173-stage-tag mono" data-stage-tag>STAGE 1/4 // 远景 [5.2m]</div>
      <div class="vp173-mode-bar">
        <button type="button" class="vp173-mode-btn mono" data-mode="cctv">[CCTV 夜视]</button>
        <button type="button" class="vp173-mode-btn active mono" data-mode="lidar">[LiDAR 点云]</button>
      </div>
      <div class="vp173-stage4-overlay" data-stage4-overlay>
        <div class="vp173-stage4-card">
          <div class="vp173-stage4-msg">
            <span class="vp173-stage4-title mono">⚠ PROXIMITY LOCK LOST // 贴脸死角告警 (0.4m)</span>
            <span class="vp173-stage4-sub">SCP-173 已抵近镜头死角，需派遣 D 级小组接管目视。</span>
          </div>
          <button type="button" class="vp173-reset-btn mono" data-reset-btn>D级人员接管目视 / RESET</button>
        </div>
      </div>
      <div class="vp173-local-blink" data-local-blink aria-hidden="true">
        <canvas class="vp173-static-canvas" width="240" height="135"></canvas>
        <div class="vp173-eyelid vp173-eyelid-top"></div>
        <div class="vp173-eyelid vp173-eyelid-bottom"></div>
      </div>
      <div class="vp173-bottom-bar">
        <div class="vp173-stamina-meta mono">
          <span class="vp173-stamina-label">STAMINA // 耐力</span>
          <span class="vp173-stamina-sec" data-stamina-sec>6.0s</span>
        </div>
        <div class="vp173-stamina-track" aria-hidden="true">
          <div class="vp173-swap-zone"></div>
          <div class="vp173-stamina-fill" data-stamina-fill></div>
        </div>
        <div class="vp173-actions">
          <button type="button" class="vp173-swap-btn mono" data-swap-btn disabled title="在耐力 ≤ 2.0s 窗口期按下，完成观察员交替目视">交替目视 / SWAP</button>
          <button type="button" class="vp173-blink-btn mono" data-blink-btn>强制眨眼 (BLINK)</button>
        </div>
      </div>
    `;
    stageEl.appendChild(rootEl);

    // Mount fullscreen 220ms eyelid + static portal on document.body (cleaned up on unmount)
    const blinkPortal = document.createElement('div');
    blinkPortal.id = 'vp173-blink-portal';
    blinkPortal.className = 'vp173-blink-portal';
    blinkPortal.setAttribute('aria-hidden', 'true');
    blinkPortal.innerHTML = `
      <canvas class="vp173-static-canvas" width="320" height="180"></canvas>
      <div class="vp173-eyelid vp173-eyelid-top"></div>
      <div class="vp173-eyelid vp173-eyelid-bottom"></div>
    `;
    document.body.appendChild(blinkPortal);

    const canvas = rootEl.querySelector('.vp173-canvas');
    const g = canvas.getContext('2d');
    const staticCanvas = blinkPortal.querySelector('.vp173-static-canvas');
    const staticCtx = staticCanvas ? staticCanvas.getContext('2d') : null;
    const localBlinkOverlay = rootEl.querySelector('[data-local-blink]');
    const localStaticCanvas = localBlinkOverlay ? localBlinkOverlay.querySelector('.vp173-static-canvas') : null;
    const localStaticCtx = localStaticCanvas ? localStaticCanvas.getContext('2d') : null;

    const stageTagEl = rootEl.querySelector('[data-stage-tag]');
    const modeButtons = Array.from(rootEl.querySelectorAll('.vp173-mode-btn'));
    const staminaSecEl = rootEl.querySelector('[data-stamina-sec]');
    const staminaFillEl = rootEl.querySelector('[data-stamina-fill]');
    const swapBtn = rootEl.querySelector('[data-swap-btn]');
    const blinkBtn = rootEl.querySelector('[data-blink-btn]');
    const stage4Overlay = rootEl.querySelector('[data-stage4-overlay]');
    const resetBtn = rootEl.querySelector('[data-reset-btn]');

    function handleResize() {
      const rect = rootEl.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(240, Math.floor(rect.width));
      height = Math.max(180, Math.floor(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawBlinkStatic(targetCanvas, targetCtx) {
      if (!targetCtx || !targetCanvas) return;
      const sw = targetCanvas.width;
      const sh = targetCanvas.height;
      const img = targetCtx.createImageData(sw, sh);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() > 0.5 ? 235 : 15;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = 255;
      }
      targetCtx.putImageData(img, 0, 0);
      // Harsh bright horizontal static bars
      targetCtx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      for (let k = 0; k < 4; k++) {
        targetCtx.fillRect(0, Math.floor(Math.random() * sh), sw, 1 + Math.floor(Math.random() * 3));
      }
    }

    function updateStageUi() {
      const cfg = STAGE_CONFIG[stage];
      stageTagEl.textContent = `STAGE ${stage}/4 // ${cfg.label} [${cfg.dist.toFixed(1)}m]`;
      stageTagEl.classList.toggle('warn', stage === 2);
      stageTagEl.classList.toggle('crit', stage >= 3);

      const locked = stage >= 4;
      stage4Overlay.classList.toggle('visible', locked);
      blinkBtn.disabled = locked || isBlinking;
      if (locked || isBlinking) {
        swapBtn.disabled = true;
        swapBtn.classList.remove('is-ready');
      }
      if (ctx.hostEl) {
        ctx.hostEl.classList.toggle('vp173-stage4', locked);
      }
    }

    function updateStaminaUi(nowMs) {
      const ratio = Math.max(0, Math.min(1, stamina / STAMINA_MAX));
      const low = stamina <= 1.5 || stage >= 4;
      const canSwap = !isBlinking && stage < 4 && stamina > 0 && stamina <= SWAP_WINDOW_SEC;
      staminaFillEl.style.width = `${(ratio * 100).toFixed(1)}%`;
      staminaFillEl.classList.toggle('low', low);
      staminaSecEl.textContent = `${stamina.toFixed(1)}s`;
      staminaSecEl.classList.toggle('low', low);
      swapBtn.disabled = !canSwap;
      swapBtn.classList.toggle('is-ready', canSwap);

      if (nowMs - lastTelemetrySyncTs >= 100) {
        lastTelemetrySyncTs = nowMs;
        if (stage >= 4) {
          ctx.setSpecialStatus('CONTACT! RESET REQ', true, 600);
        } else if (isBlinking) {
          ctx.setSpecialStatus('OPTICAL LOSS // BLINK', true, 600);
        } else {
          const text = low
            ? `BLINK IMMINENT ${stamina.toFixed(1)}s`
            : `LOCK 3/3 // ${stamina.toFixed(1)}s`;
          ctx.setSpecialStatus(text, low, 600);
        }
      }
    }

    function performOpticalSwap() {
      if (isBlinking || stage >= 4 || stamina <= 0 || stamina > SWAP_WINDOW_SEC) return;
      const now = performance.now();
      lastViewportInteractTs = now;
      stamina = STAMINA_MAX;
      swapCount += 1;

      if (ctx.sound) ctx.sound.playClick();
      ctx.triggerHumeSpike(0.12, 'SWAP // LOCK HELD');
      ctx.setSpecialStatus('SWAP OK // LOCK HELD', false, 1200);
      staminaFillEl.classList.remove('swap-ok');
      void staminaFillEl.offsetWidth;
      staminaFillEl.classList.add('swap-ok');

      updateStaminaUi(now);
      ctx.pushLog(
        `TACTICAL [SCP-173]: 观察员交替目视成功 (BLINK-3-2-1 #${swapCount}) — 耐力续满，目标保持 [${STAGE_CONFIG[stage].dist.toFixed(1)}m]`,
        'info'
      );
    }

    function triggerBlink(source) {
      if (isBlinking || stage >= 4) return;
      isBlinking = true;
      blinkBtn.disabled = true;
      swapBtn.disabled = true;
      swapBtn.classList.remove('is-ready');

      if (ctx.sound) {
        ctx.sound.playScrape(0.88);
      }

      const nowMs = performance.now();
      const useFullscreen = isPointerInside || (nowMs - lastViewportInteractTs < ENGAGE_WINDOW_MS);
      const targetEl = useFullscreen ? blinkPortal : localBlinkOverlay;
      const targetCvs = useFullscreen ? staticCanvas : localStaticCanvas;
      const targetCtx = useFullscreen ? staticCtx : localStaticCtx;

      drawBlinkStatic(targetCvs, targetCtx);
      if (targetEl) targetEl.classList.add('is-blinking');
      ctx.setSpecialStatus('OPTICAL LOSS // BLINK', true, 600);

      blinkMidTimer = setTimeout(() => {
        blinkMidTimer = null;
        drawBlinkStatic(targetCvs, targetCtx);

        stage = Math.min(4, stage + 1);
        const cfg = STAGE_CONFIG[stage];
        shakeMag = stage === 4 ? 1.5 : 1.05;

        // Spike ENV-02 SCRAPE DB into red & spike KANT-01 Hume reading
        ctx.updateEnvMetric('acoustic', cfg.scrapeDb, stage === 4 ? 60000 : 4500);
        ctx.triggerHumeSpike(0.32 + stage * 0.1, '173 SHIFT // SPIKE');

        const tag = source === 'AUTO' ? '耐力耗尽眨眼' : '手动强制眨眼';
        if (stage === 4) {
          stamina = 0;
          if (ctx.sound && typeof ctx.sound.playHeavyImpact === 'function') {
            ctx.sound.playHeavyImpact();
          }
          if (stage4BreachTimer) {
            clearTimeout(stage4BreachTimer);
            stage4BreachTimer = null;
          }
          stage4BreachTimer = setTimeout(() => {
            stage4BreachTimer = null;
            if (stage === 4 && !isBreach) {
              ctx.pushLog('FATAL [SCP-173]: 贴脸死角持续超 3.0s — 触发全站收容失效警报！', 'crit');
              ctx.setBreach(true);
            }
          }, 3000);
          ctx.pushLog(
            `CRITICAL [SCP-173]: ${tag} — 已贴脸死角 (${cfg.dist}m)！刮擦声 ${cfg.scrapeDb} dB`,
            'crit'
          );
        } else {
          stamina = STAMINA_MAX;
          ctx.pushLog(
            `ALERT [SCP-173]: ${tag} — 位移至${cfg.label} (${cfg.dist}m) // 刮擦 ${cfg.scrapeDb} dB`,
            cfg.severity
          );
        }

        updateStageUi();
        updateStaminaUi(performance.now());
      }, 110);

      blinkEndTimer = setTimeout(() => {
        blinkEndTimer = null;
        blinkPortal.classList.remove('is-blinking');
        if (localBlinkOverlay) localBlinkOverlay.classList.remove('is-blinking');
        isBlinking = false;
        updateStageUi();
      }, 220);
    }

    function resetContainment() {
      if (stage4BreachTimer) {
        clearTimeout(stage4BreachTimer);
        stage4BreachTimer = null;
      }
      if (ctx.sound) {
        ctx.sound.playClick();
      }
      stage = 1;
      stamina = STAMINA_MAX;
      shakeMag = 0.25;
      updateStageUi();
      updateStaminaUi(performance.now());
      ctx.updateEnvMetric('acoustic', STAGE_CONFIG[1].scrapeDb, 0);
      ctx.pushLog('D-CLASS RELIEF TEAM ENGAGED // SCP-173 恢复远景锁定 (5.2m)', 'info');
    }

    /* ======================================================================
       3D PROJECTION & RENDER MODE 1: LiDAR POINT CLOUD
       ====================================================================== */
    function project3D(px, py, pz, camZ, cosY, sinY, cosP, sinP, fov, cx, cy) {
      // Rotate around Y (yaw)
      const rx = px * cosY - pz * sinY;
      const rz0 = px * sinY + pz * cosY;
      // Rotate around X (pitch)
      const ry = py * cosP - rz0 * sinP;
      const rz = py * sinP + rz0 * cosP;

      const dz = rz - camZ;
      if (dz <= 0.22) return null;
      const scale = fov / dz;
      return {
        x: cx + rx * scale,
        y: cy - ry * scale,
        dz,
        scale
      };
    }

    function renderLidar(dt, nowMs) {
      const cfg = STAGE_CONFIG[stage];
      const alertMode = stage >= 3 || isBreach;
      const activeRgb = alertMode ? '255, 30, 30' : '255, 176, 0';
      const activeHex = alertMode ? '#FF1E1E' : '#FFB000';

      // Smooth camera parallax + subtle surveillance drift
      const idleYaw = Math.sin(nowMs * 0.00055) * 0.035;
      yaw += (targetYaw + idleYaw - yaw) * Math.min(1, dt * 8);
      pitch += (targetPitch - pitch) * Math.min(1, dt * 8);

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      const sx = shakeMag > 0.01 ? (Math.random() - 0.5) * 14 * shakeMag : 0;
      const sy = shakeMag > 0.01 ? (Math.random() - 0.5) * 10 * shakeMag : 0;
      const viewH = height - 46;
      const cx = width * 0.5 + sx;
      const cy = viewH * 0.53 + sy + (stage === 4 ? 26 : 0);
      const fov = Math.min(width, viewH) * 1.15;

      // Pure black LiDAR void
      g.fillStyle = '#040507';
      g.fillRect(0, 0, width, height);

      // Subtle wireframe containment floor & corner verticals
      g.strokeStyle = alertMode ? 'rgba(255, 30, 30, 0.14)' : 'rgba(56, 70, 92, 0.24)';
      g.lineWidth = 1;
      g.beginPath();
      for (let gx = -2.2; gx <= 2.21; gx += 1.1) {
        const a = project3D(gx, -1.15, -1.6, cfg.camZ, cosY, sinY, cosP, sinP, fov, cx, cy);
        const b = project3D(gx, -1.15, 2.2, cfg.camZ, cosY, sinY, cosP, sinP, fov, cx, cy);
        if (a && b) {
          g.moveTo(a.x, a.y);
          g.lineTo(b.x, b.y);
        }
      }
      for (let gz = -1.6; gz <= 2.21; gz += 0.95) {
        const a = project3D(-2.2, -1.15, gz, cfg.camZ, cosY, sinY, cosP, sinP, fov, cx, cy);
        const b = project3D(2.2, -1.15, gz, cfg.camZ, cosY, sinY, cosP, sinP, fov, cx, cy);
        if (a && b) {
          g.moveTo(a.x, a.y);
          g.lineTo(b.x, b.y);
        }
      }
      g.stroke();

      // Advance vertical LiDAR sweep plane (top -> bottom)
      scanY -= dt * 1.15;
      if (scanY < -1.25) scanY = 1.65;

      // Draw translucent horizontal laser plane band
      const pL = project3D(-2.2, scanY, 0.2, cfg.camZ, cosY, sinY, cosP, sinP, fov, cx, cy);
      const pR = project3D(2.2, scanY, 0.2, cfg.camZ, cosY, sinY, cosP, sinP, fov, cx, cy);
      if (pL && pR) {
        const planeY = (pL.y + pR.y) * 0.5;
        const grad = g.createLinearGradient(0, planeY - 14, 0, planeY + 14);
        grad.addColorStop(0, `rgba(${activeRgb}, 0)`);
        grad.addColorStop(0.5, `rgba(${activeRgb}, 0.22)`);
        grad.addColorStop(1, `rgba(${activeRgb}, 0)`);
        g.fillStyle = grad;
        g.fillRect(0, planeY - 14, width, 28);

        g.strokeStyle = `rgba(${activeRgb}, 0.65)`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, Math.floor(planeY) + 0.5);
        g.lineTo(width, Math.floor(planeY) + 0.5);
        g.stroke();
      }

      // Render base 3D points + close-range Stage 3/4 cranial/facial detail points
      const tiltSin = Math.sin(cfg.tilt);
      const tiltCos = Math.cos(cfg.tilt);
      const microJitter = stage === 4 ? 0.012 : 0;

      function renderPointList(list, boostScale = 1.0) {
        for (let i = 0; i < list.length; i++) {
          const pt = list[i];
          let px = pt.x;
          let py = pt.y;
          const pz = pt.z;

          if (pt.group !== 'room') {
            const rx = px * tiltCos - py * tiltSin;
            const ry = px * tiltSin + py * tiltCos;
            px = rx + cfg.offsetX + (microJitter ? (Math.random() - 0.5) * microJitter : 0);
            py = ry - cfg.offsetY;
          }

          const proj = project3D(px, py, pz, cfg.camZ, cosY, sinY, cosP, sinP, fov, cx, cy);
          if (!proj) continue;
          if (proj.x < -10 || proj.x > width + 10 || proj.y < -10 || proj.y > viewH + 10) continue;

          const scanDist = Math.abs(py - scanY);
          const isScanned = scanDist < 0.16;
          const scanBoost = isScanned ? 1 - scanDist / 0.16 : 0;

          const depthFade = Math.max(0.22, Math.min(1, 3.8 / proj.dz));
          let alpha = (pt.group === 'room' ? 0.28 : 0.72) * depthFade + scanBoost * 0.65;
          alpha = Math.min(1, alpha);

          let size = (pt.group === 'room' ? 1.35 : 1.9 * boostScale) * Math.min(1.85, 3.0 / proj.dz) + scanBoost * 1.65;

          if (isScanned) {
            g.fillStyle = `rgba(${activeRgb}, ${Math.min(0.42, scanBoost * 0.4)})`;
            const halo = size + 3.2;
            g.fillRect(proj.x - halo * 0.5, proj.y - halo * 0.5, halo, halo);
            g.fillStyle = `rgba(255, 248, 225, ${alpha})`;
          } else if (pt.group === 'face') {
            g.fillStyle = stage >= 3
              ? `rgba(255, 55, 55, ${Math.min(1, alpha + 0.15)})`
              : `rgba(217, 70, 50, ${alpha})`;
          } else if (pt.group === 'entity') {
            g.fillStyle = stage === 4 || isBreach
              ? `rgba(255, 72, 72, ${alpha})`
              : `rgba(255, 194, 72, ${alpha})`;
          } else {
            g.fillStyle = `rgba(110, 134, 164, ${alpha})`;
          }

          g.fillRect(proj.x - size * 0.5, proj.y - size * 0.5, size, size);
        }
      }

      renderPointList(points, 1.0);
      let renderedPtsCount = points.length;
      if (stage >= 3) {
        renderPointList(detailPoints.tier3, 0.92);
        renderedPtsCount += detailPoints.tier3.length;
      }
      if (stage >= 4) {
        renderPointList(detailPoints.tier4, 0.88);
        renderedPtsCount += detailPoints.tier4.length;
      }

      // Subtle cranial & shoulder wireframe contour overlay at Stage 3/4
      if (stage >= 3) {
        g.save();
        g.lineWidth = 0.85;
        for (let l = 0; l < HEAD_WIREFRAME_LOOPS.length; l++) {
          const loop = HEAD_WIREFRAME_LOOPS[l];
          g.beginPath();
          let started = false;
          let minScanDist = 9;
          for (let v = 0; v < loop.length; v++) {
            const pt = loop[v];
            const rx = pt.x * tiltCos - pt.y * tiltSin + cfg.offsetX;
            const ry = pt.x * tiltSin + pt.y * tiltCos - cfg.offsetY;
            minScanDist = Math.min(minScanDist, Math.abs(ry - scanY));
            const proj = project3D(rx, ry, pt.z, cfg.camZ, cosY, sinY, cosP, sinP, fov, cx, cy);
            if (!proj) {
              started = false;
              continue;
            }
            if (!started) {
              g.moveTo(proj.x, proj.y);
              started = true;
            } else {
              g.lineTo(proj.x, proj.y);
            }
          }
          const baseWireA = stage === 4 ? 0.34 : 0.19;
          const scanWireBoost = minScanDist < 0.24 ? (1 - minScanDist / 0.24) * 0.25 : 0;
          g.strokeStyle = `rgba(255, 68, 56, ${Math.min(0.62, baseWireA + scanWireBoost).toFixed(3)})`;
          g.stroke();
        }
        g.restore();
      }

      // Target lock reticle around SCP-173 cranium
      const headProj = project3D(
        cfg.offsetX + 0.025,
        1.10 - cfg.offsetY,
        0,
        cfg.camZ,
        cosY,
        sinY,
        cosP,
        sinP,
        fov,
        cx,
        cy
      );
      if (headProj) {
        const box = Math.max(18, Math.min(92, (0.38 * fov) / headProj.dz));
        const bLen = Math.max(6, box * 0.28);
        g.strokeStyle = alertMode ? 'rgba(255, 30, 30, 0.78)' : 'rgba(255, 176, 0, 0.58)';
        g.lineWidth = 1;
        g.beginPath();
        // Top-left
        g.moveTo(headProj.x - box, headProj.y - box + bLen);
        g.lineTo(headProj.x - box, headProj.y - box);
        g.lineTo(headProj.x - box + bLen, headProj.y - box);
        // Top-right
        g.moveTo(headProj.x + box - bLen, headProj.y - box);
        g.lineTo(headProj.x + box, headProj.y - box);
        g.lineTo(headProj.x + box, headProj.y - box + bLen);
        // Bottom-left
        g.moveTo(headProj.x - box, headProj.y + box - bLen);
        g.lineTo(headProj.x - box, headProj.y + box);
        g.lineTo(headProj.x - box + bLen, headProj.y + box);
        // Bottom-right
        g.moveTo(headProj.x + box - bLen, headProj.y + box);
        g.lineTo(headProj.x + box, headProj.y + box);
        g.lineTo(headProj.x + box, headProj.y + box - bLen);
        g.stroke();
      }

      // Left-side LiDAR vertical elevation scale
      g.strokeStyle = 'rgba(90, 100, 117, 0.45)';
      g.beginPath();
      g.moveTo(14, 72);
      g.lineTo(14, viewH - 42);
      for (let t = 0; t <= 6; t++) {
        const ty = 72 + ((viewH - 114) / 6) * t;
        g.moveTo(14, ty);
        g.lineTo(t % 2 === 0 ? 22 : 18, ty);
      }
      g.stroke();

      const resTag = stage === 4 ? ' [CLOSE-LOCK]' : stage === 3 ? ' [HI-RES]' : '';
      g.fillStyle = activeHex;
      g.font = '9px "JetBrains Mono", monospace';
      g.textAlign = 'right';
      g.textBaseline = 'top';
      g.fillText(`PTS:${renderedPtsCount}${resTag} // SWEEP:${scanY.toFixed(2)}m`, width - 14, 70);
    }

    /* ======================================================================
       RENDER MODE 2: CCTV NIGHT VISION (HIGH-CONTRAST MONOLITH SILHOUETTE)
       ====================================================================== */
    function renderCctv(dt, nowMs) {
      const cfg = STAGE_CONFIG[stage];
      const alertMode = stage >= 3 || isBreach;
      const viewH = height - 46;

      // Subtle surveillance mount tremor + post-blink shock
      const jitterX =
        Math.sin(nowMs * 0.013) * 0.6 +
        (shakeMag > 0.01 ? (Math.random() - 0.5) * 16 * shakeMag : 0) +
        targetYaw * -22;
      const jitterY =
        Math.cos(nowMs * 0.017) * 0.45 +
        (shakeMag > 0.01 ? (Math.random() - 0.5) * 12 * shakeMag : 0) +
        targetPitch * 18;

      g.save();
      g.translate(jitterX, jitterY);

      // Pitch-dark cold concrete chamber backdrop
      g.fillStyle = '#050709';
      g.fillRect(-20, -20, width + 40, height + 40);

      // 1-point perspective concrete walls
      const vpX = width * 0.5;
      const vpY = viewH * 0.42;
      const bw = width * 0.44;
      const bh = viewH * 0.46;
      const bx0 = vpX - bw * 0.5;
      const by0 = vpY - bh * 0.5;
      const bx1 = vpX + bw * 0.5;
      const by1 = vpY + bh * 0.5;

      // Subtle ambient wall shading
      const wallGrad = g.createRadialGradient(vpX, by0 + 10, 12, vpX, vpY, width * 0.65);
      wallGrad.addColorStop(0, alertMode ? 'rgba(65, 16, 18, 0.45)' : 'rgba(40, 48, 56, 0.36)');
      wallGrad.addColorStop(1, 'rgba(3, 4, 6, 0.96)');
      g.fillStyle = wallGrad;
      g.fillRect(-20, -20, width + 40, viewH + 40);

      // Architectural concrete seams & grid
      g.strokeStyle = alertMode ? 'rgba(130, 32, 32, 0.36)' : 'rgba(66, 78, 92, 0.38)';
      g.lineWidth = 1;
      g.strokeRect(bx0, by0, bw, bh);

      g.beginPath();
      // Corner perspective lines
      g.moveTo(0, 0); g.lineTo(bx0, by0);
      g.moveTo(width, 0); g.lineTo(bx1, by0);
      g.moveTo(0, viewH); g.lineTo(bx0, by1);
      g.moveTo(width, viewH); g.lineTo(bx1, by1);

      // Back wall horizontal block seams
      for (let i = 1; i <= 3; i++) {
        const y = by0 + (bh / 4) * i;
        g.moveTo(bx0, y);
        g.lineTo(bx1, y);
      }
      // Side wall perspective lines
      for (let i = 1; i <= 3; i++) {
        const frac = i / 4;
        g.moveTo(0, viewH * frac); g.lineTo(bx0, by0 + bh * frac);
        g.moveTo(width, viewH * frac); g.lineTo(bx1, by0 + bh * frac);
      }
      // Floor longitudinal grid lines
      for (let i = 1; i <= 5; i++) {
        const frac = i / 6;
        g.moveTo(bx0 + bw * frac, by1);
        g.lineTo(width * frac, viewH);
      }
      // Floor horizontal distance markers
      [0.2, 0.45, 0.72].forEach((t) => {
        const lx = bx0 * (1 - t);
        const rx = bx1 + (width - bx1) * t;
        const fy = by1 + (viewH - by1) * t;
        g.moveTo(lx, fy);
        g.lineTo(rx, fy);
      });
      g.stroke();

      // Overhead lamp & flickering volumetric cone
      const flicker = 0.78 + Math.sin(nowMs * 0.04) * 0.06 + (Math.random() < 0.05 ? -0.25 : 0);
      const coneTopW = 26;
      const coneBotW = width * 0.46;
      const coneGrad = g.createLinearGradient(vpX, by0 - 16, vpX, viewH);
      if (alertMode) {
        coneGrad.addColorStop(0, `rgba(255, 58, 58, ${0.26 * flicker})`);
        coneGrad.addColorStop(0.65, `rgba(180, 28, 28, ${0.1 * flicker})`);
        coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        coneGrad.addColorStop(0, `rgba(205, 224, 232, ${0.22 * flicker})`);
        coneGrad.addColorStop(0.65, `rgba(120, 142, 152, ${0.08 * flicker})`);
        coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      g.fillStyle = coneGrad;
      g.beginPath();
      g.moveTo(vpX - coneTopW, by0 - 14);
      g.lineTo(vpX + coneTopW, by0 - 14);
      g.lineTo(vpX + coneBotW, viewH);
      g.lineTo(vpX - coneBotW, viewH);
      g.closePath();
      g.fill();

      // Ceiling fixture slit
      g.fillStyle = alertMode ? 'rgba(255, 90, 90, 0.85)' : 'rgba(220, 238, 245, 0.8)';
      g.fillRect(vpX - 22, by0 - 16, 44, 4);

      // Monolithic SCP-173 Shadow Silhouette scaled per Stage (1..4)
      const entS = viewH * cfg.cctvScale;
      const entX = width * (0.5 + cfg.offsetX * 0.55);
      const entBottomY =
        stage === 1
          ? by1 + (viewH - by1) * 0.24
          : stage === 2
          ? by1 + (viewH - by1) * 0.56
          : stage === 3
          ? viewH * 0.98
          : viewH * 1.36;

      g.save();
      g.translate(entX, entBottomY);
      g.rotate(cfg.tilt);

      // Elongated dark cast shadow toward the camera
      const shadowGrad = g.createRadialGradient(0, 0, entS * 0.05, 0, entS * 0.16, entS * 0.52);
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.92)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = shadowGrad;
      g.beginPath();
      g.ellipse(0, entS * 0.04, entS * 0.34, entS * 0.12, 0, 0, Math.PI * 2);
      g.fill();

      // Asymmetric, gaunt concrete sculpture silhouette (elongated torso, crooked limbs, cocked cranium)
      function traceMonolithPath() {
        g.beginPath();
        // Left planted concrete leg -> knobby knee -> pinched gaunt waist
        g.moveTo(-entS * 0.115, 0);
        g.lineTo(-entS * 0.102, -entS * 0.18);
        g.lineTo(-entS * 0.114, -entS * 0.23);
        g.lineTo(-entS * 0.092, -entS * 0.38);
        g.quadraticCurveTo(-entS * 0.068, -entS * 0.46, -entS * 0.088, -entS * 0.54);
        // Drooping crooked left concrete arm hanging downward-outward
        g.lineTo(-entS * 0.135, -entS * 0.64);
        g.lineTo(-entS * 0.235, -entS * 0.48);
        g.lineTo(-entS * 0.258, -entS * 0.44);
        g.lineTo(-entS * 0.205, -entS * 0.43);
        g.lineTo(-entS * 0.142, -entS * 0.58);
        g.lineTo(-entS * 0.122, -entS * 0.74);
        // Sloped uneven left shoulder -> constricted neck
        g.quadraticCurveTo(-entS * 0.055, -entS * 0.78, -entS * 0.052, -entS * 0.85);
        // Oversized, asymmetrically tilted bulbous concrete cranium (flattened left temple, swollen right parietal)
        g.bezierCurveTo(
          -entS * 0.175,
          -entS * 0.89,
          -entS * 0.195,
          -entS * 1.10,
          -entS * 0.015,
          -entS * 1.21
        );
        g.bezierCurveTo(
          entS * 0.185,
          -entS * 1.25,
          entS * 0.225,
          -entS * 0.99,
          entS * 0.082,
          -entS * 0.85
        );
        // Hunched higher right shoulder -> jagged forward-crooked right concrete arm
        g.quadraticCurveTo(entS * 0.085, -entS * 0.79, entS * 0.145, -entS * 0.76);
        g.lineTo(entS * 0.232, -entS * 0.81);
        g.lineTo(entS * 0.272, -entS * 0.73);
        g.lineTo(entS * 0.255, -entS * 0.65);
        g.lineTo(entS * 0.175, -entS * 0.70);
        g.lineTo(entS * 0.115, -entS * 0.62);
        // Pinched right waist -> splayed thinner right concrete leg
        g.quadraticCurveTo(entS * 0.078, -entS * 0.48, entS * 0.095, -entS * 0.36);
        g.lineTo(entS * 0.125, -entS * 0.17);
        g.lineTo(entS * 0.118, 0);
        // Narrow asymmetric inner gap between concrete legs
        g.lineTo(entS * 0.042, 0);
        g.lineTo(entS * 0.036, -entS * 0.20);
        g.lineTo(entS * 0.018, -entS * 0.35);
        g.quadraticCurveTo(-entS * 0.005, -entS * 0.39, -entS * 0.025, -entS * 0.34);
        g.lineTo(-entS * 0.038, 0);
        g.closePath();
      }

      traceMonolithPath();
      const bodyGrad = g.createLinearGradient(-entS * 0.12, -entS * 1.24, entS * 0.12, 0);
      bodyGrad.addColorStop(0, alertMode ? '#220E10' : '#1B2127');
      bodyGrad.addColorStop(0.32, alertMode ? '#120708' : '#0D1014');
      bodyGrad.addColorStop(0.7, '#06080A');
      bodyGrad.addColorStop(1, '#020203');
      g.fillStyle = bodyGrad;
      g.fill();

      // Clipped weathered concrete mottling, neck/shoulder shadow & fissure cracks
      g.save();
      traceMonolithPath();
      g.clip();

      // Subtle deeper ambient shadow around constricted neck & gaunt waist
      const neckShadow = g.createRadialGradient(0, -entS * 0.80, entS * 0.02, 0, -entS * 0.76, entS * 0.24);
      neckShadow.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
      neckShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = neckShadow;
      g.fillRect(-entS * 0.35, -entS * 1.3, entS * 0.7, entS * 1.35);

      for (let i = 0; i < CONCRETE_PATCHES.length; i++) {
        const p = CONCRETE_PATCHES[i];
        g.fillStyle = p.dark
          ? `rgba(2, 3, 4, ${p.alpha.toFixed(2)})`
          : alertMode
          ? `rgba(110, 36, 36, ${(p.alpha * 0.55).toFixed(2)})`
          : `rgba(88, 102, 114, ${(p.alpha * 0.5).toFixed(2)})`;
        g.beginPath();
        g.ellipse(p.x * entS, p.y * entS, p.rx * entS, p.ry * entS, p.rot, 0, Math.PI * 2);
        g.fill();
      }

      g.strokeStyle = 'rgba(2, 3, 5, 0.72)';
      g.lineWidth = Math.max(0.8, entS * 0.004);
      for (let i = 0; i < CONCRETE_FISSURES.length; i++) {
        const f = CONCRETE_FISSURES[i];
        g.beginPath();
        g.moveTo(f[0].x * entS, f[0].y * entS);
        for (let k = 1; k < f.length; k++) {
          g.lineTo(f[k].x * entS, f[k].y * entS);
        }
        g.stroke();
      }
      g.restore();

      // Broken cold overhead rim light on concrete silhouette
      traceMonolithPath();
      g.strokeStyle = alertMode ? 'rgba(255, 78, 78, 0.44)' : 'rgba(188, 212, 224, 0.32)';
      g.lineWidth = stage >= 3 ? 1.45 : 1.0;
      g.stroke();

      // Asymmetric recessed facial hollows & weathered Krylon crimson-rust spray stains at Stage >= 2
      if (stage >= 2) {
        const hx = entS * 0.015;
        const hy = -entS * 1.03;
        g.fillStyle = 'rgba(2, 3, 4, 0.94)';
        g.beginPath();
        g.ellipse(hx - entS * 0.056, hy - entS * 0.025, entS * 0.028, entS * 0.042, -0.22, 0, Math.PI * 2);
        g.ellipse(hx + entS * 0.054, hy - entS * 0.006, entS * 0.032, entS * 0.048, 0.14, 0, Math.PI * 2);
        g.fill();

        // Weathered vertical Krylon spray-paint smear & asymmetrical eye bleed
        g.fillStyle = alertMode ? 'rgba(165, 22, 22, 0.52)' : 'rgba(92, 26, 20, 0.44)';
        g.fillRect(hx - entS * 0.016, hy + entS * 0.012, entS * 0.026, entS * 0.095);
        g.fillRect(hx + entS * 0.042, hy + entS * 0.038, entS * 0.014, entS * 0.055);
      }

      g.restore();

      // Analog CCTV sync hum bar & signal tear lines
      const humY = ((nowMs * 0.06) % (viewH + 40)) - 20;
      const humGrad = g.createLinearGradient(0, humY - 14, 0, humY + 14);
      humGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      humGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.045)');
      humGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      g.fillStyle = humGrad;
      g.fillRect(-20, humY - 14, width + 40, 28);

      const tearProb = shakeMag > 0.1 || alertMode ? 0.42 : 0.14;
      if (Math.random() < tearProb) {
        const ty = Math.random() * viewH;
        g.fillStyle = alertMode ? 'rgba(255, 55, 55, 0.38)' : 'rgba(220, 235, 240, 0.25)';
        g.fillRect(-20, ty, width + 40, 1 + Math.random() * 1.5);
      }

      g.restore();
    }

    function tick(nowMs) {
      const dt = Math.min(0.1, Math.max(0.001, (nowMs - lastFrameTs) / 1000));
      lastFrameTs = nowMs;

      if (shakeMag > 0.005) {
        shakeMag *= Math.pow(0.04, dt);
      } else {
        shakeMag = 0;
      }

      if (!isBlinking && stage < 4) {
        stamina = Math.max(0, stamina - dt);
        if (stamina <= 0) {
          triggerBlink('AUTO');
        }
      }

      updateStaminaUi(nowMs);

      if (viewMode === 'lidar') {
        renderLidar(dt, nowMs);
      } else {
        renderCctv(dt, nowMs);
      }

      rafId = requestAnimationFrame(tick);
    }

    /* ======================================================================
       EVENT LISTENERS & LIFECYCLE
       ====================================================================== */
    function setViewMode(mode) {
      if (mode !== 'lidar' && mode !== 'cctv') return;
      if (viewMode === mode) return;
      viewMode = mode;
      if (ctx.sound) ctx.sound.playClick();
      modeButtons.forEach((b) => {
        b.classList.toggle('active', b.dataset.mode === mode);
      });
      ctx.pushLog(
        `VIEWPORT [SCP-173]: 切换至 ${mode === 'lidar' ? 'LiDAR 3D 点云模式' : 'CCTV 夜视监控模式'}`,
        'info'
      );
    }

    function onPointerEnter() {
      isPointerInside = true;
      lastViewportInteractTs = performance.now();
    }

    function onPointerMove(e) {
      isPointerInside = true;
      lastViewportInteractTs = performance.now();
      const rect = rootEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      targetYaw = nx * 0.42;
      targetPitch = ny * 0.24;
    }

    function onPointerDown() {
      lastViewportInteractTs = performance.now();
    }

    function onPointerLeave() {
      isPointerInside = false;
      targetYaw = 0;
      targetPitch = 0;
    }

    modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        lastViewportInteractTs = performance.now();
        setViewMode(btn.dataset.mode);
      });
    });

    swapBtn.addEventListener('click', performOpticalSwap);

    blinkBtn.addEventListener('click', () => {
      lastViewportInteractTs = performance.now();
      if (ctx.sound) ctx.sound.playClick();
      triggerBlink('MANUAL');
    });

    resetBtn.addEventListener('click', () => {
      lastViewportInteractTs = performance.now();
      resetContainment();
    });

    rootEl.addEventListener('pointerenter', onPointerEnter);
    rootEl.addEventListener('pointerdown', onPointerDown);
    rootEl.addEventListener('pointermove', onPointerMove);
    rootEl.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('resize', handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(rootEl);
    }

    handleResize();
    updateStageUi();
    updateStaminaUi(performance.now());
    rafId = requestAnimationFrame(tick);

    return {
      unmount() {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (blinkMidTimer) {
          clearTimeout(blinkMidTimer);
          blinkMidTimer = null;
        }
        if (blinkEndTimer) {
          clearTimeout(blinkEndTimer);
          blinkEndTimer = null;
        }
        if (stage4BreachTimer) {
          clearTimeout(stage4BreachTimer);
          stage4BreachTimer = null;
        }
        if (resizeObserver) {
          resizeObserver.disconnect();
          resizeObserver = null;
        }
        window.removeEventListener('resize', handleResize);
        swapBtn.removeEventListener('click', performOpticalSwap);
        rootEl.removeEventListener('pointerenter', onPointerEnter);
        rootEl.removeEventListener('pointerdown', onPointerDown);
        rootEl.removeEventListener('pointermove', onPointerMove);
        rootEl.removeEventListener('pointerleave', onPointerLeave);
        blinkPortal.remove();
        rootEl.remove();
        if (ctx.hostEl) {
          ctx.hostEl.classList.remove('has-bottom-bar', 'vp173-stage4');
        }
        ctx.clearSpecialStatus();
      },
      onBreachChange(active) {
        isBreach = Boolean(active);
      }
    };
  }

  window.Viewport173 = { create };

  if (window.LiveViewport) {
    window.LiveViewport.registerModule('SCP-173', create);
  }
})();
