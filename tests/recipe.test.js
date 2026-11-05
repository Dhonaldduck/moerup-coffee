const { chromium } = require('playwright');
const SP = __dirname; require('./build');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, body: '' }));
  const sup = (id, name, category, unit, packSize, refPrice) => ({ id, name, category, unit, packSize, refPrice, minStock: 0 });
  const seed = { settings: {}, greenbeans: { gb1: { id: 'gb1', name: 'Robusta Petik Merah' } },
    supplies: {
      susu: sup('susu', 'Susu Diamond APM 1 L', 'Susu & krimer', 'ml', 1000, 19250),
      krimer: sup('krimer', 'Krimer bubuk', 'Susu & krimer', 'gram', 1000, 60000),
      aren: sup('aren', 'Gula aren cair', 'Pemanis & sirup', 'ml', 1000, 45000),
      coklat: sup('coklat', 'Bubuk cokelat', 'Cokelat & perisa', 'gram', 1000, 85000),
      air: sup('air', 'Air mineral galon', 'Bahan minuman lain', 'ml', 19000, 20000),
      botol: sup('botol', 'Botol 250 ml', 'Kemasan', 'pcs', 1, 2500),
      stk: sup('stk', 'Sticker Botol Kopsu Gula Aren', 'Stiker & label', 'pcs', 1, 955)
    },
    skus: { old: { id: 'old', line: 'rtd', name: 'Resep lama', volumeMl: 250, shelfDays: 3, price: 18000, beans: [{ greenbeanId: 'gb1', gram: 15 }], components: [{ supplyId: 'susu', qty: 150 }, { supplyId: 'botol', qty: 1 }], active: true } },
    assets: {}, customers: {},
    txns: {
      a: { id: 'a', type: 'capital', date: '2026-11-01', seq: 1, direction: 'in', amount: 3000000 },
      b: { id: 'b', type: 'purchase', kind: 'greenbean', date: '2026-11-01', seq: 2, lines: [{ itemId: 'gb1', qty: 3000, unitPrice: 60 }], payment: 'cash' },
      c: { id: 'c', type: 'roast', date: '2026-11-02', seq: 3, greenbeanId: 'gb1', inputG: 1000, outputG: 800, profile: 'Medium' },
      d: { id: 'd', type: 'purchase', kind: 'supply', date: '2026-11-02', seq: 4, lines: [
        { itemId: 'krimer', qty: 1000, unitPrice: 60 }, { itemId: 'aren', qty: 2000, unitPrice: 45 }, { itemId: 'air', qty: 19000, unitPrice: 20000 / 19000 },
        { itemId: 'botol', qty: 50, unitPrice: 2500 }, { itemId: 'stk', qty: 21, unitPrice: 955 }, { itemId: 'coklat', qty: 1000, unitPrice: 85 }], payment: 'cash' }
    } };
  await page.addInitScript(s => localStorage.setItem('kitab_roastery_v1', s), JSON.stringify(seed));
  await page.goto('file://' + SP + '/test.html#/botolan');
  await page.waitForTimeout(500);
  await page.evaluate(() => formSkuRTD());
  await page.waitForTimeout(200);
  const m = page.locator('.modal');
  await m.locator('label.f:has-text("Nama produk") input').fill('Kopi Susu Gula Aren 250 ml');
  await m.locator('label.f:has-text("Kode batch") input').fill('KSA');
  // kopi row: takaran 10, hasil 30 (defaults) — verify
  const kopi = m.locator('.rcp').first();
  await kopi.locator('label:has-text("Kopi") input').fill('10');
  await kopi.locator('label:has-text("Hasil espresso") input').fill('30');
  // bahan: krimer 7,5 dicairkan 1:1
  await m.locator('button:has-text("+ Tambah bahan")').click(); await page.waitForTimeout(80);
  let rows = m.locator('.rcp-sec:has(> .eyebrow:has-text("Bahan minuman")) .rcp');
  await rows.nth(0).locator('select').selectOption('krimer'); await page.waitForTimeout(80);
  rows = m.locator('.rcp-sec:has(> .eyebrow:has-text("Bahan minuman")) .rcp');
  await rows.nth(0).locator('label:has-text("Takaran") input').fill('7,5');
  await rows.nth(0).locator('input[type=checkbox]').check(); await page.waitForTimeout(80);
  rows = m.locator('.rcp-sec:has(> .eyebrow:has-text("Bahan minuman")) .rcp');
  await rows.nth(0).locator('label:has-text("air 1 :") input').fill('1');
  // gula aren 25 ml
  await m.locator('button:has-text("+ Tambah bahan")').click(); await page.waitForTimeout(80);
  rows = m.locator('.rcp-sec:has(> .eyebrow:has-text("Bahan minuman")) .rcp');
  await rows.nth(1).locator('select').selectOption('aren'); await page.waitForTimeout(80);
  rows = m.locator('.rcp-sec:has(> .eyebrow:has-text("Bahan minuman")) .rcp');
  await rows.nth(1).locator('label:has-text("Takaran") input').fill('25');
  // air biasa 150
  await m.locator('label:has-text("Air biasa") input').fill('150');
  // stiker
  await m.locator('button:has-text("+ Tambah kemasan")').click(); await page.waitForTimeout(100);
  await page.screenshot({ path: SP + '/shot-50-resep-atas.png' });
  await page.evaluate(() => document.querySelector('.modal-b').scrollTop = 520);
  await page.screenshot({ path: SP + '/shot-51-resep-tengah.png' }); await page.evaluate(() => document.querySelector('.modal-b').scrollTop = 1250); await page.screenshot({ path: SP + '/shot-51b-hpp.png' });
  await page.evaluate(() => document.querySelector('.modal-b').scrollTop = 99999);
  await page.screenshot({ path: SP + '/shot-52-resep-bawah.png' });
  await page.click('.modal-f button:has-text("Simpan")'); await page.waitForTimeout(250);
  const sku = await page.evaluate(() => { const s = Object.values(S.skus).find(x => x.name.startsWith('Kopi Susu')); return { s, cost: rtdRecipeCost(s), vol: rtdVolume(s), use: rtdUsage(s) }; });
  console.log(JSON.stringify(sku, null, 1));
  // reopen to check values persisted
  await page.evaluate(() => formSkuRTD(Object.values(S.skus).find(x => x.name.startsWith('Kopi Susu'))));
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('.modal-b').scrollTop = 300);
  await page.screenshot({ path: SP + '/shot-53-resep-buka-ulang.png' });
  await page.evaluate(() => closeModal());
  // production 20
  await page.evaluate(() => formProduce(null, { skuId: Object.values(S.skus).find(x => x.name.startsWith('Kopi Susu')).id }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: SP + '/shot-54-produksi.png' });
  await page.click('.modal-f button:has-text("Simpan produksi")'); await page.waitForTimeout(250);
  // old recipe production still works
  await page.evaluate(() => formProduce(null, { skuId: 'old' })); await page.waitForTimeout(150);
  await page.click('.modal-f button:has-text("Simpan produksi")'); await page.waitForTimeout(250);
  const r = await page.evaluate(() => {
    const bs = balanceSheet(todayISO());
    return { diff: bs.diff, prods: BOOKS.productions.map(p => [p.name, p.qty, Math.round(p.total), Math.round(p.perBotol), p.pakai.map(x => x.name + ':' + x.qty).join(', ')]),
      inv: Object.fromEntries(Object.entries(BOOKS.inv.sup).map(([k, b]) => [k, b.qty])) };
  });
  console.log(JSON.stringify(r, null, 1));
  // mobile + dark
  const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  await mp.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, body: '' }));
  await mp.addInitScript(s => localStorage.setItem('kitab_roastery_v1', s), JSON.stringify(seed));
  await mp.goto('file://' + SP + '/test.html#/botolan'); await mp.waitForTimeout(400);
  await mp.evaluate(() => { const s = S.skus.old; s.components = [{ supplyId: 'krimer', qty: 7.5, rasioAir: 1 }, { supplyId: 'aren', qty: 25 }, { supplyId: 'botol', qty: 1 }]; s.beans = [{ greenbeanId: 'gb1', gram: 10, yieldMl: 30 }]; s.airMl = 150; s.airSupplyId = 'air'; formSkuRTD(s); });
  await mp.waitForTimeout(200);
  await mp.evaluate(() => document.querySelector('.modal-b').scrollTop = 330);
  await mp.screenshot({ path: SP + '/shot-55-mobile-resep.png' });
  console.log('mobile sw', await mp.evaluate(() => document.querySelector('.modal-b').scrollWidth + '/' + document.querySelector('.modal-b').clientWidth));
  console.log('ERRS', JSON.stringify(errs));
  await browser.close();
})();
