# 自定义npc

世界里的活人（进 `JH_NPCS`）：能聊天、能送礼、能派任务、**能教秘术**。

## 字段

| 字段 | 说明 |
| --- | --- |
| `id` / `name` / `title` | 唯一 id、名字、头衔（显示在名字下面） |
| `scene` / `room` | 站在哪个场景、哪个房间（**房间的 `npc`/`npcs` 里也要写上他**） |
| `desc` | 说明 |
| `talk` | 闲聊台词数组（每天一次对话会给好感） |
| `gift` | 送礼偏好：`{ love:[物品id], like:[...], hate:[...] }` |
| `task` | 委托：`{ id, name, item, count, reward:{ silver, item } }` |
| `teach` | 能教什么：`{ skill:"术式id", aff:好感下限, task:"要先完成的主线id", secret:true }` |
| `hide` | `true` = 先不出现（要旗标才露头） |

## 和「自定义秘术」怎么联动

「自定义秘术」文件夹里写一条带 `secret:true` 与 `req:{...}` 的术式，
这里的 `teach.skill` 指向它 —— 门槛两条都要过：**好感够（`aff`）+ 你这个人符合它的条件（`req`）**。
`task` 可选：要先替他办成一件事，他才肯教。