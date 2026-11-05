const { chromium } = require('playwright');
const SP = __dirname; require('./build');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, body: '' }));
  const seed = { settings: {}, greenbeans: {}, supplies: {
      susu: { id: 'susu', name: 'Susu Diamond APM 1 L', category: 'Susu & krimer', unit: 'ml', minStock: 0, packSize: 1000, packName: 'kotak 1 L', refPrice: 19250 } },
    skus: {}, assets: {}, customers: {},
    txns: { a: { id: 'a', type: 'capital', date: '2026-11-01', seq: 1, direction: 'in', amount: 1000000 },
      p: { id: 'p', type: 'purchase', kind: 'supply', date: '2026-11-03', seq: 2, lines: [{ itemId: 'susu', qty: 2000, unitPrice: 19.25, mode: 'pack', packQty: 2, packPrice: 19250, packSize: 1000 }], payment: 'cash', account: '1-1000' } } };
  await page.addInitScript(s => localStorage.setItem('kitab_roastery_v1', s), JSON.stringify(seed));
  await page.goto('file://' + SP + '/test.html#/master');
  await page.waitForTimeout(500);
  await page.click('.seg button:has-text("Bahan minuman")');
  await page.waitForTimeout(150);
  // 1) edit existing: set min stock 1.000 ml, save without jumlah
  await page.locator('tr', { hasText: 'Susu Diamond' }).locator('button:has-text("Ubah")').click();
  await page.waitForTimeout(150);
  const m = page.locator('.modal');
  await m.locator('label.f:has-text("Batas stok minimum") input').fill('1.000');
  await page.waitForTimeout(100);
  await page.screenshot({ path: SP + '/shot-40-edit-bahan.png' });
  await page.click('.modal-f button:has-text("Simpan")'); await page.waitForTimeout(250);
  // 2) edit again: add new purchase 3 pcs
  await page.locator('tr', { hasText: 'Susu Diamond' }).locator('button:has-text("Ubah")').click();
  await page.waitForTimeout(150);
  await m.locator('label.f:has-text("Jumlah dibeli") input').fill('3');
  await m.locator('label.f:has-text("Harga per kemasan") input').fill('20.000');
  await m.locator('label.f:has-text("Supplier") input').fill('Toko bahan kue');
  await page.waitForTimeout(100);
  await page.screenshot({ path: SP + '/shot-41-beli-dari-bahan.png' });
  await page.evaluate(() => document.querySelector('.modal-b').scrollTop = 9999);
  await page.screenshot({ path: SP + '/shot-42-beli-dari-bahan-bawah.png' });
  await page.click('.modal-f button:has-text("Simpan")'); await page.waitForTimeout(250);
  // 3) new bahan with purchase, tempo
  await page.click('button:has-text("+ Tambah bahan")'); await page.waitForTimeout(150);
  await m.locator('label.f:has-text("Nama") input').first().fill('Gula aren cair');
  await m.locator('label.f:has-text("Kategori") select').selectOption('Pemanis & sirup');
  await m.locator('label.f:has-text("Jumlah dibeli") input').fill('2');
  await m.locator('label.f:has-text("Harga per kemasan") input').fill('45.000');
  await m.locator('button:has-text("Tempo")').click();
  await page.waitForTimeout(100);
  await page.screenshot({ path: SP + '/shot-43-bahan-baru.png' });
  await page.click('.modal-f button:has-text("Simpan")'); await page.waitForTimeout(250);
  // 4) new bahan without purchase
  await page.click('button:has-text("+ Tambah bahan")'); await page.waitForTimeout(150);
  await m.locator('label.f:has-text("Nama") input').first().fill('Bubuk cokelat');
  await m.locator('label.f:has-text("Kategori") select').selectOption('Cokelat & perisa');
  await m.locator('label.f:has-text("Satuan") select').selectOption('gram');
  await m.locator('label.f:has-text("Harga per kemasan") input').fill('85.000');
  await page.click('.modal-f button:has-text("Simpan")'); await page.waitForTimeout(250);
  await page.screenshot({ path: SP + '/shot-44-tabel-bahan.png' });
  const r = await page.evaluate(() => {
    const bs = balanceSheet(todayISO());
    return { diff: bs.diff, invBb: bs.invBb, ap: bs.ap, cash: bs.cash,
      purchases: Object.values(S.txns).filter(t => t.type === 'purchase').map(t => [t.date, t.party, t.payment, JSON.stringify(t.lines)]),
      sup: Object.values(S.supplies).map(x => [x.name, x.unit, x.packSize, x.refPrice, x.minStock, (BOOKS.inv.sup[x.id] || {}).qty]) };
  });
  console.log(JSON.stringify(r, null, 1));
  console.log('ERRS', JSON.stringify(errs));
  await browser.close();
})();
