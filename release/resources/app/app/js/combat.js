/* 打斗：伤害、状态、领域、召唤物、冷却。 */
(function () {
  'use strict';
  const M = () => window.JH_MARTIAL_MAP;
  const I = () => window.JH_ITEM_MAP;
  const O = () => window.JH_ORIGIN_MAP;
  const IN = () => window.JH_INNATE_MAP;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function mit(v) { return 1 - v / (v + 120); }
   
  function effDefOf(atk, def, pierce) {
    const d = Math.max(0, def || 0);
    const base = d * (1 - Math.min(1, Math.max(0, pierce || 0)));
    return (d > 0 && (atk || 0) > d) ? base * Math.exp(-((atk || 0) + 1) / d) : base;
  }
  function defRedOf(atk, def, pierce) { const ed = effDefOf(atk, def, pierce); return ed / (ed + 120); }
  

  const BATTLE_HP_ADD = 2000, BATTLE_CUR_ADD = 1000;
  const SOLO_HP_ADD = 700, SOLO_CUR_ADD = 500;
   
  const CUR_REGEN_K = 1.8, CUR_REGEN_PCT = 0.02;       

  function skillLv(s, id) { return (s.skillLv && s.skillLv[id]) || 1; }
   
  function hasInnate(s, id) {
    if (((s.innate) || []).indexOf(id) < 0) return false;
     
    return !(s.innateOff && s.innateOff[id]);
  }
  function innateLv(s, id) { return ((s.innateLv || {})[id]) || 1; }
  function domainOn(s, id) {
    return ((s.domain) || []).indexOf(id) >= 0;
  }
  function debugOrigin(s) { const o = O()[s.origin] || {}; return !!(o && o.debug); }
   
  function barrierLv(s) {
    if (!(s && s.skills && s.skills.k_barrier)) return 0;
    return (s.skillLv && s.skillLv.k_barrier) || 1;
  }
  

  function domNeedBarrier(s, m) { return 1; }
  

  function domGateOk(s, m) { return debugOrigin(s) || !!(s && s.mirror === true) || barrierLv(s) >= domNeedBarrier(s, m); }
   
  const DOM_FORM_NEED = 3;
  function domFormGateOk(s) { return debugOrigin(s) || !!(s && s.mirror === true) || barrierLv(s) >= DOM_FORM_NEED; }
  




  function activeIds(s, kind) {
    const key = kind === 'nei' ? 'activeNei' : 'activeQing';
    const all = (s[key] || []).filter(id => {
      const m = M()[id];
      if (!(m && m.kind === kind)) return false;
      return !(m.innate && s.innateOff && s.innateOff[m.innate]);    
    }).slice();
    if (all.length) return all;
    const legacy = (s.tech || {})[kind];
    return (legacy && M()[legacy]) ? [legacy] : [];
  }

  

  function mechOf(m) {
    if (!m) return {};
    const x = (window.JH_MECH || {})[m.id];
    return Object.assign({}, m.eff || {}, (x && x.eff) || {});
  }
  function mechNote(id) { const x = (window.JH_MECH || {})[id]; return (x && x.note) || ''; }

  



  function bfLv(s) {
    const o = O()[s.origin] || O().o_common;
    if (!(o && o.extra && o.extra.blackFlash)) return 0;
    return (s.skillLv && s.skillLv.k_black) || 0;
  }
  function blackFlashRate(s) { return 3 + 16 * bfLv(s); }
  function bfLayers(s) {
    const b = s.bf;
    if (!b || !b.t) return 0;
    let k = 0; for (const x of b.t) if (x > 0) k++;
    return k;
  }
  function addBlackFlash(s) {
    if (!s.bf || !s.bf.t) s.bf = { t: [] };
    s.bf.t.push(10);
    if (s.bf.t.length > 3) s.bf.t.shift();
  }
   
  function tickBf(s, turns) {
    if (!s.bf || !s.bf.t) return;
    const k = turns || 1;
    s.bf.t = s.bf.t.map(v => v - k).filter(v => v > 0);
  }

  


  function outFrac(s, ch) {
    const v = (s.out && s.out[ch] != null) ? s.out[ch] : 50;
    return clamp((+v) / 100, 0.2, 1);
  }
  function outMult(s, ch, m) { return 0.5 + outFrac(s, ch, m); }
  function outCostMul(s, ch, m) { return 2 * outFrac(s, ch, m); }

   
  const FG_STEP = () => (window.JH_FORGE || { stepPct: [0.005,0.005,0.005,0.01,0.01,0.01,0.01,0.02,0.02,0.02] });
   
  function forgePct(s, id) {
    const f = s && s.forge && s.forge[id];
    if (!f) return 0;
    const step = FG_STEP().stepPct;
    let p = 0;
    for (let i = 0; i < (f.lv || 0); i++) p += step[i] || 0;
    for (let i = 0; i < (f.clv || 0); i++) p += step[i] || 0;
    return p;
  }
   
  function wordsOf(s) {
    const out = { pierce:0, combo:0, rebound:0, drain:0, bind:0, slash:0, buffer:0, nullify:0, store:[] };
    const fg = (s && s.forge) || {};
    const eq = (s && s.equip) || {};
    for (const slot of ['weapon', 'armor', 'charm', 'boots']) {
      const iid = eq[slot];
      if (!iid) continue;
      const f = fg[iid];
      const slots = f && f.slots;
      if (!slots) continue;
      for (const wid of slots) {
        const w = window.JH_WORD_MAP && window.JH_WORD_MAP[wid];
        if (!w || !w.eff) continue;
        for (const k in w.eff) {
          if (k === 'store') out.store.push({ item: iid, skill: (f && f.store) || null });
          else out[k] = (out[k] || 0) + w.eff[k];
        }
      }
    }
    return out;
  }

  




  function ndMsg(who) { return { who: who || 'hero', text: '我掌握了咒术的核心', until: Date.now() + 2600 }; }
  function nearDeathCheck(s, log) {
    if (!(s.hp <= 0)) return false;       
    if (s.ndUsed) return false;                     
    if (Math.random() >= 0.05) return false;
    const st = stats(s);
    s.ndUsed = 1;
    s.hp = Math.max(1, Math.round(st.hpMax * 0.5));
    s.ndSay = ndMsg('hero');
    const cap = (s.ce && s.ce.cap) || 0.80;
    if ((s.ndBoost || 0) < 2) {
      s.ndBoost = (s.ndBoost || 0) + 1;
      s.ce.eff = Math.min(cap, (s.ce.eff || 0.30) + 0.10);
      s.ce.ctl = Math.min(cap, (s.ce.ctl || 0.30) + 0.10);
      log.push('★ 濒死：血几乎流干了，你却在那一瞬摸到了咒术的核心 —— 气血回到一半，咒效与咒操各 +10%（此生第 ' + s.ndBoost + ' 次）。');
    } else {
      log.push('★ 濒死：又从鬼门关前爬了回来 —— 气血回到一半（咒效与咒操已经不再增长了）。');
    }
    return true;
  }
   
  function foeNearDeath(foe, log) {
    if (!foe || foe.dummy || foe.hp > 0) return false;
    if (foe.ndUsed) return false;
    if (foe.endlessCur) return false;    
    if (Math.random() >= 0.05) return false;
    foe.ndUsed = 1;
    foe.hp = Math.max(1, Math.round(foe.hpMax * 0.5));
    foe.ndSay = ndMsg('foe');
    log.push('★ 濒死：' + foe.name + ' 也摸到了咒术的核心 —— 气血回到一半，重新站住。');
    return true;
  }

   
  function stats(s) {
    const a = s.attrs || { insight: 50, root: 50, luck: 20, face: 20 };
    const o = O()[s.origin] || O().o_common;
    const ini = o.init || {};    
    const bonus = { phyAtk:0, curAtk:0, def:0, hp:0, curMax:0, ceEff:0, ceCtl:0, crit:0, dodge:0, insight:0, root:0 };
    for (const slot of ['weapon', 'armor', 'charm', 'boots']) {
      const iid = s.equip && s.equip[slot];
      if (!iid) continue;
      const it = I()[iid];
      if (!it || !it.stats) continue;
      const fm = 1 + forgePct(s, iid);           
      for (const k in it.stats) bonus[k] = (bonus[k] || 0) + it.stats[k] * fm;
    }
    const bf = bfLayers(s);
    let ins = a.insight + (bonus.insight || 0);
    let root = a.root + (bonus.root || 0);
    if (bf > 0) { ins = Math.min(100, ins + 10 * bf); root = Math.min(100, root + 10 * bf); }
    const luckV = Math.min(100, (a.luck || 0) + (ini.luck || 0) + (bf > 0 ? 10 * bf : 0));
    const faceV = Math.min(o.faceCap != null ? o.faceCap : 100, (a.face || 0) + (ini.face || 0));

     
    let pCurPct = 0, pDef = 0, pHp = 0, pPhy = 0, pCurAtk = 0, pCrit = 0, pDodge = 0, pEff = 0, pCtl = 0, pHeal = 0, pEsc = 0, pBarrier = 0;
    for (const id of activeIds(s, 'nei')) {
      const m = M()[id]; if (!m || !m.nei) continue;
      const lv = skillLv(s, id), n = m.nei;
      pCurPct += (n.curMax || 0) * lv; pEff += (n.ceEff || 0) * lv; pCtl += (n.ceCtl || 0) * lv;
      pDef += (n.def || 0) * lv; pHp += (n.hp || 0) * lv;
      pCurAtk += (n.curAtk || 0) * lv; pPhy += (n.phyAtk || 0) * lv; pHeal += (n.heal || 0) * lv;
      pBarrier += (n.barrier || 0) * lv;       
    }
    for (const id of activeIds(s, 'qing')) {
      const m = M()[id]; if (!m || !m.qing) continue;
      const lv = skillLv(s, id), q = m.qing;
      pDodge += (q.dodge || 0) * lv; pEsc += (q.esc || 0) * lv; pPhy += (q.phyAtk || 0) * lv;
      pCrit += (q.crit || 0) * lv; pCtl += (q.ceCtl || 0) * lv;
    }

    const cap = (s.ce && s.ce.cap) || 0.80;
     
    const domBreakPen = (s.pst && s.pst.domBreak > 0) ? 0.20 : 0;
    const ceEff = bf > 0 ? 0.999 : clamp(((s.ce && s.ce.eff) || 0.30) + pEff + (bonus.ceEff || 0) - domBreakPen, 0.20, cap);
    const ceCtl = clamp(((s.ce && s.ce.ctl) || 0.30) + pCtl + (bonus.ceCtl || 0), 0.20, cap);

    let hpMax = 80 + root * 14 + s.realm * 70 + pHp + (bonus.hp || 0);
    let curMax = (40 + ins * 9 + s.realm * 45 + (bonus.curMax || 0) + (s.curBonus || 0)) * (1 + pCurPct);
    let phyAtk = 6 + root * 2.0 + pPhy + (bonus.phyAtk || 0);
    

    let curAtkBase = 8 + 7.238 * Math.log(1 + Math.max(0, curMax)) + 0.04 * Math.max(0, curMax)
      + ins * 0.7 + pCurAtk + (bonus.curAtk || 0);
    

    let def = 2 + root * 1.5 + pDef + (bonus.def || 0);
    if (s.st && s.st.defDown) def *= (1 - Math.min(0.9, s.st.defDown));    
    let crit = 3 + ins * 0.25 + luckV * 0.12 + faceV * 0.06 + pCrit + (bonus.crit || 0);
    let dodge = root * 0.15 + pDodge + (bonus.dodge || 0);
    if (hasInnate(s, 't_ratio')) crit += 10;
    if (hasInnate(s, 't_const')) def *= 1.08;
    if (o.extra) { if (o.extra.dodge) dodge += o.extra.dodge; if (o.extra.crit) crit += o.extra.crit; }    

     
    if (o.swap === 'body2cur') {
      const convHp = root * 14 * 0.5, convPhy = root * 2.0 * 0.5;
      hpMax -= convHp; phyAtk -= convPhy;
      curMax += convHp * 1.10; curAtkBase += convPhy * 0.90;
    } else if (o.swap === 'cur2body') {
      const convCur = curMax * 0.5, convAtk = curAtkBase * 0.5;
      curMax -= convCur; curAtkBase -= convAtk;
      hpMax += convCur * 0.55; phyAtk += convAtk * 0.60; def += convCur * 0.02;
    }
    if (o.curMaxCap != null) curMax = Math.min(curMax, o.curMaxCap);
    curMax = Math.max(0, curMax);
     
    hpMax += ini.hp || 0;
    curMax += ini.curMax || 0;
    phyAtk += ini.phyAtk || 0;
    def += ini.def || 0;
    if (o.curMaxCap != null) curMax = Math.min(curMax, o.curMaxCap);
    curMax = Math.max(0, curMax);
    hpMax = Math.max(1, hpMax);
     
    if (s.buff && s.buff.turns > 0) {
      if (s.buff.curAtk) curAtkBase *= (1 + s.buff.curAtk);
      if (s.buff.def) def *= (1 + s.buff.def);
    }
    let curAtk = Math.max(1, curAtkBase * (0.5 + ceCtl) + (ini.curAtk || 0));
    


    if (o.swap === 'cur2body') curAtk = Math.max(1, 0.3 * curAtk + 0.7 * phyAtk);

    

    if (!s.noBoost && s.attrs) {
      hpMax += s.lan ? BATTLE_HP_ADD : SOLO_HP_ADD;
      

      if (o.swap !== 'cur2body') curMax += s.lan ? BATTLE_CUR_ADD : SOLO_CUR_ADD;
    }

     
    if (s.statOver) {
      const ov = s.statOver;
      if (ov.hpMax != null && isFinite(ov.hpMax)) hpMax = ov.hpMax;
      if (ov.curMax != null && isFinite(ov.curMax)) curMax = ov.curMax;
      if (ov.phyAtk != null && isFinite(ov.phyAtk)) phyAtk = ov.phyAtk;
      if (ov.curAtk != null && isFinite(ov.curAtk)) curAtk = ov.curAtk;
      if (ov.def != null && isFinite(ov.def)) def = ov.def;
      if (ov.crit != null && isFinite(ov.crit)) crit = ov.crit;
      if (ov.dodge != null && isFinite(ov.dodge)) dodge = ov.dodge;
    }

    return {
      hpMax: Math.round(hpMax), curMax: Math.round(curMax), mpMax: Math.round(curMax),
      phyAtk: Math.round(phyAtk), curAtk: Math.round(curAtk), curAtkBase: Math.round(curAtkBase),
      def: Math.round(def), crit: Math.round(crit * 10) / 10, dodge: Math.round(dodge * 10) / 10,
      ceEff, ceCtl, ceCap: cap, expRate: 1 + ins / 70, heal: pHeal + ((o.extra && o.extra.healPct) || 0),
      escRate: clamp(0.15 + pEsc, 0.05, 0.9),
      barrier: clamp(pBarrier, 0, 0.9),
      out: { phy: outFrac(s, 'phy'), cur: outFrac(s, 'cur') },
      flaw: Math.max(0, (outFrac(s, 'phy') * 100 - 50) / 250),
      words: wordsOf(s),
      bf: bf, bfRate: blackFlashRate(s),
      insight: ins, root, luck: luckV, face: faceV
    };
  }

   
  const GEAR = [
    { w:'cg_knife', a:'ar_uniform',  n:null,        q:null },
    { w:'cg_blade', a:'ar_uniform',  n:'k_flow',    q:'k_step' },
    { w:'cg_blade', a:'ar_uniform2', n:'k_flow',    q:'k_step' },
    { w:'cg_staff', a:'ar_uniform2', n:'k_flow',    q:'k_step' },
    { w:'cg_chain', a:'ar_uniform3', n:'k_armor',   q:'k_sense' },
    { w:'cg_yuun',  a:'ar_uniform3', n:'k_armor',   q:'k_sense' },
    { w:'cg_yuun',  a:'ar_kasaya',   n:'k_armor',   q:'k_sense' },
    { w:'cg_tenk',  a:'ar_kasaya',   n:'k_reverse', q:'k_sense' },
    { w:'cg_tenk',  a:'ar_jacket',   n:'k_reverse', q:'k_sense' },
    { w:'cg_tenk',  a:'ar_jacket',   n:'k_reverse', q:'k_sense' }
  ];
  function baselinePlayer(lvl) {
    lvl = Math.max(0, Math.min(9, lvl | 0));
    const g = GEAR[lvl];
    const eff = clamp(0.30 + 0.035 * lvl, 0.20, 0.80);
    return {
      realm: lvl, origin: 'o_common',
      attrs: { insight: Math.min(100, 45 + 4 * lvl), root: Math.min(100, 45 + 4 * lvl), luck: 20, face: 20 },
      ce: { eff: eff, ctl: eff, cap: 0.80 },
      tech: { atk: null, nei: g.n, qing: g.q },
      skillLv: {}, innate: [], innateLv: {}, domain: [],
      equip: { weapon: g.w, armor: g.a, charm: null },
      items: {}, hp: 1e9, cur: 1e9, hpMaxShim: 0, noBoost: true,    
      c: { win:0, lose:0, winStreak:0, crit:0 }, stats: { kills:0 }
    };
  }
  function baseline(lvl) { return stats(baselinePlayer(lvl)); }

   
  

  function foeSkillsOf(t, lvl) {
    const declared = Array.isArray(t.skills) ? t.skills.slice() : [];
    if (t.dummy) return declared;
    const M = window.JH_MARTIAL_MAP || {};
    if (declared.some(id => M[id] && M[id].kind === 'atk')) return declared;    
    const pool = (window.JH_COMMON || []).filter(m => m.kind === 'atk' && m.id !== 'k_vow');
    if (!pool.length) return declared;
    let h = 0;
    const key = String(t.id || '');
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const want = lvl >= 6 ? 2 : 1;
    const out = declared.slice(), seen = {};
    for (const id of out) seen[id] = 1;
    for (let i = 0; i < pool.length && out.length < declared.length + want; i++) {
      const pick = pool[(h + i * 7) % pool.length];
      if (pick && !seen[pick.id]) { seen[pick.id] = 1; out.push(pick.id); }
    }
    return out;
  }
  

  const FOE_ADD_TIER = [
    { max: 2, hp: 2000, cur: 500 },      
    { max: 4, hp: 3000, cur: 1000 },     
    { max: 9, hp: 3500, cur: 2500 }      
  ];
  function foeAddOf(lvl) {
    const l = Math.max(0, lvl || 0);
    for (const t of FOE_ADD_TIER) if (l <= t.max) return t;
    return FOE_ADD_TIER[FOE_ADD_TIER.length - 1];
  }
  function makeFoe(foeId, mul, nameSuffix) {
    const t = window.JH_FOE_MAP[foeId];
    if (!t) return null;
    const lvl = t.lvl != null ? t.lvl : 0;
    const pb = baseline(lvl);
    const rounds = t.rounds || 8;
    const margin = t.margin != null ? t.margin : 1.5;
    const defF = t.defF != null ? t.defF : 0.6;
    const phyRes = t.phyRes || 0, curRes = t.curRes || 0;

    const tier = foeAddOf(lvl);
    const critF = 1 + (Math.min(90, pb.crit) / 100) * 0.8;
    const dodgeF = 1 - Math.min(0.6, pb.dodge / 100);
    const foeDef = Math.max(1, pb.def * defF);
    const phyDps = pb.phyAtk * 1.15 * mit(foeDef) * (1 - phyRes);    
    const curDps = pb.curAtk * 1.30 * mit(foeDef) * (1 - curRes);
    const dps = Math.max(phyDps, curDps) * critF;
    const foeHp = t.dummy ? 999999999 : Math.max(1, Math.round(dps * rounds * (mul || 1)) + tier.hp);    
    const foeDps = pb.hpMax / (rounds * margin);
    const foeAtk = t.dummy ? 0 : Math.max(1, Math.round(foeDps / (mit(pb.def) * dodgeF)));

    const risk = clamp(1.8 / margin, 0.6, 2.6);
     
    const pbCurMax = Math.max(1, Math.round(pb.curMax || 0));
     
    const foeCurMax = t.endlessCur ? Infinity : (pbCurMax + tier.cur);
    const foeCurAtkBase = isFinite(foeCurMax)
      ? 8 + 7.238 * Math.log(1 + foeCurMax) + 0.04 * foeCurMax + (pb.insight || 0) * 0.7
      : 0;
    const needs = window.JH_REALM_NEEDS || [400,1100,3500,10000,28000,80000,230000,650000,1500000,2800000];
    const exp = t.exp != null ? t.exp : Math.round(needs[Math.min(9, lvl)] / 350 * risk);
    const silver = t.silver != null ? t.silver : Math.round(10 * Math.pow(1.42, lvl) * risk);

    return {
      id: t.id, uid: 'foe_' + Math.random().toString(36).slice(2, 8),
      name: t.name + (nameSuffix || ''), desc: t.desc || '', lvl,
      hp: foeHp, hpMax: foeHp, atk: foeAtk, def: Math.round(foeDef),
      ceEff: pb.ceEff, ceCtl: pb.ceCtl, endlessDom: !!t.endlessDom,
      endlessCur: !!t.endlessCur, domForms: Array.isArray(t.domForms) ? t.domForms.slice() : null,
      gentleWord: t.gentleWord || '', gentleSay: t.gentleSay || '',
      phyRes, curRes, dmgType: t.dmgType || 'mixed', human: !!t.human, boss: !!t.boss,
      dummy: !!t.dummy, skills: foeSkillsOf(t, lvl),
      curMax: foeCurMax, cur: foeCurMax, curAtkBase: foeCurAtkBase,
      exp, silver, loot: t.loot || [],
      st: { stun:0, weak:0, dot:0, slash:0, mark:0, pull:0, defDown:0, adapt:0 }, turn: 0,
      domId: t.dom || '', dom: null, domBreak: 0, ndUsed: 0
    };
  }

   
  function forecast(s, foe) {
    const st = stats(s);
    const critF = 1 + (Math.min(90, st.crit) / 100) * 0.8;
     
    const pDmg = Math.max(
      st.phyAtk * 1.15 * (1 - defRedOf(st.phyAtk, foe.def, 0)) * (1 - foe.phyRes),
      st.curAtk * 1.30 * (1 - defRedOf(st.curAtk, foe.def, 0)) * (1 - foe.curRes)) * critF;
    const toKill = foe.hp / Math.max(1, pDmg);
    let eDmg = foe.atk * (1 - defRedOf(foe.atk, st.def, 0)) * (1 - Math.min(0.6, st.dodge / 100));
    if (hasInnate(s, 't_mukagen')) {
      if (foe.dmgType === 'phy') { if (s.cur > blockCost(s, foe.atk)) eDmg = 1; }
      else if (foe.dmgType === 'cur') eDmg *= mukagenFactor(s);
      else if (foe.dmgType === 'mixed') eDmg *= 0.5 + 0.5 * mukagenFactor(s);    
    }
    const toDie = s.hp / Math.max(1, eDmg);
    return { toKill, toDie, safe: toKill * 1.10 < toDie };
  }

  function mukagenFactor(s) {
    const lv = innateLv(s, 't_mukagen');
    const six = s.origin === 'o_sixeyes';
    return Math.max(six ? 0.15 : 0.30, (six ? 0.70 : 0.80) - 0.05 * (lv - 1));
  }
  


  function blockCost(s, dmg) {
    const st = stats(s);
    const lv = innateLv(s, 't_mukagen');
    let base = Math.max((IN().t_mukagen.blockCost || 22) * (1 - 0.04 * (lv - 1)), (dmg || 0) * 2);
    if (s.origin === 'o_sixeyes') base *= 0.5;
    return Math.max(1, Math.ceil(base * (1 - st.ceEff)));
  }

   
  function dealDamage(s, foe, opts, log) {
    

    const st = stats(s);
    if (!foe.st) foe.st = {};                  
    const words = opts.wordsTail ? {} : (st.words || {});    
    const who = opts.who || '你';
    const lvl = opts.lv || 1;
    const mult = opts.mult * (1 + 0.08 * (lvl - 1));
    



    const phyMix = opts.type === 'phy' && !opts.plain;
    const atkStat = opts.plain ? st.phyAtk : (phyMix ? 0.5 * st.phyAtk + 0.5 * st.curAtk : st.curAtk);
    let base = atkStat * mult;
    if (s.st && s.st.weak > 0) base *= 0.6;    
    if (opts.plain) base *= (1 - (foe.phyRes || 0) * (opts.slash ? 0.5 : 1));
    else if (phyMix) base *= (1 - (0.5 * (foe.phyRes || 0) * (opts.slash ? 0.5 : 1) + 0.5 * (foe.curRes || 0)));
    else base *= (1 - (foe.curRes || 0));
     
    let pierce = opts.pierce || 0;
    if (opts.type === 'phy' && words.pierce) pierce = Math.min(1, pierce + words.pierce);
     
    if (opts.type === 'phy' && words.nullify && !opts.wordsTail) {
      const foeCur = Math.round((foe.hpMax || 0) * 0.4 + (foe.atk || 0) * 10);
      if (s.cur < foeCur) {
        const frac = 0.5 * Math.abs(foeCur - s.cur) / Math.max(1, foeCur);
        pierce = Math.min(1, Math.max(pierce, frac));
        log.push('词条「咒力无效化」：他咒力压着你，但那点差值正好跳过了他 ' + Math.round(frac * 100) + '% 的防御。');
      } else {
        pierce = 1;
        log.push('词条「咒力无效化」：你的咒力压过了他 —— 这一击穿了个透。');
      }
    }
     
    const fdef = foe.def != null ? foe.def : stats(foe).def;
    let red = 0;
    if (!opts.trueDamage) {
      red = defRedOf(atkStat, fdef, pierce);
    } else {
      red = 0.5;
    }
    let dmg = base * (1 - red) * rnd(0.9, 1.12);
    if (foe.st && foe.st.slash) dmg *= (1 + 0.04 * foe.st.slash);
     
    const domOver = domOverMul(s, foe);
    dmg *= domOver;
     
    const bfUp = bfLayers(s) > 0;
    const bfHit = Math.random() * 100 < blackFlashRate(s);
    if (bfHit || bfUp) dmg *= (opts.type === 'phy' ? 2.1 : 2.0);
    if (bfHit) { addBlackFlash(s); s.c.bf = (s.c.bf || 0) + 1; }
    const isCrit = Math.random() * 100 < st.crit;
    if (isCrit) dmg *= hasInnate(s, 't_ratio') ? 2.1 : 1.8;
    if (isCrit && hasInnate(s, 't_ratio')) s.c.crit = (s.c.crit || 0) + 1;
     
    const marks = (foe.st && foe.st.mark) || 0;
    if (marks) dmg *= (1 + 0.12 * marks);
     
    if (opts.exec && foe.hp > 0 && foe.hp <= foe.hpMax * 0.35) dmg *= (1 + opts.exec);
     
    if (opts.dmgOnly && opts.dmgOnly !== 1) dmg *= opts.dmgOnly;
    dmg = Math.max(1, Math.round(dmg));
    foe.hp -= dmg;
     
    if (domEntOf(foe)) damageDomainOn(foe, base * domOver, log);
    if (foe.dummy) foe.hp = foe.hpMax;    
    if (bfHit) log.push('★ 黑闪！咒力与打击在那一瞬错开了。');
    log.push(who + '出手，' + foe.name + ' 受创 ' + dmg + (isCrit ? '（暴击）' : '') + '。');
    if (opts.lifesteal) { const h = Math.round(dmg * opts.lifesteal); s.hp = Math.min(st.hpMax, s.hp + h); log.push(who + '把血收了回来 +' + h + '。'); }
    if (opts.drain) { const m = Math.round(dmg * opts.drain); s.cur = Math.min(st.curMax, s.cur + m); log.push(who + '抽回咒力 ' + m + '。'); }
    if (opts.defDown) { foe.def = Math.max(1, Math.round((foe.def != null ? foe.def : stats(foe).def) * (1 - opts.defDown))); foe.st.defDown = Math.min(0.9, (foe.st.defDown || 0) + opts.defDown); log.push(foe.name + ' 的形状被削去一层，防御下降。'); }
    if (opts.stun) { foe.st.stun = Math.max(foe.st.stun, opts.stun); log.push(foe.name + ' 被钉在原地。'); }
    if (opts.weak) { foe.st.weak = Math.max(foe.st.weak, opts.weak); log.push(foe.name + ' 的咒力被压住。'); }
    if (opts.dot) { foe.st.dot = 3; foe.st.dotRate = opts.dot; log.push(foe.name + ' 身上开始渗毒。'); }
    if (opts.recoil) { const r = Math.round(st.hpMax * opts.recoil); s.hp -= r; log.push('咒言反噬，你自损气血 ' + r + '。'); }
    if (opts.adapt) { foe.st.adapt = (foe.st.adapt || 0) + 1; log.push('那一击被它记住了。'); }
    if (opts.slash) foe.st.slash = Math.min(5, (foe.st.slash || 0) + 1);
    if (opts.mark) { foe.st.mark = Math.min(3, (foe.st.mark || 0) + opts.mark); log.push(foe.name + ' 身上被点出一处分点（×' + foe.st.mark + '）。'); }
    if (opts.pull) { foe.st.pull = Math.min(0.6, Math.round(((foe.st.pull || 0) + opts.pull) * 100) / 100); log.push('引力把 ' + foe.name + ' 拽向你，它的身手慢了半拍。'); }
    if (opts.selfHeal) { const h = Math.round(dmg * opts.selfHeal); s.hp = Math.min(st.hpMax, s.hp + h); log.push(who + '带回来一部分伤，气血 +' + h + '。'); }
    if (opts.guard) { s.pst = s.pst || {}; s.pst.guard = Math.max(s.pst.guard || 0, opts.guard); log.push('你身前立起一层构筑物，替你卸掉一部分来袭。'); }
    if (opts.nullify) { s.pst = s.pst || {}; s.pst.nullify = Math.min(3, (s.pst.nullify || 0) + opts.nullify); log.push('「无限」在你身前摊开，可以再挡下 ' + s.pst.nullify + ' 击。'); }
    if (opts.swap) { const back = Math.max(1, Math.round((foe.atk != null ? foe.atk : stats(foe).phyAtk) * opts.swap)); foe.hp -= back; if (foe.dummy) foe.hp = foe.hpMax; log.push('你与它换了位置，它那一手落在了自己身上，受创 ' + back + '。'); }
     
     
    if (opts.type === 'phy' && words.slash) foe.st.slash = Math.min(5, (foe.st.slash || 0) + words.slash);
     
    if (words.drain && Math.random() < 0.20) {
      const m = Math.round(st.curMax * 0.20);
      s.cur = Math.min(st.curMax, s.cur + m);
      log.push('词条「吸咒」把散出去的咒力收了回来 +' + m + '。');
    }
     
    if (words.combo && opts.type === 'phy' && !opts.wordsTail && foe.hp > 0 && Math.random() < words.combo) {
      log.push('词条「连击」自己追上了一段。');
      dealDamage(s, foe, Object.assign({}, opts, { wordsTail: true, pierce: 0, slash: 0 }), log);
    }
    return dmg;
  }

  function skillCost(s, m) {
    const st = stats(s);
    const lv = skillLv(s, m.id);
    const base = (m.cost || 0) * (1 - 0.05 * (lv - 1));
    const mul = ((m.atkType === 'phy') ? 1 : outCostMul(s, 'cur', m));
    return Math.max(0, Math.ceil(base * (1 - st.ceEff) * mul));
  }

  



  function cdReduceOf(s) {
    const st = stats(s);
     
    const eff = Math.floor(Math.round(st.ceEff * 100) / 10);
    const ctl = Math.floor(Math.round(st.ceCtl * 100) / 10);
    return Math.min(eff, ctl);
  }
   
  function cdBaseOf(m) {
    if (!m) return 1;
    if (m.domain) return 16;    
    const st = (m.mult || 1) * (m.hits || 1);
    if (st >= 7.0) return 12;
    if (st >= 5.6) return 10;
    if (st >= 4.5) return 8;
    if (st >= 3.6) return 6;
    if (st >= 2.8) return 5;
    if (st >= 2.0) return 4;
    if (st >= 1.5) return 3;
    return 2;
  }
  function cooldownOf(s, m) { return m ? Math.max(1, cdBaseOf(m) - cdReduceOf(s)) : 1; }
  function cdLeft(s, id) { return Math.max(0, (s.cd && s.cd[id]) || 0); }
   
  function startCdRaw(s, key, base) {
    const n = Math.max(1, base - cdReduceOf(s));
    if (n > 1) { s.cd = s.cd || {}; s.cd[key] = n; }
  }
  function startCd(s, id, m) { startCdRaw(s, id, cdBaseOf(m)); }
  



  const SUMMON_CD = 10;
  function startSummonCd(s, id) {
    if (!id) return 0;
    s.cd = s.cd || {};
    s.cd[id] = SUMMON_CD;
    return SUMMON_CD;
  }
   
  function tickCd(s, turns) {
    const k = turns || 1;
    if (s.cd) for (const id of Object.keys(s.cd)) { s.cd[id] -= k; if (s.cd[id] <= 0) delete s.cd[id]; }
    if (s.overload > 0) { s.overload -= k; if (s.overload <= 0) s.overload = 0; }
    if (s.pst && s.pst.domBreak > 0) { s.pst.domBreak -= k; if (s.pst.domBreak <= 0) s.pst.domBreak = 0; }
  }

  


  function overloadRate(s, streak) {
    if (streak < 4) return 0;
    const ctl = Math.round(stats(s).ceCtl * 100);
    let p = (streak - 3) * 5 + 5;
    p -= Math.floor(ctl / 20) * 3;
    if (ctl > 99) p -= 20;
    return clamp(p, 0, 100);
  }
   
  function isTechAct(act) { return !!act && (act.type === 'skill' || act.type === 'borrow' || act.type === 'drive' || act.type === 'stored'); }
  function overloadRoll(s, log) {
    s.castStreak = (s.castStreak || 0) + 1;
    const p = overloadRate(s, s.castStreak);
    if (p > 0 && Math.random() * 100 < p) {
      s.overload = 10;
      s.castStreak = 0;
      log.push('★ 术式熔断！术式一路连着使，回路一下烧断了 —— 接下来 10 回合，任何术式都使不出来。');
      return true;
    }
    return false;
  }

  






  const DOM_BREAK_TURNS = 6;
  

  function domIsOpen(m) { return !!m; }
  








  function domPowCore(base, barrier, dom) {
    const frac = (dom && isFinite(dom.hpMax) && dom.hpMax > 0) ? clamp(dom.hp / dom.hpMax, 0, 1) : 1;
    return (base || 0) * (1 + (barrier || 0) * 1.25) * (1 + frac * 0.5);
  }
  function fmtPow(v) { return (Math.round((v || 0) * 10) / 10).toFixed(1); }
  

  function foeDomBase(foe) { return (1 + Math.max(0, (foe && foe.lvl) || 0) * 1.2) / 1.5; }
  function domProfOf(who, m) {
    if (!who || !who.attrs) return foeDomBase(who);           
    if (!m) return 0;
    return m.innate ? innateLv(who, m.innate) : skillLv(who, m.id);
  }
   
  function domBarrierOf(who) { return (who && who.attrs) ? stats(who).barrier : 0; }
  

  function domPowerOf(who, m, dom) {
    if (!who) return 0;
    if (who.attrs && !m) return 0;                             
    return domPowCore(domProfOf(who, m), domBarrierOf(who), dom);
  }
   
  function domPowFoe(foe, dom) { return domPowerOf(foe, null, dom); }
  function domPowMine(s, dom) { return dom ? domPowerOf(s, M()[dom.id], dom) : 0; }
   
  function domRefreshPow(s, foe) {
    const a = domEntOf(s), b = domEntOf(foe);
    if (a) a.pow = Math.round(domPowOf(s, a) * 100) / 100;
    if (b) b.pow = Math.round(domPowOf(foe, b) * 100) / 100;
  }
  



  const DOM_OPEN_OVER = 1.25;
  function domKindOf(who) {
    if (!who) return '';
    const d = (who.pst && who.pst.dom) || who.dom || null;
    return (d && d.kind) || '';
  }
  function domOverMul(attacker, defender) {
    return (domKindOf(attacker) === 'open' && domKindOf(defender) === 'closed') ? DOM_OPEN_OVER : 1;
  }
  


  function domEntOf(who) {
    if (!who) return null;
    if (who.dom) return who.dom;
    if (who.pst && who.pst.dom) return who.pst.dom;
    return null;
  }
   
  function domPowOf(who, dom) {
    if (!who || !dom) return 0;
    if (who.attrs) { const m = M()[dom.id]; if (m) return domPowMine(who, dom); }
    return domPowFoe(who, dom);
  }
   
  function domHpMaxOf(s, m) {
    const st = stats(s);
     
    const grow = 60 * Math.log(1 + Math.max(0, st.curMax)) + 6 * Math.max(0, st.curAtkBase || 0);
    const body = st.hpMax * 2 * (0.65 * st.ceCtl + 0.35 * st.ceEff);
    return Math.max(1, Math.round(Math.min(grow, body)));
  }
  function foeDomHpMax(foe) {
    if (!foe) return 80;
    if (foe.endlessDom) return Infinity;       
    const ctl = foe.ceCtl != null ? foe.ceCtl : clamp(0.30 + 0.035 * (foe.lvl || 0), 0.20, 0.80);
    const eff = foe.ceEff != null ? foe.ceEff : ctl;
    

    const pool = (foe.curMax != null && isFinite(foe.curMax)) ? foe.curMax : Math.max(1, Math.round((foe.hpMax || 0) * 0.6));
    const cb = (foe.curAtkBase != null && isFinite(foe.curAtkBase) && foe.curAtkBase > 0)
      ? foe.curAtkBase
      : 8 + 7.238 * Math.log(1 + pool) + 0.04 * pool + 31.5;
    const grow = 60 * Math.log(1 + Math.max(0, pool)) + 6 * Math.max(0, cb);
    const body = (foe.hpMax || 0) * 2 * (0.65 * ctl + 0.35 * eff);
    return Math.max(1, Math.round(Math.min(grow, body)));
  }
  

  function foeDomFormOpen(foe, dm) {
    const forms = (foe && foe.domForms) || null;
    if (forms) {
      const hasOpen = forms.indexOf('open') >= 0, hasClosed = forms.indexOf('closed') >= 0;
      if (hasOpen && !hasClosed) return true;
      if (hasOpen && hasClosed) return Math.random() < 0.5;
    }
    

    return !!(dm && dm.domKind === 'openBarrier');
  }
  


  function hasOpenDom(s) {
    if (!s) return false;
    const eng = window.JH && window.JH.engine;
    let usable = null;
    try { if (eng && eng.usableOf) usable = eng.usableOf(s, 'atk'); } catch (e) { usable = null; }
    const chk = id => {
      const m = M()[id];
      if (!(m && m.domain && domIsOpen(m))) return false;
      if (!usable) return true;
      return usable.indexOf(id) >= 0;
    };
    for (const tid of (s.domain || [])) { const t2 = IN()[tid]; if (t2 && t2.domain && chk(t2.domain)) return true; }
    for (const id of Object.keys(s.skills || {})) if (chk(id)) return true;
    return false;
  }
  function openDomain(s, m, log) {
    const p = pst(s);
    const openable = domIsOpen(m);                   
    

    const wantOpen = openable && s.domForm === 'open' && domFormGateOk(s);
    const kind = wantOpen ? 'open' : 'closed';
    const cannotOpen = openable && s.domForm === 'open' && !wantOpen;
    const hpMax = domHpMaxOf(s, m);
    const ent = { id: m.id, name: m.name, kind: kind, openable: openable, domKind: m.domKind || '',
      pow: Math.round(domPowerOf(s, m) * 100) / 100, turns: 0, hp: hpMax, hpMax: hpMax };
    p.dom = ent;
    if (log) log.push('领域展开：' + m.name + '（' + (kind === 'open' ? '开放式 · 不设结界，关不住人也关不住自己' : '封闭式 · 合上了，谁都走不出去')
      + '；领域血 ' + hpMax + (cannotOpen ? '。结界术还不到 ' + DOM_FORM_NEED + ' 级，这一次先按封闭式落地' : '') + '）。');
    return ent;
  }
  

  function retractDomain(s, m, log) {
    const p = pst(s);
    if (!p.dom) return false;
    const nm = p.dom.name;
    p.dom = null; p.overlap = false;
    const dkey = summonKeyOf(m);                  
    if (dkey) { const dsh = shieldOf(s, dkey); if (dsh) reclaimShield(s, dsh, log); }
    startCd(s, m.id, m);
    if (log) log.push('你把「' + nm + '」收了起来 —— 领域散尽，这门术式就此进入冷却（' + cdLeft(s, m.id) + ' 回合）。');
    return true;
  }

   
  function breakFoeDomain(foe, log, why) {
    const d = domEntOf(foe);
    const nm = (d && d.name) || '领域';
    if (foe.dom) foe.dom = null;
    if (foe.pst && foe.pst.dom) { foe.pst.dom = null; foe.pst.overlap = false; }    
    foe.domBreak = DOM_BREAK_TURNS;
    if (foe.pst) foe.pst.domBreak = DOM_BREAK_TURNS;
    if (log) log.push(why === 'dried'
      ? foe.name + ' 咒力见底，领域「' + nm + '」自己散开了。'
      : foe.name + ' 的领域「' + nm + '」被压碎了。');
  }
  function domBreakSelf(s, log, why) {
    const p = pst(s);
    const dom = domEntOf(s);
    const nm = (dom && dom.name) || '领域';
    const dm = dom && M()[dom.id];
    

    if (dm) startCd(s, dm.id, dm);
    const cdTxt = dm ? ('这门术式也进入冷却（' + cdLeft(s, dm.id) + ' 回合）') : '';
    if (s.dom) s.dom = null;
    p.dom = null; p.overlap = false; p.domBreak = DOM_BREAK_TURNS;
    const own = (s && s.mirror === true) ? '镜像 的' : '你的';
    if (log) log.push(why === 'dried'
      ? '★ 咒力见底，供不起了 —— ' + own + '领域「' + nm + '」自行散开；' + cdTxt + '，' + DOM_BREAK_TURNS + ' 回合内咒效大减，也再展不开领域。'
      : '★ ' + own + '领域被压碎了 —— ' + cdTxt + '，' + DOM_BREAK_TURNS + ' 回合内咒效大减，也再展不开领域。');
  }
   
  function domainClash(s, foe, log) {
    const p = pst(s);
    const mine = domEntOf(s), their = domEntOf(foe);
    if (!mine || !their) return null;
    domRefreshPow(s, foe);           
    if (mine.kind === 'open' || their.kind === 'open') {
      p.overlap = true;
      if (foe && foe.pst) foe.pst.overlap = true;     
      if (log) log.push('两座领域叠在了一起 —— 不设结界的那种，管不住别人关起来的那种。');
      return 'overlap';
    }
    const a = mine.pow, b = their.pow, hi = Math.max(a, b), lo = Math.min(a, b);
    if (hi > 0 && (hi - lo) / hi < 0.10) {
      const cost = Math.round(stats(s).curMax * 0.1);
      s.cur = Math.max(0, s.cur - cost);
      if (log) log.push('两座领域撞上了，一时分不出高下（强度 ' + fmtPow(a) + ' / ' + fmtPow(b) + '）—— 各耗一分咒力（-' + cost + '），僵持着。');
      return 'draw';
    }
    if (a >= b) { breakFoeDomain(foe, log); if (log) log.push('你凭着更熟的术式（强度 ' + fmtPow(a) + ' 压过 ' + fmtPow(b) + '），把它的领域压碎了。'); return 'win'; }
    if (log) log.push('它的领域更厚（强度 ' + fmtPow(b) + ' 压过 ' + fmtPow(a) + '）——');
    domBreakSelf(s, log);
    return 'lose';
  }
  

  function damageDomain(side, s, foe, amount, log) {
    const amt = Math.max(0, Math.round(amount || 0));
    if (!amt) return 0;
    if (side === 'foe') {
      const dom = domEntOf(foe);
      if (!dom) return 0;
      if (dom.endless) { if (log) log.push((foe.name || '它') + ' 的领域「' + dom.name + '」吃了 ' + amt + ' —— 那是一片海，砍不出尽头。'); return amt; }
      const f0 = domPowOf(foe, dom);
      dom.hp = Math.max(0, dom.hp - amt);
      const f1 = domPowOf(foe, dom);
      if (log) log.push(foe.name + ' 的领域「' + dom.name + '」结结实实吃了 ' + amt + '（剩 ' + Math.round(dom.hp)
        + '；强度 ' + fmtPow(f0) + ' → ' + fmtPow(f1) + '）。');
      domRefreshPow(s, foe);
      if (dom.hp <= 0) breakFoeDomain(foe, log);
      return amt;
    }
    const dom = domEntOf(s);
    if (!dom) return 0;
    const m0 = domPowOf(s, dom);
    dom.hp = Math.max(0, dom.hp - amt);
    const m1 = domPowOf(s, dom);
    const own = (s && s.mirror === true) ? '镜像 的' : '你的';    
    if (log) log.push(own + '领域「' + dom.name + '」硬接了这一下 ' + amt + '（剩 ' + Math.round(dom.hp)
      + '；强度 ' + fmtPow(m0) + ' → ' + fmtPow(m1) + '）。');
    domRefreshPow(s, foe);
    if (dom.hp <= 0) domBreakSelf(s, log);
    return amt;
  }
  

   
  function damageDomainOn(target, amount, log) {
    if (!target || !domEntOf(target)) return 0;
    if (target.attrs) return damageDomain('me', target, null, amount, log);
    return damageDomain('foe', null, target, amount, log);
  }
  const DOM_BITE = 14;
  function domAttrition(s, foe, log) {
    const a = domEntOf(s), b = domEntOf(foe);
    if (!a || !b) return null;
    domRefreshPow(s, foe);
    if (b.endless) {
      const toMe = Math.max(1, Math.round(b.pow * DOM_BITE));
      a.hp = Math.max(0, a.hp - toMe);
      if (log) log.push('两座领域互相啃啮：它的领域是一片汪洋，啃不出底；你的 −' + toMe + '（剩 ' + Math.round(a.hp) + '）。');
      const dead = { foe: false, me: a.hp <= 0 };
      if (dead.me) domBreakSelf(s, log);
      return dead;
    }
     
    const toFoe = Math.max(1, Math.round(a.pow * DOM_BITE * domOverMul(s, foe)));
    const toMe = Math.max(1, Math.round(b.pow * DOM_BITE * domOverMul(foe, s)));
    b.hp = Math.max(0, b.hp - toFoe);
    a.hp = Math.max(0, a.hp - toMe);
    if (log) log.push('两座领域互相啃啮：它的领域 −' + toFoe + '（剩 ' + Math.round(b.hp) + '），你的 −' + toMe + '（剩 ' + Math.round(a.hp) + '）。');
    const dead = { foe: b.hp <= 0, me: a.hp <= 0 };
    if (dead.foe) breakFoeDomain(foe, log);
    if (dead.me) domBreakSelf(s, log);
    return dead;
  }
   
  


  function domFeedCap(s) {
    const st = stats(s);
    const base = Math.min(2 * st.curAtkBase, st.hpMax * 0.7 + Math.max(0, s.hp) * 0.3);
    return Math.max(0, Math.floor(base * st.ceCtl));
  }
  function feedDomain(s, n, log) {
    const p = pst(s);
    if (!p.dom) return 0;
    const want = Math.max(0, Math.min(Math.floor(n || 0), domFeedCap(s)));
    const pay = Math.min(want, Math.max(0, Math.floor(s.cur)));
    if (pay <= 0) return 0;
    s.cur -= pay;
    p.dom.hp = Math.min(p.dom.hpMax, p.dom.hp + pay);    
    if (log) log.push('你往领域里续了一口气（咒力 −' + pay + '，' + p.dom.name + ' +' + pay + ' → ' + Math.round(p.dom.hp) + '）。');
    return pay;
  }
  function autoFeedDomain(s, log) {
    const n = Math.floor(s.domFeed || 0);
    if (n <= 0) return 0;
    return feedDomain(s, n, log);
  }
  




  function domUpkeepRate(ctl, eff) {
    return 0.05 + 0.10 * Math.max(0, 1 - 0.4 * (ctl || 0) - 0.6 * (eff || 0));
  }
  

  const DOM_UPKEEP_FLAT = 50;
  function domUpkeepOf(s) {
    const st = stats(s);
    return Math.max(1, Math.round(st.curMax * domUpkeepRate(st.ceCtl, st.ceEff)) + DOM_UPKEEP_FLAT);
  }
  function foeDomUpkeepOf(foe) {
    const ctl = foe.ceCtl != null ? foe.ceCtl : clamp(0.30 + 0.035 * (foe.lvl || 0), 0.20, 0.80);
    const eff = foe.ceEff != null ? foe.ceEff : ctl;
    const pool = foe.curMax != null ? foe.curMax : Math.max(1, Math.round((foe.hpMax || 0) * 0.6));
    return Math.max(1, Math.round(pool * domUpkeepRate(ctl, eff)) + DOM_UPKEEP_FLAT);
  }
   
  function domUpkeep(owner, log, who) {
    if (!owner) return 0;
    const dom = (owner.pst && owner.pst.dom) || owner.dom || null;
    if (!dom) return 0;
    const foeSide = !owner.attrs;
    if (foeSide && dom.endless) return 0;
    const cost = foeSide ? foeDomUpkeepOf(owner) : domUpkeepOf(owner);
    const have = Math.max(0, Math.floor(owner.cur || 0));
    if (have < cost) {
      owner.cur = 0;
      if (foeSide) breakFoeDomain(owner, log, 'dried'); else domBreakSelf(owner, log, 'dried');
      return 0;
    }
    owner.cur = have - cost;
     
    const pre = foeSide ? (owner.name + ' 的') : (who ? (who + ' 的') : (owner.mirror === true ? '镜像 的' : '你的'));
    if (log) log.push(pre + '领域「' + dom.name + '」每回合烧 ' + cost + ' 咒力吊着（剩 ' + Math.round(owner.cur) + '）。');
    return cost;
  }

  






   
  

  const DOM_DMG_MUL = 0.75;
  function domHit(owner, victim, mult, type, log, extra) {
    if (!victim || victim.hp <= 0) return 0;
    extra = extra || {};
    const foeOwner = !!(owner && owner.atk != null && !owner.attrs);
    if (!foeOwner) return dealDamage(owner, victim, Object.assign({ mult: mult, type: type || 'cur', dmgOnly: DOM_DMG_MUL }, extra), log);
    if (type === 'phy' && hasInnate(victim, 't_mukagen')) {
      const cost = blockCost(victim, owner.atk || 1);
      if (victim.cur >= cost) { victim.cur -= cost; log.push('无下限挡住了领域里的一击（咒力 -' + cost + '）。'); return 0; }
    }
    const stv = stats(victim);
    const crit = Math.random() * 100 < 6;
    let dmg = (owner.atk || 1) * mult * DOM_DMG_MUL * (1 - defRedOf(owner.atk || 1, stv.def, 0)) * rnd(0.9, 1.12) * (crit ? 1.6 : 1);
    dmg = Math.max(1, Math.round(dmg));
     
    const domOver = domOverMul(owner, victim);
    dmg = Math.max(1, Math.round(dmg * domOver));
    if (domEntOf(victim)) damageDomainOn(victim, Math.round((owner.atk || 1) * mult * domOver), log);
    const taken = absorb(victim, dmg, log);
    victim.hp -= taken;
    log.push(owner.name + ' 的领域出手，你受创 ' + taken + (crit ? '（暴击）' : '') + '。');
    nearDeathCheck(victim, log);
    return taken;
  }
  


  function domPin(victim, who, log) {
    const n = (victim.st.domPin = (victim.st.domPin || 0) + 1);
    if (n % 2 === 0) return false;
    victim.st.stun = Math.max(victim.st.stun || 0, 1);
    return true;
  }
  const DOM_TICK = {
     
    infoOverload(owner, victim, log) {
      log.push(domPin(victim, '无量空处', log)
        ? '无量空处：无穷次的「做得到」还在往 ' + victim.name + ' 里灌，这一回合它动不了。'
        : '无量空处：信息还在往里灌，钉劲却缓了一线 —— ' + victim.name + ' 这一回合挣得动。');
      domHit(owner, victim, 0.30, 'cur', log, { trueDamage: 0.20 });
    },
     
    command(owner, victim, log) {
      const orders = [
        { n: '「别动」', f: () => { if (!domPin(victim, '万言无声', log)) { victim.st.weak = Math.max(victim.st.weak || 0, 0.35); log.push('（钉劲隔一回合才缓得过来 —— 这一下没钉住，改口压住它的咒力。）'); } } },
        { n: '「软」',   f: () => { victim.st.weak = Math.max(victim.st.weak || 0, 0.35); } },
        { n: '「碎」',   f: () => { victim.st.defDown = Math.min(0.9, (victim.st.defDown || 0) + 0.10); } }
      ];
      const o = orders[(Math.random() * orders.length) | 0];
      o.f();
      log.push('万言无声：你说了句 ' + o.n + '，它就得照做。');
      domHit(owner, victim, 0.35, 'cur', log);
    },
     
    shadowSwarm(owner, victim, log) {
      log.push('嵌合暗翳庭：影子从脚下立起来一片，朝 ' + victim.name + ' 扑过去。');
      domHit(owner, victim, 1.05, 'phy', log, { drain: 0.25 });
    },
     
    soulTrue(owner, victim, log) {
      log.push('自闭圆顿裹：你伸手直接去捏 ' + victim.name + ' 的形状 —— 肉身挡不住。');
      domHit(owner, victim, 0.60, 'cur', log, { trueDamage: 0.6, defDown: 0.10 });
    },
     
    bloodPrice(owner, victim, log) {
      const st = stats(owner);
      const lost = Math.max(0, 1 - Math.max(0, owner.hp) / Math.max(1, st.hpMax));
      const m = 0.45 + lost * 1.6;
      log.push('血海无涯：血淌得越多，浪头越高（出力 ×' + m.toFixed(2) + '）。');
      domHit(owner, victim, m, 'cur', log, { lifesteal: 0.25 });
    },
     
    openBarrier(owner, victim, log) {
      log.push('伏魔御厨子：斩击从每个方向同时落下，没有可以躲的地方。');
       
      for (let i = 0; i < 4 && victim.hp > 0; i++) domHit(owner, victim, 0.315, 'phy', log, { pierce: 0.45, slash: 1 });
    },
     
    weakPoint(owner, victim, log) {
      victim.st.mark = Math.min(3, (victim.st.mark || 0) + 1);
      log.push('七三律：它身上又被量出一处「第七份」（分点 ×' + victim.st.mark + '）。');
      domHit(owner, victim, 0.62, 'phy', log, { pierce: 0.5 });
    },
     
    turretShield(owner, victim, log) {
      log.push('百骸机神：你身后的那一门转过炮口自动开火，顺手替你架起一层壳。');
      domHit(owner, victim, 0.55, 'cur', log);
      const p = pst(owner); p.guard = Math.max(p.guard || 0, 0.20);
    },
     
    craftRandom(owner, victim, log) {
      const roll = Math.random();
      if (roll < 0.5) { log.push('千锤百炼：你随手造出一样东西，朝 ' + victim.name + ' 砸下去。'); domHit(owner, victim, 0.75, 'phy', log, { pierce: 0.35 }); }
      else if (roll < 0.8) { const p = pst(owner); p.guard = Math.max(p.guard || 0, 0.30); log.push('千锤百炼：你造了一面墙，挡在身前。'); }
      else { victim.st.defDown = Math.min(0.9, (victim.st.defDown || 0) + 0.15); log.push('千锤百炼：造出来的东西拆掉了它一层防御。'); domHit(owner, victim, 0.40, 'phy', log); }
    },
     
    position(owner, victim, log) {
      log.push('天手力：拍了拍手，' + victim.name + ' 的位置换了 —— 它的架势全落空。');
      const back = Math.max(1, Math.round((victim.atk != null ? victim.atk : stats(victim).phyAtk) * 0.5));
      domHit(owner, victim, 0.5, 'cur', log);
      victim.hp -= back;
      log.push('它那一手收不住，落回自己身上，受创 ' + back + '。');
    },
     
    frameLock(owner, victim, log) {
      const held = domPin(victim, '时胞月宫殿', log);
      victim.st.mark = Math.min(3, (victim.st.mark || 0) + 1);
      log.push('时胞月宫殿：' + victim.name + ' 的动作被切成 24 格' + (held ? '，这一回合走不完。' : ' —— 这一回合它抢回一格，走得完。'));
      domHit(owner, victim, 0.55, 'phy', log, { pierce: 0.25 });
    },
     
    warehouse(owner, victim, log) {
      log.push('真赝相爱：架子上又取下一件赝品，照着原主的样子砸过去。');
      domHit(owner, victim, 0.85, 'cur', log, { weak: 0.25 });
      if (Math.random() < 0.3) {
        const st = stats(owner);
        const hp = Math.round(st.curMax * 0.10 + st.hpMax * 0.06);
        addShield(owner, { key: 'sum:dom_mimic', name: '赝品', kind: 'summon', hp: hp, hpMax: hp, turns: 3 });
        log.push('一件赝品替你挡在了身前。');
      }
    },
     
    slotJackpot(owner, victim, log) {
      const roll = Math.random();
      if (roll < 0.25) {
        const st = stats(owner); owner.cur = st.curMax;
        log.push('★ 坐杀博徒：三个图案对上了 —— 中大奖！咒力一下灌满，这一击不要钱地砸下去。');
        domHit(owner, victim, 2.4, 'phy', log, { pierce: 0.4 });
      } else if (roll < 0.6) {
        log.push('坐杀博徒：掷出的点数落在它身上。');
        domHit(owner, victim, 0.9, 'phy', log, { pierce: 0.3 });
      } else {
        const st = stats(owner); owner.cur = Math.min(st.curMax, owner.cur + Math.round(st.curMax * 0.08));
        log.push('坐杀博徒：这把没中，机器又吐回来一点咒力。');
        domHit(owner, victim, 0.35, 'phy', log);
      }
    },
     
    debuffSwarm(owner, victim, log) {
      const r = Math.random();
      if (r < 0.34) { victim.st.weak = Math.max(victim.st.weak || 0, 0.30); log.push('咒灵操术·全：一只咒灵扑上去，把它的咒力压住。'); }
      else if (r < 0.67) {
        if (domPin(victim, '咒灵操术·全', log)) log.push('咒灵操术·全：一只咒灵缠住了它，这一回合它动不了。');
        else { victim.st.weak = Math.max(victim.st.weak || 0, 0.30); log.push('咒灵操术·全：一只咒灵扑上去缠它 —— 没缠住，只压住了它的咒力。'); }
      }
      else { victim.st.dot = 3; victim.st.dotRate = 0.06; log.push('咒灵操术·全：一只咒灵钻进它影子里，毒开始渗。'); }
      domHit(owner, victim, 0.70, 'cur', log, { drain: 0.15 });
    }
  };
   
  function domTick(owner, victim, log) {
    if (!owner) return false;
     
    const dom = (owner.pst && owner.pst.dom) || owner.dom || null;
    if (!dom || !victim || victim.hp <= 0) return false;
    if (!victim.st) victim.st = {};
    const fn = DOM_TICK[dom.domKind];
    if (!fn) return false;
    fn(owner, victim, log || []);
    return true;
  }
   
  function playerStatusTick(s, log) {
    const st = s.st;
    if (!st) return;
    if (st.dot > 0) {
      const d = Math.max(1, Math.round(stats(s).curAtk * (st.dotRate || 0.05)));
      s.hp -= d; st.dot--;
      log.push('你身上的蚀在啃你，损失 ' + d + '。');
    }
    if (st.weak > 0) st.weak--;
  }
  



  function pst(s) { s.pst = s.pst || {}; return s.pst; }
   
  function healOnOf(s) { return !(s && s.pst && s.pst.healOff); }
  function shieldsOf(s) { const p = pst(s); if (!p.shields) p.shields = []; return p.shields; }
  function shieldOf(s, key) { return shieldsOf(s).find(x => x.key === key) || null; }
  function addShield(s, sh) {
    const list = shieldsOf(s);
    const i = list.findIndex(x => x.key === sh.key);
    const e = Object.assign({ turns: 0, kind: 'summon' }, sh);
    e.hpMax = e.hpMax || e.hp;
    e.hp = Math.max(0, Math.min(e.hp, e.hpMax));
    if (i >= 0) list[i] = e; else list.push(e);
    return e;
  }
  function removeShield(s, key) { const p = pst(s); p.shields = shieldsOf(s).filter(x => x.key !== key); }
  


  const MAHO_KEY = 'sum:tsm';
  function mahoOn(x) { return !!(x && shieldOf(x, MAHO_KEY)); }
   
  function oppositeSide(x) {
    const en = window.JH && window.JH.engine;
    if (!en || typeof en.getBattle !== 'function') return null;
    const b = en.getBattle();
    if (!b || !b.foe) return null;
    const me = en.s;
    if (x === b.foe) return (me && me !== b.foe) ? me : null;
    if (x === me) return b.foe;
    return null;
  }
  function clearMahoAdapt(owner, log) {
    const o = oppositeSide(owner);
    if (!o || !o.st || !((o.st.adapt || 0) > 0)) return false;
    const n = o.st.adapt;
    o.st.adapt = 0;
    if (log) log.push('魔虚罗一离开场上，' + (o.name || '对面') + ' 身上那份「适应 ×' + n + '」也跟着散掉。');
    return true;
  }
   
  function syncAdapt(s, foe, log) {
    if (foe && foe.st && !mahoOn(s) && (foe.st.adapt || 0) > 0) clearMahoAdapt(s, log);
    if (s && s.st && !mahoOn(foe) && (s.st.adapt || 0) > 0) {
      const n = s.st.adapt; s.st.adapt = 0;
      if (log) log.push('对面的魔虚罗不在了 —— 你身上那份「适应 ×' + n + '」随之散掉。');
    }
  }
  





  





  const JUKAI_K = [[7, 1.15], [5, 1], [3, 0.75], [0, 0.5]];
  function jukaiShieldHp(s, m) {
    const st = stats(s);
    const lv = (m && m.lv) || 1;
    let K = 0.5;
    for (let i = 0; i < JUKAI_K.length; i++) { if (lv >= JUKAI_K[i][0]) { K = JUKAI_K[i][1]; break; } }
    const byCur = 3 * (st.curAtkBase || 0) * (0.5 * st.ceEff + 0.5 * st.ceCtl);
    const byHp = st.hpMax * K;
    return Math.max(1, Math.round(Math.min(byCur, byHp)));
  }
  function summonKeyOf(m) {
    const sm = m ? mechOf(m).summon : null;
    if (!sm) return null;
    return 'sum:' + (sm.slot || sm.name || 'x');
  }
   
  function reclaimShield(s, sh, log) {
    const left = Math.max(0, Math.round(sh.hp || 0));
    removeShield(s, sh.key);
    if (sh.key === MAHO_KEY) clearMahoAdapt(s, log);    
    if (sh.src === 'csm') {
      const before = Math.round(s.csmBank || 0);
      s.csmBank = Math.min(4000, left);             
      if (log) log.push('『' + sh.name + '』收回影子里 —— 残余护盾 ' + left + ' 点收进了咒灵操术的库存（' + before + ' → ' + Math.round(s.csmBank) + '，覆盖旧值）。');
    } else if (log) {
      log.push('『' + sh.name + '』退回你的影子里（残余护盾 ' + left + ' 点散尽，不收）。');
    }
    return left;
  }
   
  function retractSummonIfOut(s, m, log) {
    const key = summonKeyOf(m);
    if (!key) return false;
    const sh = shieldOf(s, key);
    if (!sh) return false;
    reclaimShield(s, sh, log);
    startSummonCd(s, m.id, m);
    if (log) log.push('这门术式就此进入冷却（' + Math.ceil(cdLeft(s, m.id)) + ' 回合）—— 想再放，得等它歇够。');
    return true;
  }
  

  function shatteredOf(s, id) { const p = s && s.pst; return !!(p && p.shattered && p.shattered[id]); }
  function markShattered(s, id) { const p = pst(s); p.shattered = p.shattered || {}; p.shattered[id] = (p.shattered[id] || 0) + 1; }
   
  function absorb(s, dmg, log) {
    let left = dmg;
    const list = shieldsOf(s);
    const broken = [];
    for (let i = list.length - 1; i >= 0 && left > 0; i--) {
      const sh = list[i];
      if (sh.hp <= 0) continue;
      const used = Math.min(sh.hp, left);
      sh.hp -= used; left -= used;
      if (log) log.push(sh.name + ' 挡在你前面，替你吃下 ' + used + '（剩 ' + Math.round(sh.hp) + '）。');
      if (sh.hp <= 0) { broken.push(sh); if (log) log.push(sh.name + ' 的护盾碎了，它退回影子里。'); }
    }
    const p = pst(s);
    p.shields = list.filter(x => x.hp > 0);
    for (const b of broken) if (b.key === MAHO_KEY) clearMahoAdapt(s, log);    
    for (const b of broken) if (b.src === 'csm' && b.foeId != null) {
      markShattered(s, b.foeId);
      startSummonCd(s, 'drive:' + b.foeId);       
      if (log) log.push('『' + b.name + '』被打散了 —— 这一场里再也驱使不动它。');
    }
    

    for (const b of broken) if (b.src !== 'csm' && b.skillId) {
      startSummonCd(s, b.skillId);
      const sm = M()[b.skillId];
      if (log) log.push('「' + (sm ? sm.name : b.skillId) + '」进入冷却（' + Math.ceil(cdLeft(s, b.skillId))
        + ' 回合）—— 式神的护盾没了，就得等它歇够。');
    }
    return left;
  }
   
  function tickSummons(s, foe, log) {
    const list = shieldsOf(s).slice();
    for (const sh of list) {
      if (!sh.atk || foe.hp <= 0) continue;
      if (!shieldsOf(s).some(x => x.key === sh.key)) continue;    
      if (sh.turns > 0) sh.turns--;
      const a = sh.atk, hits = a.hits || 1;
      for (let i = 0; i < hits; i++) {
        if (foe.hp <= 0) break;
        dealDamage(s, foe, {
          mult: a.mult, type: a.type || 'phy', who: sh.name,
          pierce: a.pierce, trueDamage: a.trueDamage, lifesteal: a.lifesteal, drain: a.drain,
          stun: i === 0 ? a.stun : 0, weak: i === 0 ? a.weak : 0, dot: i === 0 ? a.dot : 0,
          mark: i === 0 ? a.mark : 0, exec: i === 0 ? a.exec : 0, pull: i === 0 ? a.pull : 0,
          defDown: i === 0 ? a.defDown : 0, slash: a.slash, selfHeal: a.selfHeal
        }, log);
      }
      if (sh.turns <= 0 && !sh.hold) {
        removeShield(s, sh.key);
        if (sh.key === MAHO_KEY) clearMahoAdapt(s, log);    
        const sm = sh.skillId ? M()[sh.skillId] : null;
        if (sm) startSummonCd(s, sh.skillId, sm); 
        log.push(sh.name + ' 的影子上淡了，自己退回你脚下'
          + (sm ? '（「' + sm.name + '」进入冷却 ' + Math.ceil(cdLeft(s, sh.skillId)) + ' 回合，歇够了还能再放）' : '（歇够了还能再驱）') + '。');
      }
    }
  }

  


  function driveOne(s, foe, id, log) {
    const st = stats(s);
    const t = window.JH_FOE_MAP[id];
    if (!t || !(s.tamed && s.tamed[id])) { log.push('你账下没有这只咒灵。'); return false; }
    if (shatteredOf(s, id)) { log.push('『' + t.name + '』这一场已经被打散了，驱使不动。'); return false; }
     
    const outNow = shieldOf(s, 'csm:' + id);
    if (outNow) {
      reclaimShield(s, outNow, log);
      startSummonCd(s, 'drive:' + id);
      log.push('『' + t.name + '』回到你的影子里 —— 这门驱使进入冷却（' + Math.ceil(cdLeft(s, 'drive:' + id)) + ' 回合）。');
      return true;
    }
    const dcd = cdLeft(s, 'drive:' + id);
    if (dcd > 0) { log.push('这只咒灵还在歇（剩 ' + Math.ceil(dcd) + ' 回合）。'); return false; }
    if (overloadRoll(s, log)) return false;
    const cost = Math.max(6, 8 + (t.lvl || 0) * 5);
    if (!foe.dummy && s.cur < cost) { log.push('咒力不足，驱使不动它。'); return false; }
    if (!foe.dummy) s.cur -= cost;
    log.push('—— ' + t.name + ' 从你的影子里爬了出来。');
    const hp = Math.round(st.curMax * 0.30 + st.hpMax * 0.20);
    addShield(s, { key: 'csm:' + id, foeId: id, name: t.name, kind: 'summon', src: 'csm',
      hp: hp, hpMax: hp, hold: true,
      atk: { mult: 0.55 + (t.lvl || 0) * 0.10, type: 'cur', hits: 1 } });
    dealDamage(s, foe, { mult: (1.6 + (t.lvl || 0) * 0.22) * outMult(s, 'cur'), type: 'cur', who: t.name }, log);
    if (foe.hp <= 0) foe.slainBy = 'drive:' + id;
    log.push('它护在你身前，一直撑到被打散；中途再驱使一次就是把它收回来（冷却从收回那一下起算）。');
    return true;
  }
  function driveAuto(s, foe, log) {
    const ids = Object.keys(s.tamed || {}).filter(x => window.JH_FOE_MAP[x]);
    const free = ids.filter(x => !shatteredOf(s, x) && cdLeft(s, 'drive:' + x) <= 0);
    const order = (a, b) => ((window.JH_FOE_MAP[b] || {}).lvl || 0) - ((window.JH_FOE_MAP[a] || {}).lvl || 0);
    const pick = free.filter(x => !shieldOf(s, 'csm:' + x)).sort(order)[0]
      || free.filter(x => shieldOf(s, 'csm:' + x))
             .sort((a, b) => (shieldOf(s, 'csm:' + a).hp || 0) - (shieldOf(s, 'csm:' + b).hp || 0))[0];
    if (!pick) { log.push(ids.length ? '账下的咒灵这一场都已经散了 / 都在歇。' : '账下没有咒灵。'); return false; }
    return driveOne(s, foe, pick, log);
  }

   
  function playerAct(s, foe, action, log) {
    const st = stats(s);
    const act = action || { type: 'attack' };
    if (s.pst) s.pst.buffered = false;       

     
    if (s.st && s.st.stun > 0) { s.st.stun--; log.push('你被钉在原地，这一回合动不了。'); return; }

    if (s.pst && foe.hp > 0) tickSummons(s, foe, log);
    syncAdapt(s, foe, log);    

     
    const tech = isTechAct(act);
    if (tech && s.overload > 0) {
      log.push('术式回路还烧着（熔断中，剩 ' + Math.ceil(s.overload) + ' 回合），使不出术式。');
      return;
    }
    if (!tech) s.castStreak = 0;

    if (act.type === 'curse') {
      const cost = Math.max(1, Math.ceil(10 * (1 - st.ceEff) * outCostMul(s, 'cur')));
      if (s.cur < cost) { log.push('咒力不足，放不出来。'); return; }
      s.cur -= cost;
      log.push('—— 你把咒力推了出去（注入 ' + cost + '）。');
      dealDamage(s, foe, { mult: 1.30 * outMult(s, 'cur'), type: 'cur' }, log);
      startCdRaw(s, 'act:curse', 3);    
      return;
    }
    if (act.type === 'skill') {
      const m = M()[act.id];
      if (!m) { log.push('这门术式你还没掌握。'); return; }
      

      if (act.id === 'sk_csm_drive') { driveAuto(s, foe, log); return; }
       
      if (m.domain) { const p0 = pst(s); if (p0.dom && p0.dom.id === m.id) { retractDomain(s, m, log); return; } }
       
      if (!m.domain && retractSummonIfOut(s, m, log)) return;
      const cd = cdLeft(s, act.id);
      if (cd > 0) { log.push('「' + m.name + '」还在冷却（剩 ' + Math.ceil(cd) + ' 回合）。'); return; }
      if (m.domain && s.pst && s.pst.domBreak > 0) { log.push('领域刚被压碎，' + Math.ceil(s.pst.domBreak) + ' 回合内展不开。'); return; }
      if (m.domain && !domGateOk(s, m)) {
        log.push('结界术还不到 ' + domNeedBarrier(s, m) + ' 级，「' + m.name + '」展不开（你手上是 ' + barrierLv(s) + ' 级）。'
          + '领域展开要 1 级结界术；想在战斗里切开放 / 封闭，还要再练到 ' + DOM_FORM_NEED + ' 级。');
        return;
      }
      if (overloadRoll(s, log)) return;
      const cost = skillCost(s, m);
      const eff = mechOf(m);
      const hpPay = eff.hpCost ? Math.max(1, Math.round(st.hpMax * eff.hpCost)) : 0;
      if (!foe.dummy && s.cur < cost) { log.push('咒力不足，' + m.name + ' 使不出来。'); return; }
      if (!foe.dummy && hpPay && s.hp <= hpPay) { log.push('气血不够了，' + m.name + '使出来会先把自己掏空。'); return; }
      if (!foe.dummy) {
        s.cur -= cost;
        if (hpPay) { s.hp -= hpPay; log.push('（以自身气血为代价，-' + hpPay + '）'); }
      }
      log.push('—— 你使出「' + m.name + '」。');
       
      let gm = 1;
      if (eff.gamble) {
        gm = 0.55 + Math.random() * 3.0;
        log.push('赌一把：' + (gm >= 2.4 ? '中大奖！' : gm >= 1.5 ? '押中了。' : gm >= 0.9 ? '不输不赢。' : '押空了……'));
      }
       
      if (eff.bank && s.csmBank) {
        const bm = 1 + Math.min(2.0, s.csmBank / 500);
        gm *= bm;
        log.push('库存的咒灵之力一并涌出（×' + bm.toFixed(2) + '）。');
        s.csmBank = 0;
      }
      const hits = m.hits || 1;
      for (let i = 0; i < hits; i++) {
        if (foe.hp <= 0) break;
        dealDamage(s, foe, {
          mult: (m.mult || 1) * gm * outMult(s, (m.atkType === 'phy') ? 'phy' : 'cur', m), type: m.atkType || 'cur', lv: skillLv(s, m.id),
          pierce: eff.pierce, trueDamage: eff.trueDamage, lifesteal: eff.lifesteal,
          drain: eff.drain, defDown: i === 0 ? eff.defDown : 0, stun: i === 0 ? eff.stun : 0,
          weak: i === 0 ? eff.weak : 0, dot: i === 0 ? eff.dot : 0,
          recoil: i === 0 ? eff.recoil : 0, adapt: !!eff.adapt,
          mark: eff.mark, exec: eff.exec, swap: i === 0 ? eff.swap : 0,
          selfHeal: eff.selfHeal, guard: i === 0 ? eff.guard : 0,
          nullify: i === 0 ? eff.nullify : 0, pull: i === 0 ? eff.pull : 0
        }, log);
      }
      if (eff.summon && foe.hp > 0) {
        const sm = eff.summon;
        const key = 'sum:' + (sm.slot || sm.name || 'x');
         
        const hp = sm.shieldHp || ((!m.domain && m.innate === 't_jukai')
          ? jukaiShieldHp(s, m)
          : Math.round(st.curMax * (sm.shieldPct || 0.22) + st.hpMax * 0.18));
        addShield(s, { key: key, name: sm.name || '式神', kind: 'summon', src: sm.src || '', skillId: act.id,
          hp: hp, hpMax: hp, turns: sm.turns || 4,
          atk: sm.atk || { mult: sm.mult || 0.8, type: sm.type || 'cur', hits: 1 } });
        log.push('「' + (sm.name || '式神') + '」留在了场上，护在你身前'
          + (sm.turns ? '（能撑 ' + (sm.turns || 4) + ' 回合）' : '（一直留在场上，直到被打散）')
          + '；中途再点这门术式就是把它收回来 —— 收回即进冷却。');
      }
      if (m.domain) { openDomain(s, m, log); domainClash(s, foe, log); }    
      else startCd(s, act.id, m);
       
      if (foe.hp <= 0) foe.slainBy = 'skill:' + act.id;
      if (act.id === 'sk_csm_tame' && foe.hp <= 0) {
        const en = window.JH && window.JH.engine;
        if (en && en.tameFoe) en.tameFoe(foe);
      }
      if (st.crit > 40 && Math.random() < 0.5) s.c.crit = (s.c.crit || 0) + 1;
      return;
    }
    if (act.type === 'borrow') {
      const m = M()[act.id];
      if (!m) { log.push('你还没借到这一门。'); return; }
      const uses = (s.borrow || {})[act.id];
      if (!uses) { log.push('这一门已经用尽了。'); return; }
      const bcd = cdLeft(s, act.id);
      if (bcd > 0) { log.push('借来的「' + m.name + '」还在冷却（剩 ' + Math.ceil(bcd) + ' 回合）。'); return; }
      if (overloadRoll(s, log)) return;
      const cost = skillCost(s, m);
      if (!foe.dummy && s.cur < cost) { log.push('咒力不足，' + m.name + ' 使不出来。'); return; }
      if (!foe.dummy) s.cur -= cost;
      log.push('—— 你借来的「' + m.name + '」出手了。');
      const be = mechOf(m);
      dealDamage(s, foe, {
        mult: (m.mult || 1) * outMult(s, (m.atkType === 'phy') ? 'phy' : 'cur', m),
        type: m.atkType || 'cur', lv: 1, stun: be.stun || 0, pierce: be.pierce,
        trueDamage: be.trueDamage, dot: be.dot, weak: be.weak, mark: be.mark
      }, log);
      if (foe.hp <= 0) foe.slainBy = 'borrow:' + act.id;
      startCd(s, act.id, m);
      s.borrow[act.id] = uses - 1;
      if (s.borrow[act.id] <= 0) { delete s.borrow[act.id]; log.push('这一门借来的术式用尽了，得重新借。'); }
      return;
    }
    if (act.type === 'drive') { driveOne(s, foe, act.id, log); return; }
    if (act.type === 'stored') {
      const ent = (s.forge || {})[act.item];
      const sid = ent && ent.store;
      const m = sid ? M()[sid] : null;
      if (!m) { log.push('这件咒具里没存着术式。'); return; }
      const scd = cdLeft(s, 'stored:' + act.item);
      if (scd > 0) { log.push('这件咒具刚把存着的术式放出去，还在冷却（剩 ' + Math.ceil(scd) + ' 回合）。'); return; }
      const cost = skillCost(s, m);
      if (!foe.dummy && s.cur < cost) { log.push('咒力不足，存着的「' + m.name + '」放不出来。'); return; }
      if (overloadRoll(s, log)) return;
      if (!foe.dummy) s.cur -= cost;
      log.push('—— 咒具里存着的「' + m.name + '」借了出来。');
      const se = mechOf(m);
      dealDamage(s, foe, {
        mult: (m.mult || 1) * outMult(s, (m.atkType === 'phy') ? 'phy' : 'cur', m),
        type: m.atkType || 'cur', lv: 1, stun: se.stun || 0, pierce: se.pierce,
        trueDamage: se.trueDamage, dot: se.dot, weak: se.weak, mark: se.mark
      }, log);
      if (foe.hp <= 0) foe.slainBy = 'stored:' + m.id;
      startCdRaw(s, 'stored:' + act.item, Math.max(3, cdBaseOf(m)));    
      if (window.JH && window.JH.engine && window.JH.engine.takeStored) window.JH.engine.takeStored(act.item, s);    
      return;
    }
    if (act.type === 'domform') {
      const p = pst(s);
      const standing = !!(p.dom && p.dom.openable);       
      if (!standing && !hasOpenDom(s)) { log.push('你名下还没有能改形态的领域。'); return; }
       
      if (!domFormGateOk(s)) {
        log.push('结界术还不到 ' + DOM_FORM_NEED + ' 级（你手上是 ' + barrierLv(s) + ' 级），开放 / 封闭这套手法还没练成。');
        return;
      }
      const next = (s.domForm === 'open') ? 'closed' : 'open';
      s.domForm = next;
      if (standing) {
        p.dom.kind = next;
        log.push('你把「' + p.dom.name + '」改成' + (next === 'open'
          ? '敞开的 —— 不设结界，能叠在别人的领域上，对封闭领域增伤。'
          : '合上的 —— 结界落锁，谁都出不去。'));
        if (next === 'open') domainClash(s, foe, log);
      } else {
        log.push('领域形态改成「' + (next === 'open' ? '开放' : '封闭') + '」——下一次展开就是它。');
      }
      return;
    }
    if (act.type === 'item') {
      

      const used = (window.JH && window.JH.engine) ? window.JH.engine.useItem(act.id, true, s) : false;
      const i0 = window.JH_ITEM_MAP && window.JH_ITEM_MAP[act.id];
      log.push(used ? ('你服下了「' + ((i0 && i0.name) || act.id) + '」。') : ('行囊里没有「' + ((i0 && i0.name) || act.id) + '」可用。'));
      return;
    }
    if (act.type === 'store') {
      const iid = act.item;
      const f = (s.forge || {})[iid];
      const it = window.JH_ITEM_MAP && window.JH_ITEM_MAP[iid];
      const nm = (it && it.name) || iid;
      if (!f || (f.slots || []).indexOf('w_store') < 0) { log.push('这件东西上没有「咒术存储」的纹路，吸不了。'); return; }
      if (f.store) { log.push('这件咒具里已经存着「' + (M()[f.store] ? M()[f.store].name : f.store) + '」了 —— 先用掉或弃掉，才能再吸。'); return; }
      const eq = s.equip || {};
      const held = eq.weapon === iid || eq.armor === iid || eq.charm === iid || eq.boots === iid;
      if (!held) { log.push('「' + nm + '」没带在身上 —— 先把它穿上，才亮得出来。'); return; }
      const p = pst(s);
      if (p.storeArm === iid) { p.storeArm = null; log.push('你把「' + nm + '」收了回去 —— 不再等它的术式了。'); return; }
      p.storeArm = iid;
      log.push('你亮出「' + nm + '」，摆好收纳的架势 —— 对手下一手若是术式，就被它整口吞下（代价是双倍伤害）。');
      return;
    }
    if (act.type === 'flee') {
       
      const mineD = domEntOf(s), foeD = domEntOf(foe);
      const mineOpen = !!(mineD && mineD.kind === 'open');
      if (foeD && foeD.kind === 'closed' && !mineOpen) { log.push('对面的封闭领域合着，你走不出这个圈。'); return; }
      if (mineD && mineD.kind === 'closed') { log.push('你自己的领域合着 —— 谁都走不了，包括你。'); return; }
      const esc = st.escRate * (1 - (st.barrier || 0)) * (1 - ((st.words && st.words.bind) || 0)) * (mineOpen ? 1.25 : 1);
      if (mineOpen) log.push('你的领域敞着，没有结界拦路。');
      if (foe.dummy || Math.random() < esc) { log.push(foe.dummy ? '你收了手。' : '你抽身退走。'); foe._fled = true; return; }
      log.push('你想走，却被缠住了。'); return;
    }
    

    if (act.type === 'healtoggle') {
      const self = act.who || '你';
      if (!(stats(s).heal > 0)) { log.push(self + '身上没有在转的回复术式。'); return; }
      const p = pst(s);
      const next = (act.on != null) ? !!act.on : !!(p.healOff);
      p.healOff = !next;
      log.push(next ? (self + '让回复术式重新转了起来（每回合回一份，代价是同量的咒力）。')
                    : (self + '把回复术式收住了 —— 这一场不再自己回血。'));
      return;
    }
     
     
    if (act.type === 'idle') { log.push('—— 你发了会儿呆，这一回合什么都没做（对手照常出手）。'); return; }
    dealDamage(s, foe, { mult: 1.15 * outMult(s, 'phy'), type: 'phy', plain: true }, log);    
    if (foe.hp <= 0) foe.slainBy = 'attack';
    nearDeathCheck(s, log);                  
  }

   
  function foeAct(s, foe, log) {
    if (foe.hp <= 0 || foe.dummy) return;
    const st = stats(s);
    const words = st.words || {};
    if (foe.st.stun > 0) { foe.st.stun--; log.push(foe.name + ' 挣不开束缚。'); return; }
    if (foe.st.dot > 0) {
      const d = Math.max(1, Math.round(st.curAtk * (foe.st.dotRate || 0.05)));
      foe.hp -= d; foe.st.dot--;
      log.push(foe.name + ' 身上的毒在啃它，损失 ' + d + '。');
    }
    if (foe.st.weak > 0) foe.st.weak--;
    if (foe.domBreak > 0) foe.domBreak--;
     
    if (foe.domId && !foe.dom && !(foe.domBreak > 0) && Math.random() < 0.30) {
      const dm = M()[foe.domId];
      if (dm) {
        const dh = foeDomHpMax(foe);
        const formOpen = foeDomFormOpen(foe, dm);
        foe.dom = { id: dm.id, name: dm.name, kind: formOpen ? 'open' : 'closed', domKind: dm.domKind || '',
          pow: 0, turns: 0, hp: dh, hpMax: dh, endless: !!foe.endlessDom };
        foe.dom.pow = Math.round(domPowerOf(foe, null, foe.dom) * 100) / 100;    
        log.push('★ ' + foe.name + ' 展开了领域：' + dm.name + '（' + (formOpen ? '开放式' : '封闭式') + ' · 领域血 ' + (foe.endlessDom ? '∞' : Math.round(dh)) + '）。');
        domainClash(s, foe, log);
      }
    }
    let atk = foe.atk * (foe.st.weak > 0 ? 0.6 : 1);
     
    if (foe.st.pull) atk *= (1 - foe.st.pull);

     
    if (s.pst && s.pst.nullify > 0) {
      s.pst.nullify--;
      log.push('「无限」把 ' + foe.name + ' 的一击摊在无穷远的地方' + (s.pst.nullify ? '（还可挡 ' + s.pst.nullify + ' 击）' : '') + '。');
      return;
    }
     
    if (s.pst && s.pst.guard) atk *= (1 - s.pst.guard);

    if (Math.random() * 100 < Math.min(60, st.dodge)) { log.push(foe.name + ' 扑了个空。'); return; }

    if (hasInnate(s, 't_mukagen')) {
      if (foe.dmgType === 'phy') {
        const cost = blockCost(s, atk);
        if (s.cur >= cost) {
          s.cur -= cost;
          log.push('无下限挡住了那一击（咒力 -' + cost + '）。');
          return;
        }
        log.push('咒力见底，无下限缩了回去。');
      } else if (foe.dmgType === 'cur') {
        atk *= mukagenFactor(s);
      } else if (foe.dmgType === 'mixed') {
        

        const half = atk * 0.5;
        const cost = blockCost(s, half);
        if (s.cur >= cost) {
          s.cur -= cost;
          log.push('无下限挡下了那一半物理（咒力 -' + cost + '），咒力那一半照旧打进来。');
          atk = half * mukagenFactor(s);
        } else {
          log.push('咒力见底，无下限缩了回去 —— 那一半物理也一起打进来。');
          atk = half + half * mukagenFactor(s);
        }
      }
    }

    let dmg = atk * (1 - defRedOf(atk, st.def, 0)) * rnd(0.9, 1.12);
     
    const flaw = Math.max(0, (outFrac(s, 'phy') * 100 - 50) / 250) * (((O()[s.origin] || {}).swap === 'cur2body') ? 0.7 : 1);
    if (flaw > 0) dmg *= (1 + flaw);
    if (hasInnate(s, 't_puppet')) dmg *= 0.88;
     
    const domOver = domOverMul(foe, s);
    dmg *= domOver;
    const crit = Math.random() * 100 < 6;
    if (crit) dmg *= 1.6;
     
    let skillName = '', skillId = '';
    if (foe.skills && foe.skills.length && Math.random() < 0.45) {
      const mm = M()[foe.skills[(Math.random() * foe.skills.length) | 0]];
      if (mm) { skillName = mm.name; skillId = mm.id; dmg *= 1.28; }
    }
     
    if ((foe.dmgType === 'cur' || foe.dmgType === 'mixed') && words.buffer && s.pst && !s.pst.buffered && dmg > 1) {
      s.pst.buffered = true;
      const cut = Math.round(dmg * words.buffer);
      const pay = Math.min(s.cur, cut);
      s.cur -= pay;
      dmg = Math.max(1, dmg - cut);
      log.push('词条「缓冲」卸掉一半咒力伤害（咒力 -' + pay + '）。');
    }
     
    if (skillId && s.pst && s.pst.storeArm) {
      const iid = s.pst.storeArm;
      const f = s.forge && s.forge[iid];
      const it = window.JH_ITEM_MAP && window.JH_ITEM_MAP[iid];
      if (f && !f.store && (f.slots || []).indexOf('w_store') >= 0 && window.JH.engine && window.JH.engine.storeWord) {
        dmg *= 2;
        window.JH.engine.storeWord(iid, skillId, s);
        s.pst.storeArm = null;
        log.push('你亮着的「' + ((it && it.name) || iid) + '」把那一击整口吞了下去（双倍伤害），「' + skillName + '」就此记进了咒具。');
      }
    }
    dmg = Math.max(1, Math.round(dmg));
     
    if (domEntOf(s)) damageDomainOn(s, atk * domOver, log);
    const taken = absorb(s, dmg, log);      
    s.hp -= taken;
    if (hasInnate(s, 't_const')) {
      const c = Math.max(1, Math.ceil(4 * (1 - st.ceEff)));
      s.cur = Math.max(0, s.cur - c);
    }
    log.push(foe.name + (skillName ? ' 使出「' + skillName + '」，' : ' 反击，') + '你受创 ' + taken + (crit ? '（暴击）' : '') + '。');
     
    const bloodBack = hasInnate(s, 't_blood') ? Math.round(taken * 0.05 * innateLv(s, 't_blood')) : 0;
    const wordBack = (words.rebound && (foe.dmgType === 'phy' || foe.dmgType === 'mixed')) ? Math.round(taken * words.rebound) : 0;
    if (wordBack > bloodBack && wordBack > 0) {
      const cost = Math.round(taken * 2);
      const pay = Math.min(s.cur, cost);
      s.cur -= pay;
      if (pay < cost) {
        const gap = cost - pay;
        s.hp -= gap;
        log.push('词条「反震」把那一击弹了回去（' + wordBack + '）——但咒力不够，缺口 ' + gap + ' 算在你自己头上。');
      } else {
        log.push('词条「反震」把那一击弹了回去（' + wordBack + '，咒力 -' + cost + '）。');
      }
      foe.hp -= wordBack;
    } else if (bloodBack > 0) {
      foe.hp -= bloodBack; log.push('赤血操术反弹 ' + bloodBack + '。');
    }
     
    nearDeathCheck(s, log);
    if (hasInnate(s, 't_jukai') && Math.random() < 0.15) {
      log.push('影犬从你脚边窜出，替你还了一口。');
      dealDamage(s, foe, { mult: 0.9, type: 'cur' }, log);
    }
  }

   
  function autoResolve(s, foe) {
    const log = [];
    let rounds = 0;
    const st = stats(s);
    const pick0 = bestSkill(s, foe);
    while (foe.hp > 0 && s.hp > 0 && rounds < 300) {
      rounds++;
      let acted = false;
      if (pick0 && !(pick0.domain && pst(s).dom) && s.overload <= 0 && cdLeft(s, pick0.id) <= 0 && s.cur >= skillCost(s, pick0)) { playerAct(s, foe, { type: 'skill', id: pick0.id }, log); acted = true; }
      if (!acted) {
        const curCost = Math.max(1, Math.ceil(10 * (1 - st.ceEff)));
        if (s.cur >= curCost && foe.phyRes > 0.3) playerAct(s, foe, { type: 'curse' }, log);
        else playerAct(s, foe, { type: 'attack' }, log);
      }
      if (foe.hp <= 0) break;
      tickCd(s, 1);
      foeAct(s, foe, log);
      tickBf(s, 1);
      playerStatusTick(s, log);
      healTick(s, log);
      foeHealTick(foe, log);
      curTick(s, log);
      curTick(foe, log, foe.name);
      domTick(s, foe, log);
      domTick(foe, s, log);
      domUpkeep(s, log);
      domUpkeep(foe, log);
      autoFeedDomain(s, log);
      domAttrition(s, foe, log);
    }
    if (log.length > 6) log.splice(0, log.length - 6);
    return { win: foe.hp <= 0, lose: s.hp <= 0, rounds, log };
  }

   
  function bestSkill(s, foe) {
    const st = stats(s);
    let best = null, bestScore = 0;
    for (const id of Object.keys(s.skills || {})) {
      const m = M()[id];
      if (!m || m.kind !== 'atk') continue;
      if (m.innate && (!hasInnate(s, m.innate) || innateLv(s, m.innate) < (m.lv || 0))) continue;
      if (m.domain && !domainOn(s, m.innate)) continue;
      if (m.domain && pst(s).dom) continue;       
      const skey = summonKeyOf(m);                
      if (skey && shieldOf(s, skey)) continue;
      if (m.domain && !domGateOk(s, m)) continue;
      if (cdLeft(s, id) > 0 || cdLeft(s, 'drive:' + id) > 0) continue;
      const cost = skillCost(s, m);
      if (cost > s.cur) continue;
      const res = (m.atkType === 'phy' ? foe.phyRes : foe.curRes);
      if (res >= 0.9) continue;
      const score = (m.mult || 1) * (1 - res) * (m.hits || 1) - cost * 0.01;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

   
  function peakHit(s) {
    const st = stats(s);
    const mixPeak = 0.5 * st.phyAtk + 0.5 * st.curAtk;    
    let best = Math.max(st.phyAtk, st.curAtk);            
    const ms = M();
    for (const id of Object.keys(s.skills || {})) {
      const m = ms[id];
      if (!m || m.kind !== 'atk') continue;
      const lv = skillLv(s, id);
      const ch = (m.atkType === 'phy') ? 'phy' : 'cur';
      const mult = (m.mult || 1) * (1 + 0.08 * (lv - 1)) * (m.hits || 1) * outMult(s, ch, m);
      const v = (m.atkType === 'phy' ? mixPeak : st.curAtk) * mult;
      if (v > best) best = v;
    }
     
    return Math.max(1, Math.round(best * 2));
  }

  



  function healTick(s, log, who, opts) {
    if (!s || s.hp <= 0) return 0;
    const st = stats(s);
    if (!(st.heal > 0)) return 0;
    

    if (s.pst && s.pst.healOff) return 0;
    const want = Math.min(Math.round(st.hpMax * st.heal), Math.max(0, st.hpMax - s.hp));
    if (want <= 0) return 0;
     
    const free = !!(opts && opts.free);
    const pay = free ? want : (isFinite(s.cur) ? Math.min(want, Math.max(0, Math.floor(s.cur))) : want);
    if (pay <= 0) { if (log) log.push((who || '你') + '的咒力见了底，回复术式转不动。'); return 0; }
    if (!free && isFinite(s.cur)) s.cur -= pay;
    s.hp = Math.min(st.hpMax, s.hp + pay);
    if (log) log.push((who || '你') + '的回复术式转过一圈：气血 +' + pay
      + (free ? '（练功木桩前，不耗咒力）。' : ('（咒力 −' + pay + '）' + (pay < want ? ' —— 咒力不够，只转得动这么多。' : '。'))));
    return pay;
  }
   
  function foeHealTick(foe, log) {
    if (!foe || foe.hp <= 0 || foe.gentle) return 0;
    let pct = 0;
    for (const id of (foe.skills || [])) { const m = M()[id]; if (m && m.nei && m.nei.heal) pct += m.nei.heal; }
    if (!(pct > 0)) return 0;
     
    const want = Math.min(Math.max(1, Math.round((foe.hpMax || 0) * pct)), Math.max(0, (foe.hpMax || 0) - foe.hp));
    if (want <= 0) return 0;
    const pay = isFinite(foe.cur) ? Math.min(want, Math.max(0, Math.floor(foe.cur))) : want;
    if (pay <= 0) return 0;
    if (isFinite(foe.cur)) foe.cur -= pay;
    foe.hp = Math.min(foe.hpMax, foe.hp + pay);
    if (log) log.push(foe.name + '的回复术式转过一圈：气血 +' + pay + '（咒力 −' + pay + '）。');
    return pay;
  }

  


  function curMaxOf(x) {
    if (!x) return 0;
    if (x.attrs) return stats(x).curMax;                  
    return isFinite(x.curMax) ? x.curMax : 0;             
  }
  function curTick(x, log, who) {
    if (!x || x.hp <= 0) return 0;
    if (!isFinite(x.cur)) return 0;
    const mx = curMaxOf(x);
    if (!(mx > 0) || x.cur >= mx) return 0;
     
    const gain = Math.round(CUR_REGEN_K * Math.log(1 + mx) + CUR_REGEN_PCT * Math.max(0, x.cur));
    if (!(gain > 0)) return 0;
    const before = x.cur;
    x.cur = Math.min(mx, before + gain);
    const got = x.cur - before;
    if (got > 0 && log) log.push((who || '你') + '的咒力自行回复 +' + got + '（' + Math.round(x.cur) + '/' + Math.round(mx) + '）。');
    return got;
  }

  




  function playerStatus(s, foeView) {
    const st = stats(s), list = [];
    const K = foeView ? (k => (k === 'good' ? 'bad' : k === 'bad' ? 'good' : k)) : (k => k);
    const sx = s.st || {};
    if (st.bf > 0) list.push({ n: '黑闪 ×' + st.bf, d: '心性大涨：咒效逼近满值，咒力与物理都重得多', k: K('good') });
    if (s.buff && s.buff.turns > 0) list.push({ n: '药力 ' + Math.ceil(s.buff.turns) + ' 回合', d: (s.buff.curAtk ? '咒攻 +' + Math.round(s.buff.curAtk * 100) + '% ' : '') + (s.buff.def ? '防御 +' + Math.round(s.buff.def * 100) + '%' : ''), k: K('good') });
    if (hasInnate(s, 't_mukagen')) list.push({ n: '无下限', d: '挡物理：每挡一下都要搭一截咒力（咒效越高越省）；咒力伤害也被压得很低', k: K('good') });
    if (hasInnate(s, 't_const')) list.push({ n: '构筑术式', d: '防御更高', k: K('good') });
    if (hasInnate(s, 't_puppet')) list.push({ n: '傀儡操术', d: '受伤更轻 · 每击耗咒力', k: K('good') });
    if (hasInnate(s, 't_blood')) list.push({ n: '赤血操术', d: '受物理伤会反弹一部分回去', k: K('good') });
    if (hasInnate(s, 't_ratio')) list.push({ n: '十划咒法', d: '暴击更高 · 打中要害更狠', k: K('good') });
    if (st.heal > 0) list.push({ n: '回复 ' + Math.round(st.heal * 1000) / 10 + '%／回合', d: '反转 / 命脉一类的回复术式：每回合按气血上限回一点', k: K('good') });
    if (s.pst && s.pst.nullify) list.push({ n: '无限 ×' + s.pst.nullify, d: '完全摊开来袭的一击：可再挡下 ' + s.pst.nullify + ' 次', k: K('good') });
    for (const sh of (s.pst && s.pst.shields) || []) list.push({ n: sh.name + ' 盾 ' + Math.round(sh.hp), k: K('good'),
      d: '召唤物挡在身前：护盾 ' + Math.round(sh.hp) + ' / ' + Math.round(sh.hpMax) + (sh.hold ? '，一直留在场上（护盾被打空就是它被打散）' : (sh.turns ? '，还能撑 ' + sh.turns + ' 回合' : '')) + (sh.atk ? '；每回合替你出手' : '') + '。放它那门术式正拿在手上 —— 再点一次就是把它收回来（咒灵操术把残余护盾收回库存，式神直接清除），收回 / 被打空 / 到期都让那门术式进冷却（冷却不短，也不吃减免）。' });
    if (s.pst && s.pst.shattered) {
      const gone = Object.keys(s.pst.shattered).filter(id => s.tamed && s.tamed[id] != null);
      if (gone.length) list.push({ n: '散掉的咒灵 ' + gone.length + ' 只', k: K('bad'),
        d: gone.map(id => (window.JH_FOE_MAP[id] || {}).name || id).join('、') + '：这一场被打散了，驱使不动（实战散场后从账下划掉）' });
    }
    if (s.pst && s.pst.guard) list.push({ n: '构筑护罩 −' + Math.round(s.pst.guard * 100) + '%', d: '身前的造物替你卸掉一部分来袭伤害', k: K('good') });
    

    if (sx.stun > 0) list.push({ n: '被钉住 ' + sx.stun, d: '无法行动', k: K('bad') });
    if (sx.weak > 0) list.push({ n: '咒力被压 ' + Math.round(sx.weak * 100) + '%', d: '出手轻一截', k: K('bad') });
    if (sx.dot > 0) list.push({ n: '蚀 ' + sx.dot, d: '每回合流失咒力伤害', k: K('bad') });
    if (sx.slash > 0) list.push({ n: '斩痕 ×' + sx.slash, d: '挨打更痛', k: K('bad') });
    if (sx.defDown > 0) list.push({ n: '破防 ' + Math.round(Math.min(0.9, sx.defDown) * 100) + '%', d: '防御被削去一层', k: K('bad') });
    if (sx.adapt > 0) list.push({ n: '适应 ×' + sx.adapt, d: '记住了你的招式', k: K('bad') });
    if (sx.mark > 0) list.push({ n: '分点 ×' + sx.mark, d: '十划咒法点出的弱点：被打得更痛', k: K('bad') });
    if (sx.pull > 0) list.push({ n: '被拽近 ' + Math.round(sx.pull * 100) + '%', d: '引力拽住了：出手与身手都变慢', k: K('bad') });
    if (s.act) list.push({ n: s.act.kind === 'meditate' ? '打坐中' : '休息中', d: '持续回咒力，也回气血', k: 'calm' });
    if (s.idle && s.idle.on) list.push({ n: '挂机', d: '智能打怪（不会停下来休息，不回精力；打斗里咒力每回合自回）', k: 'calm' });
    if (s.pst && s.pst.dom) list.push({ n: (s.pst.dom.kind === 'open' ? '开放领域 · ' : '封闭领域 · ') + s.pst.dom.name + ' ' + Math.round(s.pst.dom.hp) + '/' + Math.round(s.pst.dom.hpMax),
      d: (s.pst.dom.kind === 'open' ? '不设结界：能和别人的封闭领域叠在一起，对封闭领域增伤；关不住人也关不住自己' : '合上的结界：对手逃不掉' + (s.pst.overlap ? '；正与另一座领域重叠' : ''))
        + '。领域血 ' + Math.round(s.pst.dom.hp) + ' / ' + Math.round(s.pst.dom.hpMax) + '：会被对手的领域和技能直接打到（领域没防御，挨打照单全收）；每回合你还能往里面续咒力（上限 ' + domFeedCap(s) + '）。', k: K('good') });
    if (s.pst && s.pst.domBreak > 0) list.push({ n: '领域崩坏 ' + Math.ceil(s.pst.domBreak) + ' 回合', d: '咒效大跌，这段时间展不开领域', k: K('bad') });
    if (s.overload > 0) list.push({ n: '术式熔断 ' + Math.ceil(s.overload) + ' 回合', d: '回路烧断了：这段时间使不出任何术式', k: K('bad') });
    const cds = Object.keys(s.cd || {});
    if (cds.length) list.push({ n: '冷却 ' + cds.length + ' 门', d: cds.map(id => { const m = M()[id] || window.JH_FOE_MAP[id.replace(/^drive:/, '')]; return (m ? m.name : id) + ' ' + Math.ceil(s.cd[id]) + ' 回合'; }).join(' · '), k: 'calm' });
    return list;
  }
  function foeStatus(foe) {
    const st = foe.st || {}, list = [];
    if (foe.gentle) list.push({ n: '已收手', d: '他把领域收了起来，只是站着看你，什么也不做', k: 'calm' });
    if (st.stun > 0) list.push({ n: '被钉住 ' + st.stun, d: '无法行动', k: 'bad' });
    if (st.weak > 0) list.push({ n: '咒力被压 ' + st.weak, d: '出手轻一截', k: 'bad' });
    if (st.dot > 0) list.push({ n: '蚀 ' + st.dot, d: '每回合流失咒力伤害', k: 'bad' });
    if (st.slash > 0) list.push({ n: '斩痕 ×' + st.slash, d: '挨打更痛', k: 'bad' });
    if (st.defDown > 0) list.push({ n: '破防 ' + Math.round(Math.min(0.9, st.defDown) * 100) + '%', d: '防御被削去一层', k: 'bad' });
    if (st.adapt > 0) list.push({ n: '适应 ×' + st.adapt, d: '记住了你的招式', k: 'bad' });
    if (st.mark > 0) list.push({ n: '分点 ×' + st.mark, d: '十划咒法点出的弱点：你打它更痛', k: 'bad' });
    if (st.pull > 0) list.push({ n: '被拽近 ' + Math.round(st.pull * 100) + '%', d: '引力拽住了它：出手与身手都变慢', k: 'bad' });
    const fd = domEntOf(foe);
    if (fd) list.push({ n: (fd.kind === 'open' ? '开放领域 · ' : '封闭领域 · ') + fd.name + ' ' + Math.round(fd.hp) + '/' + Math.round(fd.hpMax),
      d: (fd.kind === 'closed' ? '封闭领域：你逃不出去' : '开放领域：对封闭领域增伤') + '。打到领域血归零，就能把它的领域打碎。', k: 'bad' });
    if (foe.domBreak > 0) list.push({ n: '领域崩坏 ' + Math.ceil(foe.domBreak) + ' 回合', d: '它的领域被你压碎了：展不开也压不住你', k: 'good' });
    return list;
  }

  window.JH_combat = {
    forgePct, wordsOf, nearDeathCheck,
    stats, baseline, baselinePlayer, GEAR, mit, makeFoe, forecast, playerStatus, foeStatus, foeAddOf,
    playerAct, foeAct, autoResolve, bestSkill, peakHit, skillCost, blockCost, mukagenFactor,
    hasInnate, innateLv, domainOn, skillLv, barrierLv, domNeedBarrier, domGateOk, domFormGateOk, DOM_FORM_NEED, rnd, pick, mechOf, mechNote,
    blackFlashRate, bfLayers, bfLv, addBlackFlash, tickBf, outFrac, outMult, outCostMul,
    healTick, foeHealTick, healOnOf, curTick, curMaxOf, CUR_REGEN_K, CUR_REGEN_PCT, BATTLE_HP_ADD, BATTLE_CUR_ADD, SOLO_HP_ADD, SOLO_CUR_ADD,
    activeIds, shieldsOf, shieldOf, addShield, removeShield, absorb, tickSummons, shatteredOf, markShattered,
    summonKeyOf, retractSummonIfOut, reclaimShield, startSummonCd, jukaiShieldHp, SUMMON_CD,
    syncAdapt, clearMahoAdapt, mahoOn, MAHO_KEY, DOM_DMG_MUL,
    cdReduceOf, cdBaseOf, cooldownOf, cdLeft, startCd, startCdRaw, tickCd,
    overloadRate, isTechAct, overloadRoll,
    domIsOpen, domPowerOf, domPowCore, domPowFoe, domPowMine, domPowOf, domEntOf, domRefreshPow, foeDomBase, domProfOf, domBarrierOf, fmtPow, effDefOf, defRedOf,
    openDomain, retractDomain, domainClash, breakFoeDomain, domBreakSelf, DOM_BREAK_TURNS,
    domHpMaxOf, foeDomHpMax, damageDomain, damageDomainOn, domAttrition, DOM_BITE, hasOpenDom,
    domFeedCap, feedDomain, autoFeedDomain, playerDomOf: (s) => (s && s.pst && s.pst.dom) || null,
    domUpkeepRate, DOM_UPKEEP_FLAT, domUpkeepOf, foeDomUpkeepOf, domUpkeep,
    domTick, DOM_TICK, playerStatusTick,
    foeNearDeath
  };
})();
