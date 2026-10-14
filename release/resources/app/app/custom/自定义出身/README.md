# 自定义出身

「出身」是创建角色时选的那一栏（`JH_ORIGINS`）。

## 字段

| 字段 | 说明 |
| --- | --- |
| `id` / `name` | 唯一 id（`x_` 打头）与名字 |
| `tag` | 归类词（`凡俗` / `御三家` / `咒灵` …），只影响显示 |
| `slots` | 开局能带几门生得术式 |
| `ceCap` | 咒力上限系数（0~1，越大咒力池越厚） |
| `noSelect` | `true` = 不出现在选择列表里（本体「普通人家」就是这种兜底出身） |
| `growth` | 每级成长：`{ insight, root, cur, body }` |
| `init` | 开局数值：`{ curMax, phyAtk, curAtk, def, hp, luck, face, ceEff, ceCtl, silver }` |
| `desc` / `flavor` | 说明 / 一句风味话 |

想让它能选到生得术式，就在 `slots` 上给够槽位；具体挑哪几系由玩家创建角色时自己定。