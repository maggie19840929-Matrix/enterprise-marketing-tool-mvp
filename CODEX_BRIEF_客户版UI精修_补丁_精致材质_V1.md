# Codex 补丁：客户版 UI「精致材质」三项(V1 精修的遗漏)

> 上一轮 V1 把密度/信息层级做好了(hero 精简、示例胶囊删除、标题排版收敛),
> 但 §2/§3 的"材质层"跳过了 —— 卡片还挂着重投影 + 大圆角,观感仍是"SaaS 面板"而非"高端官网"。
> 本补丁只补这三项,**全是 CSS,别动 HTML 结构和任何 JS**。改完 bump 资源版本号(`?v=` 从 1.6.79 往上)。
> 文件:`static/war-room-v1.6.1.css`(以及必要时同名客户样式)。

---

## 1. 去掉重投影 → 发丝边 + 极淡投影(最关键)

现状:
```css
--war-shadow: 0 24px 80px rgba(0,0,0,.38);      /* 太重,像悬浮面板 */
.customer-card{ ... box-shadow:var(--war-shadow) !important; }
/* 另有一处 box-shadow:0 24px 80px rgba(0,0,0,.45) 更重,一并处理 */
```
改为(客户版卡片):
```css
.customer-card{
  border:0.5px solid rgba(17,24,39,.10) !important;   /* 发丝线;暗色主题下用 rgba(255,255,255,.10) */
  box-shadow:0 1px 2px rgba(0,0,0,.04) !important;     /* 极淡,几乎无 */
}
```
- 不要再让客户卡引用 `--war-shadow`。若 `--war-shadow` 别处(内部版/弹层)还在用,**别改全局变量**,只覆盖 `.customer-card`(及客户专属卡)的 `box-shadow`,避免影响 `/internal`。
- 那处 `rgba(0,0,0,.45)` 的重投影若也落在客户视图,同样调淡;若只在内部版,别动。

## 2. 圆角收敛:26px → 16px

现状 `.customer-card{ border-radius:26px !important; }`(还有 22px 混用)。
- 卡片统一 `border-radius:16px`。
- 胶囊/按钮保持 `999px`。
- 客户视图里其它 20/22/26 的圆角一并归到 **16(容器)/ 999(胶囊)** 两档;别动内部版。

## 3. 首屏 5 步进度条弱化

现状 `.customer-progress-strip` 已缩小,但完整 5 步仍压在首屏表单顶部。二选一:
- **首选**:首屏只显示极简指示(如"第 1 步 / 共 5 步"小字或一条细进度线),用户进入第 2 步(确认方向)后再展开完整 stepper;
- 或退一步:进一步压扁——去掉每个 `.cps-item` 的边框/背景,只留圆点+文字,让它像一行安静的面包屑,不像 5 个按钮。
- 保留所有 `data-customer-step-target` / `id="customerProgressStrip"` 钩子,只改样式与显隐时机。

## 4. 页脚 meta 收成一行(公司名 · 邮箱 · 备案号)

现状 `.customer-footer-meta` 里三个并排元素(公司名/邮箱/备案号)在窄屏会折行,视觉像两行。
- 目标:桌面呈现为**一条**:`© 2016–2026 南京尚下联信息科技有限公司 · contact@fpmatrix.cn · 苏ICP备2026037570号`。
- 做法:保留三个子元素(**别删邮箱和备案链接,`href` 不动**),在相邻项之间用 `·` 分隔——建议 CSS `.customer-footer-meta > *:not(:first-child)::before{content:"·";margin-right:14px;opacity:.5;}`(或等效),不要把文案硬拼进一个 span。
- 首个 `Copyright 2016-2026` 文案可顺手改成 `© 2016–2026`(更精致);备案号 `a.customer-filing-link` 链接**保持指向 beian.miit.gov.cn**(合规要求,不能去掉可点链接)。
- 手机窄屏放不下时**允许优雅折行**,不要强行 `white-space:nowrap` 撑破容器。

---

## 硬约束(同 V1,重申)
- **只改 CSS**;不删/不重命名任何 `name`、`data-customer-*`、`id` 钩子;不改 JS 逻辑。
- **不碰 `/internal`**:凡是内部版也在用的全局变量/类,只做客户版覆盖,别改全局。
- 中文字体不引入 Google Fonts CDN(维持现状)。
- CTA 紫色强调色**保持不动**(已确认)。
- `npm test` 通过;`/api/health` 正常;控制台无报错。

## 验收(逐条给)
1. `.customer-card` 已无 24×80 重投影,改发丝边+极淡投影;圆角=16px。截图/说明。
2. 首屏进度条已弱化(不再是 5 个按钮压在最上)。
3. `/internal` 卡片投影/圆角**无变化**(自证没误伤全局)。
4. 资源版本已 bump;`npm test` 结果;控制台无报错。
