# Codex 任务书:生成延迟治理(两阶段)——先快赢保发布,再异步一劳永逸

> **现状/根因(已实测):** `POST /api/assessments` 一次同步火山调用 `callArkPlanRows`(`netlify/functions/api.mjs` ~1615),
> 用旗舰推理模型 `doubao-seed-2-0-pro`(ARK 端点 `ep-20260610235734-m8mg8`),一口气出 **7 条 × 7 字段** JSON(maxTokens ~2200),
> prompt 里 `JSON.stringify({assessment,diagnosis}, null, 2)` 把整对象美化塞入。实测 17–24s,逼近 Netlify 函数 ~26s 上限,`MODEL_TIMEOUT_MS=23s` 只剩 2–3s 余量,慢一点就 504。
>
> **分两阶段做:阶段一(A+B+D)立即上、保发布;阶段二(C 异步)随后做、彻底摆脱 26s 限制。**
> 关键入口:`callArkPlanRows`/`contentPlanPrompt`(~1542/1615)、`callArkChatCompletion`(~204)、`createContentPlan`(~1689)、`MODEL_TIMEOUT_MS`(~22)。

---

# 阶段一 —— 快赢(A+B+D),目标把生成压到 ≤12s 且不再 504

## A. 换更快的模型档
- 给**内容计划生成**这条调用单独用一个更快的火山档(doubao **lite / flash** 类),不要再用旗舰 `seed-2-0-pro` 出 7 条短选题。
- 实现上:新增 env `ARK_PLAN_MODEL`(计划生成专用端点),`callArkPlanRows` 优先用它,未配置时回落现有 `ARK_MODEL`。**别动** `/api/customer-growth-advice`、诊断等其它调用的模型。
- **必须 A/B 抽验质量**:用 3 个真实业务(如少儿篮球 / 宠物洗护 / 社区烘焙)对比新旧模型产出的 7 条选题,确认新档不明显降质(选题具体、贴业务、平台语境对)。降质就换下一个档,别硬压速度牺牲质量。

## B. 砍输出 token
- prompt 改为**只让模型产出核心字段** `topic, angle, content_type, cta`;`target_metric / publish_quality / quality_note` 改由**规则后处理补齐**(参照现有 `planTemplates` 的默认值逻辑),不再劳模型生成。
- **但 `createContentPlan`(~1710)下游仍按 7 元组解构**,所以 `rowsFromModelJson` 解析后要把缺的 3 个字段补上默认值,保证 row 结构不变、下游和测试不炸。
- 给字符串**加长度上限**(像 `customerAdvicePrompt` 那样"≤N 字"),plan prompt 现在没限长——加上。
- prompt 里**去掉 `null, 2` 美化**,且只喂模型需要的字段(industry/main_goal/target_customer/platforms/pain/biggest_problem + diagnosis 的 priority_problem/platform_recommendations),别塞整个 diagnosis 对象(它现在还含模型元数据)。

## D. 安全垫(防 504 + 改善观感)
- `MODEL_TIMEOUT_MS` 默认从 23000 **降到 18000–20000**:让"模型超时 → 退 `rule_template` 兜底"能在函数被 Netlify 掐断前**返回 201**,宁可偶尔出模板也不要 504 白屏。确认这条兜底路径确实在超时后被触发并返回。
- 前端 spinner(`static/app.js` `withBusy(triggerButton, '正在生成建议...')`)换成**分段进度文案**(如 分析业务 → 生成选题 → 适配平台),让等待显得在干活。纯文案,不改逻辑。

## 阶段一验收
1. 3 个真实业务连打,`POST /api/assessments` 用时 **≤12s**(给出实测数字);
2. 质量 A/B:新档 7 条选题不明显差于旧档(附对比);
3. 平台仍生效(选抖音→7 条全抖音)、row 仍是完整 7 字段、`npm test` 通过;
4. 模拟模型慢(可临时调低 timeout)时返回的是 **201+兜底模板**,不是 504;
5. 客户响应仍无 `ep-`/模型元数据(不回归安全整改成果)。

---

# 阶段二 —— 异步化(C),彻底摆脱 26s 上限

把内容计划生成改成 **提交 → 轮询**,POST 立刻回 `task_id`,后台生成,前端轮询取结果。生成再慢也不受函数同步上限约束。

## 要点
- **复用已有 task 基建的模式**(`submitGenerationTask`/`pollGenerationTask` 的思路),但——
- **⚠ 关键坑:现有 `/api/generation-tasks*` 已被安全整改列为内部令牌保护(见 `CODEX_BRIEF_安全整改_内部鉴权与数据隔离_V1.md` P0-2)。客户异步生成绝不能走那条被网关的路,也绝不能为此重新打开它。** 需要一条**客户可用、按 client_id 自我隔离、免内部令牌**的异步通道:
  - `POST /api/assessments`(或新 `/api/plan-jobs`):建任务,持久化到 blobs(键含 client_id),立即返回 `{job_id, status:'pending'}`;
  - `GET /api/plan-jobs/:id?client_id=xxx`:**只允许读该 client_id 自己的任务**(能力令牌模型,和 `/api/state` 一致),返回 status/结果;
  - 不得暴露跨客户任务列表、不得无 client_id 枚举。
- 后台生成沿用阶段一优化后的 `callArkPlanRows`(快模型+少字段)。
- **前端**(`submitCustomerAssessmentPayload`):改为 POST 拿 job_id → 轮询 → 出结果再 `renderCustomerGeneratedState`;轮询期间显示分段进度;失败/超时回落兜底并给友好提示。**localStorage 持久化、重开读回、多轮逻辑全部保持不变。**
- 轮询要有上限与退避,别无限打。

## 阶段二验收
1. 匿名客户(无内部令牌)走完 提交→轮询→出结果,正常;关浏览器重开仍能读回(持久化不回归);
2. `GET /api/plan-jobs/:id` 只能读自己 client_id 的任务;跨 id / 无 id 拿不到别人任务(附 curl 证明,不回归安全);
3. `/api/generation-tasks*` 仍是内部令牌保护(没被重新打开);
4. 即使生成 30s+ 也不再 504;`npm test` 通过。

---

## 硬约束(两阶段通用)
- 不改平台逻辑(`planPlatforms`)、多轮生成、脱敏(代号)、blobs 持久化、安全整改成果(枚举 401、客户响应无元数据)。
- 模型端点/令牌走 env,不硬编码、不入 git。
- 阶段一、阶段二**分开部署**:阶段一先上并验收通过(它就够发布了),阶段二再做。
- 每阶段 bump 资源版本号;`/api/health` 免令牌 200。

## 一句话给 Codex
**阶段一:把计划生成换成火山轻量档 + 只出 4 个核心字段 + 收紧 prompt,并把 `MODEL_TIMEOUT_MS` 降到 ~19s 让兜底能返回——目标 ≤12s、不再 504、质量抽验不降。阶段二:把计划生成改成客户自我隔离(按 client_id、免内部令牌)的提交→轮询异步,注意别碰已被网关的 `/api/generation-tasks*`。两阶段分开部署,阶段一先发。**
