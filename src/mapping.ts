/**
 * Configurable output field mapping — the core of "the wire field mapping is
 * data, not hardcoded".
 *
 * A `Mapping` is `outputKey -> FieldRule`. Each rule pulls a value from the
 * cart line / product / cart / context by a dotted `source` path (or a
 * `static` literal / ctx token), runs it through a NAMED `transform`, and
 * falls back to `fallback` when empty. Named transforms (not inline fns) keep
 * the map declarative and safe to expose in an app's config object.
 *
 * A deployment overrides any field by deep-merging its partial map over the
 * exported `DEFAULT_OCI_MAPPING` / `DEFAULT_CXML_MAPPING` — see `mergeMapping`.
 */

import type { PunchoutContext } from './types';
import { normalizeUnit } from './units';

export type TransformName =
  | 'money2dp'
  | 'normalizeUnit'
  | 'first8'
  | 'localized'
  | 'firstImageUrl'
  | 'int'
  | 'string';

export interface FieldRule {
  /** Dotted path resolved against { line, product, cart, ctx, session }.
   *  Supports `a||b` fallback between whole paths. Bare keys resolve on the line. */
  source?: string;
  /** A named, built-in transform applied to the resolved value. */
  transform?: TransformName;
  /** Literal, or a ctx token: `ctx.currency`, `session.CLASSIFICATION`. */
  static?: string;
  /** Used when the resolved/transformed value is empty. */
  fallback?: string;
  /** cXML Classification `domain` attribute (e.g. 'UNSPSC'). Ignored by OCI. */
  domain?: string;
  /** OCI key suffix appended after the `[i]` index, e.g. ':132' for LONGTEXT. */
  keySuffix?: string;
}

export type Mapping = Record<string, FieldRule>;

const KNOWN_ROOTS = new Set(['line', 'product', 'cart', 'ctx', 'session']);

export interface ResolveScope {
  line: Record<string, unknown>;
  product: Record<string, unknown> | null | undefined;
  cart: Record<string, unknown>;
  ctx: PunchoutContext;
  session: Record<string, string>;
}

function getPath(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const seg of path.split('.')) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/** Resolve a dotted path (with `||` fallbacks) against the scope. */
export function resolvePath(scope: ResolveScope, path: string): unknown {
  for (const alt of path.split('||').map((p) => p.trim())) {
    const first = alt.split('.')[0];
    const root = KNOWN_ROOTS.has(first)
      ? (scope as unknown as Record<string, unknown>)[first]
      : scope.line;
    const rest = KNOWN_ROOTS.has(first) ? alt.slice(first.length + 1) : alt;
    const val = rest ? getPath(root, rest) : root;
    if (val != null && val !== '') return val;
  }
  return undefined;
}

function pickLocalized(v: unknown, language: string): string {
  if (!Array.isArray(v)) return v == null ? '' : String(v);
  const arr = v as Array<{ language?: string; value?: string }>;
  const hit = arr.find((x) => x?.language === language) ?? arr[0];
  return hit?.value ?? '';
}

function firstImageUrl(v: unknown): string {
  // ProductMedia { images: [{ url, variants? }] } — grab the first url we can find.
  const media = v as { images?: Array<{ url?: string; variants?: Array<{ url?: string }> }> } | undefined;
  const img = media?.images?.[0];
  return img?.url ?? img?.variants?.[0]?.url ?? '';
}

const TRANSFORMS: Record<TransformName, (v: unknown, ctx: PunchoutContext) => string> = {
  money2dp: (v) => Number(v ?? 0).toFixed(2),
  normalizeUnit: (v) => normalizeUnit(v == null ? '' : String(v)),
  first8: (v) => String(v ?? '').slice(0, 8),
  localized: (v, ctx) => pickLocalized(v, ctx.language),
  firstImageUrl: (v) => firstImageUrl(v),
  int: (v) => String(Math.round(Number(v ?? 0))),
  string: (v) => (v == null ? '' : String(v)),
};

function resolveStatic(token: string, ctx: PunchoutContext): string {
  if (token.startsWith('ctx.')) return String(getPath(ctx, token.slice(4)) ?? '');
  if (token.startsWith('session.')) return String(ctx.session?.[token.slice(8)] ?? '');
  return token;
}

/** Resolve one field rule to a final string. */
export function applyRule(rule: FieldRule, scope: ResolveScope): string {
  let val: unknown;
  if (rule.static != null) {
    val = resolveStatic(rule.static, scope.ctx);
  } else if (rule.source) {
    val = resolvePath(scope, rule.source);
  }
  if (rule.transform && val != null && val !== '') {
    val = TRANSFORMS[rule.transform](val, scope.ctx);
  }
  let out = val == null ? '' : String(val);
  if (!out && rule.fallback != null) out = rule.fallback;
  return out;
}

/** Deep-merge a partial override over a base mapping (per-field, shallow rule merge). */
export function mergeMapping(base: Mapping, override?: Partial<Mapping>): Mapping {
  if (!override) return base;
  const out: Mapping = { ...base };
  for (const [key, rule] of Object.entries(override)) {
    if (rule == null) {
      delete out[key]; // explicit null drops a field
    } else {
      out[key] = { ...(out[key] ?? {}), ...rule };
    }
  }
  return out;
}
