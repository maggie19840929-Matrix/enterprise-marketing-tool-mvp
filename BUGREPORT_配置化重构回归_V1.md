# Bug 报告:配置化单系统重构(commit 49ffd57)两处回归

> 交给 Codex 修复。基于 `CODEX_BRIEF_配置化单系统重构_V1.md` 的重构产物。
> **现状:生产已回滚到重构前可用版(运营在用);本 bug 修复在 49ffd57 基础上进行,修好验证后再重新部署。**
> **重要:客户数据未丢失**——已确认线上 blobs 仍有 `client_id='internal'` 的项目(`清屿花艺工作室作战台`)。BUG2 是"读不出/没显示",不是数据丢失,**禁止任何"重建/初始化"数据的操作**。

---

## BUG 1:进入素材生成工作台后显示的是「内测填写」而非工作台

**复现**:在 `/internal/` 点击「素材生成工作台」(链接 `href="/internal/generation-workbench"`)→ 页面显示内测填写(diagnosisWorkflow),工作台(`#generationWorkbench`)不显示。

**疑似根因**:路由相关的显隐只在**首次加载**时应用,客户端导航/再渲染时未重应用。
- `setAppShell()`(app.js:996)负责切换 `#customerApp`/`#internalApp` 容器,并 `document.body.classList.toggle('generation-workbench-mode', isGenerationWorkbenchRoute())`(:1013)。**它只在 app.js:3842 顶层被调用一次。**
- CSS 靠 `.generation-workbench-mode #diagnosisWorkflow{display:none!important}`(styles.css)隐藏内测填写、显示工作台。若 `setAppShell()` 不随路由变化重跑,该 body class 不更新 → 工作台路由下内测填写没被隐藏。
- `renderGenerationWorkbenchRoute()`(:3613)虽在 `renderAllFromClient()` 末尾调用,但若导航没触发完整 init/正确路由判定,显隐结果不对。

**修复方向**:让**路由变化时重新评估并应用** `setAppShell()` + 工作台显隐(+ `loadGenerationWorkbench()`)——即把"首次加载才做的事"绑定到导航(链接点击拦截 / `popstate` / hash 变化),而非只在加载时执行一次。验证:在 `/internal/` 点工作台链接后,`#generationWorkbench` 显示、内测填写隐藏;直接访问 `/internal/generation-workbench` 也正确。

---

## BUG 2:内部端原有客户信息不显示

**复现**:`/internal/` 看不到此前录入的客户/项目。

**确认**:数据在 blobs(`client_id='internal'` 下有项目)。**不是数据丢失。**

**疑似根因**:`customerClientId()`(app.js:659)= `explicitCustomerClientId() || (isInternalProfile() ? INTERNAL_CLIENT_ID : readSessionClientId())`。重构把判定从 `isInternalMode()` 换成 `isInternalProfile()`(依赖 `currentProfile()/roleFromRoute()`)。若在数据加载时序里该判定解析为 `client_viewer`(非 internal),`customerClientId()` 会返回 `readSessionClientId()`(随机会话桶)→ 读到空数据 → "客户信息全没了"。
- 同时检查 `projectsStorageKey()`/`appStateStorageKey()`(:666/671)的 `isInternalProfile()` 分支、`pullCloudProjectStore()`(:470 用 `mode=internal`)、以及 `keepProjectForCurrentEntry()`(:386)是否把项目过滤掉。

**修复方向**:确保在 `/internal/*`(含工作台子路由)所有路径下 `isInternalProfile()`/`customerClientId()` 稳定返回 internal、`INTERNAL_CLIENT_ID`;internal 视图加载后能渲染出 blobs 里既有项目(用 `清屿花艺工作室作战台` 验证可见)。

---

## 共性怀疑 & 修复原则

两个 bug 很可能同源:**重构把"路由/角色相关状态"集中化,但只在初始加载求值一次,未在导航/再渲染时重新求值。** 优先排查"路由变化时 profile / shell / clientId 是否被重新评估"。

修复后必须回报:
1. `/internal/` 点工作台链接 → 工作台正确显示(截图/说明)。
2. `/internal/` 能看到既有项目 `清屿花艺工作室作战台`。
3. 直接访问 `/internal/generation-workbench` 正确。
4. **客户视图泄露扫描**(view=client)P01-03/Matrix/SunPace/Sunny/PTE/OpenClaw/Hermes + requested_model/provider/fallback/debug 全 0。
5. `npm test` 通过;`/api/health` 正常。
6. 全程**未触碰服务端数据**(blobs)。

修好后通知,我会本地+线上复验再部署。
