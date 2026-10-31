# 设计与功能记录（design log）

这个仓库有两种"记录"，职责不同，不要混：

| 文件 | 记什么 | 什么时候写 |
|---|---|---|
| [`DEFECTS.md`](../DEFECTS.md) | **缺陷**：现象、实测数据、根因、修复前后对比 | 发现一个 bug、且能复现时 |
| `docs/design-log.md`（本文） | **主动改动**：新功能、前端设计调整，以及当时否掉了哪些做法 | 决定要改、动手之前先写“要改成什么/为什么”，落地后补验证 |

缺陷的判据是"有一个正确的行为被违反了"；设计的判据是"没有对错，只有取舍"。所以设计条目里
**"没有选的做法"** 和 **"为什么"** 比结论本身更重要——半年后想改回来的人需要知道当初踩过什么。

## 一条记录怎么写

```
### D-N 一句话标题（issue #链接）

- **改动**：用户看到的变化，一句话。
- **为什么**：解决什么问题；不解决它会怎样。
- **没有选的做法**：试过的 / 想过但否掉的，各一句话说明否掉的原因。
- **验证**：探针或测试的路径 + 关键数字（设计类改动最好有 before/after 截图，贴在 issue 里，不进仓库）。
- **副作用**：明确知道的代价（性能、可访问性、和其它交互的耦合）。
```

截图贴在 issue 里而不是仓库里：二进制文件会让这个包越来越重，而 issue 自带附件与历史。
探针放在 `tools/` 下（该目录被 gitignore），测试放在 `test/` 下并挂进 `package.json` 的 `test` 链。

---

## 已记录的设计改动

### D-6（已落地，issue #19）补上 prefers-reduced-motion 降级

- **改动**：样式表末尾加一条全局 `@media (prefers-reduced-motion: reduce)`：动画/过渡时长压到 `.01ms`、
  延迟归零、循环次数封顶 1。
- **为什么**：11 处动画/过渡，**没有一处**读这个信号。用户打开系统开关（macOS「减弱动态效果」/
  Windows 关闭「动画效果」）之后，浮窗照样从下方滑入、卡片照样弹、高亮照样扫过。
  对前庭功能障碍的人是"能不能用"的问题，不是"好不好看"。
- **没有选的做法**：
  - `animation:none` / `transition:none`：几处代码在等 `transitionend` / `animationend`，
    `none` 永远不会触发，会把交互挂死；
  - 逐条给每个动画加降级：11 处容易漏，而且以后新加的动画没人记得加；
  - 只压时长、不封顶循环：无限循环的动画在 `.01ms` 下会变成每帧重绘，比不动更糟。
- **验证**：`tools/probe-a11y.mjs` 在真实浏览器里 `emulateMedia({ reducedMotion: 'reduce' })`，
  `.qc-popup` 的 computed `animation-duration` 从 `0.1s` 变成 `1e-05s`（= `.01ms`），
  循环次数 `1`。`test/accessibility.mjs` 5 条：必须有这个 media、必须覆盖 `*::before/*::after`、
  两个时长都要压、必须是 `.01ms` 而不是 `none`、循环要封顶。变异验证过：把媒体查询改成
  `no-preference`，5 条里 5 条红。
- **副作用**：开了这个设置的用户拿不到任何入场动画，包括 `.qc-done` 那个 0.9s 的完成反馈。
  反馈本身还在——`animationend` 照常触发、`forwards` 保留终态，只是瞬间完成。

### D-5（已落地，issue #18）工具栏的三处规范问题

- **改动**：
  1. `role="toolbar"` 补 `aria-label`（中「选中文字的操作」/ 英 "Actions for the selection"）；
  2. 补 `:focus-visible` 焦点环，读宿主的 `--dsw-focus-ring-width` / `--dsw-focus-ring-color`，
     `outline-offset:-2px`；
  3. 禁用态不再和图标自身的 `opacity:.8` 叠乘。
- **为什么**：
  - 没有名字的 `toolbar`，读屏只念"工具栏"，不说它作用于什么；
  - 这个面原本一条 `:focus-visible` 规则都没有。实测：聚焦后把 `outline` 设成 `none`，
    截图与未聚焦**逐字节相同**——说明当时画出来的只有浏览器默认环。而宿主其它组件用的是
    `outline:<宽> solid <色>` + offset，两套语言；
  - `.45 × .8 = .36`：同一个按钮里图标比文字更淡，正是 #15 那类叠乘。
- **没有选的做法**：
  - 焦点环自己挑一个颜色：宿主会按输入方式把 `--dsw-focus-ring-color` 设成 `transparent`
    （鼠标用户不显示环），写死颜色等于推翻这条策略；
  - `outline-offset` 用正的：按钮离浮窗边只有 3px，向外的环正好压在浮窗边上；
  - 禁用态改成 `color` 变淡、保留图标的 `.8`：算下来图标还是 `.45 × .8 = .36`，没解决问题。
    真正的解法是让图标在禁用态**不再二次变淡**。
- **验证**：`tools/probe-a11y.mjs`、`tools/probe-modality.mjs` 在真实浏览器里量到：
  `aria-label` 读回「选中文字的操作」；鼠标模态下环色 `rgba(0,0,0,0)`（宿主策略），
  按一次 Tab 后 `data-input-modality` 变 `keyboard`、环色变成 `rgb(65,118,230)`；
  禁用态 `button .45 / svg 1`。`test/accessibility.mjs` 9 条。变异验证过：去掉 `aria-label`、
  改掉焦点规则、删掉禁用态那条 svg 规则，各自立刻红。
- **副作用**：键盘用户看到的环是**内嵌**的（offset `-2px`），贴着按钮自己的圆角，
  比宿主默认的外扩环更紧凑。这是为了不压到浮窗边框，属于取舍不是缺陷。

### D-4（已落地，issue #17）两个按钮之间的分隔线做成真的

- **改动**：分隔线从 `box-shadow: inset 1px 0 0 var(--dsw-alias-border-l1)` 换成
  `button+button::before` 的 1px 竖线，颜色取 `var(--dsw-alias-border-l2)`，上下各缩进 6px，
  落在两个按钮之间的 2px 间隙里。
- **为什么**：那条线取的是 `border-l1`，实测 **rgba(0,0,0,.04)**——在浮窗底色 `#E9ECF2` 上差约 9 个色阶，
  1:1 下基本看不见。而且 `inset` 阴影必然撑满按钮高度，线从顶穿到底，正好和按钮自己的 7px 圆角撞在一起，
  看起来像渲染残留而不是结构。同一个"分隔"位置还叠着 `gap:2px` 和悬停时的白色药丸，三样东西在抢活。
- **没有选的做法**：
  - 直接删掉分隔线、只留间隙和 hover 药丸：更干净，但两个动作都是"把选中的文字送去别处"，
    留一条线让它们读起来是"两个动作"而不是"一个控件两半"；
  - 用 `background-image` 的 1px 渐变条：可行，但 hover 规则现在写的是 `background:` 简写，
    会把渐变一起清掉，要连带改 hover——为一个分隔线改 hover 的写法不值。
- **验证**：`tools/probe-toolbar-design.mjs` 在 1:1 与 3× 两档截图；实测 hover 第二个按钮时，
  线仍在间隙里，没有被白色药丸吃掉。`test/toolbar-shape.mjs` 6 条：必须锚在按钮上（`position:relative`）、
  必须是伪元素、必须上下缩进、必须居中（`left === -(gap + width) / 2`）、
  颜色必须来自 token 而不是字面量、必须是 `border-l2` 不能退回 `border-l1`。
  变异验证过：改回 `inset` 阴影、去掉缩进、换回 `border-l1`、把颜色写成 `rgba()`，各自立刻红。
- **返工（issue #20）**：第一版颜色写死成 `rgba(0,0,0,.08)`，浅色下没问题，**暗色下几乎消失**。
  原因是宿主在暗色主题下把边框类 token 翻成白色叠加（`border-l1` → `rgba(255,255,255,.06)`，
  `border-l2` → `rgba(255,255,255,.12)`），写死的黑不参与翻转。实测分隔线与底色的最大通道差：
  浅色 19 / 暗色 **9**；改用 token 后是 24 / **19**。
  当时否掉 `border-l2` 的理由是"和浮窗外框同重"——这个理由站不住：分隔线只有 15px 长，
  外框是一整圈，同色不等于同重量。教训记在这里：**这个样式表里凡是结构线都不能写字面量颜色**。
- **返工二（issue #21）**：线偏向右边的按钮。`left:-1px` 是相对**第二个按钮的左边缘**算的，
  2px 间隙在那个坐标系里是 `[-2px, 0]`，正中在 `-1px`；而 1px 宽的线放在 `left:-1px` 占据的是
  `[-1px, 0]`——它的**左边缘**对齐了正中，线整个落在右半边。实测线左空 1px、右空 0px。
  改成 `left:-1.5px`（= `-(gap + width) / 2`），两边各 0.5px。
  0.5 CSS px 在 DPR 2 下正好是 1 个设备像素：把弹窗按 2× 抓下来逐列取样，分隔线落在两列设备像素上、
  两列都是满强度 Δ73，没有摊成半强度的两列，所以不糊。
  代价：DPR 1 下会摊到相邻两列、看起来更淡。要彻底避免就得把 `gap` 从 2px 改成 3px、线放 `left:-2px`，
  但那是改间距，不只是挪线，没做。
- **副作用**：`.qc-popup button` 多了 `position:relative`，为的是给伪元素做定位上下文——按钮本来就是 flex item，
  相对定位不影响布局。线落在间隙里而不是按钮内，所以 hover 时不会跟着药丸一起变白，读起来像"药丸的左边框"。

### D-3（已落地，issue #16）「在侧边聊天中提问」缩成「侧边提问」

- **改动**：`popup.askInSide` 的中文从 8 个字缩到 4 个字；`side.noQuote` 里引用这句按钮文案的地方同步改。
- **为什么**：两个按钮实测 **88.0px vs 139.1px**，差 58%；整个浮窗 237px 宽，而选中的段落只有 742px，
  **一个划词浮窗盖住了 32% 的行宽**。文字部分实测 102.1px，正好是 8 个字的宽度——它是一句话，不是标签。
  缩到 4 字后两个按钮都是 88px，浮窗 **186px**（−21%），两半对称，覆盖率从 32% 降到 25%。
- **没有选的做法**：
  - 只把图标放大、不改文字：宽度一点没变；
  - 让第二个按钮只显示图标、hover 出文字：多一次交互，而且把唯一需要解释的动作藏起来了；
  - 改成「提问」两个字：更短，但丢掉了"在侧边"这个关键区别——主对话里也能提问，
    这个按钮的意义就是"不打断主对话"。
- **验证**：`tools/probe-toolbar-design.mjs` 打印每个按钮的宽度和浮窗对段落的覆盖率：88 / 139.1 → 88 / 88，
  237 → 186，32% → 25%。`test/toolbar-shape.mjs` 3 条：标签 ≤ 6 字、两个标签长度差 ≤ 2 字（CJK 等宽，
  字数差就是宽度差）、`side.noQuote` 必须原样引用当前按钮文案（中英各一条）。
  最后这条是真会踩的坑：`test/locale-parity.mjs` 只校验 key 对齐，改文案不改引用它看不见。
- **副作用**：按钮文字不再说明"在哪里"——位置信息改由图标承担（上一轮换的 `panel-right` 就是"右边一栏"），
  文字只说用途。这也意味着图标和文字的分工从此固定下来：动文字前先看图标还在不在说位置。

### D-2（已落地，issue #15）划词工具栏的两个图标换成 Lucide 一对

- **改动**：`IconAnnotate` 换成 Lucide 的 `message-square-plus`，`IconSideChat` 换成 Lucide 的 `panel-right`。
  路径原样使用，只把 `width`/`height` 设成 14；两者共用同一个 `LUCIDE` 几何对象（24 网格、2 笔画、圆角连接），
  因此成对成体系。原来自绘的一对全部删除，没有保留开关。
- **为什么**：现在的 `IconAnnotate` 是"气泡 + 挂在右上角的加号"，`IconSideChat` 是"大方框 + 右侧一个向内折的钩"。
  14px、16 画布、1.3 笔画下实际笔画约 1.14px，而加号只有 3.3px 长、与气泡的笔画还重叠约 1.1 个单位；
  侧边那个形状放大后更像括号而不是第二个面板。再加上 `svg{opacity:.8}` 与加号自身的 `opacity:.7` 叠乘（0.56），
  浅色主题下是灰噪点。它们也不属于同一个视觉系统：一个是"形状 + 附属符号"，一个是"两个形状相切"。
- **没有选的做法**：
  - 把图标放大到 16–18px：按钮高度会变，工具栏的相对位置与 composer 的对齐要跟着调；
  - 加投影/描边来"提亮"：在 14px 下只会更糊，且把注意力从形状挪到了效果上；
  - 用 emoji：跨平台渲染不可控，和现有线性语言冲突。
- **验证**：`tools/probe-icon-swap.mjs` 把「之前/现在」两组图标塞进同一个真实 `.qc-popup` 克隆里同帧渲染，
  并在 1:1 与 3× 两档截图对照；`test/icons.mjs` 新增 15 条静态契约——共用一个 `LUCIDE` 对象、
  同 `viewBox`、同笔画、路径内不得再出现 `stroke-width`/`opacity`、两条上游路径逐字固定、
  `IconCheck` 仍留在 16 网格、`icons.js` 必须指向许可文件。做过变异验证：给任一路径加回
  `opacity` 或 `stroke-width`，测试立刻红（13/15）。`npm test` 776 项通过。
- **副作用**：14px 线描的下限仍然在——只是这次没有再往下压，而是直接借上游已经按这个尺寸调好的形状。
  Lucide 的圆角语言比自绘那版更"圆"，和 `IconCheck`（16 网格、手绘、更尖）不是一套；
  两者不在同一个面上出现（`IconCheck` 只用在 `.qc-compose` 的确认键，这两个只在 `.qc-popup`），可以接受。
  另外 `.qc-popup svg{opacity:.8}` 保留未动：之前 0.56 的灰来自 `.8 × .7` 叠乘，现在只剩 `.8` 一层，
  实测与 12.5px 文字并排时层次是对的；去掉反而让图标比文字更抢眼。
- **调研（可复现，2026-10-31）**：三个库都能直接取单个 SVG，不需要引依赖、不需要图标字体——
  - Lucide（ISC）：`https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/<name>.svg`
  - Tabler（MIT）：`https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/outline/<name>.svg`
  - Phosphor（MIT）：`https://cdn.jsdelivr.net/npm/@phosphor-icons/core@latest/assets/<weight>/<name>[-<weight>].svg`
    （`regular` 不带后缀，`bold`/`fill` 带后缀）

  取了 45 个候选，按 14px / 12px / 8× 三档渲染，再塞进真实 `.qc-popup` 里复核（一次性探针
  `tools/probe-icon-candidates.mjs`、`tools/probe-icon-live.mjs`，均已 gitignore）。
- **调研结论**：
  - **有效笔画不是问题所在**。现状 `1.3 × 14 ÷ 16 = 1.14px`；Lucide/Tabler 原样缩到 14px 是
    `2 × 14 ÷ 24 = 1.17px`，两者几乎相同。Phosphor 是填充路径，Regular 在 14px 下反而更细（约 0.88px），
    只有 Bold 站得住。所以"糊"来自构图，不来自粗细。
  - **真正的分歧点是加号画在气泡外面**。Lucide 的 `message-square-plus` 把十字放在气泡内部（`M12 8v6` + `M9 11h6`）；
    Tabler 的 `message-plus` 和我们现状一样放在外面（`M16 19h6` + `M19 16v6`），14px 下同样糊成一团。
    即"附属符号压在容器笔画上"是通用失败模式，不是我们单独画坏了。
  - 1:1 可辨性排序——注释：`message-square-plus` > `message-circle-plus` > `pencil-line` ≈ Tabler `pencil`
    > `highlighter` > Phosphor Bold `note-pencil`；`quote`、`pilcrow`、`messages-square` 在 14px 下全糊。
  - 侧边提问：`panel-right` > Tabler `layout-sidebar-right` > Phosphor `sidebar-simple`（分隔条靠左，方向相反）
    > `panel-right-open`（内含箭头，14px 下像文件夹）。
- **拍板**：按上面这一对落地，2026-10-31 由用户确认保留（"相比于前一个，我认为这个图标确实更令人满意了"）。
  同源是关键——跨库混搭在 1:1 下能看出圆角与笔画的细微差别。
  许可落地：`src/icons.js` 顶部注明来源并指向 `docs/third-party-notices.md`，后者收录 ISC 声明原文与
  用到的两个图形名，并已加进 `package.json` 的 `files`。

### D-1 面板与作曲器之间把 8px 间距还回来（缺陷 10）

- **改动**：底部吸附时，面板底边与作曲器卡片之间留出和顶部一样的 8px 间距。
- **为什么**：下边界当时取的是作曲器里那个 `contenteditable` 的盒子，而它外面那张卡比它高 8px
  （圆角 28、`padding-top: 8px`）。于是"距作曲器 8px"的槽位正好落在卡的边上，实测间距 -0.5px，
  看起来就是贴死了；顶部同样规则留了 8px，两边不一致。
- **没有选的做法**：
  - 直接把槽位的 `gap` 从 8 改成 16：间距是"对"了，但 band 的底边仍然是错的，
    跳转居中、吸附阈值都还在用那个错的值；
  - 用 `[data-slot="conversation.composer.dock"]` 这类包装元素：本构建里三个包装全是 0×0，拿不到盒子。
- **验证**：`tools/probe-compose-gap.mjs` 2/2；修复前 `-0.5px`，修复后 `+7.5px`（差的 0.5px 是吸附取整）。
  测试：`test/layout.mjs` 新增 4 条（画了东西的祖先是作曲器的边、透明包装不算、整页盒子不算、band 底边跟着走）。
- **副作用**：`readableBand()` 的底边整体上移 8px——吸附槽位、跳跃居中都跟着变，属于修正而不是代价。
