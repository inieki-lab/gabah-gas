import React from 'react';
import { 
  KeyRound, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Calendar, 
  Users, 
  Server, 
  ExternalLink,
  ShieldCheck,
  Building
} from 'lucide-react';
import { Asset, UserProfile } from '../../types';
import { formatRupiah, formatDate, calculateDaysRemaining } from '../../services/gabahService';

interface LicensesViewProps {
  assets?: Asset[];
  currentUser: UserProfile;
  onOpenCreateLicenseModal?: () => void;
  onOpenNewAssetModal?: () => void;
  onSelectAsset?: (asset: Asset) => void;
}

export const LicensesView: React.FC<LicensesViewProps> = ({
  assets = [],
  currentUser,
  onOpenCreateLicenseModal,
  onOpenNewAssetModal,
  onSelectAsset,
}) => {
  const handleOpenCreate = onOpenCreateLicenseModal || onOpenNewAssetModal || (() => {});
  const safeAssets = Array.isArray(assets) ? assets : [];
  const licenseAssets = safeAssets.filter((a) => a.category_type === 'License');

  const totalAnnualCost = licenseAssets.reduce((sum, a) => {
    return sum + (a.license_detail?.renewal_cost || a.purchase_price || a.price || 0);
  }, 0);

  const totalSeats = licenseAssets.reduce((sum, a) => sum + (a.license_detail?.total_seats || 0), 0);
  const usedSeats = licenseAssets.reduce((sum, a) => sum + (a.license_detail?.used_seats || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-600" />
            Software License &amp; Cloud Subscriptions
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Monitoring kapasitas seat, jatuh tempo renewal, dan alokasi anggaran lisensi IT korporat.
          </p>
        </div>

        {(currentUser.role === 'Admin GABAH' || currentUser.role === 'IT') && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs"
          >
            <KeyRound className="w-4 h-4" />
            Tambah Lisensi Baru
          </button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase text-slate-500">Total Anggaran Renewal Tahunan</div>
          <div className="text-2xl font-black text-slate-900 mt-2">{formatRupiah(totalAnnualCost)}</div>
          <div className="text-xs text-indigo-700 font-medium mt-1">Est. per bulan: {formatRupiah(totalAnnualCost / 12)}</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase text-slate-500">Total Kursi / Akun Aktif (Seats)</div>
          <div className="text-2xl font-black text-slate-900 mt-2">{usedSeats} / {totalSeats} Kursi</div>
          <div className="text-xs text-emerald-700 font-medium mt-1">
            Utilisasi: {totalSeats > 0 ? Math.round((usedSeats / totalSeats) * 100) : 0}% Kapasitas Terpakai
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase text-slate-500">Peringatan Jatuh Tempo Segera</div>
          <div className="text-2xl font-black text-amber-600 mt-2">1 Kontrak (54 Hari)</div>
          <div className="text-xs text-slate-500 mt-1">Sophos Intercept X Advanced</div>
        </div>
      </div>

      {/* License Cards Grid */}
      <div className="space-y-4">
        {licenseAssets.map((license) => {
          const detail = license.license_detail;
          const daysRemaining = detail?.expiration_date ? calculateDaysRemaining(detail.expiration_date) : 999;
          const isExpiringSoon = daysRemaining < 90;
          const seatPct = detail?.total_seats ? Math.round((detail.used_seats / detail.total_seats) * 100) : 0;

          return (
            <div 
              key={license.id}
              className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => onSelectAsset && onSelectAsset(license)}
                        className="font-extrabold text-slate-900 text-base hover:text-emerald-700 text-left transition-colors cursor-pointer"
                        title="Lihat Detail Lisensi"
                      >
                        {license.name}
                      </button>
                      {license.corporate_asset_number && (
                        <span className="font-mono text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 font-bold">
                          {license.corporate_asset_number}
                        </span>
                      )}
                      <span className="font-mono text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {license.asset_number}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{license.specifications}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isExpiringSoon ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Renewal: {daysRemaining} Hari Lagi
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Status Aktif
                    </span>
                  )}
                </div>
              </div>

              {/* Details & Seats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                
                {/* Seats Utilization */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-slate-500 font-bold uppercase text-[10px]">
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Alokasi Kursi (Seats)</span>
                    <span className="text-emerald-700 font-bold">{seatPct}%</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {detail?.used_seats || 0} / {detail?.total_seats || 0} Akun Digunakan
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        seatPct > 90 ? 'bg-amber-500' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.min(seatPct, 100)}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Sisa kuota: {(detail?.total_seats || 0) - (detail?.used_seats || 0)} lisensi tersedia
                  </div>
                </div>

                {/* Financial Cost */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Biaya &amp; Siklus Billing
                  </div>
                  <div className="text-base font-extrabold text-slate-900">
                    {formatRupiah(detail?.renewal_cost || license.purchase_price)}
                  </div>
                  <div className="text-slate-700 capitalize">
                    Siklus: {detail?.billing_cycle || 'Tahunan'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Jatuh tempo: {detail?.expiration_date ? formatDate(detail.expiration_date) : '-'}
                  </div>
                </div>

                {/* Tenant & Notes */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                    <Server className="w-3.5 h-3.5 text-blue-600" /> Tenant &amp; Catatan IT
                  </div>
                  <div className="text-slate-800 font-mono text-[11px] truncate">
                    {license.location}
                  </div>
                  <p className="text-slate-500 text-[11px] line-clamp-2 mt-1">
                    {license.notes || 'Tidak ada catatan khusus.'}
                  </p>
                </div>

              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
