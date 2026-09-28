import React, { useState } from 'react';
import {
  Package,
  Laptop,
  Monitor,
  Car,
  CalendarClock,
  LifeBuoy,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Building2,
  FileText,
  Eye,
  ArrowRight,
  UserCheck,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { Asset, Loan, UserProfile } from '../../types';
import { formatRupiah, formatDateTime, formatDate } from '../../services/gabahService';

interface MyAssetsViewProps {
  assets: Asset[];
  loans: Loan[];
  currentUser: UserProfile;
  onSelectAsset?: (asset: Asset) => void;
  onReportAsset?: (asset: Asset) => void;
  onOpenNewLoanModal?: () => void;
  onOpenNewTicketModal?: () => void;
  onReturnLoan?: (loanId: string) => void;
}

export const MyAssetsView: React.FC<MyAssetsViewProps> = ({
  assets = [],
  loans = [],
  currentUser,
  onSelectAsset,
  onReportAsset,
  onOpenNewLoanModal,
  onOpenNewTicketModal,
  onReturnLoan,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'assigned' | 'loaned'>('all');

  // Find assets assigned to this user
  const assignedAssets = assets.filter((asset) => {
    if (!asset.assigned_to) return false;
    const assignedId = asset.assigned_to.id;
    const assignedEmail = asset.assigned_to.email?.toLowerCase();
    const currentEmail = currentUser.email?.toLowerCase();
    const assignedName = asset.assigned_to.name?.toLowerCase();
    const currentName = currentUser.name?.toLowerCase();

    return (
      assignedId === currentUser.id ||
      (assignedEmail && currentEmail && assignedEmail === currentEmail) ||
      (assignedName && currentName && (assignedName.includes(currentName) || currentName.includes(assignedName)))
    );
  });

  // Find active loans currently held by this user
  const myCurrentLoans = loans.filter((loan) => {
    const isBorrower =
      loan.borrower_id === currentUser.id ||
      loan.borrower_name?.toLowerCase().includes(currentUser.name.toLowerCase());
    const isActive = ['approved', 'borrowed', 'active'].includes(loan.status);
    return isBorrower && isActive;
  });

  // Calculate total value
  const totalAssignedValue = assignedAssets.reduce(
    (sum, a) => sum + (a.purchase_price || a.price || 0),
    0
  );

  const getCategoryIcon = (categoryType?: string, subcategory?: string) => {
    if (subcategory?.toLowerCase().includes('laptop')) {
      return <Laptop className="w-5 h-5 text-blue-600" />;
    }
    if (subcategory?.toLowerCase().includes('desktop') || subcategory?.toLowerCase().includes('pc')) {
      return <Monitor className="w-5 h-5 text-indigo-600" />;
    }
    if (categoryType === 'GA' || subcategory?.toLowerCase().includes('mobil') || subcategory?.toLowerCase().includes('kendaraan')) {
      return <Car className="w-5 h-5 text-amber-600" />;
    }
    return <Package className="w-5 h-5 text-[#4ABDAC]" />;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#4ABDAC]/15 text-[#206f65] border border-[#4ABDAC]/30 text-xs font-bold mb-2">
              <UserCheck className="w-3.5 h-3.5" />
              Inventaris Karyawan
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Aset &amp; Perangkat Saya
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl font-normal">
              Daftar seluruh perangkat kantor yang ditugaskan kepada Anda (<span className="font-semibold text-slate-800">{currentUser.name}</span> - {currentUser.department}) beserta aset operasional yang sedang dipinjam.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onOpenNewTicketModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold transition-all shadow-xs"
            >
              <LifeBuoy className="w-4 h-4 text-rose-600" />
              Lapor Kendala Baru
            </button>
            <button
              onClick={onOpenNewLoanModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4ABDAC] hover:bg-[#3ba393] text-white text-xs font-bold transition-all shadow-xs"
            >
              <CalendarClock className="w-4 h-4" />
              Pinjam Aset Lain
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Perangkat Tetap */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Perangkat Kerja</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Laptop className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-slate-900">{assignedAssets.length} Unit</div>
            <div className="text-xs text-blue-700 font-semibold mt-0.5">Ditugaskan Resmi (Assigned)</div>
          </div>
        </div>

        {/* Card 2: Aset Pinjaman Aktif */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pinjaman Aktif</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-slate-900">{myCurrentLoans.length} Unit</div>
            <div className="text-xs text-amber-700 font-semibold mt-0.5">Sedang Digunakan</div>
          </div>
        </div>

        {/* Card 3: Nilai Pertanggungan */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nilai Aset Tanggung Jawab</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-lg font-black text-slate-900 truncate">{formatRupiah(totalAssignedValue)}</div>
            <div className="text-xs text-emerald-700 font-semibold mt-0.5">Tercatat di Sistem Keuangan</div>
          </div>
        </div>

        {/* Card 4: Status Pemeliharaan */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Kondisi Perangkat</span>
            <div className="w-8 h-8 rounded-xl bg-[#4ABDAC]/15 text-[#206f65] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-slate-900">100% Siap</div>
            <div className="text-xs text-[#206f65] font-semibold mt-0.5">Kondisi Prima &amp; Bergaransi</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Semua Aset ({assignedAssets.length + myCurrentLoans.length})
          </button>
          <button
            onClick={() => setFilterType('assigned')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === 'assigned'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Perangkat Tetap ({assignedAssets.length})
          </button>
          <button
            onClick={() => setFilterType('loaned')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === 'loaned'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Aset Pinjaman ({myCurrentLoans.length})
          </button>
        </div>

        <div className="text-xs text-slate-500 hidden sm:flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Klik tombol merah untuk lapor kendala langsung</span>
        </div>
      </div>

      {/* Asset Cards Grid */}
      <div className="space-y-6">
        {/* Section 1: Assigned Assets */}
        {(filterType === 'all' || filterType === 'assigned') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-blue-600" />
                Perangkat Kerja Tetap (Assigned Assets)
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {assignedAssets.length} unit terdaftar
              </span>
            </div>

            {assignedAssets.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-2.5">
                <Package className="w-10 h-10 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">Belum Ada Perangkat Tetap yang Ditugaskan</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Jika Anda membutuhkan laptop atau komputer kerja baru, silakan ajukan tiket permohonan inventaris ke Divisi IT atau GA.
                </p>
                <button
                  onClick={onOpenNewTicketModal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors mt-2"
                >
                  <LifeBuoy className="w-3.5 h-3.5 text-rose-600" />
                  Ajukan Permohonan Perangkat
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignedAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                  >
                    <div>
                      {/* Header Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            {getCategoryIcon(asset.category_type, asset.subcategory)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[11px] font-extrabold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                                {asset.asset_number}
                              </span>
                              {asset.corporate_asset_number && (
                                <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                  ERP: {asset.corporate_asset_number}
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-sm text-slate-900 mt-1">
                              {asset.name}
                            </h4>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 uppercase">
                          {asset.condition || 'Good'}
                        </span>
                      </div>

                      {/* Specs */}
                      <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs text-slate-600">
                        {asset.brand && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Merek &amp; Model:</span>
                            <span className="font-semibold text-slate-800">{asset.brand} {asset.model}</span>
                          </div>
                        )}
                        {asset.serial_number && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Serial Number:</span>
                            <span className="font-mono font-semibold text-slate-800">{asset.serial_number}</span>
                          </div>
                        )}
                        {asset.specifications && (
                          <div className="pt-1 text-[11px] text-slate-500 line-clamp-2">
                            {asset.specifications}
                          </div>
                        )}
                      </div>

                      {/* Location & Handover */}
                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {asset.location || 'Head Office Food Station'}
                        </span>
                        {asset.warranty_until && (
                          <span className="text-emerald-700 font-medium">
                            Garansi s/d {formatDate(asset.warranty_until)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => onSelectAsset && onSelectAsset(asset)}
                        className="text-xs text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1 py-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Detail Spesifikasi
                      </button>

                      <button
                        onClick={() => onReportAsset && onReportAsset(asset)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors shadow-2xs"
                      >
                        <LifeBuoy className="w-3.5 h-3.5" />
                        Lapor Kendala
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section 2: Loaned Assets */}
        {(filterType === 'all' || filterType === 'loaned') && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-amber-600" />
                Barang yang Sedang Dipinjam (Active Loans)
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {myCurrentLoans.length} pinjaman aktif
              </span>
            </div>

            {myCurrentLoans.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">Tidak Ada Pinjaman Aset Aktif</p>
                <p className="text-[11px] text-slate-500">
                  Anda tidak sedang memegang barang pinjaman sementara (mobil dinas / laptop cadangan).
                </p>
                <button
                  onClick={onOpenNewLoanModal}
                  className="mt-2 text-xs font-bold text-[#206f65] hover:underline inline-block"
                >
                  + Ajukan Peminjaman Baru
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myCurrentLoans.map((loan) => (
                  <div
                    key={loan.id}
                    className="p-5 rounded-2xl bg-white border border-amber-200 hover:border-amber-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                            {loan.category_type === 'IT' ? <Laptop className="w-5 h-5" /> : <Car className="w-5 h-5" />}
                          </div>
                          <div>
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                              {loan.loan_number}
                            </span>
                            <h4 className="font-bold text-sm text-slate-900 mt-1">
                              {loan.asset_name}
                            </h4>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 uppercase">
                          {loan.status}
                        </span>
                      </div>

                      <div className="mt-3.5 p-3 rounded-xl bg-amber-50/60 border border-amber-200/60 space-y-1.5 text-xs text-slate-700">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Keperluan:</span>
                          <span className="font-semibold text-slate-800 text-right">{loan.purpose}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Waktu Mulai:</span>
                          <span className="font-medium text-slate-800">{formatDateTime(loan.start_date)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Jatuh Tempo:</span>
                          <span className="font-bold text-amber-900">{formatDateTime(loan.due_date)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] text-slate-500">
                        Disetujui: <strong className="text-slate-700">{loan.approver_name || 'Tim Pengelola'}</strong>
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const matchedAsset = assets.find(a => a.id === loan.asset_id);
                            if (matchedAsset && onReportAsset) {
                              onReportAsset(matchedAsset);
                            } else if (onOpenNewTicketModal) {
                              onOpenNewTicketModal();
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors shadow-2xs"
                        >
                          <LifeBuoy className="w-3.5 h-3.5" />
                          Lapor Kendala
                        </button>

                        {(loan.status === 'borrowed' || loan.status === 'active') && (
                          <button
                            onClick={() => {
                              if (onReturnLoan) {
                                onReturnLoan(loan.id);
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-2xs"
                          >
                            Ajukan Pengembalian
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info Card: Ketentuan Pemegang Aset */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-slate-800">Panduan Tanggung Jawab Pemegang Aset Kantor</span>
            <p className="leading-relaxed text-slate-600">
              Setiap aset kerja yang ditugaskan kepada pegawai PT Food Station Tjipinang Jaya wajib dijaga dengan baik. Apabila terjadi kendala sistem, kerusakan fisik, atau kehilangan, segera laporkan melalui tombol <strong>Lapor Kendala</strong> di atas agar segera ditindaklanjuti oleh tim IT &amp; GA dengan jaminan SLA resmi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
