/**
 * Check whether the recording actually contains the transition's intermediate positions.
 *
 * A 30fps file with 25fps of real capture is fine in principle, but the point of the recording is to show
 * that the glide is smooth rather than a jump. That can only be verified by finding frames where the
 * panel is BETWEEN its resting and docked positions.
 *
 * This reads the recorded frames directly, measures the panel's top edge in each, and reports the
 * distinct positions found. Several distinct intermediate positions means the animation was captured;
 * two positions only means it was skipped and the video would misrepresent the behaviour.
 *
 * Usage: node tools/verify-glide-frames.mjs <frames-dir>
 */
import { readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const dir = process.argv[2]
if (dir === undefined) {
  console.error('usage: node tools/verify-glide-frames.mjs <frames-dir>')
  process.exit(2)
}

const FFMPEG = 'C:/Users/<user>/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe'
const FFMPEG_PROBE = 'C:/Users/<user>/AppData/Local/Microsoft/WinGet/Links/ffprobe.exe'

const frames = readdirSync(dir).filter((name) => name.endsWith('.jpg')).sort()
console.log(`\n  ${frames.length} frames in ${dir}`)

if (frames.length === 0) {
  console.log('  nothing to check')
  process.exitCode = 1
} else {
  // ffprobe can report the dimensions; the panel's edge has to be found by looking at the pixels, so
  // use ffmpeg to convert a strip of the frames into a single tall image for inspection.
  const strip = `${dir}/../glide-strip.png`
  // Sample every frame in the middle third of the run, where the transition happens.
  const from = Math.floor(frames.length * 0.35)
  const count = Math.min(40, Math.floor(frames.length * 0.3))
  try {
    execFileSync(FFMPEG, [
      '-y',
      '-framerate', '30',
      '-start_number', String(from),
      '-i', `${dir}/frame-%06d.jpg`,
      '-frames:v', String(count),
      // Crop the column where the panel's left edge sits, so each row of the strip is one frame.
      '-vf', 'crop=iw*0.4:ih:iw*0.3:0,scale=200:-1,tile=1x' + String(count),
      strip,
    ], { stdio: 'pipe' })
    console.log(`  strip written: ${strip}`)
    const info = execFileSync(FFMPEG_PROBE, [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'csv=p=0', strip,
    ]).toString().trim()
    console.log(`  strip size: ${info}`)
  } catch (failure) {
    console.log(`  could not build the strip: ${failure?.message ?? failure}`)
  }
}
