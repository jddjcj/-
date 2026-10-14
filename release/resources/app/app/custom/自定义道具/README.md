# 自定义道具

药品 / 食物 / 酒水 / 材料 / 书 / 任务物（进 `JH_ITEMS`，靠 `type` 分栏）。

| `type` | 是什么 | 关键字段 |
| --- | --- | --- |
| `pill` | 药 | `effect` |
| `food` / `drink` | 吃的、喝的 | `effect` |
| `mat` | 材料（锻造、任务用） | 无 |
| `book` | 书，用了学会一门术式 | `learn:"技能id"` |
| `quest` | 任务物，卖不掉 | 无 |

## 字段

| 字段 | 说明 |
| --- | --- |
| `id` / `name` | 唯一 id（`x_` 打头）与名字 |
| `q` | 品质 1~7 |
| `price` | 售价 |
| `stack` | 一叠最多几个（材料 99、装备 1） |
| `desc` | 说明 |
| `effect` | 吃 / 用的效果，见下 |

## `effect` 能写什么

- `cur` / `hp`：回咒力 / 回气血（数值）
- `curFull` / `hpFull`：`true` = 直接回满
- `exp`：加修为
- `attr`：永久加属性，例如 `{ insight: 1 }`
- `cure`：`true` = 解咒毒
- `buff`：战斗里用的临时增益，例如 `{ curAtk: 0.35, turns: 4 }` 或 `{ weak: 3 }`