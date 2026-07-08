# Codex 开发任务书:配置化单系统 P3 —— 合并 DOM 容器

> 这是配置化重构(`CODEX_BRIEF_配置化单系统重构_V1.md`)的**最后一阶段 P3**。P0/P1/P2 已完成(VIEW_PROFILES、共享旅程组件、profile 渲染、isInternalMode 大幅减少均已上线)。
> P3 目标:把现在仍并存的**两棵 DOM 树合并成一个 shell**,由 profile 驱动渲染,彻底变成"一套系统"。
> ⚠️ **先读"价值与风险评估",再决定是否现在做。**

---

## 0. 价值与风险评估(务必先看)

**现状**:`static/index.html` 里仍有两个并列容器 `#customerApp` 和 `#internalApp`,靠 `setAppShell`(app.js)按路由/profile 显隐其一。但**逻辑层已经大量共享**(VIEW_PROFILES、共享旅程组件、profile 渲染,21 处引用)。

**坦诚判断**:
- "维护一套系统"的**主要收益在 P1/P2 已经拿到**(逻辑去重、配置化)。
- P3(合并 DOM 容器)是**风险最高、边际收益最低**的一步——容器虽并存,但内容大多已 profile 化。
- 最近客户版有一串重要修复(数据持久化、平台提到首页、策略轻量化、按钮修复),**P3 一旦回归会很难查**。

**建议**:**只有当"两棵 DOM 并存"真的造成维护痛点时才做 P3;否则可以长期搁置。** 如果决定做,本任务书要求**极致保守 + 全量回归**。

---

## 1. 目标

把 `#customerApp` 与 `#internalApp` 合并为**单一容器 shell**:
- 删除"两棵并列 DOM 树"的重复结构;
- 页面区块(录入/方案/复盘/工作台/全部客户/各 Tab)由 `currentProfile().tabs` + profile 决定渲染哪些、以什么密度渲染;
- `client_viewer` profile → 渲染客户轻量视图;`internal_admin` → 渲染完整内部视图;
- 路由(`/` vs `/internal*`)→ 决定 profile → 决定 shell 内容。

---

## 2. 硬约束(任一回归即不通过)

**这是本任务书的核心。最近的修复和体验必须 100% 保留。**

### 客户版 `/`(client_viewer)零回归:
1. **数据持久化**:填信息→生成→关浏览器→重开,内容仍在(localStorage + 不被"专属客户过滤"误清,见 `isDedicatedCustomerState` 逻辑)。
2. **首页含平台 + 生成策略**(必显,不在折叠里);3 必填 + 补充更多折叠。
3. **策略轻量视图**:7 天极简卡(理由折叠)、记录三步、下一个七天(结论+勾选动作+依据折叠)。
4. 「开始填写/补充信息」「修改信息并重新生成」按钮:展开+回填+滚动。
5. **零内部代号/内部字段泄露**。

### 内部版 `/internal/`(internal_admin)零回归:
6. 完整密度(诊断/计划/复盘全信息);
7. **素材生成工作台**(`/internal/generation-workbench`)正常;
8. **「全部客户」下拉**正常(聚合、点击切入);
9. hero 三个真路由按钮(内测填写/查看结果/工作台)+ 高亮同步。

### 通用:
10. 不改任何**服务端逻辑 / 模型路由 / 存储 key / profile 定义**;只动前端 DOM 结构与渲染编排。
11. 不引入新框架/新依赖;`npm test` 通过;`/api/health` 正常;可部署 Netlify。

---

## 3. 做法建议(渐进、可回退)

1. **不要一次性重写 index.html**。建议:把 `#internalApp` 独有的区块逐个迁移/合并进统一 shell,每迁一块就回归一次客户版+内部版。
2. profile 驱动:`currentProfile().tabs` 决定显示哪些区块;`isInternalProfile()` 决定密度。
3. 保留所有现有 id(`#customerFormCard`、`#generationWorkbench`、`#allCustomersPanel`、`#diagnosisWorkflow` 等),避免 JS 选择器失效;只调整它们的**容器归属**,不改 id。
4. `setAppShell` / 容器显隐逻辑相应简化为"一个 shell + profile 控制区块"。

---

## 4. 验收材料(必须逐条证明)

1. 改了哪些文件;DOM 从 2 容器变 1 容器的结构说明。
2. **客户版全流程回归**:录入(含首页平台/策略)→ 生成 → 关浏览器重开内容仍在 → 选抖音只出抖音 → 记录三步 → 下一个七天。截图/录屏。
3. **内部版回归**:诊断/计划/复盘、工作台、全部客户下拉、hero 按钮全可用。
4. 客户视图泄露扫描:P01-03/Matrix/SunPace/Sunny/PTE/OpenClaw/Hermes + 内部字段 = 0。
5. `grep -c 'id="customerApp"\|id="internalApp"' static/index.html` 的前后对比(应从 2 → 1)。
6. `npm test`、`/api/health`、控制台无报错。

---

## 5. 部署
保持可部署到现 Netlify site(`f0efe912-abbc-4362-afdc-c9e513cb986c`,禁用旧短 ID `9af65138`)。

---

## 6. 一句话给 Codex
**这是收尾性重构,价值有限、风险最高。务必逐块迁移 + 每步全量回归,任何客户/内部体验回归都不接受。若过程中发现风险过高,停下来报告,不要硬合。**
