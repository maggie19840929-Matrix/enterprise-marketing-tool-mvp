# 企业营销增长工具 MVP

当前线上/内测版：`static/` 原生前端 SPA + `netlify/functions/api.mjs` 单个 Netlify Function，用于展示营销体检、自动诊断、7天计划、反馈回填、周复盘闭环，以及 `/internal/generation-workbench` 项目化素材生成与验收工作台。

早期 Python/SQLite 版本已废弃，仅保留历史说明，不作为当前线上架构参考。

## 启动

```bash
cd /Users/matrix_core/enterprise_marketing_mvp
python3 seed.py
python3 app.py
```

打开：<http://127.0.0.1:8787>

## 已包含模块

1. 3分钟营销体检
2. 自动营销诊断
3. 3条内容发布建议
4. 本周发布计划
5. 营销反馈回填
6. 下一轮优化建议看板

## 数据库

默认数据库：`marketing_mvp.sqlite3`

表：

- `assessments`：营销体检
- `diagnoses`：诊断结果
- `content_plans`：发布计划
- `feedback`：营销反馈

## API

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/assessments`
- `GET /api/diagnoses`
- `GET /api/plans`
- `GET /api/feedback`
- `POST /api/assessments`
- `POST /api/feedback`
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
python3 -m pytest tests -q
python3 -m py_compile app.py business.py seed.py
python3 app.py
curl -s http://127.0.0.1:8787/api/health
curl -s http://127.0.0.1:8787/api/dashboard
```

## Netlify

`netlify.toml` 已配置：

- Publish directory: `static`
- API rewrite: `/api/*` → `netlify/functions/api.mjs`

Netlify Function 在生产环境优先使用 Netlify Blobs 保存项目态；无 Blobs 环境时自动降级为内存 fallback，便于本地验证。

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

如果未配置 `ARK_API_KEY` 或 `ARK_MODEL`，接口不会报错，但会明确返回 `provider: "local"`、`actual_model: "rule_template"`、`fallback: true` 和具体 `fallback_reason`，用于验收区分真实模型调用和规则兜底。

## 第一版边界

这是营销增长闭环 MVP，不是 CRM/ERP/管理系统。

第一版不做：

- 登录和权限
- 合同、报价、审批
- 客户生命周期跟进
- 多人协同冲突处理
- 线上部署和备份
- 平台自动采集/API 对接

## 下一步

如果客户验证通过，再升级：

1. 登录和角色权限
2. Excel/飞书导入导出
3. 客户真实案例模板库
4. 每周营销复盘报告
5. 平台数据自动采集
6. 线上部署和定时备份
