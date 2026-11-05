#!/usr/bin/env node
/* Membangun index.html (versi web: GitHub Pages + Firebase) dari moerapp.html
   (sumber yang sama dengan Artifact Claude).

     node tools/build-web.js

   Yang ditambahkan di sekeliling moerapp.html:
   · kerangka HTML yang sama dengan kerangka Artifact (supaya tampilannya identik);
   · penanda window.__KITAB_WEB dan janji __kitabSiapPromise yang ditunggu aplikasi;
   · <script type="module" src="js/kitab-firebase.js"> — login Google, cek peran,
     lalu menyerahkan database Firestore lewat window.__kitabSiap({db}).

   Jangan mengedit index.html langsung: perubahan akan hilang saat dibangun ulang. */
const fs = require("fs");
const path = require("path");

const akar = path.join(__dirname, "..");
const sumber = fs.readFileSync(path.join(akar, "moerapp.html"), "utf8");
if (/<!doctype|<html[\s>]|<body[\s>]/i.test(sumber.slice(0, 2000)))
  throw new Error("moerapp.html harus tanpa kerangka <html>/<body> (format sumber Artifact).");
if (!sumber.includes("window.__KITAB_WEB"))
  throw new Error("moerapp.html belum memiliki dukungan versi web (window.__KITAB_WEB).");

const kepala = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<!-- DIBANGUN OTOMATIS dari moerapp.html oleh tools/build-web.js — jangan diedit langsung. -->
<style>:root{color-scheme:light}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style>
<script>
/* Versi web: aplikasi menunggu js/kitab-firebase.js menyerahkan database
   (setelah login Google dan cek keanggotaan tim). */
window.__KITAB_WEB = true;
window.__kitabSiapPromise = new Promise(function (siap, gagal) {
  window.__kitabSiap = siap;
  window.__kitabGagalMuat = function (pesan) { gagal(new Error(pesan)); };
  /* Batas waktu hanya untuk MEMUAT modul. Begitu modul berjalan (layar masuk
     Google tampil), menunggu login berapa lama pun tidak dianggap gagal. */
  setTimeout(function () {
    if (!window.__kitabModulSiap)
      gagal(new Error("Penghubung database belum termuat setelah 60 detik. Periksa koneksi internet, lalu muat ulang."));
  }, 60000);
});
</script>
<script type="module" src="js/kitab-firebase.js" onerror="window.__kitabGagalMuat('Berkas js/kitab-firebase.js atau pustaka Firebase gagal dimuat. Periksa koneksi internet dan pastikan folder js/ ikut terunggah, lalu muat ulang.')"></script>
</head>
<body>
`;
const kaki = `
</body>
</html>
`;
fs.writeFileSync(path.join(akar, "index.html"), kepala + sumber + kaki);
console.log("index.html dibangun dari moerapp.html (" + Math.round((kepala.length + sumber.length + kaki.length) / 1024) + " KB).");
