import React, { useState } from 'react';
import { 
  CalendarClock, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Car, 
  Laptop, 
  ShieldCheck, 
  UserCheck, 
  CheckSquare, 
  Filter, 
  Info,
  Calendar,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { Loan, Asset, UserProfile, LoanStatus } from '../../types';
import { GabahService, formatDateTime, exportLoansToCsv } from '../../services/gabahService';

interface LoansViewProps {
  loans?: Loan[];
  assets?: Asset[];
  currentUser: UserProfile;
  onOpenCreateModal?: () => void;
  onOpenNewLoanModal?: () => void;
  onApproveLoan: (loanId: string) => void;
  onRejectLoan: (loanId: string, reason: string) => void;
  onHandoverLoan: (loanId: string) => void;
  onReturnLoan: (loanId: string, condition: 'excellent' | 'good' | 'fair' | 'damaged', notes: string) => void;
  onOpenBastModal?: (loan: Loan) => void;
  onOpenBast?: (loan: Loan) => void;
}

export const LoansView: React.FC<LoansViewProps> = ({
  loans = [],
  assets = [],
  currentUser,
  onOpenCreateModal,
  onOpenNewLoanModal,
  onApproveLoan,
  onRejectLoan,
  onHandoverLoan,
  onReturnLoan,
  onOpenBastModal,
  onOpenBast,
}) => {
  const handleOpenCreate = onOpenCreateModal || onOpenNewLoanModal || (() => {});
  const handleOpenBastDoc = onOpenBastModal || onOpenBast || (() => {});

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [rejectingLoanId, setRejectingLoanId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const [returningLoan, setReturningLoan] = useState<Loan | null>(null);
  const [returnCondition, setReturnCondition] = useState<'excellent' | 'good' | 'fair' | 'damaged'>('good');
  const [returnNotes, setReturnNotes] = useState<string>('');

  const isEmployee = currentUser?.role === 'Karyawan';
  const safeLoans = Array.isArray(loans) ? loans : [];
  const safeAssets = Array.isArray(assets) ? assets : [];
  const currentUserName = (currentUser?.name || '').toLowerCase();
  const currentUserId = currentUser?.id || '';

  const baseLoans = isEmployee
    ? safeLoans.filter(l => {
        const bName = (l.borrower_name || '').toLowerCase();
        return (
          l.borrower_id === currentUserId ||
          (bName && currentUserName && (bName.includes(currentUserName) || currentUserName.includes(bName)))
        );
      })
    : safeLoans;

  const filteredLoans = baseLoans.filter((loan) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'pending') return loan.status === 'pending' || loan.status === 'pending_approval';
    if (statusFilter === 'active') return loan.status === 'active' || loan.status === 'borrowed';
    return loan.status === statusFilter;
  });

  const canApprove = (loan: Loan) => {
    return GabahService.canApproveLoan(currentUser, loan);
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Schedule Guarantee */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-emerald-600" />
            Peminjaman Barang &amp; Reservasi
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isEmployee
              ? 'Daftar riwayat dan status pengajuan peminjaman kendaraan operasional serta laptop kerja Anda.'
              : 'Sistem peminjaman kendaraan operasional, laptop cadangan, kamera rapat, dan ruang meeting dengan validasi kalender otomatis.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => exportLoansToCsv(filteredLoans)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition-all shadow-xs"
            title="Download CSV Rekapitulasi Peminjaman untuk Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            id="btn-create-loan"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Ajukan Peminjaman Baru
          </button>
        </div>
      </div>

      {/* Schedule Engine Infobox */}
      <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="text-xs">
          <div className="font-bold text-slate-900 flex items-center gap-2">
            Sistem Sinkronisasi Kalender Reservasi Aktif
          </div>
          <p className="text-slate-600 mt-0.5 leading-relaxed">
            Setiap pengajuan diverifikasi secara otomatis terhadap jadwal reservasi yang sudah disetujui. Aset tidak dapat dipinjam ulang pada rentang waktu yang bertabrakan (overlap) demi memastikan ketersediaan aset di lapangan.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs w-fit overflow-x-auto">
        {['ALL', 'pending', 'approved', 'active', 'returned'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              statusFilter === status 
                ? 'bg-emerald-700 text-white font-bold shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {status === 'ALL' ? (isEmployee ? 'Semua Peminjaman Saya' : 'Semua Reservasi') :
             status === 'pending' ? `Menunggu Approval (${baseLoans.filter(l => l.status === 'pending' || (l.status as any) === 'pending_approval').length})` :
             status === 'approved' ? `Disetujui (${baseLoans.filter(l => l.status === 'approved').length})` :
             status === 'active' ? `Sedang Dipinjam (${baseLoans.filter(l => l.status === 'active' || (l.status as any) === 'borrowed').length})` :
             'Selesai Dikembalikan'}
          </button>
        ))}
      </div>

      {/* Loans Grid / Cards */}
      <div className="space-y-4">
        {filteredLoans.map((loan) => {
          const isIT = loan.category_type === 'IT' || loan.owner_division === 'IT';
          const userCanApprove = canApprove(loan);

          return (
            <div 
              key={loan.id}
              className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs space-y-4"
            >
              
              {/* Top row: Code, Asset Name, Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isIT ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                    {isIT ? <Laptop className="w-5 h-5" /> : <Car className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-400">{loan.loan_number}</span>
                      <span className="font-extrabold text-slate-900 text-sm">{loan.asset_name}</span>
                      <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                        {loan.asset_number}
                      </span>
                    </div>
                    {loan.corporate_asset_number && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        Corporate Asset: {loan.corporate_asset_number}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Badge */}
                <div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    loan.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                    (loan.status === 'pending' || (loan.status as any) === 'pending_approval') ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                    (loan.status === 'active' || (loan.status as any) === 'borrowed') ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' :
                    loan.status === 'returned' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                    'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    {loan.status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {(loan.status === 'pending' || (loan.status as any) === 'pending_approval') && <Clock className="w-3.5 h-3.5" />}
                    {(loan.status === 'active' || (loan.status as any) === 'borrowed') && <UserCheck className="w-3.5 h-3.5" />}
                    {loan.status === 'returned' && <CheckSquare className="w-3.5 h-3.5" />}
                    {loan.status === 'approved' ? 'Disetujui' :
                     (loan.status === 'pending' || (loan.status as any) === 'pending_approval') ? 'Menunggu Approval' :
                     (loan.status === 'active' || (loan.status as any) === 'borrowed') ? 'Sedang Dipinjam' :
                     loan.status === 'returned' ? 'Dikembalikan' :
                     loan.status}
                  </span>
                </div>
              </div>

              {/* Middle row: Borrower & Schedule */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                
                {/* Borrower Information */}
                <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Peminjam</div>
                  <div className="font-bold text-slate-900 text-sm">{loan.borrower_name}</div>
                  <div className="text-slate-600">{loan.borrower_department}</div>
                  <div className="text-slate-500 font-mono text-[11px]">{loan.borrower_phone}</div>
                </div>

                {/* Schedule Range */}
                <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Jadwal Pinjam Terverifikasi</div>
                  <div className="text-slate-700">
                    <strong className="text-emerald-700">Mulai:</strong> {formatDateTime(loan.start_date)}
                  </div>
                  <div className="text-slate-700">
                    <strong className="text-amber-700">Selesai:</strong> {formatDateTime(loan.due_date)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Diajukan pada: {formatDateTime(loan.created_at)}
                  </div>
                </div>

                {/* Purpose & Approval Info */}
                <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Keperluan &amp; Otorisasi</div>
                  <p className="text-slate-700 italic line-clamp-2">"{loan.purpose}"</p>
                  {loan.approver_name && (
                    <div className="text-[11px] text-emerald-700 font-semibold pt-1 border-t border-slate-200">
                      Disetujui oleh: {loan.approver_name}
                    </div>
                  )}
                  {loan.actual_returned_at && (
                    <div className="text-[11px] text-blue-700 font-medium">
                      Dikembalikan: {formatDateTime(loan.actual_returned_at)} ({loan.return_condition})
                    </div>
                  )}
                </div>

              </div>

              {/* Action buttons per status & RBAC role */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  {isIT ? 'Otoritas persetujuan: Divisi IT (Laptop/Hardware)' : 'Otoritas persetujuan: Divisi General Affair (Kendaraan/Fasilitas)'}
                </div>

                <div className="flex items-center gap-2">
                  
                  {/* Status: Pending -> Approve or Reject */}
                  {(loan.status === 'pending' || (loan.status as any) === 'pending_approval') && userCanApprove && (
                    <>
                      <button
                        onClick={() => onApproveLoan(loan.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Setujui Reservasi
                      </button>
                      <button
                        onClick={() => setRejectingLoanId(loan.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-all"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Tolak
                      </button>
                    </>
                  )}

                  {/* Status: Approved -> Handover to user */}
                  {loan.status === 'approved' && userCanApprove && (
                    <button
                      onClick={() => onHandoverLoan(loan.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Serah Terima Barang (Handover)
                    </button>
                  )}

                  {/* Status: Active -> Return inspection */}
                  {(loan.status === 'active' || (loan.status as any) === 'borrowed') && (
                    <button
                      onClick={() => setReturningLoan(loan)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      Proses Pengembalian
                    </button>
                  )}

                  {/* Cetak Berita Acara Serah Terima (BAST) untuk approved, active, returned */}
                  {loan.status !== 'rejected' && (
                    <button
                      onClick={() => handleOpenBastDoc(loan)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 text-xs font-semibold transition-all shadow-xs"
                      title="Cetak Berita Acara Serah Terima Resmi"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Cetak BAST</span>
                    </button>
                  )}

                </div>
              </div>

            </div>
          );
        })}

        {filteredLoans.length === 0 && (
          <div className="text-center py-12 rounded-2xl bg-white border border-slate-200 p-8 space-y-3 shadow-xs">
            <CalendarClock className="w-12 h-12 mx-auto text-slate-300" />
            <h4 className="font-bold text-slate-800 text-sm">
              {isEmployee ? 'Belum Ada Riwayat Peminjaman dari Anda' : 'Tidak Ada Data Peminjaman'}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {isEmployee 
                ? 'Anda belum memiliki riwayat pengajuan peminjaman barang. Klik tombol "Ajukan Peminjaman Baru" untuk meminjam mobil operasional atau laptop cadangan.'
                : 'Tidak ada data peminjaman untuk filter status ini.'}
            </p>
            {isEmployee && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Ajukan Peminjaman Baru
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectingLoanId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-slate-900">Tolak Pengajuan Peminjaman</h3>
            <p className="text-xs text-slate-600">Berikan alasan penolakan untuk pemohon:</p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Contoh: Unit sedang dijadwalkan servis berkala, atau keperluan rapat direksi..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectingLoanId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onRejectLoan(rejectingLoanId, rejectReason);
                  setRejectingLoanId(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Inspection Modal */}
      {returningLoan && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-slate-900">Verifikasi Pengembalian Aset</h3>
            <p className="text-xs text-slate-600">
              Periksa kondisi fisik <strong>{returningLoan.asset_name}</strong> ({returningLoan.asset_number}):
            </p>

            <div className="space-y-2">
              <label className="text-xs text-slate-600 font-semibold">Kondisi Saat Dikembalikan:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'excellent', label: 'Sangat Baik (Mulus)' },
                  { value: 'good', label: 'Baik & Lengkap' },
                  { value: 'fair', label: 'Wajar (Baret Halus)' },
                  { value: 'damaged', label: 'Ada Kerusakan' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setReturnCondition(item.value as any)}
                    className={`p-2.5 rounded-xl text-xs font-semibold border transition-all text-left ${
                      returnCondition === item.value 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-400 font-bold' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-600 font-semibold">Catatan Pengembalian (Opsional):</label>
              <textarea
                rows={2}
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Kelengkapan adapter charger, e-Toll, surat jalan..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setReturningLoan(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onReturnLoan(returningLoan.id, returnCondition, returnNotes);
                  setReturningLoan(null);
                  setReturnNotes('');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
              >
                Simpan &amp; Selesaikan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
