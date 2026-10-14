/* 自定义图片的装载与替换（打斗画面 / 人物 / 特效 / 大地图）。 */
(function () {
  'use strict';
  var DIR = 'custom/自定义图片/';
  var KINDS = ['battle', 'actor', 'fx', 'map'];
  var REG = {};       
  var AUTO = {};      
  var scanned = false;

  function norm(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
  function extOk(p) { return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(p); }
  function strip(p) { return String(p || '').replace(/\.(png|jpe?g|gif|webp|bmp|svg)$/i, ''); }
  function baseName(p) { var s = String(p || ''), i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\')); return i >= 0 ? s.slice(i + 1) : s; }
  function list() { return Array.isArray(window.JH_CUSTOM_IMAGES) ? window.JH_CUSTOM_IMAGES : []; }
  function pathOf(file) {
    var f = String(file == null ? '' : file).trim();
    if (!f) return '';
    if (f.indexOf('/') >= 0 || f.indexOf('\\') >= 0) return f.replace(/\\/g, '/');
    return DIR + f;
  }
  function scan() {
    scanned = true; AUTO = {};
    var imgs = list(), i, m, p;
    for (i = 0; i < imgs.length; i++) {
      p = imgs[i]; if (!extOk(p)) continue;
      m = /^(battle|actor|fx|map)__(.+)$/i.exec(strip(baseName(p)));
      if (!m) continue;
      var key = m[1].toLowerCase() + ':' + norm(m[2]);
      if (!AUTO[key]) AUTO[key] = p;       
    }
  }
  function ensure() { if (!scanned) scan(); }
  function pick(kind, slots) {
    ensure();
    kind = norm(kind);
    if (KINDS.indexOf(kind) < 0) return '';
    if (!Array.isArray(slots)) slots = [slots];
    var cand = [], i, s;
    for (i = 0; i < slots.length; i++) { s = norm(slots[i]); if (s && cand.indexOf(s) < 0) cand.push(s); }
    if (cand.indexOf('default') < 0) cand.push('default');
    for (i = 0; i < cand.length; i++) if (REG[kind + ':' + cand[i]]) return REG[kind + ':' + cand[i]];
    for (i = 0; i < cand.length; i++) if (AUTO[kind + ':' + cand[i]]) return AUTO[kind + ':' + cand[i]];
    return '';
  }

   
  window.JH_IMGC_battle = function (sceneId, foeId) {
    return pick('battle', [sceneId ? 'scene.' + sceneId : '', foeId ? 'foe.' + foeId : '']);
  };
  window.JH_IMGC_actor = function (side, id) {
    var cand = [];
    if (id) cand.push(String(id));
    cand.push(side === 'foe' ? 'foe' : 'hero');
    return pick('actor', cand);
  };
  window.JH_IMGC_fx = function (kind, skillId, innateId, domKind) {
    var cand = [];
    if (skillId) { cand.push('skill.' + skillId); cand.push(String(skillId)); }    
    if (innateId) cand.push(String(innateId));
    if (domKind) cand.push('domain.' + domKind);
    if (kind === 'domain') cand.push('domain');
    if (kind) cand.push(String(kind));
    return pick('fx', cand);
  };
  



  window.JH_IMGC_SEQ_MS = 450;
   
  window.JH_FXSEQ = window.JH_FXSEQ || [];
  






  function seqCfgList() {
    var out = [], arr = (window.JH_CUSTOM && window.JH_CUSTOM['特效间隔']) || [];
    if (Array.isArray(arr)) out = out.concat(arr);
    var g = window.JH_FXSEQ;
    if (Array.isArray(g)) out = out.concat(g);
    else if (g && typeof g === 'object') out.push(g);
    var keep = [], i;
    for (i = 0; i < out.length; i++) if (out[i] && typeof out[i] === 'object') keep.push(out[i]);
    return keep;
  }
  function seqMsFor(ctx, idx, total) {
    var list = seqCfgList(), best = null, bestSc = -1, dflt = null, i, rec, mm, sc;
    for (i = 0; i < list.length; i++) {
      rec = list[i];
      mm = (rec.match && typeof rec.match === 'object') ? rec.match : null;
      if (!mm) { if (!dflt) dflt = rec; continue; }
      if (!fxHit(mm, ctx)) continue;
      sc = (mm.skill || mm.id ? 4 : 0) + (mm.innate ? 3 : 0) + (mm.dom ? 2 : 0) + (mm.kind ? 1 : 0);
      if (sc > bestSc) { bestSc = sc; best = rec; }
    }
    var use = best || dflt;
    var base = Math.max(80, Number(window.JH_IMGC_SEQ_MS) || 450);
    if (!use) return base;
    if (Array.isArray(use.frames) && use.frames.length) {
      var fv = Number(use.frames[Math.min(idx, use.frames.length - 1)]);
      if (isFinite(fv) && fv > 0) return Math.max(40, fv);
    }
    if (idx === 0) { var a = Number(use.first); if (isFinite(a) && a > 0) return Math.max(40, a); }
    if (idx === total - 1) { var b = Number(use.last); if (isFinite(b) && b > 0) return Math.max(40, b); }
    var ms = Number(use.ms != null ? use.ms : use.default);
    return (isFinite(ms) && ms > 0) ? Math.max(40, ms) : base;
  }
  function seqOf(kind, cands) {
    ensure();
    kind = norm(kind);
    if (KINDS.indexOf(kind) < 0) return null;
    var store = [REG, AUTO], ci, si, k, base, rest, n, frames, map;
    for (ci = 0; ci < cands.length; ci++) {
      base = norm(cands[ci]); if (!base) continue;
      for (si = 0; si < store.length; si++) {
        map = store[si]; frames = [];
        for (k in map) {
          if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
          if (k.indexOf(kind + ':') !== 0) continue;
          rest = k.slice(kind.length + 1);
          if (rest.indexOf(base + '.') !== 0) continue;
          n = parseInt(rest.slice(base.length + 1), 10);
          if (!(n >= 1)) continue;
          frames.push({ n: n, p: map[k] });
        }
        if (frames.length) {
          frames.sort(function (a, b) { return a.n - b.n; });
          return frames.map(function (f) { return f.p; });
        }
      }
    }
    return null;
  }
  window.JH_IMGC_fxSeq = function (kind, skillId, innateId, domKind) {
    var cands = [];
    if (skillId) { cands.push('skill.' + skillId); cands.push(String(skillId)); }
    if (innateId) cands.push(String(innateId));
    if (domKind) cands.push('domain.' + domKind);
    if (kind === 'domain') cands.push('domain');
    if (kind) cands.push(String(kind));
    var p = seqOf('fx', cands);
    if (!p) return null;
    var ctx = { kind: String(kind || ''), skill: String(skillId || ''), innate: String(innateId || ''), domKind: String(domKind || '') };
    return p.map(function (x, i) { return { p: x, ms: seqMsFor(ctx, i, p.length) }; });
  };
  window.JH_IMGC_map = function (regionId, land) {
    return pick('map', [regionId ? String(regionId) : '', land ? String(land) : '']);
  };
   
  function pickExact(kind, slots) {
    ensure();
    kind = norm(kind);
    if (KINDS.indexOf(kind) < 0) return '';
    for (var i = 0; i < slots.length; i++) {
      var s = norm(slots[i]); if (!s) continue;
      if (REG[kind + ':' + s]) return REG[kind + ':' + s];
      if (AUTO[kind + ':' + s]) return AUTO[kind + ':' + s];
    }
    return '';
  }
  





  window.JH_IMGC_domBg = function (side, domKind) {
    var sl = [];
    if (domKind) sl.push('dom.' + domKind);
    sl.push('dom.' + (norm(side) === 'foe' ? 'foe' : 'hero'));
    sl.push('dom');
    var p = pickExact('battle', sl);
    if (p) return p;
    return pickExact('fx', [domKind ? 'domain.' + domKind : '', 'domain']);
  };

  





  var CUT = {};         
  var CUTTING = {};
  window.JH_IMGC_cutApplies = function (kind) { return kind === 'actor' || kind === 'fx'; };
  




  function cutInRenderer(path, done) {
    if (!window.JH_API || !window.JH_API.imageBytes || !window.JH_IMGCUT) { done(''); return; }
    window.JH_API.imageBytes(path).then(function (r) {
      if (!r || !r.ok || !r.dataUrl) { done(''); return; }
      if (r.animated) { done(''); return; }               
      var im = new Image();
      im.onload = function () {
        try {
          var w = im.naturalWidth, h = im.naturalHeight;
          if (!w || !h) { done(''); return; }
          var k = Math.min(1, 2048 / Math.max(w, h));       
          var cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
          var cx = cv.getContext('2d');
          if (!cx) { done(''); return; }
          cx.clearRect(0, 0, cv.width, cv.height);
          cx.drawImage(im, 0, 0, cv.width, cv.height);
          var dat = cx.getImageData(0, 0, cv.width, cv.height);
          var res = window.JH_IMGCUT.cutBitmap(dat.data, cv.width, cv.height);
          if (!res.cut) { done(''); return; }               
          cx.putImageData(dat, 0, 0);
          done(cv.toDataURL('image/png'));
        } catch (e) { done(''); }
      };
      im.onerror = function () { done(''); };
      im.src = r.dataUrl;
    })['catch'](function () { done(''); });
  }

  















  function fxEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fxList() { return (window.JH_CUSTOM && window.JH_CUSTOM['特效']) || []; }
  function fxHit(mm, ctx) {
    if (mm.skill && String(mm.skill) !== ctx.skill) return false;
    if (mm.innate && String(mm.innate) !== ctx.innate) return false;
    if (mm.dom && String(mm.dom) !== ctx.domKind) return false;
    if (mm.kind && String(mm.kind) !== ctx.kind) return false;
    if (mm.id && String(mm.id) !== ctx.skill && String(mm.id) !== ctx.innate) return false;
    return true;
  }
  window.JH_FXC_of = function (kind, m) {
    m = m || {};
    var ctx = { kind: String(kind || ''), skill: String(m.skill || ''), innate: String(m.innate || ''), domKind: String(m.domKind || '') };
    var list = fxList(), best = null, bestSc = -1;
    for (var i = 0; i < list.length; i++) {
      var rec = list[i]; if (!rec || typeof rec !== 'object') continue;
      var mm = (rec.match && typeof rec.match === 'object') ? rec.match : rec;
      if (!fxHit(mm, ctx)) continue;
      var sc = (mm.skill || mm.id ? 4 : 0) + (mm.innate ? 3 : 0) + (mm.dom ? 2 : 0) + (mm.kind ? 1 : 0);
      if (sc > bestSc) { bestSc = sc; best = rec; }
    }
    return best;
  };
  window.JH_FXC_html = function (rec, ctx) {
    if (!rec || typeof rec !== 'object') return '';
    ctx = ctx || {};
    var h = '<div class="fxcust" style="--fxc-delay:' + (Number(ctx.delay) || 0) + 'ms">';
    if (rec.code) h += String(rec.code);
    var imgs = Array.isArray(rec.imgs) ? rec.imgs : (rec.img ? [rec.img] : []);
    for (var i = 0; i < imgs.length; i++) {
      var it = imgs[i];
      var file = (it && typeof it === 'object') ? it.file : it;
      if (!file) continue;
      var p = pathOf(file);
      var st = '', plain = !!(it && typeof it === 'object' && it.plain);
      if (it && typeof it === 'object') {
        if (it.size) st += 'width:' + it.size + ';';
        if (it.left != null) st += 'left:' + it.left + ';';
        if (it.top != null) st += 'top:' + it.top + ';';
        if (it.pos) st += 'object-position:' + it.pos + ';';
        if (it.delay) st += 'animation-delay:' + (Number(it.delay) || 0) + 'ms;';
      }
      h += '<img class="fximg' + (plain ? ' nocut' : '') + '" src="' + fxEsc(p) + '"' +
        (plain ? '' : ' data-cut="' + fxEsc(p) + '"') + (st ? ' style="' + st + '"' : '') + ' alt="">';
    }
    return h + '</div>';
  };
  window.JH_FXC_css = function () {
    var list = fxList(), out = [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].css) out.push(String(list[i].css));
    return out.join('\n');
  };
   
  window.JH_FXC_ensureCss = function () {
    if (typeof document === 'undefined' || !document || !document.head || typeof document.createElement !== 'function') return;
    var css = window.JH_FXC_css();
    var el = document.getElementById && document.getElementById('jhFxCss');
    if (!css) { if (el && el.parentNode) el.parentNode.removeChild(el); return; }
    if (!el) { el = document.createElement('style'); el.id = 'jhFxCss'; document.head.appendChild(el); }
    if (el.textContent !== css) el.textContent = css;
  };
  window.JH_IMGC_cut = function (root) {
    if (!window.JH_API || !window.JH_API.imageCut) return 0;
    var nodes;
    try { nodes = (root || document).querySelectorAll('img[data-cut]'); } catch (e) { return 0; }
    var n = 0;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i], p = el.getAttribute('data-cut');
      if (!p) continue;
      if (CUT[p] !== undefined) { if (CUT[p] && el.getAttribute('src') !== CUT[p]) el.setAttribute('src', CUT[p]); continue; }
      if (CUTTING[p]) { n++; continue; }
      CUTTING[p] = true; n++;
      (function (path) {
        function done(url) {                               
          CUT[path] = url || '';
          delete CUTTING[path];
          if (!CUT[path]) return;
          var all = document.querySelectorAll('img[data-cut]');
          for (var k = 0; k < all.length; k++) {
            if (all[k].getAttribute('data-cut') === path) all[k].setAttribute('src', CUT[path]);
          }
        }
        window.JH_API.imageCut(path).then(function (r) {
          if (r && r.ok) { done(r.cut ? r.dataUrl : ''); return; }
          cutInRenderer(path, done);                       
        })['catch'](function () { cutInRenderer(path, done); });
      })(p);
    }
    return n;
  };

  window.JH_IMGC = {
    DIR: DIR,
    KINDS: KINDS.slice(),
     
    bind: function (kind, slot, file) {
      kind = norm(kind); if (KINDS.indexOf(kind) < 0) return false;
      var p = pathOf(file); if (!p) return false;
      REG[kind + ':' + norm(slot)] = p; return true;
    },
    unbind: function (kind, slot) { delete REG[norm(kind) + ':' + norm(slot)]; },
    clear: function () { REG = {}; },
    pick: pick,
    url: function (kind, slot) { return pick(kind, slot); },
     
    rescan: function () { scan(); },
     
    entries: function () {
      ensure();
      var out = [], k;
      for (k in REG) if (Object.prototype.hasOwnProperty.call(REG, k)) out.push({ slot: k, file: REG[k], by: '手动' });
      for (k in AUTO) if (Object.prototype.hasOwnProperty.call(AUTO, k)) out.push({ slot: k, file: AUTO[k], by: '文件名' });
      out.sort(function (a, b) { return a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : 0; });
      return out;
    }
  };
  

  window.JH_IMGC_bind = function (kind, slot, file) { return window.JH_IMGC.bind(kind, slot, file); };
  window.JH_IMGC_unbind = function (kind, slot) { return window.JH_IMGC.unbind(kind, slot); };
  window.JH_IMGC_url = function (kind, slot) { return window.JH_IMGC.url(kind, slot); };
  window.JH_IMGC_pick = function (kind, slots) { return window.JH_IMGC.pick(kind, slots); };
  window.JH_IMGC_SLOTS = [
    { kind: 'battle', name: '打斗画面', tip: '对战框背景。battle__default.png / battle__<场景id>.png；领域换底用 battle__dom.<领域kind>.png 或 battle__dom.hero|foe.png。' },
    { kind: 'actor', name: '人物建模', tip: '把火柴人换成人像。actor__hero.png / actor__foe.png / actor__<出身或敌人id>.png。' },
    { kind: 'fx', name: '术式特效', tip: 'fx__<术式id>.png / fx__<生得术式id>.png / fx__domain.png / fx__summon.png / fx__phy.png / fx__bf.png。多图连播就编号：fx__术式id.1.png、.2.png、.3.png —— 一张一张放完才结算伤害；每张停留多久在「自定义特效间隔」里配。' },
    { kind: 'map', name: '大地图背景', tip: '山河舆图的底板。map__default.png / map__<大地图id>.png。' }
  ];
})();
