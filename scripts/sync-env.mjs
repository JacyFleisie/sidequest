#!/usr/bin/env node
/**
 * Keeps `.env` in sync across machines so new installs need no manual key entry.
 *
 * `.env.defaults` is committed — it holds only PUBLIC client-side values
 * (Supabase URL, publishable key, Turnstile site key) that ship inside every
 * web build and APK anyway. Secrets-protected tooling never touches it.
 *
 * Runs automatically before `dev`, `build`, `apk` and `release`:
 *   1. Creates `.env` from `.env.defaults` when `.env` doesn't exist.
 *   2. Appends any keys missing from `.env` (never overwrites local values).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const defaultsPath = `${root}.env.defaults`
const envPath = `${root}.env`

if (!existsSync(defaultsPath)) {
  console.log('[env] no .env.defaults found — skipping sync')
  process.exit(0)
}

const defaults = readFileSync(defaultsPath, 'utf8')
const defaultLines = defaults
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))

if (!existsSync(envPath)) {
  writeFileSync(envPath, defaults)
  console.log('[env] created .env from .env.defaults')
  process.exit(0)
}

const existing = readFileSync(envPath, 'utf8')
const existingKeys = new Set(
  existing
    .split('\n')
    .map((l) => l.split('=')[0].trim())
    .filter(Boolean),
)

let out = existing
let added = 0
for (const line of defaultLines) {
  const key = line.split('=')[0].trim()
  if (!existingKeys.has(key)) {
    out += (out.endsWith('\n') ? '' : '\n') + line + '\n'
    added++
  }
}

if (added > 0) {
  writeFileSync(envPath, out)
  console.log(`[env] added ${added} missing key(s) to .env (from .env.defaults)`)
} else {
  console.log('[env] .env already up to date')
}
