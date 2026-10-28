/* assets/docnum.js — เลขที่เอกสารกลาง (ปี พ.ศ. + ตัวนับกันเลขย้อนกลับ)
   ใช้ร่วมกันทุกหน้า: PCC-2569-001 · INV-2569-001 · RC-2569-001

   หลักการ:
   - หาค่าสูงสุดจากเอกสารที่ยังอยู่ในรายการ (กรองตามปี พ.ศ.)
   - จำค่าสูงสุดที่เคยออกไว้ใน localStorage ด้วย จึงไม่นำเลขที่ลบไปแล้วกลับมาใช้
   - ถ้ามีการ Import เอกสารเลขสูง ระบบจะเดินต่อจากเลขนั้นให้เอง
*/
window.DOCNUM = (function () {
  var BE = (window.THAI && THAI.BE) || 543;
  var STORE = 'docnum_v1_';

  function yearBE() {
    return BE + new Date().getFullYear();
  }

  function listOf(src) {
    if (typeof src === 'function') src = src();
    return src || [];
  }

  function parse(no, prefix) {
    var m = new RegExp('^' + prefix + '-(\\d{4})-(\\d+)$').exec(String(no || '').trim());
    if (!m) return null;
    return { year: +m[1], seq: +m[2] };
  }

  function next(prefix, src, getNo, year) {
    var y = year || yearBE();
    var max = 0;

    listOf(src).forEach(function (rec) {
      var p = parse(getNo(rec), prefix);
      if (p && p.year === y) max = Math.max(max, p.seq);
    });

    var storeKey = STORE + prefix + '_' + y;
    var saved = parseInt(localStorage.getItem(storeKey), 10) || 0;
    max = Math.max(max, saved);

    var seq = max + 1;
    try { localStorage.setItem(storeKey, String(seq)); } catch (e) {}

    return prefix + '-' + y + '-' + String(seq).padStart(3, '0');
  }

  function duplicate(no, src, getNo, excludeId) {
    var n = String(no || '').trim();
    if (!n) return null;
    var list = listOf(src);
    for (var i = 0; i < list.length; i++) {
      var rec = list[i];
      if (excludeId && rec.id === excludeId) continue;
      if (String(getNo(rec) || '').trim() === n) return rec;
    }
    return null;
  }

  /* เตือนเมื่อผู้ใช้แก้เลขมือแล้วซ้ำกับเอกสารอื่น */
  function watch(input, src, getNo, getExcludeId) {
    if (!input) return;
    var warned = '';

    function check() {
      var n = String(input.value != null ? input.value : input.textContent || '').trim();
      var excludeId = typeof getExcludeId === 'function' ? getExcludeId() : getExcludeId;
      var dup = duplicate(n, src, getNo, excludeId);

      input.style.outline = dup ? '2px solid #dc2626' : '';
      input.title = dup ? 'เลขที่เอกสารนี้ซ้ำกับเอกสารอื่น' : '';

      if (dup && n !== warned) {
        warned = n;
        alert('เลขที่ "' + n + '" ซ้ำกับเอกสารที่มีอยู่แล้ว');
      }
      if (!dup) warned = '';
    }

    input.addEventListener('blur', check);
    if (input.tagName === 'INPUT') input.addEventListener('change', check);
  }

  return { next: next, parse: parse, duplicate: duplicate, watch: watch, yearBE: yearBE };
})();
