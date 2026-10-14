/* 模板 · 自定义图片（这份文件本身只是说明，不会被当成代码执行）
   ────────────────────────────────────────────────────────────────────
   这个文件夹是给玩家放图片素材的抽屉：立绘、头像、自定义面板底图，
   以及「图片替换」那四类画面。丢进来就行 —— 本体不自带任何图片。

   认的后缀：.png .jpg .jpeg .gif .webp .bmp .svg（别的忽略）

   ══ 路子一：文件名自动挂（丢进来就生效，一个字都不用写）══
     前缀__槽位名.后缀
       battle__default.png          打斗画面：默认背景
       battle__sc_home.png          打斗画面：只在某一处场景里用（场景 id）
       actor__hero.png              人物建模：我方（通用）
       actor__foe.png               人物建模：敌方（通用）
       actor__f_b_kyo.png           人物建模：某一个敌人 id
       actor__o_sukuna.png          人物建模：我方某一个出身 id
       fx__default.png              术式特效：没有更具体的时候用这张
       fx__k_punch.png              术式特效：某一门术式（术式 id）
       fx__t_csm.png                术式特效：某一系生得术式（生得术式 id）
       fx__domain.png               领域展开：所有领域
       fx__domain.infoOverload.png  领域展开：某一种领域（用 domKind）
       battle__dom.infoOverload.png 领域换底：某个领域（谁那方领域血厚就显示谁的）
       battle__dom.hero.png         领域换底：固定我方 / battle__dom.foe.png 固定敌方
       fx__summon.png               召唤登场 / 驱使
       fx__phy.png / fx__bf.png     普通攻击 / 黑闪
       map__default.png             大地图背景：默认
       map__rg_nordic.png           大地图背景：某一座大地图（大地图 id）
     槽位名大小写不敏感；同一个槽位放多张，按文件名排序取第一张。

   ══ 路子二：在自定义脚本里手动绑（比文件名更准）══
     在别的自定义夹里写 .js：
       JH_IMGC_bind('actor', 'foe', 'my_boss.png');   // 大类 / 槽位名 / 图片
       JH_IMGC_bind('fx', 'skill.k_punch', 'punch.png');
       JH_IMGC_unbind('actor', 'foe');                // 解绑 → 回到原来那张 / 纯 CSS

   取路径（给自定义脚本用）：
       JH_IMG('my_hero.png')                    → 'custom/自定义图片/my_hero.png'
       JH_IMGC.url('fx', 'skill.k_punch')       → 该槽位的路径，或空串
       window.JH_IMGC.entries()                 → 现在实际生效的槽位清单

   为什么不在这里 push 模板：图片不是 .js，装载器不会拿它当代码执行；
   写坏了最多是那张图显示不出来，不会影响别的东西。
   ──────────────────────────────────────────────────────────────────── */
