/* Uji pendeteksi transaksi kembar untuk impor cadangan (js/impor-kembar.js).
   Skenario nyata: 12 pembelian 3–4 Nov 2026 sudah dicatat di versi web, lalu
   dicatat ulang di versi Claude dengan ID lain. Mengimpor cadangan Claude tidak
   boleh membuatnya dobel. */
import { cariKembar, buangKembar, tandaTxn } from "../js/impor-kembar.js";

const gagal = [];
const cek = (ok, pesan) => { console.log((ok ? "  ok   " : "  GAGAL ") + pesan); if (!ok) gagal.push(pesan); };

// Isi database web (ID, huruf besar-kecil nama toko, dan cara isi berbeda dengan versi Claude).
const P = (id, date, party, kind, lines, extra) => ({ id, type: "purchase", kind, date, party, lines, payment: "cash", ...(extra || {}) });
const db = {
  w1: P("w1", "2026-11-04", "Pak dono", "greenbean", [{ itemId: "gb_arabicacofermentmango", qty: 10000, unitPrice: 190 }], { otherCost: 37000 }),
  w2: P("w2", "2026-11-03", "Sinau Print", "supply", [{ itemId: "x1", qty: 21, unitPrice: 955 }]),
  w3: P("w3", "2026-11-03", "warunk plastik", "asset", [{ itemId: "aw3", qty: 1, unitPrice: 5000 }], { assetId: "aw3" }),
  w4: P("w4", "2026-11-03", "Sinau Print", "supply", [{ itemId: "x2", qty: 12, unitPrice: 925 }]),
  w5: P("w5", "2026-11-03", "Toko bahan kue hasannudinn", "supply", [{ itemId: "susuPcs", qty: 2, unitPrice: 19250 }]),
  w6: P("w6", "2026-11-03", "Warunk Plastik", "asset", [{ itemId: "aw6", qty: 1, unitPrice: 11000 }], { assetId: "aw6" }),
  w7: P("w7", "2026-11-03", "Sinau Print", "supply", [{ itemId: "x3", qty: 12, unitPrice: 925 }]),
  w8: P("w8", "2026-11-03", "Sinau Print", "supply", [{ itemId: "x4", qty: 24, unitPrice: 465 }]),
  w9: P("w9", "2026-11-03", "Sinau print", "supply", [{ itemId: "x5", qty: 21, unitPrice: 955 }]),
  w10: P("w10", "2026-11-03", "Sinau Print", "supply", [{ itemId: "x6", qty: 21, unitPrice: 955 }]),
  w11: P("w11", "2026-11-03", "Warunk plastik", "asset", [{ itemId: "aw11", qty: 1, unitPrice: 4000 }], { assetId: "aw11" }),
  w12: P("w12", "2026-11-03", "warunk Plastik", "asset", [{ itemId: "aw12", qty: 1, unitPrice: 30000 }], { assetId: "aw12" }),
  lama: { id: "lama", type: "capital", date: "2026-11-01", direction: "in", amount: 1000000 }
};
const dbKatalog = { assets: { aw3: {}, aw6: {}, aw11: {}, aw12: {} }, supplies: { susuPcs: {} } };

// Berkas cadangan versi Claude: 12 pembelian yang sama dengan ID lain (data contoh, bukan data asli).
const C = (id, date, party, kind, lines, extra) => [id, { id, type: "purchase", kind, date, party, lines, payment: "cash", by: "Afif via Claude", ...(extra || {}) }];
const ledger = Object.fromEntries([
  C("c1", "2026-11-03", "Warunk Plastik", "asset", [{ itemId: "ac1", qty: 1, unitPrice: 30000 }], { assetId: "ac1" }),
  C("c2", "2026-11-03", "Warunk Plastik", "asset", [{ itemId: "ac2", qty: 1, unitPrice: 4000 }], { assetId: "ac2" }),
  C("c3", "2026-11-03", "Sinau Print", "supply", [{ itemId: "y1", qty: 21, unitPrice: 955 }]),
  C("c4", "2026-11-03", "Sinau Print", "supply", [{ itemId: "y2", qty: 21, unitPrice: 955 }]),
  C("c5", "2026-11-03", "Sinau Print", "supply", [{ itemId: "y3", qty: 24, unitPrice: 465 }]),
  C("c6", "2026-11-03", "Sinau Print", "supply", [{ itemId: "y4", qty: 12, unitPrice: 925 }]),
  C("c7", "2026-11-03", "Warunk Plastik", "asset", [{ itemId: "ac7", qty: 1, unitPrice: 11000 }], { assetId: "ac7" }),
  C("c8", "2026-11-03", "Toko bahan kue Hasannudinn", "supply", [{ itemId: "sup_susudiamond", qty: 2000, unitPrice: 19.25, mode: "pack", packQty: 2, packPrice: 19250, packSize: 1000 }]),
  C("c9", "2026-11-03", "Sinau Print", "supply", [{ itemId: "y5", qty: 12, unitPrice: 925 }]),
  C("c10", "2026-11-03", "Warunk Plastik", "asset", [{ itemId: "ac10", qty: 1, unitPrice: 5000 }], { assetId: "ac10" }),
  C("c11", "2026-11-03", "Sinau Print", "supply", [{ itemId: "y6", qty: 21, unitPrice: 955 }]),
  C("c12", "2026-11-04", "Pak Dono", "greenbean", [{ itemId: "gb_arabicacofermentmango", qty: 10000, unitPrice: 190 }], { freight: 37000 })
]);
const katalogClaude = { assets: { ac1: {}, ac2: {}, ac7: {}, ac10: {} }, supplies: { sup_susudiamond: { id: "sup_susudiamond", unit: "ml" } } };
const baru = { id: "baru1", type: "purchase", kind: "supply", date: "2026-11-05", party: "Sinau Print", lines: [{ itemId: "x1", qty: 21, unitPrice: 955 }] };
const perBulan = { "2026-11": { ...ledger, baru1: baru, lama: db.lama } };
const d = { perBulan, katalog: { assets: katalogClaude.assets, supplies: { ...katalogClaude.supplies, itemBaru: { id: "itemBaru" } } },
  jumlahTxn: Object.keys(perBulan["2026-11"]).length };

const k = cariKembar(d, db, dbKatalog);
cek(k.txnIds.size === 12, "12 pembelian kembar terdeteksi (dapat " + k.txnIds.size + ")");
cek(!k.txnIds.has("baru1"), "transaksi baru 5 Nov tidak dianggap kembar");
cek(!k.txnIds.has("lama"), "transaksi ber-ID sama tidak dianggap kembar (memang pembaruan)");
cek(k.aset.size === 4, "4 aset dari pembelian kembar ikut dilewati");
cek(k.supplies.has("sup_susudiamond"), "item Susu Diamond (hanya dipakai pembelian kembar) dilewati");
cek(!k.supplies.has("itemBaru"), "item baru yang tidak terkait tetap diimpor");

const b = buangKembar(d, k);
cek(b.jumlahTxn === 2 && b.perBulan["2026-11"].baru1 && b.perBulan["2026-11"].lama, "yang tersisa untuk diimpor: transaksi baru + pembaruan ber-ID sama");
cek(!b.katalog.assets && b.katalog.supplies && b.katalog.supplies.itemBaru && !b.katalog.supplies.sup_susudiamond, "katalog tersisa benar");

// Hitungan: 3 nota identik di database, 4 di berkas → yang dilewati 3, yang masuk 1.
const n = (id) => ({ id, type: "purchase", kind: "supply", date: "2026-11-03", party: "Sinau Print", lines: [{ itemId: "s", qty: 21, unitPrice: 955 }] });
const k2 = cariKembar({ perBulan: { "2026-11": { a: n("a"), b: n("b"), c: n("c"), d: n("d") } }, katalog: {} },
  { x: n("x"), y: n("y"), z: n("z") }, {});
cek(k2.txnIds.size === 3, "nota identik dicocokkan per hitungan (3 dari 4 dilewati)");
cek(tandaTxn(db.w1) === tandaTxn(Object.values(ledger).find(t => t.kind === "greenbean")), "ongkir di kolom berbeda (ongkir vs biaya lain) tetap cocok");

if (gagal.length) { console.log("\n" + gagal.length + " uji GAGAL"); process.exit(1); }
console.log("\nSemua uji impor lulus.");
