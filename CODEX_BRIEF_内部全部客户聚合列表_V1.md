# Codex 开发任务书:内部端「全部客户」聚合列表 V1

> 交给 Codex 的权威提示词。**只读聚合,严禁迁移/合并/删除任何数据。**
> 背景:客户数据散落在 blobs 的多个 `global-project-store.<clientId>` 键下;通用 `/internal/` 只读 `internal` 这一个键,导致运营在列表里只看到 1 个客户(其余 4-5 个"看不见但没丢")。本任务:给内部端加一个聚合列表,把所有真实客户在一处列出、点击切入。

---

## 0. 真实存储结构(已核实)

- Blobs store 常量:`CLOUD_STATE_STORE = 'enterprise-marketing-tool-state'`(api.mjs)。
- 每个客户的项目数据键:`global-project-store.<clientId>`(无后缀的 `global-project-store` 是默认/历史键)。
- 读写函数:`readCloudState(clientId)`、`clientScopedCloudStateKey(clientId)`、`cloudStore()`。
- 当前线上**真实客户**(已逐键确认,验收要能列全):

| client_id 键 | 客户名 |
|---|---|
| `internal` | 清屿花艺工作室作战台 |
| `basketball` | 中傲少儿篮球训练营 |
| `dental` | 社区口腔门诊 |
| `florist` | 清屿花艺工作室 |
| `del-doctor-share` | 德尔医生(读时偶发失败,需容错) |
| `anonymous-mq9tnyke-6blj1p` | 德儿医生产后康复中心 |
| `anonymous-mqap9sxv-k803wl` / `anonymous-mqd67u5o-i5irvr` | 子武限武术搏击俱乐部 |
| `anonymous-mqan6t31-wvlobt` | 子武限 |

- 需**排除的测试/探针键**(不得出现在运营列表):`qa-*`、`blob_probe*`、`*-probe`、`prod_*`、`draft_*`、`live_*`、`internal-ux-closure-*`、`*-1781*`(纯数字时间戳测试键)。

---

## 1. 服务端:新增聚合接口 `GET /api/customers`(api.mjs)

- 用 Netlify Blobs 的 **list** 能力枚举键:`store.list({ prefix: 'global-project-store' })`(`cloudStore()` 拿到的 store 对象支持 `.list()`)。
- 对每个键:
  - 解析 clientId:`key === 'global-project-store'` → 视作 `default`/历史;`key.startsWith('global-project-store.')` → clientId = 点号后的部分。
  - 读取该键的 project_store,提取每个 project 的 `name`、`updated_at`、数量。
  - **读失败要容错**(单键报错不能让整个接口挂):try/catch 跳过并标注。
- 返回结构(示例):
```json
{ "customers": [
  { "client_id": "basketball", "names": ["中傲少儿篮球训练营"],
    "project_count": 1, "updated_at": "2026-06-..", "is_test": false }
] }
```
- **过滤测试键**:命中上面"需排除"清单的标 `is_test: true`,默认不返回(或返回但前端隐藏)。优先**直接不返回**测试键,保持列表干净。
- **按 `updated_at` 倒序**返回。

### 硬约束(服务端)
- **只读**。绝不 `setJSON` / 不合并 / 不删除任何键。
- **仅内部可用**:此接口聚合了**所有客户**的清单,属敏感。沿用现有 internal 的判定方式(路由/`mode=internal` 参数)做门槛;若无可靠判定,**加一个共享密钥校验**(读环境变量 `INTERNAL_ACCESS_TOKEN`,缺省时退化为现状)。在代码注释里标注:真正的鉴权由后续登录系统解决(见 `CODEX_BRIEF_配置化单系统重构_V1.md` 的 `client_viewer`/`selfserve_client` profile 与权限计划)。**绝不能让 client_viewer 拿到此接口数据。**

---

## 2. 客户端:内部端「全部客户」列表(app.js + index.html)

- 在内部端(`internal_admin` profile / `isInternalMode()`)新增一个「全部客户」面板/区块(放在内部端靠上的位置;与 6 Tab 计划里的"概览/首页"一致,本期先做成一个 section 即可)。
- 加载时调 `GET /api/customers`,渲染列表:**客户名、项目数、最后更新时间**。
- **点击某客户** → 跳到 `/internal/?client_id=<clientId>`(复用现有 `explicitCustomerClientId()` 加载逻辑,会自动绕过 `keepProjectForCurrentEntry` 过滤、加载该客户数据)。用现有 SPA 路由跳转方式(`initInternalRouteNavigation` 已拦截 `/internal/*`)。
- **空状态 / 加载中 / 错误状态**三态齐全;禁止 `undefined/null/NaN/[object Object]`。
- 仅在内部端渲染;客户端(client_viewer)不得出现此面板。

---

## 3. 不在本期范围(明确划界)

- **不迁移数据**:不要把 `anonymous-*` 的客户合并进 `internal` 或彼此合并——合并有风险,且当前各键各自能访问。本期只做"看得见、点得进"。
- **不改 client_id 落库逻辑**:为什么会散落(专属预设键 + 匿名会话 id)是历史问题,本期不动,以免影响专属客户预设。可在回报里附"后续是否需要统一新客户落库到稳定 client_id"的建议,但**不在本期实现**。

---

## 4. 验收材料

1. 改了哪些文件、新增接口。
2. `GET /api/customers` 实际返回(要能列全 §0 表里的真实客户,且**不含**任何 qa-/probe/prod_/draft_ 测试键)。
3. 内部端「全部客户」列表截图/说明;点击某客户能正确切到其数据(如点"中傲少儿篮球"进入 `?client_id=basketball` 并显示该客户)。
4. 确认 client_viewer 看不到该面板、也调不到该接口(或被门槛拦下)。
5. **确认全程只读、未修改任何 blobs 键**(对比操作前后键列表与 ETag 不变)。
6. `npm test` 通过;`/api/health` 正常;可部署到现 Netlify。

---

## 5. 部署
保持可部署到现 Netlify site(`f0efe912-abbc-4362-afdc-c9e513cb986c`,禁用旧短 ID `9af65138`)。build 配置不变。
