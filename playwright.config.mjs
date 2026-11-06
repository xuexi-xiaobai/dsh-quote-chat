/**
 * Playwright configuration for the design workbench.
 *
 * This is a SEPARATE runner from `npm test`. `npm test` is a chain of static source checks that need no browser; the
 * design workbench needs one, and it needs the capture conditions to be identical on every run - which is the whole
 * point of a visual baseline.
 *
 * The conditions pinned here are the ones that change pixels:
 *
 *   viewport      fixed, so the composer wraps at the same place
 *   deviceScaleFactor 2, so 1px details are reviewable
 *   locale/timezone   fixed, so font fallback and any date text do not drift
 *   animations    disabled, so a capture never lands mid-transition
 *   caret         hidden, so a blinking caret cannot differ between two runs
 *   threshold     a small per-pixel tolerance for antialiasing, but zero tolerance for layout
 *
 * `snapshotPathTemplate` puts the baselines next to the fixture, in `design/baseline/`, because they are reviewed
 * artefacts rather than build output.
 */
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './design',
  // One worker: the captures are cheap, and parallel workers would make a failure harder to attribute.
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  // The workbench is a local review tool, not a CI gate by default; `--reporter=dot` is enough in a loop.
  forbidOnly: false,
  use: {
    viewport: { width: 900, height: 220 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    // The fixture needs no server: every state is `page.setContent`, so there is no baseURL and no webServer.
  },
  expect: {
    toHaveScreenshot: {
      // Antialiasing differs by a hair between runs on the same machine; layout differences do not.
      threshold: 0.02,
      maxDiffPixels: 40,
      animations: 'disabled',
      caret: 'hide',
      scale: 'device',
    },
  },
  snapshotPathTemplate: '{testDir}/baseline/{arg}{ext}',
})
