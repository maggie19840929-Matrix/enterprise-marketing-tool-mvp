# 企业营销增长工具 MVP

本地第一版：SQLite 后台数据库 + Python 标准库 API 服务 + Web/移动端自适应页面。

线上 Netlify 演示版：`static/` 前端 + `netlify/functions/api.mjs` 演示 API，用于展示营销体检、自动诊断、7天计划、反馈回填和周复盘闭环。

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

Netlify 演示 API 使用内存数据，适合客户演示；正式版仍建议使用 Python 服务 + 持久化数据库部署。

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
