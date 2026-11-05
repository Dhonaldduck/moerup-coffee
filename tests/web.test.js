/* Uji versi web (index.html hasil tools/build-web.js) tanpa Firebase sungguhan.
   js/kitab-firebase.js diganti tiruan yang menyediakan API database yang sama
   (doc/collection, get/set/update/delete/onSnapshot) di memori.
   Yang diuji:
   1. Aplikasi menunggu __kitabSiap, lalu berjalan dalam mode cloud.
   2. Simpanan sampai ke "database" tiruan, item lain tidak tertimpa.
   3. Konversi satuan pcs → ml pada item yang sudah punya riwayat.
   4. Berkas penghubung gagal dimuat → pesan galat, bukan "Memuat…" selamanya.
   5. Firebase belum dikonfigurasi → mode contoh dengan banner yang benar. */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const AKAR = path.join(__dirname, "..");
execFileSync(process.execPath, [path.join(AKAR, "tools", "build-web.js")], { stdio: "inherit" });

const TIPE = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const p = path.join(AKAR, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(AKAR) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TIPE[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});

const TIRUAN = `
window.__kitabModulSiap = true;
const docs = window.__seedFs || {};
window.__fakeDocs = docs;
const pend = [];
const salin = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const bungkus = p => ({ id: p.split("/").pop(), exists: p in docs, data: () => salin(docs[p]), metadata: { fromCache: false, hasPendingWrites: false } });
const anak = c => Object.keys(docs).filter(p => p.startsWith(c + "/") && p.split("/").length === c.split("/").length + 1);
function kabari() { pend.forEach(l => l()); }
function refDok(p) {
  return {
    id: p.split("/").pop(), path: p,
    get: async () => bungkus(p),
    set: async d => { docs[p] = salin(d); kabari(); },
    update: async d => { const cur = docs[p] || (docs[p] = {});
      for (const [k, v] of Object.entries(salin(d))) {
        if (v && typeof v === "object" && !Array.isArray(v)) { cur[k] = cur[k] || {}; for (const id of Object.keys(v)) cur[k][id] = v[id]; }
        else cur[k] = v; }
      kabari(); },
    delete: async () => { delete docs[p]; kabari(); },
    onSnapshot: next => { const l = () => next(bungkus(p)); pend.push(l); l(); return () => {}; },
    collection: c => refKoleksi(p + "/" + c)
  };
}
function refKoleksi(c) {
  const kueri = () => { const d = anak(c).map(bungkus); return { docs: d, size: d.length, empty: !d.length, docChanges: () => [] }; };
  return { path: c, doc: id => refDok(c + "/" + id), get: async () => kueri(),
    onSnapshot: next => { const l = () => next(kueri()); pend.push(l); l(); return () => {}; } };
}
setTimeout(() => window.__kitabSiap(window.__mode === "demo" ? {} : { db: { doc: refDok, collection: refKoleksi } }), 50);
`;

const seed = {
  "master/settings": { bizName: "Moerup Coffee Roastery" },
  "master/catalog": {
    greenbeans: { gb1: { id: "gb1", name: "Robusta" } },
    supplies: {
      susu: { id: "susu", name: "susu Diamond APM", category: "Bahan lain", unit: "pcs", minStock: 1 },
      botol: { id: "botol", name: "Botol 250 ml", category: "Kemasan", unit: "pcs" }
    },
    skus: {}, assets: {}, customers: {}
  },
  "ledger/2026-11": { txns: {
    m1: { id: "m1", type: "capital", date: "2026-11-01", seq: 1, direction: "in", amount: 1000000, by: "Tegar" },
    p1: { id: "p1", type: "purchase", kind: "supply", date: "2026-11-03", seq: 2, party: "Toko bahan kue",
          lines: [{ itemId: "susu", qty: 2, unitPrice: 19250 }, { itemId: "botol", qty: 20, unitPrice: 2500 }], payment: "cash", account: "1-1000" },
    a1: { id: "a1", type: "adjust", date: "2026-11-03", seq: 3, itemKind: "sup", itemId: "susu", qty: 2 }
  } }
};

(async () => {
  await new Promise(r => server.listen(0, r));
  const URLD = "http://127.0.0.1:" + server.address().port + "/index.html";
  const browser = await chromium.launch();
  const gagal = [];
  const cek = (ok, pesan) => { console.log((ok ? "  ok   " : "  GAGAL ") + pesan); if (!ok) gagal.push(pesan); };

  async function halaman(mode) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = []; page.on("pageerror", e => errs.push(e.message));
    await page.route("**/*", r => {
      const u = r.request().url();
      if (u.includes("/js/kitab-firebase.js")) return mode === "404" ? r.fulfill({ status: 404, body: "" })
        : r.fulfill({ status: 200, contentType: "text/javascript", body: TIRUAN });
      if (u.startsWith("http://127.0.0.1")) return r.continue();
      return r.fulfill({ status: 200, body: "" });     // font, jsPDF: tidak perlu untuk uji ini
    });
    await page.addInitScript(([s, m]) => { window.__seedFs = s; window.__mode = m; localStorage.setItem("kitab_roastery_operator", "Uji"); }, [seed, mode]);
    await page.goto(URLD + "#/master");
    await page.waitForTimeout(700);
    return { page, errs };
  }

  console.log("1–3. Mode cloud dengan database tiruan");
  {
    const { page, errs } = await halaman("cloud");
    cek(await page.evaluate(() => Store.mode === "cloud"), "aplikasi berjalan dalam mode cloud");
    cek(await page.evaluate(() => document.getElementById("modeBanner").hidden), "tidak ada banner peringatan");
    cek(await page.evaluate(() => Object.keys(S.txns).length === 3), "3 transaksi dari database termuat");
    const awal = await page.evaluate(() => { const b = balanceSheet(todayISO()); return { aset: b.assets, sup: b.invSup + b.invBb }; });
    // konversi lewat form
    await page.click('.seg button:has-text("Kemasan")');
    await page.locator("tr", { hasText: "susu Diamond" }).locator('button:has-text("Ubah")').click();
    await page.waitForTimeout(150);
    const m = page.locator(".modal");
    cek(await m.locator(".warnbox").first().isHidden(), "kotak konversi tersembunyi sebelum satuan diganti");
    await m.locator('label.f:has-text("Kategori") select').selectOption("Susu & krimer");
    await m.locator('label.f:has-text("Satuan") select').selectOption("ml");
    await m.locator('label.f:has-text("Isi per kemasan") input').fill("1.000");
    await page.waitForTimeout(100);
    cek(await m.locator('.warnbox:has-text("Satuan diganti dari pcs ke ml")').isVisible(), "kotak konversi muncul saat pcs → ml");
    cek(await m.locator(".calc:has-text('Dicatat sebagai pembelian')").isHidden(), "isian pembelian tersembunyi saat jumlah dibeli kosong");
    await page.screenshot({ path: path.join(__dirname, "web-konversi.png") });
    await page.click('.modal-f button:has-text("Simpan")');
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const b = balanceSheet(todayISO()); const d = window.__fakeDocs;
      return { aset: b.assets, sup: b.invSup + b.invBb, diff: b.diff, stok: BOOKS.inv.sup.susu,
        line: d["ledger/2026-11"].txns.p1.lines[0], botol: d["ledger/2026-11"].txns.p1.lines[1],
        adj: d["ledger/2026-11"].txns.a1.qty, cap: d["ledger/2026-11"].txns.m1, item: d["master/catalog"].supplies.susu,
        botolItem: d["master/catalog"].supplies.botol };
    });
    cek(Math.abs(r.stok.qty - 2000) < 1e-6 && Math.abs(r.stok.val - 38500) < 0.5, "stok susu jadi 2.000 ml senilai Rp 38.500");
    cek(r.line.qty === 2000 && Math.abs(r.line.unitPrice - 19.25) < 1e-9 && r.line.packQty === 2 && r.line.packPrice === 19250, "baris pembelian lama: 2 pcs × Rp 19.250 = 2.000 ml × Rp 19,25");
    cek(r.botol.qty === 20 && r.botol.unitPrice === 2500, "baris botol di nota yang sama tidak berubah");
    cek(r.adj === 2000, "opname lama ikut dikonversi");
    cek(r.cap && r.cap.by === "Tegar", "transaksi lain tidak tertimpa");
    cek(r.item.unit === "ml" && r.item.minStock === 1000 && r.item.category === "Susu & krimer", "item tersimpan: ml, minimum 1.000 ml");
    cek(Math.abs(r.aset - awal.aset) < 0.5 && Math.abs(r.sup - awal.sup) < 0.5 && Math.abs(r.diff) < 0.5, "nilai aset & persediaan tidak berubah, neraca seimbang");
    cek(!!r.botolItem && r.botolItem.unit === "pcs", "item katalog lain tetap ada");
    // halaman utama tetap jalan
    for (const h of ["dashboard", "botolan", "penjualan", "pembelian", "stok", "laporan", "jurnal", "rasio", "pengaturan"]) {
      await page.evaluate(x => { location.hash = "#/" + x; }, h); await page.waitForTimeout(120);
    }
    cek(!errs.length, "tanpa error JavaScript" + (errs.length ? ": " + errs.join(" | ") : ""));
    await page.close();
  }

  console.log("4. Penghubung gagal dimuat");
  {
    const { page } = await halaman("404");
    await page.waitForTimeout(300);
    cek(await page.locator("text=Tidak bisa memuat penghubung database").isVisible(), "pesan galat tampil, tidak macet di 'Memuat…'");
    await page.close();
  }

  console.log("5. Firebase belum dikonfigurasi (mode contoh)");
  {
    const { page } = await halaman("demo");
    cek(await page.evaluate(() => Store.mode === "lokal"), "aplikasi berjalan lokal");
    cek(await page.locator("#modeBanner:has-text('Mode contoh')").isVisible(), "banner mode contoh tampil (bukan petunjuk akun Claude)");
    await page.close();
  }

  await browser.close(); server.close();
  if (gagal.length) { console.log("\n" + gagal.length + " uji GAGAL"); process.exit(1); }
  console.log("\nSemua uji versi web lulus.");
})().catch(e => { console.error(e); server.close(); process.exit(1); });
