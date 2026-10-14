/* 界面：各个页面、对战面板、弹层、音乐盒。 */
(function () {
  'use strict';
  const E = () => window.JH.engine;
  let forgeTarget = null;    
  const API = window.JH_API || null;   
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const pct = (a, b) => Math.max(0, Math.min(100, b ? (a / b) * 100 : 0));

  let view = 'room';
  let mapRegion = null;      
  let lastMapScene = null;   
  let saveTick = 0;
   
  let saveOff = false;
  let lastLogLen = -1;
  let lastEventKey = '';
  let attrsSig = '';

   
  const Store = {
    async save(text) {
      if (API) return await API.save(text);
      localStorage.setItem('jh_save', text); return { ok: true };
    },
    async load() {
      if (API) return await API.load();
      return { ok: true, data: localStorage.getItem('jh_save') };
    },
    async reset() {
      if (API) return await API.reset();
      localStorage.removeItem('jh_save'); return { ok: true };
    },
    async dir() {
      if (API) return await API.dir();
      return '(浏览器环境，无目录)';
    },
    async exportFile(name, text) {
      if (API) return await API.exportFile(name, text);
      return { ok: false, error: '仅桌面版可用' };
    }
  };

   
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    $('toast').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.4s'; }, 1800);
    setTimeout(() => t.remove(), 2300);
  }
  const QNAME = () => window.JH_QUALITY_NAMES;
  function qclass(q) { return 'q' + (q || 0); }
  function itemName(id) { const it = window.JH_ITEM_MAP[id]; return it ? it.name : id; }
  function matName(id) { const m = window.JH_MARTIAL_MAP[id]; return m ? m.name : id; }

  function modal(title, bodyHtml, buttons) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = bodyHtml;
    const foot = $('modalFoot'); foot.innerHTML = '';
    for (const b of (buttons || [{ label: '知道了' }])) {
      const el = document.createElement('button');
      el.className = 'tbtn'; el.textContent = b.label;
      el.onclick = () => { closeModal(); if (b.onClick) b.onClick(); };
      foot.appendChild(el);
    }
    $('modalWrap').classList.remove('hidden');
  }
  function closeModal() { $('modalWrap').classList.add('hidden'); }

   
   
  function statusSig() {
    return window.JH_combat.playerStatus(E().s).map(x => x.n).join(',');
  }
  function statusLine() {
    const list = window.JH_combat.playerStatus(E().s);
    if (!list.length) return '';
    const chips = list.map(x => '<span class="buffchip ' + x.k + '" data-tip="' + esc(x.d) + '">' + esc(x.n) + '</span>').join('');
    return '<div class="pstat"><span class="pstatk">状态</span>' + chips + '</div>';
  }

  function renderStats() {
    const e = E(), s = e.s, p = e.panel(), st = p.st;
    $('playerName').textContent = s.name;
    $('clock').textContent = p.clock;
    $('realmName').textContent = p.realm.name;
    $('sectLabel').textContent = window.JH_SECT_MAP[s.sect] ? window.JH_SECT_MAP[s.sect].name : '无门无派';

    const need = p.need;
    $('barExp').style.width = pct(s.exp, need) + '%';
    $('txtExp').textContent = `修为 ${Math.floor(s.exp)} / ${need}`;
    $('barHp').style.width = pct(s.hp, st.hpMax) + '%';
    $('txtHp').textContent = `气血 ${Math.round(s.hp)} / ${Math.round(st.hpMax)}`;
    $('barMp').style.width = pct(s.cur, st.curMax) + '%';
    $('txtMp').textContent = `咒力 ${Math.round(s.cur)} / ${Math.round(st.curMax)}`;
    const staMax = 100 + s.realm * 10;
    $('barSta').style.width = pct(s.sta, staMax) + '%';
    $('txtSta').textContent = `精力 ${Math.round(s.sta)} / ${staMax}`;

    if (e.devEditable()) {
       
      const DF = [
        ['insight', '悟性', st.insight], ['root', '根骨', st.root],
        ['luck', '福缘', st.luck], ['face', '颜值', st.face],
        ['eff', '咒效%', (st.ceEff * 100).toFixed(1)], ['ctl', '咒操%', (st.ceCtl * 100).toFixed(1)],
        ['cap', '咒上限%', (st.ceCap * 100).toFixed(1)],
        ['hp', '气血', Math.round(s.hp)], ['cur', '咒力', Math.round(s.cur)], ['sta', '精力', Math.round(s.sta)],
        ['sp', '技能点', s.sp || 0], ['exp', '修为', Math.floor(s.exp)], ['silver', '咒币', Math.floor(s.silver)],
        ['curBonus', '咒量加成', s.curBonus || 0], ['realm', '境界序', s.realm]
      ];
      const sig = DF.map(x => x[2]).join('|') + '|ca' + st.curAtkBase + '||' + statusSig();
      if (sig !== attrsSig) {
        attrsSig = sig;
        $('attrs').innerHTML = '<div class="devhint">调试出身：下列数值可直接改（回车生效）</div>' +
          DF.map(x => `<label>${x[1]} <input data-dev="${x[0]}" value="${x[2]}"></label>`).join('') +
          `<div>物理 <b>${st.phyAtk}</b></div><div>咒攻 <b>${st.curAtk}</b></div>` +
          `<div>基础咒攻 <b>${st.curAtkBase}</b></div>` +
          `<div>防御 <b>${st.def}</b></div><div>暴击 <b>${st.crit}%</b></div>` +
          `<div>黑闪 <b>${st.bfRate}%</b>${st.bf ? '（增益 ×' + st.bf + '）' : ''}</div>` + statusLine() +
          `<div style="margin-top:6px"><button class="mini2" data-devstory="1" title="列出全部剧情，点哪段进哪段（不会自动连播）">剧情调试台</button></div>`;
      }
    } else {
      attrsSig = '';
      $('attrs').innerHTML =
        `<div>悟性 <b>${st.insight}</b></div><div>根骨 <b>${st.root}</b></div>` +
        `<div>福缘 <b>${st.luck}</b></div><div>颜值 <b>${st.face}</b></div>` +
        `<div>咒效 <b>${(st.ceEff * 100).toFixed(1)}%</b></div><div>咒操 <b>${(st.ceCtl * 100).toFixed(1)}%</b></div>` +
        `<div>物理 <b>${st.phyAtk}</b></div><div>咒攻 <b>${st.curAtk}</b></div>` +
        `<div>基础咒攻 <b>${st.curAtkBase}</b></div>` +
        `<div>防御 <b>${st.def}</b></div><div>暴击 <b>${st.crit}%</b></div>` +
        `<div>黑闪 <b>${st.bfRate}%</b>${st.bf ? '（增益 ×' + st.bf + '）' : ''}</div><div>技能点 <b>${s.sp || 0}</b></div>` + statusLine();
    }    $('txtSilver').textContent = `咒币 ${Math.floor(s.silver)}`;
    $('txtContrib').textContent = `贡献 ${s.contrib}`;
    $('txtKills').textContent = `胜 ${s.c.win}·负 ${s.c.lose}`;

    const bb = $('btnBreak');
    bb.disabled = !p.canBreak && s.realm >= e.REALMS.length - 1;
    bb.classList.toggle('ready', p.canBreak);
    bb.textContent = s.realm >= e.REALMS.length - 1 ? '已至终境' : (p.canBreak ? '★ 可以突破' : '突破境界');

    const ib = $('btnIdle');
    ib.textContent = '挂机：' + (s.idle.on ? '开' : '关');
    ib.style.color = s.idle.on ? 'var(--jade)' : '';
  }

  



  let logPage = 0;
  function logMediaFiles() { return Array.isArray(window.JH_CUSTOM_MEDIA) ? window.JH_CUSTOM_MEDIA : []; }
  function logPages() {
    const out = [{ kind: 'log', name: '见闻' }];
    for (const p of logMediaFiles()) {
      const f = String(p || '');
      if (!f) continue;
      const nm = f.slice(f.lastIndexOf('/') + 1);
      out.push({ kind: /\.(mp4|webm|ogv|ogg|m4v|mov)$/i.test(f) ? 'video' : 'img', name: nm, src: f });
    }
    return out;
  }
  function logGo(step) {
    const n = logPages().length;
    if (n < 2) return;
    logPage = ((logPage + step) % n + n) % n;
    const main = $('main');
    if (main && main.querySelector('.logview')) refreshLogView();
  }
  

  function refreshLogView() {
    const stage = $('logStage'), full = $('logFull');
    if (!stage || !full) return;
    const pages = logPages();
    if (logPage >= pages.length) logPage = 0;
    const page = pages[logPage] || pages[0], multi = pages.length > 1;
    const prev = $('btnLogPrev'), next = $('btnLogNext');
    if (prev) prev.classList.toggle('hidden', !multi);
    if (next) next.classList.toggle('hidden', !multi);
    const title = $('mediaTitle'), cnt = $('mediaCount');
    if (title) title.textContent = page.name || '见闻';
    if (cnt) cnt.textContent = multi ? ((logPage + 1) + ' / ' + pages.length) : '';
    const onLog = page.kind === 'log';
    stage.classList.toggle('hidden', onLog);
    full.classList.toggle('hidden', !onLog);
    const key = onLog ? 'log' : (logPage + '|' + page.src);
    if (stage.dataset.key !== key) {          
      stage.dataset.key = key;
      stage.innerHTML = onLog ? '' : (page.kind === 'video'
        ? '<video class="logvid" src="' + esc(page.src) + '" autoplay loop playsinline controls></video>'
        : '<img class="logimg" src="' + esc(page.src) + '" alt="' + esc(page.name) + '">');
    }
    if (!onLog) return;
    const s = E().s;
    if (full.dataset.n === String(s.log.length)) return;
    full.dataset.n = String(s.log.length);
    full.innerHTML = s.log.slice(-400).map(x => '<div class="lg-' + (x.cls || 'info') + '">' + esc(x.text) + '</div>').join('') || '（空白）';
  }
  function renderLog() {
    const s = E().s;
    if (s.log.length === lastLogLen) return;
    lastLogLen = s.log.length;
    const box = $('logList');
    if (!box) return;
    const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
    box.innerHTML = s.log.slice(-200).map(x => {
      const cls = 'lg-' + (x.cls || 'info');
      return `<div class="${cls}">${esc(x.text)}</div>`;
    }).join('');
    if (atBottom) box.scrollTop = box.scrollHeight;
  }

  


  const MTN = {
    r3: 'M0,152 L92,108 L152,132 L232,76 L302,120 L382,90 L470,140 L560,94 L652,138 L742,102 L832,142 L922,108 L1012,146 L1102,116 L1200,150 L1200,262 L0,262 Z',
    r2: 'M0,192 L122,156 L212,180 L302,138 L402,172 L502,148 L612,184 L702,154 L802,186 L902,158 L1002,188 L1102,166 L1200,192 L1200,262 L0,262 Z',
    r1: 'M0,232 L142,214 L282,228 L422,206 L562,226 L702,208 L842,230 L982,212 L1122,230 L1200,220 L1200,262 L0,262 Z'
  };
  function inkMtn(cls) {
    return '<svg class="inkmtn ' + (cls || '') + '" viewBox="0 0 1200 262" preserveAspectRatio="none" aria-hidden="true">' +
      '<path class="r3" d="' + MTN.r3 + '"/>' +
      '<path class="r2" d="' + MTN.r2 + '"/>' +
      '<path class="r1" d="' + MTN.r1 + '"/></svg>';
  }

   
  function render() {
    if (!E().s) return;      
    renderStats();
    renderLog();
    const e = E(), s = e.s;
    if (s.scene !== lastMapScene) { lastMapScene = s.scene; mapRegion = null; }    
    const cur = e.curEvent();
    const key = cur ? cur.id + ':' + cur.nodeId : '';
    if (key !== lastEventKey) { lastEventKey = key; }

    if (e.getBattle()) { renderStory(null); renderBattle(); return; }   

    renderStory(cur);

    const main = $('main');
    const st = main.scrollTop;
    if (view === 'room') main.innerHTML = viewRoom();
    else if (view === 'map') main.innerHTML = viewMap();
    else if (view === 'bag') main.innerHTML = viewBag();
    else if (view === 'forge') main.innerHTML = viewForge();
    else if (view === 'skill') main.innerHTML = viewSkill();
    else if (view === 'sect') main.innerHTML = viewSect();
    else if (view === 'codex') main.innerHTML = viewCodex();
    else if (view === 'egg') main.innerHTML = viewEgg();
    else if (view === 'log') { if (!main.querySelector('.logview')) main.innerHTML = viewLog(); refreshLogView(); }
    else if (view === 'help') main.innerHTML = viewHelp();
    main.scrollTop = st;
    bindMain();
    fitMapImg(main);       
  }
  

  function fitMapImg(root) {
    if (!root || !root.querySelector) return;
    const box = root.querySelector('.mapsys.hasmap');
    if (!box) return;
    const bg = box.querySelector('.mapbg');
    const url = (bg && bg.getAttribute('data-img')) || '';
    if (!url || box.getAttribute('data-ar') === url) return;
    box.setAttribute('data-ar', url);
    const probe = new Image();
    probe.onload = function () {
      const w = probe.naturalWidth, h = probe.naturalHeight;
      if (!w || !h) return;
      box.style.aspectRatio = String(w) + ' / ' + String(h);
    };
    probe.onerror = function () { box.style.aspectRatio = '16 / 9'; };
    probe.src = url;
  }

   
  function viewRoom() {
    const e = E(), s = e.s;
    const r = window.JH_ROOM_MAP[s.room], sc = window.JH_SCENE_MAP[s.scene];
    if (!r) return '<p>你站在一片空白里。</p>';
    let h = `<div class="roomhead"><span class="roomname">${esc(r.name)}</span>
      <span class="scenename">${esc(sc ? sc.name : '')} · ${esc(e.shichenName(s))}</span></div>
      <div class="roomdesc">${esc(r.desc)}</div>
      <div class="inkband">${inkMtn()}</div>
    `;

    if (s.travel) {

      const ts = window.JH_SCENE_MAP[s.travel.scene];
      h += `<div class="hint" style="color:var(--jade)">${s.travel.cross ? '远渡中' : '赶路中'}：前往「${esc(ts ? ts.name : '?')}」，还需 ${esc(e.durText(Math.max(0, s.travel.until - s.t)))}。</div>`;
    } else if (s.act) {
      h += `<div class="hint" style="color:var(--jade)">${s.act.kind === 'meditate' ? '打坐中' : '休息中'}：咒力 ${Math.round(s.cur)} / ${e.stats().curMax}${s.act.kind === 'rest' && e.atHome() ? `　精力 ${Math.round(s.sta)} / ${e.staMax()}` : ''}</div>`;
    }
    h += '<div class="actbar">';
    h += `<button class="act cost" data-act="search">搜寻此地</button>`;
    h += `<button class="act danger" data-act="fight">寻敌试招</button>`;
    if (e.atHome()) h += `<button class="act" data-act="dummy" data-tip="对着木桩随便试招：不耗咒力、木桩不还手、无限气血">木桩·试招</button>`;
    if (e.atHome()) h += `<button class="act" data-act="mirror" data-tip="镜屋的镜子：照出一个「另一个自己」。数值与术式随你填，开打后可随时换视角 —— 握着哪一边，另一边就交给电脑。">镜屋·试招</button>`;
    h += `<button class="act ${s.act && s.act.kind === 'rest' ? 'on' : ''}" data-act2="rest">${s.act && s.act.kind === 'rest' ? '停止休息' : '休息'}</button>`;
    h += `<button class="act ${s.act && s.act.kind === 'meditate' ? 'on' : ''}" data-act2="meditate">${s.act && s.act.kind === 'meditate' ? '停止打坐' : '打坐'}</button>`;
    const boss = e.bossReady();
    if (boss) h += `<button class="act danger" data-act="boss">挑战头目：${esc(boss.name)}</button>`;
    const ACT_LABEL = { gather:'采药', fish:'垂钓', drink:'小酌', work:'做工',
                        listen:'聆听', read:'读书', weave:'纺织', brew:'看火', craft:'制器', forge:'打铁', pray:'参拜' };
    for (const a of (r.actions || [])) { if (a === 'rest' || a === 'meditate') continue; h += `<button class="act cost" data-doact="${a}">${ACT_LABEL[a] || a}</button>`; }
    h += `<button class="act" data-view2="map">去别处</button>`;
    h += '</div>';
    h += outBar();
    h += `<div class="hint">已祓除 ${s.clear[s.scene] || 0} / ${e.bossGate()}（离开副本会重新计数，头目要重新清场才会现身）。</div>`;
    h += `<div class="hint">休息 / 打坐随时可点：咒力${e.atHome() ? '与精力' : '（家外只回咒力；在家休息才回精力）'}。挂机 = 智能打怪，不回咒力 / 精力。</div>`;

     
    const shop = e.shopList();
    if (shop.length) {
      const free = e.freeShop();
      h += `<h2 class="viewtitle" style="font-size:15px;margin-top:16px">柜 台${free ? ' · 试验商店（免费）' : ''}</h2><div class="gridentry">`;
      for (const id of shop) {
        const it = window.JH_ITEM_MAP[id]; if (!it) continue;
        h += `<div class="entry"><div class="en"><span class="${qclass(it.q)}">${esc(it.name)}</span><span class="q">${free ? '免费' : (it.price || 0) + ' 两'}</span></div>
          <div class="ed">${esc(it.desc)}</div>
          <div style="margin-top:8px"><button class="mini2" data-buy="${id}">${free ? '取走' : '买下'}</button></div></div>`;
      }
      h += '</div>';
    }

    const npcs = e.npcsInRoom();
    for (const n of npcs) {
      const aff = s.aff[n.id] || 0;
      h += `<div class="npccard">
        <div><span class="nname">${esc(n.name)}</span><span class="ntitle">${esc(n.title || '')}</span></div>
        <div class="ndesc">${esc(n.desc)}</div>
        <div class="affbar"><i style="width:${aff}%"></i></div>
        <div class="hint">好感 ${aff} / 100${n.teach ? `　·　好感达 ${n.teach.aff} 可获传授` : ''}${n.task ? '　·　似有托付' : ''}</div>
        <div class="npcacts" style="margin-top:9px">
          <button class="mini2" data-talk="${n.id}">交谈</button>
          <button class="mini2" data-gift="${n.id}">赠礼</button>
        </div></div>`;
    }
    if (!npcs.length) h += '<p class="hint">此地无人。</p>';

    if (s.room === 'r_home_mirror') h += mirrorPanel();
    h += `<div class="tagline">已搜寻 ${s.c.search[s.room] || 0} 次　·　到访 ${s.c.visit[s.room] || 0} 次　·　停留 ${Math.round(s.c.idle[s.room] || 0)} 秒</div>`;
    return h;
  }

   
  function mirrorPanel() {
    const e = E();
    const c = e.mirrorCfg();
    const num = (key, label, lo, hi, tip) => {
      const v = key.indexOf('out.') === 0 ? (c.out || {})[key.slice(4)] : c[key];
      return '<label class="mkin"><span>' + label + '</span>' +
        '<input type="number" data-mirror="' + key + '" min="' + lo + '" max="' + hi + '" value="' + (v == null ? 0 : v) + '" data-tip="' + tip + '"></label>';
    };
    const ownedIds = Object.keys((e.s && e.s.skills) || {});
    const atkAll = ownedIds.map(id => window.JH_MARTIAL_MAP[id]).filter(m => m && m.kind === 'atk').sort((a, b) => (a.q || 0) - (b.q || 0));
    const passAll = ownedIds.map(id => window.JH_MARTIAL_MAP[id]).filter(m => m && (m.kind === 'nei' || m.kind === 'qing')).sort((a, b) => (a.q || 0) - (b.q || 0));
    const mkSkill = m => '<button class="mkck' + (c.skills.indexOf(m.id) >= 0 ? ' on' : '') + '" data-mirror-skill="' + m.id + '">' + esc(m.name) + '</button>';
    const mkInnate = t => '<button class="mkck' + (c.innate.indexOf(t.id) >= 0 ? ' on' : '') + '" data-mirror-innate="' + t.id + '">' + esc(t.name) + '</button>';
    return '<h2 class="viewtitle" style="font-size:15px;margin-top:16px">镜 屋 · 另一个自己</h2>' +
      '<div class="mkbox">' +
      '<div class="mkhint">镜子照出的东西，数值与术式都由你填，开打之后随时「换视角」——握着哪一边，另一边就交给电脑。两边都不掉东西、不给修为，散场各自归位，纯粹用来量机制。<b>默认给一面「沙盘级」的镜子</b>，免得伤害一高、一碰就碎；想脆一点就往下调，想抄自己现在的数值就按下面那个「重铸」。</div>' +
      '<div class="mkrow">' + num('lv', '境界', 1, 9, '只影响等级相关的一点点判定') + num('ceEff', '咒效%', 20, 80, '咒力效率：消耗与效果都看它') + num('ceCtl', '咒操%', 20, 80, '咒力操作：减免冷却、熔断，也定领域注力上限') + '</div>' +
      '<div class="mkrow">' + num('hpMax', '气血上限', 0, 1000000000000, '填 0 就按 100 算；默认给一面耐打的镜子，想让镜子脆就往下调') + num('curMax', '咒力上限', 0, 1000000000000, '') + num('phyAtk', '物理攻击', 0, 1000000000000, '') + num('curAtk', '咒力攻击', 0, 1000000000000, '') + '</div>' +
      '<div class="mkrow">' + num('def', '防御', 0, 1000000000000, '') + num('crit', '暴击%', 0, 999, '') + num('dodge', '闪避%', 0, 999, '') + num('out.phy', '物理出力', 20, 100, '它自己出手时的出力') + num('out.cur', '咒力出力', 20, 100, '') + '</div>' +
      '<div class="mkrow"><label class="mkin"><span>沙盘血量</span></label>' +
        '<button class="mkck' + (c.auto !== false ? ' on' : '') + '" data-mirror-auto="1" data-tip="默认开着：开打前按「双方最强一击 × 倍率」给两边兜一个气血下限 —— 镜屋是拿来看机制的沙盘，伤害一高、一手就散场就什么都测不到。想完全按上面的数字来，点一下关掉。">' + (c.auto !== false ? '自动标定：开' : '自动标定：关（只按上面的数字）') + '</button>' +
        num('hits', '兜血倍率', 1, 999, '自动标定开着时：两边气血至少 = 双方最强一击 × 这个倍率。默认 20。') +
      '</div>' +
      (function () {
        const a = E().mirrorAuto();
        return '<div class="mkhint">' + (a.on
          ? '开打时实际：<b>镜子气血 ' + Math.max(a.floor, c.hpMax) + ' 起</b> · <b>你这边兜到 ' + Math.max(a.mine, 0) + ' 起</b>（自动标定 · 倍率 ' + a.hits + '；面板填得比这高就听面板的）'
          : '自动标定已关：完全按上面填的数字上阵（镜子气血 ' + c.hpMax + ' 起，你这边就是你自己的气血）') + '</div>';
      })() +
      '<div class="mkrow"><label class="mkin"><span>带哪几系生得术式</span></label><div class="mkgrid">' +
        ((window.JH_INNATE || []).map(mkInnate).join('') || '<span class="hint">（这一版没有生得术式）</span>') + '</div></div>' +
      '<div class="mkrow"><label class="mkin"><span>带哪些术式</span></label><div class="mkgrid tall">' + (atkAll.length ? atkAll.map(mkSkill).join('') : '<span class="hint">（你还没学过主动术式）</span>') + '</div></div>' +
      '<div class="mkrow"><label class="mkin"><span>带哪些咒力运用 / 体术身法</span></label><div class="mkgrid tall">' + (passAll.length ? passAll.map(mkSkill).join('') : '<span class="hint">（你还没学过这类术式）</span>') + '</div></div>' +
      '<div class="actbar" style="margin-top:10px">' +
        '<button class="act" data-act="mirror" data-tip="进镜子——把上面这些捏成一个对手，开始试招。">镜屋·试招</button>' +
        '<button class="act danger" data-act="mirror-reset" data-tip="把上面这些全部按你现在的样子重来一遍。">照我现在这副样子重铸</button>' +
      '</div></div>';
  }

   
  function outTarget() {
    const b = E().getBattle && E().getBattle();
    if (b && b.pvp && b.ctrl === 'foe') return b.foe;
    return E().s;
  }

   
  function outBar(inBattle, actor) {
    const s = actor || E().s, o = s.out || { phy: 50, cur: 50 };
    return `<div class="outrow">
      <label>物理出力</label><input type="range" min="20" max="100" step="5" data-out="phy" value="${o.phy}"><b>${o.phy}%</b>
      <label>咒力出力</label><input type="range" min="20" max="100" step="5" data-out="cur" value="${o.cur}"><b>${o.cur}%</b>
      <span class="hint" data-tip="出力 = 生效百分比：调低省咒力、打得轻，调高反过来；物理出力开太满，被反击时容易被抓破绽。">出力越高越痛，也越费咒力；常规 50%。</span></div>`
      + (inBattle ? '<div class="domfeedrow" id="domFeedRow"><!--DOMFEED--></div>' : '');
  }

  

  function domFeedHtml(actor) {
    const s = actor || E().s;
    const p = s.pst && s.pst.dom;
    if (!p) return '<div class="domfeedrow hint">还没展开领域。展开之后每回合都要烧咒力<b>维持</b>（血条上写着「维持 N/回合」），这里可以再额外往领域里注入咒力（不占出手）。</div>';
    const cap = window.JH_combat.domFeedCap(s);
    const v = Math.max(0, Math.min(Math.floor(s.domFeed || 0), cap));
    return `<div class="domfeedrow">
      <label>领域注力</label>
      <input type="range" id="domFeedRange" min="0" max="${cap}" step="1" value="${v}">
      <input type="number" id="domFeedNum" min="0" max="${cap}" step="1" value="${v}">
      <b>${v} / ${cap}</b>
      <span class="hint" data-tip="每回合自动往领域里注入这么多咒力，不占出手；能注入多少随咒操与气血走（当前 ${cap}）。">每回合自动注入，不占出手。</span></div>`;
  }
  function bindDomFeed(actor) {
    const s = actor || E().s; if (!s) return;
    const cap = window.JH_combat.domFeedCap(s);
    const r = $('domFeedRange'), n = $('domFeedNum');
    const sync = () => { const b = document.querySelector('#domFeedRow b'); if (b) b.textContent = Math.floor(s.domFeed || 0) + ' / ' + cap; };
    const put = (v) => { s.domFeed = Math.max(0, Math.min(Math.floor(+v || 0), cap)); if (r) r.value = s.domFeed; if (n) n.value = s.domFeed; sync(); saveSoon(); };
    if (r) r.oninput = () => put(r.value);
    if (n) n.onchange = () => put(n.value);
  }

  


  function regionOf(sid) {
    const of = window.JH_REGION_OF || {};
    if (sid && of[sid]) return of[sid];
    const regs = window.JH_REGIONS || [];
    return regs.length ? regs[0].id : null;
  }
  function regionLockText(rg) {
    const u = (rg && rg.unlock) || {}; const out = [];
    if (u.realm != null) out.push('境界 ' + E().REALMS[u.realm].name);
    if (u.insight != null) out.push('悟性 ' + u.insight);
    if (u.flag) out.push('需一段际遇');
    if (u.story) out.push('需一段剧情');
    return out.join(' / ') || '未可至';
  }
   
  function mapLand(land) {
    if (land === 'fjord') return '<svg class="mland" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      '<path class="deep" d="M0,58 C12,54 20,64 30,60 C40,56 44,66 54,64 C64,62 70,72 80,70 L100,74 L100,100 L0,100 Z"/>' +
      '<path d="M2,40 C12,30 20,40 30,32 C40,24 46,34 56,26 C66,18 74,28 84,22 C90,18 96,24 99,20 L100,34 L96,50 C86,56 78,46 68,52 C58,58 50,48 40,54 C30,60 22,50 12,56 C8,58 4,54 3,50 Z"/>' +
      '<path class="ridge" d="M10,52 C20,45 26,52 36,45 C46,38 54,46 64,40 C74,34 82,42 92,36 L94,44 C84,50 76,44 66,50 C56,56 48,49 38,55 C28,61 20,55 12,60 Z"/>' +
      '<path class="ridge" d="M22,72 C32,68 40,74 50,70 C60,66 68,72 78,68 L80,74 C70,78 62,73 52,77 C42,81 34,76 24,80 Z"/>' +
      '</svg>';
    return '<svg class="mland" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      '<path class="deep" d="M0,70 C14,62 24,74 36,70 C48,66 52,80 64,78 C76,76 82,86 92,82 L100,86 L100,100 L0,100 Z"/>' +
      '<path d="M4,32 C14,20 26,27 34,17 C44,8 56,16 66,11 C78,6 88,17 97,13 L100,22 L96,42 C86,50 76,43 66,50 C54,57 44,47 32,54 C22,59 12,51 3,57 Z"/>' +
      '<path class="ridge" d="M16,60 C26,53 34,58 42,51 C52,44 60,51 70,46 C78,42 86,49 95,44 L96,53 C86,60 78,55 68,60 C58,65 50,60 40,64 C30,69 23,64 15,68 Z"/>' +
      '</svg>';
  }
   
  function regionTabs(e, rid) {
    const regs = window.JH_REGIONS || [];
    if (regs.length <= 1) return '';
    let h = '<div class="mapregions"><button class="rgnav" data-region="prev" data-tip="上一座大地图">‹</button>';
    for (const r of regs) {
      const on = r.id === rid, un = e.regionUnlocked(r);
      h += '<button class="rgchip' + (on ? ' on' : '') + (un ? '' : ' locked') + '" data-region="' + esc(r.id) + '"' +
        (on ? '' : ' data-tip="' + esc(un ? (r.desc || r.name) : ('未至 · ' + regionLockText(r))) + '"') + '>' +
        esc(r.glyph || String(r.name || '').slice(0, 1)) + ' ' + esc(r.name) + '</button>';
    }
    h += '<button class="rgnav" data-region="next" data-tip="下一座大地图">›</button></div>';
    return h;
  }
  function viewMap() {
    const e = E(), s = e.s;
    const regs = window.JH_REGIONS || [];
    const here = window.JH_SCENE_MAP[s.scene] || { name: '—', desc: '' };
    const tr = s.travel || null;
    if (tr) mapRegion = regionOf(tr.scene);             
    let rid = mapRegion || regionOf(s.scene);
    if (!regs.some(r => r.id === rid)) rid = regs.length ? regs[0].id : null;
    const rg = (window.JH_REGION_MAP || {})[rid] || { id: rid, name: '大地图', land: 'main' };
    const viewHere = regionOf(s.scene) === rid;
    const rgUn = e.regionUnlocked(rg);

    const target = tr ? (window.JH_SCENE_MAP[tr.scene] || here) : null;
    const from = tr ? (window.JH_SCENE_MAP[tr.from] || here) : null;

     
    let routeHtml = '', walkHtml = '';
    if (tr && from && target && target.x != null) {
      const cross = regionOf(tr.from) !== regionOf(tr.scene);
      const a = cross ? { x: (rg.entry && rg.entry.x != null ? rg.entry.x : 8),
                          y: (rg.entry && rg.entry.y != null ? rg.entry.y : 90) } : from;
      if (a && a.x != null) {
        routeHtml = '<svg class="mroutes" viewBox="0 0 100 100" preserveAspectRatio="none">' +
          '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + target.x + '" y2="' + target.y +
          '" class="mroute" vector-effect="non-scaling-stroke"/></svg>';
        const t0 = (tr.start != null ? tr.start : tr.until - 1);
        const total = Math.max(1, tr.until - t0);
        const k = Math.max(0, Math.min(1, (s.t - t0) / total));
        const wx = a.x + (target.x - a.x) * k, wy = a.y + (target.y - a.y) * k;
        walkHtml = '<div class="mwalker" style="left:' + wx.toFixed(2) + '%;top:' + wy.toFixed(2) + '%"></div>' +
          '<div class="mwalklabel" style="left:' + wx.toFixed(2) + '%;top:' + wy.toFixed(2) + '%">' +
          (cross ? '远渡 ' : '赶往 ') + esc(target.name) + ' · 还需 ' + esc(e.durText(tr.until - s.t)) + '</div>';
      }
    }

    let nodesHtml = '';
    const list = (window.JH_SCENES || []).filter(sc => regionOf(sc.id) === rid && (!sc.hidden || e.sceneUnlocked(sc)));
    for (const sc of list) {
      const un = rgUn && e.sceneUnlocked(sc);
      const on = sc.id === s.scene;
      const rooms = window.JH_ROOMS.filter(r => r.scene === sc.id && e.roomUnlocked(r));
      const sub = !rgUn ? regionLockText(rg)
        : (un ? (on ? '此处' : rooms.length + ' 处 · 约 ' + e.durText(e.travelSec(sc.id))) : lockText(sc));
      nodesHtml += '<button class="mnode' + (un ? '' : ' locked') + (on ? ' on' : '') +
        '" style="left:' + sc.x + '%;top:' + sc.y + '%"' +
        (un ? ' data-scene="' + sc.id + '"' : ' disabled') + ' title="' + esc(sc.desc) + '">' +
        (on ? '<span class="mhere">◆</span>' : '') +
        '<span class="mdot" style="border-color:' + esc(sc.tone || '#d9b166') + '"></span>' +
        '<span class="mtag">' + esc(sc.name) + '</span>' +
        '<span class="mlock"' + (un && !on ? ' style="color:rgba(217,177,102,.66)"' : '') + '>' + esc(sub) + '</span>' +
        '</button>';
    }

    const infoName = viewHere ? here.name : (rg.name || '');
    const infoDesc = viewHere ? (here.desc || '')
      : ((rg.desc || '') + (rgUn ? '' : '　（未至：' + regionLockText(rg) + '）'));
    const crossTip = regs.length > 1 ? '跨大地图赶路要 10 分钟。' : '';
    const mapBgImg = window.JH_IMGC_map ? window.JH_IMGC_map(rg.id, rg.land) : '';
    let h = '<h2 class="viewtitle">舆 图</h2>' +
      '<div class="subtitle">点一处地名即动身。路上要花些时候，到了才起得了卦。' + crossTip + '</div>' +
      regionTabs(e, rid) +
      '<div class="mapsys' + (mapBgImg ? ' hasmap' : '') + '">' + (mapBgImg ? '<div class="mapbg" data-img="' + esc(mapBgImg) + '" style="background-image:url(\'' + esc(mapBgImg) + '\')"></div>' : '') + mapLand(rg.land) + '<div class="mframe"></div>' +
      '<div class="mtitle">山 河 舆 图</div><div class="mcompass">北</div>' +
      routeHtml + nodesHtml + walkHtml + '</div>' +
      '<div class="mnodeinfo"><b>' + esc(infoName) + '</b><span class="hint" style="margin-left:10px">' +
      esc(e.shichenName(s)) + '</span><div class="mi">' + esc(infoDesc) + '</div></div>';

    if (!viewHere) {
      h += '<div class="hint" style="margin-top:10px">你不在' + esc(rg.name || '这里') +
        '。上面的地名只是让你看看 —— 要走过去，得从你那座图里点它，路上要算远渡的钱和工夫。</div>';
      return h;
    }

    const rs = window.JH_ROOMS.filter(r => r.scene === s.scene && (!r.devOnly || e.devEditable()));
    h += '<h2 class="viewtitle" style="margin-top:18px">此 地 诸 处</h2>';
    if (tr) h += '<div class="hint" style="color:var(--jade)">你正在赶路，到了才走得动。</div>';
    h += '<div class="roomrow">';
    for (const r of rs) {
      const un = e.roomUnlocked(r);
      h += '<button class="roomchip' + (r.id === s.room ? ' on' : '') + (un ? '' : ' locked') + '"' +
        (un && !tr ? ' data-room="' + r.id + '"' : '') + (un ? '' : ' disabled') + '>' + esc(r.name) + '</button>';
    }
    h += '</div>';
    return h;
  }
  function lockText(sc) {
    const u = sc.unlock || {}; const out = [];
    if (u.realm != null) out.push('境界 ' + E().REALMS[u.realm].name);
    if (u.insight != null) out.push('悟性 ' + u.insight);
    if (u.flag) out.push('需一段际遇');
    return out.join(' / ') || '未可至';
  }

   
  function viewBag() {
    const e = E(), s = e.s;
    const canSell = s.room === 'r_xy_dangpu';
    const shop = e.shopList();
    let h = `<h2 class="viewtitle">行 囊</h2><div class="subtitle">共 ${e.bagTypes()} 种物件。</div>`;

    const eq = ['weapon','armor','charm','boots'].map(slot => {
      const id = s.equip && s.equip[slot];
      const nm = id ? itemName(id) : '（空）';
      return `<span class="mini2" style="margin-right:6px">${{weapon:'兵器',armor:'护具',charm:'佩饰',boots:'靴子'}[slot]}：${esc(nm)}${id ? ` <button class="mini2" data-unequip="${slot}">卸下</button>` : ''}</span>`;
    }).join('');
    h += `<div style="margin-bottom:14px">${eq}</div>`;

    const groups = {};
    for (const id of Object.keys(s.items)) {
      const it = window.JH_ITEM_MAP[id]; if (!it) continue;
      (groups[it.type] = groups[it.type] || []).push(it);
    }
    const TN = { pill:'丹药', mat:'材料', weapon:'兵器', armor:'护具', charm:'佩饰', boots:'靴子', book:'秘籍', quest:'信物', drink:'酒水', food:'吃食' };
    for (const t of Object.keys(groups)) {
      h += `<h2 class="viewtitle" style="font-size:15px;margin-top:14px">${TN[t] || t}</h2><div class="gridentry">`;
      for (const it of groups[t]) {
        const n = s.items[it.id];
        h += `<div class="entry"><div class="en"><span class="${qclass(it.q)}">${esc(it.name)}</span><span class="q ${qclass(it.q)}">${QNAME()[it.q]||''} ×${n}</span></div>
          <div class="ed">${esc(it.desc)}</div>
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            ${it.effect ? `<button class="mini2" data-use="${it.id}">使用</button>` : ''}
            ${it.learn ? `<button class="mini2" data-read="${it.id}">研读</button>` : ''}
            ${['weapon','armor','charm','boots'].includes(it.type) ? `<button class="mini2" data-equip="${it.id}">装备</button>` : ''}
            <button class="mini2" data-drop="${it.id}" data-tip="丢掉一件。带在身上的要先卸下来；丢掉的强化 / 词条 / 咒具化也一并没了。">丢弃</button>
            ${it.price ? `<button class="mini2" data-sell="${it.id}" ${canSell ? '' : 'disabled title="需在当铺"'}>典当 ${Math.floor(it.price*0.6)}</button>` : ''}
          </div></div>`;
      }
      h += '</div>';
    }
    if (!Object.keys(s.items).length) h += '<p class="hint">空空如也。</p>';
    if (shop.length) {
      h += `<h2 class="viewtitle" style="margin-top:20px">此地可购</h2><div class="gridentry">`;
      for (const id of shop) {
        const it = window.JH_ITEM_MAP[id]; if (!it) continue;
        const pr = e.priceOf(id);
        h += `<div class="entry"><div class="en"><span class="${qclass(it.q)}">${esc(it.name)}</span><span class="q">${pr > 0 ? pr + ' 两' : '免费'}</span></div>
          <div class="ed">${esc(it.desc)}</div>
          <div style="margin-top:8px"><button class="mini2" data-buy="${id}">${pr > 0 ? '买下' : '取走'}</button></div></div>`;
      }
      h += '</div>';
    }
    return h;
  }

  

  function costHtml(e, cost) {
    const gap = e.costGap(cost);
    return { txt: e.costText(cost), ok: gap.length === 0, gap: gap.join('、') };
  }
  function viewForge() {
    const e = E(), s = e.s, F = window.JH_FORGE;
    let h = '<h2 class="viewtitle">锻 冶</h2><div class="subtitle">两条线给的数值一样；咒具多一层「词条」。砧板上锻的是你挑中的这件兵器或配饰。</div>';
     
    const cand = [];
    const add = id0 => { const it0 = window.JH_ITEM_MAP[id0]; if (it0 && (it0.type === 'weapon' || it0.type === 'charm') && cand.indexOf(id0) < 0) cand.push(id0); };
    for (const slot of ['weapon', 'charm']) if (s.equip && s.equip[slot]) add(s.equip[slot]);
    for (const k of Object.keys(s.items || {})) add(k);
    let id = (forgeTarget && cand.indexOf(forgeTarget) >= 0) ? forgeTarget : null;
    if (!id && s.equip && s.equip.weapon && cand.indexOf(s.equip.weapon) >= 0) id = s.equip.weapon;
    if (!id && cand.length) id = cand[0];
    forgeTarget = id;
    if (!id) {
      h += '<p class="hint">你手里没有能上砧板的东西。先去「行囊」装备一件兵器或配饰，或往行囊里收一件。</p>';
      return h;
    }
    h += '<div class="subtitle">挑一件上砧板：</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">';
    for (const k of cand) {
      const it0 = window.JH_ITEM_MAP[k], f0 = e.forgeOf(k);
      const tag0 = f0.curse ? ('咒具 +' + f0.clv) : (f0.lv ? ('普通 +' + f0.lv) : '未锻');
      h += '<button class="mini2' + (k === id ? ' on' : '') + '" data-forge="pick:' + k + '">' + esc(it0.name) + '（' + tag0 + '）</button>';
    }
    h += '</div>';
    const it = window.JH_ITEM_MAP[id];
    const f = e.forgeOf(id);
    const pct = e.forgePct(id) * 100;
    const shown = f.curse ? ('咒具·' + it.name) : it.name;
    const line = f.curse ? ('咒具强化 +' + f.clv) : ('普通强化 +' + f.lv);
    h += '<div class="entry"><div class="en"><span class="' + qclass(it.q) + '">' + esc(shown) + '</span>'
      + '<span class="q">' + (f.curse ? '咒具' : '普通兵刃') + ' · ' + line + ' · 数值 +' + pct.toFixed(1) + '%</span></div>'
      + '<div class="ed">' + esc(it.desc) + '</div></div>';

    h += '<h2 class="viewtitle" style="font-size:15px;margin-top:14px">锻打</h2>';
    if (!f.curse) {
      const maxed = f.lv >= F.maxLv;
      const c = costHtml(e, F.lvCost(f.lv));
      h += '<div class="entry"><div class="en"><span>普通强化</span><span class="q">+' + f.lv + ' / +' + F.maxLv + '</span></div>'
        + '<div class="ed">用普通材料往上锻，越锻越硬。<b>一旦强化过，这件兵器就不能再咒具化了。</b></div>'
        + '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">'
        + (maxed ? '<span class="hint">已经锻到顶了。</span>'
          : '<button class="mini2" data-forge="up"' + (c.ok ? '' : ' disabled title="' + esc(c.gap) + '"') + '>锻到 +' + (f.lv + 1) + '　（' + esc(c.txt) + '）</button>')
        + '</div></div>';
      const cc = costHtml(e, F.curseCost);
      const held = (s.equip && (s.equip.weapon === id || s.equip.charm === id));
      const canCurse = e.curseAllowed() && held;
      const reason = !e.curseAllowed() ? '咒具认人：只有某种特殊出身才拿得动。'
        : !held ? '先把它带在身上（兵器栏或佩饰栏），才淬得进咒力。'
        : f.lv > 0 ? '这件已经强化过，淬不进咒力了 —— 换一件没动过的底子。' : '';
      h += '<div class="entry"><div class="en"><span>咒具化</span><span class="q">' + (canCurse ? '可用' : '不可用') + '</span></div>'
        + '<div class="ed">把普通兵器升成咒具：<b>数值照旧</b>，另开 3 个词条槽（+3 / +6 / +9 各开一个）。</div>'
        + '<div style="margin-top:8px">'
        + (reason ? '<span class="hint">' + esc(reason) + '</span>'
          : '<button class="mini2" data-forge="curse"' + (cc.ok ? '' : ' disabled title="' + esc(cc.gap) + '"') + '>咒具化　（' + esc(cc.txt) + '）</button>')
        + '</div></div>';
    } else {
      const maxed = f.clv >= F.maxLv;
      const c = costHtml(e, F.clvCost(f.clv));
      h += '<div class="entry"><div class="en"><span>咒具强化</span><span class="q">+' + f.clv + ' / +' + F.maxLv + '</span></div>'
        + '<div class="ed">用咒金与咒具碎片往上锻，数值与普通线一样，多的只是词条。</div>'
        + '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">'
        + (maxed ? '<span class="hint">已经锻到顶了。</span>'
          : '<button class="mini2" data-forge="cup"' + (c.ok ? '' : ' disabled title="' + esc(c.gap) + '"') + '>锻到 +' + (f.clv + 1) + '　（' + esc(c.txt) + '）</button>')
        + '</div></div>';
    }

    h += '<h2 class="viewtitle" style="font-size:15px;margin-top:16px">词条</h2>';
    if (!f.curse) {
      h += '<p class="hint">普通兵器刻不住词条 —— 先咒具化。</p>';
    } else {
      const at = F.slotsAt;
      for (let i = 0; i < 3; i++) {
        const open = f.clv >= at[i];
        const wid = f.slots[i];
        const w = wid && window.JH_WORD_MAP[wid];
        const cc = costHtml(e, F.carveCost);
        h += '<div class="entry"><div class="en"><span>第 ' + (i + 1) + ' 槽</span><span class="q">'
          + (open ? (w ? esc(w.name) : '空') : ('要 +' + at[i])) + '</span></div>';
        if (!open) h += '<div class="ed">把咒具强化到 +' + at[i] + ' 才会开这一槽。</div>';
        else if (w) h += '<div class="ed">' + esc(w.desc) + '</div><div style="margin-top:8px"><button class="mini2" data-forge="uncarve:' + i + '">磨掉（材料不退）</button></div>';
        else h += '<div class="ed">空着。可以刻一条词条进去。</div>'
          + '<div style="margin-top:8px"><button class="mini2" data-forge="carve:' + i + '"' + (cc.ok ? '' : ' disabled title="' + esc(cc.gap) + '"') + '>刻词条　（' + esc(cc.txt) + '）</button></div>';
        h += '</div>';
      }
      const hasStore = (f.slots || []).indexOf('w_store') >= 0;
      if (hasStore || f.store) {
        const sm = f.store ? window.JH_MARTIAL_MAP[f.store] : null;
        h += '<div class="entry"><div class="en"><span>咒术存储标签</span><span class="q">' + (f.store ? ('存着「' + esc(sm ? sm.name : f.store) + '」') : '空着（可吸一门）') + '</span></div>'
          + '<div class="ed">这件咒具上刻着「咒术存储」：带着标签、还没存东西时，它<b>用不出存储技能</b>，对阵页只有一条灰键「<b>吸·（空）</b>」——按一下亮出咒具，对手下一手若是术式就被整口吞下（<b>代价是双倍伤害</b>）并记进这件咒具；这时多出一个独立的「<b>储·××</b>」按键，可以直接打出去。<b>用掉、或在锻冶页主动放弃之后，标签才空出来，能再吸一次</b>。</div>';
        if (f.store) h += '<div style="margin-top:8px"><button class="mini2" data-forge="dropstore">放弃存着的这门术式</button></div>';
        h += '</div>';
      }
      h += '<p class="hint">词条可拆可重装：磨下来不退材料，但槽会空出来。效果对<b>装备着</b>的咒具生效，进战斗即用。</p>';

      h += '<h2 class="viewtitle" style="font-size:15px;margin-top:14px">词 条（' + (window.JH_WORDS || []).length + ' 条）</h2><div class="gridentry">';
      for (const w of window.JH_WORDS) {
        h += '<div class="entry"><div class="en"><span>' + esc(w.name) + '</span><span class="q">' + (w.once ? '每件限一条' : '可叠') + '</span></div>'
          + '<div class="ed">' + esc(w.desc) + '</div></div>';
      }
      h += '</div>';
    }

    const own = [];
    for (const k of Object.keys(s.items)) {
      const t2 = window.JH_ITEM_MAP[k];
      if (t2 && (t2.type === 'weapon' || t2.type === 'charm')) own.push(k);
    }
    h += '<h2 class="viewtitle" style="font-size:15px;margin-top:16px">可换的兵器与配饰</h2>';
    if (!own.length) h += '<p class="hint">行囊里没有别的兵器或配饰了。</p>';
    else {
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
      for (const k of own) {
        const t2 = window.JH_ITEM_MAP[k], f2 = e.forgeOf(k);
        const tag = f2.curse ? ('咒具 +' + f2.clv) : (f2.lv ? ('普通 +' + f2.lv) : '未锻');
        h += '<button class="mini2" data-equip="' + k + '">' + esc(t2.name) + '（' + tag + '）</button>';
      }
      h += '</div>';
    }

    const mats = ['mat_steel', 'mat_bone', 'mat_gold', 'mat_shard', 'mat_jade', 'mat_silk'];
    h += '<h2 class="viewtitle" style="font-size:15px;margin-top:16px">手上的材料</h2><div style="display:flex;gap:10px;flex-wrap:wrap">';
    for (const m of mats) {
      const mm = window.JH_ITEM_MAP[m];
      if (!mm) continue;
      h += '<span class="mini2">' + esc(mm.name) + ' ×' + (s.items[m] || 0) + '</span>';
    }
    h += '</div><p class="hint">材料靠搜寻、打铁、黑市与打怪掉落攒；咒金 / 咒玉 / 咒具碎片在黑市摊位上买得到。</p>';

    h += '<p class="hint">三条限制：① 普通兵器一旦强化过，就不能再咒具化；② 只有某种特殊出身才拿得动咒具；③ 一个人身上最多同时带 <b>两件</b>咒具。</p>';
    return h;
  }

   
  function neiText(n) {
    if (!n) return '';
    const o = [];
    if (n.curMax) o.push(`咒力总量 +${Math.round(n.curMax * 100)}%/级`);
    if (n.ceEff) o.push(`咒效 +${(n.ceEff * 100).toFixed(1)}%/级`);
    if (n.ceCtl) o.push(`咒操 +${(n.ceCtl * 100).toFixed(1)}%/级`);
    if (n.def) o.push(`防御 +${n.def}/级`);
    if (n.hp) o.push(`气血 +${n.hp}/级`);
    if (n.curAtk) o.push(`咒攻 +${n.curAtk}/级`);
    if (n.phyAtk) o.push(`物攻 +${n.phyAtk}/级`);
    if (n.heal) o.push(`回复 +${n.heal}/级`);
    return o.join('　');
  }
  function qingText(q) {
    if (!q) return '';
    const o = [];
    if (q.dodge) o.push(`闪避 +${(q.dodge * 100).toFixed(1)}%/级`);
    if (q.esc) o.push(`脱身 +${Math.round(q.esc * 100)}%/级`);
    if (q.phyAtk) o.push(`物攻 +${q.phyAtk}/级`);
    if (q.crit) o.push(`暴击 +${q.crit}%/级`);
    if (q.ceCtl) o.push(`咒操 +${(q.ceCtl * 100).toFixed(1)}%/级`);
    return o.join('　');
  }
  function effText(m) {
    if (!m) return '';
    if (m.kind === 'atk') {
      const C = window.JH_combat, eff = (C && C.mechOf) ? C.mechOf(m) : (m.eff || {});
      const mech = mechList(eff);
      return `伤害 ×${m.mult}　段数 ${m.hits}　咒力 ${m.cost}　暴击 +${m.cri}%`
        + (mech ? `<br><b class="mech">机制</b> ${mech}` : '');
    }
    if (m.kind === 'nei') return neiText(m.nei);
    return qingText(m.qing);
  }

   
   
  const MECH_LABEL = [
    ['hpCost',     () => '以自身气血为代价'],
    ['pierce',     () => '无视一部分防御'],
    ['trueDamage', v => '真伤，越过大部分减伤'],
    ['lifesteal',  () => '按造成的伤害吸回气血'],
    ['drain',      () => '从对手身上抽回咒力'],
    ['defDown',    () => '削去对手一层防御'],
    ['stun',       () => '钉住对手，让它哑火一阵'],
    ['weak',       () => '压住对手的咒力，它出手轻一截'],
    ['dot',        v => '蚀：每回合持续流失'],
    ['recoil',     () => '反噬：自损气血'],
    ['slash',      v => '斩痕：受伤逐层加深'],
    ['adapt',      v => '适应：对手会记住这一招（只在这只魔虚罗还护在场上的时候算数）'],
    ['pull',       () => '引力：拽住对手，它的攻击与身手都钝一截'],
    ['mark',       () => '点出分点，之后每一击都更狠'],
    ['exec',       v => '处决：对手残血时收得更狠'],
    ['swap',       v => '换位：让对手打到自己'],
    ['selfHeal',   v => '自愈：按造成的伤害回气血'],
    ['guard',      () => '护罩：受到的伤害轻一截'],
    ['nullify',    () => '「无限」：完全摊开来袭，还能挡下几击'],
    ['gamble',     () => '赌博：结果全看手气'],
    ['summon',     v => '召唤「' + (v.name || '式神') + '」：非常驻 buff + 自己的护盾，每回合替你出手；那门术式再点一次＝收回，收回 / 被打散 / 到期都算收场']
  ];
  function mechList(eff) {
    if (!eff) return '';
    const o = [];
    for (const pair of MECH_LABEL) if (eff[pair[0]]) o.push(pair[1](eff[pair[0]]));
    return o.join('　');
  }
  function mechNoteText(id) {
    const C = window.JH_combat;
    const note = (C && C.mechNote) ? C.mechNote(id) : '';
    const eff = (C && C.mechOf) ? C.mechOf(window.JH_MARTIAL_MAP[id]) : null;
    const list = mechList(eff);
    return [note, list].filter(Boolean).join('　');
  }

   
  function trialRow(e, s, tid) {
    const d = e.trialDef && e.trialDef(tid);
    if (!d) return '';
    const done = e.trialDone && e.trialDone(tid);
    const lv = (s.innateLv || {})[tid] || 1;
    const openLv = (e.TRIAL_LV || 6);
    const open = (e.trialOpen ? e.trialOpen(tid) : lv >= openLv);
    const kindName = { battle: '试炼战', mine: '排雷', fetch: '集物', order: '顺序', dodge: '时机' }[d.kind] || '试炼';
    return '<div class="hint" style="margin-top:6px"><b>试炼</b>（熟练度 ' + openLv + ' 级起 · 必过） ' + esc(d.name) + '（' + kindName + '）：'
      + (done ? ('已通过' + (!(s.trials && s.trials[tid]) ? '（这一出身免试）' : ''))
              : (open ? '未挑战' : ('未开启 —— 这一门现在 ' + lv + ' 级')))
      + ((done || !open) ? '' : ' <button class="mini2" data-trial="' + tid + '">进入试炼</button>')
      + '　<span class="dim">' + (open ? ('没过这一关，' + openLv + ' 级起的衍生招数与领域都拿不到。')
                                       : ('熟练度练到 ' + openLv + ' 级，这道门才立起来；前五级的升级不吃它。')) + '</span></div>';
  }

  function viewSkill() {
    const e = E(), s = e.s, st = e.stats();
    const o = window.JH_ORIGIN_MAP[s.origin];
    const dev = !!(e.devEditable && e.devEditable());
    let h = `<h2 class="viewtitle">术 式</h2><div class="subtitle">出身 ${esc(o ? o.name : '—')} · 咒力效率 ${(st.ceEff * 100).toFixed(1)}% · 咒力操作 ${(st.ceCtl * 100).toFixed(1)}%（上限 ${(st.ceCap * 100).toFixed(1)}%）</div>`;
    const slot = (kind, label) => { const cap = e.slotsOf(s, kind); const n = (e.usedOf ? e.usedOf(s, kind) : e.activeOf(s, kind).length); return `<b>${label}</b><span>${n} / ${cap >= 99 ? '∞' : cap} 门</span>`; };
    h += `<div class="kv">${slot('atk', '主动术式')}${slot('nei', '咒力运用')}${slot('qing', '体术身法')}</div>
      <div class="hint">同时生效的术式有上限：主动术式看悟性 / 咒效 / 咒操三者，咒力运用看咒操，体术身法看根骨 —— 门槛越高，能同时挂上的门数越多。在下面的「已习」里点「启用 / 卸下」调整。</div>`;

    h += `<div class="hint" style="margin-top:8px"><b>生得术式</b>：初始那一手开局在手，<b>前五级（1~5 级）的升级不吃试炼</b>；<b>6 级起的衍生招数与领域才锁在这一系的试炼后面</b>（有的出身与联机对战里的角色免试）。每一系右上角有个<b>「系：开 / 关」</b>—— 关掉它，这一系的招数与被动（比如无下限的「打不着你」）一起停手。想磨熟练度：<b>加入组织后与同门对练</b>，按你出手的次数结算，熟练度 1~10 级。</div>`;
    if (!s.innate.length) h += '<p class="hint">你还没有任何生得术式。</p>';
    for (const tid of s.innate) {
      const t = window.JH_INNATE_MAP[tid]; if (!t) continue;
      const lv = s.innateLv[tid] || 1, exp = s.innateExp[tid] || 0;
      const need = window.JH_TECH_LV[lv] || 0;
      const ioff = !!(s.innateOff && s.innateOff[tid]);
      h += `<div class="tech"><div class="techhead"><b class="${qclass(t.q)}">${esc(t.name)}</b>
        <span class="tag">${esc(t.element)}</span>
        <span class="hint">${esc(e.techLvName(lv))}　${lv} / 10</span>${dev ? ` <input class="devlv" data-dev="innateLv:${tid}" value="${lv}" title="测试：直接改熟练度">` : ''}
        <button class="mini2${ioff ? '' : ' on'}" data-innaten="${tid}" title="整系开关：关掉后这一系的术式与被动（比如无下限的「打不着你」）一起停手">系：${ioff ? '关' : '开'}</button></div>
        <div class="bar mini exp"><i style="width:${pct(exp, need)}%"></i></div>
        <div class="hint">熟练度 ${Math.floor(exp)} / ${need}${need ? '' : '（已至完遂）'}</div>
        ${trialRow(e, s, tid)}
        <div class="hint">${esc(t.passive || '')}</div><div class="tree">`;
      const list = t.skills.map(id => window.JH_MARTIAL_MAP[id]).filter(Boolean).sort((a, b) => (a.lv || 0) - (b.lv || 0));
      const trialOk = (e.trialDone ? e.trialDone(tid) : true);
      for (const m of list) {
        const need2 = m.lv || 0;
        const tlv = (e.TRIAL_LV || 6);
        const ok = lv >= need2 && (need2 < tlv || trialOk);    
        const locked = (need2 >= tlv && lv >= need2 && !trialOk) ? '<div class="hint">还锁在这一系的试炼后面 —— 先过试炼</div>' : '';
        h += `<div class="node ${ok ? 'on' : 'off'}"><span class="lvtag">${need2 <= 1 ? '初始' : '熟练度 ' + need2 + ' 级'}</span>
          <span class="${qclass(m.q)}">${esc(m.name)}</span>
          <div class="ed">${esc(m.desc || '')}<br>${effText(m)}</div>${locked}</div>`;
      }
      const dm = window.JH_MARTIAL_MAP[t.domain];
      if (dm) {
        const has = s.domain.indexOf(tid) >= 0;
        h += `<div class="node ${has ? 'on' : 'off'}"><span class="lvtag">领域 · 熟练度 8 级 · 过试炼</span>
          <span class="${qclass(dm.q)}">${esc(dm.name)}</span>
          <div class="ed">${esc(dm.desc || '')}<br>${effText(dm)}</div></div>`;
      }
      h += '</div></div>';
    }

    const KIND = { atk: '主动术式', nei: '咒力运用', qing: '体术身法', passive: '被动' };

     
    const jt = window.JH_INNATE_MAP.t_jukai;
    if (jt && s.innate.indexOf('t_jukai') >= 0) {
      const CLS = { a: '一级 · 甲类', b: '三级 · 乙类', c: '五级 · 丙类', m: '魔虚罗（单独一类）' };
      const jlv = s.innateLv.t_jukai || 1;
      h += `<h2 class="viewtitle" style="margin-top:16px;font-size:15px">式 神 选 择　<span class="hint" style="font-weight:normal">十种影法术：每类同时只能有一只出战</span></h2><div class="gridentry">`;
      h += '<p class="hint">式神护在场上时自带一块护盾，厚薄与你的咒攻、咒效、咒操和它的解锁等级有关。想收回就再点那门术式（直接清 buff）；<b>护盾被打空也算收场</b> —— 不管收回、被打空还是到期，那门术式都要歇上一阵子才转得好，不吃减免。</p>';
      for (const cls of ['a', 'b', 'c', 'm']) {
        const list = jt.skills.map(id => window.JH_MARTIAL_MAP[id]).filter(m => m && m.cls === cls);
        if (!list.length) continue;
        const cur = e.partyOf(s, cls);
        h += `<div class="entry"><div class="en"><span>${CLS[cls]}</span><span class="q">${cur ? esc(window.JH_MARTIAL_MAP[cur].name) : '未解锁'}</span></div><div class="ed" style="display:flex;flex-wrap:wrap;gap:6px">` +
          list.map(m => { const on = cur === m.id; const ok = jlv >= (m.lv || 0);
            return `<button class="mini2${on ? ' on' : ''}" data-shikigami="${cls}:${m.id}" ${ok ? '' : 'disabled'}>${esc(m.name)}${ok ? (on ? '（出战）' : '') : '（熟练度 ' + (m.lv || 1) + '）'}</button>`; }).join('') + '</div></div>';
      }
      h += '</div>';
    }

    h += `<h2 class="viewtitle" style="margin-top:16px;font-size:15px">普 适 技 能　<span class="hint" style="font-weight:normal">技能点 ${s.sp || 0}（开局 3 点，每突破一境 +2）</span></h2><div class="gridentry">`;
    h += '<p class="hint">普适技能分「主动术式 / 咒力运用 / 体术身法」三类，用技能点升级（多数单项最多 3 级，<b>结界术也是 3 级满</b>）。没点到的那些，之后要找<b>组织</b>用贡献换；有些本事还得另有门路才学得到。</p>';
    const commonIds = Object.keys(s.skills).filter(id => { const m = window.JH_MARTIAL_MAP[id]; return m && m.common; });
    if (!commonIds.length) h += '<p class="hint">还没学过普适技能。</p>';
    for (const id of commonIds) {
      const m = window.JH_MARTIAL_MAP[id];
      const lv = s.skillLv[id] || 0;
      const capLv = m.maxLv || 3;
      const extra = id === 'k_black' ? `　当前触发率 ${st.bfRate}%` : '';
      h += `<div class="entry"><div class="en"><span class="${qclass(m.q)}">${esc(m.name)}</span><span class="q ${qclass(m.q)}">${lv} / ${capLv} 级</span></div>
        <div class="ed">${esc(m.desc || '')}${extra}</div>
        <div style="margin-top:8px"><button class="mini2" data-skillup="${id}" ${lv >= capLv ? 'disabled' : ''}>${lv >= capLv ? '已至顶' : '花 1 技能点精进'}</button></div></div>`;
    }
    if (dev) {
      const un = window.JH_MARTIAL.filter(m => !m.secret && !s.skills[m.id] && m.kind);
      if (un.length) h += `<div class="entry"><div class="en"><span>还没学的技能（测试·用技能点学）</span><span class="q">${un.length}</span></div><div class="ed" style="display:flex;flex-wrap:wrap;gap:6px">` +
        un.map(m => `<button class="mini2" data-learn="${m.id}"${(s.sp || 0) < 1 ? ' disabled' : ''}>学·${esc(m.name)}（1 点）</button>`).join('') + '</div></div>';
    }
    h += '</div>';

    h += '<h2 class="viewtitle" style="margin-top:16px;font-size:15px">已 习<span class="hint" style="font-weight:normal;margin-left:8px">挂上去的才生效 —— 普通术式、秘传、生得术式都一样，点「卸下」当场就停</span></h2><div class="gridentry">';
    for (const id of Object.keys(s.skills)) {
      const m = window.JH_MARTIAL_MAP[id]; if (!m || m.kind === 'passive') continue;
      const on = e.activeOf(s, m.kind).indexOf(id) >= 0;
      const lv = s.skillLv[id] || 1;
      const capLv = m.maxLv || 3;
      const mark = m.innate ? (' · 生得术式' + ((s.innateOff && s.innateOff[m.innate]) ? '（这一系已收住）' : '')) : (m.secret ? ' · 秘传' : '');
      const upBtn = (m.common || m.innate || m.secret) ? '' : '<button class="mini2" data-skillup="' + id + '" ' + (lv >= capLv ? 'disabled' : '') + '>' + (lv >= capLv ? '已至顶' : '精进 ' + lv + ' / ' + capLv + '（1 点）') + '</button>';
      const devIn = dev ? ` <input class="devlv" data-dev="skillLv:${id}" value="${lv}" title="测试：直接改等级">` : '';
      h += `<div class="entry"><div class="en"><span class="${qclass(m.q)}">${esc(m.name)}</span><span class="q ${qclass(m.q)}">${QNAME()[m.q]} ${KIND[m.kind]}${mark}</span></div>
        <div class="ed">${esc(m.desc || '')}<br>${effText(m)}</div>
        <div style="margin-top:8px"><button class="mini2${on ? ' on' : ''}" data-tech="${id}">${on ? '卸下' : '启用'}</button>${upBtn}${devIn}</div></div>`;
    }
    h += '</div>';

    const bo = s.borrow || {};
    const boIds = Object.keys(bo).filter(id => window.JH_MARTIAL_MAP[id]);
    h += `<h2 class="viewtitle" style="margin-top:16px;font-size:15px">借 用　<span class="hint" style="font-weight:normal">术式模仿：打赢带术式的敌人就能借，最多 3 门、每门 ${window.JH_BORROW_MAX || 16} 次；对阵页各自是一个独立按键</span></h2><div class="gridentry">`;
    if (!boIds.length) h += '<p class="hint">还没有借来的术式。要有「术式模仿」这门生得术式，并打赢一个会使术式的敌人。</p>';
    for (const id of boIds) {
      const m = window.JH_MARTIAL_MAP[id];
      h += `<div class="entry"><div class="en"><span class="${qclass(m.q)}">借用·${esc(m.name)}</span><span class="q">余 ${bo[id]} 次</span></div>
        <div class="ed">${esc(m.desc || '')}<br>${effText(m)}</div>
        <div style="margin-top:8px"><button class="mini2" data-dropborrow="${id}">弃掉这门</button></div></div>`;
    }
    h += '</div>';

    const td = s.tamed || {};
    const tdIds = Object.keys(td).filter(id => window.JH_FOE_MAP[id]);
    h += `<h2 class="viewtitle" style="margin-top:16px;font-size:15px">收 服　<span class="hint" style="font-weight:normal">咒灵操术：用「收服」给出最后一击，就能把它收进账下，最多 6 种；对阵页各自是一个独立按键</span></h2><div class="gridentry">`;
    h += `<p class="hint">召唤物以「非常驻 buff + 护盾」的形式存在：护在你身前，护盾血量挂在血量槽上方的护盾槽里。战斗结束时残余护盾收回库存（当前 ${Math.round(s.csmBank || 0)}），咒灵带来的 buff 一并清除。<b>它还在场上时，再点那门术式就是把它收回来</b>，收回之后那门术式才进冷却。</p>`;
    h += `<p class="hint">护盾被打空＝这只咒灵<b>被打散</b>：这一场再也驱使不动（对阵页按键灰掉、标「已散」），散场后从账下划掉，想再驱使要重新收服。放出去就一直护着你，直到被打散（只有<b>镜屋</b>是沙盘，那边不算数）。</p>`;
    if (!tdIds.length) h += '<p class="hint">账下还没有咒灵。要有「咒灵操术」这门生得术式，把咒灵打残再收。</p>';
    for (const id of tdIds) {
      const f = window.JH_FOE_MAP[id];
      h += `<div class="entry"><div class="en"><span>${esc(f.name)}</span><span class="q">×${td[id]}</span></div>
        <div class="ed">${esc(f.desc || '')}<br><span class="hint">驱使一次要耗一笔咒力（未计咒力效率）；护在场上时它有一块自己的护盾。</span></div>
        <div style="margin-top:8px"><button class="mini2" data-droptamed="${id}">放走这只</button></div></div>`;
    }
    h += '</div>';

    const secIds = Object.keys(s.skills).filter(id => window.JH_MARTIAL_MAP[id] && window.JH_MARTIAL_MAP[id].secret);
    h += `<h2 class="viewtitle" style="margin-top:16px;font-size:15px">秘 传　<span class="hint" style="font-weight:normal">来路不明，全凭机缘；学到的都挂在「已习」里，开关也在那儿</span></h2><div class="gridentry">`;
    h += '<p class="hint">' + (secIds.length ? ('已学到 ' + secIds.length + ' 门：' + secIds.map(id => esc(window.JH_MARTIAL_MAP[id].name)).join('、')) : '还没有秘传。有些东西不写在纸上——多看、多搜、多等，或许会遇到肯教你的人。') + '</p>';
    if (dev) {
      const all = window.JH_MARTIAL.filter(m => m.secret);
      h += `<div class="entry"><div class="en"><span>全部秘传（测试）</span><span class="q">${all.length}</span></div><div class="ed">` +
        all.map(m => `<div>${esc(m.name)}　<span class="hint">${esc((e.reqText && e.reqText(m.req)) || '无条件')}</span>　<button class="mini2" data-learn="${m.id}">学（1 点）</button></div>`).join('') + '</div></div>';
    }
    h += '</div>';
    return h;
  }

   
  function viewSect() {
    const e = E(), s = e.s;
    let h = `<h2 class="viewtitle">组 织</h2>`;
    if (s.sect !== 's_none') {
      const sc = window.JH_SECT_MAP[s.sect];
      h += `<div class="subtitle">你身处 <b style="color:${sc.color}">${esc(sc.name)}</b>　联络人：${esc(sc.master)}　贡献：${s.contrib}</div>
        <div class="roomdesc">${esc(sc.desc)}</div>
        <div class="actbar">
          <button class="act" data-sectdaily>做组织任务（每日一次）</button>
          <button class="act danger" data-sectleave data-tip="走出这道门就会忘光本门术式、作废本门主修、贡献清零，同门好感也一并断掉。">脱离组织</button>
        </div>`;
      const roster = e.sparRoster();
       
      const memberIds = ((window.JH_SECT_MEMBERS || {})[s.sect] || []).filter(id => window.JH_NPC_MAP[id]);
      if (memberIds.length) {
        h += `<h2 class="viewtitle" style="font-size:15px">门 中 人　<span class="hint" style="font-weight:normal">共 ${memberIds.length} 位　·　每天按名录摇出 1~4 位到场对练</span></h2><div class="gridentry">`;
        for (const mid of memberIds) {
          const n = window.JH_NPC_MAP[mid];
          const rm = window.JH_ROOM_MAP[n.room], sc2 = rm ? window.JH_SCENE_MAP[rm.scene] : null;
          const aff = Math.round(s.aff[mid] || 0);
          const per = roster.find(x => x.npcId === mid);
          const leftN = per ? e.sparLeft(per.key) : 0;
          h += `<div class="entry${per ? '' : ' locked'}"><div class="en"><span>${esc(n.name)}</span><span class="q">好感 ${aff} / 100</span></div>
            <div class="ed">${esc(n.title || '')}<br><span class="hint">常在「${esc(rm ? rm.name : '不得而知')}」${sc2 ? '（' + esc(sc2.name) + '）' : ''}${per ? '　·　今日到场' : '　·　今日没来'}</span></div>
            ${per ? `<div style="margin-top:8px"><button class="mini2" data-spar="${esc(per.key)}" ${leftN > 0 ? '' : 'disabled'}>与 ${esc(n.name)} 对练</button></div>` : ''}</div>`;
        }
        h += '</div>';
      }
      h += `<h2 class="viewtitle" style="font-size:15px">同 门 对 练　<span class="hint" style="font-weight:normal">每天到场 1~4 位；每人每天最多三场；熟练度赢 ×20 / 输 ×10、单场至多 100</span></h2><div class="gridentry">`;
      if (!roster.length) h += '<p class="hint">今天门里没人得空。</p>';
      for (const per of roster) {
        const leftN = e.sparLeft(per.key);
        h += `<div class="entry"><div class="en"><span>${esc(per.name)}</span><span class="q">${leftN >= 99 ? '不限次' : '剩余 ' + leftN + ' / 3 次'}</span></div>
          <div class="ed"><span class="hint">与同门真打过招：熟练度按你使出的生得术式次数结算。</span></div>
          <div style="margin-top:8px"><button class="mini2" data-spar="${esc(per.key)}" ${leftN > 0 ? '' : 'disabled'}>与 ${esc(per.name)} 对练</button></div></div>`;
      }
      h += '</div>';
      h += `<h2 class="viewtitle" style="font-size:15px">贡献兑换</h2><div class="gridentry">`;
      for (const [id, cost] of sc.shop) {
        const isM = !!window.JH_MARTIAL_MAP[id];
        const nm = isM ? matName(id) : itemName(id);
        const ds = isM ? window.JH_MARTIAL_MAP[id].desc : (window.JH_ITEM_MAP[id] ? window.JH_ITEM_MAP[id].desc : '');
        h += `<div class="entry"><div class="en"><span>${esc(nm)}</span><span class="q">${cost} 贡献</span></div>
          <div class="ed">${esc(ds)}</div>
          <div style="margin-top:8px"><button class="mini2" data-sectbuy="${id}" ${s.contrib >= cost ? '' : 'disabled'}>兑换</button></div></div>`;
      }
      h += '</div>';
      return h;
    }
    const devS = !!(e.devEditable && e.devEditable());
    const joined = s.sectJoined || [];
    const joinedMsg = devS ? '（不设上限）'
      : ('一生最多认下三个组织' + (joined.length ? '，你已入 ' + joined.length + ' / 3' : ''));
    h += '<div class="subtitle">尚未加入任何组织（条件不足则不可入）。' + joinedMsg + '。</div><div class="gridentry">';
    for (const sc of window.JH_SECTS) {
      if (sc.id === 's_none') continue;
      const r = sc.req || {};
      const cond = [];
      if (r.flag) cond.push('需门路');
      if (r.root) cond.push('根骨 ' + r.root);
      if (r.insight) cond.push('悟性 ' + r.insight);
      if (r.realm) cond.push('境界 ' + E().REALMS[r.realm].name);
      const ok = (!r.root || s.attrs.root >= r.root) && (!r.insight || s.attrs.insight >= r.insight) &&
                 (!r.realm || s.realm >= r.realm) && (!r.flag || s.flags[r.flag]) &&
                 (!sc.hidden || s.flags.knows_curse_user || s.flags.knows_high);
      const full = !devS && joined.indexOf(sc.id) < 0 && joined.length >= 3;
      const can = ok && !full;
      h += `<div class="entry ${can ? '' : 'locked'}"><div class="en"><span style="color:${sc.color}">${esc(sc.name)}</span><span class="q">${esc(sc.align||'')}</span></div>
        <div class="ed">${esc(sc.desc)}<br><span class="hint">${cond.join('　') || '无门槛'}｜联络人：${esc(sc.master)}</span></div>
        <div style="margin-top:8px"><button class="mini2" data-join="${sc.id}" ${can ? '' : 'disabled'}>${can ? '加入' : (ok ? '不再收你' : '尚不可入')}</button></div></div>`;
    }
    h += '</div>';
    return h;
  }

   
  function viewCodex() {
    const e = E(), s = e.s;
    const disc = {}, discM = {};
    for (const id of Object.keys(s.items)) disc[id] = 1;
    for (const id of Object.keys(s.skills)) discM[id] = 1;
    const npcs = window.JH_NPCS.filter(n => !n.hide || s.met[n.id]);
    let h = `<h2 class="viewtitle">图 鉴</h2><div class="subtitle">见过的东西会记在这里。共收录 ${window.JH_ITEMS.length} 器物 / ${window.JH_MARTIAL.length} 术式 / ${npcs.length} 人物 / ${window.JH_EGGS.length} 闲趣。</div>`;
    const metN = Object.keys(s.met).length, knownI = Object.keys(disc).length, knownM = Object.keys(discM).length;
    h += `<div class="kv"><b>人物</b><span>${metN} / ${npcs.length}</span><b>器物</b><span>${knownI} / ${window.JH_ITEMS.length}</span><b>术式</b><span>${knownM} / ${window.JH_MARTIAL.length}</span></div>`;

    h += '<h2 class="viewtitle" style="font-size:15px;margin-top:14px">人物</h2><div class="gridentry">';
    for (const n of npcs) {
      const met = s.met[n.id];
      h += `<div class="entry ${met ? '' : 'locked'}"><div class="en"><span>${met ? esc(n.name) : '？？？'}</span></div>
        <div class="ed">${met ? esc(n.title + ' · ' + n.desc) : '尚未相识'}</div></div>`;
    }
    h += '</div>';

    h += '<h2 class="viewtitle" style="font-size:15px;margin-top:14px">术式</h2><div class="gridentry">';
    for (const m of window.JH_MARTIAL) {
      const has = !!discM[m.id];
      h += `<div class="entry ${has ? '' : 'locked'}"><div class="en"><span>${has ? esc(m.name) : '？？？'}</span><span class="q ${qclass(m.q)}">${has ? QNAME()[m.q] : '未得'}</span></div>
        <div class="ed">${has ? esc(m.desc) : '尚未习得'}</div></div>`;
    }
    h += '</div>';
    return h;
  }

   
  function viewEgg() {
    const e = E(), s = e.s;
    const got = Object.keys(s.eggs).length;
    let h = `<h2 class="viewtitle">闲 趣</h2><div class="subtitle">咒术的世界不只有打打杀杀。已拾得 ${got} / ${window.JH_EGGS.length} 处趣味。</div>`;
    h += `<div class="gridentry"><div class="entry" style="border-color:var(--gold)"><div class="en"><span>称号</span><span class="q">${Object.keys(s.titles).length}</span></div>
      <div class="ed">${Object.keys(s.titles).map(t => '<span title="' + esc((window.JH_TITLES || {})[t] || '') + '">' + esc(t) + '</span>').join('、') || '（暂无）'}</div></div></div>`;
    h += '<div class="gridentry" style="margin-top:12px">';
    for (const eg of window.JH_EGGS) {
      const has = !!s.eggs[eg.id];
      const kind = { search:'搜寻', visit:'到访', action:'动作', talk:'闲聊', click:'点击', at:'时辰', idle:'停留',
                     items:'同时持有', silver:'咒币', realm:'境界', crit:'暴击', win:'战胜', lose:'战败', bag:'收藏', secret:'密语' }[eg.type] || eg.type;
      h += `<div class="entry ${has ? '' : 'locked'}" ${has ? '' : 'title="'+esc(eg.hint)+'"'}>
        <div class="en"><span>${has ? '★ ' + esc(eg.title) : '？ 未解'}</span><span class="q">${kind}</span></div>
        <div class="ed">${has ? esc(eg.name) : '（' + esc(eg.hint) + '）'}</div></div>`;
    }
    h += '</div>';
    return h;
  }

  


  function viewLog() {
    return '<div class="logview"><h2 class="viewtitle">见 闻</h2>' +
      '<div class="mediabar">' +
        '<button id="btnLogPrev" class="mini lognav hidden" data-media="prev" data-tip="上一页：往回翻画册；从流水往回翻就绕到最后一页。">‹</button>' +
        '<span id="mediaTitle">见闻</span>' +
        '<button id="btnLogNext" class="mini lognav hidden" data-media="next" data-tip="下一页：往下翻画册；翻到最后一页再按一下就绕回流水（循环）。">›</button>' +
        '<span id="mediaCount" class="dim"></span>' +
      '</div>' +
      '<div id="logStage" class="logstage hidden"></div>' +
      '<div id="logFull" class="battlelog logfull"></div>' +
    '</div>';
  }

   
  function viewHelp() {
    return `<h2 class="viewtitle">说 明</h2>
    <div class="actbar"><button class="act" data-help2="tut">新手上路（第一次进来先看这个）</button></div>
    <div class="roomdesc" style="line-height:2.1">
    · 所在页过日子，舆图换地方，对阵页打架。右侧「见闻」只是流水账。
    · <b>修为</b>只来自打怪与明确的奖励，剧情只讲故事；攒够了点「突破境界」，修为清零、技能点增加。
    · <b>休息 / 打坐</b>：闲下来咒力与气血都不会自己涨，得点它俩（打坐更快，还能把咒力总量磨厚一点）；精力只在家里回。
    · <b>出力</b>：人物页 / 对阵页两条滑条 —— 出力越高术式打得越重、咒力也烧得越快；物理出力开太满，容易吃反击。
    · <b>伤害与防御</b>：出手分物理与咒力两条道，最后按对方防御打折，再算随机、暴击与黑闪。防御是越堆越不划算的那种。除少数明写门路的敌手外，其余敌手的出手都是<b>半咒力半物理</b> —— 只挡得住其中一条道的本事（比如无下限）照样会被打进去。
    · <b>打起来另算</b>：真进战斗后两边都加厚一层底盘，每回合还自行回一点咒力。
    · <b>赶路与副本</b>：换地方要时间，跨大地图更久；有身法、瞬移一类本事能少走些路。副本先清掉几只杂鱼，头目才现身。
    · <b>剧情</b>：差物品、旗标或时辰时，选项会「暂且搁下」，日后再来；多留意好感、时辰、地点与密语。
    · <b>技能三类</b>：术式页分主动术式 / 咒力运用 / 体术身法，同时生效的门数各有上限；<b>只有挂上去的才生效</b> —— 普通术式、秘传、生得术式都在「已习」里启用或卸下，卸下当场就停；生得术式不占这三类槽位。
    · <b>熟练度与试炼</b>：生得术式靠与同门对练长，赢多输少；<b>前五级（1~5 级）的升级不吃试炼，6 级起的衍生招数与领域要过了这一系的试炼才给</b>（有的出身与联机对战里的角色免试）。每一系还有个<b>「系：开 / 关」</b>—— 关掉后这一系的术式与被动（比如无下限的「打不着你」）一起停手。
    · <b>组织</b>：用贡献换本门的术式与物件，一生最多认下三个；退出会清掉本门的术式、贡献与同门好感。
    · <b>委托与好感</b>：凑齐人物要的东西就能交差；闲谈一天只算一次，礼物送对路涨得快。
    · <b>锻冶与商铺</b>：锻冶页既能练兵器、也能把兵器做成咒具；黑市与家里那间铺子各有来路，后者只有某种特殊出身才推得开。
    · <b>音乐</b>：右上角的「乐」是自定义音乐盒 —— 把音频丢进 userdata\music\，丢多少首就有多少首。
    · <b>濒死</b>：气血归零时偶尔会「摸到咒术的核心」，回一半气血；一场里敌我各触发一次，前两次才长本事。
    · <b>发呆 / 木桩</b>：对阵页的「发呆」这一手什么都不做；自宅的木桩拿来试招，不还手、不耗咒力。
    · <b>回复类术式</b>：反转术式这类每回合按气血上限回一份，代价是<b>同样多的咒力</b>（回多少扣多少）；命脉同理。对阵页有「回复术式：开 / 关」，开打默认开着，随手一按就切、<b>不占回合</b>；没在「已习」里挂上回复类术式，对阵页连这个按键都没有；练功木桩那一场不记账。
    · <b>镜屋不动真身</b>：镜屋照出「另一个自己」，数值与术式自己填，开打后随时换视角；在镜子里挨的打、烧的咒力一点都不会写回存档。
    · <b>悬停说明</b>：鼠标停在状态小圆片或按键上，会弹出它的效果说明。
    · <b>本作</b>：以单机的放置玩法为主，另有可选的局域网对战。可写文件只落在程序目录下的 userdata\ 里。
    </div>
    <p>· <b>本体与自定义</b>：本体的剧情 / 术式 / 装备 / 地图这些随程序走；要加自己的东西就丢进 app\\custom\\，开游戏自动装上，装不上的在「设置 → 自定义内容」里列出来。想换画面（打斗画面 / 人物建模 / 术式特效 / 大地图背景）就把图片丢进「自定义图片」。</p>
    <p>· <b>领域展开的门槛</b>：学过结界术就展得开 —— <b>只要 1 级</b>；结界术 <b>3 级满</b>，切形态要满级才动得了；某种特殊出身不受此限。</p>
    <p>· <b>领域形态（开放 / 封闭）</b>：<b>每一门领域都开得成开放式</b>，对阵页「收手」旁边那个按键随手切；开放式不设结界、能叠在别人的领域上、压封闭领域一头，也关不住人。</p>
    <p>· <b>术式冷却</b>：越重的术式歇得越久，领域展开最久，从「收场」起算（再点一次就是收回）；一场打完，冷却 / 熔断 / 领域崩坏<b>会自动清空</b>。</p>
    <p>· <b>出力 = 生效百分比</b>：调低出力，术式省咒力但打得轻；调高则相反。</p>
    <p>· <b>咒具词条</b>：刻词条是<b>概率抽取</b>，稀有词条全看运气；某种特殊出身可以自己挑。<b>咒术存储（一条咒具标签）</b> —— 刻上了才存得住对手的术式。顺带说清<b>「咒力无效化」的两层意思</b>：先在咒具上抽到这个词条，才轮到它后面那句挡击。</p>
    <p>· <b>黑闪心得</b>：正路上摸不着，得靠别的机缘；<b>改姓名</b>则随时能在「设置」里换。</p>
    <p>· <b>十四门领域各有一整套「每回合机制」</b>：钉住、下命令、群影扑咬、捏灵魂、斩击、点分点、炮台、易位、定身、叠赝品、中奖……每门领域立起来都会每回合替主人办事。</p>
    <p>· <b>领域血量</b>：领域有自己的血，摆在护盾槽上面，会被对手的领域与技能直接打到；两座领域之间另走一套「互相啃啮」的账，哪边先归零哪边先破。<b>领域强度</b>随血涨落，对撞比的就是它；注力能把血与强度顶回来。</p>
    <p>· <b>领域维持</b>：领域每回合都要烧咒力吊着，咒效 / 咒操越高越省；<b>咒力见底就供不起，领域自行散开</b>。</p>
    <div class="tagline">《咒术闲录》为非商业同人自研的单机放置游戏：玩法骨架参考《放置江湖》，世界观取材《咒术回战》，场景、人物、文案、数值均为原创，未使用上述作品的任何素材，亦与其版权方无隶属或授权关系。</div>`;
  }

   
   
  let fxList = [];
  let fxSeq = 0;
  

  function lanSwapNow() {
    const b = (window.JH && window.JH.engine && window.JH.engine.getBattle) ? window.JH.engine.getBattle() : null;
    return !!(b && b.lan && !b.lan.hostIsMe);
  }
  function sideFlip(side) {
    const sd = side || 'hero';
    return lanSwapNow() ? (sd === 'hero' ? 'foe' : 'hero') : sd;
  }
  function pushFx(kind, side, text, ms, meta) {
    const dur = (ms || (kind === 'ink' || kind === 'domain' ? 1350 : (kind === 'dmg' ? 1100 : 950))) + ((meta && meta.delay) || 0);
    fxList.push({ id: ++fxSeq, kind: kind, side: sideFlip(side), text: text || '', meta: meta || null, until: Date.now() + dur });
    if (fxList.length > 14) fxList.splice(0, fxList.length - 14);
  }
  

  function pushMove(side, mv, ms) {
    fxList.push({ id: ++fxSeq, kind: 'move', side: sideFlip(side), text: '', meta: { mv: mv }, until: Date.now() + (ms || 900) });
    if (fxList.length > 14) fxList.splice(0, fxList.length - 14);
  }
   
  function domEntryOf(a) { return (a && ((a.pst && a.pst.dom) || a.dom)) || null; }
   
  function activeDomainOf(s) {
    if (s.pst && s.pst.dom) { const dm0 = window.JH_MARTIAL_MAP[s.pst.dom.id]; if (dm0) return dm0; }
    for (const tid of (s.innate || [])) {
      const t = window.JH_INNATE_MAP[tid];
      if (!t || !t.domain) continue;
      if (!window.JH_combat.domainOn(s, tid)) continue;
      const dm = window.JH_MARTIAL_MAP[t.domain];
      if (dm) return dm;
    }
    return null;
  }
   
  let _stubDom = null;
  function stubDom() {
    if (_stubDom === null) { const d = document.createElement('div'); _stubDom = (d.firstChild === undefined); }
    return _stubDom;
  }
   
  function setCls(el, want) {
    if (!el || !el.classList) return;
    const cur = (el.getAttribute ? (el.getAttribute('class') || '') : (el.className || '')).split(/\s+/).filter(Boolean);
    for (const c of cur) if (want.indexOf(c) < 0) el.classList.remove(c);
    for (const c of want) if (cur.indexOf(c) < 0) el.classList.add(c);
  }
   
  function syncFxlayer(layer, groups) {
    if (!layer) return;
    const want = {};
    for (const g of groups) want[g.id] = 1;
    for (const ch of [].slice.call(layer.children)) {
      if (!ch.dataset || !ch.dataset.fx || !want[ch.dataset.fx]) layer.removeChild(ch);
    }
    const have = {};
    for (const ch of [].slice.call(layer.children)) if (ch.dataset) have[ch.dataset.fx] = 1;
    for (const g of groups) {
      if (have[g.id]) continue;
      const tmp = document.createElement('div');
      tmp.innerHTML = g.html;
      while (tmp.firstChild) {
        const n = tmp.firstChild;
        tmp.removeChild(n);
        n.dataset.fx = String(g.id);
        if (g.delay && n.style) { n.style.animationDelay = g.delay + 'ms'; n.style.animationFillMode = 'both'; }
        layer.appendChild(n);
      }
    }
  }
   
  function battleDyn(fx, s, foe, st) {
    const hit = (k, side) => fx.some(f => f.kind === k && (!side || f.side === side));
    const moveOf = side => { const a = fx.filter(f => f.kind === 'move' && f.side === side).map(f => f.meta && f.meta.mv).filter(Boolean); return a.length ? a[a.length - 1] : ''; };
    const heroAtk = hit('phy') || hit('ink') || hit('domain');
    const foeAtk = hit('foeAtk', 'foe');
    const clash = !!(heroAtk && foeAtk);
    const heavy = fx.some(f => f.kind === 'domain' || f.kind === 'ink');
    const foeMax = foe.hpMax || window.JH_combat.stats(foe).hpMax || st.hpMax;
    const lowHero = s.hp <= st.hpMax * 0.25, lowFoe = !foe.dummy && foe.hp <= foeMax * 0.25;
    const dom = activeDomainOf(s);
    const domK = (fx.filter(f => f.kind === 'domain').map(f => f.meta && f.meta.domKind).filter(Boolean).pop()) || (dom ? dom.domKind : '');
     
    const heroMv = moveOf('hero') || (clash ? 'dash' : (hit('phy') ? 'strike' : ((hit('ink') || hit('domain')) ? 'cast' : '')));
    const foeMv = moveOf('foe') || (clash ? 'dash' : (foeAtk ? 'strike' : ''));
    const stage = [];
    if (fx.some(f => f.kind === 'signbg')) stage.push('signshow');
    if (heavy) stage.push('quake');
    if (clash) stage.push('clash');
    if (domK) stage.push('domk-' + domK);
    const hero = (heroMv ? heroMv.split(' ') : []).concat(hit('dmg', 'hero') ? ['hurt'] : []).concat(lowHero ? ['weak'] : []);
    const foeC = (foeMv ? foeMv.split(' ') : []).concat(hit('dmg', 'foe') ? ['hurt'] : []).concat(lowFoe ? ['weak'] : []);
    return { stage: stage, hero: hero, foe: foeC, domK: domK, heavy: heavy, clash: clash, heroAtk: heroAtk, foeAtk: foeAtk };
  }
  function modsOf(arr) { return arr.length ? ' ' + arr.join(' ') : ''; }
  function liveFx() {
    const now = Date.now();
    fxList = fxList.filter(f => f.until > now);
    return fxList;
  }
   
  function sealShow() {
    return '<div class="sealshow">' +
      '<span class="sb-ring"></span><span class="sb-glyphs"></span>' +
      '<span class="sb-shoulder"></span>' +
      '<span class="sb-leg l"></span><span class="sb-leg r"></span>' +
      '<span class="sb-body"></span><span class="sb-neck"></span>' +
      '<span class="sb-head"></span>' +
      '<span class="sb-arm l"></span><span class="sb-arm r"></span>' +
      '<span class="sb-palm l"></span><span class="sb-palm r"></span>' +
      '</div>';
  }
   
  function tintCls(f) {
    const t = f && f.meta && f.meta.tint;
    return t ? ' tint-' + t : '';
  }
   
  function skillLabel(text) {
    const cs = String(text || '').split('');
    if (!cs.length) return '';
    return '<div class="inklabel">' + cs.map((c, i) =>
      '<i style="animation-delay:' + (i * 70) + 'ms">' + esc(c) + '</i>').join('') + '</div>';
  }
   
  const DOM_FX = {
     
    infoOverload: () => '<div class="domveil"></div><div class="domhole"></div><div class="domrings"></div>',
     
    openBarrier: () => '<div class="domveil"></div><div class="domcut"></div><div class="domcut b"></div><div class="domcut c"></div>',
     
    shadowSwarm: () => '<div class="domveil"></div><div class="dompool shadow"></div><div class="domswarm"></div>',
     
    soulTrue: () => '<div class="domveil"></div><div class="domsphere"></div><div class="domsphere b"></div>',
     
    bloodPrice: () => '<div class="domveil"></div><div class="dompool blood"></div><div class="domdrops"></div>',
     
    command: () => '<div class="domveil"></div><div class="dommute"></div><div class="domglyphring"></div>',
     
    weakPoint: () => '<div class="domveil"></div><div class="domgrid"></div><div class="dommark"></div>',
     
    turretShield: () => '<div class="domveil"></div><div class="domdots"></div><div class="domcross"></div>',
     
    craftRandom: () => '<div class="domveil"></div><div class="domblocks"></div>',
     
    position: () => '<div class="domveil"></div><div class="domswap"></div><div class="domrings"></div>',
     
    frameLock: () => '<div class="domveil"></div><div class="domframes"></div>',
     
    warehouse: () => '<div class="domveil"></div><div class="domcopy"></div><div class="domdots wide"></div>',
     
    slotJackpot: () => '<div class="domveil"></div><div class="domroll"></div>',
     
    debuffSwarm: () => '<div class="domveil"></div><div class="domswarm dense"></div><div class="dompool shadow"></div>',
    _default: () => '<div class="ink ink-domain"></div><div class="ink-pillars"></div><div class="ink-glyphs"></div><div class="ink-runes"></div><div class="ink-ring"></div>'
  };
  

  const DOM_KIT = {
    infoOverload: { c: '#cfe0ff', mv: 'mv-dom-hand' },
    openBarrier:  { c: '#e8e0cf', mv: 'mv-dom-slash' },
    shadowSwarm:  { c: '#8fa8d8', mv: 'mv-dom-ground' },
    soulTrue:     { c: '#d8b0e6', mv: 'mv-dom-grasp' },
    bloodPrice:   { c: '#d06a6a', mv: 'mv-dom-rise' },
    command:      { c: '#bcd9ff', mv: 'mv-dom-chant' },
    weakPoint:    { c: '#f0dcae', mv: 'mv-dom-point' },
    turretShield: { c: '#a8c0d8', mv: 'mv-dom-deploy' },
    craftRandom:  { c: '#c9b08a', mv: 'mv-dom-forge' },
    position:     { c: '#c0b0e0', mv: 'mv-dom-swap' },
    frameLock:    { c: '#d8c8a0', mv: 'mv-dom-freeze' },
    warehouse:    { c: '#cfd8e6', mv: 'mv-dom-mirror' },
    slotJackpot:  { c: '#e6c46a', mv: 'mv-dom-roll' },
    debuffSwarm:  { c: '#9aa8c8', mv: 'mv-dom-summon' }
  };
  

  const DOM_AMBIENT = {
    infoOverload: () => '<div class="domhole amb"></div><div class="domrings"></div>',
    openBarrier:  () => '<div class="domcut"></div><div class="domcut b"></div>',
    shadowSwarm:  () => '<div class="dompool shadow"></div><div class="domswarm"></div>',
    soulTrue:     () => '<div class="domsphere amb"></div><div class="domsphere b"></div>',
    bloodPrice:   () => '<div class="dompool blood"></div><div class="domdrops"></div>',
    command:      () => '<div class="dommute"></div><div class="domglyphring"></div>',
    weakPoint:    () => '<div class="domgrid"></div><div class="dommark"></div>',
    turretShield: () => '<div class="domdots"></div><div class="domcross"></div>',
    craftRandom:  () => '<div class="domblocks"></div>',
    position:     () => '<div class="domswap"></div><div class="domrings"></div>',
    frameLock:    () => '<div class="domframes"></div>',
    warehouse:    () => '<div class="domcopy"></div><div class="domdots wide"></div>',
    slotJackpot:  () => '<div class="domroll"></div>',
    debuffSwarm:  () => '<div class="domswarm dense"></div><div class="dompool shadow"></div>',
    _default:     () => '<div class="ink-pillars"></div><div class="ink-ring"></div>'
  };
   
  const SUMMON_FX = {
    shadow: () => '<div class="smnpool"></div><div class="smnrise"></div><div class="smnfangs"></div>',
    curse:  () => '<div class="smnpool curse"></div><div class="smnblob"></div><div class="smneyes"></div>',
    copy:   () => '<div class="smnglass"></div><div class="smndouble"></div>',
    puppet: () => '<div class="smnpool wood"></div><div class="smnwood"></div><div class="smnjoints"></div>',
    _default: () => '<div class="smnpool"></div><div class="smnrise"></div>'
  };
   
  function fxImgOf(f) {
    if (!window.JH_IMGC_fx) return '';
    const m = f.meta || {};
    return window.JH_IMGC_fx(f.kind, m.skill || '', m.innate || '', m.domKind || '');
  }
  

  function seqHtml(seq, base) {
    let t = base || 0, h = '<div class="fxseq">';
    for (const fr of seq) {
      const p = fr && fr.p; if (!p) continue;
      h += '<img class="fximg seqframe" src="' + esc(p) + '" data-cut="' + esc(p) + '" ' +
           'style="animation:fximgSeq ' + (fr.ms || 450) + 'ms linear ' + t + 'ms forwards" alt="">';
      t += (fr.ms || 450);
    }
    return h + '</div>';
  }
   
  function actSeqOf(act, m0) {
    if (!window.JH_IMGC_fxSeq || !act) return null;
    if (act.type === 'idle' || act.type === 'flee' || act.type === 'switch' || act.type === 'domform' || act.type === 'store' || act.type === 'healtoggle') return null;
    const m = m0 || null;
    const kind = (m && m.domain) ? 'domain' : (act.type === 'drive' ? 'summon'
               : ((act.type === 'skill' || act.type === 'borrow' || act.type === 'stored') ? 'ink' : 'phy'));
    return window.JH_IMGC_fxSeq(kind, act.id || '', (m && m.innate) || '', (m && m.domKind) || '') || null;
  }
  


  function domBgOf(s, foe) {
    if (!window.JH_IMGC_domBg) return null;
    const a = domEntryOf(s), b = domEntryOf(foe);
    if (!a && !b) return null;
    const hpOf = d => { if (!d) return 0; const v = d.hp; return v === Infinity ? Infinity : (isFinite(v) ? v : 0); };
    const powOf = d => (d && isFinite(d.pow)) ? d.pow : 0;
    let side, dom;
    if (a && !b) { side = 'hero'; dom = a; }
    else if (b && !a) { side = 'foe'; dom = b; }
    else if (hpOf(a) !== hpOf(b)) { const aWin = hpOf(a) > hpOf(b); side = aWin ? 'hero' : 'foe'; dom = aWin ? a : b; }
    else { const aWin = powOf(a) >= powOf(b); side = aWin ? 'hero' : 'foe'; dom = aWin ? a : b; }
    const url = window.JH_IMGC_domBg(side, (dom && dom.domKind) || '');
     
    return { url: url || '', side: side, domKind: (dom && dom.domKind) || '' };
  }
  function summonFxHtml(f) {
    const v = (f.meta && f.meta.summonKind) || 'shadow';
    const body = (SUMMON_FX[v] || SUMMON_FX._default)();
    return '<div class="smnfx">' + body + '<div class="smncore"></div></div>' + skillLabel(f.text);
  }
  function domainFxHtml(f) {
    const dk = (f.meta && f.meta.domKind) || '';
    const kit = DOM_KIT[dk] || {};
    const amb = !!(f.meta && f.meta.ambient);
    const body = amb ? ((DOM_AMBIENT[dk] || DOM_AMBIENT._default)()) : ((DOM_FX[dk] || DOM_FX._default)());
     
    const cls = 'domfx' + (f.side === 'foe' ? ' foe' : '') + (amb ? ' ambient' : '');
    return '<div class="' + cls + '" style="--dom-accent:' + (kit.c || '#c9a86a') + '">' + body +
      '<div class="domcore"></div><div class="domglyphs domacc"></div><div class="domring domacc"></div></div>' + skillLabel(f.text);
  }

   
  function hitStop(strong) {
    const st = document.querySelector('#main .stage');
    if (!st || st.querySelector('.hitflash')) return;
    const fl = document.createElement('div');
    fl.className = 'hitflash';
    st.appendChild(fl);
    st.classList.add('hitstop');
    setTimeout(() => st.classList.remove('hitstop'), strong ? 180 : 120);
    setTimeout(() => { if (fl.parentNode) fl.parentNode.removeChild(fl); }, strong ? 200 : 140);
  }

   
  function summonKindOf(act, sh) {
    if (act && act.type === 'drive') return 'curse';
    if (act && (act.type === 'stored' || act.type === 'borrow')) return 'copy';
    const m = act && act.id ? window.JH_MARTIAL_MAP[act.id] : null;
    const tid = m ? m.innate : '';
    if (tid === 't_csm') return 'curse';
    if (tid === 't_mimic') return 'copy';
    if (tid === 't_puppet') return 'puppet';
    if ((sh && sh.src === 'csm') || /咒灵/.test((sh && sh.name) || '')) return 'curse';
    return 'shadow';
  }
   
  function bindBattleBtns() {
    document.querySelectorAll('[data-battle]').forEach(b => b.onclick = () => {
      if (b.disabled) return;
      const v = b.dataset.battle;
      let act = { type: 'attack' };
      if (v.startsWith('skill:')) act = { type: 'skill', id: v.slice(6) };
      else if (v.startsWith('borrow:')) act = { type: 'borrow', id: v.slice(7) };
      else if (v.startsWith('drive:')) act = { type: 'drive', id: v.slice(6) };
      else if (v.startsWith('stored:')) act = { type: 'stored', item: v.slice(7) };
      else if (v.startsWith('store:')) act = { type: 'store', item: v.slice(6) };
      else if (v === 'idle') act = { type: 'idle' };
      else if (v === 'flee') act = { type: 'flee' };
      else if (v === 'switch') act = { type: 'switch' };
      else if (v === 'domform') act = { type: 'domform' };
      else if (v === 'healtoggle') {
         
        const b1 = E().getBattle();
        const held1 = (b1 && b1.pvp && b1.ctrl === 'foe') ? b1.foe : E().s;
        act = { type: 'healtoggle', on: !window.JH_combat.healOnOf(held1) };
      }
      else if (v === 'potion') { potionModal(); return; }
       
      if (window.JH_room && window.JH_room.onAction && window.JH_room.onAction(act)) return;
      runAct(act);
    });
  }
  


  function actChoreo(act) {
    const m = act.id ? window.JH_MARTIAL_MAP[act.id] : null;
    const eff = m ? window.JH_combat.mechOf(m) : {};
    const steps = [], fx = [];
    let hit = 0, total = 0;
    const mv = (t, name, dur) => { steps.push({ t: t, mv: name, dur: dur }); if (t + dur > total) total = t + dur; };
    const at = (t, kind, text, ms, meta) => fx.push({ t: t, kind: kind, text: text, ms: ms, meta: meta });
    if (act.type === 'flee' || act.type === 'switch') return { steps: steps, fx: fx, hit: 0, total: 0 };
    if (act.type === 'idle') {
       
      at(160, 'ink', '……', 1000, { tint: 'idle' });
      return { steps: steps, fx: fx, hit: 160, total: 620 };
    }
    if (act.type === 'item') {
      

      const it0 = (window.JH_ITEM_MAP && window.JH_ITEM_MAP[act.id]) || null;
      mv(0, 'mv-stance', 620);
      at(300, 'ink', (it0 && it0.name) ? ('服下 ' + it0.name) : '服下', 1100, { tint: 'item' });
      return { steps: steps, fx: fx, hit: 460, total: 920 };
    }
    if (act.type === 'store') {
       
      at(0, 'signbg', '', 900, {});
      mv(0, 'mv-chan', 520); mv(460, 'mv-stance', 920);
      at(460, 'ink', '亮出咒具', 1200, { tint: 'item' });
      return { steps: steps, fx: fx, hit: 540, total: 1000 };
    }
    if (act.type === 'domform') { mv(0, 'mv-chan', 520); at(120, 'ink', '领域形态', 1000, { tint: 'cur' }); return { steps: steps, fx: fx, hit: 300, total: 560 }; }
    if (act.type === 'healtoggle') {
       
      mv(0, 'mv-stance', 420); at(120, 'ink', act.on ? '回复术式·开' : '回复术式·关', 1000, { tint: 'item' });
      return { steps: steps, fx: fx, hit: 300, total: 520 };
    }
    const isDom = !!(m && m.domain);
    const isSummon = !!(eff.summon || act.type === 'drive');
    const isPhy = (act.type === 'attack') || !!(m && m.atkType === 'phy');
    const label = act.type === 'borrow' ? '借·' + m.name : (m ? m.name : '术式');
     
    if (isDom) {
       
      const kit = DOM_KIT[m.domKind] || {};
      at(0, 'signbg', '', 1300, {});
      mv(0, kit.mv || 'mv-chan', 700); mv(660, kit.mv || 'mv-cast', 900);
      at(660, 'domain', m.name, 1500, { domKind: m.domKind, id: m.id });
      hit = 900;
    } else if (isSummon) {
       
      at(0, 'signbg', '', 1200, {});
      mv(0, 'mv-chan', 560); mv(520, 'mv-summon', 1080);
      at(520, 'ink', act.type === 'drive' ? '驱使' : label, 1350, { tint: 'shadow' });
      hit = 780;
    } else if (isPhy) {
       
      const plain = act.type === 'attack';
      const hits = (m && m.hits) || 1;
      const many = hits >= 3, dual = hits === 2;
      const mv2 = many ? 'mv-rush mv-flurry' : (dual ? 'mv-rush mv-dual' : 'mv-rush mv-elbow');
      mv(0, plain ? 'mv-rush mv-elbow' : mv2, plain ? 950 : (many ? 1080 : (dual ? 1010 : 980)));
      at(plain ? 180 : 160, 'phy', plain ? '' : label, plain ? 950 : 1150,
         plain ? null : { tint: (m && m.atkType === 'phy') ? 'phy' : 'cur' });
      hit = plain ? 400 : (many ? 500 : (dual ? 470 : 420));
    } else if (m && m.kind === 'nei') {
       
      at(0, 'signbg', '', 1100, {});
      mv(0, 'mv-chan', 520); mv(500, 'mv-stance', 900);
      at(500, 'ink', label, 1350, { tint: 'nei' });
      hit = 780;
    } else if (m && m.kind === 'qing') {
       
      mv(0, 'mv-blink', 620); mv(560, 'mv-cast', 560);
      at(540, 'ink', label, 1350, { tint: 'qing' });
      hit = 700;
    } else {
       
      at(0, 'signbg', '', 1100, {});
      mv(0, 'mv-chan', 560); mv(520, 'mv-cast', 1020);
      at(520, 'ink', label, 1350, { tint: 'cur' });
      hit = 800;
    }
    return { steps: steps, fx: fx, hit: hit, total: total };
  }
  let acting = false, actToken = 0;
  

  function runAct(act) {
    const e = E(), s = e.s;
    if (acting) return false;
    const b0 = e.getBattle();
    if (!b0 || !b0.foe) return false;
    let ch;
    try { ch = actChoreo(act); } catch (err) { ch = { steps: [], fx: [], hit: 0, total: 400 }; }
    const m0 = act.id ? window.JH_MARTIAL_MAP[act.id] : null;
     
    const seqL = actSeqOf(act, m0);
    if (seqL && seqL.length) {
      const seqMs = seqL.reduce((a, f) => a + (f.ms || 0), 0);
      const tgt = ch.fx.filter(f => f.kind === 'ink')[0] || ch.fx.filter(f => f.kind === 'domain')[0] ||
                  ch.fx.filter(f => f.kind === 'summon')[0] || ch.fx.filter(f => f.kind === 'phy')[0];
      if (tgt) {
        tgt.meta = Object.assign({}, tgt.meta || {}, { seq: seqL, seqMs: seqMs });
        tgt.ms = Math.max(tgt.ms || 0, seqMs);
        ch.hit = Math.max(ch.hit, (tgt.t || 0) + seqMs);
        ch.total = Math.max(ch.total, (tgt.t || 0) + seqMs + 300);
      }
    }
    const isDom = !!(act.id && window.JH_MARTIAL_MAP[act.id] && window.JH_MARTIAL_MAP[act.id].domain);
    const meActor = (b0.pvp && b0.ctrl === 'foe') ? b0.foe : s;
    const dom = activeDomainOf(meActor);
     
    if (dom && !isDom) pushFx('domain', 'hero', '', 1200, { domKind: dom.domKind, id: dom.id, ambient: 1 });
     
    const oppoDom = domEntryOf((b0.pvp && b0.ctrl === 'foe') ? s : b0.foe);
    if (oppoDom && !isDom) pushFx('domain', 'foe', '', 1200, { domKind: oppoDom.domKind, id: oppoDom.id, ambient: 1 });
    for (const st of ch.steps) {
      if (st.t <= 0) pushMove('hero', st.mv, st.dur);
      else setTimeout((function (name, dur) { return function () { pushMove('hero', name, dur); renderBattle(); }; })(st.mv, st.dur), st.t);
    }
    for (const f of ch.fx) {
       
      const meta = Object.assign({}, f.meta || {});
      if (f.t > 0) meta.delay = (meta.delay || 0) + f.t;
      if (!meta.skill) meta.skill = act.id || '';
      if (!meta.innate) meta.innate = (m0 && m0.innate) || '';
      pushFx(f.kind, 'hero', f.text, f.ms, meta);
    }
    renderBattle();
    

    acting = true;
    const tok = ++actToken;
    setTimeout(function () { resolveAct(act, b0.foe, tok); }, ch.hit);
    setTimeout(function () { if (actToken === tok) acting = false; }, ch.total + 140);    
    return true;
  }
  

  function resolveAct(act, foe, tok) {
    const unlock = function () { if (tok == null || actToken === tok) acting = false; };
    try { resolveActInner(act, foe, unlock); } catch (err) { unlock(); }
  }
  function resolveActInner(act, foe, unlock) {
    const e = E(), s = e.s;
    const b0 = e.getBattle();
    if (!b0 || !foe) { unlock(); return; }
     
    const pvp = !!b0.pvp, ctrlFoe = pvp && b0.ctrl === 'foe';
    const mine = ctrlFoe ? b0.foe : s, other = ctrlFoe ? s : foe;
    const hp0 = other.hp, my0 = mine.hp;
    const sh0 = window.JH_combat.shieldsOf ? window.JH_combat.shieldsOf(mine).map(function (x) { return x.key; }) : [];
    const opDom0 = domEntryOf(other);        
    e.battleAct(act);                        
     
    const opDom = domEntryOf(other);
    if (opDom && opDom.id !== (opDom0 && opDom0.id)) {
      const oc = window.JH_MARTIAL_MAP[opDom.id];
      const okit = (oc && DOM_KIT[oc.domKind]) || {};
      pushFx('signbg', 'foe', '', 1200, {});
      pushMove('foe', okit.mv || 'mv-chan', 1100);
      pushFx('domain', 'foe', oc ? oc.name : '', 1500, { domKind: oc ? oc.domKind : '', id: opDom.id });
    }
     
    if (window.JH_combat.shieldsOf && mine.hp > 0) {
      for (const sh of window.JH_combat.shieldsOf(mine)) {
        if (sh0.indexOf(sh.key) >= 0 || sh.kind !== 'summon') continue;
        pushFx('summon', 'hero', sh.name, 1500, { summonKind: summonKindOf(act, sh) });
      }
    }
    const nowMs = Date.now();
    if (mine.ndSay && mine.ndSay.until > nowMs) pushFx('say', 'hero', mine.ndSay.text, 2400);
    if (other.ndSay && other.ndSay.until > nowMs) pushFx('say', 'foe', other.ndSay.text, 2400);
    const dFoe = Math.round(hp0 - other.hp), dMe = Math.round(my0 - mine.hp);
    if (dFoe > 0) { pushFx('dmg', 'foe', '-' + dFoe, 1100); pushFx('impactH', 'hero', '', 520); }
    if (s.log.slice(-4).map(function (x) { return x.text || ''; }).join('|').indexOf('黑闪') >= 0) pushFx('bf', 'hero', '黑闪');
    hitStop(act.type !== 'attack');
    renderBattle();
    const going = !!e.getBattle();
    if (pvp) {
      


      if (going) {
        const oppAct = (b0.lan && b0.lan.act) || null;
        const om = (oppAct && oppAct.id && window.JH_MARTIAL_MAP[oppAct.id]) || null;
        const oppQuiet = !oppAct || oppAct.type === 'idle' || oppAct.type === 'flee';
        const oppKind = (om && om.domain) ? 'domain'
          : (oppAct && oppAct.type === 'drive') ? 'summon'
          : ((oppAct && (oppAct.type === 'skill' || oppAct.type === 'borrow' || oppAct.type === 'stored')) ? 'ink' : 'foeAtk');
        if (b0.lan && !oppQuiet) {
          setTimeout(function () {
            if (!e.getBattle()) return;
            pushMove('foe', (oppKind === 'ink' || oppKind === 'domain') ? 'mv-chan mv-cast' : 'mv-rush mv-elbow', 900);
            const meta = oppKind === 'ink'
              ? { tint: (om && om.kind === 'nei' ? 'cur' : 'qing'), skill: (om && om.id) || '', innate: (om && om.innate) || '', domKind: (om && om.domKind) || '' }
              : (oppKind === 'domain' ? { domKind: (om && om.domKind) || '', id: (om && om.id) || '' } : {});
            pushFx(oppKind, 'foe', om ? om.name : '', oppKind === 'foeAtk' ? 1000 : 1300, meta);
            renderBattle();
          }, 140);
        }
        setTimeout(function () {
          if (!e.getBattle()) return;
          if (dMe > 0) { pushFx('dmg', 'hero', '-' + dMe, 1100); pushFx('impactF', 'foe', '', 520); }
          renderBattle(); hitStop(false);
        }, b0.lan ? 480 : 380);
        setTimeout(function () {
          unlock(); afterAct(e);
          

          if (b0.lan && window.JH_room && window.JH_room.tick) { try { window.JH_room.tick(); } catch (err) {} }
        }, b0.lan ? 900 : 760);
      } else { unlock(); saveSoon(); freezeFinish(760, e.pendingMimic && e.pendingMimic()); }
      return;
    }
    if (going && !foe.dummy) {
       
      setTimeout(function () {
        if (!e.getBattle()) return;
        pushMove('foe', (other.skills && other.skills.length) ? 'mv-chan mv-cast' : 'mv-rush mv-elbow', 900);
        pushFx('foeAtk', 'foe', '', 1000);
        renderBattle();
      }, 320);
      setTimeout(function () {
        if (dMe > 0) { pushFx('dmg', 'hero', '-' + dMe, 1100); pushFx('impactF', 'foe', '', 520); }
        renderBattle(); hitStop(false);
      }, 680);
      setTimeout(function () { unlock(); afterAct(e); }, 1200);
      return;
    }
    if (dMe > 0) pushFx('dmg', 'hero', '-' + dMe, 1100);
    renderBattle();
    unlock();
    if (going) afterAct(e);
    else { saveSoon(); freezeFinish(760, e.pendingMimic && e.pendingMimic()); }
  }
  function afterAct(e) {
    render(); saveSoon();
    const mo = e.pendingMimic && e.pendingMimic();
    if (mo) mimicModal(mo);
  }
   
  function freezeFinish(ms, mo) {
    const main = $('main');
    const bar = main.querySelector ? main.querySelector('.fighter.foe .fbar.hp i') : null;
    if (bar) bar.style.width = '0%';
    setTimeout(function () { render(); if (mo) mimicModal(mo); }, ms);
  }
  

  function actGroups(s, skills, st, foe) {
    const grp = (title, note, inner) => inner
      ? `<div class="actgrp"><div class="actgrph">${title}${note ? `<span class="ag-note">${note}</span>` : ''}</div><div class="actbar">${inner}</div></div>`
      : '';
    const eng = window.JH.engine;
    const usable = eng.usableOf(s, 'atk');    
    

    let list = skills.filter(m => usable.indexOf(m.id) >= 0 && m.id !== 'sk_csm_drive');
     
    if (s.innate && s.innate.indexOf('t_jukai') >= 0) list = list.filter(m => !m.cls || eng.partyOf(s, m.cls) === m.id);
    const myDom = window.JH_combat.playerDomOf(s);
    const atk = list.map(m => {
      const cs = window.JH_combat.skillCost(s, m);
      const cd = window.JH_combat.cdLeft(s, m.id);
      const cdBase = window.JH_combat.cooldownOf(s, m);
      const openThis = !!(m.domain && myDom && myDom.id === m.id);    
       
      const sumKey = window.JH_combat.summonKeyOf(m);
      const outSh = (sumKey && !m.domain) ? window.JH_combat.shieldOf(s, sumKey) : null;
      const outThis = !!outSh;
      const retrieve = openThis || outThis;
      const no = (retrieve || foe.dummy) ? false : s.cur < cs;
      const busy = retrieve ? false : (cd > 0 || s.overload > 0);
      const tip = openThis
        ? ('领域正立着（领域血 ' + Math.round(myDom.hp) + ' / ' + Math.round(myDom.hpMax) + '）—— 再点一次就收回它：收回不吃「领域崩坏」的惩罚，只让这门术式进入 ' + cdBase + ' 回合冷却。')
        : outThis
          ? ('「' + outSh.name + '」正留在场上（护盾 ' + Math.round(outSh.hp) + ' / ' + Math.round(outSh.hpMax) + '）—— 再点一次就把它收回来：残余护盾按「回收多少就是多少」收进库存（咒灵操术回收、式神直接清除），它带来的 buff 一并清除，收回之后这门术式才进冷却（冷却不短，也不吃减免）。')
          : [m.desc || '', mechNoteText(m.id), '冷却 ' + ((sumKey && !m.domain) ? (window.JH_combat.SUMMON_CD || 10) : cdBase) + ' 回合' + (cd > 0 ? '（还剩 ' + Math.ceil(cd) + '）' : '')].filter(Boolean).join('　｜　');
      const tail = openThis ? '<small class="cdtag">已展开 · 点此收回</small>'
        : outThis ? '<small class="cdtag">已上场 · 点此收回</small>'
        : cd > 0 ? ('<small class="cdtag">冷却 ' + Math.ceil(cd) + '</small>')
        : ('<small style="color:var(--dim)">' + (foe.dummy ? '练功' : cs + ' 咒力') + '</small>');
      return `<button class="act${(no && cd <= 0) ? ' danger' : ''}${retrieve ? ' on' : ''}${busy ? ' off' : ''}" data-battle="skill:${m.id}"${busy ? ' disabled' : ''} data-tip="${esc(tip)}">${esc(m.name)} ${tail}</button>`;
    }).join('');
    const cap = eng.slotsOf(s, 'atk');
    const innN = list.filter(m => m.innate).length;
    const own = grp('术式', `已出战 ${list.length} 门（普适 ${Math.max(0, list.length - innN)} / ${cap >= 99 ? '∞' : cap}，生得术式不占额）`, atk || '<span class="hint">没有挂上主动术式——去「术式」页启用。</span>');

    const bo = s.borrow || {};
    const boIds = Object.keys(bo).filter(id => window.JH_MARTIAL_MAP[id]);
    const borrowHtml = boIds.map(id => {
      const m = window.JH_MARTIAL_MAP[id], cs = window.JH_combat.skillCost(s, m);
      const cd = window.JH_combat.cdLeft(s, id);
      const no = foe.dummy ? false : s.cur < cs;
      const busy = cd > 0 || s.overload > 0;
      const tail = cd > 0 ? ('<small class="cdtag">冷却 ' + Math.ceil(cd) + '</small>') : ('<small style="color:var(--dim)">余 ' + bo[id] + ' 次</small>');
      return `<button class="act borrowed${(no && cd <= 0) ? ' danger' : ''}${busy ? ' off' : ''}" data-battle="borrow:${id}"${busy ? ' disabled' : ''} data-tip="借来的术式：${esc(m.desc || '')}">借·${esc(m.name)} ${tail}</button>`;
    }).join('');
    const borrow = boIds.length ? grp('借用（术式模仿）', `${boIds.length} / 3 门`, borrowHtml) : '';

    const td = s.tamed || {};
    const tdIds = Object.keys(td).filter(id => window.JH_FOE_MAP[id]);
    const drill = eng.sandboxFight();          
    const tamHtml = tdIds.map(id => {
      const t = window.JH_FOE_MAP[id];
      const sh = window.JH_combat.shieldOf(s, 'csm:' + id);
      const gone = window.JH_combat.shatteredOf(s, id);
      const dcd = window.JH_combat.cdLeft(s, 'drive:' + id);
      const out = !!sh;                        
      const tail = gone ? '<small class="cdtag">已散</small>'
        : out ? ('<small class="cdtag">在场上 · 护盾 ' + Math.round(sh.hp) + '</small>')
        : dcd > 0 ? ('<small class="cdtag">冷却 ' + Math.ceil(dcd) + '</small>')
          : ('×' + td[id]);
      const busy = !!(gone || (dcd > 0 && !out) || s.overload > 0);
      const tip = gone
        ? ('这条咒灵这一场已经被打散了，驱使不动。' + (drill ? '镜屋是沙盘 —— 那边散了的不当真死。' : '散场后它就从账下划掉了，想再驱使要重新收服。'))
        : out
          ? ('『' + t.name + '』正留在场上（护盾 ' + Math.round(sh.hp) + ' / ' + Math.round(sh.hpMax) + '）—— 再点一次就是把它收回来：残余护盾按「回收多少就是多少」（覆盖旧值）收进咒灵操术的库存，它带来的 buff 一并清除，然后这门驱使进入冷却（冷却不短，也不吃咒效 / 咒操减免）。')
          : ('驱使这只咒灵出手（耗咒力）：它护在你身前、每回合替你出手，带一块自己的护盾，一直撑到被打散为止（没有回合上限）。护盾被打空＝它被打散 —— 这一场驱使不动，散场后从账下划掉（只有镜屋是沙盘，不算数）；残余护盾按「回收多少就是多少」覆盖进库存。冷却从「收回 / 被打散」那一下起算，跟领域展开一个规矩：<b>收场之后才起算，冷却不短</b>，也不吃咒效 / 咒操减免。');
      return `<button class="act tamed${busy ? ' off' : ''}" data-battle="drive:${id}"${busy ? ' disabled' : ''} data-tip="${esc(tip)}">${out ? '收回' : '驱使'}·${esc(t.name)} <small style="color:var(--dim)">${tail}</small></button>`;
    }).join('');
    const tamed = tdIds.length ? grp('收服（咒灵操术）', `${tdIds.length} / 6 种`, tamHtml) : '';

    

    const stg = [];
    for (const iid of Object.keys(s.forge || {})) {
      const f = s.forge[iid];
      if (!f) continue;
      const it2 = window.JH_ITEM_MAP[iid] || { name: iid };
      const held2 = !!(s.equip && (s.equip.weapon === iid || s.equip.charm === iid || s.equip.armor === iid || s.equip.boots === iid));
      if (f.store) {
        const sm = window.JH_MARTIAL_MAP[f.store];
        if (!sm) continue;
        const scd = window.JH_combat.cdLeft(s, 'stored:' + iid);
        const sbusy = scd > 0 || s.overload > 0;
        const stail = scd > 0 ? ('<small class="cdtag">冷却 ' + Math.ceil(scd) + '</small>') : ('<small style="color:var(--dim)">' + esc(it2.name) + '</small>');
        stg.push(`<button class="act stored${sbusy ? ' off' : ''}" data-battle="stored:${iid}"${sbusy ? ' disabled' : ''} data-tip="咒具存储：${esc(it2.name + ' 里记着「' + sm.name + '」')}　${esc(sm.desc || '')}${held2 ? '' : '（这件没带在身上）'}　冷却 ${Math.max(3, window.JH_combat.cdBaseOf(sm))} 回合">储·${esc(sm.name)} ${stail}</button>`);
        continue;
      }
      if ((f.slots || []).indexOf('w_store') < 0) continue;
      const armed = !!(s.pst && s.pst.storeArm === iid);
      const sTip = armed
        ? '已经亮着这件咒具了 —— 对手下一手若是术式就被它整口吞下（双倍伤害）。再点一次，收回去。'
        : '咒术存储（空）：亮出这件咒具，等对手下一手使出术式时把它整口吞下去 —— 代价是这一击按双倍伤害吃在你身上。吞到了，这里就变成「储·××」按键。';
      const sTail = held2 ? '' : '（这件没带在身上 —— 先穿上，才亮得出来）';
      stg.push(`<button class="act store${armed ? ' armed' : ''}${held2 ? '' : ' off'}" data-battle="store:${iid}"${held2 ? '' : ' disabled'} data-tip="${esc(sTip + sTail)}">${armed ? '收·' : '吸·'}（空） <small style="color:var(--dim)">${esc(it2.name)}</small></button>`);
    }
    const stored = stg.length ? grp('咒具存储', `${stg.length} 件`, stg.join('')) : '';
    return own + borrow + tamed + stored;
  }

  let lastBattleObj = null, lastBattleCore = '';
  

  function cutImgs(root) { try { if (window.JH_IMGC_cut) window.JH_IMGC_cut(root); } catch (e) {} }
  function renderBattle() {
    const e = E(), b = e.getBattle();
    if (!b) return;
    if (b !== lastBattleObj) { lastBattleObj = b; lastBattleCore = ''; actToken++; acting = false; }
     
    const pvp = !!b.pvp, ctrlFoe = pvp && b.ctrl === 'foe';
    let s = e.s, foe = b.foe;
    if (ctrlFoe) { s = b.foe; foe = e.s; }
    

    const lanSwap = !!(b.lan && !b.lan.hostIsMe);
    const dS = lanSwap ? foe : s, dF = lanSwap ? s : foe;
    const st = e.statsOf(s), stT = e.statsOf(foe), stD = e.statsOf(dS), stF = e.statsOf(dF);
    const skills = Object.keys(s.skills).map(id => window.JH_MARTIAL_MAP[id]).filter(m => m && m.kind === 'atk');
    

    const anyDom = Object.keys(s.skills || {}).some(id => { const m = window.JH_MARTIAL_MAP[id]; return !!(m && m.domain); });
    const domNow = window.JH_combat.playerDomOf ? window.JH_combat.playerDomOf(s) : null;
    const formNow = (domNow && domNow.kind) ? domNow.kind : (s.domForm === 'open' ? 'open' : 'closed');
    const domFormOk = window.JH_combat.domFormGateOk ? window.JH_combat.domFormGateOk(s) : true;
    const domFormNeed = (window.JH_combat.DOM_FORM_NEED || 3);
    const DOMFORM_TIP = '领域形态：敞开来（开放式）不设结界、能叠在别人的领域上、对封闭领域增伤；合上（封闭式）落锁，谁都出不去。战斗里随时可切换。';
    const DOMFORM_LOCK = '领域形态要结界术满级（' + domFormNeed + ' 级）才切得动 —— 你手上的结界术还不到这一档。';
    const foeRes = [];
    if (dF.phyRes) foeRes.push('物减 ' + Math.round(dF.phyRes * 100) + '%');
    if (dF.curRes) foeRes.push('咒减 ' + Math.round(dF.curRes * 100) + '%');

     
    const bgImg = window.JH_IMGC_battle ? window.JH_IMGC_battle(s.scene, dF.id) : '';
    const heroImg = window.JH_IMGC_actor ? window.JH_IMGC_actor('hero', dS.origin) : '';
    const foeImg = window.JH_IMGC_actor ? window.JH_IMGC_actor('foe', dF.origin || dF.id) : '';
    if (window.JH_FXC_ensureCss) window.JH_FXC_ensureCss();    
    const fx = liveFx();
    const D = battleDyn(fx, dS, dF, stD);
    const shields = (window.JH_combat.shieldsOf ? window.JH_combat.shieldsOf(dS) : []);
    const shieldPct = shields.length ? pct(shields.reduce((a, x) => a + Math.max(0, x.hp), 0), Math.max(1, shields.reduce((a, x) => a + (x.hpMax || x.hp), 0))) : 0;

    const chipsOf = list => list.length
      ? list.map(x => `<span class="buffchip ${x.k}" data-tip="${esc(x.d)}">${esc(x.n)}</span>`).join('')
      : '<span class="buffchip dim">无状态</span>';

     
    const shieldsBar = shields.length
      ? `<div class="fbar shield"><i style="width:${shieldPct}%"></i></div>
         <div class="shieldrow">${shields.map(sh => `<span class="shieldchip" data-tip="${esc(sh.name + '：护盾 ' + Math.round(sh.hp) + ' / ' + Math.round(sh.hpMax) + (sh.atk ? '，每回合替你出手' : ''))}">${esc(sh.name)} <b>${Math.round(sh.hp)}</b></span>`).join('')}</div>`
      : '';
     
    const DOM_POW_TIP = '领域强度：熟练度与结界术打底，领域血涨落会带着它上下 —— 注力回血把它顶回来，被啃掉 / 打掉的血立刻削它。';
    const DOM_UP_TIP = '领域维持：每回合消耗一笔固定的底子，再按咒力上限抽一份，咒操 / 咒效越高抽得越省。咒力见底就供不起，领域自行散开（进入「领域崩坏」）。无限领域不吃这份消耗。';
     
    const pdom = window.JH_combat.playerDomOf(dS);
    const domBar = pdom ? `<div class="fbar dom"><i style="width:${pct(pdom.hp, pdom.hpMax)}%"></i></div>
            <div class="fnum">领域 <b>${Math.round(pdom.hp)}</b> / ${Math.round(pdom.hpMax)} · 强度 <b class="dompow" data-tip="${DOM_POW_TIP}">${window.JH_combat.fmtPow(window.JH_combat.domPowOf(dS, pdom))}</b> · 维持 <b class="domup" data-tip="${DOM_UP_TIP}">${window.JH_combat.domUpkeepOf(dS)}</b>/回合 · ${esc(pdom.name)}（${pdom.kind === 'open' ? '开放' : '封闭'}）</div>` : '';
    const fdom = window.JH_combat.domEntOf(dF);    
    const foeDomBar = fdom ? `<div class="fbar dom foe"><i style="width:${pct(fdom.hp, fdom.hpMax)}%"></i></div>
            <div class="fnum">领域 <b>${Math.round(fdom.hp)}</b> / ${Math.round(fdom.hpMax)} · 强度 <b class="dompow" data-tip="${DOM_POW_TIP}">${window.JH_combat.fmtPow(window.JH_combat.domPowOf(dF, fdom))}</b> · 维持 <b class="domup" data-tip="${DOM_UP_TIP}">${fdom.endless ? '∞' : (dF.attrs ? window.JH_combat.domUpkeepOf(dF) : window.JH_combat.foeDomUpkeepOf(dF))}</b>/回合 · ${esc(fdom.name)}</div>` : '';
    const domFeed = domFeedHtml(s);
    const heroBars = domBar + shieldsBar + `
            <div class="fbar hp"><i style="width:${pct(dS.hp, stD.hpMax)}%"></i></div>
            <div class="fnum">气血 <b>${Math.round(dS.hp)}</b> / ${Math.round(stD.hpMax)}</div>
            <div class="fbar mp"><i style="width:${pct(dS.cur, stD.curMax)}%"></i></div>
            <div class="fnum">咒力 <b>${Math.round(dS.cur)}</b> / ${Math.round(stD.curMax)}</div>`;
    const foeBars = foeDomBar + `
            <div class="fbar hp"><i style="width:${dF.dummy ? 100 : pct(Math.max(0, dF.hp), stF.hpMax)}%"></i></div>
            <div class="fnum">气血 <b>${dF.dummy ? '∞' : Math.max(0, Math.round(dF.hp))}</b> / ${dF.dummy ? '∞' : Math.round(stF.hpMax)}</div>`;
    const heroBuffs = chipsOf(window.JH_combat.playerStatus(dS));
    


    const foeBuffs = chipsOf(pvp ? window.JH_combat.playerStatus(dF, true) : window.JH_combat.foeStatus(dF));
    const roundHtml = '第 ' + b.round + ' 回合';
    const hintHtml = `黑闪 ${st.bfRate}%${st.bf ? '（增益 ×' + st.bf + ' 层）' : ''} · 物理出力 ${Math.round(st.out.phy * 100)}% · 咒力出力 ${Math.round(st.out.cur * 100)}% · 出力破绽 +${Math.round(st.flaw * 100)}%`;
    const logHtml = b.log.slice(-14).map(esc).join('<br>') || '你与它对视。';
    const groupsHtml = (s.overload > 0 ? '<div class="overloadbar">术式熔断 · 剩 ' + Math.ceil(s.overload) + ' 回合：术式一律用不出来，先靠普通攻击撑着</div>' : '') + actGroups(s, skills, st, foe);

     
    const figure = (side, img) => `<div class="favatar ${side}${img ? ' hasimg' : ''}">` +
      (img ? `<img class="fimg" src="${esc(img)}" data-cut="${esc(img)}" alt="">` : '') + `
          <span class="fbody">
            <span class="fshadow"></span>
            <span class="trail"></span>
            <span class="leg back"></span><span class="leg front"></span>
            <span class="robe"></span>
            <span class="torso"></span>
            <span class="arm back"></span>
            <span class="sash"></span>
            <span class="arm front"></span>
            <span class="neck"></span>
            <span class="head"></span>
            <span class="hair"></span>
            <span class="weapon"></span>
            <span class="slash"></span>
          </span>
        </div>`;

     
    const fxGroups = [];
    const domState = domBgOf(dS, dF);       
    for (const f of fx) {
      const dl = (f.meta && f.meta.delay) || 0;
      const xiPath = fxImgOf(f);
      const seqL = (f.meta && f.meta.seq) || null;
      const xi = seqL ? seqHtml(seqL, dl) : (xiPath ? '<img class="fximg" src="' + esc(xiPath) + '" data-cut="' + esc(xiPath) + '" alt="">' : '');
       
      const rec = window.JH_FXC_of ? window.JH_FXC_of(f.kind, f.meta || {}) : null;
      const cxi = rec ? window.JH_FXC_html(rec, { delay: dl }) : '';
      const hitFx = cxi || xi;
      if (f.kind === 'bf') fxGroups.push({ id: f.id, delay: dl, html: hitFx ? (hitFx + skillLabel(f.text)) : ('<div class="ink-bf"></div><div class="ink-splat"></div>' + skillLabel(f.text)) });
      else if (f.kind === 'phy') fxGroups.push({ id: f.id, delay: dl, html: hitFx || ('<div class="fwind ' + f.side + '"></div><div class="ink ink-phy' + tintCls(f) + '"></div><div class="ink-splat"></div>') });
      else if (f.kind === 'domain') fxGroups.push({ id: f.id, delay: dl, html: cxi ? (cxi + skillLabel(f.text)) : (xiPath ? skillLabel(f.text) : domainFxHtml(f)) });
      else if (f.kind === 'summon') fxGroups.push({ id: f.id, delay: dl, html: hitFx ? (hitFx + skillLabel(f.text)) : summonFxHtml(f) });
      else if (f.kind === 'ink') fxGroups.push({ id: f.id, delay: dl, html: hitFx ? (hitFx + skillLabel(f.text)) : ('<div class="ink ink-skill' + tintCls(f) + '"></div><div class="ink-ring"></div>' + skillLabel(f.text)) });
      else if (f.kind === 'dmg') {
        const digits = String(f.text).replace(/[^0-9]/g, '').length;
        fxGroups.push({ id: f.id, delay: dl, html: `<div class="fdmg ${f.side}${digits >= 4 ? ' big' : ''}">${esc(f.text)}</div>` });
      }
       
      else if (f.kind === 'impactH') fxGroups.push({ id: f.id, delay: dl, html: '<div class="impact hero"></div>' });
      else if (f.kind === 'impactF') fxGroups.push({ id: f.id, delay: dl, html: '<div class="impact foe"></div>' });
      else if (f.kind === 'say') fxGroups.push({ id: f.id, delay: dl, html: '<div class="saybox ' + (f.side === 'foe' ? 'foe' : 'hero') + '">' + esc(f.text) + '</div>' });
    }
    if (D.clash) fxGroups.push({ id: 'clashfx', delay: 0, html: '<div class="clashfx"></div>' });
    const fxHtml = fxGroups.map(g => g.html).join('');
    



    const domBgUrl = domState ? domState.url : '';
    const domBgDelay = 0;
    const domBgHtml = domBgUrl
      ? ('<img class="domimg" src="' + esc(domBgUrl) + '"' + (domBgDelay ? ' style="animation-delay:' + domBgDelay + 'ms"' : '') + ' alt="">')
      : '';

    const coreTpl = `<h2 class="viewtitle">对 阵</h2>
    <div class="battle">
      <div class="stage@STAGE@${(bgImg || domBgUrl) ? ' hasbg' : ''}">
        ${bgImg ? '<div class="battlebg" style="background-image:url(\'' + esc(bgImg) + '\')"></div>' : ''}
        <div class="dombg" id="domBg"><!--DOMBG--></div>
        ${inkMtn()}
        ${sealShow()}
        <div class="fighter hero@HERO@">
          <div class="fname">${esc(dS.name)}</div>
          <div class="fbars" id="heroBars"><!--BARS-H--></div>
          <div class="fstat hero">
            <div class="stitle">${lanSwap ? '对方状态' : '我方状态'}</div>
            <div class="buffs" id="heroBuffs"><!--BUFFS-H--></div>
          </div>
          ${figure('hero', heroImg)}
        </div>
        <div class="vsmark">对<br>峙</div>
        <div class="fighter foe@FOE@">
          <div class="fname">${esc(dF.name)}</div>
          <div class="fbars" id="foeBars"><!--BARS-F--></div>
          <div class="fmeta">攻 ${dF.atk != null ? dF.atk : Math.round(stF.phyAtk)} · 防 ${dF.def != null ? dF.def : Math.round(stF.def)}${foeRes.length ? ' · ' + foeRes.join(' · ') : ''}</div>
          <div class="fstat foe">
            <div class="stitle">${lanSwap ? '我方状态' : '敌方状态'}</div>
            <div class="buffs" id="foeBuffs"><!--BUFFS-F--></div>
          </div>
          ${figure('foe', foeImg)}
        </div>
        <div class="fxlayer"><!--FX--></div>
        <div class="roundtag" id="bRound"><!--ROUND--></div>
      </div>
      <div class="foedesc">${esc(dF.desc || '')}</div>
      <div class="hint" id="bHint"><!--HINT--></div>
      ${outBar(true, s)}
      <div class="battlelog" id="bLog"><!--LOG--></div>
      <div class="actbar">
        <button class="act" data-battle="attack">普通攻击</button>
        <button class="act idlebtn" data-battle="idle" data-tip="发呆：这一回合什么都不做 —— 不耗咒力、不吃冷却，也不算「连用术式」。对手照常出手。">发呆</button>
        <button class="act" data-battle="potion">用药</button>
        ${(st.heal > 0)
          ? `<button class="act healt${window.JH_combat.healOnOf(s) ? ' on' : ''}" data-battle="healtoggle" data-tip="回复术式：每回合按气血上限回一份，代价是<b>同样多的咒力</b>（回多少扣多少）。开着才转；开 / 关随手一按，不占回合。">回复术式：${window.JH_combat.healOnOf(s) ? '开' : '关'}</button>`
          : ''}
        ${(anyDom || window.JH_combat.hasOpenDom(s))
          ? `<button class="act domform${domFormOk ? '' : ' off'}" data-battle="domform"${domFormOk ? '' : ' disabled'} data-tip="${domFormOk ? DOMFORM_TIP : DOMFORM_LOCK}">领域形态：${formNow === 'open' ? '开放' : '封闭'}${domFormOk ? '' : '（需 ' + domFormNeed + ' 级）'}</button>`
          : ''}
        ${(pvp && !b.lan) ? `<button class="act switch" data-battle="switch" data-tip="换视角：换一个人来手操，另一边交给电脑。">换视角：握${ctrlFoe ? '自己' : '镜像'}</button>` : ''}
        <button class="act danger" data-battle="flee">${(foe.dummy || pvp) ? (b.lan ? '认输' : '收手') : '退走'}</button>
      </div>
      <div class="actgroups" id="actGroups"><!--GROUPS--></div>
    </div>`;
    const fill = inline => coreTpl
      .replace('@STAGE@', inline ? modsOf(D.stage) : '')
      .replace('@HERO@', inline ? modsOf(D.hero) : '')
      .replace('@FOE@', inline ? modsOf(D.foe) : '')
      .replace('<!--FX-->', inline ? fxHtml : '')
      .replace('<!--DOMBG-->', inline ? domBgHtml : '')
      .replace('<!--BARS-H-->', inline ? heroBars : '')
      .replace('<!--BARS-F-->', inline ? foeBars : '')
      .replace('<!--BUFFS-H-->', inline ? heroBuffs : '')
      .replace('<!--BUFFS-F-->', inline ? foeBuffs : '')
      .replace('<!--ROUND-->', inline ? roundHtml : '')
      .replace('<!--HINT-->', inline ? hintHtml : '')
      .replace('<!--LOG-->', inline ? logHtml : '')
      .replace('<!--DOMFEED-->', inline ? domFeed : '')
      .replace('<!--GROUPS-->', inline ? groupsHtml : '');

    const main = $('main');
    if (stubDom()) {                      
      main.innerHTML = fill(true);
      bindMain();
      cutImgs(main);
      return;
    }
    const core = fill(false);
    if (core !== lastBattleCore) { lastBattleCore = core; main.innerHTML = core; bindMain(); cutImgs(main); }
    patchBattleParts(D, fxGroups, { heroBars: heroBars, foeBars: foeBars, heroBuffs: heroBuffs, foeBuffs: foeBuffs,
      round: roundHtml, hint: hintHtml, log: logHtml, groups: groupsHtml, domFeed: domFeed, domActor: s,
      hasbg: !!(bgImg || domBgUrl), dombg: { url: domBgUrl, delay: domBgDelay } });
  }
   
  function patchBattleParts(D, fxGroups, parts) {
    const main = $('main');
    const stage = main.querySelector ? main.querySelector('.stage') : null;
    if (!stage) return;
    const stageWant = ['stage'].concat(D.stage);
    if (parts.hasbg) stageWant.push('hasbg');
    if (stage.classList.contains('hitstop')) stageWant.push('hitstop');
    setCls(stage, stageWant);
    setCls(main.querySelector('.fighter.hero'), ['fighter', 'hero'].concat(D.hero));
    setCls(main.querySelector('.fighter.foe'), ['fighter', 'foe'].concat(D.foe));
    const put = (id, html) => { const el = document.getElementById(id); if (el && el.innerHTML !== html) el.innerHTML = html; };
    put('heroBars', parts.heroBars); put('foeBars', parts.foeBars);
    put('heroBuffs', parts.heroBuffs); put('foeBuffs', parts.foeBuffs);
    put('bRound', parts.round); put('bHint', parts.hint); put('bLog', parts.log);
    const dfRow = document.getElementById('domFeedRow');
    if (dfRow && dfRow.innerHTML !== parts.domFeed) { dfRow.innerHTML = parts.domFeed; bindDomFeed(parts.domActor); }
    const g = document.getElementById('actGroups');
    if (g && g.innerHTML !== parts.groups) { g.innerHTML = parts.groups; bindBattleBtns(); }
    const db = document.getElementById('domBg');
    if (db) {
      const url = (parts.dombg && parts.dombg.url) || '';
      if ((db.dataset.img || '') !== url) {               
        db.dataset.img = url;
        const dl = (parts.dombg && parts.dombg.delay) || 0;
        db.innerHTML = url ? ('<img class="domimg" src="' + esc(url) + '"' + (dl ? ' style="animation-delay:' + dl + 'ms"' : '') + ' alt="">') : '';
      }
    }
    syncFxlayer(main.querySelector('.fxlayer'), fxGroups);
    cutImgs(main);
  }

   
  function renderStory(cur) {
    if (!cur) { $('storyWrap').classList.add('hidden'); return; }
    $('storyWrap').classList.remove('hidden');
    $('storyTitle').textContent = cur.def.name;
    $('storyText').innerHTML = (cur.node.text || []).map(t => `<p>${esc(t)}</p>`).join('');
    const box = $('storyChoices'); box.innerHTML = '';
    (cur.node.choices || []).forEach((ch, i) => {
      const b = document.createElement('button');
      const okc = E().condMet(ch.req);
      b.innerHTML = esc(ch.label) + (okc ? '' : '<small>条件不足</small>');
      if (!okc) b.style.opacity = '.5';
      b.onclick = () => {
        const before = Object.keys(E().s.storyDone).length;
        if (!E().choose(i)) { toast('条件不足，无法如此行事'); return; }
        const after = Object.keys(E().s.storyDone).length;
        if (after > before) toast('一段际遇告一段落');
        render(); saveSoon();
      };
      box.appendChild(b);
    });
  }

   
  function bindMain() {
    const e = E(), s = e.s;
    document.querySelectorAll('[data-media]').forEach(b => b.onclick = () => logGo(b.dataset.media === 'prev' ? -1 : 1));
    document.querySelectorAll('[data-act="search"]').forEach(b => b.onclick = () => { e.search(); render(); saveSoon(); });
    document.querySelectorAll('[data-act="fight"]').forEach(b => b.onclick = () => { e.encounter(); render(); });
    document.querySelectorAll('[data-act="dummy"]').forEach(b => b.onclick = () => { e.startDummy(); render(); });
    document.querySelectorAll('[data-act="mirror"]').forEach(b => b.onclick = () => { e.startMirror(); render(); saveSoon(); });
    document.querySelectorAll('[data-act="mirror-reset"]').forEach(b => b.onclick = () => { e.mirrorReset(); render(); saveSoon(); });
    document.querySelectorAll('[data-mirror]').forEach(b => b.onchange = () => {
      const key = b.dataset.mirror, v = Math.round(+b.value || 0);
      if (key.indexOf('out.') === 0) {
        const o = Object.assign({}, e.mirrorCfg().out || { phy: 50, cur: 50 }); o[key.slice(4)] = v;
        e.setMirrorCfg({ out: o });
      } else e.setMirrorCfg({ [key]: v });
      render(); saveSoon();
    });
    document.querySelectorAll('[data-mirror-auto]').forEach(b => b.onclick = () => {
      e.setMirrorCfg({ auto: !(e.mirrorCfg().auto !== false) }); render(); saveSoon();
    });
    document.querySelectorAll('[data-mirror-skill]').forEach(b => b.onclick = () => { e.mirrorToggleSkill(b.dataset.mirrorSkill); render(); saveSoon(); });
    document.querySelectorAll('[data-mirror-innate]').forEach(b => b.onclick = () => { e.mirrorToggleInnate(b.dataset.mirrorInnate); render(); saveSoon(); });
    document.querySelectorAll('[data-doact]').forEach(b => b.onclick = () => { e.doAction(b.dataset.doact); render(); saveSoon(); });
    document.querySelectorAll('[data-act2]').forEach(b => b.onclick = () => { e.setAct(b.dataset.act2); render(); saveSoon(); });
    document.querySelectorAll('[data-act="boss"]').forEach(b => b.onclick = () => { e.encounterBoss(); render(); });
    document.querySelectorAll('[data-out]').forEach(b => b.onchange = () => {
      const tgt = outTarget();
      if (tgt === e.s) e.setOutput(b.dataset.out, +b.value);
      else { tgt.out = tgt.out || { phy: 50, cur: 50 }; tgt.out[b.dataset.out] = Math.max(20, Math.min(100, Math.round(+b.value || 0))); }
      render(); saveSoon();
    });
    document.querySelectorAll('[data-skillup]').forEach(b => b.onclick = () => { e.skillUp(b.dataset.skillup); render(); saveSoon(); });
    document.querySelectorAll('[data-learn]').forEach(b => b.onclick = () => { e.learnByPoint(b.dataset.learn); render(); saveSoon(); });
    document.querySelectorAll('[data-view2]').forEach(b => b.onclick = () => { view = b.dataset.view2; syncNav(); render(); });
    document.querySelectorAll('[data-region]').forEach(b => b.onclick = () => {
      const v = b.dataset.region, regs = window.JH_REGIONS || [];
      if (!regs.length) return;
      if (v === 'prev' || v === 'next') {
        const curR = mapRegion || regionOf(E().s ? E().s.scene : null);
        let i = regs.findIndex(r => r.id === curR); if (i < 0) i = 0;
        i = (i + (v === 'next' ? 1 : -1) + regs.length) % regs.length;
        mapRegion = regs[i].id;
      } else mapRegion = v;
      render();
    });
    document.querySelectorAll('[data-scene]').forEach(b => b.onclick = () => {
      const ok = e.moveScene(b.dataset.scene);
       
      if (ok) { view = e.s.travel ? 'map' : 'room'; syncNav(); }
      render(); saveSoon();
    });

    document.querySelectorAll('[data-room]').forEach(b => b.onclick = () => { if (e.moveRoom(b.dataset.room)) { view = 'room'; syncNav(); } render(); saveSoon(); });
    document.querySelectorAll('[data-talk]').forEach(b => b.onclick = () => { e.talk(b.dataset.talk); render(); saveSoon(); });
    document.querySelectorAll('[data-gift]').forEach(b => b.onclick = () => giftModal(b.dataset.gift));
    document.querySelectorAll('[data-use]').forEach(b => b.onclick = () => { e.useItem(b.dataset.use); render(); saveSoon(); });
    document.querySelectorAll('[data-read]').forEach(b => b.onclick = () => {
      const it = window.JH_ITEM_MAP[b.dataset.read];
      if (it && it.learn && !s.skills[it.learn]) { e.learn(it.learn); toast('习得：' + matName(it.learn)); }
      else toast('此功你已烂熟于心');
      render(); saveSoon();
    });
    document.querySelectorAll('[data-equip]').forEach(b => b.onclick = () => { e.equip(b.dataset.equip); render(); });
    document.querySelectorAll('[data-unequip]').forEach(b => b.onclick = () => { e.unequip(b.dataset.unequip); render(); });
    document.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { e.sell(b.dataset.sell); render(); saveSoon(); });
    document.querySelectorAll('[data-drop]').forEach(b => b.onclick = () => { e.dropItem(b.dataset.drop); render(); saveSoon(); });
    document.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { e.buy(b.dataset.buy); render(); saveSoon(); });
    document.querySelectorAll('[data-tech]').forEach(b => b.onclick = () => { e.setTech(b.dataset.tech); render(); saveSoon(); });
    document.querySelectorAll('[data-innaten]').forEach(b => b.onclick = () => {
      const id = b.dataset.innaten;
      e.setInnateOn(id, !(e.innateOn ? e.innateOn(id) : true));
      render(); saveSoon();
    });
    document.querySelectorAll('[data-join]').forEach(b => b.onclick = () => { e.joinSect(b.dataset.join); render(); saveSoon(); });
    document.querySelectorAll('[data-sectdaily]').forEach(b => b.onclick = () => { e.sectDaily(); render(); saveSoon(); });
    document.querySelectorAll('[data-sectleave]').forEach(b => b.onclick = () => {
      const loss = e.leaveSectLoss();
      if (!loss || loss.debug) { e.leaveSect(); render(); saveSoon(); return; }
      sectLeaveModal(loss);
    });
    document.querySelectorAll('[data-sectbuy]').forEach(b => b.onclick = () => { e.sectBuy(b.dataset.sectbuy); render(); saveSoon(); });
    document.querySelectorAll('[data-dropborrow]').forEach(b => b.onclick = () => { e.dropBorrow(b.dataset.dropborrow); render(); saveSoon(); });
    document.querySelectorAll('[data-droptamed]').forEach(b => b.onclick = () => { e.dropTamed(b.dataset.droptamed); render(); saveSoon(); });
    document.querySelectorAll('[data-shikigami]').forEach(b => b.onclick = () => { const v = b.dataset.shikigami.split(':'); e.setParty(v[0], v[1]); render(); saveSoon(); });
    document.querySelectorAll('[data-spar]').forEach(b => b.onclick = () => { e.sparStart(b.dataset.spar); render(); saveSoon(); });
    document.querySelectorAll('[data-trial]').forEach(b => b.onclick = () => openTrial(b.dataset.trial));
    document.querySelectorAll('[data-forge]').forEach(b => b.onclick = () => {
      const v = b.dataset.forge;
      if (v.indexOf('pick:') === 0) { forgeTarget = v.slice(5); render(); return; }
      const wid = forgeTarget || (s.equip && s.equip.weapon);
      if (!wid) { toast('砧板上没东西'); return; }
      if (v === 'up') e.forgeUp(wid);
      else if (v === 'curse') e.curseUp(wid);
      else if (v === 'cup') e.curseForgeUp(wid);
      else if (v.indexOf('uncarve:') === 0) e.uncarveWord(wid, +v.slice(8));
      else if (v.indexOf('carve:') === 0) return carveModal(wid, +v.slice(6));
      else if (v === 'dropstore') e.dropStored(wid);
      render(); saveSoon();
    });
    document.querySelectorAll('[data-help2]').forEach(b => b.onclick = () => tutorialModal());
    document.querySelectorAll('[data-dev]').forEach(inp => {
      inp.onchange = () => { attrsSig = ''; if (!e.devSet(inp.dataset.dev, inp.value)) toast('这个数值改不了'); render(); saveSoon(); };
      inp.onkeydown = ev => { if (ev.key === 'Enter') inp.blur(); };
    });
    bindBattleBtns();
  }

   
   
  function sectLeaveModal(loss) {
    const li = [];
    if (loss.techs.length) li.push('主修作废：' + loss.techs.join('、'));
    if (loss.skills.length) li.push('门中术式忘却（共 ' + loss.skills.length + ' 门）：' + loss.skills.join('、'));
    if (loss.contrib) li.push('贡献 ' + loss.contrib + ' 点 —— 清零');
    if (loss.aff.length) li.push('同门好感归零：' + loss.aff.join('、'));
    if (!li.length) li.push('你在门中还没留下什么可失去的。');
    modal('脱离「' + loss.sect.name + '」',
      '<p class="hint">一旦走出这道门，下面这些都不会再回来：</p>' +
      '<ul class="losslist">' + li.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
      '<p class="hint">今后再见面，就当不认识。</p>',
      [{ label: '再想想' }]);
    $('modalBody').insertAdjacentHTML('beforeend', '<div class="actbar"><button class="act danger" id="sectLeaveGo">确认脱离</button></div>');
    const go = $('sectLeaveGo');
    if (go) go.onclick = () => { E().leaveSect(); closeModal(); toast('你走了，没有回头。'); render(); saveSoon(); };
  }

  


  let trialRun = null;
  const TRIAL_ASSAULT = [
    { zone: '下段', text: '一脚扫向你的下盘', right: '跳开' },
    { zone: '中段', text: '直拳打向你的中门', right: '后仰' },
    { zone: '上段', text: '手掌拍向你的面门', right: '低身' }
  ];
  const TRIAL_AVOID = ['跳开', '后仰', '低身'];
  function trialMineGrid() {
    const cells = [];
    for (let i = 0; i < 25; i++) cells.push(false);
    let placed = 0;
    while (placed < 5) { const k = (Math.random() * 25) | 0; if (!cells[k]) { cells[k] = true; placed++; } }
    return cells;
  }
  function trialSeq(n) {
    const pool = window.JH_TRIAL_GLYPH || ['咒', '言', '缚', '解'];
    const seq = [];
    while (seq.length < n) { const g = pool[(Math.random() * pool.length) | 0]; if (seq.indexOf(g) < 0) seq.push(g); }
    return seq;
  }
  


  function trialOf(tid) {
    const key = String(tid == null ? '' : tid);
    const byId = window.JH_TRIAL_MAP && window.JH_TRIAL_MAP[key];
    if (byId) return byId;
    const e = E();
    return (e.trialDef && e.trialDef(key)) || null;
  }
  function startTrialRun(tid) {
    const d = trialOf(tid);
    if (!d) return null;
    const key = d.innate || tid;
    if (d.kind === 'mine') return { tid: key, d: d, cells: trialMineGrid(), opened: {}, safe: 0, boom: 0 };
    if (d.kind === 'fetch') return { tid: key, d: d, got: 0, tries: 0 };
    if (d.kind === 'order') return { tid: key, d: d, seq: trialSeq(d.n), step: 0, phase: 'watch' };
    if (d.kind === 'dodge') return { tid: key, d: d, round: 0, phase: 'pick', a: TRIAL_ASSAULT[(Math.random() * 3) | 0] };
    return null;
  }
  function trialWin() {
    const tid = trialRun.tid, name = trialRun.d.name;
    E().trialPass(tid);
    trialRun = null;
    modal('试炼通过 · ' + name,
      '<p class="hint">门开了。这一系往后练上去，该给的招数与领域都会跟着到手。</p>',
      [{ label: '好' }]);
    render(); saveSoon();
  }
  function trialHintBar() {
    const e = E(), tid = trialRun.tid, lv = (e.s.innateLv || {})[tid] || 1;
    const needLv = (e.TRIAL_LV || 6);
    return '<p class="hint">当前熟练度 ' + lv + ' 级' + (lv < needLv ? '（过了这一关，往后练上去的招数才到手）' : '（过了这一关，该给的招数立刻到手）') + '</p>';
  }
  function paintTrial() {
    if (!trialRun) return;
    const r = trialRun, d = r.d;
    let body = '<p class="hint">' + esc(d.desc) + '</p>' + trialHintBar();
    if (d.kind === 'mine') {
      body += '<p class="hint">还剩 ' + (20 - r.safe) + ' 格没排完。踩到死结就重来一次。</p>';
      body += '<div class="trialgrid">';
      for (let i = 0; i < 25; i++) {
        const open = !!r.opened[i];
        body += '<button class="tcell' + (open ? ' on' : '') + '" data-tcell="' + i + '"' + (open ? ' disabled' : '') + '>' + (open ? '·' : '') + '</button>';
      }
      body += '</div>';
    } else if (d.kind === 'fetch') {
      body += '<p class="hint">已经凑到 <b>' + r.got + ' / ' + d.n + '</b> 份。搜寻 ' + (12 - r.tries) + ' 次机会。</p>';
      body += '<div class="actbar"><button class="act" data-tfetch="1">搜寻</button></div>';
    } else if (d.kind === 'order') {
      if (r.phase === 'watch') {
        body += '<p class="hint">记住这个顺序（' + d.n + ' 个），然后按顺序点出来。</p>';
        body += '<div class="trialseq">' + r.seq.map(g => '<span>' + esc(g) + '</span>').join('') + '</div>';
        body += '<div class="actbar"><button class="act" data-tconf="1">记住了</button></div>';
      } else {
        body += '<p class="hint">按顺序点出来：第 <b>' + (r.step + 1) + ' / ' + d.n + '</b> 个。点错从头再来。</p>';
        body += '<div class="actbar" style="flex-wrap:wrap">';
        for (const g of (window.JH_TRIAL_GLYPH || [])) body += '<button class="act" data-tglyph="' + esc(g) + '">' + esc(g) + '</button>';
        body += '</div>';
      }
    } else if (d.kind === 'dodge') {
      body += '<p class="hint">下段 → 跳开　中段 → 后仰　上段 → 低身。已经躲过 <b>' + r.round + ' / ' + d.n + '</b> 次。</p>';
      body += '<p><b>' + esc(r.a.text) + '</b></p>';
      body += '<div class="actbar">' + TRIAL_AVOID.map(x => '<button class="act" data-tavoid="' + esc(x) + '">' + esc(x) + '</button>').join('') + '</div>';
    }
    modal('试炼 · ' + d.name, body, [{ label: '先不练了' }]);
    bindTrial();
  }
  function bindTrial() {
    const r = trialRun;
    if (!r) return;
    document.querySelectorAll('[data-tcell]').forEach(b => b.onclick = () => {
      const i = +b.dataset.tcell;
      if (r.cells[i]) { r.boom++; r.opened = {}; r.safe = 0; r.cells = trialMineGrid(); toast('碰死了 —— 重新排。'); }
      else { r.opened[i] = true; r.safe++; }
      if (r.safe >= 20) return trialWin();
      paintTrial();
    });
    document.querySelectorAll('[data-tfetch]').forEach(b => b.onclick = () => {
      r.tries++;
      if (Math.random() < 0.55) r.got++;
      if (r.got >= r.d.n) return trialWin();
      if (r.tries >= 12) { toast('材料用完了 —— 从头再来。'); trialRun = startTrialRun(r.tid); }
      paintTrial();
    });
    document.querySelectorAll('[data-tconf]').forEach(b => b.onclick = () => { r.phase = 'input'; paintTrial(); });
    document.querySelectorAll('[data-tglyph]').forEach(b => b.onclick = () => {
      const g = b.dataset.tglyph;
      if (g === r.seq[r.step]) {
        r.step++;
        if (r.step >= r.d.n) return trialWin();
      } else { toast('念错了 —— 从头再来。'); r.step = 0; r.seq = trialSeq(r.d.n); r.phase = 'watch'; }
      paintTrial();
    });
    document.querySelectorAll('[data-tavoid]').forEach(b => b.onclick = () => {
      if (b.dataset.tavoid === r.a.right) {
        r.round++;
        if (r.round >= r.d.n) return trialWin();
        r.a = TRIAL_ASSAULT[(Math.random() * 3) | 0];
      } else { toast('结结实实挨了一下 —— 重头再来。'); r.round = 0; r.a = TRIAL_ASSAULT[(Math.random() * 3) | 0]; }
      paintTrial();
    });
  }
  function openTrial(tid, force) {
    const e = E(), d = trialOf(tid);
    if (!d) { toast('这一门还没有试炼。'); return; }
    const key = d.innate || tid;
    if (e.trialDone(key) && !force) { toast('这一门的试炼已经过了。'); return; }    
    if (!force && e.trialOpen && !e.trialOpen(key)) { toast('这一门的试炼还没开 —— 熟练度练到 ' + (e.TRIAL_LV || 6) + ' 级再来。'); return; }
    if (d.kind === 'battle') {
      closeModal();
      if (e.startTrialBattle(key)) render(); else toast('试炼战起不来。');
      return;
    }
    trialRun = startTrialRun(key);
    if (!trialRun) { toast('这一门还没有试炼。'); return; }
    paintTrial();
  }

   
  function carveModal(wid, slotIdx) {
    const e = E();
    const dev = !!(e.devEditable && e.devEditable());
    const pool = window.JH_WORDS.filter(w => !(w.once && e.wordCount(wid, w.id) > 0));
    let rareSum = 0;
    for (const w of pool) rareSum += (w.rare != null ? w.rare : 0);
    rareSum = Math.min(0.5, rareSum);
    const normals = pool.filter(w => w.rare == null).length || 1;
    const per = (1 - rareSum) / normals;
    const pctOf = w => ((w.rare != null ? w.rare : per) * 100).toFixed(1) + '%';
    let body = '<p class="hint">刻上去就取不下来了（能磨掉，但材料不退）。大多词条均分概率，标着「稀有」的只有它自己那点概率 —— 能不能刷出来，全看这一下。标着「每件限一条」的，一件咒具只能刻一次。</p>';
    if (dev) {
      body += '<p class="hint">不必抽，直接挑一条。</p><div class="actbar" style="flex-wrap:wrap">'
        + window.JH_WORDS.map(w => {
            const used = w.once && e.wordCount(wid, w.id) > 0;
            return '<button class="act" data-word="' + w.id + '"' + (used ? ' disabled' : '') + '>'
              + esc(w.name) + ' <small style="color:var(--dim)">' + (used ? '已刻过' : pctOf(w)) + '</small></button>';
          }).join('') + '</div>';
    } else {
      body += '<div class="actbar" style="flex-wrap:wrap">'
        + pool.map(w => '<span class="wordchip" data-tip="' + esc(w.desc) + '">' + esc(w.name) + ' <small>' + pctOf(w) + '</small></span>').join('')
        + '</div><div class="actbar" style="margin-top:10px"><button class="act" id="carveDrawGo">抽一条刻上去</button></div>';
      if (!pool.length) body += '<p class="hint">这一件上没有能再刻的词条了。</p>';
    }
    modal('刻词条 · 第 ' + (slotIdx + 1) + ' 槽', body, [{ label: '再想想' }]);
    document.querySelectorAll('[data-word]').forEach(b => b.onclick = () => {
      const ok = E().carveWord(wid, slotIdx, b.dataset.word);
      closeModal();
      toast(ok ? '刻好了' : '刻不上去');
      render(); saveSoon();
    });
    const go = $('carveDrawGo');
    if (go) go.onclick = () => {
      const got = E().carveDraw(wid, slotIdx);
      closeModal();
      toast(got ? '刻上了：' + window.JH_WORD_NAME(got) : '刻不上去');
      render(); saveSoon();
    };
  }

  function mimicModal(mo) {
    const list = mo.skills.map(id => {
      const m = window.JH_MARTIAL_MAP[id];
      if (!m) return '';
      return `<button class="act" data-mimic="${id}" data-tip="${esc(m.desc || '')}">${esc(m.name)} <small style="color:var(--dim)">${m.cost || 0} 咒力</small></button>`;
    }).join('');
    modal('术式模仿', `<p class="hint">「${esc(mo.from)}」倒下前那一手，你还记得。挑一门记下来（最多 3 门，每门 16 次，用尽要重新借）。</p>`, [{ label: '不借了' }]);
    $('modalBody').insertAdjacentHTML('beforeend', `<div class="actbar">${list}</div>`);
    document.querySelectorAll('[data-mimic]').forEach(b => b.onclick = () => {
      const ok = E().takeMimic(b.dataset.mimic);
      closeModal();
      toast(ok ? '记住了：' + matName(b.dataset.mimic) : '借不了这一门');
      render(); saveSoon();
    });
  }

   
  function initTip() {
    const tip = $('tip');
    if (!tip) return;
    const show = ev => {
      const el = ev.target && ev.target.closest ? ev.target.closest('[data-tip]') : null;
      if (!el) { tip.classList.add('hidden'); return; }
      const text = el.getAttribute('data-tip');
      if (!text) { tip.classList.add('hidden'); return; }
      tip.textContent = text;
      tip.classList.remove('hidden');
      const r = el.getBoundingClientRect(), tr = tip.getBoundingClientRect();
      let x = Math.min(window.innerWidth - tr.width - 8, Math.max(8, r.left));
      let y = r.top - tr.height - 8;
      if (y < 8) y = Math.min(window.innerHeight - tr.height - 8, r.bottom + 8);
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    };
    document.addEventListener('mouseover', show);
    document.addEventListener('mousemove', show);
    document.addEventListener('mouseout', ev => {
      const to = ev.relatedTarget;
      if (!to || !to.closest || !to.closest('[data-tip]')) tip.classList.add('hidden');
    });
    window.addEventListener('scroll', () => tip.classList.add('hidden'), true);
  }

   
  function maybeTutorial(e) {
    try {
      if (!e || !e.s || !e.s.flags) return;
      if (e.s.flags.tut_seen) return;
      e.s.flags.tut_seen = true;
      tutorialModal();
    } catch (_) {}
  }
  function tutorialModal() {
    const b = `
    一句话：所在页过日子，舆图换地方，对阵页打架。右侧「见闻」是流水账。
    一、怎么变强
    · 修为只来自打怪与明确的奖励，剧情只讲故事；攒够了点「突破境界」。
    · 技能点用来给普适技能升级；生得术式不花技能点，靠与同门对练长熟练度。
    二、咒力与气血
    · 闲下来都不会自己回复：点「休息」或「打坐」；精力只在家里回。
    · 打起来另算：两边都加厚一层，每回合自行回一点咒力，气血照旧不回。
    · 出力滑条：出力越高打得越重、咒力也烧得越快；物理出力开太满容易吃反击。
    三、技能分三类
    · 术式页分主动术式 / 咒力运用 / 体术身法，同时生效的门数各有上限，到「已习」里启用或卸下；生得术式不占这三类槽位。
    · 「见闻」只记流水，细则在「说明」页与鼠标悬停的小气泡里。
    四、特殊机制（会变成独立按键）
    · 借术：用「借术」给出最后一击，就能记下对面一门术式，之后是一个独立的「借·X」按键。
    · 收服：用「收服」给出最后一击，就能把那只咒灵收进账下，多出「驱使·X」按键；它护在你身前，血光了这一场就驱使不动，散场后从账下划掉。
    · 秘传术式：有些东西不写在纸上，多看多等。
    五、日常与社交
    · 组织：加入后做任务攒贡献、用贡献换本门的东西；每天有同门到场，可以和他们「对练」。
    · 委托与好感：凑齐人物要的东西就能交差；闲谈一天只算一次，礼物送对路涨得快。
    六、地图与副本
    · 换地方要「赶路」，跨大地图更久；有些地方要够条件才解锁。
    · 每个副本先清掉几只杂鱼，头目才现身；挂机不会去碰头目。
    · 家里有练功木桩，随时试招。
    七、还有
    · 隐藏剧情 / 闲趣：留意好感、时辰、地点，以及左侧的「密语」框。
    · 存档只写在程序目录下的 userdata\\ 里；以单机为主，局域网对战另起一摊、不进存档。`;
    modal('新手上路', b, [{ label: '知道了' }]);
  }

  function potionModal() {
     
    const bb = E().getBattle && E().getBattle();
    const s = (bb && bb.pvp && bb.ctrl === 'foe') ? bb.foe : E().s;
    const who = (s === E().s) ? '' : '镜像';
    const pills = Object.keys(s.items || {}).map(id => window.JH_ITEM_MAP[id])
      .filter(it => it && (it.type === 'pill' || it.type === 'food' || it.type === 'drink' || (it.effect && (it.effect.hp || it.effect.mp))));
    let body = pills.length ? '<div class="gridentry">' + pills.map(it =>
      `<div class="entry"><div class="en"><span class="${qclass(it.q)}">${esc(it.name)}</span><span class="q">×${s.items[it.id]}</span></div>
        <div class="ed">${esc(it.desc)}</div>
        <div style="margin-top:8px"><button class="mini2" data-potion="${it.id}">服用</button></div></div>`).join('') + '</div>'
      : '<p>身上没有可用的药。</p>';
    modal(who + '用药', body, [{ label: '取消' }]);
    document.querySelectorAll('[data-potion]').forEach(b => b.onclick = () => {
      const act = { type: 'item', id: b.dataset.potion };
      closeModal();
      

      if (window.JH_room && window.JH_room.onAction && window.JH_room.onAction(act)) return;
      if (!runAct(act)) render();
    });
  }

  function giftModal(npcId) {
    const s = E().s, npc = window.JH_NPC_MAP[npcId];
    if (!npc) return;
    const g = npc.gift || {};
    const ids = Object.keys(s.items);
    let body = `<p class="hint">${esc(npc.name)}　好感 ${s.aff[npcId]||0} / 100</p>`;
    if (!ids.length) body += '<p>你身上什么也没有。</p>';
    else body += '<div class="gridentry">' + ids.map(id => {
      const it = window.JH_ITEM_MAP[id]; if (!it) return '';
      const mark = (g.love||[]).includes(id) ? '　<b style="color:#e07f8f">❤ 最喜</b>'
                 : (g.like||[]).includes(id) ? '　<b style="color:#c8b06a">♡ 喜欢</b>'
                 : (g.hate||[]).includes(id) ? '　<span style="color:#8a8a8a">✕ 不喜</span>' : '';
      return `<div class="entry"><div class="en"><span class="${qclass(it.q)}">${esc(it.name)}</span><span class="q">×${s.items[id]}</span></div>
        <div class="ed">${esc(it.desc)}${mark}</div>
        <div style="margin-top:8px"><button class="mini2" data-dogift="${id}">赠予</button></div></div>`;
    }).join('') + '</div>';
    modal('赠礼', body, [{ label: '算了' }]);
    document.querySelectorAll('[data-dogift]').forEach(b => b.onclick = () => {
      E().gift(b.dataset.dogift, npcId); closeModal(); render(); saveSoon();
    });
  }

  

  function customPanel() {
    const cats = window.JH_CUSTOM_CATS || [];
    const CC = window.JH_CUSTOM || {};
    const errs = window.JH_CUSTOM_ERRORS || [];
    const loaded = window.JH_CUSTOM_LOADED || [];
    const imgs = window.JH_CUSTOM_IMAGES || [];
    const medias = window.JH_CUSTOM_MEDIA || [];
    const dir = window.JH_CUSTOM_DIR || 'app\\custom';
    const rows = cats.map(function (c) {
      const n = (CC[c.key] || []).length;
      return '<tr><td>' + esc(c.key) + '</td><td>' + (n ? '<b>' + n + '</b>' : '<span class="dim">0</span>') +
        '</td><td class="dim">' + esc(c.doc || '') + '</td></tr>';
    }).join('');
    const errHtml = errs.length
      ? '<div class="cerr"><b>有 ' + errs.length + ' 条没能装进来：</b>' +
        errs.slice(0, 20).map(function (e) { return '<br><code>' + esc(e.file) + '</code> —— ' + esc(e.msg); }).join('') +
        (errs.length > 20 ? '<br>……还有 ' + (errs.length - 20) + ' 条' : '') + '</div>'
      : '<p class="hint">没有装不进来的东西。已装入的文件：' + (loaded.length ? esc(loaded.join('、')) : '（还没有）') + '</p>';
    const gimg = (window.JH_IMGC && window.JH_IMGC.entries) ? window.JH_IMGC.entries() : [];
    const slotRows = (window.JH_IMGC_SLOTS || []).map(function (sl) {
      return '<tr><td>' + esc(sl.name) + '</td><td class="dim">' + esc(sl.tip) + '</td></tr>';
    }).join('');
    const imgRows = gimg.length
      ? gimg.map(function (x) { return '<tr><td><code>' + esc(x.slot) + '</code></td><td>' + esc(x.by) + '</td><td class="dim">' + esc(x.file) + '</td></tr>'; }).join('')
      : '<tr><td colspan="3" class="dim">（还没挂上任何图片 —— 界面还是纯 CSS / 字符画的样子）</td></tr>';
    const body = '<p class="hint">这个文件夹是留给玩家（和你）的：放进去的东西开游戏时会自动装进来。<br>文件夹：<code>' + esc(dir) + '</code></p>' +
      '<p class="hint">每个子文件夹能放 <code>.js</code> 或 <code>.json</code>（<code>_</code> 开头的模板会被跳过）；图片放「自定义图片」，用 <code>JH_IMG("文件名")</code> 取路径。现在登记了 <b>' + imgs.length + '</b> 张图。</p>' +
      '<p class="hint">见闻画册（<code>自定义见闻</code>）：现在有 <b>' + medias.length + '</b> 份图片 / 视频 —— 点顶栏「见闻」进那一页，页顶那一排 ‹ › 翻页看；第一页仍是流水，翻到最后一页再按一下就绕回流水。图片 / 视频按框自适应大小。</p>' +
      '<table class="ctab"><tr><th>分类</th><th>条数</th><th>装什么</th></tr>' + rows + '</table>' + errHtml +
      (slotRows ? '<h4 class="tuth">图片替换（把画面上这几样换成你自己的图）</h4>' +
        '<table class="ctab"><tr><th>换什么</th><th>文件名规则 / 说明</th></tr>' + slotRows + '</table>' +
        '<table class="ctab"><tr><th>槽位</th><th>怎么挂上的</th><th>图片</th></tr>' + imgRows + '</table>' : '') +
      '<p class="hint">改完要重开一次游戏才会生效。</p>';
    modal('自定义内容', body, [
      { label: '打开文件夹', onClick: () => { if (API && API.openCustomDir) API.openCustomDir(); else toast('仅桌面版可用'); } },
      { label: '关闭' }
    ]);
  }
  

  function devStoryModal() {
    const e = E();
    if (!e.devEditable()) return;
    const list = e.storyList();
    const row = x => '<tr><td>' + esc(x.name) + '</td><td class="dim">' + esc(x.id) + '</td><td>' +
      (x.playing ? '<b>进行中</b>' : (x.done ? '已过' : '未过')) + (x.deferred ? ' · 搁置中' : '') + '</td><td>' +
      '<button class="mini2" data-storygo="' + x.id + '">进入</button>' +
      (x.done ? ' <button class="mini2" data-storyreset="' + x.id + '">复位</button>' : '') + '</td></tr>';
    const tbl = (t, arr) => '<h3 class="tuth">' + t + '（' + arr.length + '）</h3>' +
      (arr.length ? '<table class="ctab"><tr><th>剧情</th><th>id</th><th>状态</th><th>操作</th></tr>' + arr.map(row).join('') + '</table>'
                  : '<p class="hint">（一段也没有）</p>');
    const tmap = { battle: '试炼战', mine: '排雷', fetch: '集物', order: '顺序', dodge: '时机' };
    const trials = e.trialAllList ? e.trialAllList() : [];
    const trow = x => '<tr><td>' + esc(x.name) + '</td><td class="dim">' + esc(x.tid) + '</td><td>' + esc(tmap[x.kind] || x.kind) + '</td><td>' +
      (x.playing ? '<b>进行中</b>' : (x.done ? '已过' : '未过')) + '</td><td>' +
      '<button class="mini2" data-trialgo="' + esc(x.tid) + '">进入</button>' +
      (x.done ? ' <button class="mini2" data-trialreset="' + esc(x.tid) + '">复位</button>' : '') + '</td></tr>';
    const tblTrials = '<h3 class="tuth">术式试炼（' + trials.length + '）</h3>' +
      (trials.length ? '<table class="ctab"><tr><th>试炼</th><th>id</th><th>花样</th><th>状态</th><th>操作</th></tr>' + trials.map(trow).join('') + '</table>'
                     : '<p class="hint">（本体还没登记试炼）</p>');
    const body = '<p class="hint">这里只列不推：点「进入」直接从该段开头进场，<b>不会</b>替你自动连播。' +
      '「复位」把一段已过 / 搁置的剧情标回未过，好让正常的触发条件再走一遍。</p>' +
      tbl('主线', list.filter(x => x.kind === 'main')) +
      tbl('支线', list.filter(x => x.kind === 'side')) +
      tbl('隐藏剧情', list.filter(x => x.kind === 'hidden')) +
      '<p class="hint">下面这一节是<b>术式试炼</b>：点「进入」不管过没过都从试炼开头走一遍（战斗类直接开那一场），「复位」把一门的试炼打回未过。</p>' +
      tblTrials;
    modal('剧情调试台', body, [{ label: '关闭' }]);
    $('modalBody').querySelectorAll('[data-storygo]').forEach(b => b.onclick = () => {
      if (E().enterStory(b.dataset.storygo)) { closeModal(); render(); saveSoon(); toast('直接进了这一段'); }
      else toast('这会儿进不去（战斗中？）');
    });
    $('modalBody').querySelectorAll('[data-storyreset]').forEach(b => b.onclick = () => {
      E().unsetStory(b.dataset.storyreset); render(); saveSoon(); devStoryModal();
    });
    $('modalBody').querySelectorAll('[data-trialgo]').forEach(b => b.onclick = () => openTrial(b.dataset.trialgo, true));
    $('modalBody').querySelectorAll('[data-trialreset]').forEach(b => b.onclick = () => {
      if (E().trialReset(b.dataset.trialreset)) { saveSoon(); devStoryModal(); } else toast('这一门没有试炼可复位。');
    });
  }

   
  function renameModal() {
    if (!E().s) { toast('尚未开局。'); return; }
    modal('改 姓 名',
      '<p class="hint">改的是你这一世的署名：最多 12 个字，随时能再改。</p>' +
      '<div class="row"><input id="renameInput" type="text" maxlength="12" value="' + esc(E().s.name) + '"></div>',
      [ { label: '取消' },
        { label: '改成这个', onClick: () => {
            const el = document.getElementById('renameInput');
            const okName = E().rename(el ? el.value : '');
            if (okName) { render(); doSave(); toast('改名了。'); }
            else toast('名字不能是空的。');
        } } ]);
    const el = document.getElementById('renameInput');
    if (el) { el.focus(); el.select();
      el.addEventListener('keydown', ev => { if (ev.key === 'Enter') { const b = document.querySelector('#modalFoot .tbtn:last-child'); if (b) b.click(); } }); }
  }
  



  function clearSaveAsk() {
    modal('清 除 存 档', '<p>这会删掉存档文件，并回到主界面从头开始。确定么？</p>', [
      { label: '取消' },
      { label: '确定清除', onClick: async () => {
          saveOff = true;
          try { await Store.reset(); } catch (_) {}
          toast('存档已清除');
          setTimeout(() => { try { location.reload(); } catch (_) { saveOff = false; toast('清除成功，请手动重开一次'); } }, 600);
      } }
    ]);
  }
  function settingsModal() {
    (async () => {
      if (!E().s) {
        const d0 = await Store.dir();
        const mi = (API && API.music) ? await API.music() : null;
        const cdir = window.JH_CUSTOM_DIR || 'app\\custom';
        modal('设置',
          '<div class="kv"><b>存档目录</b><span style="word-break:break-all">' + esc(d0) + '</span>' +
          (mi && mi.dir ? '<b>音乐目录</b><span style="word-break:break-all">' + esc(mi.dir) + '</span>' : '') +
          '<b>自定义目录</b><span style="word-break:break-all">' + esc(cdir) + '</span></div>' +
          '<p class="hint">还没开局，还没有存档。不过想改东西现在就能放：<b>自定义文件夹</b>（随你往里加）与<b>自定义音乐</b>（丢多少首就听多少首）—— 放进去重开一次游戏就装好了。</p>',
          [{ label: '自定义文件夹', onClick: () => { if (API && API.openCustomDir) API.openCustomDir(); else toast('仅桌面版可用'); } },
           { label: '自定义音乐', onClick: () => { if (API && API.openMusicDir) API.openMusicDir(); else toast('仅桌面版可用'); } },
           { label: '自定义内容', onClick: () => customPanel() },
           { label: '清除存档', onClick: () => clearSaveAsk() },
           { label: '关 闭 设 置' }]);
        return;
      }
      const dir = await Store.dir();

      const info = API ? await API.info() : null;
      const body = `<div class="kv">
        <b>存档目录</b><span style="word-break:break-all">${esc(dir)}</span>
        <b>版本</b><span>${info ? esc(info.version) : 'dev'}（Electron ${info ? esc(info.electron) : '-'}）</span>
        <b>进度</b><span>第 ${E().dayCount(E().s)} 日 · ${esc(E().REALMS[E().s.realm].name)} · 主线 ${Object.keys(E().s.storyDone).filter(k=>k.startsWith('ch')).length} 章</span>
      </div>
      ${info && info.dirNote ? '<p class="hint">' + esc(info.dirNote) + '</p>' : ''}
      <p class="hint">存档只写在上面的目录里；本程序不会读写其它任何位置。</p>
      <p class="hint">音乐：<b>自定义音乐盒</b> —— 把音频丢进 <code>userdata\music\</code>，丢多少首就能听多少首，右上角的「乐」里切歌与调音量。</p>
      <p class="hint">自定义内容：<code>app\custom\</code> 里的东西开游戏时自动装进来（.js 或 .json），点下面的按钮看清单与错误。</p>
      <p class="hint">本体内容：<code>app\base\</code> 里的 JSON 是游戏原本的剧情 / 术式 / 装备 / 地图 …… 每个分类一份，直接改它就能改本体（改完重开生效）。</p>`;
      modal('设置', body, [
        { label: '改姓名', onClick: () => renameModal() },
        { label: '自定义文件夹', onClick: () => { if (API && API.openCustomDir) API.openCustomDir(); else toast('仅桌面版可用'); } },
        { label: '自定义音乐', onClick: () => { if (API && API.openMusicDir) API.openMusicDir(); else toast('仅桌面版可用'); } },
        { label: '自定义内容', onClick: () => customPanel() },
        { label: '导出存档', onClick: async () => {
            const r = await Store.exportFile('save_' + Date.now() + '.json', E().snapshot());
            toast(r.ok ? '已导出到 userdata\\export' : ('导出失败：' + (r.error || '')));
        } },
        { label: '立即存档', onClick: async () => { const r = await Store.save(E().snapshot()); toast(r.ok ? '已存档' : '存档失败'); } },
        { label: '重开一世', onClick: () => {
            modal('确认重开', '<p>这将清除当前存档，从零开始。确定么？</p>', [
              { label: '取消' },
              { label: '确定重开', onClick: async () => { await Store.reset(); closeModal(); openCreate(); } }
            ]);
        } },
        { label: '清除存档', onClick: () => clearSaveAsk() },
        { label: '关 闭 设 置' }
      ]);
    })();
  }

  



   
  const LEGACY_MUSIC_RE = [/雨爱|雨愛|rain/i, /琵琶|pipa|djan|remix|biwa/i];
  let musicInfo = null;
  let musicEl = null;
  function musicAudio() {
    if (typeof Audio === 'undefined') return null;       
    if (!musicEl) {
      musicEl = new Audio();
      musicEl.loop = true;
       
      musicEl.addEventListener('ended', function () {
        const s = E().s; if (!s) return;
        const m = (s.music = s.music || { on: false, track: 0, vol: 0.5 });
        if (m.on) musicPlay(-2, true);
      });
    }
    return musicEl;
  }
  function musicFiles() { return (musicInfo && musicInfo.files) || []; }
  function musicPrettyName(name) {
    const s = String(name || '');
    const dot = s.lastIndexOf('.');
    return dot > 0 ? s.slice(0, dot) : s;
  }
   
  function musicIndex() {
    const s = E().s; if (!s) return 0;
    const m = (s.music = s.music || { on: false, track: 0, vol: 0.5 });
    const files = musicFiles();
    if (!files.length) return 0;
    if (m.trackKey) {
      const names = files.map(function (f) { return f.name; });
      const hit = names.indexOf(m.trackKey);
      if (hit >= 0) return hit;
    }
    if (m.trackKey == null && m.track != null && LEGACY_MUSIC_RE[m.track]) {
      for (let i = 0; i < files.length; i++) if (LEGACY_MUSIC_RE[m.track].test(files[i].name)) return i;
    }
    return Math.max(0, Math.min(files.length - 1, (m.track | 0) || 0));
  }
  function musicCurrent() { return musicFiles()[musicIndex()] || null; }
  async function loadMusic(force) {
    if (musicInfo && !force) return musicInfo;
    if (API && API.music) {
      const m = await API.music();
      musicInfo = (m && m.ok) ? m : { dir: (m && m.dir) || '', files: [] };
    } else musicInfo = { dir: '(浏览器环境，无目录)', files: [] };
    return musicInfo;
  }
  function renderMusic() {
    const s = E().s; if (!s) return;
    const m = (s.music = s.music || { on: false, track: 0, vol: 0.5 });
    const files = musicFiles();
    const cur = musicIndex();
    const box = $('musicTracks');
    if (box) {
      box.innerHTML = files.length
        ? files.map(function (f, i) {
            return '<button class="mtrk' + (i === cur ? ' on' : '') + '" data-mtrk="' + i + '" data-tip="' +
              esc(f.name) + '">' + esc(musicPrettyName(f.name)) + '<small>' +
              (i === cur ? '正在听' : '第 ' + (i + 1) + ' 首') + '</small></button>';
          }).join('')
        : '<div class="mempty">这个文件夹里还没有音频 —— 丢多少首进来，这里就有多少首。</div>';
    }
    const now = $('mNow');
    if (now) now.textContent = files.length
      ? ('正在听：' + musicPrettyName(files[cur].name) + '（' + (cur + 1) + ' / ' + files.length + '）')
      : '没有曲目';
    const tg = $('mToggle'); if (tg) tg.textContent = (musicEl && !musicEl.paused) ? '暂停' : '播放';
    const mb = $('btnMusic'); if (mb) mb.classList.toggle('onair', !!(musicEl && !musicEl.paused));
    const vol = Math.round((m.vol == null ? 0.5 : m.vol) * 100);
    const vs = $('mVol'); if (vs) vs.value = vol;
    const vt = $('mVolTxt'); if (vt) vt.textContent = vol + '%';
    const hint = $('mHint');
    if (hint) {
      const dir = (musicInfo && musicInfo.dir) || 'userdata\\music';
      hint.innerHTML = files.length
        ? '这个文件夹里现在有 <b>' + files.length + '</b> 首：<br><code>' + esc(dir) +
          '</code><br>再往里丢文件、点一下曲名（或重开音乐盒）就会多出来。'
        : '把音频丢进这个文件夹，丢多少首就能听多少首（mp3 / m4a / wav / ogg / flac / aac / opus）：<br><code>' +
          esc(dir) + '</code>';
    }
  }
  async function musicPlay(i, quiet) {
    const s = E().s; if (!s) return false;
    const m = (s.music = s.music || { on: false, track: 0, vol: 0.5 });
    await loadMusic(true);
    const files = musicFiles();
    if (!files.length) { if (!quiet) toast('还没找到音频 —— 把 mp3 放进 userdata\\music\\ 就会认出来'); m.on = false; renderMusic(); return false; }
    let idx;
    if (i === -2) idx = (musicIndex() + 1) % files.length;                     
    else if (i === -3) idx = (musicIndex() - 1 + files.length) % files.length;  
    else idx = Math.max(0, Math.min(files.length - 1, (i == null ? musicIndex() : i | 0)));
    m.track = idx; m.trackKey = files[idx].name;
    const f = files[idx];
    const a = musicAudio();
    if (!a) return false;
    a.loop = files.length <= 1;
    a.volume = Math.max(0, Math.min(1, m.vol == null ? 0.5 : m.vol));
    if (a.dataset.src !== f.url) { a.src = f.url; a.dataset.src = f.url; }
    try { await a.play(); m.on = true; }
    catch (err) { m.on = false; if (!quiet) toast('浏览器拦了一下，再点一次「播放」'); }
    renderMusic(); saveSoon();
    return m.on;
  }
  function musicStop() {
    const s = E().s; if (!s) return;
    const a0 = musicAudio(); if (a0) a0.pause();
    s.music = s.music || { on: false, track: 0, vol: 0.5 };
    s.music.on = false; renderMusic(); saveSoon();
  }
  function bindMusic() {
    const btn = $('btnMusic'), pop = $('musicPop');
    if (btn && !btn._jh) {
      btn._jh = 1;
      btn.onclick = (ev) => {
        ev.stopPropagation();
        pop.classList.toggle('hidden');
        if (!pop.classList.contains('hidden')) loadMusic(true).then(renderMusic);    
      };
    }
    const tg = $('mToggle');
    if (tg && !tg._jh) {
      tg._jh = 1;
      tg.onclick = () => { const a = musicAudio(); if (!a || a.paused) musicPlay(musicIndex()); else musicStop(); };
    }
    const pv = $('mPrev');
    if (pv && !pv._jh) { pv._jh = 1; pv.onclick = () => musicPlay(-3, false); }
    const nx = $('mNext');
    if (nx && !nx._jh) { nx._jh = 1; nx.onclick = () => musicPlay(-2, false); }
    const vs = $('mVol');
    if (vs && !vs._jh) {
      vs._jh = 1;
      vs.oninput = () => {
        const v = Math.max(0, Math.min(100, +vs.value || 0)) / 100;
        const s = E().s; if (s) { s.music = s.music || { on: false, track: 0, vol: 0.5 }; s.music.vol = v; saveSoon(); }
        const au = musicAudio(); if (au) au.volume = v;
        const txt = $('mVolTxt'); if (txt) txt.textContent = Math.round(v * 100) + '%';
      };
    }
    if (pop && !pop._jh) {
      pop._jh = 1;
       
      pop.onclick = (ev) => {
        ev.stopPropagation();
        const b = ev.target && ev.target.closest ? ev.target.closest('[data-mtrk]') : null;
        if (b) musicPlay(+b.dataset.mtrk, false);
      };
      document.addEventListener('click', () => pop.classList.add('hidden'));
    }
  }

   
  function syncNav() {
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
  }

   
  function saveSoon() { saveTick = 14; }
  async function doSave() { if (saveOff) return; await Store.save(E().snapshot()); }

  function loop() {
    const e = E();
     
    if (window.JH_room && window.JH_room.active()) { window.JH_room.tick(); return; }
    if (!e.s) return;        
    const changed = e.tick(1);
    const cur = e.curEvent();
    const key = cur ? cur.id + ':' + cur.nodeId : '';
    if (changed || key !== lastEventKey) render();
    else {
      renderStats(); renderLog();
      if (e.getBattle()) renderBattle();
      else if (view === 'map' && e.s.travel) render();
      else if (view === 'log') refreshLogView();
    }
    if (++saveTick >= 15) { saveTick = 0; doSave(); }
    const mp = $('musicPop');
    if (mp && !mp.classList.contains('hidden')) renderMusic();
  }

   
  function bindTop() {
    document.querySelectorAll('#nav button').forEach(b => b.onclick = () => { view = b.dataset.view; syncNav(); render(); });
    $('btnBreak').onclick = () => { if (E().breakthrough()) { toast('境界提升'); } render(); saveSoon(); };
    $('btnIdle').onclick = () => {
      const s = E().s;
      if (s.travel) { toast('还在赶路'); return; }
      s.idle.on = !s.idle.on; s.idle.room = s.room;
      if (s.idle.on) E().stopAct(false);
      toast('挂机：' + (s.idle.on ? '开（智能打怪）' : '关'));
      render(); saveSoon();
    };
    $('btnSave').onclick = async () => { await doSave(); toast('已存档'); };
    $('btnSettings').onclick = settingsModal;
    $('btnLogClear').onclick = () => { E().s.log = []; lastLogLen = -1; render(); };
    $('btnSecret').onclick = () => {
      const v = $('secretInput').value;
      if (E().sparInput && E().sparInput(v)) toast('他好像听见了');
      else if (E().secret(v)) toast('你似乎想起了什么');
      $('secretInput').value = ''; render();
    };
    $('secretInput').addEventListener('keydown', ev => { if (ev.key === 'Enter') $('btnSecret').click(); });
    $('moon').onclick = () => { E().click('moon'); render(); };
    $('lantern').onclick = () => { E().click('lantern'); render(); };
    $('nameplate').onclick = () => { E().click('nameplate'); renderStats(); };
    $('modalWrap').onclick = (ev) => { if (ev.target.id === 'modalWrap') closeModal(); };
     
    document.addEventListener('click', ev => {
      const b = ev.target && ev.target.closest ? ev.target.closest('[data-devstory]') : null;
      if (b) devStoryModal();
    });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeModal(); });
  }

  window.JH_ui = { onLog() {   }, render, toast, reopenLogin, showLogin, potion: potionModal,
    battle: { pushFx: pushFx, pushMove: pushMove, runAct: runAct, choreo: actChoreo, busy: function () { return acting; },
             forceIdle: function () { actToken++; acting = false; },
              clear: function () { fxList.length = 0; },
              fx: function () { return liveFx().slice(); }, render: renderBattle },
    music: { refresh: function (force) { return loadMusic(force === false ? false : true).then(function () { renderMusic(); return musicInfo; }); },
             tracks: function () { return musicFiles().map(function (f, i) { return { key: f.name, name: musicPrettyName(f.name), file: f, index: i }; }); },
             files: function () { return musicFiles(); },
             current: function () { return musicCurrent(); },
             play: function (i) { return musicPlay(i, true); },
             next: function () { return musicPlay(-2, true); },
             prev: function () { return musicPlay(-3, true); },
             stop: musicStop,
             el: function () { return musicEl; }, info: function () { return musicInfo; } } };

   
  let loginWrap = null;
  function hideLogin() {
    if (loginWrap) loginWrap.classList.add('hidden');
    document.body.classList.remove('in-login');
  }
   
  function saveMeta(raw) {
    const d = JSON.parse(raw);
    if (!d || !d.made) return null;
    const R = (E().REALMS || [])[d.realm] || {};
    let when = '';
    try { const dt = new Date(d.lastSave || Date.now()); when = (dt.getMonth() + 1) + ' 月 ' + dt.getDate() + ' 日'; } catch (_) {}
    return { raw: raw, name: d.name || '无名', realm: R.name || '—',
             day: Math.floor((d.t || 0) / 1440) + 1, when: when };
  }
  function showLogin(meta) {
    if (!loginWrap) {
      loginWrap = document.createElement('div');
      loginWrap.id = 'loginWrap';
      loginWrap.className = 'hidden';
      document.body.appendChild(loginWrap);
    }
    document.body.classList.add('in-login');
    loginWrap.classList.remove('hidden');
    const has = !!(meta && meta.hasSave);
    const btns = [];
    if (has) {
      btns.push('<button class="stonebtn" data-lg="continue">继 续 修 行</button>');
      btns.push('<button class="stonebtn ghost" data-lg="newgame">重 开 一 世</button>');
    } else {
      btns.push('<button class="stonebtn" data-lg="newgame">入 江 湖</button>');
      btns.push('<button class="stonebtn ghost" data-lg="loadfile">读 取 存 档</button>');
    }
    btns.push('<button class="stonebtn ghost" data-lg="lan">局 域 网 对 战</button>');
    btns.push('<button class="stonebtn ghost" data-lg="settings">设 置</button>');
    btns.push('<button class="stonebtn ghost" data-lg="quit">退 出</button>');
    const info = has
      ? '第 ' + meta.day + ' 日 · ' + esc(meta.realm) + ' · ' + esc(meta.name) + '　（上次存档 ' + esc(meta.when) + '）'
      : '还没有存档。新人就此入门。';
    loginWrap.innerHTML =
      '<div class="lg-ink"></div>' + inkMtn('lg-mtn') + '<div class="lg-mist"></div>' +
      '<div class="lg-sealmini"></div>' +
      '<div class="lg-ver">单机 · 离线 · 也可局域网对局</div>' +
      '<div class="lg-title"><span class="lg-seal">咒</span><b>咒术闲录</b><i>JUJUTSU XIANLU</i></div>' +
      '<div class="lg-sub">一 念 之 间 ， 人 间 与 咒 灵 之 间</div>' +
      '<div class="lg-menu">' + btns.join('') + '</div>' +
      '<div class="lg-saveinfo">' + info + '</div>' +
      '<div class="lg-foot">非商业同人自研的单机放置游戏：玩法骨架参考《放置江湖》，世界观取材《咒术回战》。<br>' +
      '界面与素材全部以 CSS / 字符 / SVG 现画，未使用任何第三方图片或音频。</div>';
    loginWrap.querySelectorAll('[data-lg]').forEach(b => b.onclick = () => loginAct(b.dataset.lg, meta));
  }
  async function loginAct(kind, meta) {
    const e = E();
    if (kind === 'continue') {
      let ok = false;
      try { ok = e.restore(meta.raw); } catch (_) { ok = false; }
      if (!ok) { toast('存档读不出来，可能版本不对'); return; }
      hideLogin();
      const gap = (Date.now() - (e.s.lastSave || Date.now())) / 1000;
      if (gap > 10) e.applyOffline(gap);
      view = 'room'; syncNav(); render(); maybeTutorial(e); toast('继续修行：' + e.s.name);
      return;
    }
    if (kind === 'newgame') {
      const go = () => { closeModal(); hideLogin(); openCreate(); };
      if (meta && meta.hasSave) {
        modal('重 开 一 世', '<p>这会从头捏一个新角色。旧存档要等你把「立身」走完、真正开局那一刻才会被覆盖。</p>', [
          { label: '算了' }, { label: '继续重开', onClick: go }
        ]);
        return;
      }
      go();
      return;
    }
    if (kind === 'loadfile') {
      let r = null;
      try { r = await Store.load(); } catch (_) {}
      if (r && r.ok && e.restore(r.data)) { hideLogin(); view = 'room'; syncNav(); render(); maybeTutorial(e); toast('存档已载入'); }
      else toast('没有可用的存档');
      return;
    }
     
    if (kind === 'lan') {
      if (!window.JH_room) { toast('这个版本没有局域网对战'); return; }
      hideLogin();
      window.JH_room.open();
      return;
    }
    if (kind === 'settings') { settingsModal(); return; }
    if (kind === 'quit') { if (API && API.quit) API.quit(); else toast('网页里退不出去'); }
  }
   
  async function reopenLogin() {
    let meta = null;
    try { const r = await Store.load(); meta = (r && r.ok && r.data) ? saveMeta(r.data) : null; } catch (_) {}
    showLogin(meta ? Object.assign({ hasSave: true }, meta) : { hasSave: false });
  }

   
  function openCreate() {
    if (!window.JH_createUI) { E().start('无名客'); syncNav(); render(); return; }
    window.JH_createUI.open((name, creation) => {
      E().startCreated(name, creation);
      view = 'room'; syncNav(); render(); maybeTutorial(E());
      toast('立身已定：' + name);
    });
  }

  async function boot() {
    bindTop();
    initTip();
    const e = E();
    let data = null;
    try { const r = await Store.load(); data = r && r.ok ? r.data : null; } catch (_) {}
    syncNav(); render();
    bindMusic();
    loadMusic().then(() => {
      renderMusic();
      if (e.s && e.s.music && e.s.music.on) musicPlay(null, true);       
    });
    setInterval(loop, 1000);
    window.addEventListener('beforeunload', () => { try { if (e.s && !e.s.lan && !saveOff) Store.save(e.snapshot()); } catch (_) {} });
     
    let meta = null;
    try { meta = data ? saveMeta(data) : null; } catch (_) { meta = null; }
    showLogin(meta ? Object.assign({ hasSave: true }, meta) : { hasSave: false });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
