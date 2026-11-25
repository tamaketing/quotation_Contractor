// Store an effective rate of zero so existing exports and document imports
// also respect the VAT selection without a second source of truth.
window.VAT = {
  lastRate: 7,
  sync() {
    const rate = document.getElementById('vatR');
    const enabled = document.getElementById('vatEnabled');
    if (!rate || !enabled) return;
    enabled.checked = Number(rate.value) !== 0;
    rate.disabled = !enabled.checked;
    if (enabled.checked) this.lastRate = rate.value;
  },
  toggle() {
    const rate = document.getElementById('vatR');
    const enabled = document.getElementById('vatEnabled');
    if (enabled.checked) {
      rate.value = this.lastRate;
    } else {
      if (Number(rate.value)) this.lastRate = rate.value;
      rate.value = 0;
    }
    this.sync();
  }
};
