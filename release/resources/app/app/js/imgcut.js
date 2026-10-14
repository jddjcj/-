/* 把图片上贴着边缘的一层纯色底抠成透明。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.JH_IMGCUT = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  var TOL = 52;               
  var TOL_SOFT = 2.4;         
  var DILATE = 1;             
  var MIN_FRACTION = 0.005;   
  var MIN_PIXELS = 16;
  var EDGE_COVER = 0.55;      
  var EDGE_OPAQUE = 0.5;      
  var CORNER_NEED = 3;        
  var ALPHA_OPAQUE = 200;

  function cutBitmap(buf, w, h, opt) {
    opt = opt || {};
    if (!buf || !w || !h || buf.length < w * h * 4) return { cut: false, why: '像素数据不完整', removed: 0 };
    var tol = opt.tol == null ? TOL : opt.tol;
    var dilate = opt.dilate == null ? DILATE : Math.max(0, opt.dilate | 0);
    var edge = [], x, y, i, e;
    for (x = 0; x < w; x++) { edge.push(x); edge.push((h - 1) * w + x); }
    for (y = 1; y < h - 1; y++) { edge.push(y * w); edge.push(y * w + w - 1); }

     
    var hist = {}, opaque = 0, o, key;
    for (e = 0; e < edge.length; e++) {
      o = edge[e] * 4;
      if (buf[o + 3] < ALPHA_OPAQUE) continue;           
      opaque++;
      key = ((buf[o + 2] >> 3) << 10) | ((buf[o + 1] >> 3) << 5) | (buf[o] >> 3);
      hist[key] = (hist[key] || 0) + 1;
    }
    if (!opaque || opaque < edge.length * EDGE_OPAQUE) return { cut: false, why: '边界大半已经是透明的了', removed: 0 };
    var bk = -1, bn = 0;
    for (key in hist) if (hist[key] > bn) { bn = hist[key]; bk = +key; }
    if (bn / opaque < EDGE_COVER) return { cut: false, why: '边界花样太多，认不出哪一片是底', removed: 0 };

     
    var sr = 0, sg = 0, sb = 0, sn = 0;
    for (e = 0; e < edge.length; e++) {
      o = edge[e] * 4;
      if (buf[o + 3] < ALPHA_OPAQUE) continue;
      key = ((buf[o + 2] >> 3) << 10) | ((buf[o + 1] >> 3) << 5) | (buf[o] >> 3);
      if (key !== bk) continue;
      sb += buf[o]; sg += buf[o + 1]; sr += buf[o + 2]; sn++;
    }
    if (!sn) return { cut: false, why: '取不到底色', removed: 0 };
    var br = sr / sn, bg = sg / sn, bb = sb / sn;

    

    var corners = [0, w - 1, (h - 1) * w, (h - 1) * w + w - 1], hit = 0;
    for (e = 0; e < 4; e++) {
      o = corners[e] * 4;
      if (buf[o + 3] < ALPHA_OPAQUE) continue;
      if (Math.abs(buf[o] - bb) <= tol && Math.abs(buf[o + 1] - bg) <= tol && Math.abs(buf[o + 2] - br) <= tol) hit++;
    }
    if (hit < CORNER_NEED) return { cut: false, why: '四个角里凑不出三个同色的底（画面多半正好贴着边），不抠', removed: 0 };

    function dist(idx) {
      var q = idx * 4;
      var dr = buf[q + 2] - br, dg = buf[q + 1] - bg, db = buf[q] - bb;
      return Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db));
    }
    function same(idx) { return buf[idx * 4 + 3] === 0 || dist(idx) <= tol; }

     
    var seen = new Uint8Array(w * h), stack = [], cur, cx, cy, j;
    for (e = 0; e < edge.length; e++) { i = edge[e]; if (!seen[i] && same(i)) { seen[i] = 1; stack.push(i); } }
    while (stack.length) {
      cur = stack.pop();
      cx = cur % w; cy = (cur / w) | 0;
      if (cx > 0) { j = cur - 1; if (!seen[j] && same(j)) { seen[j] = 1; stack.push(j); } }
      if (cx < w - 1) { j = cur + 1; if (!seen[j] && same(j)) { seen[j] = 1; stack.push(j); } }
      if (cy > 0) { j = cur - w; if (!seen[j] && same(j)) { seen[j] = 1; stack.push(j); } }
      if (cy < h - 1) { j = cur + w; if (!seen[j] && same(j)) { seen[j] = 1; stack.push(j); } }
    }

    

    var soft = tol * TOL_SOFT;
    for (var pass = 0; pass < dilate; pass++) {
      var add = [];
      for (i = 0; i < w * h; i++) {
        if (seen[i]) continue;
        if (buf[i * 4 + 3] !== 0 && dist(i) > soft) continue;
        cx = i % w; cy = (i / w) | 0;
        if ((cx > 0 && seen[i - 1]) || (cx < w - 1 && seen[i + 1]) || (cy > 0 && seen[i - w]) || (cy < h - 1 && seen[i + w])) add.push(i);
      }
      if (!add.length) break;
      for (e = 0; e < add.length; e++) seen[add[e]] = 1;
    }

     
    var removed = 0, opaqueSeen = 0;
    for (i = 0; i < w * h; i++) {
      if (!seen[i]) continue;
      o = i * 4;
      if (buf[o + 3] !== 0) opaqueSeen++;
      if (buf[o + 3] === 0 && buf[o] === 0 && buf[o + 1] === 0 && buf[o + 2] === 0) continue;
      buf[o] = 0; buf[o + 1] = 0; buf[o + 2] = 0; buf[o + 3] = 0;
      removed++;
    }
    if (opaqueSeen < Math.max(MIN_PIXELS, w * h * MIN_FRACTION)) return { cut: false, why: '要抠的太少，当它没有底', removed: 0 };
    return { cut: true, why: '', removed: removed, bg: { r: Math.round(br), g: Math.round(bg), b: Math.round(bb) } };
  }

  




  function isAnimated(buf, mime) {
    if (!buf || !buf.length) return false;
    var b = buf, n = b.length, i;
    

    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
      if (n < 13) return false;
      var p = 6;
      var flags = b[p + 4];
      p = p + 7 + ((flags & 0x80) ? 3 * (1 << ((flags & 7) + 1)) : 0);
      var frames = 0;
      while (p < n) {
        var blk = b[p++];
        if (blk === 0x3B) break;                        
        if (blk === 0x21) {                             
          if (p >= n) break;
          p++;
          while (p < n) { var sz = b[p++]; if (!sz) break; p += sz; }
          continue;
        }
        if (blk === 0x2C) {                             
          frames++;
          if (frames > 1) return true;
          if (p + 9 > n) return false;
          var lf = b[p + 8];
          p += 9 + ((lf & 0x80) ? 3 * (1 << ((lf & 7) + 1)) : 0);
          p++;                                          
          while (p < n) { var sz2 = b[p++]; if (!sz2) break; p += sz2; }
          continue;
        }
        return false;                                   
      }
      return false;
    }
     
    if (n > 16 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
      var q = 12;
      while (q + 8 <= n) {
        if (b[q] === 0x41 && b[q + 1] === 0x4E && b[q + 2] === 0x49 && b[q + 3] === 0x4D) return true;
        var sz3 = (b[q + 4] | (b[q + 5] << 8) | (b[q + 6] << 16) | (b[q + 7] << 24)) >>> 0;
        q += 8 + sz3 + (sz3 & 1);
      }
      return false;
    }
     
    if (n > 16 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) {
      var r = 8;
      while (r + 8 <= n) {
        var len = ((b[r] << 24) | (b[r + 1] << 16) | (b[r + 2] << 8) | b[r + 3]) >>> 0;
        var ty = String.fromCharCode(b[r + 4], b[r + 5], b[r + 6], b[r + 7]);
        if (ty === 'acTL') return true;
        if (ty === 'IDAT') return false;
        r += 12 + len;
      }
      return false;
    }
    return false;
  }

  return { cutBitmap: cutBitmap, isAnimated: isAnimated, TOL: TOL };
});