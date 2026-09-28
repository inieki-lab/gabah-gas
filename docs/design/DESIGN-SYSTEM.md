# GABAH — Authoritative Design System Specification

**Dokumen:** `docs/design/DESIGN-SYSTEM.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Framework UI:** React 19 + Tailwind CSS v4 + Lucide React + Motion  
**Status:** Authoritative Design System (100% Sesuai Antarmuka Aktual)  
**Terakhir Diperbarui:** 28 September 2026  

---

## 1. Prinsip Desain Antarmuka

Antarmuka GABAH dirancang untuk memenuhi kebutuhan portal internal enterprise BUMD Pangan dengan karakteristik:
1. **Kejelasan Informasi Operasional**: Data inventaris, status ketersediaan, tenggat SLA, dan jadwal rapat disajikan dengan kontras tinggi dan hierarki visual tegas.
2. **Disiplin Brand Korporat**: Menggunakan palet resmi PT Food Station Tjipinang Jaya yang mencerminkan ketahanan pangan, integritas BUMD, dan modernitas.
3. **Ergonomi Produktivitas**: Mendukung akses keyboard cepat (`Ctrl+K` untuk Omnibox), feedback status seketika, dan form entri data terstruktur.

---

## 2. Tipografi (Typography)

Sistem menggunakan jenis huruf tunggal modern **Plus Jakarta Sans** yang dimuat pada `index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
```

### Skala Tipografi:
- **Heading 1 (H1 — Page Titles)**: `text-xl sm:text-2xl font-black text-slate-900 tracking-tight`
- **Heading 2 (H2 — Section Titles)**: `text-lg font-bold text-slate-800`
- **Heading 3 (H3 — Modal / Card Titles)**: `text-base font-bold text-slate-800`
- **Body Regular**: `text-xs sm:text-sm font-normal text-slate-600 leading-relaxed`
- **Body Strong**: `text-xs sm:text-sm font-bold text-slate-800`
- **Captions & Metadata**: `text-[10px] sm:text-[11px] font-medium text-slate-400`
- **Badges & Overlines**: `text-[9px] sm:text-[10px] font-black uppercase tracking-wider`

---

## 3. Palet Warna (Color Palette)

### 3.1 Identitas Utama (Corporate Palette)
| Token / Hex | Nama Visual | Peruntukan Utama |
|:---|:---|:---|
| `#4ABDAC` | **Primary Teal** | Warna aksen primer, tombol aksi utama, border fokus input, link aktif |
| `#206f65` | **Deep Forest Teal** | State hover tombol primer, teks kontras tinggi pada background teal muda |
| `#FC4A1A` | **Accent Coral/Peach** | Highlight seleksi teks (`selection:bg-[#FC4A1A]`), badge tiket urgent, status kritis |
| `#F7B733` | **Warning Gold** | Badge pending loan, warning masa garansi, aksen perhatian khusus |
| `#DFDCE3` | **Clean Slate Border** | Border pemisah utama navbar, sidebar, kartu, dan divider form |

### 3.2 Palet Semantik Status
- **Success / Tersedia**: `bg-emerald-50 text-emerald-700 border-emerald-200`
- **Action Required / Pending**: `bg-amber-50 text-amber-700 border-amber-200`
- **Critical / Urgent / Rusak**: `bg-rose-50 text-rose-700 border-rose-200`
- **Informasi / Ditugaskan**: `bg-sky-50 text-sky-700 border-sky-200`
- **Netral / Nonaktif**: `bg-slate-100 text-slate-600 border-slate-200`

---

## 4. Komponen Antarmuka Standar (Component Library)

### 4.1 Tombol (Buttons)
1. **Primary Action**:
   ```html
   <button class="px-4 py-2.5 rounded-xl font-bold text-xs bg-[#4ABDAC] hover:bg-[#206f65] text-white shadow-xs transition-all flex items-center gap-2">
     ...
   </button>
   ```
2. **Secondary / Outline**:
   ```html
   <button class="px-3.5 py-2 rounded-xl font-bold text-xs border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all flex items-center gap-2">
     ...
   </button>
   ```
3. **Danger / Destructive**:
   ```html
   <button class="px-3.5 py-2 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white transition-all">
     ...
   </button>
   ```

### 4.2 Formulir & Input Data (Forms)
- **Input Teks / Angka / Tanggal**:
  ```html
  <input class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4ABDAC]/30 focus:border-[#4ABDAC] transition-all bg-white" />
  ```
- **Label Form**:
  ```html
  <label class="block text-xs font-bold text-slate-700 mb-1.5">
    Nama Label <span class="text-rose-500">*</span>
  </label>
  ```
- **Select Dropdown**:
  ```html
  <select class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#4ABDAC]/30">
    ...
  </select>
  ```

### 4.3 Tabel Data (Data Tables)
- **Header Tabel**:
  ```html
  <thead class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
  ```
- **Baris & Sel Tabel**:
  ```html
  <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
    <td class="px-4 py-3 text-xs text-slate-700">...</td>
  </tr>
  ```

### 4.4 Kartu Konten (Cards)
```html
<div class="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 transition-all hover:shadow-md">
  ...
</div>
```

### 4.5 Kotak Dialog & Modal (Modals)
- **Backdrop Overlay**:
  ```html
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
  ```
- **Wadah Modal (Dialog Container)**:
  ```html
  <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
  ```
- **Header Modal**:
  ```html
  <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 shrink-0">
  ```

---

## 5. Tata Letak & Responsivitas (Layout & Responsive Patterns)

1. **Header Atas (`HeaderNavbar.tsx`)**:
   - Tinggi tetap: `h-16` (`64px`), menempel di atas (`sticky top-0 z-40`).
   - Menyertakan logo resmi GABAH & BUMD Pangan, tombol pencarian Omnibox (`Ctrl+K`), indikator keamanan SSL/TLS, dropdown notifikasi real-time, dan Persona Switcher.
2. **Sidebar Kiri (`Sidebar.tsx`)**:
   - Lebar tetap: `w-64` (`256px`), border kanan `border-[#DFDCE3]`, scroll internal mandiri.
   - Mengelompokkan modul ke dalam 4 bagian: *Operasional Utama*, *Manajemen Inventaris*, *Tata Kelola & Rekanan*, serta *Sistem & Analitik*.
   - Menyajikan tombol **Administration Control Panel** khusus untuk `Admin GABAH`.
3. **Konten Utama**:
   - Pembungkus fleksibel: `flex-1 min-w-0 bg-[#f8f7fa] p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)]`.
4. **Perilaku Mobile**:
   - Pada layar kecil (< 1024px), sidebar dapat disembunyikan/di-toggle, tabel membungkus dalam container overflow horizontal (`overflow-x-auto`), dan modal menyesuaikan padding dengan margin fleksibel.
