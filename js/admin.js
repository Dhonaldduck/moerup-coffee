/* Halaman Kelola Tim & Data (khusus pemilik). */
import {
  doc, collection, getDoc, getDocs, setDoc, deleteDoc, writeBatch, FieldPath
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  sudahDikonfigurasi, fs, cekPeran, labelPeran, keluar, pantauLogin, layar, emailPemilik
} from "./firebase-init.js";
import { cariKembar, buangKembar } from "./impor-kembar.js";

const $ = s => document.querySelector(s);
const JENIS_KATALOG = ["greenbeans", "supplies", "skus", "assets", "customers"];
const NAMA_JENIS = { greenbeans: "green bean", supplies: "bahan & kemasan", skus: "produk", assets: "aset", customers: "pelanggan" };
const bersih = d => JSON.parse(JSON.stringify(d || {}));
const bulanDari = t => String(t.date || "").slice(0, 7);
const angka = n => new Intl.NumberFormat("id-ID").format(n);

function status(id, jenis, teks) {
  const el = $(id); el.innerHTML = "";
  if (!teks) return;
  const d = document.createElement("div"); d.className = "status " + jenis; d.textContent = teks; el.append(d);
}

/* ------------------------------ Anggota tim ------------------------------ */
async function muatAnggota() {
  const tb = $("#daftarAnggota"); tb.innerHTML = "";
  const baris = (email, isiPeran, aksi) => {
    const tr = document.createElement("tr");
    const a = document.createElement("td"); a.className = "em"; a.textContent = email;
    const b = document.createElement("td"); b.append(isiPeran);
    const c = document.createElement("td"); c.style.textAlign = "right"; if (aksi) c.append(aksi);
    tr.append(a, b, c); tb.append(tr);
  };
  baris(emailPemilik, document.createTextNode("Pemilik"), null);
  let snap;
  try { snap = await getDocs(collection(fs, "members")); }
  catch (e) { status("#statusAnggota", "galat", "Gagal memuat anggota: " + e.message); return; }
  snap.docs.sort((x, y) => x.id.localeCompare(y.id)).forEach(d => {
    const sel = document.createElement("select");
    sel.innerHTML = '<option value="editor">Editor</option><option value="viewer">Pembaca</option>';
    sel.value = d.data().role === "editor" ? "editor" : "viewer";
    sel.onchange = async () => {
      try { await setDoc(doc(fs, "members", d.id), { role: sel.value }, { merge: true });
        status("#statusAnggota", "ok", d.id + " sekarang " + (sel.value === "editor" ? "Editor" : "Pembaca") + ". Minta dia memuat ulang halaman."); }
      catch (e) { status("#statusAnggota", "galat", "Gagal mengubah peran: " + e.message); }
    };
    const hapus = document.createElement("button"); hapus.className = "btn bahaya"; hapus.type = "button"; hapus.textContent = "Hapus";
    hapus.onclick = async () => {
      if (!confirm("Hapus " + d.id + " dari tim? Dia tidak akan bisa membuka Kitab Roastery lagi.")) return;
      try { await deleteDoc(doc(fs, "members", d.id)); status("#statusAnggota", "ok", d.id + " dihapus dari tim."); muatAnggota(); }
      catch (e) { status("#statusAnggota", "galat", "Gagal menghapus: " + e.message); }
    };
    baris(d.id, sel, hapus);
  });
}

function pasangFormAnggota(user) {
  $("#formAnggota").onsubmit = async ev => {
    ev.preventDefault();
    const email = $("#emailBaru").value.trim().toLowerCase();
    const role = $("#peranBaru").value;
    if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email)) { status("#statusAnggota", "galat", "Format email tidak valid."); return; }
    if (email === emailPemilik) { status("#statusAnggota", "info", "Itu email pemilik — sudah punya akses penuh."); return; }
    try {
      await setDoc(doc(fs, "members", email), { role, ditambahkan: new Date().toISOString(), oleh: user.email });
      $("#emailBaru").value = "";
      status("#statusAnggota", "ok", email + " ditambahkan sebagai " + (role === "editor" ? "Editor" : "Pembaca") + ". Kirimkan alamat situs ini kepadanya; dia masuk dengan akun Google tersebut.");
      muatAnggota();
    } catch (e) { status("#statusAnggota", "galat", "Gagal menambah: " + e.message); }
  };
}

/* ------------------------------- Impor data ------------------------------- */
let dataImpor = null;

function periksaCadangan(obj) {
  if (!obj || typeof obj !== "object") throw new Error("Isi berkas bukan objek JSON.");
  const txns = obj.txns || {};
  if (typeof txns !== "object" || Array.isArray(txns)) throw new Error("Bagian 'txns' tidak dikenali.");
  const perBulan = {};
  let rusak = 0;
  for (const [id, t] of Object.entries(txns)) {
    if (!t || typeof t !== "object" || !/^\d{4}-\d{2}/.test(String(t.date || "")) || !t.type) { rusak++; continue; }
    (perBulan[bulanDari(t)] ||= {})[id] = { ...t, id: t.id || id };
  }
  const katalog = {};
  for (const j of JENIS_KATALOG) if (obj[j] && typeof obj[j] === "object") katalog[j] = obj[j];
  const jumlahTxn = Object.values(perBulan).reduce((a, b) => a + Object.keys(b).length, 0);
  if (!jumlahTxn && !Object.keys(katalog).length) throw new Error("Berkas tidak berisi transaksi maupun data master.");
  return { perBulan, katalog, settings: obj.settings && typeof obj.settings === "object" ? obj.settings : null, rusak, jumlahTxn };
}

async function isiDatabaseSekarang() {
  const [s, kat] = await Promise.all([getDocs(collection(fs, "ledger")), getDoc(doc(fs, "master/catalog"))]);
  const txns = {}; s.docs.forEach(d => Object.assign(txns, (d.data() || {}).txns || {}));
  return { n: Object.keys(txns).length, txns, katalog: kat.data() || {} };
}

let kembar = null;
function tampilPratinjau(d, adaSekarang, k) {
  const el = $("#pratinjau"); el.innerHTML = "";
  const tbl = document.createElement("table");
  tbl.innerHTML = "<thead><tr><th>Isi berkas</th><th>Jumlah</th></tr></thead>";
  const tb = document.createElement("tbody");
  const tambah = (a, b) => { const tr = document.createElement("tr"); const x = document.createElement("td"); x.textContent = a;
    const y = document.createElement("td"); y.textContent = b; tr.append(x, y); tb.append(tr); };
  Object.keys(d.perBulan).sort().forEach(m => tambah("Transaksi " + m, angka(Object.keys(d.perBulan[m]).length)));
  tambah("Total transaksi", angka(d.jumlahTxn));
  JENIS_KATALOG.forEach(j => { if (d.katalog[j]) tambah("Data master: " + NAMA_JENIS[j], angka(Object.keys(d.katalog[j]).length)); });
  tambah("Pengaturan usaha (nama, rekening, invoice)", d.settings ? "ada" : "tidak ada");
  if (k && k.txnIds.size) tambah("Tampaknya sudah ada di database (ID berbeda)", angka(k.txnIds.size) + " transaksi");
  tbl.append(tb);
  const w = document.createElement("div"); w.className = "tabel"; w.style.marginTop = "12px"; w.append(tbl); el.append(w);
  /* Transaksi yang sama tapi tercatat dengan ID lain (mis. diisi di dua sistem)
     dilewati secara bawaan supaya tidak dobel. */
  if (k && k.txnIds.size) {
    const box = document.createElement("div"); box.className = "status info";
    const lbl = document.createElement("label"); lbl.style.cssText = "display:flex;gap:8px;align-items:flex-start;cursor:pointer";
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.id = "lewatiKembar"; cb.checked = true; cb.style.marginTop = "3px";
    const teks = document.createElement("span");
    teks.textContent = "Lewati " + angka(k.txnIds.size) + " transaksi yang tanggal, jenis, pihak, dan nilainya sama persis dengan transaksi di database" +
      (k.aset.size ? " (beserta " + angka(k.aset.size) + " aset-nya)" : "") +
      (k.supplies.size ? " dan " + angka(k.supplies.size) + " item bahan yang hanya dipakai transaksi itu" : "") +
      ". Contoh: " + k.contoh.map(t => t.date + " " + (t.party || t.customer || t.type)).join(", ") + ".";
    lbl.append(cb, teks); box.append(lbl); el.append(box);
  }
  if (d.rusak) status("#statusImpor", "info", d.rusak + " transaksi dilewati karena tanggal/jenisnya tidak lengkap.");
  else if (adaSekarang) status("#statusImpor", "info", "Database saat ini sudah berisi " + angka(adaSekarang) + " transaksi. Impor akan menggabungkan, bukan menghapus.");
  else status("#statusImpor", "", "");
}

async function impor() {
  if (!dataImpor) return;
  const lewati = kembar && kembar.txnIds.size && ($("#lewatiKembar") || {}).checked;
  const d = lewati ? buangKembar(dataImpor, kembar) : dataImpor;
  const t = $("#tombolImpor"); t.disabled = true; t.textContent = "Mengimpor…";
  try {
    const batch = writeBatch(fs);
    if (d.settings) batch.set(doc(fs, "master/settings"), bersih(d.settings), { merge: true });
    const jalurKat = [];
    for (const [j, isi] of Object.entries(d.katalog)) for (const id of Object.keys(isi)) jalurKat.push(new FieldPath(j, id));
    if (jalurKat.length) batch.set(doc(fs, "master/catalog"), bersih(d.katalog), { mergeFields: jalurKat });
    for (const [m, isi] of Object.entries(d.perBulan))
      batch.set(doc(fs, "ledger/" + m), { txns: bersih(isi) }, { mergeFields: Object.keys(isi).map(id => new FieldPath("txns", id)) });
    await batch.commit();

    // Verifikasi: baca ulang dari server dan pastikan setiap transaksi di berkas sudah ada.
    const s = await getDocs(collection(fs, "ledger"));
    const diServer = {}; s.docs.forEach(x => Object.assign(diServer, (x.data() || {}).txns || {}));
    let hilang = 0; for (const isi of Object.values(d.perBulan)) for (const id of Object.keys(isi)) if (!diServer[id]) hilang++;
    const kat = (await getDoc(doc(fs, "master/catalog"))).data() || {};
    const ringkas = JENIS_KATALOG.filter(j => d.katalog[j]).map(j => angka(Object.keys(kat[j] || {}).length) + " " + NAMA_JENIS[j]).join(", ");
    if (hilang) status("#statusImpor", "galat", hilang + " transaksi belum terbaca di server. Coba impor sekali lagi.");
    else status("#statusImpor", "ok", "Impor selesai: " + angka(d.jumlahTxn) + " transaksi masuk" + (lewati ? ", " + angka(kembar.txnIds.size) + " kembar dilewati" : "") + " (total di database " + angka(Object.keys(diServer).length) + "). Data master: " + (ringkas || "-") + ". Buka Kitab Roastery untuk melihat hasilnya.");
  } catch (e) {
    status("#statusImpor", "galat", "Impor gagal, tidak ada yang berubah: " + e.message);
  } finally { t.disabled = false; t.textContent = "Impor ke database"; }
}

function pasangImpor() {
  $("#berkasImpor").onchange = async ev => {
    const f = ev.target.files[0]; dataImpor = null; $("#tombolImpor").disabled = true; $("#pratinjau").innerHTML = "";
    if (!f) return;
    try {
      const d = periksaCadangan(JSON.parse(await f.text()));
      const ada = await isiDatabaseSekarang();
      kembar = cariKembar(d, ada.txns, ada.katalog);
      dataImpor = d; tampilPratinjau(d, ada.n, kembar); $("#tombolImpor").disabled = false;
    } catch (e) { status("#statusImpor", "galat", "Berkas tidak bisa dipakai: " + e.message); }
  };
  $("#tombolImpor").onclick = impor;
}

/* -------------------------------- Cadangan -------------------------------- */
function pasangCadangan() {
  $("#tombolCadangan").onclick = async () => {
    try {
      const [st, kat, led] = await Promise.all([getDoc(doc(fs, "master/settings")), getDoc(doc(fs, "master/catalog")), getDocs(collection(fs, "ledger"))]);
      const c = kat.data() || {}; const txns = {};
      led.docs.forEach(x => Object.assign(txns, (x.data() || {}).txns || {}));
      const S = { settings: st.data() || {}, greenbeans: c.greenbeans || {}, supplies: c.supplies || {}, skus: c.skus || {},
        assets: c.assets || {}, customers: c.customers || {}, txns };
      const tgl = new Date().toLocaleDateString("sv-SE");
      const url = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "kitab-roastery-cadangan-" + tgl + ".json";
      document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
      status("#statusCadangan", "ok", "Cadangan berisi " + angka(Object.keys(txns).length) + " transaksi sudah diunduh.");
    } catch (e) { status("#statusCadangan", "galat", "Gagal membuat cadangan: " + e.message); }
  };
}

/* --------------------------------- Mulai --------------------------------- */
$("#tombolKeluar").onclick = keluar;
if (!sudahDikonfigurasi) layar.belumDikonfigurasi(null);
else {
  layar.memuat("Menyiapkan…");
  pantauLogin(async user => {
    if (!user) { layar.masuk("Kelola Tim & Data"); return; }
    let peran;
    try { peran = await cekPeran(user); }
    catch (e) { layar.galat("Gagal memeriksa akun: " + e.message); return; }
    if (peran !== "pemilik") {
      layar.galat("Halaman ini khusus pemilik. Kamu masuk sebagai " + user.email + (peran ? " (" + labelPeran(peran) + ")." : " (belum terdaftar)."),
        () => { location.href = "index.html"; }, "Khusus pemilik", "Buka Kitab Roastery");
      return;
    }
    layar.tutup();
    $("#akunInfo").textContent = user.email + " · Pemilik";
    $("#isi").hidden = false;
    pasangFormAnggota(user); pasangImpor(); pasangCadangan();
    muatAnggota();
  });
}
