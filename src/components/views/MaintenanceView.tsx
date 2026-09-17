import React, { useState } from 'react';
import {
  Wrench,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  DollarSign,
  Building2,
  Car,
  Laptop,
  CheckSquare,
  Square,
  FileText,
  User,
  ShieldCheck,
  CalendarClock,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';
import { MaintenanceSchedule, MaintenanceStatus, MaintenanceFrequency, UserProfile, Asset } from '../../types';
import { exportMaintenanceToCsv } from '../../services/gabahService';

interface MaintenanceViewProps {
  schedules: MaintenanceSchedule[];
  assets: Asset[];
  currentUser: UserProfile | null;
  onUpdateScheduleStatus?: (id: string, status: MaintenanceStatus) => void;
  onAddSchedule?: (newSchedule: Partial<MaintenanceSchedule>) => void;
  onOpenAssetDetail?: (asset: Asset) => void;
  showToast?: (msg: string, type: 'success' | 'warning' | 'info') => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  schedules = [],
  assets = [],
  currentUser,
  onUpdateScheduleStatus,
  onAddSchedule,
  onOpenAssetDetail,
  showToast,
}) => {
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [divisionFilter, setDivisionFilter] = useState<string>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form states for new maintenance
  const [formData, setFormData] = useState({
    title: '',
    asset_id: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    frequency: 'quarterly' as MaintenanceFrequency,
    technician_name: '',
    vendor_name: '',
    estimated_cost: '',
    notes: '',
    checklistText: '',
  });

  const isStaff = currentUser?.role === 'Admin GABAH' || currentUser?.role === 'IT' || currentUser?.role === 'GA' || currentUser?.role === 'Supply Chain';

  // Filtered schedules
  const filteredSchedules = schedules.filter((sch) => {
    if (activeStatusFilter !== 'ALL' && sch.status !== activeStatusFilter) return false;
    if (divisionFilter !== 'ALL' && sch.owner_division !== divisionFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        sch.title.toLowerCase().includes(q) ||
        sch.schedule_code.toLowerCase().includes(q) ||
        sch.asset_name.toLowerCase().includes(q) ||
        sch.asset_number.toLowerCase().includes(q) ||
        sch.technician_name.toLowerCase().includes(q) ||
        (sch.vendor_name && sch.vendor_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // KPI calculations
  const totalScheduled = schedules.filter((s) => s.status === 'scheduled').length;
  const totalInProgress = schedules.filter((s) => s.status === 'in_progress').length;
  const totalCompleted = schedules.filter((s) => s.status === 'completed').length;
  const totalBudget = schedules.reduce((acc, curr) => acc + (curr.actual_cost || curr.estimated_cost || 0), 0);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.asset_id) {
      if (showToast) showToast('Judul dan Aset wajib diisi.', 'warning');
      return;
    }

    const selectedAsset = assets.find((a) => a.id === formData.asset_id);
    if (!selectedAsset) return;

    const checklistItems = formData.checklistText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const newObj: Partial<MaintenanceSchedule> = {
      id: `mnt-${Date.now()}`,
      schedule_code: `MNT-2026-${String(schedules.length + 1).padStart(3, '0')}`,
      title: formData.title,
      asset_id: selectedAsset.id,
      asset_name: selectedAsset.name,
      asset_number: selectedAsset.asset_number,
      category_type: selectedAsset.category_type,
      owner_division: selectedAsset.owner_division,
      scheduled_date: formData.scheduled_date,
      frequency: formData.frequency,
      status: 'scheduled',
      technician_name: formData.technician_name || 'Teknisi Internal Food Station',
      vendor_name: formData.vendor_name,
      estimated_cost: Number(formData.estimated_cost) || 0,
      notes: formData.notes,
      checklist: checklistItems.length > 0 ? checklistItems : ['Pemeriksaan Fisik & Fungsi', 'Pembersihan Komponen', 'Uji Coba Pasca-Servis'],
      created_at: new Date().toISOString(),
    };

    if (onAddSchedule) {
      onAddSchedule(newObj);
    }
    setIsCreateModalOpen(false);
    setFormData({
      title: '',
      asset_id: '',
      scheduled_date: new Date().toISOString().split('T')[0],
      frequency: 'quarterly',
      technician_name: '',
      vendor_name: '',
      estimated_cost: '',
      notes: '',
      checklistText: '',
    });
    if (showToast) showToast('Jadwal pemeliharaan berhasil didaftarkan.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-full w-fit mb-2 border border-amber-200">
            <Wrench className="w-3.5 h-3.5" />
            <span>Pemeliharaan Aset &amp; Kalibrasi Rutin</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Jadwal Servis &amp; Maintenance Berkala</h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Program preventif untuk armada logistik, AC ruang server, mesin sortasi beras, dan kalibrasi jembatan timbang PIBC.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-auto">
          <button
            onClick={() => exportMaintenanceToCsv(filteredSchedules)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition-all shadow-xs"
            title="Download CSV Rekapitulasi Servis & Pemeliharaan untuk Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          {isStaff && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#4ABDAC] hover:bg-[#3ca89a] text-white rounded-xl font-bold text-xs shadow-md shadow-[#4ABDAC]/25 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Jadwal Servis</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Terjadwal</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-3">{totalScheduled} Aset</div>
          <div className="text-xs text-amber-700 font-bold mt-1">Menunggu waktu pelaksanaan</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Dalam Pengerjaan</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-3">{totalInProgress} Aset</div>
          <div className="text-xs text-blue-700 font-bold mt-1">Sedang ditangani bengkel/teknisi</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Selesai Dikerjakan</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-3">{totalCompleted} Servis</div>
          <div className="text-xs text-emerald-700 font-bold mt-1">Preventif terjaga optimal</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Estimasi Biaya Servis</span>
            <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-3">
            Rp {(totalBudget / 1000000).toFixed(1)} Jt
          </div>
          <div className="text-xs text-violet-700 font-bold mt-1">Alokasi anggaran pemeliharaan</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari jadwal, aset, no. inventaris, teknisi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#4ABDAC]/30 focus:border-[#4ABDAC]"
            />
          </div>

          <select
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#4ABDAC]/30 focus:border-[#4ABDAC]"
          >
            <option value="ALL">Semua Divisi Pemilik</option>
            <option value="IT">IT (Server &amp; Network)</option>
            <option value="GA">GA (Kendaraan &amp; Gedung)</option>
            <option value="SC">Supply Chain (Truk &amp; Timbangan)</option>
            <option value="PIBC">Kawasan PIBC</option>
          </select>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'Semua Status', count: schedules.length },
            { id: 'scheduled', label: 'Terjadwal', count: totalScheduled },
            { id: 'in_progress', label: 'Proses', count: totalInProgress },
            { id: 'completed', label: 'Selesai', count: totalCompleted },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeStatusFilter === tab.id
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeStatusFilter === tab.id ? 'bg-amber-200 text-amber-950' : 'bg-slate-200 text-slate-700'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Schedules List Cards */}
      <div className="space-y-4">
        {filteredSchedules.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400 space-y-2">
            <Wrench className="w-10 h-10 mx-auto text-slate-300" />
            <div className="text-sm font-bold text-slate-700">Tidak ada jadwal pemeliharaan</div>
            <div className="text-xs text-slate-400">
              Tidak ditemukan jadwal servis yang cocok dengan filter yang dipilih.
            </div>
          </div>
        ) : (
          filteredSchedules.map((sch) => {
            const matchedAsset = assets.find((a) => a.id === sch.asset_id);
            return (
              <div
                key={sch.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-slate-300 shadow-xs transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
              >
                {/* Left info */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                    sch.category_type === 'GA' ? 'bg-amber-100 text-amber-800' :
                    sch.category_type === 'IT' ? 'bg-blue-100 text-blue-800' :
                    'bg-emerald-100 text-emerald-800'
                  }`}>
                    {sch.category_type === 'GA' ? <Car className="w-5 h-5" /> :
                     sch.category_type === 'IT' ? <Laptop className="w-5 h-5" /> :
                     <Wrench className="w-5 h-5" />}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {sch.schedule_code}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        sch.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                        sch.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-amber-100 text-amber-900'
                      }`}>
                        {sch.status === 'completed' ? 'Selesai' :
                         sch.status === 'in_progress' ? 'Pengerjaan' : 'Terjadwal'}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        Frekuensi: {sch.frequency}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 leading-snug">
                      {sch.title}
                    </h3>

                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                      <span className="font-semibold text-[#206f65]">
                        Aset: {sch.asset_name} ({sch.asset_number})
                      </span>
                      <span>•</span>
                      <span>Teknisi/Bengkel: <strong>{sch.technician_name}</strong></span>
                      {sch.vendor_name && (
                        <>
                          <span>•</span>
                          <span>Vendor: {sch.vendor_name}</span>
                        </>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 mt-1 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      {sch.notes}
                    </p>

                    {/* Checklist preview */}
                    {sch.checklist && sch.checklist.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-1.5">
                        {sch.checklist.map((item, cIdx) => (
                          <span
                            key={cIdx}
                            className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
                          >
                            <CheckSquare className="w-2.5 h-2.5 text-emerald-600" />
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex flex-row lg:flex-col items-end justify-between lg:justify-center w-full lg:w-auto gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Jadwal Tanggal</div>
                    <div className="text-xs font-black text-slate-800 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      {new Date(sch.scheduled_date).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                    {sch.estimated_cost && (
                      <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                        Est: Rp {sch.estimated_cost.toLocaleString('id-ID')}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {matchedAsset && onOpenAssetDetail && (
                      <button
                        onClick={() => onOpenAssetDetail(matchedAsset)}
                        className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        Detail Aset
                      </button>
                    )}

                    {isStaff && onUpdateScheduleStatus && (
                      <div className="flex items-center gap-1">
                        {sch.status === 'scheduled' && (
                          <button
                            onClick={() => onUpdateScheduleStatus(sch.id, 'in_progress')}
                            className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                          >
                            Mulai Servis
                          </button>
                        )}
                        {sch.status === 'in_progress' && (
                          <button
                            onClick={() => onUpdateScheduleStatus(sch.id, 'completed')}
                            className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors shadow-2xs"
                          >
                            Tandai Selesai
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Tambah Jadwal Pemeliharaan */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Jadwalkan Servis / Pemeliharaan</h3>
                  <p className="text-[11px] text-slate-500">Preventive maintenance aset Food Station</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Aset Yang Diservis *</label>
                <select
                  required
                  value={formData.asset_id}
                  onChange={(e) => setFormData({ ...formData, asset_id: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#4ABDAC]/30 focus:border-[#4ABDAC]"
                >
                  <option value="">-- Pilih Aset Inventaris --</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.asset_number}] {a.name} ({a.category_type} - {a.location})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Judul Pemeliharaan / Servis *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ganti Oli Mesin & Cek Rem Avanza B 1290 PQU"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#4ABDAC]/30 focus:border-[#4ABDAC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Pelaksanaan</label>
                  <input
                    type="date"
                    required
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#4ABDAC]/30 focus:border-[#4ABDAC]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Frekuensi Siklus</label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value as MaintenanceFrequency })}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#4ABDAC]/30 focus:border-[#4ABDAC]"
                  >
                    <option value="monthly">Bulanan</option>
                    <option value="quarterly">Triwulan (3 Bulan)</option>
                    <option value="biannual">Semester (6 Bulan)</option>
                    <option value="annual">Tahunan</option>
                    <option value="one_time">Satu Kali (Insidental)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Teknisi / Pelaksana</label>
                  <input
                    type="text"
                    placeholder="Contoh: Auto2000 Cempaka Putih"
                    value={formData.technician_name}
                    onChange={(e) => setFormData({ ...formData, technician_name: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#4ABDAC]/30 focus:border-[#4ABDAC]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Estimasi Biaya (Rp)</label>
                  <input
                    type="number"
                    placeholder="Contoh: 1500000"
                    value={formData.estimated_cost}
                    onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#4ABDAC]/30 focus:border-[#4ABDAC]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Lingkup Pekerjaan</label>
                <textarea
                  rows={2}
                  placeholder="Rincian kerusakan, suku cadang yang diganti, atau rekomendasi teknisi..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#4ABDAC]/30 focus:border-[#4ABDAC]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Checklist Item Pekerjaan (Pisahkan per baris)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ganti Oli Mesin&#10;Pembersihan Filter Udara&#10;Pengecekan Tekanan Ban"
                  value={formData.checklistText}
                  onChange={(e) => setFormData({ ...formData, checklistText: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#4ABDAC]/30 focus:border-[#4ABDAC]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#4ABDAC] hover:bg-[#3ca89a] text-white font-bold shadow-md shadow-[#4ABDAC]/25"
                >
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
