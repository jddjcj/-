/* 模板 · 自定义秘术
   ────────────────────────────────────────────────────────────
   有传授条件的秘传术式（进 JH_MARTIAL）。和「自定义npc」联动：
   那边的 teach.skill 指向这里的 id，好感够 + 你符合 req，两条都过才教。

   用法：复制改名（别用 _ 开头），把 push 从注释里放出来改成自己的。

   ── 字段 ──
     id / name   唯一 id（x_ 打头）与名字
     kind        nei 内功 / atk 攻击 / qing 身法（和普通术式同一套）
     q           品质 1~7
     secret      true = 秘传（学成时记一条【秘传】流水）
     req         学它的条件，例如 { insight:70, faceMax:25 }、{ root:80 }、{ luckMax:10 }
     nei / atkType / cost / mult / hits / cri / eff / qing
                 和「自定义普通术式」一模一样的那套字段
     desc        说明

   秘传要「半通用、有机制」：别只是数值大一点，而是给一条别处拿不到的机制
   （比如挨打时把伤害改成回血、逃跑失败反而先手）；条件也写刁一点
   —— 颜值过高、福缘过低、根骨达标但悟性不足，都行。
   ──────────────────────────────────────────────────────────── */
/*
window.JH_CUSTOM.秘术.push({
  id: "x_secret_pact", name: "薄暮之约", kind: "nei", q: 6, secret: true,
  req: { insight: 70, faceMax: 25 },
  nei: { ceEff: 0.06, def: 6 },
  desc: "教你的人先把灯吹了。他说，看得见的东西都不算约定。"
});

window.JH_CUSTOM.秘术.push({
  id: "x_secret_backlash", name: "反手", kind: "atk", q: 6, secret: true,
  req: { root: 80 }, atkType: "phy", cost: 26, mult: 2.4, hits: 1, cri: 10,
  eff: { recoil: 0.15, pierce: 0.3 },
  desc: "把挨的那一下存起来，等它自己攒够了再打出去。"
});
*/
