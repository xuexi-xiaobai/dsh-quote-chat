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

> 追踪：issue [#13](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/13) —— **已修复**（见下方「修复」）

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

#### 修复

用户同时定了行为：**不再保留"卡片跟着鼠标走"那个 feature——鼠标离开芯片就关**。所以一条规则同时解决两件事：

> 悬停打开期间，每帧拿**记住的指针位置**和芯片**实时矩形**比一次。

- 指针还在芯片里 → 用实时矩形更新锚点（× 和卡片跟着芯片走）；
- 指针不在芯片里 → 立即关（`scheduleClose(0)`，不走 260ms 的 linger）。

这一个比较覆盖三种情况：鼠标移开、芯片移开（打字把它推走）、芯片在指针下换行/变大。
`src/ui/cards.js` 里新增 `pointerRef`（**必须是 ref**，原因见下）、`pointerOnChip()`、`follow()` 帧循环、
`scheduleClose(linger)`（关之前复查一次，避免把刚打开的另一张卡片关掉）。

配套的两处行为调整：

1. `hoverTargetOf` 里不再把 `.qc-card` 当成"还在芯片上"——卡片浮在芯片上方，指针在卡片上就不在芯片上；
   × 仍然算（它画在芯片左侧的字形槽里，实测覆盖 `chip.left+7..+24`，在芯片盒子内）。
2. 指针离开窗口（`mouseout` 且 `relatedTarget === null`）也关，否则再也没有指针事件来关它。

**踩到的两个坑**（都在真机验证里暴露）：

- 效果体的依赖里有 `occurrences`，**打字会让它重跑**，cleanup 把帧循环取消了 → 循环必须在效果体重启；
- `pointer` 一开始是效果体里的闭包变量，重跑后变回 `known: false`（"未知"必须当作"还在芯片上"，否则第一次悬停
  没坐标），于是芯片已经跑到 330px 外、× 还在跟着它走。改成 `React.useRef` 后正常。

#### 真机验证

`tools/probe-chip-hover-follow.mjs`（**6/6**）：

```
悬停：      chip 488.4..   × 中心 504.3   card 488..868
小移动后：  chip 505.7（+17.3）  × +16.3   card +17.3     ← 跟着走
推走之后：  chip 834.9          × 消失     card 消失       ← 关闭
移回去：    卡片重新出现
```

另外单独验了 × 仍然可点：悬停 → 指针在芯片内移到 × 上（`remove:true, card:true`）→ 点击 →
`chips: 0`、草稿清空。

#### 复现

```
node tools/probe-chip-hover-follow.mjs <url>     # 2/4，两条 FAIL
```

---

### 缺陷 12：划词工具栏点外部不消失（侧栏按下连选区都还在）

> 追踪：issue [#14](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/14) —— **已修复**（见下方「修复」）

**证据强度：`[已验证]`（真实浏览器矩阵 + 两处代码路径 + 后果实测）**

划词弹出的工具栏（`.qc-popup`）在正文之外按下时不会消失，而且有两种不同的成因：

| 按在哪里 | 工具栏 | 选区 |
|---|---|---|
| 正文空白条 / 另一段正文 | 消失 | 清空 |
| 左侧栏 | **还在** | **335 字仍高亮** |
| 头部 / 作曲器 | **还在** | 清空 |

1. **防误触规则串了场**：`dock.js` 的按下处理器里有 `if (!isInsideTranscript(event.target)) return`，
   这条规则是给「添加注释」面板写的（草稿不能点丢），但它和工具栏共用一个 `overlay`，工具栏也继承了豁免。
2. **选区消失观察不到**：选区跟踪的 `evaluate()` 第一行是 `if (overlayRef.current !== null) return`，
   所以"选区已被清空"这件事在浮层开着时永远不会被处理。

后果不只是难看：选区清空、工具栏还在时按钮仍可用——点"注释"会为一段**已经松开手**的 335 字开面板
（实测标题写着"已选 335 字"）。

顺带说明：**「添加注释」面板保持打开是对的**（用户确认），它需要"划选 + 点按钮"两步，不易误触。
所以修法是**把两种浮层的关闭规则分开**，而不是把面板也改成"外部一点就关"。

#### 修复

两种浮层是两种东西，`overlay.kind` 分开处理：

- **`actions`（划词工具栏）**：任何不在它自身的按下都关，并且**顺手清掉选区**
  （左栏那种按下不会自然清选区，不清的话紧接着的 mouseup 会重新读选区、把工具栏又打开——和 #1 的 Esc 同一个形状）；
- **`compose`（添加注释面板）**：保持原来的规则，只有正文内的按下才关。

选区跟踪那边，`evaluate()` 的提前返回从"任何浮层"收窄成"非 actions 的浮层"：
`compose` 开着时不读选区（保护草稿），`actions` 开着时照常读——选区被浏览器清掉就跟着关。

测试：`test/toolbar-dismiss.mjs`（8 条），钉住"工具栏分支在正文判断**之前**""关的时候清选区""面板仍然只认正文内的按下"
这三件事；反向验证过（把 `actions` 分支去掉 → 3 条 FAIL）。

#### 真机验证

```
修复前：左侧栏 → 工具栏还在、选区 335 字仍高亮；头部/作曲器 → 工具栏还在、选区 0 字
修复后：五个区域（正文空白条/另一段正文/左侧栏/头部/作曲器）全部 → 工具栏消失、选区清空
```

`tools/probe-toolbar-dismiss.mjs` **10/10**（原来 5/11；最后一条"过期工具栏还能开面板"的检查现在不再触发，
因为工具栏根本不在了）。

另有对照：`tools/probe-compose-dismiss.mjs` 显示「添加注释」面板仍然**只**在正文内按下时关闭
（点头部 `painted:true, compose:true`，点正文 `painted:false, compose:false`）——用户要求的防误触没被改掉。

#### 复现

```
node tools/probe-toolbar-dismiss.mjs <url>     # 修复后 10/10
```

### 缺陷 13：暗色模式下工具栏的分隔线不可见（已修复，issue #20）

> 追踪：issue [#20](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/20) —— **已修复**（见下方「修复」）

**证据强度：`[已验证]`（真实浏览器，两种 colorScheme 下各量一次；数值与截图一致）**

用户报告："在暗色模式下，工具栏的中间线依然不明显。"

缺陷 12 之后工具栏两个按钮之间有一条 1px 竖线（`button+button::before`），浅色下清楚，暗色下几乎消失。

#### 实测

用 `emulateMedia({ colorScheme })` 切换，把分隔线颜色按 alpha 合成到浮窗底色上：

| | 浮窗底色 | 分隔线渲染后 | 最大通道差 |
|---|---|---|---|
| 浅色 | rgb(233,236,242) | rgb(214,217,223) | **19** |
| 暗色 | rgb(97,102,107) | rgb(89,94,98) | **9** |

#### 根因

第一版把颜色写死成 `rgba(0,0,0,.08)`——**黑**。浅色底上"减暗 8%"是一步看得见的落差；
暗色底上同样是减暗 8%，但底色本身已经偏暗，减完几乎没有变化。

而宿主的 token 是会随主题翻转的：

| token | 浅色 | 暗色 |
|---|---|---|
| `--dsw-alias-bg-overlay` | rgb(233,236,242) | rgb(97,102,107) |
| `--dsw-alias-border-l1` | rgba(0,0,0,.04) | **rgba(255,255,255,.06)** |
| `--dsw-alias-border-l2` | rgba(0,0,0,.1) | **rgba(255,255,255,.12)** |
| `--dsw-alias-label-primary` | rgb(15,17,21) | rgb(249,250,251) |

暗色下宿主用的是**白**叠加。写死的黑不参与翻转，这是这次回归的唯一原因。

顺带说明设计条目里当时的判断错在哪：`docs/design-log.md` 的 D-4 曾以"和浮窗外框同重"为由否掉
`border-l2`。这个理由站不住——分隔线只有 15px 长，外框是一整圈，**同色不等于同重量**。

#### 修复

```diff
-  background:rgba(0,0,0,.08)}
+  background:var(--dsw-alias-border-l2)}
```

| | 合成后 | 最大通道差 |
|---|---|---|
| 浅色 | rgb(210,212,218) | 23 |
| 暗色 | rgb(116,120,125) | **19** |

暗色下的 19 正好等于浅色原来那个 19，两边现在一致。浅色从 19 变 23（略重），
但它和浮窗自己的外框同色，读起来是"同一套线"。

#### 真机验证

```
node tools/probe-dark-divider.mjs <url>
浅色：divider rgba(0, 0, 0, 0.1)      → 渲染 rgb(210,212,218)，Δ24
暗色：divider rgba(255, 255, 255, 0.12) → 渲染 rgb(116,120,125)，Δ19
```

暗色截图里那条线是清楚的一竖，不再需要凑近看。

测试：`test/toolbar-shape.mjs` 从 4 条加到 5 条，新增"颜色必须来自 token 而不是字面量"——
这条才是真正的回归防线，因为**任何写死的颜色都跟不了主题**。变异验证：把颜色改回 `rgba()` 立刻红。

---

### 缺陷 14：工具栏的分隔线偏向右边的按钮（已修复，issue #21）

> 追踪：issue [#21](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/21) —— **已修复**（见下方「修复」）

**证据强度：`[已验证]`（真实浏览器：布局测量 + 按 2× 抓图后逐列取样，两种方法结论一致）**

用户报告："这条线不是放在两个选项正中间，有点偏向右边的按钮。"

#### 实测

```
gap: 2px
::before  left: -1px   width: 1px
线左侧空出: 1px
线右侧空出: 0px
```

#### 根因

伪元素挂在第二个按钮上，`left` 是相对**第二个按钮的左边缘**算的。

2px 的间隙在那个坐标系里是 `[-2px, 0]`，正中在 `-1px`。而一条 1px 宽的线放在 `left:-1px`，
占据的是 `[-1px, 0]`——它的**左边缘**对齐了正中，线本身整个落在右半边，紧贴右按钮，左边空出 1px。

差半个像素，视觉上就是"偏向右边"。

#### 修复

```diff
-  left:-1px
+  left:-1.5px
```

即 `-(gap + width) / 2`，两边各 0.5px。

#### 真机验证

布局测量（修复后）：

```
gap: 2px  ::before left: -1.5px  width: 1px
线左侧空出: 0.5px
线右侧空出: 0.5px
```

半像素会不会糊？用 CDP 按 2× 抓图后逐列取样（行 y 取在分隔线的竖向范围内、文字的 cap height 之上）：

```
DPR 2（2 倍图）：分隔线落在设备像素列 185、186，两列都是满强度 Δ73
DPR 4（4 倍图）：设备像素列 370-373，四列满强度 Δ73
```

**没有摊成两列半强度**，所以 0.5 CSS px 在 DPR 2 下就是干净的一个设备像素。

已知代价：**DPR 1 下会摊到相邻两列、看起来更淡**。要彻底避免得把 `gap` 从 2px 改成 3px、
线放 `left:-2px`，那是改间距而不只是挪线，本次没做。

测试：`test/toolbar-shape.mjs` 把原来写死检查 `left:-1px` 的那条换成算术检查
`left === -(gap + width) / 2`——以后谁改 gap 或线宽，这条会算出新的正确值；对不上就红。
变异验证：把 `left` 改回 `-1px`，立刻红。

---

### 缺陷 15：划词工具栏压住作曲器，层级反了（已修复，issue #23）

> 追踪：issue [#23](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/23) —— **已修复**（见下方「修复」）

**证据强度：`[已验证]`（真实浏览器：真实 CDP 鼠标拖选 + 真实滚轮，连续 3 次；`elementFromPoint` 判定绘制顺序）**

用户报告："选中文本松开鼠标后，弹出菜单工具栏会固定在鼠标松开的位置，并且不随屏幕滚动而变化，现在这个菜单工具栏会在移动到下方聊天框时覆盖我们的聊天框，这个层级关系搞反了。"

#### 实测

探针 `tools/probe-toolbar-layer.mjs`（本轮新增）：

| 事实 | 值 |
|---|---|
| 工具栏 | `div.qc-popup`，`position:absolute`，`z-index:60`，挂载在 `div.wSkVaW_scrollBody` |
| 作曲器 | `div.wSkVaW_composerSeat`，`position:sticky`，`z-index:9`，同一个 scroller 的第 1 个子节点 |
| 工具栏位置 | 同一个 scroller 的第 2 个子节点（在作曲器之后） |
| 重叠点 `elementFromPoint` | 工具栏的 `button` → 工具栏在上面 |

关于"不随滚动"：**实测它是跟着文字走的**（真实滚轮 -200px → 工具栏 top +200px；程序滚动 -120px → +120px）。
所以"钉在屏幕上不动"没有复现；能复现的是它随正文滚进作曲器区域、然后压住作曲器。

#### 根因

- `src/stylesheet.js:17`：`.qc-popup{...z-index:60...}`
- `src/ui/popovers.js:151`：工具栏 portal 进 `anchored.scroller`，React 追加在作曲器之后
- 作曲器 `z-index:9`；正文文字是 in-flow（`z-index:auto`）

所以 60 > 9，工具栏直接压过作曲器。**单独把值降到 9 也不行**：工具栏在 DOM 里排在作曲器之后，
同层时后者画在前面；而低于 9 的其它值实测仍然在正文之上（正文是 in-flow，任何正 z-index 都盖过它），
所以 6 是安全的。

#### 修复

```diff
- .qc-popup{position:fixed;z-index:60;...
+ .qc-popup{position:fixed;z-index:6;...
```

与 `.qc-compose` 同层：插件表面在正文之上、在 chrome（作曲器）之下。

#### 真机验证

```
修复前：overlap → elementFromPoint = button（工具栏）              toolbar on top: true
修复后：overlap → elementFromPoint = div.uV2eYG_row（作曲器的行）  toolbar on top: false
        未重叠时 elementFromPoint(centre) = button（工具栏仍在正文之上）
```

探针退出码从 1 变 0。

#### 测试

`test/toolbar-shape.mjs` 新增一条：`.qc-popup` 的 `z-index` 必须 `> 0` 且 `< 9`（作曲器的层）。
变异验证：把 `z-index` 改回 60，立刻红。

---

### 缺陷 16：表格的添加注释按钮在指针移上去时自己消失（已修复，issue #24）

> 追踪：issue [#24](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/24) —— **已修复**（见下方「修复」）

**证据强度：`[已验证]`（真实浏览器：真实 CDP 鼠标，连续 3 次；程序化 click 作对照）**

用户报告："表格右上角的添加注释工具栏，鼠标移上去时频繁闪烁，点击后并没有在聊天框里加上注释芯片。"

#### 实测

探针 `tools/probe-table-add.mjs`（本轮新增）：

```
从表格内部向按钮中心分 12 步移动：
  presence: 111111111100   transitions: 1   FLICKERS
  last mousemove target: TH（仍在 flow 内）
  mouseleave: target=DIV/mainPanel/centerCol/frame, relatedTarget=BUTTON.qc-table-add

点击：the button is gone before the click — the click cannot reach it
对照：程序化 click → compose 打开 → 确认 → 芯片 +1
```

在单元格之间横向移动（不靠近按钮）是稳定的（`1111111111111`，0 次翻转），所以闪烁集中在按钮本身。

#### 根因

`src/ui/table.js`：

- `:82-88` `onMove` 用 `closest(FLOW_SELECTOR)` 判断；按钮 portal 到 `document.body`，指针在按钮上时
  `flow === null` → `pending = null` → 按钮被移除
- `:89-92` `document` 捕获阶段的 `mouseleave` 会收到每个元素的 leave；从表格移到按钮时
  `relatedTarget` 是按钮 → 同样清空

两条路径叠加：指针一碰到按钮就删自己，下一次 mousemove 又加回来 → 闪烁；点击落下时按钮已不在 →
打不开撰写框 → 没有芯片。

#### 修复

- `onMove`：target 在 `.qc-table-add` 内时提前返回，保留当前 target
- `onLeave`：`relatedTarget` 在按钮内、或在当前表格内时不清空
- 新增 `test/table-add-guard.mjs`（6 条源码形状断言）

#### 真机验证

```
修复前：presence 111111111100，transitions 1，点击落空
修复后：presence 111111111111，transitions 0；真实点击 → compose 打开 → 确认 → 芯片 +1
```

#### 测试

`test/table-add-guard.mjs`：onMove 的按钮 guard 必须出现在 flow 查询之前；onLeave 必须读
`relatedTarget` 并保留按钮内/表格内的移动。变异验证：删掉任一 guard，立刻红。

---

### 缺陷 17：表格注释跳转失败：锚点 quote 用 innerText，匹配用 textContent（已修复，issue #25）

> 追踪：issue [#25](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/25) —— **已修复**

**证据强度：`[已验证]`（真实浏览器，探针 `tools/probe-table-compose.mjs`，连续 3 次）**

现象：点表格注释芯片 → "row present, quote missing (240 chars: 步骤\t结果\n克隆仓库…)"，不滚动、不高亮。

根因：`src/ui/table.js` 的 `tableAnchor` 存 `table.innerText`（单元格之间 `\t`、行之间 `\n`），而
`resolveAnchor` 拿它和 `Range.toString()` / `textOf()` 比，二者都是 `textContent`，**没有这些分隔符**。
`squishText` 只折叠空白，不会凭空插入空格，所以两边永远不相等；`locateText` 的兜底同样在
`textContent` 里搜带空格的引文，也搜不到 → 返回 null → `diagnoseMiss` 报「row present, quote missing」。

修复：

```diff
- quote: table.innerText.trim(),
+ quote: table.textContent.trim(),
```

注释正文（`annotation.text`）仍是 Markdown 表格，不受影响。

真机验证：修复前 notice 非空、highlight false；修复后 notice 为空、highlight true。

测试：`test/table-annotation.mjs` 断言锚点 quote 用 `textContent` 而不是 `innerText`。

---

### 缺陷 18：表格的注释面板没有评论输入框（已修复，issue #26）

> 追踪：issue [#26](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/26) —— **已修复**

**证据强度：`[已验证]`（真实浏览器，探针 `tools/probe-table-compose.mjs`）**

现象：点表格「添加注释」→ 面板 420x62，`textarea: false`，只有「N 行」提示和取消/确认两个按钮；
确认后芯片能加，但评论恒为空。

根因：`src/ui/popovers.js` 的 `ComposeBody` 对 `source.kind === 'table'` 不渲染 textarea，确认时
`onConfirm(source.kind === 'table' ? '' : comment)` 把评论写死成空。存储层本来支持评论
（`dock.js` 的注释写着 "A table is annotatable too: the requirement asks for a comment box on tables"）。

修复：无条件渲染 textarea，确认时传 `comment`。

真机验证：修复后面板 420x123，`textarea: true`，真实键盘输入「表格评论测试」生效，确认后芯片 +1。

测试：`test/table-annotation.mjs` 断言 textarea 不被表格分支跳过、确认传 `comment`。

---

### 缺陷 19：表格注释面板的上下吸附失效（已修复，issue #27）

> 追踪：issue [#27](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/27) —— **已修复**

**证据强度：`[已验证]`（真实浏览器，两个 scratch 探针，各连续 3 次）**

现象（文字选区的面板正常）：

1. **上区域**：面板与 header 重合时输入文字会 dock 到顶部一次，之后滚动正文**不再吸附**，停在文本流位置跟着内容滚走。
2. **下区域**：把内容往下滚、面板越过作曲器时**根本不 dock**，直接滚到作曲器后面。

实测（修复前）：

```
上：文字 84..207 PINNED / 表格 84..207 → 滚动 +120 → -36..87 not pinned（docked 属性仍是 top）
下：文字 → docked=bottom 367..490 稳定 / 表格 → docked=false 534..657 → 654..777，已在 band 外
```

根因：`src/ui/popovers.js:337-358` 的每帧 watcher 读 `source.block`，为 `null`/`undefined` 时直接 return。
文字路径（`src/selection.js:158`）传了活段落；表格路径的 `annotateTable`（`src/ui/dock.js:494-507`）只传了
`rect`（点击时快照），没有 `block` → watcher 每帧空转 → 滚动后既不重算上槽位，也不重新判断下吸附。

修复：`annotateTable` 补 `block: table` 与 `blockRect`，与 `readSelection` 的表格分支完全对齐。

真机验证（修复后）：

```
上：表格 84..207，滚动 +120 / -120 都 PINNED
下：表格 → docked=bottom 367..490，再滚 120px 仍稳定（与文字面板一致）
```

测试：`test/table-annotation.mjs` 新增两条——表格 source 必须带 `block`（活元素）和 `blockRect`。

---

### 缺陷 20：代码块含标题选中后，注释面板落在屏幕外（已修复，issue #28）

> 追踪：issue [#28](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/28) —— **已修复**

**证据强度：`[已验证]`（真实浏览器，scratch 探针 `tools/probe-code-block.mjs`，连续 3 次）**

现象：从代码块标题「代码块」拖到代码内容、点「添加注释」后，面板看起来没弹出，芯片也不出现。
只选代码内容（起点在 `pre` 内）时正常。

实测（修复前）：

```
compose panel: true   {"left":569,"top":-132,"width":420,"height":123}   ← 屏幕外
chips 1 → 1            （无法确认）
confirm（程序化）→ chips 2
```

根因：`src/selection.js:157` 的 `block = closest(BLOCK_SELECTOR) ?? flow`。代码块结构是
`div.md-code-block > (标题栏, 内容 > pre)`；起点在标题的 `span` 里时，`closest(BLOCK_SELECTOR)`
（`p, li, h1..h6, pre, blockquote, table, figure`）落空 → 回退到整个 `flow` → 面板放到对话流上方，
`top: -132`，用户看不到，也就无法确认；芯片只在确认时写入。

修复：落空时先回退到**最近的代码块包裹元素**（向上找第一个包含 `pre` 的祖先），再回退到 `flow`。

```js
const block = rangeStartElement.closest(BLOCK_SELECTOR)
  ?? codeBlockWrapper(rangeStartElement)
  ?? flow
```

真机验证（修复后）：面板 `{"left":569,"top":154,...}`，确认后芯片 +1。

测试：`test/selection-block.mjs` 钉住「codeBlockWrapper 必须在 flow 之前」以及 helper 找 `pre` 的规则。

---

### 缺陷 21：inline code 注释的锚点校验拿整段文字比较，气泡在段落与消息行之间闪烁（已修复，issue #29）

> 追踪：issue [#29](https://github.com/xuexi-xiaobai/dsh-quote-chat/issues/29) —— **已修复**

**证据强度：`[已验证]`（真实浏览器，scratch 探针 `tools/probe-inline-code.mjs`、`tools/probe-inline-inject.mjs`）**

现象：选中被反引号包裹的 inline code（渲染成 `<code>` 的几个字）并添加注释后：右侧气泡闪烁；
注释芯片定位到第一处相同文本而不是选中的那一处；之后很难再点开这条注释补评论。

实测（修复前）：对新气泡连续采样 40 帧，同一个元素在两个父节点之间来回切换：

```
present 40/40
distinct tops 2    [-202, 336]
distinct parents 2
  div.EvIC1a_flowItem…@-202[14:assistant-step2:3]   ← 整条消息行
  p.qc-hosts-bubble@336[null]                       ← 正确的段落
```

用可控 fixture 复现错误定位：两个段落各注入一个相同的短 `<code>inlinetarget</code>`，
注释**第二个**，修复前气泡落在 `top:-689`（第一个，视口上方），芯片跳转也高亮第一个。

根因：`src/text-ranges.js:391` 的 `textOfWithin` 在 block 含有 `data-qc-ignore` 时返回
**整个 block 的文本**，而不是 range 自己的文本：

```js
if (box.querySelector('[data-qc-ignore]') === null) return raw
return textOf(box)          // 整段文字
```

插件自己的气泡就挂在段落里、带 `data-qc-ignore`，于是：气泡挂进段落 → 校验返回整段文字 → 整段文字
≠ 引文 → 路径校验失败 → 回退到全文搜索（命中第一处相同文本或行级节点）→ 气泡移走 → 段落不再含
`data-qc-ignore` → 校验通过 → 气泡移回 → 再失败，即闪烁。长选区不易触发（整段文字恰好等于引文），
短 inline code 最容易命中。

修复：只对 range 自己的内容做剔除，绝不回退到整个 block：

```js
const fragment = range.cloneContents()
for (const node of fragment.querySelectorAll('[data-qc-ignore]')) node.remove()
return fragment.textContent ?? ''
```

真机验证（修复后）：同一 fixture 中，注释第二个 code 时气泡现在落在 `top:286`（第二个所在段落），
60 帧父节点序列全为 `P`、0 次翻转；点气泡能打开面板并输入「补充评论」；芯片跳转高亮正确。

测试：`test/anchor-text.mjs`（6 项）钉住「不得 `return textOf(box)`」「必须从 `range.cloneContents()`
剔除 `[data-qc-ignore]`」「无插件节点时仍走 raw 快路径」。

---

### 缺陷 22：删除按钮像贴在芯片上的红色圆片，与药丸不是一体（已修复，无独立 issue）

**证据强度：`[已验证]`（真实浏览器，scratch 探针 `tools/probe-chip-remove-design.mjs`，
2x DPR 截图 `recordings/chip-remove-{resting,hover}.png`）**

现象：悬停芯片时，左侧的删除 × 是一个 `#e8291c` 的实心红圆片 + 1.5px 表面色描边，
盖在药丸的左端。药丸本身是低饱和的 accent 底色 + accent 描边，这个高饱和红圆片像一枚
贴上去的徽章，视觉上与芯片没有关系——即「关闭按钮和芯片本身不是一体」。

修复：删除按钮仍然是固定定位的覆盖层（芯片内容是编辑器的，不能写进去），但覆盖层**不再
画任何底色**：药丸自己的背景从下面透出来，× 用芯片标签的同一种墨色
（`color-mix(accent 78%, ink)`）；红色只保留给 × 自身——悬停时描边变红，不填充
（`.qc-chip-remove:hover{color:#e8291c}`）。同时去掉白色描边。

另一个必须一起处理的问题：× 是 `document.body` 里的覆盖层，不是芯片的子节点，指针从芯片
移到 × 上时芯片自己的 `:hover` 会消失，被隐藏的类型图标会重新出现。组件本来就持有 hover
状态，因此新增 `data-qc-hover` 标在芯片上，CSS 用它把图标一直藏到 × 消失为止。

**修复前后对比**（2x 截图，同一颗芯片）：

| | 修复前 | 修复后 |
|---|---|---|
| × 的底色 | `#e8291c` 实心圆片 + 1.5px 白环 | 透明，药丸底色透出 |
| × 的墨色 | 白色描边 | 芯片标签同色（accent 混合墨） |
| × 悬停 | 圆片变深红 | 只有描边变红，无填充 |
| 指针在 × 上时类型图标 | 被红圆片遮挡 | `data-qc-hover` 保持隐藏 |

测试：`test/chip-interaction.mjs` 更新为 20 项，钉住「× 不得有独立底色」「不得有白色描边」
「× 使用芯片墨色」「红色只出现在 `:hover` 描边」「`data-qc-hover` 必须隐藏类型图标」。

---

### 缺陷 23：芯片标签是序号而不是引文开头，删除按钮在头部（已修复，2026-11-07 设计评审）

**证据强度：`[已验证]`（真实浏览器；设计工作台 `design/chip.spec.mjs` 9 个状态 + 真机 `tools/probe-chip-context.mjs`）**

这两条来自 2026-11-07 在「前端设计工作台」标签页里按元素提的意见，不是缺陷报告：

> 文字部分，注释 1 其实不好，直接用选中文本的前文本截断作为标题好了。
>
> 同样的，删除按钮的位置有问题。

**问题一：标签是序号。** 芯片长在**用户正在打的句子里面**，读者在那里要问的不是"这是第几条注释"，
而是"这指的是哪一段"。序号回答不了，必须去侧栏查。而 `注释 1` 这个写法本身还有历史包袱：
`chip-draft.js` 里记着"早先的版本把截断的引文放在这里，被要求改成编号块"——这次是把它改回来，
但理由不同：当时是照着截图改，这次是按它实际所在的位置判断。

修复：`chipPreview()` 取引文开头十个字符，折叠空白、按码点截断（不切坏 emoji/生僻字）、
以省略号收尾；引文为空时回退到序号。**模型收到的 `[注释 N]` 不变**——那是可引用的块名，
和屏幕上给人看的标签是两个问题。

**问题二：删除按钮在头部。** 它占了类型图标的位置，悬停时把文档图标换成了 ×，于是同一句话里
悬停的那颗和旁边那颗看起来像两个不同组件。参考系统里删除控件一律在尾部：Material 的 input chip
（`deleteIcon`）、Ant 的 Tag（`closable`）、Gmail 的收件人芯片。

修复：移到尾部，芯片右侧预留 `1.75em` 槽位（悬停不重排），类型图标不再隐藏。
顺带修掉一个实测缺陷：按钮原来是 `1.36em`，在作曲器 15px 下只有 **20.4px**，低于 WCAG 2.2 AA
的 24px 指针目标，而且不随芯片字号变化。现在固定 24px，槽位宽度和芯片宽度由组件以**像素**传入
（芯片的 em 和按钮的 em 不是同一个，用 em 会漂）。

| | 修复前 | 修复后 |
|---|---|---|
| 标签 | `注释 1` | `另外，近两年还出现了…` |
| 类型图标 | 悬停时被 × 替换 | 始终保留 |
| × 位置 | 头部，占图标位 | 尾部，预留槽位内 |
| × 尺寸 | 20.4px（em 派生） | 24px（固定） |
| 并排两颗芯片 | 像两个组件 | 同一个组件 |

测试：`test/chip-interaction.mjs` 23 项（新增「悬停不隐藏类型图标」「× 居中于预留尾部槽位」
「槽位与芯片宽度以像素传入」「24px 指针目标」）；`test/numbering.mjs` 改为钉住「可见标签回退到
序号」；`design/chip.spec.mjs` 新增「标签是引文而不是序号」。

**遗留**：静止状态下尾部槽位是空的（悬停才出现 ×）。要填满它需要为每颗芯片常驻渲染一个按钮，
那是 `ChipCards` 的结构性改动，未做。

---

### 缺陷 24：删除按钮被挪到尾部并去掉红色，两个图标尺度不一致（已修复，2026-11-07 第二轮评审）

**证据强度：`[已验证]`（真实浏览器；设计工作台 `design/chip.spec.mjs` 11 个状态 + 真机 `tools/probe-review-panel.mjs`）**

上一轮（缺陷 23）里我把 × 从头部挪到尾部、去掉红圆片改成透明描边，理由是「Material / Ant / Gmail
都把删除控件放在尾部」。**这个推理用错了对象**：那些是收件人输入框里的 token，而这里的芯片是坐在
一句话中间的引文引用。评审直接否掉了：

> 删除注释的按钮的位置不对，应该和左侧的图标位置、轮廓尺度一致，而且之前红色的形式挺好的，你怎么把它删掉了。

同一轮还提了两条：

> 芯片外形能不能改成两端半圆的胶囊型，我看下效果。或者都保留下来，让我对比一下。
>
> 表格的图标样式和文本图标样式尺度不一致，最好调整为一致的尺度。

**修复一：× 回到头部，恢复红色，尺度对齐图标。**
- 位置改回类型图标的槽位：`left = chipLeft + padLeft + glyph/2`，两个输入以**像素**传入
  （芯片的 em 和按钮的 em 不是同一个）。
- 红色圆片由 `::before` 画，尺寸 **1.12em**——和类型图标同一个盒子，所以两态轮廓一致。
- 按钮自身仍是 24×24 透明（WCAG 2.2 AA 指针目标），圆片只是画上去的，不受命中区尺寸约束。
- 芯片不再预留尾部槽位，`padding` 回到 `0 .5em`，静止状态左右对称。

**修复二：表格图标对齐文本图标的尺度。**
文本图标的矩形是 `1.1..14.9`（13.8 单位），表格图标原来是 `1.9..14.1`（12.2 单位），
所以表格芯片的图标看着明显小一圈。现在两者都占满 `1.1..14.9`，网格线一起下移。

**修复三：形状对照。**
样式表本来就是 `border-radius:999px`（两端半圆的胶囊）。为了能对比，工作台里加了两格：
「形状 A · 胶囊」和「形状 B · 圆角矩形」（后者用内联 `8px` 覆盖，标注为**仅作对照**）。
实测 `999px` vs `8px`，高度都是 21px。**产品代码未改**——等评审选定再改。

| | 上一轮（错） | 现在 |
|---|---|---|
| × 位置 | 尾部，预留 1.75em 右内边距 | 头部，占据类型图标槽位 |
| × 外观 | 透明，芯片墨色描边 | 红色圆片 + 白色 × |
| × 尺度 | 24px 按钮即视觉尺寸 | 圆片 1.12em = 图标尺寸；按钮 24px 只是命中区 |
| 类型图标 | 悬停时保留 | 悬停时让位给 × |
| 表格图标 | 12.2 单位高，比文本图标小 | 13.8 单位，与文本图标一致 |
| 芯片内边距 | `0 1.75em 0 .5em`（左右不对称） | `0 .5em`（对称） |

测试：`test/chip-interaction.mjs` 24 项（新增「悬停隐藏类型图标」「圆片与图标同盒」「白色 ×」
「无描边环」「× 居中于头部槽位」「不预留尾部槽位」）；`design/chip.spec.mjs` 的
「删除按钮」一项改为断言**圆片直径 = 图标宽度、圆片中心 = 图标中心、圆片非透明**。

**过程中的一个真 bug**：工作台里「删除按钮悬停」的红圆片渲染成了**方形**——因为工作台把 `::before`
的悬停底色套到了按钮上，而按钮当时没有圆角。已在按钮上补 `border-radius:999px`。

---

### 缺陷 25：删除按钮 24px 而图标 1.12em，两者尺寸不一致（已修复，2026-11-07 第三轮评审）

**证据强度：`[已验证]`（真实浏览器量测 + `document.elementFromPoint` 命中测试）**

评审问了一个直接的问题：

> 请问「删除注释」的按钮和芯片上的矢量图标尺寸一致吗？

**不一致。** 上一轮我把「24px 指针目标」直接做成了按钮的盒子尺寸，而类型图标是 `1.12em`：

| | 15px 字体（web profile） | 17px 字体（桌面应用） |
|---|---|---|
| 类型图标 `1.12em` | 16.8px | 19.0px |
| 删除按钮 | 24px | 24px |

红色圆片是 1.12em，所以**圆片**对得上，**按钮**对不上。

**修复**：按钮尺寸改为 `var(--qc-chip-glyph)`——由组件从芯片读出的像素值，所以任何字号下都和图标相等。
24px 指针目标改由 `::after` 承担：一个不可见、无背景的 24px 圆垫，把命中区撑出绘制区之外。
伪元素参与父元素命中测试，所以点击圆垫任意位置都会激活按钮。

实测（`design/chip.spec.mjs`）：按钮 16.8×16.8 = 图标 16.8；圆垫 24px；
`elementFromPoint(中心 + 10px)` 命中按钮（在 8.4px 绘制半径之外、12px 圆垫之内）。

---

### 缺陷 26：工作台报「圆角 999px」，让人以为不是胶囊（已修复，2026-11-07）

**证据强度：`[已验证]`（6 倍放大截图 + 计算样式）**

评审说：

> 这显然不是胶囊型啊，两端半圆什么形态你不知道吗？

**芯片本身确实是胶囊。** `border-radius:999px` 是「尽可能圆」的哨兵值，浏览器会把它钳制到短边的一半：
21.3px 高的芯片 → 半径 10.65px，两端是标准半圆。6 倍放大截图确认了这一点。

问题出在**工作台自己**：它只报声明值 `999px`。给一个 24px 高的元素报「999px」，任何人看了都会
认为那不是胶囊。而且我上一轮把对照格设成 `8px`，和胶囊的 10.65px 只差 2.65px，两格几乎看不出区别，
反而坐实了「A 不是胶囊」的错觉。

**修复**：
1. 工作台同时报**实际绘制半径**和声明值，并在被钳制时注明「半径 = 高度一半，两端为标准半圆」。
2. 对照格 B 从 `8px` 改为 `4px`，两格的差别一眼可见。

---

### 缺陷 27：胶囊「看起来不像胶囊」——比例问题，不是形状问题（待评审选定）

**证据强度：`[已验证]`（像素轮廓扫描 + 8 倍放大；`tools/probe-chip-silhouette.mjs`）**

评审给了一张参考图并说：

> 我不觉得这个属于胶囊型，我认为目前的是圆角矩形，胶囊型两边应该更加圆润，类似于这种

**先说结论：形状是对的。** 把芯片渲染到透明背景上、按 alpha 覆盖率做亚像素边缘检测，再和
「整条边都是圆弧」的理论轮廓比对，并用两个已知形状做校准：

| | 与整高圆弧的最大偏差 | 判定 |
|---|---|---|
| 芯片 | **0.109 CSS px** | 胶囊 |
| 对照：`border-radius:999px`（已知胶囊） | **0.109 CSS px** | 胶囊 |
| 对照：`border-radius:8px`（已知圆角矩形） | 2.249 CSS px | 不是胶囊 |

芯片和已知胶囊的偏差**完全相同**，而已知圆角矩形差了 20 倍。

**量通过程中踩的三个坑**（都记下来，因为每一个都会得出相反结论）：

1. **只看最顶一行**：那一行是抗锯齿的细条，左边界不是半径。错。
2. **整数像素容差**：半圆在正中附近本来就近乎竖直，1 像素容差会把圆弧的平段误判成直线段——
   我一度得出「有 3.88px 直线段」的错误结论。必须用亚像素。
3. **边框是 26% 透明的**：低于 alpha 阈值，量到的是背景内缘而不是外轮廓，半径会小 1px。
   测量时必须把边框临时改成不透明。

`border-radius:999px` 是「尽可能圆」的哨兵值，浏览器按规范钳制到短边一半，所以它必然是胶囊。

**但评审的直觉指向了一个真问题：比例。** 拿参考图和芯片对比：

| | 参考图 | 我们的芯片 |
|---|---|---|
| 胶囊高度 | ~62px | 21.3px |
| 内容（图标/文字）高度 | ~26–30px | 16.8px |
| **内容占高度** | **~48%** | **79%** |

内容占了 79% 的高度，两端半圆只剩 2.25px 的余量，所以看起来像「圆角矩形」——几何上不是，
观感上是。参考图之所以一眼就是胶囊，是因为内容只占一半，半圆有地方显出来。

**根因**：芯片高度是写死的 `height:1.42em`（15px 下 = 21.3px），所以加垂直内边距完全无效——
这一点我先试过 `padding:0.23em`，实测高度纹丝不动，才发现是固定高度。

**已加的对照**（工作台四格，实测）：

| 格 | 高度 | 图标 | 内容占比 |
|---|---|---|---|
| A · 胶囊（当前） | 21px | 16.8px | 79% |
| B · 圆角矩形 | 21px | 16.8px | 79%（4px 圆角） |
| C · 胶囊（加高） | 26px | 16.8px | 65% |
| D · 贴合参考比例 | 24px | 14.25px | 59% |

C 会让作曲器的行变高（26px > 25px 行高）；D 仍在 25px 行内，是唯一不破坏排版又能接近参考比例的方案。

**产品代码未改**——`--qc-glyph-size` 变量已加入（默认 1.12em，无视觉变化），等评审选定高度和图标尺寸。

**后续（评审第三次指出左右两侧有直线段）**：评审说的是**左右**两端，不是上下。用同一套校准方法
在 150px 字号下重测（此时直线段会是几百个设备像素，不可能被抗锯齿掩盖）：

```
计算值 border-radius:999px  height:213px  width:1268px  box-sizing:border-box
与整高圆弧的最大偏差：0.32 CSS px（高度 213px 的 0.15%）
判定：CAPSULE
```

**几何上确实没有直线段。** 但评审的观察指向了真实后果：21px 高的半圆只有 21 个设备像素，
**圆弧中段的曲率极低**，眼睛会把它读成直线。这就是「几何正确、观感错误」。

**已改**：`height:1.42em` → `1.6em`（15px 下 21.3px → 24px，桌面 17px 下 27.2px），
仍在各自的 25px / 28.3px 行盒内，行不会变高，两端直径增加 14%。

| | 改前 | 改后 |
|---|---|---|
| 高度（15px 字体） | 21.3px | 24px |
| 半圆直径 | 21.3 设备像素 | 24 设备像素 |
| 内容占比 | 79% | 70% |
| 与整高圆弧偏差 | 0.109 CSS px | 0.19 CSS px |

**评审第四次指出「曲率半径不是常数」**。这次用**固定圆心和半径**（半径 = 半高，圆心 = 最小边界 + 半径）
的圆去套整条左边缘，逐点算残差，并和两个已知形状校准：

| | 圆拟合残差（最大） | 判定 |
|---|---|---|
| 芯片（24px 高） | **0.104 CSS px** | 整条边在一个圆上，曲率半径恒定 |
| 芯片（去掉边框） | 0.103 CSS px | 同上，边框不是原因 |
| 对照 `999px`（已知胶囊） | 0.124 CSS px | 整条边在一个圆上 |
| 对照 `8px`（已知圆角矩形） | **1.750 CSS px** | 不在一个圆上 |
| 芯片（150px 字号，240px 高） | 0.180 CSS px | 整条边在一个圆上 |

拟合出的半径是 **12.000 CSS px，正好等于高度的一半**，残差 0.104 px，和已知胶囊同一个量级，
比已知圆角矩形好 17 倍。

**两次失败的拟合方法也记下来**（都会得出相反结论）：

1. **逐点求曲率**（`(1+x'²)^1.5 / |x''|`）：二阶导把像素量化噪声放大到连已知胶囊都算出 670% 的离散度。
2. **无约束最小二乘圆拟合**：边缘接近水平的那几行是离群点，把半径从 12 拉到 13.8。

最终采用**用胶囊假设做种子**（半径 = 半高）再算残差——不拟合，只验证。

**结论**：几何上，左右两侧的曲率半径是常数，等于高度的一半。24px 高的半圆只有 24 个设备像素，
这是观感问题的来源，不是几何问题。

**真正的修复：边框改成不透明。**

评审问「这张图里的完美胶囊和我们的芯片有什么区别」。回到代码逐属性对比后，决定几何的三个属性
（`border-radius` / `box-sizing` / `height`）完全相同，**唯一实质差别是边框只有 26% 不透明度**。

26% 的边框意味着边缘不是一条线，而是一条从填充色渐变到背景的软边。软边落在 12px 的圆弧上，
眼睛读到的就是圆角。**几何是胶囊，观感是圆角——两者可以同时成立。**

逐属性二分验证（换掉任何一个属性，圆残差都还是 0.10）：

```
原样 0.103 · 边框不透明 0.104 · display:block 0.104 · 去 transform 0.073 · 去边框 0.076
```

并直接验证了钳制语义，排除椭圆角落的可能：

```
128.59 × 24 的盒子
  border-radius: 999px  →  顶行内缩 16.37
  border-radius: 12px   →  顶行内缩 16.37   ← 完全相同
```

`999px` 钳制到的是**半高**（12px）而不是半宽（64.3px），所以不是椭圆。

**改动**：`border:1px solid color-mix(accent 26%, transparent)` → `border:1px solid var(--qc-accent)`。
`test/bubble-editor.mjs` 新增「边框必须不透明」一项，防止回退。

---

### 缺陷 28：设计 fixture 用了错误的宿主类名，宿主的芯片 CSS 从未被验证过（已修复，2026-11-07）

**证据强度：`[已验证]`（`app.asar` 全文检索 + 基线不变）**

评审问：「你确定现在插件里的注释芯片的前端样式跟这个一样吗？」从代码查，发现我自己有个漏洞。

**芯片的 DOM 是谁建的？** 宿主的 Lexical 装饰器：

```js
// dsh-client-ui-conversation
createDOM(_config) {
  const el = document.createElement("span");
  el.setAttribute("data-composer-chip", this.__source);
  el.setAttribute("contenteditable", "false");
  return el;
}
```

**裸 span，不带任何 class。** 内层由宿主的 `ReferenceChip` 渲染。

**宿主对芯片有 CSS**（`ReferenceChip.module.css`）：

```css
.M7q97W_chip{ max-width:240px; color:var(--dsw-alias-state-business-primary);
              user-select:none; align-items:baseline; gap:3px; display:inline-flex }
.M7q97W_marker{ flex:none; font-weight:500 }
.M7q97W_label{ text-overflow:ellipsis; white-space:nowrap; overflow:hidden }
```

**插件用一条规则把它中和掉**：

```css
[data-composer-chip="quote-chat"] > span,
[data-composer-chip="quote-chat"] > span > span:last-child{
  position:absolute;width:0;height:0;overflow:hidden;font-size:0;line-height:0 }
```

**但我的 fixture 里写的是 `q44v1G_reference yAWgPa_chip`——在 `app.asar` 的 22425 个文件里 0 命中。**
也就是说：宿主那段 CSS 从来没进过 fixture，「插件中和了宿主样式」这个结论**从来没被验证过**。

**修复**：
1. fixture 的类名改成真实的 `M7q97W_chip` / `M7q97W_marker` / `M7q97W_label`。
2. 把宿主那段 CSS 原样加进 fixture 的 `<style>`。
3. 重跑：**11 张基线全部不变** → 中和规则确实生效。

**同时确认的其他事实**（都从代码读的，不是猜的）：
- 宿主没有针对 `[data-composer-chip]` 本身的 CSS，只有 composer 根上的 `[data-composer-chip-selected]{caret-color:#0000}`。
- 插件不给芯片写内联样式（`chip.style` 只在拖拽 ghost 上出现）。
- 插件的 11 条芯片规则全是 `[data-composer-chip="quote-chat"]` 全局选择器，**没有 composer 作用域**，所以 fixture 里的渲染和真机是同一套规则。

**结论**：样式一样，而且现在有证据。

---

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

### 3.3 `.gitattributes`（已解决，2026-11-04；原判断被实测推翻）

原来这条写的是：加 `.gitattributes` 会让 5 个 CRLF 源文件（`chip-drag.js`、`layout.js`、
`stylesheet.js`、`ui/markers.js`、`ui/popovers.js`）被规范化，而 **`stylesheet.js` 的 CSS 在模板字符串里，
规范化会改变产物哈希**，所以必须先单独提交并核对字节变化。

**这个结论是错的。** 把整棵树分别转成全 CRLF 和全 LF，各跑一次 `node build.mjs`：

```
全 CRLF  → 5030 行, 230407 字节, sha256:8199a25b5bbc5d94
全 LF    → 5030 行, 230407 字节, sha256:8199a25b5bbc5d94
```

esbuild 重新打印 AST 时把行尾统一成 `\n`，模板字符串也不例外。所以产物与源码行尾无关，
规范化是安全的。已加 `.gitattributes`（`* text=auto eol=lf`）并 renormalize 那 5 个文件，
`--check` 仍是 `8199a25b5bbc5d94`。

留在这里的教训：**"会改变产物哈希"这种判断必须实测**。否则一条技术债会以"有风险"的名义一直挂着，
而它实际造成的只是 Windows 和 macOS 的工作区不一致——`git status` 报一堆没人改过的文件，
真正的改动淹没在里面。

---

## 4. 当前基线（修复前请先复现这个）

```
node build.mjs --check   → sha256:7452901be37c6596，通过
npm test                 → 全绿（38 个套件）
npm run design           → 16 项，其中 1 项为已记录的已知缺陷（色板两种蓝）
```

验收套件（需要 1.1 + 1.2 的前提）：

```
accept-highlight   18/18
accept-side-chat   26/26
accept-lifecycle   68/73（QC_VIEWPORT=1440x1000）
verify-web-build   OK — Web serves the current build
```

修任何一个缺陷后，至少要保证 `npm test` 仍全绿，且 `--check` 的哈希变化
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
