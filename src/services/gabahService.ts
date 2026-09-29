import { Asset, AssetStatus, AssetCondition, Loan, Ticket, UserProfile, UserRole, RoomReservation, MeetingFacilityItem } from '../types';

/**
 * Currency Formatter (IDR)
 */
export function formatRupiah(amount: number): string {
  if (isNaN(amount)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Date Formatter
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * DateTime Formatter
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Calculate Remaining Days until Expiry
 */
export function calculateDaysRemaining(expiryDate: string | null | undefined): number {
  if (!expiryDate) return 0;
  const diff = new Date(expiryDate).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Asset Depreciation Calculator (Straight-Line Method)
 * Supports passing either an Asset object or individual numerical parameters.
 */
export function calculateDepreciation(
  assetOrPrice: number | Partial<Asset>,
  purchaseDateArg?: string,
  usefulLifeYearsArg?: number
) {
  let price = 0;
  let purchaseDateStr = new Date().toISOString();
  let usefulLifeYears = 4;

  if (typeof assetOrPrice === 'object' && assetOrPrice !== null) {
    price = assetOrPrice.purchase_price || assetOrPrice.price || 0;
    purchaseDateStr = assetOrPrice.purchase_date || new Date().toISOString();
    if (assetOrPrice.category_type === 'GA' || assetOrPrice.owner_division === 'GA') {
      usefulLifeYears = 8; // Vehicles and furniture typical life
    } else {
      usefulLifeYears = 4; // IT equipment typical life
    }
  } else {
    price = Number(assetOrPrice) || 0;
    purchaseDateStr = purchaseDateArg || new Date().toISOString();
    usefulLifeYears = usefulLifeYearsArg || 4;
  }

  const start = purchaseDateStr ? new Date(purchaseDateStr) : new Date();
  const now = new Date();
  const elapsedMonths = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
  const usefulLifeMonths = Math.max(1, usefulLifeYears * 12);
  const monthlyDepreciation = price / usefulLifeMonths;
  const accumulatedDepreciation = Math.min(price, monthlyDepreciation * elapsedMonths);
  const netBookValue = Math.max(0, price - accumulatedDepreciation);
  const remainingMonths = Math.max(0, usefulLifeMonths - elapsedMonths);
  const depreciationPercentage = price > 0 ? Math.min(100, Math.round((accumulatedDepreciation / price) * 100)) : 0;

  return {
    netBookValue,
    currentValue: netBookValue,
    accumulatedDepreciation,
    monthlyDepreciation,
    elapsedMonths,
    ageMonths: elapsedMonths,
    remainingMonths,
    usefulLifeYears,
    usefulLifeMonths,
    depreciationPercentage,
  };
}

/**
 * CSV Exporters
 */
export function exportAssetsToCsv(assets: Asset[]) {
  const headers = ['Nomor Aset', 'Nomor Accurate', 'Nama Aset', 'Divisi Pemilik', 'Kategori', 'Kondisi', 'Status', 'Lokasi', 'Harga Beli'];
  const rows = assets.map(a => [
    `"${a.asset_number}"`,
    `"${a.corporate_asset_number || '-'}"`,
    `"${a.name}"`,
    `"${a.owner_division}"`,
    `"${a.category_type}"`,
    `"${a.condition}"`,
    `"${a.status}"`,
    `"${a.location}"`,
    `"${a.purchase_price || 0}"`,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `gabah_assets_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportLoansToCsv(loans: Loan[]) {
  const headers = ['Nomor Peminjaman', 'Nomor Aset', 'Nama Aset', 'Peminjam', 'Divisi/Dept', 'Mulai', 'Batas Waktu', 'Status'];
  const rows = loans.map(l => [
    `"${l.loan_number}"`,
    `"${l.asset_number}"`,
    `"${l.asset_name}"`,
    `"${l.borrower_name}"`,
    `"${l.borrower_department}"`,
    `"${l.start_date}"`,
    `"${l.due_date}"`,
    `"${l.status}"`,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `gabah_loans_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportTicketsToCsv(tickets: Ticket[]) {
  const headers = ['Nomor Tiket', 'Judul', 'Kategori', 'Prioritas', 'Status', 'Pelapor', 'Departemen', 'Target SLA (Jam)'];
  const rows = tickets.map(t => [
    `"${t.ticket_number}"`,
    `"${t.title.replace(/"/g, '""')}"`,
    `"${t.category}"`,
    `"${t.priority}"`,
    `"${t.status}"`,
    `"${t.reporter_name}"`,
    `"${t.reporter_department}"`,
    `"${t.sla_hours}"`,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `gabah_tickets_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportMaintenanceToCsv(schedules: any[]) {
  const headers = ['Kode Jadwal', 'Aset', 'Nomor Aset', 'Divisi', 'Frekuensi', 'Tgl Pelaksanaan', 'Status', 'Teknisi / Rekanan', 'Estimasi Biaya'];
  const rows = schedules.map(s => [
    `"${s.schedule_code}"`,
    `"${(s.asset_name || '').replace(/"/g, '""')}"`,
    `"${s.asset_number || '-'}"`,
    `"${s.owner_division}"`,
    `"${s.frequency}"`,
    `"${s.scheduled_date}"`,
    `"${s.status}"`,
    `"${(s.technician_name || s.vendor_name || '-').replace(/"/g, '""')}"`,
    `"${s.estimated_cost || 0}"`,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `gabah_maintenance_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Presentation and UX Helpers
 */
export class GabahService {
  static getStatusBadge(status: AssetStatus | string): { label: string; color: string } {
    switch (status) {
      case 'active':
        return { label: 'Aktif', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'assigned':
      case 'in_use':
        return { label: 'Ditugaskan (In Use)', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'available':
        return { label: 'Tersedia di Gudang', color: 'bg-teal-50 text-teal-700 border-teal-200' };
      case 'reserved':
      case 'loaned':
        return { label: 'Dipinjam / Direservasi', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'in_repair':
      case 'maintenance':
        return { label: 'Dalam Perbaikan', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'damaged':
        return { label: 'Rusak', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'cannibalized':
        return { label: 'Dikanibal', color: 'bg-orange-50 text-orange-700 border-orange-200' };
      case 'pending_disposal':
        return { label: 'Usulan Afkir', color: 'bg-red-50 text-red-700 border-red-200' };
      case 'pending_auction':
        return { label: 'Usulan Lelang', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'auctioned':
        return { label: 'Telah Dilelang', color: 'bg-zinc-50 text-zinc-700 border-zinc-200' };
      case 'disposed':
        return { label: 'Dihapuskan / Afkir', color: 'bg-stone-100 text-stone-600 border-stone-300' };
      case 'lost':
        return { label: 'Hilang', color: 'bg-red-100 text-red-800 border-red-300' };
      case 'inactive':
        return { label: 'Non-Aktif', color: 'bg-gray-100 text-gray-700 border-gray-200' };
      default:
        return { label: status, color: 'bg-gray-50 text-gray-700 border-gray-200' };
    }
  }

  static getConditionBadge(condition: AssetCondition | string): { label: string; color: string } {
    switch (condition) {
      case 'new':
        return { label: 'Baru', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'good':
      case 'excellent':
        return { label: 'Baik', color: 'bg-teal-50 text-teal-700 border-teal-200' };
      case 'fair':
        return { label: 'Wajar / Cukup', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'poor':
        return { label: 'Kurang / Butuh Servis', color: 'bg-orange-50 text-orange-700 border-orange-200' };
      case 'broken':
      case 'damaged':
        return { label: 'Rusak Berat', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      default:
        return { label: condition, color: 'bg-gray-50 text-gray-700 border-gray-200' };
    }
  }

  static getLoanStatusBadge(status: string): { label: string; color: string } {
    switch (status) {
      case 'pending_approval':
      case 'pending':
        return { label: 'Menunggu Persetujuan', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'approved':
        return { label: 'Disetujui (Siap Ambil)', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'borrowed':
      case 'active':
        return { label: 'Sedang Dipinjam', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'returned':
        return { label: 'Sudah Dikembalikan', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'rejected':
        return { label: 'Ditolak', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'overdue':
        return { label: 'Jatuh Tempo (Terlambat)', color: 'bg-red-50 text-red-700 border-red-300' };
      default:
        return { label: status, color: 'bg-gray-50 text-gray-700 border-gray-200' };
    }
  }

  static getTicketPriorityBadge(priority: string): { label: string; color: string } {
    switch (priority) {
      case 'urgent':
        return { label: 'Urgent (SLA 4h)', color: 'bg-rose-100 text-rose-800 border-rose-300 font-semibold' };
      case 'high':
        return { label: 'High (SLA 8h)', color: 'bg-orange-100 text-orange-800 border-orange-300' };
      case 'medium':
        return { label: 'Medium (SLA 24h)', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'low':
        return { label: 'Low (SLA 48h)', color: 'bg-blue-100 text-blue-800 border-blue-300' };
      default:
        return { label: priority, color: 'bg-gray-100 text-gray-800 border-gray-300' };
    }
  }

  static getDivisionBadge(division: string): { label: string; color: string } {
    switch (division) {
      case 'IT':
        return { label: 'Divisi IT', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'GA':
        return { label: 'Divisi GA', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'SC':
        return { label: 'Divisi Supply Chain', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'PIBC':
        return { label: 'Divisi Pasar PIBC', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      default:
        return { label: division, color: 'bg-gray-50 text-gray-700 border-gray-200' };
    }
  }

  // Pre-check collision detection for responsive UI feedback
  static checkLoanConflict(
    assetId: string,
    startDateIso: string,
    dueDateIso: string,
    existingLoans: Loan[],
    excludeLoanId?: string
  ): { hasConflict: boolean; conflictingLoan?: Loan; message?: string } {
    const newStart = new Date(startDateIso).getTime();
    const newDue = new Date(dueDateIso).getTime();

    if (isNaN(newStart) || isNaN(newDue)) {
      return { hasConflict: true, message: 'Format tanggal tidak valid.' };
    }
    if (newDue <= newStart) {
      return { hasConflict: true, message: 'Batas waktu pengembalian harus lebih akhir dari waktu mulai.' };
    }

    const activeReservations = existingLoans.filter(l => {
      if (l.id === excludeLoanId) return false;
      if (l.asset_id !== assetId) return false;
      return l.status === 'approved' || l.status === 'active' || (l.status as any) === 'borrowed';
    });

    for (const loan of activeReservations) {
      const existingStart = new Date(loan.start_date).getTime();
      const existingDue = new Date(loan.due_date).getTime();

      if (newStart < existingDue && newDue > existingStart) {
        return {
          hasConflict: true,
          conflictingLoan: loan,
          message: `Jadwal bentrok dengan peminjaman ${loan.loan_number} (${loan.borrower_name}) pada ${formatDateTime(loan.start_date)} s/d ${formatDateTime(loan.due_date)}.`,
        };
      }
    }

    return { hasConflict: false };
  }

  // RBAC Permission helpers
  static canEditAsset(user?: UserProfile, asset?: Asset | null): boolean {
    if (!user) return false;
    if (user.role === 'Admin GABAH') return true;
    if (!asset) return false;
    if (user.role === 'IT' && asset.owner_division === 'IT') return true;
    if (user.role === 'GA' && asset.owner_division === 'GA') return true;
    if (user.role === 'Supply Chain' && asset.owner_division === 'SC') return true;
    return false;
  }

  static canApproveLoan(user?: UserProfile, loan?: Loan | null): boolean {
    if (!user) return false;
    if (user.role === 'Admin GABAH') return true;
    if (!loan) return false;
    
    // Strict Authority: IT approves IT assets (laptop/hardware), GA approves GA assets (kendaraan/operasional),
    // Supply Chain approves SC assets, PIBC approves PIBC assets
    const ownerDiv = loan.owner_division || (loan.category_type === 'IT' ? 'IT' : 'GA');
    if (user.role === 'IT' && ownerDiv === 'IT') return true;
    if (user.role === 'GA' && ownerDiv === 'GA') return true;
    if (user.role === 'Supply Chain' && ownerDiv === 'SC') return true;
    if (user.role === 'PIBC' && ownerDiv === 'PIBC') return true;
    return false;
  }

  static canManageTickets(user?: UserProfile): boolean {
    if (!user) return false;
    return ['Admin GABAH', 'IT', 'GA', 'Supply Chain', 'PIBC'].includes(user.role);
  }

  /**
   * Rule:
   * "di semua user kecuali IT dan super admin dan GA (jika tiket ditujukan ke GA) 
   * informasi tiket yg bukan pelapor ybs jgn dimunculkan di menu tiket helpdesk, yg yg muncul hanya tiket nya sendiri"
   */
  static isTicketVisibleToUser(ticket: Ticket, user?: UserProfile | null): boolean {
    if (!user || !ticket) return false;

    // 1. IT and Super Admin (Admin GABAH) can see all tickets
    if (user.role === 'Admin GABAH' || user.role === 'IT') {
      return true;
    }

    // 1b. Auditor: strict read-only visibility over ALL tickets (never able to mutate)
    if (user.role === 'Auditor') {
      return true;
    }

    const currentUserId = user.id || '';
    const currentUserName = (user.name || '').trim().toLowerCase();
    const reporterName = (ticket.reporter_name || '').trim().toLowerCase();
    const isReporter = Boolean(
      (ticket.reporter_id && ticket.reporter_id === currentUserId) ||
      (reporterName && currentUserName && (reporterName === currentUserName || reporterName.includes(currentUserName) || currentUserName.includes(reporterName)))
    );

    // 2. GA: can see tickets directed to GA (category 'GA'), or tickets reported by GA user themselves
    if (user.role === 'GA') {
      return ticket.category === 'GA' || isReporter;
    }

    // 2b. Operational divisions: see tickets directed to their division plus their own tickets
    if (user.role === 'Supply Chain') {
      return (ticket.category as string) === 'SC' || isReporter;
    }
    if (user.role === 'PIBC') {
      return (ticket.category as string) === 'PIBC' || isReporter;
    }

    // 3. All other users (Karyawan, Humas, Sekretaris Direksi, Supply Chain, PIBC, Auditor, etc.):
    // ONLY see tickets where they are the reporter
    return isReporter;
  }

  static canManageTicket(ticket: Ticket, user?: UserProfile | null): boolean {
    if (!user || !ticket) return false;
    if (user.role === 'Admin GABAH' || user.role === 'IT') return true;
    if (user.role === 'GA' && ticket.category === 'GA') return true;
    if (user.role === 'Supply Chain' && ticket.category === 'SC') return true;
    if (user.role === 'PIBC' && (ticket.category as any) === 'PIBC') return true;
    return false;
  }

  static generateCorporateAssetNumber(categoryCodeOrAssets?: any, year: number = new Date().getFullYear()): string {
    let catCode = 'AST';
    if (typeof categoryCodeOrAssets === 'string') {
      catCode = categoryCodeOrAssets;
    }
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `ACC-${catCode.toUpperCase()}-${year}-${randomSuffix}`;
  }

  static isITFacility(facilityName: string, knownFacilities?: MeetingFacilityItem[]): boolean {
    if (!facilityName) return false;
    const clean = facilityName.trim().toLowerCase();
    if (knownFacilities && knownFacilities.length > 0) {
      const match = knownFacilities.find(f => f.name.toLowerCase() === clean);
      if (match) return match.category === 'IT';
    }
    const itKeywords = ['polycom', 'projector', 'proyektor', 'tv', 'hdmi', 'converter', 'video conference', 'vicon', 'zoom', 'camera', 'laptop', 'wifi', 'lan', 'audio visual', 'network'];
    return itKeywords.some(kw => clean.includes(kw));
  }

  static isGAFacility(facilityName: string, knownFacilities?: MeetingFacilityItem[]): boolean {
    if (!facilityName) return false;
    const clean = facilityName.trim().toLowerCase();
    if (knownFacilities && knownFacilities.length > 0) {
      const match = knownFacilities.find(f => f.name.toLowerCase() === clean);
      if (match) return match.category === 'GA';
    }
    const gaKeywords = ['sound', 'mic', 'wireless', 'whiteboard', 'spidol', 'kursi', 'meja', 'podium', 'ac', 'kebersihan', 'ruangan', 'pantry', 'snack', 'makan'];
    return gaKeywords.some(kw => clean.includes(kw));
  }

  static getITFacilities(reservation: RoomReservation, knownFacilities?: MeetingFacilityItem[]): string[] {
    if (!reservation.facilities_requested || !Array.isArray(reservation.facilities_requested)) return [];
    return reservation.facilities_requested.filter(f => this.isITFacility(f, knownFacilities));
  }

  static getGAFacilities(reservation: RoomReservation, knownFacilities?: MeetingFacilityItem[]): string[] {
    if (!reservation.facilities_requested || !Array.isArray(reservation.facilities_requested)) return [];
    return reservation.facilities_requested.filter(f => this.isGAFacility(f, knownFacilities));
  }
}
