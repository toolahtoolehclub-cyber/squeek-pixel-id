# AUDIT v42.5.2 — UNEQUIP + submit tahan koneksi lambat + WalletConnect restore

Client v42.5.2, Worker v12. GitHub head: (diisi setelah push).
Tes: TEST-v34-neo.js 1813/1813 + TEST-v42.5.js 144/144 + TEST-motif.js 11/11 + verify-icon-routes.js 9/9.

## FIX 1 — UNEQUIP (laporan user: "equip jadi permanen, ga bisa dicopot")

Item yang dipakai dulu hanya menampilkan span `EQUIPPED ✓` (bukan tombol).
Sekarang item yang dipakai menampilkan tombol **[ UNEQUIP ]** / `[ LEPAS ]` di
kedua toko (Keju + SQK), per slot (note/frame independen).

- **SQK (lokal):** `unequipSqkItem(itemId)` menghapus slot itu dari
  `sqk41:skin-sqk` + memperbarui `sqk41:skin-last` sehingga skin Keju (bila
  ada) tampil kembali, atau default bila tidak ada. Kepemilikan tidak
  berubah (on-chain `sqkState.owned`).
- **Keju (server):** equipped Keju hidup di Worker (`/cheese/equip`) dan
  `fetchShop()` menyinkronkannya — unequip lokal saja tidak cukup.
  **Endpoint baru Worker v12: POST `/cheese/unequip {wallet, slot}`**
  → validasi wallet + slot ∈ {note, frame}, lalu
  `UPDATE cheese_inventory SET equipped = 0 WHERE wallet = ? AND item_id IN
  (...)` untuk semua item katalog di slot itu, kembali `{ok: true, slot}`.
  Tanpa migrasi D1 (kolom `equipped` sudah ada). Client `unequipItem(slot)`
  memanggil endpoint itu, lalu membersihkan slot Keju lokal +
  `saveSkinLast(slot, 'sqk')` + `fetchShop()`.
- Urutan equip/unequip: SQK → Keju → unequip Keju → SQK tampil lagi;
  Keju → SQK → unequip SQK → Keju tampil lagi. Unequip tidak pernah
  menghapus kepemilikan (item tetap OWNED).
- **Verifikasi live:** baris tes D1 (dead wallet, `note-mint`, equipped=1)
  → POST `/cheese/unequip` → `{"ok":true,"slot":"note"}` → D1 `equipped=0`,
  row tetap ada; `GET /cheese` → `equipped:false`; slot salah → 400.
  Baris tes sudah dihapus; dead wallet 0 di semua tabel.

## FIX 2 — Submit skor gagal di koneksi lambat (laporan user: "update score ga bisa")

Fakta: Worker hidup, tapi submit LIVE 61495 user tidak pernah sampai ke
server (koneksi ~3 K/s; replay puluhan KB butuh >8 detik).

- Timeout POST `/scores` 8 detik → **30 detik**; GET `/scores`, `/rank`,
  `/verify` (fetchLb, fetchLbRank, pollVerify, recheckVerifyOnLeague)
  8 detik → **20 detik**.
- `submitLb` me-retry **SATU kali** bila fetch gagal sebelum ada respons
  (timeout/jaringan) dengan replay yang sama — idempotent, server dedupe
  via `replay_hash`. Respons yang sudah diterima (422/429/400) TIDAK
  pernah di-retry. Retry kedua yang gagal menampilkan pesan berbeda.
- Pesan dibedakan: timeout/koneksi lambat (`KONEKSI LAMBAT — COBA LAGI`)
  vs offline (`lbOffline`), via helper baru `isTimeoutError(e)`
  (AbortError/TimeoutError).
- Tidak ada perubahan pada logika verifikasi, rate limit, atau format replay.

## FIX 3 — WalletConnect session restore gagal total (laporan + konfirmasi user 03:14 WIB)

Connect → refresh → minta connect lagi; restore TIDAK PERNAH berhasil di HP user.

**Diagnosis** (diverifikasi terhadap bundle vendored
`@walletconnect/ethereum-provider` 2.26.0, bukan asumsi):
(a) Restore hanya membaca akun secara PASIF (`p.accounts`, lalu
`eth_accounts`) — ia TIDAK PERNAH memanggil `enable()`/`connect()`.
Pada provider yang belum connect, pembacaan pasif mengembalikan `[]`
walau sesi tersimpan ada. Di bundle: `enable() = this.session ||
await this.connect(), lalu eth_requestAccounts` — bila `this.session`
ada, `connect()` DILEWATI, jadi tidak ada modal dan tidak ada hang.
(b) Sebelum restore bisa jalan, bundle WC 2,1 MB harus diunduh dulu dengan
watchdog 15 detik — mustahil pada cold load di koneksi ~3 K/s; restore
gagal diam-diam sebelum sempat mencoba.

**Perbaikan:**
1. Bila kunci sesi `wc@2:` ada, pembacaan pasif kosong, DAN `p.session`
   ada → panggil `await p.enable()` dalam try/catch. `enable()` TIDAK
   pernah dipanggil bila tidak ada kunci sesi atau tidak ada `p.session`.
   Bila `enable()` reject/kosong → menyerah diam-diam, tetap disconnected.
2. Restore init memakai `showQrModal: false` — di bundle, modal hanya
   dibuka bila `showQrModal` true (`this.rpc.showQrModal &&
   (this.modal?.open(), ...)`), jadi modal TIDAK PERNAH muncul saat page
   load. Provider restore tidak di-cache ke `wcProvider` sebelum restore
   berhasil (connect manual berikutnya tetap init baru dengan modal).
   Connect manual (`wcGetProvider()` tanpa argumen) tidak berubah:
   watchdog 15 detik + `showQrModal: true`.
3. Background-preload bundle saat page load HANYA bila kunci `wc@2:` ada
   (`wcLoadBundle(60000)`); restore menunggu bundle sampai **60 detik**
   (watchdog jadi parameter `wcLoadBundle(timeoutMs)`).
4. Kegagalan restore TERLIHAT: alasan disimpan (`wcRestoreReason`) dan
   ditampilkan sebagai teks kecil di bawah kartu wallet
   (`#wcRestoreNote`, i18n EN+ID `wcRestoreNoteTpl`):
   `bundle-timeout` / `no-accounts` / `enable-rejected`. `no-session-key`
   (belum pernah connect) dicatat tapi tidak ditampilkan — itu keadaan
   normal, bukan kegagalan. Note dibersihkan otomatis saat terhubung.

**Tes baru (19, semua lolos):** sesi + `enable()` → TERHUBUNG; tanpa kunci
sesi → `enable()` TIDAK dipanggil; bundle lambat → restore menunggu dan
berhasil + watchdog 60 detik; `enable()` reject → tanpa modal, tetap
disconnected + alasan tampil; akun pasif ada → `enable()` TIDAK dipanggil;
kunci ada tapi `p.session` kosong → `enable()` TIDAK dipanggil, alasan
`no-accounts`; connect manual tetap `showQrModal: true`; bundle gagal
total → `bundle-timeout`.

## Yang TIDAK berubah

Kontrak, harga, split 70/30, seasonEnd, Project ID, 3 bukti Genesis,
listing Genesis, logika verifikasi replay / rate limit / format replay.

## Catatan board (bukan dari tes — data user asli, JANGAN dihapus)

`verify_queue` kini 3 baris (sebelumnya 2): baris ke-3 adalah GHOST race
user sendiri, `0xb8337604…`, race 34720, v42.5.1, status **rejected**
"simulated score mismatch". Scores tetap 1 baris (race 28280 verified).
Penolakan GHOST race ini di luar scope v42.5.2 — perlu diagnosis terpisah
bila terulang di v42.5.2.

## Verifikasi live (diisi setelah push)

- Worker: `GET /` → version 12 ✓ (sudah, sebelum push)
- Pages: judul v42.5.2 + `gameVersion: 'v42.5.2'`
- `GET /icon.png` + `/og.png` → 200
- 3 bukti Genesis utuh (meta + README + DNS TXT)
- Board D1 tidak berubah (dead wallet 0; Genesis scores 1 baris)
