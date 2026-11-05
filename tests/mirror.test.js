/* Uji impor cadangan "samakan persis" (Pengaturan → Impor cadangan).
   Data contoh, bukan data asli. Skenario meniru kasus nyata:
   - database berisi pembelian kembar (ID lain) + biaya yang sudah dihapus di sumber;
   - berkas berisi versi yang benar (+1 transaksi baru, 1 transaksi diubah).
   Setelah impor, isi database harus SAMA dengan berkas, kecuali transaksi yang
   sengaja dipertahankan (centang dihilangkan) beserta data master yang dipakainya.
   Diuji di versi web (Firebase tiruan, termasuk balapan snapshot) dan versi artifact. */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
require("./build");

const AKAR = path.join(__dirname, "..");
execFileSync(process.execPath, [path.join(AKAR, "tools", "build-web.js")], { stdio: "inherit" });
const TIRUAN = fs.readFileSync(path.join(__dirname, "web.test.js"), "utf8").match(/const TIRUAN = `([\s\S]*?)`;/)[1];

const T = "2026-11-";
const P = (id, seq, party, kind, lines, extra) => ({ id, type: "purchase", kind, date: T + "03", seq, party, lines, payment: "cash", account: "1-1000", ...(extra || {}) });
const susu = { id: "susu", name: "Susu Diamond 1 L", category: "Susu & krimer", unit: "ml", packSize: 1000 };
const botol = { id: "botol", name: "Botol 250 ml", category: "Kemasan", unit: "pcs" };
const asetDup = { id: "aDup", name: "Toples (kembar)", date: T + "03", cost: 30000, lifeMonths: 12, residual: 0 };
const asetKeep = { id: "aKeep", name: "Timbangan", date: T + "03", cost: 4000, lifeMonths: 12, residual: 0 };
const txn = {
  m1: { id: "m1", type: "capital", date: T + "01", seq: 1, direction: "in", amount: 1000000, account: "1-1000" },
  p1: P("p1", 2, "Toko bahan kue", "supply", [{ itemId: "susu", qty: 2000, unitPrice: 19.25, mode: "pack", packQty: 2, packPrice: 19250, packSize: 1000 }]),
  pDup: P("pDup", 3, "Warunk Plastik", "asset", [{ itemId: "aDup", qty: 1, unitPrice: 30000 }], { assetId: "aDup", assetName: "Toples (kembar)", lifeMonths: 12, residual: 0 }),
  pKeep: P("pKeep", 4, "Toko Timbangan", "asset", [{ itemId: "aKeep", qty: 1, unitPrice: 4000 }], { assetId: "aKeep", assetName: "Timbangan", lifeMonths: 12, residual: 0 }),
  x1: { id: "x1", type: "expense", date: T + "04", seq: 5, accountId: "6-1900", amount: 281000, payment: "cash", account: "1-1000", note: "Biaya lain (sudah dihapus di sumber)" },
  e1: { id: "e1", type: "expense", date: T + "04", seq: 6, accountId: "6-1900", amount: 10000, payment: "cash", account: "1-1000", note: "Parkir" }
};
const KINI = { settings: { bizName: "Moerup Coffee Roastery" }, greenbeans: {}, supplies: { susu }, skus: {},
  assets: { aDup: asetDup, aKeep: asetKeep }, customers: {}, txns: txn };
const BERKAS = { settings: { bizName: "Moerup Coffee Roastery" }, greenbeans: {}, supplies: { susu, botol }, skus: {}, assets: {}, customers: {},
  txns: { m1: txn.m1, p1: txn.p1, e1: { ...txn.e1, amount: 12000 },
          n1: { id: "n1", type: "capital", date: T + "05", seq: 7, direction: "in", amount: 500000, account: "1-1000" } } };
const BERKAS_PATH = path.join(__dirname, "cermin-contoh.json");
fs.writeFileSync(BERKAS_PATH, JSON.stringify(BERKAS));
// kas = 1.000.000 + 500.000 − 38.500 − 12.000 − 4.000 (timbangan dipertahankan)
const KAS_HARAPAN = 1445500;

const seedFs = { "master/settings": KINI.settings,
  "master/catalog": { greenbeans: {}, supplies: KINI.supplies, skus: {}, assets: KINI.assets, customers: {} },
  "ledger/2026-11": { txns: KINI.txns } };

const TIPE = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const p = path.join(AKAR, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(AKAR) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TIPE[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const browser = await chromium.launch();
  const gagal = [];
  const cek = (ok, pesan) => { console.log((ok ? "  ok   " : "  GAGAL ") + pesan); if (!ok) gagal.push(pesan); };

  async function jalankan(page, errs, label) {
    await page.evaluate(() => { location.hash = "#/pengaturan"; }); await page.waitForTimeout(250);
    const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.click('button:has-text("Impor cadangan")')]);
    await fc.setFiles(BERKAS_PATH); await page.waitForTimeout(300);
    const m = page.locator(".modal");
    const ringkas = await m.locator(".calc").innerText();
    cek(/Ditambahkan\s*1/.test(ringkas) && /Diperbarui\s*1/.test(ringkas) && /Dihapus[^\n]*\n?\s*3/.test(ringkas), label + ": pratinjau +1 · ~1 · −3");
    cek(await m.locator(".warnbox", { hasText: "aset" }).isVisible(), label + ": peringatan data master yang ikut dihapus tampil");
    // pertahankan pembelian timbangan
    await m.locator("tbody tr", { hasText: "Toko Timbangan" }).locator("input[type=checkbox]").uncheck();
    cek(/Dipertahankan\s*1/.test(await m.locator(".calc").innerText()), label + ": hitungan 'Dipertahankan 1' diperbarui");
    await m.locator('label:has-text("Unduh cadangan") input').uncheck();
    await page.click('.modal-f button:has-text("Samakan sekarang")');
    await page.waitForFunction(() => /Data sudah sama|belum tersimpan/.test((document.querySelector(".toast") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => { const b = balanceSheet(todayISO());
      return { kas: Math.round(b.cash), diff: Math.round(b.diff), ids: Object.keys(S.txns).sort(), e1: S.txns.e1.amount,
        aset: Object.keys(S.assets).sort(), sup: Object.keys(S.supplies).sort() }; });
    cek(r.ids.join() === "e1,m1,n1,p1,pKeep", label + ": transaksi = isi berkas + yang dipertahankan (" + r.ids.join() + ")");
    cek(r.e1 === 12000, label + ": transaksi yang berubah ikut diperbarui");
    cek(r.aset.join() === "aKeep", label + ": aset kembar terhapus, aset milik transaksi yang dipertahankan tetap ada");
    cek(r.sup.join() === "botol,susu", label + ": kemasan & bahan sama dengan berkas");
    cek(r.kas === KAS_HARAPAN && r.diff === 0, label + ": kas Rp " + r.kas.toLocaleString("id-ID") + " (harapan " + KAS_HARAPAN.toLocaleString("id-ID") + "), neraca seimbang");
    cek(!errs.length, label + ": tanpa error JavaScript " + (errs.length ? JSON.stringify(errs) : ""));
  }

  console.log("1. Versi web (Firebase tiruan)");
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = []; page.on("pageerror", e => errs.push(e.message));
    await page.route("**/*", r => { const u = r.request().url();
      if (u.includes("/js/kitab-firebase.js")) return r.fulfill({ status: 200, contentType: "text/javascript", body: TIRUAN });
      if (u.startsWith("http://127.0.0.1")) return r.continue();
      return r.fulfill({ status: 200, body: "" }); });
    await page.addInitScript(s => { window.__seedFs = s; window.__mode = "cloud"; localStorage.setItem("kitab_roastery_operator", "Uji"); }, seedFs);
    await page.goto("http://127.0.0.1:" + server.address().port + "/index.html#/dashboard"); await page.waitForTimeout(700);
    await jalankan(page, errs, "web");
    // yang benar-benar tersimpan di database (bukan hanya di layar)
    const d = await page.evaluate(() => window.__fakeDocs);
    const ids = Object.keys(d).filter(k => k.startsWith("ledger/")).flatMap(k => Object.keys(d[k].txns || {})).sort();
    cek(ids.join() === "e1,m1,n1,p1,pKeep", "web: isi database tersimpan sama (" + ids.join() + ")");
    cek(Object.keys(d["master/catalog"].assets).join() === "aKeep", "web: katalog di database tidak dikembalikan snapshot lama");
    await page.close();
  }

  console.log("2. Versi artifact (penyimpanan lokal)");
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = []; page.on("pageerror", e => errs.push(e.message));
    await page.goto("file://" + path.join(__dirname, "test.html") + "#/dashboard"); await page.waitForTimeout(500);
    await page.evaluate(async k => { S = JSON.parse(JSON.stringify(k)); for (const t of Object.values(S.txns)) await Store.putTxn(t);
      await Store.saveCatalog(); await Store.saveSettings(); recompute(); render(); }, KINI);
    await jalankan(page, errs, "artifact");
    await page.close();
  }

  await browser.close(); server.close();
  try { fs.unlinkSync(BERKAS_PATH); } catch (e) {}
  if (gagal.length) { console.log("\n" + gagal.length + " uji GAGAL"); process.exit(1); }
  console.log("\nSemua uji impor-samakan lulus.");
})().catch(e => { console.error(e); process.exit(1); });
