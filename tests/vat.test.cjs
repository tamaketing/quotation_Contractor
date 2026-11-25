const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

test('VAT toggle restores rate and synchronizes imported zero rates', () => {
  const rate = { value: '7' }, enabled = { checked: true };
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/vat.js'), 'utf8'), {
    window, document: { getElementById: id => id === 'vatR' ? rate : enabled }
  });
  window.VAT.sync();
  enabled.checked = false;
  window.VAT.toggle();
  assert.equal(Number(rate.value), 0);
  assert.equal(rate.disabled, true);
  enabled.checked = true;
  window.VAT.toggle();
  assert.equal(Number(rate.value), 7);
  assert.equal(rate.disabled, false);
  rate.value = '10'; window.VAT.sync();
  enabled.checked = false; window.VAT.toggle();
  enabled.checked = true; window.VAT.toggle();
  assert.equal(Number(rate.value), 10);
  rate.value = '0'; window.VAT.sync();
  assert.equal(enabled.checked, false);
});

test('all VAT documents include the control inside the document and compile', () => {
  for (const name of ['quotation', 'invoice', 'receipt']) {
    const html = fs.readFileSync(path.join(root, name + '.html'), 'utf8');
    assert.equal((html.match(/id="vatEnabled"/g) || []).length, 1);
    assert.ok(html.indexOf('id="vatEnabled"') < html.indexOf('</body>'));
    assert.match(html, /assets\/vat.js/);
    assert.match(html, /function calc\(\)\s*\{\s*VAT.sync\(\)/);
    for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
  }
});
