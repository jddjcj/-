/* 游戏主逻辑：角色、时间、行动、剧情、存档。 */
(function () {
  'use strict';

  const SAVE_VERSION = 2;
  const MAX_OFFLINE = 8 * 3600;
  const REALMS = [
    { name:'咒力未觉',   need:400 },     { name:'见习咒术师', need:1100 },
    { name:'三级咒术师', need:3500 },    { name:'二级咒术师', need:10000 },
    { name:'一级咒术师', need:28000 },   { name:'准特级',     need:80000 },
    { name:'特级咒术师', need:230000 },  { name:'领域之主',   need:650000 },
    { name:'天与觉醒',   need:1500000 }, { name:'咒术顶点',   need:2800000 }
  ];
  const SHICHEN = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  window.JH_REALM_NEEDS = REALMS.map(r => r.need);
  const ACTION_COST = 8, SEARCH_COST = 6;
  const JH_SP_START = 3;           
  const TRAVEL_SEC = 8;            
  const TRAVEL_CROSS_SEC = 600;    
  const TRAVEL_TEST_SEC = 3;       

  const ROOM = {}, SCENE = {}, NPC = {}, ITEM = {}, MART = {}, SECT = {};
  function buildIndex() {
    for (const x of window.JH_ROOMS)   ROOM[x.id] = x;
    for (const x of window.JH_SCENES)  SCENE[x.id] = x;
    for (const x of window.JH_NPCS)    NPC[x.id] = x;
    for (const x of window.JH_ITEMS)   ITEM[x.id] = x;
    for (const x of window.JH_MARTIAL) MART[x.id] = x;
    for (const x of window.JH_SECTS)   SECT[x.id] = x;
    window.JH_ROOM_MAP = ROOM; window.JH_NPC_MAP = NPC;
  }
  buildIndex();

  



  const GAME_DAY_SEC = 12 * 3600;                   
  const SEC_PER_GAME_MIN = GAME_DAY_SEC / 1440;     
  function gameMin(s) { return Math.floor(s.t / SEC_PER_GAME_MIN); }
  function gameHour(s) { return Math.floor(s.t / (SEC_PER_GAME_MIN * 60)) % 24; }
  function shichenIdx(s) { return Math.floor(gameHour(s) / 2) % 12; }
  function shichenName(s) { return SHICHEN[shichenIdx(s)] + '时'; }
  function dayCount(s) { return Math.floor(s.t / GAME_DAY_SEC) + 1; }
  function clockText(s) {
    const h = gameHour(s), m = gameMin(s) % 60;
    return `第 ${dayCount(s)} 日 · ${SHICHEN[shichenIdx(s)]}时 · ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  let s = null;
   
  let forLan = false;

  function newState(name) {
    return {
      v: SAVE_VERSION,
      name: (name || '无名咒术师').slice(0, 12),
      made: false, t: 0, lastSave: Date.now(),
      origin: null, faceCap: 100,
      realm: 0, exp: 0,
      hp: 100, cur: 80,
      silver: 50, fame: 0,
      attrs: { insight: 50, root: 50, luck: 20, face: 20 },
      ce: { eff: 0.30, ctl: 0.30, cap: 0.80 },
      innate: [], innateLv: {}, innateExp: {}, innateOff: {}, domain: [],
      skills: {}, skillLv: {}, tech: { atk: null, nei: null, qing: null },
      activeAtk: [], activeNei: [], activeQing: [], party: {}, csmBank: 0,
      sta: 100, buff: null,
      act: null, travel: null, bf: { t: [] }, clear: {},
      sp: JH_SP_START, curBonus: 0, out: { phy: 50, cur: 50 },
      items: { pill_mini: 3, food_onigiri: 3 },
      equip: { weapon: null, armor: null, charm: null, boots: null },
      sect: 's_none', sectJoined: [], contrib: 0, sectDaily: 0,
      aff: {}, met: {},
      borrow: {}, tamed: {}, secret: {},
      flags: {}, storyDone: {}, event: null, defer: {},
      scene: 'sc_shibuya', room: 'r_sb_cross',
      idle: { on: false, room: 'r_sb_cross' },
      forge: {}, nearDeath: 0, ndBoost: 0, trials: {},
      cd: {}, overload: 0, castStreak: 0, ndUsed: 0,
      domForm: 'closed', domFeed: 0,         
      music: { on: false, track: 0, vol: 0.5 },
      spar: { day: 0, list: [], count: {} },
      mirror: null,
      c: { search:{}, visit:{}, action:{}, talk:{}, talkDay:{}, click:{}, idle:{}, crit:0, win:0, lose:0, winStreak:0 },
      eggs: {}, titles: {}, codex: {},
      log: [], stats: { kills: 0, searched: 0, moves: 0, breakthroughs: 0 }
    };
  }

  function create(name, creation) {
    s = newState(name);
    const O = window.JH_ORIGIN_MAP[creation.origin];
    s.made = true;
    s.origin = creation.origin;
    s.faceCap = creation.faceCap != null ? creation.faceCap : 100;
    s.attrs = {
      insight: creation.attrs.insight, root: creation.attrs.root,
      luck: creation.attrs.luck, face: creation.attrs.face
    };
    s.ce = { eff: creation.ce.eff, ctl: creation.ce.ctl, cap: creation.ce.cap };
    s.innate = (creation.innate || []).slice();
    for (const id of s.innate) { s.innateLv[id] = 1; s.innateExp[id] = 0; }
    



    if (O && O.extra) {
      if (O.extra.giftDomainAt) for (const tid of s.innate) s.innateLv[tid] = Math.max(s.innateLv[tid] || 1, Math.min(10, O.extra.giftDomainAt));
      

      if (O.extra.barrier) { s.skills.k_barrier = 1; s.skillLv.k_barrier = Math.max(s.skillLv.k_barrier || 1, forLan ? O.extra.barrier : 1); }
      if (O.extra.skillBonus) for (const sk of Object.keys(O.extra.skillBonus)) {
        if (!MART[sk]) continue;
        if (!s.skills[sk]) { s.skills[sk] = 1; s.skillLv[sk] = 1; }
        s.skillLv[sk] = (s.skillLv[sk] || 1) + O.extra.skillBonus[sk];
      }
    }
    



    if (forLan) {
      s.skills.k_barrier = 1;
      s.skillLv.k_barrier = Math.max(s.skillLv.k_barrier || 1, (MART.k_barrier && MART.k_barrier.maxLv) || 3);
      for (const tid of s.innate) {
        if (!window.JH_INNATE_MAP[tid]) continue;
        s.innateLv[tid] = Math.max(s.innateLv[tid] || 1, 10);
        s.innateExp[tid] = Math.max(s.innateExp[tid] || 0, (window.JH_TECH_LV && window.JH_TECH_LV[10]) || 26000);
      }
    }
    let spUsed = 0;
    for (const kv of Object.entries(creation.common || {})) {
      if (!MART[kv[0]]) continue;
      s.skills[kv[0]] = 1; s.skillLv[kv[0]] = kv[1];
      spUsed += kv[1];
    }
     
    if (O && O.extra && O.extra.blackFlash) {
      s.skills.k_black = 1;
      s.skillLv.k_black = (creation.common && creation.common.k_black) || 0;
    }
    s.sp = Math.max(0, JH_SP_START - spUsed);
    for (const tid of s.innate) {
      const t = window.JH_INNATE_MAP[tid];
      if (!t) continue;
      for (const sid of t.skills) {
        const m = MART[sid];
        if (m && (m.lv || 0) <= 1) learn(sid);
      }
    }
    


    syncInnateSkills();
     
    if (O && O.extra && O.extra.reverseStart && MART.k_reverse && !s.skills.k_reverse) {
      s.skills.k_reverse = 1;
      if (!s.skillLv.k_reverse) s.skillLv.k_reverse = 1;
      log('六眼之下，你一眼就看穿了咒力的「反向」——你学会了「反转术式」。', 'learn');
    }
    

    if (!devEditable()) {
      for (const kind of ['atk', 'nei', 'qing']) {
        const arr = activeArray(s, kind), cap = slotsOf(s, kind);
        for (const id of Object.keys(s.skills)) {
          const m = MART[id];
          if (!m || m.kind !== kind) continue;
          if (arr.indexOf(id) >= 0) continue;
          if (m.innate || usedOf(s, kind) < cap) arr.push(id);
        }
      }
    }
    syncTech();
    s.silver = 50 + ((O && O.init.silver) || 0);
    

    if (creation.bag) {
      const g = creation.bag;
      for (const k of Object.keys(g.items || {})) {
        if (!ITEM[k]) continue;
        const n = Math.max(0, Math.min(9999, Math.round(g.items[k] || 0)));
        if (isEquipItem(k)) { if (n > 0) s.items[k] = 1; else delete s.items[k]; }
        else if (n > 0) s.items[k] = n; else delete s.items[k];
      }
      for (const k of EQUIP_TYPES) { const id = g.equip && g.equip[k]; if (id && ITEM[id]) s.equip[k] = id; }
      if (g.forge) for (const k of Object.keys(g.forge)) if (ITEM[k] && g.forge[k]) s.forge[k] = g.forge[k];
      if (g.silver != null && isFinite(g.silver)) s.silver = Math.max(0, Math.round(g.silver));
      for (const k of ["activeAtk", "activeNei", "activeQing"]) {
        if (Array.isArray(g[k])) s[k] = g[k].filter(id => !!MART[id]);
      }
    }
    const st = window.JH_combat.stats(s);
    s.hp = st.hpMax; s.cur = st.curMax;
    log('你踏进涩谷。人流从你身边绕开，像绕开一块礁石。', 'story');
    autoEvent();
    return s;
  }
  function log(text, cls) {
    if (!s) return;
    s.log.push({ t: s.t, text, cls: cls || '' });
    if (s.log.length > 400) s.log.splice(0, s.log.length - 400);
    if (window.JH_ui && window.JH_ui.onLog) window.JH_ui.onLog();
  }

   
  function hasItem(id, n, who) { n = n || 1; const b = who || s; return ((b.items || {})[id] || 0) >= n; }
   
  const EQUIP_TYPES = ['weapon', 'armor', 'charm', 'boots'];
  function isEquipItem(id) { const it = ITEM[id]; return !!it && EQUIP_TYPES.indexOf(it.type) >= 0; }
  function addItem(id, n, who) {
    const b = who || s; n = n || 1;
    if (!ITEM[id]) return false;
    if (!b.items) b.items = {};
    if (isEquipItem(id)) {            
      if ((b.items[id] || 0) > 0) return false;
      b.items[id] = 1; return true;
    }
    b.items[id] = (b.items[id] || 0) + n;
    return true;
  }
  function removeItem(id, n, who) {
    const b = who || s; n = n || 1;
    if (!b.items) b.items = {};
    if ((b.items[id] || 0) < n) return false;
    b.items[id] -= n;
    if (b.items[id] <= 0) delete b.items[id];
    return true;
  }
  function bagTypes() { return Object.keys(s.items).length; }
   
  function ownsItem(id) {
    if (hasItem(id)) return true;
    for (const k of EQUIP_TYPES) if (s.equip[k] === id) return true;
    return false;
  }
   
  function dropItem(id) {
    const it = ITEM[id];
    if (!it || !hasItem(id)) return false;
    for (const k of EQUIP_TYPES) { if (s.equip[k] === id) { log('先把 ' + it.name + ' 卸下来再丢。', 'warn'); return false; } }
    removeItem(id, 1);
    if (s.forge && s.forge[id]) delete s.forge[id];    
    log('你丢掉了 ' + it.name + '。', 'warn');
    return true;
  }

  

  function expNeedNow() {
    const r = REALMS[Math.max(0, Math.min(REALMS.length - 1, s.realm | 0))];
    return (r && r.need) || 0;
  }
  function gainExp(n, silent) {
    n = Math.round(n);
    if (n <= 0) return;
    const need = expNeedNow();
    const room = need > 0 ? Math.max(0, need - s.exp) : n;
    const real = Math.min(n, room);
    s.exp += real;
    if (real <= 0) { if (!silent) log('修为已满，去「突破境界」吧。', 'warn'); return; }
    if (!silent) log(real < n ? `修为 +${real}（已至上境上限，溢出 ${n - real} 点不计）。` : `修为 +${real}。`, 'exp');
  }
  function gainSilver(n) {
    n = Math.round(n);
    if (n === 0) return;
    s.silver = Math.max(0, s.silver + n);
    if (n > 0) log(`咒币 +${n}。`, 'silver');
  }
  function gainAff(npcId, n) {
    const face = (s.attrs && s.attrs.face) || 0;
    const rate = 1 + face / 200;
    const d = n > 0 ? n * rate : n;
    s.aff[npcId] = Math.max(0, Math.min(100, (s.aff[npcId] || 0) + d));
  }

  



  function taskExpFor(sceneId) {
    const pool = window.JH_FOES.filter(f => f.scene === sceneId && !f.boss && !f.dummy);
    const lvls = pool.map(f => f.lvl || 0);
    const lvl = lvls.length ? Math.round(lvls.reduce((a, b) => a + b, 0) / lvls.length) : 0;
    const need = REALMS[Math.max(0, Math.min(REALMS.length - 1, lvl))].need;
    return Math.max(10, Math.round(need * 0.10));
  }

  function condMet(c) {
    if (!c) return true;
    if (c.flag && !s.flags[c.flag]) return false;
    if (c.notFlag && s.flags[c.notFlag]) return false;
    if (c.storyDone && !s.storyDone[c.storyDone]) return false;
    if (c.item && !hasItem(c.item)) return false;
    if (c.allItems && !c.allItems.every(i => hasItem(i))) return false;
    if (c.realm != null && s.realm < c.realm) return false;
    if (c.insight != null && s.attrs.insight < c.insight) return false;
    if (c.root != null && s.attrs.root < c.root) return false;
    if (c.innate && s.innate.indexOf(c.innate) < 0) return false;
    if (c.techLv && (s.innateLv[c.techLv.id] || 0) < c.techLv.v) return false;
    if (c.silver != null && s.silver < c.silver) return false;
    if (c.sect && s.sect !== c.sect) return false;
    if (c.aff && (s.aff[c.aff.npc] || 0) < c.aff.v) return false;
    if (c.done && !s.eggs[c.done]) return false;
    return true;
  }

  function panel() {
    const st = window.JH_combat.stats(s);
    return {
      st, realm: REALMS[s.realm], need: REALMS[s.realm].need,
      shichen: shichenName(s), clock: clockText(s),
      room: ROOM[s.room], scene: SCENE[s.scene],
      origin: window.JH_ORIGIN_MAP[s.origin] || null,
      canBreak: s.exp >= REALMS[s.realm].need && s.realm < REALMS.length - 1
    };
  }

  function expPerSec() {
    const st = window.JH_combat.stats(s);
    const room = ROOM[s.room];
    const bonus = room && room.actions && room.actions.includes('meditate') ? 1.35 : 1;
    const ins = (s.attrs.insight || 0) - 40;
    return (1.2 + ins * 0.25 + s.realm * 0.9) * st.expRate * bonus;
  }

  const TECH_LV_NAME = ['初识','入门','熟悉','纯熟','精通','极致','神髓','极之番','领域','完遂'];
  function techLvName(lv) { return TECH_LV_NAME[Math.max(0, Math.min(9, (lv || 1) - 1))]; }

  




  function activeArray(st, kind) {
    const k = kind === 'atk' ? 'activeAtk' : (kind === 'nei' ? 'activeNei' : 'activeQing');
    if (!Array.isArray(st[k])) st[k] = [];
    return st[k];
  }
  function activeOf(st, kind) {
    return activeArray(st, kind).filter(id => {
      if (!(st.skills && st.skills[id])) return false;
      const m = MART[id];
      return !(m && m.innate && innateOffOf(st, m.innate));    
    });
  }
  function slotsOf(st, kind) {
    const o = window.JH_ORIGIN_MAP[st.origin] || {};
    if (o.debug || st.mirror === true) return 99;    
    if (kind === 'atk') {
      const cs = window.JH_combat.stats(st);
      const ins = st.attrs.insight, eff = cs.ceEff * 100, ctl = cs.ceCtl * 100;
      const th = [[40, 40, 40], [60, 60, 60], [80, 80, 80], [80, 90, 90]];
      let n = 1;
      for (const t of th) if (ins >= t[0] && eff >= t[1] - 0.05 && ctl >= t[2] - 0.05) n++;
      return n;
    }
    if (kind === 'nei') {
      const ctl = Math.round(window.JH_combat.stats(st).ceCtl * 100);
      let n = 1 + Math.max(0, Math.floor((ctl - 20) / 20));
      if (ctl >= 90) n++;
      return Math.max(1, n);
    }
    if (kind === 'qing') {
      const r = st.attrs.root || 0;
      return 1 + (r >= 40 ? 1 : 0) + (r >= 80 ? 1 : 0) + (r >= 100 ? 1 : 0);
    }
    return 1;
  }
  function syncTech() {
    if (!s) return;
    s.tech = s.tech || { atk: null, nei: null, qing: null };
    for (const kind of ['atk', 'nei', 'qing']) {
      const a = activeOf(s, kind);
      s.tech[kind] = a[0] || null;
    }
  }
   
  function partyOf(st, cls) {
    st.party = st.party || {};
    const jt = window.JH_INNATE_MAP.t_jukai;
    if (!jt) return st.party[cls] || null;
    const lv = ((st.innateLv || {}).t_jukai) || 1;
    const list = jt.skills.map(id => MART[id]).filter(m => m && m.cls === cls && lv >= (m.lv || 0));
    if (!list.length) return null;
    const cur = st.party[cls];
    if (cur && list.some(m => m.id === cur)) return cur;
    return list[0].id;
  }
  function setParty(cls, id) {
    if (!s.party) s.party = {};
    if (MART[id] && !s.skills[id]) learn(id);    
    s.party[cls] = id;
    log('你换上了出战的式神。', 'info');
    return true;
  }
   
  


  function usableOf(st, kind) { return activeOf(st, kind).slice(); }
   
  function usedOf(st, kind) {
    return activeOf(st, kind).filter(id => { const m = MART[id]; return !(m && m.innate); }).length;
  }
  

  function innateOffOf(st, tid) { return !!(st && st.innateOff && st.innateOff[tid]); }
  function innateOn(tid) { return !!s && !innateOffOf(s, tid); }
  function setInnateOn(tid, on) {
    if (!s || !window.JH_INNATE_MAP[tid]) return false;
    s.innateOff = s.innateOff || {};
    if (on) delete s.innateOff[tid];
    else s.innateOff[tid] = true;
    syncTech();
    const t = window.JH_INNATE_MAP[tid];
    log('你把「' + t.name + '」这一系' + (on ? '打开了：名下的术式与它的被动一起回来。' : '收住了：名下的术式与它的被动都停手。'), on ? 'info' : 'warn');
    return true;
  }
   
  function reqMet(req) {
    if (!req) return true;
    const a = s.attrs || {};
    if (req.face != null && (a.face || 0) < req.face) return false;
    if (req.faceMax != null && (a.face || 0) > req.faceMax) return false;
    if (req.insight != null && (a.insight || 0) < req.insight) return false;
    if (req.root != null && (a.root || 0) < req.root) return false;
    if (req.luck != null && (a.luck || 0) < req.luck) return false;
    if (req.luckMax != null && (a.luck || 0) > req.luckMax) return false;
    if (req.realm != null && s.realm < req.realm) return false;
    return true;
  }
   
  function reqText(req) {
    if (!req) return '';
    const o = [];
    if (req.face != null) o.push('要长得足够好看（颜值 ≥ ' + req.face + '）');
    if (req.faceMax != null) o.push('最好不起眼（颜值 ≤ ' + req.faceMax + '）');
    if (req.insight != null) o.push('悟性 ≥ ' + req.insight);
    if (req.root != null) o.push('根骨 ≥ ' + req.root);
    if (req.luck != null) o.push('福缘 ≥ ' + req.luck);
    if (req.luckMax != null) o.push('福缘 ≤ ' + req.luckMax);
    if (req.realm != null) o.push('境界至少到 ' + (REALMS[req.realm] ? REALMS[req.realm].name : req.realm));
    return o.join('　');
  }
   
  function clearBattleBuffs() {
    if (!s) return;
    s.pst = null;
    if (s.st) delete s.st;           
    s.buff = null;
    s.bf = { t: [] };
    s.castStreak = 0;
    s.overload = 0;
  }
   
  function clearBattleCd() {
    if (!s) return;
    s.cd = {};
    s.overload = 0;
    s.castStreak = 0;
    if (s.pst) s.pst.domBreak = 0;
  }
  

  function settleSummons() {
    const shields = (s.pst && s.pst.shields) || [];
    let bank = 0;
    for (const sh of shields) if (sh && sh.src === 'csm') bank += Math.max(0, sh.hp || 0);
    if (bank > 0) {
      const before = Math.round(s.csmBank || 0);
      s.csmBank = Math.min(4000, Math.round(bank));       
      log('咒灵操术：残余的护盾收回了技能里 —— 库存' + (before > 0 ? '从 ' + before + ' 回到 ' + Math.round(s.csmBank) : ' ' + Math.round(s.csmBank)) + '。', 'calm');
    }
  }
  

  function sandboxFight() {
    return !!(battle && battle.pvp);
  }
   
  function shatteredList() {
    const sh = (s && s.pst && s.pst.shattered) || null;
    if (!sh) return [];
    return Object.keys(sh).filter(id => s.tamed && s.tamed[id] != null);
  }
  const foeNameOf = (id) => (window.JH_FOE_MAP[id] || {}).name || id;
   
  function reapShattered() {
    const ids = shatteredList();
    if (!ids.length) return;
    for (const id of ids) delete s.tamed[id];
    log('咒灵操术：' + ids.map(foeNameOf).join('、') + ' 被打散了，从账下划掉 —— 想再驱使，得把它重新收服。', 'lose');
  }
   
  function restoreShattered() {
    const ids = shatteredList();
    if (!ids.length) return;
    log('这一场只是演练：散掉的 ' + ids.map(foeNameOf).join('、') + ' 又回到了账下。', 'calm');
  }
  function onTechLevel(tid, lv) {
    const t = window.JH_INNATE_MAP[tid];
    if (!t) return;
    


    const ok = trialDone(tid);
    for (const sid of t.skills) {
      const m = MART[sid];
      if (!m) continue;
      const need = m.lv || 0;
      if (need > lv) continue;
      if (need >= TRIAL_LV && !ok) continue;
      if (!s.skills[sid]) learn(sid);
    }
    if (lv >= 8 && ok && s.domain.indexOf(tid) < 0) {
      s.domain.push(tid);
      const dm = MART[t.domain];
      if (dm) { s.skills[t.domain] = 1; s.skillLv[t.domain] = 1; log('★ 你展开了领域：' + dm.name + '。', 'realm'); }
    }
  }
  


   
  const TRIAL_LV = 6;
  function trialLv(tid) { return ((s && s.innateLv) || {})[tid] || 1; }
  function trialOpen(tid) { return !!s && (devEditable() || trialLv(tid) >= TRIAL_LV); }
  function trialDef(tid) { return (window.JH_TRIALS || []).find(x => x.innate === tid) || null; }
  



  function trialFreeOrigin() {
    const o = (window.JH_ORIGIN_MAP[(s && s.origin) || ''] || {});
    return !!(o.debug || o.trialFree || (o.extra && o.extra.trialFree));
  }
  function trialDone(tid) { if (!s) return false; if (trialFreeOrigin() || forLan) return true; return !!(s.trials && s.trials[tid]); }
  function trialPass(tid) {
    if (!trialDef(tid)) return false;
    if (!s.trials) s.trials = {};
    if (s.trials[tid]) return false;
    s.trials[tid] = true;
    const t = window.JH_INNATE_MAP[tid];
    log('试炼通过：' + (t ? t.name : tid) + ' —— 这一系的招数不再锁在门后。', 'realm');
    syncInnateSkills();
    return true;
  }
  function trialList() {
    return (s.innate || []).map(tid => { const d = trialDef(tid); return d ? Object.assign({ innate: tid }, d) : null; }).filter(Boolean);
  }
   
  function trialReset(tid) {
    if (!devEditable()) return false;
    if (!trialDef(tid)) return false;
    if (s.trials) delete s.trials[tid];
    const t = window.JH_INNATE_MAP[tid];
    log('【调试】试炼「' + (t ? t.name : tid) + '」已复位，可以再考一次。', 'realm');
    return true;
  }
   
  function trialAllList() {
    if (!devEditable()) return [];
    return (window.JH_TRIALS || []).map(d => ({
      tid: d.innate, name: d.name, kind: d.kind,
      done: trialDone(d.innate),
      playing: !!(battle && battle.trial === d.innate)
    }));
  }
   
  function startTrialBattle(tid) {
    const d = trialDef(tid);
    if (!d || d.kind !== 'battle' || !d.foe) return false;
    if (!trialOpen(tid)) { log('这一门还嫩着（熟练度 ' + trialLv(tid) + ' 级）—— 练到 ' + TRIAL_LV + ' 级，试炼才开得起来。', 'warn'); return false; }
    if (!startBattle(d.foe, 1 + s.realm * 0.02)) return false;
    battle.trial = tid;
    log('试炼开始：' + d.name + '。', 'fight');
    return true;
  }
   
  function syncInnateSkills() {
    if (!s) return 0;
    let n = 0;
    for (const tid of (s.innate || [])) {
      if (!window.JH_INNATE_MAP[tid]) continue;
      const before = Object.keys(s.skills || {}).length;
      onTechLevel(tid, (s.innateLv || {})[tid] || 1);
      n += Object.keys(s.skills || {}).length - before;
    }
    

    if (!s.switchV2) {
      s.switchV2 = 1;
      if (!devEditable()) {
        for (const id of Object.keys(s.skills || {})) {
          const m = MART[id];
          if (!m || !m.innate || m.kind === 'passive') continue;
          const arr = activeArray(s, m.kind);
          if (arr.indexOf(id) < 0) arr.push(id);
        }
        syncTech();
      }
    }
    return n;
  }
  function idleFoeId() {
    const room = ROOM[s.idle.room] || ROOM[s.room];
    const scene = room ? room.scene : s.scene;
    const pool = window.JH_FOES.filter(f => f.scene === scene && !f.boss && !f.dummy);
    if (!pool.length) return null;
    const maxL = Math.max.apply(null, pool.map(f => f.lvl || 0));
    const use = pool.filter(f => (f.lvl || 0) >= maxL - 1);
    return use[(Math.random() * use.length) | 0].id;
  }

  function idleStep() {
    if (s.t < (s.wounded || 0)) return;
    const foeId = idleFoeId();
    if (!foeId) return;
    const foe = window.JH_combat.makeFoe(foeId, 1);
    const fc = window.JH_combat.forecast(s, foe);
    if (!fc.safe) {
      if (!s._warned || s.t - s._warned > 120) {
        s._warned = s.t;
        log('这里的东西不好惹（大约要 ' + Math.ceil(fc.toKill) + ' 回合，你只能撑 ' + Math.ceil(fc.toDie) + ' 回合），先不碰。', 'warn');
      }
      return;
    }
    const r = window.JH_combat.autoResolve(s, foe);
    if (r.win) {
      s.c.win++; s.c.winStreak++; s.stats.kills++;
      s.clear[s.scene] = (s.clear[s.scene] || 0) + 1;
      gainExp(foe.exp, true); gainSilver(foe.silver);
      for (const [id, p, n] of foe.loot) {
        if (Math.random() < p) { if (id === 'silver') gainSilver(n); else addItem(id, n); }
      }
      log('挂机：祓除 ' + foe.name + '（修为 +' + foe.exp + '）。', 'win');
      checkEggs();
    } else if (r.lose) {
      const st = window.JH_combat.stats(s);
      s.hp = Math.max(1, Math.floor(st.hpMax * 0.2));
      s.c.lose++; s.c.winStreak = 0;
      s.wounded = s.t + 90;
      log('挂机：不敌 ' + foe.name + '，负伤撤退。', 'lose');
    }
  }

  let sinceIdle = 0;
  function tick(realSec) {
    if (!s) return false;
    const dt = Math.min(realSec, 5);
    s.t += dt;
    const st = window.JH_combat.stats(s);
     
     
    progressAct(dt);             
    clampVitals(st);             
    const arrived = arriveIfDue();    
    window.JH_combat.tickBf(s, dt / 10);    
    if (!battle) window.JH_combat.tickCd(s, dt / 10);    
    s.c.idle[s.room] = (s.c.idle[s.room] || 0) + dt;
    if (s.buff && s.buff.turns > 0) { s.buff.turns -= dt / 10; if (s.buff.turns <= 0) s.buff = null; }
    if (s.idle.on) {
      sinceIdle += dt;
      if (sinceIdle >= 3) { sinceIdle = 0; if (s.hp > st.hpMax * 0.6) idleStep(); }
      if (s.idle.on && s.hp <= st.hpMax * 0.25) {    
        s.idle.on = false;
        log('你累了（气血 ' + Math.round(s.hp) + '）。先回「自宅」歇一歇，再出来。', 'warn');
      }
    }
    let changed = arrived;                
    if (checkEggs()) changed = true;
    if (!s.event && autoEvent()) changed = true;
    return changed;
  }

  function staMax() { return 100 + s.realm * 10; }

   
  const HOME_SCENE = 'sc_home';
  function atHome() { return s.scene === HOME_SCENE; }
   
  function staRate() {
    if (s.origin === 'o_operator') return staMax() / 10;
    if (window.JH_DEV && window.JH_DEV.staPerSec != null) return window.JH_DEV.staPerSec;
    return 15 / 60;
  }
   
  function regionOfScene(sid) {
    const of = window.JH_REGION_OF || {};
    if (sid && of[sid]) return of[sid];
    const regs = window.JH_REGIONS || [];
    return regs.length ? regs[0].id : null;
  }
  





  function travelSpeedMul() {
    if (!s) return 1;
    const sk = s.skills || {}, inn = s.innate || [];
    if (sk.sk_mk_move && inn.indexOf('t_mukagen') >= 0) return 0.3;
    if (sk.k_step) return 0.7;
    return 1;
  }
  function travelSec(sid) {
    if (window.JH_DEV && window.JH_DEV.travelSec != null) return window.JH_DEV.travelSec;
    if (devEditable()) return TRAVEL_TEST_SEC;
    if (sid) {
      const a = regionOfScene(s.scene), b = regionOfScene(sid);
      if (a && b && a !== b) return Math.max(1, Math.round(TRAVEL_CROSS_SEC * travelSpeedMul()));
    }
    return TRAVEL_SEC;
  }
   
  function durText(sec) {
    const t = Math.max(0, Math.round(+sec || 0));
    if (t < 60) return t + ' 秒';
    const m = Math.floor(t / 60), s2 = t % 60;
    return s2 ? (m + ' 分 ' + s2 + ' 秒') : (m + ' 分钟');
  }

  





  function ceRecoverRate(kind, st) {
    if (s.origin === 'o_operator') return st.curMax / 10;                        
     
    return (kind === 'meditate' ? 3 : 2.3) * Math.log(1 + st.curMax) / 2 + 0.02 * Math.max(0, s.cur || 0);
  }
  


  function hpRecoverRate(kind, st) {
    if (s.origin === 'o_operator') return st.hpMax / 10;
    return (kind === 'meditate' ? 3 : 2.3) * Math.log(1 + st.hpMax) / 2 + 0.02 * Math.max(0, s.hp || 0);
  }
  function stopAct(auto) {
    if (!s.act) return false;
    const kind = s.act.kind;
    s.act = null;
    if (auto) log(kind === 'meditate' ? '你收了功。' : '你歇够了，精神也回来了。', 'info');
    return true;
  }
  function setAct(kind) {
    if (s.travel) { log('你还在赶路，到了再说。', 'warn'); return false; }
    if (battle) { log('打起来的时候没法静下心来。', 'warn'); return false; }
    if (s.act && s.act.kind === kind) {
      stopAct(false);
      log(kind === 'meditate' ? '你不再打坐。' : '你不再歇息。', 'info');
      return true;
    }
    s.idle.on = false;                  
    s.act = { kind: kind, room: s.room };
    log(kind === 'meditate'
      ? '你盘膝坐下，把咒力收进腹部，开始打坐。'
      : '你靠着墙坐下，闭了眼，开始休息。', 'action');
    return true;
  }
  function progressAct(dt) {
    if (!s.act || battle) return;
    const kind = s.act.kind;
    let st = window.JH_combat.stats(s);
    s.cur += ceRecoverRate(kind, st) * dt;    
    s.hp = Math.min(st.hpMax, s.hp + hpRecoverRate(kind, st) * dt);    
    if (s.cur >= st.curMax) {
      if (kind === 'meditate') {
        s.curBonus = (s.curBonus || 0) + 1;      
        s.cur = 0;                               
        st = window.JH_combat.stats(s);
        log('咒力贯通：咒力总量 +1，咒力清空，继续打坐。', 'exp');
      } else s.cur = st.curMax;
    }
    if (kind !== 'meditate' && atHome()) {
      const sr = (s.origin === 'o_operator') ? staMax() / 10 : staRate();
      s.sta = Math.min(staMax(), s.sta + sr * dt);
    }
    if (kind !== 'meditate' && s.cur >= st.curMax - 0.01 && s.hp >= st.hpMax - 0.01 && (!atHome() || s.sta >= staMax() - 0.01)) stopAct(true);
  }

  


  function clampVitals(st) {
    if (st && isFinite(st.hpMax) && s.hp > st.hpMax) s.hp = st.hpMax;
    const sm = staMax();
    if (s.sta > sm) s.sta = sm;
    const need = expNeedNow();
    if (need > 0 && s.exp > need) s.exp = need;
    if (!(s.act && s.act.kind === 'meditate') && st && isFinite(st.curMax) && s.cur > st.curMax) s.cur = st.curMax;
  }

   
  function regionUnlocked(rg) {
    if (!rg) return false;
    if (devEditable()) return true;
    const u = rg.unlock || {};
    if (u.realm != null && s.realm < u.realm) return false;
    if (u.insight != null && s.attrs.insight < u.insight) return false;
    if (u.flag && !s.flags[u.flag]) return false;
    if (u.story && !s.storyDone[u.story]) return false;
    return true;
  }
  function sceneUnlocked(sc) {
    const u = sc.unlock || {};
    if (u.realm != null && s.realm < u.realm) return false;
    if (u.insight != null && s.attrs.insight < u.insight) return false;
    if (u.flag && !s.flags[u.flag]) return false;
    if (u.story && !s.storyDone[u.story]) return false;
    return true;
  }
  function roomUnlocked(r) {
    if (r.devOnly && !devEditable()) return false;       
    if (r.unlock && r.unlock.flag && !s.flags[r.unlock.flag]) return false;
    return true;
  }
  function moveRoom(rid) {
    if (s.travel) { log('你还在赶路。', 'warn'); return false; }
    const r = ROOM[rid];
    if (!r || !roomUnlocked(r) || !sceneUnlocked(SCENE[r.scene])) return false;
    s.room = rid; s.scene = r.scene; s.stats.moves++;
    s.c.visit[rid] = (s.c.visit[rid] || 0) + 1;
    log('你走进了「' + r.name + '」。', 'move');
    s.idle.room = rid;
    checkEggs(); autoEvent();
    return true;
  }
   
  function arriveAt(t) {
    s.travel = null;
    const r = ROOM[t.room];
    if (!r) return false;
    s.room = t.room; s.scene = t.scene; s.stats.moves++;
    s.c.visit[t.room] = (s.c.visit[t.room] || 0) + 1;
    s.idle.room = t.room;
    log('你走进了「' + r.name + '」。', 'move');
    const rid = regionOfScene(t.scene);
    if (rid && !s.flags['vis_' + rid]) {           
      s.flags['vis_' + rid] = true;
      const rg = (window.JH_REGION_MAP || {})[rid];
      if (rg && rg.name) log('你踏上了「' + rg.name + '」。', 'story');
    }
    if (t.fresh) {
      s.clear[t.scene] = 0;
      log('这一带的咒灵重新聚了起来——先清一遍，此地的头目才会现身。', 'move');
    }
    checkEggs(); autoEvent();
    return true;
  }
  function arriveIfDue() { if (s.travel && s.t >= s.travel.until) return arriveAt(s.travel); return false; }
   
  function moveScene(sid) {
    const sc = SCENE[sid];
    if (!sc || !sceneUnlocked(sc)) return false;
    if (s.travel) { log('你还在赶路。', 'warn'); return false; }
    const first = window.JH_ROOMS.find(r => r.scene === sid && roomUnlocked(r));
    if (!first) return false;
    const start = window.JH_ROOMS.find(r => r.scene === sid && r.start && roomUnlocked(r)) || first;
    if (sid === s.scene) return moveRoom(start.id);
    s.idle.on = false; stopAct(false);
    const sec = travelSec(sid);
    if (sec <= 0) return arriveAt({ scene: sid, room: start.id, fresh: true });
    const cross = regionOfScene(s.scene) !== regionOfScene(sid);
    s.travel = { scene: sid, room: start.id, from: s.scene, start: s.t, until: s.t + sec, fresh: true, cross: cross };
    log(cross ? ('你动身远渡「' + sc.name + '」（隔着山海，路上约 ' + durText(sec) + '）。')
              : ('你动身前往「' + sc.name + '」（路上约 ' + durText(sec) + '）。'), 'move');
    return true;
  }

  function search() {
    if (s.travel) { log('你还在赶路。', 'warn'); return false; }
    if (s.sta < SEARCH_COST) { log('精力不济，先歇一歇。', 'warn'); return false; }
    const r = ROOM[s.room];
    if (!r || !r.search) { log('这里没什么可翻的。', 'warn'); return false; }
    s.sta -= SEARCH_COST;
    s.c.search[s.room] = (s.c.search[s.room] || 0) + 1;
    s.stats.searched++;
    let total = 0; for (const o of r.search) total += o.w;
    let roll = Math.random() * total, hitO = r.search[r.search.length - 1];
    for (const o of r.search) { roll -= o.w; if (roll <= 0) { hitO = o; break; } }
     
    const org = window.JH_ORIGIN_MAP[s.origin] || {};
    const sm = 1 + ((org.extra && org.extra.search) || 0);
    if (hitO.text) log(hitO.text, 'search');
    if (hitO.item) addItem(hitO.item, (hitO.n || 1) + ((sm > 1 && Math.random() < (sm - 1)) ? 1 : 0));
    if (hitO.silver) gainSilver(Math.round(hitO.silver * sm));
    if (hitO.exp) gainExp(Math.round(hitO.exp * sm));
    if (hitO.flag && !s.flags[hitO.flag]) { s.flags[hitO.flag] = true; if (hitO.flagText) log(hitO.flagText, 'story'); }
    return true;
  }

  const ACT_TEXT = {
    meditate:['你盘膝坐下，把咒力收进腹部。','调息'],
    train:   ['你一遍一遍地演练术式。','锻炼'],
    gather:  ['你在草丛里翻找。','采药'],
    fish:    ['你坐在水边，等。','垂钓'],
    drink:   ['你要了一杯。','小酌'],
    rest:    ['你靠着墙，闭了会儿眼。','歇息'],
    work:    ['你接了件短工。','做事'],
    listen:  ['你安静地听着。','聆听'],
    read:    ['你翻开一页。','研读'],
    weave:   ['你捻起一根咒丝。','织符'],
    brew:    ['你盯着炉火。','配药'],
    craft:   ['你拆开机括。','制器'],
    forge:   ['你抡起了锤子。','锻打'],
    pray:    ['你上了三炷香。','参拜']
  };
  function doAction(act) {
    if (s.travel) { log('你还在赶路。', 'warn'); return false; }
    if (act === 'rest' || act === 'meditate') return setAct(act);    
    const r = ROOM[s.room];
    if (!r || !r.actions || !r.actions.includes(act)) return false;
    if (s.sta < ACTION_COST) { log('精力不济，先歇一歇。', 'warn'); return false; }
    s.sta -= ACTION_COST;
    s.c.action[act] = (s.c.action[act] || 0) + 1;
    const T = ACT_TEXT[act] || ['你做了一件事。', act];
    log(T[0] + '（' + T[1] + '）', 'action');
    const st = window.JH_combat.stats(s);
    switch (act) {
      case 'gather':   if (Math.random() < 0.7) { const it = Math.random() < 0.25 ? 'mat_herb' : 'mat_res'; addItem(it, 1); log('采到了 ' + ITEM[it].name + '。', 'item'); } gainExp(20, true); break;
      case 'fish':     if (Math.random() < 0.55) { const it = Math.random() < 0.2 ? 'mat_scale' : 'food_onigiri'; addItem(it, 1); log('捞上来 ' + ITEM[it].name + '。', 'item'); } gainExp(15, true); break;
      case 'work':     gainSilver(6 + s.realm * 3); s.contrib += (s.sect !== 's_none' ? 4 : 0); gainExp(10, true); break;
      case 'forge':    if (Math.random() < 0.6) addItem('mat_steel', 1); gainExp(25, true); break;
      case 'craft':    if (Math.random() < 0.5) addItem('mat_shard', 1); gainExp(25, true); break;
      case 'brew':     if (Math.random() < 0.35) addItem('pill_mini', 1); gainExp(20, true); break;
      case 'read':     gainExp(60, true); break;
      case 'weave':    if (Math.random() < 0.3) addItem('mat_silk', 1); gainExp(15, true); break;
      case 'drink':    s.cur = Math.min(st.curMax, s.cur + 30); s.hp = Math.min(st.hpMax, s.hp + 20); gainExp(10, true); break;
      case 'listen':   gainExp(30, true); break;
      case 'pray':     if (Math.random() < 0.2) gainSilver(20); gainExp(25, true); break;
      default:         gainExp(10, true);
    }
    checkEggs();
    return true;
  }
  function npcsInRoom() {
    const r = ROOM[s.room];
    if (!r) return [];
    const ids = r.npcs || (r.npc ? [r.npc] : []);
    return ids.map(i => NPC[i])
      .filter(n => n && hideMet(n))                           
      .filter(Boolean);
  }
  

  function hideMet(n) {
    const h = n.hide;
    if (!h) return true;
    if (h.flag && !s.flags[h.flag]) return false;
    if (h.search && (s.c.search[s.room] || 0) < h.search) return false;
    return true;
  }
  function talk(npcId) {
    const here = npcsInRoom();
    const npc = npcId ? NPC[npcId] : here[0];
    if (!npc || here.indexOf(npc) < 0) { log('这里没有可以说话的人。', 'warn'); return false; }
    s.met[npc.id] = true;
    s.c.talk[npc.id] = (s.c.talk[npc.id] || 0) + 1;
    const aff = s.aff[npc.id] || 0;
    let line;
    if (npc.talk) {
      if (aff >= 80) line = npc.talk[Math.min(npc.talk.length - 1, 2)];
      else if (aff >= 40) line = npc.talk[Math.min(npc.talk.length - 1, 1)];
      else line = npc.talk[0];
      if (Math.random() < 0.3) line = npc.talk[(Math.random() * npc.talk.length) | 0];
    } else line = '……';
    log(npc.name + '：「' + line + '」', 'talk');
     
    s.c.talkDay = s.c.talkDay || {};
    const today = dayCount(s);
    if (s.c.talkDay[npc.id] !== today) {
      s.c.talkDay[npc.id] = today;
      gainAff(npc.id, 1);
      s.aff[npc.id] = s.aff[npc.id] || 1;
    } else {
      log('（今天已经和他聊过了，再聊也不会更熟。）', 'info');
    }
    checkTeach(npc);
    if (npc.task) {
      const t = npc.task;
      if (hasItem(t.item, t.count)) {
        removeItem(t.item, t.count);
        if (t.reward.silver) gainSilver(t.reward.silver);
        if (t.reward.item) addItem(t.reward.item, 1);
        const rexp = t.reward.exp != null ? t.reward.exp : taskExpFor(npc.scene);
        if (rexp) gainExp(rexp);
        log('你替 ' + npc.name + ' 办妥了「' + t.name + '」。修为 +' + rexp + '。', 'quest');
        npc.task = null;
      }
    }
    checkEggs();
    return true;
  }

  function gift(itemId, npcId) {
    const here = npcsInRoom();
    const npc = npcId ? NPC[npcId] : here[0];
    if (!npc || here.indexOf(npc) < 0) { log('这里没有可以赠礼的人。', 'warn'); return false; }
    if (!hasItem(itemId)) { log('你没有这样东西。', 'warn'); return false; }
    if (!s.met[npc.id]) { log('你尚未结识 ' + npc.name + '，冒然赠礼不妥。', 'warn'); return false; }
    const g = npc.gift || {};
    let d = 2;
    if ((g.love || []).includes(itemId)) d = 10;
    else if ((g.like || []).includes(itemId)) d = 5;
    else if ((g.hate || []).includes(itemId)) d = -6;
    removeItem(itemId, 1);
    gainAff(npc.id, d);
    log(d > 0 ? npc.name + ' 收下了 ' + ITEM[itemId].name + '，神色缓和。（好感 ' + Math.round(s.aff[npc.id]) + '）'
              : npc.name + ' 皱了皱眉，还是收下了 ' + ITEM[itemId].name + '。（好感 ' + Math.round(s.aff[npc.id]) + '）',
        d > 0 ? 'good' : 'warn');
    checkTeach(npc);
    checkEggs();
    return true;
  }

  




  let mimicOffer = null;
  function offerMimic(foe) {
     
    const can = !!(s.skills && s.skills.sk_mm_borrow) || (s.innate || []).indexOf('t_mimic') >= 0;
    if (!can) return;
     
    const src = Array.isArray(foe.skills) ? foe.skills : Object.keys(foe.skills || {});
    const list = src.filter(id => MART[id] && MART[id].kind === 'atk');
    if (!list.length) return;
    mimicOffer = { from: foe.name, skills: list };
  }
  function pendingMimic() { return mimicOffer; }
  function cancelMimic() { mimicOffer = null; return true; }
  function takeMimic(id) {
    if (!mimicOffer || mimicOffer.skills.indexOf(id) < 0) return false;
    s.borrow = s.borrow || {};
    if (s.borrow[id] == null && Object.keys(s.borrow).length >= 3) {
      log('借术已经记满三门了——先去「术式」页弃掉一门。', 'warn');
      return false;
    }
    s.borrow[id] = window.JH_BORROW_MAX || 16;
    log('借术：你记住了「' + MART[id].name + '」，还能用 ' + s.borrow[id] + ' 次。', 'learn');
    mimicOffer = null;
    return true;
  }
  function dropBorrow(id) {
    if (!s.borrow || s.borrow[id] == null) return false;
    delete s.borrow[id];
    log('你把「借用·' + MART[id].name + '」忘了。', 'info');
    return true;
  }
   
   
  function tameFoe(foe) {
    if (foe.human) { log(foe.name + ' 是个人，收不进咒灵操术。', 'warn'); return false; }
    s.tamed = s.tamed || {};
    const ids = Object.keys(s.tamed);
    if (ids.indexOf(foe.id) < 0 && ids.length >= 6) { log('账下的咒灵已经有六种了，再多也驱使不过来。', 'warn'); return false; }
    s.tamed[foe.id] = (s.tamed[foe.id] || 0) + 1;
    log('你把 ' + foe.name + ' 收进了咒灵操术的账下（可驱使「' + foe.name + '」）。', 'learn');
    return true;
  }
  function dropTamed(foeId) {
    if (!s.tamed || s.tamed[foeId] == null) return false;
    delete s.tamed[foeId];
    const n = (window.JH_FOE_MAP[foeId] || {}).name || foeId;
    log('你把 ' + n + ' 放走了 —— 咒灵操术的账下不再有它。', 'warn');
    return true;
  }
  function driveFoe(foeId) { return !!(s.tamed && s.tamed[foeId]); }

  function checkTeach(npc) {
    const t = npc.teach;
    if (!t || !t.skill || !MART[t.skill]) return;
    if (s.skills[t.skill]) return;
    if ((s.aff[npc.id] || 0) < (t.aff || 0)) return;
    if (t.task && !s.storyDone[t.task]) return;           
    if (!reqMet(MART[t.skill].req)) return;               
     
    if (t.innateLv && !(s.innate || []).some(id => (s.innateLv[id] || 1) >= t.innateLv)) {
      log(npc.name + '「你这一系还没熬到火候。回去练练再来。」', 'info');
      return;
    }
    if (t.secret) {
      s.secret = s.secret || {};
      s.secret[t.skill] = 1;
      log('【秘传】' + npc.name + ' 把「' + MART[t.skill].name + '」教给了你。', 'learn');
    }
    learn(t.skill);
  }

  function learn(id) {
    if (!MART[id]) return false;
    if (s.skills[id]) return false;
    const m = MART[id];
    if (!devEditable()) {
      if (m.innate) {
        if (s.innate.indexOf(m.innate) < 0) { log('你并没有这门生得术式。', 'warn'); return false; }
        if ((s.innateLv[m.innate] || 1) < (m.lv || 0)) { log('熟练度不足，还使不出这一手。', 'warn'); return false; }
      }
      if (m.domain && s.domain.indexOf(m.innate) < 0) { log('你还没能展开领域。', 'warn'); return false; }
    }
    s.skills[id] = 1;
    if (!s.skillLv[id]) s.skillLv[id] = 1;
    log('你学会了「' + m.name + '」。', 'learn');
    if (m.kind !== 'passive') {
      const arr = activeArray(s, m.kind);
       
      if (!devEditable() && arr.indexOf(id) < 0 && (m.innate || usedOf(s, m.kind) < slotsOf(s, m.kind))) arr.push(id);
      syncTech();
    }
    return true;
  }
   
  function learnByPoint(id) {
    if (!devEditable()) return false;
    const m = MART[id];
    if (!m || s.skills[id]) return false;
    if ((s.sp || 0) < 1) { log('技能点不足（每次突破境界 +2）。', 'warn'); return false; }
    if (!learn(id)) return false;
    s.sp -= 1;
    log('技能点 −1，还剩 ' + s.sp + ' 点。', 'warn');
    return true;
  }

  function setTech(id) {
    const m = MART[id];
    if (!m || !s.skills[id] || m.kind === 'passive') return false;
    const kind = m.kind, arr = activeArray(s, kind);
    const i = arr.indexOf(id), cap = slotsOf(s, kind);
    const KIND = { atk:'主动术式', nei:'咒力运用', qing:'体术身法' };
    if (i >= 0) {
      arr.splice(i, 1); syncTech();
      log('你卸下了「' + m.name + '」。', 'info');
      return true;
    }
     
    if (!m.innate && usedOf(s, kind) >= cap) {
      const out = arr.shift();
      if (out && MART[out]) log('槽位满了，「' + MART[out].name + '」被换下。', 'warn');
    }
    arr.push(id); syncTech();
    log('你把「' + m.name + '」挂上了' + (KIND[kind] || '术式') + '槽（' + usedOf(s, kind) + ' / ' + cap + '）。', 'info');
    return true;
  }
   
  function devEditable() {
    const o = window.JH_ORIGIN_MAP[s.origin] || {};
    return !!o.debug;
  }
  const DEV_FIELDS = {
    insight: ['attrs', 'insight', 0, 100], root: ['attrs', 'root', 0, 100],
    luck: ['attrs', 'luck', 0, 100], face: ['attrs', 'face', 0, 100],
    eff: ['ce', 'eff', 0, 0.999], ctl: ['ce', 'ctl', 0, 0.999], cap: ['ce', 'cap', 0.2, 1]
  };
  function devSet(key, v) {
    if (!devEditable()) return false;
    const str = String(key);
     
    if (str.indexOf('skillLv:') === 0) {
      const id = str.slice(8);
      if (!MART[id]) return false;
      s.skills[id] = 1;
      s.skillLv[id] = Math.max(0, Math.min(3, Math.round(parseFloat(v) || 0)));
      syncTech();
      log('【调试】' + MART[id].name + ' 等级 → ' + s.skillLv[id], 'warn');
      return true;
    }
    if (str.indexOf('innateLv:') === 0) {
      const id = str.slice(9);
      if (!window.JH_INNATE_MAP[id]) return false;
      s.innateLv[id] = Math.max(1, Math.min(10, Math.round(parseFloat(v) || 1)));
      for (const sid of window.JH_INNATE_MAP[id].skills) onTechLevel(id, s.innateLv[id]);
      log('【调试】' + window.JH_INNATE_MAP[id].name + ' 熟练度 → ' + s.innateLv[id], 'warn');
      return true;
    }
    if (str.indexOf('learn:') === 0) { const id = str.slice(6); return learn(id); }
    if (str.indexOf('forget:') === 0) {
      const id = str.slice(7);
      if (!MART[id]) return false;
      delete s.skills[id]; delete s.skillLv[id];
      for (const k of ['atk', 'nei', 'qing']) s[k === 'atk' ? 'activeAtk' : k === 'nei' ? 'activeNei' : 'activeQing'] = activeArray(s, k).filter(x => x !== id);
      syncTech();
      log('【调试】忘掉 ' + MART[id].name, 'warn');
      return true;
    }
    const num = parseFloat(v);
    if (!isFinite(num)) return false;
    const st = window.JH_combat.stats(s);
    if (key === 'hp') s.hp = Math.max(1, Math.min(num, st.hpMax));
    else if (key === 'cur') s.cur = Math.max(0, Math.min(num, st.curMax));
    else if (key === 'sta') s.sta = Math.max(0, Math.min(num, staMax()));
    else if (key === 'sp') s.sp = Math.max(0, Math.round(num));
    else if (key === 'exp') s.exp = Math.max(0, Math.round(num));
    else if (key === 'silver') s.silver = Math.max(0, Math.round(num));
    else if (key === 'curBonus') s.curBonus = Math.max(0, Math.round(num));
    else if (key === 'csmBank') s.csmBank = Math.max(0, Math.round(num));
    else if (key === 'realm') s.realm = Math.max(0, Math.min(REALMS.length - 1, Math.round(num)));
    else if (DEV_FIELDS[key]) {
      const f = DEV_FIELDS[key], pct = (f[0] === 'ce');
      s[f[0]][f[1]] = Math.max(f[2], Math.min(f[3], pct ? num / 100 : num));
    } else return false;
    log('【调试】' + key + ' → ' + v, 'warn');
    return true;
  }

   
  function setOutput(ch, v) {
    if (ch !== 'phy' && ch !== 'cur') return false;
    v = Math.max(20, Math.min(100, Math.round(+v || 0)));
    if (!s.out) s.out = { phy: 50, cur: 50 };
    s.out[ch] = v;
    log((ch === 'phy' ? '物理' : '咒力') + '出力调到 ' + v + '%。', 'info');
    return true;
  }

   
  function skillUp(id) {
    const m = MART[id];
    if (!m || !s.skills[id]) return false;
     
    if (!m.common && (m.innate || m.kind === 'passive')) return false;
    const lv = s.skillLv[id] || 0;
    const cap = m.maxLv || 3;
    if (lv >= cap) { log('这门已经练到顶了（' + cap + ' 级）。', 'warn'); return false; }
    if (id === 'k_black') {
      const o = window.JH_ORIGIN_MAP[s.origin] || {};
      if (!(o.extra && o.extra.blackFlash)) { log('黑闪是命，不是练出来的。', 'warn'); return false; }
    }
    if ((s.sp || 0) < 1) { log('技能点不足（每次突破境界 +2）。', 'warn'); return false; }
    s.sp -= 1; s.skillLv[id] = lv + 1;
    if (id === 'k_black') log('你与黑闪的缘分更近了一分：触发率 ' + window.JH_combat.blackFlashRate(s) + '%。', 'learn');
    else log('「' + m.name + '」精进至 ' + (lv + 1) + ' 级。', 'learn');
    return true;
  }

  function breakthrough() {
    if (s.realm >= REALMS.length - 1) { log('你已至咒术顶点，前路再无境界可破。', 'warn'); return false; }
    const need = REALMS[s.realm].need;
    if (s.exp < need) { log('修为不足，还需 ' + Math.ceil(need - s.exp) + ' 点。', 'warn'); return false; }
    s.exp = 0;                  
    s.realm++;
    s.sp = (s.sp || 0) + 2;     
    const o = window.JH_ORIGIN_MAP[s.origin] || window.JH_ORIGIN_MAP.o_common;
    const gI = Math.max(1, Math.round(2 * o.growth.insight));
    const gR = Math.max(1, Math.round(2 * o.growth.root * (o.swap === 'body2cur' ? 0.5 : 1)));
    s.attrs.insight = Math.min(100, s.attrs.insight + gI);
    s.attrs.root = Math.min(100, s.attrs.root + gR);
    if (s.realm % 2 === 0) {
      s.attrs.luck = Math.min(100, s.attrs.luck + 1);
      s.attrs.face = Math.min(s.faceCap || 100, s.attrs.face + 1);
    }
    s.stats.breakthroughs++;
    const st = window.JH_combat.stats(s);
    s.hp = st.hpMax; s.cur = st.curMax;
    log('冲关成功！你踏入了「' + REALMS[s.realm].name + '」。（悟性 ' + s.attrs.insight + '／根骨 ' + s.attrs.root + '，技能点 +2）', 'realm');
    return true;
  }

  

  function useItem(id, inCombat, who) {
    const me = who || s, mine = (me === s);
    const it = ITEM[id];
    if (!it || !hasItem(id, 1, me)) return false;
    const e = it.effect || {};
    if (!inCombat && !it.effect && !it.learn) { if (mine) log(it.name + ' 不是这样用的。', 'warn'); return false; }
    const st = window.JH_combat.stats(me);
    if (it.learn && !inCombat) {
      if (me.skills && me.skills[it.learn]) { if (mine) log('这门你早就学会了。', 'warn'); return false; }
      removeItem(id, 1, me);
      if (mine) learn(it.learn);
      else { me.skills = me.skills || {}; me.skills[it.learn] = 1; }
      return true;
    }
    removeItem(id, 1, me);
    if (!me.attrs) me.attrs = {};
    if (e.hp) me.hp = Math.min(st.hpMax, me.hp + e.hp);
    if (e.cur) me.cur = Math.min(st.curMax, me.cur + e.cur);
    if (e.sta) me.sta = Math.min(staMax(), me.sta + e.sta);    
    if (e.exp && mine) gainExp(e.exp);
    if (e.cure) me.hp = Math.min(st.hpMax, me.hp + 20);
    if (e.hpFull) me.hp = st.hpMax;
    if (e.curFull) me.cur = st.curMax;
    if (e.attr) for (const k in e.attr) {
      const cap = k === 'face' ? (me.faceCap || 100) : 100;
      me.attrs[k] = Math.min(cap, (me.attrs[k] || 0) + e.attr[k]);
    }
    if (e.buff) me.buff = Object.assign({ turns: 4 }, e.buff);
    if (mine) log('你用了 ' + it.name + '。', 'item');
    else log('镜像用了 ' + it.name + '。', 'item');
    return true;
  }
   
  const MAX_CURSE_EQUIP = 2;
  function equippedCursed() {
    const out = [];
    for (const k of ['weapon', 'armor', 'charm', 'boots']) {
      const iid = s.equip[k];
      if (!iid) continue;
      const f = s.forge && s.forge[iid];
      if (f && f.curse) out.push(iid);
    }
    return out;
  }
  function equip(id) {
    const it = ITEM[id];
    if (!it || !hasItem(id)) return false;
    const slot = it.type === 'weapon' ? 'weapon' : it.type === 'armor' ? 'armor'
      : it.type === 'charm' ? 'charm' : it.type === 'boots' ? 'boots' : null;
    if (!slot) { log(it.name + ' 不能装备。', 'warn'); return false; }
     
    const f = s.forge && s.forge[id];
    if (f && f.curse && equippedCursed().length >= MAX_CURSE_EQUIP) {
      log('身上最多同时带两件咒具 —— 想换就得先卸下一件。', 'warn');
      return false;
    }
    const old = s.equip[slot];
    if (old) addItem(old, 1);
    removeItem(id, 1);
    s.equip[slot] = id;
    const st = window.JH_combat.stats(s);
    s.hp = Math.min(s.hp, st.hpMax); s.cur = Math.min(s.cur, st.curMax);
    log('你装备了 ' + it.name + '。', 'item');
    return true;
  }
  function unequip(slot) {
    const id = s.equip[slot];
    if (!id) return false;
    addItem(id, 1); s.equip[slot] = null;
    log('你卸下了 ' + ITEM[id].name + '。', 'item');
    return true;
  }
  




  const FG = () => window.JH_FORGE;
  function forgeOf(id, who) {
    if (!id) return null;
    const b = who || s;
    if (!b.forge) b.forge = {};
    let f = b.forge[id];
    if (!f) { f = b.forge[id] = { lv: 0, clv: 0, curse: false, slots: [null, null, null], store: null }; }
    if (!f.slots || f.slots.length !== 3) f.slots = [null, null, null];
    if (f.lv == null) f.lv = 0;
    if (f.clv == null) f.clv = 0;
    if (f.curse == null) f.curse = false;
    return f;
  }
  function forgeOwned(id) {
    if (!id) return false;
    if (hasItem(id)) return true;
    const eq = s.equip || {};
    return eq.weapon === id || eq.armor === id || eq.charm === id;
  }
   
  function forgePct(id) {
    const f = forgeOf(id); if (!f) return 0;
    const step = FG().stepPct;
    let p = 0;
    for (let i = 0; i < (f.lv || 0); i++) p += step[i] || 0;
    for (let i = 0; i < (f.clv || 0); i++) p += step[i] || 0;
    return p;
  }
  function curseAllowed() { return FG().curseOrigins.indexOf(s.origin) >= 0; }
  function costText(cost) {
    const out = [];
    if (cost.silver) out.push(cost.silver + ' 咒币');
    for (const k in (cost.items || {})) out.push((ITEM[k] ? ITEM[k].name : k) + '×' + cost.items[k]);
    return out.join('、');
  }
  function costGap(cost) {
    const miss = [];
    if (s.silver < (cost.silver || 0)) miss.push('咒币差 ' + Math.ceil((cost.silver || 0) - s.silver));
    for (const k in (cost.items || {})) {
      const have = s.items[k] || 0;
      if (have < cost.items[k]) miss.push((ITEM[k] ? ITEM[k].name : k) + ' 差 ' + (cost.items[k] - have));
    }
    return miss;
  }
  function payCost(cost) {
    const g = costGap(cost);
    if (g.length) { log('还差点东西：' + g.join('、') + '。', 'warn'); return false; }
    s.silver -= (cost.silver || 0);
    for (const k in (cost.items || {})) removeItem(k, cost.items[k]);
    return true;
  }
   
   
  function forgeable(it) { return !!it && (it.type === 'weapon' || it.type === 'charm'); }
  function forgeUp(id) {
    const it = ITEM[id];
    if (!forgeable(it)) { log('只有兵器与配饰能上砧板。', 'warn'); return false; }
    if (!forgeOwned(id)) { log('你手边没有这件兵器。', 'warn'); return false; }
    const f = forgeOf(id);
    if (f.curse) { log(it.name + ' 已经是咒具了，普通锤子打不动它。', 'warn'); return false; }
    if (f.lv >= FG().maxLv) { log(it.name + ' 已经锻到顶了。', 'warn'); return false; }
    if (!payCost(FG().lvCost(f.lv))) return false;
    f.lv += 1;
    log('你抡了十几锤，' + it.name + ' 锻到了 +' + f.lv + '（数值 +' + (forgePct(id) * 100).toFixed(1) + '%）。', 'item');
    return true;
  }
   
  function curseUp(id) {
    const it = ITEM[id];
    if (!forgeable(it)) { log('只有兵器与配饰能咒具化。', 'warn'); return false; }
    if (!forgeOwned(id)) { log('你手边没有这件兵器。', 'warn'); return false; }
    const f = forgeOf(id);
    if (f.curse) { log(it.name + ' 已经是咒具了。', 'warn'); return false; }
    if (!curseAllowed()) { log('咒具认人：你的手压不住它。', 'warn'); return false; }
    if (f.lv > 0) { log(it.name + ' 已经强化过了，淬不进咒力了。要找一件没动过的底子。', 'warn'); return false; }
    if (s.equip.weapon !== id && s.equip.charm !== id) { log('要咒具化，得先把 ' + it.name + ' 带在身上。', 'warn'); return false; }
    if (!payCost(FG().curseCost)) return false;
    f.curse = true;
    log('咒金熔进' + it.name + '的纹路里，它醒了过来 —— 「咒具·' + it.name + '」成了。', 'realm');
    return true;
  }
   
  function curseForgeUp(id) {
    const it = ITEM[id];
    if (!forgeable(it)) { log('只有兵器与配饰能锻。', 'warn'); return false; }
    if (!forgeOwned(id)) { log('你手边没有这件兵器。', 'warn'); return false; }
    const f = forgeOf(id);
    if (!f.curse) { log(it.name + ' 还不是咒具。', 'warn'); return false; }
    if (f.clv >= FG().maxLv) { log(it.name + ' 已经锻到顶了。', 'warn'); return false; }
    if (!payCost(FG().clvCost(f.clv))) return false;
    f.clv += 1;
    log('咒力顺着纹路走了一遍，咒具·' + it.name + ' 锻到 +' + f.clv + '（数值 +' + (forgePct(id) * 100).toFixed(1) + '%）。', 'item');
    return true;
  }
  function wordCount(id, wid) {
    const f = forgeOf(id);
    return (f.slots || []).filter(x => x === wid).length;
  }
   
  function carveWord(id, slotIdx, wid) {
    const f = forgeOf(id);
    const w = window.JH_WORD_MAP[wid];
    if (!f || !f.curse) { log('不是咒具，刻不住词条。', 'warn'); return false; }
    if (!w) return false;
    const at = FG().slotsAt;
    if (slotIdx < 0 || slotIdx > 2 || f.clv < at[slotIdx]) { log('这一槽要咒具强化到 +' + at[slotIdx] + ' 才开。', 'warn'); return false; }
    if (f.slots[slotIdx]) { log('这一槽里已经刻着「' + window.JH_WORD_NAME(f.slots[slotIdx]) + '」了。', 'warn'); return false; }
    if (w.once && wordCount(id, wid) > 0) { log('「' + w.name + '」一件咒具只能刻一条。', 'warn'); return false; }
    if (!payCost(FG().carveCost)) return false;
    f.slots[slotIdx] = wid;
    log('你把「' + w.name + '」刻进了咒具·' + ITEM[id].name + ' 的纹路里。', 'item');
    return true;
  }
   
  function carveWordPool(id) {
    const pool = [];
    for (const w of window.JH_WORDS) {
      if (w.once && wordCount(id, w.id) > 0) continue;
      pool.push(w);
    }
    return pool;
  }
  function carveDraw(id, slotIdx) {
    const f = forgeOf(id);
    if (!f || !f.curse) { log('不是咒具，刻不住词条。', 'warn'); return null; }
    const at = FG().slotsAt;
    if (slotIdx < 0 || slotIdx > 2 || f.clv < at[slotIdx]) { log('这一槽要咒具强化到 +' + at[slotIdx] + ' 才开。', 'warn'); return null; }
    if (f.slots[slotIdx]) { log('这一槽里已经刻着「' + window.JH_WORD_NAME(f.slots[slotIdx]) + '」了。', 'warn'); return null; }
    const pool = carveWordPool(id);
    if (!pool.length) { log('没有能刻上去的词条了。', 'warn'); return null; }
    let rareSum = 0;
    for (const w of pool) rareSum += (w.rare != null ? w.rare : 0);
    rareSum = Math.min(0.5, rareSum);
    const normals = pool.filter(w => w.rare == null).length || 1;
    const per = (1 - rareSum) / normals;
    let r = Math.random(), got = pool[pool.length - 1];
    for (const w of pool) {
      const p = (w.rare != null) ? w.rare : per;
      if (r < p) { got = w; break; }
      r -= p;
    }
    if (!payCost(FG().carveCost)) return null;
    f.slots[slotIdx] = got.id;
    log('纹路里浮出「' + got.name + '」，你把它按进了咒具·' + ITEM[id].name + ' 第 ' + (slotIdx + 1) + ' 槽。', 'item');
    return got.id;
  }
  function uncarveWord(id, slotIdx) {
    const f = forgeOf(id);
    if (!f || f.slots[slotIdx] == null) return false;
    const wid = f.slots[slotIdx];
    f.slots[slotIdx] = null;
    log('你把「' + window.JH_WORD_NAME(wid) + '」从咒具上磨掉了（材料不退）。', 'warn');
    return true;
  }
   
  function storeWord(id, skillId, who) {
    const f = forgeOf(id, who);
    if (!f) return false;
    f.store = skillId;
    return true;
  }
  function takeStored(id, who) {
    const f = forgeOf(id, who);
    if (!f || !f.store) return null;
    const sid = f.store;
    f.store = null;
    return sid;
  }
   
  function dropStored(id, who) {
    const f = forgeOf(id, who);
    if (!f || !f.store) return false;
    const sid = f.store;
    f.store = null;
    log('你把「' + (MART[sid] ? MART[sid].name : sid) + '」从咒具里抹掉了 —— 它又空了出来，能再吸一次。', 'warn');
    return true;
  }
  function shopList() {
     
    if (s.lan) return Object.keys(ITEM);
    const r = ROOM[s.room];
    const list = (r && r.shop) || [];
    if (list.indexOf('__ALL__') >= 0) {
       
      return devEditable() ? Object.keys(ITEM) : [];
    }
    return list;
  }
   
  function freeShop() {
    const r = ROOM[s.room];
    return !!(r && (r.shop || []).indexOf('__ALL__') >= 0 && devEditable());
  }
   
  function priceOf(id) {
    const it = ITEM[id];
    if (!it) return 0;
    if (freeShop()) return 0;
    return Math.ceil((it.price || 10) * 1.0);
  }
  function buy(id) {
    const it = ITEM[id];
    if (!it || !shopList().includes(id)) return false;
    if (isEquipItem(id) && ownsItem(id)) { log('你已经有一件' + it.name + '了 —— 装备不叠，先丢掉或装备上再说。', 'warn'); return false; }
    const price = priceOf(id);
    if (s.silver < price) { log('咒币不够。', 'warn'); return false; }
    s.silver -= price; addItem(id, 1);
    if (price > 0) log('你花 ' + price + ' 咒币买下了 ' + it.name + '。', 'silver');
    else log('你从试验商店的货架上取下了 ' + it.name + '（分文不取）。', 'silver');
    return true;
  }
  function sell(id) {
    const it = ITEM[id];
    if (!it || !hasItem(id)) return false;
    const r = ROOM[s.room];
    if (!r || !r.sell) { log('这里不收东西。', 'warn'); return false; }
    const price = Math.max(1, Math.floor((it.price || 5) * 0.6));
    removeItem(id, 1); gainSilver(price);
    if (s.forge && s.forge[id]) delete s.forge[id];
    log('你把 ' + it.name + ' 折了 ' + price + ' 咒币。', 'silver');
    return true;
  }

  function joinSect(id) {
    const sc = SECT[id];
    if (!sc || id === 's_none') return false;
    if (s.sect !== 's_none') { log('你已有所属，改换门庭需先退出。', 'warn'); return false; }
    const r = sc.req || {};
    if (r.root != null && s.attrs.root < r.root) { log('根骨不足，他们不收。', 'warn'); return false; }
    if (r.insight != null && s.attrs.insight < r.insight) { log('悟性不足，他们不收。', 'warn'); return false; }
    if (r.realm != null && s.realm < r.realm) { log('等级不够，他们不收。', 'warn'); return false; }
    if (r.flag && !s.flags[r.flag]) { log('你找不到入口。', 'warn'); return false; }
    if (sc.hidden && !s.flags.knows_curse_user && !s.flags.knows_high) { log('这个组织的门，不在明面上。', 'warn'); return false; }
    if (!devEditable()) {
      s.sectJoined = s.sectJoined || [];
      if (s.sectJoined.indexOf(id) < 0 && s.sectJoined.length >= 3) {
        log('人一生认下的组织最多三个，你的路已经走满了。', 'warn');
        return false;
      }
    }
    s.sect = id; s.contrib = 0;
    s.spar = null;                         
    s.sectJoined = s.sectJoined || [];
    if (s.sectJoined.indexOf(id) < 0) s.sectJoined.push(id);
    log('你加入了 ' + sc.name + '。（引路人：' + sc.master + '）', 'sect');
    return true;
  }
  function leaveSect() {
    if (s.sect === 's_none') return false;
    const oldId = s.sect, old = SECT[oldId];
     
    if (devEditable()) {
      s.sect = 's_none'; s.contrib = 0; s.spar = null;
      log('【调试】你退出了 ' + old.name + '（本出身，不做结算）。', 'warn');
      return true;
    }
    const loss = leaveSectLoss();
    const ids = new Set(old.skills || []);
     
    for (const id of Object.keys(s.skills || {})) {
      const m = MART[id];
      if (m && (m.sect === oldId || ids.has(id))) { delete s.skills[id]; delete s.skillLv[id]; }
    }
     
    for (const k of ['atk', 'nei', 'qing']) {
      const key = k === 'atk' ? 'activeAtk' : (k === 'nei' ? 'activeNei' : 'activeQing');
      s[key] = activeArray(s, k).filter(id => { const m = MART[id]; return !(m && (m.sect === oldId || ids.has(m.id))); });
    }
    syncTech();
     
    for (const id of (window.JH_SECT_MEMBERS || {})[oldId] || []) {
      if ((s.aff[id] || 0) > 0) s.aff[id] = 0;
    }
    s.contrib = 0; s.sect = 's_none'; s.spar = null;
    s.sectLeft = (s.sectLeft || 0) + 1;
    if (loss.skills.length) log('你忘光了 ' + old.name + ' 的术式：' + loss.skills.join('、') + '。', 'warn');
    if (loss.techs.length) log('你丢下了主修：' + loss.techs.join('、') + '。', 'warn');
    if (loss.aff.length) log('同门的情分断了：' + loss.aff.join('、') + ' 的好感归零。', 'warn');
    log('你退出了 ' + old.name + '。贡献清零，门中术式尽数散去，此后再无瓜葛。', 'warn');
    return true;
  }
   
  function leaveSectLoss() {
    if (!s || !s.sect || s.sect === 's_none') return null;
    const sc = SECT[s.sect];
    const ids = new Set(sc.skills || []);
    const owned = m => m && (m.sect === s.sect || ids.has(m.id));
    const skills = Object.keys(s.skills || {}).map(id => MART[id]).filter(owned).map(m => m.name);
    const techs = ['atk', 'nei', 'qing'].map(k => MART[s.tech[k]]).filter(owned).map(m => m.name);
    const members = (window.JH_SECT_MEMBERS || {})[s.sect] || [];
    const aff = members.filter(id => (s.aff[id] || 0) > 0).map(id => (NPC[id] || {}).name || id);
    return { sect: sc, skills, techs, aff, contrib: s.contrib || 0, debug: devEditable() };
  }
  function sectDaily() {
    if (s.sect === 's_none') { log('你还没有归属。', 'warn'); return false; }
    const today = dayCount(s);
    if (s.sectDaily === today) { log('今日的任务已经做过了。', 'warn'); return false; }
    s.sectDaily = today;
    const gain = 6 + s.realm;
    s.contrib += gain;
    gainExp(120 + s.realm * 40, true);
    gainSilver(30 + s.realm * 10);
    log('你完成了今日任务，贡献 +' + gain + '。', 'sect');
    return true;
  }

  



  function sparPool(sect) {
    const ids = ((window.JH_SECT_MEMBERS || {})[sect] || []).filter(id => window.JH_NPC_MAP[id]);
    if (ids.length) return ids.map(id => ({ key: id, npcId: id, name: window.JH_NPC_MAP[id].name }));
    const names = (window.JH_SECT_SPAR_NAMES || {})[sect] || ['同门·甲', '同门·乙', '同门·丙', '同门·丁'];
    return names.map((nm, i) => ({ key: 'spar:' + sect + ':' + i, npcId: null, name: nm }));
  }
  function sparRoster() {
    if (s.sect === 's_none') return [];
    s.spar = s.spar || { day: 0, sect: '', list: [], count: {} };
    const today = dayCount(s);
    

    if (s.spar.day !== today || s.spar.sect !== s.sect || !s.spar.list || !s.spar.list.length) {
      const pool = sparPool(s.sect);
      let picked;
      if (devEditable()) picked = pool.slice();
      else {
        const want = 1 + Math.floor(Math.random() * Math.min(4, pool.length));
        picked = pool.slice();
        for (let i = picked.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const tmp = picked[i]; picked[i] = picked[j]; picked[j] = tmp; }
        picked = picked.slice(0, want);
      }
      s.spar = { day: today, sect: s.sect, list: picked, count: {} };
      log('今日同门到场：' + picked.map(x => x.name).join('、') + '。', 'sect');
    }
    return s.spar.list;
  }
  function sparLeft(key) {
    if (devEditable()) return 99;
    return Math.max(0, 3 - ((s.spar.count || {})[key] || 0));
  }
  

  function sparFoeDef(who, lvl, tid) {
    if (who.npcId === 'npc_teacher' && window.JH_FOE_MAP['f_b_gojo'] && Math.random() < 0.10)
      return Object.assign({}, window.JH_FOE_MAP['f_b_gojo'], { id: tid });
    return { id: tid, name: who.name + '（同门）', lvl: lvl, rounds: 7, margin: 1.5, human: true,
      exp: 0, silver: 0, loot: [], skills: [], desc: '同门，手上留着分寸。' };
  }
  function sparStart(key) {
    if (s.sect === 's_none') { log('你还没有归属，没人陪你练。', 'warn'); return false; }
    if (battle) return false;
    sparRoster();
    const who = (s.spar.list || []).find(x => x.key === key);
    if (!who) { log('今天这人不在。', 'warn'); return false; }
    if (!devEditable() && sparLeft(key) <= 0) { log('今日已经和他练过三次了，再练也难有长进。', 'warn'); return false; }
    const lvl = Math.max(0, Math.min(9, s.realm));
    const tid = 'spar_' + String(key).replace(/[^a-zA-Z0-9_:]/g, '_');
    const def = sparFoeDef(who, lvl, tid);
    const gojo = (def.name === '五条悟');
    window.JH_FOE_MAP[tid] = def;
    if (!startBattle(tid)) { delete window.JH_FOE_MAP[tid]; return false; }
    battle.spar = { key: key, name: who.name, uses: {}, npcId: who.npcId, gojo: gojo };
    battle.foe.spar = battle.spar;
    if (gojo) log(who.name + ' 转过身来 —— 站在那里的，却是另一个人。', 'fight');
    log('你和 ' + (gojo ? '他' : who.name) + ' 过起招来。', 'fight');
    return true;
  }
   
  function sparSettle(sp, win) {
    const ups = [];
    const gojo = !!(sp && sp.gojo);
    const mult = gojo ? 20 : (win ? 20 : 10);
    const raw = {};
    let total = 0;
    for (const tid of Object.keys(sp.uses || {})) {
      const g = (sp.uses[tid] || 0) * mult;
      if (g <= 0) continue;
      raw[tid] = g; total += g;
    }
    const debug = devEditable();
     
    const scale = gojo ? 1 : ((!debug && total > 100) ? 100 / total : 1);
    let best = 0;
    for (const tid of Object.keys(raw)) {
      const t = window.JH_INNATE_MAP[tid];
      if (!t) continue;
      let gain = Math.round(raw[tid] * scale);
      if (gojo) gain = Math.min(300, gain);
      if (gain <= 0) continue;
      best = Math.max(best, gain);
      s.innateExp[tid] = (s.innateExp[tid] || 0) + gain;
      let lv = s.innateLv[tid] || 1;
      while (lv < 10 && s.innateExp[tid] >= (window.JH_TECH_LV[lv] || Infinity)) {
        lv++; s.innateLv[tid] = lv;
        ups.push(t.name + ' ' + techLvName(lv));
        onTechLevel(tid, lv);
      }
    }
    s.spar.count[sp.key] = (s.spar.count[sp.key] || 0) + 1;
    const used = s.spar.count[sp.key];
    const noUse = !Object.keys(sp.uses || {}).length;
    log((gojo ? '与他的这一场到此为止' : '对练结束（' + (win ? '你赢了' : '你输了') + '）') + '：' +
      (noUse ? '你没怎么用出生得术式，熟悉的程度有限。' : '熟练度最长进的一门进了 ' + best + ' 点。') +
      '（今日第 ' + used + ' / 3 次）', 'learn');
    if (ups.length) log('术式精进：' + ups.join('、') + '。', 'learn');
    return true;
  }
  function sectBuy(id) {
    const sc = SECT[s.sect];
    if (!sc) return false;
    const entry = (sc.shop || []).find(e => e[0] === id);
    if (!entry) return false;
    if (MART[id] && s.skills[id]) { log('这门你已经学会了。', 'warn'); return false; }
    if (!MART[id] && isEquipItem(id) && ownsItem(id)) { log('这件你已经有了 —— 装备不叠，先丢掉或装备上再说。', 'warn'); return false; }
    if (s.contrib < entry[1]) { log('贡献不足。', 'warn'); return false; }
    s.contrib -= entry[1];
    if (MART[id]) learn(id); else addItem(id, 1);
    log('你用 ' + entry[1] + ' 点贡献换得了 ' + (MART[id] ? MART[id].name : ITEM[id].name) + '。', 'sect');
    return true;
  }

   
  function evKindOf(c) { return /^sd_/.test(c.id) ? 'side' : 'main'; }
  function allEvents() {
    const out = [];
    for (const c of window.JH_STORY) out.push({ ev: c, kind: evKindOf(c) });
    for (const c of window.JH_HIDDEN) out.push({ ev: c, kind: 'hidden' });
    return out;
  }
  function autoEvent() {
    if (s.event) return false;
    for (const item of allEvents()) {
      const ev = item.ev, kind = item.kind;
      if (s.storyDone[ev.id]) continue;
      if (s.defer[ev.id] && s.defer[ev.id] > s.t) continue;
      if (!condMet(ev.cond)) continue;
      s.event = { id: ev.id, node: ev.start || 'a', kind };
      log('【' + (kind === 'main' ? '剧情' : (kind === 'side' ? '支线' : '隐藏剧情')) + '】' + ev.name, 'story');
      checkEggs();
      return true;
    }
    return false;
  }
  function eventDef(id) {
    return window.JH_STORY.find(x => x.id === id) || window.JH_HIDDEN.find(x => x.id === id) || null;
  }

  


  function storyKindOf(id) {
    if (/^sd_/.test(id)) return 'side';
    return window.JH_STORY.some(x => x.id === id) ? 'main' : 'hidden';
  }
  function storyList() {
    if (!devEditable()) return [];
    return allEvents().map(it => ({
      id: it.ev.id, name: it.ev.name, kind: evKindOf(it.ev) === 'side' ? 'side' : it.kind,
      done: !!s.storyDone[it.ev.id],
      deferred: !!(s.defer[it.ev.id] && s.defer[it.ev.id] > s.t),
      playing: !!(s.event && s.event.id === it.ev.id)
    }));
  }
  function enterStory(id) {
    if (!devEditable()) return false;
    if (battle) { log('打起来的时候没法讲别的。', 'warn'); return false; }
    const ev = eventDef(id);
    if (!ev) { log('没有这段剧情：' + id, 'warn'); return false; }
    s.event = { id: id, node: ev.start || 'a', kind: storyKindOf(id) };
    log('【调试】直接进入「' + ev.name + '」。', 'story');
    checkEggs();
    return true;
  }
  function unsetStory(id) {
    if (!devEditable()) return false;
    const ev = eventDef(id);
    if (!ev) return false;
    delete s.storyDone[id];
    

    s.defer[id] = s.t + 900;
    log('【调试】「' + ev.name + '」已复位 —— 先搁置 15 分钟，免得当场又拉你进去；想立刻重走就点「进入」。', 'warn');
    return true;
  }
  function curEvent() {
    if (!s.event) return null;
    const def = eventDef(s.event.id);
    if (!def) { s.event = null; return null; }
    const node = def.nodes[s.event.node];
    return { def, node, id: s.event.id, nodeId: s.event.node };
  }
  function choose(idx) {
    if (battle) return false;      
    const ce = curEvent();
    if (!ce) return false;
    const ch = (ce.node.choices || [])[idx];
    if (!ch) return false;
    if (!condMet(ch.req)) { log('条件不足，无法如此行事。', 'warn'); return false; }
    if (ch.take) {
      if (ch.take.silver && s.silver < ch.take.silver) { log('咒币不足。', 'warn'); return false; }
      if (ch.take.silver) s.silver -= ch.take.silver;
      if (ch.take.item) { for (const i of ch.take.item) removeItem(i, 1); }
    }
    if (ch.set) for (const k in ch.set) s.flags[k] = ch.set[k];
    if (ch.give) for (const i of ch.give) addItem(i, 1);
    if (ch.learn) for (const i of ch.learn) learn(i);
     
    if (ch.item) addItem(ch.item, 1);
    if (ch.title) awardTitle(ch.title);
    if (ch.note) log(ch.note, 'story');
    if (ch.fight) {
      if (startBattle(ch.fight, ch.fightMul)) {
        s.event = { id: ce.id, node: ce.nodeId, kind: s.event.kind,
          pending: { win: ch.go || null, lose: ch.loseGo || null, fled: ch.fleeGo || null, def: ce.def.name } };
        checkEggs();
        return true;
      }
      log('（战端未起。）', 'warn');
    }
    if (ch.end || !ch.go) {
      if (ch.defer) {
        s.defer[ce.id] = s.t + 900;
        s.event = null;
        log('【' + ce.def.name + '】暂且搁下，日后再来。', 'story');
      } else {
        s.storyDone[ce.id] = true;
        s.event = null;
        log('【' + ce.def.name + '】告一段落。', 'story');
        autoEvent();
      }
    } else {
      s.event.node = ch.go;
    }
    checkEggs();
    return true;
  }
  function awardTitle(t) {
    if (!t) return;
    if (s.titles[t]) return;
    s.titles[t] = Date.now();
    log('★ 达成称号：「' + t + '」', 'egg');
  }
  function eggMet(e) {
    const c = s.c;
    switch (e.type) {
      case 'search': return (c.search[e.room] || 0) >= e.n;
      case 'visit':  return (c.visit[e.room] || 0) >= e.n;
      case 'action': return !e.room ? (c.action[e.act] || 0) >= e.n
                                    : (c.action[e.act] || 0) >= e.n && s.room === e.room;
      case 'talk':   return (c.talk[e.npc] || 0) >= e.n;
      case 'click':  return (c.click[e.target] || 0) >= e.n;
      case 'at':     {
        if (s.room !== e.room) return false;
        const h = gameHour(s);
        const idx = e.hours || [];
        if (idx.indexOf(h) >= 0) return true;
        return idx.some(x => x > 12 && shichenIdx(s) === (x - 12));
      }
      case 'idle':   return (c.idle[e.room] || 0) >= e.n;
      case 'items':  return (e.items || []).every(i => hasItem(i));
      case 'silver': return s.silver >= e.n;
      case 'realm':  return s.realm >= e.n;
      case 'crit':   return c.crit >= e.n;
      case 'win':    return c.win >= e.n;
      case 'lose':   return c.lose >= e.n;
      case 'bag':    return bagTypes() >= e.n;
      default: return false;
    }
  }
  function checkEggs() {
    let any = false;
    for (const e of window.JH_EGGS) {
      if (s.eggs[e.id]) continue;
      if (!eggMet(e)) continue;
      s.eggs[e.id] = Date.now();
      awardTitle(e.title);
      const r = e.reward || {};
      if (r.exp) gainExp(r.exp);
      if (r.silver) gainSilver(r.silver);
      if (r.item) addItem(r.item, 1);
      any = true;
    }
    return any;
  }
  function click(target) {
    s.c.click[target] = (s.c.click[target] || 0) + 1;
    checkEggs();
  }
  function secret(word) {
    const w = String(word || '').trim();
    if (!w) return false;
    const e = window.JH_EGGS.find(x => x.type === 'secret' && x.word === w);
    if (!e) { log('你念了一句，什么也没有发生。', 'warn'); return false; }
    if (s.eggs[e.id]) { log('这句话你已经说过了。', 'warn'); return false; }
    s.eggs[e.id] = Date.now(); awardTitle(e.title);
    const r = e.reward || {};
    if (r.exp) gainExp(r.exp);
    if (r.silver) gainSilver(r.silver);
    if (r.item) addItem(r.item, 1);
    return true;
  }

  

  function sparInput(text) {
    if (!battle || !battle.foe) return false;
    const foe = battle.foe;
    if (!foe.spar || !foe.spar.gojo || !foe.gentleWord) return false;
    const w = String(text == null ? '' : text).replace(/\s+/g, '');
    if (w !== foe.gentleWord) return false;
    if (foe.gentle) { log('他仍旧只是站在那里。', 'info'); return true; }
    foe.gentle = true;
    if (foe.dom) log('★ 他抬手一收，领域「' + foe.dom.name + '」散得干干净净。', 'fight');
    foe.dom = null;
    const say = foe.gentleSay || '你好';
    foe.ndSay = { who: 'foe', text: say, until: Date.now() + 60000 };
    if (battle.log) battle.log.push(say);
    log('他看了你一眼，应了一声：「' + say + '」。', 'info');
    return true;
  }

  let battle = null;
   
  function domainIdsOf() {
    const out = [];
    for (const tid of (s.domain || [])) { const t = window.JH_INNATE_MAP[tid]; if (t && t.domain) out.push(t.domain); }
    for (const id of Object.keys(s.skills || {})) { const m = MART[id]; if (m && m.domain) out.push(id); }
    return out;
  }
   
  function hasOpenDomain() {
    return domainIdsOf().some(id => { const m = MART[id]; return !!m && window.JH_combat.domIsOpen(m); });
  }
  function setDomainForm(f) { s.domForm = (f === 'closed') ? 'closed' : 'open'; return s.domForm; }

  function startBattle(foeId, mul) {
    if (battle && battle.pvp) return false;    
    const foe = window.JH_combat.makeFoe(foeId, mul || (1 + s.realm * 0.05));
    if (!foe) return false;
    battle = { foe, log: [], round: 1 };
    s.domForm = 'closed';                 
    s.nearDeath = 0;                      
    s.ndUsed = 0;                         
    s.castStreak = 0;                     
    clearBattleBuffs();                   
    s.idle.on = false; stopAct(false);    
    log('遭遇：' + foe.name + '。', 'fight');
    return true;
  }
  function battleAct(action) {
    if (!battle) return false;
    const foe = battle.foe;
    const l = [];
    if (battle.lan) return lanBattleAct(action, l);
    if (battle.pvp) return mirrorBattleAct(action, l);
     
    if (action && action.type === 'healtoggle') {
      window.JH_combat.playerAct(s, foe, action, l);
      battle.log.push.apply(battle.log, l);
      if (battle.log.length > 60) battle.log.splice(0, battle.log.length - 60);
      return true;
    }
    window.JH_combat.playerAct(s, foe, action, l);
    window.JH_combat.nearDeathCheck(s, l);    
    window.JH_combat.foeNearDeath(foe, l);    
     
    if (battle.spar && action) {
      let tid = null;
      if (action.type === 'skill' && MART[action.id] && MART[action.id].innate) {
        const nm = MART[action.id].name;
        if (l.some(x => x.indexOf('你使出「' + nm + '」') >= 0)) tid = MART[action.id].innate;
      } else if (action.type === 'drive' && s.skills.sk_csm_tame) {
        tid = 't_csm';
      }
      if (tid) battle.spar.uses[tid] = (battle.spar.uses[tid] || 0) + 1;
    }
    if (foe._fled) { finishBattle(false, true); return true; }
    if (foe.hp <= 0) { battle.log.push.apply(battle.log, l); finishBattle(true, false); return true; }
    if (foe.gentle) l.push('他只是站在那里，什么也没有做。');    
    else window.JH_combat.foeAct(s, foe, l);
     
    window.JH_combat.playerStatusTick(s, l);
    window.JH_combat.healTick(s, l, undefined, { free: !!(foe && foe.dummy) });
    window.JH_combat.foeHealTick(foe, l);
    window.JH_combat.curTick(s, l);               
    window.JH_combat.curTick(foe, l, foe.name);
    window.JH_combat.domTick(s, foe, l);
    window.JH_combat.domTick(foe, s, l);
    window.JH_combat.domUpkeep(s, l);
    window.JH_combat.domUpkeep(foe, l);
    window.JH_combat.autoFeedDomain(s, l);
    window.JH_combat.domAttrition(s, foe, l);
    battle.log.push.apply(battle.log, l);
    if (battle.log.length > 60) battle.log.splice(0, battle.log.length - 60);
    if (s.hp <= 0) { finishBattle(false, false); return true; }
    window.JH_combat.tickCd(s, 1);            
    battle.round++;
    return true;
  }
  function finishBattle(win, fled) {
    if (!battle) return;
    if (battle.lan) {            
      const tail = battle.log.slice(-6);
      clearBattleBuffs(); restoreShattered(); undressAsFoe(battle.foe);
      for (const line of tail) log(line, 'fight');
      log(win ? '这一局你赢了。' : (fled ? '这一局你收了手。' : '这一局你输了。'), 'info');
      lanResult = { win: !!win, fled: !!fled };
      battle = null;
      return;
    }
    if (battle.pvp) {           
      const tail = battle.log.slice(-6);
      restoreShattered(); clearBattleBuffs(); undressPlayerFoe(); mirrorRestore();
      for (const line of tail) log(line, 'fight');
      log(win ? '你握着的那一边把对面打散了 —— 镜子里两个人影各自归位。' : '你握着的那一边散了 —— 镜子里两个人影各自归位。', 'info');
      battle = null;
      return;
    }
    clearBattleCd();                      
    if (battle && battle.trial && win) trialPass(battle.trial);
    const foe = battle.foe, bl = battle.log;
    if (foe.dummy) {
      for (const line of bl.slice(-6)) log(line, 'fight');
      log(fled ? '你收了手，木桩上又添了几道新痕。' : '木桩没倒，你先歇了。', 'info');
      reapShattered();
      clearBattleBuffs();
      battle = null;
      return;
    }
     
    if (foe.spar) {
      for (const line of bl.slice(-6)) log(line, 'fight');
      sparSettle(foe.spar, !!win);
      settleSummons();
      reapShattered();
      clearBattleBuffs();
      battle = null;
      checkEggs();
      return;
    }
    for (const line of bl.slice(-6)) log(line, 'fight');
    if (win) {
      s.c.win++; s.c.winStreak++; s.stats.kills++;
      s.clear[s.scene] = (s.clear[s.scene] || 0) + 1;
      log('你祓除了 ' + foe.name + '。修为 +' + foe.exp + '，咒币 +' + foe.silver + '。', 'win');
       
      if (foe.slainBy === 'skill:sk_mm_borrow') offerMimic(foe);
      gainExp(foe.exp, true); gainSilver(foe.silver);
      for (const it of foe.loot) if (Math.random() < it[1]) { if (it[0] === 'silver') gainSilver(it[2]); else addItem(it[0], it[2]); }
    } else if (fled) {
      log('你退出了战圈。', 'warn');
    } else {
      s.c.lose++; s.c.winStreak = 0;
      s.hp = 1;                      
      log('你倒下了。醒来时，天已经黑了。', 'lose');
    }
    settleSummons();
    reapShattered();
    clearBattleBuffs();
    battle = null;
    if (s.event && s.event.pending) {
      const pd = s.event.pending;
      const back = win ? pd.win : (fled ? pd.fled : pd.lose);
      s.event.pending = null;
      if (back) { s.event.node = back; }
      else if (fled || !win) {
        const id = s.event.id;
        s.defer[id] = s.t + 900; s.event = null;
        log('【' + (pd.def || '这一段') + '】暂且搁下，日后再来。', 'story');
      } else {
        const id = s.event.id;
        s.storyDone[id] = true; s.event = null;
        log('【' + (pd.def || '这一段') + '】告一段落。', 'story');
        autoEvent();
      }
    }
    checkEggs();
  }
   
  function bossGate() {
    if (window.JH_DEV && window.JH_DEV.bossGate != null) return window.JH_DEV.bossGate;
    return 3;
  }
  function sceneBoss(sceneId) {
    const sid = sceneId || s.scene;
    return window.JH_FOES.find(f => f.scene === sid && f.boss && !f.final) || null;
  }
  function bossReady() {
    if (s.travel) return null;
    if ((s.clear[s.scene] || 0) < bossGate()) return null;
    return sceneBoss();
  }
  function encounterBoss() {
    if (s.travel) { log('你还在赶路。', 'warn'); return false; }
    const b = bossReady();
    if (!b) { log('此地的头目还没露面——先清掉 ' + bossGate() + ' 只咒灵。', 'warn'); return false; }
    return startBattle(b.id);
  }
  function encounter() {
    if (s.travel) { log('你还在赶路。', 'warn'); return false; }
    const room = ROOM[s.room];
    const pool = window.JH_FOES.filter(f => f.scene === room.scene && !f.boss && !f.dummy);
    if (!pool.length) { log('这一带很太平。', 'warn'); return false; }
    const pickF = pool[(Math.random() * pool.length) | 0];
    return startBattle(pickF.id);
  }
   
  function startDummy() {
    if (s.travel) { log('你还在赶路。', 'warn'); return false; }
    if (battle) return false;
    const foe = window.JH_combat.makeFoe('f_dummy', 1);
    if (!foe) return false;
    battle = { foe, log: [], round: 1 };
    s.domForm = 'closed';                 
    clearBattleBuffs();
    s.idle.on = false; stopAct(false);
    log('你走到木桩前面，拉开架势。（练功：不耗咒力，随时可以收手）', 'fight');
    return true;
  }
  


  const MIRROR_KEYS = ['hpMax', 'curMax', 'phyAtk', 'curAtk', 'def', 'crit', 'dodge'];
   
  const MIRROR_MIN100 = ['hpMax', 'curMax', 'phyAtk', 'curAtk', 'def'];
  function mirrorFromPlayer() {
    const st = window.JH_combat.stats(s);
    return {
      lv: Math.max(1, s.realm),
      ceEff: Math.round(st.ceEff * 100), ceCtl: Math.round(st.ceCtl * 100),
      hpMax: st.hpMax, curMax: st.curMax, phyAtk: st.phyAtk, curAtk: st.curAtk, def: st.def,
      crit: st.crit, dodge: st.dodge,
      out: { phy: (s.out && s.out.phy) || 50, cur: (s.out && s.out.cur) || 50 },
      skills: Object.keys(s.skills || {}).filter(id => MART[id] && MART[id].kind === 'atk'),
      innate: (s.innate || []).slice()
    };
  }
  



  const MIRROR_HP_MIN = 999999;
  const MIRROR_HP_MAX = 1e12;                  
  const MIRROR_HIT_MULT = 12;                  
  const MIRROR_MY_MULT = 2;                    
  function mirrorDefault() {
    const c = mirrorFromPlayer();
    c.hpMax = Math.max(c.hpMax || 0, MIRROR_HP_MIN);
    c.curMax = Math.max(c.curMax || 0, MIRROR_HP_MIN);
    return c;
  }
   
  function mirrorCfg() {
    if (!s.mirror || typeof s.mirror !== 'object') s.mirror = mirrorDefault();
    const c = s.mirror;
    c.lv = Math.max(1, Math.min(9, Math.round(+c.lv || 1)));
    c.ceEff = Math.max(20, Math.min(80, Math.round(+c.ceEff || 60)));
    c.ceCtl = Math.max(20, Math.min(80, Math.round(+c.ceCtl || 60)));
    for (const k of MIRROR_KEYS) {
      const v = +c[k];
      if (c[k] == null || c[k] === '' || !isFinite(v)) c[k] = MIRROR_MIN100.indexOf(k) >= 0 ? 100 : 0;
      else c[k] = Math.min(MIRROR_HP_MAX, Math.max(0, Math.round(v)));
      if (MIRROR_MIN100.indexOf(k) >= 0 && !c[k]) c[k] = 100;
    }
    c.skills = Array.isArray(c.skills) ? c.skills.filter(id => MART[id]) : [];
    c.innate = Array.isArray(c.innate) ? c.innate.filter(t => window.JH_INNATE_MAP[t]) : [];
    c.out = Object.assign({ phy: 50, cur: 50 }, c.out || {});
    c.out.phy = Math.max(20, Math.min(100, Math.round(+c.out.phy || 50)));
    c.out.cur = Math.max(20, Math.min(100, Math.round(+c.out.cur || 50)));
    c.auto = c.auto !== false;                                   
    c.hits = Math.max(1, Math.min(999, Math.round(+c.hits || MIRROR_HIT_MULT)));
    return c;
  }
  function setMirrorCfg(patch) {
    const c = mirrorCfg();
    if (patch) for (const k of Object.keys(patch)) c[k] = patch[k];
    return mirrorCfg();
  }
  



  function mirrorAutoOn() { return mirrorCfg().auto !== false; }
  function mirrorAutoHits() { return Math.max(1, Math.min(999, Math.round(+mirrorCfg().hits || MIRROR_HIT_MULT))); }
  function mirrorFloorHp(a) {
    const peakOf = x => (window.JH_combat && window.JH_combat.peakHit) ? window.JH_combat.peakHit(x) : 0;
    const peak = Math.max(peakOf(s), peakOf(a));
    return Math.max(MIRROR_HP_MIN, Math.round(peak * mirrorAutoHits()));
  }
   
  function mirrorAuto() {
    const on = mirrorAutoOn();
    let floor = 0;
    try { if (on) floor = mirrorFloorHp(mirrorActor()); } catch (e) { floor = 0; }
    return { on: on, hits: mirrorAutoHits(), floor: floor, mine: mirrorMyHp(floor), min: MIRROR_HP_MIN };
  }
  function mirrorMyHp(floor) { return Math.max(0, Math.round(floor * MIRROR_MY_MULT)); }
  function mirrorReset() { s.mirror = mirrorFromPlayer(); return s.mirror; }
  function mirrorToggleSkill(id) {
    const c = mirrorCfg(), i = c.skills.indexOf(id);
    if (i >= 0) c.skills.splice(i, 1); else c.skills.push(id);
    return c.skills.length;
  }
  function mirrorToggleInnate(id) {
    if (!window.JH_INNATE_MAP[id]) return 0;
    const c = mirrorCfg(), i = c.innate.indexOf(id);
    if (i >= 0) c.innate.splice(i, 1); else c.innate.push(id);
    return c.innate.length;
  }
   
  function mirrorActor() {
    const c = mirrorCfg();
    const deep = o => JSON.parse(JSON.stringify(o || {}));    
    const a = {
      realm: c.lv, origin: s.origin, mirror: true, name: '镜像',
      desc: '镜子里那个你：数值和术式都由你填。握住哪一边，另一边就由电脑替你出招。',
      attrs: { insight: 60, root: 60, luck: 20, face: 20 },
      ce: { eff: c.ceEff / 100, ctl: c.ceCtl / 100, cap: 0.8 },
      tech: { atk: null, nei: null, qing: null }, activeAtk: [], activeNei: [], activeQing: [], party: {},
      skills: {}, skillLv: {}, innate: [], innateLv: {}, domain: [],
      equip: deep(s.equip),
      items: deep(s.items), forge: deep(s.forge), borrow: deep(s.borrow),
      tamed: {}, secret: {}, pst: {}, cd: {}, overload: 0, castStreak: 0,
      ndUsed: 0, ndBoost: 0, buff: null, bf: { t: [] }, domForm: 'closed', domFeed: 0, csmBank: 0,
      out: { phy: c.out.phy, cur: c.out.cur },
      statOver: { hpMax: c.hpMax, curMax: c.curMax, phyAtk: c.phyAtk, curAtk: c.curAtk, def: c.def, crit: c.crit, dodge: c.dodge },
      st: {}, lvl: c.lv, dummy: false, loot: [],
      c: { win: 0, lose: 0, winStreak: 0, crit: 0 }, stats: { kills: 0 }
    };
    

    const lvOf = id => Math.max(1, (s.skillLv && s.skillLv[id]) || 1);
    for (const id of c.skills) {
      const m = MART[id]; if (!m) continue;
      if (!(s.skills && s.skills[id])) continue;
      a.skills[id] = 1; a.skillLv[id] = lvOf(id);
      

      if (m.kind === 'nei') a.activeNei.push(id);
      else if (m.kind === 'qing') a.activeQing.push(id);
      else if (m.kind !== 'passive') a.activeAtk.push(id);
    }
    for (const t of c.innate) {
      const def = window.JH_INNATE_MAP[t]; if (!def) continue;
      const lv = Math.max(1, (s.innateLv && s.innateLv[t]) || 1);
      a.innate.push(t); a.innateLv[t] = lv;
      if (def.domain && (s.domain || []).indexOf(t) >= 0) a.domain.push(t);
      for (const id of (def.skills || [])) {
        if (!MART[id] || !(s.skills && s.skills[id])) continue;
        a.skills[id] = 1; a.skillLv[id] = lvOf(id);
      }
    }
    const st = window.JH_combat.stats(a);
     
    a.hpMax = Math.max(1, st.hpMax); a.curMax = Math.max(0, st.curMax);
    a.hp = a.hpMax; a.cur = a.curMax;
    a.phyRes = 0; a.curRes = 0; a.def = st.def; a.atk = Math.round(st.phyAtk); a.loot = [];
    a.atks = Object.keys(a.skills);
    return a;
  }
   
  function mirrorAi(actor, target, l) {
    if (!actor || actor.hp <= 0) return;
    const pick = window.JH_combat.bestSkill(actor, target);
    if (pick) window.JH_combat.playerAct(actor, target, { type: 'skill', id: pick.id }, l);
    else window.JH_combat.playerAct(actor, target, { type: 'attack' }, l);
  }
  

  const MASK_KEYS = ['phyRes', 'curRes', 'def', 'atk', 'st', 'lvl', 'dummy', 'loot', 'hpMax', 'curMax'];
  

  const foeMasks = new WeakMap();
  function dressAsFoe(x) {
    if (!x || foeMasks.has(x)) return;
    const st = window.JH_combat.stats(x);
    const vals = { phyRes: 0, curRes: 0, def: st.def, atk: Math.round(st.phyAtk), st: {},
      lvl: x.realm || 0, dummy: false, loot: [], hpMax: st.hpMax, curMax: st.curMax };
    const keys = [];
    for (const k of MASK_KEYS) if (x[k] === undefined) { x[k] = vals[k]; keys.push(k); }
    foeMasks.set(x, { keys: keys, vals: vals });
  }
  function undressAsFoe(x) {
    const m = x ? foeMasks.get(x) : null;
    if (!m) return;
    for (const k of m.keys) delete x[k];
    foeMasks.delete(x);
  }
  function dressPlayerAsFoe() { dressAsFoe(s); }
  function undressPlayerFoe() { undressAsFoe(s); }

  


  

  let mirrorSnap = null;
  function mirrorSnapshot() { mirrorSnap = JSON.parse(JSON.stringify(s)); }
  function mirrorRestore() {
    if (!mirrorSnap) return;
    const snap = mirrorSnap; mirrorSnap = null;
    for (const k of Object.keys(s)) if (!(k in snap)) delete s[k];
    for (const k of Object.keys(snap)) s[k] = snap[k];
  }
  function startMirror() {
    if (battle) return false;
    mirrorSnapshot();
    const a = mirrorActor();
    let floor = 0;
    if (mirrorAutoOn()) {
      floor = mirrorFloorHp(a);
      if (!a.statOver) a.statOver = {};
      a.statOver.hpMax = Math.max(a.statOver.hpMax || 0, floor);    
      a.hpMax = a.statOver.hpMax; a.hp = a.hpMax;
      const st = window.JH_combat.stats(s);
      if (!s.statOver) s.statOver = {};
      s.statOver.hpMax = Math.max(st.hpMax, mirrorMyHp(floor));     
      if (s.hp < s.statOver.hpMax) s.hp = s.statOver.hpMax;
    }
    battle = { foe: a, log: [], round: 1, pvp: true, ctrl: 'hero' };
    s.domForm = 'closed'; a.domForm = 'closed';    
    dressPlayerAsFoe();
    a.pst = {};
    clearBattleBuffs();
    s.ndUsed = 0; s.castStreak = 0; s.domFeed = 0; s.cd = {}; s.overload = 0;
    a.domFeed = 0;
    s.idle.on = false; stopAct(false);
    log('你站到镜子前。镜子里那个你同时抬起手，分毫不差。（随时可以「换视角」)' +
      (floor ? '〔沙盘血量：两边气血都兜到 ' + floor + ' 起（双方最强一击 × ' + mirrorAutoHits() + '）—— 免得伤害一高、一手就散场。想完全按面板的数字来，把面板里的「自动标定」关掉。〕' : ''), 'fight');
    return true;
  }
   
  function mirrorBattleAct(action, l) {
    const foe = battle.foe;
    const ctrlFoe = battle.ctrl === 'foe';
    const mine = ctrlFoe ? foe : s, other = ctrlFoe ? s : foe;
    if (action && action.type === 'switch') {
      battle.ctrl = ctrlFoe ? 'hero' : 'foe';
      l.push('你换了个位置 —— 现在握着' + (battle.ctrl === 'foe' ? '镜像' : '自己') + '的手。');
      battle.log.push.apply(battle.log, l);
      return true;
    }
    if (action && action.type === 'flee') {
      restoreShattered(); clearBattleBuffs(); undressPlayerFoe(); mirrorRestore(); battle = null;
      log('你收了手，镜子里的两个人影各自归位。', 'fight');
      return true;
    }
     
    if (action && action.type === 'healtoggle') {
      window.JH_combat.playerAct(mine, other, action, l);
      battle.log.push.apply(battle.log, l);
      return true;
    }
     
    const tagSide = (from, who) => { if (who === s) return; for (let i = from; i < l.length; i++) l[i] = '〔镜像〕' + l[i]; };
    let mark0 = l.length;
    window.JH_combat.playerAct(mine, other, action, l);
    window.JH_combat.nearDeathCheck(mine, l);
    window.JH_combat.nearDeathCheck(other, l);
    tagSide(mark0, mine);
    if (other.hp > 0 && mine.hp > 0) {
      mark0 = l.length;
      mirrorAi(other, mine, l);
      window.JH_combat.nearDeathCheck(other, l);
      window.JH_combat.nearDeathCheck(mine, l);
      tagSide(mark0, other);
      window.JH_combat.playerStatusTick(mine, l);
      window.JH_combat.playerStatusTick(other, l);
      window.JH_combat.healTick(mine, l);
      window.JH_combat.healTick(other, l);
      window.JH_combat.curTick(mine, l);
      window.JH_combat.curTick(other, l, '镜像 ');
      window.JH_combat.domTick(mine, other, l);
      window.JH_combat.domTick(other, mine, l);
      window.JH_combat.domUpkeep(mine, l, mine === s ? null : (mine.name || '镜像'));
      window.JH_combat.domUpkeep(other, l, other === s ? null : (other.name || '镜像'));
      window.JH_combat.autoFeedDomain(mine, l);
      window.JH_combat.autoFeedDomain(other, l);
      window.JH_combat.domAttrition(mine, other, l);
    }
    window.JH_combat.tickCd(mine, 1);
    window.JH_combat.tickCd(other, 1);
    battle.log.push.apply(battle.log, l);
    if (battle.log.length > 60) battle.log.splice(0, battle.log.length - 60);
    if (other.hp <= 0 || mine.hp <= 0) { finishBattle(other.hp <= 0, false); return true; }
    battle.round++;
    return true;
  }
  





  let lanPrev = null, lanResult = null;
  function lanRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function withLanRng(seed, fn) {
    const r0 = Math.random;
    Math.random = lanRng(seed >>> 0);
    try { return fn(); } finally { Math.random = r0; }
  }
  function lanRoundSeed(seed0, n) {
    let a = ((seed0 >>> 0) ^ Math.imul(n | 0, 0x9E3779B1)) >>> 0;
    a = Math.imul(a ^ (a >>> 15), 0x85EBCA6B) >>> 0;
    return (a ^ (a >>> 13)) >>> 0;
  }
  

  

  function lanCharSeed(seed0, name, creation) {
    const txt = String(name) + '|' + JSON.stringify(creation || {});
    let h = (seed0 >>> 0) ^ 0x811C9DC5;
    for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function lanChar(name, creation, seed) {
    const keep = s, keepLan = forLan;
    s = null; forLan = true;
    withLanRng(seed, function () { create(name, creation); });
    const c = s;
    s = keep; forLan = keepLan;
    c.name = name; c.lan = true; c.mirror = false;
    

    const lst = window.JH_combat.stats(c);
    c.hp = lst.hpMax; c.cur = lst.curMax;
    return c;
  }
  


  const LAN_SILVER = 10000;
  let lanPrepSeed = 0;
   
  function lanFresh(c) {
    c.pst = {}; c.cd = {}; c.globalCd = {};
    c.overload = 0; c.castStreak = 0; c.ndUsed = 0; c.ndBoost = 0;
    c.domForm = 'closed'; c.domFeed = 0; c.buff = null;
    c.dummy = false; c.loot = []; c.hp = Math.max(1, c.hp); c.cur = Math.max(0, c.cur);
    dressAsFoe(c);
    return c;
  }
  function lanPrep(o) {
    if (!o || !o.mine || !o.mine.creation) return false;
    if (s && s.made && !s.lan) return false;       
    const keep = s;
    const seed = (o.seed || 0) >>> 0;
    const me = lanChar(o.mine.name, o.mine.creation, lanCharSeed(seed, o.mine.name, o.mine.creation));
     
    if (keep && !keep.lan) lanPrev = keep;
    s = me; lanPrepSeed = seed;
    lanFresh(me);
    


    if (!o.mine.creation.bag) me.silver += LAN_SILVER;
    return true;
  }
   
  function lanBag(act) {
    const a = act || s;
    if (!a) return null;
    return { items: Object.assign({}, a.items || {}),
             equip: Object.assign({}, a.equip || {}),
             forge: JSON.parse(JSON.stringify(a.forge || {})),
             silver: Math.max(0, Math.round(a.silver || 0)),
             activeAtk: (a.activeAtk || []).slice(), activeNei: (a.activeNei || []).slice(),
             activeQing: (a.activeQing || []).slice() };
  }
  function lanInstall(o) {
    if (!o || !o.foe) return false;
    if (!lanPrep(o)) return false;
    const seed = lanPrepSeed >>> 0;
    const foe = lanChar(o.foe.name, o.foe.creation, lanCharSeed(seed, o.foe.name, o.foe.creation));
    lanFresh(foe);
    foe.desc = '对面的咒术师。';
    foe.atks = Object.keys(foe.skills || {});
    battle = { foe: foe, log: [], round: 1, pvp: true,
               lan: { hostIsMe: !!o.hostIsMe, seed: seed, act: null, foeName: foe.name, round: 1 } };
    lanResult = null;
    return true;
  }
  function lanPrepare(act, seed) {
    if (!battle || !battle.lan) return false;
    battle.lan.act = act || null;
    battle.lan.seed = (seed || 0) >>> 0;
    return true;
  }
  function lanEnd() {
    


    if (!(s && s.lan) && !(battle && battle.lan)) return false;
    if (s) undressAsFoe(s);
    if (battle && battle.foe) undressAsFoe(battle.foe);
    battle = null; lanResult = null; lanPrepSeed = 0;
    const back = lanPrev; lanPrev = null;
    s = back || null;
    return true;
  }
  

  function lanSnapSync(o) {
    if (!battle || !battle.lan || !o || battle.lan.hostIsMe) return false;
    let changed = false;
    const put = function (c, v) {
      if (!c || !v) return;
      if (v.hp != null && Math.abs((c.hp || 0) - v.hp) > 0.5) { c.hp = v.hp; changed = true; }
      if (v.cur != null && Math.abs((c.cur || 0) - v.cur) > 0.5) { c.cur = v.cur; changed = true; }
    };
     
    put(s, o.foe); put(battle.foe, o.mine);
    return changed;
  }
  

  function lanFreeAct(act) {
    if (!battle || !battle.lan || !act) return false;
    const l = [];
    const a2 = Object.assign({}, act, { who: (battle.foe && battle.foe.name) || '对面' });
    window.JH_combat.playerAct(battle.foe, s, a2, l);
    battle.log.push.apply(battle.log, l);
    if (battle.log.length > 60) battle.log.splice(0, battle.log.length - 60);
    return true;
  }
  function lanBattleAct(action, l) {
    const lan = battle.lan, foe = battle.foe;
    

    if (action && action.type === 'healtoggle') {
      window.JH_combat.playerAct(s, foe, action, l);
      battle.log.push.apply(battle.log, l);
      if (battle.log.length > 60) battle.log.splice(0, battle.log.length - 60);
      return true;
    }
    if (action && action.type === 'flee') {
      l.push('你收了手，退出了这一局。');
      battle.log.push.apply(battle.log, l);
      finishBattle(false, true);
      return true;
    }
    const meHost = !!lan.hostIsMe;
    const host = meHost ? s : foe;
    const guest = meHost ? foe : s;
    const hAct = meHost ? (action || { type: 'attack' }) : (lan.act || { type: 'idle' });
    const gAct = meHost ? (lan.act || { type: 'idle' }) : (action || { type: 'attack' });
     
    const tag = function (from, who) { for (let i = from; i < l.length; i++) l[i] = '〔' + who.name + '〕' + l[i]; };
    withLanRng(lan.seed, function () {
      let m0 = l.length;
      window.JH_combat.playerAct(host, guest, hAct, l);
      window.JH_combat.nearDeathCheck(host, l);
      window.JH_combat.nearDeathCheck(guest, l);
      if (!meHost) tag(m0, host);
      if (host.hp > 0 && guest.hp > 0) {
        m0 = l.length;
        window.JH_combat.playerAct(guest, host, gAct, l);
        window.JH_combat.nearDeathCheck(guest, l);
        window.JH_combat.nearDeathCheck(host, l);
        if (meHost) tag(m0, guest);
        window.JH_combat.playerStatusTick(host, l);
        window.JH_combat.playerStatusTick(guest, l);
        window.JH_combat.healTick(host, l);
        window.JH_combat.healTick(guest, l);
        window.JH_combat.curTick(host, l);
        window.JH_combat.curTick(guest, l, guest.name);
        window.JH_combat.domTick(host, guest, l);
        window.JH_combat.domTick(guest, host, l);
        window.JH_combat.domUpkeep(host, l, host === s ? null : (host.name || null));
        window.JH_combat.domUpkeep(guest, l, guest === s ? null : (guest.name || null));
        window.JH_combat.autoFeedDomain(host, l);
        window.JH_combat.autoFeedDomain(guest, l);
        window.JH_combat.domAttrition(host, guest, l);
      }
      window.JH_combat.tickCd(host, 1);
      window.JH_combat.tickCd(guest, 1);
    });
    battle.log.push.apply(battle.log, l);
    if (battle.log.length > 60) battle.log.splice(0, battle.log.length - 60);
    const foeFell = foe.hp <= 0, meFell = s.hp <= 0;
    if (foeFell || meFell) { finishBattle(foeFell && !meFell, false); return true; }
    battle.round++;
    return true;
  }
  

  function lanSkipRound() {
    if (!battle || !battle.lan) return false;
    battle.round++;
    return true;
  }
  function getBattle() { return battle; }

  function snapshot() {
    if (s && s.lan) return lanPrev ? JSON.stringify(lanPrev) : 'null';
    s.lastSave = Date.now();
     
    if (mirrorSnap) { mirrorSnap.lastSave = s.lastSave; return JSON.stringify(mirrorSnap); }
    const mk = foeMasks.get(s);
    if (!mk) return JSON.stringify(s);
    for (const k of mk.keys) delete s[k];       
    const out = JSON.stringify(s);
    for (const k of mk.keys) s[k] = mk.vals[k];
    return out;
  }
  function restore(text) {
    try {
      const d = JSON.parse(text);
      if (!d || typeof d !== 'object') return false;
      if (d.v !== SAVE_VERSION) return false;
      const base = newState(d.name);
      s = Object.assign(base, d);
      s.c = Object.assign(base.c, d.c || {});
      s.attrs = Object.assign(base.attrs, d.attrs || {});
      s.ce = Object.assign(base.ce, d.ce || {});
      s.equip = Object.assign(base.equip, d.equip || {});
      s.tech = Object.assign(base.tech, d.tech || {});
      s.idle = Object.assign(base.idle, d.idle || {});
      s.defer = Object.assign(base.defer, d.defer || {});
      s.innateLv = Object.assign({}, d.innateLv || {});
      s.innateExp = Object.assign({}, d.innateExp || {});
      s.innateOff = Object.assign({}, d.innateOff || {});
      s.borrow = Object.assign({}, d.borrow || {});
      s.tamed = Object.assign({}, d.tamed || {});
      s.secret = Object.assign({}, d.secret || {});
      s.activeAtk = (d.activeAtk || []).slice();
      s.activeNei = (d.activeNei || []).slice();
      s.activeQing = (d.activeQing || []).slice();
      s.party = Object.assign({}, base.party, d.party || {});
      s.csmBank = d.csmBank || 0;
      s.forge = Object.assign({}, d.forge || {});
      s.trials = Object.assign({}, d.trials || {});
      s.ndBoost = d.ndBoost || 0;
      s.cd = Object.assign({}, d.cd || {});
      s.overload = d.overload || 0;
      s.domForm = d.domForm === 'open' ? 'open' : 'closed';
      s.domFeed = d.domFeed || 0;
      s.music = Object.assign({ on: false, track: 0, vol: 0.5 }, d.music || {});
      s.nearDeath = d.nearDeath || 0;
      s.sectJoined = (d.sectJoined || []).slice();
      s.spar = Object.assign({ day: 0, list: [], count: {} }, d.spar || {});
      s.mirror = d.mirror ? Object.assign({}, d.mirror) : null;
      s.log = d.log || [];
      syncInnateSkills();
      return true;
    } catch (e) { return false; }
  }
  function applyOffline(seconds) {
    if (!s) return null;
    const sec = Math.min(seconds, MAX_OFFLINE);
    if (sec < 10) return null;
    const before = s.exp, bs = s.silver;
    s.t += sec;
    arriveIfDue();
    if (s.act) { const nn = Math.min(3600, Math.floor(sec)); for (let i = 0; i < nn; i++) progressAct(1); }
    let kills = 0, silver = 0;
    if (s.idle.on) {
      const n = Math.floor(sec / 6);
      for (let i = 0; i < Math.min(n, 900); i++) {
        const foeId = idleFoeId(); if (!foeId) break;
        const foe = window.JH_combat.makeFoe(foeId, 1 + s.realm * 0.05);
        const hpBefore = s.hp;
        const r = window.JH_combat.autoResolve(s, foe);
        s.hp = hpBefore;
        if (r.win) { kills++; silver += foe.silver; gainExp(foe.exp, true); }
        else break;
      }
    }
     
    const res = { sec: Math.round(sec), exp: Math.round(s.exp - before), silver: Math.round(s.silver - bs), kills };
    log('你离开了 ' + (sec/60).toFixed(0) + ' 分钟。闭关所得修为 +' + res.exp + (kills ? '，祓除 ' + kills + ' 只，得咒币 ' + res.silver : '') + '。', 'offline');
    return res;
  }

   
  function rename(raw) {
    if (!s) return false;
    const name = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim().slice(0, 12);
    if (!name) { log('名字不能是空的。', 'warn'); return false; }
    if (name === s.name) return true;
    s.name = name;
    log('从此以后，你叫「' + name + '」。', 'realm');
    return true;
  }

  window.JH = window.JH || {};
  window.JH.engine = {
    REALMS, SHICHEN, get s() { return s; },
    newState, create, snapshot, restore, applyOffline, rename,
    tick, log, panel, expPerSec, techLvName, usableOf, usedOf, innateOn, setInnateOn, innateOffOf,
    sparRoster, sparLeft, sparStart, sparSettle, sparInput, sparFoeDef,
    stats: () => window.JH_combat.stats(s),
    hasItem, addItem, removeItem, bagTypes, gainExp, gainSilver, gainAff,
    atHome, staRate, staMax, travelSec, durText, regionOfScene, regionUnlocked,
    TRAVEL_SEC, TRAVEL_CROSS_SEC, TRAVEL_TEST_SEC, travelSpeedMul, arriveAt, arriveIfDue, bossGate, bossReady, sceneBoss, setOutput, dropStored,
    devEditable, devSet, hpRecoverRate,
    setAct, stopAct, progressAct, ceRecoverRate,
    condMet, sceneUnlocked, roomUnlocked,
    moveRoom, moveScene, search, doAction, talk, gift, npcsInRoom,
    learn, learnByPoint, syncInnateSkills, setTech, skillUp, breakthrough, useItem, equip, unequip, taskExpFor,
    trialDef, trialDone, trialPass, trialList, trialReset, trialAllList, startTrialBattle, trialOpen, TRIAL_LV,
    forgeOf, forgeOwned, forgePct, curseAllowed, costText, costGap, equippedCursed, MAX_CURSE_EQUIP, forgeable,
    forgeUp, curseUp, curseForgeUp, carveWord, uncarveWord, carveDraw, carveWordPool, wordCount, storeWord, takeStored,
    shopList, buy, sell, priceOf, freeShop,
    hasOpenDomain, setDomainForm, domainIdsOf, isEquipItem, ownsItem, dropItem,
    joinSect, leaveSect, sectDaily, sectBuy,
    leaveSectLoss,
    pendingMimic, takeMimic, cancelMimic, dropBorrow, tameFoe, driveFoe, dropTamed,
    slotsOf, activeOf, reqMet, reqText, partyOf, setParty,
    curEvent, choose, autoEvent, eventDef, storyList, enterStory, unsetStory,
    checkEggs, click, secret, awardTitle,
    startBattle, battleAct, getBattle, finishBattle, encounter, encounterBoss, startDummy, sandboxFight,
    lanSnapSync,
    mirrorCfg, setMirrorCfg, mirrorAuto, mirrorReset, mirrorToggleSkill, mirrorToggleInnate, startMirror, mirrorActor, statsOf: (x) => window.JH_combat.stats(x || s),
    lanInstall, lanPrep, lanBag, LAN_SILVER, lanEnd, lanPrepare, lanRoundSeed, lanFreeAct, lanActive: () => !!(s && s.lan), lanResultOf: () => lanResult,
    lanSkipRound,
    gameHour, shichenIdx, shichenName, clockText, dayCount,
    start(name) { s = newState(name); autoEvent(); return s; },
    startCreated(name, creation) { return create(name, creation); }
  };
})();
