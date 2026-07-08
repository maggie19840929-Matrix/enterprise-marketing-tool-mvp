# Codex 开发任务书:配置化「单系统」UI 重构 V1

> 交给 Codex 的权威提示词。目标:把现在「内部端 / 客户端两套 DOM + 满地 `isInternalMode()` 分支 + 客户旅程实现两遍」收敛为**一套组件 + 一份视图配置(VIEW_PROFILES)+ 角色映射**,让团队**维护一套系统而非两套**。
> **严禁推倒重写**,严禁破坏客户主流程,分阶段渐进迁移。
> 配套文档(先读):`区块清点与归屏映射_V1.md`(6 Tab / 3 步映射)、`变现方案_三层产品与算力豆_V1.md`(角色/产品分层)。

---

## 0. 必读:真实代码与现状

| 文件 | 现状 | 关键锚点 |
|---|---|---|
| `static/index.html` | **两棵 DOM 树**:`#customerApp`(3 区块)+ `#internalApp`(12 区块) | 客户旅程被实现两遍 |
| `static/app.js`(3488 行,原生 JS) | ~35 个 render 函数,满地 `isInternalMode()` 分支 | `isInternalMode()` app.js:67-69;容器切换 app.js:956-964(`customerApp.hidden = internal`) |
| `netlify/functions/api.mjs` | **安全边界已在服务端**:`sanitizeCustomerPayload`(:32-57)、`/generation-tasks?view=client` 只回 QA passed、`client_id` 数据隔离 | 这是真正的安全闸,**不许削弱** |

**核心问题:客户旅程层(录入/方案/复盘)在 `customerApp` 和 `internalApp`(diagnosisWorkflow / internalResultSection / planSection / feedbackWorkflow)各实现一遍** → 改一处要改两处,易漏(现两个 hero 标题不一致即为此)。

---

## 1. 目标架构

```
路由/登录 → 角色 → getProfile(role) → 一套组件读 profile 渲染
```

不再有 `if (isInternalMode()) {...} else {...}`,改为组件读 `profile` 的声明式开关。`#customerApp`/`#internalApp` 合并为**一个 shell**;客户端 = 用 `client_viewer` profile 渲染出的同一套组件。

### 1.1 VIEW_PROFILES(方案心脏,新增到 app.js)

```js
const VIEW_PROFILES = {
  internal_admin: {
    tabs: ['overview','strategy','plan','generate','qa_deliver','data'],
    sanitize: false, delivery: 'all', intake: 'full',
  },
  client_viewer: {                              // 当前客户端 = 这个 profile
    tabs: ['strategy','plan','deliver','data'],  // 无生产/QA机器
    sanitize: true, delivery: 'qa_passed_only', intake: 'minimal',
  },
  selfserve_client: {                           // 预留:算力豆自助
    tabs: ['strategy','plan','generate','deliver'],
    sanitize: true, delivery: 'qa_passed_only', quota: 'beans',
  },
  outsourced_worker: {                          // 预留:外包
    tabs: ['generate'], sanitize: true, assignedOnly: true,
  },
};
const getProfile = (role) => VIEW_PROFILES[role] || VIEW_PROFILES.client_viewer;
```

**当前阶段角色判定**(沿用现有路由,先不做完整登录):
- `/internal*` → `internal_admin`
- `/`(根)→ `client_viewer`
- `selfserve_client`/`outsourced_worker` 先**只定义不启用**(后续登录系统接入),但组件必须能吃这两个 profile。

### 1.2 Tab / 步骤组件集(各写一次)

按 `区块清点与归屏映射_V1.md`:
- 内部 6 Tab:`overview / strategy / plan / generate / qa_deliver / data`
- 客户 3 步(= client_viewer 的 `strategy`/`plan`/`deliver` 的简化渲染):录入 → 方案 → 记录复盘

每个组件读 profile 决定:显示与否(`tabs` 含不含)、字段集(`intake: minimal|full`)、数据过滤(`delivery`)、是否显示内部字段(`sanitize`)。

---

## 2. 硬约束(违反即不通过)

1. **安全边界留服务端,配置只管展示。** profile 的 `sanitize`/`delivery` 在前端是"少渲染",在服务端**必须是真过滤**——继续用现有 `sanitizeCustomerPayload` + `view=client`。**绝不允许**把"客户不可见"只做成前端隐藏(可被绕过)。客户 profile 请求数据时必须带 `view=client`,由服务端脱敏 + 只回 QA passed。
2. **不破坏客户主流程**:重构后,根路径 `/` 客户看到的内容/交互**不得回归**(录入→方案→记录仍可用),且**零内部代号/内部字段泄露**(P01-03/Matrix/SunPace/Sunny/PTE/OpenClaw/Hermes;requested_model/provider/fallback/debug)。
3. **不推倒重写、不引入新框架**:仍是原生 JS + 现有 API + Netlify blobs。
4. **不改服务端业务逻辑**:本任务是前端结构重构,api.mjs 除必要的 `view`/角色参数对齐外不动业务。
5. `/api/health` 可用;`npm test` 通过;可部署到现 Netlify。

---

## 3. 分阶段迁移(渐进,风险从低到高,可分次交付)

### Phase 0 — 速赢(可独立先交付,低风险)
- 客户录入(intake)`minimal` 化:必填仅 `行业/业务`、`目标`、`目标客户`;其余字段折叠进"补充更多(可选)",能预填先预填。
- 调试 / 模型信息 / QA 证据默认**折叠**。
- 统一两个 hero 标题。
> 这步即使不做后续阶段也能立刻缓解"信息太多"。

### Phase 1 — 杀重复(收益最大)
- 把客户旅程层(录入/方案/复盘)从 `customerApp` 与 `internalApp` 的**两套实现**,抽成**一个带 `profile` 参数的共享 render 组件**;删除 `customerApp` 里的副本。
- 验收:客户端与内部端的"录入/方案/复盘"由**同一份代码**渲染。

### Phase 2 — 引入配置
- 加入 `VIEW_PROFILES` + `getProfile(role)`;把散落的 `isInternalMode()` 分支逐个替换为读 `profile`。
- 验收:`grep isInternalMode static/app.js` 显著减少;新增/调整可见性 = 改配置,不写新组件。

### Phase 3 — 合并容器
- `#customerApp` / `#internalApp` 合并为单一 shell,Tab/步骤由 `profile.tabs` 生成。
- 验收:DOM 不再有两棵并列的 app 树;客户端 = client_viewer profile 渲染结果。

---

## 4. 验收材料(交付时回报)

1. 改了哪些文件、各阶段做到哪。
2. `VIEW_PROFILES` 最终结构 + 角色判定逻辑。
3. **去重证据**:客户旅程层已是单一实现(指出共享组件函数名)。
4. `isInternalMode()` 出现次数 before/after。
5. **无回归证据**:根路径 `/` 客户旅程仍可用(录入→方案→记录截图或 smoke)。
6. **无泄露证据**:客户视图(view=client)扫描 P01-03/Matrix/SunPace/Sunny/PTE/OpenClaw/Hermes + requested_model/provider/fallback/debug,全为 0。
7. `npm test` 结果、`/api/health` 返回、浏览器 smoke、控制台无报错。
8. 确认服务端仍是安全边界(客户 profile 走 `view=client` + 服务端脱敏)。

---

## 5. 部署
保持可部署到现 Netlify site(`f0efe912-abbc-4362-afdc-c9e513cb986c`,禁用旧短 ID `9af65138`);build 配置(publish=static,functions=netlify/functions)不得破坏。

---

## 6. 这次重构同时打好的地基
- 6 Tab 拆分 = `profile.tabs`
- 权限隔离 = 选哪个 profile
- 算力豆自助 / 外包 = 加一个 profile,零新组件
→ 一次 IA 重构,把**维护(一套系统)、权限、自助**三件事的地基一起打了。
