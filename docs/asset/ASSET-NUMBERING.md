# GABAH — Authoritative Asset Numbering & Taxonomy Specification

**Dokumen:** `docs/asset/ASSET-NUMBERING.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Authority Kode Sumber:** `server/numbering.ts`, `server/taxonomy.ts`, `server/services.ts`  
**Status:** Spesifikasi desain; status implementasi dibedakan secara eksplisit  
**Terakhir Diperbarui:** 11 November 2026  

---

## 1. Format Penomoran Kanonikal

Format awal yang disepakati untuk owner **IT** dan **GA**:

$$\mathbf{\{OWNER\_DIVISION\}-\{ASSET\_CODE\}-\{YEAR\}-\{SEQUENCE\}}$$

Contoh:
- IT: `IT-HLT-2026-0001`, `IT-HPC-2026-0001`
- GA: `GA-INV-F-2026-0001`, `GA-INV-P-2026-0001`

PIBC dan RPC adalah domain/owner terpisah, bukan kategori aset IT atau GA. Format ringkas yang sedang dipertimbangkan:
- PIBC: `PIBC-XXXX-XXXX`
- RPC: `RPC-XXXX-XXX`

Format ringkas PIBC/RPC belum dianggap aktif oleh generator. Keduanya harus menjadi aturan terpisah yang dapat ditambahkan, diedit, diaktifkan/nonaktifkan, atau dihapus bila belum dipakai melalui master konfigurasi penomoran. Jangan memaksakan format IT/GA kepada PIBC/RPC.

Komponen format IT/GA:
1. `{OWNER_DIVISION}`: kode owner aset yang bertanggung jawab secara anggaran dan legalitas.
2. `{ASSET_CODE}`: kode kategori aset.
3. `{YEAR}`: empat digit tahun pendaftaran.
4. `{SEQUENCE}`: urutan empat digit dengan padding nol.
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

### 2.3 Divisi RPC & Logistik (`RPC`)
| Kode Aset | Nama Kategori | Tipe Taksonomi | Klasifikasi PSAK 16 | Deskripsi Singkat |
|:---|:---|:---:|:---:|:---|
| `KDR-RPC` | Kendaraan Logistik Truk | `General` | `KDR` | Truk tronton beras, fuso wingbox, colt diesel |
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
6. **Truk Logistik Fuso Wingbox**: `RPC-KDR-RPC-2026-0001`
7. **Forklift Komatsu Pergudangan**: `RPC-MSN-2026-0001`
8. **Jembatan Timbang Truk 60 Ton PIBC**: `PIBC-MSN-PIBC-2026-0001`

---

## 4. Mekanisme Penomoran & Aturan Duplikasi

### 4.1 Siklus & Reset Sequence
- Pada mode PostgreSQL, `GabahDomainService.createAsset()` mengalokasikan nomor melalui atomic upsert ke tabel `asset_number_sequences`. `AssetNumberingEngine` berbasis `Map` hanya dipakai sebagai fallback file-store pengembangan.
- Kunci desain sequence IT/GA menggunakan kombinasi:
  $$\text{Key} = \text{OWNER\_DIVISION} : \text{ASSET\_CODE} : \text{YEAR}$$
- Tahun menjadi bagian kunci sehingga sequence tahun baru dimulai dari `0001`. PostgreSQL menghitung nomor tertinggi dari aset existing ketika counter belum tersedia atau tertinggal, lalu menaikkan counter secara atomik. Fallback file-store tetap hanya aman untuk satu proses dan dapat kehilangan counter saat restart.

### 4.2 Validasi Duplikasi Nomor Seri Fisik
- Sistem memvalidasi keunikan `serial_number`. Jika serial number yang sama sudah ada di database, server menolak pendaftaran dengan pesan:
  `Nomor Seri (Serial Number) "XYZ" sudah terdaftar pada aset IT-HLT-2026-0001 (Laptop Lenovo ThinkPad).`

### 4.3 Nomor Aset Accurate ERP (`corporate_asset_number`)
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

## 5. Status Implementasi dan Sumber Kode

Logika di atas tertanam secara otoritatif pada:
- `server/services.ts`: alokasi nomor aset atomik melalui PostgreSQL pada mode database.
- `server/numbering.ts`: `AssetNumberingEngine` untuk fallback file-store pengembangan.
- `server/taxonomy.ts`: Array `CANONICAL_TAXONOMY` dan fungsi `resolveTaxonomyByHumanName()`.
- `server/services.ts`: Fungsi `createAsset()` pada `GabahDomainService`.
- `server/migrations/001_gabah_normalized_schema.sql`: DDL tabel `assets`, `asset_categories`, dan `asset_number_sequences`.
