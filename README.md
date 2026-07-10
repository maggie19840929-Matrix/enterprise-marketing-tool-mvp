# 企业营销增长工具 MVP

当前线上/内测版：`static/` 原生前端 SPA + `netlify/functions/api.mjs` 单个 Netlify Function，用于展示营销体检、自动诊断、7天计划、反馈回填、周复盘闭环，以及 `/internal/generation-workbench` 项目化素材生成与验收工作台。

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
9. 内部端全部客户聚合、项目复盘、素材生成与 QA 交付工作台

## 数据库

当前线上版本不使用 SQLite。生产环境优先使用 Netlify Blobs 保存项目态；无 Blobs 环境时，Netlify Function 会降级为内存 fallback 以便本地 smoke test。

主要 store：

- `enterprise-marketing-tool-state`：客户项目、内容计划、反馈记录、生成任务、素材登记等状态。
- `global-project-store.<clientId>`：按客户/内部视图分隔的项目状态。
- `assets/<client_id>`：内部素材工作台素材集合。
- `tasks/<client_id>`：内部生成任务集合。

## API

- `GET /api/health`
- `POST /api/assessments`
- `POST /api/customer-growth-advice`
- `GET /api/state`
- `POST /api/state`
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
- `POST /api/feishu/sync`

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

飞书回写 V1 只提供 adapter mock：`POST /api/feishu/sync` 返回 A 客户资料 / B 内容计划 / C 外包制作 / D 内部验收 / E 客户交付 / F 数据回流 六类 payload，不真连飞书。

### 豆包 / 火山方舟文本模型

客户 public 版默认通过 Netlify Function 后端调用火山方舟 OpenAI-compatible Chat Completions API，前端不会暴露 API Key。需要在 Netlify 环境变量中配置：

```bash
ARK_API_KEY=火山方舟 API Key
ARK_MODEL=火山方舟模型 Endpoint ID，例如 ep-xxxxxxxxxxxxxxxxxxxxx
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
