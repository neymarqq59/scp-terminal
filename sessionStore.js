(function () {
  'use strict';

  /**
   * Persistent Experiment Telemetry Store for SCiPNET // SITE-19 Terminal.
   * Uses localStorage with full try/catch safety for restricted/private browsing modes.
   */
  const STORAGE_KEY = 'scipnet_site19_memory_v1';

  function createDefaultState() {
    return {
      sessionCount: 0,
      encountered079: false,
      scp682: {
        adaptedLaser: false,
        laserTestCount: 0
      },
      scp914: {
        discoveredKeys: [],
        o5CardForged: false,
        milestone10Logged: false,
        milestone20Logged: false
      },
      clearance: {
        level: 1,
        via914Keycard: false
      }
    };
  }

  function getStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
    } catch (_) {}
    return null;
  }

  function cloneState(st) {
    const src = st || createDefaultState();
    return {
      sessionCount: src.sessionCount,
      encountered079: Boolean(src.encountered079),
      scp682: {
        adaptedLaser: src.scp682.adaptedLaser,
        laserTestCount: src.scp682.laserTestCount
      },
      scp914: {
        discoveredKeys: src.scp914.discoveredKeys.slice(),
        o5CardForged: src.scp914.o5CardForged,
        milestone10Logged: src.scp914.milestone10Logged,
        milestone20Logged: src.scp914.milestone20Logged
      },
      clearance: {
        level: src.clearance.level,
        via914Keycard: src.clearance.via914Keycard
      }
    };
  }

  function normalizeState(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const raw682 = src.scp682 && typeof src.scp682 === 'object' ? src.scp682 : {};
    const raw914 = src.scp914 && typeof src.scp914 === 'object' ? src.scp914 : {};
    const rawClr = src.clearance && typeof src.clearance === 'object' ? src.clearance : {};

    const discoveredKeys = Array.isArray(raw914.discoveredKeys)
      ? Array.from(
          new Set(
            raw914.discoveredKeys.filter((k) => typeof k === 'string' && k.trim().length > 0)
          )
        )
      : [];

    const via914Keycard = Boolean(rawClr.via914Keycard);
    const parsedLevel = Number(rawClr.level);
    const level =
      via914Keycard && (parsedLevel === 1 || parsedLevel === 3 || parsedLevel === 5)
        ? parsedLevel
        : 1;

    return {
      sessionCount: Math.max(0, Math.floor(Number(src.sessionCount) || 0)),
      encountered079: Boolean(src.encountered079),
      scp682: {
        adaptedLaser: Boolean(raw682.adaptedLaser),
        laserTestCount: Math.max(0, Math.floor(Number(raw682.laserTestCount) || 0))
      },
      scp914: {
        discoveredKeys,
        o5CardForged: Boolean(raw914.o5CardForged || discoveredKeys.includes('card:very_fine')),
        milestone10Logged: Boolean(raw914.milestone10Logged),
        milestone20Logged: Boolean(raw914.milestone20Logged)
      },
      clearance: {
        level,
        via914Keycard
      }
    };
  }

  let memoryCache = createDefaultState();
  let purgedLock = false;

  function readRawFromStorage() {
    const storage = getStorage();
    if (!storage) return cloneState(memoryCache);
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      return normalizeState(JSON.parse(raw));
    } catch (_) {
      return cloneState(memoryCache);
    }
  }

  function writeToStorage(nextState) {
    memoryCache = cloneState(nextState);
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(memoryCache));
    } catch (_) {}
  }

  /**
   * Returns a cloned snapshot of persisted terminal state without mutating sessionCount.
   */
  function load() {
    return cloneState(memoryCache);
  }

  /**
   * Deep-merges partial state updates into persisted memory and writes to localStorage.
   */
  function save(partial) {
    if (purgedLock || !partial || typeof partial !== 'object') {
      return cloneState(memoryCache);
    }

    const next = cloneState(memoryCache);
    if (Object.prototype.hasOwnProperty.call(partial, 'sessionCount')) {
      next.sessionCount = partial.sessionCount;
    }
    if (Object.prototype.hasOwnProperty.call(partial, 'encountered079')) {
      next.encountered079 = Boolean(partial.encountered079);
    }
    if (partial.scp682 && typeof partial.scp682 === 'object') {
      next.scp682 = Object.assign({}, next.scp682, partial.scp682);
    }
    if (partial.scp914 && typeof partial.scp914 === 'object') {
      const merged914 = Object.assign({}, next.scp914, partial.scp914);
      if (Array.isArray(partial.scp914.discoveredKeys)) {
        merged914.discoveredKeys = partial.scp914.discoveredKeys.slice();
      }
      next.scp914 = merged914;
    }
    if (partial.clearance && typeof partial.clearance === 'object') {
      next.clearance = Object.assign({}, next.clearance, partial.clearance);
    }

    const normalized = normalizeState(next);
    writeToStorage(normalized);
    return cloneState(memoryCache);
  }

  /**
   * Clears all persisted memory and locks further writes until page reload.
   */
  function purge() {
    purgedLock = true;
    memoryCache = createDefaultState();
    const storage = getStorage();
    if (storage) {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch (_) {}
    }
    return cloneState(memoryCache);
  }

  const initial = readRawFromStorage();
  initial.sessionCount = (initial.sessionCount || 0) + 1;
  writeToStorage(initial);

  const api = {
    STORAGE_KEY,
    load,
    save,
    purge
  };

  window.SessionStore = api;
  window.sessionStore = api;
})();
