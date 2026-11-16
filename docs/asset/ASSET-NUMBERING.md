# GABAH — Authoritative Asset Numbering & Taxonomy Specification

**Dokumen:** `docs/asset/ASSET-NUMBERING.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Authority Kode Sumber:** `server/numbering.ts`, `server/taxonomy.ts`, `server/services.ts`  
**Status:** Spesifikasi aktif; batasan implementasi runtime dicatat pada §4  
**Terakhir Diperbarui:** 16 November 2026  

---

## 1. Format Penomoran Kanonikal

Sistem GABAH menetapkan format penomoran aset resmi yang seragam dan dihasilkan secara otomatis oleh server:

$$\mathbf{\{OWNER\_DIVISION\}-\{ASSET\_CODE\}-\{YEAR\}-\{SEQUENCE\}}$$

Setiap komponen memiliki arti teknis dan akuntansi:
1. `{OWNER_DIVISION}`: Kode divisi pemilik yang bertanggung jawab secara anggaran dan legalitas aset.
2. `{ASSET_CODE}`: Kode spesifik kategori barang berdasarkan taksonomi standar BUMD.
3. `{YEAR}`: 4 digit tahun perolehan/pendaftaran aset (contoh: `2026`).
4. `{SEQUENCE}`: 4 digit angka urut desimal dengan padding nol (`0001`, `0002`, dst.).

---

## 2. Taksonomi Divisi & Kode Kategori Aset

### 2.1 Divisi Teknologi Informasi (`IT`)
Seluruh perangkat keras komputasi dan lisensi digital merupakan aset resmi milik Divisi IT:
| Kode Aset | Nama Kategori | Tipe Taksonomi | Klasifikasi PSAK 16 | Deskripsi Singkat |
|:---|:---|:---:|:---:|:---|
| `HLT` | Laptop / Notebook | `IT` | `IT-H` | Komputer portabel dinas pegawai |
| `HPC` | Komputer Desktop / PC | `IT` | `IT-H` | PC tower kerja kantor |
| `HSV` | Server & Rackmount | `IT` | `IT-H` | Server data center & on-premise |
| `HWS` | Workstation | `IT` | `IT-H` | PC spesifikasi tinggi grafis/analisis |
| `HMON` | Monitor Komputer | `IT` | `IT-H` | Layar display monitor eksternal |
| `HPRN` | Printer & Barcode | `IT` | `IT-H` | Printer laser, inkjet, dan barcode |
| `HSCN` | Scanner Dokumen | `IT` | `IT-H` | Flatbed & ADF scanner arsip |
| `HNET` | Jaringan (Switch/Router) | `IT` | `IT-H` | Switch manageable, router, AP WiFi |
| `HFW` | Firewall Security | `IT` | `IT-H` | Perangkat perlindungan siber jaringan |
| `HSTG` | Storage NAS / SAN | `IT` | `IT-H` | Penyimpanan backup jaringan |
| `HUPS` | UPS Daya Cadangan | `IT` | `IT-H` | Baterai backup server & switch |
| `HRCK` | Rack Server Enclosure | `IT` | `IT-H` | Lemari rackmount data center |
| `SLIC` | Lisensi Software / SaaS | `License` | `IT-S` | Lisensi Microsoft 365, ERP, OS, Antivirus |

### 2.2 Divisi General Affairs & Sarpras (`GA`)
| Kode Aset | Nama Kategori | Tipe Taksonomi | Klasifikasi PSAK 16 | Deskripsi Singkat |
|:---|:---|:---:|:---:|:---|
| `INV-F` | Inventaris Furniture | `General` | `INV-F` | Meja kerja, kursi ergonomis, lemari arsip (Milik GA secara sentral) |
| `INV-P` | Inventaris Peralatan | `General` | `INV-P` | AC split, dispenser, microwave, kulkas, APAR |
| `KDR` | Kendaraan Dinas Kantor | `General` | `KDR` | Mobil dinas Avanza, Innova, Elf, motor patroli |
| `BGN` | Bangunan Fisik & Gudang | `General` | `BGN` | Gedung kantor pusat Cipinang & komplek gudang |
| `TNH` | Tanah & Lahan Korporat | `General` | `TNH` | Lahan kawasan Cipinang & sentra produksi daerah |
| `LNY` | Aset Tetap Lainnya | `General` | `LNY` | Aset sarana penunjang umum lainnya |

### 2.3 Divisi Supply Chain & Logistik (`SC`)
| Kode Aset | Nama Kategori | Tipe Taksonomi | Klasifikasi PSAK 16 | Deskripsi Singkat |
|:---|:---|:---:|:---:|:---|
| `KDR-SC` | Kendaraan Logistik Truk | `General` | `KDR` | Truk tronton beras, fuso wingbox, colt diesel |
| `MSN` | Mesin Pabrik & Forklift | `General` | `MSN` | Rice milling plant, forklift gudang, conveyor |

### 2.4 Divisi Pasar Induk Beras Cipinang (`PIBC`)
| Kode Aset | Nama Kategori | Tipe Taksonomi | Klasifikasi PSAK 16 | Deskripsi Singkat |
|:---|:---|:---:|:---:|:---|
| `MSN-PIBC`| Mesin Timbangan & Tera | `General` | `MSN` | Jembatan timbang truk 60 ton & alat tera resmi |

---

## 3. Contoh Nomor Aset Aktual di Lapangan

1. **Laptop IT Staff**: `IT-HLT-2026-0001`
2. **Server Datacenter Utama**: `IT-HSV-2026-0001`
3. **Lisensi Microsoft 365 E3**: `IT-SLIC-2026-0001`
4. **Meja Kerja Kayu Jati Kantor**: `GA-INV-F-2026-0001`
5. **Mobil Dinas Toyota Innova**: `GA-KDR-2026-0001`
6. **Truk Logistik Fuso Wingbox**: `SC-KDR-SC-2026-0001`
7. **Forklift Komatsu Pergudangan**: `SC-MSN-2026-0001`
8. **Jembatan Timbang Truk 60 Ton PIBC**: `PIBC-MSN-PIBC-2026-0001`

---

## 4. Mekanisme Penomoran & Aturan Duplikasi

### 4.1 Siklus & Reset Sequence
- Kunci sequence runtime: `OWNER_DIVISION:ASSET_CODE:YEAR`.
- Sequence saat ini disinkronkan kembali dari nomor aset yang telah tersimpan ketika server melakukan boot.
- Tahun menjadi bagian dari kunci sehingga counter per tahun dimulai dari nomor pertama untuk kombinasi divisi dan kode aset tersebut.
- **Batasan yang masih harus ditutup sebelum klaim production-ready:** counter generator masih berada di memori proses. Tabel `asset_number_sequences` tersedia pada skema, tetapi belum menjadi jalur atomik yang dipakai `generateAssetNumber()`. Karena itu, multi-instance/concurrent issuance belum dijamin atomik oleh PostgreSQL. Jangan mengklaim concurrency-safe sampai generator dipindahkan ke transaksi/UPSERT database dan diuji lintas proses.

### 4.2 Master Aturan Penomoran
- Aturan tersimpan di tabel `asset_numbering_rules` (Migration 034) dan dikelola melalui Administration Control Panel oleh Superadmin.
- Setiap aturan mengikat kombinasi `owner_division + asset_code`, separator, panjang sequence (3–8 digit), status aktif/nonaktif, dan catatan.
- Jika tidak ada aturan khusus, generator mempertahankan format default `DIV-CODE-YEAR-SEQUENCE` dengan separator strip dan 4 digit.
- Aturan nonaktif menolak penerbitan nomor baru untuk kombinasi tersebut; nomor aset lama tetap valid dan tidak diubah.
- Aturan yang sudah digunakan boleh mengubah separator/panjang sequence selama validasi counter dan collision lolos. Identitas divisi/kode aset tidak dapat diubah setelah digunakan.
- Aturan yang belum pernah digunakan dapat dihapus hanya dengan konfirmasi kode `DIV/CODE` dan alasan minimal 20 karakter. Penghapusan dicatat ke audit log.
- Aturan yang sudah memiliki aset atau sequence tidak dapat dihapus; gunakan Nonaktifkan agar histori tetap utuh.

### 4.3 Validasi Duplikasi Nomor Seri Fisik

### 4.4 Validasi Duplikasi Nomor Seri Fisik
- Sistem memvalidasi keunikan `serial_number`. Jika serial number yang sama sudah ada di database, server menolak pendaftaran dengan pesan:
  `Nomor Seri (Serial Number) "XYZ" sudah terdaftar pada aset IT-HLT-2026-0001 (Laptop Lenovo ThinkPad).`

### 4.5 Nomor Aset Accurate ERP (`corporate_asset_number`)
- Sistem akuntansi BUMD menggunakan Accurate ERP dengan format nomor aset tersendiri (misal: `FA-2024-00892`).
- Nomor Accurate disimpan pada kolom `corporate_asset_number` di tabel `assets`.
- Nilai `corporate_asset_number` diatur dengan constraint **UNIQUE** parsial (jika tidak null) di PostgreSQL:
  ```sql
  CREATE UNIQUE INDEX uq_assets_corporate_number
    ON assets (corporate_asset_number)
    WHERE corporate_asset_number IS NOT NULL;
  ```
- Nomor Accurate tidak pernah menggantikan nomor kanonikal GABAH, melainkan berfungsi sebagai pengait rekonsiliasi akuntansi (*accounting reconciliation key*).

---

## 5. Sumber Otoritas Kode (Authority Reference)
- `server/migrations/034_asset_numbering_rules.sql`: tabel aturan penomoran.
- `server.ts`: API Superadmin untuk membaca, membuat, mengubah, menonaktifkan, dan menghapus aturan dengan guard server-side.

Logika di atas tertanam secara otoritatif pada:
- `server/numbering.ts`: Class `AssetNumberingEngine` yang mengatur sinkronisasi sequence dari memori dan generator atomik.
- `server/taxonomy.ts`: Array `CANONICAL_TAXONOMY` dan fungsi `resolveTaxonomyByHumanName()`.
- `server/services.ts`: Fungsi `createAsset()` pada `GabahDomainService`.
- `server/migrations/001_gabah_normalized_schema.sql`: DDL tabel `assets`, `asset_categories`, dan `asset_number_sequences`.
