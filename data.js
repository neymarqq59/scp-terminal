// SCP Foundation SCiPNET Classified Archive Database
// Markup syntax for interactive redaction blocks:
//   {{R3:text}} -> Requires Security Clearance Level 3
//   {{R5:text}} -> Requires Security Clearance Level 5 (O5 Override)

window.SCP_DATABASE = [
  {
    id: 'SCP-173',
    code: '173',
    title: '雕塑 — 最初之作',
    subtitle: 'THE SCULPTURE — ORIGIN SPECIMEN',
    objectClass: 'EUCLID',
    disruptionClass: 'VLAM',
    riskClass: 'DANGER',
    sector: 'SITE-19 // SECTOR-C // CELL-173-A',
    supervisor: 'DR. {{R3:S. GLASS}} (LVL-3)',
    lastUpdated: '2026-10-14 04:12 UTC',
    revision: 'REV 19.4.2',
    summary: '混凝土与钢筋构成的自主雕塑实体，在失去直接视线接触时以极高速度移动并折断颈椎。',
    procedures: [
      '项目 SCP-173 必须始终保存在一个上锁的高强度钢筋混凝土收容室内。收容室尺寸为 6m × 6m × 4m，地面须向中央排水口保持 2° 倾角，以便定期清理排泄物。',
      '当有人员必须进入 SCP-173 的收容室进行例行清洁或维护时，进入人数不得少于 {{R3:3 名受过视觉交替训练的 D 级人员（最低配额：2 名观察员 + 1 名作业员）}}，且防爆气闸门必须在人员全部进入后立即从外部锁闭。',
      '在任何时候，至少有两名人员必须与 SCP-173 保持直接、无遮挡的眼神接触，直至所有人员彻底撤离并重新锁闭收容室。人员在眨眼前必须通过声学信号（口头报数“BLINK-3-2-1”）进行交替接管；禁止使用 {{R3:单向透视镜或纯数字延迟摄像头替代直接人工目视，因 14ms 的视频帧缓冲曾导致 201█ 年的收容失效}}。',
      '每两周需对收容室地面上的红褐色未知混合排泄物（成分经光谱分析为粪便与 {{R3:O 型人类静脉血液，DNA 序列与任何已知登记人员不匹配}}）进行高压中性清洗。{{R5:【O5-04 补充指令】：严禁在收容室内使用任何基于休谟稳定锚（SRA）的高功率场发生器。1998 年的内部实验表明，强行将局部休谟指数压低至 0.65 Hm 以下会导致 SCP-173 出现不可预测的自我复制征兆。}}'
    ],
    description: [
      'SCP-173 于 1993 年由机动特遣队回收并移送至 Site-19，其确切起源至今仍处于 {{R3:高度机密档案 [FILE-173-ORIGIN] 封存状态，仅知回收地点位于北美某废弃混凝土掩体地下三层}}。',
      '该实体由普通浇筑混凝土与建筑用螺纹钢筋构成，面部及躯干表面残留有 Krylon 品牌工业喷漆痕迹。SCP-173 具有高度敌意且处于某种非生物活性状态，但在处于任何具备神经感知能力生物的直接视野范围内时，该实体完全无法移动。',
      '视线接触绝对不可中断。据光学高速摄影与地面微震动传感器测算，在失去目视接触的 {{R3:约 0.08 至 0.16 秒内}}，SCP-173 可瞬间跨越 6 米收容空间，移动瞬时加速度超过 {{R3:420 m/s²（且不产生与之匹配的空气激波）}}。',
      '该实体报告的攻击方式为从后方折断目标颅底颈椎，或通过极高握力实施颈部绞杀。在无人员进入收容室的静默期间，隔墙拾音器频繁记录到类似石块在粗糙地面摩擦的刮擦声；此现象被视为常态，但若刮擦声频率发生突变或完全停止超过 {{R3:180 秒}}，现场值班主管必须立即启动二级戒备。',
      '{{R5:【最高机密 — 休谟与现实锚定分析】：康德计数器长期遥测显示，SCP-173 周围存在一个半径约 1.8 米的微弱高休谟壳层（1.18~1.34 Hm）。当观察者视线锁定实体时，该壳层呈现量子观测坍缩般的锁定稳态；一旦视线中断，休谟读数在毫秒级内跃升并引发局部动量守恒违背。部分 O5 议会成员怀疑 SCP-173 并非唯一实体，而是某个已灭绝异常艺术团体“Are We Cool Yet?”早期原型计划的失控遗留物。}}'
    ],
    addenda: [
      {
        code: 'ADDENDUM 173-A // 清洁日志节选 #884',
        clearance: 1,
        content: '时间：2026-09-02 14:30 UTC。三名 D 级人员执行例行排泄物清理。第 4 分钟时，收容室照明模块 B-2 出现 0.4 秒电压骤降。备用应急钨丝灯在 12 毫秒内介入，未造成人员伤亡。事后检查发现 SCP-173 相对初始坐标位移了 {{R3:1.42 米，且朝向精准对准当时正在换气的 D-4912}}。照明回路已升级为双路不间断直流冗余供电。'
      },
      {
        code: 'ADDENDUM 173-B // 跨项目测试否决令',
        clearance: 3,
        content: '关于将 SCP-173 投入 SCP-682 处决程序的第 4 次复议申请已被站点主管正式驳回。历史测试记录（归档编号 {{R3:EXP-682-173-01}}）证实，虽然 SCP-173 成功造成 SCP-682 颈部严重创伤，但 SCP-682 随后迅速演化出 {{R5:12 枚覆盖防弹角质层的复合眼球，覆盖 360° 全向视野，彻底锁死 SCP-173 长达 6 小时直至机动特遣队强行介入分离}}。'
      }
    ],
    hume: {
      baseline: 1.0,
      nominal: 1.22,
      variance: 0.08,
      spikeChance: 0.045,
      spikeMagnitude: 0.34,
      warnThreshold: 1.48,
      critThreshold: 1.75,
      waveMode: 'euclid_step'
    },
    telemetry: [
      { id: 'temp', label: 'CHAMBER TEMP', cn: '收容室温度', unit: '°C', base: 18.4, jitter: 0.3, min: 0, max: 50, warn: 35, crit: 42 },
      { id: 'pressure', label: 'AIRLOCK PRESS', cn: '气闸室气压', unit: 'kPa', base: 101.3, jitter: 0.2, min: 80, max: 120, warn: 112, crit: 116 },
      { id: 'acoustic', label: 'SCRAPE DB', cn: '刮擦声学分贝', unit: 'dB', base: 34.2, jitter: 5.5, min: 0, max: 100, warn: 68, crit: 85 },
      { id: 'integrity', label: 'WALL INTEGRITY', cn: '混凝土墙体完整度', unit: '%', base: 99.1, jitter: 0.1, min: 0, max: 100, invert: true, warn: 85, crit: 70 }
    ],
    specialStatus: {
      label: 'OPTICAL LOCK MONITOR',
      cn: '目视锁定监控',
      mode: 'blink_cycle'
    }
  },
  {
    id: 'SCP-682',
    code: '682',
    title: '不灭孽蜥',
    subtitle: 'HARD-TO-DESTROY REPTILE',
    objectClass: 'KETER',
    disruptionClass: 'EKHI',
    riskClass: 'CRITICAL',
    sector: 'SITE-19 // HEAVY CONTAINMENT // VAT-09',
    supervisor: 'O5-{{R5:04}} / DR. GEARS',
    lastUpdated: '2026-11-18 22:47 UTC',
    revision: 'REV 44.9.0-K',
    summary: '具备极端再生能力、适应性演化与全生命体敌意的大型爬虫类异常实体，需持续浸没于高浓度盐酸池中。',
    procedures: [
      'SCP-682 必须尽快被彻底摧毁。在当前基金会技术条件下，尚无可行手段能够对 SCP-682 实施永久性处决，仅能对其造成大面积物理破坏以延缓其突破行动。',
      'SCP-682 须收容于一座尺寸为 5m × 5m × 5m 的加固型室内收容池内，池壁铺设厚达 {{R3:25.4 cm 的耐强酸特种哈氏合金钢板}}。收容池内部必须持续注满高浓度盐酸（HCl，摩尔浓度维持在 36% 以上），直至实体被完全浸没且失去行动能力。',
      '一旦 SCP-682 出现移动、发声或试图破坏收容壁的任何迹象，现场安保部队必须立即使用 {{R3:热能干扰弹与高能镇静神经毒素混合液}} 进行压制，并向站点战术指挥中心发出 KETER 级警报。',
      '严禁任何非授权人员与 SCP-682 进行语言交谈，以防激怒实体或触发认知诱导风险。{{R5:【O5 终极应急协议 — OMEGA-682】：若收容池完整度跌破 35% 且机动特遣队 Nu-7（“落锤”）无法在 12 分钟内建立二次防线，允许现场指挥官解锁站内战术核装置 [WARHEAD-19-ALPHA]，但在启动前必须确认不会反而促使实体产生高能电离辐射适应性。}}'
    ],
    description: [
      'SCP-682 是一头体型庞大、起源未知的爬虫类生物。该实体表现出极高的智力水平，在有限的接触记录中能够流利使用人类语言，并展现出与 {{R3:SCP-079（旧 AI）}} 进行复杂战术协作的能力。',
      'SCP-682 对所有已知生命形态均怀有极度厌恶与敌意，其原因在历次审讯中仅被实体模糊描述为“他们令人作呕”。该实体拥有远超常规生物极限的力量、爆发速度与神经反射，且其具体生理参数随当前形态剧烈变化。',
      'SCP-682 能够以惊人的速率改变自身生理结构与质量。通过吞噬任何有机或无机物质，实体可在数分钟内完成组织重构。其消化系统极其高效，鼻孔内的特殊鳃状过滤器官能够从任何液体或气体介质中提取能量，即便在持续浸泡于浓盐酸的环境中仍能维持生命体征。',
      '在过去进行的 {{R3:17 次大规模收容突破记录}} 中，SCP-682 曾承受包括高爆穿甲弹、液氮急速冷冻、{{R3:强激光切割阵列与轨道动能打击模拟}} 在内的毁灭性伤害。即便全身 87% 的生物质遭到汽化或溶解，剩余残骸仍能保持发声能力并在数小时内再生出具备针对性抗性的新组织。',
      '{{R5:【O5 机密生物现实报告】：高灵敏度休谟波形分析揭示，SCP-682 的“不可毁灭性”并非单纯的细胞再生，而是一种局部本体论排斥效应。每当致命外力作用于实体时，其周围休谟指数会剧烈飙升至 2.00 Hm 以上，仿佛基准现实本身在强行“重写”导致其死亡的因果链。有档案暗示其与 [数据删除：深红之王第四子嗣] 存在本体论关联。}}'
    ],
    addenda: [
      {
        code: 'ADDENDUM 682-B // 审讯录音抄录 [AUDIO-682-09]',
        clearance: 1,
        content: '受访者：SCP-682（处于酸液半溶解状态）。询问者：Dr. ██████。实体在沉默 40 秒后以嘶哑声带发声：“……你们以为这池酸水能关住我多久？当我的表皮完成对氯离子的晶格重构，你们所有人都会化作残渣。” 随后实体突然撞击观察窗，造成 {{R3:外层防爆石英玻璃出现 14mm 辐射状裂纹}}，审讯立即中止。'
      },
      {
        code: 'ADDENDUM 682-E // 处决实验档案 [TERM-LOG-682-096]',
        clearance: 5,
        content: '实验摘要：尝试令 SCP-096 观测 SCP-682 触发处决冲突。双方在重型隔离测试区爆发长达 {{R5:27 小时的极端暴力对抗}}。最终 SCP-682 损失约 85% 质量，但 SCP-096 首次表现出极度惊恐与退缩行为，蜷缩于墙角拒绝再次正视 SCP-682。{{R5:此后禁止任何涉及 SCP-096 与 SCP-682 的二次交叉接触。}}'
      }
    ],
    hume: {
      baseline: 1.0,
      nominal: 1.58,
      variance: 0.22,
      spikeChance: 0.085,
      spikeMagnitude: 0.72,
      warnThreshold: 1.75,
      critThreshold: 2.05,
      waveMode: 'keter_chaotic'
    },
    telemetry: [
      { id: 'hcl', label: 'HCl CONCENTRATION', cn: '盐酸溶液浓度', unit: '%', base: 36.8, jitter: 0.6, min: 0, max: 45, invert: true, warn: 32, crit: 28 },
      { id: 'temp', label: 'VAT CORE TEMP', cn: '酸液池核心温度', unit: '°C', base: 44.6, jitter: 1.8, min: 10, max: 90, warn: 62, crit: 75 },
      { id: 'biomass', label: 'BIOMASS REGEN', cn: '异常质量再生率', unit: '%', base: 19.4, jitter: 4.2, min: 0, max: 100, warn: 45, crit: 70 },
      { id: 'integrity', label: 'ALLOY BULKHEAD', cn: '哈氏合金舱壁完整度', unit: '%', base: 86.2, jitter: 0.7, min: 0, max: 100, invert: true, warn: 75, crit: 55 }
    ],
    specialStatus: {
      label: 'CONTAINMENT THREAT',
      cn: '突破威胁状态',
      mode: 'keter_alert'
    }
  },
  {
    id: 'SCP-914',
    code: '914',
    title: '万能转换机',
    subtitle: 'THE CLOCKWORKS',
    objectClass: 'SAFE',
    disruptionClass: 'DARK',
    riskClass: 'NOTICE',
    sector: 'SITE-19 // RESEARCH FACILITY-B // LAB-914',
    supervisor: 'DR. GEARS / DR. DARBY',
    lastUpdated: '2026-11-05 09:18 UTC',
    revision: 'REV 11.2.8',
    summary: '重达数吨的精密发条机械装置，拥有五档加工旋钮，可将输入物体进行从粗糙拆解到超常精炼的物质重构。',
    procedures: [
      'SCP-914 目前存放于 Site-19 研究设施 B 区 109-B 号标准收容实验室内，门禁系统由两名全副武装的 2 级安保人员全天候值守。',
      '任何申请使用 SCP-914 的研究人员必须提前提交书面实验提案（表格 914-T），并获得 {{R3:站点研究主管或至少一名 3 级高级研究员的电子签名授权}}。所有实验输出物在离开收容室前必须接受辐射、生物活性及模因危害三项基础扫描。',
      '绝对禁止在未经 O5 议会书面特批的情况下，将任何活体生物组织或人类受试者置入 SCP-914 的“输入”舱。任何违反此条例的人员将立即面临 {{R3:降级为 D 级人员或直接处决的纪律处分}}。',
      '{{R5:【O5-02 附加备忘】：严禁将任何具备认知危害属性或休谟指数偏离基准超过 ±0.25 Hm 的 SCP 项目放入 SCP-914 进行“超精加工（Very Fine）”测试。201█ 年的未授权实验 [INC-914-VF] 差点导致研究设施 B 区局部物理常数重写。}}'
    ],
    description: [
      'SCP-914 是一台重达数吨、占地约 18 平方米的大型发条机械装置，由超过 {{R3:8,000,000 个独立运转的黄铜、锡、铜及特种合金齿轮、发条、滑轮与弹簧}} 精密咬合而成。尽管内部结构极其复杂，但设备不依赖任何外部电力输入，所有机械能似乎仅来源于手动上弦的主发条。',
      '装置主体正面设有一枚大型机械选择旋钮，标注有五个档位：粗加工（Rough）、半粗加工（Coarse）、1:1、精加工（Fine）以及超精加工（Very Fine）。旋钮下方为一根铜质启动发条钥匙。装置两侧各设有一间 3m × 2.1m × 2.1m 的铜质隔舱，分别标记为“输入（Intake）”与“输出（Output）”。',
      '当物体放入输入舱、关闭舱门并拧动发条后，SCP-914 会在 5 至 10 分钟内运转，期间未检测到任何显著热量释放或质量守恒违背——然而输出物体的结构、成分甚至物理性质将依据所选档位发生剧烈且不可逆的重构。',
      '经长时间观测发现，SCP-914 在“超精加工（Very Fine）”档位下经常表现出某种 {{R3:疑似具备讽刺意味的微弱自主意图}}。例如将普通标准手枪投入超精档位后，输出了一把能够发射 {{R3:微型定向电离等离子脉冲但每次开火都会随机擦除射手 3 秒短期记忆}} 的异常武器。',
      '{{R5:【内部机理分析】：在 SCP-914 运转期间，高精度康德计数器在其核心传动箱内测得周期性的 1.00~1.09 Hm 精密谐波脉冲。理论物理部推测，该装置并非通过宏观机械切割重塑物质，而是利用某种古老且高度受控的微观现实编织机制，在原子尺度上执行“概念级重构”。}}'
    ],
    addenda: [
      {
        code: 'TEST LOG 914-0142 // 工业钢材与芯片测试',
        clearance: 1,
        content: '输入：1 kg 标准不锈钢锭 + 1 块商用微处理器。设置：精加工（Fine）。输出：一枚高密度自散热金属晶格计算核心，在无外部散热条件下运算效率提升 420%，但内部电路拓扑结构无法被现有电子显微镜逆向解析。该产物已移交 {{R3:站点工程部用于辅助 SCiPNET 加密终端升级}}。'
      },
      {
        code: 'TEST LOG 914-0988 // 生物体违规测试记录 [封存]',
        clearance: 5,
        content: '输入：1 名 D 级人员（D-186）。设置：超精加工（Very Fine）。结果：受试者走出输出舱后体能指标提升至人类生理极限的 300%，随后表现出极端攻击性并徒手撕裂两道防爆门，最终由安保小队击毙。尸检发现其骨骼已重构为 {{R5:具备压电特性的碳纳米管蜂窝结构，大脑松果体位置检测出微弱休谟发射源}}。'
      }
    ],
    hume: {
      baseline: 1.0,
      nominal: 1.03,
      variance: 0.03,
      spikeChance: 0.025,
      spikeMagnitude: 0.12,
      warnThreshold: 1.25,
      critThreshold: 1.45,
      waveMode: 'safe_harmonic'
    },
    telemetry: [
      { id: 'temp', label: 'LAB AMBIENT', cn: '实验室环境温度', unit: '°C', base: 21.2, jitter: 0.15, min: 10, max: 40, warn: 30, crit: 36 },
      { id: 'torque', label: 'MAINSPRING', cn: '主发条张力扭矩', unit: 'N·m', base: 412.5, jitter: 6.4, min: 0, max: 800, warn: 650, crit: 740 },
      { id: 'rad', label: 'RESIDUAL RAD', cn: '输出舱残留辐射', unit: 'μSv/h', base: 0.14, jitter: 0.04, min: 0, max: 5, warn: 2.0, crit: 3.5 },
      { id: 'integrity', label: 'CHAMBER SEAL', cn: '铜质隔舱气密性', unit: '%', base: 99.8, jitter: 0.05, min: 0, max: 100, invert: true, warn: 90, crit: 80 }
    ],
    specialStatus: {
      label: 'GEARBOX DIAL STATE',
      cn: '机械档位遥测',
      mode: 'safe_dial'
    }
  }
];
