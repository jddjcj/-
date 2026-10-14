# 扩展地图

新场景、新房间、**新的大地图**都放这里。**镜屋就在这里**（本体房间表现在在
`app/base/地图/地图.json`，镜屋是当初按用户要求搬过来的）。

## 大地图（region）

舆图（山河舆图）上方那排切换按钮，一座大地图一个。现在本体有两座：
**本州**（15 处地名，没写 `region` 的场景都归它）和 **北欧**（4 处，要境界 3 才去得了）。

```js
{ id:"x_rg_marsh", name:"泽国", glyph:"泽", land:"fjord", tone:"#6f8f7a",
  desc:"水多，路少。", unlock:{ realm:2 }, entry:{ x:10, y:88 } }
```

| 字段 | 说明 |
| --- | --- |
| `id` / `name` / `glyph` | 唯一 id（`x_` 打头）、名字、切换按钮上那个字 |
| `land` | 底图形状：`main` 陆地 / `fjord` 峡湾（写别的会落回 main） |
| `tone` | 这一座的主色（`#rrggbb`） |
| `desc` | 说明 |
| `unlock` | 进这一座的条件：`{ realm, insight, flag, story }`（可任意组合） |
| `entry` | `x` / `y`：从别的大地图「远渡」过来时，小人从这个点进场 |

写法：`window.JH_CUSTOM.地图.push({ region: { … } });`
场景那边写 `region:"x_rg_marsh"` 就归到这座；不写就归本体第一座（本州）。

**赶路花多久**：同一座大地图里 8 秒；跨大地图 10 分钟；测试出身一律 3 秒。

## 场景（scene）

```js
{ id:"x_map_marsh", name:"沼", glyph:"沼", tone:"#6f8f7a", x:44, y:30,
  desc:"水面上浮着一层油似的东西。", unlock:{ realm:2 } }
```

| 字段 | 说明 |
| --- | --- |
| `id` / `name` / `glyph` | 唯一 id（`x_` 打头）、名字、舆图上的那个字 |
| `tone` | 舆图上的墨色（`#rrggbb`） |
| `x` / `y` | 舆图底板上点的位置（百分位：x 10~90，y 8~88） |
| `region` | 归到哪座大地图（`region.id`）；不写就归本体第一座（本州） |
| `desc` | 说明 |
| `unlock` | 解锁条件：`{ realm, insight, flag, story }`（可任意组合，空对象就是一开始就能去） |

## 房间（room）

```js
{ id:"x_r_marsh_walk", name:"沼边小径", scene:"x_map_marsh", actions:["gather","fish"],
  desc:"……", search:[ { w:40, item:"mat_herb", n:1, text:"……" }, { w:60, text:"……" } ] }
```

| 字段 | 说明 |
| --- | --- |
| `id` / `name` / `scene` | 唯一 id、名字、属于哪个场景 |
| `desc` | 说明 |
| `actions` | 这间屋子能做的事：`gather` 采药 / `fish` 垂钓 / `work` 做工 / `forge` 打铁 / `craft` 制器 / `brew` 看火 / `read` 读书 / `weave` 纺织 / `drink` 小酌 / `listen` 聆听 / `pray` 参拜（`rest` `meditate` 处处可做，不用写） |
| `search` | 搜寻表：每条 `{ w:权重, item:"物品id"(可省), n:数量(可省), silver:币(可省), flag:旗标(可省), flagText:拿到旗标那句话(可省), text:"这句话" }` |
| `shop` | 货架：`[[物品id, 价钱]]`；写 `"__ALL__"` 就是「什么都卖」（本体测试商店用） |
| `sell` | `true` = 能卖东西给这间屋子 |
| `npc` / `npcs` | 站在这里的 npc：单个 id 或 id 数组 |
| `start` | `true` = 一个场景的落脚点 |

## 写法

```js
window.JH_CUSTOM.地图.push({ scene: { … } });          // 加一个场景
window.JH_CUSTOM.地图.push({ room: { … } });           // 加一间房
window.JH_CUSTOM.地图.push({ scene: {…}, room: {…} }); // 一次加一套
```

房间里想放自定义 npc，就在 `npc` 里写上它的 id，同时那个 npc 要在
「自定义npc」文件夹里定义好（两边都写才认）。