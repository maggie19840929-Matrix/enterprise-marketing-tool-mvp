# Codex 开发任务书：项目化素材生成与验收工作台 V1（完整版）

> 本文件是交给 Codex 的**唯一权威提示词**。Codex 必须先读完本文件，再读下方「必读源码」，**严禁从零重写**。
> 目标：把当前聊天式素材生成流程，升级为「网页端结构化提交 → 模型生产 → 内部 QA → 客户交付 → 飞书回写预留」的闭环。

---

## 0. 上手前置：先读这些，对齐真实架构（不要假设）

线上/内测真正运行的是 **静态 SPA + 单个 Netlify Function**，**没有数据库**，**Python 版（app.py/business.py/sqlite）是废弃本地版，不要碰、不要参考**。

| 文件 | 作用 | 必须做什么 |
|---|---|---|
| `netlify/functions/api.mjs`（2284 行） | 所有 `/api/*` 后端逻辑，单文件路由 | 在这里加新路由，复用其存储/脱敏/模型元数据模式 |
| `static/app.js`（3488 行，原生 JS 无框架） | 前端 SPA 全部逻辑 | 在这里加工作台视图，复用 `isInternalMode()` |
| `static/index.html` | SPA 容器 | 加工作台 DOM 容器 |
| `netlify.toml` / `static/_redirects` | 路由：`/api/*` → function；`/internal` → index.html | 新内部页走 `/internal/...`，沿用现有重写 |
| `scripts/local-dev-server.mjs` | 本地起服务 `npm run dev` | 本地验证用 |
| `tests/api_smoke.mjs` | `npm test` 冒烟 | 必须扩展，加新接口断言 |

**复用已有能力（这些已经实现，禁止另起炉灶）：**

1. **存储**：`@netlify/blobs`，store 名常量 `CLOUD_STATE_STORE = 'enterprise-marketing-tool-state'`，读写函数 `readCloudState(clientId)` / `writeCloudState(payload, clientId)`，状态结构是 `project_store.projects[]`，按 `client_id` 分键（`clientScopedCloudStateKey`），无 store 时自动降级到内存（`memoryCloudStates`）。
   → **新数据（素材、生成任务、QA）必须沿用同一个 blobs store**，新增独立的 blob key（如 `assets/<client_id>`、`tasks/<client_id>`），**不得引入任何新数据库 / ORM / 新依赖**。

2. **模型透明度字段已存在**：api.mjs:84–138 已有 `requested_model / actual_model / provider / fallback / fallback_reason / failure_reason / latency_ms` 这套元数据模式（用于文案生成）。图片/视频/脚本任务**复用同样的字段命名和"失败不静默降级、fallback 必须写内部字段"语义**。

3. **客户脱敏层已存在**：api.mjs:32–57 的 `sanitizeCustomerPayload` + `CUSTOMER_FORBIDDEN_REPLACEMENTS`，app.js 有对应 `sanitizeCustomerText`。**扩展它，不要重写**（见 §8 硬约束）。

4. **internal/client 隔离已存在**：`isInternalMode()`（app.js）、内部 client_id `'internal'`、`/state?internal=` 区分。沿用这套做角色视图隔离。

5. **火山方舟（Ark）已接入**：api.mjs 已有 `callArkChatCompletion` + `ARK_API_KEY` 走火山方舟做文案。视频模型 Seedance 同样在火山方舟上，鉴权基础设施可复用（见 §4）。

---

## 1. 范围红线（先划清楚）

**只做 V1，且只在 `/internal` 内测区扩展。**

- ✅ 做：`/internal/generation-workbench` 工作台、素材库、生成任务、QA、客户交付区、飞书 adapter（mock）、角色视图隔离、三 Provider Adapter（mock）。
- ❌ 不做：从零重写；改客户版主流程（`/` 首页那套增长诊断流程一行都别动）；CRM/ERP；自动发布/评论/私信/养号；完整登录系统；新框架/新数据库。
- ⚠️ 模型真实调用、飞书真实回写**先用 adapter + mock**，但字段和接口要按真实形态预留好。

---

## 2. 数据结构（写进 blobs，沿用 envelope 风格）

新增两个逻辑集合，存进同一个 blobs store，独立 key、按 client 分隔。

### 2.1 素材 asset
```
asset_id, project_id, project_name, client_id, client_name,
original_filename, file_path | storage_url, mime_type, file_size,
sha256, duration(视频), resolution(图/视频),
uploaded_by, uploaded_at,
source: client|internal|outsourced|historical,
usage_scope: current_project_only|cross_project_authorized,
cross_project_authorization: {authorized_by, authorized_at, reason} | null,
status: ok|missing|unreadable,
notes
```
**硬约束**：
- 上传时**服务端校验并落地 sha256**（小文件可在前端算后端复核；见 §7 上传约束）。
- `usage_scope` 默认 `current_project_only`；跨项目复用必须有 `cross_project_authorization` 才允许被选中。
- 素材 `status != ok` 时，任何引用它的生成任务必须进入 `blocked_asset_missing`，**不得假装提交模型**。

### 2.2 生成任务 generation_task
```
task_id, project_id, client_id, content_plan_record_id,
platform: 小红书|抖音|视频号|其他,
content_type: 图文|封面|视频|脚本|其他,
generation_type: image|video|script|copy|cover,
requested_model, actual_model, provider, fallback, fallback_reason, error,
provider_job_id,        // 异步任务（视频）必填：模型侧返回的 task id
prompt, output_spec: {size, duration, style, client_visible:bool},
input_asset_ids[], output_asset_ids[],
status,（状态机见下）
qa: { qa_status, qa_reviewer, qa_time, qa_notes,
      visual_check, content_check, brand_check, platform_fit_check, client_visibility_check,
      rejection_reason, qa_evidence_urls[] },
created_at, updated_at, submitted_by
```

**状态机（严格按序，QA 未过禁止进客户区）：**
```
draft → submitted → asset_checking
  → (素材缺失) blocked_asset_missing
  → (模型鉴权失败) blocked_model_auth
  → queued → generating → generated
  → qa_pending → (qa_failed → 可回到 generating/人工修改) | qa_passed
  → client_ready → delivered
  失败任意点 → failed
```
> `queued → generating → generated` **不是装饰，是为异步视频专门留的**（见 §4）。
> 同步任务（图片/文案）可快速穿过这几个态；异步视频必须停在 `generating` 等轮询。

**硬约束**：无 `project_id` / 无 `client_id` / 无 `content_plan_record_id` 三者任一缺失，**拒绝创建任务**（接口 400 + 明确原因）。

### 2.3 模型映射（requested_model 必填，记录 actual/provider/fallback）
| generation_type | requested_model | provider | 调用形态 |
|---|---|---|---|
| image / cover | `GPT-Image-2` | OpenAI Images API | 同步，几秒~十几秒返回图 |
| video | `Seedance 2.0` | 火山方舟 Ark（异步视频任务） | **异步**，提交→轮询→取结果 URL |
| script / copy | `Claude Opus` | Anthropic API | 同步，秒级返回 |

V1 阶段 provider 调用走 **adapter mock**：mock 成功时写 `actual_model == requested_model, fallback:false`；mock 模拟失败时写 `fallback:true` + `fallback_reason`，任务进 `failed` 或 `blocked_model_auth`，**绝不静默成功**。

---

## 3. 后端接口（加到 api.mjs，沿用现有 `path ===` 路由风格）

GET：
- `/health` —— **扩展现有响应**，加 `module: 'generation-workbench', module_version, features:[...]`（保留原 `version/version_label`）。
- `/assets?client_id&project_id` —— 列出当前项目素材（默认只返回 `current_project_only` + 已授权跨项目）。
- `/generation-tasks?client_id&project_id&view=internal|client` —— `view=client` 时只返回 `qa.qa_status==passed && output_spec.client_visible` 的任务，且**经过 `sanitizeCustomerPayload`**。
- `/generation-tasks/:id` —— 单任务详情（含完整状态/证据，internal 视图）。

POST：
- `/assets` —— 上传/登记素材，服务端校验 sha256、生成 asset_id、落 blobs。
- `/generation-tasks` —— 创建任务，强制校验三个归属字段，初始 `draft`/`submitted`。
- `/generation-tasks/:id/submit` —— 触发 asset_checking → 调对应 Provider Adapter（见 §4）。
- `/generation-tasks/:id/poll` —— **异步视频专用**：用 `provider_job_id` 查模型侧状态，推进 `generating → generated`（见 §4）。
- `/generation-tasks/:id/qa` —— 提交 QA 结果，passed/failed 流转。
- `/generation-tasks/:id/deliver` —— 仅 `client_ready` 可调，置 `delivered`。
- `/feishu/sync`（adapter）—— 见 §6。

所有写操作沿用 `readCloudState`/`writeCloudState` 的 merge-by-id 思路落 blobs。

---

## 4. Provider Adapter 规范与异步视频流程（核心，务必照此设计）

三个模型 = 三套独立后端 API，**没有统一接口**，各有 endpoint / 鉴权 / 请求响应格式。统一封装成 adapter，调用方只认接口、不认厂商。

### 4.1 统一 adapter 接口
新建 `netlify/functions/lib/model-adapters/`（或 api.mjs 内独立模块），每个 provider 实现同一接口：

```js
// 每个 adapter 必须实现：
{
  name,                       // 'openai-image' | 'seedance-video' | 'claude-text'
  isAsync,                    // image/text=false, video=true
  submit({ prompt, inputAssets, outputSpec }),
      // → { ok, provider_job_id?, actual_model, provider, output?, fallback, fallback_reason, error }
      // 同步：直接带 output；异步：只带 provider_job_id，output 留空
  poll({ provider_job_id }),  // 仅 isAsync 实现
      // → { status: 'generating'|'succeeded'|'failed', output?, error }
}
```

**调用方逻辑（在 `/submit` 与 `/poll` 路由里）：**
- 同步 adapter（图片/文案）：`submit()` 拿到结果 → 写 output_asset → 直接推到 `generated`。
- 异步 adapter（视频）：`submit()` 只拿 `provider_job_id` → 状态停 `generating` → 立即返回前端；后续由 `/poll` 调 `poll()` 推进。

### 4.2 ⚠️ 异步视频与 Netlify 超时（最大的坑，必须正确处理）
Netlify Function 同步请求约 **10 秒**超时，而 Seedance 生一条视频要**几十秒~几分钟**。**绝对不能**在 `/submit` 里 hold 住连接等视频出结果——必触超时。

正确流程：
```
前端点提交
  → /submit 调 seedance adapter.submit()，拿到 provider_job_id 存 blobs
  → 状态置 generating，立刻 200 返回前端（不等）
  → 前端轮询 /generation-tasks/:id/poll（或前端定时器每 5~10s 调一次）
  → poll 调 adapter.poll(provider_job_id)：
        generating → 原样返回，前端继续轮
        succeeded  → 写 output_asset_id，状态转 generated → qa_pending
        failed     → 状态转 failed，写 error，不静默
```
V1 mock 阶段：`poll` 被调用 N 次后（或按时间戳）模拟 `succeeded`，把异步轮询链路真实跑通。

### 4.3 各 Provider 所需环境变量（写进 README，真实接入时配 Netlify env）
| Adapter | 环境变量 | 说明 |
|---|---|---|
| openai-image (`GPT-Image-2`) | `OPENAI_API_KEY` | OpenAI Images API；真实 model id 接入时按 OpenAI 当时文档确认 |
| seedance-video (`Seedance 2.0`) | `ARK_API_KEY`（已存在） | 火山方舟 Ark 异步视频任务接口 |
| claude-text (`Claude Opus`) | `ANTHROPIC_API_KEY`（已存在） | Anthropic Messages API |

**铁律**：
- API key **只放后端环境变量**，浏览器**绝不**直连模型 API，绝不把 key 下发前端。
- adapter mock ↔ 真实实现切换，**调用方一行不改**（后续由 OpenClaw 接真 key）。
- 缺 key 时进 `blocked_model_auth`，**不静默降级**。

---

## 5. 前端工作台（加到 app.js + index.html）

路由 `/internal/generation-workbench`（沿用 `isInternalMode()` 判断 + hash/path 切视图）。

页面区块：
1. 项目 / 客户 / 内容计划三级选择（内容计划取 `content_plan_record_id`）。
2. 生成类型 + 模型选择（按 §2.3 联动）。
3. 参考素材：上传 + 当前项目素材列表多选（跨项目素材默认置灰，授权后可选）。
4. 生成需求输入 + 输出规格（平台/尺寸/时长/风格/是否客户可见）。
5. 提交按钮 + 任务状态列表（展示完整状态机当前态；视频任务展示轮询进行中状态）。
6. **内部验收区**：看模型信息、provider、fallback、error、QA 证据、debug。
7. **客户交付区**：只显示 `qa_passed && client_visible`，**不出现任何内部字段/代号**，展示成品标题/素材/使用建议/平台建议/下载复制/反馈入口。

**每个页面/区块必须有：空状态、加载状态、错误状态。禁止出现 `undefined/null/NaN/[object Object]`。**

---

## 6. 飞书回写 Adapter（先 mock，结构要真）

新建 `netlify/functions/lib/feishu-adapter.mjs`（或 api.mjs 内独立模块），**飞书逻辑不得硬编码进页面**。

- 提供 `buildFeishuPayload(task|asset)` → 返回符合下列 6 视图结构的记录对象。
- `/feishu/sync` 接口：V1 不真连飞书，返回 `{ synced:false, mode:'mock', payload:{...} }`，把可回写结构吐出来即可。
- 预留 6 类视图结构：A 客户资料 / B 内容计划 / C 外包制作 / D 内部验收 / E 客户交付 / F 数据回流。
- 后续 OpenClaw 接真实 token 时只改 adapter 实现，不改调用方。

---

## 7. Netlify 上传的真实约束（必须正确处理，别踩坑）

Netlify Functions 同步请求体上限约 6MB，**大视频无法直接 POST 上传**。V1 按此处理：
- 小文件（图片/小素材）：前端读出 → 算 sha256 → base64/二进制传给 `/assets` → 后端复核 sha256 → 存 blobs。
- 大视频：**支持登记 `storage_url` 外链引用**（mock 也可），仍生成/记录 sha256（若有源可算）、duration、resolution，`source` 标注。
- 任何上传失败 / 句柄错误 / 文件不可读 → 素材 `status: unreadable`，关联任务 `blocked_asset_missing`，**界面明确报错，绝不静默**。（这正是要解决的"Resource deadlock avoided / 假装提交"事故。）

---

## 8. 硬约束（违反即不通过验收）

1. 不改客户版主流程；不引入新框架/新数据库/新认证系统/新依赖（除必要的 provider SDK，且能部署到现有 Netlify，并说明原因）。
2. **扩展现有脱敏清单**：在 `CUSTOMER_FORBIDDEN_REPLACEMENTS`（api.mjs + app.js 两处同步）补齐并过滤 `Matrix / SunPace / Sunny / PTE / P01 / P02 / P03`（沿用现有 `'Op'+'enClaw'` 拼接写法避免源码自暴露）。客户交付区还须隐藏 `requested_model/actual_model/provider/fallback/error/provider_job_id/debug`。
3. ⚠️ seed 数据里有 `P03-2026-05-...`（api.mjs:2021+）。客户视图渲染前必须经脱敏，确保这些代号不泄露到客户区。
4. QA 未 passed 的内容**绝不进客户交付区**；fallback 发生必须写内部可见字段；模型失败禁止静默降级。
5. `/api/health` 必须可用并返回版本信息。
6. 目标用户文案统一为「老板 / 企业主 / 商家」，不得出现「小老板」「preview」「内测」字样于客户可见区。
7. 顺手清理废弃目录 `static/internal（内测版）`、`static/internal（内测）`（已被 `_redirects` 301 到 `/internal/`，确认无引用后删）。
8. API key 只放后端环境变量，前端绝不直连模型 API。

---

## 9. 必交的验收材料（按这个清单回报）

1. 改了哪些文件 / 新增哪些页面、接口、adapter。
2. 数据结构说明（asset / task / qa / feishu payload / adapter 接口）。
3. 本地启动方式（`npm run dev`）与 `npm test` 结果。
4. `/api/health` 返回的实际 JSON。
5. 内测入口 URL（`/internal/generation-workbench`）。
6. **测试任务证据**（见 §10），含 project / client / content_plan_record_id / 素材 sha256 / requested_model / actual_model / provider / fallback / provider_job_id / QA 状态 / 客户区是否可见。
7. 浏览器 smoke test 结果 + 控制台是否有错误。
8. 确认客户可见页面**无任何内部代号泄露**（含 §8.3 的 P03 seed）。
9. 异步视频任务的轮询链路演示（submit → generating → poll → generated）。

---

## 10. 必做测试用例（两条）

**用例一（视频，异步 + 先失败再通过）**
- 项目：企业营销工具验收测试；客户：QA测试客户；`content_plan_record_id: qa_content_plan_001`
- 平台：小红书；类型：视频；`requested_model: Seedance 2.0`
- 参考素材：上传测试文件 / mock asset，记录其 sha256
- 走异步链路：submit 拿到 `provider_job_id` → generating → poll → generated
- QA：先 `failed` 一次（记录 rejection_reason），再 `passed`
- 客户交付区：**只显示 passed 后的结果**

**用例二（封面图，同步直接通过）**
- 类型：封面图；`requested_model: GPT-Image-2`；QA `passed`；客户交付区可见

两条都要在回报里贴出最终 task 的关键字段快照。

---

## 11. 部署

代码须保持可部署到现有 Netlify site（id: `f0efe912-abbc-4362-afdc-c9e513cb986c`）。**不要使用任何旧短 ID / `9af65138`。** V1 不要求自动部署，但 build 配置（`netlify.toml`：publish=static，functions=netlify/functions）不得破坏。
```
环境变量（真实接入时配在 Netlify env，V1 mock 不依赖）：
  OPENAI_API_KEY        # GPT-Image-2 生图
  ARK_API_KEY           # Seedance 2.0 视频（火山方舟，已存在）
  ANTHROPIC_API_KEY     # Claude Opus 文案/脚本（已存在）
```
