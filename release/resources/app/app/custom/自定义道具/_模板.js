/* 模板 · 自定义道具
   ────────────────────────────────────────────────────────────
   药品 / 食物 / 酒水 / 材料 / 书 / 任务物（进 JH_ITEMS，靠 type 分栏）。

   用法：复制改名（别用 _ 开头），把 push 从注释里放出来改成自己的。

   ── type 一览 ──
     pill   药         关键字段 effect
     food   吃的       effect
     drink  喝的       effect
     mat    材料（锻造、任务用）  无
     book   书，用了学会一门术式  learn:"技能id"
     quest  任务物，卖不掉        无

   ── 字段 ──
     id / name   唯一 id（x_ 打头）与名字
     q           品质 1~7
     price       售价
     stack       一叠最多几个（材料 99、装备 1）
     effect      吃 / 用的效果，见下
     learn       书专用：学会哪门术式
     desc        说明

   ── effect 能写什么 ──
     cur / hp           回咒力 / 回气血（数值）
     curFull / hpFull   true = 直接回满
     exp                加修为
     attr               永久加属性，例如 { insight: 1 }
     cure               true = 解咒毒
     buff               战斗里用的临时增益，例如 { curAtk:0.35, turns:4 } 或 { weak:3 }
   ──────────────────────────────────────────────────────────── */
/*
window.JH_CUSTOM.道具.push({
  id: "x_pill_ink", name: "墨丸", type: "pill", q: 3, price: 180, stack: 99,
  effect: { cur: 220, hp: 40 },
  desc: "吞下去喉咙里发苦，苦完之后咒力自己就转起来了。"
});

window.JH_CUSTOM.道具.push({
  id: "x_mat_ash", name: "影灰", type: "mat", q: 2, price: 30, stack: 99,
  desc: "从影子里扫出来的一撮灰，摸上去还是凉的。"
});

window.JH_CUSTOM.道具.push({
  id: "x_bk_shadow", name: "影之座·抄本", type: "book", q: 5, price: 900, stack: 1,
  learn: "x_sk_shadow_a",
  desc: "抄得潦草，但关键那一页记得很细。"
});
*/
