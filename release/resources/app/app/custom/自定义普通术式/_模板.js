/* 模板 · 自定义普通术式
   ────────────────────────────────────────────────────────────
   一切「能学、能加点」的术式都在这里（进 JH_MARTIAL）：
   主动、内功、身法、被动，以及生得术式的衍生技能。

   用法：复制改名（别用 _ 开头），把 push 从注释里放出来改成自己的。

   ── kind 四种 ──
     atk      攻击术式（物理 / 咒力），看 atkType cost mult hits cri eff
     nei      内功，学了永久加属性，看 nei:{ curMax, ceEff, ceCtl, insight, root … }
     qing     身法，加闪避 / 逃跑 / 先手，看 qing:{ dodge, esc, ceCtl, phyAtk … }
     passive  被动，不能主动打出 —— 只写 passive 说明；要动机制得改本体

   ── 通用字段 ──
     id / name   唯一 id（x_ 打头）与名字
     q           品质 1~7，同时也决定冷却长短（越强越久）
     common      true = 「普通术式」，各组织默认都能教（见「自定义组织」）
     innate      属于哪一系生得术式；写了才算那一系的衍生技能
     lv          解锁等级（按那一系的熟练度）
     atkType     phy 物理 / cur 咒力
     cost        咒力消耗
     mult / hits / cri  倍率 / 段数 / 暴击加成
     eff         机制块，见下
     passive     被动的说明文字
     desc        图鉴里的说明

   ── eff 能写的机制（与本体共用一套）──
     hpCost 以自身气血为代价 / pierce 无视防御 / trueDamage 真伤 / lifesteal 吸血 /
     drain 抽咒力 / defDown 削防 / stun 钉住 n 回合 / weak 降攻 / dot 蚀 /
     recoil 反噬 / heal 回血 / shield 护盾 / summon 召唤 …
   召唤系（十种影法术 / 咒灵操术这一类）的写法在 app/base/术式机制/术式机制.json，
   照抄着改最稳。
   ──────────────────────────────────────────────────────────── */
/*
window.JH_CUSTOM.普通术式.push({
  id: "x_sk_shadow_a", name: "影手", kind: "atk", q: 4, innate: "x_my_shadow", lv: 1,
  atkType: "phy", cost: 14, mult: 1.85, hits: 1, cri: 5,
  eff: { defDown: 0.15 },
  desc: "影子伸出手来抓一把，抓过的地方会松。"
});

window.JH_CUSTOM.普通术式.push({
  id: "x_nei_breath", name: "吐纳", kind: "nei", q: 2, common: true,
  nei: { curMax: 0.12, ceEff: 0.02 },
  desc: "把呼吸压慢，咒力就厚一层。"
});

window.JH_CUSTOM.普通术式.push({
  id: "x_qing_step", name: "影步", kind: "qing", q: 3, common: true,
  qing: { dodge: 12, esc: 0.2 },
  desc: "踩着影子走，脚下不响。"
});

window.JH_CUSTOM.普通术式.push({
  id: "x_ps_shadow", name: "影随", kind: "passive", q: 3, innate: "x_my_shadow",
  passive: "站在阴影里时，受到的物理伤害 −10%。",
  desc: "影子和你的脚后跟，总有一个在前面。"
});
*/
