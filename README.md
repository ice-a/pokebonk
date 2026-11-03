# POKÉBONK · 网页版宝可梦肉鸽

对齐 pokebonk.com 玩法的浏览器肉鸽：选人 → 选区域 → 3 区域推进 + 森林圣地终战（超梦）。
击杀升级选卡、投球捕获入队、大招蓄力、进化链、计时奖牌、生存无尽模式，全离线可玩（图源走 PokeAPI CDN）。

v3 新增：**20 张可玩角色卡 / 27 种野生宝可梦 / 72 个招式**、**PvE 与 PvP 双对战目标**（PvP 为镜像对决）、**排行榜**（结算后询问是否上传名字）。

## 分支说明与游戏模式

**两分支已合并**：`main` 即完整版（基线玩法 + AI 无限流），`ai-infinite` 保留为历史分支、不再单独维护。一次部署即含全部模式。

| 模式 | 说明 |
| --- | --- |
| 经典模式 | 区域 1→3 → 森林圣地终战；守护者配额 / 倒计时推进 |
| 生存模式 | 无限宝可梦群，每 120 秒里程碑守护者，星星沙子 +30 |
| **无限流模式** | 生存规则 + **AI 世界事件**（奇遇/灾变/天降/异变轮番登场，硅基流动驱动；未配 Key 自动降级本地事件池） |

### 对战目标：PvE / PvP

| 目标 | 说明 |
| --- | --- |
| **PvE · 宝可梦群** | 原有玩法：无限野怪潮、守护者、3 区域与森林圣地（经典模式） |
| **PvP · 镜像对决** | 1v1 回合制：对手从**排行榜里的真实玩家存档**抽取镜像（无记录时用 10 位内置挑战者）；逐回合自动结算、属性克制、按速度决定出手顺序，结束后可上传名字 |

难度决定 PvP 对手等级：普通 20 / 困难 26 / 噩梦 32。判定纯前端，离线可玩。

## Vercel 部署（约 2 分钟）

1. 打开 <https://vercel.com/new> → Import Git Repository → 选择 `ice-a/pokebonk`。
2. Framework Preset 选 **Other**；Build Command 与 Output Directory **留空**（纯静态站点，`/api` 自动识别为 Serverless Function，Node 18+）。
3. 点 **Deploy**，得到 `https://<项目名>.vercel.app`。
4. **一次部署即含全部模式**（含无限流）；任意分支每次 push 都会自动生成 Preview 部署链接。
5. **环境变量**：Settings → Environment Variables 按下表添加 → 修改后必须 **Redeploy** 才生效（Vercel 在部署时注入环境变量）。

## 环境变量（硅基流动 AI 配置）

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `SILICONFLOW_API_KEY` | ✅ | — | 硅基流动 API Key（<https://cloud.siliconflow.cn> 获取）。建议标记为 **Secret** |
| `SILICONFLOW_BASE_URL` | ❌ | `https://api.siliconflow.cn/v1` | OpenAI 兼容接口基地址 |
| `SILICONFLOW_MODEL` | ❌ | `Qwen/Qwen2.5-7B-Instruct` | 模型名，可换 `deepseek-ai/DeepSeek-V2.5` 等 |
| `AI_TEMPERATURE` | ❌ | `0.9` | 采样温度（1.1 更天马行空，0.6 更贴局势） |
| `AI_MAX_TOKENS` | ❌ | `300` | 单次生成上限 |
| `AI_EVENT_INTERVAL` | ❌ | `45` | 事件间隔秒数，随 `/api/generate` 响应下发给客户端 |

**排行榜存储（可选）**：接 Vercel KV / Upstash Redis 后成绩才跨设备持久化；不配也能用，成绩写入浏览器 localStorage 本地榜。

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `KV_REST_API_URL` | ❌ | Upstash REST 地址（Vercel KV 集成自动注入） |
| `KV_REST_API_TOKEN` | ❌ | Upstash REST Token |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | ❌ | 直接用 Upstash 时的等价变量名 |

未配置时 `/api/leaderboard` 退化为进程内内存（响应 `ephemeral: true`），前端自动与本地榜合并，功能不缺失。

未配 Key / 接口超时 / 离线时，客户端自动降级为**本地事件池**，游戏照常可玩。

## AI 无限流接口

`POST /api/generate`

```jsonc
// 请求
{ "state": { "level": 12, "kills": 230, "coins": 65, "hp": 210, "maxHp": 420,
             "mode": "survival", "area": 0, "elapsed": 300, "lastTitle": "星落商队" } }
// 响应
{ "event": { "title": "血月临空", "desc": "血月升起，受惊的宝可梦群向你涌来！",
             "effect": { "type": "wave", "value": 4 }, "danger": 4 },
  "model": "Qwen/Qwen2.5-7B-Instruct", "source": "siliconflow", "interval": 45 }
```

效果语义（服务端 `sanitize` + 客户端 `apply` 双重钳制）：`coins`(10~80₽) / `heal`(15~120 HP) / `damageAll`(80~400) / `xp`(20~150) / `wave`(2~6 只) / `blessing`(10~30%，15 秒)。

## 排行榜接口

`GET /api/leaderboard?mode=all|classic|survival|infinite|pvp&limit=50`

```jsonc
{ "ok": true, "mode": "pvp", "count": 1, "ephemeral": false,
  "entries": [
    { "name": "训练家A", "score": 1832, "mode": "pvp", "char": "gastly",
      "level": 24, "kills": 0, "elapsed": 8, "diff": "pvp", "ts": 1767000000000 }
  ] }
```

`POST /api/leaderboard` — body `{ "entries": [entry] }`（单条也接受）

- 服务端 `sanitize`：名字 1~16 字（去控制符与尖括号）、score 0~999999、mode 白名单兜底 `classic`、level 1~99；空名字或 score=0 返回 400 `bad-entry`。
- 存储：Upstash 有序集合 `pb:lb:<mode>`（`ZADD` 写入，`ZREMRANGEBYRANK` 每榜只留前 100）。
- 客户端：成功 = 远端 + 本地双写；失败或离线 = 只写本地榜并在提示里说明原因。

## Prompt

事件生成 System Prompt 全文见 [prompts/infinite.md](prompts/infinite.md)（与 `api/generate.js` 内嵌版本同步）。含输出 JSON 结构、效果区间、危险-收益对齐规则、低血量保护规则与调参建议。

## 客户端开关（浏览器 localStorage）

| 键 | 作用 |
| --- | --- |
| `pb.ai.enabled` | `'0'` 关闭 AI 事件流（默认开启） |
| `pb.ai.interval` | 事件间隔秒数（服务端 `AI_EVENT_INTERVAL` 下发值会覆盖默认） |
| `pb.ai.classic` | `'1'` 时经典/生存模式也启用 AI 事件（无限流模式恒开） |

控制台 API：`AIEvent.setEnabled(false)` / `AIEvent.setIntervalSec(20)` / `AIEvent.enableClassic(true)`。

## 本地开发

```bash
# 基线版（纯静态）
python -m http.server 8124        # http://127.0.0.1:8124/index.html

# AI 版（需要 /api 时用 Vercel CLI 本地模拟）
npm i -g vercel && vercel dev     # 读取本地 .env（参考 .env.example）

# 数据完整性 + 排行榜 API 自检（纯逻辑，不启动对局）
node tools/check-v3.js
```

> `.env.example` 由凭据栅栏保护、文件工具不读写；本地变量请直接在 `.env` 里按上表手动添加。

## 玩法速览

- **经典模式**：区域 1→3 → 森林圣地终战；每区域击杀配额或 10 分钟倒计时先到者触发守护者。
- **生存模式**：无限宝可梦群，每 120 秒一个里程碑守护者，星星沙子 +30。
- **无限流模式**：生存规则 + AI 世界事件流——奇遇（coins/heal/xp/blessing）与灾变（wave/damageAll）轮番登场，事件叙事由硅基流动实时生成。
- **PvP 镜像对决**：选「PvP · 镜像对决」进入 1v1 回合制，对手取自排行榜镜像或内置挑战者；属性克制 + 速度出手 + 24 回合上限。
- **排行榜**：结算屏与对决结束都会问「上榜吗？」——填名字即上传，不填直接跳过；入口在选人页 / 结算页 / 对决页的「🏆 排行榜」按钮。
- **角色卡**：20 张（覆盖 18 种属性），每张 4 招式（解锁 Lv.1/2/4/7）+ 被动 + 终极技 + 进化链。
- **升级**：每次升级 3 选 1 强化卡；角色 Lv.24 进化（部分支持火之石分支进化）。
- **捕获**：招球价格随通胀上涨（18→22→27…），队伍满 6 转宝可币奖励。
- **结算**：时间/击败数/伤害/积分 + 逐技能伤害条 + 图鉴新增 + 计时奖牌（银<24:00 / 金<18:00 / 冠军<13:30）。
