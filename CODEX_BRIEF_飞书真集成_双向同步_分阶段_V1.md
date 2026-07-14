# Codex 任务书:飞书真集成(多维表格双向同步,分阶段)

> **背景/现状(已核实):** 系统目前**没有真正的飞书联动**——
> - `/api/feishu/sync` 只把任务**格式化**成飞书结构后返回 JSON,代码里明写 `synced:false, mode:'mock'`,**不推送**;
> - **全代码无任何真实飞书 API 调用**(无 `tenant_access_token`、无 `open.feishu.cn`);
> - P03 那批飞书数据是**硬编码种子快照**(base_token `VGSxbfukVaytnPsag3WcD5rZn1e` / table_id `tblDwfGwO84jM2mE`),非活同步。
>
> **目标:** 把 mock 换成**真实的飞书多维表格(Bitable)双向同步**,支撑伊美德儿方案里的"多维表格闭环 + 每日打卡 + 数据回流"。
> **战略权重高**:这是差异化护城河①"落地执行力"的技术落地,不能一直 mock。
> 代码:`netlify/functions/api.mjs`。凭据全走 env。分两阶段、独立部署。

---

## 阶段 A —— 轻量档(内测可用,先把"回流"跑通)

**目的:门店在飞书里录入的打卡/回填/效果数据,能自动回到我们系统,闭环先转起来。** 门店数据天然录在飞书(多维表格 + 表单),先解决"飞书 → 我们"这一向。

### A-1 inbound 接收端点(飞书 → 系统)
- 新增 `POST /api/feishu/inbound`:接收飞书**多维表格自动化**(记录变更触发)回推的数据(每日打卡、效果回填、口碑任务完成…);
- 解析后按 `client_id / 项目 / 门店` 写进 blobs(沿用现有 `cloudStore`,显式 siteID+token);
- 数据落到能进"对标看板 / 多轮优化"的结构(与现有效果数据/记录格式对齐)。

### A-2 【安全红线】inbound 必须鉴权(别再造无鉴权写洞)
- inbound 是**公网可达的写入口**——必须验证:请求头带 `FEISHU_INBOUND_TOKEN`(env),或校验飞书自动化的签名;不匹配 → **401**,不落库;
- **呼应本项目安全教训**:绝不能让它变成任何人都能往我们库里写数据的洞;
- 按 `client_id` 自我隔离:一个门店的回推只能写它自己的数据。

### A-3 outbound 先半自动
- 我们的内容计划/任务入飞书,阶段 A 先用现有 `/api/feishu/sync` 的 payload,经**飞书群机器人 webhook**(env `FEISHU_WEBHOOK_URL`)推消息 / 或人工导入;完整自动写表放阶段 B。

### 阶段 A 验收
1. 配好飞书自动化 + `FEISHU_INBOUND_TOKEN` 后:飞书表单打卡/回填 → 自动回推 → 我们系统 blobs 出现该数据;
2. **无令牌 / 错令牌 POST `/api/feishu/inbound` → 401**(附 curl 自证);
3. 跨门店隔离:A 门店回推写不进 B 门店数据;
4. 不影响现有异步生成/多轮/持久化/P0 限流。

---

## 阶段 B —— 完整档(飞书自建应用 + Bitable API 双向自动)

**目的:系统自动把内容计划/任务/打卡项写进飞书表,自动读回效果/打卡数据——真正的双向同步。**

### B-1 飞书自建应用鉴权
- env:`FEISHU_APP_ID`、`FEISHU_APP_SECRET`;
- 实现 `tenant_access_token` 获取(`/open-apis/auth/v3/tenant_access_token/internal`)+ **缓存**(有效期 ~2h,缓存到 blobs/内存,过期自动重取);别每次调用都换 token。

### B-2 Bitable 读写封装
- 封装多维表格 record 的 **create / update / list**(`/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records`);
- **表标识全 env 可配**(base `app_token` + 各 `table_id`:机构档案 / 素材提交 / 内容生产 / 效果数据 / 每日打卡 / 用户口碑 / 对标看板…)——**把现有 P03 硬编码的 base_token/table_id 改成 env 读取,别再硬编码**。

### B-3 双向同步逻辑
- **出**:系统内容计划 / 生产任务 / 每日打卡清单 → 自动写进对应飞书表(用 `buildFeishuPayload` 的六段结构做字段映射基础);
- **入**:定时/触发拉取飞书表的 打卡 / 效果 / 回填 → 写回系统 blobs → 进对标看板与多轮优化;
- **幂等**:用飞书 `record_id` 与我们的 id 关联,避免重复写 / 重复计数;
- **健壮**:token 失效自动重取;API 失败退避重试;**同步失败不阻塞主流程**(降级不崩)。

### 阶段 B 验收
1. 系统生成一条内容计划 → 对应飞书表自动出现该 record;
2. 飞书表里更新打卡/效果 → 系统自动读回、看板更新;
3. `tenant_access_token` 自动刷新(不每次重取);
4. **跨客户隔离**:A 客户数据不会写进 B 客户的飞书表;
5. `npm test` 通过。

---

## 硬约束(零回归 + 安全)
1. **所有飞书凭据(APP_ID / APP_SECRET / inbound token / webhook URL)走 env,不入 git、不进前端**;
2. **把现有硬编码的飞书 base_token / table_id 改成 env**(P03 种子除外,种子可保留但标注为示例);
3. **inbound 端点必须鉴权 + 按 client_id 自我隔离**——不得成为新的无鉴权写入口(重犯本项目安全教训);
4. 不回归:内部令牌门禁(`/api/customers` 等仍 401)、异步 plan-jobs、多轮、脱敏、持久化、P0 计量限流;
5. `/api/health` 免鉴权 200;每阶段独立部署可回滚、bump 版本。

## 需要你(用户)提供
- **阶段 A**:飞书多维表格建好 + 自动化配置权限;生成 `FEISHU_INBOUND_TOKEN`(强随机)、`FEISHU_WEBHOOK_URL`(群机器人);
- **阶段 B**:飞书**自建应用**(企业管理员创建)→ `FEISHU_APP_ID` / `FEISHU_APP_SECRET`,并开通**多维表格读写权限**;各表的 `app_token` / `table_id`。

## 一句话给 Codex
**先做阶段 A:一个鉴权严格的 `/api/feishu/inbound`,把门店在飞书录入的打卡/回填自动收回系统(闭环先转)。再做阶段 B:飞书自建应用 + Bitable API 双向自动同步,并把硬编码的飞书标识改成 env。inbound 端点的鉴权和跨客户隔离是红线,别造无鉴权写洞。**
