# Catatan Audit — Migrasi Sesi Cookie HttpOnly

**Basis pemeriksaan:** commit [0m`19dab19b1f9160342c274b4aecc4bbbfc0b5ae0a` pada `main`  
**Cakupan:** source code dan dokumentasi repository (static review).  
**Bukan:** penetration test, browser UAT, verifikasi konfigurasi produksi, atau persetujuan production-readiness.

## Pemahaman sistem

GABAH adalah aplikasi internal PT Food Station Tjipinang Jaya untuk katalog dan siklus hidup aset lintas owner/lokasi, pinjaman dan BAST, helpdesk/SLA, maintenance, reservasi ruang rapat, kontrak, notifikasi, dan audit trail. Frontend React/TypeScript berkomunikasi dengan REST API Express; layanan domain dan PostgreSQL menangani aturan bisnis, otorisasi, dan persistence. API/backend adalah otoritas untuk RBAC dan mutasi operasional.

## Perubahan transport sesi yang diperiksa

- Browser tidak lagi membaca/menyimpan bearer credential di `localStorage`; permintaan client menggunakan cookie same-origin.
- Server mengeluarkan `gabah_session` sebagai cookie `HttpOnly`, `SameSite=Strict`, path `/`, masa berlaku tujuh hari, dan flag `Secure` saat `NODE_ENV=production`.
- Login, perubahan password, dan alih persona mengeluarkan cookie; logout membersihkannya. Token tidak lagi dikembalikan oleh respons JSON untuk alur tersebut.
- Middleware menolak mutasi yang membawa cookie sesi apabila header `Origin` tidak sama dengan origin yang dibentuk dari protocol dan host request.
- Klien memulihkan sesi melalui endpoint profil, bukan dengan membaca token dari browser storage.

## Temuan dan pekerjaan verifikasi

1. **Transport Bearer lama masih diterima server.** `extractToken` masih memprioritaskan `Authorization: Bearer` dan masih menerima header `x-auth-token` sebelum membaca cookie. Migrasi menghilangkan penyimpanan token dari SPA, tetapi belum menonaktifkan jalur legacy tersebut. Inventarisasi consumer/API test dahulu; setelah migrasi disetujui, hapus jalur lama atau dokumentasikan kebutuhan integrasi yang masih sah. Jangan menyebut cookie sebagai satu-satunya transport sampai ini ditangani.
2. **Origin check perlu diuji pada topologi HTTPS aktual.** Check membandingkan `Origin` dengan `req.protocol` dan `Host`. Bila TLS berakhir di reverse proxy dan Express tidak memperoleh protocol/host eksternal yang benar, request browser sah dapat ditolak. Verifikasi dengan proxy production/staging; konfigurasi trusted proxy dan canonical origin secara eksplisit, bukan dengan mempercayai header forwarding dari sembarang client.
3. **Cookie `Secure` bergantung pada HTTPS di deployment.** Flag aktif hanya saat `NODE_ENV=production`. Pastikan akses browser production memang HTTPS, cookie dikirim pada alur yang didukung, dan port aplikasi tidak dapat diakses publik dengan cara yang melewati TLS edge.
4. **CSP tetap report-only.** Cookie HttpOnly mengurangi pencurian credential lewat JavaScript, tetapi tidak mencegah XSS menjalankan tindakan dalam sesi pengguna. CSP enforcing dan pencegahan XSS tetap tindak lanjut terpisah berdasarkan inventory/UAT.
5. **Dokumentasi utama masih menyebut Bearer/localStorage.** Sinkronkan README, architecture/API design, requirements, project/security policy, serta tes/regression docs sebelum menyatakan dokumentasi sebagai source of truth untuk auth transport.
6. **UAT keamanan belum dibuktikan dalam audit ini.** Uji login, pemulihan sesi setelah reload, logout, expiry, password-change rotation, role switch, upload/download, revoke, serta request lintas origin pada browser untuk setiap alur/role yang relevan. Pastikan legacy token tidak bocor dalam response/log.

## Pemeriksaan yang tercatat

- TypeScript type-check: lulus.
- Production build: lulus; ada peringatan chunk frontend besar.
- Tidak ada browser UAT, live deployment/TLS/proxy check, database restore drill, atau pentest pada pemeriksaan ini.
- Regression check browser-storage diperbarui untuk memverifikasi ketiadaan localStorage auth, atribut cookie, Origin guard, dan ketiadaan token sesi dalam response login/password-change/role-switch.

## Kesimpulan terbatas

Perubahan menghilangkan bearer session dari penyimpanan JavaScript SPA dan menambahkan proteksi CSRF berbasis SameSite plus Origin untuk mutasi yang membawa cookie. Ini adalah pengurangan risiko, bukan bukti bahwa aplikasi bebas XSS atau siap produksi. Temuan jalur Bearer legacy, konfigurasi origin/proxy, HTTPS, dokumentasi yang tertinggal, serta UAT harus ditutup atau diterima eksplisit sebelum klaim penyelesaian penuh.
