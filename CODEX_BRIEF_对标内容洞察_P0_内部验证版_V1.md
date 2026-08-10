# Codex 开发任务书：对标内容洞察 P0 内部验证版 V1

> 本文件是“对标内容洞察”P0 的开发执行文档。
> 配套产品设计：`获客罗盘_对标内容洞察_产品设计_V1.md`。
> 总体数据方向：`Matrix_行业数据源与智能决策体系_总体规划_V1.md`。
> P0 只在内部版验证，不改变客户首页、客户生成流程和套餐承诺。

状态：已完成实现，待 unique preview 复验
建议版本：`v1.6.139 · 对标内容洞察内测版`
项目目录：`/Users/matrix_core/enterprise-marketing-tool-mvp`

## 0. 本期目标

把现有“补充资料里的 benchmark 字段”升级为一个可以独立维护、分析、审核和验证的内部能力：

```text
选择客户与项目
→ 添加对标账号
→ 添加 1–3 条代表内容与证据
→ 异步生成对标洞察
→ 内部审核
→ 用洞察生成一份内测计划
→ 检查是否更具体、是否串行业、是否照抄
```

P0 同时建立最小数据地基：每条市场信号必须有来源、时间、可信等级、隐私范围和证据引用。

## 1. 必须先读的现有代码

| 文件 | 现有能力 | 本期复用方式 |
|---|---|---|
| `netlify/functions/api.mjs` | 单 Function 路由、Blobs、内部令牌、模型调用、异步 `plan-jobs` | 新接口、集合、分析任务和内测方案接入 |
| `static/index.html` | 客户/内部共享壳、内部运营区、素材工作台 | 增加独立对标洞察工作区 DOM |
| `static/app.js` | `/internal/*` 路由、profile、全部客户、项目切换、内部表单 | 增加独立路由与渲染，不复制客户旅程 |
| `static/styles.css` | 内部工作区布局与响应式样式 | 只增加 internal-only 局部样式 |
| `tests/api_smoke.mjs` | API、安全、行业隔离、浏览器源码约束 | 增加对标 P0 完整断言 |
| `README.md` | 当前架构、环境变量与接口说明 | 增加 P0 使用说明 |
| `VERSION_CHANGELOG.md` | 版本台账 | 增加本期记录 |

必须复用：

- `cloudStore()`；
- `readCloudCollection()` / `writeCloudCollection()` / `upsertCollectionItem()`；
- `authorizeCustomerRoute()` 及内部令牌校验；
- `sanitizeCustomerPayload()` / `stripCustomerModelMetadata()`；
- `callArkChatCompletion()` 及现有模型证据字段；
- `context.waitUntil()` 异步任务模式；
- `explicitCustomerClientId()`、全部客户列表和项目切换；
- 现有行业识别、风险门禁和武术/篮球隔离规则。

禁止另建数据库、前端框架、认证体系或模型网关。

## 2. P0 范围

### 2.1 本期做

1. `/internal/benchmark-insights` 独立内部工作区；
2. 对标账号和代表内容的结构化录入；
3. 公开指标、截图素材引用和客户/运营观察；
4. 异步生成市场信号；
5. 内部审核通过/拒绝；
6. 用已审核洞察生成内测方案；
7. 武术、篮球、美甲、口腔四行业验收；
8. 最小证据结构和来源追踪；
9. 完整内部 API 安全门禁；
10. 模型失败、解析失败和行业串线的明确状态。

### 2.2 本期不做

- 不在客户首页增加入口；
- 不修改公开客户 `POST /api/plan-jobs`；
- 不自动抓取小红书、抖音或视频号；
- 不用 Cookie、自动登录或浏览器代理读取平台；
- 不建设跨客户行业样本推荐；
- 不把对标内容自动用于真实客户下一轮；
- 不自动发布、评论、私信或下载对标素材；
- 不修改套餐价格和额度；
- 不把模型知识标记为市场验证；
- 不迁移或合并现有 `global-project-store.*` 数据。

## 3. 路由与页面信息架构

### 3.1 新路由

```text
/internal/benchmark-insights
```

路由仅属于 `internal_admin` profile。直接访问时与 `/internal/generation-workbench` 一样先经过现有内部认证。

### 3.2 内部导航

内部导航新增：

```text
客户运营工作区 | 对标内容洞察 | 素材生产工作台
```

不把对标工作区直接堆进 `/internal/` 首页。

### 3.3 页面区块

#### A. 项目选择

- 客户选择：复用“全部客户”聚合数据；
- 项目选择：读取所选 `client_id` 的现有项目；
- 展示行业、目标客户、产品服务和当前平台摘要；
- 缺少客户或项目时显示明确空状态。

#### B. 对标账号

字段：

- 平台；
- 账号名称；
- 主页链接，可选；
- 参考原因，多选；
- 客户/运营观察；
- 采集时间；
- 当前状态。

#### C. 代表内容

每个账号可添加 1–3 条：

- 标题，必填；
- 内容链接，可选；
- 内容摘要，标题过短时必填；
- 内容形式；
- 发布时间，可选；
- 点赞、收藏、评论、分享等公开值，可选；
- 截图素材 `asset_id`，可选；
- 观察说明；
- 数据采集时间；
- 可信等级。

只有链接、没有标题/摘要/截图时拒绝提交，并提示“链接暂不能自动读取，请补充标题、截图或内容摘要”。

#### D. 洞察任务

显示：

- `pending`：等待分析；
- `generating`：正在分析；
- `review_required`：分析完成，等待审核；
- `approved`：审核通过，可用于内测方案；
- `rejected`：审核拒绝；
- `failed`：模型或结构化失败。

界面每 3–5 秒轮询一次正在运行的任务。离开页面后再次进入可恢复任务，不因刷新丢失。

#### E. 洞察结果与审核

展示：

- 参考对象匹配度；
- 市场关注点；
- 已验证或待验证的客户痛点；
- 标题结构；
- 内容形式；
- 信任证据；
- 转化承接方式；
- 可迁移选题；
- 不建议模仿点；
- 平台和合规风险；
- 每条结论的证据引用。

操作：

- 审核通过；
- 审核拒绝并填写原因；
- 重新分析；
- 使用该洞察生成内测方案。

技术字段放入默认折叠的“模型与调试信息”，客户不可见。

## 4. 数据结构

P0 使用四个新的按 `client_id` 隔离的 Blob 集合，不写入全局项目键：

```text
benchmark-profiles/<client_id>
benchmark-contents/<client_id>
benchmark-insights/<client_id>
benchmark-jobs/<client_id>
```

### 4.1 benchmark_profile

```json
{
  "benchmark_profile_id": "benchmark_profile_xxx",
  "client_id": "anonymous-xxx",
  "project_id": "project_xxx",
  "platform": "小红书",
  "account_name": "某少儿武术账号",
  "account_url": "https://...",
  "reference_reason": ["选题", "信任表达"],
  "operator_notes": "客户认为它对安全感的表达值得参考",
  "source_mode": "customer_supplied|operator_curated",
  "privacy_scope": "project_private",
  "observed_at": "ISO-8601",
  "status": "active|archived",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601",
  "created_by": "internal"
}
```

### 4.2 benchmark_content

```json
{
  "benchmark_content_id": "benchmark_content_xxx",
  "benchmark_profile_id": "benchmark_profile_xxx",
  "client_id": "anonymous-xxx",
  "project_id": "project_xxx",
  "platform": "小红书",
  "title": "孩子第一次上武术课，家长最该看什么",
  "content_url": "https://...",
  "content_summary": "讲安全保护、课堂秩序和教练分层",
  "content_format": "图文",
  "published_at": null,
  "visible_metrics": {
    "views": null,
    "likes": 0,
    "favorites": 0,
    "comments": 0,
    "shares": 0
  },
  "screenshot_asset_id": null,
  "operator_observation": "评论集中询问安全和孩子是否适合",
  "source_mode": "customer_supplied|operator_curated",
  "confidence": "C|D|E",
  "privacy_scope": "project_private",
  "observed_at": "ISO-8601",
  "status": "ready|incomplete|archived",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

规则：

- 手工公开指标不得默认填零；缺失必须为 `null`；
- 没有截图或可核验指标时，不得使用“爆款已验证”；
- `confidence=C` 需要链接/截图/公开指标至少一种；
- 只有口述、没有证据时为 `E`；
- P0 不产生 `A/B` 级对标证据，`A/B` 留给客户自身结果或官方接口。

### 4.3 benchmark_insight

```json
{
  "benchmark_insight_id": "benchmark_insight_xxx",
  "job_id": "benchmark_job_xxx",
  "client_id": "anonymous-xxx",
  "project_id": "project_xxx",
  "source_profile_ids": ["benchmark_profile_xxx"],
  "source_content_ids": ["benchmark_content_xxx"],
  "project_snapshot": {
    "industry": "少儿武术培训",
    "target_customer": "附近有 6–12 岁孩子的家长",
    "offer": "武术搏击体验课",
    "main_goal": "获得体验课咨询"
  },
  "fit_summary": "",
  "fit_status": "high|medium|low",
  "market_signals": [],
  "proven_pains": [],
  "title_patterns": [],
  "content_formats": [],
  "trust_evidence_patterns": [],
  "conversion_paths": [],
  "transferable_directions": [],
  "avoid_copying": [],
  "platform_risks": [],
  "industry_guard": {
    "expected_business_type": "martial_arts",
    "forbidden_terms_found": [],
    "passed": true
  },
  "status": "review_required|approved|rejected",
  "review": {
    "reviewer": "",
    "reviewed_at": "",
    "notes": "",
    "rejection_reason": ""
  },
  "requested_model": "",
  "actual_model": "",
  "provider": "",
  "fallback": false,
  "fallback_reason": null,
  "latency_ms": 0,
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

`market_signals`、`transferable_directions` 等数组中的每项使用对象，不只保存字符串：

```json
{
  "statement": "家长会先确认安全保护和课堂秩序",
  "source_content_ids": ["benchmark_content_xxx"],
  "confidence": "C",
  "observed_at": "ISO-8601",
  "adaptation_reason": "当前项目同样服务 6–12 岁孩子家长"
}
```

### 4.4 benchmark_job

```json
{
  "job_id": "benchmark_job_xxx",
  "client_id": "anonymous-xxx",
  "project_id": "project_xxx",
  "benchmark_profile_ids": [],
  "benchmark_content_ids": [],
  "status": "pending|generating|review_required|failed",
  "request_id": "",
  "requested_at": "ISO-8601",
  "started_at": "",
  "completed_at": "",
  "insight_id": "",
  "error_code": "",
  "error_message": "",
  "requested_model": "",
  "actual_model": "",
  "provider": "",
  "fallback": false,
  "fallback_reason": null,
  "latency_ms": 0
}
```

## 5. API 设计

所有 P0 接口均要求有效 `INTERNAL_ACCESS_TOKEN`，返回 `internal:true` 响应。客户端无法调用。

### 5.1 Profiles

```text
GET  /api/benchmark-profiles?client_id=&project_id=
POST /api/benchmark-profiles
PATCH /api/benchmark-profiles/:id
```

创建/更新时必须验证：

- `client_id` 有效；
- `project_id` 确实属于该 `client_id`；
- 平台合法；
- 账号名称或链接至少一项；
- 不允许跨项目修改。

### 5.2 Contents

```text
GET  /api/benchmark-contents?client_id=&project_id=&benchmark_profile_id=
POST /api/benchmark-contents
PATCH /api/benchmark-contents/:id
```

必须验证 profile、client、project 三者一致。截图只能引用同一客户和项目下的现有 `asset_id`。

### 5.3 Jobs

```text
POST /api/benchmark-jobs
GET  /api/benchmark-jobs/:id?client_id=
GET  /api/benchmark-jobs?client_id=&project_id=
```

提交响应：`202`，立即返回 `pending`，用 `context.waitUntil()` 启动分析。不得让前端同步等待模型。

网络重试使用 `request_id` 幂等：同一 `client_id + project_id + request_id` 复用原任务，不重复调用模型。

### 5.4 Insights 与审核

```text
GET   /api/benchmark-insights?client_id=&project_id=
PATCH /api/benchmark-insights/:id/review
POST  /api/benchmark-insights/:id/test-plan
```

审核规则：

- `review_required → approved|rejected`；
- 行业门禁失败不能批准；
- `fit_status=low` 默认不能批准，需重新补充来源；
- 拒绝必须填写原因；
- 已批准洞察重新分析后生成新版本，不覆盖旧证据。

`test-plan` 仅内部可用，复用现有诊断/计划内核，接受 `benchmark_insight_id`，返回内测方案及完整模型证据。P0 不修改公开 `/api/plan-jobs`。

## 6. 模型与结构化输出

### 6.1 模型调用

- 复用现有火山方舟文本模型调用；
- 调用前检查 `SAFE_TO_RUN`；
- 无 Key、未开启成本闸、超时、非 2xx 或结构解析失败时，任务进入 `failed`；
- P0 不用本地模板冒充市场洞察；
- `fallback=true` 时不得生成 `approved` 洞察；
- 日志不记录完整客户资料和完整提示词。

### 6.2 提示词必须包含

- 项目业务快照；
- 来源内容与证据等级；
- 只能使用输入证据判断市场信号；
- 无法验证时写“待验证”；
- 不能照抄标题、脚本、案例和素材；
- 必须逐条返回 `source_content_ids`；
- 必须解释如何转译成当前客户业务；
- 必须识别错行业内容；
- 输出严格 JSON。

### 6.3 结构校验

模型返回后执行：

1. JSON 解析；
2. 必填字段和数组长度；
3. 所有证据 ID 必须存在于本次输入；
4. 不能凭空添加指标；
5. 行业串线检查；
6. 标题/表达相似度风险检查；
7. 内部代号和敏感字段检查；
8. 未通过则 `failed` 或 `review_required + warnings`，不得静默通过。

## 7. 行业隔离门禁

P0 必须复用现有业务类型识别，并增加纯函数校验器。

至少支持：

| 项目类型 | 必须允许 | 禁止串入 |
|---|---|---|
| 少儿武术/搏击 | 武术、搏击、散打、防护、规则感、体验课 | 篮球课、运球、投篮、篮筐 |
| 少儿篮球 | 篮球、孩子、家长、体能、运球、投篮、体验课 | 武术、搏击、护具对抗训练 |
| 美容美甲 | 款式、通勤、到店、甲型、持久度、预约 | 儿童课程、医生诊疗、工业采购 |
| 社区口腔 | 检查、正畸、种植、医生、价格、信任 | 美甲、课程报名、工业设备 |

若来源本身跨行业：

- 保留来源记录；
- `fit_status=low`；
- 不产生可应用方向；
- 明确显示“参考对象与当前项目不匹配”。

## 8. 最小数据地基

P0 不建设完整数据平台，只完成以下共用字段：

- `source_mode`；
- `source_ref`；
- `observed_at`；
- `confidence`；
- `privacy_scope`；
- `evidence_refs/source_content_ids`；
- `adaptation_reason`；
- `industry_guard`；
- `created_at/updated_at`。

这些字段后续可被飞书、平台规则和客户发布结果复用，但 P0 不做通用 Source Registry 页面。

## 9. 安全与数据边界

1. 所有接口均先验证内部令牌；
2. 再验证 `client_id → project_id → profile/content/insight` 归属；
3. 任意跨客户读取/修改返回 404 或 403，不泄露记录是否存在；
4. 不接受 URL 参数绕过归属；
5. 不从对标链接自动发起服务端抓取；
6. 不把原始对标数据写入其他客户；
7. 不修改 `global-project-store.*`；
8. 新集合默认 `project_private`；
9. P0 不进入匿名行业统计；
10. 客户视图泄露扫描继续为 0；
11. 个性化推荐关闭时，未来 P1 不得自动应用历史/对标画像；P0 先保留状态字段但不接公开链路；
12. API 响应和日志不得包含密钥、内部令牌或浏览器授权信息。

## 10. 文件级实施计划

### 10.1 `netlify/functions/api.mjs`

- 版本号更新；
- 增加四类集合字段和 memory fallback；
- 增加项目归属校验；
- 增加 profiles/contents/jobs/insights 路由；
- 增加任务幂等与异步处理；
- 复用 Ark 调用；
- 增加审核和内测方案接口；
- 扩展 `/api/health.features`；
- 保持客户 `/plan-jobs` 不变。

### 10.2 可选新文件 `netlify/functions/benchmark-insights.mjs`

只放纯函数：

- schema 归一化；
- 提示词组装；
- 模型 JSON 解析；
- 证据 ID 校验；
- 行业隔离；
- 相似度风险；
- 客户可见结构预留。

不在该模块读写 Blobs，不读取环境变量，不处理鉴权，便于测试和未来复用。

### 10.3 `static/index.html`

- 内部导航增加“对标内容洞察”；
- 增加 `#benchmarkInsightsWorkbench`；
- 只放一棵内部 DOM，不复制客户表单；
- 空、加载、错误、运行中和审核五种状态容器齐全。

### 10.4 `static/app.js`

- 增加 `isBenchmarkInsightsRoute()`；
- `syncRouteState()` 支持新路由；
- 增加独立 state、load、render、submit、poll 和 review 函数；
- 复用内部 token 请求头、全部客户与项目选择；
- 刷新后恢复当前客户、项目和任务；
- 不修改客户首页的 benchmark 输入、生成和结果渲染；
- 不增加公开 API 调用。

### 10.5 `static/styles.css`

- 只加 `body.internal-mode.benchmark-insights-mode` 下的样式；
- 不修改 body、客户 card、button、input 等视觉基线；
- 760px 以下单列；
- 技术字段默认折叠；
- 不与素材生产工作台同时显示。

### 10.6 `tests/api_smoke.mjs`

增加 §11 的 API、行业、安全和源码断言。

### 10.7 文档

- `README.md`：接口、数据集合、内部入口和限制；
- `VERSION_CHANGELOG.md`：版本记录；
- 不修改商业套餐承诺。

## 11. 必做自动化测试

### 11.1 鉴权与隔离

1. 未带内部令牌访问所有 benchmark 接口均为 `401`；
2. A 客户不能读取或修改 B 客户记录；
3. 不存在或不属于该客户的 project 返回 `404/403`；
4. profile 与 content 跨项目绑定被拒绝；
5. 截图 asset 不属于当前项目时被拒绝；
6. 新集合写入不改变 `global-project-store.*`。

### 11.2 数据质量

1. 只有链接、没有标题/摘要/截图时返回 `400`；
2. 缺失公开指标保留 `null`，不写成 `0`；
3. `confidence=C` 缺少证据时自动降级；
4. 模型返回不存在的 source ID 时任务失败；
5. 模型失败时 `fallback=true` 且不能审核通过；
6. 网络重试同一 `request_id` 不重复创建任务。

### 11.3 行业隔离

1. 武术来源和项目生成洞察不得出现篮球词；
2. 篮球来源和项目不得被改写成武术；
3. 美甲和口腔输出保持各自客户语言；
4. 篮球来源误配武术项目时 `fit_status=low` 且不可批准；
5. 四行业内测方案主题明显不同；
6. 原标题不得被整句照抄进入计划。

### 11.4 状态机

1. 创建任务立即返回 `202/pending`；
2. `waitUntil` 后进入 `generating`；
3. 成功后为 `review_required`；
4. 通过后为 `approved`；
5. 拒绝必须有原因；
6. 失败任务可重新创建，旧记录保留；
7. 刷新后任务可继续读取。

### 11.5 P0 不回归

1. 根路径客户流程源码和行为不变；
2. `/api/plan-jobs` 既有测试全部通过；
3. 客户个性化关闭逻辑不变；
4. 内部素材工作台不变；
5. 支付、账号、套餐接口不变；
6. 客户响应无模型元数据；
7. 客户页面无 P01/P02/P03、Matrix 内部字段、provider/debug 泄露。

## 12. 浏览器验收用例

### 用例一：子武限武术搏击

项目：现有子武限武术搏击项目。
对标平台：小红书。
代表内容：

1. `孩子第一次上武术课，家长最该看什么`；
2. `搏击课会不会受伤？先看课堂里的3个保护细节`；
3. `孩子胆小或坐不住，适不适合学武术`。

预期：

- 信号聚焦安全、规则感、教练分层、体验课观察；
- 可迁移方向适配本地家长；
- 计划不出现篮球、运球、投篮、篮筐；
- 不整句照抄代表标题；
- 每条方向有证据 ID 和适配理由。

### 用例二：少儿篮球

项目：现有中傲少儿篮球项目。
代表内容聚焦体能、零基础、家长旁听和体验课。

预期：

- 与武术洞察显著不同；
- 内容出现篮球、体能、运球、投篮、孩子和家长语义；
- 不出现武术、散打、搏击训练。

### 用例三：美容美甲

代表内容聚焦通勤款、持久度、甲型适配和到店预约。

预期：

- 输出客户可直接理解的本地美甲主题；
- 不出现课程、医生或工业服务语义；
- 平台建议符合小红书图文/短视频语境。

### 用例四：社区口腔

代表内容聚焦儿童矫正、检查、种植牙、价格和医生专业度。

预期：

- 输出保持医疗服务边界；
- 不虚构疗效、案例和资质；
- 风险项提醒医疗宣传和效果承诺。

## 13. 本地 QA

开发完成后运行：

```bash
node --check static/app.js
node --check netlify/functions/api.mjs
node --check netlify/functions/benchmark-insights.mjs
node --check tests/api_smoke.mjs
node tests/api_smoke.mjs
```

如果未新增独立模块，跳过对应 `node --check`。

本地启动：

```bash
npm run dev
```

浏览器检查：

- `/internal/benchmark-insights` 正确显示；
- `/internal/` 不混入工作台内容；
- `/internal/generation-workbench` 不受影响；
- `/` 客户版不出现入口和内部字段；
- Console 0 error；
- Network 无跨客户读取和关键 API 失败。

## 14. 发布策略

1. 使用独立分支：`codex/benchmark-insights-p0`；
2. 先本地测试；
3. 再发 Netlify draft/unique preview；
4. 内部验收四行业；
5. 未经确认不部署生产；
6. 即使部署到生产，也只有 `/internal/benchmark-insights` 可见，客户版不增加入口；
7. 站点固定为 `f0efe912-abbc-4362-afdc-c9e513cb986c`；
8. publish 保持 `static`，functions 保持 `netlify/functions`；
9. 禁止使用旧站点或新建站点。

## 15. 完成定义

P0 完成必须同时满足：

1. 内部运营可选择现有客户和项目；
2. 可录入对标账号与代表内容证据；
3. 可异步生成并恢复洞察任务；
4. 洞察有逐条证据引用；
5. 模型失败不伪装成成功；
6. 审核通过前不能用于内测方案；
7. 武术与篮球严格隔离；
8. 美甲与口腔输出保持行业语境；
9. 客户首页、公开生成、支付和套餐无回归；
10. 新数据仅写入 benchmark 独立集合；
11. 客户原始数据未跨项目或跨客户共享；
12. 所有自动化与浏览器验收通过。

## 16. P1 预留但不实现

P0 验收后，P1 才考虑：

- 客户版独立“市场参考”步骤；
- 登录账号套餐权益；
- 对标洞察自动进入公开 `plan-jobs`；
- 客户上传截图；
- 客户自己的平台授权数据；
- 行业样本库；
- 个性化推荐开关对对标信号的完整控制；
- 匿名行业规律和最小样本门槛。
