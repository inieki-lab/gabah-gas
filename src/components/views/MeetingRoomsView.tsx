import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  Calendar, 
  Clock, 
  Users, 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText, 
  Printer, 
  Coffee, 
  Video, 
  Tv, 
  Check, 
  LogIn, 
  LogOut, 
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Settings,
  Camera,
  Sparkles,
  Laptop
} from 'lucide-react';
import { MeetingRoom, RoomReservation, UserProfile } from '../../types';
import { CreateRoomReservationModal } from '../modals/CreateRoomReservationModal';
import { RoomReservationSlipModal } from '../modals/RoomReservationSlipModal';
import { MeetingMasterSettingsModal } from '../modals/MeetingMasterSettingsModal';
import { GabahService } from '../../services/gabahService';

interface MeetingRoomsViewProps {
  rooms: MeetingRoom[];
  reservations: RoomReservation[];
  currentUser: UserProfile;
  onCreateReservation: (payload: any) => Promise<RoomReservation>;
  onApproveReservation: (id: string) => Promise<RoomReservation>;
  onRejectReservation: (id: string, reason: string) => Promise<RoomReservation>;
  onCheckinReservation: (id: string) => Promise<RoomReservation>;
  onCheckoutReservation: (id: string) => Promise<RoomReservation>;
  onCancelReservation: (id: string) => Promise<RoomReservation>;
  onUpdateRoomStatus?: (roomId: string, status: 'available' | 'maintenance') => Promise<MeetingRoom>;
  onRefresh?: () => void;
  initialCategoryFilter?: 'all' | 'consumption' | 'documentation' | 'it_facilities' | 'ga_facilities' | 'high_priority';
}

type SubTab = 'calendar' | 'rooms' | 'reservations';

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export const MeetingRoomsView: React.FC<MeetingRoomsViewProps> = ({
  rooms = [],
  reservations = [],
  currentUser,
  onCreateReservation,
  onApproveReservation,
  onRejectReservation,
  onCheckinReservation,
  onCheckoutReservation,
  onCancelReservation,
  onUpdateRoomStatus,
  onRefresh,
  initialCategoryFilter,
}) => {
  const [activeTab, setActiveTab] = useState<SubTab>(initialCategoryFilter ? 'reservations' : 'calendar');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRoomForBooking, setSelectedRoomForBooking] = useState<string | undefined>();
  const [selectedSlipReservation, setSelectedSlipReservation] = useState<RoomReservation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rejectReasonPromptId, setRejectReasonPromptId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isMasterSettingsModalOpen, setIsMasterSettingsModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'consumption' | 'documentation' | 'it_facilities' | 'ga_facilities' | 'high_priority'>(initialCategoryFilter || 'all');
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (initialCategoryFilter) {
      setCategoryFilter(initialCategoryFilter);
      setActiveTab('reservations');
    }
  }, [initialCategoryFilter]);

  const isGAOrAdmin = currentUser.role === 'Admin GABAH' || currentUser.role === 'GA';
  const isAuditor = currentUser.role === 'Auditor';

  // Stats
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayReservations = reservations.filter(r => r.date === todayStr && !['cancelled', 'rejected'].includes(r.status));
    const pendingCount = reservations.filter(r => r.status === 'pending_approval').length;
    const inUseCount = reservations.filter(r => r.status === 'in_use').length;
    const activeRooms = rooms.filter(r => r.status !== 'maintenance').length;
    const consumptionCount = reservations.filter(r => r.consumption_requested).length;
    const documentationCount = reservations.filter(r => r.documentation_requested).length;
    const highPriorityCount = reservations.filter(r => r.priority === 'high').length;
    const itFacilitiesCount = reservations.filter(r => !['cancelled', 'rejected'].includes(r.status) && GabahService.getITFacilities(r).length > 0).length;
    const gaFacilitiesCount = reservations.filter(r => !['cancelled', 'rejected'].includes(r.status) && GabahService.getGAFacilities(r).length > 0).length;

    return {
      activeRooms,
      todayCount: todayReservations.length,
      pendingCount,
      inUseCount,
      consumptionCount,
      documentationCount,
      highPriorityCount,
      itFacilitiesCount,
      gaFacilitiesCount,
    };
  }, [rooms, reservations]);

  // Filtered reservations for Table tab
  const filteredReservations = useMemo(() => {
    return reservations.filter(r => {
      // Room Filter
      if (roomFilter !== 'all' && r.room_id !== roomFilter) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchRoom = r.room_name.toLowerCase().includes(q);
        const matchOrganizer = r.organizer_name.toLowerCase().includes(q);
        const matchDept = r.organizer_department.toLowerCase().includes(q);
        const matchNum = r.reservation_number.toLowerCase().includes(q);
        if (!matchTitle && !matchRoom && !matchOrganizer && !matchDept && !matchNum) {
          return false;
        }
      }
      // Status
      if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false;
      }
      // Category Filter (IT Facilities, GA Facilities, Consumption, Documentation, Priority)
      if (categoryFilter === 'it_facilities' && GabahService.getITFacilities(r).length === 0) {
        return false;
      }
      if (categoryFilter === 'ga_facilities' && GabahService.getGAFacilities(r).length === 0) {
        return false;
      }
      if (categoryFilter === 'consumption' && !r.consumption_requested) {
        return false;
      }
      if (categoryFilter === 'documentation' && !r.documentation_requested) {
        return false;
      }
      if (categoryFilter === 'high_priority' && r.priority !== 'high') {
        return false;
      }
      return true;
    });
  }, [reservations, searchQuery, statusFilter, categoryFilter, roomFilter]);

  // Date Navigation helper
  const handleShiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleApprove = async (id: string) => {
    try {
      setActionError(null);
      setActionLoadingId(id);
      await onApproveReservation(id);
      onRefresh?.();
    } catch (err: any) {
      setActionError(err.message || 'Gagal menyetujui reservasi');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setActionError(null);
      setActionLoadingId(id);
      await onRejectReservation(id, rejectionReason || 'Kapasitas penuh / prioritas rapat direksi');
      setRejectReasonPromptId(null);
      setRejectionReason('');
      onRefresh?.();
    } catch (err: any) {
      setActionError(err.message || 'Gagal menolak reservasi');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCheckin = async (id: string) => {
    try {
      setActionError(null);
      setActionLoadingId(id);
      await onCheckinReservation(id);
      onRefresh?.();
    } catch (err: any) {
      setActionError(err.message || 'Gagal check-in');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCheckout = async (id: string) => {
    try {
      setActionError(null);
      setActionLoadingId(id);
      await onCheckoutReservation(id);
      onRefresh?.();
    } catch (err: any) {
      setActionError(err.message || 'Gagal check-out');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      setActionError(null);
      setActionLoadingId(id);
      await onCancelReservation(id);
      setCancelConfirmId(null);
      onRefresh?.();
    } catch (err: any) {
      setActionError(err.message || 'Gagal membatalkan reservasi');
    } finally {
      setActionLoadingId(null);
    }
  };

  const parseHourToPercent = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const totalMinutes = (h - 8) * 60 + m;
    const totalDayMinutes = 10 * 60; // from 08:00 to 18:00 = 10 hours
    const pct = (totalMinutes / totalDayMinutes) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-emerald-800/40">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 border border-emerald-400/30">
            <Building2 className="w-3.5 h-3.5" />
            <span>Fasilitas General Affairs (GA)</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
            Reservasi Ruang Rapat
          </h1>
          <p className="text-xs md:text-sm text-emerald-100/80 mt-1 max-w-xl">
            Sistem pemesanan, penjadwalan terpadu anti-tabrakan, dan pemenuhan fasilitas rapat serta pantry BUMD PT Food Station Tjipinang Jaya.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isGAOrAdmin && (
            <button
              onClick={() => setIsMasterSettingsModalOpen(true)}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition-all flex items-center gap-2"
              title="Kelola Master Tipe Rapat & Fasilitas IT/GA"
            >
              <Settings className="w-4 h-4 text-emerald-300" />
              <span>Master Tipe & Fasilitas</span>
            </button>
          )}

          {!isAuditor && (
            <button
              onClick={() => {
                setSelectedRoomForBooking(undefined);
                setIsCreateModalOpen(true);
              }}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-400/30 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Pesan Ruangan</span>
            </button>
          )}
        </div>
      </div>

      {/* Role Authority & Department Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 border border-slate-800 text-xs shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-400">Pengguna Login:</span>
          <strong className="text-white">{currentUser.name}</strong>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
            {currentUser.role}
          </span>
          {currentUser.role === 'Sekretaris Direksi' && (
            <span className="text-amber-300 text-[11px] font-medium ml-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Hak Interupsi Direksi Aktif: Berwenang menggeser jadwal Ruang Setra Wangi untuk agenda Direksi & Komisaris.
            </span>
          )}
          {currentUser.role === 'Humas' && (
            <span className="text-sky-300 text-[11px] font-medium ml-1 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-sky-400" />
              Akses Humas: Memantau & menangani order dokumentasi liputan foto/video rapat perusahaan.
            </span>
          )}
          {currentUser.role === 'GA' && (
            <span className="text-emerald-300 text-[11px] font-medium ml-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              Akses GA Sarpras: Verifikasi ruangan, sarana IT/audio-visual, dan layanan pantry konsumsi.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentUser.role === 'Humas' && (
            <button
              onClick={() => { setActiveTab('reservations'); setCategoryFilter('documentation'); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1.5 ${
                categoryFilter === 'documentation' && activeTab === 'reservations'
                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                  : 'bg-sky-950 text-sky-300 border-sky-700 hover:bg-sky-900'
              }`}
            >
              <Camera className="w-3 h-3" />
              <span>Permintaan Dokumentasi ({stats.documentationCount})</span>
            </button>
          )}
          {isGAOrAdmin && (
            <button
              onClick={() => { setActiveTab('reservations'); setCategoryFilter('consumption'); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1.5 ${
                categoryFilter === 'consumption' && activeTab === 'reservations'
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-amber-950 text-amber-300 border-amber-700 hover:bg-amber-900'
              }`}
            >
              <Coffee className="w-3 h-3" />
              <span>Order Pantry Konsumsi ({stats.consumptionCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Ruangan Aktif</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.activeRooms}</p>
          <span className="text-[11px] text-slate-500">dari total {rooms.length} ruangan GA</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Rapat Hari Ini</span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.todayCount}</p>
          <span className="text-[11px] text-slate-500">agenda terjadwal</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Sedang Digunakan</span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{stats.inUseCount}</p>
          <span className="text-[11px] text-emerald-600 font-medium">ruangan in use</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Menunggu Approval GA</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">{stats.pendingCount}</p>
          <span className="text-[11px] text-amber-700 font-medium">perlu verifikasi</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'calendar'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Jadwal & Kalender Harian</span>
          </button>

          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'rooms'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Katalog Ruangan ({rooms.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reservations')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all relative ${
              activeTab === 'reservations' && categoryFilter !== 'documentation'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Daftar Reservasi ({reservations.length})</span>
            {stats.pendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>

          {currentUser.role === 'Humas' && (
            <button
              onClick={() => {
                setActiveTab('reservations');
                setCategoryFilter('documentation');
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'reservations' && categoryFilter === 'documentation'
                  ? 'bg-sky-600 text-white shadow-xs ring-2 ring-sky-400'
                  : 'text-sky-700 bg-sky-50 hover:bg-sky-100 hover:text-sky-900 border border-sky-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-sky-500" />
              <span>Request Foto &amp; Liputan ({stats.documentationCount})</span>
              {stats.documentationCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-sky-600 text-white text-[10px] font-black">
                  {stats.documentationCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          TAB 1: JADWAL & KALENDER VISUAL
         ======================================================== */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          
          {/* Date Selector Controls */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleShiftDate(-1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
              />
              <button
                onClick={() => handleShiftDate(1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
              >
                Hari Ini
              </button>

              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                <span className="text-xs font-semibold text-slate-600">Ruangan:</span>
                <select
                  value={roomFilter}
                  onChange={e => setRoomFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold border border-sky-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                >
                  <option value="all">Semua Ruangan</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block" />
                Disetujui
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block" />
                Sedang Digunakan
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" />
                Menunggu GA
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 rounded-xs bg-slate-200 border border-slate-300 inline-block" />
                Tersedia
              </span>
            </div>
          </div>

          {/* Timeline View per Room */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
            <div className="min-w-[850px]">
              
              {/* Timeline Header (Hours: 08:00 - 18:00) */}
              <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 py-2.5 px-4">
                <div className="col-span-3">Ruang Rapat</div>
                <div className="col-span-9 flex justify-between pr-2 font-mono">
                  {HOURS.map(h => (
                    <span key={h} className="text-center w-8">
                      {String(h).padStart(2, '0')}:00
                    </span>
                  ))}
                </div>
              </div>

              {/* Rows per Room */}
              <div className="divide-y divide-slate-200">
                {rooms.filter(room => roomFilter === 'all' || room.id === roomFilter).map(room => {
                  const roomReservationsToday = reservations.filter(
                    r => r.room_id === room.id && 
                         r.date === selectedDate && 
                         !['rejected', 'cancelled'].includes(r.status)
                  );

                  return (
                    <div key={room.id} className="grid grid-cols-12 items-center px-4 py-3 hover:bg-slate-50/50 transition-colors">
                      {/* Room Info */}
                      <div className="col-span-3 pr-3">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">{room.name}</h4>
                          {room.status === 'maintenance' && (
                            <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-sm font-semibold">
                              Perawatan
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">{room.building} - {room.floor}</p>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                          <Users className="w-3 h-3" />
                          <span>{room.capacity} Orang</span>
                          <span className="mx-1">•</span>
                          <span className="capitalize">{room.type}</span>
                        </div>
                      </div>

                      {/* Visual Timeline Bar */}
                      <div className="col-span-9 relative h-12 bg-slate-100/80 rounded-lg border border-slate-200 overflow-hidden">
                        
                        {/* Hour Grid Lines */}
                        <div className="absolute inset-0 flex justify-between pointer-events-none px-4">
                          {HOURS.map((h, i) => (
                            <div key={i} className="border-r border-dashed border-slate-200 h-full" />
                          ))}
                        </div>

                        {/* Render Booked Slots */}
                        {roomReservationsToday.map(r => {
                          const leftPct = parseHourToPercent(r.start_time);
                          const rightPct = parseHourToPercent(r.end_time);
                          const widthPct = Math.max(5, rightPct - leftPct);

                          let bgClass = 'bg-emerald-600 border-emerald-700 text-white';
                          if (r.status === 'in_use') bgClass = 'bg-blue-600 border-blue-700 text-white animate-pulse';
                          if (r.status === 'pending_approval') bgClass = 'bg-amber-500 border-amber-600 text-white';
                          if (r.status === 'completed') bgClass = 'bg-slate-500 border-slate-600 text-white opacity-80';

                          return (
                            <div
                              key={r.id}
                              onClick={() => setSelectedSlipReservation(r)}
                              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                              title={`${r.title} (${r.start_time} - ${r.end_time}) - ${r.organizer_name}`}
                              className={`absolute top-1 bottom-1 rounded-md px-2 py-1 shadow-xs border cursor-pointer flex flex-col justify-center overflow-hidden transition-transform hover:scale-[1.02] hover:z-10 ${bgClass}`}
                            >
                              <div className="text-[10px] font-bold truncate leading-none">
                                {r.title}
                              </div>
                              <div className="text-[9px] opacity-90 truncate leading-tight mt-0.5 font-mono">
                                {r.start_time}-{r.end_time} • {r.organizer_name}
                              </div>
                            </div>
                          );
                        })}

                        {/* Empty Click-to-book hint */}
                        {roomReservationsToday.length === 0 && room.status !== 'maintenance' && !isAuditor && (
                          <div 
                            onClick={() => {
                              setSelectedRoomForBooking(room.id);
                              setIsCreateModalOpen(true);
                            }}
                            className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-400 hover:text-emerald-700 hover:bg-emerald-50/40 cursor-pointer transition-colors"
                          >
                            + Klik untuk pesan ruangan ini
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: KATALOG RUANGAN
         ======================================================== */}
      {activeTab === 'rooms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rooms.map(room => {
            const isMnt = room.status === 'maintenance';
            return (
              <div 
                key={room.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Photo & Status Badge */}
                  <div className="relative h-44 w-full bg-slate-800 overflow-hidden">
                    <img
                      src={room.image_url || 'https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=800&q=80'}
                      alt={room.name}
                      className="w-full h-full object-cover opacity-90 hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-900/80 text-white backdrop-blur-xs">
                        {room.code}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3">
                      {isMnt ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-600 text-white shadow-sm">
                          Pemeliharaan
                        </span>
                      ) : room.status === 'in_use' ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white shadow-sm flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          Sedang Digunakan
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white shadow-sm">
                          Tersedia
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Room Details */}
                  <div className="p-5 space-y-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{room.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{room.building} • {room.floor}</p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-semibold text-slate-800">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        Maks {room.capacity} Orang
                      </span>
                      <span>•</span>
                      <span className="capitalize">{room.type} Meeting</span>
                    </div>

                    {/* Facilities Chips */}
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Fasilitas Tersedia:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {room.facilities.map((fac, idx) => (
                          <span key={idx} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            {fac}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-5 pt-0 flex items-center justify-between gap-2 border-t border-slate-100 mt-4">
                  {isGAOrAdmin && onUpdateRoomStatus && (
                    <button
                      onClick={() => onUpdateRoomStatus(room.id, isMnt ? 'available' : 'maintenance')}
                      className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                        isMnt 
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {isMnt ? 'Aktifkan Ruangan' : 'Set Pemeliharaan'}
                    </button>
                  )}

                  {!isAuditor && (
                    <button
                      disabled={isMnt}
                      onClick={() => {
                        setSelectedRoomForBooking(room.id);
                        setIsCreateModalOpen(true);
                      }}
                      className="ml-auto px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Pesan Ruangan Ini</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================
          TAB 3: DAFTAR RESERVASI LENGKAP
         ======================================================== */}
      {activeTab === 'reservations' && (
        <div className="space-y-4">
          
          {/* Category Filter Pills (Semua, IT Support, GA Sarpras, Pantry GA, Dokumentasi Humas, Prioritas Direksi) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                categoryFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Semua ({reservations.length})
            </button>
            <button
              onClick={() => setCategoryFilter('it_facilities')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                categoryFilter === 'it_facilities'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white text-sky-800 hover:bg-sky-50 border border-sky-200'
              }`}
            >
              <Laptop className="w-3.5 h-3.5 text-sky-500" />
              <span>Dukungan IT Support ({stats.itFacilitiesCount})</span>
            </button>
            <button
              onClick={() => setCategoryFilter('ga_facilities')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                categoryFilter === 'ga_facilities'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Sarana GA ({stats.gaFacilitiesCount})</span>
            </button>
            <button
              onClick={() => setCategoryFilter('consumption')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                categoryFilter === 'consumption'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>Order Pantry GA ({stats.consumptionCount})</span>
            </button>
            <button
              onClick={() => setCategoryFilter('documentation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                categoryFilter === 'documentation'
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'bg-white text-sky-800 hover:bg-sky-50 border border-sky-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Dokumentasi Humas ({stats.documentationCount})</span>
            </button>
            <button
              onClick={() => setCategoryFilter('high_priority')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                categoryFilter === 'high_priority'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white text-purple-800 hover:bg-purple-50 border border-purple-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Prioritas Direksi ({stats.highPriorityCount})</span>
            </button>
          </div>

          {/* Filters & Search */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari agenda, pemohon, ruangan, atau no. booking..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Meeting Room:</span>
                <select
                  value={roomFilter}
                  onChange={e => setRoomFilter(e.target.value)}
                  className="px-3 py-2 text-xs border border-sky-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800 shadow-2xs"
                >
                  <option value="all">Select Meeting Room (Semua)</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                >
                  <option value="all">Semua Status</option>
                  <option value="pending_approval">Menunggu Approval GA</option>
                  <option value="approved">Disetujui</option>
                  <option value="in_use">Sedang Digunakan</option>
                  <option value="completed">Selesai</option>
                  <option value="rejected">Ditolak</option>
                  <option value="cancelled">Dibatalkan</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold">
                    <th className="py-3 px-4">No. Reservasi & Prioritas</th>
                    <th className="py-3 px-4">Ruangan</th>
                    <th className="py-3 px-4">Agenda & Penyelenggara</th>
                    <th className="py-3 px-4">Tanggal & Waktu</th>
                    <th className="py-3 px-4">Layanan & Fasilitas</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredReservations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                        Tidak ada data reservasi ruang rapat yang cocok.
                      </td>
                    </tr>
                  ) : (
                    filteredReservations.map(r => {
                      const isOwner = r.organizer_id === currentUser.id;
                      const isLoading = actionLoadingId === r.id;

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                          
                          {/* No RSV & Prioritas */}
                          <td className="py-3.5 px-4 font-mono">
                            <p className="font-semibold text-emerald-800">{r.reservation_number}</p>
                            <div className="mt-1">
                              {r.priority === 'high' ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-300 inline-flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5" /> High / Direksi
                                </span>
                              ) : r.priority === 'low' ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  Low / Internal
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                  Medium / Reguler
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Ruangan */}
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-900">{r.room_name}</p>
                            <p className="text-[11px] text-slate-500">{r.room_location}</p>
                            {r.was_interrupted && (
                              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-semibold" title={`Dialihkan dari ${r.original_room_name || 'Setra Wangi'}: ${r.interruption_reason || 'Prioritas Rapat Direksi'}`}>
                                <span>⚠️ Dialihkan dari {r.original_room_name || 'Setra Wangi'}</span>
                              </div>
                            )}
                          </td>

                          {/* Agenda & Organizer */}
                          <td className="py-3.5 px-4 max-w-xs">
                            <p className="font-bold text-slate-900 truncate" title={r.title}>
                              {r.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-medium capitalize">
                                {r.meeting_type}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                Oleh: <strong className="text-slate-700">{r.organizer_name}</strong> ({r.organizer_department})
                              </span>
                            </div>
                            {r.attendees_list && (
                              <p className="text-[10px] text-slate-500 truncate mt-1" title={r.attendees_list}>
                                👥 Peserta: {r.attendees_list}
                              </p>
                            )}
                          </td>

                          {/* Jadwal */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <p className="font-semibold text-slate-800">{r.date}</p>
                            <p className="text-[11px] font-mono text-emerald-700">
                              {r.start_time} - {r.end_time} WIB
                            </p>
                          </td>

                          {/* Layanan & Fasilitas */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <div className="text-[11px] font-semibold text-slate-800">
                                👥 {r.attendees_count} Peserta
                              </div>
                              {r.consumption_requested ? (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-900 text-[10px] font-semibold border border-amber-200">
                                  <Coffee className="w-3 h-3 text-amber-700" />
                                  <span>{r.consumption_type || 'Pantry'} ({r.consumption_pax || r.attendees_count} pax)</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 block">Tanpa Konsumsi</span>
                              )}
                              {r.documentation_requested && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 text-sky-900 text-[10px] font-semibold border border-sky-200">
                                  <Camera className="w-3 h-3 text-sky-600" />
                                  <span>{r.documentation_type || 'Liputan Humas'}</span>
                                </div>
                              )}
                              {r.facilities_requested && r.facilities_requested.length > 0 && (() => {
                                const itItems = GabahService.getITFacilities(r);
                                const gaItems = GabahService.getGAFacilities(r);
                                return (
                                  <div className="pt-0.5 space-y-1">
                                    {itItems.length > 0 && (
                                      <div className="flex items-start gap-1 text-[10px] text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                                        <Laptop className="w-3 h-3 text-sky-600 shrink-0 mt-0.5" />
                                        <span className="font-medium">IT: {itItems.join(', ')}</span>
                                      </div>
                                    )}
                                    {gaItems.length > 0 && (
                                      <div className="flex items-start gap-1 text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                        <Building2 className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                                        <span className="font-medium">GA: {gaItems.join(', ')}</span>
                                      </div>
                                    )}
                                    {itItems.length === 0 && gaItems.length === 0 && (
                                      <p className="text-[10px] text-slate-500">
                                        🛠️ {r.facilities_requested.join(', ')}
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {r.status === 'approved' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Disetujui GA
                              </span>
                            )}
                            {r.status === 'in_use' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1 w-fit">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                                Sedang Dipakai
                              </span>
                            )}
                            {r.status === 'pending_approval' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Menunggu Approval
                              </span>
                            )}
                            {r.status === 'completed' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Selesai
                              </span>
                            )}
                            {r.status === 'rejected' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200" title={r.rejection_reason}>
                                Ditolak
                              </span>
                            )}
                            {r.status === 'cancelled' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400 border border-slate-200">
                                Dibatalkan
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            
                            {/* View & Print Slip */}
                            <button
                              onClick={() => setSelectedSlipReservation(r)}
                              title="Cetak Bukti Booking"
                              className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center gap-1"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-semibold">Slip Bukti</span>
                            </button>

                            {/* GA / Admin Approve / Reject */}
                            {isGAOrAdmin && r.status === 'pending_approval' && (
                              <>
                                <button
                                  disabled={isLoading}
                                  onClick={() => handleApprove(r.id)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-xs"
                                >
                                  Setujui
                                </button>
                                <button
                                  disabled={isLoading}
                                  onClick={() => setRejectReasonPromptId(r.id)}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-xs"
                                >
                                  Tolak
                                </button>
                              </>
                            )}

                            {/* Check-In / Check-Out */}
                            {r.status === 'approved' && (
                              <button
                                disabled={isLoading}
                                onClick={() => handleCheckin(r.id)}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-xs inline-flex items-center gap-1"
                              >
                                <LogIn className="w-3 h-3" />
                                <span>Check-In</span>
                              </button>
                            )}

                            {r.status === 'in_use' && (
                              <button
                                disabled={isLoading}
                                onClick={() => handleCheckout(r.id)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[11px] font-bold transition-colors shadow-xs inline-flex items-center gap-1"
                              >
                                <LogOut className="w-3 h-3" />
                                <span>Check-Out</span>
                              </button>
                            )}

                            {/* Cancel Reservation */}
                            {['pending_approval', 'approved'].includes(r.status) && (isGAOrAdmin || isOwner) && (
                              <button
                                disabled={isLoading}
                                onClick={() => setCancelConfirmId(r.id)}
                                className="px-2 py-1 text-slate-500 hover:text-rose-600 text-[11px] font-semibold transition-colors"
                              >
                                Batalkan
                              </button>
                            )}

                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-600 hover:text-rose-900 font-bold ml-2"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm space-y-3 border border-slate-200">
            <h4 className="text-sm font-bold text-slate-900">Batalkan Reservasi Ruangan</h4>
            <p className="text-xs text-slate-600">
              Apakah Anda yakin ingin membatalkan reservasi ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelConfirmId(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
              >
                Kembali
              </button>
              <button
                onClick={() => handleCancel(cancelConfirmId)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-2xs"
              >
                Ya, Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Prompt Modal */}
      {rejectReasonPromptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-md space-y-3">
            <h4 className="text-sm font-bold text-slate-900">Alasan Penolakan Reservasi Ruang Rapat</h4>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Contoh: Bentrok dengan agenda prioritas Rapat Direksi & Komisaris..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setRejectReasonPromptId(null);
                  setRejectionReason('');
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={() => handleReject(rejectReasonPromptId)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Reservation Modal */}
      <CreateRoomReservationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        rooms={rooms}
        existingReservations={reservations}
        currentUser={currentUser}
        preselectedRoomId={selectedRoomForBooking}
        onSubmit={onCreateReservation}
        onSuccess={() => {
          onRefresh?.();
        }}
      />

      {/* Official Booking Slip Modal */}
      <RoomReservationSlipModal
        isOpen={!!selectedSlipReservation}
        onClose={() => setSelectedSlipReservation(null)}
        reservation={selectedSlipReservation}
      />

      {/* Admin Master Settings Modal (Meeting Types & Facilities CRUD) */}
      <MeetingMasterSettingsModal
        isOpen={isMasterSettingsModalOpen}
        onClose={() => setIsMasterSettingsModalOpen(false)}
        onDataChanged={() => {
          onRefresh?.();
        }}
      />

    </div>
  );
};
