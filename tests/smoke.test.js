/* Uji asap: membuka SEMUA halaman, SEMUA form, dan mengedit setiap jenis
   transaksi, lalu memeriksa neraca seimbang dan setiap jurnal debit = kredit.
   Gagal kalau ada satu saja error JavaScript. */
const { chromium } = require("playwright");
const path = require("path");
require("./build");
const SP = __dirname;

let jspdf = null;
try { jspdf = require.resolve("jspdf/dist/jspdf.umd.min.js"); } catch (e) { /* PDF dilewati */ }

const T = "2026-11-";
const seed = {
  settings: {},
  greenbeans: { gb1: { id: "gb1", name: "Robusta Petik Merah", kode: "RP", minStock: 500 }, gb2: { id: "gb2", name: "Arabica Gayo" } },
  supplies: {
    pouch: { id: "pouch", name: "Standing 250gr", category: "Valve", unit: "pcs", minStock: 5 },
    bw: { id: "bw", name: "Bubble Wrap", category: "Packing luar", unit: "meter" },
    botol: { id: "botol", name: "Botol 250 ml", category: "Kemasan", unit: "pcs" },
    stk: { id: "stk", name: "Sticker Botol Kopsu", category: "Stiker & label", unit: "pcs" },
    susu: { id: "susu", name: "Susu Diamond 1 L", category: "Susu & krimer", unit: "ml", packSize: 1000, refPrice: 19250 },
    krimer: { id: "krimer", name: "Krimer bubuk", category: "Susu & krimer", unit: "gram", packSize: 1000, refPrice: 60000 },
    air: { id: "air", name: "Air mineral galon", category: "Bahan minuman lain", unit: "ml", packSize: 19000, refPrice: 20000 }
  },
  skus: {
    sb: { id: "sb", name: "Sok Asik 250gr", price: 50000, priceOnline: 70000, beans: [{ greenbeanId: "gb1", gram: 250 }], components: [{ supplyId: "pouch", qty: 1 }], active: true },
    ks: { id: "ks", line: "rtd", name: "Kopsu Gula Aren 250 ml", kode: "KOPSUAREN", volumeMl: 250, shelfDays: 4, price: 18000, targetMargin: 60, ohPerUnit: 300, minStock: 5,
      airMl: 150, airSupplyId: "air", beans: [{ greenbeanId: "gb1", gram: 10, yieldMl: 30 }],
      components: [{ supplyId: "krimer", qty: 7.5, rasioAir: 1 }, { supplyId: "susu", qty: 40 }, { supplyId: "botol", qty: 1 }, { supplyId: "stk", qty: 1 }], active: true }
  },
  assets: { a1: { id: "a1", name: "Roaster", date: "2026-09-01", cost: 20000000, lifeMonths: 48, residual: 2000000 } },
  customers: { c1: { id: "c1", name: "Kedai Saerah", address: "Jl. Hamka 90, Semarang", phone: "0813" } },
  txns: {
    t1: { id: "t1", type: "capital", date: T + "01", seq: 1, direction: "in", amount: 30000000 },
    t2: { id: "t2", type: "purchase", kind: "greenbean", date: T + "01", seq: 2, party: "Pak Dono", lines: [{ itemId: "gb1", qty: 10000, unitPrice: 60 }, { itemId: "gb2", qty: 3000, unitPrice: 150 }], freight: 37000, payment: "credit" },
    t3: { id: "t3", type: "purchase", kind: "supply", date: T + "01", seq: 3, party: "Toko", payment: "cash", lines: [
      { itemId: "pouch", qty: 50, unitPrice: 3000 }, { itemId: "bw", qty: 20, unitPrice: 1000 }, { itemId: "botol", qty: 60, unitPrice: 2500 }, { itemId: "stk", qty: 60, unitPrice: 955 },
      { itemId: "susu", qty: 6000, unitPrice: 19.25, mode: "pack", packQty: 6, packPrice: 19250, packSize: 1000 },
      { itemId: "krimer", qty: 1000, unitPrice: 60 }, { itemId: "air", qty: 19000, unitPrice: 20000 / 19000 }] },
    t4: { id: "t4", type: "roast", date: T + "02", seq: 4, greenbeanId: "gb1", inputG: 3000, outputG: 2400, profile: "Medium-Dark" },
    t5: { id: "t5", type: "produce", date: T + "02", seq: 5, skuId: "ks", qty: 20, ohPerUnit: 300, expDate: T + "06",
      beans: [{ greenbeanId: "gb1", src: "t4", gram: 200 }], items: [{ supplyId: "krimer", qty: 150 }, { supplyId: "susu", qty: 800 }, { supplyId: "botol", qty: 20 }, { supplyId: "stk", qty: 20 }, { supplyId: "air", qty: 3750 }] },
    t6: { id: "t6", type: "sale", date: T + "03", seq: 6, customerId: "c1", customer: "Kedai Saerah", channel: "WhatsApp", payment: "credit",
      lines: [{ skuId: "sb", qty: 2, unitPrice: 50000, grind: "Medium", batches: { gb1: [{ id: "t4", gram: 500 }] } }, { skuId: "ks", qty: 10, unitPrice: 18000 }],
      packing: [{ supplyId: "bw", qty: 1 }], shippingCharged: 15000, shippingCost: 15000 },
    t7: { id: "t7", type: "sale", date: T + "03", seq: 7, customer: "Pembeli", channel: "TikTok Shop", payment: "credit", adminFee: 5000, lines: [{ skuId: "sb", qty: 1, unitPrice: 70000 }] },
    t8: { id: "t8", type: "waste", date: T + "04", seq: 8, skuId: "ks", qty: 2, reason: "Sampel / promo" },
    t9: { id: "t9", type: "qc", date: T + "04", seq: 9, batchId: "t4", rbKey: "gb1::Medium-Dark", gram: 20, purpose: "Cupping" },
    t10: { id: "t10", type: "expense", date: T + "04", seq: 10, accountId: "5-9100", amount: 12000, payment: "cash", note: "es batu" },
    t11: { id: "t11", type: "expense", date: T + "04", seq: 11, accountId: "6-1000", amount: 1500000, payment: "cash", payroll: { period: "2026-11", employees: [{ name: "Tegar", role: "Roaster", base: 1500000 }] } },
    t12: { id: "t12", type: "adjust", date: T + "05", seq: 12, itemKind: "fg", itemId: "ks", qty: 7 },
    t13: { id: "t13", type: "receivable", date: T + "05", seq: 13, targetId: "t6", amount: 100000 },
    t14: { id: "t14", type: "payable", date: T + "05", seq: 14, targetId: "t2", amount: 300000 },
    t15: { id: "t15", type: "loan", date: T + "05", seq: 15, amount: 5000000, lender: "Bank", months: 12, ratePerMonth: 1 },
    t16: { id: "t16", type: "loanpay", date: T + "05", seq: 16, loanId: "t15", principal: 416667, interest: 50000 },
    t17: { id: "t17", type: "transfer", date: T + "05", seq: 17, fromAcc: "1-1052", toAcc: "1-1000", amount: 10000 },
    t18: { id: "t18", type: "cashadj", date: T + "05", seq: 18, account: "1-1000", amount: -2000 },
    t19: { id: "t19", type: "taxpay", date: T + "05", seq: 19, amount: 1000 },
    t20: { id: "t20", type: "capital", date: T + "05", seq: 20, direction: "out", amount: 100000 }
  }
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await page.route("**/*", r => {
    const u = r.request().url();
    if (jspdf && u.includes("jspdf")) return r.fulfill({ path: jspdf, contentType: "application/javascript" });
    if (u.startsWith("file:")) return r.continue();
    return r.fulfill({ status: 200, body: "" });
  });
  await page.addInitScript(s => { localStorage.setItem("kitab_roastery_v1", s); localStorage.setItem("kitab_roastery_operator", "Uji"); }, JSON.stringify(seed));
  await page.goto("file://" + path.join(SP, "test.html") + "#/dashboard");
  await page.waitForTimeout(700);

  const hasil = await page.evaluate(async () => {
    const log = [];
    const tunggu = ms => new Promise(r => setTimeout(r, ms));
    const coba = async (nama, fn) => { try { await fn(); await tunggu(30); if (modalOpen) closeModal(); } catch (e) { log.push(nama + ": " + e.message); } };
    for (const h of ["dashboard","roasting","botolan","penjualan","pembelian","biaya","utang","stok","master","laporan","rasio","jurnal","pengaturan"]) {
      await coba("halaman " + h, () => { location.hash = "#/" + h; render(); });
    }
    for (const t of ["sku","gb","bb","sup","aset","cust"]) await coba("master " + t, () => { masterTab = t; location.hash = "#/master"; render(); });
    for (const t of ["all","gb","rb","bb","sup","fg"]) await coba("stok " + t, () => { stockFilter = t; location.hash = "#/stok"; render(); });
    for (const t of ["pl","bs","cf","sales","tax"]) await coba("laporan " + t, () => { repTab = t; location.hash = "#/laporan"; render(); });
    for (const t of ["jurnal","ledger","trial"]) await coba("jurnal " + t, () => { jTab = t; location.hash = "#/jurnal"; render(); });
    const forms = {
      quickPick: () => quickPick(), roast: () => formRoast(), sale: () => formSale(), produce: () => formProduce(), waste: () => formWaste(),
      purchaseGB: () => formPurchase("greenbean"), purchaseSup: () => formPurchase("supply"), purchaseBahan: () => formPurchase("supply", null, { minuman: true }),
      purchaseAset: () => formPurchase("asset"), expense: () => formExpense(), payroll: () => formPayroll(), cashadj: () => formCashAdj(),
      capital: () => formCapital(), transfer: () => formTransfer(), qc: () => formQC(), loan: () => formLoan(), pin: () => formPIN(),
      sku: () => formSku(S.skus.sb), skuBaru: () => formSku(), skuRTD: () => formSkuRTD(S.skus.ks), skuRTDBaru: () => formSkuRTD(),
      supply: () => formSupply(S.supplies.susu), supplyBaru: () => formSupply(null, { minuman: true }), gb: () => formGreenBean(S.greenbeans.gb1),
      customer: () => formCustomer(S.customers.c1), adjustFg: () => formAdjust("fg", "ks"), adjustSup: () => formAdjust("sup", "susu")
    };
    for (const [n, f] of Object.entries(forms)) await coba("form " + n, f);
    for (const t of Object.values(S.txns)) await coba("ubah " + t.type + " " + t.id, () => editTxn(t));
    const bs = balanceSheet(todayISO());
    const timpang = BOOKS.journal.filter(j => Math.abs(j.lines.reduce((s, l) => s + (l.dr || 0) - (l.cr || 0), 0)) > 0.01).map(j => j.desc);
    return { log, diff: bs.diff, timpang, alerts: BOOKS.alerts.map(a => a.msg), fg: BOOKS.inv.fg.ks, jurnal: BOOKS.journal.length };
  });

  let pdf = "dilewati (jspdf tidak terpasang)";
  if (jspdf) {
    await page.waitForTimeout(500);
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }).catch(() => null),
      page.evaluate(() => invoicePDF(S.txns.t6, { previewNo: "UJI/001" }))]);
    pdf = dl ? "invoice terunduh" : "GAGAL";
    if (!dl) hasil.log.push("invoice PDF tidak terunduh");
  }

  console.log("Jurnal:", hasil.jurnal, "· selisih neraca:", Math.round(hasil.diff), "· stok botol jadi:", hasil.fg && hasil.fg.qty, "· PDF:", pdf);
  console.log("Peringatan stok:", hasil.alerts.length ? hasil.alerts.join(" | ") : "tidak ada");
  const salah = hasil.log.concat(hasil.timpang.map(x => "jurnal timpang: " + x), Math.abs(hasil.diff) > 0.5 ? ["neraca selisih " + hasil.diff] : [], errs);
  await browser.close();
  if (salah.length) { console.log("GAGAL:\n  " + salah.join("\n  ")); process.exit(1); }
  console.log("Semua halaman, form, dan edit transaksi lulus.");
})().catch(e => { console.error(e); process.exit(1); });
