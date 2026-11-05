/* Jembatan Kitab Roastery ↔ Firebase.
   Aplikasi ditulis untuk API database artifact Claude (db.doc/collection,
   get/set/update/delete/onSnapshot). Modul ini menyediakan API yang sama di atas
   Cloud Firestore, sehingga logika pembukuan di index.html tidak perlu diubah. */
import {
  doc, collection, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, FieldPath
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  sudahDikonfigurasi, fs, cekPeran, labelPeran, keluar, pantauLogin, layar
} from "./firebase-init.js";

/* Penanda untuk index.html: modul (dan pustaka Firebase) sudah termuat, jadi
   batas waktu muat tidak berlaku lagi selama pengguna di layar login. */
window.__kitabModulSiap = true;

/* ---------- Terjemahan error Firestore → kode yang dikenali aplikasi ---------- */
const KODE = {
  "permission-denied": "invalid_argument",     // aplikasi membaca ini sebagai "akses hanya lihat"
  "invalid-argument": "invalid_argument",
  "failed-precondition": "invalid_argument",
  "not-found": "invalid_argument",
  "resource-exhausted": "resource_exhausted",
  "unauthenticated": "revoked"
};
const ubahError = e => (e && e.asli !== undefined) ? e
  : { code: KODE[e && e.code] || "unavailable", message: (e && e.message) || String(e), asli: (e && e.code) || "" };

/* Penulisan Firestore menunggu konfirmasi server; saat sinyal putus janji itu bisa
   menggantung lama. Batasi waktunya supaya aplikasi bisa menandai "belum tersimpan".
   Perubahan tetap antre di perangkat dan dikirim otomatis begitu koneksi pulih. */
const BATAS_MS = 20000;
function jalankan(fn) {
  let t;
  const waktuHabis = new Promise((_, tolak) => {
    t = setTimeout(() => tolak({ code: "unavailable", asli: "timeout",
      message: "Server tidak menjawab dalam " + BATAS_MS / 1000 + " detik (koneksi lambat/putus). Perubahan diantrekan dan dikirim otomatis saat koneksi pulih." }), BATAS_MS);
  });
  return Promise.race([Promise.resolve().then(fn).catch(e => { throw ubahError(e); }), waktuHabis])
    .finally(() => clearTimeout(t));
}

/* Data dari aplikasi bisa beku (Object.freeze) atau berisi undefined — salin bersih. */
const bersih = d => JSON.parse(JSON.stringify(d || {}));

/* update({txns:{id:item}}) → ganti item "txns.id" SECARA UTUH, item lain tidak disentuh.
   (Lebih tepat daripada gabung bertingkat: kolom yang dihapus saat mengedit benar-benar hilang.) */
function jalurItem(data) {
  const jalur = [];
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const id of Object.keys(v)) jalur.push(new FieldPath(k, id));
    } else jalur.push(new FieldPath(k));
  }
  return jalur;
}

const bungkusDok = s => ({
  id: s.id,
  exists: s.exists(),
  data: () => (s.exists() ? s.data() : undefined),
  metadata: { fromCache: s.metadata.fromCache, hasPendingWrites: s.metadata.hasPendingWrites }
});
const bungkusKueri = s => {
  const docs = s.docs.map(bungkusDok);
  return {
    docs, size: docs.length, empty: !docs.length,
    docChanges: () => s.docChanges().map(c => ({ type: c.type, doc: bungkusDok(c.doc), oldIndex: c.oldIndex, newIndex: c.newIndex })),
    metadata: { fromCache: s.metadata.fromCache, hasPendingWrites: s.metadata.hasPendingWrites }
  };
};

function refDok(path) {
  const r = doc(fs, path);
  return {
    id: r.id, path,
    get: () => jalankan(() => getDoc(r).then(bungkusDok)),
    set: data => jalankan(() => setDoc(r, bersih(data))),
    update: data => {
      const d = bersih(data); const jalur = jalurItem(d);
      if (!jalur.length) return Promise.resolve();
      return jalankan(() => setDoc(r, d, { mergeFields: jalur }));
    },
    delete: () => jalankan(() => deleteDoc(r)),
    onSnapshot: (next, err) => onSnapshot(r, s => next(bungkusDok(s)), e => { if (err) err(ubahError(e)); }),
    collection: p => refKoleksi(path + "/" + p)
  };
}
function refKoleksi(path) {
  const c = collection(fs, path);
  const q = {
    path,
    doc: id => refDok(path + "/" + (id || doc(c).id)),
    add: async data => { const r = refDok(path + "/" + doc(c).id); await r.set(data); return r; },
    get: () => jalankan(() => getDocs(c).then(bungkusKueri)),
    onSnapshot: (next, err) => onSnapshot(c, s => next(bungkusKueri(s)), e => { if (err) err(ubahError(e)); }),
    // Aplikasi tidak memakai filter; disediakan agar pemanggilan tidak error.
    where() { return q; }, orderBy() { return q; }, limit() { return q; }
  };
  return q;
}
const db = { doc: refDok, collection: refKoleksi };

/* ------------------------------ Tombol akun ------------------------------ */
function pasangAkun(user, peran) {
  const gaya = document.createElement("style");
  gaya.textContent = `
  .akun-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line-2);background:var(--raised);color:var(--ink);
    border-radius:999px;padding:3px 9px 3px 3px;font:inherit;font-size:12px;cursor:pointer;max-width:100%}
  .akun-btn i{width:22px;height:22px;border-radius:50%;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center;
    font-style:normal;font-weight:600;font-size:11px;flex:none}
  .akun-btn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .akun-side{padding:4px 16px 12px}
  .topbar .akun-btn{flex:none}
  @media (max-width:560px){.topbar .akun-btn span{display:none}.topbar .akun-btn{padding:3px}}
  .akun-pop{position:fixed;z-index:60;min-width:230px;max-width:calc(100vw - 32px);background:var(--raised);border:1px solid var(--line);
    border-radius:12px;box-shadow:var(--shadow);padding:12px;font-size:13px}
  .akun-pop .em{font-family:var(--mono);font-size:11.5px;color:var(--ink-2);word-break:break-all;margin:2px 0 8px}
  .akun-pop a,.akun-pop button{display:block;width:100%;text-align:left;padding:8px 10px;border-radius:8px;border:0;background:none;
    color:var(--ink);font:inherit;text-decoration:none;cursor:pointer}
  .akun-pop a:hover,.akun-pop button:hover{background:var(--sunk)}`;
  document.head.append(gaya);

  const nama = user.displayName || user.email;
  const awal = (nama || "?").trim().charAt(0).toUpperCase();
  let pop = null;
  const tutupPop = () => { if (pop) { pop.remove(); pop = null; } };
  function bukaPop(btn) {
    if (pop) { tutupPop(); return; }
    pop = document.createElement("div"); pop.className = "akun-pop";
    const b = btn.getBoundingClientRect();
    pop.style.top = Math.min(b.bottom + 6, innerHeight - 200) + "px";
    pop.style.left = Math.max(16, Math.min(b.left, innerWidth - 262)) + "px";
    const judul = document.createElement("b"); judul.textContent = nama;
    const em = document.createElement("div"); em.className = "em"; em.textContent = user.email + " · " + labelPeran(peran);
    pop.append(judul, em);
    if (peran === "pemilik") {
      const a = document.createElement("a"); a.href = "admin.html"; a.textContent = "Kelola Tim & Data"; pop.append(a);
    }
    const k = document.createElement("button"); k.type = "button"; k.textContent = "Keluar"; k.onclick = keluar; pop.append(k);
    document.body.append(pop);
    setTimeout(() => document.addEventListener("click", function luar(ev) {
      if (pop && !pop.contains(ev.target)) { tutupPop(); document.removeEventListener("click", luar); }
    }), 0);
  }
  const buatBtn = () => {
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "akun-btn";
    btn.title = user.email + " · " + labelPeran(peran);
    const i = document.createElement("i"); i.textContent = awal;
    const s = document.createElement("span"); s.textContent = (nama || "").split(" ")[0] + " · " + labelPeran(peran);
    btn.append(i, s); btn.onclick = ev => { ev.stopPropagation(); bukaPop(btn); };
    return btn;
  };
  const side = document.querySelector(".side .side-head");
  if (side) { const w = document.createElement("div"); w.className = "akun-side"; w.append(buatBtn()); side.after(w); }
  const top = document.querySelector(".topbar");
  if (top) top.append(buatBtn());
}

/* --------------------------------- Mulai --------------------------------- */
if (!sudahDikonfigurasi) {
  layar.belumDikonfigurasi(() => { layar.tutup(); window.__kitabSiap({}); });
} else {
  layar.memuat("Menyiapkan…");
  let sudahMasuk = false;
  pantauLogin(async user => {
    if (sudahMasuk) { if (!user) location.reload(); return; }
    if (!user) { layar.masuk(); return; }
    layar.memuat("Memeriksa keanggotaan tim…");
    let peran;
    try { peran = await cekPeran(user); }
    catch (e) { layar.galat("Gagal memeriksa keanggotaan: " + ((e && e.message) || e)); return; }
    if (!peran) { layar.belumTerdaftar(user.email); return; }
    sudahMasuk = true;
    layar.tutup();
    try {
      if (!localStorage.getItem("kitab_roastery_operator") && typeof window.setOperator === "function")
        window.setOperator((user.displayName || user.email.split("@")[0]).split(" ")[0]);
    } catch (e) {}
    pasangAkun(user, peran);
    window.__kitabSiap({ db });
  });
}
