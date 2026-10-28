/* ══════════════════════════════════════════════════════════════
   thai.js — ฟังก์ชันกลาง: จัดรูปแบบตัวเลข / จำนวนเงินเป็นตัวหนังสือไทย / ปฏิทิน พ.ศ.
   ใช้ร่วมกันทุกเอกสาร (ใบเสนอราคา, ใบแจ้งหนี้, ใบเสร็จรับเงิน, หนังสือส่งมอบงาน)
   ══════════════════════════════════════════════════════════════ */
const THAI = (function () {
  const BE = 543;
  const MONTH = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const SHORT = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  /* จำนวนเงิน → 2 ตำแหน่ง เช่น 1234.5 → "1,234.50" */
  function fmt(n) {
    return (+n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* ตัวเลขไทย (เลข 0-999,999 ต่อช่วง) */
  function thNum(s) {
    const d = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const p = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    s = String(s).replace(/^0+/, '');
    if (!s) return '';
    if (s.length > 7) return thNum(s.slice(0, s.length - 6)) + 'ล้าน' + thNum(s.slice(s.length - 6));
    let r = '';
    for (let i = 0; i < s.length; i++) {
      const n = +s[i], pos = s.length - 1 - i;
      if (!n) continue;
      if (pos === 0 && n === 1 && s.length > 1) r += 'เอ็ด';
      else if (pos === 1 && n === 2) r += 'ยี่';
      else if (pos === 1 && n === 1) r += '';
      else r += d[n];
      r += p[pos];
    }
    return r;
  }

  /* จำนวนเงินเป็นตัวหนังสือ เช่น 1234.50 → "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์" */
  function bahtText(v) {
    v = Math.round((+v || 0) * 100) / 100;
    const neg = v < 0; v = Math.abs(v);
    const [b, st] = v.toFixed(2).split('.');
    let t = (b === '0' ? 'ศูนย์' : thNum(b)) + 'บาท';
    t += st === '00' ? 'ถ้วน' : thNum(st) + 'สตางค์';
    return (neg ? 'ลบ' : '') + t;
  }

  /* ── วันที่ ── */
  function todayParts() { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() }; }
  function fmtDateBE(y, m, d) { return d + '/' + (m + 1) + '/' + (y + BE); }
  function fmtDateBEFull(y, m, d) { return d + ' ' + MONTH[m + 1] + ' ' + (y + BE); }

  function parseDateBE(s) {
    const mt = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})\s*$/.exec(s || '');
    if (!mt) return null;
    let d = +mt[1], m = +mt[2] - 1, y = +mt[3];
    if (y < 100) y = y > 2500 ? y : (y < 2200 ? y + 2500 : y + BE);
    if (y >= 2500) y -= BE;
    if (m < 0 || m > 11 || d < 1 || d > 31) return null;
    return { y, m, d };
  }

  /* "2026-09-03" (ค.ศ. จาก <input type="date">) → "3/9/2569" (พ.ศ.) */
  function isoToBE(iso) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec((iso || '').trim());
    if (!m) return '';
    return (+m[3]) + '/' + (+m[2]) + '/' + (+m[1] + BE);
  }
  /* "3/9/2569" → "2569-09-03" */
  function beToISO(s) {
    const p = parseDateBE(s);
    if (!p) return '';
    const pad = n => String(n).padStart(2, '0');
    return (p.y + BE) + '-' + pad(p.m + 1) + '-' + pad(p.d);
  }

  /* ══════════════════════════════════════════════════════════════
     ปฏิทินเลือกวันที่ (พ.ศ.) — ผูกกับทุก element ที่มี class="dpick"
     ใช้ data-v เก็บค่า, แสดงผลเป็นข้อความใน element
     ══════════════════════════════════════════════════════════════ */
  let pop = null, target = null, calY = 0, calM = 0, calSel = '';

  function ensurePop() {
    if (pop) return pop;
    pop = document.createElement('div');
    pop.id = 'calPop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'เลือกวันที่');
    pop.innerHTML =
      '<div class="cal-head">' +
      '<div class="cal-nav"><button type="button" data-nav="py">« ปี</button><button type="button" data-nav="pm">‹</button></div>' +
      '<div class="t" id="calTitle">—</div>' +
      '<div class="cal-nav"><button type="button" data-nav="nm">›</button><button type="button" data-nav="ny">ปี »</button></div>' +
      '</div>' +
      '<div class="cal-dow"><span>อา</span><span>จ</span><span>อ</span><span>พ</span><span>พฤ</span><span>ศ</span><span>ส</span></div>' +
      '<div class="cal-grid" id="calGrid"></div>' +
      '<div class="cal-foot">' +
      '<button type="button" data-act="today">วันนี้</button>' +
      '<button type="button" data-act="clear">ล้าง</button>' +
      '<button type="button" data-act="close">ปิด</button>' +
      '</div>';
    document.body.appendChild(pop);
    return pop;
  }

  function openCal(el) {
    ensurePop();
    target = el;
    const saved = el.dataset.v ? parseDateBE(el.dataset.v) : null;
    const t = saved || todayParts();
    calY = t.y; calM = t.m; calSel = el.dataset.v || '';
    renderCal();
    pop.classList.add('open');
    const r = el.getBoundingClientRect();
    const w = 212;
    pop.style.top = (window.scrollY + r.bottom + 3) + 'px';
    pop.style.left = Math.max(8, window.scrollX + r.left - w + 40) + 'px';
  }
  function closeCal() { if (pop) pop.classList.remove('open'); target = null; }
  function isOpen() { return !!pop && pop.classList.contains('open'); }

  function renderCal() {
    const title = document.getElementById('calTitle');
    const g = document.getElementById('calGrid');
    if (!title || !g) return;
    title.textContent = MONTH[calM + 1] + ' ' + (calY + BE);
    g.innerHTML = '';
    const first = new Date(calY, calM, 1).getDay();
    const dim = new Date(calY, calM + 1, 0).getDate();
    const pd = new Date(calY, calM, 0).getDate();
    for (let i = first - 1; i >= 0; i--) g.appendChild(calBtn(pd - i, true, ''));
    for (let d = 1; d <= dim; d++) g.appendChild(calBtn(d, false, fmtDateBE(calY, calM, d)));
    const rest = (7 - (g.children.length % 7)) % 7;
    for (let i = 1; i <= rest; i++) g.appendChild(calBtn(i, true, ''));
  }

  function calBtn(d, pad, iso) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = d;
    if (pad) b.className = 'pad';
    const t = todayParts(), tis = fmtDateBE(t.y, t.m, t.d);
    if (iso && iso === tis) b.classList.add('today');
    if (iso && iso === calSel) b.classList.add('on');
    if (!pad) b.addEventListener('click', () => { setDate(target, iso); closeCal(); });
    return b;
  }

  /* ตั้งค่าวันที่ + ปล่อย event change ให้ฟอร์มรู้ */
  function setDate(el, iso) {
    if (!el) return;
    el.dataset.v = iso || '';
    el.textContent = iso || '—';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function init(onChange) {
    ensurePop();
    pop.addEventListener('click', e => {
      const nav = e.target.dataset.nav;
      if (nav) {
        if (nav === 'pm') { calM--; if (calM < 0) { calM = 11; calY--; } }
        if (nav === 'nm') { calM++; if (calM > 11) { calM = 0; calY++; } }
        if (nav === 'py') calY--;
        if (nav === 'ny') calY++;
        renderCal(); return;
      }
      const act = e.target.dataset.act;
      if (act === 'today') { const t = todayParts(); setDate(target, fmtDateBE(t.y, t.m, t.d)); calY = t.y; calM = t.m; closeCal(); }
      if (act === 'clear') { setDate(target, ''); closeCal(); }
      if (act === 'close') closeCal();
    });
    document.addEventListener('click', e => {
      if (!isOpen()) return;
      if (pop.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.dpick')) return;
      closeCal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeCal();
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('dpick')) {
        e.preventDefault(); e.target.click();
      }
    });
    document.addEventListener('change', e => {
      if (e.target.classList && e.target.classList.contains('dpick') && typeof onChange === 'function') onChange();
    });
    document.querySelectorAll('.dpick').forEach(el => {
      el.addEventListener('click', () => openCal(el));
    });
  }

  return { BE, MONTH, SHORT, fmt, thNum, bahtText, todayParts, fmtDateBE, fmtDateBEFull, parseDateBE, isoToBE, beToISO, setDate, init, openCal, closeCal };
})();