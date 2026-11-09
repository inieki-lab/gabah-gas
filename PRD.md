# GABAH — Product Requirements Document (PRD)

**Nama Produk:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi Pemilik:** PT Food Station Tjipinang Jaya (Perseroda) — BUMD Pangan DKI Jakarta  
**Versi Sistem:** 2026.1.0-enterprise  
**Status Dokumen:** Baseline kebutuhan bisnis; sinkronisasi implementasi dan UAT masih berjalan (bukan klaim seluruh fitur sudah selesai).  
**Terakhir Diperbarui:** 8 November 2026  

---

## 1. Latar Belakang & Visi Produk

PT Food Station Tjipinang Jaya (Perseroda) mengelola aset bernilai tinggi yang tersebar di berbagai unit operasional strategis:
- Kantor Pusat Cipinang
- Komplek Pergudangan Pasar Induk Beras Cipinang (PIBC)
- Depo Logistik & Transportasi Truk Distribusi Pangan
- Data Center & Server Room
- Sentra Pengolahan Beras (Rice Milling Plant) di daerah mitra

Sebelum adanya GABAH, pencatatan aset inventaris, penjadwalan pemeliharaan armada/mesin, peminjaman barang dinas, pelaporan tiket kendala operasional, dan reservasi fasilitas ruang rapat VIP masih terfragmentasi.

**GABAH** hadir sebagai portal internal perusahaan terpadu (*single pane of glass*) untuk:
1. **Manajemen Inventaris Multi-Divisi**: Pencatatan aset komprehensif (IT Hardware, Software & Lisensi SaaS, Sarana/Prasarana General Affairs, mesin operasional, dan sarana pasar PIBC; owner aset ditetapkan terpisah dari lokasi) dengan klasifikasi akuntansi PSAK 16 BUMD.
2. **Penomoran Aset Standar Korporat**: Generator nomor otomatis terpusat `{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}` dan rekonsiliasi nomor ERP Accurate BUMD.
3. **Peminjaman Aset Anti-Bentrok Jadwal (*Conflict-Free Loans*)**: Validasi tumpang tindih tanggal berbasis server untuk aset pool, alur persetujuan divisi pemilik, dan cetak Berita Acara Serah Terima (BAST).
4. **Helpdesk & Gangguan Layanan (SLA-Driven)**: Pelaporan kendala operasional dengan matriks SLA otomatis (Urgent 4 jam, High 8 jam, Medium 24 jam, Low 48 jam) dan eskalasi teknisi.
5. **Pemeliharaan Berkala (*Preventive Maintenance & Calibration*)**: Kalender servis berkala armada logistik, AC data center, genset, serta uji tera resmi jembatan timbang PIBC.
6. **Reservasi Ruang Rapat VIP & Otomatisasi Fasilitas**: Pemesanan ruang rapat dengan penanganan prioritas Direksi, deteksi tabrakan jadwal, serta perutean notifikasi otomatis multi-divisi (IT Support untuk alat vicon/proyektor, GA Sarpras untuk fisik, GA Pantry untuk konsumsi, dan Humas untuk peliputan/dokumentasi).
7. **Kepatuhan & Audit Trail BUMD**: Pencatatan log mutasi dan aktivitas administratif yang tidak dapat diubah (*immutable audit logs*), inspeksi kepatuhan Satuan Pengawas Internal (SPI/Auditor).
8. **Contract Management (Domain Tersendiri)**: Register kontrak lintas divisi (security → GA, maintenance firewall → IT, supplier beras → SC, layanan pasar → PIBC, kontrak divisi lain sesuai pemilik) dengan PIC, dokumen append-only (original/amendment/renewal/supporting), nilai kontrak, notice period + notice date, reminder kedaluwarsa configurable (default 60/35/7 hari) via in-app, email, dan Telegram dengan log pengiriman per channel berstatus jujur (sent/failed/skipped — tanpa sukses palsu), scheduler otomatis idempoten per hari, keputusan renewal (outcome + notes), dashboard kedaluwarsa berfilter, dan audit trail. **Contract Management adalah domain tersendiri; Contract bukan kategori Helpdesk.** Ticket dapat ditautkan ke Contract (`contract_id`) apabila terdapat pekerjaan yang perlu ditindaklanjuti.

---

## 2. Persona & Pengguna Sasaran (Role Existing — Model Transisi)

Implementasi saat ini masih membawa **9 role legacy** untuk kompatibilitas akun dan data lama. Daftar ini bukan batas jumlah role dan bukan model organisasi target. Model target mengikuti keputusan pada Bagian 2.1–2.2; role legacy akan dipetakan bertahap tanpa menghapus akun atau histori:

| No | Peran (Role) | Persona Uji | Divisi Utama | Lingkup Tanggung Jawab & Hak Akses |
|:---|:---|:---|:---|:---|
| 1 | **Admin GABAH** | Budi Santoso | IT (MIS & TI) | Super Administrator. Kontrol penuh seluruh modul, Master Data, Manajemen Pengguna, Persetujuan Penghapusan Aset (*Disposal*), Override Reservasi, dan Akses Administration Control Panel. |
| 2 | **IT** | Dani Setiawan | IT (MIS & TI) | Pengelola seluruh aset komputasi, hardware jaringan, server, lisensi software, penanganan tiket kategori IT/License, persetujuan pinjaman laptop/proyektor, serta penyiapan fasilitas IT ruang rapat. |
| 3 | **GA** | Siti Rahmawati | General Affairs | Pengelola aset umum (furniture, peralatan kantor, kendaraan dinas, gedung), persetujuan pinjaman kendaraan kantor, pengelolaan tiket GA, persetujuan reservasi ruang rapat, dan koordinasi konsumsi pantry. |
| 4 | **Sekretaris Direksi** | Dewi Anggraini, S.Sos | GA (Sekretariat Direksi) | Pemesanan ruang rapat prioritas tinggi untuk jajaran Direksi & Dewan Komisaris (otomatis disetujui / auto-approved), peminjaman perlengkapan rapat, dan pelaporan kendala eksekutif. |
| 5 | **Humas** | Rina Kartika, M.I.Kom | GA (Humas & Protokoler) | Menerima notifikasi khusus permintaan peliputan dan dokumentasi acara/rapat VIP (foto, video, press release). Akses menu aset disembunyikan sesuai SOP protokoler. |
| 6 | **Supply Chain (legacy)** | Agus Pratama | Lokasi RPC | Akun legacy yang harus dipetakan ke pegawai, jabatan, unit kerja, dan lokasi. Nama lokasi tidak otomatis memberi hak kelola aset atau seluruh tiket. |
| 7 | **PIBC (legacy)** | Bambang Hermawan | Lokasi PIBC | Akun legacy yang harus dipetakan ke pegawai, jabatan, unit kerja, dan lokasi. Nama lokasi tidak otomatis memberi hak kelola aset atau seluruh tiket. |
| 8 | **Karyawan** | Hendra Wijaya | Komersial / Operasional | Staf umum perusahaan. Melihat aset kerja yang ditugaskan (*Aset Saya*), mengajukan peminjaman barang dinas, membuat tiket bantuan IT/GA, dan mereservasi ruang rapat. |
| 9 | **Auditor** | Maya Indriani, SE, Ak, CA | Audit (SPI) | Pengawas kepatuhan internal. Hak akses **Read-Only** ke seluruh modul katalog aset, log sirkulasi, log audit, rekonsiliasi Accurate, dan riwayat helpdesk. Dilarang melakukan mutasi data (403 Forbidden). |

---

## 2.1 Klarifikasi Struktur Organisasi, Lokasi, Kepemilikan Aset, dan Kewenangan Role (Keputusan Bisnis)

> Bagian ini menjadi acuan utama untuk desain data, menu, dashboard, RBAC, dan alur kerja. Nama role, nama kantor/lokasi, unit pemilik aset, serta lokasi fisik tidak boleh dipertukarkan maknanya.

### A. Kepemilikan dan pengelolaan aset ditentukan oleh unit pemilik, bukan lokasi
- **IT mengelola seluruh aset TI perusahaan di semua lokasi**, termasuk PC, laptop, printer/perangkat periferal, server, perangkat jaringan, perangkat rapat/AV yang menjadi domain IT, software, dan lisensi. Aset TI tetap berada dalam tanggung jawab IT meskipun ditempatkan atau digunakan di Kantor Pusat, kantor RPC, PIBC, gudang, depo, atau lokasi operasional lainnya.
- **GA mengelola seluruh aset umum/sarana-prasarana yang menjadi domain GA di semua lokasi**, termasuk furniture, perlengkapan kantor, fasilitas gedung, kendaraan atau aset umum lain sesuai klasifikasi dan penetapan pemiliknya. Aset GA tetap menjadi tanggung jawab GA meskipun berada di kantor RPC, PIBC, gudang, depo, atau lokasi lain.
- **RPC dan PIBC dalam konteks pembahasan ini adalah nama kantor/lokasi operasional**, bukan otomatis unit pemilik atau pengelola semua aset yang berada di sana. Penempatan aset di lokasi tersebut tidak mengubah kepemilikan/pengelola aset.
- Lokasi fisik aset, lokasi kerja pengguna, unit pemilik/pengelola aset (owner_division), custodian/PIC, dan role/permission pengguna harus menjadi dimensi data yang terpisah.
- Jika suatu aset di lokasi cabang dimiliki/dikelola IT, maka IT tetap berwenang mengelola lifecycle dan datanya. Jika aset tersebut milik GA, GA yang mengelolanya. Jangan mengalihkan kewenangan hanya karena aset berada di lokasi cabang.

### B. Matriks kewenangan aset IT, GA, dan Super Admin (keputusan eksplisit)
- **Admin GABAH / Super Admin** memiliki akses global: dapat melihat dan mengelola seluruh aset dari semua owner_division dan seluruh lokasi, termasuk create, update, delete, assign, mutasi lokasi, lifecycle, serta pengaturan administrasi sesuai kebijakan sistem. Tidak dibatasi oleh cakupan divisi atau lokasi.
- **IT** melihat dan mengelola seluruh aset dengan owner_division IT di semua lokasi. IT tidak otomatis memperoleh kewenangan mengelola aset milik GA.
- **GA** melihat dan mengelola seluruh aset dengan owner_division GA di semua lokasi.
- **GA terhadap aset IT dibatasi hanya pada kategori perangkat Laptop dan PC/Desktop** (termasuk notebook/komputer desktop yang diklasifikasikan secara benar). Akses ini hanya **read-only**. GA tidak boleh membuat, mengubah, menghapus, assign, memindahkan lokasi, mengubah owner, atau mengubah status/lifecycle aset IT tersebut.
- **Cakupan tampilan baca GA atas Laptop dan PC milik IT harus dapat dikonfigurasi** melalui permission/menu-view atau kebijakan akses yang dikelola Super Admin. Jika dinonaktifkan, GA tidak melihat aset IT tersebut. Jika diaktifkan, GA hanya melihat Laptop dan PC; bukan server, jaringan, printer, lisensi, perangkat keamanan, konfigurasi, atau seluruh inventaris IT.
- Hak baca terbatas GA tidak membuka data sensitif seperti kredensial, konfigurasi keamanan, detail lisensi tertentu, maupun administrasi infrastruktur.
- Akses baca tidak pernah otomatis memberikan hak create, update, delete, approve, assign, atau admin. Backend wajib menegakkan aturan yang sama; menyembunyikan menu di frontend saja tidak cukup.

### C. Sekretaris Direksi dan Humas tetap pengguna/karyawan dengan kewenangan tambahan
- Pengguna dengan role **Sekretaris Direksi** dan **Humas** tetap merupakan karyawan/staf perusahaan. Keduanya tetap membutuhkan fungsi dasar karyawan, seperti melihat aset yang ditugaskan kepada dirinya, mengajukan peminjaman, membuat tiket bantuan, dan menggunakan fasilitas/reservasi sesuai kebijakan.
- Perbedaan role terletak pada **kewenangan tambahan dan alur kerja khusus**, bukan status kepegawaian atau pemisahan total dari pengalaman dasar karyawan.
- Sekretaris Direksi dapat memiliki kewenangan khusus untuk mengelola kebutuhan agenda Direksi, termasuk reservasi/agenda prioritas sesuai kebijakan. Sekretaris Direksi juga dapat membuat permintaan dukungan Humas (misalnya foto atau dokumentasi rapat Direksi) yang terkait dengan agenda/rapat tertentu.
- Humas memiliki fungsi dasar karyawan sekaligus kewenangan operasional untuk menerima, melihat, mengonfirmasi, dan menangani permintaan peliputan/dokumentasi yang menjadi tugasnya. Humas bukan pemilik aset IT atau GA hanya karena menerima permintaan dukungan.

### D. Alur permintaan dokumentasi dari Sekretaris Direksi kepada Humas
- Form agenda/permintaan rapat Direksi harus menyediakan kebutuhan dokumentasi sebagai pilihan yang jelas, misalnya foto, video, dokumentasi kegiatan, atau kebutuhan publikasi; permintaan juga dapat dibuat/ditindaklanjuti dari agenda yang sudah tersimpan.
- Saat permintaan dokumentasi dikirim, sistem membuat item pekerjaan/permintaan Humas yang tertaut ke agenda atau reservasi terkait. Data minimum mencakup pemohon, agenda/acara, tanggal dan waktu, lokasi, jenis dokumentasi, brief/catatan, serta status permintaan.
- Notifikasi dikirim kepada tim Humas yang relevan. Sistem harus mendukung penentuan penerima berupa **satu staf Humas atau beberapa staf Humas**, bukan mengasumsikan hanya ada satu akun Humas.
- Penerima yang berwenang dapat mengonfirmasi/menolak dengan alasan, mengambil atau menerima penugasan, dan memperbarui progres. Permintaan harus memiliki PIC/assignee yang jelas agar tidak terjadi pekerjaan ganda atau permintaan tanpa penanggung jawab.
- Pemohon (Sekretaris Direksi) dapat melihat status dan PIC permintaan. Tim Humas dapat melihat antrean permintaan yang menjadi cakupan tugasnya. Pengguna lain tidak otomatis dapat melihat detail agenda atau dokumentasi yang bukan kewenangannya.
- Status minimum yang perlu dipertimbangkan: submitted, notified, accepted, assigned, in_progress, completed, cancelled, dan rejected. Status final dan transisi harus ditetapkan dalam desain workflow sebelum implementasi.
- Notifikasi harus tercatat dan status pengiriman tidak boleh mengklaim berhasil apabila pengiriman gagal. Perubahan status dan penugasan harus masuk audit trail.
- Permintaan dokumentasi tidak boleh hanya berupa notifikasi lepas. Harus ada halaman/antrean kerja Humas, detail permintaan, aksi yang berfungsi, status, PIC, dan riwayat yang dapat ditelusuri.

### E. Prinsip desain menu dan akses
- Menu dan halaman dibentuk dari kombinasi **fungsi pekerjaan + permission + cakupan data**, bukan hanya nama role.
- Pengalaman dasar karyawan digunakan bersama (misalnya Aset Saya, Pengajuan/Peminjaman, Tiket Bantuan, dan Reservasi). Sekretaris Direksi dan Humas memperoleh menu/aksi tambahan yang relevan dengan kewenangannya.
- Menu pengelolaan aset IT menampilkan aset IT lintas lokasi dan hanya dapat dimutasi oleh petugas berwenang IT. GA memperoleh tampilan baca aset IT sesuai kebutuhan.
- Menu pengelolaan aset GA menampilkan aset GA lintas lokasi dan dikelola oleh GA.
- Nama kantor/lokasi RPC dan PIBC tidak boleh dipakai sebagai filter kepemilikan aset secara otomatis. Filter lokasi boleh digunakan untuk menemukan aset berdasarkan tempat fisiknya, tanpa mengubah hak kelola.
- Akses harus dibedakan secara eksplisit antara read, create, update, delete, approve, assign, dan admin. Hak read tidak boleh dianggap memberi hak mutasi atau persetujuan.
- Setiap perubahan RBAC, filter data, dashboard, menu, dan endpoint API wajib mengikuti prinsip di atas. Filter frontend hanya untuk pengalaman pengguna; otorisasi final tetap wajib ditegakkan di backend.
### 2.2 Model Target Role Aplikasi, Jabatan, Unit Kerja, dan Lokasi

Bagian ini memperjelas dan menjadi acuan target implementasi. Daftar role legacy pada Bagian 2 tidak boleh ditafsirkan sebagai struktur organisasi permanen.

- **Role aplikasi bukan jabatan dan bukan lokasi.** Role aplikasi adalah paket fungsi yang dapat diberikan kepada pengguna sesuai pekerjaan. Pengguna dapat memperoleh lebih dari satu role aplikasi bila memang diperlukan.
- **Jabatan** adalah Direksi, Kadiv, Kadep, Kasi, Staf, atau jabatan lain yang dikelola melalui master. Jabatan tidak otomatis memberikan permission.
- **Unit kerja** menunjukkan bidang/fungsi organisasi dan dapat berada di kantor pusat maupun cabang.
- **Lokasi kerja** menunjukkan kantor/cabang penempatan pegawai, misalnya HO, RPC, PIBC, atau lokasi lain. Lokasi tidak otomatis memberi akses ke seluruh data di lokasi itu.
- **Permission** menentukan tindakan yang boleh dilakukan (read, create, update, delete, approve, assign, administer). **Data scope** menentukan objek/data yang boleh dijangkau (own, unit, lokasi, owner domain, atau global).
- Menu frontend diturunkan dari permission efektif pengguna. Backend tetap memeriksa permission dan scope pada setiap endpoint dan objek.
- Pengalaman dasar pegawai mencakup Aset Saya, pengajuan peminjaman, tiket bantuan, dan reservasi sesuai permission. Sekretaris Direksi dan Humas mendapat fungsi tambahan sesuai pekerjaan.
- Supply Chain dan PIBC bukan role aplikasi permanen. Akun yang sekarang memakai label tersebut dipertahankan sebagai data transisi, lalu dipetakan ke jabatan/unit/lokasi dan role aplikasi yang tepat oleh Super Admin.
- **Tidak ada migrasi massal owner aset SC/PIBC berdasarkan lokasi.** Nilai owner legacy harus ditinjau per aset dan dipetakan ke pengelola yang benar. Sampai review selesai, aset yang belum jelas kepemilikannya tidak boleh otomatis dipindahkan ke GA atau IT.
- Penambahan cabang atau lokasi baru tidak boleh memerlukan penambahan role aplikasi baru. Super Admin cukup mengelola master organisasi, penempatan pegawai, role, permission, dan scope.

### 2.3 Role Primer, Role Tambahan, dan Scope per Modul

- Setiap pegawai memiliki satu role primer yang selaras dengan role aplikasi dasarnya (misalnya Karyawan, IT, GA, Humas, Sekretaris Direksi, Auditor). Role primer tersimpan selaras dengan profil pengguna.
- Super Admin dapat menetapkan role tambahan kepada pegawai untuk fungsi/jabatan tertentu. Role tambahan menambah permission dan scope tanpa mengganti identitas pegawai, jabatan, unit, atau lokasi kerja.
- Penggantian role primer tidak boleh menghapus role tambahan yang masih sah; role primer lama harus dilepas agar permission lama tidak tertinggal.
- Permission dan scope adalah dua hal berbeda. Permission menjawab tindakan apa yang boleh dilakukan; scope menjawab data mana yang boleh dijangkau.
- Scope wajib memiliki modul (misalnya assets, loans, tickets, vendors, contracts). Scope modul assets tidak otomatis memberi akses ke loans/tickets/contracts, dan sebaliknya.
- Scope '*' (semua modul) dan scope all harus ditetapkan secara eksplisit oleh Super Admin. Resolver backend tetap membatasi owner legacy SC/PIBC agar tidak ikut terbuka ke role operasional biasa.
- Navigasi frontend menggunakan permission efektif. Seluruh endpoint, detail-by-ID, dashboard, pencarian, export, dan aksi mutasi tetap memeriksa permission serta scope di backend.
- Data hasil API yang sudah di-scope backend tidak boleh difilter ulang memakai satu nama role legacy di frontend karena pegawai dapat memiliki role tambahan.
### 2.4 Master Lokasi Aktif dan Owner Domain Fleksibel (Keputusan 8 November 2026)

**Master lokasi kantor aktif saat ini (lima lokasi):**
1. HO (OFF-KP)
2. PIBC (OFF-PIBC)
3. RPC (OFF-RPC)
4. Pangsub (OFF-PANGSUB)
5. Kantor Perawatan (OFF-PERAWATAN)

Subang sudah ditutup. Record historis lokasi Subang, bila ada, harus dinonaktifkan dan dipertahankan untuk referensi historis; jangan diaktifkan kembali sebagai lokasi operasional. Lokasi baru di masa depan ditambahkan melalui master oleh Super Admin tanpa perubahan kode. Menutup lokasi berarti menonaktifkan, bukan menghapus atau mengubah histori user/aset.

**Owner domain aset adalah master fungsi/pemilik yang fleksibel**, bukan daftar enum tetap dan bukan nama lokasi. Contoh nilai saat ini dapat mencakup IT, GA, RPC dan domain operasional lain yang disahkan. Kategori aset, lokasi fisik, lokasi kerja pegawai, unit organisasi, serta custodian tidak boleh otomatis menentukan owner tanpa aturan bisnis yang eksplisit.

- IT tetap mengelola aset owner IT di seluruh lokasi.
- GA tetap mengelola aset owner GA di seluruh lokasi.
- Super Admin dapat mengonfigurasi kebijakan GA yang lebih luas, termasuk pola "semua owner kecuali IT". Kebijakan tersebut adalah opsi konfigurasi, bukan grant otomatis yang boleh diaktifkan tanpa persetujuan bisnis.
- GA hanya memperoleh akses baca tambahan ke Laptop dan PC/Desktop milik IT jika permission khusus assets.read.it_workstations aktif. Akses tersebut tidak memberikan kemampuan mutasi.
- Owner operasional historis berkode SC (yang sebelumnya disebut Supply Chain) tetap merupakan data legacy dan harus diverifikasi sebelum ditetapkan sebagai owner aktif; lokasi kantor RPC tidak otomatis menjadi owner aset. Contoh: mesin produksi/gudang yang berada di lokasi Subang (contoh historis) tetap dapat dimiliki fungsi RPC/SC; lokasi tidak memindahkan owner.
- Data owner historis yang ambigu harus masuk daftar review Super Admin. Tidak boleh ada mass reassignment owner berdasarkan nama cabang, lokasi, atau kategori semata.

### 2.5 Kontrak Data dan Otorisasi Target

- users.role dipertahankan sebagai profil/role primer selama transisi; gabah_user_roles menyimpan role primer dan role tambahan yang aktif. Role tambahan tidak boleh hilang akibat siklus persistensi normal.
- Permission efektif berasal dari gabungan role dinamis yang ditetapkan secara eksplisit; scope diperiksa per modul dan objek. Tidak ada grant hanya karena jabatan atau lokasi kerja.
- Master office location, organizational unit, job level, asset location, owner domain, dan custodian adalah entitas berbeda.
- Semua endpoint list, detail-by-ID, create, update, delete, approve/reject, export, pencarian, dan agregasi harus menerapkan permission serta scope di backend. Menu frontend hanya cerminan hak efektif.
- Migrasi skema/seed boleh berjalan otomatis pada database baru; migrasi data produksi harus didahului backup, dry-run, laporan dampak, rencana rollback, dan persetujuan eksplisit.

---

## 3. Fitur Utama Sistem (Core Capabilities)

### 3.1 Manajemen Aset Multi-Divisi & Taksonomi PSAK 16
- **Catatan transisi owner:** kode owner SC/PIBC pada data lama tidak otomatis dianggap sebagai lokasi maupun dialihkan ke owner baru. Pembuatan aset baru harus mengikuti domain pemilik yang disahkan; data historis owner SC/PIBC menunggu review klasifikasi per aset.
- Pencatatan spesifikasi lengkap: Merek, Model, Nomor Seri, Tanggal Perolehan, Nilai Pembelian, Masa Garansi, Lokasi Fisik, dan Penanggung Jawab (*Custodian*).
- Klasifikasi Aset Tetap PSAK 16:
  - `TNH`: Tanah & Lahan
  - `BGN`: Bangunan Fisik & Gudang
  - `MSN`: Mesin Produksi & Timbangan PIBC
  - `KDR`: Kendaraan Dinas & Truk Logistik
  - `INV-F`: Inventaris Furniture (Wajib Milik Divisi GA secara sentral)
  - `INV-P`: Inventaris Peralatan Kantor (Dispenser, AC, APAR)
  - `IT-H`: Hardware Komputer (Wajib Milik Divisi IT)
  - `IT-S`: Lisensi Software & SaaS (Wajib Milik Divisi IT)
  - `LNY`: Aset Tetap Lainnya
- Siklus Hidup Aset (*Lifecycle*): `active`, `assigned`, `available`, `reserved`, `in_repair`, `damaged`, `cannibalized`, `pending_disposal`, `pending_auction`, `auctioned`, `disposed`, `lost`, `inactive`.
- Integrasi QR Code: Pembuatan kode QR individual, cetak batch label QR standar barcode label, dan pemindai kamera terintegrasi untuk stock opname.

### 3.2 Penomoran Otomatis & Rekonsiliasi ERP
- Generator nomor kanonikal: `{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}`.
- Pemisahan tegas antara nomor sistem kanonikal dan nomor Accurate ERP (`corporate_asset_number`).
- Fitur pencocokan dan penautan nomor Accurate pada modul Rekonsiliasi.

### 3.3 Sirkulasi Peminjaman Barang & BAST
- Katalog barang pinjaman (*loanable assets pool*).
- Validasi pencegahan tabrakan jadwal (*schedule anti-collision*) di backend: mencegah peminjaman aset yang sama pada rentang waktu yang saling bersinggungan.
- Alur 4 tahap: Pengajuan (*Pending*) → Persetujuan Divisi Pemilik (*Approved*) → Serah Terima Fisik (*Borrowed*) → Pengembalian & Inspeksi Kondisi Fisik (*Returned*).
- Generator Berita Acara Serah Terima (BAST) otomatis dengan nomor dokumen resmi, data peminjam, inspeksi fisik, dan klausul tanggung jawab dinas.

### 3.4 Helpdesk Tiket SLA & Eskalasi
- Pelaporan gangguan oleh seluruh karyawan.
- Perhitungan SLA otomatis berbasis jam kerja dan prioritas masalah:
  - `urgent`: SLA 4 jam
  - `high`: SLA 8 jam
  - `medium`: SLA 24 jam
  - `low`: SLA 48 jam
- Penugasan teknisi (*Assignee*), pelacakan status (`open`, `in_progress`, `pending_vendor`, `resolved`, `closed`), catatan solusi (*resolution notes*), dan rating kepuasan.

### 3.5 Kategori Helpdesk Ticket (Strict Divisional)
Kategori tujuan tiket helpdesk adalah **IT**, **GA**, dan **ME (Mechanical, Electrical & Tim Perawatan)**. PIBC dan RPC adalah lokasi, bukan kategori tiket.
- Software/License/SaaS (Accurate, Microsoft 365, VPN, aktivasi lisensi) → kategori `IT` (License adalah domain aset, bukan kategori tiket).
- Hardware, jaringan, server, akun, software/lisensi → `IT`; fasilitas umum/gedung/kendaraan dinas → `GA`; mesin, kelistrikan, mekanikal/elektrikal, dan perawatan teknis lingkup Tim Perawatan → `ME` (unit `UNIT-PIBC-ME` di bawah PIBC). Lokasi RPC/PIBC tidak menentukan kategori tiket.
- **Contract Management adalah domain tersendiri dan BUKAN kategori Helpdesk.** Ticket dapat ditautkan ke Contract apabila terdapat pekerjaan/action yang perlu ditindaklanjuti (`contract_id` pada tiket).

### 3.6 Preventive Maintenance & Kalibrasi Tera
- Penjadwalan perawatan berkala: Mingguan, Bulanan, Triwulan, Semester, Tahunan, atau Insidental.
- Pencatatan teknisi, vendor rekanan, estimasi biaya, realisasi biaya, dan checklist pekerjaan teknis.
- Pengawasan kalibrasi tera berkala jembatan timbang 60 ton PIBC.

### 3.7 Reservasi Ruang Rapat VIP & Integrasi Lintas Divisi
- Manajemen ruang rapat representatif (Ruang Rapat VIP Direksi, Ruang Rapat Cipinang Utama, Ruang Rapat Distribusi SPHP, Ruang Rapat IT Center).
- Alur reservasi:
  - Reservasi oleh Sekretaris Direksi: Otomatis disetujui (*auto-approved*) dengan prioritas High.
  - Reservasi oleh Karyawan/Divisi lain: Menunggu persetujuan GA (*pending_approval*).
- Notifikasi Terpadu Otomatis:
  - Notifikasi ke IT Support jika fasilitas IT dipilih (Polycom Studio, Smart TV 85", Laser Projector, Kabel HDMI, Audio Visual).
  - Notifikasi ke GA Sarpras untuk fasilitas fisik (Sound System, Mic Wireless, Whiteboard, Podium).
  - Notifikasi ke GA Pantry untuk pesanan konsumsi (Snack Box, Lunch Box, Coffee/Tea Break, VIP Buffet).
  - Notifikasi ke Humas untuk permintaan peliputan media dan dokumentasi foto/video.
- Fitur Check-In dan Check-Out ruangan secara real-time.

### 3.8 Direktori Vendor dan Owner Domain

- Vendor memiliki kategori layanan (contoh: IT Hardware, License, Maintenance, General) dan owner domain yang terpisah.
- Kategori vendor tidak boleh otomatis menentukan owner. Vendor kategori IT Hardware dapat dimiliki fungsi lain jika kebijakan bisnis menyatakannya.
- Owner vendor harus dipilih dari master owner domain yang aktif. Owner domain dapat ditambah oleh Super Admin tanpa perubahan kode.
- IT, GA, dan role operasional lain hanya dapat melihat/mengelola vendor sesuai permission modul vendors dan scope owner yang diberikan.
- Perubahan owner vendor memerlukan kewenangan atas owner asal dan owner tujuan. Vendor lama tanpa owner hanya dapat diklasifikasikan oleh Super Admin.
- Owner domain tidak boleh dihapus selama masih direferensikan vendor, kontrak, aset, maintenance, peminjaman, kategori, pegawai, atau unit organisasi.
- Tidak boleh menampilkan metrik SLA atau kontrak yang tidak berasal dari data aktual.

### 3.9 Administration Control Panel (Khusus Super Admin)
- Disediakan secara eksklusif untuk peran `Admin GABAH`:
  1. Manajemen Pengguna (Tambah, Edit, Nonaktifkan Akun, Reset Password).
  2. Matriks Peran & Izin Akses (RBAC Viewer).
  3. Struktur Organisasi (Kelola Divisi & Departemen dinamis).
  4. Master Taksonomi Aset (Kategori, Kode, Masa Depresiasi).
  5. Master Lokasi Fasilitas Gudang & Kantor.
  6. Master Tipe & Fasilitas Ruang Rapat.
  7. Log Audit Trail Komprehensif dengan filter entitas.
  8. Konfigurasi SLA & Kebijakan Sistem.

---

## 4. Kriteria Keberhasilan & Batasan Teknis

1. **Keandalan Data (Persistence)**: PostgreSQL 17 adalah sumber data produksi yang otoritatif. Data inti menggunakan tabel relasional; sebagian domain yang belum dinormalisasi masih tersimpan pada state payload PostgreSQL dan harus tetap diuji melalui CRUD serta restart. File-store lokal hanya mode pengembangan, bukan backup atau fallback produksi.
2. **Kepatuhan RBAC**: Tidak ada akses di luar permission dan scope owner yang disahkan. Owner aset/vendor tidak ditentukan oleh lokasi. IT dan GA mengelola domain masing-masing; owner operasional lain dapat ditambahkan melalui master. GA hanya membaca Laptop/PC owner IT bila permission khusus aktif. Auditor read-only.
3. **Kinerja UI**: Render antarmuka responsif tanpa lag, Tailwind CSS v4, dynamic counter badges, dan navigasi instan via Quick Search Omnibox (`Ctrl+K`).
4. **Verifikasi Teknis**: 0 lint error (`tsc --noEmit`), build produksi sukses (`vite build && node scripts/build-server.cjs`), dan berjalan stabil pada Docker container.
