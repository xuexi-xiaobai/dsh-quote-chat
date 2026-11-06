# 设计工作台

前端设计改动的**评价与验证**工具。和 `npm test` 是两件事：

| | 管什么 | 需要浏览器 | 跑法 |
|---|---|---|---|
| `npm test` | 源码形状、契约、数据流 | 否 | 秒级 |
| `npm run design` | **像素、颜色、尺寸、无障碍** | 是 | 十几秒 |

两者互不依赖，也都不该替代对方。

## 为什么要有它

2026-11-06 改注释芯片的删除按钮时，`npm test` 822 项全绿，`probe-chip-layout` 全绿，
但芯片依然是错的：同一颗芯片里画了**两种蓝**（类型图标 `rgb(65,118,230)`、标签 `rgb(54,96,184)`），
悬停时类型图标被 `×` 替换，导致并排两颗芯片像两个不同组件。

这三个问题没有一个能被"跑测试"发现，只能靠**把状态固定下来、并排看、量数字**。
工作台就是把这三件事自动化。

## 怎么用

```powershell
npm run design            # 与基线比对，不一致就失败并写出 diff
npm run design:update     # 接受当前渲染为新基线（改完设计后跑）
npm run design:sheet      # 生成 design/sheet.png：全部状态一张图
npm run design:parity -- "<带 token 的 URL>"   # 检查 fixture 是否还描述真实芯片
```

## 组成

```
design/
  fixture.mjs      芯片 DOM 的静态副本 + 状态清单（CHIP_STATES）
  chip.spec.mjs    Playwright 用例：逐状态截图 + 客观指标 + axe 无障碍
  baseline/*.png   已评审的设计，入库
  sheet.png        接触表（gitignore，可重新生成）

playwright.config.mjs   截图契约：视口、DPR、locale、动画冻结、光标隐藏、阈值
tools/
  design-sheet.mjs      接触表生成
  design-parity.mjs     fixture ↔ 真实应用 的结构比对
  design-dump-chip.mjs  一次性：读真实芯片的 DOM 形状
  design-dump-type.mjs  一次性：读宿主作曲器的字体与表面色
```

## 截图契约（`playwright.config.mjs`）

会改变像素的东西全部钉死：

| 项 | 值 | 为什么 |
|---|---|---|
| viewport | 900×220 | 换行位置固定 |
| deviceScaleFactor | 2 | 1px 细节可评审 |
| locale / timezone | zh-CN / Asia/Shanghai | 字体回退、日期文本不漂 |
| animations | disabled | 不会拍到过渡中间态 |
| caret | hide | 闪烁光标不会造成假 diff |
| threshold | 0.02 + 40px | 容忍抗锯齿，不容忍布局 |

## 为什么是静态 fixture，不是真实应用

芯片**不是本插件的 React 组件**，它是宿主 Lexical 的 decorator，样式全部来自 `src/stylesheet.js`。
所以评审它只需要"宿主的 DOM 形状 + 我们的样式表"，不需要登录、会话、虚拟列表和 6–9 秒的浏览器启动。

静态副本换来的是**逐像素可复现**——这是基线比对的前提。

代价是漂移：宿主改了 decorator，副本会继续通过，却在评审一个已经不存在的芯片。
`design:parity` 就是防这个的：它读真实芯片的标签链、属性名、子树形状，和 fixture 比；
**故意不比较类名**（宿主的是 CSS Module 哈希，而样式表本来就是结构化选择），
也**故意不比较 `data-qc-*`**（那是插件自己的记账，随状态变化）。

## 客观指标

截图表达不了的，用断言表达：

- **色板同族**：类型图标与标签的通道差 ≤ 40（"两种蓝"就是这条挂的）
- **标签是引文不是序号**：`::after` 的内容必须是引文开头，不得是 `注释 N`
- **截断预算**：长引文最多 10 个字符 + 省略号
- **删除按钮无独立底色**：`background` 必须透明、`box-shadow` 必须为 none
- **命中区**：≥ 24×24（WCAG 2.2 AA）
- **不挤压**：芯片高度 ≤ 行高，标签不溢出
- **无障碍**：axe 扫描，serious/critical 必须为 0

## 加一个新状态

1. 在 `design/fixture.mjs` 的 `CHIP_STATES` 里加一条：`{ name, note, html, act, dark? }`
2. `npm run design:update` 生成基线
3. `npm run design:sheet` 看接触表
4. 提交 `design/baseline/<name>.png`

`note` 会直接显示在接触表上，所以它应该写"这个状态要看什么"，而不是复述状态名。
