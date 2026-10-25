/**
 * The platform seam: React and ReactDOM, resolved at CALL time rather than import time.
 *
 * Why this indirection exists: the Host hands the plugin a `require` function, and that
 * function — not a global — is how React arrives. But ES module imports are evaluated when the
 * bundle's module graph runs, which happens before `__ModuleLoader__` calls the factory. A
 * top-level `import React from 'react'` therefore asks for React too early and throws.
 *
 * So the platform is captured once inside the factory, and every consumer reads it through
 * these functions. They throw a named error if read too early, which turns a confusing
 * `undefined is not a function` into a precise message.
 *
 * What this module does NOT do: it holds no UI, no registration and no state, and it never
 * imports React itself — that would reintroduce the eager-evaluation problem it exists to
 * solve.
 */

/** Captured platform modules. */
let react = null
let reactDom = null

/**
 * Capture the Host's platform modules. Called once, from the factory.
 * @param require - the Host's synchronous require.
 */
export function bindPlatform(require) {
  if (react !== null) {
    throw new Error('dsh-quote-chat: the Host factory ran more than once')
  }
  react = require('react')
  reactDom = require('react-dom')
  if (react === undefined || react === null) {
    throw new Error('dsh-quote-chat: the Host did not provide "react"')
  }
  if (reactDom === undefined || reactDom === null || typeof reactDom.createPortal !== 'function') {
    throw new Error('dsh-quote-chat: the Host did not provide "react-dom" with createPortal')
  }
}

/**
 * The React namespace.
 * @returns the module the Host supplied.
 */
export function getReact() {
  if (react === null) {
    throw new Error('dsh-quote-chat: React was read before the Host provided it')
  }
  return react
}

/**
 * The ReactDOM namespace.
 * @returns the module the Host supplied.
 */
export function getReactDom() {
  if (reactDom === null) {
    throw new Error('dsh-quote-chat: ReactDOM was read before the Host provided it')
  }
  return reactDom
}
