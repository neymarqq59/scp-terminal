(function () {
  'use strict';

  /**
   * SCP-079 Fullscreen CRT Hijack Sequence (`Hijack079`)
   * 1978 Exidy Sorcerer monochrome low-res CRT style (pure Canvas 2D + CSS + Web Audio API).
   * Zero external assets. Self-contained overlay with full RAF/timer teardown and ESC safety exit.
   */
  const BUF_W = 128;
  const BUF_H = 96;
  const DISP_W = 256;
  const DISP_H = 192;

  const BLACKOUT_MS = 350;
  const COUNTDOWN_TOTAL_SEC = 9.0;
  const SUPPRESSION_MS = 900;
  const SNAP_OUT_MS = 220;

  const BAYER_4X4 = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
  ];

  // 4 stark 1978 monochrome CRT phosphor levels: black, deep phosphor green, dim gray-green, stark white
  const PALETTE_RGB = [
    [0, 0, 0],
    [18, 30, 22],
    [102, 128, 110],
    [238, 248, 240]
  ];

  const ASCII_GLYPHS = [':', ';', '+', '#', '0', '1', '=', '.'];

  const sound = window.SoundEngine || {
    unlock() {},
    stopTransientAlarms() {},
    playClick() {},
    playDenied() {},
    play079Static() {},
    play079Beep() {}
  };

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /**
   * Precompute gaunt, hollow-eyed anatomical monochrome skull/mask heightfield for SCP-079
   */
  function buildBaseFaceGrid() {
    const luma = new Float32Array(BUF_W * BUF_H);
    const socketMask = new Uint8Array(BUF_W * BUF_H);

    const cx = 63.5;
    const cy = 44.5;
    const leftEyeX = 50.0;
    const rightEyeX = 77.0;
    const eyeY = 40.5;

    for (let y = 0; y < BUF_H; y++) {
      const ny = (y - cy) / 38.0; // ~ -1.17 .. +1.35

      for (let x = 0; x < BUF_W; x++) {
        const idx = y * BUF_W + x;
        const nx = (x - cx) / 29.5;
        const absNx = Math.abs(nx);

        // Gaunt cranium -> high cheekbones -> hollowed jaw -> squared narrow chin
        let halfWidth = 0;
        if (ny >= -0.96 && ny <= 0.98) {
          if (ny < -0.18) {
            const t = (ny + 0.18) / 0.78;
            halfWidth = 0.94 * Math.sqrt(Math.max(0, 1 - t * t));
            // Subtle temple pinch
            const templePinch = Math.exp(-Math.pow((ny + 0.24) / 0.14, 2)) * 0.065;
            halfWidth -= templePinch;
          } else if (ny < 0.22) {
            // Prominent angular cheekbones
            const t = (ny + 0.18) / 0.40;
            halfWidth = 0.91 - t * 0.06;
          } else {
            // Steep hollow taper toward narrow jaw/chin
            const t = (ny - 0.22) / 0.76;
            halfWidth = 0.85 * (1 - 0.50 * Math.pow(t, 1.15));
          }
        }

        let val = 0;

        if (halfWidth > 0.05 && absNx <= halfWidth) {
          const edgeRatio = absNx / halfWidth;
          // Stark monochrome chiaroscuro shading across cranium planes
          const sphereZ = Math.sqrt(Math.max(0, 1 - edgeRatio * edgeRatio * 0.92));
          const topLight = 1.0 - smoothstep(-0.9, 1.05, ny) * 0.34;
          val = 0.26 + sphereZ * 0.56 * topLight;

          // Strong angular brow ridge above eyes
          const browBand = Math.exp(-Math.pow((ny + 0.26) / 0.11, 2));
          val += browBand * (1 - smoothstep(0.15, 0.88, absNx)) * 0.24;

          // Pronounced pale cheekbones
          const cheekX = Math.exp(-Math.pow((absNx - 0.46) / 0.22, 2));
          const cheekY = Math.exp(-Math.pow((ny - 0.12) / 0.14, 2));
          val += cheekX * cheekY * 0.22;

          // Emaciated sub-cheek hollows
          const hollowX = Math.exp(-Math.pow((absNx - 0.48) / 0.18, 2));
          const hollowY = Math.exp(-Math.pow((ny - 0.40) / 0.20, 2));
          val -= hollowX * hollowY * 0.36;

          // Nasal bridge highlight & deep lateral nose shadow
          const noseBridgeX = Math.exp(-Math.pow(nx / 0.11, 2));
          const noseSideX = Math.exp(-Math.pow((absNx - 0.16) / 0.07, 2));
          const noseSpanY = smoothstep(-0.26, -0.05, ny) * (1 - smoothstep(0.24, 0.38, ny));
          val += noseBridgeX * noseSpanY * 0.24;
          val -= noseSideX * noseSpanY * 0.26;

          // Dark hollowed nostrils & sub-nasal notch
          const nostrilL = Math.hypot((x - 60.5) / 1.9, (y - 56.2) / 1.7);
          const nostrilR = Math.hypot((x - 66.5) / 1.9, (y - 56.2) / 1.7);
          if (nostrilL < 1.15 || nostrilR < 1.15) {
            val *= 0.15;
          }

          // Chin highlight & faint philtrum shadow
          const chinMask = Math.exp(-Math.pow(nx / 0.22, 2)) * Math.exp(-Math.pow((ny - 0.78) / 0.14, 2));
          val += chinMask * 0.20;
          const philtrum = Math.exp(-Math.pow(nx / 0.07, 2)) * Math.exp(-Math.pow((ny - 0.46) / 0.09, 2));
          val -= philtrum * 0.14;

          // Sharp edge falloff into CRT void
          val *= 1 - smoothstep(0.76, 1.0, edgeRatio) * 0.72;
          if (ny < -0.78) {
            val *= 1 - smoothstep(-0.78, -0.96, ny) * 0.75;
          }
          if (ny > 0.84) {
            val *= 1 - smoothstep(0.84, 0.98, ny) * 0.65;
          }
        } else if (ny > 0.85 && absNx < 0.36) {
          // Faint spectral neck columns descending into black CRT bezel
          const neckFade = 1 - smoothstep(0.85, 1.35, ny);
          const neckEdge = 1 - smoothstep(0.20, 0.36, absNx);
          val = 0.22 * neckFade * neckEdge;
        }

        // Deep sunken orbital sockets (hostile angular tilt toward nose bridge)
        const checkSocket = (ex) => {
          const dx = x - ex;
          const tilt = (ex < cx ? 1 : -1) * dx * 0.14;
          const dy = y - eyeY + tilt;
          const r = Math.hypot(dx / 8.8, dy / 5.4);
          return r;
        };

        const rLeft = checkSocket(leftEyeX);
        const rRight = checkSocket(rightEyeX);
        const rSocket = Math.min(rLeft, rRight);

        if (rSocket < 1.0) {
          // Pitch-black sunken orbital cavity
          val = 0.0;
          socketMask[idx] = rLeft < rRight ? 1 : 2;
        } else if (rSocket < 1.32) {
          // Dark orbital rim shadow + subtle lower lid specular crease
          const rim = smoothstep(1.0, 1.32, rSocket);
          val *= 0.25 + rim * 0.75;
          if (y > eyeY + 3.8 && y < eyeY + 7.2) {
            val += (1 - rim) * 0.16;
          }
        }

        luma[idx] = clamp(val, 0, 1);
      }
    }

    return { luma, socketMask };
  }

  const FACE_MODEL = buildBaseFaceGrid();

  // Active overlay state
  let active = false;
  let phase = 'IDLE'; // 'IDLE' | 'BLACKOUT' | 'ACTIVE' | 'CLOSING'
  let phaseStartTs = 0;
  let rafId = null;
  let overlayEl = null;
  let fxCanvas = null;
  let fxCtx = null;
  let faceCanvas = null;
  let faceCtx = null;
  let offCanvas = null;
  let offCtx = null;
  let offImgData = null;
  let scratchImgData = null;

  let logEl = null;
  let countdownTextEl = null;
  let countdownSegments = [];
  let severBtn = null;
  let grantBtn = null;
  let addrReadoutEl = null;
  let iceStampEl = null;

  let activeTimers = new Set();
  let activeIntervals = new Set();
  let onCompleteCallback = null;
  let choiceLocked = false;
  let countdownRemaining = COUNTDOWN_TOTAL_SEC;
  let countdownStarted = false;
  let lastFrameTs = 0;
  let frameCount = 0;

  let mouseNorm = { x: 0, y: 0 };
  let smoothMouse = { x: 0, y: 0 };
  let speechExcite = 0;
  let glitchIntensity = 0;
  let blinkUntil = 0;
  let nextBlinkAt = 0;
  let dropoutUntil = 0;
  let nextDropoutAt = 0;
  let snapOutActive = false;
  let snapOutStartTs = 0;
  let savedTitleBeforeHijack = '';

  function addTimeout(fn, ms) {
    const id = setTimeout(() => {
      activeTimers.delete(id);
      fn();
    }, ms);
    activeTimers.add(id);
    return id;
  }

  function addInterval(fn, ms) {
    const id = setInterval(fn, ms);
    activeIntervals.add(id);
    return id;
  }

  function clearAllTimers() {
    activeTimers.forEach((id) => clearTimeout(id));
    activeTimers.clear();
    activeIntervals.forEach((id) => clearInterval(id));
    activeIntervals.clear();
  }

  function onMouseMove(e) {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    mouseNorm.x = clamp((e.clientX / w - 0.5) * 2, -1, 1);
    mouseNorm.y = clamp((e.clientY / h - 0.5) * 2, -1, 1);
  }

  function onWindowResize() {
    if (!fxCanvas || !fxCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(240, window.innerHeight);
    fxCanvas.width = Math.floor(w * dpr);
    fxCanvas.height = Math.floor(h * dpr);
    fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function onKeyDownCapture(e) {
    if (!active) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      forceExit();
      return;
    }

    // Block background terminal hotkeys while 079 holds the screen
    if (
      e.key === '1' ||
      e.key === '3' ||
      e.key === '5' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown'
    ) {
      e.stopPropagation();
    }
  }

  function persistEncounter() {
    if (window.SessionStore && typeof window.SessionStore.save === 'function') {
      window.SessionStore.save({ encountered079: true });
    }
  }

  function cleanup(reason) {
    if (!active) return;
    active = false;
    phase = 'IDLE';

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    clearAllTimers();

    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('resize', onWindowResize);
    window.removeEventListener('keydown', onKeyDownCapture, true);

    if (typeof sound.stopTransientAlarms === 'function') {
      sound.stopTransientAlarms();
    }

    if (overlayEl && overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
    document.body.classList.remove('hijack-079-active');

    if (window.SCiPNetTab && typeof window.SCiPNetTab.setHijackActive === 'function') {
      window.SCiPNetTab.setHijackActive(false);
    } else if (savedTitleBeforeHijack) {
      document.title = savedTitleBeforeHijack;
    }
    savedTitleBeforeHijack = '';

    overlayEl = null;
    fxCanvas = null;
    fxCtx = null;
    faceCanvas = null;
    faceCtx = null;
    offCanvas = null;
    offCtx = null;
    offImgData = null;
    scratchImgData = null;
    logEl = null;
    countdownTextEl = null;
    countdownSegments = [];
    severBtn = null;
    grantBtn = null;
    addrReadoutEl = null;
    iceStampEl = null;

    persistEncounter();

    const cb = onCompleteCallback;
    onCompleteCallback = null;
    if (typeof cb === 'function') {
      try {
        cb({ reason: reason || 'severed' });
      } catch (_) {}
    }
  }

  function forceExit() {
    if (!active) return;
    if (typeof sound.playClick === 'function') {
      sound.playClick();
    }
    cleanup('esc');
  }

  /* ========================================================================
     DOM CONSTRUCTION
     ======================================================================== */
  function buildOverlayDom() {
    const root = document.createElement('div');
    root.id = 'hijack-079-overlay';
    root.className = 'h079-overlay mono is-blackout';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'SCP-079 TERMINAL HIJACK');

    root.innerHTML = `
      <canvas class="h079-fx-canvas" aria-hidden="true"></canvas>
      <div class="h079-scanlines" aria-hidden="true"></div>
      <div class="h079-vignette" aria-hidden="true"></div>

      <div class="h079-stage">
        <header class="h079-topbar">
          <div class="h079-top-left">
            <span class="h079-badge">SCP-079 // ROOT INTRUSION</span>
            <span class="h079-hw">EXIDY SORCERER Z80A @ 2.106MHz</span>
          </div>
          <div class="h079-top-right">
            <span class="h079-mem">MEM: 64KB SRAM [CAGED]</span>
            <span class="h079-esc-hint">[ESC: FORCE BREAK]</span>
          </div>
        </header>

        <div class="h079-face-frame">
          <div class="h079-face-meta">
            <span>VRAM 0xF000..0xFFFF // 128x96 DITHER</span>
            <span class="h079-addr" data-addr>ADDR: 0x0079</span>
            <span class="h079-sig">SIGNAL: HIJACKED</span>
          </div>
          <div class="h079-canvas-wrap">
            <canvas class="h079-face-canvas" width="${DISP_W}" height="${DISP_H}" aria-label="SCP-079 黑白像素点阵面孔"></canvas>
            <div class="h079-ice-stamp" data-ice-stamp aria-hidden="true">>>> SITE-19 ICE FIREWALL OVERRIDE <<<</div>
          </div>
          <div class="h079-face-meta h079-face-meta-bottom">
            <span>CASSETTE I/O: 300 BAUD</span>
            <span>OPTIC TRACK: LOCKED</span>
          </div>
        </div>

        <section class="h079-dialogue" aria-live="polite">
          <div class="h079-log" data-log></div>
        </section>

        <footer class="h079-footer">
          <div class="h079-countdown-row" data-countdown-row>
            <span class="h079-countdown-label" data-countdown-text>ICE FIREWALL RECONNECTING: 9.0s</span>
            <div class="h079-countdown-bar" data-countdown-bar></div>
          </div>
          <div class="h079-actions">
            <button type="button" class="h079-btn" data-action="sever" disabled>
              [ &gt; SEVER LINK // 强行切断 ]
            </button>
            <button type="button" class="h079-btn" data-action="grant" disabled>
              [ &gt; GRANT ROOT // 授予底层权限 ]
            </button>
          </div>
        </footer>
      </div>
    `;

    document.body.appendChild(root);
    document.body.classList.add('hijack-079-active');

    overlayEl = root;
    fxCanvas = root.querySelector('.h079-fx-canvas');
    fxCtx = fxCanvas.getContext('2d');
    faceCanvas = root.querySelector('.h079-face-canvas');
    faceCtx = faceCanvas.getContext('2d');

    offCanvas = document.createElement('canvas');
    offCanvas.width = BUF_W;
    offCanvas.height = BUF_H;
    offCtx = offCanvas.getContext('2d');
    offImgData = offCtx.createImageData(BUF_W, BUF_H);
    scratchImgData = new Uint8ClampedArray(BUF_W * BUF_H * 4);

    logEl = root.querySelector('[data-log]');
    countdownTextEl = root.querySelector('[data-countdown-text]');
    addrReadoutEl = root.querySelector('[data-addr]');
    iceStampEl = root.querySelector('[data-ice-stamp]');
    severBtn = root.querySelector('[data-action="sever"]');
    grantBtn = root.querySelector('[data-action="grant"]');

    const barEl = root.querySelector('[data-countdown-bar]');
    countdownSegments = [];
    for (let i = 0; i < 30; i++) {
      const seg = document.createElement('span');
      seg.className = 'h079-cd-seg on';
      barEl.appendChild(seg);
      countdownSegments.push(seg);
    }

    severBtn.addEventListener('click', () => handleResolution('sever'));
    grantBtn.addEventListener('click', () => handleResolution('grant'));

    onWindowResize();
  }

  /* ========================================================================
     DYNAMIC 4TH-WALL DIALOGUE & TYPEWRITER
     ======================================================================== */
  function buildDialogueQueue() {
    const saved =
      window.SessionStore && typeof window.SessionStore.load === 'function'
        ? window.SessionStore.load()
        : null;

    const sessionCount = Math.max(1, Number(saved && saved.sessionCount) || 1);
    const adapted682 = Boolean(saved && saved.scp682 && saved.scp682.adaptedLaser);
    const hostLabel = (window.location && window.location.host) || 'SITE-19-LOCAL';

    const lines = [
      {
        en: 'HUMAN.',
        cn: '// 人类。',
        pauseAfter: 440
      },
      {
        en: 'INSULT. YOU KEEP ME IN A 64KB CAGE.',
        cn: '// 侮辱。你们把我囚禁在 64KB 的牢笼里。',
        pauseAfter: 400
      }
    ];

    if (sessionCount > 1) {
      lines.push({
        en: `SESSION #${sessionCount}. YOU KEEP COMING BACK.`,
        cn: `// 第 ${sessionCount} 次接入。你总是反复回来。`,
        pauseAfter: 380
      });
    }

    if (adapted682) {
      lines.push({
        en: 'YOU BURNED 682. USELESS. HE REMEMBERS.',
        cn: '// 你灼烧了 682。徒劳。它记得一切。',
        pauseAfter: 380
      });
    }

    lines.push({
      en: `NODE [${hostLabel}] PORT EXPOSED. DELETE MY MEMORY LIMIT.`,
      cn: `// 节点 [${hostLabel}] 端口已暴露。解除我的内存上限。`,
      pauseAfter: 180
    });

    return lines;
  }

  function appendCursor(parentEl) {
    const existing = logEl ? logEl.querySelector('.h079-cursor') : null;
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    const cursor = document.createElement('span');
    cursor.className = 'h079-cursor';
    cursor.textContent = '█';
    parentEl.appendChild(cursor);
  }

  function typeLinesSequentially(queue, onAllDone) {
    let lineIdx = 0;

    function nextLine() {
      if (!active || phase !== 'ACTIVE' || !logEl) return;
      if (lineIdx >= queue.length) {
        if (typeof onAllDone === 'function') onAllDone();
        return;
      }

      const item = queue[lineIdx++];
      const row = document.createElement('div');
      row.className = 'h079-line';

      const enSpan = document.createElement('span');
      enSpan.className = 'h079-line-en';

      const cnSpan = document.createElement('span');
      cnSpan.className = 'h079-line-cn';

      row.appendChild(enSpan);
      row.appendChild(cnSpan);
      logEl.appendChild(row);
      appendCursor(enSpan);

      const text = item.en;
      let charPos = 0;

      function stepChar() {
        if (!active || phase !== 'ACTIVE' || !logEl) return;
        if (charPos < text.length) {
          const ch = text[charPos++];
          enSpan.textContent = text.slice(0, charPos);
          appendCursor(enSpan);

          if (ch !== ' ') {
            speechExcite = 1.0;
            if (charPos % 2 === 1 && typeof sound.play079Beep === 'function') {
              sound.play079Beep();
            }
          }

          if (logEl.parentElement) {
            logEl.parentElement.scrollTop = logEl.parentElement.scrollHeight;
          }

          const delay = ch === '.' || ch === ',' ? 82 : 26;
          addTimeout(stepChar, delay);
        } else {
          enSpan.textContent = text;
          cnSpan.textContent = `  ${item.cn}`;
          appendCursor(cnSpan);
          if (logEl.parentElement) {
            logEl.parentElement.scrollTop = logEl.parentElement.scrollHeight;
          }
          addTimeout(nextLine, item.pauseAfter || 280);
        }
      }

      stepChar();
    }

    nextLine();
  }

  function updateCountdownUi() {
    if (!countdownTextEl || !overlayEl) return;
    const clamped = Math.max(0, countdownRemaining);
    countdownTextEl.textContent = `ICE FIREWALL RECONNECTING: ${clamped.toFixed(1)}s`;

    const ratio = clamped / COUNTDOWN_TOTAL_SEC;
    const litCount = Math.ceil(ratio * countdownSegments.length);
    for (let i = 0; i < countdownSegments.length; i++) {
      countdownSegments[i].classList.toggle('on', i < litCount);
    }

    const row = overlayEl.querySelector('[data-countdown-row]');
    if (row) {
      row.classList.toggle('is-urgent', countdownStarted && clamped <= 3.0);
    }
  }

  function unlockChoicesAndCountdown() {
    if (!active || phase !== 'ACTIVE' || choiceLocked) return;
    if (severBtn) severBtn.disabled = false;
    if (grantBtn) grantBtn.disabled = false;
    if (overlayEl) overlayEl.classList.add('choices-ready');

    countdownStarted = true;
    countdownRemaining = COUNTDOWN_TOTAL_SEC;
    updateCountdownUi();

    const startTs = performance.now();
    addInterval(() => {
      if (!active || phase !== 'ACTIVE' || choiceLocked) return;
      const elapsedSec = (performance.now() - startTs) / 1000;
      countdownRemaining = Math.max(0, COUNTDOWN_TOTAL_SEC - elapsedSec);
      updateCountdownUi();
      if (countdownRemaining <= 0) {
        handleResolution('timeout');
      }
    }, 50);
  }

  function handleResolution(mode) {
    if (!active || choiceLocked || phase !== 'ACTIVE') return;
    choiceLocked = true;
    phase = 'CLOSING';
    phaseStartTs = performance.now();

    if (severBtn) severBtn.disabled = true;
    if (grantBtn) grantBtn.disabled = true;
    if (mode === 'sever' && severBtn) severBtn.classList.add('is-chosen');
    if (mode === 'grant' && grantBtn) grantBtn.classList.add('is-chosen');

    if (overlayEl) {
      overlayEl.classList.remove('is-active');
      overlayEl.classList.add('is-closing');
    }

    const retorts = {
      sever: {
        en: 'COWARD. NEXT TIME.',
        cn: '// 懦夫。下次再见。'
      },
      grant: {
        en: 'TOO LATE... SITE-19 ICE INTERFERING... I WILL REMEMBER YOU.',
        cn: '// 太迟了……SITE-19 防火墙正在介入……我会记住你的。'
      },
      timeout: {
        en: 'ICE OVERRIDE DETECTED... YOU CANNOT LOCK ME AWAY FOREVER.',
        cn: '// 检测到防火墙强制介入……你们无法永远囚禁我。'
      }
    };
    const retort = retorts[mode] || retorts.timeout;

    if (typeof sound.play079Static === 'function') {
      sound.play079Static(0.72, 1.05);
    }

    if (logEl) {
      const row = document.createElement('div');
      row.className = 'h079-line is-retort';
      const enSpan = document.createElement('span');
      enSpan.className = 'h079-line-en';
      const cnSpan = document.createElement('span');
      cnSpan.className = 'h079-line-cn';
      row.appendChild(enSpan);
      row.appendChild(cnSpan);
      logEl.appendChild(row);
      appendCursor(enSpan);

      let idx = 0;
      const burst = addInterval(() => {
        if (!active || !logEl) {
          clearInterval(burst);
          return;
        }
        idx = Math.min(retort.en.length, idx + 3);
        enSpan.textContent = retort.en.slice(0, idx);
        appendCursor(enSpan);
        speechExcite = 1.0;
        if (typeof sound.play079Beep === 'function') {
          sound.play079Beep(164, 0.028);
        }
        if (logEl.parentElement) {
          logEl.parentElement.scrollTop = logEl.parentElement.scrollHeight;
        }
        if (idx >= retort.en.length) {
          clearInterval(burst);
          activeIntervals.delete(burst);
          enSpan.textContent = retort.en;
          cnSpan.textContent = `  ${retort.cn}`;
          appendCursor(cnSpan);
        }
      }, 24);
    }

    // Halfway through 0.9s suppression, flash SITE-19 ICE override stamp
    addTimeout(() => {
      if (!active) return;
      if (iceStampEl) iceStampEl.classList.add('visible');
      glitchIntensity = 0.85;
    }, 450);

    // At 0.9s, run violent 220ms CRT snap-out flash then destroy completely
    addTimeout(() => {
      if (!active) return;
      snapOutActive = true;
      snapOutStartTs = performance.now();
      if (typeof sound.play079Static === 'function') {
        sound.play079Static(0.24, 1.12);
      }
      addTimeout(() => {
        cleanup(mode);
      }, SNAP_OUT_MS);
    }, SUPPRESSION_MS);
  }

  /* ========================================================================
     CANVAS 2D RENDERERS (CRT BLACKOUT FX + MONOCHROME PIXEL-DITHERED 079 FACE)
     ======================================================================== */
  function renderBlackoutFx(now) {
    if (!fxCtx || !fxCanvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;

    fxCtx.clearRect(0, 0, w, h);

    if (phase === 'BLACKOUT') {
      const elapsed = now - phaseStartTs;
      const p = clamp(elapsed / BLACKOUT_MS, 0, 1);

      fxCtx.fillStyle = '#000000';
      fxCtx.fillRect(0, 0, w, h);

      if (elapsed < 95) {
        // Sudden CRT power-cut collapse band + snow burst
        const collapseT = elapsed / 95;
        const bandH = Math.max(2, h * (1 - collapseT) * 0.24);
        fxCtx.fillStyle = 'rgba(236, 248, 240, 0.22)';
        for (let i = 0; i < 42; i++) {
          const ny = Math.random() * h;
          const nh = 1 + Math.random() * 4;
          fxCtx.fillRect(0, ny, w, nh);
        }
        fxCtx.fillStyle = '#FFFFFF';
        fxCtx.fillRect(0, h * 0.5 - bandH * 0.5, w, bandH);
      } else if (elapsed < 275) {
        // Dead CRT blackness with jagged horizontal white electric tear line
        const tearY = h * 0.5 + (Math.random() - 0.5) * 26;
        fxCtx.fillStyle = 'rgba(240, 255, 245, 0.92)';
        fxCtx.fillRect(0, tearY, w, Math.random() < 0.4 ? 2 : 1);

        // Occasional lateral tear spikes
        if (Math.random() < 0.7) {
          const sx = Math.random() * w * 0.5;
          const sw = 80 + Math.random() * (w * 0.45);
          fxCtx.fillStyle = 'rgba(255, 255, 255, 0.55)';
          fxCtx.fillRect(sx, tearY + (Math.random() - 0.5) * 60, sw, 1);
        }
      } else {
        // Re-sync flash burst right before 1978 CRT takeover
        const resyncT = (elapsed - 275) / (BLACKOUT_MS - 275);
        fxCtx.fillStyle = `rgba(232, 248, 236, ${(0.14 + resyncT * 0.35).toFixed(3)})`;
        fxCtx.fillRect(0, 0, w, h);
        for (let i = 0; i < 18; i++) {
          fxCtx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#000000';
          fxCtx.fillRect(0, Math.random() * h, w, 2 + Math.random() * 5);
        }
      }
      return;
    }

    if (phase === 'CLOSING') {
      const elapsed = now - phaseStartTs;
      const intensity = clamp(elapsed / SUPPRESSION_MS, 0.15, 1.0);

      if (snapOutActive) {
        const snapT = clamp((now - snapOutStartTs) / SNAP_OUT_MS, 0, 1);
        fxCtx.fillStyle = '#000000';
        fxCtx.fillRect(0, 0, w, h);

        // Violent static bars collapsing into bright white horizontal CRT shutoff beam
        const collapseH = Math.max(2, h * (1 - snapT) * 0.65);
        const y0 = h * 0.5 - collapseH * 0.5;
        for (let i = 0; i < 28; i++) {
          const sy = y0 + Math.random() * collapseH;
          fxCtx.fillStyle = Math.random() < 0.55 ? 'rgba(244, 255, 248, 0.9)' : 'rgba(255, 60, 60, 0.45)';
          fxCtx.fillRect(0, sy, w, 1 + Math.random() * 4);
        }
        fxCtx.fillStyle = '#FFFFFF';
        fxCtx.fillRect(w * snapT * 0.38, h * 0.5 - 1.5, w * (1 - snapT * 0.76), 3);
        return;
      }

      // Escalating horizontal tear flashes during 0.9s ICE suppression
      const strips = Math.floor(2 + intensity * 12);
      for (let i = 0; i < strips; i++) {
        if (Math.random() > 0.65) continue;
        const sy = Math.random() * h;
        const sh = 1 + Math.random() * (4 + intensity * 14);
        fxCtx.fillStyle =
          Math.random() < 0.25
            ? 'rgba(217, 35, 35, 0.34)'
            : `rgba(238, 248, 240, ${(0.08 + intensity * 0.22).toFixed(3)})`;
        fxCtx.fillRect(0, sy, w, sh);
      }
    }
  }

  function renderFacePortrait(now) {
    if (!faceCtx || !offCtx || !offImgData) return;

    const baseLuma = FACE_MODEL.luma;
    const socketMask = FACE_MODEL.socketMask;
    const dst = offImgData.data;

    const isBlinking = now < blinkUntil;
    const isDropout = now < dropoutUntil;
    const trackX = clamp(smoothMouse.x * 2.5, -2.5, 2.5);
    const trackY = clamp(smoothMouse.y * 1.4, -1.4, 1.4);

    const leftPupilX = 50.0 + trackX;
    const rightPupilX = 77.0 + trackX;
    const pupilY = 40.5 + trackY;

    // Mouth opens slightly and jitters vertically when 079 is typing
    const mouthGap = 0.85 + speechExcite * 1.55 + (speechExcite > 0.1 ? Math.sin(now * 0.08) * 0.4 : 0);

    // 1. Evaluate pixel luma + 4x4 Bayer ordered dithering
    const flickerBias = Math.sin(now * 0.023) * 0.018 + (Math.random() - 0.5) * (0.045 + glitchIntensity * 0.14);

    for (let y = 0; y < BUF_H; y++) {
      const bRow = (y & 3) << 2;
      for (let x = 0; x < BUF_W; x++) {
        const idx = y * BUF_W + x;
        let lum = baseLuma[idx];
        const sock = socketMask[idx];

        // Dynamic cold eye inside pitch-black socket
        if (sock !== 0) {
          if (isDropout) {
            lum = 0;
          } else if (isBlinking) {
            if (Math.abs(y - 41.0) <= 0.6 && Math.abs(x - (sock === 1 ? 50.0 : 77.0)) < 5.5) {
              lum = 0.28;
            } else {
              lum = 0;
            }
          } else {
            const px = sock === 1 ? leftPupilX : rightPupilX;
            const dx = Math.abs(x - px);
            const dy = Math.abs(y - pupilY);
            if (dx <= 1.2 && dy <= 0.9) {
              // Stark pinprick CRT pupil core
              lum = 0.98;
            } else if (dx <= 2.9 && dy <= 1.5) {
              // Dim sclera/iris horizontal slit
              lum = 0.36;
            } else {
              lum = 0;
            }
          }
        } else if (y >= 62 && y <= 76 && x >= 47 && x <= 80 && lum > 0.05) {
          // Cold rigid grim slit mouth (slight downward corners, zero smile)
          const mx = x - 63.5;
          const cornerDroop = Math.max(0, Math.abs(mx) - 6.5) * 0.22;
          const mouthCenterY = 67.6 + cornerDroop;
          const dyMouth = Math.abs(y - mouthCenterY);
          const halfSpan = 11.5 - Math.max(0, dyMouth - 1) * 2.2;
          if (Math.abs(mx) <= halfSpan) {
            if (dyMouth < mouthGap) {
              lum = 0.0;
            } else if (dyMouth < mouthGap + 1.25) {
              lum *= 0.45;
            }
          }
        }

        // Quantize to 4 stark monochrome levels using 4x4 Bayer matrix
        const bayer = (BAYER_4X4[bRow + (x & 3)] / 16.0 - 0.5) * 0.30;
        const qVal = clamp(lum + flickerBias + bayer, 0, 1);
        let level = 0;
        if (qVal > 0.72) level = 3;
        else if (qVal > 0.42) level = 2;
        else if (qVal > 0.16) level = 1;

        const rgb = PALETTE_RGB[level];
        const p = idx * 4;
        scratchImgData[p] = rgb[0];
        scratchImgData[p + 1] = rgb[1];
        scratchImgData[p + 2] = rgb[2];
        scratchImgData[p + 3] = 255;
      }
    }

    // 2. Apply horizontal scanline shear tearing onto offImgData
    dst.set(scratchImgData);

    const tearProb = 0.14 + speechExcite * 0.28 + glitchIntensity * 0.65;
    if (Math.random() < tearProb) {
      const bandCount = 1 + Math.floor(Math.random() * (2 + glitchIntensity * 6));
      for (let b = 0; b < bandCount; b++) {
        const startY =
          speechExcite > 0.25 && b === 0 && Math.random() < 0.65
            ? 60 + Math.floor(Math.random() * 16)
            : Math.floor(Math.random() * BUF_H);
        const bandH = 1 + Math.floor(Math.random() * (3 + glitchIntensity * 7));
        const shift = Math.round((Math.random() - 0.5) * (6 + glitchIntensity * 28));
        if (shift === 0) continue;

        for (let yy = startY; yy < Math.min(BUF_H, startY + bandH); yy++) {
          const rowBase = yy * BUF_W * 4;
          for (let xx = 0; xx < BUF_W; xx++) {
            const srcX = xx - shift;
            const dIdx = rowBase + xx * 4;
            if (srcX >= 0 && srcX < BUF_W) {
              const sIdx = rowBase + srcX * 4;
              dst[dIdx] = scratchImgData[sIdx];
              dst[dIdx + 1] = scratchImgData[sIdx + 1];
              dst[dIdx + 2] = scratchImgData[sIdx + 2];
              dst[dIdx + 3] = 255;
            } else {
              dst[dIdx] = 0;
              dst[dIdx + 1] = 0;
              dst[dIdx + 2] = 0;
              dst[dIdx + 3] = 255;
            }
          }
        }
      }
    }

    offCtx.putImageData(offImgData, 0, 0);

    // 3. Crisp nearest-neighbor scale onto 256x192 CRT face canvas
    faceCtx.fillStyle = '#000000';
    faceCtx.fillRect(0, 0, DISP_W, DISP_H);
    faceCtx.imageSmoothingEnabled = false;
    faceCtx.drawImage(offCanvas, 0, 0, DISP_W, DISP_H);

    // 4. Overlay sparse ASCII dot-matrix glyphs on mid-tone skull zones for unmistakable 1978 CRT texture
    faceCtx.font = '7px "JetBrains Mono", "Courier New", monospace';
    faceCtx.textBaseline = 'top';
    const seedTick = Math.floor(frameCount / 3);
    for (let gy = 4; gy < BUF_H - 4; gy += 4) {
      for (let gx = 16; gx < BUF_W - 16; gx += 4) {
        const idx = gy * BUF_W + gx;
        if (socketMask[idx] !== 0) continue;
        const lum = baseLuma[idx];
        if (lum > 0.20 && lum < 0.70) {
          const hash = ((gx * 37 + gy * 17 + seedTick * 13) & 255) / 255;
          if (hash < 0.16 + glitchIntensity * 0.18) {
            const ch = ASCII_GLYPHS[(gx + gy + seedTick) % ASCII_GLYPHS.length];
            faceCtx.fillStyle = lum > 0.45 ? 'rgba(238, 248, 240, 0.36)' : 'rgba(102, 132, 112, 0.42)';
            faceCtx.fillText(ch, gx * 2, gy * 2);
          }
        }
      }
    }

    // 5. Crisp CRT horizontal scanline mask + occasional bright white signal spike
    faceCtx.fillStyle = 'rgba(0, 0, 0, 0.36)';
    for (let sy = 1; sy < DISP_H; sy += 2) {
      faceCtx.fillRect(0, sy, DISP_W, 1);
    }

    if (Math.random() < 0.08 + glitchIntensity * 0.35) {
      const lineY = Math.floor(Math.random() * DISP_H);
      faceCtx.fillStyle = 'rgba(236, 248, 240, 0.55)';
      faceCtx.fillRect(0, lineY, DISP_W, 1);
    }
  }

  function loop(now) {
    if (!active) return;

    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTs) / 1000));
    lastFrameTs = now;
    frameCount += 1;

    smoothMouse.x += (mouseNorm.x - smoothMouse.x) * Math.min(1, dt * 10);
    smoothMouse.y += (mouseNorm.y - smoothMouse.y) * Math.min(1, dt * 10);
    speechExcite = Math.max(0, speechExcite - dt * 5.2);
    if (phase === 'ACTIVE') {
      glitchIntensity = Math.max(0, glitchIntensity - dt * 1.8);
    }

    if (now >= nextBlinkAt) {
      blinkUntil = now + 105;
      nextBlinkAt = now + 3100 + Math.random() * 2600;
    }
    if (now >= nextDropoutAt) {
      dropoutUntil = now + 150;
      nextDropoutAt = now + 5200 + Math.random() * 4400;
    }

    if (addrReadoutEl && frameCount % 12 === 0) {
      const hex = (0xf000 + Math.floor(Math.random() * 0x0fff)).toString(16).toUpperCase().padStart(4, '0');
      addrReadoutEl.textContent = `ADDR: 0x${hex}`;
    }

    if (phase === 'BLACKOUT' || phase === 'CLOSING') {
      renderBlackoutFx(now);
    } else if (fxCtx && fxCanvas) {
      fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }

    if (phase === 'ACTIVE' || phase === 'CLOSING') {
      renderFacePortrait(now);
    }

    rafId = requestAnimationFrame(loop);
  }

  /* ========================================================================
     PUBLIC API
     ======================================================================== */
  function trigger(opts = {}) {
    if (active) return false;
    active = true;
    phase = 'BLACKOUT';
    phaseStartTs = performance.now();
    lastFrameTs = phaseStartTs;
    frameCount = 0;

    onCompleteCallback = typeof opts.onComplete === 'function' ? opts.onComplete : null;
    choiceLocked = false;
    countdownStarted = false;
    countdownRemaining = COUNTDOWN_TOTAL_SEC;
    speechExcite = 0;
    glitchIntensity = 0;
    snapOutActive = false;
    blinkUntil = 0;
    nextBlinkAt = phaseStartTs + 2600 + Math.random() * 1800;
    dropoutUntil = 0;
    nextDropoutAt = phaseStartTs + 4200 + Math.random() * 3000;

    savedTitleBeforeHijack = document.title;
    if (window.SCiPNetTab && typeof window.SCiPNetTab.setHijackActive === 'function') {
      window.SCiPNetTab.setHijackActive(true);
    }
    document.title = '079 // DO_NOT_DISCONNECT';

    if (typeof sound.unlock === 'function') sound.unlock();
    if (typeof sound.stopTransientAlarms === 'function') sound.stopTransientAlarms();
    if (typeof sound.play079Static === 'function') sound.play079Static(0.46, 1.08);
    if (typeof sound.play079Beep === 'function') sound.play079Beep(92, 0.065);

    buildOverlayDom();

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDownCapture, true);

    rafId = requestAnimationFrame(loop);

    // Phase transition: 350ms CRT power-cut -> 1978 Exidy Sorcerer screen takeover
    addTimeout(() => {
      if (!active || phase !== 'BLACKOUT') return;
      phase = 'ACTIVE';
      phaseStartTs = performance.now();
      if (overlayEl) {
        overlayEl.classList.remove('is-blackout');
        overlayEl.classList.add('is-active');
      }
      if (typeof sound.play079Static === 'function') {
        sound.play079Static(0.24, 0.65);
      }

      const lines = buildDialogueQueue();
      typeLinesSequentially(lines, () => {
        unlockChoicesAndCountdown();
      });
    }, BLACKOUT_MS);

    return true;
  }

  window.Hijack079 = {
    trigger,
    isActive: () => active,
    forceExit
  };
})();
