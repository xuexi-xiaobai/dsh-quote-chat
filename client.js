/**
 * dsh-quote-chat — browser half.
 *
 * GENERATED FILE. Do not edit.
 * Source: src/, assembled by build.mjs. Run `node build.mjs` after changing any source
 * module; `node build.mjs --check` fails when this file has drifted from src/.
 *
 * Artifact: sha256:a7fbf967fd54b27b
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
    "card.limit": "最多 {max} 条注释，删掉一条后再继续",
    "card.stale": "有 {n} 条注释在页面刷新后失效，已从草稿中移除",
    "card.staleSend": "注释在页面刷新后已失效，删掉草稿里的注释芯片后再发送",
    "card.removed": "已删除一条注释",
    "card.removedMany": "已删除 {n} 条注释",
    "card.undo": "撤销",
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
    "card.limit": "At most {max} annotations — delete one to add another",
    "card.stale": "{n} annotation(s) were lost when the page reloaded and have been removed from the draft",
    "card.staleSend": "These annotations were lost when the page reloaded — remove their chips from the draft, then send",
    "card.removed": "Annotation removed",
    "card.removedMany": "{n} annotations removed",
    "card.undo": "Undo",
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
  function chipOrdinal(occurrences, source, ref) {
    const mine = (Array.isArray(occurrences) ? occurrences : []).filter((item) => item.source === source);
    const index = mine.findIndex((item) => item.ref === ref);
    return index < 0 ? null : index + 1;
  }
  function staleChipRefs(occurrences, has, source) {
    return (Array.isArray(occurrences) ? occurrences : []).filter((item) => item.source === source && !has(item.ref)).map((item) => item.ref);
  }
  function orphanedIds(annotations, occurrences, source) {
    const live = new Set(
      (Array.isArray(occurrences) ? occurrences : []).filter((item) => item.source === source).map((item) => item.ref)
    );
    return (Array.isArray(annotations) ? annotations : []).filter((item) => !live.has(item.id)).map((item) => item.id);
  }
  function withAppendedChip(draft, existing, addition, reference) {
    const base = draft;
    return {
      text: `${base}${addition}`,
      references: [...existing, { ...reference, offset: base.length }]
    };
  }
  function withChipAt(draft, existing, addition, reference, at) {
    const point = Math.max(0, Math.min(Number.isFinite(at) ? at : draft.length, draft.length));
    const shift = addition.length;
    const moved = existing.map((item) => item.offset >= point ? { ...item, offset: item.offset + shift } : item);
    const placed = { ...reference, offset: point + shift - reference.length };
    const index = moved.findIndex((item) => item.offset > placed.offset);
    const references = [...moved];
    references.splice(index < 0 ? references.length : index, 0, placed);
    return {
      text: `${draft.slice(0, point)}${addition}${draft.slice(point)}`,
      references
    };
  }
  function chipRemovalSite(draft, references, source, ref) {
    const index = references.findIndex((item) => item.source === source && item.ref === ref);
    if (index < 0) return null;
    const target = references[index];
    let start = target.offset;
    const stop = target.offset + target.length;
    const brokenBefore = start > 0 && draft[start - 1] === "\n";
    const brokenAfter = stop < draft.length && draft[stop] === "\n";
    const ownsLine = brokenBefore && brokenAfter;
    if (ownsLine) start -= 1;
    return {
      index,
      // Where the cut begins — and, once it is made, where the seam is. A chip put back goes here.
      start,
      stop,
      removed: draft.slice(start, stop),
      // The break the cut took, if any. A chip put back has to bring it along.
      lead: ownsLine ? "\n" : ""
    };
  }
  function withoutChip(draft, references, source, ref) {
    const site = chipRemovalSite(draft, references, source, ref);
    if (site === null) return null;
    const nextText = `${draft.slice(0, site.start)}${draft.slice(site.stop)}`;
    const shift = site.removed.length;
    const kept = references.filter((_, position) => position !== site.index).map((item) => item.offset >= site.stop ? { ...item, offset: item.offset - shift } : item);
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
       * Place one annotation in the draft at a chosen point rather than at the end.
       *
       * This is `place` for a chip that is going back where it came from. The ordering rule is
       * the same one — register first, write second, report failure without rolling the payload
       * back — because it protects the same invariant: a payload with no chip is harmless, a chip
       * with no payload is unrenderable.
       *
       * @param port - `{ setDraft }` from the Host's input actions; may be absent.
       * @param read - getter for `{ draft, occurrences }`.
       * @param annotation - the annotation to place.
       * @param labels - the active locale's card labels.
       * @param site - `{ start, lead }` from `chipRemovalSite`: where the chip came out, and the
       *   line break the cut took with it. Without one the chip is appended, since a caller with
       *   no site has no place to restore to.
       * @returns true when the draft accepted the chip.
       */
      placeAt(port, read, annotation, labels, site) {
        if (typeof port?.setDraft !== "function") return false;
        const { draft, occurrences } = liveDraft(read);
        try {
          const reference = registry.register(annotation, chipLabel(annotation, labels));
          const addition = `${site?.lead ?? ""}${CHIP_PLACEHOLDER}`;
          port.setDraft(withChipAt(draft, occurrences, addition, reference, site?.start ?? draft.length));
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
  var PANEL_COLUMN_INSET = 8;
  var PANEL_MIN_WIDTH = 240;
  var SIDEBAR_TAB_SELECTOR = "[data-sidebar-right-tab]";
  var widthCache = { width: -1, limit: null };
  var scrollerCache = { flow: null, scroller: null };
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
  function liveColumnBox(flow) {
    if (flow === null || flow === void 0) return null;
    const own = flow.getBoundingClientRect();
    if (own.width > 0 && own.height > 0) return own;
    let node = flow.parentElement;
    for (let depth = 0; node !== null && depth < 4; depth += 1) {
      const box = node.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) return box;
      node = node.parentElement;
    }
    return null;
  }
  function localScrollerOf(flow) {
    if (flow === null || flow === void 0) return null;
    if (scrollerCache.flow === flow && scrollerCache.scroller !== null && scrollerCache.scroller.isConnected === true) return scrollerCache.scroller;
    let node = flow.parentElement;
    while (node !== null && node !== document.body) {
      if (node.scrollHeight > node.clientHeight + 8 && node.clientHeight > 0) {
        const overflowY = window.getComputedStyle(node).overflowY;
        if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
          scrollerCache.flow = flow;
          scrollerCache.scroller = node;
          return node;
        }
      }
      node = node.parentElement;
    }
    return null;
  }
  function livePanelColumn() {
    if (typeof document === "undefined") return null;
    const flow = findFlowElement();
    if (flow === null || flow === void 0) return null;
    const scroller = localScrollerOf(flow);
    const target = scroller ?? flow.parentElement;
    if (target === null || target === void 0) return null;
    const box = target.getBoundingClientRect();
    if (box.width <= 0) return null;
    return { left: Math.round(box.left), width: Math.round(box.width), right: Math.round(box.right) };
  }
  function panelMaxWidth(flow) {
    const scroller = localScrollerOf(flow);
    const available = scroller !== null && scroller !== void 0 && scroller.clientWidth > 0 ? scroller.clientWidth : null;
    const column = available === null ? liveColumnBox(flow) : null;
    const width = available ?? (column === null ? null : column.width);
    if (width === null || width === void 0 || width <= 0) return null;
    if (widthCache.width === width) return widthCache.limit;
    const viewport = typeof window === "undefined" ? 0 : window.innerWidth;
    const room = Math.floor(width) - 2 * PANEL_COLUMN_INSET;
    const floor = Math.min(PANEL_MIN_WIDTH, Math.max(160, Math.floor(viewport * 0.5)));
    const limit = Math.max(floor, room);
    widthCache.width = width;
    widthCache.limit = limit;
    return limit;
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
      const column = livePanelColumn();
      const left = column === null ? Math.max(margin, Math.round((viewportWidth - size.width) / 2)) : Math.min(
        Math.round(column.left + Math.max(margin, (column.width - size.width) / 2)),
        Math.max(column.left + margin, column.right - size.width - margin)
      );
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
      const edge = options.edge === "top" || options.edge === "bottom" ? options.edge : toTop <= toBottom ? "top" : "bottom";
      const column = livePanelColumn();
      const centred = column === null ? Math.max(margin, Math.round((viewportWidth - size.width) / 2)) : Math.round(column.left + Math.max(margin, (column.width - size.width) / 2));
      const left = column === null ? centred : Math.min(centred, Math.max(column.left + margin, column.right - size.width - margin));
      return {
        left,
        top: edge === "top" ? top : bottom,
        edge
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
    /* Never let the browser pick this panel as a scroll-anchor candidate.
       While a pane boundary is dragged the text re-wraps and the transcript's scroll offset is adjusted by the browser's
       scroll anchoring; measured, scrollTop moved 893 -> 1441 -> 943 across one width sweep. The panel sits at a fixed
       offset INSIDE the container, so that adjustment carried it up and down the viewport by up to 80px while its dock
       state never changed — exactly the wobble that was reported. It is not anchored content; it must not influence or be
       moved by anchoring. */
    overflow-anchor:none;
    border:1px solid var(--dsw-alias-border-l3, var(--dsw-alias-border-l2));border-radius:18px;
    background:var(--dsw-alias-bg-overlay);
    box-shadow:0 16px 40px rgba(0,0,0,.32),0 2px 8px rgba(0,0,0,.18);
    padding:12px;color:var(--dsw-alias-label-primary);
    font-size:12.5px;animation:qc-pop .1s ease-out}
  /* No CSS transition on the panel's position, deliberately.
   *
   * A transition on the top property made a docked panel trail every scroll frame: each frame set a new target and the
   * 260ms interpolation restarted, so the panel arrived late — the inertia reported. Turning it off makes tracking exact.
   *
   * The glide across the two dock-state changes is animated by the component with the Web Animations API instead, because
   * a CSS transition cannot express it: the attribute that enables the transition and the new position arrive in the same
   * commit, so the browser has no starting value and the change lands instantly (measured: 84 -> 97 in one frame, no
   * intermediate positions).
   */
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
    /* Same reason as .qc-compose: the browser's scroll anchoring must not move this panel, which sits at a fixed offset
       inside the scroll container and was being carried up and down the viewport while a pane boundary was dragged. */
    overflow-anchor:none;
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
  /* The chip is a FIXED-SIZE token that sits ON the text's line, not beside it.

     Measured before this revision, against the composer's own text:

         composer text    font 15px, line-height 25px, colour rgb(15,17,21)
         chip             font 12.5px, height 24px
         chip background  rgb(255,255,255)
         composer surface rgb(255,255,255)

     Two things were wrong. The chip was 2.5px smaller than the prose it sits in, so it read as
     a footnote rather than as another kind of word. And its background was EXACTLY the
     composer's, so the only thing separating the two was a 1px hairline border — the token had
     no body of its own.

     The colours are now derived from the text colour rather than hard-coded or taken from a
     layer token, because the layer tokens resolve to the SAME value as the composer surface and
     therefore cannot express "slightly raised". Mixing the label colour into the surface by a
     few percent gives a tint that tracks the theme by construction: in light mode it is a soft
     grey, in dark mode a slightly lifted charcoal, and it is always visible against whatever the
     composer uses.

     The size follows the prose: em-based sizing against the inherited font-size, and a line-height
     that matches the composer's so a line containing a chip is the same height as one without. */
  [data-composer-chip="quote-chat"]{display:inline-flex;align-items:center;
    /* Left-aligned, not centred. A fixed width plus centring leaves whatever the label does not use split into two equal
       gaps, and since the icon and the label have different visual weights the result reads as slack rather than as
       breathing room: measured, 32px of unused space on each side of a two-character label. Anchoring the content to the
       start keeps one consistent inset and lets a longer ordinal grow into the free space instead of shifting the icon. */
    justify-content:flex-start;gap:0;
    box-sizing:border-box;
    /* Auto width, with a floor.
       A hard width was the wrong instrument: the label's own width changes with its ordinal (measured at 15px,
       "注释 1" is 42.45px but "注释 10" is 50.78px), so any fixed value either clips the common case or leaves a gap in
       the other. Clipping is what happened — a 79.5px box against 79.05px of content, and a flex item may shrink, so the
       label rendered as "注...".
       An auto width lets the chip be exactly as wide as its contents. The min-width keeps a uniform look while the
       ordinals are single digits, and the small amount it grows at 10 is one 8px step, invisible in a line of prose. */
    width:auto;min-width:var(--qc-chip-w, 5.3em);
    /* Height tracks the line, not a pixel value: 1.42em against an inherited 15px gives the 21.3px the composer's own
       line box occupies, so a chip never makes its line taller than a plain one. */
    height:1.42em;
    /* The middle value aligns the box's centre with the parent's x-height midpoint, which is NOT the optical centre of a
       line of CJK text: measured, the chip's centre sat 2.3px below the text's and its bottom edge landed exactly on the
       paragraph's, so it read as hanging off the line rather than sitting in it.
       A small em-based lift corrects it, and being em-based it survives a font-size change. */
    vertical-align:middle;
    transform:translateY(-.085em);
    padding:0 .5em;margin:0 .3em;
    border-radius:999px;
    /* Derived from the ACCENT, not from a background layer.
       The Host's --dsw-alias-bg-layer-1/2/3 all resolve to #fff, the composer's own colour, so a layer token cannot express
       "slightly raised": that is exactly why the chip used to have no body of its own. Mixing the accent into the surface
       gives a tint that is distinct in light mode and, with the dark-mode values below, in dark mode too. */
    border:1px solid color-mix(in srgb, var(--qc-accent, #4176e6) 26%, transparent);
    background:color-mix(in srgb, var(--qc-accent, #4176e6) 7%, var(--qc-surface, #fff));
    /* The label uses the accent pressed darker: pure #4176e6 does not carry enough contrast as body text. */
    color:color-mix(in srgb, var(--qc-accent, #4176e6) 78%, var(--qc-ink, #0f1115));
    font-size:1em;line-height:1;font-weight:500;
    font-variant-numeric:tabular-nums;
    cursor:pointer;position:relative;
    user-select:none;
    /* The chip's box must be hit-testable across its WHOLE area, not only where its glyphs happen to be.
       Measured with elementsFromPoint at the chip's centre: the topmost element was the paragraph, so a press in the
       middle of the chip fell through to the text and the drag never started. The box is painted by the background, so it
       should catch the pointer everywhere — the label is drawn by a pseudo-element and a pseudo-element has no box of its
       own to hit. */
    pointer-events:auto;
    transition:background .12s ease,border-color .12s ease}
  /* The children must not steal the press from the chip: they are decoration, and the chip is the handle. */
  [data-composer-chip="quote-chat"] > *,
  [data-composer-chip="quote-chat"] > * > *{pointer-events:none}
  [data-composer-chip="quote-chat"]:hover,
  [data-composer-chip="quote-chat"]:focus-within{
    background:color-mix(in srgb, var(--qc-accent, #4176e6) 12%, var(--qc-surface, #fff));
    border-color:color-mix(in srgb, var(--qc-accent, #4176e6) 40%, transparent)}
  /* Dark mode: one recipe, two variable sets. The accent and surface are the only things that change. */
  @media (prefers-color-scheme: dark){
    [data-composer-chip="quote-chat"]{
      --qc-accent:#5b8cf0;
      --qc-surface:#1b1d21;
      --qc-ink:#e7e9ee;
    }
  }
  /* The host's marker glyph is the first child; it is hidden and replaced by a
     CSS glyph so the node's contents are never touched.

     But it must be hidden as a GLYPH, not as a container.

     The chip has exactly ONE child element, so a rule on "span:first-child" or
     "span:last-child" hit the same node twice and removed the host's entire
     subtree from layout: measured, that child computed to display:none with a
     width of 0. Everything visible afterwards was two pseudo-elements, so the chip
     contained no text node at all — its 72px were drawn entirely by CSS.

     That is why the chip interacted badly with the surrounding text. A caret
     cannot sit inside a pseudo-element, and a click near the chip's left edge had
     no text position to land on, so the following keystrokes went to whichever
     side the editor considered nearest (measured: text typed at the left edge
     arrived after the chip).

     The glyph and the label are now hidden individually, which leaves the wrapper in
     flow. The chip keeps a real, zero-width text box with the label in it, so
     selection, caret placement and click targeting all behave like ordinary inline
     content.

     They are selected STRUCTURALLY, not by class name. The host's classes here are
     CSS-Module hashes ("yAWgPa_marker"), and those change with the host's build; an
     earlier revision keyed on them and the moment they changed the marker came back:
     the chip started rendering the host's "@" and its own label next to the plugin's,
     which is the duplicated text that was reported.

     The chip's DOM is always the same three levels: the decorator, one wrapper, then
     the marker followed by the label. Selecting by position survives any renaming. */
  [data-composer-chip="quote-chat"] > span > span:first-child{display:none}
  /* The kind glyph, occupying the left slot.

     TWO things are set here, and getting either wrong makes the icon look small next to the label.

     1. The BOX is 1.12em, not 0.92em. The label's ink is about 20px tall at a 15px font size, and a 0.92em box was only
        9px of visible geometry, so the icon read as a bullet rather than as a mark of equal weight.

     2. The ARTWORK fills its viewBox. The previous icon drew a 12x10 rectangle inside a 16x16 canvas, so even at full box
        size it occupied 62% of the height. The rect now spans 1..15 vertically, and the box size was chosen to match the
        measured ink height rather than guessed. */
  [data-composer-chip="quote-chat"]::before{content:"";
    flex:none;width:1.12em;height:1.12em;
    /* The ONLY spacing between the icon and the label. It used to be the flex gap on the parent, which also applied
       around the host's wrapper span — and that wrapper, though emptied by the rules below, still occupied 8px of
       flex space. The visible gap measured 17px: 4.5 + 8 + 4.5. Spending the spacing here instead of on the gap
       gives exactly one gap, next to nothing else. */
    margin-right:.32em;
    background-color:color-mix(in srgb, var(--qc-accent, #4176e6) 100%, transparent);
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
    order:1;margin-left:0;font-size:1em;line-height:1;
    color:inherit;font-variant-numeric:tabular-nums;
    /* Never shrink, never ellipsise.
       A flex item may shrink by default, and the label did: inside a fixed-width box it was squeezed to 40.9px against
       its natural 42.45px and the browser rendered "注..." — the ellipsis was the visible symptom of a squeeze, not of a
       genuinely long label. With auto width there is nothing to squeeze against, and flex none keeps it that way if
       the chip is ever placed in a constrained line. */
    flex:none;
    white-space:nowrap}
  /* The host's own label is hidden as a glyph — the ordinal above is the visible text — but it stays in the box so the
     chip still owns a text node.

     Two levels are involved and BOTH must leave the flex flow:

     1. The decorator's single wrapper span (a direct child). It is the one that occupies space: measured, 8px wide and
        0 tall while its own contents are hidden. A zero-width flex item with a gap still costs the gap on both sides,
        so the icon and the label sat 17px apart: 4.5 + 8 + 4.5.

     2. The label span inside that wrapper, for the same reason.

     position:absolute removes each from the flow instead of merely shrinking it. They keep their text nodes, which is
     all the editor needs them for. */
  [data-composer-chip="quote-chat"] > span,
  [data-composer-chip="quote-chat"] > span > span:last-child{
    position:absolute;width:0;height:0;overflow:hidden;
    font-size:0;line-height:0;vertical-align:baseline}

  /* Glyph: a rounded rectangle holding two lines of text — a passage, abstracted.

     The artwork fills the canvas on purpose. viewBox is 16x16 and the rect runs from 1 to 15 in BOTH axes, so the drawn
     geometry is the full box; an icon that draws a small shape inside a large canvas renders visually smaller than its
     CSS size claims, which is what made the previous glyph look like a dot next to the label.

     Table chips get a grid glyph, drawn to the same footprint. */
  :root{
    --qc-glyph-text:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='1.1' y='1.1' width='13.8' height='13.8' rx='3.4' fill='none' stroke='black' stroke-width='1.7'/><path d='M4.6 6.1h6.4M4.6 9.9h4.2' stroke='black' stroke-width='1.6' stroke-linecap='round'/></svg>");
    --qc-glyph-table:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='1.1' y='1.9' width='13.8' height='12.2' rx='2.6' fill='none' stroke='black' stroke-width='1.7'/><path d='M1.1 5.9h13.8M1.1 10h13.8M5.9 1.9v12.2' stroke='black' stroke-width='1.35'/></svg>");
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
  /* The red × sits in the chip's left slot, replacing the kind glyph on hover.

     ITS POSITION AND SIZE ARE DERIVED FROM THE CHIP'S OWN METRICS, not set independently.

     The previous version hard-coded "centre at 7 + 13/2 px" and a 15px box. Both described an older chip: once the glyph
     became 1.12em (16.8px) and the padding .5em (7.5px), the cross was measured 1.9px left of the glyph's centre and its
     15px box was smaller than the 16.8px glyph, so a blue sliver of the icon showed around the red disc while hovering.
     A px constant cannot track an em value.

     So the three values below are the SAME ones the chip uses:
       padding-left  .5em
       glyph width   1.12em
     and the button is centred on that slot by construction, and made slightly LARGER than the glyph so it covers it
     completely rather than leaving an edge.

     The chip's rectangle arrives as custom properties from the component; this rule only knows the insets. */
  .qc-chip-remove{position:fixed;z-index:45;
    --qc-chip-pad-left:.5em;
    --qc-chip-glyph:1.12em;
    /* Centred on the glyph slot: padding + half the glyph, measured from the chip's left edge.
       Written as a pre-halved sum rather than glyph / 2 so the calc has no division to round: at 15px the browser was
       landing 0.5px to the right, which is exactly the kind of sub-pixel error that leaves a visible sliver of the icon
       showing through. Half of 1.12em is 0.56em. */
    left:calc(var(--qc-chip-left, 0px) + var(--qc-chip-pad-left) + .56em);
    top:calc(var(--qc-chip-top, 0px) + var(--qc-chip-height, 24px) / 2);
    /* Larger than the glyph so it hides it entirely: 1.36em covers 1.12em with a 0.12em ring on each side, which at 15px
       is 20.4px against a 16.8px glyph. The margin matters because the glyph is a masked image whose strokes reach the
       very edge of its box — a button merely equal in size leaves antialiased fringe showing. */
    width:1.36em;height:1.36em;font-size:15px;
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

  /* ── Dragging a chip ─────────────────────────────────────────────────────────

     A drag shows two things and moves nothing: a solid grab bar at the seam the
     chip would drop into, and a translucent copy of the chip following the cursor.

     The chip itself belongs to the Host's editor (a Lexical decorator), so its DOM
     cannot be moved without the next keystroke undoing it. The overlay exists so
     the gesture still reads as dragging, while the real reorder is written to the
     draft on release.

     Neither element takes pointer events: the pointer must keep reaching the
     editor underneath, or the gesture would lose track of the text it is over. */
  .qc-chip-drag-grab{position:fixed;z-index:41;width:2px;
    border-radius:1px;background:var(--dsw-alias-brand-primary, #6b4df6);
    transform:translateX(-1px);pointer-events:none;
    box-shadow:0 0 0 3px rgba(107,77,246,.16)}
  /* The knobs on the bar: they are what makes it read as a grab handle rather
     than a caret. */
  .qc-chip-drag-grab::before,
  .qc-chip-drag-grab::after{content:"";position:absolute;left:50%;
    width:7px;height:7px;border-radius:50%;
    background:var(--dsw-alias-brand-primary, #6b4df6);
    transform:translateX(-50%)}
  .qc-chip-drag-grab::before{top:-2px}
  .qc-chip-drag-grab::after{bottom:-2px}

  .qc-chip-drag-ghost{position:fixed;z-index:42;
    box-sizing:border-box;
    max-width:16em;height:1.45em;padding:0 .55em;
    display:inline-flex;align-items:center;justify-content:center;
    border-radius:999px;border:1px solid transparent;
    background:var(--qc-chip-drag-bg, rgba(107,77,246,.16));
    color:var(--dsw-alias-brand-primary, #6b4df6);
    font-size:15px;line-height:1;white-space:nowrap;
    overflow:hidden;text-overflow:ellipsis;
    transform:translate(12px,-50%);pointer-events:none;
    box-shadow:0 6px 18px rgba(0,0,0,.14)}

  /* While a chip is being carried, that chip steps back so the ghost reads as the thing in flight. */
  [data-qc-dragging="true"]{opacity:.45}

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

  /* ── The undo bar ────────────────────────────────────────────────────────────

     WHERE IT SITS.

     Bottom-centre was tried first and failed: the hover preview card opens ABOVE the chip, so the bar landed inside the
     card's rectangle (measured 315..695 x 450..546 against the bar's 560..720 x 495..533) and clicks aimed at the bar hit
     the card. Raising the z-index cannot help — the card is a portal with its own stacking context, so the two values are
     never compared. Top-centre was then tried and read as application chrome, sitting in the header strip next to the
     view title.

     It belongs WITH THE COMPOSER, which is what it edits, but clear of the preview card: pinned just below the top of the
     composer's area and above the notice slot. Never overlapping the card, always in the same place, and near the eye
     after pressing ×.

     THE WHOLE BAR IS THE BUTTON. A bar whose only live region is a small button inside it invites a missed click, and that
     was reported: pressing the middle did nothing. Every pixel here is the control.

     The meter is a countdown, not decoration: this bar has a real five-second deadline, and a draining hairline says so
     without a number ticking in the reader's face.

     The offset is a fallback only. The component measures the composer and passes --qc-composer-offset, so the bar sits
     just above the composer at any window size; the constant here keeps it sane if that measurement has not run yet. */
  .qc-undo{position:fixed;left:50%;bottom:var(--qc-composer-offset, 148px);
    transform:translateX(-50%);z-index:76;
    display:flex;align-items:center;gap:11px;
    appearance:none;margin:0;padding:9px 9px 9px 13px;
    border-radius:11px;cursor:pointer;overflow:hidden;
    border:1px solid color-mix(in srgb,var(--qc-accent,#4176e6) 26%,transparent);
    background:color-mix(in srgb,var(--qc-accent,#4176e6) 7%,var(--dsw-alias-bg-overlay,#fff));
    box-shadow:0 10px 26px rgba(15,17,21,.15),0 2px 6px rgba(15,17,21,.07);
    font:inherit;font-size:12.5px;text-align:left;line-height:1.25;
    color:var(--dsw-alias-label-secondary,#61666b);
    max-width:min(30em,88vw);
    animation:qc-undo-in .2s cubic-bezier(.2,.8,.3,1);
    transition:background .12s ease,border-color .12s ease,box-shadow .12s ease}
  @keyframes qc-undo-in{
    from{opacity:0;transform:translateX(-50%) translateY(7px) scale(.985)}
    to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
  .qc-undo:hover{
    background:color-mix(in srgb,var(--qc-accent,#4176e6) 12%,var(--dsw-alias-bg-overlay,#fff));
    border-color:color-mix(in srgb,var(--qc-accent,#4176e6) 40%,transparent);
    box-shadow:0 12px 30px rgba(15,17,21,.18),0 2px 7px rgba(15,17,21,.08)}
  .qc-undo:active{transform:translateX(-50%) scale(.988)}
  .qc-undo:focus-visible{outline:2px solid color-mix(in srgb,var(--qc-accent,#4176e6) 55%,transparent);
    outline-offset:2px}
  .qc-undo-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .qc-undo-action{flex:none;padding:4px 11px;border-radius:7px;font-weight:600;
    background:color-mix(in srgb,var(--qc-accent,#4176e6) 14%,transparent);
    color:color-mix(in srgb,var(--qc-accent,#4176e6) 84%,var(--qc-ink,#0f1115));
    transition:background .12s ease}
  .qc-undo:hover .qc-undo-action{background:color-mix(in srgb,var(--qc-accent,#4176e6) 22%,transparent)}
  /* The countdown hairline, pinned to the bottom edge of the bar. Width is driven by --qc-undo-left, which the component
     keeps in whole seconds; the transition is longer than the tick interval so the bar slides rather than steps. */
  .qc-undo-meter{position:absolute;left:0;bottom:0;height:2px;border-radius:0 1px 1px 0;
    width:calc(var(--qc-undo-left, 5) / 5 * 100%);
    background:color-mix(in srgb,var(--qc-accent,#4176e6) 62%,transparent);
    transition:width .3s linear;pointer-events:none}

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
    const ComposeBody = import_react3.default.memo(function ComposeBody2(props) {
      const { comment, inputRef, labels, onCancel, onChange, onConfirm, source } = props;
      return h2(
        import_react3.default.Fragment,
        null,
        source.kind === "table" ? null : h2("textarea", {
          ref: inputRef,
          value: comment,
          rows: 2,
          placeholder: labels.placeholder,
          onChange,
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
      );
    });
    function ComposerPopover2(props) {
      const { source, labels, onConfirm, onCancel } = props;
      const ref = import_react3.default.useRef(null);
      const inputRef = import_react3.default.useRef(null);
      const [comment, setComment] = import_react3.default.useState("");
      const dockedRef = import_react3.default.useRef(null);
      const dockedEdgeRef = import_react3.default.useRef(null);
      const previousBlockRef = import_react3.default.useRef(null);
      const dockedSlotRef = import_react3.default.useRef(null);
      const previousScrollTopRef = import_react3.default.useRef(null);
      const onChangeComment = import_react3.default.useCallback((event) => {
        setComment(event.target.value);
      }, []);
      const onCancelStable = import_react3.default.useCallback(() => {
        onCancel();
      }, [onCancel]);
      const onConfirmStable = import_react3.default.useCallback((text) => {
        onConfirm(text);
      }, [onConfirm]);
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
        const previousAnchor = scroller.style.overflowAnchor;
        scroller.style.overflowAnchor = "none";
        return () => {
          scroller.style.overflowAnchor = previousAnchor;
        };
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
        let lastWidth = null;
        const watch = () => {
          frame = window.requestAnimationFrame(watch);
          if (block === null || block === void 0 || block.isConnected !== true) return;
          const box = block.getBoundingClientRect();
          const top = Math.round(box.top);
          const left = Math.round(box.left);
          const height2 = Math.round(box.height);
          const width2 = Math.round(box.width);
          if (primed === false) {
            primed = true;
            lastTop = top;
            lastLeft = left;
            lastHeight = height2;
            lastWidth = width2;
            return;
          }
          if (top === lastTop && left === lastLeft && height2 === lastHeight && width2 === lastWidth) return;
          lastTop = top;
          lastLeft = left;
          lastHeight = height2;
          lastWidth = width2;
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
      const columnLimit = panelMaxWidth(findFlowElement());
      const width = columnLimit === null ? size.width || 420 : Math.min(size.width || 420, columnLimit);
      const height = size.height || 170;
      const liveBlock = source.block;
      const blockBox = liveBlock !== void 0 && liveBlock !== null && liveBlock.isConnected === true ? liveBlock.getBoundingClientRect() : source.blockRect ?? source.rect?.passage ?? source.rect;
      const resting = anchorAboveSelection ? anchorAboveSelection(blockBox, { width, height }) : placeNear(source.rect?.passage ?? source.rect, { width, height });
      const scrollerBox = scroller === null ? { top: 0, left: 0, bottom: typeof window === "undefined" ? 0 : window.innerHeight } : scroller.getBoundingClientRect();
      const hasInput = comment.trim() !== "";
      const restingBottom = resting.top + height;
      const DOCK_MARGIN = 24;
      const wasDocked = dockedRef.current !== null;
      const clearlyOut = resting.top < scrollerBox.top - DOCK_MARGIN || restingBottom > scrollerBox.bottom + DOCK_MARGIN;
      const comfortablyVisible = resting.top >= scrollerBox.top + DOCK_MARGIN && restingBottom <= scrollerBox.bottom - DOCK_MARGIN;
      const anchorMoved = blockBox !== void 0 && blockBox !== null && previousBlockRef.current !== null && Math.abs(Math.round(blockBox.top) - previousBlockRef.current) > 1;
      const scrollMoved = previousScrollTopRef.current !== null && Math.abs((scroller === null || scroller === void 0 ? 0 : scroller.scrollTop) - previousScrollTopRef.current) > 1;
      const frozen = anchorMoved && scrollMoved === false;
      const needsRescue = hasInput === false ? false : frozen ? wasDocked : wasDocked ? clearlyOut && comfortablyVisible === false : resting.top < scrollerBox.top - 1 || restingBottom > scrollerBox.bottom + 1;
      previousBlockRef.current = blockBox === void 0 || blockBox === null ? null : Math.round(blockBox.top);
      previousScrollTopRef.current = scroller === null || scroller === void 0 ? 0 : scroller.scrollTop;
      const lockedEdge = dockedEdgeRef.current;
      let dockedSlot = null;
      if (needsRescue && snapPosition) {
        const computed = snapPosition(resting.top, { width, height, edge: lockedEdge });
        const latched = dockedSlotRef.current;
        if (latched !== null && latched.edge === computed.edge) {
          dockedSlot = { left: computed.left, top: latched.top, edge: computed.edge };
        } else {
          dockedSlot = computed;
        }
      }
      const docked = dockedSlot;
      dockedRef.current = docked;
      dockedEdgeRef.current = docked === null ? null : docked.edge;
      dockedSlotRef.current = docked === null ? null : { top: docked.top, edge: docked.edge };
      const inViewport = docked ?? { left: resting.left, top: resting.top };
      const target = scroller === null ? inViewport : {
        left: Math.round(inViewport.left - scrollerBox.left + scroller.scrollLeft),
        top: Math.round(inViewport.top - scrollerBox.top + scroller.scrollTop)
      };
      const dockedEdge = docked === null ? null : docked.edge;
      const previousEdgeRef = import_react3.default.useRef(void 0);
      const previousTopRef = import_react3.default.useRef(null);
      const previousScrollRef = import_react3.default.useRef(null);
      const glideRef = import_react3.default.useRef(null);
      import_react3.default.useLayoutEffect(() => {
        const element = ref.current;
        if (element === null) return;
        const running = glideRef.current;
        glideRef.current = null;
        if (running !== null && running !== void 0) {
          try {
            running.cancel();
          } catch {
          }
        }
        const viewportTop = element.getBoundingClientRect().top;
        const previousEdge = previousEdgeRef.current;
        const previousTop = previousTopRef.current;
        const previousScroll = previousScrollRef.current;
        const scrollNow = scroller === null || scroller === void 0 ? 0 : scroller.scrollTop;
        const scrolled = previousScroll !== null && scrollNow !== previousScroll;
        const edgeChanged = previousEdge !== void 0 && previousEdge !== dockedEdge;
        if (previousTop !== null) {
          const delta = previousTop - viewportTop;
          const reflowed = scrolled === false && previousEdge === dockedEdge;
          const settledDocked = dockedEdge !== null && edgeChanged === false;
          if (Math.abs(delta) > 2 && Math.abs(delta) < 400 && typeof element.animate === "function" && settledDocked === false && (edgeChanged || reflowed)) {
            glideRef.current = element.animate(
              [{ transform: `translateY(${delta}px)` }, { transform: "none" }],
              { duration: edgeChanged ? 260 : 90, easing: "cubic-bezier(.22,.61,.36,1)" }
            );
          }
        }
        previousEdgeRef.current = dockedEdge;
        previousTopRef.current = viewportTop;
        previousScrollRef.current = scrollNow;
      });
      return (0, import_react_dom.createPortal)(
        h2(
          "div",
          {
            ref,
            className: "qc-compose",
            role: "dialog",
            "aria-label": labels.title,
            // The docked slot, exposed for the stylesheet and for probes. The glide itself is done with WAAPI above.
            "data-docked": docked === null ? "false" : docked.edge,
            style: {
              left: `${target.left}px`,
              top: `${target.top}px`,
              // Capped by the text column when it can be measured. The stylesheet's `min(420px, 92vw)` is a viewport rule:
              // with a sidebar open the column can be narrower than that, and the panel then overhangs it.
              width: columnLimit === null ? void 0 : `${Math.round(width)}px`,
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
          h2(ComposeBody, {
            comment,
            inputRef,
            labels,
            onCancel: onCancelStable,
            onChange: onChangeComment,
            onConfirm: onConfirmStable,
            source
          }, `qc-compose-body-${source.kind}`)
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

  // src/chip-drag.js
  var DRAG_GRAB_CLASS = "qc-chip-drag-grab";
  var DRAG_GHOST_CLASS = "qc-chip-drag-ghost";
  var CHIP_SOURCE2 = "quote-chat";
  var DRAG_THRESHOLD = 4;
  function offsetInDraft(root, range) {
    if (typeof document === "undefined" || root === null || range === null) return null;
    const offsetOf = (node, within) => {
      let offset = 0;
      let reached = false;
      const visit = (parent) => {
        for (const child of parent.childNodes) {
          if (child === node) {
            reached = true;
            if (node.nodeType === Node.TEXT_NODE) {
              offset += Math.min(within, node.data.length);
              return true;
            }
            if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute?.("data-composer-chip")) {
              if (within > 0) offset += 1;
              return true;
            }
            return true;
          }
          if (child.nodeType === Node.TEXT_NODE) {
            offset += child.data.length;
            continue;
          }
          if (child.nodeType !== Node.ELEMENT_NODE) continue;
          if (child.hasAttribute("data-composer-chip")) {
            if (child.contains(node)) {
              offset += 1;
              reached = true;
              return true;
            }
            offset += 1;
            continue;
          }
          if (child.tagName === "BR") {
            offset += 1;
            continue;
          }
          if (visit(child)) return true;
        }
        return false;
      };
      visit(root);
      return reached ? offset : null;
    };
    const computed = offsetOf(range.startContainer, range.startOffset);
    return computed === null ? null : computed;
  }
  function moveChipInDraft(draft, references, source, ref, target) {
    const own = references.filter((item) => item.source === source && item.ref !== void 0).slice().sort((left, right) => left.offset - right.offset);
    const current = own.findIndex((item) => item.ref === ref);
    if (current < 0) return null;
    const chip = own[current];
    let start = chip.offset;
    const stop = chip.offset + chip.length;
    const ownsLeadingBreak = start > 0 && draft[start - 1] === "\n";
    if (ownsLeadingBreak) start -= 1;
    const chunk = draft.slice(start, stop);
    const removedLength = stop - start;
    const rest = `${draft.slice(0, start)}${draft.slice(stop)}`;
    const clamped = Math.max(0, Math.min(target, draft.length));
    const insertion = Math.max(0, Math.min(
      clamped >= stop ? clamped - removedLength : clamped,
      rest.length
    ));
    const text = `${rest.slice(0, insertion)}${chunk}${rest.slice(insertion)}`;
    const movedIds = new Set(own.map((item) => item.ref));
    const rebuilt = [];
    for (const item of references) {
      if (item.source === source && movedIds.has(item.ref)) continue;
      if (item.offset >= stop) rebuilt.push({ ...item, offset: item.offset - removedLength + chunk.length });
      else if (item.offset > start) rebuilt.push({ ...item, offset: item.offset - chunk.length });
      else rebuilt.push({ ...item });
    }
    const survivors = own.filter((item) => item.ref !== ref).map((item) => ({
      ...item,
      offset: item.offset >= stop ? item.offset - removedLength + chunk.length : item.offset > start ? item.offset - chunk.length : item.offset
    }));
    const slots = [...survivors, { ...chip, offset: insertion }].sort((left, right) => {
      if (left.offset !== right.offset) return left.offset - right.offset;
      if (left.ref === ref) return insertion > chip.offset ? 1 : -1;
      if (right.ref === ref) return insertion > chip.offset ? -1 : 1;
      return 0;
    });
    const slotNow = slots.findIndex((item) => item.ref === ref);
    if (slots[slotNow].offset === chip.offset) return null;
    let searchFrom = 0;
    for (const item of slots) {
      const at = text.indexOf("￼", searchFrom);
      if (at < 0) break;
      rebuilt.push({ ...item, offset: at });
      searchFrom = at + item.length;
    }
    rebuilt.sort((left, right) => left.offset - right.offset);
    return { text, references: rebuilt };
  }
  function attachChipDragging({ listChips, readDraft, setDraft, source, onMoved }) {
    if (typeof document === "undefined") return () => {
    };
    let ghost = null;
    let grab = null;
    let dragging = null;
    const ensureOverlay = () => {
      if (ghost === null || ghost.isConnected === false) {
        ghost = document.createElement("div");
        ghost.className = DRAG_GHOST_CLASS;
        ghost.setAttribute("aria-hidden", "true");
        document.body.appendChild(ghost);
      }
      if (grab === null || grab.isConnected === false) {
        grab = document.createElement("div");
        grab.className = DRAG_GRAB_CLASS;
        grab.setAttribute("aria-hidden", "true");
        document.body.appendChild(grab);
      }
    };
    const chipIndexNear = (chips, clientX) => {
      let best = 0;
      let bestDistance = Infinity;
      for (let index = 0; index < chips.length; index += 1) {
        const box = chips[index].getBoundingClientRect();
        const distance = Math.abs(clientX - (box.left + box.width / 2));
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      }
      return best;
    };
    const caretAt = (root, clientX, clientY) => {
      if (root === null || typeof document.caretRangeFromPoint !== "function") return null;
      const range = document.caretRangeFromPoint(clientX, clientY);
      if (range === null || range === void 0) return null;
      if (root.contains(range.startContainer) === false) return null;
      const offset = offsetInDraft(root, range);
      const box = caretBoxOf(range);
      if (box === null) return { offset, left: clientX, top: clientY, height: 20 };
      return { offset, left: box.left, top: box.top, height: box.height };
    };
    const caretBoxOf = (range) => {
      const direct = range.getBoundingClientRect();
      if (direct.height > 0) return direct;
      const container = range.startContainer;
      if (container.nodeType !== Node.TEXT_NODE || container.data.length === 0) return null;
      const at = Math.min(range.startOffset, container.data.length - 1);
      const widened = range.cloneRange();
      widened.setStart(container, at);
      widened.setEnd(container, at + 1);
      const box = widened.getBoundingClientRect();
      if (box.height === 0) return null;
      return {
        left: range.startOffset <= at ? box.left : box.right,
        top: box.top,
        height: box.height
      };
    };
    const placeGrab = (chips, index) => {
      if (chips.length === 0) return;
      const at = Math.min(index, chips.length);
      const anchorChip = at < chips.length ? chips[at] : chips[chips.length - 1];
      const box = anchorChip.getBoundingClientRect();
      const left = at < chips.length ? box.left : box.right;
      grab.style.left = `${Math.round(left)}px`;
      grab.style.top = `${Math.round(box.top)}px`;
      grab.style.height = `${Math.round(box.height)}px`;
    };
    const cleanup = () => {
      if (ghost !== null) ghost.remove();
      if (grab !== null) grab.remove();
      ghost = null;
      grab = null;
      if (dragging !== null && dragging.element !== null) {
        dragging.element.removeAttribute("data-qc-dragging");
      }
      dragging = null;
      document.body.style.removeProperty("cursor");
    };
    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target.closest("[data-composer-chip]") : null;
      if (target === null) return;
      if (target.getAttribute("data-composer-chip") !== CHIP_SOURCE2) return;
      const chips = listChips();
      const index = chips.indexOf(target);
      if (index < 0) return;
      dragging = {
        element: target,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        index,
        ref: target.getAttribute("data-qc-ref"),
        label: target.getAttribute("data-qc-label") ?? "",
        kind: target.getAttribute("data-qc-kind") ?? "text"
      };
    };
    const onPointerMove = (event) => {
      if (dragging === null) return;
      if (dragging.active === false) {
        const dx = event.clientX - dragging.startX;
        const dy = event.clientY - dragging.startY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        dragging.active = true;
        ensureOverlay();
        dragging.element.setAttribute("data-qc-dragging", "true");
        ghost.textContent = dragging.label;
        ghost.setAttribute("data-qc-kind", dragging.kind);
        document.body.style.cursor = "grabbing";
      }
      event.preventDefault();
      ghost.style.left = `${Math.round(event.clientX)}px`;
      ghost.style.top = `${Math.round(event.clientY)}px`;
      const root = dragging.root ?? (dragging.element.closest('[contenteditable="true"]') ?? document.querySelector('[contenteditable="true"]'));
      dragging.root = root;
      const draftNow = dragging.draft ?? (dragging.draft = readDraft().draft ?? "");
      const caret = caretAt(root, event.clientX, event.clientY);
      if (caret === null || caret.offset === null) {
        const chips = listChips();
        placeGrab(chips, chipIndexNear(chips, event.clientX));
        return;
      }
      dragging.offset = Math.max(0, Math.min(caret.offset, draftNow.length));
      grab.style.left = `${Math.round(caret.left)}px`;
      grab.style.top = `${Math.round(caret.top)}px`;
      grab.style.height = `${Math.round(caret.height)}px`;
    };
    const finish = (commit) => {
      const state = dragging;
      if (state === null) return;
      if (state.active && commit) {
        const live = readDraft();
        const result = moveChipInDraft(live.draft, live.occurrences, source, state.ref, state.offset ?? 0);
        if (result !== null && typeof setDraft === "function") {
          setDraft(result);
          if (typeof onMoved === "function") onMoved();
        }
      }
      cleanup();
    };
    const onPointerUp = () => finish(true);
    const onKeyDown = (event) => {
      if (event.key === "Escape" && dragging !== null && dragging.active) {
        event.stopPropagation();
        finish(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerUp, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerUp, true);
      document.removeEventListener("keydown", onKeyDown, true);
      cleanup();
    };
  }

  // src/ui/cards.js
  var h3 = import_react4.default.createElement;
  var HOVER_LINGER_MS = 260;
  var CARD_EXIT_MS = 130;
  var SUPPRESS_MS = 400;
  var VIEWPORT_MARGIN2 = 8;
  var snap = (value) => Math.round(value * 100) / 100;
  function createCards({ composerContainer: composerContainer2 }) {
    function ChipCards2(props) {
      const { annotations, occurrences, labels, onJump, onRemove, setDraft, draft } = props;
      const actionsRef = import_react4.default.useRef({ onJump, onRemove });
      actionsRef.current = { onJump, onRemove };
      const [hover, setHover] = import_react4.default.useState(null);
      const hoverRef = import_react4.default.useRef(null);
      hoverRef.current = hover;
      const suppressUntil = import_react4.default.useRef(0);
      import_react4.default.useEffect(() => {
        if (typeof document === "undefined") return void 0;
        let frame = 0;
        let timer = 0;
        let consumedClickAt = 0;
        const dragConsumedClick = () => consumedClickAt !== 0 && Date.now() - consumedClickAt < 400;
        let closeTimer = 0;
        const marked = /* @__PURE__ */ new Set();
        const unmark = (chip) => {
          delete chip.dataset.qcNum;
          delete chip.dataset.qcKind;
          delete chip.dataset.qcLabel;
          delete chip.dataset.qcRef;
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
            chip.dataset.qcRef = annotation.id;
            marked.add(chip);
          }
          const alive = new Set(annotations.map((item) => item.id));
          for (const chip of [...marked]) {
            if (live.has(chip)) continue;
            const ref = chip.dataset.qcRef;
            if (ref !== void 0 && alive.has(ref)) {
              continue;
            }
            unmark(chip);
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
          if (Date.now() < suppressUntil.current) return;
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
            if (current !== null && current.annotation.id === annotation.id && current.anchor.left === snap(rect.left) && current.anchor.top === snap(rect.top) && current.anchor.width === snap(rect.width) && current.anchor.height === snap(rect.height)) return current;
            return { annotation, anchor: {
              left: snap(rect.left),
              top: snap(rect.top),
              width: snap(rect.width),
              height: snap(rect.height)
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
              left: snap(rect.left),
              top: snap(rect.top),
              width: snap(rect.width),
              height: snap(rect.height)
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
          if (dragConsumedClick()) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          const chip = chipOf(event);
          if (chip === null) return;
          const annotation = pairs().find((pair) => pair.chip === chip)?.annotation;
          if (annotation === void 0) return;
          event.preventDefault();
          event.stopPropagation();
          actionsRef.current.onJump(annotation);
        };
        document.addEventListener("click", onClick, true);
        const detachDrag = attachChipDragging({
          listChips: () => pairs().map((pair) => pair.chip),
          readDraft: () => ({ draft, occurrences }),
          setDraft,
          source: CHIP_SOURCE,
          onMoved: () => {
            consumedClickAt = Date.now();
          }
        });
        return () => {
          if (frame !== 0) cancelAnimationFrame(frame);
          clearTimeout(timer);
          if (closeTimer !== 0) clearTimeout(closeTimer);
          observer.disconnect();
          detachDrag();
          document.removeEventListener("mouseover", onPointer, true);
          document.removeEventListener("scroll", reposition, true);
          window.removeEventListener("resize", reposition);
          document.removeEventListener("click", onClick, true);
        };
      }, [annotations, occurrences, labels]);
      if (hover === null) return null;
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
                "--qc-chip-left": `${hover.anchor.left}px`,
                "--qc-chip-top": `${hover.anchor.top}px`,
                "--qc-chip-height": `${hover.anchor.height}px`
              },
              onMouseDown: (event) => event.preventDefault(),
              onClick: (event) => {
                event.preventDefault();
                event.stopPropagation();
                suppressUntil.current = Date.now() + SUPPRESS_MS;
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
      const dockedRef = import_react5.default.useRef(null);
      const dockedEdgeLockRef = import_react5.default.useRef(null);
      const previousBubbleTopRef = import_react5.default.useRef(null);
      const previousScrollTopRef = import_react5.default.useRef(null);
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
      const columnLimit = panelMaxWidth(findFlowElement());
      const width = columnLimit === null ? size.width || 320 : Math.min(size.width || 320, columnLimit);
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
      const DOCK_MARGIN = 24;
      const wasDocked = dockedRef.current !== null;
      const clearlyOut = anchoredTop < bandTop - DOCK_MARGIN || anchoredBottom > bandBottom + DOCK_MARGIN;
      const comfortablyVisible = anchoredTop >= bandTop + DOCK_MARGIN && anchoredBottom <= bandBottom - DOCK_MARGIN;
      const hasGeometry = rel !== null && rel.bubbleTop !== void 0;
      const panelScrollerNow = localScrollerOf(findFlowElement());
      const scrollerTopNow = panelScrollerNow === null || panelScrollerNow === void 0 ? 0 : panelScrollerNow.scrollTop;
      const anchorMoved = rel !== null && rel.bubbleTop !== void 0 && previousBubbleTopRef.current !== null && Math.abs(rel.bubbleTop - previousBubbleTopRef.current) > 1;
      const scrollMoved = previousScrollTopRef.current !== null && Math.abs(scrollerTopNow - previousScrollTopRef.current) > 1;
      const frozen = anchorMoved && scrollMoved === false;
      const needsDock = hasGeometry === false ? false : frozen ? wasDocked : wasDocked ? clearlyOut && comfortablyVisible === false : clearlyOut;
      const docks = hasText && needsDock;
      const dockTop = bandTop;
      const dockBottom = Math.max(bandTop, bandBottom - panelHeight);
      const lockedEdge = dockedEdgeLockRef.current;
      const dockedEdge = docks === false ? null : lockedEdge !== null && lockedEdge !== void 0 ? lockedEdge : Math.abs(anchoredTop - dockTop) <= Math.abs(dockBottom - anchoredTop) ? "top" : "bottom";
      dockedEdgeLockRef.current = dockedEdge;
      dockedRef.current = dockedEdge;
      previousBubbleTopRef.current = rel === null || rel.bubbleTop === void 0 ? null : rel.bubbleTop;
      previousScrollTopRef.current = scrollerTopNow;
      const previousEdgeRef = import_react5.default.useRef(void 0);
      const previousTopRef = import_react5.default.useRef(null);
      const previousScrollRef = import_react5.default.useRef(null);
      const glideRef = import_react5.default.useRef(null);
      import_react5.default.useLayoutEffect(() => {
        const element = ref.current;
        if (element === null) return;
        const running = glideRef.current;
        glideRef.current = null;
        if (running !== null && running !== void 0) {
          try {
            running.cancel();
          } catch {
          }
        }
        const viewportTop = element.getBoundingClientRect().top;
        const previousEdge = previousEdgeRef.current;
        const previousTop = previousTopRef.current;
        const previousScroll = previousScrollRef.current;
        const panelScroller = localScrollerOf(findFlowElement());
        const scrollNow = panelScroller === null || panelScroller === void 0 ? 0 : panelScroller.scrollTop;
        const scrolled = previousScroll !== null && scrollNow !== previousScroll;
        const edgeChanged = previousEdge !== void 0 && previousEdge !== dockedEdge;
        if (previousTop !== null) {
          const delta = previousTop - viewportTop;
          const reflowed = scrolled === false && previousEdge === dockedEdge;
          const settledDocked = dockedEdge !== null && edgeChanged === false;
          if (Math.abs(delta) > 2 && Math.abs(delta) < 400 && typeof element.animate === "function" && settledDocked === false && (edgeChanged || reflowed)) {
            glideRef.current = element.animate(
              [{ transform: `translateY(${delta}px)` }, { transform: "none" }],
              { duration: edgeChanged ? 260 : 90, easing: "cubic-bezier(.22,.61,.36,1)" }
            );
          }
        }
        previousEdgeRef.current = dockedEdge;
        previousTopRef.current = viewportTop;
        previousScrollRef.current = scrollNow;
      });
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
            // Capped by the text column. The stylesheet's own `min(320px, 80vw)` is a viewport rule and knows nothing
            // about the column, so it is overridden here rather than removed — the class-based width still applies when
            // the column cannot be measured.
            width: columnLimit === null ? void 0 : `${Math.round(width)}px`,
            visibility: size.width === 0 ? "hidden" : "visible"
          } : {
            left: `${left}px`,
            top: `${clampedTop}px`,
            width: columnLimit === null ? void 0 : `${Math.round(width)}px`,
            visibility: size.width === 0 ? "hidden" : "visible"
          },
          // The docked slot, exposed for the stylesheet and for probes. The glide is done with WAAPI above.
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
        const scroller = localScrollerOf(findFlowElement());
        const watch = () => {
          frame = window.requestAnimationFrame(watch);
          const bubble = document.querySelector(`.qc-marker[data-qc-for="${editingId}"]`);
          if (bubble === null) return;
          const box = bubble.getBoundingClientRect();
          const columnWidth = scroller === null || scroller === void 0 ? -1 : scroller.clientWidth;
          const key = `${Math.round(box.top)}:${Math.round(box.left)}:${columnWidth}`;
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
  var UNDO_MS = 5e3;
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
    const {
      registry: chipRegistry2,
      bridge: chipBridge2,
      jumpHandler: chipJumpHandler2,
      labelHandler: chipLabelHandler2
    } = chips;
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
      const undoRef = import_react8.default.useRef(null);
      const [undoPending, setUndoPending] = import_react8.default.useState(false);
      const [undoLeft, setUndoLeft] = import_react8.default.useState(0);
      const [undoToken, setUndoToken] = import_react8.default.useState(0);
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
        stale: t("card.stale"),
        removed: t("card.removed"),
        undo: t("card.undo"),
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
      import_react8.default.useEffect(() => {
        if (sessionId === void 0) return;
        const stale = staleChipRefs(occurrences, (ref) => chipRegistry2.has(ref), CHIP_SOURCE);
        if (stale.length === 0) return;
        if (typeof inputActions?.setDraft !== "function") return;
        let snapshot = { text: draft, references: occurrences };
        let removed = 0;
        for (const ref of stale) {
          const next = withoutChip(snapshot.text, snapshot.references, CHIP_SOURCE, ref);
          if (next === null) continue;
          snapshot = next;
          removed += 1;
        }
        if (removed === 0) return;
        inputActions.setDraft(snapshot);
        setNotice(labels.stale.replace("{n}", String(removed)));
      }, [chipRegistry2, draft, inputActions, labels, occurrences, sessionId]);
      const pruneOrphans = import_react8.default.useCallback(() => {
        if (sessionId === void 0) return 0;
        const dead = orphanedIds(annotations2, occurrences, CHIP_SOURCE);
        for (const id of dead) removeAnnotation(sessionId, id);
        return dead.length;
      }, [annotations2, occurrences, removeAnnotation, sessionId]);
      const commit = import_react8.default.useCallback((source, comment) => {
        if (sessionId === void 0) return;
        if (annotations2.length >= MAX_ANNOTATIONS2) pruneOrphans();
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
      }, [annotations2, sessionId, labels, pruneOrphans, writeChip]);
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
      import_react8.default.useEffect(() => {
        chipLabelHandler2.current = (ref) => {
          const ordinal = chipOrdinal(occurrences, CHIP_SOURCE, ref);
          return ordinal === null ? null : labels.content.replace("{n}", String(ordinal));
        };
        return () => {
          if (chipLabelHandler2.current !== null) chipLabelHandler2.current = null;
        };
      }, [occurrences, labels]);
      const readLiveDraft = import_react8.default.useCallback(() => {
        const state = inputStateRef.current;
        return {
          draft: typeof state?.draft === "string" ? state.draft : "",
          occurrences: Array.isArray(state?.occurrences) ? state.occurrences : []
        };
      }, []);
      const onRemove = import_react8.default.useCallback((annotation) => {
        if (sessionId === void 0) return;
        const live = readLiveDraft();
        const site = chipRemovalSite(live.draft, live.occurrences, CHIP_SOURCE, annotation.id);
        chipBridge2.release(inputActions, () => live, annotation.id);
        removeAnnotation(sessionId, annotation.id);
        undoRef.current = { annotation, site };
        setUndoPending(true);
        setUndoLeft(Math.ceil(UNDO_MS / 1e3));
        setUndoToken((value) => value + 1);
      }, [inputActions, readLiveDraft, sessionId]);
      import_react8.default.useEffect(() => {
        if (!undoPending) return void 0;
        const deadline = Date.now() + UNDO_MS;
        const tick = () => {
          const remaining = deadline - Date.now();
          if (remaining <= 0) {
            undoRef.current = null;
            setUndoPending(false);
            setUndoLeft(0);
            return;
          }
          setUndoLeft(Math.ceil(remaining / 1e3));
        };
        setUndoLeft(Math.ceil(UNDO_MS / 1e3));
        const timer = setInterval(tick, 250);
        return () => clearInterval(timer);
      }, [undoPending, undoToken]);
      const onUndoRemove = import_react8.default.useCallback(() => {
        if (sessionId === void 0) return;
        const entry = undoRef.current;
        undoRef.current = null;
        setUndoPending(false);
        setUndoLeft(0);
        if (entry === null) return;
        const { annotation, site } = entry;
        if (annotations2.length >= MAX_ANNOTATIONS2) pruneOrphans();
        const restored = addAnnotation(sessionId, {
          kind: annotation.kind,
          text: annotation.text,
          previewText: annotation.previewText,
          previewHtml: annotation.previewHtml,
          comment: annotation.comment,
          anchor: annotation.anchor
        });
        if (restored === null) {
          setNotice(labels.limit.replace("{max}", String(MAX_ANNOTATIONS2)));
          return;
        }
        if (!chipBridge2.placeAt(inputActions, readLiveDraft, restored, labels, site)) {
          setNotice(labels.unavailable);
        }
      }, [annotations2, inputActions, labels, pruneOrphans, readLiveDraft, sessionId]);
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
      import_react8.default.useEffect(() => {
        if (typeof document === "undefined") return void 0;
        const sync = () => {
          const editor = [...document.querySelectorAll('[contenteditable="true"]')].filter((element) => element.closest("[data-sidebar-right-tab]") === null).find((element) => element.getBoundingClientRect().height > 0);
          const box = editor?.getBoundingClientRect?.();
          if (box === void 0 || box === null || box.height === 0) return;
          const offset = Math.max(0, Math.round(window.innerHeight - box.top + 8));
          document.documentElement.style.setProperty("--qc-composer-offset", `${offset}px`);
        };
        sync();
        const timer = setInterval(sync, 500);
        window.addEventListener("resize", sync);
        return () => {
          clearInterval(timer);
          window.removeEventListener("resize", sync);
          document.documentElement.style.removeProperty("--qc-composer-offset");
        };
      }, []);
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
        h6(ChipCards2, {
          annotations: annotations2,
          occurrences,
          labels,
          onJump,
          onRemove,
          setDraft: inputActions?.setDraft,
          draft
        }),
        h6(MarkerLayer2, { annotations: annotations2, occurrences, labels, onJump, onHighlight, onUpdate, onRemove }),
        h6(TableAddButton2, { label: labels.tableAdd, onAdd: annotateTable }),
        // The whole bar is the control.
        //
        // It used to be a container whose only live region was a small button inside it, and pressing the middle of the
        // bar did nothing — reported as "the undo button is hard to hit". A single button makes every pixel work, and the
        // label reads as the action it performs rather than as a caption.
        undoPending ? h6(
          "button",
          {
            type: "button",
            className: "qc-undo",
            onClick: onUndoRemove,
            title: labels.undo
          },
          h6("span", { className: "qc-undo-text" }, labels.removed),
          h6("span", { className: "qc-undo-action", "aria-hidden": "true" }, labels.undo),
          // A thin bar that drains over the life of the window, so the deadline is visible rather than surprising.
          h6("span", {
            className: "qc-undo-meter",
            "aria-hidden": "true",
            style: { "--qc-undo-left": String(undoLeft) }
          })
        ) : null,
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
    labelHandler,
    t,
    CHIP_TRIGGER: CHIP_TRIGGER2,
    CHIP_SOURCE: CHIP_SOURCE3,
    CHIP_PLACEHOLDER: CHIP_PLACEHOLDER2,
    serializeChipForModel: serializeChipForModel2
  }) {
    ctx.effect(() => {
      const handle = ctx.inject(["inputTriggers"], (scope) => {
        const triggers = scope.inputTriggers;
        if (triggers === void 0 || typeof triggers.registerSource !== "function") return void 0;
        return triggers.registerSource({
          trigger: CHIP_TRIGGER2,
          name: CHIP_SOURCE3,
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
                const reason = typeof t === "function" ? t("card.staleSend") : `quote-chat: no payload for chip "${ref}" (the draft outlived the page)`;
                return Promise.reject(new Error(reason));
              }
              const live = typeof labelHandler?.current === "function" ? labelHandler.current(ref) : null;
              return Promise.resolve(serializeChipForModel2(
                typeof live === "string" && live !== "" ? { ...payload, label: live } : payload
              ));
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
  var chipLabelHandler = { current: null };
  function applyImpl(ctx) {
    installStyles(ctx);
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), "quote-chat: dictionaries");
    const t = ctx.locale.bind(NS);
    registerSideChatTab({ ctx, t, TAB_ID, TAB_KIND, NS, SideChatTab });
    registerReferenceSource({
      ctx,
      registry: chipRegistry,
      jumpHandler: chipJumpHandler,
      labelHandler: chipLabelHandler,
      t,
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
        chips: {
          registry: chipRegistry,
          bridge: chipBridge,
          jumpHandler: chipJumpHandler,
          labelHandler: chipLabelHandler
        },
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
