// Token Radar — value model (radar-4, category-calibrated, evidence-weighted).
//
// The board ranks every protocol in the sealed snapshot that RECORDS NO TOKEN
// and is not a wrapped / staked / bridged product of a token that already
// trades. "Records no token" is DefiLlama's record, never proof a protocol
// has no token: a protocol may still have one its record does not carry.
//
// Implied value is computed from the snapshot's own figures only, in seven
// factors — no protocol name is ever special-cased:
//
//   1. Category multiple: the median market-cap / TVL ratio of the
//      LIVE-token protocols in the SAME category in this snapshot
//      (at least 3 comparables, shrunk toward the global median and
//      clamped to [0.03, 0.80]); categories with fewer than 3 live
//      comparables use the global median. This is the market's own
//      pricing of that kind of protocol, recomputed on every run, so a
//      future snapshot re-prices the board instead of replaying a list.
//   2. Growth: clamp(change_7d, -50, +100)%, weight 0.6.
//   3. Maturity: 0.65 + min(age_days, 1095) / 1095 * 0.35, where age is
//      days since DefiLlama first listed the protocol; unknown age = 365.
//      A protocol that has run longer with no token on record has had
//      longer to accumulate users worth rewarding at launch.
//   4. Chain breadth: 1 + 0.02 * min(chains - 1, 5), at most 1.10.
//      A protocol live on more chains reaches more farmers.
//   5. Momentum: growth relative to the median 7d growth of the
//      category's rankable peers, clamped to +/-30 points, weight 0.3.
//      A protocol outgrowing its own category is nearer a launch than
//      one riding the category's drift.
//   6. Dominance: share of the category's rankable TVL, capped at a 50%
//      share, weight 0.2. The protocol that leads its category is the
//      one a launch would price first.
//   7. Evidence adjustment: the category multiple is only as good as the
//      live comparables behind it. A row priced from 10+ comparables
//      keeps its full value (strong, x1.00); 3-9 comparables keep 90%
//      (fair, x0.90); a row priced on the global median with fewer than
//      3 comparables keeps 70% (thin, x0.70). A valuation built on a
//      guess is discounted, in the open, instead of presented at full
//      price beside one built on evidence.
//
//   implied = round(tvl_usd * category_multiple * growth_mult
//                   * maturity_mult * chain_mult * momentum_mult
//                   * dominance_mult * evidence_mult), at least $1.
//
// Each row also carries a confidence grade (strong/fair/thin, from how
// many live comparables price its category), scannable signals (HOT,
// COOLING, THIN, 1-CHAIN, LONG WAIT, NEW), and a one-line verdict built
// from its own factors. (Radar-3's "implied value per $1 farmed" is gone:
// implied value divided by a $50-$250 farm ticket is a multi-million
// dollar figure per dollar that reads as innumerate, not informative.)
//
// Exclusions (the house watchlist rule, applied to the WHOLE board, not
// just the watchlist): category Bridge / Canonical Bridge / Liquid
// Staking / Liquid Restaking / Restaked BTC / CEX; a name carrying a whole
// word "wrapped", "staked" or "staking"; a name ending in a version marker
// (" V2", " v2", " 2.0", ...); a name beginning with an exchange name
// (Binance, Coinbase, Bybit, Kraken, Bitget, OKX, Bitfinex, Gemini).
// Live-token protocols (any of mcap_usd / gecko_id / symbol present) are
// kept apart in the Live view with their real market caps, never ranked.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  min_comparables: number;
  shrink_prior: number;
  multiple_floor: number;
  multiple_cap: number;
  chain_step: number;
  chain_cap: number;
  momentum_weight: number;
  momentum_cap: number;
  dominance_step: number;
  dominance_share_cap: number;
  /** Evidence haircut on the final implied value: strong (10+ comparables). */
  confidence_strong: number;
  /** Evidence haircut: fair (3-9 comparables). */
  confidence_fair: number;
  /** Evidence haircut: thin (<3 comparables, global median used). */
  confidence_thin: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.65,
  maturity_range: 0.35,
  maturity_days: 1095,
  unknown_age_days: 365,
  min_comparables: 3,
  shrink_prior: 8,
  multiple_floor: 0.03,
  multiple_cap: 0.8,
  chain_step: 0.02,
  chain_cap: 1.1,
  momentum_weight: 0.3,
  momentum_cap: 30,
  dominance_step: 0.2,
  dominance_share_cap: 0.5,
  confidence_strong: 1.0,
  confidence_fair: 0.9,
  confidence_thin: 0.7,
};

export const MODEL_VERSION = 'radar-4';
export const LIVE_ROWS = 24;

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    comparables: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    momentum_multiplier: number;
    dominance_multiplier: number;
    /** Evidence haircut applied to the final implied value (1.00 / 0.90 / 0.70). */
    confidence_multiplier: number;
    age_days: number | null;
  };
  /** Growth of this protocol minus the median 7d growth of its category's rankable peers, in points. */
  relative_growth: number;
  /** Share of the category's rankable TVL, 0..1. */
  category_share: number;
  /** 'strong' = 10+ live comparables, 'fair' = 3-9, 'thin' = priced on the global median. */
  confidence: 'strong' | 'fair' | 'thin';
  /** Scannable flags: HOT, COOLING, THIN, 1-CHAIN, LONG WAIT, NEW. */
  signals: string[];
  /** One plain-language verdict built from this row's own factors. */
  verdict: string;
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiple: number;
  comparables: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  momentum_multiplier: number;
  dominance_multiplier: number;
  /** Evidence haircut applied to the final implied value (1.00 / 0.90 / 0.70). */
  confidence_multiplier: number;
  /** Growth of this protocol minus the median 7d growth of its category's rankable peers, in points. */
  relative_growth: number;
  /** Share of the category's rankable TVL, 0..1. */
  category_share: number;
  confidence: 'strong' | 'fair' | 'thin';
  signals: string[];
  verdict: string;
  farm_steps: string[];
  watchlist: boolean;
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface CategoryMultiple {
  category: string;
  multiple: number;
  comparables: number;
  median_ratio: number;
}

export interface CategoryStat {
  category: string;
  rows: number;
  total_implied_usd: number;
  total_tvl_usd: number;
  median_multiple: number;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  global_multiple: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  total_implied_usd: number;
  category_multiples: CategoryMultiple[];
  category_stats: CategoryStat[];
  rows: RadarRow[];
  live: LiveRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCLUDED_CATEGORIES = new Set([
  'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX',
]);
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** True when DefiLlama records no token at all for the protocol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** True when the protocol looks like a wrapped / staked / bridged product, a versioned pool, or an exchange product. */
export function isWrappedOrExcluded(p: SnapshotProtocol): boolean {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return true;
  if (WRAPPED_WORD.test(p.name)) return true;
  if (VERSIONED.test(p.name)) return true;
  return EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x));
}

/** A protocol the board may rank: pre-token and not a wrapped/staked product. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !isWrappedOrExcluded(p);
}

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

/**
 * The category multiples, calibrated from this snapshot's live-token
 * protocols: for each category with >= min_comparables live protocols,
 * the median mcap/TVL shrunk toward the global median; every other
 * category falls back to the global median. Returns the global median,
 * the per-category table (for the dashboard), and a lookup.
 */
export function calibrateMultiples(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { global: number; table: CategoryMultiple[]; lookup: Map<string, { multiple: number; comparables: number }> } {
  const live = snapshot.protocols.filter(
    (p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
  const ratios = live.map((p) => p.mcap_usd! / p.tvl_usd);
  const global = ratios.length > 0 ? median(ratios) : 0.2;
  const byCat = new Map<string, number[]>();
  for (const p of live) {
    if (p.category === null) continue;
    const list = byCat.get(p.category) ?? [];
    list.push(p.mcap_usd! / p.tvl_usd);
    byCat.set(p.category, list);
  }
  const table: CategoryMultiple[] = [];
  const lookup = new Map<string, { multiple: number; comparables: number }>();
  for (const [cat, list] of [...byCat.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (list.length < model.min_comparables) continue;
    const med = median(list);
    const shrunk = (list.length * med + model.shrink_prior * global) / (list.length + model.shrink_prior);
    const multiple = round4(Math.min(model.multiple_cap, Math.max(model.multiple_floor, shrunk)));
    table.push({ category: cat, multiple, comparables: list.length, median_ratio: round4(med) });
    lookup.set(cat, { multiple, comparables: list.length });
  }
  return { global: round4(global), table, lookup };
}

export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  multiple: number,
  model: ModelConstants,
  peerMedianGrowth: number | null = null,
  categoryShare: number = 0,
): { implied: number; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; momentumMult: number; dominanceMult: number; relativeGrowth: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), 5);
  const chainMult = Math.min(model.chain_cap, 1 + extraChains * model.chain_step);
  // Momentum: growth relative to the category's rankable peers. A protocol
  // outgrowing its own category is nearer a launch than one riding the
  // category's drift; a protocol lagging its peers is marked down. Clamped
  // to +/-30 points so one wild week cannot dominate.
  const relativeGrowth =
    peerMedianGrowth === null
      ? 0
      : Math.min(model.momentum_cap, Math.max(-model.momentum_cap, rawGrowth - peerMedianGrowth));
  const momentumMult = 1 + (relativeGrowth / 100) * model.momentum_weight;
  // Dominance: share of the category's rankable TVL. The protocol that
  // leads its category is the one a launch would price first; the boost
  // caps at a 50% share so a one-protocol category cannot run away.
  const dominanceMult = 1 + Math.min(Math.max(categoryShare, 0), model.dominance_share_cap) * model.dominance_step;
  const implied = Math.max(
    1,
    Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult * chainMult * momentumMult * dominanceMult),
  );
  return { implied, growthPct, growthMult, maturityMult, chainMult, momentumMult, dominanceMult, relativeGrowth, age };
}

/**
 * Per category, the median 7d growth of its rankable protocols (nulls
 * skipped; categories with fewer than 3 growth readings get no median).
 * Computed over the rankable set only, so live-token protocols never set
 * the peer bar for pre-token ones.
 */
export function categoryPeerMedians(rankable: SnapshotProtocol[]): Map<string, number> {
  const byCat = new Map<string, number[]>();
  for (const p of rankable) {
    if (p.category === null || p.change_7d === null || !Number.isFinite(p.change_7d)) continue;
    const list = byCat.get(p.category) ?? [];
    list.push(p.change_7d);
    byCat.set(p.category, list);
  }
  const out = new Map<string, number>();
  for (const [cat, list] of byCat) {
    if (list.length >= 3) out.set(cat, median(list));
  }
  return out;
}

/** Per category, the total TVL of its rankable protocols. */
export function categoryTotals(rankable: SnapshotProtocol[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of rankable) {
    out.set(p.category ?? 'Other', (out.get(p.category ?? 'Other') ?? 0) + p.tvl_usd);
  }
  return out;
}

export function confidenceFor(comparables: number): 'strong' | 'fair' | 'thin' {
  if (comparables >= 10) return 'strong';
  if (comparables >= 3) return 'fair';
  return 'thin';
}

/** Evidence haircut on the final implied value, from the confidence grade. */
export function confidenceMultiplier(
  confidence: 'strong' | 'fair' | 'thin',
  model: ModelConstants = MODEL,
): number {
  if (confidence === 'strong') return model.confidence_strong;
  if (confidence === 'fair') return model.confidence_fair;
  return model.confidence_thin;
}

/** Scannable flags for a row, from its own record only. */
export function signalsFor(
  p: SnapshotProtocol,
  age: number | null,
  comparables: number,
): string[] {
  const signals: string[] = [];
  const growth = finite(p.change_7d, 0);
  if (p.change_7d !== null && p.change_7d >= 10) signals.push('HOT');
  if (p.change_7d !== null && p.change_7d <= -10) signals.push('COOLING');
  if (comparables < 3) signals.push('THIN');
  if (p.chains.length <= 1) signals.push('1-CHAIN');
  if (age !== null && age > 1095) signals.push('LONG WAIT');
  if (age !== null && age < 180) signals.push('NEW');
  return signals;
}

/** One plain-language verdict for a row, built from its own factors only. */
export function verdictFor(args: {
  rank: number;
  name: string;
  category: string | null;
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  chains: string[];
  category_multiple: number;
  comparables: number;
  relative_growth: number;
  category_share: number;
  confidence: 'strong' | 'fair' | 'thin';
}): string {
  const a = args;
  // Each strength is a participle or adjective phrase, because the
  // sentence is "Ranks #N because it is <strength>, and <strength>."
  // Radar-3 shipped finite verbs here ("because it is leads ...");
  // radar-4 keeps the grammar straight.
  const strengths: string[] = [];
  if (a.change_7d !== null && a.change_7d >= 10) {
    strengths.push(`growing fast at +${a.change_7d.toFixed(1)}% in 7 days`);
  }
  if (a.relative_growth >= 10) {
    strengths.push(`outgrowing its category peers by ${a.relative_growth.toFixed(1)} points`);
  }
  if (a.category_share >= 0.3) {
    strengths.push(`leading its category with ${(a.category_share * 100).toFixed(0)}% of the category's pre-token TVL`);
  }
  if (a.age_days !== null && a.age_days >= 730) {
    strengths.push(`running ${(a.age_days / 365).toFixed(1)} years with no token on record`);
  }
  if (a.chains.length >= 8) {
    strengths.push(`live on ${a.chains.length} chains`);
  }
  if (strengths.length === 0) {
    strengths.push(`carrying $${Math.round(a.tvl_usd / 1e6)}M of TVL priced at a ${a.category_multiple.toFixed(2)}x category multiple`);
  }
  const risks: string[] = [];
  if (a.confidence === 'thin') {
    risks.push(`priced on the global median — only ${a.comparables} live comparables in its category, so its value is discounted 30%`);
  }
  if (a.change_7d !== null && a.change_7d <= -10) {
    risks.push(`TVL fell ${a.change_7d.toFixed(1)}% in 7 days`);
  }
  if (a.chains.length <= 1) {
    risks.push('live on one chain only');
  }
  if (a.age_days !== null && a.age_days < 180) {
    risks.push(`listed only ${a.age_days} days ago`);
  }
  const watch = risks.length > 0 ? risks.join('; ') : 'nothing in the record argues against it';
  return `Ranks #${a.rank} because it is ${strengths.join(', and ')}. Watch: ${watch}.`;
}

function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const { lookup, global } = calibrateMultiples(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, in full.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable protocol in the snapshot, by
  // TVL order of consideration — no cap beyond the rankable set itself.
  // Wrapped / staked / bridged / versioned / exchange products are out,
  // and live-token protocols never enter.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const rankable = [...chosen.values()];
  // Radar-3 factors, both computed over the rankable set only: the median
  // 7d growth of each category's rankable peers (momentum) and each
  // category's total rankable TVL (dominance).
  const peerMedians = categoryPeerMedians(rankable);
  const totals = categoryTotals(rankable);
  const scored = rankable.map((p) => {
    const entry = p.category !== null ? lookup.get(p.category) : undefined;
    const multiple = entry?.multiple ?? global;
    const comparables = entry?.comparables ?? 0;
    const peerMedian = p.category !== null ? peerMedians.get(p.category) ?? null : null;
    const catTotal = totals.get(p.category ?? 'Other') ?? p.tvl_usd;
    const share = catTotal > 0 ? p.tvl_usd / catTotal : 0;
    const v = impliedValue(p, snapshot.as_of, multiple, model, peerMedian, share);
    // Radar-4: the evidence haircut. A row priced on the global median
    // with no live comparables behind its multiple is discounted 30%
    // before ranking; the board ranks evidence-weighted value, not a
    // raw guess presented at full price.
    const confidence = confidenceFor(comparables);
    const confMult = confidenceMultiplier(confidence, model);
    const adjusted = Math.max(1, Math.round(v.implied * confMult));
    return { p, multiple, comparables, share, confidence, confMult, adjusted, ...v };
  });
  scored.sort((a, b) => b.adjusted - a.adjusted || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const signals = signalsFor(s.p, s.age, s.comparables);
    const verdict = verdictFor({
      rank: i + 1,
      name: s.p.name,
      category: s.p.category,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      age_days: s.age,
      chains: s.p.chains,
      category_multiple: s.multiple,
      comparables: s.comparables,
      relative_growth: s.relativeGrowth,
      category_share: s.share,
      confidence: s.confidence,
    });
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      age_days: s.age,
      implied_value_usd: s.adjusted,
      model: {
        category_multiple: s.multiple,
        comparables: s.comparables,
        growth_pct: s.growthPct,
        // Full precision here, not round4: the dashboard recomputes the
        // row from these exact numbers, and rounded factors would make
        // its check disagree with board.json by a few dollars.
        growth_multiplier: s.growthMult,
        maturity_multiplier: s.maturityMult,
        chain_multiplier: s.chainMult,
        momentum_multiplier: s.momentumMult,
        dominance_multiplier: s.dominanceMult,
        confidence_multiplier: s.confMult,
        age_days: s.age,
      },
      confidence: s.confidence,
      signals,
      relative_growth: round4(s.relativeGrowth),
      category_share: round4(s.share),
      verdict,
      farm_steps: farmSteps(s.p, s.age).map(stepText),
    };
  });
}

export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Typical gas for one transaction on the protocol's first chain (a rough guide, not a quote). */
function gasGuide(chain: string): string {
  if (chain === 'Ethereum') return 'about $5 to $15 of gas per transaction';
  if (chain === 'Solana' || chain === 'Bitcoin') return 'under $1 of gas per transaction';
  return 'about $1 to $3 of gas per transaction';
}

function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and, if you are comfortable with the risk, borrow a small amount against it.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} in a balanced pair and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app instead of bridging straight back.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token in the same wallet.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position, then close it the same week.`;
  if (c.includes('prediction')) return `Fund $${capital} on ${name} and place one small market position on an outcome you have researched.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares in the same wallet.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it for the full period.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it in the same wallet.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the full period.`;
  if (c.includes('payment')) return `Send $${capital} through ${name} on ${chain} for a real payment and keep the receipt.`;
  if (c.includes('chain')) return `Use $${capital} on ${name}'s own chain for a real transaction and keep the wallet active there.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time.
 * Derived from the protocol's own record (category, chains, TVL, age),
 * never from a hand-written list of names.
 */
/** The weekly qualifying action, specific to the protocol's category — a
 * farm plan that says "do something" every week is a template, not a plan. */
function weeklyActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'a supply, a borrow or a repayment';
  if (c.includes('dex') || c.includes('leveraged farm')) return 'a swap or a liquidity top-up';
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator') || c.includes('risk')) return 'a deposit or a vault rebalance';
  if (c.includes('rwa')) return 'a mint or a hold-check on the yield-bearing asset';
  if (c.includes('prediction')) return 'one small researched market position';
  if (c.includes('perpetual') || c.includes('derivative')) return 'one small hedged trade';
  if (c.includes('bridge')) return 'a bridge transfer you actually use';
  if (c.includes('staking') || c.includes('restak')) return 'a stake top-up or a rewards check';
  if (c.includes('stable')) return 'a mint or a hold of the stable asset';
  if (c.includes('insurance')) return 'a cover check or a policy renewal';
  if (c.includes('payment')) return 'one real payment through the protocol';
  return 'a deposit, a borrow, a swap or a vote';
}

export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasGuide(chain);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyActionFor(p);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, keep its seed phrase offline, and fund it with $${capital} of USDC plus gas on ${chain}.`,
      cost: gas,
      time: '10 minutes',
    },
    { text: action, cost: `$${capital} of capital and ${gas}`, time: '15 minutes to set up' },
    {
      text: `Do one qualifying action each week on ${chain} — ${weekly} — and never leave the wallet idle for a whole month.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and check the protocol's own points or rewards page monthly.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Never pay anyone to claim a reward, never sign a transaction from a link in a direct message, and revoke the approval if you stop farming ${p.name}.`,
      cost: 'nothing to check, and never pay to claim',
      time: '5 minutes',
    },
    {
      text: `Write the wallet address, the dates and every transaction hash in a farm log, then unwind in stages: withdraw half first and confirm it arrives before the rest.`,
      cost: 'nothing but the log',
      time: '10 minutes to unwind',
    },
  ];
}

export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    comparables: row.model.comparables,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    momentum_multiplier: row.model.momentum_multiplier,
    dominance_multiplier: row.model.dominance_multiplier,
    confidence_multiplier: row.model.confidence_multiplier,
    relative_growth: row.relative_growth,
    category_share: row.category_share,
    confidence: row.confidence,
    signals: row.signals,
    verdict: row.verdict,
    farm_steps: row.farm_steps,
    watchlist: false,
  };
}

export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const { global, table } = calibrateMultiples(snapshot, model);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  // Category stats: implied value by category, strongest first.
  const byCat = new Map<string, { rows: number; total_implied: number; total_tvl: number; multiples: number[] }>();
  for (const r of board) {
    const key = r.category ?? 'Other';
    const s = byCat.get(key) ?? { rows: 0, total_implied: 0, total_tvl: 0, multiples: [] };
    s.rows += 1;
    s.total_implied += r.implied_value_usd;
    s.total_tvl += r.tvl_usd;
    s.multiples.push(r.model.category_multiple);
    byCat.set(key, s);
  }
  const category_stats: CategoryStat[] = [...byCat.entries()]
    .map(([category, s]) => ({
      category,
      rows: s.rows,
      total_implied_usd: s.total_implied,
      total_tvl_usd: s.total_tvl,
      median_multiple: median(s.multiples),
    }))
    .sort((a, b) => b.total_implied_usd - a.total_implied_usd);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    global_multiple: global,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    total_implied_usd: board.reduce((a, r) => a + r.implied_value_usd, 0),
    category_multiples: table,
    category_stats,
    rows: board.map((r) => ({ ...radarRow(r), watchlist: snapshot.watchlist.includes(r.slug) })),
    live,
  };
  return { board, radar };
}

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
