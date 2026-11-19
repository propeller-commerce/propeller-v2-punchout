import { buildStartUrl, buildAutoPostForm, buildDebugPage, assertReturnUrl } from '../src/url';

describe('buildStartUrl', () => {
  it('appends only defined params and encodes them', () => {
    const u = buildStartUrl('https://shop/api/punchout/enter', {
      mode: 'cxml',
      mtoken: 'a b',
      empty: '',
      missing: undefined,
    });
    expect(u).toContain('mode=cxml');
    expect(u).toContain('mtoken=a+b');
    expect(u).not.toContain('empty=');
    expect(u).not.toContain('missing=');
  });
});

describe('buildAutoPostForm', () => {
  it('renders hidden inputs + auto-submit for the ERP', () => {
    const html = buildAutoPostForm('https://erp/hook', { A: '1', B: '2' }, { target: '_top' });
    expect(html).toContain('action="https://erp/hook"');
    expect(html).toContain('target="_top"');
    expect(html).toContain('name="A" value="1"');
    expect(html).toContain('onload="document.forms[0].submit()"');
  });
});

describe('return URL guard', () => {
  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:x',
    'file:///etc/passwd',
    '/relative/path',
    '//attacker.example/collect',
    'not a url',
    '',
    'https://user:pw@erp.example/hook',
  ])('refuses %j', (url) => {
    expect(() => assertReturnUrl(url)).toThrow();
    expect(() => buildAutoPostForm(url, { A: '1' })).toThrow();
    expect(() => buildDebugPage({ mode: 'oci', returnUrl: url, fields: { A: '1' } })).toThrow();
  });

  it('accepts https URLs, keeping the query string', () => {
    expect(assertReturnUrl('https://erp.example/sap/bc/gui?sap-client=100&x=1')).toBe(
      'https://erp.example/sap/bc/gui?sap-client=100&x=1',
    );
  });

  it.each([
    'http://erp.example/hook',
    'HTTP://erp.example/hook',
    'http://localhost.attacker.test/hook',
    'http://127.0.0.1.attacker.test/hook',
    'http://10.0.0.5/hook',
  ])('refuses plain http to a non-loopback host: %j', (url) => {
    expect(() => assertReturnUrl(url)).toThrow(/https/);
    expect(() => buildAutoPostForm(url, { A: '1' })).toThrow(/https/);
    expect(() => buildDebugPage({ mode: 'oci', returnUrl: url, fields: { A: '1' } })).toThrow(/https/);
  });

  it.each([
    ['http://localhost:8080/hook', 'http://localhost:8080/hook'],
    ['HTTP://LOCALHOST/hook', 'http://localhost/hook'],
    ['http://127.0.0.1:8080/hook', 'http://127.0.0.1:8080/hook'],
    ['http://[::1]:8080/hook', 'http://[::1]:8080/hook'],
  ])('accepts plain http to a loopback host (dev procurement simulators): %j', (url, href) => {
    expect(assertReturnUrl(url)).toBe(href);
  });

  it('allowedHosts still applies to loopback http', () => {
    expect(() => assertReturnUrl('http://localhost:8080/hook', ['erp.example'])).toThrow(/not allowed/);
    expect(assertReturnUrl('http://localhost:8080/hook', ['localhost'])).toBe('http://localhost:8080/hook');
  });

  it('allowedHosts: exact hostname match, case-insensitive; empty list = any host', () => {
    expect(assertReturnUrl('https://ERP.example/hook', ['erp.example'])).toBe('https://erp.example/hook');
    expect(() => assertReturnUrl('https://attacker.example/hook', ['erp.example'])).toThrow(/not allowed/);
    expect(() => assertReturnUrl('https://erp.example.attacker.test/hook', ['erp.example'])).toThrow();
    expect(assertReturnUrl('https://any.example/hook', [])).toBe('https://any.example/hook');
    expect(() =>
      buildAutoPostForm('https://attacker.example/hook', { A: '1' }, { allowedHosts: ['erp.example'] }),
    ).toThrow();
  });

  it('escapes every attribute and value', () => {
    const html = buildAutoPostForm(
      'https://erp.example/hook?a="><script>x</script>',
      { 'k"><img src=x onerror=y>': 'v"><script>z</script>' },
      { target: '_top"><script>', title: '</title><script>', submitLabel: '<b>' },
    );
    expect(html).not.toMatch(/<script|<img|<b>/);
    expect(html).toContain(`target="_top&quot;&gt;&lt;script&gt;"`);
    expect(html).toContain('name="k&quot;&gt;&lt;img src=x onerror=y&gt;"');
  });
});

describe('buildDebugPage', () => {
  it('OCI: renders the NEW_ITEM field table + a manual submit form', () => {
    const html = buildDebugPage({
      mode: 'oci',
      returnUrl: 'https://erp/oci',
      fields: { 'NEW_ITEM-DESCRIPTION[1]': 'Drill', 'NEW_ITEM-PRICE[1]': '9.90' },
    });
    expect(html).toContain('<table>');
    expect(html).toContain('NEW_ITEM-DESCRIPTION[1]');
    expect(html).toContain('<td>Drill</td>');
    expect(html).toContain('action="https://erp/oci"');
    expect(html).not.toContain('onload='); // debug page does NOT auto-submit
  });

  it('cXML: renders the document in a <pre> and a cxml-urlencoded field', () => {
    const html = buildDebugPage({ mode: 'cxml', returnUrl: 'https://erp/cxml', xml: '<cXML>&amp;</cXML>' });
    expect(html).toContain('<pre>');
    expect(html).toContain('&lt;cXML&gt;'); // escaped for display
    expect(html).toContain('name="cxml-urlencoded"');
  });
});
