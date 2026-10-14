/* 把游戏内置的数据装进内存，并建好索引。 */
(function () {
  'use strict';

  







  var CATS = [
    ['生得术式', 'array', 'JH_INNATE'],
    ['普通术式', 'array', 'JH_MARTIAL'],
    ['秘术',     'array', 'JH_MARTIAL'],
    ['装备',     'array', 'JH_ITEMS'],
    ['道具',     'array', 'JH_ITEMS'],
    ['咒具词条', 'array', 'JH_WORDS'],
    ['敌人',     'array', 'JH_FOES'],
    ['npc',      'array', 'JH_NPCS'],
    ['组织',     'sect',  null],
    ['剧情',     'array', 'JH_STORY'],
    ['隐藏剧情', 'array', 'JH_HIDDEN'],
    ['彩蛋',     'array', 'JH_EGGS'],
    ['术式机制', 'map',   'JH_MECH'],
    ['称号',     'map',   'JH_TITLES'],
    ['地图',     'world', null],
    ['试炼',     'trials',null],
    ['出身',     'array', 'JH_ORIGINS'],
    ['锻冶',     'forge', 'JH_FORGE']
  ];
  window.JH_BASE_CATS = CATS.map(function (c) { return { key: c[0], mode: c[1], dest: c[2] }; });

  var errors = window.JH_BASE_ERRORS || (window.JH_BASE_ERRORS = []);
  function noteErr(file, msg) {
    errors.push({ file: String(file || ''), msg: String(msg || '') });
    if (window.console && console.warn) console.warn('本体内容有问题：' + file + ' → ' + msg);
  }
  function isObj(e) { return !!e && typeof e === 'object' && !Array.isArray(e); }
  

  function clone(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; } }
  function assign(dest, src) {
    if (!isObj(dest) || !isObj(src)) return 0;
    var n = 0;
    for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) { dest[k] = src[k]; n++; }
    return n;
  }

   
  var ARR = ['JH_INNATE', 'JH_MARTIAL', 'JH_ITEMS', 'JH_WORDS', 'JH_FOES', 'JH_NPCS', 'JH_SECTS',
    'JH_STORY', 'JH_HIDDEN', 'JH_EGGS', 'JH_ORIGINS', 'JH_SCENES', 'JH_ROOMS', 'JH_TRIALS', 'JH_REGIONS'];
  for (var a = 0; a < ARR.length; a++) if (!Array.isArray(window[ARR[a]])) window[ARR[a]] = [];
  var OBJ = ['JH_MECH', 'JH_TITLES', 'JH_SECT_MEMBERS', 'JH_SECT_SPAR_NAMES', 'JH_FORGE'];
  for (var o = 0; o < OBJ.length; o++) if (!isObj(window[OBJ[o]])) window[OBJ[o]] = {};
  if (!Array.isArray(window.JH_TRIAL_GLYPH)) window.JH_TRIAL_GLYPH = [];

   
  function apply(cat, file, data) {
    var spec = null;
    for (var i = 0; i < CATS.length; i++) if (CATS[i][0] === cat) { spec = CATS[i]; break; }
    if (!spec) { noteErr(file, '文件夹「' + cat + '」不是已知的 base 分类'); return 0; }
    data = clone(data);
    var mode = spec[1], dest = spec[2], n = 0, j, k;
    if (mode === 'array') {
      var arr = Array.isArray(data) ? data : [data];
      for (j = 0; j < arr.length; j++) {
        if (!isObj(arr[j])) { noteErr(file, cat + ' 第 ' + (j + 1) + ' 条不是对象，已跳过'); continue; }
        window[dest].push(arr[j]); n++;
      }
    } else if (mode === 'map') {
      if (!isObj(data)) { noteErr(file, cat + ' 应当是一个对象表，已跳过'); return 0; }
      for (k in data) if (Object.prototype.hasOwnProperty.call(data, k)) {
        if (dest === 'JH_MECH' && !isObj(data[k])) { noteErr(file, cat + ' 的 ' + k + ' 不是对象，已跳过'); continue; }
        window[dest][k] = data[k]; n++;
      }
    } else if (mode === 'sect') {
      if (!isObj(data)) { noteErr(file, cat + ' 应当是一个对象，已跳过'); return 0; }
      if (Array.isArray(data.sects)) for (j = 0; j < data.sects.length; j++) {
        if (!isObj(data.sects[j])) { noteErr(file, 'sects 第 ' + (j + 1) + ' 条不是对象，已跳过'); continue; }
        window.JH_SECTS.push(data.sects[j]); n++;
      }
      assign(window.JH_SECT_MEMBERS, data.members);
      assign(window.JH_SECT_SPAR_NAMES, data.sparNames);
    } else if (mode === 'world') {
      if (!isObj(data)) { noteErr(file, cat + ' 应当是一个对象，已跳过'); return 0; }
      if (Array.isArray(data.scenes)) for (j = 0; j < data.scenes.length; j++) {
        if (!isObj(data.scenes[j])) { noteErr(file, 'scenes 第 ' + (j + 1) + ' 条不是对象，已跳过'); continue; }
        window.JH_SCENES.push(data.scenes[j]); n++;
      }
      if (Array.isArray(data.rooms)) for (j = 0; j < data.rooms.length; j++) {
        if (!isObj(data.rooms[j])) { noteErr(file, 'rooms 第 ' + (j + 1) + ' 条不是对象，已跳过'); continue; }
        window.JH_ROOMS.push(data.rooms[j]); n++;
      }
      if (Array.isArray(data.regions)) for (j = 0; j < data.regions.length; j++) {
        if (!isObj(data.regions[j])) { noteErr(file, 'regions 第 ' + (j + 1) + ' 条不是对象，已跳过'); continue; }
        window.JH_REGIONS.push(data.regions[j]); n++;
      }
    } else if (mode === 'trials') {
      if (!isObj(data)) { noteErr(file, cat + ' 应当是一个对象，已跳过'); return 0; }
      if (Array.isArray(data.trials)) for (j = 0; j < data.trials.length; j++) {
        if (!isObj(data.trials[j])) { noteErr(file, 'trials 第 ' + (j + 1) + ' 条不是对象，已跳过'); continue; }
        window.JH_TRIALS.push(data.trials[j]); n++;
      }
      if (Array.isArray(data.glyph)) window.JH_TRIAL_GLYPH = data.glyph.slice();
    } else if (mode === 'forge') {
      if (isObj(data)) n = assign(window.JH_FORGE, data);
    }
    return n;
  }

   
  function loadBrowser(list) {
    if (!Array.isArray(list)) return;
    for (var i = 0; i < list.length; i++) {
      var it = list[i]; if (!it) continue;
      if (it.error) { noteErr(it.file, 'JSON 读不了：' + it.error); continue; }
      apply(it.cat, it.file, it.data);
    }
  }
  function loadNode() {
    var fs = require('fs'), path = require('path'), vm = 0;
    var root = path.join(__dirname, '..', 'base'), dirs;
    window.JH_BASE_DIR = root;
    try { dirs = fs.readdirSync(root); } catch (e) { return; }
    dirs.sort();
    for (var i = 0; i < dirs.length; i++) {
      var dp = path.join(root, dirs[i]), files;
      try { if (!fs.statSync(dp).isDirectory()) continue; } catch (e) { continue; }
      try { files = fs.readdirSync(dp); } catch (e) { continue; }
      files.sort();
      for (var j = 0; j < files.length; j++) {
        var f = files[j];
        if (f.charAt(0) === '_' || !/\.json$/i.test(f)) continue;
        var p = path.join(dp, f), rel = 'base/' + dirs[i] + '/' + f, data;
        try { data = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); }
        catch (e2) { noteErr(rel, 'JSON 解析失败：' + (e2 && e2.message)); continue; }
        apply(dirs[i], rel, data);
      }
    }
  }
  if (Array.isArray(window.JH_BASE_DATA)) loadBrowser(window.JH_BASE_DATA);
  else if (typeof require === 'function') { try { loadNode(); } catch (e) {} }

   

   
  var HIDDEN_CODES = {
    o_sukuna: ['宿傩', '两面宿傩'],
    o_sixeyes: ['五条悟', '六眼'],
    o_heaven: ['天与咒缚', '咒缚'],
    o_tyrant: ['天与暴君', '暴君'],
    o_blackflash: ['黑闪', '黑闪王']
  };
  var j, k;
  for (j = 0; j < window.JH_ORIGINS.length; j++) {
    var ho = window.JH_ORIGINS[j];
    if (ho && HIDDEN_CODES[ho.id] && !ho.codes) ho.codes = HIDDEN_CODES[ho.id].slice();
  }

   
  window.JH_ORIGINS.push({
    id: 'o_operator', name: 'operator', tag: '调试', hidden: true, debug: true, codes: ['jddjcj', 'deepsleep'],
    slots: (window.JH_INNATE || []).length, ceCap: 1.00,
    growth: { insight: 1.00, root: 1.00, cur: 1.00, body: 1.00 },
    init: { curMax: 0, phyAtk: 0, curAtk: 0, def: 0, hp: 0, luck: 0, face: 0, ceEff: 0, ceCtl: 0, silver: 99999 },
    extra: { allSkills: true, freeShop: true, blackFlash: true },
    desc: '调试用出身。',
    flavor: '所有有上限的数值都可自己调（上限 100%）；初始商店材料免费；也能加黑闪点；可同时选择所有生得术式。不进图鉴/成就。'
  });

   
  if (typeof window.JH_FORGE.lvCost !== 'function') window.JH_FORGE.lvCost = function (lv) {
    return { silver: 120 + lv * 90, items: { mat_steel: 2 + Math.floor(lv / 2), mat_bone: 1 + Math.floor(lv / 3) } };
  };
  if (typeof window.JH_FORGE.clvCost !== 'function') window.JH_FORGE.clvCost = function (lv) {
    return { silver: 400 + lv * 260, items: { mat_gold: 1, mat_shard: 1 + Math.floor(lv / 2) } };
  };

   
  window.JH_TECH_LV = [0, 60, 170, 380, 750, 1400, 2600, 4750, 8500, 15000, 26000];    
   
  window.JH_BORROW_MAX = 16;
   
  window.JH_QUALITY_NAMES = ['', '凡', '常见', '良', '珍', '秘', '极', '极之番'];

   
  window.JH_findOriginByCode = function (raw) {
    var code = String(raw || '').trim().toLowerCase();
    if (!code) return null;
    for (var i = 0; i < window.JH_ORIGINS.length; i++) {
      var oo = window.JH_ORIGINS[i];
      if (!oo.hidden || !oo.codes) continue;
      for (var c = 0; c < oo.codes.length; c++) if (String(oo.codes[c]).toLowerCase() === code) return oo;
    }
    return null;
  };
   
  window.JH_WORD_NAME = function (id) { var w = window.JH_WORD_MAP[id]; return w ? w.name : id; };

  


  function rebuildRegions() {
    var regs = window.JH_REGIONS;
    if (!Array.isArray(regs)) regs = window.JH_REGIONS = [];
    if (!regs.length) regs.push({ id: 'rg_default', name: '大地图', glyph: '图', land: 'main', desc: '' });
    var rm = window.JH_REGION_MAP = {}, i, j;
    for (i = 0; i < regs.length; i++) if (isObj(regs[i]) && regs[i].id) rm[regs[i].id] = regs[i];
    var first = regs[0] && regs[0].id;
    var of = window.JH_REGION_OF = {}, byR = window.JH_REGION_SCENES = {};
    var scenes = Array.isArray(window.JH_SCENES) ? window.JH_SCENES : [];
    for (i = 0; i < scenes.length; i++) {
      var sc = scenes[i]; if (!isObj(sc) || !sc.id) continue;
      var rid = (sc.region && rm[sc.region]) ? sc.region : first;
      sc.region = rid; of[sc.id] = rid;
      (byR[rid] || (byR[rid] = [])).push(sc);
    }
    for (i = 0; i < regs.length; i++) if (isObj(regs[i]) && regs[i].id && !byR[regs[i].id]) byR[regs[i].id] = [];
  }
  window.JH_BASE_REBUILD_REGIONS = rebuildRegions;

   
  function rebuild() {
    var i;
    if (Array.isArray(window.JH_MARTIAL)) {
      var mm = window.JH_MARTIAL_MAP = {};
      for (i = 0; i < window.JH_MARTIAL.length; i++) mm[window.JH_MARTIAL[i].id] = window.JH_MARTIAL[i];
      window.JH_COMMON = window.JH_MARTIAL.filter(function (m) { return m.common && m.kind !== 'passive'; });
      window.JH_COMMON_ALL = window.JH_MARTIAL.filter(function (m) { return m.common; });
    }
    var paired = [['JH_INNATE', 'JH_INNATE_MAP'], ['JH_ITEMS', 'JH_ITEM_MAP'], ['JH_WORDS', 'JH_WORD_MAP'],
      ['JH_FOES', 'JH_FOE_MAP'], ['JH_NPCS', 'JH_NPC_MAP'], ['JH_ORIGINS', 'JH_ORIGIN_MAP'],
      ['JH_SCENES', 'JH_SCENE_MAP'], ['JH_ROOMS', 'JH_ROOM_MAP'], ['JH_TRIALS', 'JH_TRIAL_MAP'],
      ['JH_SECTS', 'JH_SECT_MAP']];
    rebuildRegions();
    for (i = 0; i < paired.length; i++) {
      var src = window[paired[i][0]];
      if (!Array.isArray(src)) continue;
      var mp = window[paired[i][1]] = {};
      for (var x = 0; x < src.length; x++) if (src[x] && src[x].id) mp[src[x].id] = src[x];
    }
  }
  window.JH_BASE_REBUILD = rebuild;
  window.JH_BASE_APPLY = apply;
  if (!window.JH_BASE_DIR) {
    window.JH_BASE_DIR = (typeof require === 'function')
      ? require('path').join(__dirname, '..', 'base') : 'app/base';
  }
  rebuild();
})();