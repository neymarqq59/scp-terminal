(function () {
  'use strict';

  /**
   * Central Live Surveillance Viewport Router & CCTV Visual Shell.
   * Zero external images; overlays procedural grain, scanlines, fisheye vignette,
   * blinking REC status, and millisecond UTC timestamp above routed SCP modules.
   */
  const registry = new Map();

  let activeHost = null;
  let activeChild = null;
  let activeScp = null;
  let activeBridge = null;
  let noiseRafId = null;
  let noiseCanvas = null;
  let noiseCtx = null;
  let tsEl = null;
  let sigEl = null;
  let lastNoiseDrawTs = 0;
  let isBreachState = false;
  let isConsoleMode = false;

  function formatUtcTimestamp(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}.${ms} UTC`;
  }

  function drawProceduralNoise() {
    if (!noiseCtx || !noiseCanvas) return;
    const w = noiseCanvas.width;
    const h = noiseCanvas.height;
    const imgData = noiseCtx.createImageData(w, h);
    const data = imgData.data;
    const len = data.length;

    // Lightweight monochrome film grain
    for (let i = 0; i < len; i += 4) {
      const grain = (Math.random() * 255) | 0;
      data[i] = grain;
      data[i + 1] = grain;
      data[i + 2] = grain;
      data[i + 3] = 255;
    }
    noiseCtx.putImageData(imgData, 0, 0);

    // Subtle horizontal interference line (intensifies in BREACH mode)
    const tearChance = isBreachState ? 0.35 : 0.1;
    if (Math.random() < tearChance) {
      const tearY = Math.floor(Math.random() * h);
      noiseCtx.fillStyle = isBreachState
        ? 'rgba(255, 70, 70, 0.45)'
        : 'rgba(226, 232, 240, 0.25)';
      noiseCtx.fillRect(0, tearY, w, isBreachState ? 2 : 1);
    }
  }

  function startOverlayLoop() {
    if (noiseRafId) cancelAnimationFrame(noiseRafId);

    function frame(now) {
      if (tsEl) {
        tsEl.textContent = formatUtcTimestamp(new Date());
      }
      if (!isConsoleMode && now - lastNoiseDrawTs >= 55) {
        lastNoiseDrawTs = now;
        drawProceduralNoise();
      }
      noiseRafId = requestAnimationFrame(frame);
    }

    noiseRafId = requestAnimationFrame(frame);
  }

  /**
   * Phase 1 default placeholder module routed when no custom module is registered
   */
  function createStandbyModule(stageEl, ctx) {
    const cellId = ctx.scp.sector.split('//').pop().trim();
    const wrap = document.createElement('div');
    wrap.className = 'lv-standby';
    wrap.innerHTML = `
      <div class="lv-standby-grid" aria-hidden="true"></div>
      <div class="lv-standby-core">
        <div class="lv-standby-route mono">
          ROUTE TARGET // ${ctx.scp.id} [${cellId}]
        </div>
        <div class="lv-standby-title mono">
          SIGNAL STANDBY // 等待接入模块
        </div>
        <div class="lv-standby-sub">
          实时监控交互子模块接口已就绪，可通过 <code>LiveViewport.registerModule('${ctx.scp.id}', factory)</code> 挂载专属交互视图。
        </div>
        <div class="lv-standby-bus mono">
          <span>BUS: ENV-02</span>
          <span>KANT-01</span>
          <span>SYS-LOG</span>
          <span>AUDIO</span>
          <span class="lv-bus-ready">[LINK READY]</span>
        </div>
      </div>
    `;
    stageEl.appendChild(wrap);

    function applyBreach(breach) {
      wrap.classList.toggle('is-breach', Boolean(breach));
    }
    applyBreach(ctx.isBreach);

    return {
      unmount() {
        wrap.remove();
      },
      onBreachChange: applyBreach
    };
  }

  function unmount() {
    if (noiseRafId) {
      cancelAnimationFrame(noiseRafId);
      noiseRafId = null;
    }
    if (activeChild && typeof activeChild.unmount === 'function') {
      try {
        activeChild.unmount();
      } catch (_) {}
    }
    activeChild = null;
    if (activeHost) {
      activeHost.classList.remove('has-bottom-bar', 'vp173-stage4', 'vp682-rampage', 'has-console-layout');
      activeHost.innerHTML = '';
    }
    activeHost = null;
    activeScp = null;
    isConsoleMode = false;
    noiseCanvas = null;
    noiseCtx = null;
    tsEl = null;
    sigEl = null;
  }

  function mount(hostEl, scp, bridge) {
    unmount();
    if (!hostEl || !scp) return;

    activeHost = hostEl;
    activeScp = scp;
    activeBridge = bridge;
    isBreachState = Boolean(bridge && bridge.isBreach());

    const cellId = scp.sector.split('//').pop().trim();

    hostEl.dataset.breach = isBreachState ? 'true' : 'false';
    hostEl.innerHTML = `
      <span class="reticle tl" aria-hidden="true">⌜</span>
      <span class="reticle tr" aria-hidden="true">⌝</span>
      <span class="reticle bl" aria-hidden="true">⌞</span>
      <span class="reticle br" aria-hidden="true">⌟</span>
      <div class="lv-stage" id="lv-stage"></div>
      <div class="lv-cctv-overlay" aria-hidden="true">
        <canvas class="lv-noise-canvas" width="240" height="135"></canvas>
        <div class="lv-scanlines"></div>
        <div class="lv-fisheye"></div>
        <div class="lv-crosshair"></div>
        <div class="lv-hud-tl mono">
          <span class="lv-rec-dot">REC ●</span>
          <span class="lv-cam-id">CAM-LIVE // ${cellId}</span>
        </div>
        <div class="lv-hud-tr mono">
          <span class="lv-timestamp">${formatUtcTimestamp(new Date())}</span>
        </div>
        <div class="lv-hud-bl mono">FEED: ${scp.id} // ${scp.objectClass}</div>
        <div class="lv-hud-br mono" data-lv-signal>SIG: ${isBreachState ? 'ALERT OVERRIDE' : 'LOCKED // 30.0 FPS'}</div>
      </div>
    `;

    const stageEl = hostEl.querySelector('#lv-stage');
    noiseCanvas = hostEl.querySelector('.lv-noise-canvas');
    noiseCtx = noiseCanvas ? noiseCanvas.getContext('2d') : null;
    tsEl = hostEl.querySelector('.lv-timestamp');
    sigEl = hostEl.querySelector('[data-lv-signal]');

    const childFactory = registry.get(scp.id) || createStandbyModule;
    const context = {
      scp,
      hostEl,
      clearance: bridge ? bridge.getClearance() : 1,
      isBreach: isBreachState,
      sound: window.SoundEngine,
      updateEnvMetric: bridge ? bridge.updateEnvMetric : () => {},
      setSpecialStatus: bridge ? bridge.setSpecialStatus : () => {},
      clearSpecialStatus: bridge && bridge.clearSpecialStatus ? bridge.clearSpecialStatus : () => {},
      triggerHumeSpike: bridge ? bridge.triggerHumeSpike : () => {},
      setHumeOffset: bridge ? bridge.setHumeOffset : () => {},
      pushLog: bridge ? bridge.pushLog : () => {},
      setBreach: bridge ? bridge.setBreach : () => {},
      denyAccess: bridge && bridge.denyAccess ? bridge.denyAccess : () => {},
      setClearance: bridge && bridge.setClearance ? bridge.setClearance : () => {}
    };

    activeChild = childFactory(stageEl, context) || null;
    isConsoleMode = hostEl.classList.contains('has-console-layout');
    if (isConsoleMode) {
      const camIdEl = hostEl.querySelector('.lv-cam-id');
      if (camIdEl) camIdEl.textContent = `CONSOLE // ${cellId}`;
      if (sigEl) {
        sigEl.textContent = isBreachState ? 'SYS: LOCKDOWN ACTIVE' : 'SYS: CLOCKWORK SYNC';
      }
    } else {
      drawProceduralNoise();
    }
    startOverlayLoop();
  }

  function registerModule(scpId, factory) {
    if (scpId && typeof factory === 'function') {
      registry.set(scpId, factory);
    }
  }

  function setBreach(active) {
    isBreachState = Boolean(active);
    if (activeHost) {
      activeHost.dataset.breach = isBreachState ? 'true' : 'false';
    }
    if (sigEl) {
      sigEl.textContent = isConsoleMode
        ? (isBreachState ? 'SYS: LOCKDOWN ACTIVE' : 'SYS: CLOCKWORK SYNC')
        : (isBreachState ? 'SIG: ALERT OVERRIDE' : 'SIG: LOCKED // 30.0 FPS');
    }
    if (activeChild && typeof activeChild.onBreachChange === 'function') {
      try {
        activeChild.onBreachChange(isBreachState);
      } catch (_) {}
    }
  }

  function setClearance(level) {
    if (activeChild && typeof activeChild.onClearanceChange === 'function') {
      try {
        activeChild.onClearanceChange(level);
      } catch (_) {}
    }
  }

  window.LiveViewport = {
    registerModule,
    mount,
    unmount,
    setBreach,
    setClearance,
    getActiveScpId: () => (activeScp ? activeScp.id : null),
    getBridge: () => activeBridge
  };
})();
