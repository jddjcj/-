/* 主进程：开窗口、读写存档、挑自定义目录、开局域网房间。 */
'use strict';

const { app, BrowserWindow, ipcMain, session, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const dgram = require('dgram');
const os = require('os');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const APP_DIR = __dirname;

 


const EXE_DIR = path.dirname(process.execPath);
const BASE_DIR = fs.existsSync(path.join(EXE_DIR, 'portable.txt'))
  ? EXE_DIR
  : (app.isPackaged ? EXE_DIR : APP_DIR);


const LAN_ONLY = process.argv.indexOf('--lan') >= 0;



const DIR_PICK = (LAN_ONLY ? 'userdata-lan' : 'userdata');
function canWriteDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.write-test');
    fs.writeFileSync(probe, 'x');
    fs.unlinkSync(probe);
    return true;
  } catch (e) { return false; }
}
let DIR_NOTE = '';
let USER_DIR = path.join(BASE_DIR, DIR_PICK);
if (!canWriteDir(USER_DIR)) {
  const home = process.env.APPDATA || process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const alt = path.join(home, '咒术闲录' + (LAN_ONLY ? '-lan' : ''));
  if (canWriteDir(alt)) {
    DIR_NOTE = '程序目录写不进去，存档与音乐改放在：' + alt;
    USER_DIR = alt;
  } else {
    DIR_NOTE = '警告：程序目录与备用目录都写不进去，存档可能会失败。';
  }
}


if (!canWriteDir(path.join(APP_DIR, 'app', 'custom'))) {
  DIR_NOTE = (DIR_NOTE ? DIR_NOTE + ' ' : '') + '自定义素材目录（app/custom）写不进去：想放自己的图片 / 音乐 / 文本，请先把游戏解压到能写的文件夹。';
}
const SAVE_FILE = path.join(USER_DIR, 'save.json');
const EXPORT_DIR = path.join(USER_DIR, 'export');
const MUSIC_DIR = path.join(USER_DIR, 'music');

for (const d of [USER_DIR, EXPORT_DIR, MUSIC_DIR]) {
  try { fs.mkdirSync(d, { recursive: true }); } catch (e) {}
}

app.setPath('userData', USER_DIR);
app.setPath('sessionData', path.join(USER_DIR, 'session'));
app.setPath('cache', path.join(USER_DIR, 'cache'));
app.setPath('logs', path.join(USER_DIR, 'logs'));
app.setPath('crashDumps', path.join(USER_DIR, 'crashes'));
app.setPath('temp', path.join(USER_DIR, 'tmp'));
try { app.setAppLogsPath(path.join(USER_DIR, 'logs')); } catch (e) {}

 
if (!LAN_ONLY && !app.requestSingleInstanceLock()) app.quit();

 
function lockNetwork() {
  const s = session.defaultSession;
  s.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, cb) => {
    const u = details.url || '';
    const allowed = u.startsWith('file://') || u.startsWith('devtools://') ||
                    u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('about:');
    cb({ cancel: !allowed });
  });
  s.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  s.setPermissionCheckHandler(() => false);
}

 
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0b0d10',
    title: '咒术闲录',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(APP_DIR, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      devTools: false,
      webSecurity: true,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(APP_DIR, 'app', 'index.html'));
  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

 
ipcMain.handle('jh-save', (_e, text) => {
  try {
    const tmp = SAVE_FILE + '.tmp';
    fs.writeFileSync(tmp, String(text), 'utf8');
    fs.renameSync(tmp, SAVE_FILE);
    return { ok: true, path: SAVE_FILE };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
});

ipcMain.handle('jh-load', () => {
  try {
    if (!fs.existsSync(SAVE_FILE)) return { ok: true, data: null };
    return { ok: true, data: fs.readFileSync(SAVE_FILE, 'utf8') };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
});

ipcMain.handle('jh-reset', () => {
  try { if (fs.existsSync(SAVE_FILE)) fs.unlinkSync(SAVE_FILE); return { ok: true }; }
  catch (err) { return { ok: false, error: String(err && err.message || err) }; }
});

ipcMain.handle('jh-dir', () => USER_DIR);

 
const AUDIO_EXT = ['.mp3', '.m4a', '.wav', '.ogg', '.oga', '.flac', '.aac', '.opus', '.webm'];
ipcMain.handle('jh-music', () => {
  try {
    const files = fs.readdirSync(MUSIC_DIR)
      .filter(f => AUDIO_EXT.indexOf(path.extname(f).toLowerCase()) >= 0)
      .sort();
    return { ok: true, dir: MUSIC_DIR, files: files.map(f => {
      const p = path.join(MUSIC_DIR, f);
      return { name: f, path: p, url: pathToFileURL(p).href };
    }) };
  } catch (err) { return { ok: false, dir: MUSIC_DIR, files: [], error: String(err && err.message || err) }; }
});

ipcMain.handle('jh-music-open', () => {
  try { fs.mkdirSync(MUSIC_DIR, { recursive: true }); shell.openPath(MUSIC_DIR); return true; }
  catch (e) { return false; }
});

 
ipcMain.handle('jh-custom-open', () => {
  try {
    const p = path.join(APP_DIR, 'app', 'custom');
    fs.mkdirSync(p, { recursive: true });
    shell.openPath(p);
    return { ok: true, path: p };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
});





const JH_IMGCUT = require('./app/js/imgcut.js');
const IMG_DIR = path.join(APP_DIR, 'app', 'custom', '自定义图片');
const CUT_CACHE = new Map();
const CUT_MAX_EDGE = 2048;         

function cutSolidBackground(abs) {
  let img = nativeImage.createFromPath(abs);
  if (img.isEmpty()) return { ok: false, err: '读不出这张图' };
  let size = img.getSize();
  if (size.width > CUT_MAX_EDGE || size.height > CUT_MAX_EDGE) {
    const k = CUT_MAX_EDGE / Math.max(size.width, size.height);
    img = img.resize({ width: Math.max(1, Math.round(size.width * k)), height: Math.max(1, Math.round(size.height * k)), quality: 'best' });
    size = img.getSize();
  }
  const w = size.width, h = size.height;
  const buf = img.toBitmap();                      
  if (!w || !h || buf.length < w * h * 4) return { ok: false, err: '像素数据不完整' };
  const res = JH_IMGCUT.cutBitmap(buf, w, h);
  if (!res.cut) return { ok: true, cut: false, why: res.why || '' };
  const dataUrl = nativeImage.createFromBitmap(buf, { width: w, height: h }).toDataURL();
  if (!dataUrl || dataUrl.length < 32) return { ok: false, err: '抠完转不出 PNG' };
  return { ok: true, cut: true, width: w, height: h, removed: res.removed, bg: res.bg, dataUrl: dataUrl };
}

 
function imgFileOf(rel) {
  let name = String(rel == null ? '' : rel).trim().replace(/\\/g, '/').replace(/^\.\//, '');
  const pre = 'custom/' + '自定义图片/';
  if (name.indexOf(pre) === 0) name = name.slice(pre.length);
  if (!name || name.indexOf('/') >= 0 || name.indexOf('..') >= 0) return { ok: false, err: '文件名不合法' };
  const abs = path.join(IMG_DIR, name);
  if (path.dirname(abs) !== IMG_DIR) return { ok: false, err: '路径越界' };
  try { fs.statSync(abs); } catch (e) { return { ok: false, err: '找不到这张图' }; }
  return { ok: true, abs: abs };
}

 
const ANIM_EXT = /.(gif|webp|png|apng)$/i;
function animBytesOf(abs) {
  try {
    const st = fs.statSync(abs);
    if (st.size > 16 * 1024 * 1024) return null;               
    return fs.readFileSync(abs);
  } catch (e) { return null; }
}

ipcMain.handle('jh-image-cut', (_e, rel) => {
  try {
    const f = imgFileOf(rel);
    if (!f.ok) return f;
    const abs = f.abs;
    const st = fs.statSync(abs);
    const key = abs + '|' + st.mtimeMs + '|' + st.size;
    if (CUT_CACHE.has(key)) return CUT_CACHE.get(key);
    

    if (ANIM_EXT.test(abs)) {
      const raw = animBytesOf(abs);
      if (raw && JH_IMGCUT.isAnimated(raw, sniffImageMime(raw, abs))) {
        const r0 = { ok: true, cut: false, animated: true, why: '动图不抠底（改用原图，动画照放）' };
        if (CUT_CACHE.size > 48) CUT_CACHE.clear();
        CUT_CACHE.set(key, r0);
        return r0;
      }
    }
    const res = cutSolidBackground(abs);
    if (res.ok) {
      if (CUT_CACHE.size > 48) CUT_CACHE.clear();      
      CUT_CACHE.set(key, res);
    }
    return res;
  } catch (err) { return { ok: false, err: String((err && err.message) || err) }; }
});





const IMG_BYTES_MAX = 32 * 1024 * 1024;
function sniffImageMime(buf, name) {
  const b = buf;
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b.length > 2 && b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  const head = buf.slice(0, 400).toString('utf8').replace(/^\uFEFF/, '').trim().toLowerCase();
  if (head.indexOf('<svg') === 0 || (head.indexOf('<?xml') === 0 && head.indexOf('<svg') > 0)) return 'image/svg+xml';
  const m = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.svg': 'image/svg+xml' };
  return m[path.extname(String(name)).toLowerCase()] || 'application/octet-stream';
}

ipcMain.handle('jh-image-bytes', (_e, rel) => {
  try {
    const f = imgFileOf(rel);
    if (!f.ok) return f;
    const st = fs.statSync(f.abs);
    if (st.size > IMG_BYTES_MAX) return { ok: false, err: '这张图太大（超过 32MB）' };
    const buf = fs.readFileSync(f.abs);
    const mime = sniffImageMime(buf, f.abs);
    const animated = JH_IMGCUT.isAnimated(buf, mime);    
    return { ok: true, size: buf.length, mime: mime, animated: animated, dataUrl: 'data:' + mime + ';base64,' + buf.toString('base64') };
  } catch (err) { return { ok: false, err: String((err && err.message) || err) }; }
});

ipcMain.handle('jh-export', (_e, name, text) => {
  try {
    const safe = String(name || 'export.txt').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
    const p = path.join(EXPORT_DIR, safe);
    fs.writeFileSync(p, String(text), 'utf8');
    return { ok: true, path: p };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
});

ipcMain.handle('jh-reveal', (_e, p) => {
  try {
    const target = String(p || USER_DIR);
    if (target.startsWith(USER_DIR)) shell.showItemInFolder(target);
    return true;
  } catch (e) { return false; }
});

ipcMain.handle('jh-quit', () => { app.quit(); return true; });

ipcMain.handle('jh-info', () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  userDir: USER_DIR,
  saveFile: SAVE_FILE,
  dirNote: DIR_NOTE,           
}));





const LAN_PORT = 47653;       
const LAN_TCP = 47654;        
const LAN_MAGIC = 'jh-lan-1';
const LAN_MSG_MAX = 512 * 1024;
let lan = null;               
const lanRooms = new Map();   

function lanEmit(ev) { try { if (win && !win.isDestroyed()) win.webContents.send('jh-lan-event', ev); } catch (e) {} }
function lanAddrs() {
  const out = [];
  const ifs = os.networkInterfaces();
  for (const k of Object.keys(ifs)) for (const a of (ifs[k] || [])) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  return out;
}
function lanRoomList() {
  const now = Date.now();
  for (const [id, r] of lanRooms) if (now - r.at > 4200) lanRooms.delete(id);
  return Array.from(lanRooms.values()).map(r => ({ id: r.id, name: r.name, addr: r.addr, port: r.port }));
}
 
let lanDiscover = null;
function lanListen() {
  if (lanDiscover) return;
  try {
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    sock.on('error', () => { try { sock.close(); } catch (e) {} });
    sock.on('message', (buf, rinfo) => {
      let m = null;
      try { m = JSON.parse(buf.toString('utf8')); } catch (e) { return; }
      if (!m || m.jh !== LAN_MAGIC || !m.room || !m.room.id) return;
      if (lan && lan.id === m.room.id) return;                
      lanRooms.set(m.room.id, { id: m.room.id, name: String(m.room.name || '对局').slice(0, 20),
                                addr: rinfo.address, port: m.room.port | 0, at: Date.now() });
    });
    sock.bind(LAN_PORT);
    lanDiscover = sock;
  } catch (e) { lanDiscover = null; }
}
 
function lanBind(sock) {
  let buf = '';
  sock.setEncoding('utf8');
  sock.on('data', (t) => {
    buf += t;
    if (buf.length > LAN_MSG_MAX) { buf = ''; lanEmit({ type: 'error', text: '对面发来的东西太大' }); return; }
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line) continue;
      let m = null;
      try { m = JSON.parse(line); } catch (e) { continue; }
      if (m && m.t === 'full') { lanEmit({ type: 'error', text: '这间房已经坐满了（只许两个人）' }); return; }
      lanEmit({ type: 'peer', msg: m });
    }
  });
  sock.on('error', () => {});
  sock.on('close', () => { if (lan && lan.peers.has(sock)) { lan.peers.delete(sock); lanEmit({ type: 'closed' }); } });
}
function lanWrite(msg) {
  if (!lan) return false;
  let line = '';
  try { line = JSON.stringify(msg) + '\n'; } catch (e) { return false; }
  if (line.length > LAN_MSG_MAX) return false;
  for (const s of lan.peers) { try { s.write(line); } catch (e) {} }
  return true;
}
function lanClose() {
  if (!lan) { return true; }
  try { if (lan.beacon) clearInterval(lan.beacon); } catch (e) {}
  for (const s of lan.peers) { try { s.destroy(); } catch (e) {} }
  try { if (lan.server) lan.server.close(); } catch (e) {}
  try { if (lan.sock) lan.sock.close(); } catch (e) {}
  lan = null;
  return true;
}
function lanHost(name) {
  return new Promise((resolve) => {
    if (lan) return resolve({ ok: false, err: '已经开着一间房了' });
    lanListen();
    const id = crypto.randomBytes(6).toString('hex');
    const server = net.createServer((sock) => {
      if (!lan || lan.peers.size >= 1) {                      
        try { sock.write(JSON.stringify({ t: 'full' }) + '\n'); } catch (e) {}
        setTimeout(() => { try { sock.destroy(); } catch (e) {} }, 250);
        return;
      }
      lan.peers.add(sock);
      lanBind(sock);
      resolveOpen();
    });
    let opened = false;
    const resolveOpen = () => { if (!opened) { opened = true; lanEmit({ type: 'open' }); } };
    const start = (port) => {
      const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      sock.on('error', () => {});
      sock.bind(LAN_PORT, () => {
        try { sock.setBroadcast(true); } catch (e) {}
        const room = { id: id, name: String(name || '局域网对局').slice(0, 20), port: port };
        lan = { mode: 'host', id: id, name: room.name, port: port, server: server, sock: sock, peers: new Set(), beacon: null };
        lan.beacon = setInterval(() => {
          const msg = Buffer.from(JSON.stringify({ jh: LAN_MAGIC, room: room }));
          const targets = ['255.255.255.255'].concat(lanAddrs().map(a => a.replace(/\.\d+$/, '.255')));
          for (const br of targets) { try { sock.send(msg, 0, msg.length, LAN_PORT, br); } catch (e) {} }
        }, 900);
        resolve({ ok: true, id: id, name: room.name, port: port, addrs: lanAddrs() });
      });
    };
    server.on('error', (e) => {
      if (!opened && (e.code === 'EADDRINUSE') && server.__try0 !== true) { server.__try0 = true; try { server.close(); } catch (er) {} tryListen(0); return; }
      resolve({ ok: false, err: '开房失败：' + String(e.message || e) });
    });
    const tryListen = (port) => { try { server.listen(port); } catch (e) { resolve({ ok: false, err: String(e.message || e) }); } };
    server.on('listening', () => { start(server.address().port); });
    tryListen(LAN_TCP);
  });
}
function lanJoin(addr, port) {
  return new Promise((resolve) => {
    if (lan) return resolve({ ok: false, err: '已经在房里了' });
    if (!addr) return resolve({ ok: false, err: '没有对方地址' });
    lanListen();
    const sock = net.connect({ host: addr, port: port || LAN_TCP });
    let done = false;
    sock.setNoDelay(true);
    sock.on('connect', () => {
      done = true;
      lan = { mode: 'guest', id: '', name: '', port: 0, server: null, sock: null, peers: new Set([sock]), beacon: null };
      lanBind(sock);
      resolve({ ok: true, addr: addr, port: port || LAN_TCP });
    });
    sock.on('error', (e) => {
      if (!done) { done = true; resolve({ ok: false, err: '连不上 ' + addr + '：' + String(e.message || e) }); }
      else lanEmit({ type: 'closed' });
    });
    setTimeout(() => { if (!done) { done = true; try { sock.destroy(); } catch (e) {} resolve({ ok: false, err: '连不上 ' + addr + '（超时）' }); } }, 6000);
  });
}

ipcMain.handle('jh-lan-list', () => ({ ok: true, rooms: lanRoomList(), addrs: lanAddrs(), port: LAN_TCP }));
ipcMain.handle('jh-lan-host', (_e, name) => lanHost(name));
ipcMain.handle('jh-lan-join', (_e, addr, port) => lanJoin(String(addr || '').trim(), +port || 0));
ipcMain.handle('jh-lan-send', (_e, msg) => lanWrite(msg));
ipcMain.handle('jh-lan-leave', () => lanClose());
ipcMain.handle('jh-lan-info', () => ({ ok: true, addrs: lanAddrs(), port: LAN_TCP, active: !!lan, role: lan ? lan.mode : '' }));

 
app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.whenReady().then(() => {
  lockNetwork();
  lanListen();                      
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { lanClose(); app.quit(); });

process.on('uncaughtException', (e) => { try { console.error(e); } catch (_) {} });