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
# <npx-cache> 换成本机 npx 缓存路径（`npm config get cache` 下的 _npx/<hash>）
DSH=<npx-cache>/node_modules/@deepseek-ai/dsh/lib/bin.js
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

## 2. 缺陷清单

每条缺陷在 GitHub issue 里有对应条目（仓库 `xuexi-xiaobai/dsh-quote-chat`）。
**本文档是长文**：记证据强度、被证伪的旧说法、以及排查过程中排除掉的可能；
**issue 是可跟踪的条目**：认领、关联 commit、关闭。两者不要各说各话。

下面每一条都标注了**证据强度**。`[已验证]` = 我在当前代码上跑过或读过并确认；
`[未验证]` = 合理推断，需要执行者先证实再动手。

### 缺陷 1：一次被取消的拖拽会让选区工具栏永久失效

> 追踪：**未开 issue** —— 见下方「第二轮核实」，本条已降级为健壮性缺口，不再占修复排期。

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

#### 第二轮核实（2026-10-30，真实浏览器，与上面并列保留）

执行者用真实 CDP 鼠标（非合成事件）复核了这一条，结论与上文**不一致**，按仓库纪律在此更正：

- **卡死状态确实能制造**：真实拖动页面上任何一个 `draggable` 元素（侧边栏的会话行 / 项目行），
  事件流是 `pointerdown → mousedown → dragstart → pointercancel → drop → dragend`，
  **没有 `pointerup`，也没有 `mouseup`**，`pointerDown` 停在 `true`。
  `onDown` 挂在 `document` 上，所以在页面任何位置拖拽都会命中。
- **但用户看不到任何后果**：桌面 Chrome 的方向键不移动非编辑文本里的光标（那是"光标浏览"
  才有的行为，默认关闭），所以人无法造出"只触发 `keyup`、不触发指针事件"的选区。
  而任何鼠标选区都会先发 `pointerup`，把标志清掉再评估——工具栏照常出现。
  实测：卡死状态下三击选中一段，工具栏正常弹出。
- 因此上文的 `[未验证]（浏览器内的复现）` 现在可以结案：**作为用户可见缺陷，它不存在。**
  它与 `644ff33` 修掉的"右键菜单吃掉 pointerup"是同一失效模式；那次修复把
  `pointerDown = false` 提到 `onUp` 第一行、对所有按键都清，已经覆盖了实际发生过的那条路径。
- **建议**：本条从"待修缺陷"降级为"已知健壮性缺口"，不再占用修复排期。若要做加固，
  只注册 `pointercancel`/`blur` 复位即可，**不要**照上文那样"随后 `schedule()`"——
  原生拖拽进行中立刻求值会把 `position: fixed` 的工具栏画到手势中间，正是这个标志存在的初衷。

### 缺陷 2：满 12 条后再也无法添加，而提示语没有说明该怎么办

> 追踪：issue [#2](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/2) —— **已修复**（见下方「修复」）

**证据强度：`[已验证]`（真实浏览器，修复前后各一次）+ `[已修正]`（我上一轮的说法有误，见下）**

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
- **比这条 issue 写的更糟（本轮查清）**：满额之后，用户**根本没有可删的东西**。
  - 能删注释的只有两条路：气泡编辑器里的删除（`markers.js:908`）、悬浮卡上的删除
    （`cards.js:459`），**两者都要求草稿里有芯片**。
  - 而发送之后草稿被宿主清空，芯片就没了；用 Backspace 删掉芯片也一样。
    `markers.js:631` 自己的注释就写着 "the store keeps an entry with no chip"。
  - 所以：没有芯片 → 没有气泡 → 删不掉 → 额度永远回不来，**只能刷新页面**。
  - 也就是说，原方案的"只改提示语文案"会指向一个用户做不到的操作。
- 注意：`chip-registry.js:22-26` 解释了 **chip payload registry** 为何**故意不提供**
  delete/clear。那段理由是这条缺陷的上游，务必先读：

  > "a draft is not the only consumer; the user can remove a chip and put it back; an undo,
  > a re-render, or a restored draft can reintroduce a reference whose payload would then be
  > gone. … adding them now would invite exactly that coupling."

  也就是说：作者**已经预见到**"撤销/重渲染/恢复草稿会重新引入一个 payload 已消失的
  reference"这种情形，并选择用"永不回收"来规避它。缺陷 3 正是这条规避策略**覆盖不到**的
  场景（跨刷新，内存整个没了）。修缺陷 3 时不要顺手推翻这个设计——它保护的是页内生命周期，
  缺陷 3 是跨页面的，两者不冲突。

  本次修复**没有**碰 payload registry：清掉的是"注释条目"（store），不是"芯片内容"（registry）。
  已经发出去的消息仍然能渲染，因为它的 payload 还在。这两件事必须分开看。

#### 修复

选了「上限只数草稿里的芯片」，而不是另外两个方向：

- **为什么不只改文案**：满额时屏幕上没有可删的东西，文案会指向一个不存在的操作。
- **为什么不在发送后清空**：需要可靠识别"发送成功"，而且修不了 Backspace 删芯片留下的孤儿。

实现：

- `chip-draft.js` 新增 `orphanedIds(annotations, occurrences, source)` —— 纯函数，
  返回"没有芯片的那些注释 id"。
- `dock.js` 新增 `pruneOrphans()`，在 `commit()` 和 `onUndoRemove()` 里、
  **且只在 `annotations.length >= MAX_ANNOTATIONS` 时**调用。
  平时不清理：store 本来就被上限约束在 12 条以内，每次提交都扫一遍没有收益。
- `locales.js`：提示语改成「最多 {max} 条注释，删掉一条后再继续」。

结果：上限从"这个会话一共能加多少条"变成"这条消息里能放多少条"，和用户看到的一致。

#### 真机验证

`tools/probe-limit-recovery.mjs` —— 不需要发消息，清空草稿走的是同一条路径：

```
① 同一段落连续加 12 条 → 12 个芯片，满额
② 再加一条            → 拒绝
③ 全选草稿 + Backspace → 0 芯片、0 气泡，屏幕上没有任何可删的东西
④ 再加一条            → 旧 bundle：永远加不上；新 bundle：芯片 1 个
```

旧 bundle 的提示语是「最多 12 条注释」，新的是「最多 12 条注释，删掉一条后再继续」。

### 缺陷 3：刷新后残留的草稿芯片会让发送被拒绝

> 追踪：issue [#3](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/3) —— **已修复**（见下方「修复」）

**证据强度：`[已验证]`（真实浏览器，修复前后各一次；宿主行为从 `app.asar` 读出）**

- 插件侧：`src/registrations.js` —— `registry.get(ref)` 取不到 payload 时
  `Promise.reject(new Error('quote-chat: unknown chip "<ref>"'))`。
- 宿主侧（从 `app.asar` 里 `@deepseek-ai/dsh-client-ui-conversation/lib/client.js` 读出，非推断）：
  - 宿主持久化草稿时存 `{ text, references: [...] }`，其中 `references[].offset`
    必须与 `text` 中的占位文本严格对齐（`snapshotSchema` 的 `refine` 校验）。
  - `sinkSerialized` 对每个 occurrence 调 `inputTriggers.serializeReference(source, ref, signal)`，
    把草稿里那一段**替换**成返回的文本；任何一个 reject 就整次提交失败，
    走 `settleDetachedFailure` —— 把草稿放回编辑器并显示那条 error 的 message。
  - 它自己的注释写得很明白："Owner missing or serialization failure rejects the detached send
    and restores its editor snapshot."
- **端到端复现（本轮）**：标注一段 → 打字 → 刷新页面 →
  - 芯片还在，而且**看起来正常**（宿主按自己存的 label 渲染出「@注释 1」）；
  - 但插件侧 `data-qc-label` / `data-qc-num` / `data-qc-ref` 全被抹掉（注释库是空的）；
  - 按回车：**0 个请求离开页面**，屏幕上出现 `quote-chat: unknown chip "qc-…"`；
  - 草稿被放回编辑器，用户重试多少次都一样。

#### 修复

**没有选"降级"**。issue 里建议 `serialize` 遇到未知 ref 时返回占位符，但宿主是**故意**把
无法解析的引用当硬错误的：宁可拒绝发送，也不要发出一条"引用静默消失"的消息。降级会让
用户以为引用发出去了，而模型看到的是一段没有出处的正文。这条设计要保留。

改成**把死的芯片从草稿里拿掉**：

- `chip-draft.js` 新增 `staleChipRefs(occurrences, has, source)` —— 纯函数，
  返回"这次页面加载没有 payload 的芯片 ref"。
- `dock.js` 新增一个 effect：发现这种芯片就用**一份快照**把它们从草稿里移除，
  并弹提示「有 {n} 条注释在页面刷新后失效，已从草稿中移除」。
  - 一份快照，不是逐个 `chipBridge.release`：`release` 每次都读实时草稿，
    第二个芯片会按"还含着第一个占位符"的文本去切，offset 就错了。
  - 这不是数据丢失——那个芯片对应的段落早就没了，留下的只是一个必然失败的雷。
- `registrations.js`：万一还是走到拒绝（例如拿不到 `setDraft`），message 改成用户能看懂的
  文案（`card.staleSend`），而不是把内部 id 抛给用户。

#### 验证时抓到的一个 bug

第一版写完后，芯片被正确移除了，但**提示没出现**：`labels.stale` 没有加进 `dock.js` 的
`labels` memo，`labels.stale` 是 `undefined`，effect 在 `setDraft` 之后抛在
`undefined.replace` 上——芯片没了，却没人告诉用户。

补了一条通用断言：**dock 里读到的每个 `labels.<key>` 都必须在这个 memo 里定义**。
反向验证过：删掉那一行，测试报 `missing from the memo: stale`。

#### 真机验证

`tools/probe-stale-chip.mjs`，同一段脚本、只换 `client.js`：

```
旧 bundle：芯片还在 / 无提示 / 0 个请求 / 屏幕上 quote-chat: unknown chip "qc-…"   （3/7）
新 bundle：芯片被移除 / 有提示 / 1 个请求 / 屏幕上没有内部 id                      （7/7）
```

#### 后续：真的把刷新后保留注释做出来了

上面那一版只是"把死的芯片清掉"，属于止血。用户随后问："那能不能刷新后保留注释呢？"—— 能，
而且比当初估计的简单，因为顺序反过来了：

**当初以为要把 chip payload 也持久化。其实不用。** `chipRegistry.register` 的 payload 是从
一条注释**推导**出来的（kind / number / text / comment / label），所以只要把注释存下来、
加载时重新 `register`，codec 需要的东西就全齐了。存两份反而会多一个不一致的来源。

- `annotation-persistence.js`（新）：`createAnnotationPersistence({ storage, max })` → `{ load, save }`。
  版本号放在 **key 里**（`dsh-quote-chat:v1:annotations:<sessionId>`），不是放在值里 ——
  将来改格式时旧条目自然读不到，不需要每次加载都判断和迁移。
- `annotation-store.js`：新增 `restore(sessionId, list)`，不发 id、重算编号、
  并把 `seq` 推到已恢复 id 的序号之后（否则下一次 `add` 可能造出一个已存在的 id）。
- `dock.js`：挂载时恢复 + 重新注册 payload；注释变化时写盘。
  两个 effect 的**声明顺序**是有意义的 —— 恢复先跑，保存后跑。
- `index.js`：创建适配器并下传。

读路径按"解析器"对待，每种畸形都退回空列表：
非 JSON、JSON 但不是数组、条目缺 anchor / 缺 quote、`number` 不是数字、id 为空、id 重复
（重复会让编号和 payload 对不上）、长度超过上限（上限调小后仍然成立）。
**一条坏条目不连坐邻居**：丢掉那一条，其余保留。
存储抛异常（隐私模式、配额满）不向外传播，功能退回到"只在这个页面里有效"，也就是它以前的样子。

#### 真机验证（第二版）

`tools/probe-stale-chip.mjs`，只换 `client.js`：

```
                    芯片   注释气泡   提示        发送
旧 bundle（#3 修复前） 死    0 条      "已移除"    能发（注释没了）
#3 修复版             死    0 条      "已移除"    能发（注释没了）
本版                  活    1 条      无          能发，且带注释
```

8/8 通过。新增 `test/annotation-persistence.mjs` 33 条，测试总数 712。

### 缺陷 4：撤销把芯片放回草稿末尾，而不是原来的位置

> 追踪：issue [#4](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/4) —— **已修复**（见下方「修复」）

**证据强度：`[已验证]`（代码路径 + 真实浏览器复现，修复前后各跑一次）**

- 位置：`src/ui/dock.js` `onUndoRemove` → `chipBridge.place` →
  `src/chip-draft.js` `withAppendedChip`：`offset: base.length`，即**永远追加到末尾**。
- `undoRef.current = annotation` 只保存注释本身，**没有保存它原来在草稿里的 offset**；
  `add()` 返回的对象里也没有 offset 概念。
- 后果：删除草稿中间的一个芯片再撤销，它会跑到句子末尾。文本占位符与 comment 一起移动。

#### 修复

`chip-draft.js` 增加两个纯函数，`chip-bridge.js` 增加一个入口：

- `withChipAt(draft, existing, addition, reference, at)` —— `withAppendedChip` 的对称面：
  在 `at` 处插入，`offset >= at` 的 reference 右移 `addition.length`。
- `chipRemovalSite(draft, references, source, ref)` —— 把"这次删除会切掉哪一段"从
  `withoutChip` 里拆出来。撤销记录和真正的删除读**同一份算术**，两边不会漂移。
  它同时报告 `lead`：芯片独占一行时删除会连带切掉前面那个换行，恢复时必须一起放回去，
  否则芯片会落在上一行的末尾。
- `chipBridge.placeAt(port, read, annotation, labels, site)` —— 注册先于写入的顺序不变。

一个 issue 里没写、但会踩到的点：**新 reference 必须按 offset 插进数组，不能 append**。
`cards.js` 的 `pairs()` 是按数组下标把 DOM 里的芯片和 `occurrences` 对起来的，append 会让
"恢复到最前面"的芯片被编成最后一个号（显示成"注释 2 在第一个位置"）。

#### 真机验证

同一个脚本 `tools/probe-undo-position.mjs`，只换 `client.js`：

```
旧 bundle：[A,B] → 删 A → [B] → 撤销 → [B,A']   ← 缺陷
新 bundle：[A,B] → 删 A → [B] → 撤销 → [A',B]   ← 修复
```

测试 641 条全过；新增 `withChipAt` 7 条、删除-恢复往返 12 条、`placeAt` 8 条、
撤销契约 3 条。

### 缺陷 5：`pairs()` 按下标拉链，长度不等时静默错配

> 追踪：issue [#5](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/5)

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

### 缺陷 6：动作工具栏开着时，Esc 关不掉它

> 追踪：issue [#1](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/1)

**证据强度：`[已验证]`（真实浏览器，三次独立运行，结果一致）**

- 位置：`src/ui/dock.js:180-182`（keydown → `cancelCompose()`）、`src/ui/dock.js:266`
  （`keyup` → `schedule()`）、`src/ui/dock.js:209`（`if (overlayRef.current !== null) return`）。
- 事实：
  - 划选一段 → `.qc-popup` 出现 → 按 Esc：keydown 把 overlay 置空，**紧接着的 keyup**
    触发 `schedule()` → `evaluate()` → 选区还在 → 工具栏被**重新打开**。
  - 实测连按两次 Esc，`.qc-popup` 始终是 1 个、2 个按钮。
  - 撰写框（`.qc-compose`）里的 Esc 是**正常**的：打开撰写框时选区已被清空，
    keyup 重新求值时 `readSelection()` 返回 null，所以不会反弹。
- 后果：Esc 是插件自己声明的关闭键，但对动作工具栏无效；用户只能把鼠标点进正文内部才能关掉。
  不影响鼠标选区本身，属可用性缺陷，不是功能失效。
- 修复方向（两种，语义不同，先定哪种是产品想要的）：
  1. 在 `onKeyDown` 里记一个"这次 Esc 是我处理的"标记，让紧随其后的 `keyup` 跳过这一次求值；
  2. 让 `evaluate()` 记住"用户刚刚主动关掉了这个选区"，同一选区不再自动重开
     —— 这会连带改变"关掉之后重新划选"的行为，需要先确认。
- **与缺陷 1 无关**：`pointerDown` 卡死只会跳过"选区变化后的重求值"，不会让 Esc 失效；
  修缺陷 1 也修不好这条。

### 缺陷 7：芯片编号对不上 —— 界面按位置算，模型按注册时的号码

> 追踪：issue [#6](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/6) —— **已修复**（见下方「修复」）

**证据强度：`[已验证]`（代码路径 + 真实浏览器抓包，修复前后各一次）**

- 界面：`src/ui/cards.js` `pairs()` 把 DOM 里的芯片（文档顺序）和 `occurrences` **按下标拉链**，
  序号就是位置；`src/ui/markers.js` 的 `chipOrdinals()` 是同一套写法。
- 模型：`src/chip-registry.js` `register()` 把 `chipLabel(annotation, labels)` 存进 payload，
  之后**没有任何路径更新它** —— 全仓库唯一的 payload 修改是 `updateComment()`，只动 comment。
  `src/registrations.js` 的 `serialize` 直接 `serializeChipForModel(payload)`，用的是存下来的 `label`。
- 两套只在"注册顺序 == 当前顺序"时一致。删掉中间一条注释，界面显示 1、2，模型收到 1、3，
  而且可能出现**重复编号**（A=1、C=3、D=3）。

#### 修复

`chip-draft.js` 新增 `chipOrdinal(occurrences, source, ref)`：按宿主数组的下标算位置。
**故意不按 `offset` 排序** —— `pairs()` 和 `chipOrdinals()` 都是按下标拉链的，这里换一种顺序
反而会在更多情况下让模型和界面不一致；要改就得三处一起改。

`registrations.js` 的 `serialize` 在组消息时通过 `labelHandler` 问一次当前位置，拿不到就退回
存下来的 label（dock 没挂载时，例如从别的视图提交）。

#### 真机验证

`tools/probe-ordinal-submit.mjs` —— 抓发出去的请求体，而不是看界面：

```
三条注释 → 删第一条 → 界面 注释 1 / 注释 2
旧 bundle：payload [注释 2] [注释 3]   ← 缺陷
新 bundle：payload [注释 1] [注释 2]   ← 修复
```

顺带证实了 `serialize` 确实在草稿还在的时候跑（否则拿不到 `occurrences`，会退回旧行为）。

### 缺陷 8：吸附判断在 23px 的缝隙里每帧翻转（"小幅高频抖动"的一半）

> 追踪：issue [#11](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/11) —— **已修复**（见下方「修复」）

**证据强度：`[已验证]`（真实浏览器：定点扫描 + 逐帧采样，两种方法互不依赖）**

`needsRescue` 的两个分支用的是**反过来的阈值**：

- 未吸附 → 越界 1px 就吸附（`resting.top < visibleTop - 1`）；
- 已吸附 → 必须越界 24px 才算"还该吸着"（`clearlyOut`），否则松开。

于是 `visibleTop-24 .. visibleTop-1` 这 23px 里，"松开"和"吸附"的条件**同时成立**，每次渲染翻一次。
代码里的 `comfortablyVisible` 在这个位置恒为 false（`clearlyOut` 已蕴含它），所以写了但没起作用。

实测（1440×560，滚动范围 0..657，头部底边 76）：

```
每滚 1px 落定一次：
  343:top 344:- 345:top 346:- ... 364:- 365:top 366:top
  ↑ 23 次翻转，之后才稳定
逐帧（1px/帧，120 帧）：state changes 23，相对位置 -24..+35
```

逐帧表里，面板被两个状态轮流拖着，从头部底边下面 2px 一路滑到上面 24px，
然后在 366 那一帧啪一下落回槽位（+7）。`tools/probe-dock-jitter.mjs` 的两条断言 FAIL。

顺带：`tools/probe-compose-band.mjs`（#9 的回归探针）在 scroll 365 读到的"藏在头部下面 24px"
就是同一个现象——HEAD 和新构建都一样，不是本轮改动引入的。

#### 修复

判断本身抽成纯模块 `src/dock-decision.js`（`dockDecision()`），两个阈值分开：

- **进入**：越界 `ENTER_SLOP = 1px` 就吸附；
- **离开**：只有"舒服地回到带内"（上下各留 `DOCK_MARGIN = 24px`）才松开。

两个条件不再重叠：`r < bandTop-1`（进入）和 `r ≥ bandTop+24`（离开）之间有 25px 的稳定缝隙。
进入**故意**不用 24px——那一版试过，滞后变成 48px，代价是面板可以先钻到头部底下 24px 才弹回槽位，
也就是 #9 抱怨的那个现象；实测 `probe-compose-band` 又会红。所以滞后放在"离开"这一侧。

抽成模块的直接理由是**可测**：原来这段是渲染体里的一个表达式，没法断言。
`test/dock-decision.mjs` 现在把静止位置一像素一像素扫过阈值，数"状态变了几次"——
有滞后的规则只变一次，重叠的规则每像素变一次。

#### 真机验证

```
定点扫描（每滚 1px 落定，offset 135..403，共 269 个位置）
  修复前：343:top 344:- 345:top ... 365:top     ← 23 次翻转
  修复后：135:- … 365:- 366:top 367:top … 403:top ← 1 次
逐帧（1px/帧）：state changes 0，相对头部底边 8.00..8.00（spread 0.00px）
```

顺带：`probe-compose-band` 的 `scroll 365` 那一条从 FAIL 回到 **5/5**（worst 头部重叠 -8px、作曲器重叠 -15px）。

---

### 缺陷 9：吸附槽位在亚像素滚动下漂移 1px 再弹回（"小幅高频抖动"的另一半）

> 追踪：issue [#12](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/12) —— **已修复**（见下方「修复」）

**证据强度：`[已验证]`（真实浏览器；滚动由定时器驱动，避开 rAF 回调顺序）**

两处叠加：

1. 每帧跑的 `watch` 只在**锚点区块的整数盒子**变化时 `setViewportTick`，`scroller.scrollTop` 没参与比较。
   滚动 0.5px 时，区块取整后的 `top` 每两帧才变一次；中间那一帧面板作为一个内容空间的绝对定位元素
   被容器一起卷走——吸附状态下这是纯误差。
2. `target.top` 又被 `Math.round` 到整数，`scrollTop` 是小数时抵消不干净。

实测（顶部吸附，定时器每 tick 滚 0.5px）：

```
scrollTop  625.00 → 625.50 → 626.00 → 626.00
相对头部     8.00     7.50     7.00     8.00   ← 重算，弹回
60 帧：spread 1.00px，方向反转 19 次，animations 0/60
静置对照：spread 0.00px
```

底部吸附同样（`7.50 / 8.00 / 8.50`，19 次反转）。

#### 修复

三处，缺一不可：

1. **让滚动参与重算触发**：每帧的 `watch` 现在也比 `scroller.scrollTop`。
2. **槽位在视口空间取整**：`dock-decision.js` 的 `dockSlotTop()` 负责取整，`layout.js` 的 `snapPosition()` 用它；
   内容空间的 `top` **不再**取整，这样小数 `scrollTop` 正好被抵消，画出来还是整数像素。
3. **在本帧内提交**：`watch` 里用 `flushSync` 包住 `setViewportTick`。

第 3 点是量出来的，不是想出来的。修好前两条以后逐帧采样仍然有 1.5px 的锯齿，用截图看**真正画出来的**帧才发现：
`setState` 在帧回调里是**被调度的**（React 18 走 scheduler 的通道），DOM 在**这一帧画完之后**才更新——
于是每一帧面板都晚一帧落位。用真滚轮 + `Page.captureScreenshot` 抓画出来的帧，
面板顶边在"滚动刚发生"的那几帧里比槽位高 **9px**，下一帧才回到槽位。

`flushSync` 让渲染和提交发生在同一个回调里、样式与绘制之前。宿主提供的 React 没有这个 API 时退回原来的调用。

#### 真机验证

```
probe-dock-jitter（逐帧，滚动由定时器驱动 = 帧之间，和真实输入一致）
  修复前：0.5px/帧 → spread 1.00px / 19 次反转；静置 0.00px
  修复后：1px/帧、0.5px/帧 → spread 0.00px / 0 次反转；静置 0.00px
  6/6 checks passed
probe-paint-lag（真滚轮 + 截图，看画出来的帧）
  修复前：面板顶边最坏偏离槽位 9px（左边缘法）
  修复后：最坏 1.5 CSS px（含合成器取整噪声），2/2
```

---

### 缺陷 10：面板和作曲器之间没有间距（已修复，按用户要求不开 issue）

`readableBand()` 的下边界来自 `findComposerDock()`，而它在本构建里走的是
「三个 `data-slot` 包装都是 0×0」的兜底分支：取**最低的那个 contenteditable**。
editable 不是作曲器的边——它外面那张卡（白底、圆角 28、`padding-top 8px`）比它高 8px。
于是"距作曲器 8px"的槽位正好落在卡的边上，看起来就是贴住了。

实测（1440×560，底部吸附）：

```
修复前：面板底边 430.5   卡片顶边 430.0   →  间距 -0.5px（压在卡的边上）
顶部同规则：面板顶边 84.0   头部底边 76.0  →  间距 +8px
修复后：面板底边 422.5   卡片顶边 430.0   →  间距 +7.5px（差的 0.5px 是缺陷 9 的取整）
```

#### 修复

`src/layout.js` 新增 `composerSurface(editable)`：从 editable 往上找**第一个真的画了东西**的祖先
（背景色 / 背景图 / 上边框），带三个边界——只在 editable 上方 160px 内找、高度超过视口 60% 的盒子不算
（那是页面）、最多 6 层。`findComposerDock()` 的兜底分支返回它。

测试：`test/layout.mjs` 新增 4 条（画了东西的祖先是作曲器的边、透明包装不算、整页盒子不算、
band 底边跟着走），该套件 45 条。探针：`tools/probe-compose-gap.mjs`（gitignore），2/2。

---

### 缺陷 11：悬停卡片和红色 × 用的是"快照锚点"，芯片被文字推走后它们留在原地

> 追踪：issue [#13](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/13) —— **未修复**

**证据强度：`[已验证]`（真实浏览器复现 + 直接读到过期锚点 + 代码路径唯一）**

用户报的场景：悬停注释芯片 → 弹卡片和红色 × → **在芯片前面输入文字** → 芯片被推走 →
鼠标已经不在芯片上，但 × 还留在原地，压在正在输入的文字上（卡片也一样，只是用户说"可以算 feature"）。

实测（1440×700，悬停后不移动鼠标，用键盘打 17 个字）：

```
悬停时：  chip 505.72..   × 中心 521    card 505..885     ← 正常，× 在芯片左边缘
打字后：  chip 817.53..   × 511..532    card 506..886     ← 芯片右移 312px，× 和卡片没动
--qc-chip-left（× 的 inline 变量）：505.72，实时芯片 left 是 817.53
```

那 17.3px 的位移不是跟随，是"悬停前点击输入框让光标落位"造成的芯片位移——锚点正是在那一刻取的。

#### 根因

`src/ui/cards.js` `onPointer`（`mouseover`）在**指针事件那一刻**量一次 `chip.getBoundingClientRect()`，
存进 `hover.anchor`。之后：

- `hover.anchor` 是快照，除了下一次指针事件没有任何重测路径；
- ×（`.qc-chip-remove`）是 `position: fixed`，位置完全来自 `--qc-chip-left/top/height` 三个变量；
- 卡片用同一个 anchor；
- **打字不产生指针事件**——鼠标一动不动，`mouseover` 不会再触发。

所以这不是"卡片该不该留着"的问题，是**两个浮层被钉在过期坐标上**。
危险的地方在于 × 的位置错、行为对：它点的仍是正确的那条注释，用户可能以为在删文字，结果删掉的是注释。

#### 修复方向（未做）

悬停期间持续重测：rAF 循环比较芯片矩形与 `hover.anchor`，不同就 `setHover` 只更新坐标（不重置其它字段，
避免卡片闪烁）。这个仓库的组合面板已经用这个做法。用 `MutationObserver`/`ResizeObserver` 只能覆盖"内容变了"，
覆盖不了"容器自己滚了/换行了"。

"芯片移走后要不要关闭卡片"是另一个决定（用户倾向可保留），不在本 issue 里。

#### 复现

```
node tools/probe-chip-hover-follow.mjs <url>     # 2/4，两条 FAIL
```

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
node build.mjs --check   → sha256:5c3842d71dee43d5，通过
npm test                 → 748/748 通过，0 失败
```

验收套件（需要 1.1 + 1.2 的前提）：

```
accept-highlight   18/18
accept-side-chat   26/26
accept-lifecycle   68/73（QC_VIEWPORT=1440x1000）
verify-web-build   OK — Web serves the current build
```

修任何一个缺陷后，至少要保证 `npm test` 仍 748 通过，且 `--check` 的哈希变化
**只能来自源码改动**。新增测试并入 `package.json` 的 `test` 脚本（注意是长
`&&` 链，加在末尾）。

---

## 5. 建议的动手顺序

按"复现成本低、影响面小、能先建立信心"排：

1. ~~**缺陷 4（撤销位置）**~~ **已完成**。原来以为"改动局限在 `dock.js` 一处"，
   实际需要在 `chip-draft.js` 新增对称的插入函数、在 `chip-bridge.js` 新增 `placeAt`，
   并注意 reference 数组必须按 offset 排序（否则编号错位）。
2. **缺陷 1（pointerDown 卡死）**：影响最大（工具栏永久失效），但需要真实 pointer
   序列的探针——先写这个探针，它会同时成为回归保护。
3. ~~**缺陷 3（孤儿芯片）**~~ **已完成**。契约方向已经问清楚：宿主**故意**把无法解析的引用
   当硬错误，所以不降级，改成把死芯片从草稿里移除并告知用户。
4. ~~**缺陷 2（12 条上限）**~~ **已完成**。三个方向里选了「上限只数草稿里的芯片」，
   因为另外两个都修不了"满额时屏幕上没有可删的东西"这件事。
5. **缺陷 5（pairs 下标）**：风险最低（已被兜住一部分），且改法需要确认属性里有没有 ref。

---

## 6. 我明确没有做的事

- 本文档本身不含代码改动。缺陷 4 已单独修复，见该节的「修复」与对应 issue。
- **没有**端到端复现缺陷 1、3（只读了代码路径和宿主契约）。
- **没有**查明会话级模型覆盖 `our-free-model` 的来源（见 1.2）。
- **没有**验证缺陷 2 在真实浏览器里"发送后注释不清除"的时序——只用 store 层验证了额度行为。
- 上一轮有两处说法**已被本轮证伪并更正**：缺陷 2 不是"终身额度"（删除会释放）；
  缺陷 5 不是"错配"（是少配）。执行者请以本文档为准。
