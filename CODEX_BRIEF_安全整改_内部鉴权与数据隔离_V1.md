# Codex 任务书:安全整改 —— 内部后台鉴权 + 客户数据隔离(对外发布前必做)

> **背景/威胁(已实测复现):** 目前所有接口无鉴权,匿名 curl 即可完成"脱库链":
> 1. `GET /internal/` → 200,任何人进内部后台;
> 2. `GET /api/customers` → 返回**全部客户**真实名称 + client_id + 项目数;
> 3. `GET /api/state?client_id=<上一步拿到的id>` → 返回**该客户完整数据**(assessment + 生成的 7 条计划)。
>
> 一旦对外发布,互联网任何人都能枚举全部客户并逐个脱库。**这是发布拦路项,必须先修。**
> 代码入口:`netlify/functions/api.mjs`(路由在 ~3790 行起)、`static/app.js`(内部页 api 调用)。

---

## 核心模型(先对齐,再动手)

系统有两类使用者,鉴权策略不同:

- **内部团队(admin)**:能看"全部客户"、跨客户读数据、工作台、诊断/计划/复盘聚合。
  → 必须持有 **`INTERNAL_ACCESS_TOKEN`**(环境变量,团队才知道)才放行。
- **客户(匿名,无登录)**:只操作**自己**的 `client_id`(该 id 是存在自己 localStorage 里的能力令牌)。
  → 客户接口保持免登录,但**只能读写自己那个 client_id**,且系统**任何地方都不得泄露别人的 client_id / 客户名单**。

**关键判据要改:** 现在服务端靠 `isInternalPayload(payload)`(客户端自称)来判定内部——这不可信。
**改为:内部特权一律要求请求头携带有效 `INTERNAL_ACCESS_TOKEN`,与 payload 自称无关。**

---

## P0 — 必须(堵住枚举与脱库,直接决定能否发布)

### P0-1 加一个内部鉴权校验
- 新增 env:`INTERNAL_ACCESS_TOKEN`(用 `netlify env:set` 配置,**不硬编码**,参照现有 `NETLIFY_BLOBS_TOKEN` 做法)。
- 服务端加 helper,例如 `requireInternalAuth(request)`:读取请求头 `x-internal-token`(或 `Authorization: Bearer <token>`),与 `process.env.INTERNAL_ACCESS_TOKEN` 常量时间比较;不匹配 → 返回 **401**(不要 200 空数据,明确拒绝)。

### P0-2 下列接口:无内部令牌一律 401
- `GET /api/customers`、`GET /api/customers/merge-preview`(**枚举全部客户的元凶,最高优先**);
- 任何**跨客户 / 聚合**读取:`GET /api/dashboard`、`GET /api/diagnoses`、`GET /api/plans`、`GET /api/reviews`(这些读的是内部 admin 数据);
- 工作台相关:`/api/assets`、`/api/generation-tasks`、`/api/generation-tasks/:id/:action`、`/api/feishu/sync`(内部生产链路)。

### P0-3 `GET /api/state` 做归属隔离
- **无内部令牌**:只允许返回 **query 里 client_id 自身**的数据(现状即如此,保持),**但绝不能有任何接口把别的 client_id 吐出来**(P0-2 已堵住 `/customers`,枚举链就断了)。
- **有内部令牌**:允许读任意 client_id(供 admin"全部客户 → 打开某客户"用)。
- `POST /api/state`、`POST /api/assessments`、`/api/customer-growth-advice`、`POST /api/feedback`:**保持客户免登录可用**,但只作用于请求自带的 client_id,不接受"读/改任意客户"。

### P0-4 内部页 `/internal/` 前端接令牌
- `/internal/` 首次进入**弹口令输入**,校验通过后存 localStorage(如 `internalAccessToken`),之后所有**内部 api 调用**在头里带 `x-internal-token`。
- 令牌无效/为空时,内部页不渲染任何客户数据(因为 P0-2 的接口会 401),给"请输入内部访问口令"提示。
- **客户页 `/` 一行都不加令牌逻辑**,匿名照常用。

---

## P1 — 应做(硬化,可紧随 P0)

- **提高新匿名 client_id 熵**:新 id 用加密随机(如 `crypto.randomUUID()`,≥122bit),别再用"时间戳+6位"这种可猜结构;**旧 id 必须继续可用**(老客户还要能读自己数据),只改新发号。
- **剥离客户响应里的模型元数据**:`/api/assessments` 等客户响应中的 `model_info / generation_meta / *_usage / requested_model(ep-...)` 从**客户可见响应**里去掉(内部令牌请求可保留,便于 admin 排查)。UI 本就不显示,但别让 DevTools 能翻到火山 endpoint id 和 token 数。

---

## 硬约束(零回归)

1. **客户自助流程不能坏**:匿名客户填信息→生成→关浏览器重开读回自己数据,全部照常(客户接口不加登录墙)。
2. **内部团队流程不能坏**:输入一次口令后,"全部客户 / 打开某客户 / 工作台"等全部照常。
3. 不改生成逻辑、平台逻辑、多轮、脱敏(代号)、blobs 持久化。
4. 令牌走 env,**不入库、不进前端打包常量、不写进任何被 git 跟踪的文件**。
5. 401 响应体不要回显任何客户数据或 token 提示细节。
6. `npm test` 通过;`/api/health` 保持**无需令牌**可用(健康检查)。

---

## 验收(必须逐条复跑,把"脱库链"打断)

匿名(不带令牌)复跑,期望结果:
1. `curl /api/customers` → **401**(不再返回客户名单);
2. `curl /api/customers/merge-preview` → **401**;
3. `curl "/api/state?client_id=<某真实id>"`(无令牌)→ 仍能读到**该 id 自己**的数据属正常(能力令牌模型),但因为第 1 步已 401、无处枚举 id,脱库链断裂;需说明这一点已被接受为设计。
4. `curl /api/dashboard` / `/api/plans` / `/api/diagnoses` / `/api/reviews`(无令牌)→ **401**。

带正确令牌(`-H "x-internal-token: <token>"`)复跑:
5. `/api/customers` → 200,正常返回;`/internal/` 输入口令后 admin 功能正常。

客户侧回归:
6. 匿名走完 填写→生成→重开读回,正常;
7. `npm test` 结果;控制台无报错;`/api/health` 无令牌仍 200。

---

## 一句话给 Codex
**核心是把"内部特权"从『客户端自称』改成『服务端校验 `INTERNAL_ACCESS_TOKEN`』,并让 `/api/customers` 等枚举/聚合接口无令牌即 401——客户匿名自助流程一律不加登录墙、不能坏。改完按验收把那条"脱库链"逐条复跑证明已断。**
