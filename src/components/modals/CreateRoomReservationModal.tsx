import React, { useState, useMemo } from 'react';
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
  Sparkles,
  Info
} from 'lucide-react';
import { MeetingRoom, RoomReservation, UserProfile, MeetingType } from '../../types';

interface CreateRoomReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: MeetingRoom[];
  existingReservations: RoomReservation[];
  currentUser: UserProfile;
  preselectedRoomId?: string;
  onSuccess: (reservation: RoomReservation) => void;
  onSubmit: (payload: {
    room_id: string;
    title: string;
    description?: string;
    attendees_count: number;
    meeting_type: MeetingType;
    date: string;
    start_time: string;
    end_time: string;
    facilities_requested: string[];
    consumption_requested: boolean;
    consumption_notes?: string;
    notes?: string;
  }) => Promise<RoomReservation>;
}

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00'
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

  const [roomId, setRoomId] = useState<string>(preselectedRoomId || (rooms[0]?.id ?? ''));
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('11:00');
  const [attendeesCount, setAttendeesCount] = useState<number>(8);
  const [meetingType, setMeetingType] = useState<MeetingType>('internal');
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([
    'Polycom Studio Video Conference',
    'Smart TV 85" 4K HDR'
  ]);
  const [consumptionRequested, setConsumptionRequested] = useState<boolean>(false);
  const [consumptionNotes, setConsumptionNotes] = useState<string>('Snack box & Kopi/Teh dari pantry GA');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync preselected room if changed
  React.useEffect(() => {
    if (preselectedRoomId) {
      setRoomId(preselectedRoomId);
    } else if (!roomId && rooms.length > 0) {
      setRoomId(rooms[0].id);
    }
  }, [preselectedRoomId, rooms]);

  const selectedRoom = useMemo(() => {
    return (rooms || []).find(r => r.id === roomId) || (rooms || [])[0];
  }, [rooms, roomId]);

  // Real-time Anti-Collision check
  const conflictReservation = useMemo(() => {
    if (!roomId || !date || !startTime || !endTime) return null;
    if (startTime >= endTime) return null;

    return (existingReservations || []).find(r => {
      if (r.room_id !== roomId) return false;
      if (['rejected', 'cancelled'].includes(r.status)) return false;
      if (r.date !== date) return false;
      // Overlapping: StartA < EndB && EndA > StartB
      return startTime < r.end_time && endTime > r.start_time;
    });
  }, [existingReservations, roomId, date, startTime, endTime]);

  const isCapacityExceeded = useMemo(() => {
    if (!selectedRoom) return false;
    return attendeesCount > selectedRoom.capacity;
  }, [selectedRoom, attendeesCount]);

  if (!isOpen) return null;

  const toggleFacility = (facility: string) => {
    setSelectedFacilities(prev => 
      prev.includes(facility) 
        ? prev.filter(f => f !== facility) 
        : [...prev, facility]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Agenda / Judul rapat wajib diisi.');
      return;
    }

    if (startTime >= endTime) {
      setErrorMessage('Jam mulai rapat harus lebih awal dari jam selesai.');
      return;
    }

    if (conflictReservation) {
      setErrorMessage(
        `Jadwal bentrok dengan agenda "${conflictReservation.title}" oleh ${conflictReservation.organizer_name} (${conflictReservation.start_time} - ${conflictReservation.end_time}). Silakan pilih jam atau ruangan lain.`
      );
      return;
    }

    if (isCapacityExceeded) {
      setErrorMessage(`Jumlah peserta (${attendeesCount}) melebihi kapasitas maksimum ruangan (${selectedRoom?.capacity} orang).`);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await onSubmit({
        room_id: roomId,
        title: title.trim(),
        description: description.trim(),
        attendees_count: Number(attendeesCount),
        meeting_type: meetingType,
        date,
        start_time: startTime,
        end_time: endTime,
        facilities_requested: selectedFacilities,
        consumption_requested: consumptionRequested,
        consumption_notes: consumptionRequested ? consumptionNotes.trim() : undefined,
        notes: notes.trim(),
      });
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal membuat reservasi ruangan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Building2 className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Formulir Reservasi Ruang Rapat</h2>
              <p className="text-xs text-emerald-100">Fasilitas General Affairs & Hybrid Meeting PT Food Station Tjipinang Jaya</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Perhatian</p>
                <p className="text-rose-700 text-xs mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Pemohon Information Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-slate-700">
            <div>
              <span className="text-slate-500">Pemohon Rapat:</span>{' '}
              <strong className="text-slate-900">{currentUser.name}</strong> ({currentUser.department})
            </div>
            <div className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
              Role: {currentUser.role}
            </div>
          </div>

          {/* Pilih Ruangan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Pilih Ruang Rapat <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {rooms.map(room => {
                const isSelected = room.id === roomId;
                const isMnt = room.status === 'maintenance';
                return (
                  <button
                    type="button"
                    key={room.id}
                    disabled={isMnt}
                    onClick={() => setRoomId(room.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      isSelected 
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20' 
                        : isMnt
                          ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900 leading-tight">{room.name}</h4>
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{room.building} - {room.floor}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        <Users className="w-3 h-3 text-slate-500" />
                        Kapasitas: {room.capacity} Orang
                      </span>
                      {isMnt ? (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                          Perawatan
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                          Tersedia
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Agenda & Tipe Rapat */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Agenda / Topik Rapat <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Rapat Koordinasi Distribusi Beras SPHP"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipe Rapat
              </label>
              <select
                value={meetingType}
                onChange={e => setMeetingType(e.target.value as MeetingType)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              >
                <option value="internal">Internal Perusahaan</option>
                <option value="external">Tamu Eksternal / Rekanan</option>
                <option value="hybrid">Hybrid (Zoom / Meet / Polycom)</option>
                <option value="direksi">Rapat Direksi & Komisaris</option>
              </select>
            </div>
          </div>

          {/* Tanggal & Waktu */}
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
                  onChange={e => setDate(e.target.value)}
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
                  onChange={e => setStartTime(e.target.value)}
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
                  onChange={e => setEndTime(e.target.value)}
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

            {/* Real-Time Conflict / Availability Indicator */}
            {conflictReservation ? (
              <div className="bg-rose-100/80 border border-rose-300 rounded-lg p-3 text-xs text-rose-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Tabrakan Jadwal Terdeteksi!</p>
                  <p className="mt-0.5 text-rose-800">
                    Ruangan ini sudah dipesan untuk agenda <strong>"{conflictReservation.title}"</strong> oleh{' '}
                    <strong>{conflictReservation.organizer_name}</strong> ({conflictReservation.start_time} - {conflictReservation.end_time}).
                  </p>
                </div>
              </div>
            ) : isCapacityExceeded ? (
              <div className="bg-amber-100/80 border border-amber-300 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Melebihi Kapasitas Ruangan!</p>
                  <p className="mt-0.5 text-amber-800">
                    Kapasitas maksimum {selectedRoom?.name} adalah {selectedRoom?.capacity} orang, Anda menginput {attendeesCount} orang.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Ruangan Tersedia!</strong> Tidak ada bentrok jadwal pada {date} pukul {startTime} - {endTime} WIB.
                </span>
              </div>
            )}
          </div>

          {/* Fasilitas yang Diperlukan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Fasilitas GA & IT Tambahan yang Diminta
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {[
                { name: 'Polycom Studio Video Conference', icon: Video },
                { name: 'Laser Projector & Layar', icon: Tv },
                { name: 'Smart TV 85" 4K HDR', icon: Tv },
                { name: 'Sound System & Wireless Mic', icon: Mic },
                { name: 'Whiteboard Kaca & Spidol', icon: FileText },
                { name: 'Kabel HDMI / Converter Type-C', icon: Sparkles },
              ].map(item => {
                const checked = selectedFacilities.includes(item.name);
                const Icon = item.icon;
                return (
                  <button
                    type="button"
                    key={item.name}
                    onClick={() => toggleFacility(item.name)}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                      checked 
                        ? 'border-emerald-600 bg-emerald-50/60 text-emerald-950 font-medium' 
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                      checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {checked && '✓'}
                    </div>
                    <Icon className={`w-3.5 h-3.5 ${checked ? 'text-emerald-700' : 'text-slate-400'}`} />
                    <span className="truncate">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Konsumsi Pantry GA */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-amber-600" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Permintaan Konsumsi / Pantry GA</h4>
                  <p className="text-[11px] text-slate-500">Snack box, air mineral, teh & kopi untuk rapat</p>
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
              <div className="pt-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan Menu & Jumlah Pax Konsumsi
                </label>
                <input
                  type="text"
                  value={consumptionNotes}
                  onChange={e => setConsumptionNotes(e.target.value)}
                  placeholder="Contoh: Snack box 15 pax, kopi & teh hangat, buah potong"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>
            )}
          </div>

          {/* Deskripsi & Catatan Tambahan */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Deskripsi Pertemuan & Kebutuhan Khusus
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Deskripsikan agenda rapat, susunan acara, atau instruksi khusus untuk staf General Affairs..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
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
              disabled={isSubmitting || !!conflictReservation || isCapacityExceeded}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memproses Reservasi...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Kirim Permintaan Reservasi</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
