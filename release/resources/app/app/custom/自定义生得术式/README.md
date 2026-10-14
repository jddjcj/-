# 自定义生得术式

「生得术式」是天生的那一系术式（`app/base/生得术式/生得术式.json` 里的 `JH_INNATE`）。
每一系下面挂一串衍生技能（那些技能写在「自定义普通术式」里，用 `innate` 指回来）。

## 字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | ✓ | 唯一 id，建议 `x_` 打头 |
| `name` | ✓ | 术式名 |
| `q` | ✓ | 品质 1~7 |
| `element` | | 属性，纯文字（`空间` / `影` / `血` / `言` …） |
| `passive` | | 被动说明（一句话，写清机制） |
| `desc` | | 图鉴里的说明文字 |
| `skills` | | 这一系的衍生技能 id 数组 |
| `domain` | | 领域展开那个术式的 id（写在「自定义普通术式」里，见下） |
| `blockCost` | | 每次格挡消耗的咒力（只有带格挡被动的系才要） |

## 领域展开怎么写

领域也是 `JH_MARTIAL` 里的一条术式，只是多了 `domain:true` 与 `domKind`：

```js
{ id:"x_dom_mine", name:"领域展开·我的领域", kind:"atk", q:7, innate:"x_my_innate", lv:8,
  domain:true, domKind:"infoOverload", atkType:"cur", cost:130, mult:5.0, hits:1, cri:20,
  eff:{ stun:2, trueDamage:0.25 },
  desc:"……" }
```

`domKind` 决定用哪一套水墨演出（每个领域一套专属动作与主色）。现成的取值：

`infoOverload` `openBarrier` `shadowSwarm` `soulTrue` `bloodPrice` `command` `weakPoint`
`turretShield` `craftRandom` `position` `frameLock` `warehouse` `slotJackpot` `debuffSwarm`

（写别的值也能开，只是会落到默认那套墨戏上。要加新的一套，得改本体 `app/js/ui.js`。）