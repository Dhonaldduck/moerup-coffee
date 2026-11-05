/* Pendeteksi transaksi kembar saat impor cadangan (dipakai admin.js).
   Tanpa ketergantungan Firebase supaya bisa diuji di Node.

   Kasus nyatanya: transaksi yang sama dicatat dua kali di dua sistem (versi
   Claude dan versi web) dengan ID berbeda. Impor biasa menggabungkan per ID,
   jadi tanpa pemeriksaan ini transaksi itu akan dobel.

   Dianggap kembar: jenis, sub-jenis, tanggal, pihak (huruf kecil), dan nilai
   rupiah (dibulatkan) sama, padahal ID-nya berbeda. Dicocokkan per hitungan:
   kalau database punya 2 nota identik dan berkas punya 3, yang dilewati 2. */

export function nilaiTxn(t) {
  const n = v => +v || 0;
  if (t.type === "purchase")
    return (t.lines || []).reduce((s, l) => s + n(l.qty) * n(l.unitPrice), 0) + n(t.freight) + n(t.otherCost);
  if (t.type === "sale")
    return (t.lines || []).reduce((s, l) => s + n(l.qty) * n(l.unitPrice) - n(l.disc), 0) - n(t.discount);
  if (t.type === "roast") return n(t.inputG) * 100000 + n(t.outputG);
  if (t.type === "loanpay") return n(t.principal) + n(t.interest);
  return n(t.amount) || n(t.qty) || n(t.gram);
}

export function tandaTxn(t) {
  const pihak = String(t.party || t.customer || t.lender || t.skuId || t.greenbeanId || t.itemId || t.accountId || "")
    .trim().toLowerCase().replace(/\s+/g, " ");
  return [t.type || "", t.kind || "", String(t.date || "").slice(0, 10), pihak, Math.round(nilaiTxn(t))].join("|");
}

/* d: hasil periksaCadangan (perBulan, katalog); dbTxns: {id: txn}; dbKatalog: dokumen master/catalog.
   Mengembalikan { txnIds:Set, aset:Set, supplies:Set, contoh:[...] }. */
export function cariKembar(d, dbTxns, dbKatalog) {
  dbTxns = dbTxns || {}; dbKatalog = dbKatalog || {};
  const sisa = new Map();
  for (const t of Object.values(dbTxns)) { const k = tandaTxn(t); sisa.set(k, (sisa.get(k) || 0) + 1); }
  const semua = [];
  for (const isi of Object.values(d.perBulan || {})) for (const [id, t] of Object.entries(isi)) semua.push([id, t]);
  semua.sort((a, b) => String(a[1].date).localeCompare(String(b[1].date)) || (a[1].seq || 0) - (b[1].seq || 0));

  const txnIds = new Set(), contoh = [];
  for (const [id, t] of semua) {
    if (dbTxns[id]) continue;                      // ID sama = memang diperbarui, bukan kembar
    const k = tandaTxn(t), ada = sisa.get(k) || 0;
    if (ada > 0) { sisa.set(k, ada - 1); txnIds.add(id); if (contoh.length < 6) contoh.push(t); }
  }

  // Aset yang lahir dari pembelian kembar ikut dilewati, kalau belum ada di database.
  const aset = new Set();
  for (const [id, t] of semua)
    if (txnIds.has(id) && t.kind === "asset" && t.assetId && !((dbKatalog.assets || {})[t.assetId])) aset.add(t.assetId);

  // Kemasan/bahan baru yang HANYA dipakai transaksi kembar juga dilewati.
  const dipakaiOleh = (sid, t) =>
    (t.lines || []).some(l => l.itemId === sid) || (t.packing || []).some(p => p.supplyId === sid) ||
    (t.items || []).some(x => x.supplyId === sid) || (t.itemKind === "sup" && t.itemId === sid);
  const skuFile = Object.values((d.katalog || {}).skus || {});
  const supplies = new Set();
  for (const sid of Object.keys((d.katalog || {}).supplies || {})) {
    if ((dbKatalog.supplies || {})[sid]) continue;
    const olehKembar = semua.some(([id, t]) => txnIds.has(id) && dipakaiOleh(sid, t));
    const olehLain = semua.some(([id, t]) => !txnIds.has(id) && dipakaiOleh(sid, t)) ||
      skuFile.some(k => (k.components || []).some(c => c.supplyId === sid) || k.airSupplyId === sid);
    if (olehKembar && !olehLain) supplies.add(sid);
  }
  return { txnIds, aset, supplies, contoh };
}

/* Buang yang kembar dari data impor (dipanggil sebelum menulis). */
export function buangKembar(d, k) {
  const perBulan = {};
  for (const [m, isi] of Object.entries(d.perBulan)) {
    const sisa = {};
    for (const [id, t] of Object.entries(isi)) if (!k.txnIds.has(id)) sisa[id] = t;
    if (Object.keys(sisa).length) perBulan[m] = sisa;
  }
  const katalog = {};
  for (const [j, isi] of Object.entries(d.katalog)) {
    const buang = j === "assets" ? k.aset : j === "supplies" ? k.supplies : null;
    const x = {}; for (const [id, v] of Object.entries(isi)) if (!buang || !buang.has(id)) x[id] = v;
    if (Object.keys(x).length) katalog[j] = x;
  }
  const jumlahTxn = Object.values(perBulan).reduce((a, b) => a + Object.keys(b).length, 0);
  return { ...d, perBulan, katalog, jumlahTxn };
}
