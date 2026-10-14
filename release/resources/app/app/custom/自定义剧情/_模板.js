/* 模板 · 自定义剧情
   ────────────────────────────────────────────────────────────
   自己的剧情 / 支线，格式和本体主线的一章一模一样（进 JH_STORY）。

   用法：复制改名（别用 _ 开头），把 push 从注释里放出来改成自己的。

   ── 一章 = { id, name, cond?, auto?, start, nodes } ──
     id / name   唯一 id（x_ 打头）与章节名
     cond        这一章出现的条件（章节级叫 cond，选项里的才叫 req）
     auto        true = 不需要条件就自己出现（一般写 false 或不写）
     start       起始节点名（不写就是 a）
     nodes       节点表

   cond / req 认这些键：flag notFlag storyDone item allItems realm insight root
   innate techLv:{id,v} silver sect aff:{npc,v} done

   ── 一个节点 ──
     text      叙述段落数组（一句一个元素，一帧一帧弹出来）
     choices   选项数组，每个选项：
       label   按钮上的字
       go      去哪个节点（不写 = 这一章到此为止）
       end     true = 收束这一章（会记进 storyDone）
       defer   true = 暂且搁下（15 分钟后还能再来）
       set     记旗标，例如 { x_flag_light: true }
       give    给物品 id 数组 / item 给一件 / learn 学术式 id 数组
       take    交出东西：{ silver: 几两, item:["物品id"] }
       title   达成称号（写字符串）
       note    写一条见闻
       fight   打一场：敌手 id；输 / 逃 / 赢各有去处
       fightMul 这一场的强度倍率（可省）
       loseGo  输了去哪；fleeGo 逃了去哪；req 进这一条的条件
   ──────────────────────────────────────────────────────────── */
/*
window.JH_CUSTOM.剧情.push({
  id: "x_ch_lamp", name: "支线 · 没人添的灯", auto: false,
  cond: { storyDone: "ch1" },          // 走完第一章才出现
  start: "a",
  nodes: {
    a: { text: [
      "巷子口的灯灭了很久，灯罩上积着一层灰。",
      "你摸出火折子，凑到灯芯边上。"],
      choices: [
        { label: "把灯点上", go: "b", set: { x_flag_light: true } },
        { label: "不管它，走过去", go: "b" } ] },
    b: { text: [
      "灯亮起来那一下，巷子尽头像是有什么缩回了墙里。",
      "你站着看了一会儿，直到灯重新稳住。"],
      choices: [ { label: "继续走", end: true, title: "点灯人" } ] }
  }
});
*/
