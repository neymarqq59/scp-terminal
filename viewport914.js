(function () {
  'use strict';

  /**
   * Dedicated SCP-914 Clockwork Industrial Console (`Viewport914`)
   * Procedural interlocking SVG gear train + analog pressure gauge + Canvas 2D steam/spark FX,
   * 4 test items × 5 dial settings = 20 lore-accurate outcomes with typewriter printout & SYS-LOG sync.
   */
  const PROCESS_DURATION_MS = 2500;
  const discoveredPairs = new Set();

  const ITEMS = [
    { id: 'card', code: 'KEY-01', name: '1级门禁卡', en: 'LVL-1 KEYCARD' },
    { id: 'pistol', code: 'ARM-09', name: '9mm制式手枪', en: '9MM SIDEARM' },
    { id: 'watch', code: 'CLK-44', name: '老式机械怀表', en: 'POCKET WATCH' },
    { id: 'coffee', code: 'BEV-85', name: '一杯热咖啡', en: 'HOT COFFEE' }
  ];

  const SETTINGS = [
    { id: 'rough', label: '粗加工', short: '粗加工', en: 'ROUGH', angle: -72, radSpike: 0.22, humeSpike: 0.08, torque: 685 },
    { id: 'coarse', label: '半粗', short: '半粗', en: 'COARSE', angle: -36, radSpike: 0.35, humeSpike: 0.11, torque: 710 },
    { id: '1:1', label: '1:1', short: '1:1', en: '1:1', angle: 0, radSpike: 0.48, humeSpike: 0.16, torque: 740 },
    { id: 'fine', label: '精加工', short: '精加工', en: 'FINE', angle: 36, radSpike: 1.65, humeSpike: 0.28, torque: 768 },
    { id: 'very_fine', label: '超精加工', short: '超精', en: 'VERY FINE', angle: 72, radSpike: 3.85, humeSpike: 0.46, torque: 792 }
  ];

  const VALID_PAIR_KEYS = new Set();
  ITEMS.forEach((it) => {
    SETTINGS.forEach((st) => {
      VALID_PAIR_KEYS.add(`${it.id}:${st.id}`);
    });
  });

  const store = window.SessionStore || null;
  let o5CardForged = false;
  let milestone10Logged = false;
  let milestone20Logged = false;

  function hydrate914Store() {
    if (!store) return;
    const saved = store.load();
    const s914 = saved && saved.scp914 ? saved.scp914 : {};
    discoveredPairs.clear();
    if (Array.isArray(s914.discoveredKeys)) {
      s914.discoveredKeys.forEach((k) => {
        if (VALID_PAIR_KEYS.has(k)) discoveredPairs.add(k);
      });
    }
    o5CardForged = Boolean(s914.o5CardForged || discoveredPairs.has('card:very_fine'));
    milestone10Logged = Boolean(s914.milestone10Logged);
    milestone20Logged = Boolean(s914.milestone20Logged);
  }

  function persist914Store() {
    if (!store) return;
    store.save({
      scp914: {
        discoveredKeys: Array.from(discoveredPairs),
        o5CardForged,
        milestone10Logged,
        milestone20Logged
      }
    });
  }

  hydrate914Store();

  // Complete 4 × 5 = 20 SCP-914 Refinement Outcome Matrix
  const RESULTS = {
    card: {
      rough: {
        tag: 'DESTROYED',
        severity: 'info',
        summary: 'PVC 卡片被完全粉碎为 14 克静电塑料碎屑与铜箔粉末',
        detail:
          'OUTPUT // 输出槽回收约 14g 精细研磨的白色 PVC 塑料碎屑及少量氧化铜粉末。磁条与 RFID 芯片已被彻底物理销毁，未检测到任何残留异常属性。'
      },
      coarse: {
        tag: 'DEGRADED',
        severity: 'info',
        summary: '门禁卡被切割为 6 枚规整的 PVC 矩形切片，磁条失效',
        detail:
          'OUTPUT // 输出一块被激光般精准分割的 6 等份塑料切片，芯片裸露且内部铜线圈完整剥离并整齐码放于一旁。无法通过任何 Site-19 读卡器识别。'
      },
      '1:1': {
        tag: 'EQUIVALENT',
        severity: 'info',
        summary: '转换为一张结构等价但印有混沌分裂者风格的黄铜打孔卡',
        detail:
          'OUTPUT // 门禁卡转换为一枚同等质量的复古黄铜机械打孔识别牌，表面冲压未知编号 [NODE-019-ALT]。刷过站点测试读卡槽时未能开门，但触发了 0.2 秒旧版兼容响应。'
      },
      fine: {
        tag: 'ELEVATED',
        severity: 'warn',
        summary: '升级为 3 级加密复合权限卡，表面浮现动态自修复微电路',
        detail:
          'OUTPUT // 产物外观升级为哑光黑碳纤维复合卡，实测可刷开 Site-19 B 区 3 级研究实验室气闸门。卡片表面存在非传统光刻的微米级银色拓扑纹路，建议立即收缴封存。'
      },
      very_fine: {
        tag: 'ANOMALOUS',
        severity: 'crit',
        summary: '生成无物理接口的“全能密钥卡”，靠近任何电子门锁即强制覆写解锁',
        detail:
          'OUTPUT // 输出一枚漆黑无标识金属薄片，质量比原卡增加 0.4g。接近半径 1.2m 内的所有电子与机械锁具均自动报错并弹开，甚至一度引起测试室收容门自检紊乱。已移交安保封存！'
      }
    },
    pistol: {
      rough: {
        tag: 'DISMANTLED',
        severity: 'info',
        summary: '制式手枪被熔锻拆解为生铁锭、铅弹丸堆与炭化聚合物颗粒',
        detail:
          'OUTPUT // 手枪未发生走火，在隔舱内被彻底拆解并分别归类为：3 块粗钢坯、15 枚剥离铜被甲的铅芯及一撮无烟火药灰渣。'
      },
      coarse: {
        tag: 'DISASSEMBLED',
        severity: 'info',
        summary: '所有 47 个机械零件按尺寸从大到小完美排列，膛线已被磨平',
        detail:
          'OUTPUT // 手枪被无损分解为 47 个独立组件并依长度升序呈矩阵摆放在输出槽底板上。击针被折弯 90°，套筒内部膛线被彻底抛光消除。'
      },
      '1:1': {
        tag: 'EQUIVALENT',
        severity: 'info',
        summary: '重构为一把同口径镀镍左轮手枪，弹巢刻有古典发条纹饰',
        detail:
          'OUTPUT // 输出一把 19 世纪风格的精密 9mm 六发镀镍转轮手枪，机械公差达到微米级。靶场试射弹道完全正常，无任何异常物理效应。'
      },
      fine: {
        tag: 'ENHANCED',
        severity: 'warn',
        summary: '升级为几乎零后坐力的自冷式脉冲半自动手枪，弹匣容量翻倍',
        detail:
          'OUTPUT // 外壳重构为未知钛合金复合材料，枪管内部形成螺旋散热微槽。实弹测试初速提升 185%，连续击发 30 发枪管温升低于 1.5°C，弹道具备轻微电磁加速特征。'
      },
      very_fine: {
        tag: 'HAZARD',
        severity: 'crit',
        summary: '产物发射微型定向电离等离子脉冲，但每次扣动扳机擦除射手 3 秒记忆',
        detail:
          'OUTPUT // 手枪演化为无弹匣的无缝流线型暗金属武器。D 级受试者试射时，枪口喷射高能蓝白电离等离子束击穿 40mm 靶钢板，但受试者每次开火后均茫然询问“为什么我手里拿着枪？”。'
      }
    },
    watch: {
      rough: {
        tag: 'SCRAPPED',
        severity: 'info',
        summary: '机械怀表被碾压为黄铜碎片堆与断裂的主发条卷带',
        detail:
          'OUTPUT // 输出一小堆混合玻璃渣、碎黄铜片和氧化钢轴的金属垃圾，所有齿轮齿牙均被齐根剪断。'
      },
      coarse: {
        tag: 'DEGRADED',
        severity: 'info',
        summary: '重构为一尊简陋的黄铜日晷与一袋细石英砂',
        detail:
          'OUTPUT // 精密擒纵机构全部消失，原金属壳体被重塑为一只直径 6cm 的迷你粗糙日晷，表盘指针熔接于刻度盘中央无法移动。'
      },
      '1:1': {
        tag: 'EQUIVALENT',
        severity: 'info',
        summary: '转换为同年代数字显示电子表，逆向走时但时间精度分毫不差',
        detail:
          'OUTPUT // 怀表转为一只 1980 年代复古液晶数字表（外壳仍为原怀表黄铜打造），内置无电池压电微动供能。屏幕倒序显示剩余当日时间，计时误差小于 0.01 秒/周。'
      },
      fine: {
        tag: 'REFINED',
        severity: 'warn',
        summary: '永动级天文怀表：可实时追踪地球磁极偏角与站点局部休谟基线',
        detail:
          'OUTPUT // 原表盘新增两根极细的铂金副指针。经核对，除标准 UTC 时间外，其余指针竟分别精准指向地磁北极与实验室内当前康德计数器的实时休谟偏移值。'
      },
      very_fine: {
        tag: 'TEMPORAL',
        severity: 'crit',
        summary: '产生物体局部时间滞留场：半径 40cm 内物理过程减缓至 1/12 流速',
        detail:
          'OUTPUT // 怀表外壳悬浮起 3 枚独立旋转的无轴黄金光环。当发条上紧时，表身周围 40cm 范围内的灰尘飘落与放射性同位素衰变速率骤降至正常值的 8.3%，已立即放入铅衬隔离箱。'
      }
    },
    coffee: {
      rough: {
        tag: 'SEPARATED',
        severity: 'info',
        summary: '咖啡分离为干燥焦糊咖啡因晶体、纯蒸馏水与纸浆泥',
        detail:
          'OUTPUT // 纸杯被撕成湿纸浆球，咖啡液体彻底分解为 185ml 无味蒸馏水以及一小撮极苦的纯白咖啡因粉末结晶。'
      },
      coarse: {
        tag: 'CONDENSED',
        severity: 'info',
        summary: '浓缩为一小块散发浓烈焦苦味的黑色咖啡糖浆砖与压扁纸杯',
        detail:
          'OUTPUT // 水分几乎完全蒸发，残留约 12g 粘稠高浓缩焦糖化咖啡膏，经成分检测咖啡因浓度达到常规浓缩咖啡的 14 倍。'
      },
      '1:1': {
        tag: 'EQUIVALENT',
        severity: 'info',
        summary: '替换为一杯温度完全相同的伯爵红茶（附带陶瓷茶杯）',
        detail:
          'OUTPUT // 原纸杯与黑咖啡等质量转换为一只素白骨瓷杯盛装的 68°C 锡兰伯爵红茶，口感极佳且未检出任何异常模因或化学毒性。'
      },
      fine: {
        tag: 'STIMULANT',
        severity: 'warn',
        summary: '液态呈金属琥珀光泽：饮用后可保持 72 小时绝对清醒且反应速度 +40%',
        detail:
          'OUTPUT // 输出液体散发微微蓝金荧光与强烈烘培香气。D 级人员试饮 15ml 后连续 72 小时无任何困意，视觉动态捕捉与逻辑运算显著增强，72 小时后一次性补眠 14 小时恢复常态。'
      },
      very_fine: {
        tag: 'COGNITOHAZARD',
        severity: 'crit',
        summary: '液体违背重力在杯口上方凝聚为旋转黄金球体，散发微弱逆模因苦香',
        detail:
          'OUTPUT // 纸杯已化为透明晶体材质，内部液体凝聚为一颗悬浮于杯口上方 2cm 处自行公转的高密度金褐色液滴。靠近观测者报告称“闻到了童年最遗憾那天的味道”。禁止直接接触！'
      }
    }
  };

  function buildGearSvgPath(teeth, outerR, rootR) {
    const step = (Math.PI * 2) / teeth;
    let d = '';
    for (let i = 0; i < teeth; i++) {
      const a0 = i * step;
      const a1 = a0 + step * 0.22;
      const a2 = a0 + step * 0.32;
      const a3 = a0 + step * 0.68;
      const a4 = a0 + step * 0.78;
      const pts = [
        [Math.cos(a0) * rootR, Math.sin(a0) * rootR],
        [Math.cos(a1) * rootR, Math.sin(a1) * rootR],
        [Math.cos(a2) * outerR, Math.sin(a2) * outerR],
        [Math.cos(a3) * outerR, Math.sin(a3) * outerR],
        [Math.cos(a4) * rootR, Math.sin(a4) * rootR]
      ];
      pts.forEach(([x, y], idx) => {
        d += `${i === 0 && idx === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `;
      });
    }
    return d + 'Z';
  }

  function create(stageEl, ctx) {
    hydrate914Store();

    let selectedItemId = ITEMS[0].id;
    let settingIndex = 2; // Default 1:1
    let isProcessing = false;
    let processStartTs = 0;
    let runCount = 142;
    let clearance = Number(ctx.clearance) || 1;
    let isBreach = Boolean(ctx.isBreach);
    let breachOverridden = false;
    let activeKeycardLvl = null;
    let codexFlashTimer = null;
    let sealFlashTimer = null;
    const deniedTimers = new WeakMap();

    let gearBaseDeg = 0;
    let speedMult = 1.0;
    let pressureRatio = 0.22;
    let width = 680;
    let height = 350;

    let rafId = null;
    let processTimer = null;
    let gearSoundTimer = null;
    let typewriterTimer = null;
    let completeRestoreTimer = null;
    let resizeObserver = null;
    let lastFrameTs = performance.now();

    const sparks = [];
    const steam = [];

    if (ctx.hostEl) {
      ctx.hostEl.classList.add('has-console-layout');
    }

    const gearSpecs = [
      { id: 'g1', cx: 135, cy: 195, teeth: 24, outerR: 98, rootR: 84, dir: 1, fill: '#241B0F', stroke: '#A37B38' },
      { id: 'g2', cx: 292, cy: 118, teeth: 18, outerR: 76, rootR: 64, dir: -1, fill: '#2C2112', stroke: '#B68B3F' },
      { id: 'g3', cx: 386, cy: 235, teeth: 22, outerR: 90, rootR: 77, dir: 1, fill: '#21180D', stroke: '#947134' },
      { id: 'g4', cx: 540, cy: 130, teeth: 20, outerR: 82, rootR: 70, dir: -1, fill: '#2A2011', stroke: '#B2873E' },
      { id: 'g5', cx: 658, cy: 238, teeth: 14, outerR: 58, rootR: 48, dir: 1, fill: '#231B0E', stroke: '#9C7636' }
    ];

    const gearsMarkup = gearSpecs
      .map((gs) => {
        const toothPath = buildGearSvgPath(gs.teeth, gs.outerR, gs.rootR);
        const rimR = gs.rootR * 0.72;
        const hubR = gs.rootR * 0.24;
        return `
          <g data-gear-id="${gs.id}" transform="translate(${gs.cx} ${gs.cy})">
            <g data-gear-rotor>
              <path d="${toothPath}" fill="${gs.fill}" stroke="${gs.stroke}" stroke-width="1.4" />
              <circle cx="0" cy="0" r="${rimR.toFixed(1)}" fill="none" stroke="${gs.stroke}" stroke-width="1.3" stroke-dasharray="14 8" />
              <line x1="${-rimR}" y1="0" x2="${rimR}" y2="0" stroke="${gs.stroke}" stroke-width="2.2" />
              <line x1="0" y1="${-rimR}" x2="0" y2="${rimR}" stroke="${gs.stroke}" stroke-width="2.2" />
              <circle cx="0" cy="0" r="${hubR.toFixed(1)}" fill="#16110A" stroke="#C79A46" stroke-width="1.6" />
              <circle cx="0" cy="0" r="4" fill="#FFB000" opacity="0.85" />
            </g>
          </g>
        `;
      })
      .join('');

    const itemsMarkup = ITEMS.map((it) => {
      const active = it.id === selectedItemId ? 'active' : '';
      return `
        <button type="button" class="vp914-item-btn ${active}" data-item-id="${it.id}">
          <div class="vp914-item-top mono">
            <span class="vp914-item-code">${it.code} <em class="vp914-item-prog" data-item-prog>0/5</em></span>
            <span data-item-pip>${it.id === selectedItemId ? 'LOADED' : 'READY'}</span>
          </div>
          <div class="vp914-item-name">${it.name}</div>
        </button>
      `;
    }).join('');

    const detentsMarkup = SETTINGS.map((st, idx) => {
      const active = idx === settingIndex ? 'active' : '';
      return `<button type="button" class="vp914-detent-btn mono ${active}" data-setting-idx="${idx}" data-setting="${st.id}">${st.short}</button>`;
    }).join('');

    const rootEl = document.createElement('div');
    rootEl.className = 'vp914-root';
    rootEl.innerHTML = `
      <svg class="vp914-gears-svg" viewBox="0 0 760 350" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        ${gearsMarkup}
      </svg>
      <canvas class="vp914-fx-canvas"></canvas>
      <div class="vp914-console">
        <!-- LEFT ZONE: INTAKE -->
        <section class="vp914-panel vp914-intake">
          <div class="vp914-zone-head mono">
            <span>INTAKE // 输入槽</span>
            <span class="vp914-zone-tag">01</span>
          </div>
          <div class="vp914-intake-list">
            ${itemsMarkup}
          </div>
        </section>

        <!-- CENTER ZONE: PRESSURE GAUGE & 5-SETTING ROTARY DIAL -->
        <section class="vp914-panel vp914-dial-zone">
          <div class="vp914-zone-head mono">
            <span>GEARBOX // 五档旋钮</span>
            <span class="vp914-zone-tag">02</span>
          </div>
          <div class="vp914-dial-body">
            <div class="vp914-gauge-strip">
              <svg class="vp914-gauge-svg" viewBox="0 0 100 54" aria-hidden="true">
                <path d="M 12 46 A 38 38 0 0 1 88 46" fill="none" stroke="#262C37" stroke-width="5" />
                <path d="M 12 46 A 38 38 0 0 1 71 14" fill="none" stroke="#FFB000" stroke-width="3" opacity="0.65" />
                <path d="M 71 14 A 38 38 0 0 1 88 46" fill="none" stroke="#D92323" stroke-width="4" opacity="0.88" />
                <g data-gauge-needle transform="rotate(-55 50 46)">
                  <line x1="50" y1="46" x2="50" y2="12" stroke="#E2E8F0" stroke-width="2" />
                </g>
                <circle cx="50" cy="46" r="4" fill="#FFB000" />
              </svg>
              <div class="vp914-gauge-meta mono">
                <span class="vp914-psi-val" data-psi-val>220 PSI</span>
                <div class="vp914-leds">
                  <span class="vp914-led-item"><i class="vp914-led-dot on-amber" data-led-idle></i>IDLE</span>
                  <span class="vp914-led-item"><i class="vp914-led-dot" data-led-wind></i>WIND</span>
                  <span class="vp914-led-item"><i class="vp914-led-dot" data-led-peak></i>PEAK</span>
                </div>
              </div>
            </div>

            <div class="vp914-knob-stage">
              <button type="button" class="vp914-knob-btn" data-knob-btn data-setting="${SETTINGS[settingIndex].id}" title="点击顺时针切换机械档位">
                <div class="vp914-knob-ring">
                  <div class="vp914-knob-rotor" data-knob-rotor style="transform: rotate(${SETTINGS[settingIndex].angle}deg);">
                    <span class="vp914-knob-notch"></span>
                  </div>
                </div>
              </button>
              <div class="vp914-knob-readout mono" data-dial-readout>MODE: ${SETTINGS[settingIndex].label} (${SETTINGS[settingIndex].en})</div>
            </div>

            <div class="vp914-detent-row">
              ${detentsMarkup}
            </div>
          </div>
        </section>

        <!-- RIGHT ZONE: MAINSPRING LEVER & OUTPUT REPORT -->
        <section class="vp914-panel vp914-output-zone">
          <div class="vp914-zone-head mono">
            <span>OUTPUT // 转换输出报告</span>
            <span class="vp914-codex-tag mono" data-codex-count>DISCOVERED: ${discoveredPairs.size}/20</span>
          </div>
          <div class="vp914-output-body">
            <div class="vp914-commendation-seal mono" data-commendation-seal aria-hidden="true">
              <span class="vp914-seal-core">◈ MATRIX COMPLETE // O5 COMMENDATION</span>
              <span class="vp914-seal-code">[O5-SEAL]</span>
            </div>
            <button type="button" class="vp914-start-btn mono" data-start-btn>
              <span data-start-label>⚙ 启动转换 // WIND</span>
              <span data-start-timer>2.5s</span>
              <div class="vp914-progress-track">
                <div class="vp914-progress-fill" data-progress-fill></div>
              </div>
            </button>

            <div class="vp914-report-box" data-report-box>
              <div class="vp914-report-meta mono">
                <span class="vp914-report-pair" data-report-pair>READY // [1级门禁卡] @ [1:1]</span>
                <div class="vp914-report-tags">
                  <span class="vp914-archived-tag" data-archived-tag>✓ ARCHIVED</span>
                  <span class="vp914-report-badge info" data-report-badge>STANDBY</span>
                </div>
              </div>
              <p class="vp914-output-text mono" data-output-text>请于左侧选定测试物品并校准中央五档发条旋钮，点击 [启动转换] 上紧主发条。所有实验记录将自动同步至 SYS-LOG 审计终端。<span class="vp914-cursor">█</span></p>
              <div class="vp914-easter-slot" data-easter-slot></div>
            </div>
          </div>
        </section>
      </div>
      <div class="vp914-lockdown-overlay" data-lockdown-overlay>
        <div class="vp914-lockdown-card">
          <div class="vp914-lockdown-head mono">⚠ AIRLOCK LOCKDOWN // LAB-914 气闸封锁</div>
          <div class="vp914-lockdown-desc">全站收容失效警报生效中，B 区防爆气闸与主发条联动已锁闭，需 LEVEL 5 (O5) 权限覆写解除。</div>
          <button type="button" class="vp914-override-btn mono" data-override-btn>🔒 O5 OVERRIDE // 解除封锁 [LVL-5]</button>
        </div>
      </div>
    `;
    stageEl.appendChild(rootEl);

    const fxCanvas = rootEl.querySelector('.vp914-fx-canvas');
    const fxCtx = fxCanvas.getContext('2d');
    const gearRotors = gearSpecs.map((gs) => ({
      spec: gs,
      el: rootEl.querySelector(`[data-gear-id="${gs.id}"] [data-gear-rotor]`)
    }));

    const itemBtns = Array.from(rootEl.querySelectorAll('.vp914-item-btn'));
    const detentBtns = Array.from(rootEl.querySelectorAll('.vp914-detent-btn'));
    const knobBtn = rootEl.querySelector('[data-knob-btn]');
    const knobRotor = rootEl.querySelector('[data-knob-rotor]');
    const dialReadout = rootEl.querySelector('[data-dial-readout]');
    const gaugeNeedle = rootEl.querySelector('[data-gauge-needle]');
    const psiValEl = rootEl.querySelector('[data-psi-val]');
    const ledIdle = rootEl.querySelector('[data-led-idle]');
    const ledWind = rootEl.querySelector('[data-led-wind]');
    const ledPeak = rootEl.querySelector('[data-led-peak]');
    const startBtn = rootEl.querySelector('[data-start-btn]');
    const startLabel = rootEl.querySelector('[data-start-label]');
    const startTimer = rootEl.querySelector('[data-start-timer]');
    const progressFill = rootEl.querySelector('[data-progress-fill]');
    const reportBox = rootEl.querySelector('[data-report-box]');
    const reportPair = rootEl.querySelector('[data-report-pair]');
    const reportBadge = rootEl.querySelector('[data-report-badge]');
    const outputTextEl = rootEl.querySelector('[data-output-text]');
    const easterSlotEl = rootEl.querySelector('[data-easter-slot]');
    const codexCountEl = rootEl.querySelector('[data-codex-count]');
    const commendationSealEl = rootEl.querySelector('[data-commendation-seal]');
    const archivedTagEl = rootEl.querySelector('[data-archived-tag]');
    const lockdownOverlay = rootEl.querySelector('[data-lockdown-overlay]');
    const overrideBtn = rootEl.querySelector('[data-override-btn]');
    const veryFineBtn = detentBtns.find((b) => b.dataset.setting === 'very_fine');

    function handleResize() {
      const rect = rootEl.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(240, Math.floor(rect.width));
      height = Math.max(180, Math.floor(rect.height));
      fxCanvas.width = Math.round(width * dpr);
      fxCanvas.height = Math.round(height * dpr);
      fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function getSelectedItem() {
      return ITEMS.find((it) => it.id === selectedItemId) || ITEMS[0];
    }

    function getCurrentSetting() {
      return SETTINGS[settingIndex] || SETTINGS[2];
    }

    function flashDeniedEl(el) {
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

    function updateArchivedIndicators() {
      itemBtns.forEach((btn) => {
        const itemId = btn.dataset.itemId;
        let count = 0;
        SETTINGS.forEach((st) => {
          if (discoveredPairs.has(`${itemId}:${st.id}`)) count += 1;
        });
        const progEl = btn.querySelector('[data-item-prog]');
        if (progEl) {
          progEl.textContent = count === SETTINGS.length ? `✓ ${count}/5` : `${count}/5`;
        }
        btn.classList.toggle('is-item-complete', count === SETTINGS.length);
      });

      detentBtns.forEach((btn) => {
        const key = `${selectedItemId}:${btn.dataset.setting}`;
        btn.classList.toggle('is-archived', discoveredPairs.has(key));
      });

      if (archivedTagEl) {
        const curKey = `${selectedItemId}:${getCurrentSetting().id}`;
        archivedTagEl.classList.toggle('visible', discoveredPairs.has(curKey));
      }
    }

    function syncReadyPairDisplay() {
      updateArchivedIndicators();
      if (isBreach && !breachOverridden) return;
      const item = getSelectedItem();
      const st = getCurrentSetting();
      if (!isProcessing) {
        ctx.setSpecialStatus(`DIAL: ${st.en} // STANDBY`, st.id === 'very_fine', 86400000);
        reportPair.textContent = `QUEUED // [${item.name}] @ [${st.label}]`;
      }
    }

    function updateLockdownUi() {
      const locked = isBreach && !breachOverridden;
      if (lockdownOverlay) {
        lockdownOverlay.classList.toggle('visible', locked);
      }
      rootEl.classList.toggle('is-lockdown', locked);
      rootEl.classList.toggle('is-breach-overridden', isBreach && breachOverridden);
      if (locked) {
        ctx.setSpecialStatus('AIRLOCK SEALED // LVL-5', true, 86400000);
      } else {
        syncReadyPairDisplay();
      }
    }

    function updateClearanceUi() {
      const vfLocked = clearance < 3;
      if (veryFineBtn) {
        veryFineBtn.classList.toggle('is-locked', vfLocked);
        veryFineBtn.textContent = vfLocked ? '🔒超精' : '超精';
        veryFineBtn.title = vfLocked ? '需要 LEVEL 3 安全权限解锁 [VERY FINE] 档位' : '超精加工 (VERY FINE)';
      }

      if (overrideBtn) {
        const canOverride = clearance >= 5;
        overrideBtn.classList.toggle('is-ready', canOverride);
        overrideBtn.textContent = canOverride
          ? '🔓 O5 OVERRIDE // 解除气闸封锁'
          : '🔒 O5 OVERRIDE // 解除封锁 [LVL-5]';
      }

      if (vfLocked && getCurrentSetting().id === 'very_fine' && !isProcessing) {
        settingIndex = 3;
        const st = getCurrentSetting();
        knobBtn.dataset.setting = st.id;
        knobRotor.style.transform = `rotate(${st.angle}deg)`;
        dialReadout.textContent = `MODE: ${st.label} (${st.en})`;
        detentBtns.forEach((b) => {
          b.classList.toggle('active', Number(b.dataset.settingIdx) === settingIndex);
        });
        syncReadyPairDisplay();
        ctx.pushLog('SCP-914 权限降级: [超精] 档位已自动复位至 [精加工]', 'warn');
      }

      if (isBreach && breachOverridden && clearance < 5) {
        breachOverridden = false;
        updateLockdownUi();
        ctx.pushLog('SCP-914 权限降级: LAB-914 气闸封锁重新生效', 'warn');
      }

      if (activeKeycardLvl) {
        renderKeycardOverrideBtn();
      }
    }

    function updateCodexUi(isNew = false, justCompleted = false) {
      if (codexCountEl) {
        codexCountEl.textContent = `DISCOVERED: ${discoveredPairs.size}/20`;
        codexCountEl.classList.toggle('is-complete', discoveredPairs.size >= 20);
        if (isNew) {
          if (codexFlashTimer) clearTimeout(codexFlashTimer);
          codexCountEl.classList.remove('is-new');
          void codexCountEl.offsetWidth;
          codexCountEl.classList.add('is-new');
          codexFlashTimer = setTimeout(() => {
            codexFlashTimer = null;
            if (codexCountEl) codexCountEl.classList.remove('is-new');
          }, 700);
        }
      }

      if (commendationSealEl) {
        const complete = discoveredPairs.size >= 20;
        commendationSealEl.classList.toggle('visible', complete);
        commendationSealEl.setAttribute('aria-hidden', String(!complete));
        if (justCompleted && complete) {
          if (sealFlashTimer) clearTimeout(sealFlashTimer);
          commendationSealEl.classList.remove('is-just-unlocked');
          void commendationSealEl.offsetWidth;
          commendationSealEl.classList.add('is-just-unlocked');
          sealFlashTimer = setTimeout(() => {
            sealFlashTimer = null;
            if (commendationSealEl) commendationSealEl.classList.remove('is-just-unlocked');
          }, 800);
        }
      }
    }

    function renderKeycardOverrideBtn() {
      if (!easterSlotEl) return;
      if (!activeKeycardLvl) {
        easterSlotEl.innerHTML = '';
        return;
      }
      const reqLvl = activeKeycardLvl;
      const alreadyHigh = clearance >= reqLvl;
      easterSlotEl.innerHTML = '';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `vp914-keycard-btn lvl-${reqLvl}${alreadyHigh ? ' is-active' : ''} mono`;
      btn.textContent = alreadyHigh
        ? `✓ 终端已授权 LVL-${reqLvl}+ [点击校验密钥卡]`
        : `◈ 刷卡覆写终端至 LVL-${reqLvl}`;
      btn.title = alreadyHigh
        ? `当前终端权限 LVL-${clearance} 已覆盖该密钥卡等级`
        : `使用 SCP-914 产出的高阶密钥卡直接覆写 SCiPNET 终端至 LEVEL ${reqLvl}`;

      btn.addEventListener('click', () => {
        if (clearance < reqLvl && typeof ctx.setClearance === 'function') {
          ctx.setClearance(reqLvl, { source: 'KEYCARD_914' });
        } else {
          if (ctx.sound) {
            ctx.sound.playClick();
            ctx.sound.playDecrypt();
          }
          ctx.pushLog(`KEYCARD VERIFIED [SCP-914]: 914 高阶密钥卡核验通过 (当前权限 LVL-${clearance} 已达标)`, 'info');
        }
      });

      easterSlotEl.appendChild(btn);
    }

    function setControlsLocked(locked) {
      itemBtns.forEach((b) => {
        b.disabled = locked;
      });
      detentBtns.forEach((b) => {
        b.disabled = locked;
      });
      knobBtn.disabled = locked;
      startBtn.disabled = locked;
      startBtn.classList.toggle('running', locked);
    }

    function selectItem(itemId) {
      if (isProcessing || (isBreach && !breachOverridden) || itemId === selectedItemId) return;
      selectedItemId = itemId;
      if (ctx.sound) ctx.sound.playClick();

      itemBtns.forEach((b) => {
        const isAct = b.dataset.itemId === itemId;
        b.classList.toggle('active', isAct);
        const pip = b.querySelector('[data-item-pip]');
        if (pip) pip.textContent = isAct ? 'LOADED' : 'READY';
      });
      syncReadyPairDisplay();
    }

    function selectSetting(idx) {
      if (isProcessing || (isBreach && !breachOverridden)) return;
      const nextIdx = ((idx % SETTINGS.length) + SETTINGS.length) % SETTINGS.length;
      if (nextIdx === settingIndex) return;
      if (SETTINGS[nextIdx].id === 'very_fine' && clearance < 3) {
        flashDeniedEl(veryFineBtn);
        flashDeniedEl(knobBtn);
        if (typeof ctx.denyAccess === 'function') {
          ctx.denyAccess(
            3,
            'ACCESS DENIED // SCP-914 [VERY FINE] 超精档位需要 LEVEL 3 安全权限',
            'ACCESS DENIED [SCP-914]: VERY FINE 档位需要 LVL-3 权限'
          );
        }
        return;
      }
      settingIndex = nextIdx;
      const st = getCurrentSetting();

      if (ctx.sound) ctx.sound.playGear(2);

      knobBtn.dataset.setting = st.id;
      knobRotor.style.transform = `rotate(${st.angle}deg)`;
      dialReadout.textContent = `MODE: ${st.label} (${st.en})`;

      detentBtns.forEach((b) => {
        b.classList.toggle('active', Number(b.dataset.settingIdx) === settingIndex);
      });

      syncReadyPairDisplay();
      ctx.pushLog(`SCP-914 档位调整: [${st.label} / ${st.en}]`, st.id === 'very_fine' ? 'warn' : 'info');
    }

    function typewriteResult(fullText) {
      if (typewriterTimer) {
        clearInterval(typewriterTimer);
        typewriterTimer = null;
      }

      let cursorPos = 0;
      outputTextEl.textContent = '';
      const cursorSpan = document.createElement('span');
      cursorSpan.className = 'vp914-cursor';
      cursorSpan.textContent = '█';
      const textNode = document.createTextNode('');
      outputTextEl.appendChild(textNode);
      outputTextEl.appendChild(cursorSpan);

      typewriterTimer = setInterval(() => {
        cursorPos = Math.min(fullText.length, cursorPos + 2);
        textNode.textContent = fullText.slice(0, cursorPos);
        reportBox.scrollTop = reportBox.scrollHeight;

        if (cursorPos >= fullText.length) {
          clearInterval(typewriterTimer);
          typewriterTimer = null;
        }
      }, 24);
    }

    function startConversion() {
      if (isProcessing) return;
      if (isBreach && !breachOverridden) return;
      const item = getSelectedItem();
      const st = getCurrentSetting();
      if (st.id === 'very_fine' && clearance < 3) {
        flashDeniedEl(veryFineBtn);
        if (typeof ctx.denyAccess === 'function') {
          ctx.denyAccess(
            3,
            'ACCESS DENIED // SCP-914 [VERY FINE] 超精档位需要 LEVEL 3 安全权限',
            'ACCESS DENIED [SCP-914]: VERY FINE 档位需要 LVL-3 权限'
          );
        }
        return;
      }
      runCount += 1;

      isProcessing = true;
      processStartTs = performance.now();
      setControlsLocked(true);

      startLabel.textContent = `⚙ 运转中 // ${st.short}`;
      reportPair.textContent = `LOG #914-${runCount} // [${item.name}] @ [${st.label}]`;
      reportBadge.textContent = 'PROCESSING';
      reportBadge.className = 'vp914-report-badge warn';

      if (typewriterTimer) {
        clearInterval(typewriterTimer);
        typewriterTimer = null;
      }
      activeKeycardLvl = null;
      if (easterSlotEl) easterSlotEl.innerHTML = '';
      outputTextEl.innerHTML = `发条主轴已咬合，正在对 <b>${item.name}</b> 执行 <b>${st.label} (${st.en})</b> 重构...<span class="vp914-cursor">█</span>`;

      if (ctx.sound) {
        ctx.sound.playClick();
        ctx.sound.playGear(4);
        gearSoundTimer = setInterval(() => {
          if (ctx.sound) ctx.sound.playGear(3);
        }, 310);
      }

      ctx.setSpecialStatus(`DIAL: ${st.en} // REFINING`, true, 3000);
      ctx.updateEnvMetric('torque', st.torque, PROCESS_DURATION_MS + 1200);
      ctx.updateEnvMetric('rad', st.radSpike, PROCESS_DURATION_MS + 2200);
      ctx.triggerHumeSpike(st.humeSpike, `914 CYCLE // ${st.en}`);
      ctx.pushLog(`SCP-914 启动转换: [${item.name}] @ [${st.label}]`, 'info');

      processTimer = setTimeout(() => {
        processTimer = null;
        if (gearSoundTimer) {
          clearInterval(gearSoundTimer);
          gearSoundTimer = null;
        }

        isProcessing = false;
        setControlsLocked(false);
        startLabel.textContent = '⚙ 启动转换 // WIND';
        startTimer.textContent = '2.5s';
        progressFill.style.width = '0%';

        const res = RESULTS[item.id][st.id];
        reportBadge.textContent = res.tag;
        reportBadge.className = `vp914-report-badge ${res.severity}`;

        if (completeRestoreTimer) {
          clearTimeout(completeRestoreTimer);
          completeRestoreTimer = null;
        }
        ctx.setSpecialStatus(`DIAL: ${st.en} // COMPLETE`, res.severity === 'crit', 2600);
        completeRestoreTimer = setTimeout(() => {
          completeRestoreTimer = null;
          if (!isProcessing) {
            const cur = getCurrentSetting();
            ctx.setSpecialStatus(`DIAL: ${cur.en} // STANDBY`, cur.id === 'very_fine', 86400000);
          }
        }, 2600);
        if (ctx.sound) {
          if (typeof ctx.sound.playSteamRelease === 'function') {
            ctx.sound.playSteamRelease();
          } else {
            ctx.sound.playGear(2);
          }
        }

        // Synchronized completion steam exhaust burst across gearbox
        for (let i = 0; i < 12 && steam.length < 36; i++) {
          steam.push({
            x: width * (0.28 + Math.random() * 0.44),
            y: height * (0.45 + Math.random() * 0.35),
            vx: (Math.random() - 0.5) * 32,
            vy: -36 - Math.random() * 34,
            r: 10 + Math.random() * 14,
            life: 0,
            maxLife: 0.75 + Math.random() * 0.45
          });
        }

        const pairKey = `${item.id}:${st.id}`;
        const isNewDiscovery = !discoveredPairs.has(pairKey);
        discoveredPairs.add(pairKey);
        if (item.id === 'card' && st.id === 'very_fine') {
          o5CardForged = true;
        }

        let justHit10 = false;
        let justHit20 = false;
        if (discoveredPairs.size >= 10 && !milestone10Logged) {
          milestone10Logged = true;
          justHit10 = true;
        }
        if (discoveredPairs.size >= 20 && !milestone20Logged) {
          milestone20Logged = true;
          justHit20 = true;
        }

        persist914Store();
        updateCodexUi(isNewDiscovery, justHit20);
        updateArchivedIndicators();

        typewriteResult(res.detail);
        if (item.id === 'card' && (st.id === 'fine' || st.id === 'very_fine')) {
          activeKeycardLvl = st.id === 'very_fine' ? 5 : 3;
          renderKeycardOverrideBtn();
          reportBox.scrollTop = reportBox.scrollHeight;
        }
        ctx.pushLog(`TEST 914-${runCount} [${item.name} -> ${st.label}]: ${res.summary}`, res.severity);

        if (justHit10) {
          ctx.pushLog('[O5-RESEARCH] 50% REFINEMENT MATRIX LOGGED // CONTINUE TESTING', 'warn');
        }
        if (justHit20) {
          if (ctx.sound && typeof ctx.sound.playDecrypt === 'function') {
            ctx.sound.playDecrypt();
          }
          ctx.pushLog(
            '[O5-COUNCIL // ENCRYPTED DISPATCH] SCP-914 20/20 精炼矩阵全量归档完成 — 授予 O5 特别研究嘉奖，实验矩阵已执行黑盒封存 [SEAL: O5-914-OMEGA]',
            'o5'
          );
        }
      }, PROCESS_DURATION_MS);
    }

    /* ======================================================================
       CANVAS 2D STEAM & SPARK FX + SVG GEAR/GAUGE ANIMATION LOOP
       ====================================================================== */
    function spawnParticles(dt) {
      if (isProcessing) {
        // Metallic sparks erupting near center gearbox seam
        const sparkRate = 28 * dt;
        const count = Math.floor(sparkRate) + (Math.random() < sparkRate % 1 ? 1 : 0);
        for (let i = 0; i < count && sparks.length < 70; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 70 + Math.random() * 190;
          sparks.push({
            x: width * (0.34 + Math.random() * 0.32),
            y: height * (0.28 + Math.random() * 0.44),
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 45,
            life: 0,
            maxLife: 0.25 + Math.random() * 0.32,
            hot: Math.random() > 0.3
          });
        }

        // Pressurized steam puffs
        if (steam.length < 28 && Math.random() < 0.45) {
          steam.push({
            x: width * (0.26 + Math.random() * 0.48),
            y: height * (0.55 + Math.random() * 0.3),
            vx: (Math.random() - 0.5) * 18,
            vy: -28 - Math.random() * 28,
            r: 8 + Math.random() * 12,
            life: 0,
            maxLife: 0.8 + Math.random() * 0.55
          });
        }
      } else if (steam.length < 6 && Math.random() < 0.03) {
        // Rare idle residual steam wisp
        steam.push({
          x: width * (0.3 + Math.random() * 0.4),
          y: height * 0.78,
          vx: (Math.random() - 0.5) * 8,
          vy: -14 - Math.random() * 10,
          r: 7 + Math.random() * 8,
          life: 0,
          maxLife: 1.1
        });
      }
    }

    function renderParticles(dt) {
      fxCtx.clearRect(0, 0, width, height);
      spawnParticles(dt);

      // Draw rising steam puffs
      for (let i = steam.length - 1; i >= 0; i--) {
        const p = steam[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          steam.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += 16 * dt;
        const alpha = (1 - p.life / p.maxLife) * (isProcessing ? 0.14 : 0.06);
        fxCtx.fillStyle = `rgba(202, 214, 228, ${alpha.toFixed(3)})`;
        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        fxCtx.fill();
      }

      // Draw metallic spark streaks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += dt;
        if (s.life >= s.maxLife) {
          sparks.splice(i, 1);
          continue;
        }
        const prevX = s.x;
        const prevY = s.y;
        s.vy += 280 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const alpha = 1 - s.life / s.maxLife;
        fxCtx.strokeStyle = s.hot
          ? `rgba(255, 212, 110, ${alpha.toFixed(2)})`
          : `rgba(255, 110, 48, ${alpha.toFixed(2)})`;
        fxCtx.lineWidth = 1.4;
        fxCtx.beginPath();
        fxCtx.moveTo(prevX, prevY);
        fxCtx.lineTo(s.x, s.y);
        fxCtx.stroke();
      }
    }

    function tick(nowMs) {
      const dt = Math.min(0.1, Math.max(0.001, (nowMs - lastFrameTs) / 1000));
      lastFrameTs = nowMs;

      // Smoothly ramp gear speed and analog gauge pressure
      const st = getCurrentSetting();
      const targetMult = isProcessing ? 16.0 : 1.0;
      speedMult += (targetMult - speedMult) * Math.min(1, dt * (isProcessing ? 5.5 : 3.2));
      gearBaseDeg = (gearBaseDeg + dt * 5.2 * speedMult) % 36000;

      for (let i = 0; i < gearRotors.length; i++) {
        const gr = gearRotors[i];
        const ratio = 18 / gr.spec.teeth;
        const angle = (gearBaseDeg * ratio * gr.spec.dir) % 360;
        gr.el.setAttribute('transform', `rotate(${angle.toFixed(2)})`);
      }

      const targetPressure = isProcessing
        ? st.id === 'very_fine'
          ? 0.96
          : st.id === 'fine'
          ? 0.91
          : 0.85
        : 0.22;
      pressureRatio += (targetPressure - pressureRatio) * Math.min(1, dt * (isProcessing ? 4.5 : 2.8));

      const jitter = isProcessing
        ? Math.sin(nowMs * 0.045) * 0.032 + (Math.random() - 0.5) * 0.025
        : Math.sin(nowMs * 0.012) * 0.006 + (Math.random() - 0.5) * 0.004;
      const pShown = Math.max(0.04, Math.min(1, pressureRatio + jitter));
      const needleDeg = -90 + pShown * 180;
      gaugeNeedle.setAttribute('transform', `rotate(${needleDeg.toFixed(1)} 50 46)`);

      const psi = Math.round(pShown * 1000);
      const isPeak = pShown >= 0.78;
      psiValEl.textContent = `${psi} PSI`;
      psiValEl.classList.toggle('red', isPeak);

      ledIdle.className = `vp914-led-dot ${!isProcessing ? 'on-amber' : ''}`;
      ledWind.className = `vp914-led-dot ${isProcessing ? 'on-amber' : ''}`;
      ledPeak.className = `vp914-led-dot ${isPeak ? 'on-red' : ''}`;

      if (isProcessing) {
        const elapsed = nowMs - processStartTs;
        const pct = Math.min(100, (elapsed / PROCESS_DURATION_MS) * 100);
        const rem = Math.max(0, (PROCESS_DURATION_MS - elapsed) / 1000);
        progressFill.style.width = `${pct.toFixed(1)}%`;
        startTimer.textContent = `${rem.toFixed(1)}s`;
      }

      renderParticles(dt);
      rafId = requestAnimationFrame(tick);
    }

    /* ======================================================================
       EVENT BINDINGS & CLEANUP
       ====================================================================== */
    itemBtns.forEach((btn) => {
      btn.addEventListener('click', () => selectItem(btn.dataset.itemId));
    });

    knobBtn.addEventListener('click', () => selectSetting(settingIndex + 1));

    detentBtns.forEach((btn) => {
      btn.addEventListener('click', () => selectSetting(Number(btn.dataset.settingIdx)));
    });

    startBtn.addEventListener('click', startConversion);

    if (overrideBtn) {
      overrideBtn.addEventListener('click', () => {
        if (clearance < 5) {
          flashDeniedEl(overrideBtn);
          if (typeof ctx.denyAccess === 'function') {
            ctx.denyAccess(
              5,
              'ACCESS DENIED // LAB-914 气闸封锁覆写需要 LEVEL 5 (O5) 安全权限',
              'ACCESS DENIED [SCP-914]: 气闸封锁覆写需要 LVL-5 权限'
            );
          }
          return;
        }
        breachOverridden = true;
        if (ctx.sound) {
          ctx.sound.playClick();
          ctx.sound.playDecrypt();
        }
        updateLockdownUi();
        ctx.pushLog('O5 OVERRIDE [SCP-914]: LAB-914 气闸封锁已覆写解除', 'warn');
      });
    }

    window.addEventListener('resize', handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(rootEl);
    }

    handleResize();
    updateCodexUi(false, false);
    updateArchivedIndicators();
    updateClearanceUi();
    updateLockdownUi();
    rafId = requestAnimationFrame(tick);

    return {
      unmount() {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (processTimer) {
          clearTimeout(processTimer);
          processTimer = null;
        }
        if (gearSoundTimer) {
          clearInterval(gearSoundTimer);
          gearSoundTimer = null;
        }
        if (typewriterTimer) {
          clearInterval(typewriterTimer);
          typewriterTimer = null;
        }
        if (completeRestoreTimer) {
          clearTimeout(completeRestoreTimer);
          completeRestoreTimer = null;
        }
        if (codexFlashTimer) {
          clearTimeout(codexFlashTimer);
          codexFlashTimer = null;
        }
        if (sealFlashTimer) {
          clearTimeout(sealFlashTimer);
          sealFlashTimer = null;
        }
        if (resizeObserver) {
          resizeObserver.disconnect();
          resizeObserver = null;
        }
        window.removeEventListener('resize', handleResize);
        if (ctx.hostEl) {
          ctx.hostEl.classList.remove('has-console-layout');
        }
        ctx.clearSpecialStatus();
        rootEl.remove();
      },
      onBreachChange(active) {
        isBreach = Boolean(active);
        if (!isBreach) {
          breachOverridden = false;
        }
        updateLockdownUi();
        if (isBreach) {
          ctx.pushLog('LOCKDOWN [SCP-914]: 全站收容失效，B 区气闸已自动封锁 (需 LVL-5 覆写)', 'crit');
        }
      },
      onClearanceChange(level) {
        clearance = Number(level) || 1;
        updateClearanceUi();
      }
    };
  }

  window.Viewport914 = { create };

  if (window.LiveViewport) {
    window.LiveViewport.registerModule('SCP-914', create);
  }
})();
