import React, { useMemo, useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  DollarSign, 
  PieChart, 
  Clock, 
  ShieldCheck,
  PackageCheck,
  Download,
  Printer,
  Calculator,
  TrendingDown,
  FileSpreadsheet,
  Wrench
} from 'lucide-react';
import { Asset, Ticket, Loan, MaintenanceSchedule } from '../../types';
import { 
  formatRupiah, 
  calculateDepreciation, 
  exportAssetsToCsv, 
  exportLoansToCsv, 
  exportTicketsToCsv,
  exportMaintenanceToCsv,
  exportDivisionSummaryToCsv
} from '../../services/gabahService';

interface ReportsViewProps {
  assets: Asset[];
  tickets: Ticket[];
  loans: Loan[];
  maintenanceSchedules?: MaintenanceSchedule[];
  auditLogs?: any[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ assets, tickets, loans, maintenanceSchedules = [] }) => {
  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeLoans = Array.isArray(loans) ? loans : [];
  const safeTickets = Array.isArray(tickets) ? tickets : [];
  const safeMaintenances = Array.isArray(maintenanceSchedules) ? maintenanceSchedules : [];
  const locationOnlyOwnerValues = new Set(['SC', 'SUPPLY CHAIN', 'RPC', 'PIBC']);
  const normalizeOwnerCode = (value: unknown) => String(value || '').trim().toUpperCase();
  const assetsById = useMemo(() => new Map(safeAssets.map(asset => [asset.id, asset] as const)), [safeAssets]);

  // Owner division is an ownership domain; ticket category and office location
  // are separate concepts and must never be used as substitutes for it.
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  const divisionOptions = useMemo(
    () => Array.from(new Set(safeAssets
      .map(a => normalizeOwnerCode(a.owner_division || 'Umum'))
      .filter(owner => owner && !locationOnlyOwnerValues.has(owner)))).sort(),
    [safeAssets]
  );
  const departmentOptions = useMemo(
    () => Array.from(new Set(safeAssets.map(a => a.assigned_to?.department).filter(Boolean) as string[])).sort(),
    [safeAssets]
  );

  const filteredAssets = useMemo(() => safeAssets.filter(a =>
    (divisionFilter === 'all' || normalizeOwnerCode(a.owner_division || 'Umum') === divisionFilter) &&
    (departmentFilter === 'all' || (a.assigned_to?.department || '') === departmentFilter)
  ), [safeAssets, divisionFilter, departmentFilter]);

  const filteredLoans = useMemo(() => safeLoans.filter(l =>
    // Loan owner_division is authoritative. Asset-number prefixes are numbering
    // identifiers and are not a safe substitute for the persisted owner field.
    (divisionFilter === 'all' || normalizeOwnerCode(l.owner_division) === divisionFilter) &&
    (departmentFilter === 'all' || (l.borrower_department || '') === departmentFilter)
  ), [safeLoans, divisionFilter, departmentFilter]);

  const filteredTickets = useMemo(() => safeTickets.filter(ticket => {
    const relatedAsset = ticket.related_asset_id ? assetsById.get(ticket.related_asset_id) : undefined;
    // Ticket category (IT/GA/ME) is a service queue, not an asset owner.
    // Unlinked tickets have no owner-division attribution and are excluded
    // only while a specific owner filter is active.
    const ownerMatches = divisionFilter === 'all'
      || (relatedAsset != null && normalizeOwnerCode(relatedAsset.owner_division) === divisionFilter);
    return ownerMatches &&
      (departmentFilter === 'all' || (ticket.reporter_department || '') === departmentFilter);
  }), [safeTickets, assetsById, divisionFilter, departmentFilter]);

  const filteredMaintenances = useMemo(() => safeMaintenances.filter(m =>
    divisionFilter === 'all' || normalizeOwnerCode(m.owner_division || 'Umum') === divisionFilter
  ), [safeMaintenances, divisionFilter]);

  const isFilterActive = divisionFilter !== 'all' || departmentFilter !== 'all';

  const resolvedTickets = filteredTickets.filter(t => t.status === 'resolved' || t.status === 'closed');
  // SLA is measurable only when both authoritative timestamps exist. Missing
  // timestamps are excluded rather than silently counted as on-time.
  const slaMeasuredTickets = resolvedTickets.filter(ticket => {
    const deadline = Date.parse(ticket.sla_resolution_deadline || '');
    const resolvedAt = Date.parse(ticket.resolved_at || '');
    return Number.isFinite(deadline) && Number.isFinite(resolvedAt);
  });
  const slaOnTimeCount = slaMeasuredTickets.filter(ticket =>
    Date.parse(ticket.resolved_at as string) <= Date.parse(ticket.sla_resolution_deadline as string)
  ).length;
  const slaOnTimePct = slaMeasuredTickets.length
    ? Math.round((slaOnTimeCount / slaMeasuredTickets.length) * 100)
    : null;

  const getPrioritySlaStats = (priorities: Ticket['priority'][]) => {
    const completed = resolvedTickets.filter(ticket => priorities.includes(ticket.priority));
    const measured = completed.filter(ticket => {
      const deadline = Date.parse(ticket.sla_resolution_deadline || '');
      const resolvedAt = Date.parse(ticket.resolved_at || '');
      return Number.isFinite(deadline) && Number.isFinite(resolvedAt);
    });
    const onTime = measured.filter(ticket =>
      Date.parse(ticket.resolved_at as string) <= Date.parse(ticket.sla_resolution_deadline as string)
    ).length;
    const durations = completed.map(ticket => {
      const createdAt = Date.parse(ticket.created_at || '');
      const resolvedAt = Date.parse(ticket.resolved_at || '');
      return Number.isFinite(createdAt) && Number.isFinite(resolvedAt) && resolvedAt >= createdAt
        ? (resolvedAt - createdAt) / (1000 * 60 * 60)
        : null;
    }).filter((hours): hours is number => hours !== null);
    return {
      completedCount: completed.length,
      measuredCount: measured.length,
      onTimePct: measured.length ? Math.round((onTime / measured.length) * 100) : null,
      averageResolutionHours: durations.length
        ? durations.reduce((sum, hours) => sum + hours, 0) / durations.length
        : null,
    };
  };
  const prioritySlaGroups = [
    { label: 'URGENT', description: 'Prioritas tertinggi', stats: getPrioritySlaStats(['urgent']), textColor: 'text-rose-700' },
    { label: 'HIGH', description: 'Prioritas tinggi', stats: getPrioritySlaStats(['high']), textColor: 'text-amber-700' },
    { label: 'MEDIUM & LOW', description: 'Prioritas sedang dan rendah', stats: getPrioritySlaStats(['medium', 'low']), textColor: 'text-blue-700' },
  ];

  const totalAssetValue = filteredAssets.reduce((sum, a) => sum + (a.purchase_price || a.price || 0), 0);

  const totalMaintenanceBudget = filteredMaintenances.reduce((acc, curr) => acc + (curr.actual_cost || curr.estimated_cost || 0), 0);
  const completedMaintenanceCount = filteredMaintenances.filter(m => m.status === 'completed').length;

  const totalAssetCount = Math.max(filteredAssets.length, 1);
  // SC/Supply Chain/RPC and PIBC are office locations, not owner divisions.
  // Legacy records carrying these values in owner_division are called out for
  // data correction instead of being reported as organizational divisions.
  const unclassifiedOwnerAssets = filteredAssets.filter(asset => {
    const owner = String(asset.owner_division || '').trim().toUpperCase();
    return !owner || locationOnlyOwnerValues.has(owner);
  });
  const ownerDivisionStats = Array.from(
    filteredAssets.reduce((groups, asset) => {
      const owner = String(asset.owner_division || '').trim();
      if (!owner || locationOnlyOwnerValues.has(owner.toUpperCase())) return groups;
      const group = groups.get(owner) || [];
      group.push(asset);
      groups.set(owner, group);
      return groups;
    }, new Map<string, Asset[]>())
  ).map(([owner, items]) => ({
    owner,
    count: items.length,
    value: items.reduce((sum, asset) => sum + (asset.purchase_price || asset.price || 0), 0),
  })).sort((a, b) => b.count - a.count || a.owner.localeCompare(b.owner));

  // Breakdown per 9 Jenis Aset Tetap
  const taxonomyGroups = [
    { code: 'IT-H', name: 'IT Hardware (Laptop, PC, Server)', filter: (a: Asset) => a.category_code === 'IT-H' || ['HLT','HPC','HSV','HWS','HMON','HPRN','HSCN','HNET','HFW','HSTG','HUPS','HRCK'].includes(a.category_code || '') || a.asset_number?.includes('-HLT-') || a.asset_number?.includes('-HPC-') || a.asset_number?.includes('-HSV-') },
    { code: 'IT-S', name: 'IT Software & Lisensi (SLic)', filter: (a: Asset) => a.category_code === 'IT-S' || a.category_code === 'SLIC' || a.category_type === 'License' || a.asset_number?.includes('-SLIC-') },
    { code: 'INV-F', name: 'Inventaris Furniture (Meja, Kursi - Milik GA)', filter: (a: Asset) => a.category_code === 'INV-F' || a.asset_number?.includes('-INV-F-') },
    { code: 'INV-P', name: 'Inventaris Peralatan (Kompor, AC, APAR)', filter: (a: Asset) => a.category_code === 'INV-P' || a.asset_number?.includes('-INV-P-') },
    { code: 'KDR', name: 'Kendaraan (Mobil Dinas & Truk Logistik)', filter: (a: Asset) => a.category_code?.startsWith('KDR') || a.asset_number?.includes('-KDR-') },
    { code: 'MSN', name: 'Mesin (Rice Milling & Jembatan Timbang)', filter: (a: Asset) => a.category_code?.startsWith('MSN') || a.asset_number?.includes('-MSN-') },
    { code: 'BGN', name: 'Bangunan (Gedung Kantor & Pergudangan)', filter: (a: Asset) => a.category_code?.startsWith('BGN') || a.asset_number?.includes('-BGN-') },
    { code: 'TNH', name: 'Tanah & Lahan Kawasan Pasar', filter: (a: Asset) => a.category_code?.startsWith('TNH') || a.asset_number?.includes('-TNH-') },
    { code: 'LNY', name: 'Lainnya (Perlengkapan Tambahan)', filter: (a: Asset) => a.category_code === 'LNY' || a.asset_number?.includes('-LNY-') },
  ].map(g => {
    const matched = filteredAssets.filter(g.filter);
    return {
      ...g,
      count: matched.length,
      value: matched.reduce((sum, a) => sum + (a.purchase_price || a.price || 0), 0)
    };
  });

  // Akumulasi penyusutan aset (mengikuti filter divisi/departemen aktif)
  const depreciations = filteredAssets.map(a => calculateDepreciation(a));
  const totalAccumulatedDepreciation = depreciations.reduce((sum, d) => sum + d.accumulatedDepreciation, 0);
  const totalNetBookValue = depreciations.reduce((sum, d) => sum + d.netBookValue, 0);
  const totalMonthlyDepreciation = depreciations.reduce((sum, d) => sum + d.monthlyDepreciation, 0);

  return (
    <div className="space-y-6">
      
      {/* Header & Export Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            Laporan Eksekutif, SLA & KPI Portal GABAH
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Ringkasan analitik kepatuhan SLA Helpdesk, utilisasi peminjaman barang, dan valuasi aset korporat.
          </p>
        </div>

        {/* Data Export & Print Buttons */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={() => exportDivisionSummaryToCsv(filteredAssets)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition-all shadow-xs"
            title="Rekapitulasi jumlah aset, nilai perolehan, akumulasi depresiasi, dan nilai buku per divisi"
          >
            <PieChart className="w-3.5 h-3.5 text-indigo-600" />
            <span>Rekap Divisi</span>
          </button>

          <button
            onClick={() => exportAssetsToCsv(filteredAssets)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-all shadow-xs"
            title="Download CSV Master Aset untuk Microsoft Excel — hanya data sesuai filter divisi/departemen aktif"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Aset (CSV)</span>
          </button>

          <button
            onClick={() => exportLoansToCsv(filteredLoans)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition-all shadow-xs"
            title="Download CSV Rekapitulasi Peminjaman Barang — mengikuti filter aktif"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Rekap Pinjam</span>
          </button>

          <button
            onClick={() => exportTicketsToCsv(filteredTickets)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition-all shadow-xs"
            title="Download CSV Rekapitulasi Tiket Helpdesk & SLA — mengikuti filter aktif"
          >
            <Download className="w-3.5 h-3.5 text-purple-600" />
            <span>Rekap Tiket</span>
          </button>

          <button
            onClick={() => exportMaintenanceToCsv(filteredMaintenances)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition-all shadow-xs"
            title="Download CSV Rekapitulasi Pemeliharaan & Kalibrasi — mengikuti filter aktif"
          >
            <Download className="w-3.5 h-3.5 text-amber-600" />
            <span>Rekap Servis</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold transition-all shadow-xs"
            title="Simpan laporan jako PDF via dialog cetak browser"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Laporan per Bagian/Departemen/Divisi */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col md:flex-row md:items-center gap-3 shadow-xs print:hidden">
        <div className="flex items-center gap-2 shrink-0">
          <PieChart className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Filter Laporan</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={divisionFilter}
            onChange={e => setDivisionFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold focus:outline-none focus:border-emerald-500"
            title="Filter berdasarkan divisi pemilik aset; tiket hanya teratribusi melalui aset terkait"
          >
            <option value="all">Semua Divisi ({divisionOptions.length})</option>
            {divisionOptions.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold focus:outline-none focus:border-emerald-500"
            title="Filter berdasarkan departemen penanggung jawab / peminjam / pelapor"
          >
            <option value="all">Semua Departemen ({departmentOptions.length})</option>
            {departmentOptions.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {isFilterActive && (
            <button
              onClick={() => { setDivisionFilter('all'); setDepartmentFilter('all'); }}
              className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
            >
              Reset Filter
            </button>
          )}
        </div>
        <div className="md:ml-auto flex items-center gap-3 text-[11px] text-slate-500 font-medium">
          <span>{filteredAssets.length} aset</span>
          <span>·</span>
          <span>{filteredLoans.length} peminjaman</span>
          <span>·</span>
          <span>{filteredTickets.length} tiket</span>
          <span>·</span>
          <span>{filteredMaintenances.length} jadwal servis</span>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase text-slate-500">Tingkat Kepatuhan SLA</div>
          <div className="text-3xl font-black text-emerald-700 mt-2">{slaOnTimePct === null ? '—' : `${slaOnTimePct}%`}</div>
          <div className="text-xs text-slate-600 mt-1 font-medium">
            {slaOnTimePct === null
              ? 'Belum ada data penyelesaian dan deadline SLA yang lengkap'
              : `${slaOnTimeCount} dari ${slaMeasuredTickets.length} tiket selesai tepat waktu · ${slaOnTimePct >= 95 ? 'Target ≥95% tercapai' : 'Di bawah target ≥95%'}`}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase text-slate-500">Rata-Rata Respon Helpdesk</div>
          <div className="text-3xl font-black text-slate-900 mt-2">—</div>
          <div className="text-xs text-slate-600 font-medium mt-1">Belum tersedia · timestamp respons pertama belum dicatat</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase text-slate-500">Total Reservasi Pinjam</div>
          <div className="text-3xl font-black text-amber-600 mt-2">{filteredLoans.length} Sesi</div>
          <div className="text-xs text-slate-600 mt-1 font-medium">Jumlah record peminjaman sesuai filter aktif</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase text-slate-500">Total Nilai Perolehan Aset</div>
          <div className="text-2xl font-black text-indigo-700 mt-2">{formatRupiah(totalAssetValue)}</div>
          <div className="text-xs text-slate-600 mt-1 font-medium">Nilai perolehan aset pada cakupan filter aktif</div>
        </div>
      </div>

      {/* Depresiasi Akuntansi PSAK 16 Card */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                Estimasi Nilai Buku &amp; Penyusutan Indikatif Aset
              </h3>
              <p className="text-xs text-slate-500">
                Simulasi internal berdasarkan asumsi umur manfaat; bukan pembukuan atau perhitungan PSAK 16.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 w-fit">
            Estimasi garis lurus (asumsi sistem)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-500 text-[11px] font-medium">Nilai Buku Bersih (Net Book Value)</div>
            <div className="text-2xl font-black text-emerald-700">{formatRupiah(totalNetBookValue)}</div>
            <div className="text-[10px] text-slate-500">Estimasi nilai setelah penyusutan indikatif</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-500 text-[11px] font-medium">Akumulasi Beban Penyusutan</div>
            <div className="text-2xl font-black text-rose-600">{formatRupiah(totalAccumulatedDepreciation)}</div>
            <div className="text-[10px] text-slate-500">Akumulasi hasil simulasi, bukan jurnal pembukuan</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-500 text-[11px] font-medium">Beban Penyusutan / Bulan</div>
            <div className="text-xl font-black text-slate-900">{formatRupiah(totalMonthlyDepreciation)}</div>
            <div className="text-[10px] text-slate-500">Estimasi penyusutan bulanan; bukan amortisasi lisensi</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-500 text-[11px] font-medium">Rasio Penyusutan Indikatif</div>
            <div className="text-2xl font-black text-amber-600">
              {totalAssetValue > 0 ? Math.round((totalAccumulatedDepreciation / totalAssetValue) * 100) : 0}%
            </div>
            <div className="text-[10px] text-slate-500">Estimasi terhadap nilai perolehan aset</div>
          </div>
        </div>
      </div>

      {/* Pemeliharaan & Kalibrasi Preventif KPI Card */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                Realisasi Program Pemeliharaan Preventif &amp; Kalibrasi (Food Station)
              </h3>
              <p className="text-xs text-slate-500">
                Monitoring servis armada truk logistik, kalibrasi tera jembatan timbang PIBC, dan AC precision ruang server.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 w-fit">
            Preventive Maintenance
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-500 text-[11px] font-medium">Total Jadwal Pemeliharaan</div>
            <div className="text-2xl font-black text-slate-900">{filteredMaintenances.length} Jadwal</div>
            <div className="text-[10px] text-slate-500">Mengikuti record pemeliharaan yang tersedia dalam cakupan filter</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-500 text-[11px] font-medium">Realisasi Selesai / On-Track</div>
            <div className="text-2xl font-black text-emerald-700">
              {filteredMaintenances.length === 0 ? '—' : `${completedMaintenanceCount} Selesai (${Math.round((completedMaintenanceCount / filteredMaintenances.length) * 100)}%)`}
            </div>
            <div className="text-[10px] text-emerald-600 font-medium">Proporsi jadwal berstatus selesai; bukan penilaian kondisi aset</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-500 text-[11px] font-medium">Biaya Pemeliharaan (Aktual / Estimasi)</div>
            <div className="text-xl font-black text-amber-700">{formatRupiah(totalMaintenanceBudget)}</div>
            <div className="text-[10px] text-slate-500">Mengutamakan biaya aktual; jika kosong memakai estimasi</div>
          </div>
        </div>
      </div>

      {/* Visual chart breakdown from current records */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Division Distribution */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-xs">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-600" />
            Distribusi Aset Berdasarkan Owner Divisi
          </h3>
          <p className="text-[11px] text-slate-500">Mengikuti nilai owner_division pada data aset. RPC/SC dan PIBC adalah lokasi kantor, bukan divisi; record lama yang menaruhnya sebagai owner dipisahkan untuk koreksi.</p>
          <div className="space-y-3 text-xs">
            {ownerDivisionStats.length === 0 && unclassifiedOwnerAssets.length === 0 && (
              <div className="text-slate-500">Belum ada data aset dalam filter ini.</div>
            )}
            {ownerDivisionStats.map((group, index) => {
              const percentage = Math.round((group.count / totalAssetCount) * 100);
              const barColors = ['bg-blue-600', 'bg-amber-500', 'bg-emerald-600', 'bg-purple-600', 'bg-cyan-600'];
              return (
                <div key={group.owner}>
                  <div className="flex justify-between text-slate-700 mb-1 font-medium">
                    <span>{group.owner}</span>
                    <span className="font-bold text-slate-900">{group.count} Unit ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className={`${barColors[index % barColors.length]} h-2.5 rounded-full`} style={{ width: `${percentage}%` }} />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Nilai perolehan: {formatRupiah(group.value)}</div>
                </div>
              );
            })}
            {unclassifiedOwnerAssets.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex justify-between font-semibold text-amber-900">
                  <span>Owner belum diklasifikasikan / berisi kode lokasi</span>
                  <span>{unclassifiedOwnerAssets.length} Unit ({Math.round((unclassifiedOwnerAssets.length / totalAssetCount) * 100)}%)</span>
                </div>
                <div className="text-[11px] text-amber-800 mt-1">Perlu pemetaan owner divisi yang benar; kode lokasi tidak otomatis dianggap sebagai divisi.</div>
              </div>
            )}
          </div>
        </div>

        {/* SLA Breakdown by Priority */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-xs">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            Kinerja Penyelesaian SLA Helpdesk
          </h3>
          <div className="space-y-3 text-xs">
            {prioritySlaGroups.map(group => (
              <div key={group.label} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className={`font-bold ${group.textColor}`}>{group.label}</div>
                  <div className="text-[11px] text-slate-500">{group.description} · {group.stats.completedCount} tiket selesai</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold text-slate-900">
                    {group.stats.onTimePct === null ? '—' : `${group.stats.onTimePct}%`}
                  </div>
                  <div className="text-[10px] text-slate-600 font-medium">
                    {group.stats.averageResolutionHours === null
                      ? 'Durasi penyelesaian belum tersedia'
                      : `Rata-rata ${group.stats.averageResolutionHours.toFixed(1)} jam`}
                  </div>
                  <div className="text-[10px] text-slate-500">{group.stats.measuredCount} tiket memiliki data SLA lengkap</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Rekapitulasi Kategori Aset Berdasarkan Kode Saat Ini */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-emerald-600" />
              Rekapitulasi Kategori Aset Berdasarkan Kode Saat Ini
            </h3>
            <p className="text-xs text-slate-500">
              Pengelompokan indikatif dari kode kategori dan nomor aset yang tersimpan; bukan standar akuntansi atau daftar kategori resmi.
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
            Total {filteredAssets.length} Aset Terdata
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-3">Kode</th>
                <th className="py-2.5 px-3">Klasifikasi Aktiva Tetap</th>
                <th className="py-2.5 px-3">Kategori / Owner Data</th>
                <th className="py-2.5 px-3 text-center">Jumlah Unit</th>
                <th className="py-2.5 px-3 text-right">Nilai Perolehan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {taxonomyGroups.map((group) => (
                <tr key={group.code} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                      {group.code}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-800">
                    {group.name}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {group.code.startsWith('IT') ? (
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200 text-[10px]">
                        Devisi IT (Milik IT, GA Read-only)
                      </span>
                    ) : group.code === 'INV-F' ? (
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200 text-[10px]">
                        Devisi GA (Semua Lokasi Milik GA)
                      </span>
                    ) : group.code === 'MSN' ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 text-[10px]">
                        SC / PIBC (Pabrik &amp; Timbangan)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200 text-[10px]">
                        GA / Operasional
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                    {group.count} Unit
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    {formatRupiah(group.value)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                <td colSpan={3} className="py-3 px-3 text-right uppercase text-[11px]">Total Seluruh Aktiva</td>
                <td className="py-3 px-3 text-center">{filteredAssets.length} Unit</td>
                <td className="py-3 px-3 text-right font-mono text-emerald-700">{formatRupiah(totalAssetValue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  );
};
