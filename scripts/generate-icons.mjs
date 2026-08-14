// ============================================================================
// SideQuest app-icon generator.
//
// Reads the master icon artwork (assets/app-icon.jpg) and regenerates every
// icon the app ships:
//
//   * Android legacy launcher icons (ic_launcher / ic_launcher_round) at all
//     five densities — mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}
//   * Android adaptive-icon foregrounds (ic_launcher_foreground) — the artwork
//     scaled into the 66/108 safe zone on a transparent canvas
//   * The web favicon (public/icon.png, 512×512)
//
// The source JPEG renders the rounded-square artwork's transparency as black
// corner cutaways, so the first step keys out near-black pixels and composites
// the artwork onto its own cream background — turning it into a seamless
// square tile. The sampled cream also becomes the adaptive-icon background
// colour (@color/ic_launcher_background), so the mask-shaped icon blends with
// the foreground.
//
// Run with:  npm run icons
// ============================================================================

import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(root, 'assets', 'app-icon.jpg')

// Legacy icon sizes per density (px). Adaptive foreground canvases are 2.25×
// the legacy size (108/48), matching the standard Android mipmap convention.
const DENSITIES = [
  { name: 'mdpi', legacy: 48 },
  { name: 'hdpi', legacy: 72 },
  { name: 'xhdpi', legacy: 96 },
  { name: 'xxhdpi', legacy: 144 },
  { name: 'xxxhdpi', legacy: 192 },
]

/** Fraction of the adaptive canvas the artwork occupies (safe zone 66/108). */
const SAFE_ZONE = 66 / 108

/**
 * Loads the artwork and produces a seamless square cream tile:
 *   1. trims the near-black (transparent) margin around the artwork,
 *   2. keys out the rounded-corner cutaways,
 *   3. composites it onto its cream background (sampled from the tile edges).
 * Returns { tile: sharp instance, background: hex string }.
 */
async function loadTile() {
  const meta = await sharp(SOURCE).metadata()
  const size = Math.min(meta.width, meta.height)

  // Find the artwork's bounding box (any pixel that isn't the black margin).
  const raw = await sharp(SOURCE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { data, info } = raw
  const isBlack = (x, y) => {
    const i = (y * info.width + x) * 4
    return Math.max(data[i], data[i + 1], data[i + 2]) < 12
  }
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1
  for (let y = 0; y < info.height; y += 2) {
    for (let x = 0; x < info.width; x += 2) {
      if (isBlack(x, y)) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) throw new Error('No artwork found in the source image')

  // Crop to a centred square around the artwork.
  const tileSize = Math.max(maxX - minX + 1, maxY - minY + 1)
  const left = Math.max(0, Math.min(minX, info.width - tileSize))
  const top = Math.max(0, Math.min(minY, info.height - tileSize))
  const img = sharp(SOURCE).extract({ left, top, width: tileSize, height: tileSize })

  // Sample the background from the mid-edges (well inside the corner cutaways).
  const bgSamples = []
  for (const [fx, fy] of [[0.5, 0.07], [0.07, 0.5], [0.93, 0.5], [0.5, 0.93]]) {
    const px = await img
      .clone()
      .extract({ left: Math.floor(tileSize * fx), top: Math.floor(tileSize * fy), width: 2, height: 2 })
      .raw()
      .toBuffer()
    bgSamples.push([px[0], px[1], px[2]])
  }
  const bg = [0, 1, 2].map((ch) =>
    Math.round(bgSamples.reduce((sum, s) => sum + s[ch], 0) / bgSamples.length),
  )
  const background = `#${bg.map((c) => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase()

  // Chroma-key near-black pixels to transparent (a smooth ramp avoids a hard
  // fringe on JPEG edges), then flatten onto the cream background.
  const keyed = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { data: kd, info: ki } = keyed
  const out = Buffer.alloc(kd.length)
  for (let i = 0; i < kd.length; i += 4) {
    const max = Math.max(kd[i], kd[i + 1], kd[i + 2])
    // Fully transparent below 12, fully opaque above 30, linear ramp between.
    const alpha = Math.round(Math.min(1, Math.max(0, (max - 12) / 18)) * 255)
    out[i] = kd[i]
    out[i + 1] = kd[i + 1]
    out[i + 2] = kd[i + 2]
    out[i + 3] = alpha
  }

  const tile = sharp(out, { raw: { width: ki.width, height: ki.height, channels: 4 } }).flatten({
    background,
  })

  return { tile, background }
}

async function main() {
  const { tile, background } = await loadTile()

  for (const d of DENSITIES) {
    const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res', `mipmap-${d.name}`)

    // Legacy launcher icons: the full square tile.
    await tile.clone().resize(d.legacy, d.legacy).png().toFile(path.join(resDir, 'ic_launcher.png'))
    await tile.clone().resize(d.legacy, d.legacy).png().toFile(path.join(resDir, 'ic_launcher_round.png'))

    // Adaptive foreground: artwork scaled into the safe zone on a transparent
    // canvas the density-appropriate size.
    const canvas = Math.round(d.legacy * 2.25)
    const content = Math.round(canvas * SAFE_ZONE)
    const offset = Math.round((canvas - content) / 2)
    await sharp({
      create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        {
          input: await tile.clone().resize(content, content).png().toBuffer(),
          left: offset,
          top: offset,
        },
      ])
      .png()
      .toFile(path.join(resDir, 'ic_launcher_foreground.png'))

    console.log(`✓ mipmap-${d.name} (legacy ${d.legacy}px, adaptive canvas ${canvas}px)`)
  }

  // Web favicon (512×512).
  await tile.clone().resize(512, 512).png().toFile(path.join(root, 'public', 'icon.png'))
  console.log('✓ public/icon.png (512×512)')

  // Adaptive-icon background colour — keep it in sync with the artwork's cream.
  const colorsPath = path.join(root, 'android', 'app', 'src', 'main', 'res', 'values', 'ic_launcher_background.xml')
  const colorsXml = readFileSync(colorsPath, 'utf8')
  const updated = colorsXml.replace(
    /<color name="ic_launcher_background">#[0-9A-Fa-f]{6}<\/color>/,
    `<color name="ic_launcher_background">${background}</color>`,
  )
  if (updated === colorsXml) throw new Error('Could not find ic_launcher_background colour to update')
  writeFileSync(colorsPath, updated)
  console.log(`✓ ic_launcher_background -> ${background}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
