/* 模板 · 自定义组织
   ────────────────────────────────────────────────────────────
   组织（进 JH_SECTS）：自己的势力、自己的成员、自己的特有术式。

   用法：复制改名（别用 _ 开头），把 push 从注释里放出来改成自己的。

   ── 字段 ──
     id / name   唯一 id（x_ 打头）与名字
     align / color  正 / 中 / 邪，与显示色
     desc        说明
     req         加入条件：{ insight, root, realm, flag }
     master      负责人（求教用，写个名字）
     hidden      true = 要相应旗标才露面
     skills      这个组织特有的术式 id（写在「自定义普通术式」或「自定义秘术」里）
     shop        贡献兑换表：[[物品或技能 id, 贡献价]]
     daily       每日事务的一句话说明
     members     组织成员（npc id 数组）—— 每日对练就是和他们练
     allCommon   true（默认）= 这个组织默认能教所有普通术式；写 false 关掉

   ── 两条默认规矩 ──
   1) 所有组织默认可以学习所有普通术式：不写 allCommon 也行，装载器会把这组织该教的
      （JH_COMMON_ALL 里那批 common:true 的术式）自动补进 shop，价钱按本体常规价位。
      要按自己的价钱来，就自己在 shop 里写一遍（写了就不重复补）。
   2) members 里的人会跟着组织走：退出组织时，这些人里好感为正的会被一并清零
      （同门的情分断起来是断干净的）；一个角色一生最多加入 3 个组织。

   ── 成员怎么写 ──
   成员必须是「自定义npc」文件夹里存在的 npc id。每日对练会从里面随机刷人
   （最少 1 个、最多 4 个，每人每天陪练 3 次）。
   ──────────────────────────────────────────────────────────── */
/*
window.JH_CUSTOM.组织.push({
  id: "x_sect_lamplight", name: "点灯人", align: "中", color: "#8f8f6a",
  desc: "不挂招牌的一群人。他们只做一件事：让该亮的地方亮着。",
  req: { insight: 55, realm: 2 },
  master: "提灯的老者",
  skills: ["x_secret_pact"],
  shop: [["mat_ink", 40], ["x_pill_ink", 120], ["x_secret_pact", 300]],
  daily: "巡街、添灯油、把不该灭的灯记在本子上，得贡献 7。",
  members: ["x_npc_lamplighter"]
});
*/
