import { buildStartUrl, buildAutoPostForm, buildDebugPage } from '../src/url';

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
