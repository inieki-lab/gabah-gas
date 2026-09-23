import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Building2, 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  Coffee, 
  Video, 
  Mic, 
  Tv, 
  FileText,
  Camera,
  ShieldAlert,
  ArrowRightLeft,
  Sparkles,
  Info,
  Layers,
  ChevronRight,
  ChevronDown,
  MapPin,
  Check,
  Laptop
} from 'lucide-react';
import { 
  MeetingRoom, 
  RoomReservation, 
  UserProfile, 
  MeetingTypeItem, 
  MeetingFacilityItem, 
  MeetingPriority 
} from '../../types';
import { gabahApi } from '../../services/gabahApi';
import { GabahService } from '../../services/gabahService';

interface CreateRoomReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: MeetingRoom[];
  existingReservations: RoomReservation[];
  currentUser: UserProfile;
  preselectedRoomId?: string;
  onSuccess: (reservation: RoomReservation) => void;
  onSubmit: (payload: any) => Promise<RoomReservation>;
}

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00'
];

const DEFAULT_TYPES: MeetingTypeItem[] = [
  { id: '1', name: 'Internal Perusahaan', code: 'internal', description: 'Rapat koordinasi internal divisi/unit kerja', priority_level: 'low', color: 'blue' },
  { id: '2', name: 'Tamu Eksternal / Rekanan', code: 'external', description: 'Pertemuan dengan mitra usaha / vendor / instansi', priority_level: 'medium', color: 'emerald' },
  { id: '3', name: 'Hybrid (Video Conference)', code: 'hybrid', description: 'Rapat gabungan offline dan online Polycom/Zoom', priority_level: 'medium', color: 'amber' },
  { id: '4', name: 'Rapat Direksi & Dewan Komisaris', code: 'direksi', description: 'Agenda pimpinan Dewan Direksi & Komisaris Food Station', priority_level: 'high', color: 'purple' },
];

export const CreateRoomReservationModal: React.FC<CreateRoomReservationModalProps> = ({
  isOpen,
  onClose,
  rooms = [],
  existingReservations = [],
  currentUser,
  preselectedRoomId,
  onSuccess,
  onSubmit,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Dynamic Master Data
  const [meetingTypes, setMeetingTypes] = useState<MeetingTypeItem[]>(DEFAULT_TYPES);
  const [facilitiesList, setFacilitiesList] = useState<MeetingFacilityItem[]>([]);

  // Core Form State
  const [roomId, setRoomId] = useState<string>(preselectedRoomId || '');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('11:00');
  const [attendeesCount, setAttendeesCount] = useState<number>(8);
  const [attendeesList, setAttendeesList] = useState<string>('');
  const [meetingType, setMeetingType] = useState<string>('internal');
  const [priority, setPriority] = useState<MeetingPriority>('medium');
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([
    'Polycom Studio Video Conference',
    'Smart TV 85" 4K HDR'
  ]);

  // Consumption (Pantry GA)
  const [consumptionRequested, setConsumptionRequested] = useState<boolean>(false);
  const [consumptionType, setConsumptionType] = useState<string>('Snack Box & Kopi/Teh');
  const [consumptionPax, setConsumptionPax] = useState<number>(8);
  const [consumptionServingTime, setConsumptionServingTime] = useState<string>('09:30');
  const [consumptionNotes, setConsumptionNotes] = useState<string>('');

  // Documentation (Humas)
  const [documentationRequested, setDocumentationRequested] = useState<boolean>(false);
  const [documentationType, setDocumentationType] = useState<string>('Foto Dokumentasi Kegiatan');
  const [documentationNotes, setDocumentationNotes] = useState<string>('');

  // Interruption / Override
  const [enableOverride, setEnableOverride] = useState<boolean>(false);
  const [interruptionReason, setInterruptionReason] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serverConflictData, setServerConflictData] = useState<any | null>(null);

  // Privileged Role Check
  const canOverride = useMemo(() => {
    return (
      currentUser.role === 'Sekretaris Direksi' ||
      currentUser.role === 'GA' ||
      currentUser.role === 'Admin GABAH'
    );
  }, [currentUser.role]);

  // Load master types and facilities
  useEffect(() => {
    if (isOpen) {
      gabahApi.getMeetingTypes().then(types => {
        if (types && types.length > 0) setMeetingTypes(types);
      }).catch(() => {});

      gabahApi.getMeetingFacilities().then(facs => {
        if (facs && facs.length > 0) setFacilitiesList(facs);
      }).catch(() => {});
    }
  }, [isOpen]);

  // Auto set priority based on meeting type & user role
  useEffect(() => {
    if (currentUser.role === 'Sekretaris Direksi' || meetingType === 'direksi') {
      setPriority('high');
    }
    const matchedType = meetingTypes.find(t => t.code === meetingType);
    if (matchedType && matchedType.priority_level && currentUser.role !== 'Sekretaris Direksi') {
      setPriority(matchedType.priority_level);
    }
  }, [meetingType, meetingTypes, currentUser.role]);

  // Sync attendees pax with consumption pax
  useEffect(() => {
    if (attendeesCount > 0) {
      setConsumptionPax(attendeesCount);
    }
  }, [attendeesCount]);

  // Sync preselected room
  useEffect(() => {
    if (preselectedRoomId) {
      setRoomId(preselectedRoomId);
    }
  }, [preselectedRoomId]);

  const selectedRoom = useMemo(() => {
    return (rooms || []).find(r => r.id === roomId) || null;
  }, [rooms, roomId]);

  // Real-time Anti-Collision check on frontend
  const localConflictReservation = useMemo(() => {
    if (!roomId || !date || !startTime || !endTime) return null;
    if (startTime >= endTime) return null;

    return (existingReservations || []).find(r => {
      if (r.room_id !== roomId) return false;
      if (['rejected', 'cancelled'].includes(r.status)) return false;
      if (r.date !== date) return false;
      return startTime < r.end_time && endTime > r.start_time;
    });
  }, [existingReservations, roomId, date, startTime, endTime]);

  const activeConflict = serverConflictData || localConflictReservation;

  const isCapacityExceeded = useMemo(() => {
    if (!selectedRoom) return false;
    return attendeesCount > selectedRoom.capacity;
  }, [selectedRoom, attendeesCount]);

  if (!isOpen) return null;

  const toggleFacility = (facilityName: string) => {
    setSelectedFacilities(prev => 
      prev.includes(facilityName) 
        ? prev.filter(f => f !== facilityName) 
        : [...prev, facilityName]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!roomId) {
      setErrorMessage('Silakan pilih Meeting Room (Ruang Rapat) terlebih dahulu.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Agenda / Judul rapat wajib diisi.');
      return;
    }

    if (startTime >= endTime) {
      setErrorMessage('Jam mulai rapat harus lebih awal dari jam selesai.');
      return;
    }

    if (isCapacityExceeded) {
      setErrorMessage(`Jumlah peserta (${attendeesCount}) melebihi kapasitas maksimum ruangan (${selectedRoom?.capacity} orang).`);
      return;
    }

    if (activeConflict && !enableOverride) {
      setErrorMessage(
        `Jadwal bentrok dengan agenda "${activeConflict.title}" oleh ${activeConflict.organizer_name} (${activeConflict.start_time} - ${activeConflict.end_time}). ${canOverride ? 'Gunakan hak interupsi jika ini agenda prioritas Direksi.' : 'Silakan pilih slot waktu atau ruangan lain.'}`
      );
      return;
    }

    if (enableOverride && !interruptionReason.trim()) {
      setErrorMessage('Harap isi alasan interupsi atau instruksi pemindahan untuk agenda yang digeser.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await onSubmit({
        room_id: roomId,
        title: title.trim(),
        description: description.trim(),
        attendees_count: Number(attendeesCount),
        attendees_list: attendeesList.trim() || undefined,
        meeting_type: meetingType,
        priority,
        date,
        start_time: startTime,
        end_time: endTime,
        facilities_requested: selectedFacilities,
        consumption_requested: consumptionRequested,
        consumption_type: consumptionRequested ? consumptionType : undefined,
        consumption_pax: consumptionRequested ? Number(consumptionPax) : undefined,
        consumption_serving_time: consumptionRequested ? consumptionServingTime : undefined,
        consumption_notes: consumptionRequested ? consumptionNotes.trim() : undefined,
        documentation_requested: documentationRequested,
        documentation_type: documentationRequested ? documentationType : undefined,
        documentation_notes: documentationRequested ? documentationNotes.trim() : undefined,
        override_conflict: enableOverride,
        interruption_reason: enableOverride ? interruptionReason.trim() : undefined,
      });

      onSuccess(res);
      onClose();
    } catch (err: any) {
      if (err.conflict) {
        setServerConflictData(err.conflict);
      }
      setErrorMessage(err.message || 'Gagal membuat reservasi ruangan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Building2 className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Formulir Reservasi Ruang Rapat</h2>
                {currentUser.role === 'Sekretaris Direksi' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-xs">
                    Prioritas Direksi Aktif
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-100">Fasilitas General Affairs & Protokoler Pertemuan PT Food Station Tjipinang Jaya</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          
          {/* Pemohon Information Card (Requirement #8: Pemohon Tetap Ada) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Pemohon Rapat:</span>
              <strong className="text-slate-900 font-bold">{currentUser.name}</strong>
              <span className="text-slate-400">•</span>
              <span className="text-slate-700">{currentUser.department}</span>
              {currentUser.phone && (
                <>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600">{currentUser.phone}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Role Sistem:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                {currentUser.role}
              </span>
              {canOverride && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-300">
                  Hak Interupsi Ruang
                </span>
              )}
            </div>
          </div>

          {/* Schedule Conflict & Comparison Panel (Requirement: "jika salah tolong diberi keterangan ya.. biar bisa di compare..") */}
          {activeConflict && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                    Tabrakan Jadwal Terdeteksi! Perbandingan Jadwal:
                  </h3>
                  <p className="text-xs text-rose-800 mt-0.5">
                    Ruang <strong>{selectedRoom?.name}</strong> telah terisi pada rentang jam yang Anda pilih. Berikut perbandingannya:
                  </p>
                </div>
              </div>

              {/* Side-by-side comparison grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Existing Reservation */}
                <div className="bg-white border border-rose-200 rounded-lg p-3 text-xs shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between pb-1 border-b border-rose-100">
                    <span className="font-bold text-rose-800 text-[11px] uppercase tracking-wide">
                      1. Jadwal Eksisting (Terdaftar)
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                      {activeConflict.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Agenda:</span>{' '}
                    <strong className="text-slate-900">{activeConflict.title}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Pemesan:</span>{' '}
                    <span className="text-slate-800">{activeConflict.organizer_name} ({activeConflict.organizer_department})</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Waktu:</span>{' '}
                    <span className="font-semibold text-rose-700">{activeConflict.date} ({activeConflict.start_time} - {activeConflict.end_time} WIB)</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Prioritas:</span>{' '}
                    <span className="font-bold uppercase text-[10px] text-slate-700">{activeConflict.priority || 'medium'}</span>
                  </div>
                </div>

                {/* Requested Reservation */}
                <div className="bg-white border border-emerald-300 rounded-lg p-3 text-xs shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between pb-1 border-b border-emerald-100">
                    <span className="font-bold text-emerald-800 text-[11px] uppercase tracking-wide">
                      2. Pengajuan Jadwal Anda
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Baru
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Agenda:</span>{' '}
                    <strong className="text-slate-900">{title || '(Belum mengisi agenda)'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Pemesan:</span>{' '}
                    <span className="text-slate-800">{currentUser.name} ({currentUser.department})</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Waktu:</span>{' '}
                    <span className="font-semibold text-emerald-800">{date} ({startTime} - {endTime} WIB)</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Prioritas:</span>{' '}
                    <span className="font-bold uppercase text-[10px] text-purple-700">{priority}</span>
                  </div>
                </div>
              </div>

              {/* Requirement #4: Privileged Override for Sekretaris Direksi / GA */}
              {canOverride ? (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 mt-2 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">
                        Opsi Interupsi Ruang Rapat (Hak Akses {currentUser.role})
                      </h4>
                      <p className="text-[11px] text-amber-800">
                        Sesuai tata kelola, agenda pimpinan Direksi memiliki prioritas utama. Anda dapat menggeser rapat eksisting di atas ke ruangan alternatif lain (seperti Ruang Setra Ramos / Jasmine) atau menjadwal ulang secara otomatis.
                      </p>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableOverride}
                        onChange={e => setEnableOverride(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                    <span className="text-xs font-bold text-slate-800">
                      Gunakan Hak Interupsi Ruang (Prioritaskan Rapat Direksi & Pindahkan Jadwal Bentrok)
                    </span>
                  </div>

                  {enableOverride && (
                    <div className="pt-2 animate-in fade-in">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Alasan Interupsi / Instruksi Pemindahan Ruangan <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={interruptionReason}
                        onChange={e => setInterruptionReason(e.target.value)}
                        placeholder="Contoh: Digunakan Rapat Koordinasi Direksi Utama & Dewan Komisaris (jadwal eksisting dialihkan ke Ruang Setra Ramos)"
                        className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                      <p className="text-[10px] text-amber-800 mt-1">
                        Sistem akan mengalihkan reservasi sebelumnya ke ruangan lain yang muat dan mengirimkan notifikasi resmi kepada pemesan aslinya.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-rose-700 italic bg-white/70 p-2 rounded-lg border border-rose-200">
                  Untuk menggeser atau menggunakan ruang pada jam ini, hubungi <strong>Sekretaris Direksi</strong> atau <strong>Bagian General Affairs (GA)</strong>.
                </p>
              )}
            </div>
          )}

          {/* Regular Error Message if not conflict */}
          {errorMessage && !activeConflict && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3.5 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Perhatian:</strong> {errorMessage}
              </div>
            </div>
          )}

          {/* Section 1: Pilih Ruang Rapat - Tampilan Kartu Semua Ruangan (Bukan Dropdown) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-800">
                  1. Pilih Ruang Rapat <span className="text-rose-500">*</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Klik langsung kartu ruang rapat di bawah ini ({rooms.length} ruangan tersedia):
                </p>
              </div>
              {selectedRoom && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Ruangan Terpilih: <strong>{selectedRoom.name}</strong>
                </span>
              )}
            </div>

            {/* Grid Semua Ruangan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {rooms.map(room => {
                const isSelected = room.id === roomId;
                const isMnt = room.status === 'maintenance';

                return (
                  <button
                    key={room.id}
                    type="button"
                    disabled={isMnt}
                    onClick={() => {
                      if (!isMnt) {
                        setRoomId(room.id);
                        setServerConflictData(null);
                      }
                    }}
                    className={`relative text-left p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between gap-2.5 group cursor-pointer ${
                      isMnt
                        ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                        : isSelected
                          ? 'bg-emerald-50/90 border-emerald-600 shadow-md ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200 hover:border-emerald-400 hover:bg-slate-50/70 shadow-2xs'
                    }`}
                  >
                    {/* Header Card: Nama & Indikator Radio */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                            {room.name}
                          </span>
                          {room.name.toLowerCase().includes('setrawangi') && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                              VIP
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{room.building} ({room.floor})</span>
                        </div>
                      </div>

                      <div className="shrink-0 pt-0.5">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-300 group-hover:border-emerald-400 transition-colors" />
                        )}
                      </div>
                    </div>

                    {/* Kapasitas & Status Badges */}
                    <div className="flex items-center justify-between gap-2 text-[11px] pt-1">
                      <span className={`inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-md border ${
                        isSelected
                          ? 'bg-white border-emerald-200 text-emerald-800 shadow-2xs'
                          : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}>
                        <Users className="w-3 h-3 text-slate-500" />
                        Kapasitas: {room.capacity} Orang
                      </span>

                      {isMnt ? (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Perawatan
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                          Tersedia
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Room Full Details Strip */}
            {selectedRoom ? (
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      <span>{selectedRoom.name}</span>
                      <span className="text-[11px] font-normal text-slate-500">
                        • Lokasi: {selectedRoom.building} {selectedRoom.floor} • Kapasitas: <strong>{selectedRoom.capacity} Orang</strong>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Pengelola / PIC GA: <strong>{selectedRoom.pic_ga}</strong>
                    </p>
                  </div>
                </div>

                {isCapacityExceeded && (
                  <div className="flex items-center gap-1.5 text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg font-semibold text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Jumlah peserta ({attendeesCount}) melebihi kapasitas ruang ({selectedRoom.capacity})</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
                Silakan klik salah satu kartu ruang rapat di atas untuk melanjutkan pemesanan jadwal.
              </div>
            )}
          </div>

          {/* Section 2: Agenda, Tipe Rapat & Prioritas */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                2. Agenda / Topik Rapat <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Rapat Koordinasi Distribusi Beras SPHP & Stabilisasi Pasokan"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            {/* Requirement #1: Tipe Rapat (Dynamic CRUD Supported) */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Tipe Rapat
              </label>
              <select
                value={meetingType}
                onChange={e => setMeetingType(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium"
              >
                {meetingTypes.map(t => (
                  <option key={t.id} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Requirement #7: Prioritas Meeting (High, Medium, Low) */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Tingkat Prioritas
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as MeetingPriority)}
                className={`w-full px-3 py-2 text-xs border rounded-lg bg-white font-bold focus:outline-none focus:ring-2 ${
                  priority === 'high' 
                    ? 'border-purple-300 text-purple-900 bg-purple-50/50' 
                    : priority === 'medium'
                      ? 'border-blue-300 text-blue-900'
                      : 'border-slate-300 text-slate-800'
                }`}
              >
                <option value="high">🔴 High (Prioritas Direksi / Mendesak)</option>
                <option value="medium">🟡 Medium (Koordinasi Lintas Divisi)</option>
                <option value="low">🟢 Low (Reguler / Internal Tim)</option>
              </select>
            </div>
          </div>

          {/* Section 3: Tanggal & Waktu */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Tanggal Rapat <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => { setDate(e.target.value); setServerConflictData(null); }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Jam Mulai <span className="text-rose-500">*</span>
                </label>
                <select
                  value={startTime}
                  onChange={e => { setStartTime(e.target.value); setServerConflictData(null); }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                >
                  {TIME_SLOTS.map(t => (
                    <option key={t} value={t}>{t} WIB</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Jam Selesai <span className="text-rose-500">*</span>
                </label>
                <select
                  value={endTime}
                  onChange={e => { setEndTime(e.target.value); setServerConflictData(null); }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                >
                  {TIME_SLOTS.map(t => (
                    <option key={t} value={t}>{t} WIB</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  Jumlah Peserta <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={attendeesCount}
                  onChange={e => setAttendeesCount(parseInt(e.target.value) || 1)}
                  className={`w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 ${
                    isCapacityExceeded 
                      ? 'border-rose-400 focus:ring-rose-500/20 text-rose-700' 
                      : 'border-slate-300 focus:ring-emerald-500/20 focus:border-emerald-600'
                  }`}
                />
              </div>
            </div>

            {/* Availability status line */}
            {!activeConflict && !isCapacityExceeded && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Ruangan Tersedia!</strong> Tidak ada bentrok jadwal pada {date} pukul {startTime} - {endTime} WIB di {selectedRoom?.name}.
                </span>
              </div>
            )}
          </div>

          {/* Section 4: Inputan Peserta Meeting (Requirement #5: inputan peserta meeting di setiap ruang meeting) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>3. Daftar Peserta Rapat & Pejabat yang Hadir</span>
              <span className="text-[11px] font-normal text-slate-500">Maks. Kapasitas: {selectedRoom?.capacity} Orang</span>
            </label>
            <textarea
              rows={2}
              value={attendeesList}
              onChange={e => setAttendeesList(e.target.value)}
              placeholder="Contoh: 1. Direktur Utama, 2. Direktur Operasional, 3. Kadiv GA, 4. Kadiv Komersial, 5. Perwakilan Bulog (5 orang)"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          {/* Section 5: Fasilitas GA & IT Tambahan (Requirement #2: Fasilitas CRUD) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800">
                4. Fasilitas GA & IT Tambahan yang Diperlukan
              </label>
              <span className="text-[11px] text-slate-500">Pilih kebutuhan audio-visual & perlengkapan</span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {(facilitiesList.length > 0 ? facilitiesList : [
                { id: '1', name: 'Polycom Studio Video Conference', category: 'IT' },
                { id: '2', name: 'Laser Projector & Layar', category: 'IT' },
                { id: '3', name: 'Smart TV 85" 4K HDR', category: 'IT' },
                { id: '4', name: 'Sound System & Wireless Mic', category: 'GA' },
                { id: '5', name: 'Whiteboard Kaca & Spidol', category: 'GA' },
                { id: '6', name: 'Kabel HDMI / Converter Type-C', category: 'IT' },
              ]).map(item => {
                const checked = selectedFacilities.includes(item.name);
                const isIT = item.category === 'IT';
                return (
                  <button
                    type="button"
                    key={item.id || item.name}
                    onClick={() => toggleFacility(item.name)}
                    className={`p-2.5 rounded-lg border text-left flex items-center justify-between gap-2 transition-all ${
                      checked 
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-medium' 
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] shrink-0 ${
                        checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {checked && '✓'}
                      </div>
                      <span className="truncate">{item.name}</span>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase ${
                      isIT ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {item.category}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Real-time notification routing confirmation for Section 4 */}
            {(() => {
              const activeFacilitiesList = facilitiesList.length > 0 ? facilitiesList : [
                { id: '1', name: 'Polycom Studio Video Conference', category: 'IT' as const },
                { id: '2', name: 'Laser Projector & Layar', category: 'IT' as const },
                { id: '3', name: 'Smart TV 85" 4K HDR', category: 'IT' as const },
                { id: '4', name: 'Sound System & Wireless Mic', category: 'GA' as const },
                { id: '5', name: 'Whiteboard Kaca & Spidol', category: 'GA' as const },
                { id: '6', name: 'Kabel HDMI / Converter Type-C', category: 'IT' as const },
              ];
              const selectedIT = activeFacilitiesList.filter(f => selectedFacilities.includes(f.name) && (f.category === 'IT' || GabahService.isITFacility(f.name)));
              const selectedGA = activeFacilitiesList.filter(f => selectedFacilities.includes(f.name) && (f.category === 'GA' || GabahService.isGAFacility(f.name)));

              return (
                <div className="mt-2.5 space-y-1.5">
                  {selectedIT.length > 0 && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-950 text-xs animate-in fade-in">
                      <Laptop className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-sky-900">Notifikasi Otomatis ke Tim IT Support: </span>
                        <span className="text-sky-800">{selectedIT.map(f => f.name).join(', ')}</span>
                        <p className="text-[10px] text-sky-600 mt-0.5">Tiket persiapan perangkat &amp; uji koneksi vicon akan otomatis diteruskan ke petugas IT.</p>
                      </div>
                    </div>
                  )}
                  {selectedGA.length > 0 && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs animate-in fade-in">
                      <Building2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-emerald-900">Notifikasi Otomatis ke Tim GA (Sarpras): </span>
                        <span className="text-emerald-800">{selectedGA.map(f => f.name).join(', ')}</span>
                        <p className="text-[10px] text-emerald-600 mt-0.5">Penyiapan fisik tata ruang, mikrofon, dan sarana umum akan otomatis diteruskan ke petugas GA.</p>
                      </div>
                    </div>
                  )}
                  {selectedFacilities.length === 0 && (
                    <p className="text-[11px] text-slate-500 italic mt-1">
                      💡 Centang item di atas untuk mengirimkan permintaan fasilitas langsung ke tim IT Support (perangkat IT) dan tim GA (sarana fisik).
                    </p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Section 6: Permintaan Konsumsi / Pantry GA (Requirement #3: Permintaan konsumsi ke pantry masuk notif ke tim GA) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200">
                  <Coffee className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900">Permintaan Konsumsi / Pantry GA</h4>
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      Notifikasi Otomatis ke Tim GA
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Penyediaan snack box, makan siang prasmanan/box, teh & kopi dari pantry</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={consumptionRequested}
                  onChange={e => setConsumptionRequested(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {consumptionRequested && (
              <div className="pt-2 grid grid-cols-1 md:grid-cols-3 gap-3 animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Jenis Konsumsi
                  </label>
                  <select
                    value={consumptionType}
                    onChange={e => setConsumptionType(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="Snack Box & Kopi/Teh">Snack Box & Kopi/Teh</option>
                    <option value="Makan Siang (Rice Box / Bento)">Makan Siang (Rice Box / Bento)</option>
                    <option value="Makan Siang (Prasmanan / Buffet VIP)">Makan Siang (Prasmanan VIP Direksi)</option>
                    <option value="Coffee Break Pagi & Sore">Coffee Break Lengkap (Pagi & Sore)</option>
                    <option value="Air Mineral & Buah Segar">Air Mineral & Buah Potong Segar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Jumlah Porsi (Pax)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={consumptionPax}
                    onChange={e => setConsumptionPax(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Jam Penyajian di Ruangan
                  </label>
                  <select
                    value={consumptionServingTime}
                    onChange={e => setConsumptionServingTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {TIME_SLOTS.map(t => (
                      <option key={t} value={t}>{t} WIB</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Catatan Menu Khusus / Pantangan Makanan
                  </label>
                  <input
                    type="text"
                    value={consumptionNotes}
                    onChange={e => setConsumptionNotes(e.target.value)}
                    placeholder="Contoh: Menu tanpa santan, 2 porsi vegetarian untuk tamu rekanan, siapkan gula jagung"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 7: Permintaan Dokumentasi & Humas (Requirement #6: Dokumentasi ke Humas ada notif) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center border border-sky-200">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900">Permintaan Dokumentasi & Liputan Humas</h4>
                    <span className="text-[10px] font-semibold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full">
                      Notifikasi Otomatis ke Departemen Humas
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Fotografer, video dokumentasi, rilis media & publikasi portal perusahaan</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={documentationRequested}
                  onChange={e => setDocumentationRequested(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
              </label>
            </div>

            {documentationRequested && (
              <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Jenis Peliputan / Dokumentasi
                  </label>
                  <select
                    value={documentationType}
                    onChange={e => setDocumentationType(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-sky-500/20"
                  >
                    <option value="Foto Dokumentasi Kegiatan">Foto Dokumentasi Kegiatan (Kamera DSLR/Mirrorless)</option>
                    <option value="Video Liputan & Highlights">Video Liputan Singkat & Video Reels Media Sosial</option>
                    <option value="Press Release & Berita Portal">Press Release Media Massa & Berita Portal Internal</option>
                    <option value="Paket Lengkap (Foto, Video & Notulensi Humas)">Paket Lengkap VIP (Foto, Video, Siaran Pers)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Instruksi Khusus / Angle Dokumentasi
                  </label>
                  <input
                    type="text"
                    value={documentationNotes}
                    onChange={e => setDocumentationNotes(e.target.value)}
                    placeholder="Contoh: Fokus pada sesi penandatanganan MoU dengan Bulog pukul 10:00 WIB"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 8: Deskripsi / Catatan Tambahan */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              5. Catatan Tambahan / Instruksi Khusus
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Tambahkan catatan susunan acara, nomor kontak PIC di ruangan, atau hal khusus lainnya..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>Semua permintaan fasilitas, konsumsi & dokumentasi tercatat dalam BAST reservasi.</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={isSubmitting || (!!activeConflict && !enableOverride) || isCapacityExceeded}
                className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                  enableOverride 
                    ? 'bg-amber-600 hover:bg-amber-700' 
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memproses Reservasi...</span>
                  </>
                ) : enableOverride ? (
                  <>
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>Sahkan Reservasi & Alihkan Jadwal Bentrok</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Kirim Permintaan Reservasi</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
