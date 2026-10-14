/* 渲染层与主进程之间的那道桥：只递存档 / 自定义 / 局域网这几个口子。 */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('JH_API', {
  isDesktop: true,
  save: (text) => ipcRenderer.invoke('jh-save', text),
  load: () => ipcRenderer.invoke('jh-load'),
  reset: () => ipcRenderer.invoke('jh-reset'),
  dir: () => ipcRenderer.invoke('jh-dir'),
  music: () => ipcRenderer.invoke('jh-music'),
  openMusicDir: () => ipcRenderer.invoke('jh-music-open'),
  openCustomDir: () => ipcRenderer.invoke('jh-custom-open'),
  exportFile: (name, text) => ipcRenderer.invoke('jh-export', name, text),
  

  imageCut: (rel) => ipcRenderer.invoke('jh-image-cut', rel),
   
  imageBytes: (rel) => ipcRenderer.invoke('jh-image-bytes', rel),
  reveal: (p) => ipcRenderer.invoke('jh-reveal', p),
  quit: () => ipcRenderer.invoke('jh-quit'),
  info: () => ipcRenderer.invoke('jh-info'),
  

  lan: {
    list: () => ipcRenderer.invoke('jh-lan-list'),
    host: (name) => ipcRenderer.invoke('jh-lan-host', name),
    join: (addr, port) => ipcRenderer.invoke('jh-lan-join', addr, port),
    send: (msg) => ipcRenderer.invoke('jh-lan-send', msg),
    leave: () => ipcRenderer.invoke('jh-lan-leave'),
    info: () => ipcRenderer.invoke('jh-lan-info'),
    on: (cb) => { ipcRenderer.on('jh-lan-event', (_e, ev) => { try { cb(ev); } catch (e) {} }); }
  },
});





function listCustom() {
  const out = [];
  const root = path.join(__dirname, 'app', 'custom');
  let dirs = [];
  try { dirs = fs.readdirSync(root); } catch (e) { return out; }
  dirs.sort();
  for (const d of dirs) {
    const dp = path.join(root, d);
    let files = [];
    try { if (!fs.statSync(dp).isDirectory()) continue; } catch (e) { continue; }
    try { files = fs.readdirSync(dp); } catch (e) { continue; }
    files.sort();
    for (const f of files) {
      if (!/\.js$/i.test(f) || f.charAt(0) === '_') continue;
      out.push('custom/' + d + '/' + f);
    }
  }
  return out;
}
 
function readCustomJson() {
  const out = [];
  const root = path.join(__dirname, 'app', 'custom');
  let dirs = [];
  try { dirs = fs.readdirSync(root); } catch (e) { return out; }
  dirs.sort();
  for (const d of dirs) {
    const dp = path.join(root, d);
    let files = [];
    try { if (!fs.statSync(dp).isDirectory()) continue; } catch (e) { continue; }
    try { files = fs.readdirSync(dp); } catch (e) { continue; }
    files.sort();
    for (const f of files) {
      if (f.charAt(0) === '_' || !/\.json$/i.test(f)) continue;
      const p = path.join(dp, f), rel = 'custom/' + d + '/' + f;
      try { out.push({ cat: d, file: rel, data: JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')) }); }
      catch (e) { out.push({ cat: d, file: rel, error: String(e && e.message || e) }); }
    }
  }
  return out;
}


function readBaseJson() {
  const out = [];
  const root = path.join(__dirname, 'app', 'base');
  let dirs = [];
  try { dirs = fs.readdirSync(root); } catch (e) { return out; }
  dirs.sort();
  for (const d of dirs) {
    const dp = path.join(root, d);
    let files = [];
    try { if (!fs.statSync(dp).isDirectory()) continue; } catch (e) { continue; }
    try { files = fs.readdirSync(dp); } catch (e) { continue; }
    files.sort();
    for (const f of files) {
      if (f.charAt(0) === '_' || !/\.json$/i.test(f)) continue;
      const p = path.join(dp, f), rel = 'base/' + d + '/' + f;
      try { out.push({ cat: d, file: rel, data: JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')) }); }
      catch (e) { out.push({ cat: d, file: rel, error: String((e && e.message) || e) }); }
    }
  }
  return out;
}

contextBridge.exposeInMainWorld('JH_CUSTOM_FILES', listCustom());
contextBridge.exposeInMainWorld('JH_CUSTOM_DATA', readCustomJson());
contextBridge.exposeInMainWorld('JH_CUSTOM_DIR', path.join(__dirname, 'app', 'custom'));
contextBridge.exposeInMainWorld('JH_BASE_DATA', readBaseJson());
contextBridge.exposeInMainWorld('JH_BASE_DIR', path.join(__dirname, 'app', 'base'));



const IMG_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
function listImages() {
  const out = [];
  const dir = path.join(__dirname, 'app', 'custom', '自定义图片');
  let files = [];
  try { files = fs.readdirSync(dir); } catch (e) { return out; }
  files.sort();
  for (const f of files) if (IMG_RE.test(f)) out.push('custom/' + '自定义图片' + '/' + f);
  return out;
}
contextBridge.exposeInMainWorld('JH_CUSTOM_IMAGES', listImages());



const MEDIA_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif|mp4|webm|ogv|ogg|m4v|mov)$/i;
function listMedia() {
  const out = [];
  const dir = path.join(__dirname, 'app', 'custom', '自定义见闻');
  let files = [];
  try { files = fs.readdirSync(dir); } catch (e) { return out; }
  files.sort();
  for (const f of files) if (MEDIA_RE.test(f)) out.push('custom/' + '自定义见闻' + '/' + f);
  return out;
}
contextBridge.exposeInMainWorld('JH_CUSTOM_MEDIA', listMedia());
