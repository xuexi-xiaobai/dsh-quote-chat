/**
 * The three things this plugin registers with the host, one function each.
 *
 * Every registration has the same shape: open an `effect`, wait for the service it needs with
 * `ctx.inject`, return a disposer. `ctx.inject` hands back either a function or an object with
 * `dispose`, so `asEffect` adapts it — that adaptation used to be copy-pasted at the end of all
 * three blocks, where a change to the convention would have had three homes to find.
 *
 * They live here rather than in the entry so the entry reads as wiring: what exists, in what order,
 * with which collaborators. This file is the boundary where the plugin meets the host's registries.
 *
 * Constants and helpers arrive through each function's parameters rather than by import, because
 * they are declared in the entry and moving them would be a separate change.
 */

/**
 * Adapt whatever `ctx.inject` returned into an effect disposer.
 *
 * @param handle - a disposer function, an object with `dispose`, or nothing.
 * @returns a function safe to call more than once.
 */
function asEffect(handle) {
  const release = typeof handle === 'function' ? handle : handle?.dispose?.bind(handle)
  return () => { if (typeof release === 'function') release() }
}

/**
 * Register the side-chat tab type and its pane.
 *
 * Optional by design: a host without `sidebarRightTabs` keeps the annotation workflow and disables
 * the "ask in side chat" action, rather than failing to load.
 *
 * @param options - `{ ctx, t, TAB_ID, TAB_KIND, NS, SideChatTab }`.
 */
export function registerSideChatTab({ ctx, t, TAB_ID, TAB_KIND, NS, SideChatTab }) {
  ctx.effect(() => {
    const handle = ctx.inject(['sidebarRightTabs'], (scope) => {
      const tabs = scope.sidebarRightTabs
      if (tabs === undefined || typeof tabs.register !== 'function') return
      const disposers = []
      try {
        disposers.push(tabs.register({
          id: TAB_ID,
          kind: TAB_KIND,
          title: () => t('side.title'),
          guide: [{
            id: 'quote-chat',
            order: 55,
            title: () => t('side.title'),
            description: () => t('side.guide')
          }]
        }))
        disposers.push(scope.slots.inject('sidebar.right.pane.tab', () => scope.slots.register({
          name: 'sidebar.right.pane.tab',
          key: TAB_ID,
          locale: NS,
          inject: () => ({ pluginCtx: ctx })
        }, SideChatTab)))
      } catch (error) {
        for (const dispose of disposers.splice(0)) dispose()
        console.error('[dsh-quote-chat] right-sidebar registration failed:', error)
        return undefined
      }
      return () => { for (const dispose of disposers.splice(0)) dispose() }
    })
    return asEffect(handle)
  }, 'quote-chat: side-chat tab type')
}

/**
 * Register the reference source.
 *
 * This is what makes an annotation a chip rather than stray text: the framework calls
 * `codec.serialize` on submit to turn the chip into the model's copy of the passage, and
 * `openReference` when the chip is clicked. Without it a chip is an inert token with no owner.
 *
 * @param options - `{ ctx, registry, jumpHandler, CHIP_TRIGGER, CHIP_SOURCE, CHIP_PLACEHOLDER,
 *   serializeChipForModel }`.
 */
export function registerReferenceSource({
  ctx, registry, jumpHandler, CHIP_TRIGGER, CHIP_SOURCE, CHIP_PLACEHOLDER, serializeChipForModel,
}) {
  ctx.effect(() => {
    const handle = ctx.inject(['inputTriggers'], (scope) => {
      const triggers = scope.inputTriggers
      if (triggers === undefined || typeof triggers.registerSource !== 'function') return undefined
      return triggers.registerSource({
        trigger: CHIP_TRIGGER,
        name: CHIP_SOURCE,
        openReference(_session, reference) {
          const jump = jumpHandler.current
          if (typeof jump !== 'function') return false
          // The chip knows which annotation it is; the dock knows where that
          // annotation's passage sits in the flow.
          return jump(reference?.ref) === true
        },
        codec: {
          clipboardText: () => CHIP_PLACEHOLDER,
          serialize(ref) {
            const payload = registry.get(ref)
            if (payload === undefined) {
              return Promise.reject(new Error(`quote-chat: unknown chip "${ref}"`))
            }
            return Promise.resolve(serializeChipForModel(payload))
          }
        }
      })
    })
    return asEffect(handle)
  }, 'quote-chat: reference source')
}

/**
 * Register the annotation strip and its floating surfaces.
 *
 * @param options - `{ ctx, NS, buildDock }`, where `buildDock` returns the dock component.
 */
export function registerAnnotationDock({ ctx, NS, buildDock }) {
  ctx.effect(() => {
    const release = ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
      name: 'conversation.input.dock',
      id: 'quote-chat-annotations',
      order: 15,
      locale: NS
    }, buildDock()))
    return () => { if (typeof release === 'function') release() }
  }, 'quote-chat: annotation dock')
}
