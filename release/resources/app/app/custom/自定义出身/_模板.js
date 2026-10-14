/* 模板 · 自定义出身
   ────────────────────────────────────────────────────────────
   「出身」＝创建角色时选的那一栏（进 JH_ORIGINS）。

   用法：复制改名（别用 _ 开头），把 push 从注释里放出来改成自己的。

   ── 字段 ──
     id / name      唯一 id（x_ 打头）与名字
     tag            归类词（凡俗 / 御三家 / 咒灵 …），只影响显示
     slots          开局能带几门生得术式
     ceCap          咒力上限系数（0~1，越大咒力池越厚）
     noSelect       true = 不出现在选择列表里（本体「普通人家」就是这种兜底出身）
     growth         每级成长：{ insight, root, cur, body }
     init           开局数值：{ curMax, phyAtk, curAtk, def, hp, luck, face,
                                 ceEff, ceCtl, silver }
     extra          可选的特殊待遇，例如 { allSkills:true, freeShop:true }
     desc / flavor  说明 / 一句风味话

   想让它能挑生得术式，就把 slots 给够；具体挑哪几系由玩家创建角色时自己定。
   ──────────────────────────────────────────────────────────── */
/*
window.JH_CUSTOM.出身.push({
  id: "x_origin_stray", name: "野孩子", tag: "凡俗", slots: 2, ceCap: 0.9,
  growth: { insight: 1, root: 2, cur: 1, body: 2 },
  init: { curMax: 20, phyAtk: 4, curAtk: 0, def: 2, hp: 30, luck: 5, face: 0,
          ceEff: 0.02, ceCtl: 0.01, silver: 80 },
  desc: "没人给你上过户口，也没人教过你规矩。",
  flavor: "好处是，你从小就知道跑比打有用。"
});
*/
