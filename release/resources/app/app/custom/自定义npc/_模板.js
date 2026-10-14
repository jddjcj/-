/* 模板 · 自定义npc
   ────────────────────────────────────────────────────────────
   世界里的活人（进 JH_NPCS）：能聊天、能收礼、能派任务、能教秘术。
   写在「扩展地图」的房间 npc/npcs 里，人才会真的站在那间屋。

   用法：复制改名（别用 _ 开头），把 push 从注释里放出来改成自己的。

   ── 字段 ──
     id / name / title   唯一 id、名字、头衔（显示在名字下面那行小字）
     scene / room        站在哪个场景、哪间屋（房间那边也要写上这个 id，两边都对才认）
     desc                说明
     talk                闲聊台词数组（每天一次对话会给好感）
     gift                收礼偏好：{ love:[物品id], like:[...], hate:[...] }
     task                委托：{ id, name, item:"要的东西", count:几件,
                                 reward:{ silver:几两, item:"给的东西" } }
     teach               教什么：{ skill:"术式id", aff:好感下限, task:"先完成的主线id", secret:true }
     hide                true = 先不出现（要旗标才露头）

   和「自定义秘术」怎么联动：那边写一条 secret:true 的术式，这边 teach.skill 指向它；
   两个门槛都要过 —— 好感够（aff）+ 你这个人符合它的 req。task 可省。
   ──────────────────────────────────────────────────────────── */
/*
window.JH_CUSTOM.npc.push({
  id: "x_npc_lamplighter", name: "点灯的人", title: "后巷",
  scene: "sc_shibuya", room: "r_sb_alley",
  desc: "天还没黑，他已经开始点灯了。每一盏都要看上很久。",
  talk: [
    "灯亮着，路就不算没人走。",
    "你身上的影子比别人的沉。",
    "别站太近，灯油贵。"
  ],
  gift: { love: ["mat_ink"], like: ["food_onigiri"], hate: ["mat_venom"] },
  task: { id: "x_t_lamp", name: "凑灯油", item: "mat_ink", count: 5,
          reward: { silver: 300, item: "mat_paper" } },
  teach: { skill: "x_secret_pact", aff: 70, secret: true }
});
*/
