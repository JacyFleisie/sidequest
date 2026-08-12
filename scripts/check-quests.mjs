#!/usr/bin/env node
// ============================================================================
// SideQuest — quest data quality checker
//
// Scans the quest data files and flags problems so the map grows clean:
//   * missing province / city / region
//   * coordinates outside South Africa (or missing entirely)
//   * duplicate quest ids
//   * duplicate titles within ~1 km of each other
//   * missing cost / duration / players (unfillable quest cards)
//   * anywhere quests that still carry stray coordinates
//
// Usage:  node scripts/check-quests.mjs
// ============================================================================
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const FILES = ['src/data/hangouts.ts', 'src/data/social.ts', 'src/data/quests.ts', 'src/data/places.ts', 'src/data/seasonal.ts', 'src/data/events.ts']

const PROVINCES = new Set(['GP', 'WC', 'KZN', 'EC', 'FS', 'LP', 'MP', 'NW', 'NC'])
// Rough SA bounding box (Cape Agulhas → Musina, Alexander Bay → Kosi Bay).
const SA = { minLat: -35.0, maxLat: -22.0, minLng: 16.3, maxLng: 33.0 }

/** Extracts the N-th top-level q({…}) block's balanced braces from a file. */
function extractBlocks(src) {
  const blocks = []
  let i = 0
  while (i < src.length) {
    const start = src.indexOf('q({', i)
    if (start === -1) break
    let depth = 0
    let j = start + 2 // first char is '{'
    while (j < src.length) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') {
        depth--
        if (depth === 0) break
      }
      j++
    }
    if (depth !== 0) break
    blocks.push(src.slice(start + 2, j))
    i = j
  }
  return blocks
}

const field = (block, name) => {
  const m = block.match(new RegExp(`${name}\\s*:\\s*([^,\\n]+)`))
  return m ? m[1].trim().replace(/^'|'$/g, '').replace(/^"|"$/g, '') : null
}

const playersField = (block) => block.match(/players\s*:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/)

const seenIds = new Map()
const seenTitles = new Map()
const issues = []
let total = 0

for (const file of FILES) {
  let src = ''
  try {
    src = readFileSync(join(root, file), 'utf8')
  } catch {
    continue
  }
  const blocks = extractBlocks(src)
  for (const block of blocks) {
    const id = field(block, 'id')
    const title = field(block, 'title')
    const province = field(block, 'province')
    const city = field(block, 'city')
    const region = field(block, 'region')
    const lat = parseFloat(field(block, 'lat') ?? '')
    const lng = parseFloat(field(block, 'lng') ?? '')
    const cost = field(block, 'cost')
    const duration = field(block, 'durationMin')
    const players = playersField(block)
    const anywhere = block.includes('anywhere: true')
    // Skip programmatic chain-building blocks (template-literal ids), not real quests.
    if (/\$\{/.test(block)) continue
    total++

    const where = `[${file.replace('src/data/', '')}] ${title ?? id ?? '?'}`

    if (!id) issues.push(`✗ ${where} — missing id`)
    else if (seenIds.has(id)) issues.push(`✗ ${where} — DUPLICATE id (also used by ${seenIds.get(id)})`)
    else seenIds.set(id, where)

    if (!title) issues.push(`✗ ${where} — missing title`)
    else if (seenTitles.has(title)) {
      const other = seenTitles.get(title)
      const [aLat, aLng] = other.loc.split(',').map(Number)
      const [bLat, bLng] = [lat, lng].map(Number)
      const d = haversine(aLat, aLng, bLat, bLng)
      if (!isNaN(d) && d < 1) issues.push(`✗ ${where} — duplicate title within ${d.toFixed(2)} km of ${other.where}`)
    } else seenTitles.set(title, { where, loc: `${lat},${lng}` })

    if (!PROVINCES.has(province)) issues.push(`✗ ${where} — bad/missing province: ${province}`)
    if (!city) issues.push(`✗ ${where} — missing city`)
    if (!region && !anywhere) issues.push(`✗ ${where} — missing region`)

    if (anywhere) {
      if (!isNaN(lat) && lat !== 0 && !isNaN(lng) && lng !== 0)
        issues.push(`⚠ ${where} — anywhere quest carries coordinates (${lat}, ${lng})`)
    } else {
      if (isNaN(lat) || isNaN(lng)) issues.push(`✗ ${where} — missing lat/lng`)
      else if (lat < SA.minLat || lat > SA.maxLat || lng < SA.minLng || lng > SA.maxLng)
        issues.push(`✗ ${where} — coordinates outside South Africa (${lat}, ${lng})`)
    }

    if (cost === null || cost === undefined) issues.push(`✗ ${where} — missing cost`)
    if (duration === null || duration === undefined) issues.push(`✗ ${where} — missing durationMin`)
    if (!players) issues.push(`✗ ${where} — missing/invalid players`)
  }
}

function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

console.log(`\n📊 Quest data check — ${total} quests scanned\n`)
if (issues.length === 0) {
  console.log('✅ All clean — no issues found.')
} else {
  console.log(issues.join('\n'))
  console.log(`\n⚠️  ${issues.length} issue(s)`)
}
process.exit(issues.length > 0 ? 1 : 0)
