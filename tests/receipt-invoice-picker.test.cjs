const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../receipt.html'), 'utf8');
const source = html.slice(html.indexOf('async function openInvoicePicker()'), html.indexOf('function importInvoiceFile('));

function setup(api, confirm = () => true) {
  const search = { value: '', focus() {} };
  const list = { children: [], replaceChildren() { this.children = []; }, appendChild(b) { this.children.push(b); }, querySelectorAll() { return this.children; } };
  const file = {};
  const closeButton = {};
  const overlay = {
    isConnected: false,
    querySelector(s) { return { '[data-search]': search, '[data-list]': list, '[data-file]': file }[s]; },
    querySelectorAll() { return [closeButton]; },
    remove() { this.isConnected = false; },
  };
  const imported = [], errors = [];
  let fileClicks = 0;
  const context = vm.createContext({
    API: api, confirm,
    document: { createElement(tag) { return tag === 'div' ? overlay : { style: {} }; }, body: { appendChild(el) { el.isConnected = true; } } },
    $(id) { return id === 'fiInv' ? { click() { fileClicks++; } } : (overlay.isConnected ? overlay : null); },
    fillFromInvoice(d) { imported.push(d); },
    TOAST: { error(...args) { errors.push(args); } },
  });
  vm.runInContext(source, context);
  return { context, overlay, search, list, imported, errors, file, fileClicks: () => fileClicks };
}

test('cloud picker searches invoices and imports freshly fetched details after confirmation', async () => {
  const calls = [];
  const invoice = { invNo: 'INV-1', cusName: 'ลูกค้าทดสอบ', items: [{ qty: 2, price: 100 }] };
  const s = setup({
    async listDocs(type) { calls.push(type); return { items: [{ id: 'one', invNo: 'INV-1', cusName: 'ลูกค้าทดสอบ' }, { id: 'two', invNo: 'INV-2', prjName: 'โครงการสอง' }] }; },
    async getDoc(type, id) { calls.push([type, id]); return invoice; },
  });
  await s.context.openInvoicePicker();
  assert.equal(s.list.children.length, 2);
  s.search.value = 'โครงการสอง'; s.search.oninput();
  assert.equal(s.list.children.length, 1);
  s.search.value = 'ลูกค้าทดสอบ'; s.search.oninput();
  await s.list.children[0].onclick();
  assert.deepEqual(calls, ['invoices', ['invoices', 'one']]);
  assert.deepEqual(s.imported, [invoice]);
  assert.equal(s.overlay.isConnected, false);
});

test('cancel preserves the receipt and request failures allow retry', async () => {
  let fail = true;
  const s = setup({ async listDocs() { return { items: [{ id: 'one', invNo: 'INV-1' }] }; }, async getDoc() { if (fail) throw Error('offline'); return { invNo: 'INV-1' }; } }, () => false);
  await s.context.openInvoicePicker();
  const button = s.list.children[0];
  await button.onclick();
  assert.equal(s.errors.length, 1);
  assert.equal(button.disabled, false);
  fail = false;
  await button.onclick();
  assert.equal(s.imported.length, 0);
  assert.equal(s.overlay.isConnected, true);
  assert.equal(s.search.disabled, false);
});

test('empty and failed cloud lists show status and retain file import', async () => {
  for (const fail of [false, true]) {
    const s = setup({ async listDocs() { if (fail) throw Error('offline'); return { items: [] }; } });
    await s.context.openInvoicePicker();
    assert.match(s.list.textContent, fail ? /โหลดใบแจ้งหนี้ไม่สำเร็จ/ : /ยังไม่มีใบแจ้งหนี้/);
    s.file.onclick();
    assert.equal(s.fileClicks(), 1);
    assert.equal(s.overlay.isConnected, false);
  }
});

test('receipt inline scripts compile', () => {
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  assert.match(html, /onclick="openInvoicePicker\(\)"/);
});
