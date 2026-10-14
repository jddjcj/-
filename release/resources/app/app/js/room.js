/* 局域网对战：房间与出阵流程。 */
(function () {
  'use strict';

  const LAN_POINTS = 19;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const C = () => window.JH_create;
  const E = () => window.JH.engine;
  const UI = () => window.JH_ui;
  const KIND = { atk: '主动术式', nei: '咒力运用', qing: '体术身法', passive: '被动' };
  const qclass = q => 'q' + (q || 0);
  const PHASE = { LOBBY: 'lobby', PREP: 'prep', BATTLE: 'battle', OVER: 'over' };
  const STAGE_NAMES = ['一 · 出身', '二 · 生得术式', '三 · 普通技能', '四 · 互相确认', '五 · 出阵准备'];
   
  const PREP_TABS = ['出 战 配 置', '兵 器 铺', '锻 冶 台', '行 囊'];
  const EQ_SLOT = { weapon: '兵器', armor: '护具', charm: '佩饰', boots: '靴子' };

   

   
  function rulesOf() {
    const ids = a => (a || []).map(x => x && x.id).join(',');
    const txt = [ids(window.JH_ORIGINS), ids(window.JH_INNATE), ids(window.JH_COMMON), ids(window.JH_MARTIAL)].join('|');
    let h = 0x811C9DC5;
    for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return { hash: h >>> 0, origins: (window.JH_ORIGINS || []).length, innate: (window.JH_INNATE || []).length,
             common: (window.JH_COMMON || []).length, martial: (window.JH_MARTIAL || []).length };
  }

   
  function stageData(draft, stage) {
    const o = draft.originId ? window.JH_ORIGIN_MAP[draft.originId] : null;
    if (stage === 0) {
      const hidden = !!(o && o.hidden);
      return hidden ? { name: draft.name, masked: true }
                    : { name: draft.name, origin: draft.originId, originName: o ? o.name : '' };
    }
    if (stage === 1) return { techs: (draft.techs || []).slice() };
    if (stage === 2) return { common: Object.assign({}, draft.common || {}),
                              cePts: { eff: (draft.cePts && draft.cePts.eff) || 0, ctl: (draft.cePts && draft.cePts.ctl) || 0 },
                              attrs: { insight: draft.insight, root: draft.root, luck: draft.luck, face: draft.face } };
    return {};
  }

   
  function statsOfBuild(originId, attrs, techs, common, cePts) {
    try {
      const o = window.JH_ORIGIN_MAP[originId];
      if (!o) return null;
      const p = cePts || { eff: 0, ctl: 0 }, PV = C().CE_PT_VALUE || 0.01;
      const eff = Math.max(0.20, Math.min(o.ceCap, C().BASE_CE_EFF + ((o.init && o.init.ceEff) || 0) + (p.eff || 0) * PV));
      const ctl = Math.max(0.20, Math.min(o.ceCap, C().BASE_CE_CTL + ((o.init && o.init.ceCtl) || 0) + (p.ctl || 0) * PV));
      const skills = {}, skillLv = {};
      for (const id of Object.keys(common || {})) { if (window.JH_MARTIAL_MAP[id]) { skills[id] = 1; skillLv[id] = common[id]; } }
      for (const t of (techs || [])) {
        const def = window.JH_INNATE_MAP[t];
        for (const sid of ((def && def.skills) || [])) {
          const m = window.JH_MARTIAL_MAP[sid];
          if (m && (m.lv || 0) <= 1) { skills[sid] = 1; if (!skillLv[sid]) skillLv[sid] = 1; }
        }
      }
      return window.JH_combat.stats({ attrs: attrs, origin: originId, ce: { eff: eff, ctl: ctl, cap: o.ceCap },
        realm: 0, innate: (techs || []).slice(), skills: skills, skillLv: skillLv, equip: {}, tech: {}, buff: null });
    } catch (e) { return null; }
  }
  



  const SYNC_KEYS = ['JH_MARTIAL', 'JH_INNATE', 'JH_ORIGINS', 'JH_ITEMS', 'JH_WORDS',
                     'JH_FOES', 'JH_MECH', 'JH_SECTS', 'JH_TRIALS', 'JH_TITLES'];
  function packTables() {
    const out = {};
    for (const k of SYNC_KEYS) { const v = window[k]; if (v && typeof v === 'object') out[k] = v; }
    return out;
  }
  function applyTables(t) {
    if (!t || typeof t !== 'object') return false;
    for (const k of SYNC_KEYS) if (t[k] !== undefined) window[k] = t[k];
    try { if (window.JH_BASE_REBUILD) window.JH_BASE_REBUILD(); } catch (e) {}
    return true;
  }
   
  function sanitizeCreation(c) {
    if (!c || typeof c !== 'object') return null;
    const out = Object.assign({}, c);
    if (!window.JH_ORIGIN_MAP[out.origin]) out.origin = ((window.JH_ORIGINS || [])[0] || {}).id;
    out.innate = (c.innate || []).filter(function (id) { return !!window.JH_INNATE_MAP[id]; });
    out.common = {};
    for (const k of Object.keys(c.common || {})) if (window.JH_MARTIAL_MAP[k]) out.common[k] = c.common[k];
    out.cePts = c.cePts || { eff: 0, ctl: 0 };
    return out;
  }
  function previewOf(draft) {
    const f = C().finalize(draft);
    return statsOfBuild(f.origin, f.attrs, f.innate, f.common);
  }

  function createSession(o) {
    o = o || {};
    const S = {
      host: !!o.host, role: o.host ? 'host' : 'guest',
      roomName: String(o.roomName || '局域网对局').slice(0, 20),
      myName: String(o.name || '咒术师').slice(0, 12),
      phase: PHASE.LOBBY, stage: 0,
      draft: C().newDraft(String(o.name || '咒术师').slice(0, 12)),
      peerName: '', peerInfo: {}, peerLoad: null, peerStage: -1, peerRules: null,
      rules: rulesOf(), confirmed: false, peerConfirmed: false,
      prepTab: 0, forgeSel: null, readyDone: false, myBag: null, peerBag: null,
      seed0: 0, round: 1, myAct: null, myActN: 0, peerAct: null, peerActN: 0,
      running: false, runningAt: 0, stallN: 0, busyAt: 0, waitAt: 0, needN: 0, runningMiss: 0,
      result: null, note: '',
      rev: 0, send: o.send || function () {}, on: o.onChange || function () {}
    };
    S.draft.points = LAN_POINTS;
    function fire() { S.rev = (S.rev || 0) + 1; try { S.on(S); } catch (e) {} }
    function say(m) { S.note = m || ''; fire(); }
    function send(m) { try { S.send(m); } catch (e) {} }

    S.setName = function (n) { S.myName = String(n || '').slice(0, 12); S.draft.name = S.myName; };
    S.hello = function () { send({ t: 'hello', name: S.myName, rules: S.rules }); };
    S.startPrep = function () { if (S.phase === PHASE.LOBBY) { S.phase = PHASE.PREP; S.stage = 0; S.note = ''; fire(); } };

    S.next = function () {
      if (S.phase !== PHASE.PREP || S.stage > 3) return;
      const d = S.draft, stage = S.stage;
      if (stage === 0 && !d.originId) return say('先挑一个出身。');
      if (stage === 1) {
        const o = C().originOf(d);
        if (!o || d.techs.length !== o.slots) return say('这个出身要选满 ' + (o ? o.slots : 1) + ' 门生得术式。');
      }
      if (stage === 2) {
        const v = C().validate(d);
        if (!v.ok) return say(v.errors.join('　'));
      }
      send({ t: 'prep', stage: stage, data: stageData(d, stage) });
      if (stage === 2) { send({ t: 'loadout', creation: C().finalize(d) }); S.stage = 3; }
      else if (stage === 3) {
         
        S.stage = 4; S.prepTab = 0; S.forgeSel = null; S.readyDone = false;
        E().lanPrep({ mine: { name: d.name || S.myName, creation: C().finalize(d) }, seed: 0 });
      }
      else S.stage = stage + 1;
      S.note = ''; fire();
    };
    S.back = function () {
      if (S.phase !== PHASE.PREP || S.stage <= 0) return;
      if (S.stage === 4) S.stage = 3;     
      else S.stage--;
      S.note = ''; fire();
    };

    

    S.prepare = function () {
      if (S.phase !== PHASE.PREP || S.stage !== 4 || S.readyDone) return;
      if (!E().s || !E().s.lan) return say('这一份还没捏好，稍等一下…');
      S.readyDone = true; S.myBag = E().lanBag();
      send({ t: 'bag', bag: S.myBag });
      readyCheck(); fire(); maybeStart();
    };
     
    function readyCheck() {
      if (S.phase !== PHASE.PREP || S.stage !== 4 || S.confirmed || !S.readyDone) return;
      if (!S.peerLoad) return;
      S.confirmed = true; send({ t: 'confirm' }); hostSeed();
    }
     
    function hostSeed() {
      if (!S.host || S.seed0 || !S.confirmed || !S.peerConfirmed) return;
      S.seed0 = ((Math.random() * 4294967296) >>> 0) || 1;
      send({ t: 'start', seed: S.seed0 });
    }
    function maybeStart() {
      if (S.phase === PHASE.BATTLE || S.phase === PHASE.OVER) return;
      if (!S.confirmed || !S.peerConfirmed || S.stage < 4 || S.peerStage < 4) return;
      if (!S.seed0 || !S.peerLoad) return;
      beginBattle();
    }
    function beginBattle() {
      const myC = C().finalize(S.draft); myC.bag = S.myBag || null;
      const foeC = sanitizeCreation(S.peerLoad); if (foeC) foeC.bag = S.peerBag || null;
      const mine = { name: S.draft.name || S.myName, creation: myC };
      const foe = { name: (S.peerInfo[0] && S.peerInfo[0].name) || S.peerName || '对手', creation: foeC };
      if (!E().lanInstall({ mine: mine, foe: foe, hostIsMe: S.host, seed: S.seed0 })) {
        S.phase = PHASE.OVER; S.result = { win: false, why: '对局开不起来（对方的数据不全，或本机还有一局没散）' }; fire(); return;
      }
      S.phase = PHASE.BATTLE; S.round = 1; S.myAct = null; S.myActN = 0; S.peerAct = null; S.peerActN = 0;
      S.running = false; S.runningAt = 0; S.stallN = 0; S.note = '';
      fire();
    }

    S.recv = function (m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'hello') {
        S.peerName = String(m.name || '对手').slice(0, 12); S.peerRules = m.rules || null; S.startPrep();
         
        if (S.host && S.peerRules && S.peerRules.hash !== S.rules.hash) send({ t: 'data', rules: S.rules, tables: packTables() });
      }
      else if (m.t === 'data') {
        if (applyTables(m.tables)) {
          S.hostData = true;
          if (m.rules) S.rules = m.rules;       
          S.note = '这一局以房主的数据为准：出身 / 术式 / 词条已换成房主那份。';
        }
      }
      else if (m.t === 'prep') { S.peerInfo[m.stage | 0] = m.data || null; if ((m.stage | 0) + 1 > S.peerStage) S.peerStage = (m.stage | 0) + 1;
         
        if (S.phase === PHASE.LOBBY) S.startPrep(); }
      else if (m.t === 'loadout') { S.peerLoad = m.creation || null; if (S.phase === PHASE.LOBBY) S.startPrep(); readyCheck(); }
       
      else if (m.t === 'bag') { S.peerBag = m.bag || null; readyCheck(); }
      else if (m.t === 'confirm') { S.peerConfirmed = true; hostSeed(); }
      else if (m.t === 'start') { if (!S.seed0) S.seed0 = (m.seed || 0) >>> 0; }
      




      else if (m.t === 'act') {
        if (S.phase === PHASE.BATTLE && m.n != null) {
          if (m.n >= S.round) { S.peerAct = m.act || { type: 'idle' }; S.peerActN = m.n; }
          else send({ t: 'need', n: S.round });
        }
      }
       
      else if (m.t === 'free') {
        try { E().lanFreeAct(m.act); } catch (e) {}
      }
      else if (m.t === 'need') {
         
        if (S.phase === PHASE.BATTLE && S.myAct && S.myActN === S.round) send({ t: 'act', n: S.myActN, act: S.myAct });
      }
      else if (m.t === 'sync') {
         
        if (S.host) {   }
        else if (E().lanSnapSync && E().lanSnapSync(m) && !S.synced) { S.synced = true; S.note = '两边算出来的数值有出入，已按房主那份对齐。'; }
      }
      else if (m.t === 'bye') { S.phase = PHASE.OVER; S.result = { win: true, why: '对方离开了这一局' }; }
       
      else if (m.t === 'again' && S.phase === PHASE.OVER) resetPrep();
      fire(); maybeStart(); tryRound();
    };
    

    function resetPrep() {
      try { if (!E().lanActive || E().lanActive()) E().lanEnd(); } catch (e) {}
      S.phase = PHASE.PREP; S.stage = 0;
      S.draft = C().newDraft(S.myName); S.draft.points = LAN_POINTS;
      S.confirmed = false; S.peerConfirmed = false; S.readyDone = false;
      S.myBag = null; S.peerBag = null; S.peerLoad = null; S.peerStage = -1; S.peerInfo = {};
      S.seed0 = 0; S.round = 1; S.myAct = null; S.myActN = 0; S.peerAct = null; S.peerActN = 0;
      S.running = false; S.runningAt = 0; S.stallN = 0; S.voided = 0; S.synced = false;
      S.busyAt = 0; S.waitAt = Date.now(); S.needN = 0; S.runningMiss = 0;
      S.result = null; S.prepTab = 0; S.forgeSel = null; S.note = '';
    }
    S.again = function () { if (S.phase !== PHASE.OVER) return; resetPrep(); send({ t: 'again' }); fire(); };

    S.peerLeft = function () { if (S.phase !== PHASE.OVER) { S.phase = PHASE.OVER; S.result = { win: true, why: '对方离开了这一局' }; fire(); } };

    S.submit = function (act) {
      if (S.phase !== PHASE.BATTLE) return false;
      

      if (act && act.type === 'healtoggle') {
        try { E().battleAct(act); } catch (e) {}
        send({ t: 'free', act: { type: 'healtoggle', on: !!act.on } });
        fire(); return true;
      }
      if (S.myAct || S.running) return false;
      S.myAct = act; S.myActN = S.round;       
      S.waitAt = Date.now(); S.needN = 0;      
      send({ t: 'act', n: S.round, act: act }); fire(); tryRound(); return true;
    };
    




    function tryRound() {
      if (S.phase !== PHASE.BATTLE || S.running) return;
       
      if (!S.myAct || S.myActN !== S.round) return;
      if (!S.peerAct || S.peerActN !== S.round) return;
      const ui = UI();
      if (ui && ui.battle && ui.battle.busy && ui.battle.busy()) return;
      S.running = true;
      S.runningAt = Date.now();
      E().lanPrepare(S.peerAct, E().lanRoundSeed(S.seed0, S.round));
      fire();
      renderHud();             
      if (ui && ui.battle && ui.battle.runAct) {
        

        if (!ui.battle.runAct(S.myAct)) { S.runningMiss = (S.runningMiss || 0) + 1; dumpLan('演出没接住', S.myAct && S.myAct.type); }
      }
    }
    


    const STALL_MS = 10000;         
    const STALL_HARD_MS = 30000;    
    const PEER_MS = 12000;          
    S.roundDone = function () {
      if (S.phase !== PHASE.BATTLE) return false;
      const ui = UI();
      const b = E().getBattle();
      const now = Date.now();
      if (!S.waitAt) S.waitAt = now;
      let busy = !!(ui && ui.battle && ui.battle.busy && ui.battle.busy());
      

      if (busy) { if (!S.busyAt) S.busyAt = now; } else S.busyAt = 0;
      if (busy && now - S.busyAt > STALL_HARD_MS) {
        if (ui && ui.battle && ui.battle.forceIdle) ui.battle.forceIdle();
        S.busyAt = 0; busy = false;
        dumpLan('动作锁摘不掉', '已经强行解锁');
      }
      

      

      const over = now - (S.running ? (S.runningAt || S.waitAt) : (S.waitAt || now));
      const limit = S.running ? (busy ? STALL_HARD_MS : STALL_MS) : PEER_MS;
      if (b && b.round <= S.round && (S.running || (!!S.myAct && !S.peerAct)) && over > limit) {
        if (busy && ui && ui.battle && ui.battle.forceIdle) ui.battle.forceIdle();
        S.waitAt = now;
        if (!S.running) {
           
          if (S.needN !== S.round) { S.needN = S.round; send({ t: 'need', n: S.round }); }
          else { S.peerAct = { type: 'idle' }; S.peerActN = S.round; }
          S.note = '对面那一手一直没来，这一回合先当空缺过去了。';
          dumpLan('等不到对面那一手', '第 ' + S.round + ' 回合');
          fire(); renderHud(); tryRound();
          return true;
        }
        S.running = false; S.runningAt = 0; S.stallN = (S.stallN || 0) + 1;
        if (S.stallN >= 3) {
          

          S.stallN = 0;
          S.peerAct = { type: 'idle' }; S.peerActN = S.round;
          S.voided = (S.voided || 0) + 1;
          if (S.voided >= 3) {                      
            S.voided = 0;
            if (E().lanSkipRound) E().lanSkipRound();
            S.myAct = null; S.myActN = 0; S.peerAct = null; S.peerActN = 0;
            const b2 = E().getBattle();
            if (b2) S.round = b2.round;
          }
        }
        S.note = '这一手怎么演都出不来，已经跳过去了。';    
        dumpLan('这一回合钉住了', '第 ' + S.round + ' 回合，已自动跳过');
        fire();
        tryRound();
        return true;
      }
      if (!b) {
        const r = E().lanResultOf();
        S.phase = PHASE.OVER;
        S.result = { win: !!(r && r.win), why: (r && r.win) ? '这一局你赢了' : ((r && r.fled) ? '你收了手' : '这一局你输了') };
        fire(); return true;
      }
      

      if (b.round > S.round && (S.running || S.myAct || S.peerAct)) {
         
        if (S.host) {
          const e2 = E(), me2 = e2.s;
          send({ t: 'sync', n: b.round - 1,
                 mine: { hp: me2 ? me2.hp : null, cur: me2 ? me2.cur : null },
                 foe: { hp: b.foe ? b.foe.hp : null, cur: b.foe ? b.foe.cur : null } });
        }
        S.running = false; S.runningAt = 0; S.stallN = 0; S.voided = 0;
        S.round = b.round;
        S.waitAt = now;                   
         
        if (S.myActN !== S.round) { S.myAct = null; S.myActN = 0; }
        if (S.peerActN !== S.round) { S.peerAct = null; S.peerActN = 0; }
        fire(); renderHud();
      }
      if (busy) return false;            
      if (!S.running) tryRound();        
      return false;
    };
    S.end = function () { return E().lanEnd(); };
    S.peerStageName = function () { return STAGE_NAMES[Math.max(0, Math.min(4, S.peerStage))]; };
    return S;
  }

  window.JH_roomLogic = { createSession: createSession, rulesOf: rulesOf, stageData: stageData,
                          statsOfBuild: statsOfBuild, previewOf: previewOf, LAN_POINTS: LAN_POINTS,
                          PHASE: PHASE, STAGE_NAMES: STAGE_NAMES };

   
  let wrap = null, sess = null, hud = null, lanOn = false, isHost = false, rooms = [], listTimer = null, lastTickKey = '';

  function api() { return (window.JH_API && window.JH_API.lan) || null; }
  function toast(m) { if (UI() && UI().toast) UI().toast(m); }
  function visible() { return !!wrap && !wrap.classList.contains('hidden'); }
  function show() { if (wrap) { wrap.classList.remove('hidden'); document.body.classList.add('in-login'); } }
  



  function hide() { if (wrap) wrap.classList.add('hidden'); document.body.classList.remove('in-login'); }

  function open() {
    if (!api()) { toast('这个版本没有局域网对战（要桌面版）'); return; }
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'lanWrap'; wrap.className = 'hidden'; document.body.appendChild(wrap); }
    lanOn = true; sess = null; rooms = [];
    show(); render();
    if (api().on) api().on(onApiEvent);
    if (api().list) api().list().then(function (r) { if (r && r.ok) { rooms = r.rooms || []; render(); } });
    if (listTimer) clearInterval(listTimer);
    listTimer = setInterval(function () {
      if (!lanOn || sess || !api()) return;
      api().list().then(function (r) { if (r && r.ok) { rooms = r.rooms || []; if (visible()) render(); } });
    }, 1200);
  }

  function close() {
    lanOn = false;
    if (listTimer) { clearInterval(listTimer); listTimer = null; }
    if (sess && api() && api().leave) { try { api().leave(); } catch (e) {} }
    if (sess && sess.end) { try { sess.end(); } catch (e) {} }
    else { try { if (E().lanActive && E().lanActive()) E().lanEnd(); } catch (e) {} }
    sess = null;
    if (hud) { hud.remove(); hud = null; }
    hide();
    document.body.classList.remove('in-login');
    if (UI() && UI().reopenLogin) UI().reopenLogin();
  }

  function onApiEvent(ev) {
    if (!ev || !ev.type) return;
    if (ev.type === 'rooms') { rooms = ev.rooms || []; if (!sess && visible()) render(); return; }
     
    if (ev.type === 'open') { if (sess) { sess.hello(); Render(); } return; }
    if (ev.type === 'peer') { if (sess) { sess.recv(ev.msg); Render(); } return; }
    if (ev.type === 'closed' || ev.type === 'error') {
      if (sess) { sess.peerLeft(); Render(); }
      else toast(ev.type === 'error' ? (ev.text || '连接出了点问题') : '对方离开了');
      return;
    }
  }

   
  function askHost() {
    const box = mkModal('创 建 房 间', '给这间房起个名字（对方在列表里看到的就是它）', '咒术闲录 · 对局', function (name) {
      isHost = true;
      api().host(String(name || '局域网对局').slice(0, 20)).then(function (r) {
        if (!r || !r.ok) { toast(r && r.err ? r.err : '开房失败'); return; }
        attach(r.name || name);
      });
    });
    return box;
  }
  function askJoin(r) {
    mkModal('加 入 这 间 房', '「' + r.name + '」 · ' + r.addr + '　确认后两边一起进预备界面', '', function () {
      isHost = false;
      api().join(r.addr, r.port).then(function (res) {
        if (!res || !res.ok) { toast(res && res.err ? res.err : '连不上这间房'); return; }
        attach(r.name || '局域网对局');
      });
    });
  }
  function attach(roomName) {
    sess = createSession({ host: isHost, name: '咒术师', roomName: roomName,
      send: function (m) { if (api() && api().send) api().send(m); },
      onChange: function () { Render(); } });
    sess.hello();
    Render();
  }
   
  function leaveRoom() {
    if (sess && api() && api().leave) { try { api().leave(); } catch (e) {} }
    if (sess && sess.end) { try { sess.end(); } catch (e) {} }
    else { try { if (E().lanActive && E().lanActive()) E().lanEnd(); } catch (e) {} }
    sess = null; isHost = false;
    if (hud) { hud.remove(); hud = null; }
    if (lanOn) { show(); render(); }
  }
  function mkModal(title, body, input, ok) {
    const box = document.createElement('div');
    box.className = 'lanmodal';
    box.innerHTML = '<div class="lanmbox"><h3>' + esc(title) + '</h3><p>' + esc(body) + '</p>' +
      (input != null ? '<input id="lanModalIn" maxlength="20" value="' + esc(input) + '">' : '') +
      '<div class="lanmfoot"><button class="tbtn" data-no>再想想</button><button class="tbtn" data-yes>确 认</button></div></div>';
    document.body.appendChild(box);
    box.querySelector('[data-no]').onclick = function () { box.remove(); };
    box.querySelector('[data-yes]').onclick = function () {
      const v = input != null ? (box.querySelector('#lanModalIn').value || '') : '';
      box.remove(); ok(v);
    };
    return box;
  }

   
  function Render() {
    if (!sess) { if (lanOn) render(); return; }
    if (sess.phase === PHASE.BATTLE) { if (visible()) hide(); document.body.classList.remove('in-login'); renderHud(); return; }
    if (hud) { hud.remove(); hud = null; }
    if (lanOn) { show(); render(); }
  }
  function render() {
    if (!wrap) return;
    wrap.innerHTML = sess ? viewFlow(sess) : viewLobby();
    if (sess) bindFlow(); else bindLobby();
  }

  function viewLobby() {
    let h = '<div class="lanbox"><div class="lanhead"><b>局 域 网 对 战</b>' +
      '<span>同一个局域网里两个人各拿一台机器，一局临时对局（不进存档）</span></div>';
    h += '<div class="lanrow"><button class="tbtn big" data-lan="host">创 建 房 间</button>' +
         '<span class="lanhint">开好之后，对方会在下面的列表里看到它</span></div>';
    h += '<h4>附近的对局</h4><div class="lanlist">';
    if (!rooms.length) h += '<div class="lanempty">还没看到别人的房间。可以让对方先「创建房间」。</div>';
    for (const r of rooms) {
      h += '<div class="lanroom"><b>' + esc(r.name || '对局') + '</b><span>' + esc(r.addr) + '</span>' +
           '<button class="tbtn" data-lan="join" data-addr="' + esc(r.addr) + '" data-port="' + esc(r.port) + '" data-name="' + esc(r.name || '对局') + '">加 入</button></div>';
    }
    h += '</div>';
    h += '<h4>列表里没有？手填对方地址</h4><div class="lanrow">' +
      '<input id="lanAddr" placeholder="例：192.168.1.23" maxlength="40">' +
      '<input id="lanPort" placeholder="端口（可留空）" maxlength="6">' +
      '<button class="tbtn" data-lan="joinip">直 连</button></div>';
    h += '<div class="lanfoot"><button class="tbtn ghost" data-lan="back">返 回 登 录</button>' +
      '<span class="lanhint">同一台电脑上想自己试两下：另开一个窗口，启动参数加 --lan。</span></div></div>';
    return h;
  }
  function bindLobby() {
    wrap.querySelectorAll('[data-lan]').forEach(function (b) { b.onclick = function () {
      const k = b.dataset.lan;
      if (k === 'host') return askHost();
      if (k === 'join') return askJoin({ name: b.dataset.name, addr: b.dataset.addr, port: +b.dataset.port || 0 });
      if (k === 'joinip') {
        const addr = (wrap.querySelector('#lanAddr').value || '').trim();
        const port = parseInt(wrap.querySelector('#lanPort').value, 10) || 0;
        if (!addr) return toast('先填对方地址');
        return askJoin({ name: '手动地址', addr: addr, port: port });
      }
      if (k === 'back') return close();
    }; });
  }

  function viewFlow(S) {
    let h = '<div class="lanbox"><div class="lanhead"><b>局 域 网 对 局</b><span>' + esc(S.roomName) +
      ' ｜ 你：' + esc(S.myName) + ' ｜ 对方：' + esc(S.peerName || '（还没进来）') + '</span></div>';
    h += '<div class="crsteps">' + STAGE_NAMES.map(function (n, i) {
      return '<span class="' + (i === Math.min(S.stage, 4) ? 'on' : '') + '">' + n + '</span>'; }).join('') + '</div>';
    if (S.peerRules && S.rules && S.peerRules.hash !== S.rules.hash) {
      h += '<div class="lanwarn">对方那台机器的数据和你这一份对不上（自己改过 base / custom？）—— 这一局以房主的数据为准。</div>';
    }
    

    if (S.phase === PHASE.OVER) {
      h += overBody(S);
      h += '<div class="crfoot"><span class="crhint">想接着打就再来一局，两边都按一下。</span>' +
        '<button class="tbtn ghost" data-lan="quit">退 出 对 局</button>' +
        '<button class="tbtn" data-lan="again">再 来 一 局</button></div></div>';
      return h;
    }
    h += (S.stage <= 2) ? stageBody(S, S.stage) : (S.stage === 3 ? revealBody(S) : prepBody(S));
    const hint = S.note || (S.stage === 3 ? '看清楚了就按「下一步 · 出阵准备」。'
      : S.stage === 4 ? (S.readyDone ? (S.peerConfirmed ? '两边都准备好了 —— 这就开打。' : '准备完毕，等对方点「准备完毕」…')
                                     : '额外发了 10000 咒币：买什么、锻什么、带哪几门上场，都由你定。')
      : '选完按「下一步」。');
    h += '<div class="crfoot"><span class="crhint">' + esc(hint) + '</span>' +
      '<button class="tbtn ghost" data-lan="quit">退 出 对 局</button>' +
      '<button class="tbtn" data-lan="back">' + (S.stage === 0 ? '上一步 · 回大厅' : '上一步') + '</button>' +
      (S.stage <= 2 ? '<button class="tbtn" data-lan="next">' + (S.stage === 2 ? '下一步 · 互相确认' : '下一步') + '</button>'
        : S.stage === 3 ? '<button class="tbtn" data-lan="next">下一步 · 出阵准备</button>'
        : '<button class="tbtn" data-lan="prepare"' + (S.readyDone ? ' disabled' : '') + '>' + (S.readyDone ? '已 准 备 完 毕' : '准 备 完 毕') + '</button>') +
      '</div></div>';
    return h;
  }

   
  function overBody(S) {
    const r = S.result || {};
    const win = !!r.win;
    return '<div class="crblock"><div class="subtitle">这一局收场了：<b>' +
      (win ? '胜' : '负') + '</b> · ' + esc(r.why || (win ? '这一局你赢了' : '这一局你输了')) + '</div>' +
      '<div class="hint">两边用的都是临时角色：这一局里的气血 / 咒力 / 装备 / 锻冶记录一样都不写进存档。' +
      '再开一局，两边各自重新选出身、生得术式与技能点。</div></div>';
  }

  function stageBody(S, stage) {
    const d = S.draft;
    if (stage === 0) {
      let h = '<div class="crrow"><label>姓名</label><input id="lanName" maxlength="12" value="' + esc(d.name) + '">' +
        '<span class="hint">最多 12 字</span></div>';
      h += '<div class="crrow"><label>密语</label><input id="lanCode" maxlength="12" placeholder="想起一句话…">' +
        '<button class="tbtn" id="lanCodeBtn">验证</button></div>';
      h += '<div class="crgrid">';
      for (const o of C().visibleOrigins(d)) {
        h += '<div class="crcard' + (d.originId === o.id ? ' on' : '') + '" data-lan-origin="' + o.id + '">' +
          '<div class="crcard-h"><b>' + esc(o.name) + '</b><span class="tag">' + esc(o.tag) + '</span></div>' +
          '<div class="crcard-d">' + esc(o.desc || '') + '</div>' +
          '<div class="crcard-f">' + esc(o.flavor || '') + '</div>' +
          '<div class="crcard-n"><span>术式槽位 ' + o.slots + '</span><span>咒效 / 咒操上限 ' + Math.round(o.ceCap * 1000) / 10 + '%</span></div></div>';
      }
      return h + '</div>';
    }
    if (stage === 1) {
      const o = C().originOf(d), slots = o ? o.slots : 1;
      let h = '<div class="subtitle">这个出身带得走 <b>' + d.techs.length + ' / ' + slots + '</b> 门生得术式。</div><div class="crgrid wide">';
      for (const t of window.JH_INNATE) {
        h += '<div class="crcard' + (d.techs.indexOf(t.id) >= 0 ? ' on' : '') + '" data-lan-tech="' + t.id + '">' +
          '<div class="crcard-h"><b class="q' + t.q + '">' + esc(t.name) + '</b><span class="tag">' + esc(t.element) + '</span></div>' +
          '<div class="crcard-d">' + esc(t.desc || '') + '</div>' +
          '<div class="crcard-f">' + esc(t.passive || '') + '</div></div>';
      }
      return h + '</div>';
    }
    let h = '<div class="crblock"><div class="crrow"><label>悟性</label>' +
      stepBtns('tal', 'insight', d.insight) + '<label style="width:auto;margin-left:14px">根骨</label>' + stepBtns('tal', 'root', d.root) +
      '<span class="hint">两项合计 ' + C().talentSpent(d) + ' / ' + d.talentPool + '</span></div>' +
      '<div class="crrow"><label>福缘</label>' + stepBtns('luck', 'luck', d.luck) +
      '<label style="width:auto;margin-left:14px">颜值</label>' + stepBtns('luck', 'face', d.face) +
      '<span class="hint">两项合计 ' + C().luckSpent(d) + ' / ' + d.luckPool + '</span></div></div>';
    h += '<div class="crblock" style="margin-top:10px"><div class="crrow"><label>属性点</label>' +
      lanCeRow(d, 'eff', '咒效') + lanCeRow(d, 'ctl', '咒操') +
      '<span class="hint">' + C().CE_PTS + ' 点随便分给咒效与咒操（1 点 = 1%）；已用 ' +
      C().cePtsUsed(d) + ' / ' + d.cePool + '</span></div></div>';
    h += '<div class="crblock" style="margin-top:10px"><div class="crrow"><label>技能点</label>' +
      '<b class="lanval">已用 ' + C().pointsUsed(d) + ' / ' + C().pointsCap(d) + '</b><span class="hint">单门最多 ' + C().SKILL_MAX_LV + ' 级</span></div>';
    for (const m of C().allowedCommon(d)) {
      const lv = d.common[m.id] || 0;
      h += '<div class="crskill"><span class="q' + m.q + '">' + esc(m.name) + '</span><span class="hint">' + KIND[m.kind] + '</span>' +
        '<button class="mini2" data-lan-skill="' + m.id + ':-1"' + (lv ? '' : ' disabled') + '>\u2212</button><b>' + lv + '</b>' +
        '<button class="mini2" data-lan-skill="' + m.id + ':1"' + (lv >= C().SKILL_MAX_LV ? ' disabled' : '') + '>+</button></div>';
    }
    return h + '</div>';
  }
   
  function lanCeRow(d, key, label) {
    const v = (d.cePts && d.cePts[key]) || 0;
    const capPts = C().ceCapPts(d, key);
    const left = (d.cePool || C().CE_PTS) - C().cePtsUsed(d);
    const pct = C().ceBaseOf(d, key) + v * C().CE_PT_VALUE;
    return '<label style="width:auto;margin-left:14px">' + label + '</label>' +
      '<button class="mini2" data-lan-ce="' + key + ':-5"' + (v <= 0 ? ' disabled' : '') + '>\u22125</button>' +
      '<button class="mini2" data-lan-ce="' + key + ':-1"' + (v <= 0 ? ' disabled' : '') + '>\u2212</button>' +
      '<b class="lanval">' + v + '</b>' +
      '<button class="mini2" data-lan-ce="' + key + ':1"' + (left <= 0 || v >= capPts ? ' disabled' : '') + '>+</button>' +
      '<button class="mini2" data-lan-ce="' + key + ':5"' + (left <= 0 || v >= capPts ? ' disabled' : '') + '>+5</button>' +
      '<span class="hint">→ ' + (Math.round(pct * 1000) / 10) + '%</span>';
  }

  function stepBtns(kind, key, v) {
    return '<button class="mini2" data-lan-adj="' + kind + ':' + key + ':-5">\u22125</button>' +
           '<b class="lanval">' + v + '</b>' +
           '<button class="mini2" data-lan-adj="' + kind + ':' + key + ':5">+5</button>';
  }

  function loadoutOf(S, mine) {
    if (mine) {
      const d = S.draft, o = C().originOf(d);
      return { name: d.name || S.myName, originName: o ? o.name : '', masked: false,
               techs: d.techs.slice(), common: Object.assign({}, d.common),
               cePts: { eff: (d.cePts && d.cePts.eff) || 0, ctl: (d.cePts && d.cePts.ctl) || 0 },
               stats: previewOf(d) };
    }
    const i0 = S.peerInfo[0], i1 = S.peerInfo[1], i2 = S.peerInfo[2];
    if (!i0) return { name: S.peerName || '对手', originName: '', masked: false, techs: [], common: {}, stats: null, blank: true };
    const masked = !!i0.masked || !i0.origin;
    return { name: i0.name || S.peerName || '对手',
             originName: masked ? (i0.name || S.peerName || '对手') : (i0.originName || ''),
             masked: masked, techs: (i1 && i1.techs) || [], common: (i2 && i2.common) || {},
             stats: (!masked && i2) ? statsOfBuild(i0.origin, i2.attrs, (i1 && i1.techs) || [], i2.common || {}, i2.cePts) : null };
  }
  function nameOfCommon(id) { const m = window.JH_MARTIAL_MAP[id]; return m ? m.name : id; }
  function nameOfInnate(id) { const t = window.JH_INNATE_MAP[id]; return t ? t.name : id; }
  function statLine(st) {
    if (!st) return '<div class="lanstat">—</div>';
    return '<div class="lanstat">气血 ' + st.hpMax + ' · 咒力 ' + st.curMax + ' · 物攻 ' + st.phyAtk + ' · 咒攻 ' + st.curAtk +
      ' · 防御 ' + st.def + ' · 暴击 ' + st.crit + ' · 闪避 ' + st.dodge +
      '<br>咒力效率 ' + (Math.round(st.ceEff * 1000) / 10) + '% · 咒力操作 ' + (Math.round(st.ceCtl * 1000) / 10) + '% · 结界术 ' + Math.round(st.barrier * 100) + '%</div>';
  }
  function colHtml(title, L) {
    let h = '<div class="lancol"><h5>' + esc(title) + '</h5>';
    h += '<div class="lanstat"><b>' + esc(L.name) + '</b></div>';
    h += '<div class="lanstat">出身：' + (L.blank ? '（还没送到）' : esc(L.originName)) + '</div>';
    h += '<div class="lanstat">生得术式：' + (L.techs.length ? L.techs.map(function (t) { return esc(nameOfInnate(t)); }).join(' · ') : '（无）') + '</div>';
    const ks = Object.keys(L.common || {});
    h += '<div class="lanstat">普通技能：' + (ks.length ? ks.map(function (id) { return esc(nameOfCommon(id)) + ' ' + L.common[id] + ' 级'; }).join(' · ') : '（未点）') + '</div>';
    h += statLine(L.stats);
    return h + '</div>';
  }
  function revealBody(S) {
    return '<div class="subtitle">两边在这一步互相看得见对方的全部选择与数值。看清楚了就按「下一步 · 出阵准备」。</div>' +
      '<div class="lancmp">' + colHtml('我（' + (S.host ? '房主 · 左' : '客机 · 右') + '）', loadoutOf(S, true)) +
      colHtml('对方', loadoutOf(S, false)) + '</div>';
  }

  



  function prepBody(S) {
    const e = E(), s = e.s;
    if (!s || !s.lan) return '<div class="subtitle">正在把你这副身子捏出来……</div>';
    const silver = e.LAN_SILVER || 10000;
    let h = '<div class="subtitle">出阵准备：买什么、锻什么、带哪几门术式上场，都由你定 —— 两边各买各的，都点「准备完毕」才开打。</div>';
    h += '<div class="lanpurse"><span>咒币 <b>' + Math.round(s.silver) + '</b></span>' +
      '<span>行囊 ' + Object.keys(s.items || {}).length + ' 项</span>' +
      '<span>砧板上 ' + forgedCount(s) + ' 件</span>' +
      '<span class="hint">出阵准备额外发了 ' + silver + ' 咒币；买完剩多少，就带进对局</span></div>';
    h += statLine(window.JH_combat.stats(s));
    if (S.readyDone) {
      h += '<div class="lanwarn">这一身已经送出去了 —— 现在再改也不作数。等对方点「准备完毕」就开打。</div>';
      return h;
    }
    h += '<div class="lantabs">' + PREP_TABS.map(function (n, i) {
      return '<button class="mini2' + (S.prepTab === i ? ' on' : '') + '" data-lan-tab="' + i + '">' + n + '</button>'; }).join('') + '</div>';
    h += '<div class="lanpanel">' + prepTabBody(S) + '</div>';
    return h;
  }
  function forgedCount(s) {
    let n = 0;
    for (const k of Object.keys(s.forge || {})) { const f = s.forge[k]; if (f && (f.lv || f.clv || f.curse)) n++; }
    return n;
  }
  function prepTabBody(S) {
    if (S.prepTab === 1) return shopBody(S);
    if (S.prepTab === 2) return forgeBody(S);
    if (S.prepTab === 3) return bagBody(S);
    return deployBody(S);
  }
   
  function deployBody(S) {
    const e = E(), s = e.s;
    let h = '<p class="hint">同时能挂上的术式有上限：<b>主动术式</b>同时看悟性 / 咒效 / 咒操；<b>咒力运用</b>看咒操；<b>体术身法</b>看根骨。' +
      '<b>生得术式与其衍生招数不占额</b>（那一系整系都在手上），所以这里只管普适技能。</p>';
    for (const kind of ['atk', 'nei', 'qing']) {
      const cap = e.slotsOf(s, kind), act = e.activeOf(s, kind);
      const list = Object.keys(s.skills || {}).map(function (id) { return window.JH_MARTIAL_MAP[id]; })
        .filter(function (m) { return m && m.kind === kind && !m.innate; });
      const n = act.filter(function (id) { const m = window.JH_MARTIAL_MAP[id]; return m && !m.innate; }).length;
      h += '<h4>' + KIND[kind] + '　<span class="lanstat">已出战 ' + n + ' / ' + (cap >= 99 ? '∞' : cap) + ' 门</span></h4>';
      if (!list.length) h += '<p class="hint">这一类还没学过技能（开局没点到的通用技能，单机里要找组织换；这一局练手用不着）。</p>';
      else h += '<div class="lanchips">' + list.map(function (m) {
        const on = act.indexOf(m.id) >= 0, full = !on && n >= cap;
        return '<button class="mini2' + (on ? ' on' : '') + '" data-lan-deploy="' + kind + ':' + m.id + '"' +
          (full ? ' disabled title="槽位满了：先卸下一门再挂"' : '') + '>' + esc(m.name) + (on ? '（出战）' : '') + '</button>';
      }).join('') + '</div>';
    }
    h += '<h4>生 得 术 式　<span class="lanstat">整系在手，不占额</span></h4>';
    if (!(s.innate || []).length) h += '<p class="hint">这一副身子没有生得术式。</p>';
    for (const tid of (s.innate || [])) {
      const t = window.JH_INNATE_MAP[tid]; if (!t) continue;
      const lv = s.innateLv[tid] || 1;
      const ids = (t.skills || []).filter(function (id) { const m = window.JH_MARTIAL_MAP[id]; return m && (m.lv || 0) <= lv; });
      h += '<div class="laninnate"><b>' + esc(t.name) + '</b>　<span class="hint">熟练度 ' + lv + ' / 10' +
        (t.domain && lv >= 8 ? '　领域：' + esc((window.JH_MARTIAL_MAP[t.domain] || {}).name || '') : '') + '</span><div class="hint">' +
        (ids.length ? ids.map(function (id) { return esc(window.JH_MARTIAL_MAP[id].name); }).join(' · ') : '这一系暂时没有衍生招数') + '</div></div>';
    }
    return h;
  }
   
  const SHOP_GROUPS = [['weapon', '兵 器'], ['armor', '护 具'], ['charm', '佩 饰'], ['boots', '靴 子'],
                       ['pill', '丹 药'], ['food', '食 物'], ['drink', '酒 水'], ['book', '书 册'], ['mat', '材 料']];
  function shopBody(S) {
    const e = E(), s = e.s;
    let h = '<p class="hint">铺子什么都摆，标价照付。装备不叠（同一样只能有一件）；买来的兵器 / 配饰去「锻冶台」上砧板，「行囊」页穿在身上。</p>';
    const all = (window.JH_ITEMS || []).slice();
    for (const g of SHOP_GROUPS) {
      const list = all.filter(function (it) { return it.type === g[0]; });
      if (!list.length) continue;
      h += '<h4>' + g[1] + '</h4><div class="gridentry">';
      for (const it of list) {
        const pr = e.priceOf(it.id);
        const owned = e.isEquipItem(it.id) && e.ownsItem(it.id);
        const poor = s.silver < pr;
        const why = owned ? '已经有一件了（装备不叠）' : poor ? '咒币不够' : '';
        h += '<div class="entry"><div class="en"><span class="' + qclass(it.q) + '">' + esc(it.name) + '</span><span class="q">' + pr + ' 咒币</span></div>' +
          '<div class="ed">' + esc(it.desc || '') + '</div>' +
          '<div style="margin-top:8px"><button class="mini2" data-lan-buy="' + it.id + '"' +
          (why ? ' disabled title="' + esc(why) + '"' : '') + '>买 下</button></div></div>';
      }
      h += '</div>';
    }
    return h;
  }
   
  function forgeBody(S) {
    const e = E(), s = e.s, F = window.JH_FORGE || {};
    const cand = [];
    const add = function (id) { const it = window.JH_ITEM_MAP[id]; if (it && (it.type === 'weapon' || it.type === 'charm') && cand.indexOf(id) < 0) cand.push(id); };
    for (const slot of ['weapon', 'charm']) if (s.equip && s.equip[slot]) add(s.equip[slot]);
    for (const k of Object.keys(s.items || {})) add(k);
    let id = (S.forgeSel && cand.indexOf(S.forgeSel) >= 0) ? S.forgeSel
      : (s.equip && s.equip.weapon && cand.indexOf(s.equip.weapon) >= 0) ? s.equip.weapon : (cand[0] || null);
    S.forgeSel = id;
    if (!id) return '<p class="hint">手里还没有能上砧板的东西 —— 先去「兵器铺」买一件兵器或配饰，再回这里。</p>';
    const it = window.JH_ITEM_MAP[id], f = e.forgeOf(id);
    let h = '<h4>砧 板</h4><div class="lanchips">' + cand.map(function (k) {
      const it0 = window.JH_ITEM_MAP[k], f0 = s.forge[k] || {};
      const tag0 = f0.curse ? ('咒具 +' + f0.clv) : (f0.lv ? ('普通 +' + f0.lv) : '未锻');
      return '<button class="mini2' + (k === id ? ' on' : '') + '" data-lan-forge="pick:' + k + '">' + esc(it0.name) + '（' + tag0 + '）</button>';
    }).join('') + '</div>';
    h += '<div class="entry"><div class="en"><span class="' + qclass(it.q) + '">' + esc(f.curse ? ('咒具·' + it.name) : it.name) + '</span>' +
      '<span class="q">' + (f.curse ? '咒具' : '普通兵刃') + ' · ' + (f.curse ? ('咒具强化 +' + f.clv) : ('普通强化 +' + f.lv)) + ' · 数值 +' + (e.forgePct(id) * 100).toFixed(1) + '%</span></div>' +
      '<div class="ed">' + esc(it.desc || '') + '</div></div>';
    h += '<h4>锻 打</h4>';
    if (!f.curse) {
      const maxed = f.lv >= (F.maxLv || 10), c = costHtml(e, F.lvCost(f.lv));
      h += '<div class="entry"><div class="en"><span>普通强化</span><span class="q">+' + f.lv + ' / +' + (F.maxLv || 10) + '</span></div>' +
        '<div class="ed">用咒铁、咒骨一类普通材料往上锻（每级 0.5% ~ 2%，满级 +11.5%）。<b>一旦强化过，这件兵器就不能再咒具化了。</b></div>' +
        '<div style="margin-top:8px">' + (maxed ? '<span class="hint">已经锻到顶了。</span>'
          : '<button class="mini2" data-lan-forge="up"' + (c.ok ? '' : ' disabled title="' + esc(c.gap) + '"') + '>锻到 +' + (f.lv + 1) + '　（' + esc(c.txt) + '）</button>') +
        '</div></div>';
      const cc = costHtml(e, F.curseCost);
      const held = !!(s.equip && (s.equip.weapon === id || s.equip.charm === id));
      const canCurse = e.curseAllowed() && held;
      const reason = !e.curseAllowed() ? '咒具认人：只有某种特殊出身才拿得动。'
        : !held ? '先把它带在身上（兵器栏或佩饰栏），才淬得进咒力。'
        : f.lv > 0 ? '这件已经强化过，淬不进咒力了 —— 换一件没动过的底子。' : '';
      h += '<div class="entry"><div class="en"><span>咒具化</span><span class="q">' + (canCurse ? '可用' : '不可用') + '</span></div>' +
        '<div class="ed">用咒金、咒具碎片与咒玉把普通兵器升成咒具：<b>继承原数值</b>，并解锁 3 个词条槽（+3 / +6 / +9 各开一个）。</div>' +
        '<div style="margin-top:8px">' + (reason ? '<span class="hint">' + esc(reason) + '</span>'
          : '<button class="mini2" data-lan-forge="curse"' + (cc.ok ? '' : ' disabled title="' + esc(cc.gap) + '"') + '>咒具化　（' + esc(cc.txt) + '）</button>') +
        '</div></div>';
    } else {
      const maxed = f.clv >= (F.maxLv || 10), c = costHtml(e, F.clvCost(f.clv));
      h += '<div class="entry"><div class="en"><span>咒具强化</span><span class="q">+' + f.clv + ' / +' + (F.maxLv || 10) + '</span></div>' +
        '<div class="ed">用咒金与咒具碎片往上锻 —— 每级给的数值和普通线<b>完全一样</b>，多的只是词条。</div>' +
        '<div style="margin-top:8px">' + (maxed ? '<span class="hint">已经锻到顶了。</span>'
          : '<button class="mini2" data-lan-forge="cup"' + (c.ok ? '' : ' disabled title="' + esc(c.gap) + '"') + '>锻到 +' + (f.clv + 1) + '　（' + esc(c.txt) + '）</button>') +
        '</div></div>';
      h += '<h4>词 条 槽</h4>';
      const at = F.slotsAt || [3, 6, 9];
      for (let i = 0; i < 3; i++) {
        const open = f.clv >= at[i], wid = f.slots[i], w = wid && window.JH_WORD_MAP[wid], cc = costHtml(e, F.carveCost);
        h += '<div class="entry"><div class="en"><span>第 ' + (i + 1) + ' 槽</span><span class="q">' + (open ? (w ? esc(w.name) : '空') : ('要 +' + at[i])) + '</span></div>';
        if (!open) h += '<div class="ed">把咒具强化到 +' + at[i] + ' 才会开这一槽。</div>';
        else if (w) h += '<div class="ed">' + esc(w.desc || '') + '</div><div style="margin-top:8px"><button class="mini2" data-lan-forge="uncarve:' + i + '">磨掉（材料不退）</button></div>';
        else h += '<div class="ed">空着 —— 刻一条词条进去（概率抽取；标着「每件限一条」的，一件咒具只刻得上一次）。</div>' +
          '<div style="margin-top:8px"><button class="mini2" data-lan-forge="carve:' + i + '"' + (cc.ok ? '' : ' disabled title="' + esc(cc.gap) + '"') + '>抽一条刻上去　（' + esc(cc.txt) + '）</button></div>';
        h += '</div>';
      }
      const hasStore = (f.slots || []).indexOf('w_store') >= 0;
      if (hasStore || f.store) {
        const sm = f.store ? window.JH_MARTIAL_MAP[f.store] : null;
        h += '<div class="entry"><div class="en"><span>咒术存储标签</span><span class="q">' + (f.store ? ('存着「' + esc(sm ? sm.name : f.store) + '」') : '空着（可吸一门）') + '</span></div>' +
          '<div class="ed">这件咒具上刻着「咒术存储」：带着标签、还没存东西时用不出存储技能；对阵页先按「吸·（空）」亮出咒具，对手下一手若是术式就被整口吞下（代价是双倍伤害）。用掉或在这里主动放弃，标签才空出来。</div>' +
          (f.store ? '<div style="margin-top:8px"><button class="mini2" data-lan-forge="dropstore">放弃存着的这门术式</button></div>' : '') + '</div>';
      }
    }
    const mats = ['mat_steel', 'mat_bone', 'mat_gold', 'mat_shard', 'mat_jade', 'mat_silk'];
    h += '<h4>手 上 的 材 料</h4><div class="lanchips">' + mats.map(function (m) {
      const mm = window.JH_ITEM_MAP[m];
      return mm ? '<span class="mini2">' + esc(mm.name) + ' ×' + (s.items[m] || 0) + '</span>' : '';
    }).join('') + '</div>';
    h += '<p class="hint">三条限制：① 普通兵器一旦强化过，就不能再咒具化；② 只有某种特殊出身才拿得动咒具；③ 一个人身上最多同时带 <b>' + (e.MAX_CURSE_EQUIP || 2) + ' 件</b>咒具。材料在「兵器铺」的「材料」一栏买得到。</p>';
    return h;
  }
   
  function bagBody(S) {
    const e = E(), s = e.s;
    let h = '<h4>身 上</h4><div class="lanchips">';
    for (const k of Object.keys(EQ_SLOT)) {
      const id = s.equip && s.equip[k];
      const f = id ? (s.forge[id] || {}) : {};
      h += '<span class="mini2">' + EQ_SLOT[k] + '：' + (id ? esc(window.JH_ITEM_MAP[id].name) + (f.curse ? '（咒具 +' + f.clv + '）' : f.lv ? '（强化 +' + f.lv + '）' : '') : '空') +
        (id ? ' <button class="mini2" data-lan-unequip="' + k + '">卸下</button>' : '') + '</span>';
    }
    h += '</div><h4>行 囊</h4>';
    const ks = Object.keys(s.items || {});
    if (!ks.length) h += '<p class="hint">空空如也 —— 去「兵器铺」买点东西。</p>';
    else {
      h += '<div class="gridentry">';
      for (const id of ks) {
        const it = window.JH_ITEM_MAP[id]; if (!it) continue;
        const n = s.items[id], f = s.forge[id] || {};
        h += '<div class="entry"><div class="en"><span class="' + qclass(it.q) + '">' + esc(it.name) + (n > 1 ? ' ×' + n : '') + '</span>' +
          '<span class="q">' + (f.curse ? ('咒具 +' + f.clv) : f.lv ? ('强化 +' + f.lv) : '') + '</span></div>' +
          '<div class="ed">' + esc(it.desc || '') + '</div>' +
          '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
          (e.isEquipItem(id) ? '<button class="mini2" data-lan-equip="' + id + '">装备</button>' : '') +
          '<button class="mini2" data-lan-drop="' + id + '">丢弃</button></div></div>';
      }
      h += '</div>';
    }
    h += '<p class="hint">装备不叠（同一样只能有一件）；想丢带在身上的那件，先卸下来。</p>';
    return h;
  }
   
  function costHtml(e, cost) {
    const gap = e.costGap(cost);
    return { txt: e.costText(cost), ok: gap.length === 0, gap: gap.join('、') };
  }
  function bindFlow() {
    const S = sess; if (!S) return;
     
    wrap.querySelectorAll('[data-lan-tab]').forEach(function (b) { b.onclick = function () { S.prepTab = +b.dataset.lanTab || 0; Render(); }; });
    wrap.querySelectorAll('[data-lan-deploy]').forEach(function (b) { b.onclick = function () {
      const p = b.dataset.lanDeploy.split(':'); E().setTech(p[1]); Render();
    }; });
    wrap.querySelectorAll('[data-lan-buy]').forEach(function (b) { b.onclick = function () { E().buy(b.dataset.lanBuy); Render(); }; });
    wrap.querySelectorAll('[data-lan-forge]').forEach(function (b) { b.onclick = function () {
      const e = E(), v = b.dataset.lanForge;
      if (v.indexOf('pick:') === 0) { S.forgeSel = v.slice(5); Render(); return; }
      const sid = S.forgeSel || (e.s.equip && e.s.equip.weapon);
      if (!sid) { toast('砧板上没东西'); return; }
      if (v === 'up') e.forgeUp(sid);
      else if (v === 'curse') e.curseUp(sid);
      else if (v === 'cup') e.curseForgeUp(sid);
      else if (v.indexOf('uncarve:') === 0) e.uncarveWord(sid, +v.slice(8));
      else if (v.indexOf('carve:') === 0) e.carveDraw(sid, +v.slice(6));
      else if (v === 'dropstore') e.dropStored(sid);
      Render();
    }; });
    wrap.querySelectorAll('[data-lan-equip]').forEach(function (b) { b.onclick = function () { E().equip(b.dataset.lanEquip); Render(); }; });
    wrap.querySelectorAll('[data-lan-unequip]').forEach(function (b) { b.onclick = function () { E().unequip(b.dataset.lanUnequip); Render(); }; });
    wrap.querySelectorAll('[data-lan-drop]').forEach(function (b) { b.onclick = function () { E().dropItem(b.dataset.lanDrop); Render(); }; });
    const nm = wrap.querySelector('#lanName');
    if (nm) nm.oninput = function () { S.setName(nm.value); };
    const cb = wrap.querySelector('#lanCodeBtn');
    if (cb) cb.onclick = function () {
      const v = (wrap.querySelector('#lanCode').value || '').trim();
      if (!C().unlockByCode(S.draft, v)) { S.note = '你什么也没想起来。'; Render(); return; }
      Render();
    };
    wrap.querySelectorAll('[data-lan-origin]').forEach(function (c) { c.onclick = function () { C().pickOrigin(S.draft, c.dataset.lanOrigin); Render(); }; });
    wrap.querySelectorAll('[data-lan-tech]').forEach(function (c) { c.onclick = function () { C().toggleTech(S.draft, c.dataset.lanTech); Render(); }; });
    wrap.querySelectorAll('[data-lan-ce]').forEach(function (b) { b.onclick = function () {
      const p = b.dataset.lanCe.split(':');
      C().adjCe(S.draft, p[0], +p[1]);
      Render();
    }; });
    wrap.querySelectorAll('[data-lan-adj]').forEach(function (b) { b.onclick = function () {
      const p = b.dataset.lanAdj.split(':');
      if (p[0] === 'tal') C().adjTalent(S.draft, p[1], +p[2]); else C().adjLuck(S.draft, p[1], +p[2]);
      Render();
    }; });
    wrap.querySelectorAll('[data-lan-skill]').forEach(function (b) { b.onclick = function () {
      const p = b.dataset.lanSkill.split(':');
      C().spendPoint(S.draft, p[0], +p[1]); Render();
    }; });
    wrap.querySelectorAll('[data-lan]').forEach(function (b) { b.onclick = function () {
      const k = b.dataset.lan;
      if (k === 'next') S.next();
      else if (k === 'back') { if (S.stage === 0) leaveRoom(); else S.back(); }
      else if (k === 'quit') close();
      else if (k === 'prepare') S.prepare();
      else if (k === 'again') S.again();
      Render();
    }; });
  }

   
  function renderHud() {
    if (!sess || sess.phase !== PHASE.BATTLE) { if (hud) { hud.remove(); hud = null; } return; }
    if (!hud) { hud = document.createElement('div'); hud.id = 'lanHud'; document.body.appendChild(hud); }
    const wait = !!sess.myAct && !sess.peerAct;
    

    let line = sess.myAct ? (wait ? '已出招，等对方…' : '两边都出完了…') : '轮到你出招';
    if (sess.running) {
      const sec = Math.max(0, Math.round((Date.now() - (sess.runningAt || Date.now())) / 1000));
      line = '这一手在演…' + (sec >= 3 ? '（' + sec + ' 秒）' : '');
      if (sec >= 8) line += ' 卡住了，正在自动恢复…';
    } else if (wait && sess.waitAt) {
      const sec = Math.max(0, Math.round((Date.now() - sess.waitAt) / 1000));
      if (sec >= 8) line = '等对方出招…（' + sec + ' 秒，一直不来就当他发呆）';
    }
    hud.innerHTML = '<b>局域网对局</b><span>第 ' + sess.round + ' 回合</span><span>' +
      line + '</span>' +
      '<span class="lanhudl">' + esc(sess.roomName) + '</span>';
    const btns = document.querySelectorAll('#main [data-battle]');
    for (let i = 0; i < btns.length; i++) {
       
      if (sess.myAct || sess.running) btns[i].setAttribute('disabled', '1'); else btns[i].removeAttribute('disabled');
    }
  }

  


  let lastDump = 0;
  function dumpLan(tag, extra) {
    const now = Date.now();
    if (now - lastDump < 2000) return;
    lastDump = now;
    try {
      const a = window.JH_API;
      if (!a || !a.exportFile) return;
      const b = (E() && E().getBattle) ? E().getBattle() : null;
      const S = sess, me = E().s;
      const L = [];
      L.push('时间：' + new Date().toLocaleString());
      L.push('标记：' + tag + (extra ? '（' + extra + '）' : ''));
      if (S) {
        L.push('阶段：' + S.phase + ' · 会话回合 ' + S.round + ' · 对局回合 ' + (b ? b.round : '-'));
        L.push('running=' + !!S.running +
               ' · 界面在演=' + !!(UI() && UI().battle && UI().battle.busy()) +
               ' · stallN=' + (S.stallN || 0) + ' · voided=' + (S.voided || 0) +
               ' · 演出没接住=' + (S.runningMiss || 0));
        L.push('我这一手：' + (S.myAct ? S.myAct.type + '/' + (S.myAct.id || '') : '-') +
               ' ｜ 对面这一手：' + (S.peerAct ? S.peerAct.type + '/' + (S.peerAct.id || '') : '-'));
      }
      if (me) L.push('我：' + Math.round(me.hp || 0) + ' 血 / ' + Math.round(me.cur || 0) + ' 咒力');
      if (b && b.foe) L.push('对面：' + Math.round(b.foe.hp || 0) + ' 血 / ' + Math.round(b.foe.cur || 0) + ' 咒力');
      try { if (UI() && UI().battle && UI().battle.fx) L.push('场上特效：' + JSON.stringify(UI().battle.fx()).slice(0, 1200)); } catch (e) {}
      a.exportFile('lan-error.txt', L.join(String.fromCharCode(10)));
    } catch (e) {}
  }
  window.JH_lanDump = dumpLan;
   
  window.addEventListener('error', function (ev) {
    if (!lanOn) return;
    dumpLan('脚本报错', ((ev && ev.message) || '') + ' @ ' + ((ev && ev.filename) || '') + ':' + ((ev && ev.lineno) || 0));
  });
  window.addEventListener('unhandledrejection', function (ev) {
    if (!lanOn) return;
    const r = ev && ev.reason;
    dumpLan('未处理的报错', String((r && r.message) || r || ''));
  });

  window.JH_room = {
    open: open, close: close,
    active: function () { return lanOn; },
    inBattle: function () { return !!(sess && sess.phase === PHASE.BATTLE); },
    onAction: function (act) {
      if (!lanOn || !sess || sess.phase !== PHASE.BATTLE) return false;
      const ok = sess.submit(act);
      if (!ok) toast('这一手已经出了 —— 等这一回合演完。');    
      renderHud();
      return true;
    },
    tick: function () {
      if (!lanOn) return;
      if (sess && sess.phase === PHASE.BATTLE) {
        sess.roundDone();
        



        const key = sess.round + '|' + (sess.myAct ? 1 : 0) + '|' + (sess.running ? 1 : 0) + '|' + (sess.rev || 0);
        if (key !== lastTickKey) { lastTickKey = key; if (UI() && UI().render) UI().render(); }
        renderHud();
        return;
      }
      lastTickKey = '';
      if (sess && (sess.phase === PHASE.OVER || sess.phase === PHASE.PREP || sess.phase === PHASE.LOBBY) && !visible()) { show(); render(); }
    },
    state: function () { return sess; }
  };
})();
