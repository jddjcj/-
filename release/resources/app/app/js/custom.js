/* 读玩家放进自定义夹里的东西。 */
(function () {
  'use strict';

   
  var CATS = [
    ['生得术式', 'JH_INNATE'],
    ['出身',     'JH_ORIGINS'],
    ['秘术',     'JH_MARTIAL'],
    ['普通术式', 'JH_MARTIAL'],
    ['装备',     'JH_ITEMS'],
    ['道具',     'JH_ITEMS'],
    ['咒具词条', 'JH_WORDS'],
    ['敌人',     'JH_FOES'],
    ['npc',      'JH_NPCS'],
    ['组织',     'JH_SECTS'],
    ['剧情',     'JH_STORY'],
    ['地图',     null],
    ['称号',     null],
    ['现有文本', null],
    ['图片',     null],
    ['特效',     null],
    ['特效间隔', null]
  ];

   
  var CAT_DOC = {
    '生得术式': '天生的一系术式（可带领域）',
    '出身': '创建角色时可选的出身',
    '秘术': '有传授条件的秘传术式（与自定义 npc 联动）',
    '普通术式': '主动 / 内功 / 身法 / 被动技能',
    '装备': '兵器 / 护具 / 配饰 / 靴子（词条引用「咒具词条」）',
    '道具': '药品 / 食物 / 材料 / 书',
    '咒具词条': '咒具抽取的词条池（与「装备」联动）',
    '敌人': '场景里刷的敌手 / 头目',
    'npc': '世界里的活人（可教术、可派任务）',
    '组织': '势力、成员、组织特有术式',
    '剧情': '自己的剧情 / 支线（并进本体主线章节表）',
    '地图': '新场景 / 新房间 / 新的大地图（region；镜屋的写法就在「扩展地图」）',
    '称号': '称号（本体暂未接入，先登记）',
    '现有文本': '把本体已有的名称 / 说明换成自己的说法',
    '图片': '放图片素材；按 battle__ / actor__ / fx__ / map__ 命名即自动顶替打斗画面 / 人物建模 / 术式特效 / 舆图底板',
    '特效': '自己写的术式特效（代码 + 图片的组合；有它就不用本体的墨戏）',
    '特效间隔': '多图连播时每张图停留多久（每张之间隔多少毫秒）'
  };

   
  var NEED_ID = {
    JH_INNATE: 1, JH_ORIGINS: 1, JH_MARTIAL: 1, JH_ITEMS: 1, JH_WORDS: 1,
    JH_FOES: 1, JH_NPCS: 1, JH_SECTS: 1, JH_STORY: 1
  };

  var C = window.JH_CUSTOM;
  if (!C || typeof C !== 'object') C = window.JH_CUSTOM = {};
  var CAT_KEY = {};
  for (var i = 0; i < CATS.length; i++) { if (!C[CATS[i][0]]) C[CATS[i][0]] = []; CAT_KEY[CATS[i][0]] = 1; }

  var loaded = [];
  var errors = [];
  var SRC = new WeakMap();                
  var MERGED = new WeakSet();             

  window.JH_CUSTOM_CATS = CATS.map(function (c) { return { key: c[0], dest: c[1], doc: CAT_DOC[c[0]] || '' }; });
  window.JH_CUSTOM_ERRORS = errors;

  function noteErr(file, msg) {
    errors.push({ file: String(file || ''), msg: String(msg || '') });
    if (window.console && console.warn) console.warn('自定义内容有问题：' + file + ' → ' + msg);
  }
   
  function clone(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e2) { return v; } }
   
  function normCat(k) {
    k = String(k == null ? '' : k).trim();
    if (CAT_KEY[k]) return k;
    var s = k.replace(/^自定义/, '');
    if (CAT_KEY[s]) return s;
    if (k === '扩展地图' || s === '扩展地图') return '地图';
    return k;
  }
  function put(catKey, file, idx, e) {
    catKey = normCat(catKey);
    if (!CAT_KEY[catKey]) { noteErr(file, '文件夹「' + catKey + '」不是已知的自定义分类'); return; }
    if (!e || typeof e !== 'object' || Array.isArray(e)) { noteErr(file, catKey + ' 第 ' + idx + ' 条不是对象，已跳过'); return; }
    var copy = clone(e);
    if (file) { try { SRC.set(copy, file); } catch (e2) {} }
    C[catKey].push(copy);
  }
   
  function putJson(cat, file, data) {
    var arr = Array.isArray(data) ? data : [data];
    for (var j = 0; j < arr.length; j++) put(cat, file, j + 1, arr[j]);
    loaded.push(file);
  }

   
  function loadBrowser(list) {
    var tags = [];
    for (var i = 0; i < list.length; i++) {
      var p = String(list[i] || '');
      if (!/^custom\/.+\.js$/i.test(p)) continue;       
      tags.push('<scr' + 'ipt src="' + encodeURI(p) + '"></scr' + 'ipt>');
      loaded.push(p);
    }
    if (tags.length) document.write(tags.join(''));
  }
   
  function loadJsonList(list) {
    if (!Array.isArray(list)) return 0;
    var before = loaded.length;
    for (var i = 0; i < list.length; i++) {
      var it = list[i]; if (!it) continue;
      if (it.error) { noteErr(it.file, 'JSON 读不了：' + it.error); continue; }
      putJson(it.cat, it.file, it.data);
    }
    return loaded.length - before;
  }

   
  function loadNode() {
    var fs = require('fs'), path = require('path'), vm = require('vm');
    var root = path.join(__dirname, '..', 'custom'), dirs;
    setGlobal('JH_CUSTOM_DIR', root);
    try { dirs = fs.readdirSync(root); } catch (e) { return; }
    dirs.sort();
    for (var i = 0; i < dirs.length; i++) {
      var dp = path.join(root, dirs[i]), files;
      try { if (!fs.statSync(dp).isDirectory()) continue; } catch (e) { continue; }
      try { files = fs.readdirSync(dp); } catch (e) { continue; }
      files.sort();
      for (var j = 0; j < files.length; j++) {
        var f = files[j];
        if (f.charAt(0) === '_') continue;                  
        var p = path.join(dp, f), rel = 'custom/' + dirs[i] + '/' + f;
        if (/\.json$/i.test(f)) {
          var txt;
          try { txt = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''); }
          catch (e2) { noteErr(rel, '读文件失败：' + (e2 && e2.message)); continue; }
          var data;
          try { data = JSON.parse(txt); }
          catch (e3) { noteErr(rel, 'JSON 解析失败：' + (e3 && e3.message)); continue; }
          putJson(dirs[i], rel, data);
          continue;
        }
        if (!/\.js$/i.test(f)) continue;
        try {
          vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
          loaded.push(rel);
        } catch (e2) { noteErr(rel, (e2 && e2.message) || e2); }
      }
    }
  }

   
  if (typeof document !== 'undefined' && document && typeof document.write === 'function') {
    if (Array.isArray(window.JH_CUSTOM_FILES)) loadBrowser(window.JH_CUSTOM_FILES);
    loadJsonList(window.JH_CUSTOM_DATA);
  } else if (typeof require === 'function') {
    try { loadNode(); } catch (e) {}
  }

   
  var IMG_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
  var IMG_DIR_NAME = '\u81ea\u5b9a\u4e49\u56fe\u7247';
  function listImages() {
    var fs = require('fs'), path = require('path'), out = [];
    var dir = path.join(__dirname, '..', 'custom', IMG_DIR_NAME);
    var files; try { files = fs.readdirSync(dir); } catch (e) { return out; }
    files.sort();
    for (var i = 0; i < files.length; i++) if (IMG_RE.test(files[i])) out.push('custom/' + IMG_DIR_NAME + '/' + files[i]);
    return out;
  }

   
  var MEDIA_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif|mp4|webm|ogv|ogg|m4v|mov)$/i;
  var MEDIA_DIR_NAME = '\u81ea\u5b9a\u4e49\u89c1\u95fb';
  function listMedia() {
    var fs = require('fs'), path = require('path'), out = [];
    var dir = path.join(__dirname, '..', 'custom', MEDIA_DIR_NAME);
    var files; try { files = fs.readdirSync(dir); } catch (e) { return out; }
    files.sort();
    for (var i = 0; i < files.length; i++) if (MEDIA_RE.test(files[i])) out.push('custom/' + MEDIA_DIR_NAME + '/' + files[i]);
    return out;
  }

  

  var TEXT_FIELDS = ['name', 'desc', 'note', 'title', 'daily', 'master'];
  function applyTextOverrides() {
    var tov = (C['现有文本'] || []).filter(function (o) { return o && typeof o.from === 'string' && o.from && o.from !== o.to; });
    if (!tov.length) return;
    var tables = ['JH_ITEMS', 'JH_MARTIAL', 'JH_INNATE', 'JH_NPCS', 'JH_ROOMS', 'JH_SCENES',
      'JH_ORIGINS', 'JH_FOES', 'JH_SECTS', 'JH_WORDS', 'JH_TRIALS', 'JH_STORY', 'JH_HIDDEN'];
    function rep(v) { for (var t = 0; t < tov.length; t++) v = v.split(tov[t].from).join(tov[t].to || ''); return v; }
    for (var ti = 0; ti < tables.length; ti++) {
      var arr = window[tables[ti]];
      if (!Array.isArray(arr)) continue;
      for (var ai = 0; ai < arr.length; ai++) {
        var o = arr[ai];
        if (!o || typeof o !== 'object') continue;
        for (var fi = 0; fi < TEXT_FIELDS.length; fi++) {
          if (typeof o[TEXT_FIELDS[fi]] === 'string') o[TEXT_FIELDS[fi]] = rep(o[TEXT_FIELDS[fi]]);
        }
      }
    }
  }

   
  function merge() {
    var i, j;
    for (i = 0; i < CATS.length; i++) {
      var key = CATS[i][0], dest = CATS[i][1];
      if (!dest) continue;                                 
      var target = window[dest], arr = C[key] || [];
      if (!Array.isArray(target)) continue;
      for (j = 0; j < arr.length; j++) {
        var e = arr[j], from = (SRC.get && SRC.get(e)) || ('JH_CUSTOM.' + key);
        if (!e || typeof e !== 'object' || Array.isArray(e)) { noteErr(from, key + ' 第 ' + (j + 1) + ' 条不是对象，已跳过'); continue; }
        if (MERGED.has(e)) continue;                        
        if (NEED_ID[dest] && !e.id) { if (!MERGED.has(e)) { MERGED.add(e); noteErr(from, key + ' 第 ' + (j + 1) + ' 条缺 id，已跳过'); } continue; }
        MERGED.add(e);
        target.push(e);
      }
    }
    

    var map = C['地图'] || [];
    for (i = 0; i < map.length; i++) {
      var me = map[i];
      var mfrom = (SRC.get && SRC.get(me)) || 'JH_CUSTOM.地图';
      if (!me || typeof me !== 'object') { noteErr(mfrom, '第 ' + (i + 1) + ' 条不是对象，已跳过'); continue; }
      var mapOne = function (obj, dest, label) {
        if (!obj || typeof obj !== 'object') { noteErr(mfrom, label + ' 不是对象，已跳过'); return; }
        if (!obj.id) { noteErr(mfrom, label + ' 缺 id，已跳过'); return; }
        if (MERGED.has(obj)) return;                        
        MERGED.add(obj);
        if (window[dest]) window[dest].push(obj);
      };
      if (me.scene) mapOne(me.scene, 'JH_SCENES', 'scene');
      if (me.room) mapOne(me.room, 'JH_ROOMS', 'room');
      if (me.region) mapOne(me.region, 'JH_REGIONS', 'region');
      if (Array.isArray(me.scenes)) for (j = 0; j < me.scenes.length; j++) mapOne(me.scenes[j], 'JH_SCENES', 'scenes 第 ' + (j + 1) + ' 项');
      if (Array.isArray(me.rooms)) for (j = 0; j < me.rooms.length; j++) mapOne(me.rooms[j], 'JH_ROOMS', 'rooms 第 ' + (j + 1) + ' 项');
      if (Array.isArray(me.regions)) for (j = 0; j < me.regions.length; j++) mapOne(me.regions[j], 'JH_REGIONS', 'regions 第 ' + (j + 1) + ' 项');
    }
    rebuild();
  }

  function rebuild() {
    var i, k;
     
    if (Array.isArray(window.JH_MARTIAL)) {
      var mm = window.JH_MARTIAL_MAP = {};
      for (i = 0; i < window.JH_MARTIAL.length; i++) mm[window.JH_MARTIAL[i].id] = window.JH_MARTIAL[i];
      window.JH_COMMON = window.JH_MARTIAL.filter(function (m) { return m.common && m.kind !== 'passive'; });
      window.JH_COMMON_ALL = window.JH_MARTIAL.filter(function (m) { return m.common; });
    }
    if (Array.isArray(window.JH_INNATE)) {
      var im = window.JH_INNATE_MAP = {};
      for (i = 0; i < window.JH_INNATE.length; i++) im[window.JH_INNATE[i].id] = window.JH_INNATE[i];
    }
    if (Array.isArray(window.JH_ITEMS)) {
      var tm = window.JH_ITEM_MAP = {};
      for (i = 0; i < window.JH_ITEMS.length; i++) tm[window.JH_ITEMS[i].id] = window.JH_ITEMS[i];
    }
    if (Array.isArray(window.JH_WORDS)) {
      var wm = window.JH_WORD_MAP = {};
      for (i = 0; i < window.JH_WORDS.length; i++) wm[window.JH_WORDS[i].id] = window.JH_WORDS[i];
    }
    if (Array.isArray(window.JH_FOES)) {
      var fm = window.JH_FOE_MAP = {};
      for (i = 0; i < window.JH_FOES.length; i++) fm[window.JH_FOES[i].id] = window.JH_FOES[i];
    }
    if (Array.isArray(window.JH_NPCS)) {
      var nm = window.JH_NPC_MAP = {};
      for (i = 0; i < window.JH_NPCS.length; i++) nm[window.JH_NPCS[i].id] = window.JH_NPCS[i];
    }
    if (Array.isArray(window.JH_ORIGINS)) {
      var om = window.JH_ORIGIN_MAP = {};
      for (i = 0; i < window.JH_ORIGINS.length; i++) om[window.JH_ORIGINS[i].id] = window.JH_ORIGINS[i];
    }
    if (Array.isArray(window.JH_SCENES)) {
      var sm = window.JH_SCENE_MAP = {};
      for (i = 0; i < window.JH_SCENES.length; i++) sm[window.JH_SCENES[i].id] = window.JH_SCENES[i];
    }
    if (Array.isArray(window.JH_ROOMS)) {
      var rm = window.JH_ROOM_MAP = {};
      for (i = 0; i < window.JH_ROOMS.length; i++) rm[window.JH_ROOMS[i].id] = window.JH_ROOMS[i];
    }
    if (Array.isArray(window.JH_TRIALS)) {
      var trm = window.JH_TRIAL_MAP = {};
      for (i = 0; i < window.JH_TRIALS.length; i++) trm[window.JH_TRIALS[i].id] = window.JH_TRIALS[i];
    }
    if (Array.isArray(window.JH_SECTS)) {
      var cm = window.JH_SECT_MAP = {};
      for (i = 0; i < window.JH_SECTS.length; i++) cm[window.JH_SECTS[i].id] = window.JH_SECTS[i];
    }
     
    if (typeof window.JH_BASE_REBUILD_REGIONS === 'function') window.JH_BASE_REBUILD_REGIONS();

     
    var members = window.JH_SECT_MEMBERS || (window.JH_SECT_MEMBERS = {});
    var commonAll = Array.isArray(window.JH_COMMON_ALL) ? window.JH_COMMON_ALL : [];
    var sects = C['组织'] || [];
    for (k = 0; k < sects.length; k++) {
      var sec = sects[k];
      if (!sec || !sec.id) continue;
      if (Array.isArray(sec.members) && sec.members.length) members[sec.id] = sec.members.slice();
      if (sec.allCommon === false) continue;
      if (!Array.isArray(sec.shop)) sec.shop = [];
      var have = {};
      for (i = 0; i < sec.shop.length; i++) have[sec.shop[i][0]] = 1;
      for (i = 0; i < commonAll.length; i++) {
        if (!have[commonAll[i].id]) { sec.shop.push([commonAll[i].id, 120]); have[commonAll[i].id] = 1; }
      }
    }
    applyTextOverrides();
  }

  


  function setGlobal(k, v) {
    if (window[k] !== undefined && window[k] !== null) return window[k];
    try { window[k] = v; } catch (e) {}
    if (window[k] === undefined) {
      try { Object.defineProperty(window, k, { value: v, writable: true, configurable: true }); } catch (e2) {}
    }
    return window[k];
  }
  window.JH_SET_GLOBAL = setGlobal;

  

  window.JH_CUSTOM_MERGE = function () {
    if (window.__JH_CUSTOM_MERGED) return;
    window.__JH_CUSTOM_MERGED = true;
    merge();
  };
   
  window.JH_CUSTOM_LOAD_JSON = loadJsonList;
   
  window.JH_CUSTOM_TEXT_RUN = applyTextOverrides;
  setGlobal('JH_IMG', function (name) { return 'custom/' + IMG_DIR_NAME + '/' + name; });
  setGlobal('JH_CUSTOM_DIR', typeof require === 'function'
    ? require('path').join(__dirname, '..', 'custom') : 'app/custom');
  setGlobal('JH_CUSTOM_LOADED', loaded);
  if (!Array.isArray(window.JH_CUSTOM_IMAGES)) {
    var imgs = [];
    if (typeof require === 'function') { try { imgs = listImages(); } catch (e) {} }
    setGlobal('JH_CUSTOM_IMAGES', imgs);
  }
   
  if (!Array.isArray(window.JH_CUSTOM_MEDIA)) {
    var med = [];
    if (typeof require === 'function') { try { med = listMedia(); } catch (e) {} }
    setGlobal('JH_CUSTOM_MEDIA', med);
  }
  setGlobal('JH_MEDIA', function (name) { return 'custom/' + MEDIA_DIR_NAME + '/' + name; });
   
  if (window.JH_IMGC && window.JH_IMGC.rescan) window.JH_IMGC.rescan();
})();