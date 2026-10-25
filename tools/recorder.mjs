/**
 * Record a browser acceptance run and save it as a playable video.
 *
 * Playwright MCP exposes no video recorder, but it does take reliable screenshots and
 * ffmpeg is present on this machine. So a run is captured as a dense frame sequence and
 * stitched afterwards. That is enough to review a gesture frame by frame — which is exactly
 * what "did the popup appear where the pointer was" needs.
 *
 * Frames are numbered so ordering survives a failed run, and the stitcher is separate from
 * the capture so a crash mid-run still leaves inspectable frames.
 *
 * Usage as a library:
 *   const recorder = createRecorder(page, outDir)
 *   await recorder.frame('before click')
 *   …action…
 *   await recorder.frame('after click')
 *   await recorder.finish()          -> writes recording.mp4
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Playwright MCP only writes inside its allowed roots (the workspace and .playwright-mcp),
 * so recordings must live there. Callers pass an output directory; this asserts it is one.
 */
const FFMPEG = 'C:\\Users\\Ethan cole\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffmpeg.exe'

/** Frames per second of the produced video; also the pause inserted after each frame. */
const FPS = 2

/**
 * Create a recorder bound to one page and output directory.
 * @param page - a browser handle exposing `call(tool, args)`.
 * @param outDir - directory for frames and the finished video.
 * @returns { frame, finish }.
 */
export function createRecorder(page, outDir) {
  mkdirSync(outDir, { recursive: true })

  // Clear stale frames so a re-run does not mix sequences.
  for (const name of readdirSync(outDir)) {
    if (name.startsWith('frame-') || name === 'recording.mp4') {
      rmSync(join(outDir, name), { force: true })
    }
  }

  let index = 0
  const frames = []

  /**
   * Capture one frame.
   * @param label - short description folded into the file name, so the sequence is readable
   *   even without playing the video.
   */
  async function frame(label) {
    const safe = label.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40)
    const name = `frame-${String(index).padStart(4, '0')}-${safe}.png`
    index += 1
    const path = join(outDir, name)
    try {
      await page.call('browser_take_screenshot', { filename: path })
      frames.push(path)
      // A short pause keeps the frame count in step with wall-clock time, so the video's
      // pacing matches how long each step actually took.
      await new Promise((resolve) => setTimeout(resolve, 1000 / FPS))
    } catch {
      // A failed screenshot must not abort the run; the assertion still tells the story.
    }
    return path
  }

  /**
   * Stitch the captured frames into an mp4.
   *
   * Frames are written as `frame-NNNN-label.png`, but ffmpeg's `image2` demuxer needs a
   * purely numeric pattern, so the stitcher first copies them to a sequential run of
   * `seq-NNNN.png`. The `glob` pattern type is not compiled into this ffmpeg build
   * ("globbing is not supported by this libavformat build"), so it cannot be used.
   *
   * @returns the video path, or null when there was nothing to encode.
   */
  async function finish() {
    if (frames.length === 0) return null
    const video = join(outDir, 'recording.mp4')
    if (!existsSync(FFMPEG)) return null

    const seqDir = join(outDir, 'seq')
    rmSync(seqDir, { recursive: true, force: true })
    mkdirSync(seqDir, { recursive: true })
    frames.forEach((source, index) => {
      copyFileSync(source, join(seqDir, `seq-${String(index).padStart(4, '0')}.png`))
    })

    try {
      execFileSync(FFMPEG, [
        '-y',
        '-framerate', String(FPS),
        '-start_number', '0',
        '-i', join(seqDir, 'seq-%04d.png'),
        // Even dimensions are required by yuv420p.
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-crf', '23',
        video,
      ], { stdio: 'ignore' })
      return video
    } catch {
      return null
    } finally {
      rmSync(seqDir, { recursive: true, force: true })
    }
  }

  return { frame, finish, count: () => frames.length }
}
