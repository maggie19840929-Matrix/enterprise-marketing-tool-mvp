# 企业营销工具 MVP 部署交接

## 项目路径

`/Users/matrix_core/enterprise_marketing_mvp`

## 当前状态

新版代码已落盘并通过本地测试。8787 端口当前有旧进程占用，正式部署需要重启 MVP 服务。

## 已验证

```bash
cd /Users/matrix_core/enterprise_marketing_mvp
python3 -m pytest tests -q
python3 -m py_compile app.py business.py seed.py
```

验证结果：`7 passed`

独立端口 smoke test 已通过：
- `/api/health` 正常
- `POST /api/assessments` 正常生成诊断与 7 天计划
- `POST /api/feedback` 正常回填
- `POST /api/reviews` 正常生成周复盘

## 启动命令

```bash
cd /Users/matrix_core/enterprise_marketing_mvp
python3 seed.py
python3 app.py
```

默认访问：

`http://127.0.0.1:8787`

如 8787 被占用，可临时：

```bash
PORT=8877 python3 app.py
```

## 端口占用注意

上次检查到：

```text
60955 /Library/Frameworks/Python.framework/Versions/3.11/Resources/Python.app/Contents/MacOS/Python app.py
61239 /Library/Frameworks/Python.framework/Versions/3.11/Resources/Python.app/Contents/MacOS/Python /Users/matrix_core/.hermes/scripts/matrix_epaper_health_api.py
```

部署时只允许处理企业营销工具 MVP 对应的 `app.py` 进程。不要误杀 `matrix_epaper_health_api.py`。

建议部署前重新确认：

```bash
lsof -nP -iTCP:8787 -sTCP:LISTEN
ps -p <PID> -o pid,command
```

## 部署验收

部署后必须回传以下证据：

1. 启动命令和 PID
2. `lsof -nP -iTCP:8787 -sTCP:LISTEN` 输出
3. `curl -s http://127.0.0.1:8787/api/health`
4. `curl -s http://127.0.0.1:8787/api/dashboard`
5. 浏览器或接口确认新版字段存在：`feedback_rate`、`/api/reviews`、7 天计划、诊断评分

## 第一版功能

- 客户营销体检
- 自动诊断报告
- 营销闭环评分
- 7 天内容发布计划
- 发布反馈回填
- 周复盘生成
- 下一轮优化建议

## 边界

这是营销增长闭环 MVP，不是 CRM/ERP。第一版不做登录权限、合同报价、客户生命周期、销售线索流转、平台自动采集。