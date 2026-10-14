/* 模板 · 扩展地图
   ────────────────────────────────────────────────────────────
   这个文件夹放「新的大地图 / 新场景 / 新房间」。本体自己的地图在
   app/base/地图/地图.json，这里加的会和它并在一起。

   用法：复制这份文件 → 改名（别用 _ 开头）→ 把下面 push 外面的注释去掉，
        改成自己的内容。整份模板本身什么也不做。

   一份可以只带 scene / room / region 里的任意一个：
     scene  一个场景（舆图上的一处地名）
     room   一间屋子（场景里的落脚点）
     region 一座大地图（舆图上方那排切换按钮里的一座）

   ── scene 字段 ──
     id        唯一 id（x_ 打头最保险）
     name      场景名（舆图上那个标签）
     glyph     舆图圆点里显示的那个字（一个字最好）
     tone      圆点边上的墨色，#rrggbb
     x / y     在底板上的位置（百分位，x 8~92、y 8~92）
     region    属于哪座大地图（不写就归本体第一座「本州」）
     desc      说明（点开地名时显示的那句）
     unlock    解锁条件 { realm, insight, flag, story }；空 {} = 一开始就能去
     hidden    true = 先不出现（要旗标才露头）

   ── room 字段 ──
     id / name / scene  唯一 id、屋子名、属于哪个场景
     desc               说明
     actions            能做的事：gather 采药 / fish 垂钓 / work 做工 / forge 打铁 /
                        craft 制器 / brew 看火 / read 读书 / weave 纺织 / drink 小酌 /
                        listen 聆听 / pray 参拜（rest、meditate 处处可做，不用写）
     search             搜寻表：[{ w:权重, item:"物品id", n:数量, silver:几枚钱,
                         text:"这句话", flag:"旗标id", flagText:"拿到旗标时那句话" }]
     shop               货架：[[物品id, 价钱]]（写 "__ALL__" = 什么都卖，只给测试出身）
     sell               true = 能把东西卖给这间屋
     npc / npcs         站在这儿的 npc：单个 id 或 id 数组（要在「自定义npc」里写好）
     start              true = 一个场景的落脚点（一个场景挑一间写就行）

   ── region 字段 ──
     id / name  唯一 id 与名字（「北欧」这种）
     glyph      切换按钮上那个字
     land       底图形状：main 陆地 / fjord 峡湾（写别的会落回 main）
     tone       这一座的主色 #rrggbb
     desc       说明
     unlock     进这一座的条件（同 scene.unlock）
     entry      x / y：从别的大地图「远渡」过来时，小人是从这个点进场的

   赶路花多久：同一座大地图里 8 秒，跨大地图 10 分钟；测试出身一律 3 秒。
   ──────────────────────────────────────────────────────────── */
/*
window.JH_CUSTOM.地图.push({

  // ① 新加一座大地图（也可以不加：只往本体现有的「本州」里塞场景）
  region: {
    id: "x_rg_marsh", name: "泽国", glyph: "泽",
    land: "fjord",            // main 陆地 / fjord 峡湾
    tone: "#6f8f7a",
    desc: "水多，路少。走一步要探一下深浅。",
    unlock: { realm: 2 },     // 境界 2 才去得了；测试出身不看这个
    entry: { x: 10, y: 88 }   // 从别处远渡过来时的入场点
  },

  // ② 一个场景（舆图上一处地名）
  scene: {
    id: "x_map_marsh", name: "沼", glyph: "沼", tone: "#6f8f7a",
    x: 44, y: 30,             // 底板上的百分位坐标
    region: "x_rg_marsh",     // 归到上面那座大地图；不写就归「本州」
    desc: "水面上浮着一层油似的东西，踩上去会响。",
    unlock: { realm: 2 }      // 进这个场景的条件
  },

  // ③ 这个场景里的第一间屋（一个场景至少得有一间，写 start: true）
  room: {
    id: "x_r_marsh_walk", name: "沼边小径", scene: "x_map_marsh",
    start: true,                        // 落脚点
    actions: ["gather", "fish", "pray"],// 这间屋能做的事
    desc: "一条只够一个人走的土埂。两边是水，水里没有倒影。",
    search: [
      { w: 40, item: "mat_herb", n: 1, text: "埂边的草叶上挂着水，摘下来是苦的。" },
      { w: 25, silver: 12, text: "泥里亮了一下，是半枚硬币。" },
      { w: 20, flag: "x_flag_marsh", flagText: "你记下了这片水的位置。", text: "水底闪过一片东西，没看清。" },
      { w: 15, text: "水面上没有你的倒影。你多看了两眼。" }
    ],
    npc: "x_npc_lamplighter"            // 站在这儿的 npc（要在「自定义npc」里写）
  }
});
*/
