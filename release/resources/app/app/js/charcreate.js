/* 创建角色的步骤与规则。 */
(function () {
  'use strict';

  const TALENT_MIN = 40, TALENT_CAP = 100, TALENT_SUM_MIN = 100, TALENT_SUM_MAX = 140;
  const LUCK_CAP = 100, LUCK_SUM_MAX = 60, LUCK_MIN = 5;
  const SKILL_POINTS = 3, SKILL_MAX_LV = 3;
  const BASE_CE_EFF = 0.30, BASE_CE_CTL = 0.30;
  


  const CE_PTS = 70, CE_PT_VALUE = 0.01;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function newDraft(name) {
    return {
      name: (name || '无名咒术师').slice(0, 12),
      originId: null,
      hiddenUnlocked: [],
      insight: 50, root: 50,      
      talentPool: 60,
      luck: 30, face: 30,         
      luckPool: 60,
      techs: [],
      common: {},                 
      cePts: { eff: 0, ctl: 0 },   
      cePool: CE_PTS,
      skillPoints: SKILL_POINTS
    };
  }

  function originOf(draft) {
    return draft.originId ? window.JH_ORIGIN_MAP[draft.originId] : null;
  }
  function visibleOrigins(draft) {
    return window.JH_ORIGINS.filter(o => !o.hidden || draft.hiddenUnlocked.indexOf(o.id) >= 0);
  }
  function unlockByCode(draft, code) {
    const o = window.JH_findOriginByCode(code);
    if (!o) return null;
    if (draft.hiddenUnlocked.indexOf(o.id) < 0) draft.hiddenUnlocked.push(o.id);
    draft.originId = o.id;
    draft.techs = draft.techs.slice(0, o.slots);
    return o;
  }
  function pickOrigin(draft, id) {
    const o = window.JH_ORIGIN_MAP[id];
    if (!o) return false;
    if (o.hidden && draft.hiddenUnlocked.indexOf(id) < 0) return false;
    draft.originId = id;
    draft.techs = draft.techs.slice(0, o.slots);
    const fc = o.faceCap != null ? o.faceCap : LUCK_CAP;
    draft.face = clamp(draft.face, 0, fc);
     
    if (!draft.cePts) draft.cePts = { eff: 0, ctl: 0 };
    

    for (const k of ['eff', 'ctl']) draft.cePts[k] = Math.max(0, Math.min(draft.cePts[k] || 0, ceCapPts(draft, k)));
    if (draft.ceGift) delete draft.ceGift;    
    return true;
  }

  function talentSpent(draft) { return (draft.insight - 40) + (draft.root - 40); }
  function luckSpent(draft) { return draft.luck + draft.face; }

   
  function adjTalent(draft, key, delta) {
    if (key !== 'insight' && key !== 'root') return false;
    const next = draft[key] + delta;
    if (next < TALENT_MIN || next > TALENT_CAP) return false;
    const spent = talentSpent(draft) + delta;
    if (spent < 0 || spent > draft.talentPool) return false;
    draft[key] = next;
    return true;
  }
  function adjLuck(draft, key, delta) {
    if (key !== 'luck' && key !== 'face') return false;
    const o = originOf(draft);
    const cap = key === 'face' && o && o.faceCap != null ? o.faceCap : LUCK_CAP;
    const next = draft[key] + delta;
    if (next < 0 || next > cap) return false;
    if (luckSpent(draft) + delta > draft.luckPool) return false;
    draft[key] = next;
    return true;
  }

   
  function ceBaseOf(draft, key) {
    const o = originOf(draft);
    if (!o) return key === 'eff' ? BASE_CE_EFF : BASE_CE_CTL;
    const i = o.init || {};
    return (key === 'eff' ? BASE_CE_EFF + (i.ceEff || 0) : BASE_CE_CTL + (i.ceCtl || 0));
  }
   
  function ceCapPts(draft, key) {
    const o = originOf(draft);
    const cap = o ? o.ceCap : 0.8;
    return Math.max(0, Math.floor((cap - ceBaseOf(draft, key)) / CE_PT_VALUE + 1e-9));
  }
  function cePtsUsed(draft) {
    const p = (draft && draft.cePts) || { eff: 0, ctl: 0 };
    return (p.eff || 0) + (p.ctl || 0);
  }
  function adjCe(draft, key, delta) {
    if (key !== 'eff' && key !== 'ctl') return false;
    if (!originOf(draft)) return false;
    if (!draft.cePts) draft.cePts = { eff: 0, ctl: 0 };
    const next = (draft.cePts[key] || 0) + delta;
    if (next < 0 || next > ceCapPts(draft, key)) return false;
    if (cePtsUsed(draft) + delta > (draft.cePool || CE_PTS)) return false;
    draft.cePts[key] = next;
    return true;
  }

  function toggleTech(draft, id) {
    const o = originOf(draft);
    if (!o) return false;
    const t = window.JH_INNATE_MAP[id];
    if (!t) return false;
    const i = draft.techs.indexOf(id);
    if (i >= 0) { draft.techs.splice(i, 1); return true; }
    if (draft.techs.length >= o.slots) {
      if (o.slots === 1) draft.techs = [id];
      else return false;
    } else draft.techs.push(id);
    return true;
  }

   
  function blackFlashAllowed(draft) {
    const o = originOf(draft);
    return !!(o && o.extra && o.extra.blackFlash);
  }
  function allowedCommon(draft) {
    

    const list = window.JH_COMMON.filter(m => m.id !== 'k_black' && m.id !== 'k_barrier');
     
    if (blackFlashAllowed(draft) && window.JH_MARTIAL_MAP.k_black) list.push(window.JH_MARTIAL_MAP.k_black);
    return list;
  }
   
  function pointsCap(draft) {
    const p = Math.floor(+((draft && draft.points) != null ? draft.points : SKILL_POINTS));
    return (isFinite(p) && p > 0) ? p : SKILL_POINTS;
  }
  function spendPoint(draft, skillId, delta) {
    const m = window.JH_MARTIAL_MAP[skillId];
    if (!m || !m.common) return false;
    if (skillId === 'k_barrier') return false;       
    if (skillId === 'k_black' && !blackFlashAllowed(draft)) return false;
    const cur = draft.common[skillId] || 0;
    const next = cur + delta;
    if (next < 0 || next > SKILL_MAX_LV) return false;
    const used = Object.keys(draft.common).reduce((a, k) => a + draft.common[k], 0);
    if (used + delta > pointsCap(draft)) return false;
    if (next === 0) delete draft.common[skillId]; else draft.common[skillId] = next;
    return true;
  }
  function pointsUsed(draft) {
    return Object.keys(draft.common).reduce((a, k) => a + draft.common[k], 0);
  }

  function validate(draft) {
    const errs = [];
    const o = originOf(draft);
    if (!o) errs.push('请先选择出身。');
    if (talentSpent(draft) < TALENT_SUM_MIN - 80) errs.push('悟性与根骨之和至少要 ' + TALENT_SUM_MIN + '。');
    if (draft.insight < TALENT_MIN || draft.root < TALENT_MIN) errs.push('悟性与根骨单项不得低于 ' + TALENT_MIN + '。');
    if (draft.luck < LUCK_MIN || draft.face < LUCK_MIN) errs.push('福缘与颜值单项不得低于 ' + LUCK_MIN + '。');
    if (luckSpent(draft) > LUCK_SUM_MAX) errs.push('福缘与颜值之和不得超过 ' + LUCK_SUM_MAX + '。');
    if (draft.techs.length !== (o ? o.slots : 0)) errs.push('请选择 ' + (o ? o.slots : 1) + ' 门生得术式。');
    if (pointsUsed(draft) > pointsCap(draft)) errs.push('技能点不足。');
    return { ok: errs.length === 0, errors: errs };
  }

   
  function finalize(draft) {
    const o = originOf(draft);
    const pts = draft.cePts || { eff: 0, ctl: 0 };
    const eff = clamp(BASE_CE_EFF + (o.init.ceEff || 0) + (pts.eff || 0) * CE_PT_VALUE, 0.20, o.ceCap);
    const ctl = clamp(BASE_CE_CTL + (o.init.ceCtl || 0) + (pts.ctl || 0) * CE_PT_VALUE, 0.20, o.ceCap);
    return {
      origin: o.id,
      attrs: { insight: draft.insight, root: draft.root, luck: draft.luck, face: draft.face },
      ce: { eff: eff, ctl: ctl, cap: o.ceCap },
      cePts: { eff: pts.eff || 0, ctl: pts.ctl || 0 },
      innate: draft.techs.slice(),
      common: Object.assign({}, draft.common),
      faceCap: o.faceCap != null ? o.faceCap : LUCK_CAP
    };
  }

  window.JH_create = {
    TALENT_MIN, TALENT_CAP, TALENT_SUM_MIN, TALENT_SUM_MAX, LUCK_CAP, LUCK_SUM_MAX, LUCK_MIN,
    SKILL_POINTS, SKILL_MAX_LV, BASE_CE_EFF, BASE_CE_CTL, pointsCap,
    CE_PTS, CE_PT_VALUE, cePtsUsed, ceCapPts, ceBaseOf, adjCe,
    newDraft, originOf, visibleOrigins, unlockByCode, pickOrigin,
    adjTalent, adjLuck, toggleTech, spendPoint, pointsUsed, talentSpent, luckSpent, validate, finalize,
    blackFlashAllowed, allowedCommon
  };
})();
