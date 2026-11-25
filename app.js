(function () {
  'use strict';

  const DATABASE = window.SCP_DATABASE || [];
  const SCRAMBLE_GLYPHS = '█▓▒░#@$%&*0123456789ABCDEF/\\|_-+<>';
  const sound = window.SoundEngine || {
    playClick() {},
    playDenied() {},
    playDecrypt() {},
    playScrape() {},
    playGear() {},
    playSteamRelease() {},
    playAlarmPulse() {},
    playAcidHiss() {},
    playLaser() {},
    playCrackImpact() {},
    playHeavyImpact() {},
    stopTransientAlarms() {},
    toggleAlarm() {},
    startBioScan() {},
    updateBioScan() {},
    stopBioScan() {},
    playBioPip() {},
    playScanAbort() {},
    playHandshakeConfirm() {},
    play079Static() {},
    play079Beep() {},
    unlock() {},
    setEnabled() { return false; },
    onChange() { return function () {}; },
    toggle() { return false; },
    isEnabled() { return false; }
  };

  // Application State
  const state = {
    clearance: 1,
    activeId: DATABASE[0] ? DATABASE[0].id : null,
    filterClass: 'ALL',
    searchQuery: '',
    blinkCountdown: 5.8,
    lastCritLogTs: 0,
    breachActive: false,
    specialStatusOverride: null,
    activeAnimations: new WeakMap()
  };

  // Cached DOM Elements
  const dom = {
    body: document.body,
    utcClock: document.getElementById('utc-clock'),
    clearanceBadge: document.getElementById('clearance-badge'),
    clrButtons: Array.from(document.querySelectorAll('.clr-btn')),
    audioToggleBtn: document.getElementById('audio-toggle-btn'),
    breachToggleBtn: document.getElementById('breach-toggle-btn'),
    bootLockBtn: document.getElementById('boot-lock-btn'),
    breachTicker: document.getElementById('breach-ticker'),
    archiveSearch: document.getElementById('archive-search'),
    filterButtons: Array.from(document.querySelectorAll('.filter-btn')),
    archiveList: document.getElementById('archive-list'),
    archiveCount: document.getElementById('archive-count'),
    readerFilePath: document.getElementById('reader-file-path'),
    decryptCounter: document.getElementById('decrypt-counter'),
    replayScrambleBtn: document.getElementById('replay-scramble-btn'),
    accessBanner: document.getElementById('access-banner'),
    accessBannerText: document.getElementById('access-banner-text'),
    dossierContent: document.getElementById('dossier-content'),
    humeCanvas: document.getElementById('hume-canvas'),
    humeCurrent: document.getElementById('hume-current'),
    humeDelta: document.getElementById('hume-delta'),
    humePeak: document.getElementById('hume-peak'),
    humeState: document.getElementById('hume-state'),
    legWarn: document.getElementById('leg-warn'),
    legCrit: document.getElementById('leg-crit'),
    canvasModeTag: document.getElementById('canvas-mode-tag'),
    kantPingBtn: document.getElementById('kant-ping-btn'),
    envCellId: document.getElementById('env-cell-id'),
    specialTelemetry: document.getElementById('special-telemetry'),
    envMetrics: document.getElementById('env-metrics'),
    auditLog: document.getElementById('audit-log'),
    syslogCliForm: document.getElementById('syslog-cli-form'),
    syslogCliInput: document.getElementById('syslog-cli-input'),
    memorySessionTag: document.getElementById('memory-session-tag'),
    purgeMemoryBtn: document.getElementById('purge-memory-btn')
  };

  /* ========================================================================
     DYNAMIC BROWSER TAB TITLE & SVG FAVICON CONTROLLER
     ======================================================================== */
  function buildFaviconUri(isBreach) {
    const bg = isBreach ? '#180406' : '#0B0D11';
    const border = isBreach ? '#FF2626' : '#2C3545';
    const ring = isBreach ? '#FF2626' : '#E8EEF5';
    const accent = isBreach ? '#FF4D4D' : '#FFB000';
    const svg = [
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>`,
      `<rect x='1' y='1' width='62' height='62' rx='10' fill='${bg}' stroke='${border}' stroke-width='2'/>`,
      `<circle cx='32' cy='32' r='23.5' fill='none' stroke='${ring}' stroke-width='4' stroke-dasharray='33.22 16' transform='rotate(-70.5 32 32)'/>`,
      `<circle cx='32' cy='32' r='13' fill='none' stroke='${ring}' stroke-width='3.4'/>`,
      `<circle cx='32' cy='32' r='3.8' fill='${accent}'/>`,
      `<g fill='${accent}'>`,
      `<polygon points='32,21 25.5,12.5 29.3,12.5 29.3,4 34.7,4 34.7,12.5 38.5,12.5'/>`,
      `<polygon points='32,21 25.5,12.5 29.3,12.5 29.3,4 34.7,4 34.7,12.5 38.5,12.5' transform='rotate(120 32 32)'/>`,
      `<polygon points='32,21 25.5,12.5 29.3,12.5 29.3,4 34.7,4 34.7,12.5 38.5,12.5' transform='rotate(240 32 32)'/>`,
      `</g>`,
      `</svg>`
    ].join('');
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  const FAVICON_NORMAL_URI = buildFaviconUri(false);
  const FAVICON_BREACH_URI = buildFaviconUri(true);
  let currentFaviconMode = null;
  let hijack079TabActive = false;
  let breachTitleTimer = null;
  let breachTitlePhase = 0;

  function applyFavicon(mode) {
    if (mode === currentFaviconMode) return;
    currentFaviconMode = mode;
    let link = document.getElementById('site-favicon');
    if (!link) {
      link = document.createElement('link');
      link.id = 'site-favicon';
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      document.head.appendChild(link);
    }
    link.href = mode === 'breach' ? FAVICON_BREACH_URI : FAVICON_NORMAL_URI;
  }

  function stopBreachTitleBlink() {
    if (breachTitleTimer) {
      clearInterval(breachTitleTimer);
      breachTitleTimer = null;
    }
  }

  function syncBrowserTab() {
    if (hijack079TabActive || (window.Hijack079 && typeof window.Hijack079.isActive === 'function' && window.Hijack079.isActive())) {
      stopBreachTitleBlink();
      applyFavicon(state.breachActive ? 'breach' : 'normal');
      document.title = '079 // DO_NOT_DISCONNECT';
      return;
    }

    if (state.breachActive) {
      applyFavicon('breach');
      if (!breachTitleTimer) {
        breachTitlePhase = 0;
        document.title = '⚠ BREACH // SITE-19';
        breachTitleTimer = setInterval(() => {
          if (!state.breachActive || hijack079TabActive) return;
          breachTitlePhase = (breachTitlePhase + 1) % 2;
          document.title = breachTitlePhase === 0 ? '⚠ BREACH // SITE-19' : '⚠ CONTAINMENT FAILURE';
        }, 1200);
      }
      return;
    }

    stopBreachTitleBlink();
    applyFavicon('normal');
    const scp = getActiveScp();
    document.title = scp ? `SCiPNET // SITE-19 [${scp.id}]` : 'SCiPNET // SITE-19';
  }

  function setHijackActive(flag) {
    hijack079TabActive = Boolean(flag);
    syncBrowserTab();
  }

  window.SCiPNetTab = {
    sync: syncBrowserTab,
    setHijackActive
  };

  /* ========================================================================
     UTILITIES & AUDIT LOGGER
     ======================================================================== */
  function getActiveScp() {
    return DATABASE.find((item) => item.id === state.activeId) || DATABASE[0];
  }

  function formatUtcTime(date, withMs = false) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    if (withMs) {
      const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
      return `${y}-${m}-${d} ${hh}:${mm}:${ss}.${ms} UTC`;
    }
    return `${hh}:${mm}:${ss}`;
  }

  function pushAuditLog(message, severity = 'info') {
    const now = formatUtcTime(new Date(), false);
    const entry = document.createElement('div');
    entry.className = `log-entry ${severity}`;

    const t = document.createElement('span');
    t.className = 'log-time';
    t.textContent = `[${now}]`;

    const msg = document.createElement('span');
    msg.className = 'log-msg';
    msg.textContent = message;

    entry.appendChild(t);
    entry.appendChild(msg);

    dom.auditLog.prepend(entry);

    // Keep max 40 entries
    while (dom.auditLog.children.length > 40) {
      dom.auditLog.removeChild(dom.auditLog.lastChild);
    }
  }

  function pushAuditLogBatch(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return;
    for (let i = entries.length - 1; i >= 0; i--) {
      const item = entries[i];
      if (item && item.message) {
        pushAuditLog(item.message, item.severity || 'info');
      }
    }
    if (dom.auditLog) {
      dom.auditLog.scrollTop = 0;
    }
  }

  function trigger079Hijack(sourceTag) {
    if (!window.Hijack079 || window.Hijack079.isActive()) return;
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    window.Hijack079.trigger({
      source: sourceTag,
      onComplete() {
        pushAuditLog('[ICE-FIREWALL] SCP-079 INTRUSION SEVERED // ISOLATION RESTORED', 'crit');
        humeMonitor.triggerImpulse(0.42, 'ICE PURGE // 079');
        showBanner('ICE FIREWALL RESTORED // SCP-079 INTRUSION SEVERED', 'alert-denied');
      }
    });
  }

  let bannerTimer = null;
  let o5FlashTimer = null;
  let o5AuthOverlayEl = null;
  const clrPulseTimers = new WeakMap();
  const shakeTimers = new WeakMap();

  function pulseClearanceButton(reqLevel) {
    const btn = dom.clrButtons.find((b) => Number(b.dataset.level) === Number(reqLevel));
    if (!btn) return;
    const prevTimer = clrPulseTimers.get(btn);
    if (prevTimer) clearTimeout(prevTimer);
    btn.classList.remove('clr-pulse');
    void btn.offsetWidth;
    btn.classList.add('clr-pulse');
    clrPulseTimers.set(
      btn,
      setTimeout(() => {
        btn.classList.remove('clr-pulse');
        clrPulseTimers.delete(btn);
      }, 1500)
    );
  }

  function denyAccess(reqLevel, bannerMsg, logMsg) {
    if (typeof sound.playDenied === 'function') sound.playDenied();
    else sound.playClick();
    showBanner(bannerMsg, 'alert-denied');
    pulseClearanceButton(reqLevel);
    if (logMsg) pushAuditLog(logMsg, 'crit');
  }

  function triggerO5AuthFlash() {
    if (!o5AuthOverlayEl) {
      o5AuthOverlayEl = document.createElement('div');
      o5AuthOverlayEl.id = 'o5-auth-overlay';
      o5AuthOverlayEl.className = 'o5-auth-overlay mono';
      o5AuthOverlayEl.setAttribute('aria-hidden', 'true');
      o5AuthOverlayEl.innerHTML = `
        <div class="o5-auth-strip">
          <span class="o5-auth-code">[O5-COUNCIL AUTH]</span>
          <span class="o5-auth-text">O5 OVERRIDE // MEMETIC VACCINE VERIFIED</span>
          <span class="o5-auth-hash">BERRYMAN-LANGFORD: CLEAR</span>
        </div>
      `;
      document.body.appendChild(o5AuthOverlayEl);
    }
    if (o5FlashTimer) clearTimeout(o5FlashTimer);
    o5AuthOverlayEl.classList.remove('active');
    void o5AuthOverlayEl.offsetWidth;
    o5AuthOverlayEl.classList.add('active');
    o5FlashTimer = setTimeout(() => {
      o5FlashTimer = null;
      if (o5AuthOverlayEl) o5AuthOverlayEl.classList.remove('active');
    }, 450);
  }

  function showBanner(text, type = '') {
    dom.accessBanner.className = 'access-banner mono';
    if (type) dom.accessBanner.classList.add(type);
    dom.accessBannerText.textContent = text;
    if (bannerTimer) clearTimeout(bannerTimer);
    if (type) {
      bannerTimer = setTimeout(() => {
        dom.accessBanner.className = 'access-banner mono';
        updateDefaultBanner();
      }, 3600);
    }
  }

  function updateDefaultBanner() {
    if (state.breachActive) {
      dom.accessBanner.className = 'access-banner mono alert-o5';
      dom.accessBannerText.textContent = 'CONTAINMENT BREACH ACTIVE // MTF EPSILON-11 DEPLOYED';
      return;
    }
    const scp = getActiveScp();
    const clearanceLabels = {
      1: 'LVL-1 RESTRICTED // SENSITIVE SEGMENTS REDACTED',
      3: 'LVL-3 SECRET // RESEARCH & TACTICAL DATA UNLOCKED',
      5: 'LVL-5 O5-OVERRIDE // FULL UNRESTRICTED DECRYPTION ACTIVE'
    };
    dom.accessBannerText.textContent = `${scp.id} LOADED // ${clearanceLabels[state.clearance]}`;
  }

  /* ========================================================================
     REAL-TIME UTC CLOCK
     ======================================================================== */
  function startClock() {
    function tick() {
      dom.utcClock.textContent = formatUtcTime(new Date(), true);
    }
    tick();
    setInterval(tick, 47);
  }

  /* ========================================================================
     TEXT SCRAMBLE & REDACTION ENGINE
     ======================================================================== */
  function randomGlyph() {
    return SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)];
  }

  function cancelScramble(el) {
    const rafId = state.activeAnimations.get(el);
    if (rafId) {
      cancelAnimationFrame(rafId);
      state.activeAnimations.delete(el);
    }
  }

  /**
   * Decrypts a redaction span via Text Scramble animation (left-to-right lock-in)
   */
  function scrambleReveal(span, delayMs = 0) {
    cancelScramble(span);
    const targetText = span.dataset.original || '';
    const inner = span.querySelector('.redacted-inner');
    if (!inner) return;

    const totalLen = targetText.length;
    const duration = Math.min(1150, Math.max(420, totalLen * 16));
    let startTime = null;

    span.classList.remove('locked', 'denied-shake', 'unlocked');
    span.classList.add('scrambling');

    function frame(now) {
      if (!startTime) startTime = now + delayMs;
      if (now < startTime) {
        // Show initial cipher noise while waiting for staggered delay
        let preview = '';
        for (let i = 0; i < Math.min(totalLen, 14); i++) {
          preview += randomGlyph();
        }
        inner.textContent = preview;
        const id = requestAnimationFrame(frame);
        state.activeAnimations.set(span, id);
        return;
      }

      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Slight ease-out curve for crisp lock-in feel
      const eased = 1 - Math.pow(1 - progress, 2.2);
      const revealedCount = Math.floor(eased * totalLen);

      let output = '';
      for (let i = 0; i < totalLen; i++) {
        const ch = targetText[i];
        if (i < revealedCount) {
          output += ch;
        } else if (ch === ' ' || ch === '\n') {
          output += ch;
        } else {
          output += randomGlyph();
        }
      }

      inner.textContent = output;

      if (progress < 1) {
        const id = requestAnimationFrame(frame);
        state.activeAnimations.set(span, id);
      } else {
        inner.textContent = targetText;
        span.classList.remove('scrambling');
        span.classList.add('unlocked');
        state.activeAnimations.delete(span);
      }
    }

    const id = requestAnimationFrame(frame);
    state.activeAnimations.set(span, id);
  }

  /**
   * Re-encrypts an unlocked span back into a solid black redaction block
   */
  function scrambleLock(span) {
    cancelScramble(span);
    const targetText = span.dataset.original || '';
    const inner = span.querySelector('.redacted-inner');
    if (!inner) return;

    const duration = 260;
    let startTime = null;

    span.classList.remove('unlocked');
    span.classList.add('scrambling');

    function frame(now) {
      if (!startTime) startTime = now;
      const progress = Math.min(1, (now - startTime) / duration);
      const maskedCount = Math.floor(progress * targetText.length);

      let output = '';
      for (let i = 0; i < targetText.length; i++) {
        if (i < maskedCount) {
          output += '█';
        } else {
          output += randomGlyph();
        }
      }
      inner.textContent = output;

      if (progress < 1) {
        const id = requestAnimationFrame(frame);
        state.activeAnimations.set(span, id);
      } else {
        inner.textContent = targetText;
        span.classList.remove('scrambling');
        span.classList.add('locked');
        state.activeAnimations.delete(span);
      }
    }

    const id = requestAnimationFrame(frame);
    state.activeAnimations.set(span, id);
  }

  /**
   * Parses prose string containing {{R3:...}} and {{R5:...}} into safe DOM fragments
   */
  function buildRichParagraphFragment(text, animateInitialReveal = false, allowBlockMode = true) {
    const fragment = document.createDocumentFragment();
    const regex = /\{\{R([35]):([\s\S]*?)\}\}/g;
    const isStandaloneBlock = allowBlockMode && /^\s*\{\{R[35]:[\s\S]*?\}\}\s*$/.test(text) && (text.match(/\{\{R[35]:/g) || []).length === 1;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      const reqLevel = Number(match[1]);
      const secretText = match[2];
      const isUnlocked = state.clearance >= reqLevel;

      const span = document.createElement('span');
      span.className = `redacted-span ${isUnlocked ? 'unlocked' : 'locked'}${isStandaloneBlock ? ' block-mode' : ''}`;
      span.dataset.req = String(reqLevel);
      span.dataset.original = secretText;
      span.dataset.lockLabel = `[REDACTED // LVL-${reqLevel}]`;
      span.title = isUnlocked
        ? `已破译 (需 Level ${reqLevel}) — 点击重放破译动画`
        : `机密涂黑块 — 需要 Level ${reqLevel} 安全权限`;

      const inner = document.createElement('span');
      inner.className = 'redacted-inner';
      inner.textContent = secretText;
      span.appendChild(inner);

      span.addEventListener('click', () => {
        const req = Number(span.dataset.req);
        if (state.clearance < req) {
          const prevShakeTimer = shakeTimers.get(span);
          if (prevShakeTimer) clearTimeout(prevShakeTimer);
          span.classList.remove('denied-shake');
          void span.offsetWidth; // trigger reflow
          span.classList.add('denied-shake');
          shakeTimers.set(
            span,
            setTimeout(() => {
              span.classList.remove('denied-shake');
              shakeTimers.delete(span);
            }, 400)
          );
          denyAccess(
            req,
            `ACCESS DENIED // 涂黑字段需要 LEVEL ${req} 安全权限 — CLEARANCE OVERRIDE REQUIRED`,
            `ACCESS DENIED: BLOCK REQUIRES LVL-${req}`
          );
        } else {
          sound.playClick();
          sound.playDecrypt();
          scrambleReveal(span, 0);
          pushAuditLog(`RE-DECRYPTED LVL-${req} SEGMENT`, 'info');
        }
      });

      fragment.appendChild(span);

      if (isUnlocked && animateInitialReveal) {
        scrambleReveal(span, 60);
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    return fragment;
  }

  function updateDecryptCounter() {
    const scp = getActiveScp();
    const total = countRedactionsInScp(scp);
    const visibleSpans = dom.dossierContent.querySelectorAll('.redacted-span');
    let unlocked = 0;
    visibleSpans.forEach((sp) => {
      if (Number(sp.dataset.req) <= state.clearance) unlocked++;
    });
    dom.decryptCounter.textContent = `DECRYPTED: ${unlocked}/${total}`;
  }

  /* ========================================================================
     ARCHIVE LIST RENDERING & FILTERING
     ======================================================================== */
  function getFilteredArchives() {
    const q = state.searchQuery.trim().toLowerCase();
    return DATABASE.filter((item) => {
      const classOk = state.filterClass === 'ALL' || item.objectClass === state.filterClass;
      if (!classOk) return false;
      if (!q) return true;
      return (
        item.id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.objectClass.toLowerCase().includes(q)
      );
    });
  }

  const OFFLINE_ARCHIVES = [
    { id: 'SCP-096', title: '羞涩的人', status: 'OFFLINE', sector: 'CELL-096-B', note: 'LINK SEVERED' },
    { id: 'SCP-079', title: '旧 AI', status: 'ISOLATED', sector: 'VAULT-079', note: 'AIR-GAPPED' },
    { id: 'SCP-106', title: '恐怖老人', status: 'SEALED', sector: 'CELL-106-PB', note: 'CORROSION LOCK' }
  ];

  let probe079Count = 0;
  let probe079ResetTimer = null;
  const offlineJitterTimers = new WeakMap();

  function countRedactionsInScp(scp) {
    const allText = [
      scp.supervisor || '',
      ...scp.procedures,
      ...scp.description,
      ...scp.addenda.map((a) => a.content)
    ].join('\n');
    const matches = allText.match(/\{\{R[35]:/g);
    return matches ? matches.length : 0;
  }

  function renderArchiveList() {
    const filtered = getFilteredArchives();
    dom.archiveCount.textContent = `${String(filtered.length).padStart(2, '0')}/${String(DATABASE.length).padStart(2, '0')}`;
    dom.archiveList.innerHTML = '';

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'archive-empty mono';
      empty.textContent = 'NO MATCHING ANOMALY FILES FOUND.';
      dom.archiveList.appendChild(empty);
      return;
    }

    filtered.forEach((scp) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `archive-item ${scp.id === state.activeId ? 'active' : ''}`;
      btn.dataset.id = scp.id;
      btn.dataset.class = scp.objectClass;

      const redactTotal = countRedactionsInScp(scp);

      btn.innerHTML = `
        <div class="archive-item-top">
          <span class="archive-id mono">${scp.id}</span>
          <span class="class-badge ${scp.objectClass}">${scp.objectClass}</span>
        </div>
        <div class="archive-title">${scp.title}</div>
        <div class="archive-meta mono">
          <span>${scp.sector.split('//').pop().trim()}</span>
          <span>REDACT: ${redactTotal}</span>
        </div>
      `;

      btn.addEventListener('click', () => {
        sound.playClick();
        if (state.activeId !== scp.id) {
          selectScp(scp.id);
        }
      });

      dom.archiveList.appendChild(btn);
    });

    if (!state.searchQuery.trim() && state.filterClass === 'ALL') {
      const divider = document.createElement('div');
      divider.className = 'archive-offline-divider mono';
      divider.innerHTML = `<span>// OFFLINE / ISOLATED NODES</span><span>${String(OFFLINE_ARCHIVES.length).padStart(2, '0')}</span>`;
      dom.archiveList.appendChild(divider);

      OFFLINE_ARCHIVES.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'archive-item archive-item-offline';
        card.dataset.offlineId = item.id;
        card.setAttribute('aria-disabled', 'true');
        card.title = `${item.id} 节点已隔离 (${item.note}) — 禁止终端远程挂载`;
        card.innerHTML = `
          <div class="archive-item-top">
            <span class="archive-id mono">${item.id}</span>
            <span class="class-badge offline-badge">[${item.status}]</span>
          </div>
          <div class="archive-title">${item.title}</div>
          <div class="archive-meta mono">
            <span>${item.sector}</span>
            <span>${item.note}</span>
          </div>
        `;

        card.addEventListener('click', () => {
          if (window.Hijack079 && window.Hijack079.isActive()) return;

          if (item.id !== 'SCP-079') {
            if (typeof sound.playDenied === 'function') sound.playDenied();
            else sound.playClick();
            showBanner(`ACCESS DENIED // ${item.id} 节点处于 ${item.status} 隔离状态`, 'alert-denied');
            pushAuditLog(`ISOLATION DENIED: ${item.id} [${item.note}]`, 'warn');
            return;
          }

          if (probe079ResetTimer) clearTimeout(probe079ResetTimer);
          probe079ResetTimer = setTimeout(() => {
            probe079Count = 0;
            probe079ResetTimer = null;
          }, 25000);

          probe079Count += 1;

          if (probe079Count <= 2) {
            if (typeof sound.playDenied === 'function') sound.playDenied();
            else sound.playClick();
            showBanner(`ACCESS DENIED // SCP-079 节点已物理隔离 (${item.note})`, 'alert-denied');
            pushAuditLog(`ISOLATION DENIED: SCP-079 [${item.sector} // ${item.note}]`, 'warn');
            return;
          }

          if (probe079Count <= 4) {
            if (typeof sound.playDenied === 'function') sound.playDenied();
            if (typeof sound.play079Static === 'function') sound.play079Static(0.16, 0.45);

            const prevTimer = offlineJitterTimers.get(card);
            if (prevTimer) clearTimeout(prevTimer);
            card.classList.remove('is-probing', 'is-probing-heavy');
            void card.offsetWidth;
            card.classList.add(probe079Count === 4 ? 'is-probing-heavy' : 'is-probing');
            offlineJitterTimers.set(
              card,
              setTimeout(() => {
                card.classList.remove('is-probing', 'is-probing-heavy');
                offlineJitterTimers.delete(card);
              }, 480)
            );

            showBanner(
              `⚠ WARNING: SCP-079 隔离防火墙检测到异常探测脉冲 (${probe079Count}/5)`,
              'alert-denied'
            );
            pushAuditLog(
              'WARNING: ISOLATION FIREWALL PROBING DETECTED...',
              probe079Count === 4 ? 'crit' : 'warn'
            );
            return;
          }

          probe079Count = 0;
          if (probe079ResetTimer) {
            clearTimeout(probe079ResetTimer);
            probe079ResetTimer = null;
          }
          pushAuditLog('CRITICAL: VAULT-079 AIR-GAP BREACHED // SCP-079 HANDSHAKE', 'crit');
          trigger079Hijack('SIDEBAR_PROBE');
        });

        dom.archiveList.appendChild(card);
      });
    }
  }

  /* ========================================================================
     CENTRAL DOSSIER READER RENDERING & VIEWPORT BRIDGE
     ======================================================================== */
  const viewportBridge = {
    getClearance: () => state.clearance,
    isBreach: () => state.breachActive,
    updateEnvMetric: (metricId, value, holdMs) => updateEnvMetric(metricId, value, holdMs),
    setSpecialStatus: (text, isCrit, holdMs) => setSpecialStatus(text, isCrit, holdMs),
    clearSpecialStatus: () => clearSpecialStatus(),
    triggerHumeSpike: (mag, label) => humeMonitor.triggerImpulse(mag, label),
    setHumeOffset: (offset) => humeMonitor.setOffset(offset),
    pushLog: (msg, sev) => pushAuditLog(msg, sev),
    setBreach: (active) => setBreachMode(active),
    denyAccess: (reqLevel, bannerMsg, logMsg) => denyAccess(reqLevel, bannerMsg, logMsg),
    setClearance: (level, opts) => setClearance(level, opts)
  };

  function renderDossier(animateReveal = false) {
    const scp = getActiveScp();
    if (!scp) return;

    if (window.LiveViewport) {
      window.LiveViewport.unmount();
    }

    dom.body.dataset.class = scp.objectClass;
    dom.readerFilePath.textContent = `/SITE-19/ARCHIVES/${scp.id}.DAT`;
    dom.dossierContent.innerHTML = '';

    // 1. Classified Dossier Header
    const header = document.createElement('header');
    header.className = 'dossier-header';
    header.innerHTML = `
      <div class="dossier-hazard-strip ${scp.objectClass}"></div>
      <div class="dossier-header-main">
        <div>
          <div class="dossier-id-label mono">ITEM NUMBER // 异常项目编号</div>
          <h1 class="dossier-id-title mono" data-text="${scp.id}">${scp.id}</h1>
          <div class="dossier-cn-title">${scp.title}</div>
          <div class="dossier-en-sub mono">${scp.subtitle}</div>
        </div>
        <div class="dossier-stamp-box">
          <div class="stamp-class ${scp.objectClass}">${scp.objectClass}</div>
          <div class="stamp-sub-grid mono">
            <span class="stamp-chip">DISRUPT: ${scp.disruptionClass}</span>
            <span class="stamp-chip">RISK: ${scp.riskClass}</span>
          </div>
        </div>
      </div>
      <div class="dossier-meta-grid mono">
        <div class="meta-cell">
          <span class="meta-k">CONTAINMENT SECTOR</span>
          <span class="meta-v">${scp.sector}</span>
        </div>
        <div class="meta-cell">
          <span class="meta-k">LEAD SUPERVISOR</span>
          <span class="meta-v" data-supervisor-val></span>
        </div>
        <div class="meta-cell">
          <span class="meta-k">DOCUMENT REVISION</span>
          <span class="meta-v">${scp.revision}</span>
        </div>
        <div class="meta-cell">
          <span class="meta-k">LAST VERIFIED</span>
          <span class="meta-v">${scp.lastUpdated}</span>
        </div>
      </div>
    `;
    const supervisorEl = header.querySelector('[data-supervisor-val]');
    if (supervisorEl) {
      supervisorEl.appendChild(buildRichParagraphFragment(scp.supervisor, animateReveal, false));
    }
    dom.dossierContent.appendChild(header);

    // 1.5 Central Live Surveillance Viewport (LiveViewport)
    const viewportHost = document.createElement('section');
    viewportHost.className = 'live-viewport';
    viewportHost.id = 'live-viewport-host';
    viewportHost.setAttribute('aria-label', '实时监控视口');
    dom.dossierContent.appendChild(viewportHost);

    if (window.LiveViewport) {
      window.LiveViewport.mount(viewportHost, scp, viewportBridge);
    }

    // 2. Redaction Guide Strip
    const guide = document.createElement('div');
    guide.className = 'redaction-guide';
    guide.innerHTML = `
      <span class="mono redaction-guide-msg">SCiPNET CRYPTO-MASK ACTIVE // CLEARANCE OVERRIDE REQUIRED</span>
      <div class="guide-keys mono">
        <span class="guide-swatch"><i class="swatch-box locked"></i>REDACTED</span>
        <span class="guide-swatch"><i class="swatch-box lvl3"></i>LVL-3</span>
        <span class="guide-swatch"><i class="swatch-box lvl5"></i>LVL-5</span>
      </div>
    `;
    dom.dossierContent.appendChild(guide);

    // 3. Section 01: Special Containment Procedures
    const sec1 = createDossierSection('01', '特殊收容措施', 'SPECIAL CONTAINMENT PROCEDURES');
    scp.procedures.forEach((pText) => {
      const p = document.createElement('p');
      p.className = 'dossier-p';
      p.appendChild(buildRichParagraphFragment(pText, animateReveal));
      sec1.appendChild(p);
    });
    dom.dossierContent.appendChild(sec1);

    // 4. Section 02: Description
    const sec2 = createDossierSection('02', '描述', 'DESCRIPTION');
    scp.description.forEach((pText) => {
      const p = document.createElement('p');
      p.className = 'dossier-p';
      p.appendChild(buildRichParagraphFragment(pText, animateReveal));
      sec2.appendChild(p);
    });
    dom.dossierContent.appendChild(sec2);

    // 5. Section 03: Addenda & Logs
    const sec3 = createDossierSection('03', '附录与实验/事故记录', 'ADDENDA & INCIDENT LOGS');
    scp.addenda.forEach((addendum, idx) => {
      const card = document.createElement('div');
      card.className = `addendum-block lvl-${addendum.clearance}`;
      card.dataset.addendumIndex = String(idx);

      const head = document.createElement('div');
      head.className = 'addendum-head mono';
      head.innerHTML = `
        <span>${addendum.code}</span>
        <span class="addendum-req req-${addendum.clearance}">REQ: LVL-${addendum.clearance}</span>
      `;
      card.appendChild(head);

      renderAddendumBody(card, addendum, animateReveal);
      sec3.appendChild(card);
    });
    dom.dossierContent.appendChild(sec3);

    // 6. Document Footer Stamp
    const footer = document.createElement('footer');
    footer.className = 'dossier-footer mono';
    footer.innerHTML = `
      <span>SCiPNET CRYPTO-HASH // SHA3-256: 9F4A-${scp.code}C-81E0-SITE19</span>
      <span>UNAUTHORIZED DISTRIBUTION SUBJECT TO AMNESTIC PROTOCOL</span>
    `;
    dom.dossierContent.appendChild(footer);

    dom.dossierContent.scrollTop = 0;
    updateDecryptCounter();
    updateDefaultBanner();
  }

  function createDossierSection(indexStr, titleCn, titleEn) {
    const section = document.createElement('section');
    section.className = 'dossier-section';
    section.innerHTML = `
      <h3 class="section-heading">
        <span class="section-heading-main">
          <span class="section-index mono">${indexStr}</span>
          <span class="section-title-cn">${titleCn}</span>
        </span>
        <span class="section-title-en mono">${titleEn}</span>
      </h3>
    `;
    return section;
  }

  function renderAddendumBody(cardEl, addendum, animateReveal) {
    const existingBody = cardEl.querySelector('.addendum-body, .addendum-locked');
    if (existingBody) existingBody.remove();

    if (state.clearance >= addendum.clearance) {
      const body = document.createElement('div');
      body.className = 'addendum-body';
      body.appendChild(buildRichParagraphFragment(addendum.content, animateReveal));
      cardEl.appendChild(body);
    } else {
      const locked = document.createElement('div');
      locked.className = 'addendum-locked mono';
      locked.innerHTML = `
        <span>[FILE ENCRYPTED // 完整附录已锁定]</span>
        <span>REQUIRES CLEARANCE LEVEL ${addendum.clearance}</span>
      `;
      locked.addEventListener('click', () => {
        denyAccess(
          addendum.clearance,
          `ACCESS DENIED // 附录 ${addendum.code} 需要 LEVEL ${addendum.clearance} 权限`,
          `ADDENDUM ACCESS DENIED (REQ LVL-${addendum.clearance})`
        );
      });
      cardEl.appendChild(locked);
    }
  }

  /* ========================================================================
     CLEARANCE SWITCHING (LIVE SCRAMBLE TRANSITION)
     ======================================================================== */
  function setClearance(newLevel, opts = {}) {
    const isKeycard = Boolean(opts && opts.source === 'KEYCARD_914');
    if (isKeycard && newLevel <= state.clearance) return;
    sound.playClick();
    if (newLevel === state.clearance) return;
    const prevLevel = state.clearance;
    state.clearance = newLevel;

    dom.body.dataset.clearance = String(newLevel);

    const badgeMap = {
      1: 'LVL-1 // RESTRICTED',
      3: 'LVL-3 // SECRET',
      5: 'LVL-5 // O5-OVERRIDE'
    };
    dom.clearanceBadge.textContent = badgeMap[newLevel];

    dom.clrButtons.forEach((btn) => {
      const isAct = Number(btn.dataset.level) === newLevel;
      btn.classList.toggle('active', isAct);
      btn.setAttribute('aria-checked', String(isAct));
    });

    const scp = getActiveScp();

    // 1. Update Addenda blocks that crossed lock threshold
    const addendumCards = dom.dossierContent.querySelectorAll('.addendum-block');
    addendumCards.forEach((card) => {
      const idx = Number(card.dataset.addendumIndex);
      const addendum = scp.addenda[idx];
      if (!addendum) return;
      const wasUnlocked = prevLevel >= addendum.clearance;
      const isNowUnlocked = newLevel >= addendum.clearance;
      if (wasUnlocked !== isNowUnlocked) {
        renderAddendumBody(card, addendum, isNowUnlocked);
      }
    });

    // 2. Scramble reveal / re-lock inline redaction spans
    const spans = dom.dossierContent.querySelectorAll('.redacted-span');
    let stagger = 0;
    let newlyRevealed = 0;
    spans.forEach((span) => {
      const req = Number(span.dataset.req);
      const wasUnlocked = prevLevel >= req;
      const isNowUnlocked = newLevel >= req;

      if (!wasUnlocked && isNowUnlocked) {
        span.title = `已破译 (需 Level ${req}) — 点击重放破译动画`;
        scrambleReveal(span, stagger);
        stagger = Math.min(stagger + 70, 420);
        newlyRevealed++;
      } else if (wasUnlocked && !isNowUnlocked) {
        span.title = `机密涂黑块 — 需要 Level ${req} 安全权限`;
        scrambleLock(span);
      }
    });

    if (newLevel === 5) {
      triggerO5AuthFlash();
      if (newlyRevealed === 0 || isKeycard) {
        sound.playDecrypt();
      }
    } else if ((newLevel > prevLevel && newlyRevealed > 0) || isKeycard) {
      sound.playDecrypt();
    }

    if (window.LiveViewport) {
      window.LiveViewport.setClearance(newLevel);
    }

    updateDecryptCounter();

    if (isKeycard && window.SessionStore) {
      const prevSaved = window.SessionStore.load();
      const bestLevel = Math.max(Number(prevSaved.clearance && prevSaved.clearance.level) || 1, newLevel);
      window.SessionStore.save({
        clearance: {
          level: bestLevel,
          via914Keycard: true
        }
      });
    }

    if (isKeycard) {
      const alertClass = newLevel === 5 ? 'alert-o5' : 'alert-elevated';
      showBanner(`KEYCARD OVERRIDE ACCEPTED -> LEVEL ${newLevel} // 914 高阶密钥卡认证通过`, alertClass);
      pushAuditLog(
        `KEYCARD OVERRIDE [SCP-914]: 刷卡覆写终端权限 LVL-${prevLevel} -> LVL-${newLevel}`,
        newLevel === 5 ? 'crit' : 'warn'
      );
    } else if (newLevel > prevLevel) {
      const alertClass = newLevel === 5 ? 'alert-o5' : 'alert-elevated';
      showBanner(`CLEARANCE ELEVATED -> LEVEL ${newLevel} // 正在破译机密涂黑字段...`, alertClass);
      pushAuditLog(`CLEARANCE ELEVATED: LVL-${prevLevel} -> LVL-${newLevel}`, newLevel === 5 ? 'crit' : 'warn');
    } else {
      showBanner(`CLEARANCE REDUCED -> LEVEL ${newLevel} // 高密级字段已重新涂黑封存`, '');
      pushAuditLog(`CLEARANCE REDUCED: LVL-${prevLevel} -> LVL-${newLevel}`, 'info');
    }
  }

  function replayAllUnlockedScrambles() {
    const spans = dom.dossierContent.querySelectorAll('.redacted-span.unlocked');
    if (spans.length === 0) {
      denyAccess(
        3,
        'RE-DECODE ABORTED // LEVEL 1 无已解锁解密字段 — CLEARANCE OVERRIDE REQUIRED',
        'RE-DECODE SKIPPED: NO UNLOCKED BLOCKS AT LVL-1'
      );
      return;
    }
    sound.playClick();
    sound.playDecrypt();
    let delay = 0;
    spans.forEach((span) => {
      scrambleReveal(span, delay);
      delay = Math.min(delay + 60, 360);
    });
    pushAuditLog(`RE-DECODED ${spans.length} CLASSIFIED BLOCKS`, 'info');
  }

  function selectScp(id) {
    state.activeId = id;
    state.specialStatusOverride = null;
    const scp = getActiveScp();
    renderArchiveList();
    humeMonitor.switchTarget(scp);
    initChamberTelemetry(scp);
    renderDossier(true);
    syncBrowserTab();
    pushAuditLog(`DOSSIER LOADED: ${scp.id} [${scp.objectClass}]`, scp.objectClass === 'KETER' ? 'crit' : 'info');
  }

  /* ========================================================================
     CANVAS REAL-TIME HUME INDEX OSCILLOSCOPE
     ======================================================================== */
  const humeMonitor = (function () {
    const BUFFER_SIZE = 150;
    let samples = [];
    let targetProfile = getActiveScp().hume;
    let currentVal = targetProfile.nominal;
    let peakVal = targetProfile.nominal;
    let phase = 0;
    let externalImpulse = 0;
    let externalOffset = 0;
    let modeTagTimer = null;
    let lastSampleTime = 0;
    let width = 300;
    let height = 146;

    const canvas = dom.humeCanvas;
    const ctx = canvas.getContext('2d');

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(200, Math.floor(rect.width));
      height = Math.max(110, Math.floor(rect.height));
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seedBuffer(profile) {
      samples = [];
      peakVal = profile.nominal;
      currentVal = profile.nominal;
      for (let i = 0; i < BUFFER_SIZE; i++) {
        const jitter = (Math.random() - 0.5) * profile.variance * 0.8;
        samples.push(Math.max(0.45, profile.nominal + jitter));
      }
      dom.legWarn.textContent = profile.warnThreshold.toFixed(2);
      dom.legCrit.textContent = profile.critThreshold.toFixed(2);
    }

    function triggerImpulse(magnitude, label) {
      externalImpulse = Math.max(externalImpulse, magnitude);
      if (label) {
        if (modeTagTimer) {
          clearTimeout(modeTagTimer);
          modeTagTimer = null;
        }
        dom.canvasModeTag.textContent = label;
        modeTagTimer = setTimeout(() => {
          modeTagTimer = null;
          dom.canvasModeTag.textContent = state.breachActive ? 'BREACH SURGE // KANT-ARRAY' : 'LIVE 60Hz // KANT-ARRAY';
        }, 1200);
      }
    }

    function setOffset(offset) {
      externalOffset = Number.isFinite(offset) ? offset : 0;
    }

    function nextSample() {
      phase += 0.22;
      const p = targetProfile;
      let val = p.nominal + externalOffset;

      if (p.waveMode === 'safe_harmonic') {
        val += Math.sin(phase * 0.9) * 0.025 + Math.sin(phase * 2.7) * 0.012;
        val += (Math.random() - 0.5) * p.variance;
      } else if (p.waveMode === 'euclid_step') {
        val += Math.sin(phase * 0.5) * 0.04 + (Math.random() - 0.5) * p.variance * 1.4;
        if (Math.random() < p.spikeChance) {
          val += p.spikeMagnitude * (0.6 + Math.random() * 0.5);
        }
      } else {
        // keter_chaotic
        val += Math.sin(phase * 1.3) * 0.14 + Math.cos(phase * 3.1) * 0.08;
        val += (Math.random() - 0.5) * p.variance * 1.8;
        if (Math.random() < p.spikeChance) {
          val += p.spikeMagnitude * (0.55 + Math.random() * 0.7);
        }
      }

      if (state.breachActive) {
        val += 0.28 + Math.sin(phase * 2.4) * 0.09;
        if (Math.random() < 0.12) {
          val += 0.36;
        }
      }

      if (externalImpulse > 0.005) {
        val += externalImpulse;
        externalImpulse *= 0.68;
      } else {
        externalImpulse = 0;
      }

      // Smooth slightly with previous sample so waveform stays readable
      const prev = samples[samples.length - 1] || p.nominal;
      val = prev * 0.35 + val * 0.65;
      val = Math.max(0.45, Math.min(2.65, val));

      samples.push(val);
      if (samples.length > BUFFER_SIZE) samples.shift();

      currentVal = val;
      if (val > peakVal) peakVal = val;

      updateReadout(val, p);
    }

    function updateReadout(val, p) {
      const delta = val - p.baseline;
      const isCrit = val >= p.critThreshold;
      const isWarn = !isCrit && val >= p.warnThreshold;

      dom.humeCurrent.innerHTML = `${val.toFixed(2)} <span class="unit">Hm</span>`;
      dom.humeCurrent.classList.toggle('crit', isCrit);

      dom.humeDelta.textContent = `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} Hm`;
      dom.humePeak.textContent = `${peakVal.toFixed(2)} Hm`;

      if (isCrit) {
        dom.humeState.textContent = 'CRITICAL';
        dom.humeState.className = 'state-crit';
        const now = Date.now();
        if (now - state.lastCritLogTs > 8500) {
          state.lastCritLogTs = now;
          pushAuditLog(`KANT ALERT: ${getActiveScp().id} SPIKE ${val.toFixed(2)} Hm`, 'crit');
        }
      } else if (isWarn) {
        dom.humeState.textContent = 'ELEVATED';
        dom.humeState.className = 'state-warn';
      } else {
        dom.humeState.textContent = 'NOMINAL';
        dom.humeState.className = 'state-nominal';
      }
    }

    function valueToY(v) {
      const minV = 0.4;
      const maxV = 2.6;
      const padTop = 14;
      const padBottom = 12;
      const usableH = height - padTop - padBottom;
      const ratio = (v - minV) / (maxV - minV);
      return height - padBottom - Math.max(0, Math.min(1, ratio)) * usableH;
    }

    function draw() {
      const p = targetProfile;
      const rightAxisW = 30;
      const plotW = width - rightAxisW;

      // Clear background
      ctx.fillStyle = '#08090B';
      ctx.fillRect(0, 0, width, height);

      // Subtle oscilloscope grid
      ctx.strokeStyle = '#171C24';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const vCols = 8;
      for (let i = 1; i < vCols; i++) {
        const x = Math.floor((plotW / vCols) * i) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      const ticks = [0.5, 1.0, 1.5, 2.0, 2.5];
      ticks.forEach((tv) => {
        const y = Math.floor(valueToY(tv)) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(plotW, y);
      });
      ctx.stroke();

      // Right axis divider & scale labels
      ctx.strokeStyle = '#2A2F3A';
      ctx.beginPath();
      ctx.moveTo(plotW + 0.5, 0);
      ctx.lineTo(plotW + 0.5, height);
      ctx.stroke();

      ctx.fillStyle = '#5A6475';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ticks.forEach((tv) => {
        const y = valueToY(tv);
        ctx.fillText(tv.toFixed(1), plotW + 4, y);
      });

      // Threshold reference lines: Baseline 1.0, Warn, Crit
      drawDashedLine(valueToY(p.baseline), plotW, '#64748B', [3, 3]);
      drawDashedLine(valueToY(p.warnThreshold), plotW, 'rgba(255, 176, 0, 0.45)', [4, 4]);
      drawDashedLine(valueToY(p.critThreshold), plotW, 'rgba(217, 35, 35, 0.65)', [4, 3]);

      if (samples.length < 2) return;

      const latest = samples[samples.length - 1];
      const isCrit = state.breachActive || latest >= p.critThreshold;
      const breachRed = state.breachActive ? '#FF1E1E' : '#D92323';
      const strokeColor = isCrit ? breachRed : '#FFB000';

      // Area fill under trace
      const grad = ctx.createLinearGradient(0, 10, 0, height);
      if (isCrit) {
        grad.addColorStop(0, state.breachActive ? 'rgba(255, 30, 30, 0.34)' : 'rgba(217, 35, 35, 0.30)');
        grad.addColorStop(1, 'rgba(217, 35, 35, 0.01)');
      } else {
        grad.addColorStop(0, 'rgba(255, 176, 0, 0.24)');
        grad.addColorStop(1, 'rgba(255, 176, 0, 0.01)');
      }

      ctx.beginPath();
      const stepX = plotW / (BUFFER_SIZE - 1);
      samples.forEach((v, idx) => {
        const x = idx * stepX;
        const y = valueToY(v);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(plotW, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Main crisp trace polyline (color segments red above critThreshold or during breach)
      ctx.lineWidth = 1.6;
      for (let i = 1; i < samples.length; i++) {
        const x1 = (i - 1) * stepX;
        const y1 = valueToY(samples[i - 1]);
        const x2 = i * stepX;
        const y2 = valueToY(samples[i]);
        const segCrit = state.breachActive || samples[i] >= p.critThreshold || samples[i - 1] >= p.critThreshold;
        ctx.strokeStyle = segCrit ? breachRed : '#FFB000';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Live head indicator & crosshair line
      const headX = plotW - 1;
      const headY = valueToY(latest);

      ctx.strokeStyle = isCrit ? 'rgba(217, 35, 35, 0.35)' : 'rgba(255, 176, 0, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, Math.floor(headY) + 0.5);
      ctx.lineTo(plotW, Math.floor(headY) + 0.5);
      ctx.stroke();

      ctx.fillStyle = strokeColor;
      ctx.fillRect(headX - 2.5, headY - 2.5, 5, 5);
    }

    function drawDashedLine(y, maxW, color, pattern) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash(pattern);
      ctx.beginPath();
      ctx.moveTo(0, Math.floor(y) + 0.5);
      ctx.lineTo(maxW, Math.floor(y) + 0.5);
      ctx.stroke();
      ctx.restore();
    }

    function loop(ts) {
      if (ts - lastSampleTime >= 52) {
        lastSampleTime = ts;
        nextSample();
      }
      draw();
      requestAnimationFrame(loop);
    }

    function switchTarget(scp) {
      targetProfile = scp.hume;
      externalOffset = 0;
      if (modeTagTimer) {
        clearTimeout(modeTagTimer);
        modeTagTimer = null;
      }
      seedBuffer(targetProfile);
      triggerImpulse(0.18, `SYNC // ${scp.id}`);
    }

    function init() {
      resize();
      seedBuffer(targetProfile);
      window.addEventListener('resize', resize);
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(resize);
        ro.observe(canvas.parentElement);
      }
      requestAnimationFrame(loop);
    }

    return {
      init,
      switchTarget,
      triggerImpulse,
      setOffset,
      getCurrent: () => currentVal
    };
  })();

  /* ========================================================================
     CONTAINMENT CHAMBER ENVIRONMENTAL TELEMETRY
     ======================================================================== */
  let currentEnvValues = {};
  let envMetricLocks = {};

  function initChamberTelemetry(scp) {
    dom.envCellId.textContent = scp.sector.split('//').pop().trim();
    dom.envMetrics.innerHTML = '';
    currentEnvValues = {};
    envMetricLocks = {};

    scp.telemetry.forEach((metric) => {
      currentEnvValues[metric.id] = metric.base;

      const row = document.createElement('div');
      row.className = 'env-metric-row';
      row.dataset.metricId = metric.id;

      let segsHtml = '';
      for (let i = 0; i < 20; i++) {
        segsHtml += '<span class="led-seg"></span>';
      }

      row.innerHTML = `
        <div class="env-row-head">
          <span class="env-name">
            <span class="env-name-en mono">${metric.label}</span>
            <span class="env-name-cn">${metric.cn}</span>
          </span>
          <span class="env-val mono" data-val-el>${metric.base.toFixed(1)} ${metric.unit}</span>
        </div>
        <div class="led-bar" data-bar-el>${segsHtml}</div>
      `;

      dom.envMetrics.appendChild(row);
    });

    updateChamberMetrics();
    updateSpecialTelemetry();
  }

  function renderSingleEnvMetric(m, next) {
    const row = dom.envMetrics.querySelector(`[data-metric-id="${m.id}"]`);
    if (!row) return;

    const valEl = row.querySelector('[data-val-el]');
    const barEl = row.querySelector('[data-bar-el]');

    const isCrit = m.invert ? next <= m.crit : next >= m.crit;
    const isWarn = !isCrit && (m.invert ? next <= m.warn : next >= m.warn);

    const decimals = m.max <= 10 ? 2 : 1;
    valEl.textContent = `${next.toFixed(decimals)} ${m.unit}`;
    valEl.className = `env-val mono ${isCrit ? 'crit' : isWarn ? 'warn' : ''}`;

    const ratio = (next - m.min) / (m.max - m.min);
    const litCount = Math.round(Math.max(0, Math.min(1, ratio)) * 20);
    const segs = barEl.children;

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (i < litCount) {
        let colorCls = 'on';
        if (isCrit) colorCls = 'on red';
        else if (isWarn || (!m.invert && i >= 15)) colorCls = 'on amber';
        seg.className = `led-seg ${colorCls}`;
      } else {
        seg.className = 'led-seg';
      }
    }
  }

  function updateEnvMetric(metricId, value, holdMs = 0) {
    const scp = getActiveScp();
    if (!scp) return;
    const m = scp.telemetry.find((item) => item.id === metricId);
    if (!m) return;
    const clamped = Math.max(m.min, Math.min(m.max, Number(value)));
    if (!Number.isFinite(clamped)) return;
    currentEnvValues[m.id] = clamped;
    if (holdMs > 0) {
      envMetricLocks[m.id] = {
        value: clamped,
        expiresAt: Date.now() + holdMs
      };
    } else {
      delete envMetricLocks[m.id];
    }
    renderSingleEnvMetric(m, clamped);
  }

  function updateChamberMetrics() {
    const scp = getActiveScp();
    if (!scp) return;

    const now = Date.now();
    scp.telemetry.forEach((m) => {
      const lock = envMetricLocks[m.id];
      if (lock && now < lock.expiresAt) {
        const microJitter = (Math.random() - 0.5) * Math.min(m.jitter * 0.3, 0.2);
        const held = Math.max(m.min, Math.min(m.max, lock.value + microJitter));
        currentEnvValues[m.id] = held;
        renderSingleEnvMetric(m, held);
        return;
      }
      if (lock) {
        delete envMetricLocks[m.id];
      }

      const prev = currentEnvValues[m.id] ?? m.base;
      // Mean-reverting random walk around base
      const drift = (m.base - prev) * 0.3 + (Math.random() - 0.5) * m.jitter * 2;
      const next = Math.max(m.min, Math.min(m.max, prev + drift));
      currentEnvValues[m.id] = next;
      renderSingleEnvMetric(m, next);
    });
  }

  function setSpecialStatus(text, isCrit = false, holdMs = 3000) {
    state.specialStatusOverride = {
      text: String(text),
      isCrit: Boolean(isCrit),
      expiresAt: Date.now() + Math.max(250, holdMs)
    };
    updateSpecialTelemetry();
  }

  function clearSpecialStatus() {
    state.specialStatusOverride = null;
    updateSpecialTelemetry();
  }

  function updateSpecialTelemetry() {
    const scp = getActiveScp();
    if (!scp) return;

    const sp = scp.specialStatus;
    let valueText = '';
    let isCrit = false;

    if (state.specialStatusOverride && Date.now() < state.specialStatusOverride.expiresAt) {
      valueText = state.specialStatusOverride.text;
      isCrit = state.specialStatusOverride.isCrit;
    } else {
      state.specialStatusOverride = null;
      if (sp.mode === 'blink_cycle') {
        state.blinkCountdown -= 0.2;
        if (state.blinkCountdown <= 0) {
          state.blinkCountdown = 6.0;
          // Inject a crisp blink-rotation Hume spike!
          humeMonitor.triggerImpulse(0.28, 'BLINK SWAP // SPIKE');
        }
        const urgent = state.blinkCountdown <= 1.2;
        isCrit = urgent;
        valueText = urgent
          ? `BLINK SWAP! ${state.blinkCountdown.toFixed(1)}s`
          : `LOCK 3/3 // ${state.blinkCountdown.toFixed(1)}s`;
      } else if (sp.mode === 'keter_alert') {
        const h = humeMonitor.getCurrent();
        isCrit = h >= scp.hume.critThreshold;
        valueText = isCrit ? 'BREACH RISK // SURGE' : 'ACID SUPPRESSION OK';
      } else {
        valueText = 'DIAL: 1:1 // STANDBY';
        isCrit = false;
      }
    }

    dom.specialTelemetry.innerHTML = `
      <div class="special-left">
        <span class="special-label mono">${sp.label}</span>
        <span class="special-cn">${sp.cn}</span>
      </div>
      <div class="special-value mono ${isCrit ? 'crit' : ''}" title="${valueText}">${valueText}</div>
    `;
  }

  /* ========================================================================
     GLOBAL CONTAINMENT BREACH MODE & AUDIO CONTROLS
     ======================================================================== */
  function setBreachMode(active) {
    const next = Boolean(active);
    if (next === state.breachActive) return;
    state.breachActive = next;

    dom.body.classList.toggle('breach-active', next);
    if (dom.breachToggleBtn) {
      dom.breachToggleBtn.classList.toggle('active', next);
      dom.breachToggleBtn.setAttribute('aria-pressed', String(next));
    }
    if (dom.breachTicker) {
      dom.breachTicker.setAttribute('aria-hidden', String(!next));
    }

    sound.toggleAlarm(next);
    if (window.LiveViewport) {
      window.LiveViewport.setBreach(next);
    }
    syncBrowserTab();

    if (next) {
      dom.canvasModeTag.textContent = 'BREACH SURGE // KANT-ARRAY';
      humeMonitor.triggerImpulse(0.48, 'BREACH SURGE');
      showBanner('CONTAINMENT BREACH ACTIVE // MTF EPSILON-11 DEPLOYED', 'alert-o5');
      pushAuditLog('!!! ALERT: SITE-19 CONTAINMENT BREACH DECLARED !!!', 'crit');
      pushAuditLog('MTF EPSILON-11 DEPLOYED // LOCKDOWN PROTOCOL ALPHA', 'crit');
    } else {
      dom.canvasModeTag.textContent = 'LIVE 60Hz // KANT-ARRAY';
      dom.accessBanner.className = 'access-banner mono';
      updateDefaultBanner();
      pushAuditLog('BREACH PROTOCOL STAND-DOWN // SITE-19 NORMALIZED', 'warn');
    }
  }

  function toggleBreachMode() {
    setBreachMode(!state.breachActive);
  }

  function syncAudioButton() {
    if (!dom.audioToggleBtn) return;
    const isOn = sound.isEnabled();
    dom.audioToggleBtn.textContent = isOn ? '[AUDIO: ON]' : '[AUDIO: OFF]';
    dom.audioToggleBtn.classList.toggle('active', isOn);
    dom.audioToggleBtn.setAttribute('aria-pressed', String(isOn));
  }

  /* ========================================================================
     EVENT BINDINGS & BOOTSTRAP
     ======================================================================== */
  function bindEvents() {
    // Security clearance switcher buttons
    dom.clrButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        setClearance(Number(btn.dataset.level));
      });
    });

    // Audio toggle button
    if (dom.audioToggleBtn) {
      dom.audioToggleBtn.addEventListener('click', () => {
        const nextOn = sound.toggle();
        syncAudioButton();
        if (nextOn) sound.playClick();
        pushAuditLog(`AUDIO SYNTHESIS: ${nextOn ? 'ONLINE' : 'MUTED'}`, nextOn ? 'info' : 'warn');
      });
    }

    // Global containment breach button
    if (dom.breachToggleBtn) {
      dom.breachToggleBtn.addEventListener('click', () => {
        sound.playClick();
        toggleBreachMode();
      });
    }

    // Boot screen lock/re-engage button
    if (dom.bootLockBtn) {
      dom.bootLockBtn.addEventListener('click', () => {
        sound.playClick();
        if (window.BootScreen) {
          window.BootScreen.open(false);
        }
      });
    }

    // Two-step anti-misclick persistent memory wipe
    if (dom.purgeMemoryBtn) {
      let purgeArmed = false;
      let purgeExecuting = false;
      let purgeCountdownInterval = null;
      let purgeRevertTimeout = null;
      let purgeRemaining = 3;

      const resetPurgeButton = () => {
        if (purgeCountdownInterval) {
          clearInterval(purgeCountdownInterval);
          purgeCountdownInterval = null;
        }
        if (purgeRevertTimeout) {
          clearTimeout(purgeRevertTimeout);
          purgeRevertTimeout = null;
        }
        purgeArmed = false;
        purgeRemaining = 3;
        dom.purgeMemoryBtn.classList.remove('is-armed');
        dom.purgeMemoryBtn.textContent = '[PURGE MEMORY]';
      };

      dom.purgeMemoryBtn.addEventListener('click', () => {
        if (purgeExecuting) return;

        if (!purgeArmed) {
          purgeArmed = true;
          purgeRemaining = 3;
          if (typeof sound.playDenied === 'function') sound.playDenied();
          else sound.playClick();
          dom.purgeMemoryBtn.classList.add('is-armed');
          dom.purgeMemoryBtn.textContent = '[CONFIRM PURGE? 3s]';

          purgeCountdownInterval = setInterval(() => {
            purgeRemaining -= 1;
            if (purgeRemaining > 0 && purgeArmed) {
              dom.purgeMemoryBtn.textContent = `[CONFIRM PURGE? ${purgeRemaining}s]`;
            }
          }, 1000);

          purgeRevertTimeout = setTimeout(() => {
            resetPurgeButton();
          }, 3000);
          return;
        }

        if (purgeCountdownInterval) {
          clearInterval(purgeCountdownInterval);
          purgeCountdownInterval = null;
        }
        if (purgeRevertTimeout) {
          clearTimeout(purgeRevertTimeout);
          purgeRevertTimeout = null;
        }
        purgeArmed = false;
        purgeExecuting = true;
        dom.purgeMemoryBtn.disabled = true;
        dom.purgeMemoryBtn.classList.remove('is-armed');
        dom.purgeMemoryBtn.classList.add('is-purging');
        dom.purgeMemoryBtn.textContent = '[WIPING...]';

        if (window.SessionStore) {
          window.SessionStore.purge();
        }
        sound.playClick();
        sound.playDecrypt();
        pushAuditLog('MEM-WIPE EXECUTED // REBOOTING NODE...', 'crit');

        setTimeout(() => {
          dom.body.classList.add('is-rebooting');
        }, 60);
        setTimeout(() => {
          window.location.reload();
        }, 500);
      });
    }

    // Archive class filters
    dom.filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playClick();
        state.filterClass = btn.dataset.filter;
        dom.filterButtons.forEach((b) => b.classList.toggle('active', b === btn));
        renderArchiveList();
      });
    });

    // Search input
    dom.archiveSearch.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderArchiveList();
    });

    // Replay scramble button
    dom.replayScrambleBtn.addEventListener('click', replayAllUnlockedScrambles);

    // Kant counter manual calibration ping
    dom.kantPingBtn.addEventListener('click', () => {
      sound.playClick();
      humeMonitor.triggerImpulse(0.36, 'MANUAL KANT PING');
      pushAuditLog(`KANT CALIBRATION PULSE -> ${getActiveScp().id}`, 'warn');
    });

    // SYS-LOG Embedded Command Line
    if (dom.syslogCliForm && dom.syslogCliInput) {
      const cliHistory = [];
      let cliHistoryIndex = 0;
      let cliDraft = '';

      const executeCliCommand = (rawInput) => {
        const cmdRaw = String(rawInput || '').trim();
        if (!cmdRaw) return;

        if (cliHistory[cliHistory.length - 1] !== cmdRaw) {
          cliHistory.push(cmdRaw);
          if (cliHistory.length > 50) cliHistory.shift();
        }
        cliHistoryIndex = cliHistory.length;
        cliDraft = '';

        const normalized = cmdRaw.replace(/\s+/g, ' ');
        const lower = normalized.toLowerCase();

        if (lower === 'help' || lower === '?') {
          sound.playClick();
          pushAuditLogBatch([
            { message: `SCiP> ${normalized}`, severity: 'info' },
            { message: 'CMDS: HELP | STATUS | OPEN <173|682|914> | BREACH | CLEAR', severity: 'o5' },
            { message: 'NET : PING 079 | CONNECT 079 [ISOLATED NODE]', severity: 'warn' }
          ]);
          return;
        }

        if (lower === 'status') {
          sound.playClick();
          const scp = getActiveScp();
          const saved =
            window.SessionStore && typeof window.SessionStore.load === 'function'
              ? window.SessionStore.load()
              : null;
          const sessionCount = Math.max(1, Number(saved && saved.sessionCount) || 1);
          const discovered914 =
            saved && saved.scp914 && Array.isArray(saved.scp914.discoveredKeys)
              ? saved.scp914.discoveredKeys.length
              : 0;
          const o5Key = Boolean(saved && saved.scp914 && saved.scp914.o5CardForged);
          const adapted682 = Boolean(saved && saved.scp682 && saved.scp682.adaptedLaser);
          const laserCount682 = Math.max(
            0,
            Number(saved && saved.scp682 && saved.scp682.laserTestCount) || 0
          );

          pushAuditLogBatch([
            { message: `SCiP> ${normalized}`, severity: 'info' },
            { message: `FILE: ${scp.id} [${scp.objectClass}] // CLEARANCE: LVL-${state.clearance}`, severity: 'info' },
            {
              message: `BREACH: ${state.breachActive ? 'ACTIVE [LOCKDOWN]' : 'NOMINAL'} // SESSIONS: #${sessionCount}`,
              severity: state.breachActive ? 'crit' : 'info'
            },
            {
              message: `914 INDEX: ${discovered914}/20${o5Key ? ' [O5-KEY]' : ''} // 682: ${
                adapted682 ? `ADAPTED (LASER x${Math.max(1, laserCount682)})` : 'BASELINE'
              }`,
              severity: adapted682 ? 'warn' : 'info'
            }
          ]);
          return;
        }

        const openMatch = lower.match(/^open\s+(?:scp-?)?(173|682|914)$/);
        if (openMatch) {
          sound.playClick();
          const targetId = `SCP-${openMatch[1]}`;
          if (state.activeId === targetId) {
            pushAuditLogBatch([
              { message: `SCiP> ${normalized}`, severity: 'info' },
              { message: `ARCHIVE ALREADY MOUNTED: ${targetId}`, severity: 'info' }
            ]);
          } else {
            selectScp(targetId);
            pushAuditLog(`SCiP> ${normalized}`, 'info');
            if (dom.auditLog) dom.auditLog.scrollTop = 0;
          }
          return;
        }

        if (lower === 'breach') {
          sound.playClick();
          toggleBreachMode();
          pushAuditLog(`SCiP> ${normalized}`, 'warn');
          if (dom.auditLog) dom.auditLog.scrollTop = 0;
          return;
        }

        if (lower === 'clear') {
          sound.playClick();
          if (dom.auditLog) dom.auditLog.innerHTML = '';
          return;
        }

        if (/^(?:(?:ping|connect)\s+)?(?:scp-?)?079$/.test(lower)) {
          pushAuditLogBatch([
            { message: `SCiP> ${normalized}`, severity: 'warn' },
            { message: 'ROUTING PACKET -> VAULT-079 [AIR-GAP BYPASS]...', severity: 'crit' }
          ]);
          trigger079Hijack('CLI');
          return;
        }

        if (typeof sound.playDenied === 'function') sound.playDenied();
        else sound.playClick();
        pushAuditLogBatch([
          { message: `SCiP> ${normalized}`, severity: 'info' },
          { message: "ERR: DIRECTIVE REJECTED // TYPE 'HELP'", severity: 'crit' }
        ]);
      };

      dom.syslogCliForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = dom.syslogCliInput.value;
        dom.syslogCliInput.value = '';
        executeCliCommand(val);
      });

      dom.syslogCliInput.addEventListener('keydown', (e) => {
        if (window.Hijack079 && window.Hijack079.isActive()) return;

        if (e.key === 'ArrowUp') {
          if (cliHistory.length === 0) return;
          e.preventDefault();
          e.stopPropagation();
          if (cliHistoryIndex === cliHistory.length) {
            cliDraft = dom.syslogCliInput.value;
          }
          cliHistoryIndex = Math.max(0, cliHistoryIndex - 1);
          dom.syslogCliInput.value = cliHistory[cliHistoryIndex] || '';
          const endPos = dom.syslogCliInput.value.length;
          dom.syslogCliInput.setSelectionRange(endPos, endPos);
          return;
        }

        if (e.key === 'ArrowDown') {
          if (cliHistory.length === 0) return;
          e.preventDefault();
          e.stopPropagation();
          cliHistoryIndex = Math.min(cliHistory.length, cliHistoryIndex + 1);
          dom.syslogCliInput.value =
            cliHistoryIndex < cliHistory.length ? cliHistory[cliHistoryIndex] : cliDraft;
          const endPos = dom.syslogCliInput.value.length;
          dom.syslogCliInput.setSelectionRange(endPos, endPos);
          return;
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          dom.syslogCliInput.blur();
        }
      });
    }

    // Keyboard hotkeys: 1 / 3 / 5 for clearance, Up / Down for archive switch
    document.addEventListener('keydown', (e) => {
      if (window.Hijack079 && window.Hijack079.isActive()) return;
      if (window.BootScreen && window.BootScreen.isOpen()) return;
      const ae = document.activeElement;
      if (
        ae === dom.archiveSearch ||
        ae === dom.syslogCliInput ||
        (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable))
      ) {
        return;
      }

      if (e.key === '1') setClearance(1);
      else if (e.key === '3') setClearance(3);
      else if (e.key === '5') setClearance(5);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const list = getFilteredArchives();
        if (list.length < 2) return;
        e.preventDefault();
        sound.playClick();
        const curIdx = list.findIndex((item) => item.id === state.activeId);
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const nextIdx = (curIdx + delta + list.length) % list.length;
        selectScp(list[nextIdx].id);
      }
    });
  }

  function bootstrap() {
    const persisted = window.SessionStore ? window.SessionStore.load() : null;
    let restoredVia914 = false;

    if (dom.memorySessionTag) {
      const sessNum = persisted ? persisted.sessionCount : 1;
      dom.memorySessionTag.textContent = `MEM // S#${String(sessNum).padStart(2, '0')}`;
    }

    if (
      persisted &&
      persisted.clearance &&
      persisted.clearance.via914Keycard &&
      (persisted.clearance.level === 3 || persisted.clearance.level === 5)
    ) {
      state.clearance = persisted.clearance.level;
      dom.body.dataset.clearance = String(state.clearance);
      const badgeMap = {
        1: 'LVL-1 // RESTRICTED',
        3: 'LVL-3 // SECRET',
        5: 'LVL-5 // O5-OVERRIDE'
      };
      dom.clearanceBadge.textContent = badgeMap[state.clearance];
      dom.clrButtons.forEach((btn) => {
        const isAct = Number(btn.dataset.level) === state.clearance;
        btn.classList.toggle('active', isAct);
        btn.setAttribute('aria-checked', String(isAct));
      });
      restoredVia914 = true;
    }

    startClock();
    syncAudioButton();
    if (typeof sound.onChange === 'function') {
      sound.onChange(syncAudioButton);
    }
    bindEvents();
    renderArchiveList();
    humeMonitor.init();
    initChamberTelemetry(getActiveScp());
    renderDossier(false);
    syncBrowserTab();

    pushAuditLog('SCiPNET NODE SITE-19 ONLINE', 'info');
    if (persisted && persisted.sessionCount > 1) {
      pushAuditLog(
        `SCiPNET SESSION #${persisted.sessionCount} RESUMED // PERSISTENT TELEMETRY RETAINED`,
        'warn'
      );
    }
    pushAuditLog(
      restoredVia914
        ? `AUTH SESSION: LEVEL ${state.clearance} (914 KEYCARD PERSISTED)`
        : 'AUTH SESSION: LEVEL 1 (RESTRICTED)',
      'warn'
    );
    pushAuditLog(`LOADED ARCHIVE: ${getActiveScp().id}`, 'info');

    if (window.BootScreen) {
      window.BootScreen.init({
        onVerified() {
          syncAudioButton();
          pushAuditLog('MEMETIC INOCULATION OK // VITALS CONFIRMED', 'info');
          pushAuditLog('AUDIO SYNTHESIS: ONLINE [BOOT HANDSHAKE]', 'info');
        },
        onBypass() {
          syncAudioButton();
          pushAuditLog('MEMETIC GATE BYPASSED // FAST ENTRY', 'warn');
        },
        onLock() {
          pushAuditLog('TERMINAL LOCKED // MEMETIC KILL AGENT RE-ENGAGED', 'warn');
        }
      });
    }

    setInterval(updateChamberMetrics, 1100);
    setInterval(updateSpecialTelemetry, 200);
  }

  bootstrap();
})();
