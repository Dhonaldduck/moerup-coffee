# Kitab Roastery — Versi Web

Aplikasi pembukuan & operasional roastery Moerup Coffee yang bisa dibuka dari **browser mana pun** (HP/laptop) oleh anggota tim yang Anda daftarkan — tanpa akun Claude.

| Bagian | Dipegang oleh | Biaya |
|---|---|---|
| Tampilan aplikasi (berkas di repo ini) | **GitHub Pages** | Gratis (repo publik) |
| Database & login Google | **Firebase** (Google) — paket Spark | Gratis: 50.000 baca & 20.000 tulis per hari, 1 GB data |

> **Kode boleh publik, data tidak.** Repo ini tidak berisi data keuangan apa pun. Transaksi, gaji, harga beli, data pelanggan, dan rekening tersimpan di Firebase dan hanya bisa dibaca oleh akun Google yang terdaftar. Orang lain yang membuka alamat situs hanya melihat layar "Masuk dengan Google", lalu ditolak.

## Isi paket

| Berkas | Fungsi |
|---|---|
| `index.html` | Aplikasi Kitab Roastery (semua menu: roasting, produksi botolan, penjualan, stok, laporan, rasio, jurnal). **Dibangun otomatis** dari `moerapp.html` — jangan diedit langsung |
| `moerapp.html` | **Sumber aplikasi** — berkas yang sama dengan Artifact Claude. Semua perubahan fitur dilakukan di sini |
| `tools/build-web.js` | Membangun `index.html` dari `moerapp.html`: `node tools/build-web.js` |
| `admin.html` | **Kelola Tim & Data** — khusus pemilik: tambah anggota, atur peran, impor data, unduh cadangan |
| `js/firebase-config.js` | **Satu-satunya berkas yang Anda isi** (Langkah 3) |
| `js/firebase-init.js`, `js/kitab-firebase.js`, `js/admin.js` | Penghubung aplikasi ↔ Firebase (tidak perlu diubah) |
| `js/impor-kembar.js` | Pendeteksi transaksi kembar saat impor (dipakai `admin.html`) |
| `tests/` | Uji otomatis (Playwright) — lihat *Untuk pengembang* |
| `CHANGELOG.md` | Catatan perubahan fitur |
| `firestore.rules` | Aturan keamanan database — ditempel ke Firebase (Langkah 2) |
| `firebase.json`, `firestore.indexes.json` | Untuk Firebase CLI & pengujian (opsional) |

## Peran pengguna

| Peran | Bisa melihat | Bisa mengisi/mengubah | Kelola tim & impor |
|---|---|---|---|
| **Pemilik** (email di Langkah 2–3) | ✔ | ✔ | ✔ |
| **Editor** (mis. Tegar) | ✔ | ✔ | — |
| **Pembaca** (mis. investor, akuntan) | ✔ | — | — |
| Orang lain | — | — | — |

---

## Panduan hosting (sekali saja, ±30 menit)

### Langkah 1 — Buat proyek Firebase
1. Buka **https://console.firebase.google.com** dan masuk dengan akun Google pemilik.
2. Klik **Create a project** → nama: `kitab-roastery` → Google Analytics **matikan** → **Create project**.

### Langkah 2 — Aktifkan login Google & database
1. Menu kiri **Build → Authentication → Get started** → tab **Sign-in method** → **Google** → **Enable** → pilih email dukungan → **Save**.
2. Menu kiri **Build → Firestore Database → Create database**
   - Lokasi: **asia-southeast2 (Jakarta)** (tidak bisa diubah nanti)
   - Mode: **Start in production mode** → **Create**.
3. Di Firestore, buka tab **Rules** → hapus semua isinya → tempel **seluruh isi berkas `firestore.rules`**.
4. Pada baris `function emailPemilik() { return "email-pemilik@gmail.com"; }` ganti dengan **email Google Anda (huruf kecil)** → **Publish**.

### Langkah 3 — Hubungkan aplikasi ke Firebase
1. Klik ikon ⚙️ **Project settings** → bagian **Your apps** → ikon **`</>`** (Web).
2. Nickname: `kitab-web` → **Register app** (jangan centang Firebase Hosting).
3. Akan tampil kode `const firebaseConfig = { apiKey: "...", ... }`. Buka berkas **`js/firebase-config.js`**, lalu ganti setiap `ISI_...` dengan nilai yang sesuai.
4. Di berkas yang sama, ganti `email-pemilik@gmail.com` dengan email yang **sama persis** seperti di Langkah 2.4.

> Nilai `apiKey` dan kawan-kawan **bukan rahasia** — memang dirancang untuk dipasang di situs publik. Keamanan dijaga oleh aturan di Langkah 2.

### Langkah 4 — Unggah ke GitHub & aktifkan GitHub Pages
1. Di **github.com** → **New repository** → nama: `kitab-roastery` → **Public** → **Create repository**.
2. Klik **uploading an existing file** → seret **semua isi folder paket ini** (termasuk folder `js`) → **Commit changes**.
3. Buka **Settings → Pages** → *Source*: **Deploy from a branch** → *Branch*: **main** dan **/(root)** → **Save**.
4. Tunggu 1–3 menit. Alamat situs: **`https://USERNAME.github.io/kitab-roastery/`**

> GitHub Pages gratis hanya untuk repo **publik**. Itu aman karena data tidak ada di repo. Kalau ingin repo tetap privat, lihat bagian *Alternatif hosting* di bawah.

### Langkah 5 — Izinkan alamat GitHub di Firebase
Firebase → **Authentication → Settings → Authorized domains → Add domain** → isi **`USERNAME.github.io`** → **Add**.
(Tanpa langkah ini, tombol "Masuk dengan Google" akan menampilkan pesan *domain belum diizinkan*.)

### Langkah 6 — Pindahkan data dari Kitab Roastery lama
1. Buka **`https://USERNAME.github.io/kitab-roastery/admin.html`** → **Masuk dengan Google** (akun pemilik).
2. Bagian **Impor data** → pilih berkas **`kitab-roastery-cadangan-2026-11-02.json`** → periksa ringkasannya → **Impor ke database**.
3. Kalau sejak 2 November ada transaksi baru di Kitab Roastery versi Claude, ekspor ulang dari sana (**Pengaturan → Ekspor cadangan (.json)**), lalu impor berkas itu juga. Impor aman diulang: transaksi dengan ID yang sama tidak akan dobel, dan transaksi yang **sama persis tapi ber-ID lain** (tanggal, jenis, pihak, nilai sama — mis. dicatat di dua sistem) terdeteksi dan dilewati secara bawaan. Periksa ringkasannya sebelum menekan **Impor**.
   > Catatan 4 Nov 2026: 12 pembelian tanggal 3–4 Nov (Sinau Print, Warunk Plastik, Toko bahan kue, Pak Dono) sempat dicatat ulang di versi Claude, padahal sudah ada di versi web. Kalau mengimpor cadangan versi Claude, pastikan ke-12 transaksi itu masuk daftar "sudah ada di database" dan tetap dicentang untuk dilewati.
4. **Setelah impor, berhenti mengisi versi Claude.** Mulai hari itu semua orang hanya memakai versi web, supaya data tidak terpecah di dua tempat.

### Dua jenis impor — pilih yang tepat

| | `admin.html` → **Impor data** | Aplikasi → **Pengaturan → Impor cadangan** |
|---|---|---|
| Sifat | **Menggabung** per ID | **Menyamakan persis** dengan berkas |
| Transaksi baru di berkas | ditambahkan | ditambahkan |
| Transaksi yang diubah | diperbarui | diperbarui |
| Transaksi yang **tidak ada** di berkas (sudah dihapus di sumber, atau tercatat dobel dengan ID lain) | **tetap ada** | **dihapus** — ditampilkan dulu satu per satu; hilangkan centang untuk mempertahankan |
| Data master & pengaturan | digabung | diganti isi berkas (kecuali yang dipakai transaksi yang dipertahankan) |
| Dipakai untuk | migrasi awal, menambah data dari sumber lain | menyamakan dua salinan yang sudah berbeda (mis. web ↔ Artifact Claude) |

**Aturan satu sumber data:** hanya **satu** tempat yang boleh diisi (disarankan versi web). Artifact Claude tidak bisa tersambung langsung ke Firebase, jadi tidak ada sinkron otomatis dua arah. Kalau Artifact masih ingin dipakai untuk melihat laporan, perlakukan sebagai **cermin baca-saja**: unduh cadangan dari web, lalu di Artifact pilih **Pengaturan → Impor cadangan → Samakan sekarang**. Jangan mengisi transaksi di Artifact lalu mengimpornya kembali dengan impor gabung — itulah penyebab angka web dan Artifact berbeda pada 4–5 Nov 2026.

### Langkah 7 — Tambah anggota tim
`admin.html` → **Anggota tim** → isi email Google Tegar → peran **Editor** → **Tambah**.
Kirim alamat situs ke Tegar; dia cukup klik **Masuk dengan Google** dengan email tersebut.

### Langkah 8 (opsional) — Pasang di layar utama HP
Buka situs di Chrome → menu ⋮ → **Add to Home screen**. Aplikasi tampil seperti app biasa.

---

## Pemakaian sehari-hari

- **Sinyal putus:** data yang sudah termuat tetap tampil. Isian baru disimpan di HP dan dikirim otomatis saat koneksi pulih. Kalau muncul peringatan *"BELUM tersimpan"*, tekan **Coba simpan ulang**. Tombol ini hanya mengirim isian Anda dan tidak menimpa data orang lain.
- **HP/laptop dipakai bersama:** selalu tekan nama Anda (pojok kiri atas) → **Keluar**. Salinan data di perangkat ikut dihapus.
- **Cadangan:** minimal sebulan sekali buka `admin.html` → **Unduh cadangan (.json)**, lalu simpan di Google Drive.
- **Mencabut akses** (karyawan keluar): `admin.html` → **Hapus**. Aksesnya berhenti saat itu juga.

## Batas kapasitas

Transaksi disimpan per bulan. Satu bulan aman sampai ±**700 transaksi** (saat ini puncaknya 89/bulan). Kalau penjualan HoReCa tumbuh mendekati angka itu, lakukan ini sekali: Firestore → **Indexes → Single field → Add exemption** → Collection `ledger`, Field `txns`, matikan semua indeks. Batasnya naik menjadi ±1.500 transaksi/bulan.

## Alternatif hosting (repo tetap privat)

- **Cloudflare Pages** atau **Netlify**: gratis, bisa mengambil dari repo GitHub **privat**. Tidak perlu *build command*; *output directory* = folder berisi `index.html`. Tambahkan domain `*.pages.dev` / `*.netlify.app` ke *Authorized domains* (Langkah 5).
- **Firebase Hosting**: `npx firebase-tools deploy --only hosting,firestore` dari folder ini. Alamatnya menjadi `PROJECT-ID.web.app` (domain ini otomatis diizinkan untuk login).

## Untuk pengembang

Uji di komputer sendiri tanpa menyentuh data asli (butuh Node.js & Java 11+):

```bash
npx firebase-tools emulators:start --only auth,firestore --project demo-kitab
```

```bash
python3 -m http.server 5050
```

Buka `http://localhost:5050/index.html?emulator=1`, lalu masuk lewat konsol browser: `__ujiMasuk("email-pemilik@gmail.com", "Pemilik")`.

### Alur mengubah aplikasi

1. Ubah **`moerapp.html`** (sumber yang sama dengan Artifact Claude).
2. Bangun versi web: `node tools/build-web.js` → menulis ulang `index.html`.
3. Jalankan uji: `cd tests && npm install && npx playwright install chromium && npm test`.
4. Commit `moerapp.html` **dan** `index.html` bersamaan.

> Jangan menimpa `index.html` dengan berkas dari luar (mis. dari zip Artifact). Tanpa langkah 2, `index.html` kehilangan penghubung Firebase: aplikasi tidak meminta login dan isian hanya tersimpan di browser.

`index.html` = `moerapp.html` + kerangka halaman + penanda `window.__KITAB_WEB` + `js/kitab-firebase.js`. Modul itu menangani login Google & peran, lalu menyerahkan API database yang sama dengan Artifact (`doc`/`collection`, `get`/`set`/`update`/`onSnapshot`) di atas Cloud Firestore lewat `window.__kitabSiap({db})`. Setiap simpanan hanya mengganti **satu item** (`txns.<id>`), sehingga isian anggota tim lain tidak pernah tertimpa. Kalau modul gagal dimuat, aplikasi menampilkan pesan galat (tidak macet di "Memuat…").

### Isi uji (`tests/`)

| Berkas | Memeriksa |
|---|---|
| `smoke.test.js` | Semua halaman, semua form, edit setiap jenis transaksi, invoice PDF; neraca seimbang & setiap jurnal debit = kredit |
| `web.test.js` | `index.html` versi web dengan database tiruan: mode cloud, simpanan tidak menimpa data lain, konversi satuan, galat muat, mode contoh |
| `impor.test.mjs` | Pendeteksi transaksi kembar saat impor |
| `mirror.test.js` | Impor "samakan persis" di versi web (termasuk balapan snapshot Firestore) dan versi Artifact: hapus/tambah/perbarui, transaksi yang dipertahankan beserta asetnya |
| `edge.test.js`, `form.test.js`, `recipe.test.js` | Produksi & waste botolan, form bahan + pembelian, resep dengan pelarutan & air |
