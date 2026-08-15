#!/usr/bin/env node
/**
 * Regenerates the README screenshots (assets/screenshots/*.png) from the live app.
 *
 * - Boots its own Vite dev server in OFFLINE mode (empty Supabase env vars), so
 *   it never signs in anonymously or writes to the database.
 * - Drives the installed Chrome/Edge headlessly at a 390×844 phone viewport.
 * - Seeds a realistic demo profile into localStorage (this device only), so the
 *   screens look alive without touching the live DB.
 *
 * Usage: npm run screenshots
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

// scripts/ is one level below the project root.
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT_DIR = path.join(ROOT, 'assets', 'screenshots')
const PORT = 5217
const BASE = `http://localhost:${PORT}`

// ── Browser detection (system Chrome/Edge — no bundled download) ────────────
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean)
const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!executablePath) {
  console.error('No Chrome/Edge found — set CHROME_PATH to your browser executable.')
  process.exit(1)
}

// ── Demo profile seeded into localStorage (never sent to any server) ─────────
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 864e5).toISOString()
const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const SEED = {
  version: 1,
  playerName: 'Jacy',
  homeBaseId: 'jhb',
  startPlace: { label: 'Johannesburg', lat: -26.2041, lng: 28.0473 },
  feedPlace: { label: 'Johannesburg', lat: -26.2041, lng: 28.0473 },
  xp: 1890,
  streak: 4,
  lastQuestDate: dateKey(new Date()),
  completed: {
    'maboneng-art-walk': { at: iso(3), xp: 500 },
    'constitution-hill': { at: iso(3), xp: 320 },
    'melville-diner-race': { at: iso(2), xp: 300 },
    'union-buildings-sunset': { at: iso(2), xp: 230 },
    'walter-sisulu-walk': { at: iso(1), xp: 220 },
    'zoo-lake-paddle': { at: iso(1), xp: 180 },
    'vilakazi-history': { at: iso(0), xp: 140 },
  },
  memories: [],
  activeSession: null,
  lastCompletion: null,
  seenIntro: true,
  customChains: [],
  customQuests: [],
  friends: [
    { id: 'f1', name: 'Kabelo', emoji: '🐆', addedAt: iso(6) },
    { id: 'f2', name: 'Naledi', emoji: '🦒', addedAt: iso(5) },
    { id: 'f3', name: 'Amy', emoji: '🦁', addedAt: iso(4) },
  ],
  recentGenerated: [],
}

const SHOTS = [
  { file: 'home.png', path: '/', settle: 1800 },
  { file: 'map.png', path: '/map', settle: 4500 },
  { file: 'feed.png', path: '/feed', settle: 2500 },
  { file: 'friends.png', path: '/friends', settle: 2000 },
  { file: 'profile.png', path: '/profile', settle: 1500 },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function probe() {
  return new Promise((resolve) => {
    const req = http.get(BASE, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1200, () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function startServer() {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const child = spawn(
    npmCmd,
    ['run', 'dev', '--', '--port', String(PORT), '--strictPort'],
    {
      // Empty Supabase vars → the app boots in offline/demo mode (no client,
      // no anonymous sign-in, no DB writes). This is what keeps screenshots
      // from creating test accounts in the live database.
      env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    },
  )
  child.stdout?.on('data', (d) => process.stdout.write(`[vite] ${d}`))
  child.stderr?.on('data', (d) => process.stderr.write(`[vite] ${d}`))
  for (let i = 0; i < 60; i += 1) {
    if (await probe()) return child
    await sleep(500)
  }
  child.kill()
  throw new Error('Dev server did not become ready')
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  console.log(`[shots] booting offline dev server on :${PORT}`)
  const server = await startServer()

  let browser
  try {
    console.log(`[shots] launching ${executablePath}`)
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
    page.on('pageerror', (e) => console.log(`[shots] pageerror: ${e.message}`))

    // Seed the demo profile, then reload so the app mounts with it.
    // NB: we wait for DOM content only, never 'networkidle' — vite's HMR
    // WebSocket keeps the network busy forever, and background fetches
    // (events feed, release check) shouldn't gate the capture.
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await sleep(2500)
    await page.evaluate((seed) => {
      localStorage.setItem('sidequest-state-v1', JSON.stringify(seed))
      localStorage.setItem('sidequest-last-seen-version', '1.0.22')
    }, SEED)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 })
    await sleep(2500)

    for (const shot of SHOTS) {
      await page.goto(`${BASE}${shot.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await sleep(shot.settle) // let map tiles / feed shuffle settle
      const out = path.join(OUT_DIR, shot.file)
      await page.screenshot({ path: out, type: 'png' })
      console.log(`[shots] wrote ${out}`)
    }

    await browser.close()
    browser = null
  } finally {
    if (browser) await browser.close()
    server.kill()
  }
  console.log('[shots] done')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
