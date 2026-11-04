# dsh-quote-chat

DSH 插件：划选正文 → 添加注释 → 芯片进草稿 → 随消息发送。

**动手前先读 [`DEVELOPING.md`](DEVELOPING.md)** —— 构建方式、测试方式、跨平台约定，以及六条
用真实代价换来的工作纪律。缺陷台账在 [`DEFECTS.md`](DEFECTS.md)，设计取舍在
[`docs/design-log.md`](docs/design-log.md)。

## 三条最容易踩的

1. **只改 `src/`。** `client.js` 是 `node build.mjs` 生成的产物，手改会被下一次构建覆盖。
2. **改完必须跑** `node build.mjs`（构建即部署：DSH profile 是软链到这里的），
   再跑 `node build.mjs --check` 和 `npm test`。
3. **不要为了让测试变绿而改产品代码，也不要为了让探针变绿而改探针。** 两者冲突时先判断
   哪个错了，把判断写下来，再改错的那个。

## 环境

- `node tools/platform.mjs` 打印 node / playwright / profile / chrome / ffmpeg / ffprobe / mcp cli
  七个路径的解析结果。套件跑不起来时先跑这一条。
- 换机器后先 `npm install`：esbuild 和 Playwright 的浏览器都是平台二进制，不能跨系统共用。
- 行尾由 `.gitattributes` 钉成 LF，不要改；产物与行尾无关，已实测。

## 这个仓库和别处的关系

Windows 上的旧工作区 `..\deepseekharness插件\` 已停用，插件目录整体归档在那里，
**不要回去改**。GitHub 的 `xuexi-xiaobai/dsh-quote-chat` 是唯一源头，`git push` / `git pull` 即可。
