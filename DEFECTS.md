# 已知缺陷与交接说明

写给下一个会话用的交接文档。**只记录我实际验证过的东西**，并明确区分"已验证"与
"未验证的推断"——上一轮交接（`HANDOVER-chip-selection-regression.md`）有一部分推断被
后续证伪，代价是走了半天弯路，所以这里把证据强度标在执行者看得见的地方。

生成时间：2026-10-30，对应 `d1bd22e`（工作区干净）。
全部结论都是在**当前仓库上重新核实过的**，不是从旧对话里抄的。

---

## 0. 先读：这个仓库的工作纪律

摘自 `DEVELOPING.md`，修复缺陷时会直接用到：

1. **不要为了让探针变绿而改产品代码。** 探针失败优先怀疑探针。
2. **不要为了让探针变绿而改探针。** 一个探针不能为它没做的改动改绿。
   判定"探针过时"还是"产品错了"是产品决策，不是测试决策。
3. **先复现，再修。** 每个缺陷先写一个**会失败**的测试，再改代码让它通过。
4. **合成事件测不出指针 bug。** `element.click()` 不触发真实的 pointer 序列；
   见 `harness.mjs` 里 `clickAt`/`dragSelect` 的注释。

---

## 1. 环境前提（不做这一步，所有套件都跑不起来）

这台机器：macOS x86_64，Node v24.22.0，Playwright 1.64.1（已装为 devDependency）。
Chrome 在 `/Applications/Google Chrome.app`。**没有 ffmpeg**（录制功能不可用，其余不受影响）。

### 1.1 起一个能跑套件的 web 服务器

`dsh web` 的 profile 装的是 `~/.dsh/profiles/web`，插件以 junction 链到仓库，
所以**构建即部署**：`node build.mjs` 写完 `client.js`，服务器立刻看到新代码（重启页面即可）。

```sh
cd <repo>/dsh-quote-chat
node build.mjs --check          # 先确认产物与源码一致
node tools/platform.mjs         # 可选：打印四个依赖路径，确认解析结果
```

启动服务器（**必须用你自己的 profile 和端口，不要动用户在 3080 上的服务器**）：

```sh
DSH=/Users/macos/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh/lib/bin.js
nohup node "$DSH" --profile web --host 127.0.0.1 --port 8791 --no-open > /tmp/qc-web.log 2>&1 &
sleep 14 && sed -n 's/^dsh web: //p' /tmp/qc-web.log      # 拿到带 token 的 URL
```

### 1.2 最大的坑：默认模型没有 adapter

**新会话的模型选择器显示"请选择模型"，直接发送会得到
`no adapter registered for provider "our-free-model"`，整轮 `turn-error`，正文里没有任何
可划选的模型回答。**

所有 `accept-*` 套件都要求正文里有 ≥40 字符的模型输出，因此**在造测试数据之前必须先手选模型**：

```
点 [data-slot="conversation.input.model"] → 选 deepseek-v4.1-flash
```

选好后选择器显示 `deepseek-v4.1-flash Default`。

> 已验证：这是 `cordis.patch.yml` 里 `agent-default-model` 配的是 `wb-proxy/deepseek-v4.1-flash`，
> 但会话级覆盖指向了 `our-free-model`，而该 provider 在本机没有注册 adapter。
> **未查明**这个会话级覆盖是从哪写进去的（不在 `plugin-store.sqlite`，不在
> `~/.dsh/storages/*.json`）。这不阻塞缺陷修复，但会让每一次新会话都踩一次。

### 1.3 屏幕高度会改变几何断言的含义

窗口是**真的最大化了**（`Browser.getWindowBounds` 返回 `windowState: "maximized"`），
但这台机器的屏幕只有 1280×800，最大化后可读区仅 **632px** 高。一批以高度为阈值的
几何断言因此"造不出场景"，报成 `could not set the test up`，读起来像产品缺陷。

用更高的虚拟视口跑几何相关的套件：

```sh
QC_VIEWPORT=1440x1000 node tools/accept-lifecycle.mjs "<url>"
```

实测：1280×632 → 63/73；1440×1000 → 68/73。

### 1.4 造测试数据

需要一个含真实模型回答的会话。除了手选模型（1.2），没有别的办法——
不要在用户正在用的会话里做实验，`DEVELOPING.md` 明确要求用**专用测试会话**。

---

## 2. 待修缺陷

下面每一条都标注了**证据强度**。`[已验证]` = 我在当前代码上跑过或读过并确认；
`[未验证]` = 合理推断，需要执行者先证实再动手。

### 缺陷 1：一次被取消的拖拽会让选区工具栏永久失效

**证据强度：`[已验证]`（代码路径）+ `[未验证]`（浏览器内的复现）**

- 位置：`src/ui/dock.js:241` `onDown`，`src/ui/dock.js:202` `let pointerDown = false`
- 事实：
  - `pointerDown` 在 `onDown`（`pointerdown`/`mousedown`）置 `true`，在 `onUp`
    （`pointerup`/`mouseup`）置 `false`。
  - `evaluate()` 开头有 `if (pointerDown) return`——**这个标志为 true 时整个选区评估被跳过**。
  - dock **没有**注册 `pointercancel`，也没有 `blur` / `visibilitychange`。
  - 对照：`src/chip-drag.js:440` 注册了 `pointercancel`，处理与 `pointerup` 相同。
- 后果：任何"按下后没有 `pointerup`"的路径都会让 `pointerDown` 永久停在 `true`：
  拖拽被系统取消（触摸/触控板惯性、手势被上层元素接管）、窗口失焦、
  或按下后 `pointerup` 落在 document 之外。之后选区工具栏**再也不出现**，直到刷新。
  这个状态无法从 UI 上察觉，用户只会觉得"插件坏了"。
- 修复方向：注册 `pointercancel` 与 `blur`（或 `visibilitychange`）同样复位 `pointerDown = false`，
  随后 `schedule()` 评估一次。注意 `onUp` 里已有的注释解释了"为什么每个按键都要清"——
  同样的理由适用于这里。
- **修复时必须先复现**：用真实的 pointer 序列（`mouse.move` → `mouse.down` →
  派发 `pointercancel` → 再正常选择），合成 `click()` 测不出来。

### 缺陷 2：满 12 条后再也无法添加，而提示语没有说明该怎么办

**证据强度：`[已验证]`（行为）+ `[已修正]`（我上一轮的说法有误，见下）**

- 位置：`src/index.js:34` `MAX_ANNOTATIONS = 12`，`src/annotation-store.js:140`
- 事实（用真实 store 跑过）：
  - 满 12 条后 `add()` 返回 `null`，`dock.js:347` 弹 `card.limit` 提示。
  - **删除会释放额度**：删掉 1 条后 `add()` 立刻成功。
  - 所以**不是**"终身额度"——我上一轮说"注释一旦发满就再也加不了"是**错的**，
    在此更正。真实情况是"满额且不删除时无法继续"。
- 真正的问题在别处：注释库是**纯内存**（`annotation-store.js` 文档注释明确写
  "nothing is written to storage and nothing is evicted"），发送消息**不会**清除已有注释。
  于是一个自然的工作流（划注释 → 发送 → 再划 → 再发送）会稳定地累积到 12 条，
  到第 13 次才报"最多 12 条注释"，而提示语**没有告诉用户需要先删**。
- 修复方向（三选一，是产品决策，需要先问）：
  1. 发送成功后清掉该会话的注释（`store.clear` 已经存在，**当前零调用点**）；
  2. 满额时提示语改为可操作的文案（"最多 12 条注释，删除一条后可继续"）；
  3. 提高上限或改为按草稿而非会话计数。
- 注意：`chip-registry.js:22-26` 解释了 **chip payload registry** 为何**故意不提供**
  delete/clear。那段理由是这条缺陷的上游，务必先读：

  > "a draft is not the only consumer; the user can remove a chip and put it back; an undo,
  > a re-render, or a restored draft can reintroduce a reference whose payload would then be
  > gone. … adding them now would invite exactly that coupling."

  也就是说：作者**已经预见到**"撤销/重渲染/恢复草稿会重新引入一个 payload 已消失的
  reference"这种情形，并选择用"永不回收"来规避它。缺陷 3 正是这条规避策略**覆盖不到**的
  场景（跨刷新，内存整个没了）。修缺陷 3 时不要顺手推翻这个设计——它保护的是页内生命周期，
  缺陷 3 是跨页面的，两者不冲突。

### 缺陷 3：刷新后残留的草稿芯片会让发送被拒绝

**证据强度：`[已验证]`（宿主行为 + 插件行为），`[未验证]`（端到端复现）**

- 插件侧：`src/registrations.js:102` —— `registry.get(ref)` 取不到 payload 时
  `Promise.reject(new Error('quote-chat: unknown chip "<ref>"'))`。
- 宿主侧（从 `app.asar` 里 `@deepseek-ai/dsh-client-ui-conversation/lib/client.js` 读出，非推断）：
  - 宿主持久化草稿时存 `{ text, references: [...] }`，其中 `references[].offset`
    必须与 `text` 中的占位文本严格对齐（`snapshotSchema` 的 `refine` 校验）。
  - 提交时对每个 reference 调 `inputTriggers.serializeReference(source, ref, signal)`；
    该 Promise 一旦 reject，走 `settleDetachedFailure(attempt, message)`，**整次提交失败**。
- 后果：草稿跨刷新存活，但芯片 payload 是内存里的，刷新即丢。用户看到一个正常的芯片，
  点发送却得到 `quote-chat: unknown chip "qc-…"`，且**没有办法自愈**——删掉芯片会
  同时删掉文本？需要执行者确认，但至少"发送按钮看起来正常、点了报错"是可复现的。
- 修复方向：`serialize` 遇到未知 ref 时降级为 `CHIP_PLACEHOLDER`（或纯文本），
  而不是 reject。这属于"宿主契约允许降级"还是"插件应保证 payload 可重建"，
  需要先看 `DEVELOPING.md` 里对 codec 契约的描述。

### 缺陷 4：撤销把芯片放回草稿末尾，而不是原来的位置

**证据强度：`[已验证]`（代码路径）**

- 位置：`src/ui/dock.js:549` `onUndoRemove` → `chipBridge.place` →
  `src/chip-draft.js:106` `withAppendedChip`：`offset: base.length`，即**永远追加到末尾**。
- `undoRef.current = annotation`（`dock.js:493`）只保存注释本身，
  **没有保存它原来在草稿里的 offset**；`add()` 返回的对象里也没有 offset 概念。
- 后果：删除草稿中间的一个芯片再撤销，它会跑到句子末尾。文本占位符与 comment 一起移动。
- 修复方向：删除时把 `occurrence.offset` 一并存进 undo 记录（`dock.js:491` 附近已经有
  `occurrences` 可用），撤销时按该 offset 拼接而不是走 `withAppendedChip`。
  注意 `chip-draft.js` **目前只有两个拼接函数**：`withAppendedChip`（追加，就是本缺陷的成因）
  和 `withoutChip`（按 offset 删除，并修正其后所有 reference 的 offset）。**没有**"按指定
  offset 插入"的函数，需要新写一个——可以照 `withoutChip` 里 offset 位移的写法反过来做
  （`chip-draft.js:131-151`）。这也说明这条缺陷的修复不是一行改动，而是要在 `chip-draft.js`
  增加一个对称的插入函数，并为它写单元测试。

### 缺陷 5：`pairs()` 按下标拉链，长度不等时静默错配

**证据强度：`[已验证]`（代码路径）**

- 位置：`src/ui/cards.js:137`
  `for (let index = 0; index < chips.length && index < refs.length; index += 1)`
- 事实：DOM 里的芯片顺序与 `occurrences` 的下标被当作一一对应。宿主重渲染期间两者
  长度可能短暂不等（这**正是** `b011970` 修的那个芯片掉属性 bug 的同一场景）。
- 当前行为：`annotation === undefined` 时**跳过**该下标（`if (...) result.push(...)`），
  所以不会错配到"错误的那一条"，而是**少配**。这一点比我上一轮说的"错配"要轻——
  在此更正：真实风险是"该配的没配上"，不是"配到别人身上"。
- 后果：少配 → 该芯片不被 `apply()` 维护，标签/图标消失。
  `b011970` 已经把"未配对就 unmark"改成"只在注释确实不在 store 里才 unmark"，
  所以后果被兜住了一部分；但如果芯片顺序真的错位（例如用户手工调整了文本），
  仍会把 A 的属性写到 B 上。
- 修复方向：用芯片携带的 ref（`data-composer-chip` 值 / `ref`）做 map 查找，
  而不是按下标。这需要确认 `data-qc-*` 属性里是否已经带有 ref。

---

## 3. 不算缺陷，但会误导人的现状

### 3.1 `accept-lifecycle` 有 5 项固定失败

在 `QC_VIEWPORT=1440x1000` 下是 **68/73**。剩余 5 项分两类，**都不是移植问题**：

| 断言 | 原因 |
|---|---|
| `clicking outside closes the compose box`<br>`clicking outside also clears the held highlight` | **产品故意改了规则**：`dock.js:161-165` 把关闭收窄为"点击正文内部"，理由是旧规则会因为瞥一眼侧栏就丢掉写到一半的评论。测试仍期望旧行为。已在文件内标注 `KNOWN STALE ASSERTION`。 |
| `the header covers the compose panel…`<br>`the compose panel does not jump…`<br>`typing brings a panel…back into view` | 场景造不出来（滚动/重叠样本未产生），与屏幕高度和当前会话的字数有关。换一个更长的会话可能就过了。 |

**这三项需要判定"断言过时"还是"产品错了"——那是产品决策，不要为了跑绿而改。**

### 3.2 `accept-highlight` 记录了一个真实但独立的既有缺陷

样式表声明了 `::highlight(quote-chat-hold)`，但代码**从不注册**这个名字——
`hold()` 实际画在 `quote-chat-flash` 下。套件自己在输出里注明了
`pre-existing defect, recorded`。它与本文档 5 个缺陷无关，可单独修。

### 3.3 未做的技术债：`.gitattributes`

现在加会让 5 个 CRLF 源文件（`chip-drag.js`、`layout.js`、`stylesheet.js`、
`ui/markers.js`、`ui/popovers.js`）被规范化。**`stylesheet.js` 的 CSS 在模板字符串里，
规范化会改变产物哈希。** 必须是独立提交，且提交后要重新构建并确认产物字节变化符合预期。

---

## 4. 当前基线（修复前请先复现这个）

```
node build.mjs --check   → sha256:5848438bdcb1ec08，通过
npm test                 → 611/611 通过，0 失败
```

验收套件（需要 1.1 + 1.2 的前提）：

```
accept-highlight   18/18
accept-side-chat   26/26
accept-lifecycle   68/73（QC_VIEWPORT=1440x1000）
verify-web-build   OK — Web serves the current build
```

修任何一个缺陷后，至少要保证 `npm test` 仍 611 通过，且 `--check` 的哈希变化
**只能来自源码改动**。新增测试并入 `package.json` 的 `test` 脚本（注意是长
`&&` 链，加在末尾）。

---

## 5. 建议的动手顺序

按"复现成本低、影响面小、能先建立信心"排：

1. **缺陷 4（撤销位置）**：纯逻辑，`undo-contract.mjs` 已有 14 项可以直接扩写，
   不需要浏览器。改动局限在 `dock.js` 一处。
2. **缺陷 1（pointerDown 卡死）**：影响最大（工具栏永久失效），但需要真实 pointer
   序列的探针——先写这个探针，它会同时成为回归保护。
3. **缺陷 3（孤儿芯片）**：需要判断契约方向，可能需要问用户。
4. **缺陷 2（12 条上限）**：三个方向都是产品决策，**动手前先问用户**。
5. **缺陷 5（pairs 下标）**：风险最低（已被兜住一部分），且改法需要确认属性里有没有 ref。

---

## 6. 我明确没有做的事

- **没有**修改任何产品代码来修上述缺陷（本文档只是记录）。
- **没有**端到端复现缺陷 1、3（只读了代码路径和宿主契约）。
- **没有**查明会话级模型覆盖 `our-free-model` 的来源（见 1.2）。
- **没有**验证缺陷 2 在真实浏览器里"发送后注释不清除"的时序——只用 store 层验证了额度行为。
- 上一轮有两处说法**已被本轮证伪并更正**：缺陷 2 不是"终身额度"（删除会释放）；
  缺陷 5 不是"错配"（是少配）。执行者请以本文档为准。
