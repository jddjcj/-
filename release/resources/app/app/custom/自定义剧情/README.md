# 自定义剧情

自己的剧情 / 支线（并进本体的 `JH_STORY`）。格式和本体主线的一章一模一样。

## 一章怎么写

| 字段 | 说明 |
| --- | --- |
| `id` / `name` | 唯一 id（`x_` 打头）与章节名 |
| `auto` | `true` = 不需要任何条件就自己出现（一般写 `false` 或省略） |
| `cond` | 这一章出现的条件（**是 `cond`，不是 `req`**） |
| `start` | 起始节点名 |
| `nodes` | 节点表 |

`cond` 认这些键：`flag` `notFlag` `storyDone` `item` `allItems` `realm` `insight` `root` `innate` `techLv:{id,v}` `silver` `sect` `aff:{npc,v}` `done`。

## 节点怎么写

节点（`nodes` 里的一项）：

| 字段 | 说明 |
| --- | --- |
| `text` | 叙述段落数组（一段一项） |
| `choices` | 选项数组，每项 `{ label, go, req, set, give, take, exp, silver, fight, fightMul, loseGo, fleeGo, learn, item, title, note, end }` |

- `go` 指向同章的下一个节点；`fight` 是敌手 id（可以用「自定义敌人」里写的）。
- 选择项的 `req` 才叫 `req`（判定跟 `cond` 同一套键）。
- 旗标、物品这类 id 一律 `x_` 打头最保险，免得和本体撞车。
- 自定义章节**排在本体章节后面**；能不能进、什么时候进，全看你写的 `cond` 或 `auto`。

## 一条本体口径

剧情只讲故事：**不给修为、不给咒币**（`exp` / `silver` 写了也会被本体的口径盖过去，所以别指望靠剧情刷数值）。