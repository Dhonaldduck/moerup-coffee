// Membangun tests/test.html dari ../moerapp.html (sumber artifact tanpa kerangka
// <html>), supaya bisa dibuka Playwright lewat file://. Dipanggil otomatis oleh
// setiap *.test.js.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'moerapp.html'), 'utf8');
const html = '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' +
  src + '</body></html>';
fs.writeFileSync(path.join(__dirname, 'test.html'), html);
