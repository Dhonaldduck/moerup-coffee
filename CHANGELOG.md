# Catatan perubahan

## 2026-11-05 — Impor "samakan persis" (web ↔ Artifact tidak sinkron)

### Masalah

Total uang di dashboard web dan Artifact berbeda. Penyebabnya bukan berkas JSON yang rusak, melainkan **cara impor lama yang hanya menggabung per ID**:

- transaksi yang sama tetapi tercatat dengan ID berbeda di dua tempat ikut masuk dua kali;
- transaksi yang sudah dihapus di sumber tetap tinggal di tujuan, karena impor tidak pernah menghapus.

### Perubahan

1. **Pengaturan → Impor cadangan** kini *menyamakan persis* database dengan berkas (berlaku di web dan Artifact).
   - Sebelum menulis, muncul pratinjau: jumlah transaksi ditambah, diperbarui, dan dihapus, serta daftar setiap transaksi yang akan dihapus (tanggal, jenis, nilai, pencatat).
   - Hilangkan centang untuk mempertahankan transaksi yang memang sah tetapi belum ada di berkas. Data master yang dipakainya (mis. aset dari pembelian peralatan) ikut dipertahankan.
   - Ada peringatan data master yang ikut terhapus, dan opsi mengunduh cadangan data saat ini sebelum impor (aktif secara bawaan).
2. **Perbaikan balapan sinkronisasi.** Snapshot Firestore yang datang di tengah proses massal (isinya setengah lama) sempat mengembalikan katalog lama, sehingga aset kembar hidup lagi dan penyusutannya tetap tercatat. Perbaikannya:
   - selama impor, penerapan snapshot ditunda (`tundaSync`) dan baru diterapkan setelah semua tulisan selesai;
   - `saveCatalog` kini ikut dijaga `markWrite`/`replayRecent`, sama seperti penyimpanan lainnya;
   - katalog disimpan sebelum pengaturan.
3. Uji baru `tests/mirror.test.js`, dengan data contoh, untuk web (Firebase tiruan) dan Artifact.

Diuji juga dengan data asli di luar repo: database web hasil rekonstruksi + berkas Artifact 5 Nov. Hasilnya: total uang, laba, persediaan, jumlah transaksi, dan aset semuanya identik dengan berkas. Mesin pembukuan untuk data lama tetap identik dengan versi awal (uji regresi).

## 2026-11-04 (b) — Perbaikan setelah penggabungan ke repo web

Hasil pemeriksaan zip `moerup-coffee-main` setelah source baru digabung.

### Bug yang diperbaiki

1. **Kritis — `index.html` kehilangan penghubung Firebase.** Berkas `index.html` tertimpa versi mandiri dari zip Artifact, yang tidak memuat `js/kitab-firebase.js`. Akibatnya situs web tidak meminta login, tidak membaca database tim, dan isian hanya tersimpan di browser masing-masing. Sekarang `index.html` **dibangun** dari `moerapp.html` lewat `tools/build-web.js`, dan sumber aplikasi mendukung dua tempat jalan (Artifact Claude & web) tanpa perlu disunting terpisah.
2. **Aplikasi macet di "Memuat…" kalau penghubung gagal dimuat** (sinyal putus saat pertama buka, atau folder `js/` tidak ikut terunggah). Sekarang muncul pesan galat dan tombol *Muat ulang*. Batas waktu hanya berlaku saat memuat modul, tidak saat pengguna di layar login.
3. **Elemen tersembunyi tetap tampil di versi web.** Aplikasi bergantung pada aturan `[hidden]` dan `body{margin:0}` dari kerangka Artifact. Di web, tombol/kotak yang mestinya tersembunyi (mis. isian pembelian di form bahan, tombol kantong roast kosong) ikut tampil. Aturannya kini ada di CSS aplikasi sendiri.
4. **Mengganti satuan item yang sudah punya riwayat merusak stok.** Contoh: "susu Diamond APM" di database web tercatat 2 pcs × Rp 19.250. Mengubah satuannya ke ml tanpa konversi membuat stok terbaca 2 ml seharga Rp 19.250/ml. Sekarang form item menampilkan kotak **konversi satuan** (1 pcs lama = 1.000 ml): semua pembelian, opname, packing, produksi, dan resep yang memakai item itu dikalikan faktor; nilai rupiah tidak berubah sehingga jurnal, neraca, dan laba rugi tetap sama.
5. **Impor bisa membuat transaksi dobel.** Transaksi yang sama tapi tercatat dengan ID berbeda di dua sistem (kasus nyata: 12 pembelian 3–4 Nov) akan terimpor dua kali. `admin.html` kini mendeteksinya (tanggal, jenis, pihak, nilai sama; dicocokkan per hitungan) dan melewatinya secara bawaan, termasuk aset dan item bahan yang hanya dipakai transaksi itu.
6. Teks banner dan pesan gagal simpan di versi web tidak lagi menyuruh "masuk akun Claude / akses can edit"; sekarang merujuk peran Editor/Pembaca.

### Lain-lain

- `.gitignore`: hasil uji dan berkas cadangan (`*cadangan*.json`) tidak ikut ter-commit — repo ini publik.
- `firebase.json`: `moerapp.html`, `tests/`, `tools/`, `CHANGELOG.md` tidak ikut di-hosting.
- Uji baru: `smoke.test.js`, `web.test.js`, `impor.test.mjs`.
- Diperiksa dan tidak perlu diubah: `firestore.rules` (fitur baru tidak menambah koleksi; data botolan & bahan masuk `master/catalog` dan `ledger/<bulan>` yang sudah diatur), `firestore.indexes.json`, `js/firebase-init.js`.

## 2026-11-04 — Lini kopi botolan & bahan minuman per ml

Diuji: pembukuan data lama (tanpa botolan) menghasilkan jurnal, saldo stok, laba rugi, dan
neraca yang **identik** dengan versi sebelumnya.

### Akun baru

| Kode | Nama | Jenis |
|---|---|---|
| 1-1340 | Persediaan Bahan Baku Minuman | Aset |
| 1-1350 | Persediaan Barang Jadi Botolan | Aset |
| 5-1100 | HPP Minuman Botolan | HPP |
| 5-9100 | Selisih Biaya Produksi Botolan | HPP |
| 5-9600 | Waste & Kedaluwarsa Botolan | HPP |

### Bahan minuman (susu, krimer, gula aren, cokelat, air)

- Tab baru **Produk & Aset → Bahan minuman**. Kategori: Susu & krimer, Pemanis & sirup,
  Cokelat & perisa, Bahan minuman lain. Satuan stok ml atau gram.
- Form bahan: **Isi per kemasan**, **Jumlah dibeli (pcs)**, **Harga per kemasan** → harga per
  ml/gram dihitung otomatis. Kalau jumlah dibeli diisi, pembelian langsung tercatat (stok
  naik, kas turun atau hutang bertambah). Kolom jumlah selalu kosong saat form dibuka,
  supaya menyimpan ulang tidak mencatat pembelian dua kali.
- **Batas stok minimum** dalam satuan dasar (ml/gram), dengan padanan pcs.
- Pembelian bahan bisa diisi per kemasan (12 pcs × Rp 19.500) atau per satuan dasar;
  mesin akuntansi selalu menerima satuan dasar. Satu nota berisi kemasan + bahan
  dipisah ke akun 1-1330 dan 1-1340.
- Tombol "Isi daftar bahan umum" dan menu cepat "Pembelian bahan minuman".

### Produk botolan (RTD) & resep

- `sku.line = "rtd"` membedakan botolan dari kopi biji/bubuk (produk lama = `"bean"`).
- Resep per botol, dalam satuan **bahan baku** (yang dipotong dari stok):
  1. Kopi: gram roast bean → hasil espresso (ml).
  2. Bahan minuman: takaran ml/gram; bubuk bisa **dicairkan** dengan air 1 : x → hasil cair.
  3. Air: air biasa + sumber air (stok air atau tidak dihitung).
  4. Kemasan per botol; biaya lain per botol (es, gas, tenaga).
- **Air yang dihitung** = air seduh espresso (sama dengan hasil espresso: 10 g → 30 ml memakai
  30 ml air) + air pelarut (7,5 g dicairkan 1 : 1 = 7,5 ml) + air biasa. Air masuk HPP kalau
  sumber airnya dipilih.
- Bar **isi botol** (espresso + bahan cair + air biasa dibanding isi botol), rincian HPP per
  kelompok, food cost, dan saran harga jual untuk target margin.
- Kode batch boleh sampai 10 karakter (juga kode green bean).

### Produksi botolan

- Menu baru **Produksi Botolan**. Produksi batch memotong roast bean (pilih batch roasting),
  bahan minuman, air, dan kemasan → stok botol jadi, dengan kode batch
  `BTL-<kode><DDMMYY>-<n>` dan tanggal kedaluwarsa dari masa simpan.
- Isian bahan otomatis = resep × jumlah botol (bisa diubah ke pemakaian nyata), plus
  **panduan racik** untuk satu batch.
- Jurnal: Dr 1-1350 / Cr 1-1320, 1-1340, 1-1330, 5-9100. Batch dengan 0 botol dicatat
  seluruhnya sebagai waste.
- **Waste / sampel**: kedaluwarsa, rusak, gagal QC → 5-9600; sampel/promo → 6-1400;
  konsumsi internal → 6-1900.
- Lot botol jadi dilacak per batch dengan urutan kedaluwarsa terdekat (FEFO); nilai HPP tetap
  rata-rata bergerak. Penjualan sebelum produksi dicatat (stok minus) dikoreksi lewat
  Selisih Harga Stok Minus, dan kekurangannya dipotong dari lot berikutnya.

### Penjualan, invoice, laporan

- Penjualan botolan memotong stok botol jadi (bukan bahan) → HPP 5-1100. Peringatan kalau
  stok botol tidak cukup.
- Invoice: baris botolan berisi isi botol, batch produksi, tanggal kedaluwarsa, dan
  "baik diminum sebelum".
- Rekap Penjualan: tabel **per lini produk** (biji & bubuk vs botolan).
- Neraca, halaman Stok (filter Bahan minuman, Kemasan, Botol jadi), Beranda (peringatan
  kedaluwarsa), dan rasio keuangan ikut memasukkan persediaan baru.
- Kopi untuk botolan dinilai sebesar **HPP roast bean**, bukan harga jual (satu badan usaha;
  PSAK 14). Laba roastery terkandung di margin botolan saat botol terjual ke pelanggan.

### Model data baru

- `supplies[id]`: `packSize`, `refPrice` (harga per kemasan).
- `skus[id]` botolan: `line`, `kode`, `volumeMl`, `shelfDays`, `minStock`, `targetMargin`,
  `ohPerUnit`, `airMl`, `airSupplyId`, `beans[].yieldMl`, `components[].rasioAir`,
  `components[].yieldMl`.
- Transaksi baru: `produce` (`skuId`, `qty`, `beans[{greenbeanId, src, gram}]`,
  `items[{supplyId, qty}]`, `ohPerUnit`, `expDate`) dan `waste` (`skuId`, `qty`, `lotId`,
  `reason`).
- Baris pembelian per kemasan: `mode:"pack"`, `packQty`, `packPrice`, `packSize`
  (`qty`/`unitPrice` tetap dalam satuan dasar).
