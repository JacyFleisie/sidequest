import { useMemo, useState } from 'react'
import { ALL_QUESTS, CATEGORY_META, type Category, type Quest } from '../data/quests'
import { fmtCost, fmtDuration } from '../lib/game'
import { chainShareUrl, copyText, shareViaNative } from '../lib/share'
import { useGame, type CustomChain } from '../lib/store'
import { Button, Chip, QuestStats } from './ui'

const EMOJIS = ['🎯', '🗺️', '🚗', '🍔', '🌳', '🏆', '🎲', '🔥', '🦁', '🏖️', '⛰️', '🎨']

const uid = (): string => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export default function ChainBuilder() {
  const { customChains, saveCustomChain, deleteCustomChain, startCustomChain, startGenerated } = useGame()
  const [added, setAdded] = useState<Quest[]>([])
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('🎯')
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<Category | 'all'>('all')
  const [toast, setToast] = useState<string | null>(null)

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }

  const addedIds = useMemo(() => new Set(added.map((q) => q.id)), [added])

  const pool = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ALL_QUESTS.filter((x) => {
      if (cat !== 'all' && x.category !== cat) return false
      if (!q) return true
      return (
        x.title.toLowerCase().includes(q) ||
        x.city.toLowerCase().includes(q) ||
        x.tags.some((t) => t.toLowerCase().includes(q)) ||
        x.category.includes(q)
      )
    }).sort((a, b) => a.city.localeCompare(b.city))
  }, [query, cat])

  const add = (quest: Quest) => {
    if (addedIds.has(quest.id)) return
    setAdded((prev) => [...prev, quest])
    if (!title) setTitle(quest.title.length > 24 ? `${quest.title.slice(0, 24)}…` : quest.title)
  }

  const remove = (id: string) => setAdded((prev) => prev.filter((q) => q.id !== id))

  const move = (index: number, dir: -1 | 1) => {
    setAdded((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const stats = useMemo(() => {
    const durationMin = added.reduce((a, q) => a + q.durationMin, 0)
    const cost = added.reduce((a, q) => a + q.cost, 0)
    const players: [number, number] =
      added.length === 0
        ? [1, 1]
        : [Math.min(...added.map((q) => q.players[0])), Math.max(...added.map((q) => q.players[1]))]
    const xp = added.reduce((a, q) => a + q.xp, 0) + 150
    return { durationMin, cost, players, xp }
  }, [added])

  const finalTitle = title.trim() || (added[0] ? added[0].title : 'My Quest')

  const persist = (): CustomChain | null => {
    if (added.length < 2) {
      flash('Add at least 2 stops to save a quest.')
      return null
    }
    const chain: CustomChain = {
      id: uid(),
      title: finalTitle,
      emoji,
      questIds: added.map((q) => q.id),
      createdAt: new Date().toISOString(),
    }
    saveCustomChain(chain)
    return chain
  }

  const share = async () => {
    if (added.length < 2) {
      flash('Add at least 2 stops before sharing.')
      return
    }
    const url = chainShareUrl(finalTitle, emoji, added.map((q) => q.id))
    const text = `${emoji} ${finalTitle} — ${added.length} stops · ${fmtDuration(stats.durationMin)} · ${fmtCost(stats.cost)}/person. Join me on SideQuest!`
    const native = await shareViaNative(text, url)
    if (native) return
    const ok = await copyText(url)
    flash(ok ? '📋 Link copied — send it to your crew!' : "Couldn't copy the link. Try again.")
  }

  const shareSaved = async (chain: CustomChain) => {
    const quests = chain.questIds
      .map((id) => ALL_QUESTS.find((q) => q.id === id))
      .filter((q): q is Quest => Boolean(q))
    if (quests.length < 2) return
    const url = chainShareUrl(chain.title, chain.emoji, chain.questIds)
    const duration = quests.reduce((a, q) => a + q.durationMin, 0)
    const cost = quests.reduce((a, q) => a + q.cost, 0)
    const text = `${chain.emoji} ${chain.title} — ${quests.length} stops · ${fmtDuration(duration)} · ${fmtCost(cost)}/person. Join me on SideQuest!`
    const native = await shareViaNative(text, url)
    if (native) return
    const ok = await copyText(url)
    flash(ok ? '📋 Link copied — send it to your crew!' : "Couldn't copy the link. Try again.")
  }

  const startCurrent = () => {
    if (added.length < 2) {
      flash('Add at least 2 stops to start.')
      return
    }
    startGenerated(added, finalTitle, emoji)
  }

  return (
    <div className="page builder">
      <header className="page-head">
        <div className="bored-banner">🔧 ASSEMBLE YOUR OWN</div>
        <h1 className="page-title">Chain Builder</h1>
        <p className="page-sub">
          Pick stops from the whole of South Africa, order them, and share your quest with friends.
        </p>
      </header>

      {/* Current chain */}
      <section className="builder-chain">
        <div className="builder-chain-head">
          <span className="builder-emoji-pick">{emoji}</span>
          <input
            className="chain-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={added.length === 0 ? 'Name your quest…' : finalTitle}
          />
        </div>
        <div className="builder-emoji-row">
          {EMOJIS.map((e) => (
            <button
              key={e}
              className={`emoji-opt ${e === emoji ? 'emoji-opt-active' : ''}`}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>

        {added.length === 0 ? (
          <div className="builder-empty">Your quest is empty. Tap ➕ on stops below to add them — in order!</div>
        ) : (
          <div className="builder-steps">
            {added.map((q, i) => (
              <div className="builder-step" key={q.id}>
                <div className="builder-step-num">{i + 1}</div>
                <div className="builder-step-main">
                  <div className="builder-step-title">
                    {q.emoji} {q.title}
                  </div>
                  <div className="builder-step-meta">
                    {q.city} · {fmtDuration(q.durationMin)} · {fmtCost(q.cost)} · +{q.xp} XP
                  </div>
                </div>
                <div className="builder-step-actions">
                  <button className="move-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                    ↑
                  </button>
                  <button
                    className="move-btn"
                    disabled={i === added.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button className="remove-btn" onClick={() => remove(q.id)} aria-label="Remove">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <QuestStats durationMin={stats.durationMin} cost={stats.cost} players={stats.players} />

        <div className="builder-actions">
          <Button variant="gold" disabled={added.length < 2} onClick={startCurrent}>
            ▶ START QUEST
          </Button>
          <Button variant="ghost" disabled={added.length < 2} onClick={share}>
            📤 SHARE
          </Button>
          <Button variant="ghost" disabled={added.length < 2} onClick={() => { const c = persist(); if (c) flash('💾 Saved to your quests.') }}>
            💾 SAVE
          </Button>
        </div>
      </section>

      {/* Add stops */}
      <section className="builder-pool">
        <h2 className="section-title">➕ Add stops</h2>
        <p className="section-sub">{pool.length} quests · search or filter</p>
        <div className="search-bar builder-search">
          <span className="search-icon">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search kota, waterfall, mall, Durban…"
          />
        </div>
        <div className="chips-row">
          <Chip label="All" active={cat === 'all'} onClick={() => setCat('all')} />
          {Object.entries(CATEGORY_META).map(([id, meta]) => (
            <Chip
              key={id}
              label={meta.label}
              emoji={meta.emoji}
              active={cat === id}
              color={meta.color}
              onClick={() => setCat(id as Category)}
            />
          ))}
        </div>
        <div className="builder-quest-list">
          {pool.slice(0, 60).map((q) => (
            <div className={`builder-quest ${addedIds.has(q.id) ? 'builder-quest-added' : ''}`} key={q.id}>
              <div className="builder-quest-emoji">{q.emoji}</div>
              <div className="builder-quest-main">
                <div className="builder-quest-title">{q.title}</div>
                <div className="builder-quest-meta">
                  {q.city} · {q.provinceName} · {fmtDuration(q.durationMin)} · {fmtCost(q.cost)}
                </div>
              </div>
              <button
                className="builder-add-btn"
                disabled={addedIds.has(q.id)}
                onClick={() => add(q)}
                aria-label={addedIds.has(q.id) ? 'Added' : 'Add'}
              >
                {addedIds.has(q.id) ? '✓' : '＋'}
              </button>
            </div>
          ))}
          {pool.length > 60 && <div className="builder-more">…{pool.length - 60} more — refine your search</div>}
          {pool.length === 0 && <div className="empty-state">Nothing found for “{query}”. Try something else.</div>}
        </div>
      </section>

      {/* Saved quests */}
      {customChains.length > 0 && (
        <section className="builder-saved">
          <h2 className="section-title">💾 My quests</h2>
          <p className="section-sub">Your saved chains — start, share or delete.</p>
          {customChains.map((chain) => {
            const quests = chain.questIds
              .map((id) => ALL_QUESTS.find((q) => q.id === id))
              .filter(Boolean) as Quest[]
            const duration = quests.reduce((a, q) => a + q.durationMin, 0)
            const cost = quests.reduce((a, q) => a + q.cost, 0)
            return (
              <div className="saved-card" key={chain.id}>
                <div className="saved-emoji">{chain.emoji}</div>
                <div className="saved-main">
                  <div className="saved-title">{chain.title}</div>
                  <div className="saved-meta">
                    {quests.length} stops · {fmtDuration(duration)} · {fmtCost(cost)}
                  </div>
                  <div className="saved-actions">
                    <button className="saved-action saved-action-start" onClick={() => startCustomChain(chain)}>
                      ▶ Start
                    </button>
                    <button className="saved-action" onClick={() => shareSaved(chain)}>
                      📤 Share
                    </button>
                    <button className="saved-action saved-action-del" onClick={() => deleteCustomChain(chain.id)}>
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {toast && <div className="builder-toast">{toast}</div>}
    </div>
  )
}
