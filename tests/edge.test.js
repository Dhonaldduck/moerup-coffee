const { chromium } = require('playwright');
const SP = __dirname; require('./build');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, body: '' }));
  const seed = {
    settings: {},
    greenbeans: { gb1: { id: 'gb1', name: 'Robusta', minStock: 0 } },
    supplies: {
      botol: { id: 'botol', name: 'Botol 250 ml', category: 'Kemasan', unit: 'pcs' },
      susu: { id: 'susu', name: 'Susu UHT', category: 'Susu & krimer', unit: 'ml', packSize: 1000, packName: 'kotak', refPrice: 20000 },
      aren: { id: 'aren', name: 'Gula aren', category: 'Pemanis & sirup', unit: 'ml', packSize: 1000, refPrice: 40000 }
    },
    skus: {
      ks: { id: 'ks', line: 'rtd', name: 'Kopsu Aren 250 ml', kode: 'KSA', volumeMl: 250, shelfDays: 3, price: 18000, ohPerUnit: 500, minStock: 5,
        beans: [{ greenbeanId: 'gb1', gram: 15 }], components: [{ supplyId: 'susu', qty: 150 }, { supplyId: 'aren', qty: 20 }, { supplyId: 'botol', qty: 1 }], active: true }
    },
    assets: {}, customers: {},
    txns: {
      a: { id: 'a', type: 'capital', date: '2026-10-20', seq: 1, direction: 'in', amount: 5000000 },
      b: { id: 'b', type: 'purchase', kind: 'greenbean', date: '2026-10-20', seq: 2, lines: [{ itemId: 'gb1', qty: 3000, unitPrice: 60 }], payment: 'cash' },
      // mixed purchase: botol + susu (pack) + ongkir
      c: { id: 'c', type: 'purchase', kind: 'supply', date: '2026-10-20', seq: 3, lines: [{ itemId: 'botol', qty: 50, unitPrice: 2000 }, { itemId: 'susu', qty: 6000, unitPrice: 19, mode: 'pack', packQty: 6, packPrice: 19000, packSize: 1000 }, { itemId: 'aren', qty: 1000, unitPrice: 40 }], freight: 10000, payment: 'cash' },
      d: { id: 'd', type: 'roast', date: '2026-10-21', seq: 4, greenbeanId: 'gb1', inputG: 1000, outputG: 800, profile: 'Medium' },
      // sale before production -> stok minus
      e: { id: 'e', type: 'sale', date: '2026-10-22', seq: 5, customer: 'Pre', channel: 'WhatsApp', lines: [{ skuId: 'ks', qty: 4, unitPrice: 18000 }], payment: 'cash' },
      f: { id: 'f', type: 'produce', date: '2026-10-23', seq: 6, skuId: 'ks', qty: 20, beans: [{ greenbeanId: 'gb1', src: 'd', gram: 300 }], items: [{ supplyId: 'susu', qty: 3000 }, { supplyId: 'aren', qty: 400 }, { supplyId: 'botol', qty: 20 }], ohPerUnit: 500, expDate: '2026-10-26' },
      g: { id: 'g', type: 'produce', date: '2026-10-28', seq: 7, skuId: 'ks', qty: 10, beans: [{ greenbeanId: 'gb1', src: 'K:gb1::Medium', gram: 150 }], items: [{ supplyId: 'susu', qty: 1500 }, { supplyId: 'aren', qty: 200 }, { supplyId: 'botol', qty: 10 }], ohPerUnit: 500, expDate: '2026-11-30' },
      h: { id: 'h', type: 'produce', date: '2026-10-28', seq: 8, skuId: 'ks', qty: 0, beans: [], items: [{ supplyId: 'susu', qty: 500 }], ohPerUnit: 0, expDate: '' },
      i: { id: 'i', type: 'sale', date: '2026-10-29', seq: 9, customer: 'Kafe', channel: 'WhatsApp', lines: [{ skuId: 'ks', qty: 6, unitPrice: 18000 }], payment: 'credit' },
      j: { id: 'j', type: 'waste', date: '2026-10-29', seq: 10, skuId: 'ks', qty: 2, reason: 'Sampel / promo', lotId: '' },
      k: { id: 'k', type: 'adjust', date: '2026-10-30', seq: 11, itemKind: 'fg', itemId: 'ks', qty: 17 },
      l: { id: 'l', type: 'expense', date: '2026-10-30', seq: 12, accountId: '5-9100', amount: 12000, payment: 'cash', note: 'es batu' }
    }
  };
  await page.addInitScript(s => localStorage.setItem('kitab_roastery_v1', s), JSON.stringify(seed));
  await page.goto('file://' + SP + '/test.html#/botolan');
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const bs = balanceSheet(todayISO());
    const bad = BOOKS.journal.filter(j => Math.abs(j.lines.reduce((s, l) => s + (l.dr || 0) - (l.cr || 0), 0)) > 0.01).map(j => j.desc);
    return {
      diff: bs.diff, bad, fg: BOOKS.inv.fg.ks, lots: BOOKS.fgLots.ks.map(l => [l.code, l.qty, l.sisa, l.exp]),
      batchSisa_d: batchSisa('d'), rb: BOOKS.inv.rb,
      alerts: BOOKS.alerts.map(a => a.msg),
      j: BOOKS.journal.filter(j => !['capital'].includes(j.type)).map(j => j.date + ' ' + j.desc + ' :: ' + j.lines.map(l => l.acc + (l.dr ? ' D' + Math.round(l.dr) : ' K' + Math.round(l.cr))).join(', ')),
      sup: BOOKS.inv.sup,
      stockRowsFg: stockRows().filter(x => x.kind === 'fg'),
      alloc: BOOKS.fgAlloc
    };
  });
  console.log(JSON.stringify(r, null, 1));
  await page.screenshot({ path: SP + '/shot-30-edge-botolan.png', fullPage: true });
  await page.goto('file://' + SP + '/test.html#/dashboard'); await page.waitForTimeout(300);
  await page.screenshot({ path: SP + '/shot-31-edge-dashboard.png', fullPage: true });
  // delete sku -> views still render
  await page.evaluate(() => { delete S.skus.ks; recompute(); });
  for (const h of ['botolan', 'stok', 'penjualan', 'laporan', 'master', 'dashboard', 'jurnal']) {
    await page.goto('file://' + SP + '/test.html#/' + h); await page.waitForTimeout(150);
  }
  await page.evaluate(() => { location.hash = '#/stok'; render(); });
  console.log('ERRS', JSON.stringify(errs));
  await browser.close();
})();
