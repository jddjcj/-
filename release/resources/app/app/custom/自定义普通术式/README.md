# 自定义普通术式

一切「能学、能加点」的术式都在这里（`JH_MARTIAL`）—— 主动、内功、身法、被动，
以及生得术式的衍生技能。

## 四种 kind

| `kind` | 是什么 | 靠哪些字段 |
| --- | --- | --- |
| `atk` | 攻击术式（物理 / 咒力） | `atkType` `cost` `mult` `hits` `cri` `eff` |
| `nei` | 内功，学了永久加属性 | `nei:{ curMax, ceEff, ceCtl, insight, root … }` |
| `qing` | 身法，加闪避 / 逃跑 / 先手 | `qing:{ dodge, esc, ceCtl, phyAtk … }` |
| `passive` | 被动，不能主动打出 | 只写 `passive` 说明；机制要动本体 |

## 通用字段

| 字段 | 说明 |
| --- | --- |
| `id` / `name` | 唯一 id（`x_` 打头）与名字 |
| `q` | 品质 1~7，同时决定冷却长短（越强越久） |
| `common` | `true` = 「普通术式」，各组织默认都能教（见「自定义组织」） |
| `innate` | 属于哪一系生得术式；写了才算那一系的衍生技能 |
| `lv` | 解锁等级（按那一系的等级） |
| `atkType` | `phy` 物理 / `cur` 咒力 |
| `cost` | 咒力消耗 |
| `mult` / `hits` / `cri` | 倍率 / 段数 / 暴击加成 |
| `eff` | 机制块，见下 |
| `desc` | 说明 |

## `eff` 能写的机制（与本体共用一套）

`hpCost`（以自身气血为代价）`pierce`（无视防御）`trueDamage`（真伤）`lifesteal`（吸血）
`drain`（抽咒力）`defDown`（削防）`stun`（钉住 n 回合）`weak`（降攻）`dot`（蚀）
`recoil`（反噬）`heal`（回血）`shield`（护盾）`summon`（召唤）……

召唤系（十种影法术 / 咒灵操术这类）的本体写法在 `app/base/术式机制/术式机制.json` 的 `JH_MECH`，
照抄着改最稳。