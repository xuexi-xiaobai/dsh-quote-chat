/**
 * dsh-quote-chat — browser half.
 *
 * GENERATED FILE. Do not edit.
 * Source: src/, assembled by build.mjs. Run `node build.mjs` after changing any source
 * module; `node build.mjs --check` fails when this file has drifted from src/.
 *
 * Artifact: sha256:274de0d4aa6a5868
 */
function __dshQuoteChatFactory(hostRequire) {
  let module = { exports: {} }
  let exports = module.exports
  // The Host require, visible to the module graph as `require`. esbuild's helper for the
  // external react/react-dom specifiers resolves through this binding, which exists because
  // the whole graph is evaluated inside this function rather than at script load.
  const require = hostRequire
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.js
  var index_exports = {};
  __export(index_exports, {
    apply: () => apply,
    inject: () => inject
  });
  module.exports = __toCommonJS(index_exports);
  var import_react10 = __toESM(require("react"), 1);
  var import_react_dom6 = require("react-dom");

  // src/locales.js
  var zh = {
    "popup.annotate": "添加注释",
    "popup.askInSide": "在侧边聊天中提问",
    "popup.tooLong": "选中的内容太长（最多 {max} 字）",
    "popup.unavailable": "这段内容无法写入输入框",
    "compose.title": "添加注释",
    "compose.placeholder": "写下你的评价，可留空…",
    "compose.selected": "已选 {count} 字",
    "compose.table": "整张表格 · {rows} 行",
    "compose.confirm": "添加注释",
    "compose.cancel": "取消",
    "compose.hint": "Enter 添加 · Esc 取消",
    "card.content": "注释 {n}",
    "card.remove": "删除注释",
    "card.count": "{n} 条注释",
    "card.clear": "全部清除",
    "card.missing": "这条注释对应的内容已不在当前对话中",
    "card.limit": "最多 {max} 条注释",
    "bubble.edit": "编辑注释",
    "bubble.comment": "评价",
    "bubble.saved": "已保存",
    "bubble.deleted": "已删除",
    "bubble.placeholder": "补充这条注释的说明…",
    "bubble.save": "保存",
    "bubble.delete": "删除",
    "marker.jump": "跳到注释内容：内容 {n}",
    "table.add": "添加到对话",
    "side.title": "侧边提问",
    "side.guide": "就选中的一段回答单独提问，不影响主对话。",
    "side.empty": "就这段引文提问，例如：这里的假设成立吗？",
    "side.quote": "引文",
    "side.expandQuote": "展开引文",
    "side.collapseQuote": "收起引文",
    "side.send": "发送",
    "side.stop": "停止",
    "side.addToChat": "加入当前对话",
    "side.added": "已加入当前对话",
    "side.clear": "新对话",
    "side.placeholder": "就这段引文提问…",
    "side.errorPrefix": "回答失败：",
    "side.you": "你",
    "side.assistant": "助手",
    "side.noQuote": "从一个回答里划选一段文字，再点“在侧边聊天中提问”。"
  };
  var en = {
    "popup.annotate": "Add annotation",
    "popup.askInSide": "Ask in side chat",
    "popup.tooLong": "Selection is too long (max {max} characters)",
    "popup.unavailable": "This passage cannot be written into the composer",
    "compose.title": "Add annotation",
    "compose.placeholder": "Add your evaluation, or leave it blank…",
    "compose.selected": "{count} characters selected",
    "compose.table": "Whole table · {rows} rows",
    "compose.confirm": "Add annotation",
    "compose.cancel": "Cancel",
    "compose.hint": "Enter to add · Esc to cancel",
    "card.content": "Note {n}",
    "card.remove": "Remove annotation",
    "card.count": "{n} annotation(s)",
    "card.clear": "Clear all",
    "card.missing": "The passage for this annotation is no longer in this conversation",
    "card.limit": "At most {max} annotations",
    "bubble.edit": "Edit annotation",
    "bubble.comment": "Comment",
    "bubble.saved": "Saved",
    "bubble.deleted": "Deleted",
    "bubble.placeholder": "Add a note about this annotation…",
    "bubble.save": "Save",
    "bubble.delete": "Delete",
    "marker.jump": "Jump to the passage: Content {n}",
    "table.add": "Add to chat",
    "side.title": "Side chat",
    "side.guide": "Ask about one quoted passage without touching the main conversation.",
    "side.empty": "Ask about this quote — for example: does this assumption hold?",
    "side.quote": "Quote",
    "side.expandQuote": "Expand quote",
    "side.collapseQuote": "Collapse quote",
    "side.send": "Send",
    "side.stop": "Stop",
    "side.addToChat": "Add to current chat",
    "side.added": "Added to the current chat",
    "side.clear": "New chat",
    "side.placeholder": "Ask about this quote…",
    "side.errorPrefix": "The answer failed: ",
    "side.you": "You",
    "side.assistant": "Assistant",
    "side.noQuote": "Select a passage in an answer, then choose “Ask in side chat”."
  };

  // src/annotation-store.js
  function createAnnotationStore({ maxAnnotations } = {}) {
    if (!Number.isInteger(maxAnnotations) || maxAnnotations <= 0) {
      throw new Error("dsh-quote-chat: createAnnotationStore requires a positive maxAnnotations");
    }
    const sessions = /* @__PURE__ */ new Map();
    const EMPTY = Object.freeze([]);
    function stateFor(sessionId) {
      let state = sessions.get(sessionId);
      if (state === void 0) {
        state = { list: EMPTY, listeners: /* @__PURE__ */ new Set(), seq: 0 };
        sessions.set(sessionId, state);
      }
      return state;
    }
    function publish(state, list) {
      state.list = list;
      for (const listener of [...state.listeners]) listener();
    }
    function renumber(list) {
      return list.map((item, index) => item.number === index + 1 ? item : { ...item, number: index + 1 });
    }
    return {
      /**
       * The current list for one session.
       *
       * Identity-stable: the previous array is returned until a mutation replaces it.
       *
       * @param sessionId - the session key (may be undefined).
       * @returns the list, or a shared frozen empty array.
       */
      snapshot(sessionId) {
        if (sessionId === void 0) return EMPTY;
        return sessions.get(sessionId)?.list ?? EMPTY;
      },
      /**
       * Subscribe to one session's changes.
       *
       * Subscribing before any annotation exists is supported and is not the same as
       * subscribing to a non-existent session: the session is materialized on subscribe, so a
       * later add still notifies.
       *
       * @param sessionId - the session key (may be undefined).
       * @param listener - called after each mutation of that session.
       * @returns an unsubscribe function.
       */
      subscribe(sessionId, listener) {
        if (sessionId === void 0) return () => {
        };
        const state = stateFor(sessionId);
        state.listeners.add(listener);
        return () => {
          state.listeners.delete(listener);
        };
      },
      /**
       * Add one annotation.
       * @param sessionId - the session key.
       * @param draft - the annotation draft, without id or number.
       * @returns the stored annotation, or null when the session's list is full.
       */
      add(sessionId, draft) {
        const state = stateFor(sessionId);
        if (state.list.length >= maxAnnotations) return null;
        state.seq += 1;
        const annotation = {
          ...draft,
          id: `qc-${Date.now()}-${state.seq}`,
          number: state.list.length + 1
        };
        publish(state, renumber([...state.list, annotation]));
        return annotation;
      },
      /**
       * Remove one annotation.
       *
       * Ids are never reused, so remaining annotations keep their identity even though their
       * displayed numbers shift.
       *
       * @param sessionId - the session key.
       * @param id - the annotation id.
       */
      remove(sessionId, id) {
        const state = stateFor(sessionId);
        publish(state, renumber(state.list.filter((item) => item.id !== id)));
      },
      /**
       * Change one annotation's comment, keeping everything else.
       *
       * The comment is the only editable part: the passage it points at is fixed by the
       * selection and the ordinal is a position. Editing replaces rather than re-adds, so the
       * chip, its id and its place in the draft all survive.
       *
       * @param sessionId - the session key.
       * @param id - the annotation id.
       * @param comment - the new comment text; anything non-string becomes an empty comment.
       * @returns the updated annotation, or null when it is gone.
       */
      update(sessionId, id, comment) {
        const state = stateFor(sessionId);
        let updated = null;
        publish(state, state.list.map((item) => {
          if (item.id !== id) return item;
          updated = { ...item, comment: typeof comment === "string" ? comment.trim() : "" };
          return updated;
        }));
        return updated;
      },
      /**
       * Look up one annotation.
       *
       * Implemented against the private record rather than through `snapshot`, so the method
       * keeps working when destructured off the store object.
       *
       * @param sessionId - the session key.
       * @param id - the annotation id.
       * @returns the annotation, or null.
       */
      find(sessionId, id) {
        if (sessionId === void 0) return null;
        const state = sessions.get(sessionId);
        if (state === void 0) return null;
        return state.list.find((item) => item.id === id) ?? null;
      },
      /**
       * Remove every annotation of one session.
       *
       * Notifies only when the list was non-empty, so a clear on an empty session does not wake
       * subscribers for nothing.
       *
       * @param sessionId - the session key.
       */
      clear(sessionId) {
        const state = stateFor(sessionId);
        if (state.list.length > 0) publish(state, EMPTY);
      }
    };
  }

  // src/annotation-hooks.js
  var import_react = __toESM(require("react"), 1);
  function makeUseAnnotations(store) {
    return function useAnnotations2(sessionId) {
      const subscribe = import_react.default.useCallback(
        (listener) => store.subscribe(sessionId, listener),
        [sessionId]
      );
      const snapshot = import_react.default.useCallback(
        () => store.snapshot(sessionId),
        [sessionId]
      );
      return import_react.default.useSyncExternalStore(subscribe, snapshot, snapshot);
    };
  }

  // src/chip-draft.js
  var CHIP_SOURCE = "quote-chat";
  var CHIP_TRIGGER = "#";
  var CHIP_PLACEHOLDER = "￼";
  function serializeChipForModel(payload) {
    const head = `[${payload.label}]`;
    const note = payload.comment === "" ? "" : `
  ${payload.comment}`;
    return `
  ${head}${note}
  ${payload.text}
  `;
  }
  function chipLabel(annotation, labels) {
    return labels.content.replace("{n}", String(annotation.number));
  }
  function withAppendedChip(draft, existing, addition, reference) {
    const base = draft === "" || draft.endsWith("\n") ? draft : `${draft}
  `;
    return {
      text: `${base}${addition}`,
      references: [...existing, { ...reference, offset: base.length }]
    };
  }
  function withoutChip(draft, references, source, ref) {
    const index = references.findIndex((item) => item.source === source && item.ref === ref);
    if (index < 0) return null;
    const target = references[index];
    let start = target.offset;
    let stop = target.offset + target.length;
    const brokenBefore = start > 0 && draft[start - 1] === "\n";
    const brokenAfter = stop < draft.length && draft[stop] === "\n";
    const ownsLine = (start === 0 || brokenBefore) && (stop === draft.length || brokenAfter);
    if (ownsLine) {
      if (brokenBefore) start -= 1;
      else if (brokenAfter) stop += 1;
    }
    const removed = draft.slice(start, stop);
    const nextText = `${draft.slice(0, start)}${draft.slice(stop)}`;
    const shift = removed.length;
    const kept = references.filter((_, position) => position !== index).map((item) => item.offset >= stop ? { ...item, offset: item.offset - shift } : item);
    return { text: nextText, references: kept };
  }

  // src/chip-registry.js
  function createChipRegistry() {
    const payloads = /* @__PURE__ */ new Map();
    return {
      /**
       * Record what one chip stands for, and return the reference that places it in a draft.
       *
       * Registering here is what makes the chip resolvable later, so this must happen before the
       * draft is written — the Host can serialize as soon as the chip exists.
       *
       * @param annotation - the annotation being placed.
       * @param label - the inline label the chip shows.
       * @returns the reference record, without its offset (the bridge fills that in).
       */
      register(annotation, label) {
        payloads.set(annotation.id, {
          kind: annotation.kind,
          number: annotation.number,
          text: annotation.text,
          comment: annotation.comment,
          label
        });
        return {
          source: CHIP_SOURCE,
          ref: annotation.id,
          offset: 0,
          // The placeholder's length in UTF-16 units; the composer counts in those.
          length: CHIP_PLACEHOLDER.length,
          label,
          clipboardText: CHIP_PLACEHOLDER
        };
      },
      /**
       * The payload for one chip, or undefined.
       *
       * Returns the stored object itself rather than a copy: `serialize` runs inside the submit
       * attempt and the reference system compares nothing here, so copying on every read would
       * cost without buying isolation the callers need.
       *
       * @param ref - the chip id.
       * @returns the payload, or undefined when this instance never minted it.
       */
      get(ref) {
        return payloads.get(ref);
      },
      /**
       * Replace one chip's comment.
       *
       * The comment is the only part that changes after placement: the passage is fixed by the
       * selection and the ordinal is a position. When the chip was never registered this is a
       * no-op rather than an error — the caller may be updating an annotation whose chip the user
       * already removed from the draft, and that must not fail the edit.
       *
       * @param ref - the chip id.
       * @param comment - the new comment text; anything non-string becomes empty.
       * @returns true when a payload was updated.
       */
      updateComment(ref, comment) {
        const payload = payloads.get(ref);
        if (payload === void 0) return false;
        payloads.set(ref, {
          ...payload,
          comment: typeof comment === "string" ? comment.trim() : ""
        });
        return true;
      },
      /**
       * Whether this instance minted the given chip.
       *
       * Exposed instead of the map so a caller can distinguish "unknown chip" from "payload with
       * empty fields" without reaching into storage.
       *
       * @param ref - the chip id.
       * @returns true when a payload exists.
       */
      has(ref) {
        return payloads.has(ref);
      }
    };
  }

  // src/chip-bridge.js
  function createDraftBridge({ registry, source }) {
    function liveDraft(read) {
      const state = read();
      return {
        draft: typeof state?.draft === "string" ? state.draft : "",
        occurrences: Array.isArray(state?.occurrences) ? state.occurrences : []
      };
    }
    return {
      /**
       * Place one annotation in the draft as a chip.
       *
       * Registers the payload first, then asks the Host to accept the new draft. A failure to
       * write leaves the payload in place — see the module note.
       *
       * @param port - `{ setDraft }` from the Host's input actions; may be absent.
       * @param read - getter for `{ draft, occurrences }`.
       * @param annotation - the annotation to place.
       * @param labels - the active locale's card labels.
       * @returns true when the draft accepted the chip.
       */
      place(port, read, annotation, labels) {
        if (typeof port?.setDraft !== "function") return false;
        const { draft, occurrences } = liveDraft(read);
        try {
          const reference = registry.register(annotation, chipLabel(annotation, labels));
          port.setDraft(withAppendedChip(draft, occurrences, CHIP_PLACEHOLDER, reference));
          return true;
        } catch (failure) {
          console.error("[dsh-quote-chat] chip insertion failed:", failure);
          return false;
        }
      },
      /**
       * Remove one annotation's chip from the draft.
       *
       * The payload is not touched and not deleted: the draft is not the only thing that can
       * reintroduce the reference, so removing its payload here would be premature.
       *
       * @param port - `{ setDraft }` from the Host's input actions; may be absent.
       * @param read - getter for `{ draft, occurrences }`.
       * @param ref - the annotation id the chip carries.
       * @returns true when a chip was found and the draft accepted the rewrite.
       */
      release(port, read, ref) {
        const { draft, occurrences } = liveDraft(read);
        const snapshot = withoutChip(draft, occurrences, source, ref);
        if (snapshot === null) return false;
        if (typeof port?.setDraft !== "function") return false;
        port.setDraft(snapshot);
        return true;
      }
    };
  }

  // src/quote-handoff.js
  var PENDING_QUOTE_TTL = 15e3;
  function createQuoteHandoff({ now = () => Date.now() } = {}) {
    let text = "";
    let at = 0;
    return {
      /**
       * Record the quote a popup action wants the side chat to open with.
       *
       * Called immediately before the tab is opened, so the clock starts at the same moment the
       * tab appears. A later call replaces the earlier one and restarts the window.
       *
       * @param quote - the passage text; empty strings are allowed and mean "no quote".
       */
      remember(quote) {
        text = typeof quote === "string" ? quote : "";
        at = now();
      },
      /**
       * The quote a tab should show.
       *
       * Reading never consumes: a tab body can re-render many times, and each render asks again.
       *
       * @param carried - the quote the tab's navigation params carried, if any.
       * @returns the carried quote, a fresh pending one, or an empty string.
       */
      forTab(carried) {
        if (typeof carried === "string" && carried !== "") return carried;
        const fresh = now() - at < PENDING_QUOTE_TTL;
        return fresh ? text : "";
      }
    };
  }

  // src/side-chat-transport.js
  function askUrl() {
    const base = typeof document !== "undefined" && typeof document.baseURI === "string" && document.baseURI !== "" ? document.baseURI : "http://dsh.internal/";
    return new URL("quote-chat/api/ask", base).href;
  }
  async function askSideChat(request, signal, onDelta, { fetch: fetchImpl } = {}) {
    const doFetch = fetchImpl ?? fetch;
    const response = await doFetch(askUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal,
      credentials: "same-origin"
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/event-stream")) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message ?? `HTTP ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    const handleFrame = (line) => {
      if (!line.startsWith("data:")) return false;
      let event;
      try {
        event = JSON.parse(line.slice(5).trim());
      } catch {
        return false;
      }
      if (event.type === "delta" && typeof event.text === "string") {
        answer += event.text;
        onDelta(event.text);
        return false;
      }
      if (event.type === "error") {
        throw new Error(typeof event.message === "string" ? event.message : "the answer failed");
      }
      return event.type === "done";
    };
    for (; ; ) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const line = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
        if (handleFrame(line)) return answer;
      }
    }
    return answer;
  }

  // src/dom.js
  function elementOf(node) {
    if (node === null || node === void 0) return null;
    return node.nodeType === 1 ? node : node.parentElement;
  }
  function cssEscape(value) {
    const registry = typeof window === "undefined" ? void 0 : window.CSS;
    if (typeof registry === "object" && registry !== null && typeof registry.escape === "function") {
      return registry.escape(value);
    }
    return value.replace(/["\\]/g, "\\$&");
  }

  // src/text-ranges.js
  var FLOW_SELECTOR = '[data-slot="conversation.chat.flow"]';
  var FLOW_SELECTORS = [
    '[data-slot="conversation.chat.flow"]',
    '[data-slot="conversation.chat"]',
    "[data-message-id]",
    "[data-chat-flow]"
  ];
  function findFlowElement() {
    if (typeof document === "undefined") return null;
    for (const selector of FLOW_SELECTORS) {
      const matches = [...document.querySelectorAll(selector)].filter((element) => element.closest("[data-sidebar-right-tab]") === null);
      if (matches.length === 0) continue;
      const first = matches[0];
      if (selector === "[data-message-id]") {
        for (let node = first.parentElement; node !== null; node = node.parentElement) {
          if (node.scrollHeight > node.clientHeight + 8) return node;
        }
      }
      return first;
    }
    return null;
  }
  var COMPOSER_SELECTORS = [
    '[data-slot="conversation.composer.dock"]',
    '[data-slot="conversation.input.dock"]',
    "[data-composer-root]",
    '[contenteditable="true"]'
  ];
  function composerSurface() {
    const editable = [...document.querySelectorAll('[contenteditable="true"]')].find((element) => element.getBoundingClientRect().height > 0) ?? null;
    if (editable === null) return null;
    const flow = findFlowElement();
    let surface = editable;
    for (let node = editable.parentElement; node !== null; node = node.parentElement) {
      if (node === document.body || node === document.documentElement) break;
      if (flow !== null && node.contains(flow)) break;
      surface = node;
    }
    return surface;
  }
  function isInsideTranscript(target) {
    if (target === null || target === void 0) return false;
    const flow = findFlowElement();
    if (flow === null) return false;
    const composer = composerSurface();
    if (composer !== null && composer.contains(target) === true) return false;
    for (const selector of COMPOSER_SELECTORS) {
      for (const element of document.querySelectorAll(selector)) {
        if (element.contains(target) === true) return false;
      }
    }
    let container = null;
    for (let node = flow; node !== null; node = node.parentElement) {
      if (node.nodeType !== 1) continue;
      if (node.scrollHeight > node.clientHeight + 8) {
        container = node;
        break;
      }
    }
    if (container === null) container = flow;
    return container.contains(target) === true;
  }
  var BLOCK_SELECTOR = "p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, table, figure";
  function rangeAt(root, offset, length) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let consumed = 0;
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if (node.parentElement?.closest("[data-qc-ignore]") != null) continue;
      const next = consumed + node.data.length;
      if (startNode === null && offset < next) {
        startNode = node;
        startOffset = offset - consumed;
      }
      if (startNode !== null && offset + length <= next) {
        endNode = node;
        endOffset = offset + length - consumed;
        break;
      }
      consumed = next;
    }
    if (startNode === null || endNode === null) return null;
    const range = document.createRange();
    range.setStart(startNode, Math.max(0, Math.min(startOffset, startNode.data.length)));
    range.setEnd(endNode, Math.max(0, Math.min(endOffset, endNode.data.length)));
    return range;
  }
  function nodePath(host, node) {
    const path = [];
    let current = node;
    while (current !== null && current !== host) {
      const parent = current.parentNode;
      if (parent === null) return null;
      path.unshift([...parent.childNodes].indexOf(current));
      current = parent;
    }
    return current === host ? path : null;
  }
  function nodeAtPath(host, path) {
    let current = host;
    for (const index of path) {
      const next = current?.childNodes?.[index];
      if (next === void 0) return null;
      current = next;
    }
    return current ?? null;
  }
  function captureAnchor(range, flow) {
    const row = elementOf(range.startContainer)?.closest("[data-chat-node-key]") ?? null;
    return {
      nodeKey: row?.getAttribute("data-chat-node-key") ?? "",
      startPath: nodePath(flow, range.startContainer),
      startOffset: range.startOffset,
      endPath: nodePath(flow, range.endContainer),
      endOffset: range.endOffset,
      quote: range.toString()
    };
  }
  function resolveAnchor(flow, anchor) {
    if (flow === null || anchor.quote === "") return null;
    if (Array.isArray(anchor.startPath) && Array.isArray(anchor.endPath)) {
      const startNode = nodeAtPath(flow, anchor.startPath);
      const endNode = nodeAtPath(flow, anchor.endPath);
      if (startNode !== null && endNode !== null) {
        try {
          const range = document.createRange();
          range.setStart(startNode, Math.min(anchor.startOffset, (startNode.textContent ?? "").length));
          range.setEnd(endNode, Math.min(anchor.endOffset, (endNode.textContent ?? "").length));
          if (sameText(textOfWithin(range, anchor.quote), anchor.quote)) return range;
        } catch {
        }
      }
    }
    const row = anchor.nodeKey === "" ? null : flow.querySelector(`[data-chat-node-key="${cssEscape(anchor.nodeKey)}"]`);
    if (row !== null) {
      const local = locateText(row, anchor.quote);
      if (local !== null) {
        const range = rangeAt(row, local.offset, local.length);
        if (range !== null) return range;
      }
    }
    const anywhere = locateText(flow, anchor.quote);
    return anywhere === null ? null : rangeAt(flow, anywhere.offset, anywhere.length);
  }
  var EXTRA_SPACE = "   - \u2028\u2029  　";
  var ZERO_WIDTH = "​-‍\uFEFF";
  function squishText(value) {
    return value.replace(new RegExp(`[${ZERO_WIDTH}]`, "g"), "").replace(new RegExp(`[\\s${EXTRA_SPACE}]+`, "g"), " ").trim();
  }
  function sameText(left, right) {
    return squishText(left) === squishText(right);
  }
  function textOfWithin(range, quote) {
    const raw = range.toString();
    if (raw === "" || raw.length < quote.length) return raw;
    const start = elementOf(range.startContainer);
    const box = start?.closest(BLOCK_SELECTOR) ?? start;
    if (box === null || box === void 0) return raw;
    if (box.querySelector("[data-qc-ignore]") === null) return raw;
    return textOf(box);
  }
  function textOf(host) {
    if (host === null || host === void 0) return "";
    const ignored = host.querySelectorAll("[data-qc-ignore]");
    if (ignored.length === 0) return host.textContent ?? "";
    const copy = host.cloneNode(true);
    for (const node of copy.querySelectorAll("[data-qc-ignore]")) node.remove();
    return copy.textContent ?? "";
  }
  function locateText(host, quote) {
    const raw = textOf(host);
    const exact = raw.indexOf(quote);
    if (exact >= 0) return { offset: exact, length: quote.length };
    const spaceRe = new RegExp(`[\\s${EXTRA_SPACE}]`);
    const zeroRe = new RegExp(`[${ZERO_WIDTH}]`);
    const needle = squishText(quote);
    if (needle === "") return null;
    const starts = [];
    let flat = "";
    let pendingSpace = false;
    for (let index = 0; index < raw.length; index += 1) {
      const char = raw[index];
      if (zeroRe.test(char)) continue;
      if (spaceRe.test(char)) {
        pendingSpace = flat !== "";
        continue;
      }
      if (pendingSpace) {
        starts.push(index - 1);
        flat += " ";
        pendingSpace = false;
      }
      starts.push(index);
      flat += char;
    }
    const at = flat.indexOf(needle);
    if (at < 0) return null;
    const from = starts[at];
    const to = starts[at + needle.length - 1];
    return { offset: from, length: to - from + 1 };
  }

  // src/layout.js
  var ANCHOR_INSET = 8;
  var PANEL_BUBBLE_GAP = 10;
  var SIDEBAR_TAB_SELECTOR = "[data-sidebar-right-tab]";
  var COMPOSER_SELECTORS2 = [
    '[data-slot="conversation.composer.dock"]',
    '[data-slot="conversation.input.dock"]',
    "[data-composer-root]"
  ];
  function composerContainer() {
    if (typeof document === "undefined") return null;
    const selectors = [
      '[data-slot="conversation.composer.dock"]',
      '[data-slot="conversation.input.dock"]',
      "[data-composer-root]",
      '[contenteditable="true"]'
    ];
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (element.closest("[data-sidebar-right-tab]") !== null) continue;
        if (element.getClientRects().length > 0) {
          return element.closest("[data-composer-root]") ?? element.parentElement ?? element;
        }
      }
    }
    return null;
  }
  function createLayout() {
    const columnCache = /* @__PURE__ */ new WeakMap();
    const containerCache = /* @__PURE__ */ new WeakMap();
    function findFlow() {
      if (typeof document === "undefined") return null;
      for (const selector of FLOW_SELECTORS) {
        let fallback = null;
        for (const element of document.querySelectorAll(selector)) {
          if (element.closest(SIDEBAR_TAB_SELECTOR) !== null) continue;
          if (element.getClientRects().length > 0 || hasBoxedChild(element)) return element;
          if (fallback === null) fallback = element;
        }
        if (fallback !== null) return fallback;
      }
      return findFlowElement();
    }
    function hasBoxedChild(element) {
      if (typeof element.getClientRects === "function" && element.getClientRects().length > 0) return true;
      for (const child of element.children) {
        if (hasBoxedChild(child)) return true;
      }
      return false;
    }
    function scrollContainerOf(flow) {
      if (flow === null || flow === void 0) return null;
      let node = flow.parentElement;
      while (node !== null) {
        const style = getComputedStyle(node);
        if (/(auto|scroll)/.test(`${style.overflowY}`) && node.scrollHeight > node.clientHeight + 4) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    }
    function containerFor(flow) {
      if (flow === null || flow === void 0) return null;
      const hit = containerCache.get(flow);
      if (hit !== void 0 && hit.contains(flow)) return hit;
      const found = scrollContainerOf(flow);
      if (found !== null) containerCache.set(flow, found);
      return found;
    }
    function findComposerDock() {
      if (typeof document === "undefined") return null;
      for (const selector of COMPOSER_SELECTORS2) {
        for (const element of document.querySelectorAll(selector)) {
          if (element.closest(SIDEBAR_TAB_SELECTOR) !== null) continue;
          const box = element.getBoundingClientRect();
          if (box.width > 0 && box.height > 0) return element;
        }
      }
      const editables = [...document.querySelectorAll('[contenteditable="true"]')].filter((element) => element.closest(SIDEBAR_TAB_SELECTOR) === null).filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      });
      let lowest = null;
      let lowestTop = -Infinity;
      for (const element of editables) {
        const top = element.getBoundingClientRect().top;
        if (top > lowestTop) {
          lowestTop = top;
          lowest = element;
        }
      }
      return lowest;
    }
    function visibleChatArea(scroller) {
      const box = scroller.getBoundingClientRect();
      let top = Math.max(0, box.top);
      let bottom = Math.min(window.innerHeight, box.bottom);
      const composer = findComposerDock();
      if (composer !== null) {
        const dock = composer.getBoundingClientRect();
        if (dock.height > 0 && dock.top > top && dock.top < bottom) bottom = dock.top;
      }
      if (bottom - top < 120) {
        top = Math.max(0, box.top);
        bottom = Math.min(window.innerHeight, box.bottom);
      }
      return { top, height: Math.max(1, bottom - top) };
    }
    function prepareContainer(scroller) {
      if (scroller.dataset.qcPositioned !== "1") {
        if (getComputedStyle(scroller).position === "static") {
          scroller.style.position = "relative";
        }
        scroller.dataset.qcPositioned = "1";
      }
    }
    function anchorInTranscript(flow, box, size, prefer) {
      const scroller = containerFor(flow);
      if (scroller === null || scroller === void 0 || box === null) return null;
      prepareContainer(scroller);
      const rect = scroller.getBoundingClientRect();
      const width = size.width || 0;
      const height = size.height || 0;
      const area = visibleChatArea(scroller);
      const bandTop = area.top - rect.top + scroller.scrollTop;
      const bandBottom = bandTop + area.height;
      const localTop = box.top - rect.top + scroller.scrollTop;
      const localBottom = (box.bottom ?? box.top) - rect.top + scroller.scrollTop;
      const localLeft = box.left - rect.left + scroller.scrollLeft;
      const fitsBelow = localBottom + 8 + height + ANCHOR_INSET <= bandBottom;
      const wantAbove = prefer === "above" || !fitsBelow;
      let top = wantAbove ? localTop - height - 8 : localBottom + 8;
      const maxTop = Math.max(bandTop + ANCHOR_INSET, bandBottom - height - ANCHOR_INSET);
      top = Math.min(Math.max(bandTop + ANCHOR_INSET, top), maxTop);
      const maxLeft = Math.max(ANCHOR_INSET, scroller.clientWidth - width - ANCHOR_INSET);
      const left = Math.min(Math.max(ANCHOR_INSET, localLeft), maxLeft);
      return { scroller, position: { top, left } };
    }
    function firstPinnedTopBar() {
      const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
      let best = null;
      let bestBottom = 0;
      let seen = 0;
      for (const element of document.querySelectorAll("body *")) {
        if (seen >= 400) break;
        seen += 1;
        const style = typeof getComputedStyle === "function" ? getComputedStyle(element) : null;
        if (style === null) continue;
        if (style.position !== "fixed" && style.position !== "sticky") continue;
        if (style.visibility === "hidden" || style.display === "none") continue;
        const box = element.getBoundingClientRect();
        if (box.height < 24 || box.height > 160) continue;
        if (box.top > 2) continue;
        if (box.width < viewportWidth * 0.4) continue;
        if (box.bottom > bestBottom) {
          best = element;
          bestBottom = box.bottom;
        }
      }
      return best;
    }
    function readableBand() {
      const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
      let top = 0;
      if (typeof document !== "undefined") {
        const header = document.querySelector('[data-slot="conversation.chat.header"]') ?? document.querySelector("header") ?? firstPinnedTopBar();
        if (header !== null) {
          const box = header.getBoundingClientRect();
          if (box.height > 0 && box.top <= 0) top = Math.max(0, box.bottom);
        }
        if (top === 0) {
          const flow = findFlow();
          if (flow !== null) {
            for (let node = flow; node !== null; node = node.parentElement) {
              if (node === document.body || node === document.documentElement) break;
              if (node.scrollHeight <= node.clientHeight + 8) continue;
              const box = node.getBoundingClientRect();
              if (box.height > 0 && box.top > 0) top = Math.round(box.top);
              break;
            }
          }
        }
      }
      let bottom = viewportHeight;
      const dock = findComposerDock();
      if (dock !== null) {
        const box = dock.getBoundingClientRect();
        if (box.height > 0 && box.top > top) bottom = box.top;
      }
      return { top, bottom, height: Math.max(1, bottom - top) };
    }
    function anchorAboveSelection(blockBox, size, options = {}) {
      const gap = options.gap ?? 10;
      const margin = options.margin ?? 8;
      const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
      const band = readableBand();
      const left = Math.max(margin, Math.round((viewportWidth - size.width) / 2));
      const above = blockBox.top - gap - size.height;
      return { left, top: Math.round(above), edge: "above" };
    }
    function snapPosition(restingTop, size, options = {}) {
      const gap = options.gap ?? 8;
      const margin = options.margin ?? 8;
      const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
      const band = readableBand();
      const top = band.top + gap;
      const bottom = Math.max(band.top + gap, band.bottom - gap - size.height);
      const toTop = Math.abs(restingTop - top);
      const toBottom = Math.abs(bottom - restingTop);
      return {
        left: Math.max(margin, Math.round((viewportWidth - size.width) / 2)),
        top: toTop <= toBottom ? top : bottom,
        edge: toTop <= toBottom ? "top" : "bottom"
      };
    }
    function anchorAboveBubble(flow, bubble, size) {
      const scroller = containerFor(flow);
      if (scroller === null || scroller === void 0 || bubble === null) return null;
      prepareContainer(scroller);
      const rect = scroller.getBoundingClientRect();
      const width = size.width || 0;
      const height = size.height || 0;
      const area = visibleChatArea(scroller);
      const bandTop = area.top - rect.top + scroller.scrollTop;
      const bandBottom = bandTop + area.height;
      const bubbleTop = bubble.top - rect.top + scroller.scrollTop;
      const bubbleRight = bubble.right - rect.left + scroller.scrollLeft;
      const right = Math.max(ANCHOR_INSET, rect.width + scroller.scrollLeft - bubbleRight);
      const maxTop = Math.max(bandTop + ANCHOR_INSET, bandBottom - height - ANCHOR_INSET);
      const maxLeft = Math.max(ANCHOR_INSET, scroller.clientWidth - width - ANCHOR_INSET);
      const left = Math.min(Math.max(ANCHOR_INSET, bubbleRight - width), maxLeft);
      return {
        scroller,
        position: {
          // Fallback top, for the first paint before the panel has measured itself.
          top: Math.min(Math.max(bandTop + ANCHOR_INSET, bubbleTop - PANEL_BUBBLE_GAP - height), maxTop),
          right,
          left,
          // Everything the panel needs to place its own bottom edge.
          bubbleTop,
          gap: PANEL_BUBBLE_GAP,
          // The bubble's bottom edge, so the panel can sit BELOW it when there is no room above. Without this the panel
          // was clamped against the top of the band and covered the very bubble it belongs to.
          bubbleBottom: bubble.bottom - rect.top + scroller.scrollTop,
          bandTop: bandTop + ANCHOR_INSET,
          bandBottom: bandBottom - ANCHOR_INSET
        }
      };
    }
    function flowColumnBox(flow) {
      if (flow === null) return null;
      const cached = columnCache.get(flow);
      if (cached !== void 0 && cached.element.isConnected) return cached;
      let best = null;
      const consider = (element) => {
        const box = element.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return;
        if (best === null || box.right > best.box.right) best = { box, element };
      };
      for (const child of flow.querySelectorAll("[data-chat-node-key]")) consider(child);
      if (best !== null) {
        columnCache.set(flow, best);
        return best;
      }
      for (const child of flow.querySelectorAll("*")) {
        if (child.closest(SIDEBAR_TAB_SELECTOR) !== null) continue;
        consider(child);
      }
      if (best !== null) {
        columnCache.set(flow, best);
        return best;
      }
      let ancestor = flow.parentElement;
      while (ancestor !== null) {
        const box = ancestor.getBoundingClientRect();
        if (box.width > 0 && box.height > 0) {
          const found = { box, element: ancestor };
          columnCache.set(flow, found);
          return found;
        }
        ancestor = ancestor.parentElement;
      }
      return null;
    }
    function flowColumn(flow) {
      const found = flowColumnBox(flow);
      return found === null ? null : found.box;
    }
    function columnElement(flow) {
      const found = flowColumnBox(flow);
      return found === null ? null : found.element;
    }
    return {
      composerContainer,
      findFlow,
      scrollContainerOf,
      containerFor,
      findComposerDock,
      visibleChatArea,
      anchorInTranscript,
      anchorAboveBubble,
      anchorAboveSelection,
      snapPosition,
      readableBand,
      flowColumnBox,
      flowColumn,
      columnElement
    };
  }

  // src/highlight.js
  var FLASH_HIGHLIGHT = "quote-chat-flash";
  var FLASH_MS = 2600;
  var RESOLVE_DELAY = 90;
  function canPaintHighlight() {
    const registry = typeof window === "undefined" ? void 0 : window.CSS;
    return typeof registry === "object" && registry !== null && typeof registry.highlights === "object" && registry.highlights !== null && typeof window.Highlight === "function";
  }
  function paintSafeRange(range) {
    try {
      const endElement = elementOf(range.endContainer);
      if (endElement === null || endElement.closest("[data-qc-ignore]") === null) {
        const startElement = elementOf(range.startContainer);
        if (startElement === null || startElement.closest("[data-qc-ignore]") === null) {
          return range;
        }
      }
      const box = endElement?.closest(BLOCK_SELECTOR) ?? elementOf(range.startContainer)?.closest(BLOCK_SELECTOR);
      if (box === null || box === void 0) return range;
      const clean = document.createRange();
      const texts = [];
      const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        if (node.parentElement?.closest("[data-qc-ignore]") != null) continue;
        texts.push(node);
      }
      if (texts.length === 0) return range;
      const startIn = texts.findIndex((node) => node === range.startContainer);
      const endIn = texts.findIndex((node) => node === range.endContainer);
      const startNode = startIn >= 0 ? texts[startIn] : texts[0];
      const startOffset = startIn >= 0 ? range.startOffset : 0;
      let endNode;
      let endOffset;
      if (endIn >= 0) {
        endNode = texts[endIn];
        endOffset = range.endOffset;
      } else {
        const chromeNode = range.endContainer;
        const proseNodesBefore = [];
        const docWalker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
        for (let node = docWalker.nextNode(); node !== null; node = docWalker.nextNode()) {
          if (node === chromeNode) break;
          if (node.parentElement?.closest("[data-qc-ignore]") != null) continue;
          proseNodesBefore.push(node);
        }
        if (proseNodesBefore.length === 0) return range;
        endNode = proseNodesBefore[proseNodesBefore.length - 1];
        endOffset = (endNode.textContent ?? "").length;
      }
      if (endNode === startNode && endOffset < startOffset) {
        endOffset = startOffset;
      }
      clean.setStart(startNode, startOffset);
      clean.setEnd(endNode, endOffset);
      return clean;
    } catch {
      return range;
    }
  }
  function createHighlighter() {
    function flash(range, ms = FLASH_MS, resolve = null) {
      if (!canPaintHighlight()) return;
      try {
        let highlight = new Highlight(paintSafeRange(range));
        window.CSS.highlights.set(FLASH_HIGHLIGHT, highlight);
        const deadline = Date.now() + ms;
        const settle = () => {
          if (window.CSS.highlights.get(FLASH_HIGHLIGHT) !== highlight) return;
          if (resolve !== null) {
            const live = resolve();
            if (live !== null) {
              highlight = new Highlight(paintSafeRange(live));
              window.CSS.highlights.set(FLASH_HIGHLIGHT, highlight);
            }
          }
          setTimeout(() => {
            if (window.CSS.highlights.get(FLASH_HIGHLIGHT) === highlight) {
              window.CSS.highlights.delete(FLASH_HIGHLIGHT);
            }
          }, Math.max(0, deadline - Date.now()));
        };
        if (resolve === null) settle();
        else setTimeout(settle, RESOLVE_DELAY);
      } catch (failure) {
        console.error("[dsh-quote-chat] highlight failed:", failure);
      }
    }
    function hold(range, resolve = null) {
      if (!canPaintHighlight()) return;
      try {
        let highlight = new Highlight(paintSafeRange(range));
        window.CSS.highlights.set(FLASH_HIGHLIGHT, highlight);
        if (resolve === null) return;
        setTimeout(() => {
          if (window.CSS.highlights.get(FLASH_HIGHLIGHT) !== highlight) return;
          const live = resolve();
          if (live === null) return;
          highlight = new Highlight(paintSafeRange(live));
          window.CSS.highlights.set(FLASH_HIGHLIGHT, highlight);
        }, RESOLVE_DELAY);
      } catch (failure) {
        console.error("[dsh-quote-chat] hold highlight failed:", failure);
      }
    }
    function clear() {
      if (!canPaintHighlight()) return;
      window.CSS.highlights.delete(FLASH_HIGHLIGHT);
    }
    return { flash, hold, clear };
  }

  // src/navigation.js
  var MAX_STEPS = 40;
  var FRAMES_PER_STEP = 2;
  var ANCHOR_TOP_GAP = 28;
  var MIN_STEP = 160;
  function nextFrame() {
    return new Promise((resolve) => {
      if (typeof requestAnimationFrame !== "function") {
        resolve();
        return;
      }
      requestAnimationFrame(() => resolve());
    });
  }
  function createNavigation({
    layout: layout2,
    findFlow = () => layout2.findFlow(),
    resolve = resolveAnchor
  } = {}) {
    function scrollToRange(range, flow) {
      const scroller = layout2.scrollContainerOf(flow);
      const rect = range.getBoundingClientRect();
      if (scroller === null) {
        const host = elementOf(range.startContainer)?.closest("[data-chat-node-key]") ?? flow;
        host.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
        return range;
      }
      const area = layout2.visibleChatArea(scroller);
      const target = scroller.scrollTop + (rect.top - area.top) - ANCHOR_TOP_GAP;
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      scroller.scrollTop = Math.min(Math.max(0, target), max);
      return range;
    }
    async function reveal(flow, annotation) {
      const immediate = resolve(flow, annotation.anchor);
      if (immediate !== null) return scrollToRange(immediate, flow);
      const scroller = layout2.scrollContainerOf(flow);
      if (scroller === null) return null;
      const start = scroller.scrollTop;
      const step = Math.max(MIN_STEP, Math.round(scroller.clientHeight * 0.8));
      const sweep = async (direction) => {
        let barren = 0;
        for (let attempt = 0; attempt < MAX_STEPS; attempt += 1) {
          const before = scroller.scrollTop;
          scroller.scrollTop = before + step * direction;
          for (let frame = 0; frame < FRAMES_PER_STEP; frame += 1) await nextFrame();
          const live = findFlow() ?? flow;
          const hit = resolve(live, annotation.anchor);
          if (hit !== null) return scrollToRange(hit, live);
          if (scroller.scrollTop === before) {
            barren += 1;
            if (barren > 1) return null;
          } else {
            barren = 0;
          }
        }
        return null;
      };
      const up = await sweep(-1);
      if (up !== null) return up;
      scroller.scrollTop = start;
      await nextFrame();
      return sweep(1);
    }
    return { reveal, scrollToRange, nextFrame };
  }

  // src/stylesheet.js
  var STYLESHEET = `
  .qc-popup{position:fixed;z-index:60;display:flex;align-items:stretch;gap:2px;padding:3px;
    border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-overlay);
    box-shadow:0 8px 24px rgba(0,0,0,.18);font-size:12.5px;line-height:1.2;color:var(--dsw-alias-label-primary);
    animation:qc-pop .1s ease-out;box-sizing:border-box}
  @keyframes qc-pop{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}
  .qc-popup button{appearance:none;border:0;background:transparent;color:inherit;font:inherit;
    display:flex;align-items:center;gap:5px;padding:6px 9px;border-radius:7px;cursor:pointer;white-space:nowrap}
  .qc-popup button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
  .qc-popup button:disabled{opacity:.45;cursor:default}
  .qc-popup button+button{box-shadow:inset 1px 0 0 var(--dsw-alias-border-l1)}
  .qc-popup svg{flex:none;opacity:.8}

  /* The compose panel: a compact dialog, larger radii to match the composer it sits above.
   *
   * The transition is declared here but only engages once the panel is DOCKED. A plain transition on the
   * top property would animate the first paint as well, so the panel would fly in from wherever it
   * rendered instead of appearing at its resting place above the selection.
   *
   * z-index -1 puts it BELOW the app's chrome, which is the required relationship: the header and the
   * composer must cover this panel when they overlap it.
   *
   * A negative z-index is deliberate. The header is a static element with no stacking context, so ANY
   * positioned element with a non-negative z-index paints above it — no value above zero can satisfy the
   * requirement. Negative values are valid for positioned elements and paint behind the in-flow content of the
   * stacking context, which is exactly "under the chrome, above the background".
   *
   * The old note claimed:
   * header are rendered by the host at higher layers, so when the panel is pushed under them it is
   * covered rather than floating on top. That is the requested behaviour.
   */
  .qc-compose{position:absolute;z-index:6;width:min(420px,92vw);box-sizing:border-box;
    border:1px solid var(--dsw-alias-border-l3, var(--dsw-alias-border-l2));border-radius:18px;
    background:var(--dsw-alias-bg-overlay);
    box-shadow:0 16px 40px rgba(0,0,0,.32),0 2px 8px rgba(0,0,0,.18);
    padding:12px;color:var(--dsw-alias-label-primary);
    font-size:12.5px;animation:qc-pop .1s ease-out;
    /* Smooth glide between the resting place and the docked slots. */
    transition:top .26s cubic-bezier(.22,.61,.36,1),left .26s cubic-bezier(.22,.61,.36,1)}
  .qc-compose[data-docked="false"]{transition:none}
  /* The gutter bubble's editor docks the same way the compose panel does, so it gets the same glide. */
  .qc-bubble-panel[data-docked="false"]{transition:none}
  .qc-bubble-panel{transition:top .26s cubic-bezier(.22,.61,.36,1),right .26s cubic-bezier(.22,.61,.36,1),left .26s cubic-bezier(.22,.61,.36,1)}
  .qc-compose textarea{width:100%;box-sizing:border-box;resize:none;min-height:2.8em;max-height:9em;
    font:inherit;line-height:1.5;padding:9px 11px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2);
    background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);outline:none}
  .qc-compose textarea:focus{border-color:var(--dsw-alias-brand-primary)}
  .qc-compose-row{display:flex;align-items:center;gap:8px;margin-top:10px}
  .qc-compose-hint{flex:1;min-width:0;font-size:11px;color:var(--dsw-alias-label-secondary);opacity:.85;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .qc-compose-confirm{appearance:none;border:0;border-radius:999px;min-width:26px;height:26px;
    padding:0 10px;flex:none;font:inherit;font-size:12px;font-weight:600;
    display:flex;align-items:center;justify-content:center;cursor:pointer;
    /* A solid accent with white ink. The theme token alone was too pale against the
       popover surface in dark mode, leaving the button barely visible. */
    background:#1f6ae0;color:#fff;
    box-shadow:0 1px 3px rgba(0,0,0,.28);
    transition:background .12s ease}
  .qc-compose-confirm svg{margin-right:5px}
  .qc-compose-confirm-text{white-space:nowrap}
  .qc-compose-confirm:hover{background:#1a5cc4}
  .qc-compose-confirm:active{background:#1550ac}
  .qc-compose-cancel:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
  .qc-compose-cancel{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;
    color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;border-radius:7px;
    padding:4px 10px;cursor:pointer;flex:none}

  /* ── The right-gutter bubble ────────────────────────────────────────────────

     A blue speech bubble pinned to the right of the text column, level with the
     TOP of the annotated passage, carrying the same ordinal as the annotation's
     chip. It marks where a passage came from without touching the prose itself.

     Drawn with a tail, so it reads as a bubble rather than a plain badge: the tail
     points back at the passage it belongs to. */
  /* The bubble is mounted INSIDE the row that holds its passage, and positioned
     with CSS alone.
    
     That is what makes it independent of zoom, wrapping and pane drags: it shares
     the row's box, so any transform of the row moves it by construction. Nothing
     recomputes its position, so nothing can go stale. right docks it to the
     column edge and top centres it on the row's first line.
    
     position:absolute against the row keeps it out of the text flow; the row is
     given position:relative only while it hosts a bubble. */
  /* The bubble sits at the paragraph's top-right corner, INSIDE its box, in a
     gutter created with padding-inline-end on the HOSTING BLOCK.

     Why padding after all: reserving room outside the box (negative right) lets the
     scroll container clip the bubble, and reserving it with a border or by shrinking
     the content box re-wraps the prose. Padding is applied once, when the bubble is
     attached, and never changes afterwards - so the paragraph lays out exactly once
     and cannot flicker on subsequent passes. */
  /* A hosting block reserves a right-hand gutter for its bubble.
     Applied once per block: the paragraph lays out with the gutter from the start, so
     adding a bubble never re-wraps the text and never changes the measured height. */
  .qc-hosts-bubble{padding-right:28px}
  .qc-marker{position:absolute;right:2px;top:0;z-index:2;
    /* The ordinal is CSS-generated, not a text node: a real node inside the paragraph
       would both join its textContent and be painted by the passage highlight. */
    content:"";
    display:flex;align-items:center;justify-content:center;
    min-width:19px;height:19px;padding:0 5px;
    border-radius:9.5px 9.5px 9.5px 3px;border:0;cursor:pointer;
    font-size:11px;font-weight:600;line-height:1;color:#fff;font-family:inherit;
    background:#2f7df6;
    box-shadow:0 1px 4px rgba(0,0,0,.22);
    transform-origin:left center;
    transition:transform .12s ease,background .12s ease,box-shadow .12s ease}.qc-marker::after{content:attr(data-qc-number);line-height:1}
  .qc-marker:hover{transform:scale(1.16);background:#1f6ae0}
  .qc-marker:active{transform:scale(1.04)}
  /* Tables keep a distinct hue so a glance tells the two kinds apart. */
  .qc-marker-table{background:#17a673}
  .qc-marker-table:hover{background:#128a5f}
  /* The bubble the editor belongs to stays lit while the editor is open. */
  .qc-marker.qc-marker-active{background:#1f6ae0;box-shadow:0 0 0 2px rgba(47,125,246,.28),
    0 1px 4px rgba(0,0,0,.22)}

  /* The bubble's own editor: change or delete the comment, without touching the
     annotated passage. Sits above the bubble but still below app chrome. */
  /* In-flow placement: the panel is a child of the annotated paragraph, so it rides
     with the text (scroll, zoom, reflow) and needs no reposition listener. It sits just
     clear of the bubble so the two never overlap. */
  /* z-index 6 — the SAME layer as the compose panel, and deliberately BELOW the composer (7).
   *
   * It used to be 40, which put the editor on top of the chat box: scrolling the panel down to the composer's position
   * drew it OVER the chat box, while the compose panel correctly slid underneath. Both editors now share one layer, so
   * the chrome covers them exactly as it covers the transcript text. 6 also keeps them above the code-block banner,
   * which is 6 as well and older in DOM order.
   */
  .qc-bubble-panel{position:absolute;z-index:6;box-sizing:border-box;
    width:min(320px,80vw);padding:10px;
    border:1px solid var(--dsw-alias-border-l3, var(--dsw-alias-border-l2));border-radius:12px;
    background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);
    box-shadow:0 16px 40px rgba(0,0,0,.32),0 2px 8px rgba(0,0,0,.18);
    display:flex;flex-direction:column;gap:8px;
    animation:qc-card-in .14s cubic-bezier(.2,.8,.3,1)}
  .qc-bubble-panel .qc-bp-label{font-size:11.5px;font-weight:600;
    color:var(--dsw-alias-label-secondary);padding:0 1px}
  .qc-bubble-panel textarea{box-sizing:border-box;width:100%;min-height:64px;
    resize:vertical;padding:7px 9px;border-radius:8px;font:inherit;font-size:12.5px;
    line-height:1.55;color:inherit;background:var(--dsw-alias-bg-layer-2);
    border:1px solid var(--dsw-alias-border-l2)}
  .qc-bubble-panel textarea:focus{outline:none;
    border-color:var(--dsw-alias-state-accent-primary)}
  .qc-bp-actions{display:flex;align-items:center;gap:6px}
  /* Buttons carry a real hover/press state, not just a cursor change: a filled
     background shift on hover, a drop under the finger on press, and a focused ring
     for keyboard use. A pointer-only affordance is invisible at a glance. */
  .qc-bp-actions button{appearance:none;font:inherit;font-size:12px;font-weight:500;
    cursor:pointer;padding:6px 13px;border-radius:8px;
    border:1px solid var(--dsw-alias-border-l2);
    background:var(--dsw-alias-bg-layer-2);color:inherit;
    transition:background .14s ease,border-color .14s ease,transform .08s ease,
      box-shadow .14s ease,opacity .14s ease}
  .qc-bp-actions button:hover:not(:disabled){
    background:var(--dsw-alias-bg-layer-3);
    border-color:var(--dsw-alias-border-l3)}
  .qc-bp-actions button:active:not(:disabled){transform:translateY(1px) scale(.985)}
  .qc-bp-actions button:focus-visible{outline:none;
    box-shadow:0 0 0 2px var(--dsw-alias-state-accent-primary)}
  .qc-bp-actions button:disabled{opacity:.45;cursor:default}
  /* The save button is the panel's primary action, so it uses a solid, saturated
     fill with white text.
     It previously painted with --dsw-alias-state-accent-primary, which is a BORDER
     and TEXT accent token, not a button fill: as a background it is pale, so white
     text on it was almost unreadable. The token is still used for the focus ring,
     which is what it is for. */
  .qc-bp-actions .qc-bp-save{margin-left:auto;border-color:transparent;
    background:#1f6ae0;color:#fff;font-weight:600;
    box-shadow:0 1px 2px rgba(16,63,145,.28)}
  .qc-bp-actions .qc-bp-save:hover:not(:disabled){
    background:#1a5cc4;color:#fff;
    box-shadow:0 3px 10px rgba(31,106,224,.38)}
  .qc-bp-actions .qc-bp-save:active:not(:disabled){
    background:#1550ac;box-shadow:0 1px 3px rgba(16,63,145,.35)}
  .qc-bp-actions .qc-bp-save:focus-visible{
    box-shadow:0 0 0 2px #fff,0 0 0 4px #1f6ae0}
  /* Delete is a destructive action: it only looks dangerous once you are on it. */
  .qc-bp-actions .qc-bp-delete{color:var(--dsw-alias-state-error-primary)}
  .qc-bp-actions .qc-bp-delete:hover:not(:disabled){
    background:var(--dsw-alias-state-error-primary);color:#fff;
    border-color:transparent}

  /* A short confirmation, so a save is not a silent state change. */
  .qc-bp-done{position:fixed;z-index:41;pointer-events:none;
    padding:5px 10px;border-radius:8px;font-size:12px;color:#fff;
    background:rgba(24,24,24,.88);box-shadow:0 4px 14px rgba(0,0,0,.2);
    animation:qc-done .9s ease forwards}
  @keyframes qc-done{
    0%{opacity:0;transform:translateY(3px)}
    18%{opacity:1;transform:translateY(0)}
    75%{opacity:1;transform:translateY(0)}
    100%{opacity:0;transform:translateY(-3px)}}

  .qc-table-add{position:fixed;z-index:55;appearance:none;border:1px solid var(--dsw-alias-border-l2);
    background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;
    border-radius:8px;padding:4px 9px;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.14);
    display:flex;align-items:center;gap:5px;white-space:nowrap}
  .qc-table-add:hover{background:var(--dsw-alias-bg-layer-2)}

  /* The jump flash is a range highlight painted by the browser, not a positioned
     box: the ::highlight pseudo-element follows the text through scrolling and
     reflow, so it can never end up glowing over the composer while the passage is
     off-screen.

     The highlight pseudo-element cannot be transitioned — it takes no transition
     property — so the fade is produced by animating the painted colour itself. Two names are used:
     the transient jump ADDS the highlight and lets qc-flash-in run its own
     fade-in/fade-out; the editor HOLD registers a highlight that stays, so it does
     not animate out at all. */
  ::highlight(quote-chat-flash){background-color:rgba(255,214,0,.42);
    text-decoration:underline;text-decoration-color:rgba(255,196,0,.55);
    text-decoration-thickness:2px;
    animation:qc-hl-in .22s ease-out}
  @keyframes qc-hl-in{
    from{background-color:rgba(255,214,0,0);text-decoration-color:rgba(255,196,0,0)}
    to{background-color:rgba(255,214,0,.42);text-decoration-color:rgba(255,196,0,.55)}}
  /* The held highlight (used while a bubble's editor is open) fades in the same
     way but never fades out on its own. */
  ::highlight(quote-chat-hold){background-color:rgba(255,214,0,.42);
    text-decoration:underline;text-decoration-color:rgba(255,196,0,.55);
    text-decoration-thickness:2px;
    animation:qc-hl-in .22s ease-out}

  /* ── The inline annotation chip ──────────────────────────────────────────────

     A rounded pill sitting in the composer's text flow, showing the annotation's
     label plus a leading glyph that names its kind:

       text     引文 glyph
       table    grid glyph

     On hover the glyph is replaced, in place, by a red × that removes the
     annotation. The × lives INSIDE the chip's left edge — it takes over the glyph's
     slot rather than floating outside — so the control is part of the pill and
     cannot drift away from it.

     Both glyphs and the × are drawn by pseudo-elements and a positioned overlay
     keyed on the chip's own box. The chip's children are React's; nothing here
     writes into them. */
  /* The chip follows the app's theme instead of hard-coding a light grey.
     --qc-chip-bg resolves to the app's own layer token, so dark mode is inherited
     rather than guessed at; the fallbacks only apply outside the host. */
  [data-composer-chip="quote-chat"]{display:inline-flex;align-items:center;
    vertical-align:baseline;max-width:20em;padding:2px 9px 2px 7px;margin:0 1px;
    border-radius:999px;
    border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.08));
    background:var(--qc-chip-bg, var(--dsw-alias-bg-layer-2, #f2f2f2));
    color:var(--dsw-alias-label-primary, #181818);
    font-size:12.5px;line-height:1.5;cursor:pointer;position:relative;
    transition:background .14s ease}
  [data-composer-chip="quote-chat"]:hover,
  [data-composer-chip="quote-chat"]:focus-within{
    background:var(--qc-chip-bg-hover, var(--dsw-alias-bg-layer-3, #e8e8e8));
    border-color:var(--dsw-alias-border-l3, rgba(0,0,0,.16))}
  /* The host's own marker glyph is the first child; it is hidden and replaced by a
     CSS glyph so the node's contents are never touched. */
  [data-composer-chip="quote-chat"] > span:first-child{display:none}
  /* The kind glyph, occupying the left slot. */
  [data-composer-chip="quote-chat"]::before{content:"";
    flex:none;width:13px;height:13px;margin-right:6px;
    background-color:currentColor;opacity:.75;
    -webkit-mask-image:var(--qc-glyph, var(--qc-glyph-text));
    mask-image:var(--qc-glyph, var(--qc-glyph-text));
    -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
    -webkit-mask-position:center;mask-position:center;
    -webkit-mask-size:contain;mask-size:contain;
    transition:opacity .12s ease,visibility .12s ease}
  /* Hovering hides the kind glyph: the × takes its place in the same slot. */
  [data-composer-chip="quote-chat"]:hover::before,
  [data-composer-chip="quote-chat"]:focus-within::before{opacity:0;visibility:hidden}
  /*
   * The ordinal, drawn here rather than relying on the host's label.
   *
   * The host renders its label inside a child span, and that text was not reaching
   * the screen: the chip showed a glyph and nothing else. A pseudo-element is
   * rendered by CSS from an attribute the plugin sets, so it cannot be lost to the
   * editor's own rendering.
   */
  [data-composer-chip="quote-chat"]::after{content:attr(data-qc-label);
    order:1;margin-left:0;font-size:12.5px;line-height:1.5;
    color:var(--dsw-alias-label-primary, #181818);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* Keep the host's own label out of the way so the ordinal is the only text. */
  [data-composer-chip="quote-chat"] > span:last-child{display:none}

  /* Glyph: a rounded rectangle with a quote stroke inside it — the same "quoted
     text" mark the reference shows. Table chips get a grid glyph. */
  :root{
    --qc-glyph-text:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='2' y='3' width='12' height='10' rx='2.5' fill='none' stroke='black' stroke-width='1.4'/><path d='M5.6 6.6h4.8M5.6 9.2h3' stroke='black' stroke-width='1.3' stroke-linecap='round'/></svg>");
    --qc-glyph-table:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='2' y='3.2' width='12' height='9.6' rx='1.8' fill='none' stroke='black' stroke-width='1.3'/><path d='M2 6.4h12M2 9.6h12M6.2 3.2v9.6' stroke='black' stroke-width='1.1'/></svg>");
  }
  [data-composer-chip="quote-chat"][data-qc-kind="table"]{--qc-glyph:var(--qc-glyph-table)}

  /* ── The hover removal control ───────────────────────────────────────────────

     The red × sits in the chip's left slot, replacing the kind glyph on hover.

     Shaped to belong to the pill: fully rounded like the chip, sized to the glyph
     box it covers, and centred on the same point (the inline style positions it by
     its centre).

     The cross is drawn as an SVG, not typed as a character. A text multiplication
     sign inherits the font's baseline and side bearings, which made it sit high and
     look undersized no matter how it was nudged; two strokes give exact geometry
     and scale with the button. */
  .qc-chip-remove{position:fixed;z-index:45;
    appearance:none;box-sizing:border-box;margin:0;padding:0;border:0;
    border-radius:999px;background:#e8291c;
    cursor:pointer;display:flex;align-items:center;justify-content:center;
    transform:translate(-50%,-50%);box-shadow:0 0 0 1.5px var(--dsw-alias-bg-layer-1, #f2f2f2);
    transition:background .12s ease,transform .12s ease}
  .qc-chip-remove svg{display:block;width:10px;height:10px;flex:none;
    pointer-events:none}
  .qc-chip-remove svg path{stroke:#fff;stroke-width:2.1;stroke-linecap:round;
    fill:none;vector-effect:non-scaling-stroke}
  .qc-chip-remove:hover{background:#c81f14;transform:translate(-50%,-50%) scale(1.1)}

  /* ── The hover preview card ──────────────────────────────────────────────────

     A compact panel floating above the chip, holding the rendered passage. Sized to
     its content: a short passage should not open a 560px sheet. max-width caps
     it, width:max-content lets it stay small.

     No ordinal and no removal control inside — the chip carries both. */
  .qc-card{position:fixed;z-index:50;
    width:max-content;max-width:min(380px,80vw);box-sizing:border-box;
    border:1px solid var(--dsw-alias-border-l3, rgba(0,0,0,.07));border-radius:12px;
    background:var(--dsw-alias-bg-overlay, #fff);
    box-shadow:0 8px 26px rgba(0,0,0,.15),0 2px 6px rgba(0,0,0,.05);
    padding:8px 10px;color:var(--dsw-alias-label-primary, #181818);
    animation:qc-card-in .16s cubic-bezier(.2,.8,.3,1)}
  @keyframes qc-card-in{
    from{opacity:0;transform:translateY(4px) scale(.98)}
    to{opacity:1;transform:translateY(0) scale(1)}}
  /* The exit runs while the card is still mounted; the parent unmounts it after
     CARD_EXIT_MS. Filled mode keeps the final keyframe's state, so the card does not
     flash back to full opacity on the last frame. */
  .qc-card-out{animation:qc-card-out .13s ease-in forwards}
  @keyframes qc-card-out{
    from{opacity:1;transform:translateY(0) scale(1)}
    to{opacity:0;transform:translateY(3px) scale(.985)}}
  .qc-card-comment{margin:0 0 7px;padding:6px 9px;border-radius:8px;
    background:var(--dsw-alias-bg-layer-2, #f6f6f6);color:#4b4b4b;font-size:12px;line-height:1.55;
    white-space:pre-wrap;word-break:break-word}
  .qc-card-body{max-height:220px;overflow:auto;font-size:12.5px;line-height:1.6;
    word-break:break-word;
    /* The captured markup keeps the answer's own class names, but the stylesheet
       those classes belong to lives in the transcript, not here — so nothing is
       inherited automatically. These defaults make the fragment readable on its
       own: headings, lists, quotes and code all get a local shape. */
  }
  .qc-card-body h1,.qc-card-body h2,.qc-card-body h3,.qc-card-body h4{
    margin:.5em 0 .35em;font-size:1em;font-weight:700;line-height:1.4}
  .qc-card-body p{margin:.35em 0}
  .qc-card-body ul,.qc-card-body ol{margin:.35em 0;padding-left:1.35em}
  .qc-card-body li{margin:.15em 0}
  .qc-card-body blockquote{margin:.4em 0;padding-left:.7em;
    border-left:2px solid var(--dsw-alias-border-l2, #e0e0e0);color:var(--dsw-alias-label-secondary, #555)}
  .qc-card-body code{font-family:ui-monospace,monospace;font-size:.92em;
    padding:.1em .3em;border-radius:4px;background:var(--dsw-alias-bg-layer-2, #f2f2f2)}
  .qc-card-body pre{margin:.4em 0;padding:7px 9px;border-radius:8px;
    background:var(--dsw-alias-bg-layer-2, #f6f6f6);overflow-x:auto}
  .qc-card-body pre code{padding:0;background:none}
  .qc-card-body a{color:#3b6fd4;text-decoration:underline}
  .qc-card-body strong,.qc-card-body b{font-weight:700}
  .qc-card-body em,.qc-card-body i{font-style:italic}
  /* KaTeX ships its own layout rules with the transcript's stylesheet; pull in the
     few that matter so a captured formula does not collapse into run-together
     glyphs. The markup already carries the spans, so this only restores shape. */
  .qc-card-body .katex{font-size:1.05em;line-height:1.2}
  .qc-card-body .katex .base{position:relative;display:inline-block;white-space:nowrap}
  .qc-card-body .katex .vlist-t{display:inline-table;table-layout:fixed;
    border-collapse:collapse}
  .qc-card-body .katex .vlist-r{display:table-row}
  .qc-card-body .katex .vlist{display:table-cell;vertical-align:bottom;position:relative}
  .qc-card-body .katex .vlist > span{display:block;height:0;position:relative}
  .qc-card-body .katex .vlist > span > span{display:inline-block}
  .qc-card-body .katex .msupsub{text-align:left}
  .qc-card-body .katex .mfrac > span > span{text-align:center}
  .qc-card-body .katex .mfrac .frac-line{border-bottom:1px solid currentColor;
    display:inline-block;width:100%}
  .qc-card-body .katex .mord,.qc-card-body .katex .mbin,.qc-card-body .katex .mrel,
  .qc-card-body .katex .mopen,.qc-card-body .katex .mclose,.qc-card-body .katex .mpunct,
  .qc-card-body .katex .minner{display:inline-block}
  .qc-card-body .katex .mspace{display:inline-block}
  .qc-card-body .katex .sqrt > .root{margin-left:.2em}
  .qc-card-body .katex .hide-tail{overflow:hidden}
  .qc-card-body .katex .sizing,.qc-card-body .katex .fontsize-ensurer{display:inline-block}
  .qc-card-body table{border-collapse:collapse;width:100%;font-size:12.5px;margin:0}
  .qc-card-body td,.qc-card-body th{border:1px solid #e6e6e6;padding:6px 10px;
    text-align:left}
  .qc-card-body th{background:#fafafa;font-weight:600}
  .qc-card-md{margin:0;white-space:pre-wrap;font:inherit;font-size:12px;line-height:1.55}

  .qc-notice{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:70;
    padding:6px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);
    background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-state-warn-primary);
    font-size:12px;max-width:min(32em,90vw);text-align:center}

  .qc-side{display:flex;flex-direction:column;height:100%;min-height:0;font-size:13px;
    color:var(--dsw-alias-label-primary);box-sizing:border-box}
  .qc-side-head{display:flex;align-items:center;gap:8px;padding:8px 12px;
    border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
  .qc-side-head-title{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .qc-side-head button{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;
    color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;padding:3px 8px;border-radius:7px;cursor:pointer}
  .qc-side-head button:hover{background:var(--dsw-alias-bg-layer-2)}
  .qc-quote{flex:none;margin:10px 12px 0;padding:8px 10px;border-left:2px solid var(--dsw-alias-brand-primary);
    border-radius:0 8px 8px 0;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);
    font-size:12px;line-height:1.55}
  .qc-quote-label{font-size:11px;letter-spacing:.04em;text-transform:uppercase;opacity:.75;margin-bottom:3px;
    display:flex;justify-content:space-between;gap:8px;align-items:baseline}
  .qc-quote-label button{appearance:none;border:0;background:transparent;color:var(--dsw-alias-brand-primary);
    font:inherit;font-size:11px;letter-spacing:0;text-transform:none;cursor:pointer;padding:0;flex:none}
  .qc-quote-body{white-space:pre-wrap;word-break:break-word}
  .qc-quote-body.qc-clamped{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
  .qc-thread{flex:1;min-height:0;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
  .qc-empty{margin:auto;max-width:30em;text-align:center;color:var(--dsw-alias-label-secondary);
    font-size:12.5px;line-height:1.65}
  .qc-msg{display:flex;flex-direction:column;gap:4px;max-width:100%}
  .qc-msg-role{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);opacity:.75}
  .qc-msg-body{white-space:pre-wrap;word-break:break-word;line-height:1.7}
  .qc-msg-user .qc-msg-body{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);
    border-radius:9px;padding:7px 10px}
  .qc-msg-actions{display:flex;gap:10px}
  .qc-msg-actions button{appearance:none;border:0;background:transparent;color:var(--dsw-alias-brand-primary);
    font:inherit;font-size:12px;cursor:pointer;padding:0}
  .qc-msg-actions button:hover{text-decoration:underline}
  .qc-msg-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.6}
  .qc-dots::after{content:'';animation:qc-dots 1.2s steps(4,end) infinite}
  @keyframes qc-dots{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
  .qc-side-compose{flex:none;border-top:1px solid var(--dsw-alias-border-l1);padding:10px 12px;
    display:flex;flex-direction:column;gap:8px}
  .qc-side-compose textarea{width:100%;box-sizing:border-box;resize:none;min-height:3.4em;max-height:12em;
    font:inherit;line-height:1.5;padding:8px 10px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2);
    background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);outline:none}
  .qc-side-compose textarea:focus{border-color:var(--dsw-alias-brand-primary)}
  .qc-side-compose-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .qc-side-compose-hint{flex:1;min-width:0;font-size:11px;color:var(--dsw-alias-label-secondary);opacity:.85}
  .qc-btn{appearance:none;border:0;border-radius:8px;font:inherit;font-size:12.5px;padding:6px 14px;
    cursor:pointer;background:var(--dsw-alias-brand-primary);color:#fff;font-weight:500}
  .qc-btn:disabled{opacity:.45;cursor:default}
  .qc-btn-ghost{background:transparent;color:var(--dsw-alias-label-secondary);
    border:1px solid var(--dsw-alias-border-l2);font-weight:400}
  .qc-btn-ghost:hover{background:var(--dsw-alias-bg-layer-2)}
  `;

  // src/icons.js
  var import_react2 = __toESM(require("react"), 1);
  var h = import_react2.default.createElement;
  function IconAnnotate() {
    return h(
      "svg",
      { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" },
      h("path", {
        d: "M2.6 4.4h6a1.3 1.3 0 0 1 1.3 1.3v3.6a1.3 1.3 0 0 1-1.3 1.3H5.3L3 12.8V5.7",
        stroke: "currentColor",
        "stroke-width": 1.3,
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      }),
      h("path", {
        d: "M12 3.1v3.8M10.1 5h3.8",
        stroke: "currentColor",
        "stroke-width": 1.3,
        "stroke-linecap": "round",
        opacity: 0.7
      })
    );
  }
  function IconSideChat() {
    return h(
      "svg",
      { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" },
      h("rect", { x: 1.8, y: 2.6, width: 8.2, height: 8.9, rx: 1.4, stroke: "currentColor", "stroke-width": 1.3 }),
      h("path", {
        d: "M10.1 5.2h2.6a1.3 1.3 0 0 1 1.3 1.3v6.2l-2.1-1.6",
        stroke: "currentColor",
        "stroke-width": 1.3,
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      })
    );
  }
  function IconCheck() {
    return h(
      "svg",
      { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" },
      h("path", {
        d: "M3.4 8.5l3 3 6.2-7",
        stroke: "currentColor",
        "stroke-width": 1.8,
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      })
    );
  }

  // src/html.js
  function tableHtml(markdown) {
    const rows = markdown.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("|")).map((line) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell2) => cell2.trim())).filter((cells) => cells.length > 0 && !cells.every((cell2) => /^:?-{2,}:?$/.test(cell2)));
    if (rows.length === 0) return `<pre class="qc-card-md">${escapeHtml(markdown)}</pre>`;
    const head = rows[0];
    const body = rows.slice(1);
    const cell = (tag, text) => `<${tag}>${escapeHtml(text)}</${tag}>`;
    return `<table><thead><tr>${head.map((text) => cell("th", text)).join("")}</tr></thead><tbody>${body.map((cells) => `<tr>${cells.map((text) => cell("td", text)).join("")}</tr>`).join("")}</tbody></table>`;
  }
  function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // src/ui/popovers.js
  var import_react3 = __toESM(require("react"), 1);
  var import_react_dom = require("react-dom");
  var h2 = import_react3.default.createElement;
  var VIEWPORT_MARGIN = 8;
  var ANCHOR_GAP = 8;
  function findScroller() {
    if (typeof document === "undefined") return null;
    const flow = findFlowElement();
    if (flow === null) return null;
    for (let node = flow; node !== null; node = node.parentElement) {
      if (node === document.body || node === document.documentElement) break;
      if (node.scrollHeight <= node.clientHeight + 8) continue;
      if (node === flow || node.contains(flow)) return node;
    }
    return null;
  }
  function placeNear(rect, size) {
    const width = size.width;
    const height = size.height;
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN));
    let top = rect.top - height - ANCHOR_GAP;
    if (top < VIEWPORT_MARGIN) {
      top = Math.min(rect.bottom + ANCHOR_GAP, window.innerHeight - height - VIEWPORT_MARGIN);
    }
    return { left: Math.max(VIEWPORT_MARGIN, left), top: Math.max(VIEWPORT_MARGIN, top) };
  }
  function createPopovers({
    findFlow,
    anchorInTranscript,
    anchorAboveSelection,
    snapPosition,
    readableBand
  }) {
    function ActionPopup2(props) {
      const { anchor, canAnnotate, canAsk, labels, onAnnotate, onAsk } = props;
      const ref = import_react3.default.useRef(null);
      const [size, setSize] = import_react3.default.useState({ width: 0, height: 0 });
      import_react3.default.useLayoutEffect(() => {
        const element = ref.current;
        if (element === null) return;
        const rect = element.getBoundingClientRect();
        setSize({ width: rect.width, height: rect.height });
      }, []);
      const flow = findFlow();
      const measured = { width: size.width || 210, height: size.height || 34 };
      const anchored = flow === null ? null : anchorInTranscript(flow, anchor, measured, "below");
      const position = anchored === null ? placeNear(anchor, measured) : anchored.position;
      return (0, import_react_dom.createPortal)(
        h2(
          "div",
          {
            ref,
            className: "qc-popup",
            role: "toolbar",
            style: {
              left: `${position.left}px`,
              top: `${position.top}px`,
              position: anchored === null ? "fixed" : "absolute",
              visibility: size.width === 0 ? "hidden" : "visible"
            },
            // The selection must survive the click that chooses an action.
            onMouseDown: (event) => event.preventDefault()
          },
          h2(
            "button",
            { type: "button", disabled: !canAnnotate, onClick: onAnnotate },
            h2(IconAnnotate, null),
            labels.annotate
          ),
          h2(
            "button",
            { type: "button", disabled: !canAsk, onClick: onAsk },
            h2(IconSideChat, null),
            labels.askInSide
          )
        ),
        anchored === null ? document.body : anchored.scroller
      );
    }
    function ComposerPopover2(props) {
      const { source, labels, onConfirm, onCancel } = props;
      const ref = import_react3.default.useRef(null);
      const inputRef = import_react3.default.useRef(null);
      const [comment, setComment] = import_react3.default.useState("");
      const [, setViewportTick] = import_react3.default.useState(0);
      const [size, setSize] = import_react3.default.useState({ width: 0, height: 0 });
      const scrollerRef = import_react3.default.useRef(void 0);
      if (scrollerRef.current === void 0) {
        scrollerRef.current = findScroller();
      }
      const scroller = scrollerRef.current;
      import_react3.default.useLayoutEffect(() => {
        if (scroller === null) return;
        if (getComputedStyle(scroller).position === "static") {
          scroller.style.position = "relative";
        }
      }, [scroller]);
      import_react3.default.useLayoutEffect(() => {
        const element = ref.current;
        if (element === null) return;
        const rect = element.getBoundingClientRect();
        if (rect.width !== size.width || rect.height !== size.height) {
          setSize({ width: rect.width, height: rect.height });
        }
      });
      import_react3.default.useEffect(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, []);
      import_react3.default.useEffect(() => {
        const block = source.block;
        let frame = 0;
        let primed = false;
        let lastTop = null;
        let lastLeft = null;
        let lastHeight = null;
        const watch = () => {
          frame = window.requestAnimationFrame(watch);
          if (block === null || block === void 0 || block.isConnected !== true) return;
          const box = block.getBoundingClientRect();
          const top = Math.round(box.top);
          const left = Math.round(box.left);
          const height2 = Math.round(box.height);
          if (primed === false) {
            primed = true;
            lastTop = top;
            lastLeft = left;
            lastHeight = height2;
            return;
          }
          if (top === lastTop && left === lastLeft && height2 === lastHeight) return;
          lastTop = top;
          lastLeft = left;
          lastHeight = height2;
          setViewportTick((tick) => tick + 1);
        };
        frame = window.requestAnimationFrame(watch);
        return () => {
          if (frame !== 0) window.cancelAnimationFrame(frame);
        };
      }, [source.block]);
      import_react3.default.useEffect(() => {
        const onDown = (event) => {
          const target2 = event.target;
          if (!(target2 instanceof Node)) return;
          if (ref.current !== null && ref.current.contains(target2)) return;
          if (isInsideTranscript(target2) === false) return;
          onCancel();
        };
        const onKey = (event) => {
          if (event.key === "Escape") onCancel();
        };
        document.addEventListener("mousedown", onDown, true);
        document.addEventListener("keydown", onKey, true);
        return () => {
          document.removeEventListener("mousedown", onDown, true);
          document.removeEventListener("keydown", onKey, true);
        };
      }, [onCancel]);
      const width = size.width || 420;
      const height = size.height || 170;
      const liveBlock = source.block;
      const blockBox = liveBlock !== void 0 && liveBlock !== null && liveBlock.isConnected === true ? liveBlock.getBoundingClientRect() : source.blockRect ?? source.rect?.passage ?? source.rect;
      const resting = anchorAboveSelection ? anchorAboveSelection(blockBox, { width, height }) : placeNear(source.rect?.passage ?? source.rect, { width, height });
      const scrollerBox = scroller === null ? { top: 0, left: 0, bottom: typeof window === "undefined" ? 0 : window.innerHeight } : scroller.getBoundingClientRect();
      const hasInput = comment.trim() !== "";
      const restingBottom = resting.top + height;
      const fullyVisible = resting.top >= scrollerBox.top - 1 && restingBottom <= scrollerBox.bottom + 1;
      const needsRescue = hasInput && !fullyVisible;
      const docked = needsRescue && snapPosition ? snapPosition(resting.top, { width, height }) : null;
      const inViewport = docked ?? { left: resting.left, top: resting.top };
      const target = scroller === null ? inViewport : {
        left: Math.round(inViewport.left - scrollerBox.left + scroller.scrollLeft),
        top: Math.round(inViewport.top - scrollerBox.top + scroller.scrollTop)
      };
      return (0, import_react_dom.createPortal)(
        h2(
          "div",
          {
            ref,
            className: "qc-compose",
            role: "dialog",
            "aria-label": labels.title,
            // The docked slot is a data attribute so the stylesheet can add the transition only when a
            // move is actually happening — the first paint must not animate from the origin.
            "data-docked": docked === null ? "false" : docked.edge,
            style: {
              left: `${target.left}px`,
              top: `${target.top}px`,
              // Absolute inside the transcript's scroll container, so the panel shares the text's layer. The container
              // clips it at its top edge and the composer covers it at the bottom, exactly as happens to text — no
              // clip-path, no z-index trick, and no scroll listener needed for the resting position.
              position: scroller === null ? "fixed" : "absolute"
            },
            onMouseDown: (event) => event.stopPropagation(),
            onKeyDown: (event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                onCancel();
              }
            }
          },
          source.kind === "table" ? null : h2("textarea", {
            ref: inputRef,
            value: comment,
            rows: 2,
            placeholder: labels.placeholder,
            onChange: (event) => setComment(event.target.value),
            onKeyDown: (event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent?.isComposing) {
                event.preventDefault();
                onConfirm(comment);
              }
            }
          }),
          h2(
            "div",
            { className: "qc-compose-row" },
            h2(
              "span",
              { className: "qc-compose-hint" },
              source.kind === "table" ? labels.table.replace("{rows}", String(source.rows ?? 0)) : `${labels.selected.replace("{count}", String(source.previewText.length))} · ${labels.hint}`
            ),
            h2("button", { type: "button", className: "qc-compose-cancel", onClick: onCancel }, labels.cancel),
            h2("button", {
              type: "button",
              className: "qc-compose-confirm",
              title: labels.confirm,
              "aria-label": labels.confirm,
              onClick: () => onConfirm(source.kind === "table" ? "" : comment)
            }, h2(IconCheck, null), h2("span", { className: "qc-compose-confirm-text" }, labels.confirm))
          )
        ),
        // Inside the transcript's scroll container, so the panel is covered and clipped exactly as the text is.
        // Falls back to `body` when there is no container, where `position: fixed` and viewport coordinates apply.
        scroller ?? document.body
      );
    }
    return { ActionPopup: ActionPopup2, ComposerPopover: ComposerPopover2 };
  }

  // src/ui/cards.js
  var import_react4 = __toESM(require("react"), 1);
  var import_react_dom2 = require("react-dom");
  var h3 = import_react4.default.createElement;
  var HOVER_LINGER_MS = 260;
  var CARD_EXIT_MS = 130;
  var VIEWPORT_MARGIN2 = 8;
  function createCards({ composerContainer: composerContainer2 }) {
    function ChipCards2(props) {
      const { annotations, occurrences, labels, onJump, onRemove } = props;
      const actionsRef = import_react4.default.useRef({ onJump, onRemove });
      actionsRef.current = { onJump, onRemove };
      const [hover, setHover] = import_react4.default.useState(null);
      const hoverRef = import_react4.default.useRef(null);
      hoverRef.current = hover;
      import_react4.default.useEffect(() => {
        if (typeof document === "undefined") return void 0;
        let frame = 0;
        let timer = 0;
        let closeTimer = 0;
        const marked = /* @__PURE__ */ new Set();
        const unmark = (chip) => {
          delete chip.dataset.qcNum;
          delete chip.dataset.qcKind;
          delete chip.dataset.qcLabel;
          marked.delete(chip);
        };
        const pairs = () => {
          const refs = occurrences.filter((item) => item.source === CHIP_SOURCE).map((item) => item.ref);
          const chips = [...document.querySelectorAll('[data-composer-chip="quote-chat"]')].filter((element) => element.closest("[data-sidebar-right-tab]") === null);
          const result = [];
          for (let index = 0; index < chips.length && index < refs.length; index += 1) {
            const annotation = annotations.find((item) => item.id === refs[index]);
            if (annotation !== void 0) result.push({ chip: chips[index], annotation });
          }
          return result;
        };
        const apply2 = () => {
          frame = 0;
          if (typeof document === "undefined") return;
          const live = /* @__PURE__ */ new Set();
          const ordered = pairs();
          for (let position = 0; position < ordered.length; position += 1) {
            const { chip, annotation } = ordered[position];
            const ordinal = position + 1;
            live.add(chip);
            chip.dataset.qcNum = String(ordinal);
            chip.dataset.qcKind = annotation.kind === "table" ? "table" : "text";
            chip.dataset.qcLabel = labels.content.replace("{n}", String(ordinal));
            marked.add(chip);
          }
          for (const chip of [...marked]) {
            if (!live.has(chip)) unmark(chip);
          }
        };
        const schedule = () => {
          if (frame !== 0) return;
          frame = requestAnimationFrame(apply2);
        };
        const debounced = () => {
          clearTimeout(timer);
          timer = setTimeout(schedule, 70);
        };
        schedule();
        const observer = new MutationObserver((records) => {
          for (const record of records) {
            if (record.type === "attributes") {
              if (record.attributeName?.startsWith("data-qc")) continue;
              if (record.target instanceof Element && record.target.closest('[data-composer-chip="quote-chat"]') !== null) {
                debounced();
                return;
              }
              continue;
            }
            for (const node of record.addedNodes) {
              if (node instanceof Element && (node.matches?.('[data-composer-chip="quote-chat"]') || node.querySelector?.('[data-composer-chip="quote-chat"]') !== null)) {
                debounced();
                return;
              }
            }
            for (const node of record.removedNodes) {
              if (node instanceof Element && (node.matches?.('[data-composer-chip="quote-chat"]') || node.querySelector?.('[data-composer-chip="quote-chat"]') !== null)) {
                debounced();
                return;
              }
            }
          }
        });
        const composerHost = composerContainer2();
        if (composerHost !== null) {
          observer.observe(composerHost, { childList: true, subtree: true });
        }
        const chipOf = (event) => event.target instanceof Element ? event.target.closest('[data-composer-chip="quote-chat"]') : null;
        const hoverTargetOf = (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (target === null) return void 0;
          const inFloating = target.closest(".qc-card") !== null || target.closest(".qc-chip-remove") !== null;
          if (inFloating) {
            return hoverRef.current?.annotation ?? null;
          }
          const chip = chipOf(event);
          if (chip === null) return void 0;
          return pairs().find((pair) => pair.chip === chip)?.annotation;
        };
        const onPointer = (event) => {
          const annotation = hoverTargetOf(event);
          if (annotation === void 0 || annotation === null) {
            if (closeTimer === 0) {
              closeTimer = setTimeout(() => {
                closeTimer = 0;
                setHover((current) => current === null ? current : { ...current, closing: true });
                closeTimer = setTimeout(() => {
                  closeTimer = 0;
                  setHover(null);
                }, CARD_EXIT_MS);
              }, HOVER_LINGER_MS);
            }
            return;
          }
          if (closeTimer !== 0) {
            clearTimeout(closeTimer);
            closeTimer = 0;
          }
          const chip = pairs().find((pair) => pair.annotation.id === annotation.id)?.chip;
          if (chip === void 0) return;
          const rect = chip.getBoundingClientRect();
          setHover((current) => {
            if (current !== null && current.annotation.id === annotation.id && current.anchor.left === Math.round(rect.left) && current.anchor.top === Math.round(rect.top) && current.anchor.width === Math.round(rect.width) && current.anchor.height === Math.round(rect.height)) return current;
            return { annotation, anchor: {
              left: Math.round(rect.left),
              top: Math.round(rect.top),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            } };
          });
        };
        const reposition = () => {
          setHover((current) => {
            if (current === null) return current;
            const still = pairs().find((pair) => pair.annotation.id === current.annotation.id);
            if (still === void 0) return null;
            const rect = still.chip.getBoundingClientRect();
            const next = {
              left: Math.round(rect.left),
              top: Math.round(rect.top),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            };
            if (current.anchor.left === next.left && current.anchor.top === next.top && current.anchor.width === next.width && current.anchor.height === next.height) {
              return current;
            }
            return { annotation: current.annotation, anchor: next };
          });
        };
        document.addEventListener("mouseover", onPointer, true);
        document.addEventListener("scroll", reposition, true);
        window.addEventListener("resize", reposition);
        const onClick = (event) => {
          const chip = chipOf(event);
          if (chip === null) return;
          const annotation = pairs().find((pair) => pair.chip === chip)?.annotation;
          if (annotation === void 0) return;
          event.preventDefault();
          event.stopPropagation();
          actionsRef.current.onJump(annotation);
        };
        document.addEventListener("click", onClick, true);
        return () => {
          if (frame !== 0) cancelAnimationFrame(frame);
          clearTimeout(timer);
          if (closeTimer !== 0) clearTimeout(closeTimer);
          observer.disconnect();
          document.removeEventListener("mouseover", onPointer, true);
          document.removeEventListener("scroll", reposition, true);
          window.removeEventListener("resize", reposition);
          document.removeEventListener("click", onClick, true);
          for (const chip of [...marked]) unmark(chip);
        };
      }, [annotations, occurrences, labels]);
      if (hover === null) return null;
      const GLYPH_CENTRE = 7 + 13 / 2;
      const REMOVE_SIZE = 15;
      return (0, import_react_dom2.createPortal)(
        h3(
          import_react4.default.Fragment,
          null,
          h3(
            "button",
            {
              type: "button",
              className: "qc-chip-remove",
              title: labels.remove,
              "aria-label": labels.remove,
              style: {
                left: `${hover.anchor.left + GLYPH_CENTRE}px`,
                top: `${hover.anchor.top + hover.anchor.height / 2}px`,
                width: `${REMOVE_SIZE}px`,
                height: `${REMOVE_SIZE}px`
              },
              onMouseDown: (event) => event.preventDefault(),
              onClick: (event) => {
                event.preventDefault();
                event.stopPropagation();
                setHover(null);
                onRemove(hover.annotation);
              }
            },
            // Two diagonal strokes on a 10×10 grid, meeting at the exact centre (5,5).
            // Drawn rather than typed so it is centred by construction.
            h3(
              "svg",
              { viewBox: "0 0 10 10", "aria-hidden": "true", focusable: "false" },
              h3("path", { d: "M2.6 2.6 L7.4 7.4 M7.4 2.6 L2.6 7.4" })
            )
          ),
          h3(AnnotationCard2, {
            annotation: hover.annotation,
            anchor: hover.anchor,
            closing: hover.closing === true
          })
        ),
        document.body
      );
    }
    function AnnotationCard2(props) {
      const { annotation, anchor, closing = false } = props;
      const ref = import_react4.default.useRef(null);
      const [size, setSize] = import_react4.default.useState({ width: 0, height: 0 });
      import_react4.default.useLayoutEffect(() => {
        const element = ref.current;
        if (element === null) return;
        const box = element.getBoundingClientRect();
        setSize({ width: box.width, height: box.height });
      }, [annotation.id]);
      const width = size.width || 280;
      const height = size.height || 140;
      const above = anchor.top - height - 8;
      const top = above >= VIEWPORT_MARGIN2 ? above : anchor.top + anchor.height + 8;
      const left = Math.min(
        Math.max(VIEWPORT_MARGIN2, anchor.left),
        Math.max(VIEWPORT_MARGIN2, window.innerWidth - width - VIEWPORT_MARGIN2)
      );
      return h3(
        "div",
        {
          ref,
          // The closing class runs the exit animation; the parent keeps the card
          // mounted for CARD_EXIT_MS so it can finish.
          className: closing ? "qc-card qc-card-out" : "qc-card",
          style: {
            left: `${left}px`,
            top: `${top}px`,
            visibility: size.width === 0 ? "hidden" : "visible"
          }
        },
        annotation.comment === "" ? null : h3("div", { className: "qc-card-comment" }, annotation.comment),
        h3(
          "div",
          { className: "qc-card-body" },
          annotation.kind === "table" ? h3("div", { dangerouslySetInnerHTML: { __html: tableHtml(annotation.text) } }) : h3("div", { dangerouslySetInnerHTML: { __html: annotation.previewHtml ?? "" } })
        )
      );
    }
    return { ChipCards: ChipCards2, AnnotationCard: AnnotationCard2 };
  }

  // src/ui/markers.js
  var import_react5 = __toESM(require("react"), 1);
  var import_react_dom3 = require("react-dom");
  var h4 = import_react5.default.createElement;
  var VIEWPORT_MARGIN3 = 8;
  var BUBBLE_CLEARANCE = 30;
  var BUBBLE_PANEL_WIDTH = 320;
  var BUBBLE_PANEL_HEIGHT = 200;
  function createMarkerLayer({ findFlow, columnElement, anchorAboveBubble }) {
    function chipOrdinals(occurrences) {
      const ordinals = /* @__PURE__ */ new Map();
      if (typeof document === "undefined") return ordinals;
      const refs = occurrences.filter((item) => item.source === CHIP_SOURCE).map((item) => item.ref);
      const chips = [...document.querySelectorAll('[data-composer-chip="quote-chat"]')].filter((element) => element.closest("[data-sidebar-right-tab]") === null);
      for (let index = 0; index < chips.length && index < refs.length; index += 1) {
        ordinals.set(refs[index], index + 1);
      }
      return ordinals;
    }
    function composerContainer2() {
      if (typeof document === "undefined") return null;
      const selectors = [
        '[data-slot="conversation.composer.dock"]',
        '[data-slot="conversation.input.dock"]',
        "[data-composer-root]",
        '[contenteditable="true"]'
      ];
      for (const selector of selectors) {
        for (const element of document.querySelectorAll(selector)) {
          if (element.closest("[data-sidebar-right-tab]") !== null) continue;
          if (element.getClientRects().length > 0) {
            return element.closest("[data-composer-root]") ?? element.parentElement ?? element;
          }
        }
      }
      return null;
    }
    const columnCache = /* @__PURE__ */ new WeakMap();
    const containerCache = /* @__PURE__ */ new WeakMap();
    function BubblePanel(props) {
      const { annotation, anchor, labels, onSave, onDelete, onClose, inFlow = false, rel = null } = props;
      const [text, setText] = import_react5.default.useState(annotation.comment);
      const [touched, setTouched] = import_react5.default.useState(false);
      const [flash, setFlash] = import_react5.default.useState("");
      const ref = import_react5.default.useRef(null);
      const areaRef = import_react5.default.useRef(null);
      const [size, setSize] = import_react5.default.useState({ width: 0, height: 0 });
      import_react5.default.useLayoutEffect(() => {
        const element = ref.current;
        if (element === null) return;
        const box = element.getBoundingClientRect();
        setSize({ width: box.width, height: box.height });
        areaRef.current?.focus();
      }, []);
      import_react5.default.useEffect(() => {
        const onDown = (event) => {
          const target = event.target;
          if (!(target instanceof Node)) return;
          if (ref.current !== null && ref.current.contains(target)) return;
          if (isInsideTranscript(target) === false) return;
          onClose();
        };
        const onKey = (event) => {
          if (event.key === "Escape") onClose();
        };
        document.addEventListener("mousedown", onDown, true);
        document.addEventListener("keydown", onKey, true);
        return () => {
          document.removeEventListener("mousedown", onDown, true);
          document.removeEventListener("keydown", onKey, true);
        };
      }, [onClose]);
      const width = size.width || 320;
      const height = size.height || 200;
      const rightEdge = rel !== null && rel.right !== void 0 ? rel.right : null;
      const left = rel !== null ? rel.left : inFlow ? Math.max(0, anchor.width - width) : Math.min(
        Math.max(VIEWPORT_MARGIN3, anchor.left),
        Math.max(VIEWPORT_MARGIN3, window.innerWidth - width - VIEWPORT_MARGIN3)
      );
      const measured = height > 0 ? height : 0;
      const anchoredTop = rel !== null ? rel.bubbleTop === void 0 ? rel.top : rel.bubbleTop - rel.gap - (measured || rel.gap) : inFlow ? -(height + BUBBLE_CLEARANCE) : Math.min(
        Math.max(VIEWPORT_MARGIN3, anchor.top),
        Math.max(VIEWPORT_MARGIN3, window.innerHeight - height - VIEWPORT_MARGIN3)
      );
      const hasText = touched === true;
      const bandTop = rel === null || rel.bandTop === void 0 ? 0 : rel.bandTop;
      const bandBottom = rel === null || rel.bandBottom === void 0 ? 0 : rel.bandBottom;
      const panelHeight = measured || rel?.gap || 0;
      const anchoredBottom = anchoredTop + panelHeight;
      const fullyVisible = rel !== null && rel.bubbleTop !== void 0 && anchoredTop >= bandTop - 1 && anchoredBottom <= bandBottom + 1;
      const docks = rel !== null && rel.bubbleTop !== void 0 && hasText && fullyVisible === false;
      const dockTop = bandTop;
      const dockBottom = Math.max(bandTop, bandBottom - panelHeight);
      const dockedEdge = docks === false ? null : Math.abs(anchoredTop - dockTop) <= Math.abs(dockBottom - anchoredTop) ? "top" : "bottom";
      const clampedTop = docks === false ? anchoredTop : dockedEdge === "top" ? dockTop : Math.min(dockBottom, Math.max(bandTop, bandBottom - (measured || 0)));
      const commit = () => {
        setFlash(labels.saved);
        setTimeout(() => onSave(text), 160);
      };
      return h4(
        "div",
        {
          ref,
          // Plugin chrome: the passage highlight must never paint over the editor, and
          // text readers must skip it. Both are keyed off this attribute.
          "data-qc-ignore": "1",
          className: "qc-bubble-panel",
          role: "dialog",
          "aria-label": labels.edit,
          style: rightEdge !== null ? {
            right: `${rightEdge}px`,
            top: `${clampedTop}px`,
            visibility: size.width === 0 ? "hidden" : "visible"
          } : {
            left: `${left}px`,
            top: `${clampedTop}px`,
            visibility: size.width === 0 ? "hidden" : "visible"
          },
          // Same docking marker the compose panel uses, so the stylesheet can animate a move only when one is happening.
          "data-docked": dockedEdge === null ? "false" : dockedEdge
        },
        // No passage preview and no jump button: the passage is already lit in the
        // transcript behind this panel, which is a better answer than a truncated
        // copy of it, and jumping is folded into opening the panel.
        h4("div", { className: "qc-bp-label" }, labels.comment),
        h4("textarea", {
          ref: areaRef,
          value: text,
          placeholder: labels.bubblePlaceholder,
          spellCheck: false,
          onChange: (event) => {
            setTouched(event.target.value.trim() !== "");
            setText(event.target.value);
          },
          onKeyDown: (event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              commit();
            }
          }
        }),
        h4(
          "div",
          { className: "qc-bp-actions" },
          h4("button", {
            type: "button",
            className: "qc-bp-delete",
            onClick: () => {
              setFlash(labels.deleted);
              onDelete();
            }
          }, labels.delete),
          h4("button", {
            type: "button",
            className: "qc-bp-save",
            onClick: commit
          }, labels.save)
        ),
        flash === "" ? null : h4("span", {
          className: "qc-bp-done",
          style: { left: `${left}px`, top: `${clampedTop + height + 6}px` }
        }, flash)
      );
    }
    function samePositions(left, right) {
      if (left.length !== right.length) return false;
      for (let index = 0; index < left.length; index += 1) {
        const a = left[index];
        const b = right[index];
        if (a.id !== b.id || a.row !== b.row || a.number !== b.number) return false;
      }
      return true;
    }
    function rowOf(range, flow) {
      const element = elementOf(range.startContainer);
      if (element === null) return null;
      const block = element.closest(BLOCK_SELECTOR);
      if (block !== null && block !== flow && flow.contains(block)) return block;
      const row = element.closest("[data-chat-node-key]");
      if (row !== null) return row;
      let ancestor = element;
      while (ancestor !== null) {
        if (ancestor !== flow && ancestor.getClientRects().length > 0) return ancestor;
        ancestor = ancestor.parentElement;
      }
      return null;
    }
    function MarkerLayer2(props) {
      const { annotations, occurrences, labels, onJump, onHighlight, onUpdate, onRemove } = props;
      const [positions, setPositions] = import_react5.default.useState([]);
      const [editing, setEditing] = import_react5.default.useState(null);
      const [bubbleTick, setBubbleTick] = import_react5.default.useState(0);
      const editingId = editing === null ? null : editing.id;
      import_react5.default.useEffect(() => {
        if (editingId === null || editingId === void 0) return void 0;
        let frame = 0;
        let primed = false;
        let lastKey = null;
        const watch = () => {
          frame = window.requestAnimationFrame(watch);
          const bubble = document.querySelector(`.qc-marker[data-qc-for="${editingId}"]`);
          if (bubble === null) return;
          const box = bubble.getBoundingClientRect();
          const key = `${Math.round(box.top)}:${Math.round(box.left)}`;
          if (primed === false) {
            primed = true;
            lastKey = key;
            return;
          }
          if (key === lastKey) return;
          lastKey = key;
          setBubbleTick((tick) => tick + 1);
        };
        frame = window.requestAnimationFrame(watch);
        return () => {
          if (frame !== 0) window.cancelAnimationFrame(frame);
        };
      }, [editingId]);
      import_react5.default.useEffect(() => {
        if (typeof document === "undefined") return void 0;
        let frame = 0;
        let timer = 0;
        let measured = [];
        const measure = () => {
          frame = 0;
          const flow2 = findFlow();
          if (flow2 === null) {
            measured = [];
            setPositions((current) => current.length === 0 ? current : []);
            return;
          }
          const ordinals = chipOrdinals(occurrences);
          const next = [];
          for (const annotation of annotations) {
            const number = ordinals.get(annotation.id);
            if (number === void 0) continue;
            const range = resolveAnchor(flow2, annotation.anchor);
            if (range === null) continue;
            const row = rowOf(range, flow2);
            if (row === null) continue;
            next.push({
              id: annotation.id,
              row,
              // The base class is already the blue bubble; only tables recolour.
              tone: annotation.kind === "table" ? "qc-marker-table" : "",
              number,
              title: labels.jump.replace("{n}", String(number))
            });
          }
          measured = next;
          publish(next);
        };
        const publish = (next) => {
          setPositions((current) => samePositions(current, next) ? current : next);
        };
        const reflow = () => {
          frame = 0;
          if (measured.length === 0) return;
          publish(measured);
        };
        const schedule = () => {
          if (frame !== 0) return;
          frame = requestAnimationFrame(measure);
        };
        const onColumnResize = () => {
          schedule();
        };
        schedule();
        const debounced = () => {
          clearTimeout(timer);
          timer = setTimeout(schedule, 80);
        };
        const observer = new MutationObserver(debounced);
        const flow = findFlow();
        if (flow !== null) observer.observe(flow, { childList: true, subtree: true });
        let columnObserver = null;
        const watchColumn = () => {
          const flow2 = findFlow();
          const target = flow2 === null ? null : columnElement(flow2);
          if (target === null) return;
          if (columnObserver !== null && columnObserver.__qcTarget === target) return;
          if (columnObserver !== null) columnObserver.disconnect();
          if (typeof ResizeObserver !== "function") return;
          columnObserver = new ResizeObserver(onColumnResize);
          columnObserver.__qcTarget = target;
          columnObserver.observe(target);
        };
        watchColumn();
        let lastRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
        const onWindowResize = () => {
          const ratio = window.devicePixelRatio || 1;
          const zoomed = ratio !== lastRatio;
          lastRatio = ratio;
          if (zoomed) {
          }
          schedule();
        };
        window.addEventListener("resize", onWindowResize);
        if (window.visualViewport !== void 0 && window.visualViewport !== null) {
          window.visualViewport.addEventListener("resize", onWindowResize);
        }
        return () => {
          if (frame !== 0) cancelAnimationFrame(frame);
          clearTimeout(timer);
          window.removeEventListener("resize", onWindowResize);
          if (window.visualViewport !== void 0 && window.visualViewport !== null) {
            window.visualViewport.removeEventListener("resize", onWindowResize);
          }
          observer.disconnect();
          if (columnObserver !== null) columnObserver.disconnect();
        };
      }, [annotations, occurrences, labels]);
      import_react5.default.useEffect(() => {
        if (typeof document === "undefined") return;
        for (const position of positions) {
          const row = position.row;
          if (row === void 0 || !row.isConnected) continue;
          if (row.dataset.qcHost === "1") continue;
          if (getComputedStyle(row).position === "static") row.style.position = "relative";
          row.classList.add("qc-hosts-bubble");
          row.dataset.qcHost = "1";
        }
      }, [positions]);
      if (typeof document === "undefined") return null;
      if (positions.length === 0 && editing === null) return null;
      const nodes = [];
      for (const position of positions) {
        const row = position.row;
        if (row === void 0 || !row.isConnected) continue;
        nodes.push((0, import_react_dom3.createPortal)(h4("button", {
          key: position.id,
          type: "button",
          "data-qc-ignore": "1",
          // The ordinal is drawn by CSS from this attribute rather than being a text
          // node. A real text node inside the paragraph joins its textContent AND gets
          // painted by CSS.highlights when the passage is lit - which is how the
          // fluorescent marker ended up covering the bubble's own number.
          "data-qc-number": String(position.number),
          // Stable handle for the annotation this bubble stands for. The editor is
          // positioned against this exact bubble.
          "data-qc-for": position.id,
          className: "qc-marker " + position.tone + (editing !== null && editing.id === position.id ? " qc-marker-active" : ""),
          title: position.title,
          "aria-label": position.title,
          onClick: () => {
            const annotation = annotations.find((item) => item.id === position.id);
            if (annotation === void 0) return;
            const already = editing !== null && editing.id === position.id;
            setEditing(already ? null : { id: position.id, row });
            if (!already) onHighlight(annotation, true);
            else onHighlight(annotation, false);
          }
        }), row));
      }
      const editor = editing === null ? null : (() => {
        const annotation = annotations.find((item) => item.id === editing.id);
        if (annotation === void 0) return null;
        const row = editing.row;
        const flow = findFlow();
        const bubble = row !== void 0 && row !== null && row.isConnected ? row.querySelector('.qc-marker[data-qc-for="' + editing.id + '"]') : null;
        const box = bubble === null || bubble === void 0 ? row !== void 0 && row !== null && row.isConnected ? row.getBoundingClientRect() : null : bubble.getBoundingClientRect();
        const anchored = flow === null || box === null ? null : anchorAboveBubble(flow, box, {
          width: BUBBLE_PANEL_WIDTH,
          // Assumed height for the first paint. The panel reports its real size after
          // mounting, and the bottom-edge offset uses that measurement from then on.
          height: BUBBLE_PANEL_HEIGHT
        });
        return (0, import_react_dom3.createPortal)(h4(BubblePanel, {
          annotation,
          rel: anchored === null ? null : anchored.position,
          // Fallback geometry for the case where there is no transcript to anchor to.
          anchor: {
            left: box === null ? 0 : Math.min(box.right, window.innerWidth - 40),
            top: box === null ? 0 : box.top,
            bottom: box === null ? 0 : box.bottom,
            width: box === null ? 0 : box.width
          },
          labels,
          onJump: () => {
            setEditing(null);
            onHighlight(annotation, false);
            onJump(annotation);
          },
          onSave: (comment) => {
            setEditing(null);
            onHighlight(annotation, false);
            onUpdate(annotation, comment);
          },
          onDelete: () => {
            setEditing(null);
            onHighlight(annotation, false);
            onRemove(annotation);
          },
          onClose: () => {
            setEditing(null);
            onHighlight(annotation, false);
          }
        }), anchored === null ? document.body : anchored.scroller);
      })();
      return h4(import_react5.default.Fragment, null, ...nodes, editor);
    }
    return { MarkerLayer: MarkerLayer2 };
  }

  // src/ui/side-chat.js
  var import_react7 = __toESM(require("react"), 1);

  // src/ui/draft-hooks.js
  var import_react6 = __toESM(require("react"), 1);
  function useDraft(useInput, fallback = "") {
    const inert = (selector) => selector({ draft: fallback });
    return (typeof useInput === "function" ? useInput : inert)(
      (state) => state.draft,
      (left, right) => left === right
    );
  }
  function useDraftOccurrences(useInput) {
    const empty = import_react6.default.useMemo(() => [], []);
    const inert = () => empty;
    const picked = (typeof useInput === "function" ? useInput : inert)(
      (state) => state.occurrences,
      (left, right) => left === right
    );
    return Array.isArray(picked) ? picked : empty;
  }

  // src/ui/side-chat.js
  var h5 = import_react7.default.createElement;
  function createSideChat({ quoteForTab }) {
    function SideChat2(props) {
      const { quote, t, locale, inputActions, useInput } = props;
      const draft = useDraft(useInput);
      const [messages, setMessages] = import_react7.default.useState([]);
      const [question, setQuestion] = import_react7.default.useState("");
      const [busy, setBusy] = import_react7.default.useState(false);
      const [error, setError] = import_react7.default.useState("");
      const [expanded, setExpanded] = import_react7.default.useState(false);
      const [added, setAdded] = import_react7.default.useState(false);
      const abortRef = import_react7.default.useRef(null);
      const threadRef = import_react7.default.useRef(null);
      import_react7.default.useEffect(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        setMessages([]);
        setQuestion("");
        setError("");
        setBusy(false);
        setAdded(false);
      }, [quote]);
      import_react7.default.useEffect(() => () => {
        abortRef.current?.abort();
      }, []);
      const scrollToEnd = import_react7.default.useCallback(() => {
        const element = threadRef.current;
        if (element !== null) element.scrollTop = element.scrollHeight;
      }, []);
      import_react7.default.useEffect(scrollToEnd, [messages, scrollToEnd]);
      const submit = import_react7.default.useCallback(async () => {
        const text = question.trim();
        if (text === "" || busy) return;
        const history = messages.filter((message) => message.text.trim() !== "").map((message) => ({ role: message.role, text: message.text }));
        const replayed = [];
        for (let index = 0; index < history.length; index += 1) {
          const current = history[index];
          const next = history[index + 1];
          if (current.role === "user" && next !== void 0 && next.role === "assistant") {
            replayed.push({ question: current.text, answer: next.text });
            index += 1;
          }
        }
        setMessages((current) => [...current, { role: "user", text }, { role: "assistant", text: "" }]);
        setQuestion("");
        setError("");
        setBusy(true);
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          await askSideChat({ quote, question: text, history: replayed, locale }, controller.signal, (delta) => {
            setMessages((current) => {
              const copy = current.slice();
              const last = copy.length - 1;
              if (last < 0) return current;
              copy[last] = { role: "assistant", text: copy[last].text + delta };
              return copy;
            });
          });
        } catch (failure) {
          if (controller.signal.aborted) {
            setMessages((current) => {
              const copy = current.slice();
              const last = copy.length - 1;
              if (last >= 0 && copy[last].role === "assistant" && copy[last].text === "") copy.pop();
              return copy;
            });
          } else {
            setError(failure instanceof Error ? failure.message : String(failure));
          }
        } finally {
          if (abortRef.current === controller) abortRef.current = null;
          setBusy(false);
        }
      }, [question, busy, messages, quote, locale]);
      const stop = import_react7.default.useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        setBusy(false);
      }, []);
      const addToChat = import_react7.default.useCallback((text) => {
        const payload = text.split(/\r?\n/).map((line) => line === "" ? ">" : `> ${line}`).join("\n");
        const current = typeof draft === "string" ? draft : "";
        if (typeof inputActions?.captureInsertion === "function" && typeof inputActions?.insertText === "function") {
          const span = inputActions.captureInsertion();
          if (inputActions.insertText(`${payload}

  `, span) === true) {
            setAdded(true);
            return;
          }
        }
        if (typeof inputActions?.setDraft === "function") {
          inputActions.setDraft(current.trim() === "" ? payload : `${current}

  ${payload}`);
          setAdded(true);
        }
      }, [draft, inputActions]);
      import_react7.default.useEffect(() => {
        if (!added) return void 0;
        const timer = setTimeout(() => setAdded(false), 2200);
        return () => clearTimeout(timer);
      }, [added]);
      const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant" && message.text !== "");
      const lastQuestion = [...messages].reverse().find((message) => message.role === "user");
      return h5(
        "div",
        { className: "qc-side" },
        h5(
          "div",
          { className: "qc-side-head" },
          h5("span", { className: "qc-side-head-title" }, t("side.title")),
          messages.length > 0 ? h5("button", {
            type: "button",
            onClick: () => {
              setMessages([]);
              setError("");
              setAdded(false);
            }
          }, t("side.clear")) : null
        ),
        h5(
          "div",
          { className: "qc-quote" },
          h5(
            "div",
            { className: "qc-quote-label" },
            h5("span", null, t("side.quote")),
            quote.length > 260 ? h5("button", {
              type: "button",
              onClick: () => setExpanded((value) => !value)
            }, expanded ? t("side.collapseQuote") : t("side.expandQuote")) : null
          ),
          h5("div", { className: `qc-quote-body${expanded ? "" : " qc-clamped"}` }, quote)
        ),
        h5(
          "div",
          { ref: threadRef, className: "qc-thread" },
          messages.length === 0 ? h5("div", { className: "qc-empty" }, t("side.empty")) : messages.map((message, index) => h5(
            "div",
            {
              key: `${index}-${message.role}`,
              className: `qc-msg qc-msg-${message.role}`
            },
            h5(
              "div",
              { className: "qc-msg-role" },
              message.role === "user" ? t("side.you") : t("side.assistant")
            ),
            h5(
              "div",
              { className: "qc-msg-body" },
              message.text === "" && busy && index === messages.length - 1 ? h5("span", { className: "qc-dots" }) : message.text
            ),
            message.role === "assistant" && message.text !== "" ? h5(
              "div",
              { className: "qc-msg-actions" },
              h5("button", {
                type: "button",
                onClick: () => addToChat(message.text)
              }, t("side.addToChat"))
            ) : null
          )),
          error === "" ? null : h5("div", { className: "qc-msg-error" }, `${t("side.errorPrefix")}${error}`)
        ),
        h5(
          "div",
          { className: "qc-side-compose" },
          h5("textarea", {
            value: question,
            placeholder: t("side.placeholder"),
            rows: 2,
            onChange: (event) => setQuestion(event.target.value),
            onKeyDown: (event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent?.isComposing) {
                event.preventDefault();
                submit();
              }
            }
          }),
          h5(
            "div",
            { className: "qc-side-compose-row" },
            h5("span", { className: "qc-side-compose-hint" }, added ? t("side.added") : ""),
            lastAssistant !== void 0 ? h5("button", {
              type: "button",
              className: "qc-btn qc-btn-ghost",
              onClick: () => addToChat(
                `> ${lastQuestion === void 0 ? "" : lastQuestion.text}

  ${lastAssistant.text}`
              )
            }, t("side.addToChat")) : null,
            busy ? h5("button", { type: "button", className: "qc-btn qc-btn-ghost", onClick: stop }, t("side.stop")) : h5("button", {
              type: "button",
              className: "qc-btn",
              disabled: question.trim() === "",
              onClick: submit
            }, t("side.send"))
          )
        )
      );
    }
    function SideChatTab2(props) {
      const { useTabInfo, inputActions, useInput, t, pluginCtx } = props;
      const info = typeof useTabInfo === "function" ? useTabInfo() : void 0;
      const quote = quoteForTab(info?.tab?.navigation?.params?.quote);
      const localeService = pluginCtx?.locale;
      const locale = import_react7.default.useSyncExternalStore(
        import_react7.default.useCallback(
          (listener) => typeof localeService?.subscribe === "function" ? localeService.subscribe(listener) : () => {
          },
          [localeService]
        ),
        import_react7.default.useCallback(
          () => typeof localeService?.getLocale === "function" ? localeService.getLocale().active : "zh",
          [localeService]
        ),
        import_react7.default.useCallback(() => "zh", [])
      );
      if (quote === "") {
        return h5(
          "div",
          { className: "qc-side" },
          h5(
            "div",
            { className: "qc-quote" },
            h5("div", { className: "qc-quote-body" }, t("side.noQuote"))
          )
        );
      }
      return h5(SideChat2, { quote, t, locale: locale === "en" ? "en" : "zh", inputActions, useInput });
    }
    return { SideChat: SideChat2, SideChatTab: SideChatTab2 };
  }

  // src/ui/dock.js
  var import_react8 = __toESM(require("react"), 1);
  var import_react_dom4 = require("react-dom");
  var h6 = import_react8.default.createElement;
  function annotationDock(deps) {
    const {
      ctx,
      annotations,
      chips,
      highlights,
      navigation: navigation2,
      quoteHandoff: quoteHandoff2,
      surfaces,
      selection,
      limits,
      t: boundT
    } = deps;
    const {
      useAnnotations: useAnnotations2,
      store: annotationStore2
    } = annotations;
    const { add: addAnnotation, remove: removeAnnotation, update: updateAnnotation } = annotationStore2;
    const { registry: chipRegistry2, bridge: chipBridge2, jumpHandler: chipJumpHandler2 } = chips;
    const {
      flash: flashRange,
      clear: clearFlashRange,
      hold: holdRange
    } = highlights;
    const {
      ActionPopup: ActionPopup2,
      ComposerPopover: ComposerPopover2,
      ChipCards: ChipCards2,
      MarkerLayer: MarkerLayer2,
      TableAddButton: TableAddButton2
    } = surfaces;
    const {
      readSelection: readSelection2,
      clearSelection: clearSelection2,
      tableToMarkdown: tableToMarkdown2,
      tableAnchor: tableAnchor2,
      diagnoseMiss: diagnoseMiss2,
      findFlow
    } = selection;
    const { MAX_QUOTE_CHARS: MAX_QUOTE_CHARS2, MAX_ANNOTATIONS: MAX_ANNOTATIONS2, TAB_KIND: TAB_KIND2 } = limits;
    return function AnnotationDock(props) {
      const { inputActions, useInput, sessionId } = props;
      const t = typeof props.t === "function" ? props.t : boundT;
      const draft = useDraft(useInput);
      const occurrences = useDraftOccurrences(useInput);
      const inputStateRef = import_react8.default.useRef(null);
      inputStateRef.current = { draft, occurrences };
      const annotations2 = useAnnotations2(sessionId);
      const [overlay, setOverlay] = import_react8.default.useState(null);
      const [notice, setNotice] = import_react8.default.useState("");
      const overlayRef = import_react8.default.useRef(null);
      overlayRef.current = overlay;
      const labels = import_react8.default.useMemo(() => ({
        annotate: t("popup.annotate"),
        askInSide: t("popup.askInSide"),
        tooLong: t("popup.tooLong"),
        unavailable: t("popup.unavailable"),
        title: t("compose.title"),
        placeholder: t("compose.placeholder"),
        selected: t("compose.selected"),
        table: t("compose.table"),
        confirm: t("compose.confirm"),
        cancel: t("compose.cancel"),
        hint: t("compose.hint"),
        content: t("card.content"),
        remove: t("card.remove"),
        count: t("card.count"),
        clear: t("card.clear"),
        missing: t("card.missing"),
        limit: t("card.limit"),
        jump: t("marker.jump"),
        tableAdd: t("table.add"),
        edit: t("bubble.edit"),
        comment: t("bubble.comment"),
        saved: t("bubble.saved"),
        deleted: t("bubble.deleted"),
        /** Bubble-editor placeholder. The compose box keeps `placeholder`;
         * a duplicate key here silently overrode it, so the compose box was showing
         * the bubble's hint. */
        bubblePlaceholder: t("bubble.placeholder"),
        save: t("bubble.save"),
        delete: t("bubble.delete")
      }), [t]);
      import_react8.default.useEffect(() => {
        if (overlay === null) return void 0;
        const onPointerDown = (event) => {
          const surface = document.querySelector(".qc-popup, .qc-compose");
          if (surface !== null && surface.contains(event.target)) return;
          if (!isInsideTranscript(event.target)) return;
          cancelCompose();
        };
        const onKeyDown = (event) => {
          if (event.key === "Escape") cancelCompose();
        };
        document.addEventListener("mousedown", onPointerDown, true);
        document.addEventListener("keydown", onKeyDown, true);
        return () => {
          document.removeEventListener("mousedown", onPointerDown, true);
          document.removeEventListener("keydown", onKeyDown, true);
        };
      }, [overlay === null]);
      import_react8.default.useEffect(() => {
        if (typeof document === "undefined") return void 0;
        let frame = 0;
        let pointerDown = false;
        let releasePoint = null;
        const evaluate = () => {
          frame = 0;
          if (overlayRef.current !== null) return;
          if (pointerDown) return;
          const next = readSelection2(releasePoint);
          if (next === null) {
            setOverlay((current) => current === null || current.kind === "actions" ? null : current);
            return;
          }
          if (next.text.length > MAX_QUOTE_CHARS2) {
            setNotice(labels.tooLong.replace("{max}", String(MAX_QUOTE_CHARS2)));
            setOverlay(null);
            return;
          }
          setOverlay({ kind: "actions", source: next });
        };
        const schedule = () => {
          if (frame !== 0) return;
          frame = requestAnimationFrame(evaluate);
        };
        const isPrimary = (event) => {
          const button = event?.button;
          return typeof button !== "number" || button === 0;
        };
        const onDown = (event) => {
          if (!isPrimary(event)) return;
          pointerDown = true;
          releasePoint = null;
        };
        const onUp = (event) => {
          pointerDown = false;
          if (!isPrimary(event)) return;
          if (typeof event?.clientX === "number" && typeof event?.clientY === "number") {
            releasePoint = { x: event.clientX, y: event.clientY };
          } else {
            releasePoint = null;
          }
          schedule();
        };
        document.addEventListener("pointerdown", onDown, true);
        document.addEventListener("mousedown", onDown, true);
        document.addEventListener("pointerup", onUp, true);
        document.addEventListener("mouseup", onUp, true);
        document.addEventListener("keyup", schedule, true);
        document.addEventListener("selectionchange", schedule);
        return () => {
          if (frame !== 0) cancelAnimationFrame(frame);
          document.removeEventListener("pointerdown", onDown, true);
          document.removeEventListener("mousedown", onDown, true);
          document.removeEventListener("pointerup", onUp, true);
          document.removeEventListener("mouseup", onUp, true);
          document.removeEventListener("keyup", schedule, true);
          document.removeEventListener("selectionchange", schedule);
        };
      }, [labels]);
      import_react8.default.useEffect(() => {
        if (notice === "") return void 0;
        const timer = setTimeout(() => setNotice(""), 3200);
        return () => clearTimeout(timer);
      }, [notice]);
      import_react8.default.useEffect(() => () => clearFlashRange(), []);
      const writeChip = import_react8.default.useCallback((annotation) => chipBridge2.place(
        inputActions,
        () => ({ draft, occurrences: inputStateRef.current?.occurrences }),
        annotation,
        labels
      ), [draft, inputActions, labels]);
      const cancelCompose = import_react8.default.useCallback(() => {
        clearFlashRange();
        setOverlay(null);
      }, []);
      const commit = import_react8.default.useCallback((source, comment) => {
        if (sessionId === void 0) return;
        const text = typeof comment === "string" ? comment.trim() : "";
        const stored = addAnnotation(sessionId, {
          kind: source.kind,
          text: source.text,
          previewText: source.previewText,
          // The captured markup is what the card replays. It used to be stored
          // under `html` while the card read `previewHtml`, so every card body
          // came out blank — the "content is not rendered" symptom.
          previewHtml: source.kind === "table" ? "" : source.previewHtml,
          // A table is annotatable too: the requirement asks for a comment box
          // on tables, so its comment is kept like any other.
          comment: text,
          anchor: source.anchor
        });
        if (stored === null) {
          setNotice(labels.limit.replace("{max}", String(MAX_ANNOTATIONS2)));
          return;
        }
        if (!writeChip(stored)) setNotice(labels.unavailable);
        setOverlay(null);
        clearSelection2();
        const flow = findFlow();
        const range = flow === null ? null : resolveAnchor(flow, stored.anchor);
        if (range !== null) flashRange(range);
      }, [sessionId, labels, writeChip]);
      const annotateTable = import_react8.default.useCallback((table) => {
        const markdown = tableToMarkdown2(table);
        if (markdown === "") return;
        const flow = findFlow();
        setOverlay({
          kind: "compose",
          source: {
            kind: "table",
            text: markdown,
            previewHtml: "",
            previewText: markdown,
            rect: table.getBoundingClientRect(),
            rows: table.rows.length,
            anchor: flow === null ? { nodeKey: "", offset: 0, quote: "" } : tableAnchor2(flow, table)
          }
        });
        clearSelection2();
      }, []);
      const onHighlight = import_react8.default.useCallback((annotation, on) => {
        const flow = findFlow();
        if (flow === null) return;
        if (!on) {
          clearFlashRange();
          return;
        }
        const range = resolveAnchor(flow, annotation.anchor);
        if (range === null) return;
        holdRange(range, () => {
          const live = findFlow();
          return live === null ? null : resolveAnchor(live, annotation.anchor);
        });
      }, []);
      const onJump = import_react8.default.useCallback((annotation) => {
        const flow = findFlow();
        if (flow === null) {
          setNotice(diagnoseMiss2(null, annotation));
          return;
        }
        setNotice("");
        navigation2.reveal(flow, annotation).then((range) => {
          if (range === null) {
            setNotice(diagnoseMiss2(findFlow(), annotation));
            return;
          }
          flashRange(range, FLASH_MS, () => {
            const live = findFlow();
            return live === null ? null : resolveAnchor(live, annotation.anchor);
          });
        }, (failure) => {
          console.error("[dsh-quote-chat] jump failed:", failure);
          setNotice(diagnoseMiss2(findFlow(), annotation));
        });
      }, []);
      import_react8.default.useEffect(() => {
        chipJumpHandler2.current = (ref) => {
          const match = annotations2.find((item) => item.id === ref);
          if (match === void 0) return false;
          onJump(match);
          return true;
        };
        return () => {
          if (chipJumpHandler2.current !== null) chipJumpHandler2.current = null;
        };
      }, [annotations2, onJump]);
      const onRemove = import_react8.default.useCallback((annotation) => {
        if (sessionId === void 0) return;
        chipBridge2.release(
          inputActions,
          () => ({ draft, occurrences: inputStateRef.current?.occurrences }),
          annotation.id
        );
        removeAnnotation(sessionId, annotation.id);
      }, [draft, inputActions, sessionId]);
      const onUpdate = import_react8.default.useCallback((annotation, comment) => {
        if (sessionId === void 0) return;
        chipRegistry2.updateComment(annotation.id, comment);
        updateAnnotation(sessionId, annotation.id, comment);
      }, [sessionId]);
      const onAsk = import_react8.default.useCallback((source) => {
        const opener = ctx.get("sidebarRight");
        if (typeof opener?.openTab !== "function") return;
        quoteHandoff2.remember(source.text);
        try {
          opener.openTab(TAB_KIND2, {
            params: { quote: source.text, title: t("side.title") },
            revealIfOpened: true
          });
        } catch (failure) {
          console.error("[dsh-quote-chat] side-chat open failed:", failure);
          setNotice(labels.unavailable);
          return;
        }
        setOverlay(null);
        clearSelection2();
      }, [ctx, labels, t]);
      const canAnnotate = typeof inputActions?.setDraft === "function" || typeof inputActions?.captureInsertion === "function" && typeof inputActions?.insertText === "function";
      const canAsk = typeof ctx.get("sidebarRight")?.openTab === "function";
      return h6(
        import_react8.default.Fragment,
        null,
        overlay === null ? null : overlay.kind === "actions" ? h6(ActionPopup2, {
          anchor: overlay.source.rect,
          canAnnotate,
          canAsk,
          labels,
          onAnnotate: () => {
            const source = overlay.source;
            const flow = findFlow();
            if (flow !== null && source.anchor !== void 0) {
              const range = resolveAnchor(flow, source.anchor);
              if (range !== null) {
                holdRange(range, () => {
                  const live = findFlow();
                  return live === null ? null : resolveAnchor(live, source.anchor);
                });
              }
            }
            setOverlay({ kind: "compose", source });
          },
          onAsk: () => onAsk(overlay.source)
        }) : h6(ComposerPopover2, {
          source: overlay.source,
          labels,
          onConfirm: (comment) => commit(overlay.source, comment),
          onCancel: cancelCompose
        }),
        h6(ChipCards2, { annotations: annotations2, occurrences, labels, onJump, onRemove }),
        h6(MarkerLayer2, { annotations: annotations2, occurrences, labels, onJump, onHighlight, onUpdate, onRemove }),
        h6(TableAddButton2, { label: labels.tableAdd, onAdd: annotateTable }),
        typeof notice === "string" && notice !== "" ? h6("div", { className: "qc-notice" }, notice) : null
      );
    };
  }

  // src/registrations.js
  function asEffect(handle) {
    const release = typeof handle === "function" ? handle : handle?.dispose?.bind(handle);
    return () => {
      if (typeof release === "function") release();
    };
  }
  function registerSideChatTab({ ctx, t, TAB_ID: TAB_ID2, TAB_KIND: TAB_KIND2, NS: NS2, SideChatTab: SideChatTab2 }) {
    ctx.effect(() => {
      const handle = ctx.inject(["sidebarRightTabs"], (scope) => {
        const tabs = scope.sidebarRightTabs;
        if (tabs === void 0 || typeof tabs.register !== "function") return;
        const disposers = [];
        try {
          disposers.push(tabs.register({
            id: TAB_ID2,
            kind: TAB_KIND2,
            title: () => t("side.title"),
            guide: [{
              id: "quote-chat",
              order: 55,
              title: () => t("side.title"),
              description: () => t("side.guide")
            }]
          }));
          disposers.push(scope.slots.inject("sidebar.right.pane.tab", () => scope.slots.register({
            name: "sidebar.right.pane.tab",
            key: TAB_ID2,
            locale: NS2,
            inject: () => ({ pluginCtx: ctx })
          }, SideChatTab2)));
        } catch (error) {
          for (const dispose of disposers.splice(0)) dispose();
          console.error("[dsh-quote-chat] right-sidebar registration failed:", error);
          return void 0;
        }
        return () => {
          for (const dispose of disposers.splice(0)) dispose();
        };
      });
      return asEffect(handle);
    }, "quote-chat: side-chat tab type");
  }
  function registerReferenceSource({
    ctx,
    registry,
    jumpHandler,
    CHIP_TRIGGER: CHIP_TRIGGER2,
    CHIP_SOURCE: CHIP_SOURCE2,
    CHIP_PLACEHOLDER: CHIP_PLACEHOLDER2,
    serializeChipForModel: serializeChipForModel2
  }) {
    ctx.effect(() => {
      const handle = ctx.inject(["inputTriggers"], (scope) => {
        const triggers = scope.inputTriggers;
        if (triggers === void 0 || typeof triggers.registerSource !== "function") return void 0;
        return triggers.registerSource({
          trigger: CHIP_TRIGGER2,
          name: CHIP_SOURCE2,
          openReference(_session, reference) {
            const jump = jumpHandler.current;
            if (typeof jump !== "function") return false;
            return jump(reference?.ref) === true;
          },
          codec: {
            clipboardText: () => CHIP_PLACEHOLDER2,
            serialize(ref) {
              const payload = registry.get(ref);
              if (payload === void 0) {
                return Promise.reject(new Error(`quote-chat: unknown chip "${ref}"`));
              }
              return Promise.resolve(serializeChipForModel2(payload));
            }
          }
        });
      });
      return asEffect(handle);
    }, "quote-chat: reference source");
  }
  function registerAnnotationDock({ ctx, NS: NS2, buildDock }) {
    ctx.effect(() => {
      const release = ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
        name: "conversation.input.dock",
        id: "quote-chat-annotations",
        order: 15,
        locale: NS2
      }, buildDock()));
      return () => {
        if (typeof release === "function") release();
      };
    }, "quote-chat: annotation dock");
  }

  // src/ui/table.js
  var import_react9 = __toESM(require("react"), 1);
  var import_react_dom5 = require("react-dom");
  var h7 = import_react9.default.createElement;
  var VIEWPORT_MARGIN4 = 8;
  var TABLE_BUTTON_INSET = 116;
  var TABLE_BUTTON_OFFSET = 4;
  function TableAddButton(props) {
    const { label, onAdd } = props;
    const [target, setTarget] = import_react9.default.useState(null);
    import_react9.default.useEffect(() => {
      if (typeof document === "undefined") return void 0;
      let frame = 0;
      let pending = null;
      const apply2 = () => {
        frame = 0;
        if (pending === null) {
          setTarget((current) => current === null ? current : null);
          return;
        }
        const rect = pending.getBoundingClientRect();
        setTarget((current) => {
          if (current !== null && current.element === pending && current.rect.top === rect.top && current.rect.right === rect.right) return current;
          return { element: pending, rect };
        });
      };
      const schedule = () => {
        if (frame !== 0) return;
        frame = requestAnimationFrame(apply2);
      };
      const onMove = (event) => {
        const element = elementOf(event.target);
        const flow = element?.closest(FLOW_SELECTOR) ?? null;
        const table = flow === null || element === null ? null : element.closest("table");
        pending = table !== null && flow !== null && flow.contains(table) ? table : null;
        schedule();
      };
      const onLeave = () => {
        pending = null;
        schedule();
      };
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseleave", onLeave, true);
      document.addEventListener("scroll", onLeave, true);
      return () => {
        if (frame !== 0) cancelAnimationFrame(frame);
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseleave", onLeave, true);
        document.removeEventListener("scroll", onLeave, true);
      };
    }, []);
    if (target === null || typeof document === "undefined") return null;
    const position = {
      left: Math.max(VIEWPORT_MARGIN4, target.rect.right - TABLE_BUTTON_INSET),
      top: Math.max(VIEWPORT_MARGIN4, target.rect.top + TABLE_BUTTON_OFFSET)
    };
    return (0, import_react_dom5.createPortal)(
      h7("button", {
        type: "button",
        className: "qc-table-add",
        style: { left: `${position.left}px`, top: `${position.top}px` },
        // Keep the pointer where it is: focusing the button would fire a mousemove elsewhere and
        // clear the target before the click.
        onMouseDown: (event) => event.preventDefault(),
        onClick: () => onAdd(target.element)
      }, h7(IconAnnotate, null), label),
      document.body
    );
  }
  function diagnoseMiss(flow, annotation) {
    const anchor = annotation.anchor ?? {};
    const quote = typeof anchor.quote === "string" ? anchor.quote : "";
    const head = quote.length > 18 ? `${quote.slice(0, 18)}…` : quote;
    if (flow === null) return `找不到对话区域 / no chat flow (quote ${quote.length} chars: ${head})`;
    const rows = flow.querySelectorAll("[data-chat-node-key]");
    const row = anchor.nodeKey === "" ? null : flow.querySelector(`[data-chat-node-key="${cssEscape(anchor.nodeKey)}"]`);
    if (row === null) {
      return `翻遍对话仍未加载到原文所在消息 / row never loaded (${rows.length} rows mounted, quote ${quote.length} chars: ${head})`;
    }
    return `消息还在，但其中找不到这段引文 / row present, quote missing (${quote.length} chars: ${head})`;
  }
  function tableAnchor(flow, table) {
    const row = table.closest("[data-chat-node-key]") ?? null;
    const path = nodePath(flow, table);
    return {
      nodeKey: row?.getAttribute("data-chat-node-key") ?? "",
      // A table anchors as a single element: start and end are the same node, so the range covers
      // the whole table rather than a character run.
      startPath: path,
      startOffset: 0,
      endPath: path,
      endOffset: table.childNodes.length,
      quote: table.innerText.trim()
    };
  }

  // src/selection.js
  var NON_ANSWER_SELECTOR = 'textarea, input, [contenteditable="true"], [data-slot="conversation.composer"]';
  var UNSAFE_IN_CARD = "script, style, iframe, object, embed, link, meta";
  function clearSelection() {
    if (typeof window === "undefined") return;
    const selection = window.getSelection();
    if (selection !== null && selection.rangeCount > 0) selection.removeAllRanges();
  }
  function fragmentHtml(fragment) {
    const host = document.createElement("div");
    host.appendChild(fragment);
    for (const node of host.querySelectorAll(UNSAFE_IN_CARD)) node.remove();
    for (const node of host.querySelectorAll("*")) {
      for (const attribute of [...node.attributes]) {
        const name = attribute.name.toLowerCase();
        if (name.startsWith("on")) node.removeAttribute(attribute.name);
      }
    }
    return host.innerHTML;
  }
  function tableToMarkdown(table) {
    const rows = [...table.rows].map((row) => [...row.cells].map((cell) => cell.innerText.replace(/\s+/g, " ").trim()));
    const usable = rows.filter((row) => row.length > 0);
    if (usable.length === 0) return "";
    const width = Math.max(...usable.map((row) => row.length));
    const pad = (row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")];
    const line = (row) => `| ${pad(row).map((cell) => cell.replace(/\|/g, "\\|")).join(" | ")} |`;
    const head = usable[0];
    return [line(head), `| ${pad(head).map(() => "---").join(" | ")} |`, ...usable.slice(1).map(line)].join("\n");
  }
  function readSelection(pointer) {
    if (typeof window === "undefined" || typeof document === "undefined") return null;
    const selection = window.getSelection();
    if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) return null;
    const text = selection.toString();
    if (typeof text !== "string" || text.trim() === "") return null;
    const startElement = elementOf(selection.anchorNode);
    const endElement = elementOf(selection.focusNode);
    if (startElement === null || endElement === null) return null;
    const flow = startElement.closest(FLOW_SELECTOR);
    if (flow === null || !flow.contains(endElement)) return null;
    if (startElement.closest('[data-chat-flow-kind="user"]') !== null) return null;
    if (startElement.closest("[data-sidebar-right-tab]") !== null) return null;
    if (startElement.closest(NON_ANSWER_SELECTOR) !== null) return null;
    const range = selection.getRangeAt(0);
    let box;
    try {
      box = range.getBoundingClientRect();
    } catch {
      return null;
    }
    if (box === void 0 || box.width === 0 && box.height === 0) return null;
    const rect = pointer === null || pointer === void 0 ? { left: box.right, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height } : {
      left: pointer.x,
      top: pointer.y,
      right: pointer.x,
      bottom: pointer.y,
      width: box.width,
      height: box.height,
      // The passage box, kept so the action popup can sit relative to the text too.
      passage: box
    };
    if (rect === void 0 || rect.width === 0 && rect.height === 0) return null;
    const table = startElement.closest("table") ?? endElement.closest("table");
    if (table !== null && flow.contains(table)) {
      const tableBox = table.getBoundingClientRect();
      return {
        kind: "table",
        text: tableToMarkdown(table),
        previewHtml: "",
        previewText: table.innerText.trim(),
        rect: tableBox,
        block: table,
        blockRect: tableBox,
        anchor: tableAnchor(flow, table)
      };
    }
    const rangeStartElement = elementOf(range.startContainer) ?? startElement;
    const block = rangeStartElement.closest(BLOCK_SELECTOR) ?? flow;
    return {
      kind: "text",
      text: text.trim(),
      previewHtml: fragmentHtml(range.cloneContents()),
      previewText: text.trim(),
      rect,
      // The block that holds the selection, kept both as an element and as a snapshot of its box at
      // this moment. Placement must use the snapshot: a live `getBoundingClientRect()` at render time
      // reports wherever the block has moved to since, which put the panel 182–207px off in scenarios
      // where the transcript scrolled in between.
      block,
      blockRect: block.getBoundingClientRect(),
      anchor: captureAnchor(range, flow)
    };
  }

  // src/index.js
  var MAX_QUOTE_CHARS = 8e3;
  var MAX_ANNOTATIONS = 12;
  var h8 = import_react10.default.createElement;
  var NS = "quoteChat";
  var TAB_ID = "dsh-quote-chat:side";
  var TAB_KIND = "dsh-quote-chat";
  function installStyles(ctx) {
    ctx.effect(() => {
      if (typeof document === "undefined") return void 0;
      const tag = document.createElement("style");
      tag.dataset.quoteChat = "";
      tag.textContent = STYLESHEET;
      document.head.appendChild(tag);
      return () => {
        tag.remove();
      };
    }, "quote-chat: stylesheet");
  }
  var layout = createLayout();
  var navigation = createNavigation({ layout });
  var { ChipCards, AnnotationCard } = createCards({ composerContainer: layout.composerContainer });
  var { MarkerLayer } = createMarkerLayer({
    findFlow: layout.findFlow,
    columnElement: (flow) => layout.columnElement(flow),
    anchorAboveBubble: (flow, box, size) => layout.anchorAboveBubble(flow, box, size)
  });
  var quoteHandoff = createQuoteHandoff();
  var { SideChat, SideChatTab } = createSideChat({
    quoteForTab: (carried) => quoteHandoff.forTab(carried)
  });
  var { ActionPopup, ComposerPopover } = createPopovers({
    findFlow: layout.findFlow,
    anchorInTranscript: (flow, box, size, prefer) => layout.anchorInTranscript(flow, box, size, prefer),
    // Viewport-space placement for the compose panel: above the selection, then docked once it has text.
    anchorAboveSelection: layout.anchorAboveSelection,
    snapPosition: layout.snapPosition,
    // The band the panel must stay visually inside: the header above, the composer below. Used to clip the
    // panel, so those surfaces appear to cover it.
    readableBand: layout.readableBand
  });
  var highlighter = createHighlighter();
  var annotationStore = createAnnotationStore({ maxAnnotations: MAX_ANNOTATIONS });
  var useAnnotations = makeUseAnnotations(annotationStore);
  var chipRegistry = createChipRegistry();
  var chipBridge = createDraftBridge({ registry: chipRegistry, source: CHIP_SOURCE });
  var chipJumpHandler = { current: null };
  function applyImpl(ctx) {
    installStyles(ctx);
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), "quote-chat: dictionaries");
    const t = ctx.locale.bind(NS);
    registerSideChatTab({ ctx, t, TAB_ID, TAB_KIND, NS, SideChatTab });
    registerReferenceSource({
      ctx,
      registry: chipRegistry,
      jumpHandler: chipJumpHandler,
      CHIP_TRIGGER,
      CHIP_SOURCE,
      CHIP_PLACEHOLDER,
      serializeChipForModel
    });
    registerAnnotationDock({
      ctx,
      NS,
      buildDock: () => annotationDock({
        ctx,
        // The annotation lifecycle: one store, plus the React binding over it.
        annotations: { store: annotationStore, useAnnotations },
        // Chip identity and the draft seam.
        chips: { registry: chipRegistry, bridge: chipBridge, jumpHandler: chipJumpHandler },
        // Painting: the transient glow and the held editor highlight.
        highlights: highlighter,
        // Restoring a stored passage into view.
        navigation,
        // The passage a freshly opened side chat should show.
        quoteHandoff,
        // Component types, created once at wiring.
        surfaces: { ActionPopup, ComposerPopover, ChipCards, MarkerLayer, TableAddButton },
        // Reading what the user selected, and explaining a jump that missed.
        selection: {
          readSelection,
          clearSelection,
          tableToMarkdown,
          tableAnchor,
          diagnoseMiss,
          findFlow: layout.findFlow
        },
        // Declared limits and protocol ids.
        limits: { MAX_QUOTE_CHARS, MAX_ANNOTATIONS, TAB_KIND },
        t
      })
    });
  }
  var inject = ["slots", "locale"];
  function apply(ctx) {
    applyImpl(ctx);
  }

  return module.exports
}

// The Host reads this envelope: a fixed id and a synchronous factory.
//
// `__dshQuoteChatFactory` evaluates the whole module graph when called, so building the
// plugin happens inside `factory`, not at script load. Each factory call therefore gets
// its own instance of every module-scope value, which is the semantics the original
// concatenated build had.
window.__ModuleLoader__.load({
  id: 'dsh-quote-chat',
  factory(hostRequire) {
    const bundle = __dshQuoteChatFactory(hostRequire)
    return { inject: bundle.inject, apply: bundle.apply }
  },
})
