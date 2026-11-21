# Token Radar — NOTES.md (methodology)

Entry for `token-radar-01`. Snapshot: DefiLlama protocols fetched
2026-11-14 (`as_of` in the snapshot), 758 protocols at or above $5M TVL,
40 on the house watchlist, floor $50M. All figures below come from that
sealed snapshot; no TVL or price was invented, and no live data was fetched
while building this entry.

## 1. "Records no token"

A protocol is pre-token when **all three** snapshot fields are null:
`mcap_usd`, `gecko_id`, `symbol`. That is DefiLlama's record, never proof
the protocol has no token — a protocol may have a token its record does
not carry. The dashboard says "no token on record" everywhere, never
"has no token". Live-token protocols (any of the three present) are kept
apart in the Live tab with their real market caps and are never ranked.

## 2. Removing wrapped / staked / bridged products

The house watchlist rule is applied to the **whole board**, not just the
watchlist, in `isWrappedOrExcluded` (`lib/model.ts`):

- category in Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking,
  Restaked BTC, CEX;
- name carrying a whole word `wrapped`, `staked` or `staking`
  (case-insensitive);
- name ending in a version marker (` V2`, ` v2`, ` 2.0`, …);
- name beginning with an exchange name (Binance, Coinbase, Bybit, Kraken,
  Bitget, OKX, Bitfinex, Gemini).

`parentProtocol` is not one of the snapshot's ten fields, so it cannot be
checked directly; the category / name / version rules above are the
snapshot-visible part of the house rule. This is why, for example, WBTC
and Binance staked ETH are not rankable even though they record no token
of their own in the usual sense — each is a wrapped/staked product of a
token that already trades.

Result: 198 rankable protocols — all 40 watchlist slugs plus 158
pre-token protocols the watchlist does not name: 138 below the $50M
floor, and 20 above it. Those 20 (e.g. Sentora Curator, Polymarket
International, Mellow Core, Figure Markets Prime, CIAN Yield Layer) pass
every snapshot-visible rule yet are not on the house watchlist, which
almost certainly means DefiLlama records a `parentProtocol` for them —
a field the snapshot does not carry, so it cannot be checked here. They
are kept on the board (they record no token and pass every visible rule)
and flagged here rather than silently dropped or hand-excluded by name:
excluding them would need a hardcoded name list, which the value model
is built to avoid. A reader should treat those 20 as weaker candidates
than the watchlist 40 — they may be a child product of another protocol
rather than a standalone launch.

## 3. Implied value (model `radar-2`, `impliedValue` in `lib/model.ts`)

```
implied = round(tvl_usd x category_multiple
                x (1 + clamp(change_7d, -50, +100)/100 x 0.6)
                x (0.65 + min(age_days, 1095)/1095 x 0.35)
                x chain_breadth)
chain_breadth = min(1.10, 1 + 0.02 x min(chains - 1, 5))
```

- **Category multiple** (`calibrateMultiples`): for each category with at
  least 3 live-token comparables in this snapshot, the median
  market-cap / TVL of those comparables, shrunk toward the global median
  (`(n·median + 8·global) / (n + 8)`) and clamped to [0.03, 0.80].
  Categories with fewer than 3 comparables use the global median
  (0.2138x on this snapshot). One live record carries `mcap_usd: -1`
  (AUTOfinance) — a bad sentinel, not a real market cap — so the
  calibration only counts live protocols with `mcap_usd > 0` (128 of
  them); counting the -1 would drag the median to 0.2049x. The multiples
  are recomputed from the snapshot on every run — a future snapshot
  re-prices the board instead of replaying a hand-kept list, and no
  protocol name is special-cased.
  Calibrated multiples on this snapshot include Lending 0.16x, Dexs
  0.29x, RWA 0.25x, Basis Trading 0.42x, Yield 0.20x; the full table is
  rendered in the dashboard's model panel.
- **Growth**: the snapshot's `change_7d`, clamped to [-50%, +100%] so a
  single-week spike (the snapshot's max is +4448%) cannot dominate.
  Missing growth is treated as 0%.
- **Maturity**: days since `listed_at` (age), capped at 3 years; unknown
  listing date uses 365 days. Longer-running with no token on record
  scores higher — more time to accumulate users worth rewarding.
- **Chain breadth**: small bonus for protocols live on more chains.

Top of the board on this snapshot: Steakhouse Financial ≈ $526M,
Sentora Curator ≈ $494M, Gauntlet ≈ $316M, Veda ≈ $298M, USDD ≈ $184M.
The board spans ≈ $526M down to ≈ $0.65M, so it is a real ranking, not a
tie. Implied value is this entry's own claim about what a launch could
be worth if the record stayed as it is — not a price, and not a
prediction that a token will be issued, or when.

## 4. Farm plans

`farmSteps` in `lib/model.ts` derives six steps per protocol from its own
record only — category (which action: supply, provide liquidity, bridge,
stake, deposit margin, place a market, deposit into a vault, mint a
stable / yield asset, buy cover, send a payment), first chain (gas guide:
Ethereum $5–$15/tx, Solana/Bitcoin under $1, others $1–$3), TVL tier
(capital $50 / $100 / $150 / $250) and age (hold 30 / 45 / 60 days).
Every step states its cost and its time. Step 5 is a safety step (never
pay to claim, never sign from a DM link, revoke approvals). The dashboard
renders the exact strings `board.json` carries — it does not regenerate
them — so screenshots, code and board agree.

## 5. What the snapshot does not contain (limits, stated honestly)

- No revenue, fees, user counts, points programs or airdrop flags — so
  the model cannot use them, and the farm plans cannot promise points
  exist for a given protocol.
- No `parentProtocol` field — wrapped/staked detection uses only the
  snapshot-visible rules in §2; a product whose parent is invisible in
  the snapshot could slip through if its name/category do not betray it.
- `change_7d` is null for some protocols (treated as 0% growth) and
  `listed_at` is null for some (age treated as 365 days).
- Category multiples rest on few comparables for some categories
  (minimum 3, shrunk toward the global median); a category whose live
  comparables are unrepresentative will mis-price its pre-token peers.
  The dashboard shows the comparable count beside every multiple so a
  reader can see how thin the evidence is.

## 6. Files

- `main.ts` — entrypoint: reads the snapshot, writes `board.json`,
  `data.js`, copies `dashboard/` + `screenshots/`, writes `dossier.json`.
- `lib/model.ts` — the model, the farm plans, snapshot parsing, gate checks.
- `vendor/makefun-board.ts` — the kit's dossier library, copied verbatim.
- `dashboard/` — `index.html`, `app.css`, `app.js`; static, no network.
  `data.js` (written by `main.ts` beside `dashboard/`) carries the board,
  the live set and the calibrated multiples.
- `screenshots/` — board, detail, filtered views (see §7).
- `LICENSE` — MIT (SPDX line included), copied from the kit starter.

## 7. Screenshots

No Chrome/Chromium/Firefox was installed on this machine at build time.
`npx playwright install chromium` was run: the first attempt stalled and
timed out downloading Chrome for Testing from the Playwright CDN (a
socket timeout after ~7 minutes); a second attempt, after clearing the
stale install lock, completed and installed `chromium-1255` and
`chromium_headless_shell-1255`. The three screenshots are real renders
of `out/dashboard/` in headless Chromium at 1440x900, taken with a fresh
page per view (an earlier run reused one page, so the hash-only
navigations did not reload and all three shots were identical — that
batch was discarded and retaken). Files: `1-board.jpg` (board, 125 KB),
`2-detail.jpg` (Steakhouse Financial detail drawer, 149 KB),
`3-filtered.jpg` (Category = Lending, 16 rows, 123 KB). All were
visually inspected: the board, the detail drawer with its model
breakdown and six farm steps, and the filtered view all render as
intended.
