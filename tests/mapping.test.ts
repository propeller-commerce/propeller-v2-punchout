import { resolvePath, applyRule, mergeMapping, type ResolveScope } from '../src/mapping';
import { DEFAULT_OCI_MAPPING } from '../src/defaults';
import { CTX } from './fixtures';

function scopeFor(line: Record<string, unknown>): ResolveScope {
  return {
    line,
    product: (line.product as Record<string, unknown>) ?? null,
    cart: {},
    ctx: CTX,
    session: CTX.session ?? {},
  };
}

describe('resolvePath', () => {
  it('resolves bare keys on the line and dotted paths on roots', () => {
    const s = scopeFor({ quantity: 3, product: { sku: 'X' } });
    expect(resolvePath(s, 'quantity')).toBe(3);
    expect(resolvePath(s, 'product.sku')).toBe('X');
    expect(resolvePath(s, 'session.CLASSIFICATION')).toBe('44121600');
  });

  it('honours || fallback and skips empty values', () => {
    const s = scopeFor({ product: { sku: '', supplierCode: 'SUP' } });
    expect(resolvePath(s, 'product.sku||product.supplierCode')).toBe('SUP');
  });
});

describe('applyRule', () => {
  it('applies named transforms and fallbacks', () => {
    const s = scopeFor({ price: 9.9, product: { names: [{ language: 'en', value: 'Bolt' }] } });
    expect(applyRule({ source: 'price', transform: 'money2dp' }, s)).toBe('9.90');
    expect(applyRule({ source: 'product.names', transform: 'localized' }, s)).toBe('Bolt');
    expect(applyRule({ source: 'product.missing', fallback: 'EA' }, s)).toBe('EA');
    expect(applyRule({ static: 'ctx.currency' }, s)).toBe('EUR');
  });
});

describe('mergeMapping', () => {
  it('overrides a field and drops one set to null', () => {
    const merged = mergeMapping(DEFAULT_OCI_MAPPING, {
      PRICE: { source: 'totalPrice', transform: 'money2dp' },
      MATNR: null as never,
    });
    expect(merged.PRICE.source).toBe('totalPrice');
    expect(merged.MATNR).toBeUndefined();
    expect(merged.DESCRIPTION).toEqual(DEFAULT_OCI_MAPPING.DESCRIPTION); // untouched
  });
});
