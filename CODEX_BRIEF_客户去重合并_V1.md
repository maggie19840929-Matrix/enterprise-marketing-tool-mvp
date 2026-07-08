# Codex 开发任务书:客户去重 / 合并 V1

> 交给 Codex。处理「同一客户散落在多个 client_id 键、聚合列表里重名」的问题。
> **分两层:V1（UI 分组,零数据风险,本期做)+ V2(数据合并,有风险,需备份+逐个确认,本期只设计不自动执行)。**

---

## 0. 现状(已核实)

`/api/customers` 聚合所有 `global-project-store.*` 键,出现同一客户的多条记录:

| 客户 | 重复的 client_id 键 |
|---|---|
| 子武限武术搏击俱乐部 | `anonymous-mqd67u5o-i5irvr`、`anonymous-mqbrw6q8-q6nkmw`、`anonymous-mqap9sxv-k803wl` |
| 中傲少儿篮球训练营 | `basketball`、`default`(无后缀的 `global-project-store`) |

根因:同一客户在不同会话/终端录入,落到了不同键(历史问题)。数据**都在,没丢**,只是重名。

---

## 1. V1：UI 分组去重(本期做,只读、零数据风险)

**目标:** 下拉/列表里同一客户只显示一条,展开能看到/选择它的多个记录。**不改任何 blobs 数据。**

服务端 `/api/customers`(api.mjs):
- 增加按**归一化客户名**分组(去掉"作战台"等后缀、去空格后比较):把同名的多条记录聚成一组,返回结构改为:
```json
{ "customers": [
  { "display_name": "子武限武术搏击俱乐部", "is_test": false,
    "records": [
      { "client_id": "anonymous-mqd67u5o-i5irvr", "project_count": 1, "updated_at": "2026-06-14 10:36" },
      { "client_id": "anonymous-mqbrw6q8-q6nkmw", "project_count": 1, "updated_at": "2026-06-13 11:07" }
    ],
    "primary_client_id": "<records 里 updated_at 最新的那个>" }
] }`
```
- `primary_client_id` = 该组里 `updated_at` 最新的键(默认切入用它)。
- 仍**排除测试键**、清屿花艺仍 `is_test:true` 归"测试/示例"。

前端(app.js「全部客户」下拉):
- 同名客户在下拉里**只出现一条**(用 `display_name`),选中 → 切入 `primary_client_id`(最新记录)。
- 对有多条记录的客户,加一个小标记(如"(3 条记录)")并提供展开方式(可选:二级下拉/小链接)让运营在需要时选具体某条记录(按日期)。**默认走最新那条即可**。
- 空/加载/错误三态保留。

**硬约束:** V1 全程**只读**,不写、不删、不合并任何 blobs 键。

---

## 2. V2：数据合并(本期只设计,不自动执行 —— 需显式批准)

> ⚠️ 合并 = 数据迁移,有风险且基本不可逆。**禁止在本任务里自动跑。** 仅实现一个"预演 + 需确认"的安全流程,留给人工逐客户触发。

设计要点(实现成接口/脚本,但默认 dry-run):
- **先备份**:合并前把涉及的所有源键完整导出(写到一个 `backup/<timestamp>/` blob 或返回 JSON 供人工存档)。
- **选 canonical**:每个客户选一个主键(默认 `updated_at` 最新;或人工指定)。
- **合并项目**:把其余键的 projects 按 project_id 并入主键的 project_store(沿用现有 `mergeProjectStores`/按 id 去重、保留 updated_at 较新者),**不丢任何 project**。
- **dry-run 默认**:接口默认只返回"将合并哪些键、结果预览、是否有 project_id 冲突",**不落库**;只有显式传 `confirm=true` + 备份成功才真正写,且写完**保留源键**(不删,改名/标记 archived 即可)。
- 提供回滚路径(从备份恢复)。

**本期交付 V2 的:仅"dry-run 预演接口 + 设计说明",不接通真正写入。** 真正合并由人工逐客户、带备份确认后再做(后续单独评估)。

---

## 3. 验收材料
1. 改了哪些文件;`/api/customers` 新返回结构(分组)。
2. 下拉里:子武限只剩 1 条(标注多记录)、中傲少儿篮球只剩 1 条;选中能切入最新记录。
3. 清屿花艺仍在「测试/示例」分组。
4. **确认 V1 全程未修改任何 blobs 键**(对比前后键列表 + ETag 不变)。
5. V2 dry-run 接口:对子武限调用返回合并预览,且**未实际写入**。
6. `npm test` 通过;`/api/health` 正常;可部署 Netlify。

---

## 4. 部署
保持可部署到现 Netlify site（`f0efe912-abbc-4362-afdc-c9e513cb986c`,禁用旧短 ID `9af65138`)。
