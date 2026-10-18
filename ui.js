/* Shared UI primitives. Dependencies are bundled locally; taxpayer data stays in memory. */
const KPPUI = {
  serviceName(value) {
    const names = {npwp:'NPWP',nik:'NIK',pph:'PPh',ppn:'PPN',ppnbm:'PPnBM',spt:'SPT',sppkp:'SPPKP',pkp:'PKP',djp:'DJP',efin:'EFIN',ntpn:'NTPN',pbb:'PBB',pbk:'PBK',wp:'WP',pt:'PT',cv:'CV',coretax:'Coretax','e-faktur':'e-Faktur','e-bupot':'e-Bupot','e-filing':'e-Filing'};
    return String(value || '').replace(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu, word => names[word.toLowerCase()] || word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  },
  taxpayerName(ticket) {
    const applicant = ticket.namaPemohon || ticket.nama || '';
    const taxpayer = ticket.namaWP || applicant || 'Wajib Pajak';
    return taxpayer + (applicant ? ' (' + applicant + ')' : '');
  },
  icon(name) {
    const span = document.createElement('span');
    span.className = 'ik'; span.setAttribute('aria-hidden', 'true');
    const library = typeof KPPLibs === 'undefined' ? null : KPPLibs;
    span.innerHTML = library && library.icons[name] || '';
    return span;
  },
  // short: label ringkas untuk layar sempit (CSS memilih salah satu; pembaca layar memakai aria-label).
  button(el, label, icon, busy = false, short = '') {
    const state = [label, icon, busy, short].join('|');
    if (el.dataset.uiState === state) return;
    el.dataset.uiState = state;
    el.setAttribute('aria-busy', String(busy));
    const mark = KPPUI.icon(busy ? 'spinner' : icon);
    if (busy) mark.classList.add('ui-spin');
    const text = document.createElement('span'); text.textContent = label;
    if (!short) { el.replaceChildren(mark, text); return; }
    text.className = 'ui-label-panjang';
    const pendek = document.createElement('span'); pendek.className = 'ui-label-pendek'; pendek.textContent = short; pendek.setAttribute('aria-hidden', 'true');
    el.setAttribute('aria-label', label);
    el.replaceChildren(mark, text, pendek);
  },
  skeleton(kind = 'chat') {
    const box = document.createElement('div');
    box.className = 'ui-skeleton ui-skeleton-' + kind;
    box.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < (kind === 'list' ? 6 : 4); i++) {
      const row = document.createElement('div'); row.className = 'ui-skeleton-row';
      for (let j = 0; j < 3; j++) { const bar = document.createElement('span'); row.append(bar); }
      box.append(row);
    }
    return box;
  }
};
