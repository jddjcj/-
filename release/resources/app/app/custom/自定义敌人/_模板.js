/* 模板 · 自定义敌人
   ────────────────────────────────────────────────────────────
   场景里刷的敌手与头目（进 JH_FOES）。敌我数值是陪你一起长的 ——
   不写死几万血，而是写「它该挨几下」，本体按你当前的强度折算出来。

   用法：复制改名（别用 _ 开头），把 push 从注释里放出来改成自己的。

   ── 字段 ──
     id / name      唯一 id（x_ 打头）与名字
     scene          刷在哪个场景（本体场景 id，如 sc_shibuya；也可以是自定义场景）
     lvl            等级，决定它和你对打的档次
     rounds         预期能撑几个回合 —— 这就是它的血量，越多越厚
     margin         强度系数，越大越容易打（常例 1.5）
     defF           防御系数（本体基准防御 × defF）
     phyRes         物理减伤 0~1
     curRes         咒力减伤 0~1
     dmgType        它打你的是 phy 物理还是 cur 咒力
     human          true = 算「人」，不吃收服那一套
     skills         它会用的术式 id 数组（术式得真实存在）
     boss           true = 头目（清场够数才现身的那种）
     dummy          true = 木桩（打不完，给你试招用）
     dom            它会开的领域（领域术式 id）；endlessDom:true 才让它领域血无限
     loot           掉落表：[[物品id, 概率 0~1, 数量]]
     exp / silver   想自己定就写；不写按等级折算

   不要写无限血 / 无限咒力：本体不给敌人这种待遇，领域血也是按它自身强度算的。
   ──────────────────────────────────────────────────────────── */
/*
window.JH_CUSTOM.敌人.push({
  id: "x_f_shadow_hound", name: "影犬", scene: "sc_forest", lvl: 2,
  rounds: 8, margin: 1.6, defF: 0.7, phyRes: 0.15, dmgType: "phy",
  skills: ["k_punch"],
  desc: "从树影里立起来的一条狗，没有眼睛，靠听。",
  loot: [["mat_res", 0.5, 1], ["mat_bone", 0.3, 1]]
});

window.JH_CUSTOM.敌人.push({
  id: "x_f_shadow_lord", name: "影座之主", scene: "sc_forest", lvl: 6,
  rounds: 14, margin: 1.05, defF: 1.1, phyRes: 0.5, curRes: 0.3,
  dmgType: "cur", boss: true, skills: ["x_sk_shadow_a"],
  desc: "它坐着不动。你走过去的每一步，影子都比你先到。",
  loot: [["mat_core", 0.8, 1], ["mat_shard", 0.6, 2]]
});
*/
