# GABAH — Green Enterprise Design System

**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Framework UI:** React 19 + Tailwind CSS v4 + Lucide React  
**Status:** Active design direction — gradual adoption, existing workflows preserved  
**Design reference:** [Shadcn Dashboard](https://github.com/shadcndashboard/shadcndashboard) — free MIT-licensed React + Vite dashboard. GABAH uses the visual direction and adapts it to existing components; it does not replace the application stack or import the template wholesale.

## 1. Prinsip

- Green enterprise: bersih, tenang, profesional, dan konsisten dengan identitas Food Station.
- Utamakan keterbacaan data operasional dan kepadatan informasi yang wajar.
- Pertahankan navigasi, route, RBAC, API, form, dan workflow yang sudah berjalan.
- Gunakan komponen yang sudah ada; hindari dependensi UI baru tanpa kebutuhan nyata.
- Animasi minimal, responsif, dan akses keyboard tetap tersedia.

## 2. Palet

| Token | Warna | Penggunaan |
|---|---|---|
| Green 950 | `#123B2B` | Kontras tinggi / teks gelap |
| Green 900 | `#174D36` | Identitas gelap |
| Green 800 | `#176B45` | Aksi utama dan navigasi aktif |
| Green 700 | `#218653` | Hover dan ikon aktif |
| Green 600 | `#2D9B63` | Fokus dan aksen |
| Green 100 | `#E5F4EB` | Permukaan aktif / selected |
| Green 50 | `#F1F8F3` | Permukaan lembut |
| Canvas | `#F4F8F5` | Latar workspace |
| Surface | `#FFFFFF` | Kartu, form, modal |
| Border | `#E1EBE4` | Garis pemisah |
| Coral | `#FC4A1A` | Kondisi urgent |
| Gold | `#F7B733` | Warning / pending |

Warna teal Food Station lama (`#4ABDAC`, `#206F65`) dipertahankan sebagai compatibility tokens selama migrasi bertahap. Jangan mengganti warna status semantik (success, warning, danger, info) dengan hijau; status harus tetap dapat dibedakan.

## 3. Tipografi

Gunakan **Plus Jakarta Sans**. Hierarki:
- Page title: `text-xl sm:text-2xl font-bold tracking-tight`
- Section title: `text-base sm:text-lg font-semibold`
- Body: `text-xs sm:text-sm`
- Metadata: `text-[10px] sm:text-[11px]`

## 4. Pola Komponen

- **Header:** putih, sticky, border hijau pucat; pencarian terpusat; notifikasi dan tindakan cepat di kanan.
- **Sidebar:** permukaan putih-hijau pucat; section label ringkas; state aktif memakai green-100 + teks green-800, bukan blok warna mencolok.
- **Workspace:** canvas `#F4F8F5`, konten utama fleksibel.
- **Cards:** putih, border tipis `#E1EBE4`, radius konsisten, shadow sangat ringan.
- **Tables:** header netral, pemisah halus, hover lembut, filter dan pagination tetap terlihat.
- **Forms:** label jelas, input putih, border netral, focus ring green.
- **Badges:** gunakan warna semantik; jangan memakai hijau untuk semua status.

## 5. Batasan Perubahan

Perubahan tema hanya menyentuh presentasi. Tidak boleh mengubah:
- role, permission, menu visibility, atau module lifecycle;
- route, API contract, autentikasi, dan session handling;
- validasi form, approval flow, atau aturan bisnis;
- ownership dan scope data per divisi/lokasi;
- struktur database atau migration.

Setiap perubahan UI harus lolos `npm run lint`, `npm run build`, navigation/RBAC regression tests, dan UAT visual pada akun beberapa role.
