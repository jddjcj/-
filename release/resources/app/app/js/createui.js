/* 创建角色那几屏的界面。 */
(function () {
  'use strict';
  const C = () => window.JH_create;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const p100 = v => (Math.round(v * 1000) / 10) + '%';
  const KIND = { atk: '主动术式', nei: '咒力运用', qing: '体术身法', passive: '被动' };

  let draft = null, done = null, step = 0, wrap = null;
  const STEPS = ['一 · 出身', '二 · 生得术式', '三 · 天赋与技能'];

   
  function preview() {
    if (!draft.originId) return null;
    const f = C().finalize(draft);
    const st = window.JH_combat.stats({
      attrs: f.attrs, origin: f.origin, ce: f.ce, realm: 0,
      innate: f.innate, skills: {}, skillLv: {}, equip: {}, tech: {}, buff: null
    });
    return { f: f, st: st };
  }

  function originInit(o) {
    const i = o.init || {}, out = [];
    if (i.curMax) out.push('咒力总量 +' + i.curMax);
    if (i.hp) out.push('气血 ' + (i.hp > 0 ? '+' : '') + i.hp);
    if (i.phyAtk) out.push('物理攻击 +' + i.phyAtk);
    if (i.curAtk) out.push('咒力攻击 +' + i.curAtk);
    if (i.def) out.push('防御 +' + i.def);
    if (i.luck) out.push('福缘 ' + (i.luck > 0 ? '+' : '') + i.luck);
    if (i.face) out.push('颜值 ' + (i.face > 0 ? '+' : '') + i.face);
    if (i.ceEff) out.push('咒力效率 +' + p100(i.ceEff));
    if (i.ceCtl) out.push('咒力操作 +' + p100(i.ceCtl));
    if (i.silver) out.push('咒币 +' + i.silver);
    const g = o.growth || {};
    out.push('成长 悟性×' + (g.insight || 1) + ' 根骨×' + (g.root || 1));
    return out.join(' · ');
  }

   
  function viewOrigin() {
    let h = '<div class="crrow"><label>姓名</label>' +
      '<input id="crName" maxlength="12" placeholder="无名咒术师" value="' + esc(draft.name) + '">' +
      '<span class="hint">最多 12 字</span></div>';
    h += '<div class="crrow"><label>密语</label>' +
      '<input id="crCode" maxlength="12" placeholder="想起一句话…"><button class="tbtn" id="crCodeBtn">验证</button>' +
      '<span class="hint">' + (draft.hiddenUnlocked.length ? ('你已想起 ' + draft.hiddenUnlocked.length + ' 句') : '想不起名字的东西，写在这里也不认') + '</span></div>';
    h += '<div class="crgrid">';
    for (const o of C().visibleOrigins(draft)) {
      h += '<div class="crcard' + (draft.originId === o.id ? ' on' : '') + '" data-origin="' + o.id + '">' +
        '<div class="crcard-h"><b>' + esc(o.name) + '</b><span class="tag">' + esc(o.tag) + '</span>' +
        '</div>' +
        '<div class="crcard-d">' + esc(o.desc || '') + '</div>' +
        '<div class="crcard-f">' + esc(o.flavor || '') + '</div>' +
        '<div class="crcard-n"><span>术式槽位 ' + o.slots + '</span><span>咒效/咒操上限 ' + p100(o.ceCap) + '</span></div>' +
        '<div class="crcard-n dim">' + esc(originInit(o)) + '</div>' +
        '</div>';
    }
    h += '</div>';
    return h;
  }

  function viewTech() {
    const o = C().originOf(draft), slots = o ? o.slots : 1;
    let h = '<div class="subtitle">你觉醒了 <b>' + draft.techs.length + ' / ' + slots +
      '</b> 门生得术式' + (slots > 1 ? '（此出身可择 ' + slots + ' 门）' : '') + '。</div>';
    h += '<div class="crgrid wide">';
    for (const t of window.JH_INNATE) {
      const dm = window.JH_MARTIAL_MAP[t.domain];
      h += '<div class="crcard' + (draft.techs.indexOf(t.id) >= 0 ? ' on' : '') + '" data-tech="' + t.id + '">' +
        '<div class="crcard-h"><b class="q' + t.q + '">' + esc(t.name) + '</b>' +
        '<span class="tag">' + esc(t.element) + '</span>' +
        '<span class="tag">' + esc(window.JH_QUALITY_NAMES[t.q] || '') + '</span></div>' +
        '<div class="crcard-d">' + esc(t.desc || '') + '</div>' +
        '<div class="crcard-f">' + esc(t.passive || '') + '</div>' +
        '<div class="crcard-n">' + t.skills.map(function (id) {
          const m = window.JH_MARTIAL_MAP[id];
          return m ? ('<span>' + esc(m.name) + ' · ' + (m.lv || 1) + '级</span>') : '';
        }).join('') + '</div>' +
        (dm ? '<div class="crcard-n dim"><span>领域：' + esc(dm.name) + '（熟练度 8 级）</span></div>' : '') +
        '</div>';
    }
    h += '</div>';
    return h;
  }

  function talentRow(key, label, note) {
    const v = draft[key];
    const pool = draft.talentPool - C().talentSpent(draft);
    return '<div class="crtalent"><label>' + label + '</label>' +
      '<button class="mini2" data-tal="' + key + '" data-d="-1"' + (v <= C().TALENT_MIN ? ' disabled' : '') + '>−</button>' +
      '<b>' + v + '</b>' +
      '<button class="mini2" data-tal="' + key + '" data-d="1"' + (pool <= 0 || v >= C().TALENT_CAP ? ' disabled' : '') + '>＋</button>' +
      '<em>' + note + '　单项 ' + C().TALENT_MIN + '~' + C().TALENT_CAP + '</em></div>';
  }
  function luckRow(key, label) {
    const v = draft[key];
    const o = C().originOf(draft);
    const cap = (key === 'face' && o && o.faceCap != null) ? o.faceCap : C().LUCK_CAP;
    const pool = draft.luckPool - C().luckSpent(draft);
    return '<div class="crtalent"><label>' + label + '</label>' +
      '<button class="mini2" data-luck="' + key + '" data-d="-1"' + (v <= 0 ? ' disabled' : '') + '>−</button>' +
      '<b>' + v + '</b>' +
      '<button class="mini2" data-luck="' + key + '" data-d="1"' + (pool <= 0 || v >= cap ? ' disabled' : '') + '>＋</button>' +
      '<em>上限 ' + cap + (key === 'face' ? '　好运效果为福缘一半，但涨好感更快' : '') + '</em></div>';
  }

  function viewAttrs() {
    const p = preview();
    let h = '<div class="cr2col"><div class="crblock"><h3>天 赋</h3>' +
      '<div class="hint">悟性：修炼咒力更快　根骨：修炼肉身更快（两项之和 100~140）</div>' +
      talentRow('insight', '悟性', '咒力侧') + talentRow('root', '根骨', '肉身侧') +
      '<div class="crleft">天赋点 已用 ' + C().talentSpent(draft) + ' / ' + draft.talentPool + '</div>' +
      luckRow('luck', '福缘') + luckRow('face', '颜值') +
      '<div class="crleft">福缘+颜值 已用 ' + C().luckSpent(draft) + ' / ' + draft.luckPool + '</div>' +
      '</div>';

    h += '<div class="crblock"><h3>估 算</h3>';
    if (p) {
      h += '<div class="kv">' +
        '<b>咒力效率</b><span>' + p100(p.st.ceEff) + ' （上限 ' + p100(p.st.ceCap) + '）</span>' +
        '<b>咒力操作</b><span>' + p100(p.st.ceCtl) + '</span>' +
        '<b>气血上限</b><span>' + p.st.hpMax + '</span>' +
        '<b>咒力总量</b><span>' + p.st.curMax + '</span>' +
        '<b>物理攻击</b><span>' + p.st.phyAtk + '</span>' +
        '<b>咒力攻击</b><span>' + p.st.curAtk + '</span>' +
        '<b>防御</b><span>' + p.st.def + '</span>' +
        '<b>暴击 / 闪避</b><span>' + p.st.crit + '% / ' + p.st.dodge + '%</span></div>';
    } else h += '<p class="hint">请先选定出身。</p>';
    h += '<h3>普 适 技 能</h3><div class="hint">共 ' + C().SKILL_POINTS + ' 点，单项最多 ' + C().SKILL_MAX_LV + ' 级</div>';
    for (const m of C().allowedCommon(draft)) {
      const lv = draft.common[m.id] || 0;
      h += '<div class="crskill"><span class="q' + m.q + '">' + esc(m.name) + '</span>' +
        '<span class="hint">' + KIND[m.kind] + '</span>' +
        '<button class="mini2" data-common="' + m.id + '" data-d="-1"' + (lv ? '' : ' disabled') + '>−</button>' +
        '<b>' + lv + '</b>' +
        '<button class="mini2" data-common="' + m.id + '" data-d="1"' + (lv >= C().SKILL_MAX_LV ? ' disabled' : '') + '>＋</button></div>';
    }
    h += '<div class="crleft">技能点 已用 ' + C().pointsUsed(draft) + ' / ' + C().pointsCap(draft) + '</div>';
    h += '</div></div>';
    return h;
  }

   
  function render() {
    const body = wrap.querySelector('#crBody');
    body.innerHTML = step === 0 ? viewOrigin() : step === 1 ? viewTech() : viewAttrs();
    wrap.querySelector('#crHint').textContent = '';
    const heads = wrap.querySelectorAll('.crsteps span');
    for (let i = 0; i < heads.length; i++) heads[i].classList.toggle('on', i === step);
    wrap.querySelector('#crBack').disabled = step === 0;
    wrap.querySelector('#crNext').textContent = step === 2 ? '开 始' : '下一步';

    const nameEl = body.querySelector('#crName');
    if (nameEl) nameEl.oninput = function () { draft.name = nameEl.value.slice(0, 12); };

    const codeBtn = body.querySelector('#crCodeBtn');
    if (codeBtn) codeBtn.onclick = function () {
      const inp = body.querySelector('#crCode');
      const o = C().unlockByCode(draft, (inp.value || '').trim());
      if (!o) { hint('你什么也没想起来。'); return; }
      render();
      hint('你想起了一个名字：' + o.name + '。');
    };

    body.querySelectorAll('[data-origin]').forEach(function (c) {
      c.onclick = function () { if (C().pickOrigin(draft, c.dataset.origin)) render(); };
    });
    body.querySelectorAll('[data-tech]').forEach(function (c) {
      c.onclick = function () {
        if (!C().toggleTech(draft, c.dataset.tech)) hint('这个出身只能带走 ' + (C().originOf(draft) || {}).slots + ' 门术式，先取下一门。');
        render();
      };
    });
    body.querySelectorAll('[data-tal]').forEach(function (b) {
      b.onclick = function () { C().adjTalent(draft, b.dataset.tal, +b.dataset.d); render(); };
    });
    body.querySelectorAll('[data-luck]').forEach(function (b) {
      b.onclick = function () { C().adjLuck(draft, b.dataset.luck, +b.dataset.d); render(); };
    });
    body.querySelectorAll('[data-common]').forEach(function (b) {
      b.onclick = function () { C().spendPoint(draft, b.dataset.common, +b.dataset.d); render(); };
    });
  }

  function hint(msg) { if (wrap) wrap.querySelector('#crHint').textContent = msg || ''; }

  function next() {
    const o = C().originOf(draft);
    if (step === 0) {
      if (!o) { hint('先挑一个出身。'); return; }
      step = 1; render(); return;
    }
    if (step === 1) {
      if (!o || draft.techs.length !== o.slots) { hint('这个出身要选满 ' + (o ? o.slots : 1) + ' 门生得术式。'); return; }
      step = 2; render(); return;
    }
    const v = C().validate(draft);
    if (!v.ok) { hint(v.errors.join('　')); return; }
    const f = C().finalize(draft);
    const name = (draft.name || '').trim() || '无名咒术师';
    const cb = done;
    close();
    if (cb) cb(name, f);
  }

  function build() {
    wrap = document.createElement('div');
    wrap.id = 'createWrap';
    wrap.className = 'hidden';
    wrap.innerHTML =
      '<div id="createBox">' +
        '<div class="crhead"><div class="crtitle">立 身</div>' +
        '<div class="crsub">咒术闲录 · 出身定天赋，术式定路数</div>' +
        '<button class="tbtn" id="crCancel" style="margin-left:auto">返回登录</button></div>' +
        '<div class="crsteps">' + STEPS.map(function (s) { return '<span>' + s + '</span>'; }).join('') + '</div>' +
        '<div class="crbody" id="crBody"></div>' +
        '<div class="crfoot"><span class="crhint" id="crHint"></span>' +
        '<button class="tbtn" id="crBack">上一步</button>' +
        '<button class="tbtn" id="crNext">下一步</button></div>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.querySelector('#crBack').onclick = function () { if (step > 0) { step--; render(); } };
    wrap.querySelector('#crCancel').onclick = function () {
      close();
      if (window.JH_ui && window.JH_ui.reopenLogin) window.JH_ui.reopenLogin();
    };
    wrap.querySelector('#crNext').onclick = next;
  }

  function open(cb) {
    if (!wrap) build();
    draft = C().newDraft('无名咒术师');
    done = cb;
    step = 0;
    wrap.classList.remove('hidden');
    render();
  }
  function close() { if (wrap) wrap.classList.add('hidden'); }

  window.JH_createUI = { open: open, close: close, isOpen: function () { return !!wrap && !wrap.classList.contains('hidden'); } };
})();