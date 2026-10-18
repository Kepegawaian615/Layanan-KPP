/* Pembaca dokumen kode billing untuk dashboard petugas (versi 4.0).
 * Bagian di antara penanda MULAI/AKHIR disalin sama persis ke apps-script/Dashboard.gs,
 * sehingga dashboard dan server menyusun pesan WP dengan aturan yang sama.
 * Bagian setelah penanda AKHIR hanya untuk browser: membaca teks PDF dengan PDF.js lokal. */

/* ==== MULAI PEMBACA BILLING (salinan sama di apps-script/Dashboard.gs) ==== */
var KPPBilling = (function () {
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BULAN_SINGKAT = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
  // Nama akun pajak yang umum. Dipakai hanya bila dokumen tidak mencantumkan uraiannya.
  var NAMA_KAP = {
    '411119': 'PPh Migas Lainnya', '411121': 'PPh Pasal 21', '411122': 'PPh Pasal 22', '411123': 'PPh Pasal 22 Impor',
    '411124': 'PPh Pasal 23', '411125': 'PPh Pasal 25/29 Orang Pribadi', '411126': 'PPh Pasal 25/29 Badan',
    '411127': 'PPh Pasal 26', '411128': 'PPh Final', '411129': 'PPh Non-Migas Lainnya', '411211': 'PPN Dalam Negeri',
    '411212': 'PPN Impor', '411219': 'PPN Lainnya', '411221': 'PPnBM Dalam Negeri', '411222': 'PPnBM Impor',
    '411229': 'PPnBM Lainnya', '411611': 'Bea Meterai', '411618': 'Deposit Pajak', '411619': 'Pajak Tidak Langsung Lainnya'
  };
  var NAMA_GABUNGAN = {
    '411128-402': 'PPh Final atas pengalihan hak atas tanah dan/atau bangunan',
    '411128-403': 'PPh Final atas persewaan tanah dan/atau bangunan',
    '411128-420': 'PPh Final UMKM',
    '411128-432': 'PPh Final atas PPJB tanah dan/atau bangunan',
    '411125-100': 'PPh Pasal 25/29 Orang Pribadi (masa)',
    '411126-100': 'PPh Pasal 25/29 Badan (masa)',
    '411611-100': 'Bea Meterai (setoran SSP)',
    '411618-100': 'Setoran Deposit Pajak'
  };
  var LABEL_LAIN = /(?:\b(?:kode\s*billing|id\s*billing|masa\s*aktif|berlaku|npwp|nitku|nik|nama|alamat|nop|kode\s*akun\s*pajak|jenis\s*pajak|kode\s*jenis\s*setoran|jenis\s*setoran|masa\s*pajak|tahun\s*pajak|nomor\s*ketetapan|jumlah\s*setor\w*|terbilang|uraian|keterangan|mata\s*uang)\b\s*[:=])/i;

  // Segmen yang seluruhnya berupa nama label (judul kolom tabel), bukan nilai.
  var LABEL_KATA = /^(?:kode\s*billing|id\s*billing|npwp|nitku|nik|nama(?:\s*wajib\s*pajak)?|alamat|nop|kode\s*akun\s*pajak|kap|jenis\s*pajak|kode\s*jenis\s*setoran|kjs|jenis\s*setoran|masa\s*pajak|tahun\s*pajak|nomor\s*ketetapan|jumlah(?:\s*setor(?:an)?)?|nominal(?:\s*setor(?:an)?)?|kap\s*-?\s*kjs|ref(?:\s*tagihan)?|tagihan|terbilang|uraian|keterangan|masa\s*aktif(?:\s*kode\s*billing)?|berlaku\s*(?:s\.?\s*d\.?|sampai)|mata\s*uang)$/i;

  function teks(v) { return v === null || v === undefined ? '' : String(v); }
  function digit(v) { return teks(v).replace(/\D/g, ''); }
  function esc(v) { return teks(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function rapiSpasi(v) { return teks(v).replace(/\s+/g, ' ').replace(/^[\s:=\-–.]+|[\s:=\-–]+$/g, '').trim(); }

  function normal(isi) {
    return teks(isi).replace(/\r/g, '').replace(/[   \t]/g, ' ').replace(/：/g, ':')
      .split('\n').map(function (b) { return b.replace(/ {2,}/g, ' ').trim(); }).join('\n');
  }

  // Potongan teks setelah label (boleh berlanjut ke baris berikutnya), untuk dicari nilainya.
  // Label yang diikuti titik dua didahulukan, lalu label tanpa titik dua (mis. judul tabel).
  function setelah(isi, pola, panjang) {
    var tegas = [], longgar = [];
    var re = new RegExp(pola.source, 'gi');
    var m;
    while ((m = re.exec(isi))) {
      var sisa = isi.slice(m.index + m[0].length, m.index + m[0].length + (panjang || 90));
      (/^[ ]*[:=]/.test(sisa) ? tegas : longgar).push(sisa);
      if (m[0].length === 0) re.lastIndex++;
    }
    return tegas.concat(longgar);
  }
  // Nilai setelah label: baris yang sama, atau baris berikutnya bila nilainya turun ke bawah.
  function barisNilai(potongan) {
    var bagian = teks(potongan).replace(/^[ :=\-–]*/, '').split('\n');
    var baris = bagian[0].trim() ? bagian[0] : (bagian[1] || '');
    var lain = baris.search(LABEL_LAIN);
    if (lain > 0) baris = baris.slice(0, lain);
    else if (lain === 0) baris = '';
    if (LABEL_KATA.test(rapiSpasi(baris)) || /^(?:[A-Za-z]+\s*){1,4}$/.test(rapiSpasi(baris)) && rapiSpasi(baris).split(/\s+/).every(function (w) { return LABEL_KATA.test(w) || /^(?:pajak|setor|billing|aktif|kode|jenis|masa|tahun|nomor|ketetapan|uang|mata)$/i.test(w); })) baris = '';
    return baris;
  }
  function sisaBaris(potongan) { return rapiSpasi(barisNilai(potongan)); }

  function kodeBilling(isi, kecuali) {
    var hasil = [];
    var tambah = function (k) { if (k.length === 15 && hasil.indexOf(k) < 0 && (!kecuali || kecuali.indexOf(k) < 0)) hasil.push(k); };
    setelah(isi, /(?:kode|id)\s*billing|billing\s*(?:code|id)/, 90).forEach(function (p) {
      var m = /(?:^|[^\d])((?:\d[ .\-]?){14}\d)(?!\d)/.exec(p);
      if (m) tambah(digit(m[1]));
    });
    if (hasil.length) return hasil;
    var re = /(^|[^\d.\-])(\d{15})(?!\d)/g;
    var m;
    while ((m = re.exec(isi))) {
      var sebelum = isi.slice(Math.max(0, m.index - 24), m.index + m[1].length).toLowerCase();
      if (/npwp|nik|nitku|nop|ntpn|ntb|nomor|no\./.test(sebelum)) continue;
      tambah(m[2]);
    }
    return hasil;
  }

  function nomorIdentitas(isi) {
    var hasil = '';
    setelah(isi, /\b(?:npwp|nik\s*\/\s*npwp|npwp\s*\/\s*nik)\b(?!\s*penyetor)/, 60).some(function (p) {
      var m = /^[\s:=]*((?:\d[ .\-]?){14,15}\d)(?!\d)/.exec(p.split('\n')[0]) || /^[\s:=]*\n?\s*((?:\d[ .\-]?){14,15}\d)(?!\d)/.exec(p);
      if (m) { var d = digit(m[1]); if (d.length === 15 || d.length === 16) { hasil = d; return true; } }
      return false;
    });
    return hasil;
  }

  function akunPajak(isi) {
    var o = { kap: '', kjs: '', namaKap: '', namaKjs: '' };
    var gab = /\b(4\d{5})\s*[-–\/]\s*(\d{3})\b/.exec(isi);
    if (gab) { o.kap = gab[1]; o.kjs = gab[2]; }
    var uraianKode = function (baris, kode) { var t = rapiSpasi(baris.replace(kode, ' ').replace(/[()]/g, ' ').replace(/^[\s\-–:]+/, '')); return LABEL_KATA.test(t) ? '' : t; };
    setelah(isi, /kode\s*akun\s*pajak|akun\s*pajak|\bkap\b|jenis\s*pajak/, 140).some(function (p) {
      var baris = barisNilai(p);
      var m = /(4\d{5})(?:\s*[-–\/]\s*(\d{3})\b)?/.exec(baris);
      if (!m) return false;
      o.kap = o.kap || m[1];
      if (m[2] && !o.kjs) o.kjs = m[2];
      o.namaKap = uraianKode(baris, m[0]);
      return true;
    });
    setelah(isi, /kode\s*jenis\s*setoran|jenis\s*setoran|\bkjs\b/, 160).some(function (p) {
      var baris = barisNilai(p);
      var m = /(?:^|[^\d])(\d{3})(?!\d)/.exec(baris);
      if (!m) return false;
      o.kjs = o.kjs || m[1];
      o.namaKjs = uraianKode(baris, m[1]);
      return true;
    });
    return o;
  }

  function namaJenis(a) {
    var kunci = a.kap && a.kjs ? a.kap + '-' + a.kjs : '';
    var dok = [a.namaKap, a.namaKjs].filter(function (x) { return x && !/^\d+$/.test(x); });
    if (dok.length === 2 && dok[1].toLowerCase().indexOf(dok[0].toLowerCase()) >= 0) dok = [dok[1]];
    if (dok.length) return dok.join(' – ').slice(0, 140);
    return NAMA_GABUNGAN[kunci] || NAMA_KAP[a.kap] || '';
  }

  function namaBulan(n) { return BULAN[n - 1] || ''; }
  function masaPajak(isi, tahun) {
    var nilai = '';
    // Nilai harus memuat angka atau nama bulan. Judul kolom tabel (REF TAGIHAN NOP NOMINAL) tidak boleh terbaca sebagai masa pajak.
    setelah(isi, /masa\s*pajak/, 80).some(function (p) {
      var v = sisaBaris(p), kata = v.split(/\s+/)[0].toLowerCase();
      if (v && (/\d/.test(v) || BULAN.some(function (b) { return kata.length >= 3 && b.toLowerCase().indexOf(kata) === 0; }))) nilai = v;
      return !!nilai;
    });
    if (!nilai) return '';
    var m = /^(\d{2})(\d{2})(\d{4})$/.exec(nilai.replace(/\s/g, ''));
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12 && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
      return m[1] === m[2] ? namaBulan(Number(m[1])) + ' ' + m[3] : namaBulan(Number(m[1])) + '–' + namaBulan(Number(m[2])) + ' ' + m[3];
    }
    m = /^(\d{2})(\d{4})$/.exec(nilai.replace(/\s/g, ''));
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return namaBulan(Number(m[1])) + ' ' + m[2];
    m = /^([A-Za-z]{3,9})\.?\s*(?:[-–]|s\.?\s*d\.?)\s*([A-Za-z]{3,9})\.?\s*((?:19|20)\d{2})?$/i.exec(nilai);
    if (m && BULAN_SINGKAT[m[1].slice(0, 3).toLowerCase()] && BULAN_SINGKAT[m[2].slice(0, 3).toLowerCase()]) {
      var b1 = BULAN_SINGKAT[m[1].slice(0, 3).toLowerCase()], b2 = BULAN_SINGKAT[m[2].slice(0, 3).toLowerCase()], th = m[3] || tahun;
      return (b1 === b2 ? namaBulan(b1) : namaBulan(b1) + '–' + namaBulan(b2)) + (th ? ' ' + th : '');
    }
    m = /^([A-Za-z]{3,9})\.?\s+((?:19|20)\d{2})$/.exec(nilai);
    if (m && BULAN_SINGKAT[m[1].slice(0, 3).toLowerCase()]) return namaBulan(BULAN_SINGKAT[m[1].slice(0, 3).toLowerCase()]) + ' ' + m[2];
    m = /^(\d{1,2})\s*[-\/.]\s*(\d{4})$/.exec(nilai);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return namaBulan(Number(m[1])) + ' ' + m[2];
    m = /^(\d{1,2})\s*(?:[-–]|s\.?\s*d\.?)\s*(\d{1,2})$/i.exec(nilai);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12 && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
      var dasar = m[1] === m[2] ? namaBulan(Number(m[1])) : namaBulan(Number(m[1])) + '–' + namaBulan(Number(m[2]));
      return tahun ? dasar + ' ' + tahun : dasar;
    }
    m = /^(\d{1,2})$/.exec(nilai);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return namaBulan(Number(m[1])) + (tahun ? ' ' + tahun : '');
    nilai = nilai.replace(/\(\s*|\s*\)/g, ' ').replace(/\s+/g, ' ').trim();
    if (tahun && nilai.indexOf(tahun) < 0 && !/\d{4}/.test(nilai)) nilai += ' ' + tahun;
    return nilai.slice(0, 60);
  }
  function tahunPajak(isi) {
    var hasil = '';
    setelah(isi, /tahun\s*pajak/, 30).some(function (p) { var m = /^[\s:=]*((?:19|20)\d{2})\b/.exec(p); if (m) hasil = m[1]; return !!hasil; });
    return hasil;
  }

  function angkaRupiah(s) {
    var t = teks(s).replace(/\s/g, '').replace(/^(?:rp\.?|idr)/i, '');
    var m = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?/.exec(t) || /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?/.exec(t) || /^\d+(?:[.,]\d{1,2})?/.exec(t);
    if (!m) return '';
    var v = m[0];
    if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(v)) v = v.split(',')[0];
    else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(v)) v = v.split('.')[0];
    else v = v.split(/[.,]/)[0];
    v = digit(v).replace(/^0+(?=\d)/, '');
    return v.length && v.length <= 13 ? v : '';
  }
  function jumlahSetor(isi) {
    var hasil = '';
    setelah(isi, /jumlah\s*(?:setor(?:an)?|pembayaran|yang\s*(?:harus\s*)?(?:di)?bayar(?:kan)?|bayar|tagihan|pajak)|total\s*(?:setor(?:an)?|pembayaran|bayar|tagihan)|nominal(?:\s*setor(?:an)?)?/, 60).some(function (p) {
      var m = /^[\s:=]*(?:\((?:rp|idr)\)\s*[:=]?\s*)?(?:\n\s*)?((?:rp\.?|idr)?\s*[\d.,]+)/i.exec(p);
      if (m) hasil = angkaRupiah(m[1]);
      return !!hasil && hasil !== '0';
    });
    return hasil;
  }

  function waktuWIB(y, bln, tgl, jam, mnt, dtk, zona) {
    var selisih = zona === 'WITA' ? 8 : zona === 'WIT' ? 9 : 7;
    if (!(y >= 2000 && y <= 2100 && bln >= 1 && bln <= 12 && tgl >= 1 && tgl <= 31 && jam >= 0 && jam <= 23 && mnt >= 0 && mnt <= 59 && dtk >= 0 && dtk <= 59)) return null;
    var d = new Date(Date.UTC(y, bln - 1, tgl, jam - selisih, mnt, dtk));
    var cek = new Date(d.getTime() + selisih * 3600000);
    return cek.getUTCDate() === tgl ? d : null;
  }
  function semuaTanggal(p) {
    var hasil = [];
    var zona = /\bWITA\b/i.test(p) ? 'WITA' : /\bWIT\b/i.test(p) ? 'WIT' : 'WIB';
    var simpan = function (idx, y, b, t, j, m, s) {
      var ada = j !== undefined && j !== '' && j !== null;
      var d = waktuWIB(Number(y), Number(b), Number(t), ada ? Number(j) : 23, ada ? Number(m) : 59, ada && s ? Number(s) : ada ? 0 : 59, zona);
      if (d) hasil.push({ i: idx, d: d, jam: ada });
    };
    var re = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:[ ,T]+(?:pukul\s*|jam\s*)?(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?/gi;
    var m;
    while ((m = re.exec(p))) simpan(m.index, m[3], m[2], m[1], m[4], m[5], m[6]);
    re = /(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?/g;
    while ((m = re.exec(p))) simpan(m.index, m[1], m[2], m[3], m[4], m[5], m[6]);
    re = /(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})(?:[ ,]+(?:pukul\s*|jam\s*)?(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?/g;
    while ((m = re.exec(p))) {
      var b = BULAN_SINGKAT[m[2].slice(0, 3).toLowerCase()];
      if (b) simpan(m.index, m[3], b, m[1], m[4], m[5], m[6]);
    }
    return hasil.sort(function (a, c) { return a.i - c.i; });
  }
  function masaAktif(isi) {
    var hasil = null;
    setelah(isi, /masa\s*aktif(?:\s*kode\s*billing)?|berlaku\s*(?:sampai|hingga|s\.?\s*d\.?|sd)(?:\s*dengan)?|batas\s*(?:waktu|akhir)(?:\s*(?:pembayaran|bayar|setor(?:an)?))?|tanggal\s*(?:kedaluwarsa|kadaluwarsa|kedaluarsa|kadaluarsa)|kedaluwarsa|kadaluwarsa|kedaluarsa|kadaluarsa|expired?(?:\s*date)?|jatuh\s*tempo/, 90).some(function (p) {
      var daftar = semuaTanggal(p.split('\n').slice(0, 3).join(' '));
      if (!daftar.length) return false;
      hasil = daftar[daftar.length - 1];
      return true;
    });
    return hasil ? { iso: hasil.d.toISOString(), jam: hasil.jam } : null;
  }

  function namaWP(isi) {
    var hasil = '';
    setelah(isi, /\bnama(?:\s*wajib\s*pajak|\s*wp)?\b(?!\s*(?:penyetor|bank|ibu|petugas|pemohon))/, 120).some(function (p) {
      var v = sisaBaris(p);
      if (v && !/^\d+$/.test(v) && v.length >= 2) { hasil = v.slice(0, 100); return true; }
      return false;
    });
    return hasil;
  }
  function nilaiTeks(isi, pola, maks) {
    var hasil = '';
    setelah(isi, pola, maks + 40).some(function (p) { var v = sisaBaris(p); if (v && v !== '-' && !/^0+$/.test(v)) hasil = v.slice(0, maks); return !!hasil; });
    return hasil;
  }

  /** Membaca rincian dari teks dokumen billing (hasil PDF.js atau OCR). */
  function baca(isiMentah) {
    var isi = normal(isiMentah);
    var npwp = nomorIdentitas(isi);
    var kode = kodeBilling(isi, npwp ? [npwp] : []);
    var akun = akunPajak(isi);
    var tahun = tahunPajak(isi);
    var aktif = masaAktif(isi);
    var r = {
      kode: kode.slice(0, 10), kap: akun.kap, kjs: akun.kjs, jenis: namaJenis(akun),
      masa: masaPajak(isi, tahun), tahun: tahun, jumlah: jumlahSetor(isi),
      berlaku: aktif ? aktif.iso : '', berlakuJam: aktif ? aktif.jam : false,
      nama: namaWP(isi), npwp: npwp,
      ketetapan: nilaiTeks(isi, /nomor\s*ketetapan|no\.?\s*ketetapan/, 60),
      uraian: nilaiTeks(isi, /\buraian\b/, 120)
    };
    r.terbaca = !!(r.kode.length || r.jumlah || r.kap);
    return r;
  }

  /** Menyaring rincian dari browser/OCR sebelum dipakai server. Mengembalikan null bila tidak ada isi berarti. */
  function rapikan(r) {
    if (!r || typeof r !== 'object') return null;
    var kode = [];
    (Array.isArray(r.kode) ? r.kode : []).slice(0, 10).forEach(function (k) { var d = digit(k); if (d.length === 15 && kode.indexOf(d) < 0) kode.push(d); });
    var bersih = function (v, maks) { return rapiSpasi(teks(v).replace(/[\u0000-\u001f\u007f<>]/g, ' ')).slice(0, maks); };
    var berlaku = '';
    if (r.berlaku) { var d = new Date(r.berlaku); if (!isNaN(d.getTime()) && d.getUTCFullYear() >= 2000 && d.getUTCFullYear() <= 2100) berlaku = d.toISOString(); }
    var hasil = {
      kode: kode, kap: /^4\d{5}$/.test(digit(r.kap)) ? digit(r.kap) : '', kjs: /^\d{3}$/.test(digit(r.kjs)) ? digit(r.kjs) : '',
      jenis: bersih(r.jenis, 140), masa: bersih(r.masa, 60), tahun: /^(19|20)\d{2}$/.test(digit(r.tahun)) ? digit(r.tahun) : '',
      jumlah: /^\d{1,16}$/.test(digit(r.jumlah)) ? digit(r.jumlah).replace(/^0+(?=\d)/, '') : '',
      berlaku: berlaku, berlakuJam: !!r.berlakuJam && !!berlaku,
      nama: bersih(r.nama, 100), npwp: [15, 16].indexOf(digit(r.npwp).length) >= 0 ? digit(r.npwp) : '',
      ketetapan: bersih(r.ketetapan, 60), uraian: bersih(r.uraian, 120)
    };
    if (hasil.jumlah === '0') hasil.jumlah = '';
    return hasil.kode.length || hasil.jumlah || hasil.kap || hasil.berlaku ? hasil : null;
  }

  // "Yth. Bapak/Ibu Nama", kecuali nama sudah diawali sapaan (Bapak, Ibu, Sdr., dll.).
  function sapa(nama) {
    var n = rapiSpasi(nama) || 'Wajib Pajak';
    return /^(?:bapak|ibu|bpk\.?|bu|pak|sdr\.?|sdri\.?|saudara|saudari|tuan|nyonya|ny\.)(?:\s|$)/i.test(n) ? 'Yth. <b>' + esc(n) + '</b>,' : 'Yth. Bapak/Ibu <b>' + esc(n) + '</b>,';
  }
  function rupiah(v) { var d = digit(v); return d ? 'Rp' + d.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''; }
  function tanggalWIB(iso, denganJam) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var w = new Date(d.getTime() + 7 * 3600000);
    var dua = function (n) { return (n < 10 ? '0' : '') + n; };
    var dasar = w.getUTCDate() + ' ' + BULAN[w.getUTCMonth()] + ' ' + w.getUTCFullYear();
    return denganJam === false ? dasar : dasar + ', pukul ' + dua(w.getUTCHours()) + '.' + dua(w.getUTCMinutes()) + ' WIB';
  }
  function kodeTampil(k) { return k.slice(0, 4) + ' ' + k.slice(4, 8) + ' ' + k.slice(8, 12) + ' ' + k.slice(12); }
  function sudahLewat(r, kini) { return !!(r && r.berlaku && new Date(r.berlaku).getTime() <= (kini || Date.now())); }

  /** Panjang teks yang dihitung Telegram (setelah tag HTML dibuang). */
  function panjangTampil(html) { return teksPolos(html).length; }
  function teksPolos(html) {
    return teks(html).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  }

  /** Menyusun pesan pengantar file billing untuk WP. Hasil berupa HTML Telegram, maksimal 1.024 karakter tampil. */
  function pesan(o) {
    o = o || {};
    var r = o.rincian || null;
    var kode = [];
    (r && r.kode ? r.kode : []).concat(o.kode || []).forEach(function (k) { var d = digit(k); if (d.length === 15 && kode.indexOf(d) < 0) kode.push(d); });
    var ke = o.total > 1 && o.urutan && o.urutan <= o.total ? ' (' + o.urutan + ' dari ' + o.total + ')' : o.urutan > 1 ? ' (dokumen ke-' + o.urutan + ')' : '';
    var pembuka = [
      sapa(o.pemohon),
      '',
      'Terima kasih telah menunggu. Bersama ini kami sampaikan dokumen kode billing atas permohonan <b>' + esc(o.tiket || '') + '</b>' + ke + '.'
    ];
    var rinci = [];
    if (kode.length === 1) rinci.push('🧾 Kode billing: <code>' + kode[0] + '</code>');
    else if (kode.length > 1) rinci.push('🧾 Kode billing: ' + kode.map(function (k) { return '<code>' + k + '</code>'; }).join(', '));
    if (r) {
      var akun = r.kap ? r.kap + (r.kjs ? '-' + r.kjs : '') : '';
      if (r.jenis || akun) rinci.push('• Jenis pajak: ' + esc([akun, r.jenis].filter(Boolean).join(' · ')));
      if (r.masa || r.tahun) rinci.push('• Masa pajak: ' + esc(r.masa || r.tahun));
      if (r.jumlah) rinci.push('• Jumlah setor: <b>' + rupiah(r.jumlah) + '</b>');
      if (r.berlaku) rinci.push('• Berlaku sampai: <b>' + esc(tanggalWIB(r.berlaku, r.berlakuJam !== false)) + '</b>');
      if (r.nama) rinci.push('• Atas nama: ' + esc(r.nama) + (r.npwp ? ' · NPWP/NIK ' + r.npwp : ''));
    }
    var adaRinci = !!(r && (r.jumlah || r.berlaku || r.jenis || r.kap));
    var periksa = adaRinci ? 'Mohon periksa kembali kesesuaian rincian di atas dengan dokumen terlampir.'
      : 'Rincian jenis pajak, masa pajak, jumlah setor, dan masa berlaku kode billing tercantum pada dokumen terlampir. Mohon diperiksa sebelum melakukan pembayaran.';
    var langkah = [
      '<b>Langkah pembayaran</b>',
      '1. Lakukan pembayaran sebelum masa berlaku kode billing berakhir melalui bank/pos persepsi, ATM, internet/mobile banking, atau kanal pembayaran resmi lainnya.',
      '2. Pastikan jumlah yang dibayarkan sama dengan jumlah setor pada kode billing.',
      '3. Simpan Bukti Penerimaan Negara (BPN) yang memuat NTPN sebagai bukti pembayaran yang sah.'
    ];
    var catatan = rapiSpasi(o.catatan || '');
    var penutup = 'Apabila terdapat data yang tidak sesuai, mohon balas pesan ini sebelum melakukan pembayaran. Terima kasih.';
    var susun = function (pakaiLangkah, pakaiPenutup, catatanMaks) {
      var bagian = pembuka.slice();
      if (rinci.length) bagian.push('', '<b>Rincian pembayaran</b>', rinci.join('\n'));
      bagian.push('', periksa);
      if (pakaiLangkah) bagian.push('', langkah.join('\n'));
      if (catatan && catatanMaks > 0) bagian.push('', 'Keterangan petugas: ' + esc(catatan.length > catatanMaks ? catatan.slice(0, catatanMaks - 1) + '…' : catatan));
      if (pakaiPenutup) bagian.push('', penutup);
      return bagian.join('\n');
    };
    var pilihan = [[true, true, 400], [true, true, 160], [true, false, 160], [false, true, 160], [false, false, 120], [false, false, 0]];
    for (var i = 0; i < pilihan.length; i++) {
      var h = susun(pilihan[i][0], pilihan[i][1], pilihan[i][2]);
      if (panjangTampil(h) <= 1024) return h;
    }
    return ('Dokumen kode billing atas permohonan <b>' + esc(o.tiket || '') + '</b>' + ke + '.\n' +
      kode.slice(0, 8).map(function (k) { return '<code>' + k + '</code>'; }).join('\n') +
      '\nRincian lengkap tercantum pada dokumen. Simpan BPN setelah pembayaran.');
  }

  /** Pesan untuk kode billing yang diketik petugas (formulir atau topik). Maksimal sekitar 3.900 karakter. */
  function pesanKode(o) {
    o = o || {};
    var items = (o.items || []).filter(function (it) { return it && digit(it.kode).length === 15; });
    var banyak = items.length > 1;
    var baris = [
      sapa(o.pemohon),
      '',
      'Terima kasih telah menunggu. Bersama ini kami sampaikan ' + (banyak ? items.length + ' kode billing' : 'kode billing') + ' atas permohonan <b>' + esc(o.tiket || '') + '</b>:',
      ''
    ];
    items.forEach(function (it, i) {
      var k = digit(it.kode);
      var ket = [it.jenis ? esc(rapiSpasi(it.jenis)) : '', it.jumlah ? '<b>' + rupiah(it.jumlah) + '</b>' : ''].filter(Boolean).join(' · ');
      if (banyak) baris.push((i + 1) + '. 🧾 <code>' + k + '</code>' + (ket ? '\n    ' + ket : ''));
      else {
        baris.push('🧾 Kode billing: <code>' + k + '</code>');
        if (it.jenis) baris.push('• Jenis pajak: ' + esc(rapiSpasi(it.jenis)));
        if (it.jumlah) baris.push('• Jumlah setor: <b>' + rupiah(it.jumlah) + '</b>');
      }
    });
    baris.push('', o.berlaku
      ? 'Kode billing berlaku sampai <b>' + esc(tanggalWIB(o.berlaku, true)) + '</b>.'
      : 'Masa berlaku kode billing terbatas. Mohon pembayaran dilakukan sesegera mungkin; apabila kode billing telah kedaluwarsa, silakan hubungi kami melalui chat ini.');
    baris.push('',
      '<b>Langkah pembayaran</b>',
      '1. Lakukan pembayaran melalui bank/pos persepsi, ATM, internet/mobile banking, atau kanal pembayaran resmi lainnya.',
      '2. Pastikan jumlah yang dibayarkan sama dengan jumlah setor pada kode billing.',
      '3. Simpan Bukti Penerimaan Negara (BPN) yang memuat NTPN sebagai bukti pembayaran yang sah.',
      '',
      '<i>Ketuk kode billing untuk menyalin.</i>',
      'Apabila terdapat data yang tidak sesuai, mohon balas pesan ini sebelum melakukan pembayaran. Terima kasih.');
    return baris.join('\n');
  }

  /** Ringkasan satu baris untuk catatan petugas di topik dan dashboard. */
  function ringkas(r) {
    if (!r) return '';
    return [r.kode && r.kode.length ? r.kode.join(', ') : '', r.jenis || (r.kap ? r.kap + (r.kjs ? '-' + r.kjs : '') : ''), r.masa,
      r.jumlah ? rupiah(r.jumlah) : '', r.berlaku ? 's.d. ' + tanggalWIB(r.berlaku, r.berlakuJam !== false) : ''].filter(Boolean).join(' · ');
  }

  // Menyusun ulang potongan teks PDF per baris (atas ke bawah, kiri ke kanan).
  // Tabel dengan judul kolom di satu baris dan nilai di baris berikutnya ditambahkan sebagai "Label : nilai".
  function susunBaris(items) {
    var baris = [];
    (items || []).forEach(function (it) {
      if (!it || typeof it.str !== 'string' || !it.str.trim() || !it.transform) return;
      var x = it.transform[4], y = it.transform[5], tinggi = Math.abs(it.transform[3]) || it.height || 10;
      var b = null;
      for (var i = 0; i < baris.length; i++) if (Math.abs(baris[i].y - y) <= Math.max(2, tinggi * 0.45)) { b = baris[i]; break; }
      if (!b) { b = { y: y, tinggi: tinggi, isi: [] }; baris.push(b); }
      b.isi.push({ x: x, s: it.str, w: it.width || 0 });
    });
    baris.sort(function (a, c) { return c.y - a.y; });
    var data = baris.map(function (b) {
      b.isi.sort(function (a, c) { return a.x - c.x; });
      var seg = [], akhir = null;
      b.isi.forEach(function (p) {
        var jarak = akhir === null ? 0 : p.x - akhir;
        if (!seg.length || jarak > Math.max(12, b.tinggi * 1.2)) seg.push({ x: p.x, s: p.s });
        else seg[seg.length - 1].s += (jarak > 1.5 ? ' ' : '') + p.s;
        akhir = p.x + p.w;
      });
      seg.forEach(function (x) { x.s = x.s.replace(/\s+/g, ' ').trim(); });
      return seg;
    });
    var hasil = data.map(function (seg) { return seg.map(function (x) { return x.s; }).join(' '); });
    for (var i = 0; i + 1 < data.length; i++) {
      var kepala = data[i], nilai = data[i + 1];
      if (kepala.length < 2 || nilai.length < 2 || !kepala.every(function (k) { return LABEL_KATA.test(k.s); })) continue;
      nilai.forEach(function (v) {
        var dekat = null, jarakMin = Infinity;
        kepala.forEach(function (k) { var j = Math.abs(k.x - v.x); if (j < jarakMin) { jarakMin = j; dekat = k; } });
        if (dekat && jarakMin <= 40) hasil.push(dekat.s + ' : ' + v.s);
      });
    }
    return hasil.join('\n');
  }

  return { baca: baca, rapikan: rapikan, pesan: pesan, pesanKode: pesanKode, ringkas: ringkas, susunBaris: susunBaris, sapa: sapa, rupiah: rupiah, tanggalWIB: tanggalWIB,
    kodeTampil: kodeTampil, sudahLewat: sudahLewat, teksPolos: teksPolos, panjangTampil: panjangTampil };
})();
/* ==== AKHIR PEMBACA BILLING ==== */

/* ---- Khusus browser: membaca teks PDF dengan PDF.js yang disertakan di vendor/pdfjs/ ---- */
(function () {
  if (typeof window === 'undefined' || typeof KPPBilling === 'undefined') return;
  var VERSI_PDFJS = '6.2.108';
  var muat = null;
  function alamat(relatif) {
    try { return new URL(relatif, (document.currentScript && document.currentScript.src) || document.baseURI).href; } catch (e) { return relatif; }
  }
  var lokal = { modul: alamat('vendor/pdfjs/pdf.min.mjs'), pekerja: alamat('vendor/pdfjs/pdf.worker.min.mjs') };
  var cdn = {
    modul: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + VERSI_PDFJS + '/legacy/build/pdf.min.mjs',
    pekerja: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + VERSI_PDFJS + '/legacy/build/pdf.worker.min.mjs'
  };
  function muatPdfJs() {
    if (muat) return muat;
    var coba = function (sumber) {
      return import(/* webpackIgnore: true */ sumber.modul).then(function (pdfjs) {
        pdfjs.GlobalWorkerOptions.workerSrc = sumber.pekerja;
        return pdfjs;
      });
    };
    var asalFile = /^(file|content):/i.test(location.protocol);
    muat = (asalFile ? coba(cdn) : coba(lokal).catch(function () { return coba(cdn); }))
      .catch(function (e) { muat = null; throw new Error('Pembaca PDF belum dapat dimuat di perangkat ini.'); });
    return muat;
  }
  KPPBilling.bacaPdf = function (file) {
    if (!file || !(file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''))) return Promise.reject(new Error('Pembacaan otomatis hanya untuk file PDF.'));
    if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('File lebih dari 5 MB.'));
    return Promise.all([muatPdfJs(), file.arrayBuffer()]).then(function (x) {
      var pdfjs = x[0];
      var tugas = pdfjs.getDocument({ data: new Uint8Array(x[1]), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 });
      return tugas.promise.then(function (doc) {
        var halaman = [];
        var n = Math.min(doc.numPages, 3);
        var baca = function (i) {
          if (i > n) return Promise.resolve();
          return doc.getPage(i).then(function (p) { return p.getTextContent(); }).then(function (tc) { halaman.push(KPPBilling.susunBaris(tc.items)); return baca(i + 1); });
        };
        return baca(1).then(function () { var t = halaman.join('\n'); tugas.destroy(); return t; }, function (e) { tugas.destroy(); throw e; });
      });
    });
  };
  KPPBilling.bacaFile = function (file) {
    return KPPBilling.bacaPdf(file).then(function (isi) {
      var r = KPPBilling.baca(isi);
      r.teksAda = isi.replace(/\s/g, '').length > 20;
      return r;
    });
  };
})();
