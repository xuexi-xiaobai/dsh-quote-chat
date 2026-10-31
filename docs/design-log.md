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

### D-2（提案，待拍板）划词工具栏的两个图标要重做（issue #15）

- **改动**：把「注释」「侧边提问」两个 14px 图标重画，使它们在 1:1 下可辨、成对成体系。
- **为什么**：现在的 `IconAnnotate` 是"气泡 + 挂在右上角的加号"，`IconSideChat` 是"大方框 + 右侧一个向内折的钩"。
  14px、16 画布、1.3 笔画下实际笔画约 1.14px，而加号只有 3.3px 长、与气泡的笔画还重叠约 1.1 个单位；
  侧边那个形状放大后更像括号而不是第二个面板。再加上 `svg{opacity:.8}` 与加号自身的 `opacity:.7` 叠乘（0.56），
  浅色主题下是灰噪点。它们也不属于同一个视觉系统：一个是"形状 + 附属符号"，一个是"两个形状相切"。
- **没有选的做法**：
  - 把图标放大到 16–18px：按钮高度会变，工具栏的相对位置与 composer 的对齐要跟着调；
  - 加投影/描边来"提亮"：在 14px 下只会更糊，且把注意力从形状挪到了效果上；
  - 用 emoji：跨平台渲染不可控，和现有线性语言冲突。
- **验证（计划）**：1:1 与 10× 两组渲染对照；`test/` 里加一条静态契约——两个图标必须共用同一 `viewBox`、
  同一 stroke、且不出现"两个图标各自不同的圆角"这类偏移。
- **副作用**：14px 线描的下限就在那里——方向 B（局部实心）能更清晰，但会比周围 UI 更"重"，
  这一条要等拍板。
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
- **倾向**：注释用 Lucide `message-square-plus`、侧边提问用 Lucide `panel-right`。两者同源（同 24 网格、同 2 笔画、
  同圆角），一次性解决"不成体系"；落地时在 `src/icons.js` 顶部保留上游版权与许可行（ISC 要求保留声明）。

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
