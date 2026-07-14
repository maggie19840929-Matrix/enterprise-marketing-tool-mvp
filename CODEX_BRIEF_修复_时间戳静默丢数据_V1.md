# Codex 任务书:修复 updated_at 字符串比较导致的静默丢数据

> **Bug(压测实测):** 云端项目合并时用 `updated_at` **字符串比较**决定保留新版还是旧版。系统 `nowIso()` 产出**空格格式** `2026-07-13 23:21:07`;一旦某条写入是 **ISO 格式** `2026-07-13T10:00:00Z`,字符串比较里 `空格(0x20) < T(0x54)`,**更新的写入会被判成"更旧"而被静默丢弃——不报错、数据直接没了**。
> 复现:用 ISO 格式 `updated_at` 播一个项目种子 → 再走 `/api/feishu/inbound`(其写入用 `nowIso()` 空格格式)→ inbound 返回 `ok:true`,但读回项目 state **没有** 打卡/效果数据(被合并逻辑丢弃)。改成一致的空格格式后一切正常 → 证实是**格式依赖的静默丢更新**。
> **风险场景**:飞书自动化/前端很容易塞 ISO 时间戳(`toISOString()`、飞书 occurred_at),触发静默丢数据。
> 文件:`netlify/functions/api.mjs`。

---

## 根因
`updated_at` 用 `String(a) >= String(b)` 比较,只有在**所有时间戳格式一致**时才正确。混入 ISO(`T`/`Z`)与空格格式就错乱。

至少两处比较要改:
1. **`writeCloudState`** 按 id 合并时:`(!existing || String(item.updated_at||'') >= String(existing.updated_at||'')) → 保留 incoming`;
2. **`normalizeCloudProjectStore`** 按名去重时的同 completeness 分支:`... && String(item.updated_at||'') >= String(existing.updated_at||'')`。
(自行 grep `updated_at` 的所有 `>=` / `localeCompare` / 字符串比较点,一并修。)

## 修法
- **把时间戳解析成可比数值再比**(如 `Date.parse(x)` / `new Date(x).getTime()`),用 epoch 毫秒比较,不再字符串比;
- **健壮兜底**:任一侧解析失败(NaN)时,**优先保留 incoming**(调用方刚写的、更可能是有意的),**绝不因格式问题静默丢掉新写入**;
- 建议加一个 `toEpoch(ts)` 小工具统一处理,所有 updated_at 比较都走它;
- (可选加固)写入前把 `updated_at` **归一到统一格式**(与 `nowIso()` 一致),从源头消除混格式。

## 硬约束(零回归)
- **保留原意图**:真正更旧的写入仍不能覆盖更新的(防并发 stale clobber)——只是把"谁更新"从字符串判断改成按真实时间判断;
- 不改变落库数据的既有格式导致老数据读取异常;
- 不回归:飞书 inbound(鉴权/隔离/幂等/分类存)、异步生成、多轮、持久化、安全门禁、P0 计量;
- `npm test` 通过;bump 版本号。

## 验收(必须新增回归测试)
1. **本 bug 回归测试**:播一个 `updated_at` 为 **ISO 格式** 的项目 → 再发一条 `nowIso()` 空格格式、真实时间更晚的更新(或走 `/api/feishu/inbound`)→ **断言更新成功持久化**(读回能看到,不被丢);
2. **inbound 落库测试(补齐)**:inbound 打卡/效果后,**读回项目 state 断言 `daily_checkins`/`feedback`/`records` 确实有数据**(不只是断言响应 `ok:true`)——这次的坑正是"返回 ok 但没落库";
3. 混格式两侧仍按真实时间比较,真正更旧的写入不覆盖更新的;
4. `npm test` 通过。

## 一句话给 Codex
**把云端项目合并里所有 `updated_at` 的字符串比较改成"解析成时间再比",解析失败时优先保留新写入,绝不因 ISO vs 空格格式静默丢数据。补一个"ISO种子 + 空格格式更新"的回归测试,并让 inbound 测试读回断言真落库(不只看 ok:true)。**
