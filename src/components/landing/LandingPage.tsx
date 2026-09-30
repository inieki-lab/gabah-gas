import React from 'react';
import { 
  Building2, 
  ShieldCheck, 
  LogIn, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Laptop, 
  Truck, 
  QrCode, 
  TrendingUp, 
  BarChart3, 
  Layers, 
  Phone, 
  Mail, 
  MapPin, 
  Sparkles,
  ChevronRight,
  Database,
  Search,
  KeyRound,
  FileCheck
} from 'lucide-react';
import { UserProfile } from '../../types';
import { INITIAL_USERS } from '../../data/mockData';

interface LandingPageProps {
  onOpenLogin: () => void;
  onQuickLogin: (user: UserProfile) => void;
  demoUsers?: UserProfile[];
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenLogin,
  onQuickLogin,
  demoUsers = INITIAL_USERS,
}) => {
  const usersList = (demoUsers && demoUsers.length > 0) ? demoUsers : INITIAL_USERS;
  const superAdminUser = usersList.find(u => u.role === 'Admin GABAH') || usersList[0] || INITIAL_USERS[0];
  const gaAdminUser = usersList.find(u => u.role === 'GA') || usersList[2] || INITIAL_USERS[2];
  const itAdminUser = usersList.find(u => u.role === 'IT') || usersList[1] || INITIAL_USERS[1];
  const employeeUser = usersList.find(u => u.role === 'Karyawan') || usersList[4] || INITIAL_USERS[4];

  return (
    <div className="min-h-screen bg-[#f8f7fa] text-slate-900 flex flex-col font-sans selection:bg-[#FC4A1A] selection:text-white">
      
      {/* 1. CORPORATE HEADER (Clean Palette with Fresh #4ABDAC & Vermillion #FC4A1A accents) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#DFDCE3] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#4ABDAC] flex items-center justify-center text-white shadow-md shadow-[#4ABDAC]/30 border border-[#3ea395]">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-2xl tracking-tight text-slate-900">GABAH</span>
                <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#4ABDAC]/15 text-[#2d7f74] border border-[#4ABDAC]/40">
                  FOOD STATION
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 hidden sm:block">
                General Asset, Business &amp; Automated Helpdesk — BUMD Pangan DKI Jakarta
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <a href="#fitur" className="hover:text-[#4ABDAC] transition-colors">Modul Sistem</a>
            <a href="#operasional" className="hover:text-[#4ABDAC] transition-colors">Status Operasional</a>
            <a href="#akun-demo" className="hover:text-[#4ABDAC] transition-colors">Daftar Akun</a>
          </nav>

          {/* Login CTA Button (Vermillion #FC4A1A) */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FC4A1A] hover:bg-[#e03f14] text-white font-bold text-sm transition-all shadow-md shadow-[#FC4A1A]/25 hover:shadow-lg active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>Masuk Portal</span>
            </button>
          </div>

        </div>
      </header>

      {/* 2. HERO SECTION (Immersive FRESH #4ABDAC Background with Clean & Vermillion elements) */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-18 lg:pb-24 bg-gradient-to-br from-[#4ABDAC] via-[#40aba8] to-[#34988a] text-white border-b border-[#369588]">
        
        {/* Ambient atmospheric glows */}
        <div className="absolute top-0 right-0 w-[30rem] h-[30rem] bg-white/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#F7B733]/20 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Headline & Pitch */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-[#F7B733]" />
                <span>Portal Resmi BUMD PT Food Station Tjipinang Jaya (Perseroda)</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.16] drop-shadow-xs">
                Sistem Terpadu Pengelolaan <span className="text-[#F7B733]">Aset, Fasilitas</span> &amp; <span className="text-[#DFDCE3]">Helpdesk</span>
              </h1>

              <p className="text-base sm:text-lg text-white/90 leading-relaxed font-normal max-w-2xl">
                Mendukung kelancaran operasional Pasar Induk Beras Cipinang (PIBC) melalui tata kelola aset fisik, armada logistik, lisensi enterprise, peminjaman terjadwal, dan pelaporan terpadu.
              </p>

              {/* Action Buttons with Vermillion #FC4A1A and Sunshine #F7B733 */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={onOpenLogin}
                  className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#FC4A1A] hover:bg-[#e03f14] text-white font-extrabold text-sm sm:text-base transition-all shadow-xl shadow-[#FC4A1A]/30 active:scale-95"
                >
                  <LogIn className="w-5 h-5" />
                  <span>Akses Portal Pegawai</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <a
                  href="#akun-demo"
                  className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#F7B733] hover:bg-[#e5a828] text-slate-900 font-bold text-sm sm:text-base transition-all shadow-md shadow-[#F7B733]/25 active:scale-95"
                >
                  <KeyRound className="w-4 h-4 text-slate-900" />
                  <span>Daftar Akun &amp; Sandi</span>
                </a>
              </div>

              {/* Trust & Operational Badges */}
              <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-white/95 font-medium">
                <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg backdrop-blur-xs border border-white/20">
                  <CheckCircle2 className="w-4 h-4 text-[#F7B733] shrink-0" />
                  <span>Pencatatan Aset &amp; QR Code</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg backdrop-blur-xs border border-white/20">
                  <CheckCircle2 className="w-4 h-4 text-[#F7B733] shrink-0" />
                  <span>Peminjaman Anti-Bentrok</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg backdrop-blur-xs border border-white/20">
                  <CheckCircle2 className="w-4 h-4 text-[#F7B733] shrink-0" />
                  <span>Helpdesk Layanan Terpadu</span>
                </div>
              </div>

            </div>

            {/* Right Card: REPLACED QUOTE CARD with LIVE OPERATIONAL METRICS & ROLE ACCESS */}
            <div id="operasional" className="lg:col-span-5">
              <div className="bg-white rounded-3xl border border-[#DFDCE3] shadow-2xl p-6 relative overflow-hidden text-slate-900">
                
                {/* Header with Live Status Pulse */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#4ABDAC] text-white flex items-center justify-center font-black text-xs shadow-xs">
                      FS
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">Kontrol Operasional Terpadu</div>
                      <div className="text-[10px] text-slate-500">Pasar Induk Beras Cipinang (PIBC)</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>100% Aktif</span>
                  </div>
                </div>

                {/* Key Operational Highlights (Replaces the random quote card) */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="p-2.5 rounded-xl bg-[#f8f7fa] border border-[#DFDCE3] text-center">
                    <div className="text-base font-black text-[#4ABDAC]">4.280+</div>
                    <div className="text-[10px] text-slate-500 font-medium">Aset Terdata</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#f8f7fa] border border-[#DFDCE3] text-center">
                    <div className="text-base font-black text-[#FC4A1A]">99.8%</div>
                    <div className="text-[10px] text-slate-500 font-medium">Armada Siap</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#f8f7fa] border border-[#DFDCE3] text-center">
                    <div className="text-base font-black text-[#F7B733]">&lt; 2 Jam</div>
                    <div className="text-[10px] text-slate-500 font-medium">SLA Respon</div>
                  </div>
                </div>

                {/* Quick Role Direct Access */}
                <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center justify-between">
                  <span>Akses Cepat Peran:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Pilih Peran</span>
                </div>

                <div className="space-y-2">
                  {/* 1. Super Admin */}
                  {superAdminUser && (
                    <div className="p-2 rounded-xl border border-slate-200 bg-[#f8f7fa] hover:bg-[#4ABDAC]/10 hover:border-[#4ABDAC] transition-all flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <img 
                          src={superAdminUser.avatar} 
                          alt={superAdminUser.name} 
                          className="w-8 h-8 rounded-full object-cover border-2 border-[#4ABDAC] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate">{superAdminUser.name}</span>
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#4ABDAC]/15 text-[#2d7f74] border border-[#4ABDAC]/30">
                              Super Admin
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">Akses Penuh &amp; Audit Log</div>
                        </div>
                      </div>
                      <button
                        onClick={() => onQuickLogin(superAdminUser)}
                        className="px-3 py-1 rounded-lg bg-[#4ABDAC] hover:bg-[#3ea395] text-white font-bold text-[11px] whitespace-nowrap transition-colors shadow-xs shrink-0"
                      >
                        Masuk
                      </button>
                    </div>
                  )}

                  {/* 2. Admin (General Affairs) */}
                  {gaAdminUser && (
                    <div className="p-2 rounded-xl border border-slate-200 bg-[#f8f7fa] hover:bg-[#F7B733]/15 hover:border-[#F7B733] transition-all flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <img 
                          src={gaAdminUser.avatar} 
                          alt={gaAdminUser.name} 
                          className="w-8 h-8 rounded-full object-cover border-2 border-[#F7B733] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate">{gaAdminUser.name}</span>
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#F7B733]/20 text-amber-900 border border-[#F7B733]/40">
                              Admin GA
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">Armada &amp; Fasilitas Gedung</div>
                        </div>
                      </div>
                      <button
                        onClick={() => onQuickLogin(gaAdminUser)}
                        className="px-3 py-1 rounded-lg bg-[#F7B733] hover:bg-[#e5a828] text-slate-900 font-bold text-[11px] whitespace-nowrap transition-colors shadow-xs shrink-0"
                      >
                        Masuk
                      </button>
                    </div>
                  )}

                  {/* 3. IT Admin */}
                  {itAdminUser && (
                    <div className="p-2 rounded-xl border border-slate-200 bg-[#f8f7fa] hover:bg-[#4ABDAC]/10 hover:border-[#4ABDAC] transition-all flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <img 
                          src={itAdminUser.avatar} 
                          alt={itAdminUser.name} 
                          className="w-8 h-8 rounded-full object-cover border-2 border-[#4ABDAC] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate">{itAdminUser.name}</span>
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#4ABDAC]/15 text-[#2d7f74] border border-[#4ABDAC]/30">
                              IT Admin
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">Perangkat Kerja &amp; Jaringan</div>
                        </div>
                      </div>
                      <button
                        onClick={() => onQuickLogin(itAdminUser)}
                        className="px-3 py-1 rounded-lg bg-[#4ABDAC] hover:bg-[#3ea395] text-white font-bold text-[11px] whitespace-nowrap transition-colors shadow-xs shrink-0"
                      >
                        Masuk
                      </button>
                    </div>
                  )}

                  {/* 4. Pegawai */}
                  {employeeUser && (
                    <div className="p-2 rounded-xl border border-slate-200 bg-[#f8f7fa] hover:bg-slate-100 hover:border-slate-300 transition-all flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <img 
                          src={employeeUser.avatar} 
                          alt={employeeUser.name} 
                          className="w-8 h-8 rounded-full object-cover border-2 border-slate-400 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate">{employeeUser.name}</span>
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#DFDCE3] text-slate-800 border border-slate-300">
                              Pegawai
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">Layanan Mandiri Pinjam &amp; Tiket</div>
                        </div>
                      </div>
                      <button
                        onClick={() => onQuickLogin(employeeUser)}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] whitespace-nowrap transition-colors shadow-xs shrink-0"
                      >
                        Masuk
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer note */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 text-center">
                  <button
                    onClick={onOpenLogin}
                    className="text-xs font-bold text-[#FC4A1A] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Masuk Menggunakan Email &amp; Password Manual</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. FITUR UTAMA & 4 PILAR GABAH */}
      <section id="fitur" className="py-16 bg-white border-b border-[#DFDCE3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#2d7f74] bg-[#4ABDAC]/15 border border-[#4ABDAC]/30 px-3.5 py-1 rounded-full">
              Pilar Keunggulan Operasional
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
              Dirancang Khusus untuk Kebutuhan BUMD Pangan DKI Jakarta
            </h2>
            <p className="text-slate-600 text-sm mt-2">
              Mengintegrasikan fungsi aset logistik beras, teknologi informasi, general affairs, dan helpdesk dalam satu platform transparan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1: Manajemen Aset & Barcode */}
            <div className="p-6 rounded-2xl bg-[#f8f7fa] border border-[#DFDCE3] hover:border-[#4ABDAC] hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-xl bg-[#4ABDAC]/15 text-[#4ABDAC] flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-[#4ABDAC] group-hover:text-white transition-all">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-1">Manajemen Aset &amp; Barcode</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pencatatan menyeluruh aset IT, fasilitas gedung, armada operasional, dan lisensi dengan penomoran unik standar dan label QR siap cetak.
              </p>
            </div>

            {/* Card 2: Peminjaman Terjadwal */}
            <div className="p-6 rounded-2xl bg-[#f8f7fa] border border-[#DFDCE3] hover:border-[#F7B733] hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-xl bg-[#F7B733]/20 text-[#d49210] flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-[#F7B733] group-hover:text-slate-900 transition-all">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-1">Peminjaman Aset Terjadwal</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Peminjaman laptop, proyektor, dan kendaraan operasional dilindungi verifikasi ketersediaan jadwal otomatis anti-bentrok.
              </p>
            </div>

            {/* Card 3: Monitoring Siklus Hidup Aset */}
            <div className="p-6 rounded-2xl bg-[#f8f7fa] border border-[#DFDCE3] hover:border-[#FC4A1A] hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-xl bg-[#FC4A1A]/15 text-[#FC4A1A] flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-[#FC4A1A] group-hover:text-white transition-all">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-1">Monitoring Siklus Hidup Aset</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pelacakan kondisi fisik, riwayat servis pemeliharaan, serta masa pakai aset secara terukur dan transparan.
              </p>
            </div>

            {/* Card 4: Helpdesk & Tiket Layanan */}
            <div className="p-6 rounded-2xl bg-[#f8f7fa] border border-[#DFDCE3] hover:border-[#4ABDAC] hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-xl bg-[#4ABDAC]/15 text-[#4ABDAC] flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-[#4ABDAC] group-hover:text-white transition-all">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-1">Helpdesk &amp; Layanan Cepat</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pusat pelaporan gangguan teknis IT dan perbaikan sarana kantor dengan pemantauan status SLA pengerjaan yang terorganisir.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 4. AKUN DEMO & PASSWORD SEMENTARA SECTION */}
      <section id="akun-demo" className="py-16 bg-[#f8f7fa] border-b border-[#DFDCE3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#2d7f74] bg-[#4ABDAC]/15 border border-[#4ABDAC]/30 px-3 py-1 rounded-full">
                Akses Pegawai &amp; Kredensial
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                Daftar Akun Pengguna
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm mt-1">
                Kredensial akun tidak ditampilkan di halaman publik. Gunakan kredensial resmi yang Anda terima dari Administrator melalui proses provisioning.
              </p>
            </div>

            <button
              onClick={onOpenLogin}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FC4A1A] hover:bg-[#e03f14] text-white font-bold text-xs sm:text-sm transition-all shrink-0 self-start md:self-auto shadow-md shadow-[#FC4A1A]/20"
            >
              <LogIn className="w-4 h-4" />
              <span>Buka Form Login Manual</span>
            </button>
          </div>

          {/* Cards of Demo Users */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {demoUsers.map((user) => (
              <div 
                key={user.id}
                className="bg-white rounded-2xl border border-[#DFDCE3] p-5 shadow-xs hover:shadow-md hover:border-[#4ABDAC] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <img 
                      src={user.avatar} 
                      alt={user.name} 
                      className="w-11 h-11 rounded-full object-cover border-2 border-[#4ABDAC]/50"
                    />
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{user.name}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#DFDCE3]/60 text-slate-700 border border-[#DFDCE3] inline-block mt-0.5">
                        {user.role_label}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Unit Kerja</div>
                      <div className="font-medium text-slate-700">{user.department}</div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Email Login</div>
                      <div className="font-mono text-slate-800 font-medium">{user.email}</div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-600 font-semibold uppercase flex items-center gap-1">
                        <KeyRound className="w-3 h-3 text-[#FC4A1A]" />
                        <span>Password Sementara</span>
                      </div>
                      <div className="font-mono font-bold text-amber-900 bg-[#F7B733]/15 px-2 py-1 rounded border border-[#F7B733]/30 mt-0.5">
                        ********
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => onQuickLogin(user)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#4ABDAC] hover:bg-[#3ea395] text-white font-bold text-xs transition-colors shadow-xs"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Gunakan Akun Ini</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 5. FOOTER RESMI (PIBC Food Station BUMD Pangan DKI) */}
      <footer className="bg-white border-t border-[#DFDCE3] text-slate-600 text-xs py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-[#DFDCE3]">
            
            {/* Col 1: Instansi */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#4ABDAC] flex items-center justify-center text-white font-black shadow-xs">
                  FS
                </div>
                <div>
                  <div className="font-black text-slate-900 text-sm">PT FOOD STATION TJIPINANG JAYA (PERSERODA)</div>
                  <div className="text-[11px] text-slate-500">Badan Usaha Milik Daerah (BUMD) Pangan Pemerintah Provinsi DKI Jakarta</div>
                </div>
              </div>
              <p className="text-slate-500 leading-relaxed text-xs max-w-md">
                Pengelola tunggal Pasar Induk Beras Cipinang (PIBC) sebagai pusat perdagangan beras terbesar di Asia Tenggara dan stabilisator ketahanan pangan ibukota.
              </p>
            </div>

            {/* Col 2: Alamat Kantor & PIBC */}
            <div className="space-y-2">
              <div className="font-bold text-slate-900">Lokasi Operasional</div>
              <p className="text-slate-500 leading-relaxed text-xs">
                Pasar Induk Beras Cipinang (PIBC)<br />
                Jl. Pisangan Timur, Cipinang, Pulo Gadung<br />
                Jakarta Timur 13230 - DKI Jakarta
              </p>
            </div>

            {/* Col 3: Layanan Helpdesk IT & GA */}
            <div className="space-y-2">
              <div className="font-bold text-slate-900">Kontak Service Desk</div>
              <p className="text-slate-500 leading-relaxed text-xs">
                Telepon: (021) 4786-8888<br />
                Email: helpdesk@foodstation.co.id<br />
                Jam Kerja: Senin – Jumat 08.00 – 17.00 WIB
              </p>
            </div>

          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
            <div>
              &copy; {new Date().getFullYear()} PT Food Station Tjipinang Jaya (Perseroda). Seluruh Hak Cipta Dilindungi Undang-Undang.
            </div>
            <div className="flex items-center gap-4">
              <span>GABAH Enterprise Portal v2.4</span>
              <span>•</span>
              <span>Proxmox VM Certified</span>
              <span>•</span>
              <button onClick={onOpenLogin} className="text-[#FC4A1A] hover:underline font-bold">
                Pintu Masuk Pegawai
              </button>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
};
