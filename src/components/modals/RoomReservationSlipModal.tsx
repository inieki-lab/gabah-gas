import React from 'react';
import { 
  X, 
  Printer, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  Building2, 
  Users, 
  ShieldCheck,
  Coffee,
  Check,
  Laptop
} from 'lucide-react';
import { RoomReservation } from '../../types';
import { GabahService } from '../../services/gabahService';

interface RoomReservationSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: RoomReservation | null;
}

export const RoomReservationSlipModal: React.FC<RoomReservationSlipModalProps> = ({
  isOpen,
  onClose,
  reservation,
}) => {
  if (!isOpen || !reservation) return null;

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-300">DISETUJUI (APPROVED)</span>;
      case 'in_use':
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full border border-blue-300">SEDANG BERLANGSUNG</span>;
      case 'completed':
        return <span className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-full border border-slate-300">SELESAI (COMPLETED)</span>;
      case 'pending_approval':
        return <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-300">MENUNGGU VERIFIKASI GA</span>;
      case 'rejected':
        return <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-full border border-rose-300">DITOLAK (REJECTED)</span>;
      case 'cancelled':
        return <span className="px-3 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-full border border-slate-300">DIBATALKAN</span>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-6 print:shadow-none print:border-none print:max-w-none print:w-full">
        
        {/* Modal Bar (Hidden on print) */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm">Bukti Booking / Lembar Konfirmasi Reservasi</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div className="p-8 space-y-6 text-slate-900 font-sans">
          
          {/* Header Kop Surat BUMD PT Food Station Tjipinang Jaya */}
          <div className="border-b-2 border-slate-900 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-700 flex items-center justify-center text-white font-black text-sm">
                    FS
                  </div>
                  <div>
                    <h1 className="text-base font-black tracking-tight text-slate-900 uppercase">
                      PT Food Station Tjipinang Jaya
                    </h1>
                    <p className="text-[11px] text-slate-600 font-medium">
                      BUMD Pangan Provinsi DKI Jakarta • Pasar Induk Beras Cipinang
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Jl. Pisangan Lama Timur No. 1, Jakarta Timur 13230 • Telp: (021) 4786-9000
                </p>
              </div>

              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">NO. RESERVASI</p>
                <p className="text-sm font-black font-mono text-emerald-800">{reservation.reservation_number}</p>
                <p className="text-[10px] text-slate-500">Tgl Buat: {new Date(reservation.created_at).toLocaleDateString('id-ID')}</p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                TANDA BUKTI RESERVASI & PENGGUNAAN RUANG RAPAT
              </span>
              {getStatusBadge(reservation.status)}
            </div>
          </div>

          {/* Room & Meeting Details */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500">Ruangan</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{reservation.room_name}</p>
              <p className="text-slate-600 text-[11px]">{reservation.room_location}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500">Agenda / Topik Rapat</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{reservation.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-slate-600 text-[11px]">Tipe: <span className="capitalize font-semibold">{reservation.meeting_type}</span></span>
                <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                  reservation.priority === 'high'
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : reservation.priority === 'low'
                      ? 'bg-slate-100 text-slate-700 border border-slate-200'
                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  Prioritas: {reservation.priority || 'medium'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <p className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Tanggal Pelaksanaan
              </p>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                {new Date(reservation.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <p className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                Waktu Pelaksanaan
              </p>
              <p className="text-xs font-bold text-emerald-800 mt-0.5 font-mono">
                {reservation.start_time} - {reservation.end_time} WIB
              </p>
            </div>
          </div>

          {/* Organizer & Attendees */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="border border-slate-200 rounded-xl p-3.5">
              <p className="text-[10px] uppercase font-bold text-slate-500">Pemohon / Penyelenggara</p>
              <p className="text-xs font-bold text-slate-900 mt-1">{reservation.organizer_name}</p>
              <p className="text-[11px] text-slate-600">Divisi: {reservation.organizer_department}</p>
              <p className="text-[11px] text-slate-600">Kontak: {reservation.organizer_phone}</p>
            </div>

            <div className="border border-slate-200 rounded-xl p-3.5">
              <p className="text-[10px] uppercase font-bold text-slate-500">Kapasitas & Peserta</p>
              <div className="flex items-center gap-2 mt-1">
                <Users className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-900">{reservation.attendees_count} Orang</span>
              </div>
              {reservation.attendees_list && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                  <p className="text-[10px] text-slate-500 font-semibold">Daftar Peserta / Pejabat:</p>
                  <p className="text-[10px] text-slate-700 whitespace-pre-wrap">{reservation.attendees_list}</p>
                </div>
              )}
            </div>
          </div>

          {/* Layanan Konsumsi & Dokumentasi */}
          {(reservation.consumption_requested || reservation.documentation_requested) && (
            <div className="grid grid-cols-2 gap-4 text-xs">
              {reservation.consumption_requested && (
                <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-3.5">
                  <p className="text-[10px] uppercase font-bold text-amber-900 flex items-center gap-1.5">
                    <Coffee className="w-3.5 h-3.5 text-amber-700" />
                    Layanan Konsumsi / Pantry GA
                  </p>
                  <p className="text-xs font-bold text-slate-900 mt-1">
                    {reservation.consumption_type || 'Snack Box & Kopi/Teh'} ({reservation.consumption_pax || reservation.attendees_count} Pax)
                  </p>
                  {reservation.consumption_serving_time && (
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Penyajian: Pukul {reservation.consumption_serving_time} WIB
                    </p>
                  )}
                  {reservation.consumption_notes && (
                    <p className="text-[10px] text-slate-600 italic mt-0.5">"{reservation.consumption_notes}"</p>
                  )}
                </div>
              )}

              {reservation.documentation_requested && (
                <div className="border border-sky-200 bg-sky-50/50 rounded-xl p-3.5">
                  <p className="text-[10px] uppercase font-bold text-sky-900 flex items-center gap-1.5">
                    <span>📸</span>
                    Layanan Dokumentasi & Humas
                  </p>
                  <p className="text-xs font-bold text-slate-900 mt-1">
                    {reservation.documentation_type || 'Foto Dokumentasi Kegiatan'}
                  </p>
                  {reservation.documentation_notes && (
                    <p className="text-[10px] text-slate-600 italic mt-0.5">"{reservation.documentation_notes}"</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Interruption Notice if shifted */}
          {reservation.was_interrupted && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-950">
              <p className="font-bold">⚠️ Informasi Penyesuaian Ruang Rapat (Prioritas Direksi):</p>
              <p className="text-[11px] text-purple-900 mt-0.5">
                Reservasi ini sebelumnya dijadwalkan di <strong>{reservation.original_room_name || 'Ruang Setra Wangi'}</strong> dan telah dialihkan secara resmi oleh {reservation.interrupted_by || 'Sekretaris Direksi'}.
              </p>
              {reservation.interruption_reason && (
                <p className="text-[10px] text-purple-800 italic mt-0.5">Alasan: "{reservation.interruption_reason}"</p>
              )}
            </div>
          )}

          {/* Fasilitas yang Disiapkan */}
          {reservation.facilities_requested && reservation.facilities_requested.length > 0 && (() => {
            const itItems = GabahService.getITFacilities(reservation);
            const gaItems = GabahService.getGAFacilities(reservation);
            return (
              <div className="border border-slate-200 rounded-xl p-3.5 text-xs space-y-2.5">
                <p className="text-[10px] uppercase font-bold text-slate-500">Fasilitas GA &amp; IT yang Disiapkan</p>
                {itItems.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-sky-900 flex items-center gap-1 mb-1">
                      <Laptop className="w-3.5 h-3.5 text-sky-600" />
                      Dukungan Tim IT Support:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {itItems.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-50 text-sky-900 text-[11px] border border-sky-200 font-medium">
                          <Check className="w-3 h-3 text-sky-600" />
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {gaItems.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1 mb-1">
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                      Sarana Tim General Affairs (GA):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {gaItems.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-900 text-[11px] border border-emerald-200 font-medium">
                          <Check className="w-3 h-3 text-emerald-600" />
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {itItems.length === 0 && gaItems.length === 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {reservation.facilities_requested.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 text-[11px] border border-slate-200">
                        <Check className="w-3 h-3 text-emerald-600" />
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Tata Tertib Ruang Rapat */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-950 space-y-1">
            <p className="font-bold flex items-center gap-1 text-amber-900">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              Ketentuan Pemakaian Ruangan:
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-amber-900/90 text-[10px]">
              <li>Harap lakukan check-in kepada petugas GA saat memasuki ruangan.</li>
              <li>Jaga kebersihan perangkat IT (smart TV, kabel HDMI, mikrofon nirkabel) dan kembalikan ke posisi semula.</li>
              <li>Matikan AC dan lampu jika rapat telah selesai mendahului jadwal dan konfirmasi check-out ke GA.</li>
            </ul>
          </div>

          {/* Signatures */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-2 text-center text-xs">
            <div>
              <p className="text-slate-500 text-[11px]">Penyelenggara / Pemohon,</p>
              <div className="h-16 flex items-center justify-center">
                <span className="text-slate-300 italic text-[10px]">[Tanda Tangan Digital]</span>
              </div>
              <p className="font-bold text-slate-900 underline">{reservation.organizer_name}</p>
              <p className="text-[10px] text-slate-500">{reservation.organizer_department}</p>
            </div>

            <div>
              <p className="text-slate-500 text-[11px]">General Affairs (GA) Approval,</p>
              <div className="h-16 flex items-center justify-center">
                {reservation.approver_name ? (
                  <div className="border border-emerald-500 rounded px-2 py-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold">
                    VERIFIED & APPROVED
                  </div>
                ) : (
                  <span className="text-slate-300 italic text-[10px]">[Menunggu Approval]</span>
                )}
              </div>
              <p className="font-bold text-slate-900 underline">{reservation.approver_name || 'Petugas GA BUMD'}</p>
              <p className="text-[10px] text-slate-500">Divisi General Affairs</p>
            </div>
          </div>

          {/* Footer note */}
          <div className="text-center pt-2 text-[9px] text-slate-400">
            Dicetak secara otomatis dari Sistem Informasi GABAH (General Affairs & Asset BUMD Hub) • Dokumen resmi sah tanpa stempel basah
          </div>

        </div>

      </div>
    </div>
  );
};
