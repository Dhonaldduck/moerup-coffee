/* Inisialisasi Firebase bersama (dipakai index.html dan admin.html):
   koneksi, layar masuk Google, pengecekan keanggotaan tim, dan keluar. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  signInWithCredential, signOut, connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  connectFirestoreEmulator, terminate, clearIndexedDbPersistence, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { FIREBASE_CONFIG, EMAIL_PEMILIK } from "./firebase-config.js";

const param = new URLSearchParams(location.search);
/* Mode emulator hanya untuk pengujian di komputer sendiri (localhost). */
export const MODE_EMULATOR = param.has("emulator") && ["localhost", "127.0.0.1"].includes(location.hostname);
export const sudahDikonfigurasi = MODE_EMULATOR || !/ISI_/.test(JSON.stringify(FIREBASE_CONFIG));
export const emailPemilik = ((MODE_EMULATOR && param.get("pemilik")) || EMAIL_PEMILIK || "").trim().toLowerCase();

export let auth = null, fs = null;
if (sudahDikonfigurasi) {
  const app = initializeApp(MODE_EMULATOR
    ? { apiKey: "demo-key", authDomain: "localhost", projectId: "demo-kitab", appId: "demo" }
    : FIREBASE_CONFIG);
  auth = getAuth(app);
  const opsi = { ignoreUndefinedProperties: true };
  /* Cache di perangkat: data tetap tampil saat sinyal putus, dan perubahan yang
     belum terkirim ikut tersimpan sampai koneksi pulih. */
  try { fs = initializeFirestore(app, { ...opsi, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch (e) { fs = initializeFirestore(app, { ...opsi, localCache: memoryLocalCache() }); }
  if (MODE_EMULATOR) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(fs, "127.0.0.1", 8080);
    window.__ujiMasuk = (email, nama) => signInWithCredential(auth, GoogleAuthProvider.credential(
      JSON.stringify({ sub: email, email, email_verified: true, name: nama || email })));
  }
}

/* Peran: "pemilik" | "editor" | "pembaca" | null (belum terdaftar). */
export async function cekPeran(user) {
  const email = (user.email || "").toLowerCase();
  if (email && email === emailPemilik) return "pemilik";
  try {
    const m = await getDoc(doc(fs, "members", email));
    if (!m.exists()) return null;
    return m.data().role === "editor" ? "editor" : "pembaca";
  } catch (e) {
    if (e && e.code === "permission-denied") return null;
    throw e;
  }
}
export const labelPeran = p => ({ pemilik: "Pemilik", editor: "Editor", pembaca: "Pembaca" }[p] || p);

export async function keluar() {
  // Jangan sampai isian yang belum terkirim hilang tanpa peringatan.
  try {
    if (typeof unsaved !== "undefined" && unsaved.size &&
        !confirm(unsaved.size + " perubahan BELUM tersimpan ke server dan akan hilang kalau keluar sekarang. Tetap keluar?")) return;
  } catch (e) {}
  try { await signOut(auth); } catch (e) {}
  // Hapus salinan data di perangkat ini, penting untuk HP/laptop yang dipakai bersama.
  try { await terminate(fs); await clearIndexedDbPersistence(fs); } catch (e) {}
  try { ["kitab_roastery_v1", "kitab_roastery_operator"].forEach(k => localStorage.removeItem(k)); } catch (e) {}
  location.reload();
}

/* Pantau status login. fn(user|null) dipanggil setiap kali berubah. */
export const pantauLogin = fn => onAuthStateChanged(auth, fn);

async function masukGoogle(info) {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  try { await signInWithPopup(auth, p); }
  catch (e) {
    const kode = e && e.code;
    if (kode === "auth/popup-blocked" || kode === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, p); return;
    }
    if (kode === "auth/popup-closed-by-user" || kode === "auth/cancelled-popup-request") return;
    const pesan = kode === "auth/unauthorized-domain"
      ? "Domain " + location.hostname + " belum diizinkan. Pemilik perlu menambahkannya di Firebase Console → Authentication → Settings → Authorized domains."
      : "Gagal masuk: " + ((e && e.message) || e);
    info.textContent = pesan;
  }
}

/* ------------------------------ Layar penuh ------------------------------ */
const GAYA = `
#kitabLayar{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;
  background:#EDF0EA;color:#151A16;font:14px/1.55 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
@media (prefers-color-scheme:dark){#kitabLayar{background:#111410;color:#E9EDE6}
  #kitabLayar .kartu{background:#181C16;border-color:#2B3128}#kitabLayar .redup{color:#9CA69B}}
#kitabLayar .kartu{width:100%;max-width:420px;background:#FBFCF9;border:1px solid #DCE1D8;border-radius:14px;
  padding:28px 24px;box-shadow:0 8px 24px -12px rgba(21,26,22,.25);text-align:center}
#kitabLayar .logo{width:44px;height:44px;border-radius:11px;background:#A8461D;color:#fff;display:grid;place-items:center;
  margin:0 auto 14px;font:600 20px "IBM Plex Mono",ui-monospace,monospace}
#kitabLayar h1{font-size:19px;margin:0 0 6px;letter-spacing:-.01em}
#kitabLayar p{margin:0 0 14px}
#kitabLayar .redup{color:#5A655C;font-size:13px}
#kitabLayar .tombol{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:11px 14px;
  border-radius:10px;border:1px solid #C6CEC1;background:#fff;color:#151A16;font:inherit;font-weight:600;cursor:pointer;margin-top:8px}
#kitabLayar .tombol.utama{background:#A8461D;border-color:#A8461D;color:#fff}
#kitabLayar .email{font-family:"IBM Plex Mono",ui-monospace,monospace;background:rgba(168,70,29,.08);padding:6px 8px;border-radius:6px;word-break:break-all}
#kitabLayar .info{color:#A3282A;font-size:12.5px;margin-top:10px;min-height:1em}`;

let elLayar = null;
function layarBaru(isi) {
  if (!document.getElementById("kitabLayarGaya")) {
    const s = document.createElement("style"); s.id = "kitabLayarGaya"; s.textContent = GAYA; document.head.append(s);
  }
  if (!elLayar) { elLayar = document.createElement("div"); elLayar.id = "kitabLayar"; document.body.append(elLayar); }
  elLayar.innerHTML = "";
  const kartu = document.createElement("div"); kartu.className = "kartu";
  kartu.innerHTML = '<div class="logo">R</div>';
  isi(kartu);
  elLayar.append(kartu);
  return kartu;
}
const buat = (tag, kelas, teks) => { const e = document.createElement(tag); if (kelas) e.className = kelas; if (teks != null) e.textContent = teks; return e; };
const tombol = (teks, utama, fn) => { const b = buat("button", "tombol" + (utama ? " utama" : ""), teks); b.type = "button"; b.onclick = fn; return b; };

export const layar = {
  tutup() { if (elLayar) { elLayar.remove(); elLayar = null; } },
  memuat(teks) {
    layarBaru(k => { k.append(buat("h1", null, "Kitab Roastery"), buat("p", "redup", teks || "Memuat…")); });
  },
  masuk(judul) {
    layarBaru(k => {
      const info = buat("div", "info");
      k.append(buat("h1", null, judul || "Kitab Roastery"),
        buat("p", "redup", "Pembukuan & operasional roastery. Masuk dengan akun Google yang sudah didaftarkan pemilik."),
        tombol("Masuk dengan Google", true, () => { info.textContent = ""; masukGoogle(info); }), info);
    });
  },
  belumTerdaftar(email) {
    layarBaru(k => {
      const info = buat("div", "info");
      const em = buat("p", "email", email);
      k.append(buat("h1", null, "Akun belum terdaftar"),
        buat("p", "redup", "Akun Google ini belum ditambahkan sebagai anggota tim. Kirim email di bawah ke pemilik agar didaftarkan di halaman Kelola Tim, lalu muat ulang halaman ini."),
        em,
        tombol("Salin email", false, async () => {
          try { await navigator.clipboard.writeText(email); info.style.color = "#2B6A4A"; info.textContent = "Email disalin."; }
          catch (e) { info.textContent = "Tidak bisa menyalin — salin manual dari kotak di atas."; }
        }),
        tombol("Muat ulang", false, () => location.reload()),
        tombol("Ganti akun Google", false, keluar), info);
    });
  },
  belumDikonfigurasi(lanjutContoh) {
    layarBaru(k => {
      k.append(buat("h1", null, "Firebase belum dikonfigurasi"),
        buat("p", "redup", "Pemilik perlu mengisi berkas js/firebase-config.js dan memasang firestore.rules. Ikuti README.md bagian Panduan Hosting."));
      if (lanjutContoh) k.append(tombol("Lihat contoh (data hanya di browser ini)", false, lanjutContoh));
    });
  },
  galat(pesan, ulang, judul, labelUlang) {
    layarBaru(k => {
      k.append(buat("h1", null, judul || "Tidak bisa tersambung"), buat("p", "redup", pesan));
      k.append(tombol(labelUlang || "Coba lagi", true, ulang || (() => location.reload())), tombol("Keluar", false, keluar));
    });
  }
};
