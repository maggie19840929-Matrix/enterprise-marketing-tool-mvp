# 企业营销增长工具 MVP

当前线上/内测版：`static/` 原生前端 SPA + `netlify/functions/api.mjs` 单个 Netlify Function，用于展示营销体检、自动诊断、7天计划、反馈回填、周复盘闭环，以及内部对标内容洞察和项目化素材生成与验收工作台。

早期 Python/SQLite 版本已废弃，仅保留历史说明，不作为当前线上架构参考。

## 启动

```bash
cd /Users/matrix_core/enterprise-marketing-tool-mvp
npm install
npm run dev
```

打开：<http://127.0.0.1:8888>

## 已包含模块

1. 客户版 3 个必填信息 + 可选补充的轻量录入
2. 生成前客户共创确认，选择本周优先内容方向和不想发的内容
3. 自动营销诊断与内容方向建议
4. 首轮 7 天内容计划
5. 发布后效果记录与客户观察标签
6. 下一轮 7 天计划生成与一键启用
7. 内容周期历史区，支持查看第 N 轮与已归档轮次
8. 客户公开页数据云端同步，用于内部端查看和行业样本沉淀
9. 内部端全部客户聚合、项目复盘、对标内容洞察、素材生成与 QA 交付工作台

## 数据库

当前线上版本不使用 SQLite。生产环境优先使用 Netlify Blobs 保存项目态；无 Blobs 环境时，Netlify Function 会降级为内存 fallback 以便本地 smoke test。

主要 store：

- `enterprise-marketing-tool-state`：客户项目、内容计划、反馈记录、生成任务、素材登记等状态。
- `global-project-store.<clientId>`：按客户/内部视图分隔的项目状态。
- `assets/<client_id>`：内部素材工作台素材集合。
- `tasks/<client_id>`：内部生成任务集合。
- `benchmark-profiles/<client_id>`：项目内对标账号集合。
- `benchmark-contents/<client_id>`：代表内容、公开指标和证据集合。
- `benchmark-insights/<client_id>`：模型洞察与人工审核结果集合。
- `benchmark-jobs/<client_id>`：异步洞察任务集合。
- `delivery-projects/<client_id>`：交付项目及其交付模板。
- `delivery-cycles/<client_id>`：按周推进的交付周期。
- `collaboration-tasks/<client_id>`：内部、客户与外包协作任务。
- `collaboration-approvals/<client_id>`：技术审核、内部 QA 与客户确认记录。
- `shooting-schedules/<client_id>`：现场拍摄时段与素材清单。
- `weekly-reports/<client_id>`：项目周报结构化记录。
- `delivery-feishu-bindings/<client_id>`：项目与飞书工作区/表格的绑定关系。

## API

- `GET /api/health`
- `POST /api/assessments`
- `POST /api/customer-growth-advice`
- `GET /api/state`
- `POST /api/state`
- `POST /api/auth/email/start`
- `POST /api/auth/email/verify`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/account/link-client`
- `GET /api/account/projects`
- `GET /api/customers?mode=internal`
- `GET /api/customers/merge-preview?mode=internal`
- `GET /api/assets?client_id&project_id`
- `POST /api/assets`
- `GET /api/generation-tasks?client_id&project_id&view=internal|client`
- `GET /api/generation-tasks/:id`
- `POST /api/generation-tasks`
- `POST /api/generation-tasks/:id/submit`
- `POST /api/generation-tasks/:id/poll`
- `POST /api/generation-tasks/:id/qa`
- `POST /api/generation-tasks/:id/deliver`
- `GET|POST /api/benchmark-profiles`
- `PATCH /api/benchmark-profiles/:id`
- `GET|POST /api/benchmark-contents`
- `PATCH /api/benchmark-contents/:id`
- `GET|POST /api/benchmark-jobs`
- `GET /api/benchmark-jobs/:id`
- `GET /api/benchmark-insights`
- `PATCH /api/benchmark-insights/:id/review`
- `POST /api/benchmark-insights/:id/test-plan`
- `POST /api/feishu/sync`
- `GET /api/delivery-profiles`
- `GET|POST /api/delivery-projects`
- `GET|POST /api/delivery-cycles`
- `GET|POST /api/collaboration-tasks`
- `GET|POST /api/collaboration-approvals`
- `GET|POST /api/shooting-schedules`
- `GET|POST /api/weekly-reports`

### 可选账号与跨设备找回

- 客户无需登录即可继续使用原有流程；邮箱账号只用于主动绑定和跨设备找回项目。
- 客户页「账号与项目」通过邮箱验证码建立 HttpOnly 会话，可绑定当前已生成项目，并打开账号自身已绑定的云端项目。
- 新设备读取项目时，服务端会校验账号会话与客户桶绑定关系；未绑定的 `client_id` 不可读取。
- 生产环境需配置 `ACCOUNT_AUTH_ENABLED=true`、`ACCOUNT_AUTH_SECRET`、`EMAIL_PROVIDER=resend`、`RESEND_API_KEY` 与 `EMAIL_FROM`。
- `GET|POST /api/delivery-feishu-bindings`
- `PATCH /api/<上述协同资源>/:id`

## 验证

```bash
npm test
node --check static/app.js
node --check netlify/functions/api.mjs
curl -s http://127.0.0.1:8888/api/health
```

## Netlify

`netlify.toml` 已配置：

- Publish directory: `static`
- API rewrite: `/api/*` → `netlify/functions/api.mjs`

Netlify Function 在生产环境优先使用 Netlify Blobs 保存项目态；无 Blobs 环境时自动降级为内存 fallback，便于本地验证。

### 内部访问鉴权

内部后台和跨客户/聚合接口必须在 Netlify 环境变量中配置：

```bash
INTERNAL_ACCESS_TOKEN=团队内部使用的高强度随机口令
```

`/internal/` 首次进入会要求输入该口令，验证通过后浏览器仅在本站 localStorage 保存口令，并在内部请求头中发送 `x-internal-token`。服务端也兼容 `Authorization: Bearer <token>`。未配置环境变量、未携带口令或口令错误时，内部接口统一返回 401；URL 的 `mode=internal`、`client_id=internal` 或 payload 自称均不能授予内部权限。

客户根路径 `/` 不发送内部令牌，匿名自助流程仍按浏览器保存的高熵 `client_id` 读写自己的项目。`/api/health` 保持公开。

### P0 成本保护与漏斗埋点

内容计划与下一轮建议使用独立的 `metering/v1`、`analytics/v1` Blobs 命名空间，不修改现有 `global-project-store.*` 客户数据。建议在 Netlify 生产环境配置：

```bash
SAFE_TO_RUN=true
RATE_LIMIT_ENFORCE=false
CUSTOMER_LEGACY_CLAIM_UNTIL=2026-09-30T15:59:59.999Z
GENERATION_RATE_WINDOW_SECONDS=60
GENERATION_RATE_CLIENT_MAX=3
GENERATION_RATE_IP_MAX=10
GENERATION_DAILY_CLIENT_MAX=30
TRACKING_ENABLED=true
TRACKING_RETENTION_DAYS=90
METERING_HASH_SECRET=至少32字节的随机服务端密钥
```

`RATE_LIMIT_ENFORCE=false` 是首发影子模式：达到阈值时写入计量和漏斗记录，但不阻断请求。观察真实试用一至两天后，人工改成 `true` 才会返回 `429` 和“生成太频繁，稍等片刻再试”。同一个 `request_id` 会复用同一 reservation 与任务，不因网络重试重复计量。

`CUSTOMER_LEGACY_CLAIM_UNTIL` 控制旧浏览器项目认领的迁移截止时间（ISO 8601）。迁移完成后应改为 `disabled` 或过期时间，彻底关闭可推导的旧 proof 路径。

`SAFE_TO_RUN` 是所有真实付费模型调用的总闸。生产部署代码与 `SAFE_TO_RUN=true` 必须同步完成；关闭时客户仍会获得规则兜底结果，但不会发起真实模型请求。`GET /api/analytics/funnel` 仅允许携带 `INTERNAL_ACCESS_TOKEN` 的内部请求读取聚合计数，公开端不能枚举事件。

`/api/assessments` 已改为内部令牌专用。公开客户流程只通过异步 `/api/plan-jobs` 生成内容计划。

### P1a 账号与跨端找回地基

账号功能默认关闭，不影响匿名客户继续使用。启用邮箱验证码前，需要在 Netlify 配置：

```bash
ACCOUNT_AUTH_ENABLED=true
ACCOUNT_AUTH_SECRET=至少32字节的独立高强度随机密钥
ACCOUNT_EMAIL_RESEND_SECONDS=60
ACCOUNT_EMAIL_DAILY_IP_MAX=20
EMAIL_PROVIDER=resend
RESEND_API_KEY=邮件服务商服务端密钥
EMAIL_FROM=已验证发件域名下的发件地址
```

账号会话使用同源 `HttpOnly + Secure + SameSite=Lax` Cookie。邮箱只在发送验证码时短暂使用，Blobs 仅保存加密摘要；验证码有效期 10 分钟。账号绑定已有项目时，仍必须同时证明当前浏览器持有该 `client_id` 的 customer access token；绑定只写关联关系，不迁移、不复制、不删除 `global-project-store.<client_id>`。

P1a 目前只提供后端安全地基，公开首页不增加登录墙。未配置邮件服务或关闭 `ACCOUNT_AUTH_ENABLED` 时，邮箱验证接口返回友好不可用状态，现有匿名流程保持原样。

### P2 套餐、权益与用量地基

套餐配置、权益快照和产品用量分别使用 `subscriptions/v1`、`entitlements/v1`、`usage/v1` 命名空间，不迁移或修改客户的 `global-project-store.*` 数据。首轮完整内容计划计 1 轮策略周期；反馈达到下一轮解锁门槛时，同一轮计划集合只预留 1 次，成功交付后核销，失败或限流后释放。

```bash
COMMERCIALIZATION_ENABLED=false
FREE_TRIAL_STRATEGY_CYCLES=3
FREE_TRIAL_VALID_DAYS=30
FREE_MONTHLY_STRATEGY_CYCLES=1
PLUS_MONTHLY_STRATEGY_CYCLES=4
PRO_MONTHLY_STRATEGY_CYCLES=12
FREE_MONTHLY_COMPLETE_CONTENT=0
PLUS_MONTHLY_COMPLETE_CONTENT=12
PRO_MONTHLY_COMPLETE_CONTENT=40
FREE_DAILY_GENERATIONS=1
PLUS_DAILY_GENERATIONS=10
PRO_DAILY_GENERATIONS=30
FREE_ACTIVE_PROJECTS=1
PLUS_ACTIVE_PROJECTS=3
PRO_ACTIVE_PROJECTS=10
PLUS_MONTHLY_PRICE_CNY=299
PLUS_YEARLY_PRICE_CNY=2990
PRO_MONTHLY_PRICE_CNY=899
PRO_YEARLY_PRICE_CNY=8990
PRO_PUBLIC_SALES_ENABLED=false
```

`COMMERCIALIZATION_ENABLED=false` 是上线前的观察模式：系统记录策略周期和本期用量，但不会拦截现有匿名或登录客户；观察期记录不会在以后开启强制模式时追溯扣减。只有人工确认后改为 `true`，服务端才会在额度不足时返回 `quota_exceeded`。客户界面只展示套餐、策略周期、完整内容和刷新时间，不展示 Token、模型供应商或内部成本。

### P3a 商业订单与人工开通

v1.6.137 起，登录客户可在 `/plans` 选择公开销售的套餐和月付/年付周期。订单金额由服务端读取套餐配置后锁定，客户请求只提交套餐、周期和幂等标识；网络重试复用同一订单。客户只能查看或取消自己账号下尚未付款的订单。

当前 `billing_mode=manual_review`：订单创建后显示唯一订单号与付款联系邮箱。运营核对真实到账后，在受 `INTERNAL_ACCESS_TOKEN` 保护的内部订单区填写到账凭证并确认，系统按订单号幂等开通或顺延订阅。重复确认不会重复增加权益，订单、索引、幂等记录和审计日志使用独立 Blob 命名空间，不改动 `global-project-store.*`。

```bash
BILLING_ORDER_TTL_HOURS=72
BILLING_CONTACT_EMAIL=contact@fpmatrix.cn
```

这一阶段不模拟微信或支付宝支付成功。自动支付需取得真实商户号、签名密钥、证书及回调域名后接入，届时复用现有订单与权益状态机。

### 客户连续内容周期

客户版主路径：

```text
/ → 填写业务信息 → 确认内容方向 → 查看本周 7 天计划 → 记录发布效果 → 查看下一轮建议 → 启用下一轮
```

v1.6.50 起，客户公开页改为分步式体验：

- 页面一次只展示当前该做的一件事；
- 顶部进度为“填写业务 / 确认方向 / 本周计划 / 记录效果 / 下一轮”；
- 点击计划卡片后进入记录效果步骤；
- 保存记录后进入下一轮建议步骤；
- 内部版和生成内核不变，分步只影响客户版呈现。

v1.6.51 起，客户公开页继续冻结在 v1.6.50 的分步体验；内部端拆成「客户运营工作区」和「素材生产工作台」，避免素材生产、QA、交付任务与客户内容策略流混在同一个页面。

v1.6.49 起，客户公开页会在生成前加入轻量共创确认：

- 系统先给出 3 个方向卡，例如家长痛点型、教练专业信任型、体验课转化型；
- 客户选择本周优先方向，并可排除不想发的内容；
- 系统按客户确认后的方向生成 7 天计划；
- 发布后记录效果时，客户可补充“问体验课时间 / 问价格但没预约 / 收藏多但没咨询”等观察标签。

这些共创字段会写入 `assessment.co_creation` 和反馈 `observation_tags`，用于后续同行业样本积累。

v1.6.47 起，客户记录发布效果后会生成下一轮 7 天计划；点击“开始使用第 N 轮 7 天计划”后，当前计划会进入下一轮，旧计划归档到内容周期历史区。后续第 3 / 第 4 / 第 N 轮都会携带历史选题，避免重复旧主题。

v1.6.48 起，客户公开页会在关键节点同步云端项目态：

- 首次生成建议：同步业务信息、诊断和 7 天计划；
- 记录发布效果：同步发布链接、曝光、互动、咨询、备注和下一轮建议；
- 启用下一轮：同步当前轮次和历史内容周期。

云端同步用于内部端“全部客户”列表和行业品类样本沉淀；如果同步失败，客户本地流程仍继续可用。

### 项目交付协同 P0

P0 为不同客户交付方式建立统一数据地基，不改变客户公开页，也不迁移现有 `global-project-store.*` 数据。

两套交付模板：

| 模板 | 典型客户 | 适用流程 |
| --- | --- | --- |
| `professional_project` | 安标检测 | 内容规划 → 技术审核 → 客户确认 → 现场拍摄 → 外包制作 → 内部 QA → 客户交付 → 发布与周报 |
| `local_growth_operation` | 伊美德儿 | 内容规划 → 轻确认 → 素材收集 → 内容制作 → 发布 → 效果记录 → 下一轮优化 |

每条协同记录必须同时归属 `client_id + project_id`；周期内资源还必须归属 `delivery_project_id + cycle_id`。任务、审批、拍摄和周报分别使用独立 Blob key，避免和客户内容计划、反馈或素材生成任务混写。状态变更会追加 `status_events`，非法跨阶段跳转会被拒绝。

字段所有权分为：

- 系统：ID、归属关系、创建/更新时间和状态历史；
- 内部团队：项目目标、脚本、要求、负责人、QA、周报和状态；
- 外包团队：制作状态、草稿/成品地址、素材和制作备注；
- 客户：确认意见、拍摄时间、发布数据和客户反馈。

P0 所有 `/api/delivery-*`、`/api/collaboration-*`、`/api/shooting-schedules`、`/api/weekly-reports` 接口均要求 `INTERNAL_ACCESS_TOKEN`，公开客户不能枚举或修改协同数据。飞书本期仅保存项目级绑定关系，`sync_mode=binding_only`；真正的多维表格读写、字段映射和外部角色入口放到 P1，不会冒充已同步。

### 项目化素材生成与验收工作台 V1

内测入口：

```text
/internal/generation-workbench
```

V1 数据仍使用同一个 Netlify Blobs store：`enterprise-marketing-tool-state`。

- 素材集合 key：`assets/<client_id>`
- 生成任务集合 key：`tasks/<client_id>`
- 无 Blobs 环境时自动降级为函数内存 fallback，便于本地 smoke test。

Provider Adapter V1 先使用 mock：

| generation_type | requested_model | provider | 调用形态 |
| --- | --- | --- | --- |
| image / cover | GPT-Image-2 | openai-image | 同步 mock |
| video | Seedance 2.0 | seedance-video | 异步 mock，submit 后 poll |
| script / copy | Claude Opus | claude-text | 同步 mock |

真实接入时需要配置：

```bash
OPENAI_API_KEY=OpenAI Images API Key
ARK_API_KEY=火山方舟 API Key，用于 Seedance 2.0 视频
ANTHROPIC_API_KEY=Anthropic API Key，用于 Claude Opus 文案/脚本
```

### 对标内容洞察 P0

内部入口：

```text
/internal/benchmark-insights
```

该工作区复用「全部客户」和项目归属校验，按以下流程工作：

```text
选择客户与项目 → 录入对标账号 → 录入 1–3 条代表内容与证据
→ 异步生成市场洞察 → 内部审核 → 生成不落正式项目的测试计划
```

所有接口必须携带 `INTERNAL_ACCESS_TOKEN`；请求的 `client_id + project_id` 必须能在对应客户项目桶中核验。四类数据分别写入 `benchmark-profiles`、`benchmark-contents`、`benchmark-insights` 和 `benchmark-jobs` 独立集合，不修改 `global-project-store.*`。

洞察只调用现有火山方舟文本链路。缺少 `SAFE_TO_RUN=true`、`ARK_API_KEY` 或模型配置时，任务明确进入 `failed` 并记录 `fallback_reason`，不会生成本地规则洞察。分析完成后状态为 `review_required`，只有人工审核通过才能生成测试计划；测试计划仅供内部比较，不会写入客户正式内容周期。

P0 支持武术、篮球、美甲和口腔的基础行业隔离。跨行业参考会降级为低匹配观察项，不会自动给出可迁移方向；代表内容只作为主题、痛点和表达结构证据，不允许照抄来源标题或素材。本期不自动抓取任何平台，也不在公开客户首页提供入口。

### 飞书双向同步阶段 A

阶段 A 先打通门店数据回流，并保留半自动出站能力：

- `POST /api/feishu/inbound`：接收飞书多维表格自动化推送；必须携带 `x-feishu-inbound-token`（也兼容 Bearer token），否则返回 `401`。
- 每条自动化建议同时携带 `x-feishu-client-id`，且必须与 body 的 `client_id` 一致；服务端只读取并写回该客户自己的 `global-project-store.<client_id>`，不会跨客户搜索项目。
- 效果数据会幂等写入项目的 `feedback` 与 `records`；每日打卡、口碑任务分别写入 `daily_checkins`、`reputation_tasks`，并统一留下 `feishu_inbound_records` 审计记录。
- `POST /api/feishu/sync`：配置群机器人 webhook 后真实推送任务摘要；未配置时返回可人工导入的 A-F 六段 payload，不伪装同步成功。

Netlify 环境变量：

```bash
FEISHU_INBOUND_TOKEN=至少32字节的强随机回流令牌
FEISHU_BOT_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/...
# 兼容历史变量名：FEISHU_WEBHOOK_URL
```

飞书自动化回推示例（字段也兼容对应中文列名）：

```json
{
  "client_id": "basketball",
  "project_id": "project-basketball",
  "event_type": "效果回填",
  "record_id": "recxxxxxxxx",
  "fields": {
    "内容计划ID": "plan-1",
    "发布链接": "https://example.com/post",
    "反馈时间点": "T+72",
    "曝光": 1800,
    "点赞": 42,
    "评论": 8,
    "收藏": 26,
    "转发": 4,
    "咨询人数": 6,
    "观察": "客户更关注体验流程"
  }
}
```

### 飞书主动读取阶段 B

阶段 B 不替换阶段 A。系统通过飞书开放平台 Bitable API 主动读取多维表格，并继续复用阶段 A 的中文字段归一化、项目归属校验和记录 ID 幂等写入：

- `POST /api/feishu/pull`：仅接受 `INTERNAL_ACCESS_TOKEN`，可在 body 传单张 `table_id + event_type`，也可不传 body 直接使用环境变量配置的三张表。独立多维表格可直接传 `app_token`；知识库表格可传 `wiki_node_token`，后端会自动解析真实 `obj_token`。
- `feishu-pull-scheduled`：Netlify Scheduled Function，每 15 分钟执行一次；Scheduled Function 使用 UTC cron，但本任务按固定间隔同步，不受时区影响。
- 文本数组会拼成纯文本，毫秒时间戳转为北京时间业务时间，超链接取真实 link。
- 每条记录必须包含客户 ID 和项目 ID；效果表还必须包含属于该项目的内容计划 ID。项目不存在或计划不匹配时只跳过该条，不跨客户搜索。
- 重复拉取相同 `record_id` 会更新原记录，不重复累计。

Netlify 环境变量：

```bash
FEISHU_APP_ID=飞书自建应用 App ID
FEISHU_APP_SECRET=飞书自建应用 App Secret
# 以下二选一；显式请求参数优先于环境变量
FEISHU_BASE_TOKEN=独立多维表格 /base/ 地址中的 app_token
FEISHU_WIKI_NODE_TOKEN=知识库多维表格 /wiki/ 地址中的 node_token
FEISHU_TABLE_EFFECT=效果表 table_id
FEISHU_TABLE_CHECKIN=打卡表 table_id
FEISHU_TABLE_REPUTATION=口碑表 table_id

# 可选，以下为默认值
FEISHU_PULL_PAGE_SIZE=100
FEISHU_PULL_MAX_RECORDS=500
FEISHU_PULL_TIMEOUT_MS=8000
FEISHU_PULL_DEADLINE_MS=23000
```

手动触发示例：

```bash
curl -X POST https://sales-improve.netlify.app/api/feishu/pull \
  -H "Authorization: Bearer $INTERNAL_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

飞书侧需给自建应用开通多维表格读取权限，并将应用添加为目标多维表格的文档应用。使用 `FEISHU_WIKI_NODE_TOKEN` 时，还需开通“查看知识空间节点信息”权限；后端只缓存解析出的 `obj_token`，不会向前端返回应用凭据。任何凭据都只配置在 Netlify 环境变量中，不写入前端或 Git。

### 飞书协同写入阶段 C

阶段 C 复用阶段 B 的应用凭据与 Base/Wiki Token，把内部项目的内容计划 upsert 到飞书内容计划/排期表：

- `POST /api/feishu/push`：仅接受 `INTERNAL_ACCESS_TOKEN`，body 必须指定 `client_id + project_id`；系统只读取该客户桶中的指定项目。
- `GET /api/feishu/status`：仅供内部页读取非敏感协同状态，包括计划数、最近推送/拉取时间和可选工作区链接。
- 飞书字段固定为：客户 ID、项目 ID、内容计划 ID、平台、选题、角度、形式、CTA、计划发布日期、状态。
- 以真实 `内容计划ID` 为唯一键；首次推送 `batch_create`，重复推送 `batch_update`，不会生成重复排期行。
- 日期写为毫秒时间戳，单选写选项名，超链接按 `{link,text}` 格式处理。凭据、表 ID 或写权限缺失时 fail-closed，不冒充成功。

新增 Netlify 环境变量：

```bash
FEISHU_TABLE_PLAN=内容计划/排期表 table_id
FEISHU_WORKSPACE_URL=https://... # 可选，内部页“打开飞书工作区”链接
FEISHU_BOT_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/... # 可选，沿用阶段 A 机器人通知
```

手动推送示例：

```bash
curl -X POST https://sales-improve.netlify.app/api/feishu/push \
  -H "Authorization: Bearer $INTERNAL_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"basketball","project_id":"project-basketball"}'
```

飞书自建应用必须增加多维表格写入/编辑权限，重新发布并通过管理员审批，同时添加为目标多维表格的文档应用。阶段 C 不自动创建表格，也不会改写阶段 A/B 的回流表。

### 豆包 / 火山方舟文本模型

客户 public 版默认通过 Netlify Function 后端调用火山方舟 OpenAI-compatible Chat Completions API，前端不会暴露 API Key。需要在 Netlify 环境变量中配置：

```bash
ARK_API_KEY=火山方舟 API Key
ARK_MODEL=火山方舟模型 Endpoint ID，例如 ep-xxxxxxxxxxxxxxxxxxxxx
ARK_PLAN_MODEL=内容计划专用轻量模型或 Endpoint ID，例如 doubao-seed-2-0-lite-260215
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

可选兼容变量：

```bash
VOLCENGINE_ARK_API_KEY=
DOUBAO_MODEL=
VOLCENGINE_ARK_MODEL=
CUSTOMER_PUBLIC_MODEL=
```

`ARK_BASE_URL` 可以填写 `https://ark.cn-beijing.volces.com/api/v3`，后端会自动拼接 `/chat/completions`；如果已填写完整 `/chat/completions` 地址也兼容。

如果未配置 `ARK_API_KEY` 或 `ARK_MODEL`，接口不会报错，内部令牌请求会明确返回 `provider: "local"`、`actual_model: "rule_template"`、`fallback` 和具体 `fallback_reason`，用于验收区分真实模型调用和规则兜底。匿名客户响应会移除这些模型与供应商元数据，前端仍可正常渲染规则兜底结果。

### AI 运营调度观测地基（v1.6.177 P0）

P0 只记录当前生产模型路由，不改变任何模型选择、客户输出或套餐扣减。计划、复盘、文案、图片和视频任务会把路由决策、模型调用与质量结果写入同一个 Netlify Blobs store 下的独立命名空间：

- `routing/v1/<client_id>`：当前固定路由及 reason code；
- `model-runs/v1/<client_id>`：供应商尝试、延迟、fallback、usage 与可选成本估算；
- `quality/v1/<client_id>`：自动门禁和人工 QA 结果。

只读查询接口仅接受 `INTERNAL_ACCESS_TOKEN`：

```bash
curl "https://sales-improve.netlify.app/api/internal/model-observability?client_id=<client_id>" \
  -H "Authorization: Bearer $INTERNAL_ACCESS_TOKEN"
```

环境变量：

```bash
MODEL_ROUTING_MODE=observe          # P0 固定为 observe；off 可关闭全部观测写入
MODEL_RUN_LEDGER_ENABLED=true       # false 时停止写模型调用账本
MODEL_COST_TRACKING_ENABLED=true    # 无价格配置时 estimated_cost_cny 返回 null
MODEL_ROUTING_SAMPLE_RATE=100       # 0-100，按 task_id 稳定采样

# 可选：按 provider 名转换后的前缀配置每百万 Token 人民币价格
VOLCENGINE_ARK_INPUT_CNY_PER_MILLION_TOKENS=
VOLCENGINE_ARK_OUTPUT_CNY_PER_MILLION_TOKENS=
KIMI_TEXT_INPUT_CNY_PER_MILLION_TOKENS=
KIMI_TEXT_OUTPUT_CNY_PER_MILLION_TOKENS=
```

观测账本是 best-effort：Blobs 写入失败只写服务端告警，不阻断生成。回滚时将 `MODEL_RUN_LEDGER_ENABLED=false` 和 `MODEL_COST_TRACKING_ENABLED=false`；独立账本不会修改或迁移 `global-project-store.*`、商业额度 reservation 与客户反馈数据。

## 产品边界

这是营销增长闭环 MVP，不是 CRM/ERP/管理系统。

当前版本不做：

- 合同、报价、审批
- 客户生命周期跟进
- 多人协同冲突处理
- 平台自动发布、自动评论、自动私信
- 账号矩阵、养号、自动建号
- 面向客户公开展示内部模型、QA、素材生产细节

## 下一步

如果客户验证通过，再升级：

1. 登录和角色权限
2. Excel/飞书导入导出
3. 客户真实案例模板库
4. 跨周内容周期报表
5. 平台数据自动采集
6. 定时备份与运营审计
