/* ══════════════════════════════════════════════════════════════
   profile.js — ข้อมูลบริษัทของผู้ใช้ (ตั้งค่าครั้งเดียว ใช้ได้ทุกเอกสาร)
   เก็บใน localStorage ของเครื่องผู้ใช้ ไม่ถูกส่งออกไปที่ไหน
   ══════════════════════════════════════════════════════════════ */
const PROFILE = (function () {

  const KEY = 'quota_profile_v1';
  const WN_KEY = '__quota_profile_v1__';

  const FIELDS = [
    { k: 'coName', label: 'ชื่อบริษัท', ph: 'บริษัท ตัวอย่าง จำกัด', line: true },
    { k: 'coNameEn', label: 'ชื่อภาษาอังกฤษ', ph: 'Example Co., Ltd.', line: true },
    { k: 'coBranch', label: 'สาขา', ph: 'สำนักงานใหญ่' },
    { k: 'coTax', label: 'เลขประจำตัวผู้เสียภาษี', ph: '0-0000-00000-00-0' },
    { k: 'coAddr', label: 'ที่อยู่', ph: 'ที่อยู่ จังหวัด รหัสไปรษณีย์', area: true },
    { k: 'coPhone', label: 'โทรศัพท์', ph: '0xx-xxx-xxxx' },
    { k: 'coEmail', label: 'อีเมล', ph: 'name@example.com' },
    { k: 'sellerName', label: 'ชื่อผู้เสนอราคา / ผู้วางบิล / ผู้รับเงิน', ph: 'ชื่อ-นามสกุล' },
    { k: 'sellerPhone', label: 'เบอร์ผู้เสนอราคา', ph: '0xx-xxx-xxxx' },
    { k: 'validDays', label: 'อายุใบเสนอราคา', ph: '15วัน' },
    { k: 'vatRate', label: 'ภาษีมูลค่าเพิ่ม (%)', ph: '7' },
    { k: 'bankInfo', label: 'ข้อความชำระเงิน / บัญชีธนาคาร', ph: 'ธนาคาร... เลขที่บัญชี... ชื่อบัญชี...', area: true }
  ];

  const DEFAULT = {
    coName: '', coNameEn: '', coBranch: 'สำนักงานใหญ่', coAddr: '', coTax: '', coPhone: '', coEmail: '',
    sellerName: '', sellerPhone: '', validDays: '15วัน', vatRate: '7', bankInfo: '', logo: ''
  };

  function readWindowName() {
    try {
      if (!window.name || window.name[0] !== '{') return null;
      const parsed = JSON.parse(window.name);
      return parsed && parsed[WN_KEY] ? parsed[WN_KEY] : null;
    } catch { return null; }
  }

  function writeWindowName(obj) {
    try {
      let base = {};
      if (window.name && window.name[0] === '{') {
        try { base = JSON.parse(window.name) || {}; } catch { base = {}; }
      }
      base[WN_KEY] = obj;
      window.name = JSON.stringify(base);
    } catch { }
  }

  function hasData(p) {
    if (!p || typeof p !== 'object') return false;
    return Boolean((p.coName && p.coName.trim()) || (p.coAddr && p.coAddr.trim()) || (p.coTax && p.coTax.trim()) ||
      (p.coPhone && p.coPhone.trim()) || (p.coEmail && p.coEmail.trim()) || (p.bankInfo && p.bankInfo.trim()) || p.logo);
  }

  function get() {
    let ls = null;
    try { ls = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { ls = null; }
    const wn = readWindowName();
    let chosen = ls;
    if (!hasData(ls) && hasData(wn)) {
      chosen = wn;
      try { localStorage.setItem(KEY, JSON.stringify(wn)); } catch { }
    } else if (hasData(ls) && hasData(wn) && (wn._updatedAt || 0) > (ls._updatedAt || 0)) {
      chosen = wn;
      try { localStorage.setItem(KEY, JSON.stringify(wn)); } catch { }
    } else if (hasData(ls) && !hasData(wn)) {
      writeWindowName(ls);
    }
    return Object.assign({}, DEFAULT, chosen || {});
  }

  function set(p, silent) {
    const merged = Object.assign({}, DEFAULT, p || {}, { _updatedAt: Date.now() });
    try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch { }
    writeWindowName(merged);
    if (!silent) {
      try { document.dispatchEvent(new CustomEvent('profile:updated', { detail: merged })); } catch { }
    }
    return merged;
  }

  /* เขียนค่าลง element ที่มี data-profile="key"
     ถ้าผู้ใช้ยังไม่เคยตั้งค่า → คงข้อความตัวอย่างที่ติดมากับหน้าไว้
     data-profile-multiline="1" → \n กลายเป็น <br> (สำหรับ contenteditable) */
  let applying = false;
  function apply() {
    const p = get();
    const configured = hasData(p);
    applying = true;
    try {
      document.querySelectorAll('[data-profile]').forEach(el => {
        bindInlineElement(el);
        if (!configured) return;
        if (document.activeElement === el) return;
        const k = el.dataset.profile;
        const v = p[k] != null ? p[k] : '';
        if (el.dataset.profileMultiline) {
          if (v || k !== 'coName') el.innerHTML = v ? String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>') : '';
        } else if ('value' in el && el.tagName !== 'DIV') {
          el.value = v;
        } else {
          if (v || (k !== 'coName' && k !== 'sellerName')) el.textContent = v;
        }
      });
      document.querySelectorAll('[data-profile-logo]').forEach(img => {
        if (p.logo) { img.src = p.logo; img.style.display = ''; }
        else { img.removeAttribute('src'); img.style.display = 'none'; }
      });
    } finally {
      applying = false;
    }
  }

  function readElementValue(el) {
    if ('value' in el && el.tagName !== 'DIV') return el.value;
    if (el.dataset.profileMultiline) return (el.innerText || el.textContent || '').replace(/\r\n/g, '\n').trim();
    return (el.textContent || '').trim();
  }

  let inlineTimer = null;
  function bindInlineElement(el) {
    if (!el || el.dataset.profileBound) return;
    const editable = ('value' in el && el.tagName !== 'DIV') || el.isContentEditable || el.getAttribute('contenteditable') === 'true';
    if (!editable) return;
    el.dataset.profileBound = '1';
    const syncFromEl = () => {
      if (applying) return;
      const k = el.dataset.profile;
      if (!k) return;
      const val = readElementValue(el);
      const cur = get();
      if ((cur[k] || '') === val) return;
      cur[k] = val;
      set(cur, true);
      /* ซิงก์ element อื่นในหน้าเดียวกันที่ใช้ data-profile เดียวกัน */
      document.querySelectorAll('[data-profile="' + k + '"]').forEach(other => {
        if (other === el || document.activeElement === other) return;
        if ('value' in other && other.tagName !== 'DIV') other.value = val;
        else other.textContent = val;
      });
      clearTimeout(inlineTimer);
      inlineTimer = setTimeout(() => {
        try { document.dispatchEvent(new CustomEvent('profile:updated', { detail: get() })); } catch { }
      }, 300);
    };
    el.addEventListener('input', syncFromEl);
    el.addEventListener('change', syncFromEl);
    el.addEventListener('blur', syncFromEl);
  }

  window.addEventListener('storage', e => {
    if (e.key === KEY) {
      apply();
      try { document.dispatchEvent(new CustomEvent('profile:updated', { detail: get() })); } catch { }
    }
  });

  /* ย่อโลโก้ก่อนบันทึก กัน localStorage ล้น (ไฟล์ใหญ่ 848KB → ~80KB) */
  function shrinkLogo(file, maxSide) {
    maxSide = maxSide || 480;
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('ไม่ใช่ไฟล์รูปภาพ'));
        img.onload = () => {
          let { width: w, height: h } = img;
          if (w > h && w > maxSide) { h = Math.round(h * maxSide / w); w = maxSide; }
          else if (h > maxSide) { w = Math.round(w * maxSide / h); h = maxSide; }
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/png'));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     หน้าต่างตั้งค่า
     ══════════════════════════════════════════════════════════════ */
  function buildModal() {
    if (document.getElementById('profOverlay')) return;
    const ov = document.createElement('div');
    ov.className = 'x-overlay';
    ov.id = 'profOverlay';
    ov.innerHTML =
      '<div class="x-modal wide" role="dialog" aria-label="ตั้งค่าข้อมูลบริษัท">' +
      '<div class="x-modal-hd"><h3>⚙ ข้อมูลบริษัท</h3><button type="button" class="x-close" data-close="1">&times;</button></div>' +
      '<div class="x-modal-bd">' +
      '<div class="x-note">กรอกครั้งเดียว ข้อมูลจะถูกใช้กับทุกเอกสาร (ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จรับเงิน / หนังสือส่งมอบงาน) บนเครื่องนี้<br>ต้องการย้ายเครื่องหรือใช้หลายเครื่อง → กด “ส่งออก” แล้วนำไปกด “นำเข้า” ที่เครื่องปลายทาง</div>' +
      '<div class="x-logo-row">' +
      '<div class="x-logo-preview" id="logoPrev"></div>' +
      '<div class="x-logo-actions">' +
      '<input type="file" id="logoFile" accept="image/*" hidden>' +
      '<button type="button" class="x-btn" id="logoPick">เลือกรูปโลโก้</button>' +
      '<button type="button" class="x-btn danger" id="logoDel">ลบโลโก้</button>' +
      '<span style="font-size:10.5px;color:#9ca3af">PNG / JPG · ย่อให้อัตโนมัติ</span>' +
      '</div></div>' +
      '<div id="profFields" style="margin-top:16px"></div>' +
      '</div>' +
      '<div class="x-modal-ft">' +
      '<button type="button" class="x-btn" id="profExport">ส่งออก (.json)</button>' +
      '<button type="button" class="x-btn" id="profImport">นำเข้า</button>' +
      '<button type="button" class="x-btn" id="profPwd">เปลี่ยนรหัสผ่าน</button>' +
      '<input type="file" id="profFile" accept=".json" hidden>' +
      '<span style="flex:1"></span>' +
      '<button type="button" class="x-btn" data-close="1">ยกเลิก</button>' +
      '<button type="button" class="x-btn ok" id="profSave">บันทึก</button>' +
      '</div></div>';
    document.body.appendChild(ov);

    /* ช่องกรอก */
    const box = ov.querySelector('#profFields');
    box.innerHTML =
      '<div class="x-row2">' + FIELDS.slice(0, 2).map(fld).join('') + '</div>' +
      '<div class="x-row2">' + FIELDS.slice(2, 4).map(fld).join('') + '</div>' +
      fld(FIELDS[4]) +
      '<div class="x-row2">' + FIELDS.slice(5, 7).map(fld).join('') + '</div>' +
      '<div class="x-row2">' + FIELDS.slice(7, 9).map(fld).join('') + '</div>' +
      '<div class="x-row2">' + FIELDS.slice(9, 11).map(fld).join('') + '</div>' +
      fld(FIELDS[11]);

    const prev = ov.querySelector('#logoPrev');
    const file = ov.querySelector('#logoFile');
    let pendingLogo = null, removeLogo = false;

    function drawLogo(p) {
      const src = removeLogo ? '' : (pendingLogo || p.logo);
      prev.innerHTML = src ? '<img src="' + src + '" alt="">' : '<span class="none">ไม่มีโลโก้</span>';
    }

    ov.querySelector('#logoPick').addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      if (!file.files[0]) return;
      shrinkLogo(file.files[0]).then(d => { pendingLogo = d; removeLogo = false; drawLogo(get()); })
        .catch(err => alert(err.message));
      file.value = '';
    });
    ov.querySelector('#logoDel').addEventListener('click', () => { pendingLogo = null; removeLogo = true; drawLogo(get()); });

    ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => ov.classList.remove('open')));
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') ov.classList.remove('open'); });

    ov.querySelector('#profSave').addEventListener('click', () => {
      const p = {};
      FIELDS.forEach(f => { const el = ov.querySelector('[data-f="' + f.k + '"]'); if (el) p[f.k] = el.value; });
      const old = get();
      p.logo = removeLogo ? '' : (pendingLogo || old.logo);
      const saved = set(p, true);
      apply();
      try { document.dispatchEvent(new CustomEvent('profile:updated', { detail: saved })); } catch { }
      ov.classList.remove('open');
      alert('บันทึกข้อมูลบริษัทเรียบร้อยแล้ว');
    });

    ov.querySelector('#profExport').addEventListener('click', () => {
      const p = Object.assign(get(), pendingLogo ? { logo: pendingLogo } : {});
      const b = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'company_profile.json';
      a.click();
    });

    const pf = ov.querySelector('#profFile');
    ov.querySelector('#profImport').addEventListener('click', () => pf.click());
    pf.addEventListener('change', () => {
      const f = pf.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = e => {
        try {
          const d = JSON.parse(e.target.result);
          const saved = set(d, true);
          apply();
          try { document.dispatchEvent(new CustomEvent('profile:updated', { detail: saved })); } catch { }
          openModal();
          alert('นำเข้าข้อมูลบริษัทเรียบร้อยแล้ว');
        } catch { alert('ไฟล์ไม่ถูกต้อง'); }
      };
      r.readAsText(f); pf.value = '';
    });

    ov.querySelector('#profPwd').addEventListener('click', () => {
      const oldP = prompt('รหัสผ่านเดิม:');
      if (oldP === null) return;
      const newP = prompt('รหัสผ่านใหม่ (อย่างน้อย 4 ตัวอักษร):');
      if (newP === null) return;
      GATE.changePassword(oldP, newP).then(r => alert(r.msg));
    });

    ov._refresh = () => {
      const p = get();
      FIELDS.forEach(f => { const el = ov.querySelector('[data-f="' + f.k + '"]'); if (el) el.value = p[f.k] || ''; });
      pendingLogo = null; removeLogo = false;
      drawLogo(p);
    };
  }

  function fld(f) {
    return '<div class="x-field"><label>' + f.label + '</label>' +
      (f.area
        ? '<textarea data-f="' + f.k + '" placeholder="' + f.ph + '"></textarea>'
        : '<input type="text" data-f="' + f.k + '" placeholder="' + f.ph + '">') +
      '</div>';
  }

  function openModal() { buildModal(); const ov = document.getElementById('profOverlay'); ov._refresh(); ov.classList.add('open'); }

  /* ใส่ปุ่ม ⚙ ใน toolbar ที่กำลังวางอยู่ */
  function mountButton(container) {
    const b = document.createElement('button');
    b.className = 'x-btn';
    b.innerHTML = '⚙ ข้อมูลบริษัท';
    b.title = 'ตั้งค่าชื่อบริษัท ที่อยู่ เลขภาษี โลโก้';
    b.addEventListener('click', openModal);
    container.appendChild(b);
  }

  return { get, set, apply, openModal, mountButton, shrinkLogo, KEY };
})();