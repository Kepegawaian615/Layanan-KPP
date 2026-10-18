/* Integrated staff dashboard. API calls always use the existing signed Telegram session. */
function buatDashboard(kunciAwal) {
  app.classList.add('dashboard-app');
  const simpan = S.dashboard || (S.dashboard = { drafts: {}, query: '', filter: 'balas', layanan: '', selected: '' });
  function preference(key, value) { try { if (value !== undefined) localStorage.setItem(key, value); return localStorage.getItem(key) || ''; } catch (e) { return ''; } }
  if (!simpan.preferenceLoaded) { simpan.layanan = preference('kpp615-fokus'); simpan.preferenceLoaded = true; }
  let catalog = [];
  let selected = kunciAwal || simpan.selected || '', detail = null, list = [], versi = '', detailSeq = 0;
  let disposed = false, syncing = false, lastFull = 0, signature = '', detailKey = '', actionBusy = false;
  let detailFresh = false, syncQueued = false, dataEpoch = 0, listSignature = '', quickSignature = '', fileSignature = '';
  const cached = simpan.cache || (simpan.cache = typeof KPPLibs !== 'undefined' ? new KPPLibs.QuickLRU({ maxSize: 12, maxAge: 60000 }) : { get() {}, set() {}, delete() {}, clear() {} });
  const detailFlights = new Map();
  const ui = typeof KPPUI === 'undefined' ? null : KPPUI;
  const serviceName = value => ui ? ui.serviceName(value) : value;
  const personName = ticket => ui ? ui.taxpayerName(ticket) : ticket.namaWP || ticket.namaPemohon || ticket.nama;
  function buttonFace(el, label, icon, busy, short) { if (ui) ui.button(el, label, icon, !!busy, short || ''); else { el.textContent = label; el.setAttribute('aria-busy', String(!!busy)); } }
  function markChanged(key) { dataEpoch++; cached.delete(key); detailFlights.delete(key); if (key === selected) detailFresh = false; }
  const root = h('main', { class: 'dash', 'aria-label': 'Dashboard petugas', 'aria-busy': 'true', 'data-loading': 'true', 'data-view': selected ? 'chat' : 'daftar', 'data-info': 'false' });
  const live = h('span', { class: 'dash-sync', role: 'status', text: 'Menghubungkan…' });
  const count = h('span', { class: 'dash-count', text: '0' });
  const countMobile = h('span', { class: 'dash-count', text: '' });
  const search = h('input', { class: 'dash-search', type: 'search', placeholder: 'Cari nama WP, tiket, atau permohonan', 'aria-label': 'Cari tiket', value: simpan.query, autocomplete: 'off' });
  const services = h('select', { class: 'dash-services', 'aria-label': 'Filter layanan' }, h('option', { value: '', text: 'Semua Layanan' }));
  const focusBar = h('nav', { class: 'dash-focus', 'aria-label': 'Fokus jenis pelayanan' });
  const filters = h('div', { class: 'dash-filters', role: 'group', 'aria-label': 'Status antrean' });
  const items = h('div', { class: 'dash-items', role: 'listbox', 'aria-label': 'Daftar tiket' }, h('p', { class: 'dash-skeleton', text: 'Memuat antrean bersama…' }));
  const title = h('h2', { text: selected ? 'Memuat percakapan…' : 'Pilih percakapan' });
  const subtitle = h('p');
  const identity = h('p', {class:'dash-identity'});
  const billingProgress = h('span', {class:'dash-billing-pill',hidden:true});
  const badge = h('span', { class: 'dash-status' });
  const chatSearch = h('input', { class: 'dash-chat-search', type: 'search', placeholder: 'Cari dalam percakapan ini…', 'aria-label': 'Cari dalam percakapan', hidden: true });
  const chatSearchButton = h('button', { class: 'dash-tool', 'aria-label': 'Cari dalam percakapan', onClick: () => { chatSearch.hidden = !chatSearch.hidden; if (!chatSearch.hidden) chatSearch.focus(); else { chatSearch.value = ''; signature = ''; if (detail) showDetail(detail, selected, detailSeq, !detailFresh); } } }, '⌕');
  const notice = h('div', { class: 'dash-notice', role: 'status' });
  const problem = h('div', { class: 'dash-problem', role: 'alert' });
  const messages = h('div', { class: 'dash-messages' });
  const pending = h('div', { class: 'dash-pending' });
  const sendingPreview = h('div', { class: 'dash-sending-preview', role: 'status', hidden: true });
  // Tombol "Pesan terbaru" menempel di bawah area percakapan, berapa pun tinggi kotak pesan.
  const newMessage = h('button', { class: 'dash-btn dash-new', hidden: true, onClick: () => scrollBottom() }, 'Pesan terbaru ↓');
  const conversation = h('div', { class: 'dash-conversation', tabindex: '0', 'aria-label': 'Riwayat percakapan' }, messages, sendingPreview, pending, newMessage);
  const media = new KPPChat.Media({api:(...args)=>api(...args),current:key=>!disposed && selected===key,root:conversation});
  const textarea = h('textarea', { rows: '1', maxlength: '3500', placeholder: 'Pilih tiket untuk membalas…', 'aria-label': 'Balasan untuk WP', disabled: true });
  const internal = h('input', { type: 'checkbox', id: 'dash-internal' });
  const send = h('button', { type: 'button', class: 'dash-btn primary dash-send', 'aria-label': 'Kirim balasan', disabled: true, onClick: () => sendMessage() }, 'Kirim pesan');
  const length = h('span', { class: 'dash-compose-count', text: '0 / 3500' });
  const info = h('aside', { class: 'dash-detail', 'aria-label': 'Informasi WP dan tindakan' });
  const fileInput = h('input', { type: 'file', multiple: true, hidden: true, 'aria-label': 'Pilih lampiran' });
  const attach = h('button', { type: 'button', class: 'dash-tool', title: 'Lampirkan foto atau dokumen', 'aria-label': 'Lampirkan file', disabled: true, onClick: () => fileInput.click() }, '＋');
  const replyBar = h('div', { class: 'dash-reply-bar', hidden: true });
  const filesBar = h('div', { class: 'dash-files', hidden: true });
  const emojiPanel = h('div', { class: 'dash-emoji-panel', hidden: true, 'aria-label': 'Pilih emoji' });
  const emoji = h('button', { type: 'button', class: 'dash-tool', title: 'Emoji', 'aria-label': 'Buka emoji', onClick: () => { emojiPanel.hidden = !emojiPanel.hidden; emoji.setAttribute('aria-expanded', String(!emojiPanel.hidden)); } }, '☺');
  const enterSend = h('input', { type: 'checkbox', checked: preference('kpp615-enter') === '1', 'aria-label': 'Enter untuk mengirim' });
  const nativeChat = h('button', { class: 'dash-btn dash-native', onClick: () => openTopic() }, 'Telegram ↗');
  const infoToggle = h('button', { class: 'dash-btn dash-info-toggle', 'aria-label': 'Informasi wajib pajak', onClick: () => { root.dataset.info = 'true'; tombolKembali(); } }, 'Info');
  const dropArea = h('div', { class: 'dash-drop', hidden: true }, h('strong', { text: 'Lepaskan file di sini' }), h('span', { text: 'Foto atau dokumen · maksimal 5 MB/file' }));
  const previewDialog = h('dialog', { class: 'dash-preview-dialog', 'aria-label': 'Pratinjau lampiran' });
  const quickDialog = h('dialog', { class: 'dash-quick-dialog', 'aria-label': 'Jawaban cepat' });
  const manageDialog = h('dialog', { class: 'dash-quick-dialog dash-manage-dialog', 'aria-label': 'Kelola jawaban cepat' });
  const quickSearch = h('input', { type: 'search', placeholder: 'Cari jawaban atau /perintah', 'aria-label': 'Cari jawaban cepat' });
  const quickResults = h('div', { class: 'dash-quick-results', id: 'dash-quick-results', role: 'listbox', 'aria-label': 'Pilihan jawaban cepat' });
  const pickerManage = h('button', { class: 'dash-tool', type: 'button', title: 'Ubah atau hapus jawaban cepat', 'aria-label': 'Kelola jawaban cepat', onClick: () => openManage() }, ui ? ui.icon('kelola') : '⚙');
  const pickerAdd = h('button', { class: 'dash-tool', type: 'button', title: 'Tambah jawaban cepat', 'aria-label': 'Tambah jawaban cepat', onClick: () => addQuickReply() }, ui ? ui.icon('tambah') : '+');
  const quickPicker = h('div', { class: 'dash-quick-picker', hidden: true }, h('div', { class: 'dash-quick-search-row' }, quickSearch, pickerManage, pickerAdd, h('button', { class: 'dash-tool', 'aria-label': 'Tutup jawaban cepat', onClick: () => closeQuick() }, ui ? ui.icon('tutup') : '×')), quickResults);
  const quickChips = h('div', { class: 'dash-quick-chips' });
  const quickButton = h('button', { class: 'dash-quick-label', type: 'button', 'aria-expanded': 'false', onClick: () => { quickOpen = !quickOpen; slashDismissed = false; quickSearch.value = ''; drawQuick(); if (quickOpen) quickSearch.focus(); } }, 'Jawaban cepat');
  const quickManage = h('button', { class: 'dash-quick-manage', type: 'button', title: 'Ubah atau hapus jawaban cepat', onClick: () => openManage() }, 'Kelola');
  const quickAdd = h('button', { class: 'dash-quick-add', type: 'button', onClick: () => addQuickReply() }, '+ Tambah');
  const quickBar = h('div', { class: 'dash-quick-bar' }, h('div', { class: 'dash-quick-heading' }, quickButton, h('kbd', { text: '/' }), quickManage, quickAdd), quickChips);
  const finish = h('button', { class: 'dash-btn dash-finish', disabled: true, onClick: () => {
    if (!detail || finish.disabled) return;
    const key = selected;
    confirmAction('Selesaikan permohonan ' + detail.tiket.id + '? WP akan menerima pesan penutup dan permintaan penilaian.', () => runAction('selesai', {}, key));
  } }, '✓ Selesaikan permohonan');
  let quickOpen = false, slashDismissed = false, quickOptions = [], quickIndex = 0;
  let quickForm = null;
  const editForms = {};
  let previewURL = '', dragDepth = 0;

  const compose = h('div', { class: 'dash-compose', 'data-internal': 'false' },
    quickBar, quickPicker, replyBar, filesBar, emojiPanel, fileInput, h('div', { class: 'dash-write-row' }, attach, textarea, emoji, send),
    h('div', { class: 'dash-compose-bottom' }, h('label', { class: 'dash-note-toggle', for: 'dash-internal' }, internal, 'Catatan internal'), h('div', { class: 'dash-compose-hint' }, h('label', { class: 'dash-enter-setting' }, enterSend, 'Enter kirim'), length)));
  const next = h('button', { class: 'dash-btn primary', onClick: () => nextTicket() }, 'Tiket berikutnya →');
  const refresh = h('button', { class: 'dash-btn ghost dash-refresh', onClick: () => sync(true) }, '↻ Muat ulang');
  root.append(
    h('header', { class: 'dash-head' },
      h('div', { class: 'dash-brand' }, h('img', {class:'dash-brand-logo',src:'logo-djp.png',alt:'DJP',width:'44',height:'44',onError:e=>{e.target.hidden=true;}}), h('div', {}, h('h1', { text: 'Dashboard Telegram' }), h('p', { text: 'KPP Pratama Surabaya Rungkut' }))),
      h('div', { class: 'dash-mobile-title' }, h('b', { text: 'Kotak masuk' }), countMobile),
      h('div', { class: 'dash-head-actions' }, live, refresh, next)),
    h('div', { class: 'dash-focus-wrap' }, focusBar),
    h('div', { class: 'dash-grid' },
      h('aside', { class: 'dash-list', 'aria-label': 'Antrean bersama' },
        h('div', { class: 'dash-list-head' }, h('div', { class: 'dash-title-row' }, h('h2', { text: 'Kotak masuk' }), count), search, filters, services), items),
      h('section', { class: 'dash-chat', 'aria-label': 'Percakapan terpilih' },
        h('header', { class: 'dash-chat-head' }, h('div', { class: 'dash-chat-main' }, h('button', { class: 'dash-btn dash-back', 'aria-label': 'Kembali ke daftar', onClick: () => { root.dataset.view = 'daftar'; tombolKembali(); } }, ui ? ui.icon('kembali') : '←'),
          h('div', { class: 'dash-chat-heading' }, title, subtitle, identity), chatSearchButton, nativeChat, infoToggle),
          h('div', { class: 'dash-chat-actions' }, h('div', {class:'dash-ticket-status'}, badge, billingProgress), finish)),
        notice, chatSearch, conversation, problem, compose, dropArea), info), previewDialog, quickDialog, manageDialog);

  if (ui) {
    items.replaceChildren(ui.skeleton('list'));
    if (selected) messages.replaceChildren(ui.skeleton('chat'));
    attach.replaceChildren(ui.icon('lampiran')); emoji.replaceChildren(ui.icon('emoji')); chatSearchButton.replaceChildren(ui.icon('cari'));
    buttonFace(nativeChat, 'Telegram', 'tautan'); buttonFace(next, 'Tiket berikutnya', 'panah');
    buttonFace(refresh, 'Muat ulang', 'muat'); refresh.setAttribute('aria-label', 'Muat ulang');
    buttonFace(quickAdd, 'Tambah', 'tambah'); buttonFace(quickManage, 'Kelola', 'kelola'); buttonFace(newMessage, 'Pesan terbaru', 'turun');
    buttonFace(infoToggle, 'Info', 'catatan'); infoToggle.setAttribute('aria-label', 'Informasi wajib pajak');
  }
  // Layar sempit: daftar dan percakapan bergantian; tombol kembali Telegram ikut dipakai.
  function sempit() { try { return !!(window.matchMedia && window.matchMedia('(max-width: 760px), (max-height: 500px) and (max-width: 1024px)').matches); } catch (e) { return false; } }
  function tombolKembali() {
    try {
      const b = tg && tg.BackButton;
      if (!b) return;
      if (sempit() && (root.dataset.view === 'chat' || root.dataset.info === 'true')) b.show(); else if (!(S.riwayat && S.riwayat.length > 1)) b.hide();
    } catch (e) { /* SDK lama */ }
  }
  S.kembaliDashboard = () => {
    if (disposed) return false;
    if (root.dataset.info === 'true') { root.dataset.info = 'false'; tombolKembali(); return true; }
    if (root.dataset.view === 'chat' && sempit()) { root.dataset.view = 'daftar'; tombolKembali(); return true; }
    return false;
  };
  function tinggiOtomatis() {
    try {
      if (!textarea.style || typeof textarea.scrollHeight !== 'number') return;
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight + 2, sempit() ? 132 : 180) + 'px';
    } catch (e) { /* tanpa tata letak */ }
  }

  const groups = [
    ['balas', 'Perlu dibalas', t => t.alur === 'Perlu dibalas'],
    ['proses', 'Diproses', t => t.alur === 'Sedang diproses'],
    ['tunggu', 'Menunggu WP', t => t.alur === 'Menunggu WP'],
    ['selesai', 'Selesai', t => !active(t)],
    ['semua', 'Semua', () => true],
  ];
  function active(t) { return !!t && ['Menunggu', 'Dilayani'].includes(t.status); }
  function draft(key = selected) {
    const d = simpan.drafts[key] || (simpan.drafts[key] = { text: '', internal: false, revision: null, request: null, sending: false, result: null, error: '' });
    d.files = d.files || []; return d;
  }
  function inFocus(t) { return !simpan.layanan || t.layanan === simpan.layanan; }
  function setFocus(name) { simpan.layanan = name; services.value = name; preference('kpp615-fokus', name); drawList(); }

  function validView(key, seq) { return !disposed && selected === key && (seq === undefined || seq === detailSeq); }
  function empty(heading, text) { return h('div', { class: 'dash-empty' }, h('b', { text: heading }), text ? h('p', { text }) : null); }
  function scrollBottom() { conversation.scrollTop = conversation.scrollHeight; newMessage.hidden = true; }
  function initials(name) { return String(name || 'WP').trim().split(/\s+/).slice(0, 2).map(x => x.charAt(0).toUpperCase()).join(''); }
  function since(t) { const n = Math.max(0, Math.floor((Date.now() - Number(t.menungguMs || t.masukMs || Date.now())) / 60000)); return n < 1 ? 'baru' : n < 60 ? n + ' mnt' : n < 1440 ? Math.floor(n / 60) + ' jam' : Math.floor(n / 1440) + ' hari'; }
  function waitingOrder(a, b) { return Number(a.menungguMs || a.masukMs || 0) - Number(b.menungguMs || b.masukMs || 0); }
  function visibleTickets() {
    const test = (groups.find(g => g[0] === simpan.filter) || groups[0])[2];
    const q = simpan.query.toLocaleLowerCase('id').trim();
    return list.filter(t => test(t) && inFocus(t) && (!q || [t.nama, t.namaWP, t.id, t.layanan, t.terakhir && t.terakhir.isi].filter(Boolean).join(' ').toLocaleLowerCase('id').includes(q))).sort((a,b) => Number(!active(a)) - Number(!active(b)) || waitingOrder(a,b));
  }
  function drawList() {
    const snapshot = JSON.stringify([list, catalog, selected, simpan.query, simpan.filter, simpan.layanan, Object.entries(simpan.drafts).map(([key,d]) => [key,!!d.sending,!!d.request,!!(d.text || d.files && d.files.length)])]);
    if (snapshot === listSignature) return;
    listSignature = snapshot;
    count.textContent = String(list.filter(active).length) + ' aktif';
    countMobile.textContent = count.textContent;
    // Ringkasan status sekaligus filter; angka mengikuti fokus layanan yang dipilih.
    // Baris atas: tiga status yang perlu ditangani. Baris bawah: Selesai dan Semua (lebih ringkas).
    const filterButton = ([key, label, test]) => h('button', { class: 'dash-filter', type: 'button', 'data-status': key, 'aria-pressed': String(simpan.filter === key), onClick: () => { simpan.filter = key; drawList(); } }, label, h('small', { text: list.filter(t => test(t) && inFocus(t)).length }));
    filters.replaceChildren(h('div', { class: 'dash-filters-utama' }, groups.slice(0, 3).map(filterButton)), h('div', { class: 'dash-filters-lain' }, groups.slice(3).map(filterButton)));
    const names = [...new Set(catalog.map(l => l.nama).concat(list.map(t => t.layanan)))].filter(Boolean).sort();
    if (simpan.layanan && !names.includes(simpan.layanan)) simpan.layanan = '';
    focusBar.replaceChildren(...[''].concat(names).map(name => h('button', { class: 'dash-service-tab', 'aria-pressed': String(simpan.layanan === name), onClick: () => setFocus(name) },
      h('span', { text: serviceName(name) || 'Semua Layanan' }), h('small', { text: list.filter(t => active(t) && (!name || t.layanan === name)).length }))));

    const serviceSignature = names.join('|');
    if (services.dataset.options !== serviceSignature) {
      services.replaceChildren(h('option', { value: '', text: 'Semua Layanan' }), ...names.map(n => h('option', { value: n, text: serviceName(n) })));
      if (simpan.layanan && !names.includes(simpan.layanan)) simpan.layanan = '';
      services.value = simpan.layanan; services.dataset.options = serviceSignature;
    }
    const shown = visibleTickets();
    next.disabled = !list.some(t => t.kunci !== selected && t.alur === 'Perlu dibalas' && inFocus(t));
    if (!shown.length) { items.replaceChildren(empty('Tidak ada tiket', simpan.query ? 'Coba nama atau nomor tiket lain.' : 'Tiket yang sesuai akan muncul di sini.')); return; }
    items.replaceChildren(...shown.map(t => {
      const d = simpan.drafts[t.kunci];
      const state = d && (d.sending ? 'Sedang mengirim…' : d.request ? 'Periksa hasil kiriman' : d.text || (d.files && d.files.length) ? 'Draf tersimpan' : '');
      const preview = state || (t.terakhir ? (t.terakhir.dari === 'wp' ? 'WP: ' : 'Petugas: ') + t.terakhir.isi : 'Permohonan baru');
      const alur = !active(t) ? 'selesai' : t.alur === 'Perlu dibalas' ? 'balas' : t.alur === 'Menunggu WP' ? 'tunggu' : 'proses';
      return h('button', { class: 'dash-item' + (!active(t) ? ' is-closed' : ''), role: 'option', 'aria-selected': String(t.kunci === selected), 'data-key': t.kunci, 'data-alur': alur, onClick: () => select(t.kunci) },
        h('span', { class: 'dash-avatar', text: initials(t.namaWP || t.nama) }),
        h('span', { class: 'dash-item-main' }, h('span', { class: 'dash-item-name', text: personName(t) }),
          h('span', { class: 'dash-item-sub', text: t.id + ' · ' + serviceName(t.layanan) }),
          h('span', { class: state ? 'dash-item-preview dash-draft' : 'dash-item-preview', text: preview }),
          t.billingSisa ? h('span', { class: 'dash-item-sub', text: 'Sisa ' + t.billingSisa + ' billing' }) : null),
        h('span', { class: 'dash-item-meta' }, h('span', { text: !active(t) ? t.status : t.alur === 'Perlu dibalas' ? since(t) : t.masuk }),
          t.pesanBaru && active(t) ? h('span', { class: 'dash-unread', 'aria-label': t.pesanBaru + ' pesan belum dibalas', text: t.pesanBaru }) : null));
    }));
  }
  function renderDraft() {
    if (!selected) { compose.hidden = true; finish.disabled = true; return; }
    const d = draft();
    compose.hidden = !!detail && !active(detail.tiket);
    const available = detail && detailKey === selected && active(detail.tiket);
    finish.disabled = !available || !detailFresh || actionBusy || d.sending || !!d.request;
    buttonFace(finish, actionBusy ? 'Memproses…' : 'Selesaikan permohonan', 'selesai', actionBusy, actionBusy ? '' : 'Selesaikan');
    if (textarea.value !== d.text) { textarea.value = d.text; tinggiOtomatis(); }
    internal.checked = d.internal;
    textarea.disabled = !available || d.sending || !!d.request;
    internal.disabled = textarea.disabled;
    // HP: petunjuk singkat agar tidak terpotong di kolom ketik satu baris.
    textarea.placeholder = d.request ? (sempit() ? 'Periksa kiriman dahulu…' : 'Periksa hasil kiriman ini sebelum mengubah draf.') : d.internal ? (sempit() ? 'Catatan internal…' : 'Catatan untuk rekan petugas…')
      : sempit() ? 'Tulis balasan…' : 'Tulis balasan untuk ' + (detail ? detail.tiket.namaPemohon : 'WP') + '…';
    compose.dataset.internal = String(d.internal); length.textContent = d.text.length + ' / 3500';
    const membaca = d.files.some(f => f.billing && f.baca === 'membaca');
    const kedaluwarsa = d.files.some(f => billingLewat(f));
    send.disabled = !available || !detailFresh || d.sending || (!d.text.trim() && !d.files.length && !d.request) || d.text.length > (d.files.length ? 1024 : 3500) || (!d.request && (membaca || kedaluwarsa));
    const sendLabel = d.sending ? 'Mengirim…' : d.request ? 'Periksa kiriman' : membaca ? 'Membaca dokumen…' : d.internal ? 'Simpan catatan' : d.files.length ? 'Kirim ' + d.files.length + ' lampiran' : 'Kirim pesan';
    buttonFace(send, sendLabel, d.request ? 'muat' : d.internal ? 'internal' : 'kirim', d.sending || (membaca && !d.request));
    send.dataset.mode = !d.sending && !d.request && !membaca && !d.internal && !d.files.length ? 'kirim' : 'lain';
    attach.disabled = !available || d.internal || d.sending || !!d.request;
    emoji.disabled = !available || d.sending || !!d.request;
    internal.disabled = textarea.disabled || !!d.files.length;
    nativeChat.disabled = !detail || !detail.tiket.topik;
    textarea.maxLength = d.files.length ? 1024 : 3500;
    length.textContent = d.text.length + ' / ' + textarea.maxLength;
    replyBar.hidden = !d.reply;
    replyBar.replaceChildren(...(d.reply ? [h('span', {}, h('b', { text: 'Membalas ' + d.reply.nama }), h('span', { text: d.reply.isi })), h('button', { class: 'dash-tool', 'aria-label': 'Batalkan balasan', disabled: !!d.request || d.sending, onClick: () => { d.reply = null; renderDraft(); } }, ui ? ui.icon('tutup') : '×')] : []));
    drawFiles(d);
    drawQuick();
    drawSending();

    const stale = detail && d.text && d.revision !== null && d.revision !== detail.revisi;
    notice.textContent = stale ? 'Ada percakapan baru sejak draf ini dibuat. Baca pesan terbaru; sistem akan meminta konfirmasi sebelum mengirim.' : d.request && !d.sending ? 'Hasil pengiriman belum diketahui. Tekan Periksa kiriman dengan ID yang sama; jangan menulis ulang pesan.' : '';
    problem.replaceChildren();
    if (d.receipt) problem.append(h('div', {class:'dash-receipt',role:'status',text:d.receipt}));
    if (d.error) problem.append(h('div', { class: 'dash-notice', text: d.error }));
    if (d.result && !(detail && (detail.tertahan || []).some(r => r.operasi === d.result.operasi))) {
      const key = selected;
      problem.append(kartuPengiriman(d.result, () => { draft(key).result = null; markChanged(key); ++detailSeq; sync(true); }));
    }
  }
  function drawSending() {
    const d = selected && draft(selected), echo = d && d.echo;
    sendingPreview.hidden = !echo;
    if (!echo) { sendingPreview.replaceChildren(); return; }
    const line = h('span', { class: 'dash-echo-status' }, ui ? ui.icon(echo.phase === 'Mengirim…' ? 'spinner' : echo.phase === 'Terkirim' || echo.phase === 'Catatan tersimpan' ? 'cek' : 'jam') : null, echo.phase);
    if (echo.phase === 'Mengirim…') line.classList.add('is-sending');
    sendingPreview.replaceChildren(h('article', { class: 'dash-message ' + (echo.internal ? 'internal' : 'petugas') + ' dash-local-message' }, h('span', { class: 'dash-message-text', text: echo.text }), line));
  }
  function showDetail(r, key, seq, fromCache = false) {
    if (!validView(key, seq)) return;
    if (!r || !r.ok) {
      media.reset(); cached.clear(); detail = null; detailKey = ''; detailFresh = false; identity.textContent = ''; billingProgress.hidden = true; title.textContent = 'Percakapan belum tersedia'; subtitle.textContent = key;
      messages.replaceChildren(empty('Belum dapat membuka tiket', r && r.pesan || 'Coba muat ulang.')); pending.replaceChildren(); info.replaceChildren(); renderDraft(); return;
    }
    // Never replace a newer WP/reply revision with a late response.
    if (detail && detailKey === key) {
      const old = String(detail.revisi).split(':').map(Number), fresh = String(r.revisi).split(':').map(Number);
      if (fresh[0] < old[0] || fresh[1] < old[1]) return;
    }
    const first = detailKey !== key, atBottom = conversation.scrollHeight - conversation.scrollTop - conversation.clientHeight < 90;
    detail = r; detailKey = key; detailFresh = !fromCache;
    if (!fromCache) { cached.set(key, r); root.dataset.loading = 'false'; root.setAttribute('aria-busy', 'false'); }
    const d = draft(key);
    if (!fromCache && d.echo && d.echo.acknowledged) d.echo = null;
    if (d.result && ['Tertahan', 'Mengirim', 'Belum pasti'].includes(d.result.status) && !(r.tertahan || []).some(x => x.operasi === d.result.operasi)) {
      d.result = null; d.error = 'Pengiriman sebelumnya sudah ditangani. Periksa riwayat untuk melihat hasilnya.';
    }
    title.textContent = personName(r.tiket);
    identity.textContent = 'NPWP/NIK: ' + (r.tiket.npwp || '—');
    billingProgress.hidden = !r.tiket.billing;
    billingProgress.textContent = r.tiket.billing ? 'Billing ' + r.ringkasan.terkirim + (r.ringkasan.diminta ? ' / ' + r.ringkasan.diminta : ' terkirim') : '';
    subtitle.textContent = r.tiket.id + ' · ' + serviceName(r.tiket.layanan) + ' · lewat ' + r.tiket.lewat;
    badge.textContent = r.tiket.alur; badge.className = 'dash-status' + (!active(r.tiket) ? ' done' : r.tiket.alur === 'Menunggu WP' ? ' wait' : '');
    const newSignature = JSON.stringify(r.pesan);
    if (newSignature !== signature || first) {
      if (media.observer) media.observer.disconnect();
      signature = newSignature;
      const shownMessages = r.pesan.filter(m => !chatSearch.value.trim() || String(m.isi).toLocaleLowerCase('id').includes(chatSearch.value.toLocaleLowerCase('id').trim()));
      messages.replaceChildren(...(r.pesan.length ? (shownMessages.length ? shownMessages.map(m => renderMessage(m, r.tiket, key)) : [empty('Pesan tidak ditemukan', 'Coba kata lain dalam percakapan ini.')]) : [empty('Percakapan dimulai di sini', r.tiket.uraian || 'Balas permohonan WP melalui kotak pesan.') ]));
      if (first || atBottom) scrollBottom(); else newMessage.hidden = false;
    }
    pending.replaceChildren(...(r.tertahan || []).map(op => kartuPengiriman(op, () => { draft(key).result = null; markChanged(key); ++detailSeq; sync(true); })));
    drawInfo(); renderDraft();
  }
  function drawInfo() {
    if (!detail) { info.replaceChildren(empty('Informasi WP', 'Pilih tiket untuk melihat rincian.')); return; }
    const t = detail.tiket, r = detail.ringkasan, key = selected;
    const actions = h('section', { class: 'dash-section' }, h('h3', { text: 'Tindakan layanan' }));
    if (active(t)) {
      actions.append(h('button', { class: 'dash-btn', onClick: () => runAction('tunggu') }, 'Menunggu WP'),
        h('button', { class: 'dash-btn', onClick: () => runAction('proses') }, 'Sedang diproses'));
      if (detail.layanan.length) {
        const move = h('select', { class: 'dash-services', 'aria-label': 'Pindah ke layanan', style: 'margin-top:12px' }, h('option', { value: '', text: 'Pindah jenis layanan…' }), detail.layanan.map(l => h('option', { value: l.kode, text: serviceName(l.nama) })));
        move.addEventListener('change', () => { if (move.value) { const kode = move.value; confirmAction('Pindahkan jenis layanan untuk tiket ini?', () => runAction('pindah', { kode }, key)); move.value = ''; } }); actions.append(move);
      }
    }
    info.replaceChildren(h('button', { class: 'dash-btn dash-detail-close', onClick: () => { root.dataset.info = 'false'; tombolKembali(); } }, '← Kembali ke percakapan'),
      h('section', { class: 'dash-section' }, h('h3', { text: 'Nama Wajib Pajak (Nama Pemohon)' }), h('div', { class: 'dash-person', text: personName(t) }),
        h('p', { class: 'kecil', text: serviceName(t.layanan) + ' · ' + t.id }),
        h('dl', { class: 'dash-info-grid' }, h('dt', { text: 'Pemohon' }), h('dd', { text: t.namaPemohon }), h('dt', { text: 'Selaku' }), h('dd', { text: t.selaku }), h('dt', { text: 'NPWP/NIK' }), h('dd', {}, h('code',{text:t.npwp || '—'})), h('dt', { text: 'Masuk' }), h('dd', { text: t.masuk }))),
      r.diminta ? h('section', { class: 'dash-section' }, h('h3', { text: 'PROGRES BILLING' }),
        h('div', { class: 'dash-billing' }, [[r.diminta, 'Diminta'], [r.terkirim, 'Terkirim'], [r.sisa, 'Tersisa']].map(([n, label]) => h('div', {}, h('strong', { text: n }), h('small', { text: label })))),
        h('div', { class: 'dash-progress', role: 'progressbar', 'aria-label': 'Billing terkirim', 'aria-valuemin': 0, 'aria-valuemax': r.diminta, 'aria-valuenow': Math.min(r.terkirim, r.diminta) }, h('span', { style: 'width:' + Math.min(100, r.terkirim / r.diminta * 100) + '%' })),
        active(t) ? h('button', { class: 'dash-btn', onClick: () => buka('billing', key) }, '＋ Kirim kode billing (ketik kode)') : null,
        active(t) ? h('p', { class: 'kecil', style: 'margin-top:8px', text: 'Untuk PDF billing: lampirkan file di kotak pesan, lalu centang Catat sebagai billing. Isi dokumen dibaca otomatis.' }) : null) : null,
      h('section', { class: 'dash-section' }, h('h3', { text: 'PERMOHONAN' }), h('p', { class: 'dash-summary', text: t.uraian }), h('p', { class: 'kecil', style: 'margin-top:10px', text: 'WP terakhir: ' + r.wp })),
      actions,
      h('section', { class: 'dash-section' }, h('h3', { text: 'JAWABAN CEPAT' }), h('p', { class: 'kecil', text: (detail.template || []).length + ' jawaban tersedia untuk layanan ini.' }),
        h('button', { class: 'dash-btn', onClick: () => openManage() }, 'Kelola jawaban cepat (ubah/hapus)')),
      t.topik ? h('button', { class: 'dash-btn', onClick: () => openTopic() }, 'Buka Telegram ↗') : null);
  }
  function slashToken() {
    if (!selected) return null;
    const m = draft().text.match(/(^|\s)\/([a-z0-9_]*)$/i);
    return m ? { start: m.index + m[1].length, query: m[2].toLowerCase() } : null;
  }
  function closeQuick() { quickOpen = false; slashDismissed = true; drawQuick(); }
  function drawQuick() {
    const available = !!detail && detailKey === selected && active(detail.tiket) && !textarea.disabled;
    quickButton.disabled = !available; quickAdd.disabled = !available; quickManage.disabled = !detail; pickerAdd.disabled = !available; pickerManage.disabled = !detail;
    const templates = available ? detail.template || [] : [], key = selected;
    const state = JSON.stringify([key,available,templates,quickOpen,slashDismissed,slashToken(),quickSearch.value,quickIndex]);
    if (quickSignature === state) return;
    quickSignature = state;
    quickChips.replaceChildren(...templates.slice(0, 3).map(tp => h('button', { class: 'dash-template', type: 'button', title: tp.isi, onClick: () => chooseQuick(tp, key, slashToken()) }, h('span', { text: tp.judul }), tp.perintah ? h('code', { text: '/' + tp.perintah }) : null)));
    if (!templates.length) quickChips.append(h('span', { class: 'dash-quick-none', text: 'Belum ada jawaban cepat' }));
    const token = slashToken();
    quickPicker.hidden = !available || !(quickOpen || token && !slashDismissed);
    quickButton.setAttribute('aria-expanded', String(!quickPicker.hidden));
    textarea.setAttribute('aria-controls', 'dash-quick-results');
    textarea.setAttribute('aria-expanded', String(!quickPicker.hidden));
    if (quickPicker.hidden) { textarea.removeAttribute('aria-activedescendant'); return; }
    quickSearch.hidden = !!token && !quickOpen;
    const q = (quickOpen ? quickSearch.value : token.query).toLowerCase().trim();
    quickOptions = templates.filter(tp => (quickOpen ? [tp.judul, tp.perintah, tp.isi].join(' ').toLowerCase().includes(q) : tp.perintah && tp.perintah.toLowerCase().startsWith(q)));
    quickIndex = Math.min(quickIndex, Math.max(0, quickOptions.length - 1));
    textarea.setAttribute('aria-activedescendant', 'dash-quick-' + quickIndex);
    quickResults.replaceChildren(...quickOptions.map((tp, i) => h('button', { class: 'dash-quick-option', id: 'dash-quick-' + i, type: 'button', role: 'option', 'aria-selected': String(i === quickIndex), onClick: () => chooseQuick(tp, key, token) }, h('b', { text: tp.judul }), h('code', { text: tp.perintah ? '/' + tp.perintah : '' }), h('span', { text: tp.isi }))));
    if (!quickOptions.length) quickResults.append(h('p', { text: 'Jawaban tidak ditemukan.' }));
    const current = quickResults.childNodes[quickIndex];
    if (current && current.scrollIntoView) current.scrollIntoView({ block: 'nearest' });
  }
  function chooseQuick(tp, key, token) {
    if (!validView(key) || !detail || detailKey !== key || !active(detail.tiket) || textarea.disabled) return;
    const d = draft(key), text = token ? d.text.slice(0, token.start) + tp.isi : d.text ? d.text + '\n\n' + tp.isi : tp.isi;
    if (text.length > (d.files.length ? 1024 : 3500)) { d.error = 'Jawaban melebihi batas karakter. Ringkas draf dahulu.'; renderDraft(); return; }
    if (d.revision === null) d.revision = detail.revisi;
    d.text = text; d.error = ''; quickOpen = false; slashDismissed = true; renderDraft(); drawList(); textarea.focus();
  }
  function addQuickReply() { openQuickForm(null); }
  // Form bersama untuk menambah dan mengubah jawaban cepat. Hasil tersimpan di tab Template untuk seluruh petugas.
  function openQuickForm(tp) {
    const edit = !!tp;
    if (!edit && quickAdd.disabled) return;
    if (!detail) return;
    const lama = edit ? editForms[tp.id] : quickForm;
    if (lama && lama.saving) { live.textContent = 'Menyimpan jawaban…'; return; }
    closeQuick();
    const f = lama || (edit
      ? (editForms[tp.id] = { judul: tp.judul, perintah: tp.perintah ? '/' + tp.perintah : '', isi: tp.asli || tp.isi, layanan: tp.lingkup || '', id: tp.id, versi: tp.versi, payload: null, saving: false })
      : (quickForm = { judul: '', perintah: '', isi: '', layanan: detail.tiket.layanan, id: idPermintaan(), payload: null, saving: false }));
    const name = h('input', { id: 'quick-title', value: f.judul, maxlength: '60', required: true, autocomplete: 'off' });
    const command = h('input', { id: 'quick-command', value: f.perintah, placeholder: '/minta_data', maxlength: '33', required: true, autocomplete: 'off', autocapitalize: 'none', spellcheck: false });
    const pilihan = [...new Set(catalog.map(l => l.nama).concat(detail.tiket.layanan))].filter(Boolean);
    const scope = h('select', { id: 'quick-service' }, h('option', { value: '', text: 'Semua Layanan' }), pilihan.map(n => h('option', { value: n, text: serviceName(n) })),
      f.layanan && pilihan.indexOf(f.layanan) < 0 ? h('option', { value: f.layanan, text: f.layanan === '*' ? 'Semua layanan (*)' : 'Tetap: ' + f.layanan }) : null);
    scope.value = f.layanan;
    const body = h('textarea', { id: 'quick-body', rows: '6', maxlength: '3500', required: true, placeholder: 'Tulis jawaban…' }); body.value = f.isi;
    const error = h('p', { class: 'dash-quick-error', role: 'alert', text: f.error || '' });
    const label = () => f.saving ? 'Menyimpan…' : f.payload ? 'Periksa penyimpanan' : edit ? 'Simpan perubahan' : 'Simpan jawaban';
    const save = h('button', { class: 'dash-btn primary', type: 'submit' }, label());
    const fields = [name, command, scope, body];
    function lockForm() { fields.forEach(el => { el.disabled = f.saving || !!f.payload; }); save.disabled = f.saving; buttonFace(save, label(), 'cek', f.saving); }
    fields.forEach(el => el.addEventListener('input', () => { f.judul = name.value; f.perintah = command.value; f.layanan = scope.value; f.isi = body.value; }));
    const form = h('form', {}, h('header', {}, h('h2', { text: edit ? 'Ubah jawaban cepat' : 'Tambah jawaban cepat' }), h('button', { type: 'button', class: 'dash-tool', 'aria-label': 'Tutup form jawaban cepat', onClick: () => quickDialog.close() }, ui ? ui.icon('tutup') : '×')),
      h('label', { for: 'quick-title' }, 'Nama jawaban', name), h('div', { class: 'dash-quick-fields' }, h('label', { for: 'quick-command' }, 'Perintah', command), h('label', { for: 'quick-service' }, 'Layanan', scope)),
      h('label', { for: 'quick-body' }, 'Isi jawaban', body), h('small', { text: 'Variabel: {nama}, {tiket}, {layanan}, {kantor}, {alamat}, {jam}, {formulir}, {syarat}. ' + (edit ? 'Perubahan langsung berlaku untuk seluruh petugas.' : 'Tersedia untuk seluruh petugas.') }), error,
      h('footer', {}, h('button', { class: 'dash-btn', type: 'button', onClick: () => quickDialog.close() }, 'Batal'), save));
    form.addEventListener('submit', async e => {
      e.preventDefault(); if (f.saving) return;
      f.payload = f.payload || (edit
        ? { aksi: 'ubah', id: f.id, versi: f.versi, judul: name.value.trim(), perintah: command.value.trim(), layanan: scope.value, isi: body.value.trim() }
        : { judul: name.value.trim(), perintah: command.value.trim(), layanan: scope.value, isi: body.value.trim(), permintaan: f.id });
      f.saving = true; f.error = ''; error.textContent = ''; lockForm();
      try {
        const r = await api(edit ? 'konsolKelolaTemplate' : 'konsolSimpanTemplate', f.payload);
        if (!r.ok) { f.payload = null; throw Object.assign(new Error(r.pesan || 'Jawaban belum tersimpan.'), { ditolak: true }); }
        if (edit) delete editForms[tp.id]; else quickForm = null;
        if (disposed) return;
        quickDialog.close(); live.textContent = 'Jawaban /' + r.perintah + (edit ? ' diperbarui.' : ' tersimpan.');
        cached.clear(); dataEpoch++; ++detailSeq; await sync(true);
        if (manageDialog.open) await loadManage();
      } catch (err) { f.error = err.ditolak ? err.message : 'Koneksi terputus. Periksa penyimpanan untuk mencoba dengan ID yang sama.'; error.textContent = f.error; }
      finally { f.saving = false; lockForm(); }
    });
    quickDialog.replaceChildren(form); lockForm(); quickDialog.showModal(); if (!f.payload) name.focus();
  }

  // Kelola: daftar semua jawaban cepat dengan tombol Ubah dan Hapus.
  let manageItems = null, manageError = '', manageBusy = '';
  const manageSearch = h('input', { type: 'search', class: 'dash-manage-search', placeholder: 'Cari nama, /perintah, atau isi jawaban', 'aria-label': 'Cari jawaban cepat yang dikelola' });
  const manageList = h('div', { class: 'dash-manage-list', role: 'list' });
  const manageNote = h('p', { class: 'dash-quick-error', role: 'alert' });
  manageSearch.addEventListener('input', () => drawManage());
  manageDialog.append(h('div', { class: 'dash-manage-body' },
    h('header', {}, h('h2', { text: 'Kelola jawaban cepat' }), h('button', { type: 'button', class: 'dash-tool', 'aria-label': 'Tutup kelola jawaban', onClick: () => manageDialog.close() }, ui ? ui.icon('tutup') : '×')),
    h('p', { class: 'dash-manage-hint', text: 'Perubahan berlaku untuk seluruh petugas. Jawaban yang dihapus disimpan sebagai nonaktif di tab Template dan dapat dipulihkan dari Sheet.' }),
    manageSearch, manageNote, manageList,
    h('footer', {}, h('button', { class: 'dash-btn', type: 'button', onClick: () => { manageDialog.close(); addQuickReply(); } }, '+ Tambah jawaban'), h('button', { class: 'dash-btn primary', type: 'button', onClick: () => manageDialog.close() }, 'Selesai'))));
  async function openManage() {
    if (!detail || disposed) return;
    closeQuick(); manageSearch.value = ''; manageError = '';
    if (!manageDialog.open) manageDialog.showModal();
    await loadManage();
  }
  async function loadManage() {
    manageItems = null; drawManage();
    try {
      const r = await api('konsolDaftarTemplate', {});
      if (!r.ok) throw new Error(r.pesan || 'Daftar jawaban belum dapat dimuat.');
      manageItems = r.template || []; manageError = '';
    } catch (e) { manageItems = manageItems || []; manageError = e.message || 'Daftar jawaban belum dapat dimuat.'; }
    if (!disposed) drawManage();
  }
  function lingkupTeks(x) { return !x || x === '*' ? 'Semua layanan' : x.split(/[;,]/).map(v => serviceName(v.trim())).filter(Boolean).join(', '); }
  function drawManage() {
    manageNote.textContent = manageError;
    if (manageItems === null) { manageList.replaceChildren(ui ? ui.skeleton('list') : h('p', { text: 'Memuat jawaban…' })); return; }
    const q = manageSearch.value.toLocaleLowerCase('id').trim();
    const tampil = manageItems.filter(tp => !q || [tp.judul, tp.perintah, tp.asli, tp.lingkup].join(' ').toLocaleLowerCase('id').includes(q));
    if (!tampil.length) { manageList.replaceChildren(empty(q ? 'Jawaban tidak ditemukan' : 'Belum ada jawaban cepat', q ? 'Coba kata lain.' : 'Tambahkan jawaban pertama.')); return; }
    manageList.replaceChildren(...tampil.map(tp => h('article', { class: 'dash-manage-item', role: 'listitem', 'data-template': tp.id },
      h('div', { class: 'dash-manage-main' }, h('b', { text: tp.judul }), h('span', { class: 'dash-manage-meta' }, tp.perintah ? h('code', { text: '/' + tp.perintah }) : null, h('span', { text: lingkupTeks(tp.lingkup) })),
        h('p', { text: String(tp.asli || '').slice(0, 180) + (String(tp.asli || '').length > 180 ? '…' : '') })),
      h('div', { class: 'dash-manage-actions' },
        h('button', { type: 'button', class: 'dash-btn', disabled: !!manageBusy, 'aria-label': 'Ubah ' + tp.judul, onClick: () => { manageDialog.close(); openQuickForm(tp); } }, ui ? ui.icon('ubah') : null, 'Ubah'),
        h('button', { type: 'button', class: 'dash-btn dash-danger', disabled: !!manageBusy, 'aria-label': 'Hapus ' + tp.judul, onClick: () => deleteQuick(tp) }, ui ? ui.icon(manageBusy === tp.id ? 'spinner' : 'hapus') : null, manageBusy === tp.id ? 'Menghapus…' : 'Hapus')))));
  }
  function deleteQuick(tp) {
    if (manageBusy) return;
    confirmAction('Hapus jawaban cepat "' + tp.judul + '"' + (tp.perintah ? ' (/' + tp.perintah + ')' : '') + '? Jawaban tidak lagi muncul untuk seluruh petugas.', async () => {
      manageBusy = tp.id; manageError = ''; drawManage();
      try {
        const r = await api('konsolKelolaTemplate', { aksi: 'hapus', id: tp.id, versi: tp.versi });
        if (!r.ok) throw new Error(r.pesan || 'Jawaban belum terhapus.');
        live.textContent = 'Jawaban "' + tp.judul + '" dihapus.';
        cached.clear(); dataEpoch++; ++detailSeq; manageBusy = ''; await sync(true); await loadManage();
      } catch (e) { manageError = e.message || 'Koneksi terputus. Muat ulang lalu periksa daftar jawaban.'; }
      finally { manageBusy = ''; if (!disposed) drawManage(); }
    });
  }
  function confirmAction(text, work) { if (tg && tg.showConfirm) tg.showConfirm(text, ok => { if (ok && !disposed) work(); }); else if (confirm(text)) work(); }
  function openTopic() {
    if (!detail || !detail.tiket.topik) return;
    const url = detail.tiket.topik;
    if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else bukaTautan(url);
  }
  function formatSize(bytes) { return bytes < 1024 * 1024 ? Math.ceil(bytes / 1024) + ' KB' : (bytes / 1024 / 1024).toFixed(1) + ' MB'; }
  function addFiles(input) {
    if (!selected || !detail || detailKey !== selected || !active(detail.tiket)) { live.textContent = 'Pilih tiket aktif sebelum menambahkan file.'; return; }
    const d = draft();
    if (d.internal || d.sending || d.request) { d.error = d.internal ? 'Matikan Catatan internal untuk mengirim lampiran ke WP.' : 'Tunggu atau periksa kiriman sebelumnya.'; renderDraft(); return; }
    const rejected = [];
    for (const file of Array.from(input || [])) {
      if (!file.size || file.size > 5 * 1024 * 1024) { rejected.push(file.name + ': maksimal 5 MB'); continue; }
      if (d.files.length >= 6 || d.files.reduce((n,x) => n+x.size,0) + file.size > 15 * 1024 * 1024) { rejected.push(file.name + ': maksimal 6 file / total 15 MB'); continue; }
      if (d.files.some(f => f.name === file.name && f.size === file.size && f.file.lastModified === file.lastModified)) continue;
      const photo = ['image/jpeg','image/png'].includes(file.type);
      const preview = photo && typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : '';
      d.files.push({ id: idPermintaan(), file, name: file.name, size: file.size, mime: file.type || 'application/octet-stream', kind: photo ? 'foto' : 'dokumen', preview, billing: false, phase: 'Siap dikirim' });
    }
    if (d.revision === null) d.revision = detail.revisi;
    d.error = rejected.join('\n'); root.dataset.view = 'chat'; root.dataset.info = 'false'; renderDraft(); drawList();
  }
  function removeFile(d, file) { if (file.preview && typeof URL !== 'undefined') URL.revokeObjectURL(file.preview); d.files = d.files.filter(f => f !== file); }
  function isPdf(f) { return f.mime === 'application/pdf' || /\.pdf$/i.test(f.name || ''); }
  const pembaca = () => typeof KPPBilling !== 'undefined' ? KPPBilling : null;
  function billingLewat(f) { const B = pembaca(); return !!(B && f.billing && f.pakaiRincian !== false && f.rincian && B.sudahLewat(f.rincian)); }
  function kodeDariTeks(teks) { const out = [], re = /(?:^|\D)(\d{15})(?!\d)/g; let m; while ((m = re.exec(String(teks || '')))) if (out.indexOf(m[1]) < 0) out.push(m[1]); return out; }
  function npwpSama(a, b) { a = String(a || '').replace(/\D/g, ''); b = String(b || '').replace(/\D/g, ''); return !a || !b || a === b || '0' + a === b || a === '0' + b; }
  // Membaca isi PDF saat Catat sebagai billing dicentang. Hasil disimpan pada file itu sendiri, jadi aman saat berpindah tiket.
  function mulaiBaca(d, f) {
    const B = pembaca();
    if ((f.baca && f.baca !== 'gagal') || !B || !B.bacaFile || !isPdf(f) || !f.file) return; // gagal: centang ulang mencoba lagi
    f.baca = 'membaca';
    const key = selected;
    Promise.resolve().then(() => B.bacaFile(f.file)).then(r => { f.rincian = B.rapikan(r); f.baca = 'selesai'; }, () => { f.baca = 'gagal'; })
      .then(() => { if (!disposed && d.files.indexOf(f) >= 0 && validView(key)) { fileSignature = ''; renderDraft(); } });
  }
  function pratinjauBilling(d, f) {
    const B = pembaca(), t = detail.tiket, r = detail.ringkasan || {};
    const urutan = Number(r.terkirim || t.terkirim || 0) + Math.max(0, d.files.filter(x => x.billing).indexOf(f)) + 1;
    const pertama = d.files[0] === f;
    return B.teksPolos(B.pesan({ pemohon: t.namaPemohon, tiket: t.id, urutan, total: Number(t.permintaan || r.diminta || 0),
      rincian: f.pakaiRincian !== false ? f.rincian : null, kode: pertama ? kodeDariTeks(d.text) : [], catatan: pertama ? d.text.trim() : '' }));
  }
  function bacaanBilling(d, f, locked) {
    const B = pembaca(), efek = h('small', { class: 'dash-billing-effect', text: 'Progres billing bertambah setelah berhasil dikirim.' });
    if (!B) return [efek];
    if (!isPdf(f)) return [efek, h('p', { class: 'dash-read is-note' }, ui ? ui.icon('pindai') : null, h('span', { text: 'Foto billing: rincian dibaca server saat dikirim bila pembaca dokumen aktif. Bila tidak terbaca, WP menerima file dengan penjelasan umum.' }))];
    if (f.baca === 'membaca') return [efek, h('p', { class: 'dash-read is-loading', role: 'status' }, ui ? ui.icon('spinner') : null, h('span', { text: 'Membaca isi dokumen…' }))];
    if (f.baca === 'gagal') return [efek, h('p', { class: 'dash-read is-note' }, ui ? ui.icon('peringatan') : null, h('span', { text: 'Pembaca PDF belum dapat dimuat di perangkat ini. Server akan mencoba membaca dokumen saat dikirim; bila tidak terbaca, WP menerima penjelasan umum.' }))];
    if (f.baca !== 'selesai') return [efek];
    if (!f.rincian) return [efek, h('p', { class: 'dash-read is-note' }, ui ? ui.icon('peringatan') : null, h('span', { text: 'Isi dokumen tidak terbaca otomatis (misalnya hasil pindai). WP tetap menerima file dengan penjelasan umum.' }))];
    const r = f.rincian, t = detail.tiket, peringatan = [];
    if (B.sudahLewat(r) && f.pakaiRincian !== false) peringatan.push(['is-error', 'Masa aktif pada dokumen sudah berakhir. Buat kode billing baru, atau matikan "Sertakan rincian" bila tanggal tersebut keliru terbaca.']);
    if ((r.kode || []).some(k => (t.kodeTerkirim || []).indexOf(k) >= 0)) peringatan.push(['is-error', 'Kode billing ini sudah tercatat terkirim pada tiket ini.']);
    if (r.npwp && !npwpSama(r.npwp, t.npwp)) peringatan.push(['is-warn', 'NPWP pada dokumen (' + r.npwp + ') berbeda dengan NPWP/NIK pemohon (' + (t.npwp || '-') + '). Periksa kembali sebelum mengirim.']);
    if ((r.kode || []).length > 1) peringatan.push(['is-warn', 'Dokumen memuat ' + r.kode.length + ' kode billing; seluruhnya dicatat terkirim.']);
    const baris = [['Kode billing', (r.kode || []).map(B.kodeTampil).join(', ') || 'Tidak terbaca'], ['Jenis pajak', [r.kap ? r.kap + (r.kjs ? '-' + r.kjs : '') : '', r.jenis].filter(Boolean).join(' · ')],
      ['Masa pajak', r.masa || r.tahun], ['Jumlah setor', r.jumlah ? B.rupiah(r.jumlah) : ''], ['Berlaku s.d.', r.berlaku ? B.tanggalWIB(r.berlaku, r.berlakuJam !== false) : ''], ['Atas nama', r.nama]].filter(x => x[1]);
    const pakai = h('input', { type: 'checkbox', checked: f.pakaiRincian !== false, disabled: locked, 'aria-label': 'Sertakan rincian ' + f.name + ' di pesan WP' });
    pakai.addEventListener('change', () => { f.pakaiRincian = pakai.checked; fileSignature = ''; renderDraft(); });
    const lihat = h('button', { type: 'button', class: 'dash-read-toggle', 'aria-expanded': String(!!f.lihat), onClick: () => { f.lihat = !f.lihat; fileSignature = ''; renderDraft(); } }, f.lihat ? 'Sembunyikan pesan untuk WP' : 'Lihat pesan untuk WP');
    return [efek, h('div', { class: 'dash-read' + (peringatan.some(x => x[0] === 'is-error') ? ' has-error' : '') },
      h('div', { class: 'dash-read-head' }, ui ? ui.icon('cek') : null, h('b', { text: 'Isi dokumen terbaca' }), h('label', { class: 'dash-read-use' }, pakai, 'Sertakan rincian')),
      h('dl', { class: 'dash-read-grid' }, baris.map(x => [h('dt', { text: x[0] }), h('dd', { text: x[1] })])),
      peringatan.map(x => h('p', { class: 'dash-read-alert ' + x[0] }, ui ? ui.icon('peringatan') : null, h('span', { text: x[1] }))),
      lihat, f.lihat ? h('pre', { class: 'dash-read-preview', text: pratinjauBilling(d, f) }) : null)];
  }
  function drawFiles(d) {
    const state = JSON.stringify([selected,d.sending,!!d.request,d.uploadBlocked,detail && detail.tiket.billing,detail && detail.ringkasan && detail.ringkasan.terkirim,d.files.some(f=>f.lihat) ? d.text : '',d.files.map(f=>[f.id,f.kind,f.billing,f.phase,!!f.uploaded,f.baca||'',f.pakaiRincian!==false,!!f.lihat,!!f.rincian])]);
    if (state === fileSignature) return; fileSignature = state;
    filesBar.hidden = !d.files.length;
    filesBar.replaceChildren(...d.files.map(f => {
      const locked = d.sending || !!d.request || !!f.uploaded;
      const kind = h('select', { class: 'dash-file-kind', 'aria-label': 'Kirim ' + f.name + ' sebagai', value: f.kind, disabled: locked },
        ['image/jpeg','image/png'].includes(f.mime) ? h('option', { value: 'foto', text: 'Foto' }) : null,
        h('option', { value: 'dokumen', text: 'File asli' }));
      kind.addEventListener('change', () => { f.kind = kind.value; });
      const billing = h('input', { type: 'checkbox', checked: f.billing, disabled: d.sending || !!d.request, 'aria-label': 'Hitung ' + f.name + ' sebagai billing' });
      billing.addEventListener('change', () => { f.billing = billing.checked; if (f.billing) mulaiBaca(d, f); renderDraft(); });
      return h('div', { class: 'dash-file-card' + (f.billing ? ' is-billing' : ''), 'data-file': f.id },
        h('div', { class: 'dash-file-row' },
          f.preview ? h('img', { src: f.preview, alt: f.name, class: 'dash-file-thumb' }) : h('span', { class: 'dash-file-icon', text: f.name.split('.').pop().slice(0,4).toUpperCase() || 'FILE' }),
          h('div', { class: 'dash-file-meta' }, h('b', { text: f.name }), h('small', { text: formatSize(f.size) + ' · ' + f.phase }),
            h('div', { class: 'dash-file-options' }, kind, detail && detail.tiket.billing && (f.mime === 'application/pdf' || /^image\//.test(f.mime)) ? h('label', {}, billing, 'Catat sebagai billing') : null)),
          h('button', { type: 'button', class: 'dash-tool', 'aria-label': 'Hapus lampiran ' + f.name, disabled: d.sending || !!d.request, onClick: () => { removeFile(d,f); renderDraft(); drawList(); } }, ui ? ui.icon('tutup') : '×')),
        f.billing ? bacaanBilling(d, f, locked) : null);
    }));
    if (d.files.length) filesBar.append(h('p', { class: 'dash-upload-hint', text: '5 MB/file · 6 file · keterangan pada file pertama' }));
    if (d.uploadBlocked && !d.sending) filesBar.append(h('button', { class: 'dash-btn', onClick: () => confirmAction('Batalkan sisa unggahan di dashboard? Salinan yang sudah masuk topik internal tetap ada; unggahan ini belum diteruskan ke WP.', () => {
      d.files.slice().forEach(f => removeFile(d,f)); d.request = null; d.uploadBlocked = false; d.error = 'Sisa unggahan dibatalkan. Periksa topik Telegram sebelum memilih ulang.'; renderDraft(); drawList();
    }) }, 'Batalkan sisa unggahan'));
  }
  function renderMessage(m, ticket, key) {
    const by = m.dari === 'wp' ? ticket.namaPemohon : m.nama || 'Petugas';
    const role = m.dari === 'wp' ? 'Wajib Pajak' : m.dari === 'internal' ? 'Catatan Internal' : 'Petugas';
    const tools = h('div', { class: 'dash-message-tools' });
    const reply = () => {
      if (!validView(key) || !detail || !active(detail.tiket) || !m.bisaBalas || !m.ref) return;
      const d = draft(key); if (d.sending || d.request) return;
      d.reply = {ref:m.ref,nama:by,isi:String(m.isi || m.namaFile || 'Foto').slice(0,240)}; d.internal=false;
      if(d.revision===null)d.revision=detail.revisi;
      renderDraft();textarea.focus();
    };
    if (m.dari !== 'sistem') {
      if (m.bisaBalas && m.ref) tools.append(h('button', {title:'Balas pesan ini','aria-label':'Balas pesan '+by,onClick:reply}, ui ? ui.icon('balas') : null, 'Balas'));
      tools.append(h('button', {title:'Salin teks',onClick:async()=>{
        try {await navigator.clipboard.writeText(m.isi);live.textContent='Teks disalin.';}
        catch(e){live.textContent='Pilih teks pesan lalu gunakan Salin pada perangkat.';}
      }},ui ? ui.icon('salin') : null,'Salin'));
    }
    const photo = m.file && m.ref && /^image\/(jpeg|png|webp|gif)$/.test(m.mime || '');
    const node = h('article', {class:'dash-message '+m.dari,'data-message-ref':m.ref || ''},
      m.dari==='sistem' ? null : h('b',{},h('span',{class:'dash-message-role',text:role}),by),
      m.kutipan ? h('blockquote',{class:'dash-message-quote',text:m.kutipan}) : null,
      photo ? media.image(m,key,loadAttachment) : null,
      h('span',{class:'dash-message-text',text:m.isi}),
      m.file && !photo ? h('button',{class:'dash-message-file',onClick:()=>m.ref ? loadAttachment(m,key) : openTopic()},ui ? ui.icon('dokumen') : null,h('span',{text:m.namaFile || 'Lampiran'}),h('small',{text:'Buka file'})) : null,
      h('footer',{class:'dash-message-footer'},tools,h('small',{text:m.jam+(m.dari==='petugas'?' · terkirim':'')})));
    if(m.bisaBalas && m.ref && active(ticket))KPPChat.swipeReply(node,reply);
    return node;
  }
  async function loadAttachment(m,key) {
    if(!validView(key))return;
    const generation = media.generation;
    live.textContent='Memuat lampiran…';
    try {
      const r=await media.get(key,m);
      if(!validView(key) || generation!==media.generation)return;
      if(previewURL)URL.revokeObjectURL(previewURL);
      previewURL=URL.createObjectURL(r.blob);
      const close=h('button',{class:'dash-btn',onClick:()=>previewDialog.close()},'Tutup');
      const download=h('a',{class:'dash-btn primary',href:previewURL,download:r.nama,text:'Unduh file'});
      previewDialog.replaceChildren(h('header',{},h('h2',{text:r.nama}),close),
        /^image\//.test(r.mime) ? h('img',{src:previewURL,alt:r.nama}) : h('p',{text:'Dokumen siap diunduh. Buka dengan aplikasi pada perangkat.'}),
        h('footer',{},download,h('button',{class:'dash-btn',onClick:()=>openTopic()},'Buka Telegram')));
      previewDialog.showModal();live.textContent='Lampiran siap.';
    }catch(e){if(validView(key) && generation===media.generation){draft(key).error=e.message;renderDraft();live.textContent='Lampiran belum dapat dibuka.';}}
  }
  function fileBase64(file) {
    return new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('File tidak dapat dibaca. Pilih ulang file.')); reader.readAsDataURL(file); });
  }
  async function sendAttachments(key,d) {
    if (d.sending || d.internal || d.text.length > 1024) return;
    if (d.result && ['Tertahan','Mengirim','Belum pasti'].includes(d.result.status)) { d.error = 'Periksa kiriman sebelumnya sebelum melanjutkan lampiran.'; renderDraft(); return; }
    // A frozen bundle keeps the recipient, caption, reply and revision fixed across retries.
    d.request = d.request || { bundle:true, kunci:key, teks:d.text.trim(), balas:d.reply && d.reply.ref || '', revisi:d.revision === null ? detail.revisi : d.revision };
    const bundle = d.request;
    d.sending = true; d.uploadBlocked = false; d.error = ''; d.receipt = '';  ++detailSeq; renderDraft(); drawList();
    let current, completed = true;
    try {
      while(d.files.length) {
        current = d.files[0];
        if (!current.uploaded) {
          current.phase = 'Menyiapkan unggahan…'; if(validView(key))renderDraft();
          const body = { kunci:key, permintaan:current.id, revisi:bundle.revisi, nama:current.name, mime:current.mime, jenis:current.kind, base64:await fileBase64(current.file) };
          const upload = await api('konsolUnggah', body);
          if (!upload.ok) { current.phase = upload.status || 'Unggahan ditolak'; d.uploadBlocked = true; throw new Error(upload.pesan || 'Periksa unggahan pada topik Telegram.'); }
          current.uploaded = upload.unggahan;
        }
        current.phase = 'Mengirim ke WP…'; if(validView(key))renderDraft();
        current.sendRequest = current.sendRequest || { kunci:key, unggahan:current.uploaded, teks:bundle.teks, balas:bundle.balas, revisi:bundle.revisi, permintaan:idPermintaan(), billing:!!current.billing,
          rincian: current.billing && current.pakaiRincian !== false && current.rincian ? current.rincian : undefined,
          pakaiRincian: current.billing ? current.pakaiRincian !== false : undefined };
        const r = await api('konsolKirimLampiran',current.sendRequest);
        if (!r.ok) {
          completed = false;
          if (r.operasi && ['Tertahan','Mengirim','Belum pasti'].includes(r.status)) {
            d.result = r; removeFile(d,current); d.text = ''; d.reply = null; d.error = 'Lampiran ini disimpan untuk diperiksa. Sisa file belum dikirim.';
          } else { current.phase = 'Belum terkirim'; current.sendRequest = null; d.error = r.pesan || 'Lampiran belum terkirim.'; }
          d.request = null; break;
        }
        d.receipt = current.billing ? (r.billing ? 'Billing terkirim · ' + r.billing.terkirim + (r.billing.diminta ? ' dari ' + r.billing.diminta : '') + ' dilayani' + (r.billing.rincian ? ' · ' + r.billing.rincian : '') : 'File billing terkirim. Progres diperbarui.') : 'Lampiran terkirim.';
        const parts=String(bundle.revisi).split(':');
        bundle.revisi = r.revisiLanjutan || parts[0]+':'+(Number(parts[1])+1);
        bundle.teks = ''; d.text = ''; d.revision = bundle.revisi;
        removeFile(d,current); drawList();
      }
      if (!d.files.length) { d.request = null; d.reply = null; d.revision = null; if (completed) getar('success'); }
    } catch(e) {
      if (current && !current.sendRequest) d.uploadBlocked = true;
      d.error = (e.message || 'Koneksi terputus.') + ' Tombol Periksa kiriman melanjutkan dengan ID yang sama.';
    } finally {
      d.sending = false;
      if (!disposed) { markChanged(key); ++detailSeq; drawList(); renderDraft(); await sync(true); }
    }
  }

  async function loadDetail(key) {
    const seq = ++detailSeq, epoch = dataEpoch;
    let flight = detailFlights.get(key);
    if (!flight || flight.epoch !== epoch) {
      flight = { epoch, promise: api('konsolBuka', { kunci: key }) };
      detailFlights.set(key, flight);
    }
    try {
      const r = await flight.promise;
      if (epoch !== dataEpoch || disposed) return;
      showDetail(r, key, seq);
    } catch (e) {
      if (validView(key, seq) && epoch === dataEpoch) {
        detailFresh = false;
        if (!detail) { detailKey = ''; messages.replaceChildren(empty('Koneksi terputus', 'Gunakan Muat ulang untuk mencoba lagi.')); }
        live.textContent = 'Pembaruan tertunda · periksa koneksi'; root.dataset.connection = 'error'; renderDraft();
      }
    } finally { if (detailFlights.get(key) === flight) detailFlights.delete(key); }
  }
  async function select(key) {
    if (disposed) return;
    if (selected === key && detailKey === key && detailFresh) { root.dataset.view = 'chat'; tombolKembali(); return; }
    media.reset(); if (previewDialog.open) previewDialog.close();
    selected = key; simpan.selected = key; quickOpen = false; slashDismissed = false; quickIndex = 0;
    const route = S.riwayat && S.riwayat[S.riwayat.length - 1];
    if (route && route.layar === 'dashboard') route.arg = key;
    root.dataset.view = 'chat'; root.dataset.info = 'false'; tombolKembali();
    detail = null; detailKey = ''; detailFresh = false; signature = ''; newMessage.hidden = true; chatSearch.value = ''; chatSearch.hidden = true;
    identity.textContent = ''; billingProgress.hidden = true;
    title.textContent = 'Memuat percakapan…'; subtitle.textContent = 'Tiket ' + key; badge.textContent = '';
    messages.replaceChildren(ui ? ui.skeleton('chat') : empty('Memuat percakapan…', '')); pending.replaceChildren(); sendingPreview.replaceChildren();
    const recent = cached.get(key);
    if (recent) { showDetail(recent, key, undefined, true); live.textContent = 'Memperbarui percakapan…'; }
    drawList(); drawInfo(); renderDraft(); await loadDetail(key);
  }
  function nextTicket() {
    const nextOne = list.filter(t => t.kunci !== selected && t.alur === 'Perlu dibalas' && inFocus(t)).sort(waitingOrder)[0];
    if (nextOne) select(nextOne.kunci);
    else { live.textContent = 'Tidak ada tiket lain yang perlu dibalas.'; }
  }
  async function sendMessage() {
    const key = selected, d = draft(key);
    if (!key || d.sending || !detail || !detailFresh || detailKey !== key || !active(detail.tiket)) return;
    if (!d.request && slashToken()) {
      const token = slashToken(), tp = (detail.template || []).find(t => t.perintah && t.perintah.toLowerCase() === token.query);
      if (tp) chooseQuick(tp, key, token);
      else { d.error = 'Pilih jawaban cepat atau hapus perintah yang belum terdaftar.'; slashDismissed = false; renderDraft(); }
      return;
    }
    if (d.files.length) {
      if (!d.request && d.files.some(f => f.billing && f.baca === 'membaca')) { d.error = 'Tunggu sebentar, isi dokumen billing sedang dibaca.'; renderDraft(); return; }
      return sendAttachments(key, d);
    }
    if (!d.request && (!d.text.trim() || d.text.length > 3500)) return;
    d.request = d.request || { kunci: key, teks: d.text.trim(), internal: d.internal, balas: d.internal ? '' : d.reply && d.reply.ref || '', permintaan: idPermintaan(), revisi: d.revision === null ? detail.revisi : d.revision };
    const request = d.request; d.sending = true; d.error = ''; d.receipt = '';
    d.echo = { text: request.teks, internal: request.internal, phase: 'Mengirim…', acknowledged: false };
    ++detailSeq; renderDraft(); drawList(); scrollBottom();
    try {
      const r = await api('konsolKirim', request);
      if (r.ok) { d.echo = { text: request.teks, internal: request.internal, phase: request.internal ? 'Catatan tersimpan' : 'Terkirim', acknowledged: true }; d.text = ''; d.reply = null; d.revision = null; d.request = null; d.result = null; d.error = ''; getar('success'); }
      else if (r.operasi) { d.echo = null; d.text = ''; d.reply = null; d.revision = null; d.request = null; d.result = r; }
      else { d.echo = null; d.request = null; d.error = r.pesan || 'Pesan belum dikirim.'; }
    } catch (e) { if (d.echo) d.echo.phase = 'Hasil belum pasti'; d.error = (e.message || 'Koneksi terputus.') + ' Periksa hasil dengan ID pengiriman yang sama melalui tombol di bawah.'; }
    finally {
      d.sending = false;
      if (!disposed) { markChanged(key); ++detailSeq; drawList(); renderDraft(); await sync(true); }
    }
  }
  async function runAction(action, extra = {}, key = selected) {
    if (disposed || actionBusy || !validView(key) || !detail || !detailFresh) return;
    const revision = detail.revisi;
    actionBusy = true; ++detailSeq; renderDraft();
    try {
      const r = await api('konsolAksi', Object.assign({ kunci: key, aksi: action, revisi: revision, permintaan: idPermintaan() }, extra));
      if (r.perluKonfirmasiSisa) { actionBusy = false; confirmAction(r.pesan, () => runAction('selesai', { tutupSisa: true, revisi: r.revisi }, key)); return; }
      if (!r.ok) { if (validView(key)) { draft(key).error = r.pesan || 'Aksi belum berhasil.'; renderDraft(); } }
      else { draft(key).error = ''; markChanged(key); ++detailSeq; await sync(true); }
    } catch (e) { if (validView(key)) { draft(key).error = e.message || 'Aksi belum berhasil. Muat ulang status.'; renderDraft(); } }
    finally { actionBusy = false; if (!disposed) renderDraft(); }
  }
  async function sync(force = false) {
    if (disposed || document.hidden) return;
    if (syncing) { if (force) syncQueued = true; return; }
    syncing = true;
    const key = selected, seq = detailSeq, epoch = dataEpoch;
    const full = force || !versi || Date.now() - lastFull > 60000;
    if (force) buttonFace(refresh, 'Memuat…', 'muat', true);
    try {
      const r = await api('konsolSinkron', { versi, kunci: key, paksa: full });
      if (disposed) return;
      if (epoch !== dataEpoch) { syncQueued = true; return; }
      if (!r.ok) throw Object.assign(new Error(r.pesan || 'Tidak dapat memperbarui dashboard.'), { rejected: true });
      if (!r.sama) {
        versi = r.versi; lastFull = Date.now();
        list = r.daftar && r.daftar.tiket || []; catalog = r.daftar && r.daftar.layanan || catalog; drawList();
        if (key && validView(key, seq)) showDetail(r.detail, key, seq);
      }
      root.dataset.connection = 'ok'; root.dataset.loading = 'false'; root.setAttribute('aria-busy', 'false');
      live.textContent = 'Diperbarui ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      if (!disposed) {
        live.textContent = 'Pembaruan tertunda · ' + (e.message || 'periksa koneksi'); root.dataset.connection = 'error';
        if (e.rejected) {
          dataEpoch++; ++detailSeq; detailFlights.clear(); media.reset(); if(previewDialog.open)previewDialog.close(); identity.textContent='';billingProgress.hidden=true;
          cached.clear(); list = []; detail = null; detailKey = ''; detailFresh = false; simpan.drafts = {};
          title.textContent = 'Akses belum tersedia'; subtitle.textContent = ''; badge.textContent = '';
          chatSearch.value = ''; root.dataset.info = 'false'; count.textContent = '—'; listSignature = '';
          messages.replaceChildren(empty('Akses belum tersedia', e.message)); pending.replaceChildren(); sendingPreview.replaceChildren(); drawInfo(); renderDraft();
        }
        if (!list.length) items.replaceChildren(empty('Antrean belum dimuat', 'Tekan Muat ulang.'));
      }
    } finally {
      syncing = false;
      if (!disposed) { buttonFace(refresh, 'Muat ulang', 'muat'); root.dataset.loading = 'false'; root.setAttribute('aria-busy', 'false'); }
      if (syncQueued && !disposed) { syncQueued = false; await sync(true); }
    }
  }
  textarea.addEventListener('input', () => {
    if (!selected || textarea.disabled) return;
    const d = draft();
    if (d.revision === null && detail) d.revision = detail.revisi;
    d.text = textarea.value; d.error = ''; slashDismissed = false; quickIndex = 0; tinggiOtomatis(); renderDraft(); drawList();
  });
  internal.addEventListener('change', () => { if (!selected || internal.disabled) return; draft().internal = internal.checked; renderDraft(); });
  textarea.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (!quickPicker.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeQuick(); return; }
      if (quickOptions.length && ['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); quickIndex = (quickIndex + (e.key === 'ArrowDown' ? 1 : -1) + quickOptions.length) % quickOptions.length; drawQuick(); return; }
      if (quickOptions.length && (e.key === 'Enter' && !e.shiftKey || e.key === 'Tab')) { e.preventDefault(); chooseQuick(quickOptions[quickIndex], selected, slashToken()); return; }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || enterSend.checked && !e.shiftKey && window.matchMedia && window.matchMedia('(pointer:fine)').matches)) { e.preventDefault(); sendMessage(); }
  });
  quickSearch.addEventListener('input', () => { quickIndex = 0; drawQuick(); });
  quickSearch.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closeQuick(); textarea.focus(); }
    if (e.key === 'Enter' && quickOptions.length) { e.preventDefault(); chooseQuick(quickOptions[quickIndex], selected, slashToken()); }
    if (quickOptions.length && ['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); quickIndex = (quickIndex + (e.key === 'ArrowDown' ? 1 : -1) + quickOptions.length) % quickOptions.length; drawQuick(); }
  });
  chatSearch.addEventListener('input', () => { signature = ''; if (detail) showDetail(detail, selected, detailSeq, !detailFresh); });
  search.addEventListener('input', () => { simpan.query = search.value; drawList(); });
  services.addEventListener('change', () => setFocus(services.value));
  enterSend.addEventListener('change', () => preference('kpp615-enter', enterSend.checked ? '1' : '0'));
  fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
  textarea.addEventListener('paste', e => { const fs = e.clipboardData && e.clipboardData.files; if (fs && fs.length) { e.preventDefault(); addFiles(fs); } });
  root.addEventListener('dragenter', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); dragDepth++; dropArea.hidden = false; } });
  root.addEventListener('dragover', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  root.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; dropArea.hidden = true; } });
  root.addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; dropArea.hidden = true; if (e.dataTransfer) addFiles(e.dataTransfer.files); });
  const emojiGroups = [
    ['Sering Dipakai',['🙏','👍','😊','✅','📎','📄','🧾','⏳','👋','👌','🤝','🙂']],
    ['Pelayanan',['📌','📋','📝','🔍','📁','📂','📥','📤','📩','✉️','📞','☎️','💬','🗂️','🖨️','🏢']],
    ['Status & Waktu',['☑️','✔️','❌','⚠️','ℹ️','🔔','⏰','🕒','📅','🗓️','🔄','💡','➡️','⬇️','🔗','🔒']],
    ['Pembayaran',['💳','🏦','💰','💵','🧮','📊','📈','🔢','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟']]
  ];
  emojiPanel.append(h('header',{},h('b',{text:'Emoji'}),h('button',{type:'button','aria-label':'Tutup emoji',onClick:()=>{emojiPanel.hidden=true;emoji.setAttribute('aria-expanded','false');}},ui ? ui.icon('tutup') : '×')));
  emojiGroups.forEach(([label,symbols])=>emojiPanel.append(h('section',{},h('h3',{text:label}),h('div',{class:'dash-emoji-grid'},symbols.map(symbol=>h('button',{type:'button','aria-label':symbol,onPointerdown:e=>e.preventDefault(),onClick:()=>{
    if(!selected || textarea.disabled)return;
    const d=draft();if(d.revision===null)d.revision=detail.revisi;
    const pos=textarea.selectionStart===undefined?d.text.length:textarea.selectionStart;
    d.text=d.text.slice(0,pos)+symbol+d.text.slice(textarea.selectionEnd===undefined?pos:textarea.selectionEnd);
    emojiPanel.hidden=true;emoji.setAttribute('aria-expanded','false');renderDraft();drawList();textarea.focus();
    if(textarea.setSelectionRange)textarea.setSelectionRange(pos+symbol.length,pos+symbol.length);
  }},symbol))))));
  previewDialog.addEventListener('close', () => { if (previewURL) { URL.revokeObjectURL(previewURL); previewURL = ''; } });
  conversation.addEventListener('scroll', () => { if (conversation.scrollHeight - conversation.scrollTop - conversation.clientHeight < 60) newMessage.hidden = true; });
  root.addEventListener('keydown', e => { if (e.key && e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); root.dataset.view = 'daftar'; search.focus(); } });
  const visible = () => { if (!document.hidden) sync(true); };
  document.addEventListener('visibilitychange', visible);
  const viewport = window.visualViewport;
  const resize = () => { if (viewport) root.style.setProperty('--dash-height', Math.round(viewport.height) + 'px'); };
  if (viewport) { viewport.addEventListener('resize', resize); resize(); }
  const timer = setInterval(() => sync(), 5000); S.poll = timer;
  S.bersihkanDashboard = () => { disposed = true; S.kembaliDashboard = null; media.reset(); ++detailSeq; clearInterval(timer); if (viewport) viewport.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', visible); if (previewURL) { URL.revokeObjectURL(previewURL); previewURL = ''; } }; 
  if (selected) { renderDraft(); drawInfo(); } else { compose.hidden = true; messages.replaceChildren(empty('Pilih percakapan', '')); drawInfo(); }
  sync(true);
  return root;
}
