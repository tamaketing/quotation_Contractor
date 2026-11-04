/* ══════════════════════════════════════════════════════════════
   toast.js — แจ้งเตือนแบบไม่ขัดจังหวะ (toast)
   ใช้: TOAST.success('บันทึกแล้ว'); TOAST.error('...'); TOAST.warn('...'); TOAST.info('...')
   ไม่ต้องกดปิด — หายเองใน 2.6–4.6 วินาที (คลิกที่การ์ดเพื่อปิดได้)
   ══════════════════════════════════════════════════════════════ */
const TOAST = (function () {
  const MAX = 3;
  const ICONS = {
    success: '<path d="M4.2 10.6l4 4L15.9 6.4"/>',
    error: '<path d="M10 5.6v5.8"/><circle cx="10" cy="14.9" r="1.25" fill="currentColor" stroke="none"/>',
    warn: '<path d="M10 5.6v5.8"/><circle cx="10" cy="14.9" r="1.25" fill="currentColor" stroke="none"/>',
    info: '<path d="M10 9.4v5.6"/><circle cx="10" cy="5.4" r="1.25" fill="currentColor" stroke="none"/>',
  };
  const TIME = { success: 2600, info: 3000, warn: 4200, error: 4600 };
  let host = null;

  function wrap() {
    if (host && host.isConnected) return host;
    host = document.createElement('div');
    host.className = 'toast-wrap';
    host.setAttribute('aria-live', 'polite');
    host.setAttribute('aria-atomic', 'false');
    document.body.appendChild(host);
    return host;
  }

  function dismiss(el) {
    if (!el || el.classList.contains('out')) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 280);
  }

  function show(msg, type, sub) {
    if (!msg) return null;
    type = ICONS[type] ? type : 'info';
    const box = wrap();
    while (box.children.length >= MAX) box.firstElementChild.remove();

    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML =
      '<span class="t-ic"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[type] + '</svg></span>' +
      '<div class="t-bd">' +
        '<div class="t-msg"></div>' +
        (sub ? '<div class="t-sub"></div>' : '') +
      '</div>' +
      '<button type="button" class="t-x" aria-label="ปิดการแจ้งเตือน">&times;</button>' +
      '<span class="t-bar" style="animation-duration:' + TIME[type] + 'ms"></span>';
    el.querySelector('.t-msg').textContent = msg;
    if (sub) el.querySelector('.t-sub').textContent = sub;
    box.appendChild(el);

    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));

    const timer = setTimeout(() => dismiss(el), TIME[type]);
    el.addEventListener('click', () => { clearTimeout(timer); dismiss(el); });
    return el;
  }

  return {
    show,
    success: (m, s) => show(m, 'success', s),
    error: (m, s) => show(m, 'error', s),
    warn: (m, s) => show(m, 'warn', s),
    info: (m, s) => show(m, 'info', s),
    clear() { if (host) host.innerHTML = ''; },
  };
})();
