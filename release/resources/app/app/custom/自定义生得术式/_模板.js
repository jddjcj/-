/* 模板 · 自定义生得术式
   ────────────────────────────────────────────────────────────
   「生得术式」＝天生的那一系术式（进 JH_INNATE）。本体十四系在
   app/base/生得术式/生得术式.json；每一系下面挂一串衍生技能（写在
   「自定义普通术式」里，用 innate 指回这一系）。

   用法：复制改名（别用 _ 开头），把 push 从注释里放出来改成自己的。

   ── 字段 ──
     id          唯一 id（x_ 打头最保险）
     name        术式名
     q           品质 1~7
     element     属性，纯文字（空间 / 影 / 血 / 言 …）
     passive     被动说明（一句话，写清机制）
     desc        图鉴里的说明
     skills      这一系衍生技能的 id 数组
     domain      领域展开那个术式的 id（写在本文件夹之外的「自定义普通术式」里）
     blockCost   每次格挡消耗的咒力（只有带格挡被动的系才要）

   ── 领域展开怎么写 ──
   领域也是 JH_MARTIAL 里的一条，多写 domain:true 与 domKind：

     { id:"x_dom_mine", name:"领域展开·我的领域", kind:"atk", q:7, innate:"x_my_shadow",
       lv:8, domain:true, domKind:"shadowSwarm", atkType:"cur", cost:130,
       mult:5.0, hits:1, cri:20, eff:{ stun:2, trueDamage:0.25 }, desc:"……" }

   domKind 决定用哪一套水墨演出（每个领域一套专属动作与主色）。现成取值：
     infoOverload openBarrier shadowSwarm soulTrue bloodPrice command weakPoint
     turretShield craftRandom position frameLock warehouse slotJackpot debuffSwarm
   写别的值也能开，只是会落到默认那套墨戏上。要加全新的一套，得改本体 app/js/ui.js。
   ──────────────────────────────────────────────────────────── */
/*
window.JH_CUSTOM.生得术式.push({
  id: "x_my_shadow", name: "影之座", q: 6, element: "影",
  passive: "影子里能站东西：受到的物理伤害 −20%。",
  desc: "脚底下的那块黑，比你自己的影子听话。",
  skills: ["x_sk_shadow_a", "x_sk_shadow_b"],
  domain: "x_dom_shadow"
});
*/
