const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ Intl, Date });
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../assets/thai.js'), 'utf8') + ';globalThis.thai = THAI;', context);
const thai = context.thai;

test('invoice date remains stable over repeated saves and legacy import', () => {
  let iso = '2026-11-10';
  for (let i = 0; i < 10; i++) {
    assert.equal(thai.isoToBE(iso), '10/11/2569');
    iso = thai.beToISO(thai.isoToBE(iso));
    assert.equal(iso, '2026-11-10');
  }
  assert.equal(thai.isoToBE('2569-11-10'), '10/11/2569');
  assert.equal(thai.dateYearBE('10/11/2569'), '2569');
});

test('today follows Bangkok across midnight and new year', () => {
  assert.equal(JSON.stringify(thai.todayParts(new Date('2026-12-31T17:00:00Z'))), '{"y":2027,"m":0,"d":1}');
  assert.equal(JSON.stringify(thai.todayParts(new Date('2026-11-09T17:00:00Z'))), '{"y":2026,"m":10,"d":10}');
});

test('invalid dates are rejected and leap days are preserved', () => {
  assert.equal(thai.parseDateBE('31/2/2569'), null);
  assert.equal(thai.isoToBE('2026-02-29'), '');
  assert.equal(thai.beToISO('29/2/2567'), '2024-02-29');
  assert.equal(thai.beToISO('10/11/69'), '2026-11-10');
});
