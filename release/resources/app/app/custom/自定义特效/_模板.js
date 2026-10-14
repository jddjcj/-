/* 模板 · 自定义特效（技能演出：代码 + 图片）
   ────────────────────────────────────────────────────────────
   在这里写你自己的一门术式 / 一系生得术式 / 一个领域 / 一类动作的演出。
   一份配方 = 「一段 HTML 代码」+「若干张图（放『自定义图片』里）」+「这段代码要的 CSS」，
   三者可以只用其中任意几样（只写图片也行，只写代码也行）。

   优先级：有配方就整段用配方，本体原本的墨戏不再画；一个技能没配方时，
   才去看「自定义图片」里 fx__ 那张静态图（fx__<术式id>.png）；都没有才用本体的墨戏。

   ── 用法 ──
     复制本文件、改名（别用 _ 开头），把下面 window.JH_CUSTOM.特效.push({...}) 从注释里放出来改成自己的。

   ── match：这条配方什么时候用（任填其一或组合；一条都不写 = 兜底，最后才轮到它）──
     skill   某一门术式 id（JH_MARTIAL 里的 id，如 "k_punch"）
     innate  某一系生得术式 id（JH_INNATE 里的 id，如 "t_csm"）
     dom     某个领域的 domKind（如 "infoOverload" / "openBarrier" / "shadowSwarm" …）
     kind    动作类别：bf（黑闪）/ phy（普通攻击）/ ink（术式）/ summon（召唤登场）/ domain（领域展开）
     id      术式 id 或生得术式 id 都认（图省事用）
   一个技能只会命中一条：越具体的越优先（skill/id > innate > dom > kind > 空）。

   ── code：代码部分（HTML 字符串）──
     可以用本体已有的 class（.ink / .ink-skill / .ink-ring / .inklabel …），
     也可以用下面的 css 自己定义一套。

   ── imgs：图片部分（可写字符串，也可写对象）──
     'punch.png'                        放到「自定义图片」夹里的文件名
     { file:'punch.png', size:'40%', left:'60%', top:'30%', pos:'50% 50%', delay:120, plain:false }
       size   宽度（如 '40%' / '320px'）；只给宽度，高度按比例自适应
       left / top   图片中心的位置（默认正中央 50% / 50%）
       pos    图片在框里的 object-position（默认居中）
       delay  这张图晚多少毫秒出现
       plain  true = 这张图不抠底（默认会自动抠掉连着边缘的纯色底）
     图片默认居中、等比缩放、最大不超过整框 —— 多大的图都不会撑破版面。

   ── css：给这段代码补的样式（可选）──
     会被注入一次（全局），所以 class 名自己起得独特点，别和本体撞车。

   ── delay：整段演出延后多少毫秒（可选）──
   ──────────────────────────────────────────────────────────── */
/*
window.JH_CUSTOM.特效.push({
  match: { skill: "k_punch" },
  code: '<div class="my-punch-ink"></div><div class="my-punch-shock"></div>',
  imgs: [ { file: "punch_fist.png", size: "46%", left: "62%", top: "48%", delay: 80 } ],
  css: '.my-punch-ink{position:absolute;inset:0;background:radial-gradient(circle at 62% 48%, rgba(255,240,210,.35), transparent 62%);animation:inkFade .9s ease both}'
       + '.my-punch-shock{position:absolute;left:50%;top:50%;width:34%;height:34%;margin:-17% 0 0 -17%;border:2px solid rgba(255,236,196,.6);border-radius:50%;animation:inkRing .8s ease-out both}',
  delay: 0
});

// 只写图片也行（等于给这门术式换一张自己的图，比 fx__ 更精确）
window.JH_CUSTOM.特效.push({
  match: { innate: "t_csm" },
  imgs: ["csm_summon.png"]
});
*/