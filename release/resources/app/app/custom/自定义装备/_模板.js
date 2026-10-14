/* 模板 · 自定义装备
   ────────────────────────────────────────────────────────────
   兵器 / 护具 / 配饰 / 靴子（进 JH_ITEMS，靠 type 分栏）。装备一律不堆叠。

   用法：复制改名（别用 _ 开头），把 push 从注释里放出来改成自己的。

   ── 字段 ──
     id / name   唯一 id（x_ 打头）与名字
     type        weapon 兵器 / armor 护具 / charm 配饰 / boots 靴子
     q           品质 1~7
     price       售价（商店买、当铺卖都用它）
     stack       装备一律写 1（装备不堆叠）
     stats       加成：{ phyAtk, curAtk, def, dodge, curMax, hp, crit, esc … }
     desc        说明

   跟「自定义咒具词条」怎么联动：装备本身不带词条 —— 得先把它咒具化
   （本体锻冶页，需要某一类特殊出身），再到锻冶页抽词条，抽的就是那个池子。
   所以：这里定义「能被咒具化、能刻词条的东西」，那里定义「能刻上去的机制」。
   一件咒具最多刻 3 条（强化到 +3 / +6 / +9 各开一槽）。
   ──────────────────────────────────────────────────────────── */
/*
window.JH_CUSTOM.装备.push({
  id: "x_wp_inked", name: "墨刀", type: "weapon", q: 4, price: 520, stack: 1,
  stats: { phyAtk: 22, crit: 4 },
  desc: "刀身上一道一道的，看着像字，其实是谁的牙印。"
});

window.JH_CUSTOM.装备.push({
  id: "x_bt_straw", name: "草履", type: "boots", q: 2, price: 120, stack: 1,
  stats: { dodge: 8, esc: 0.05 },
  desc: "走山路用的。踩在影子上不响。"
});
*/
