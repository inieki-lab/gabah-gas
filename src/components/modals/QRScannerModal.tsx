import React, { useState, useEffect, useRef } from 'react';
import { 
  ScanLine, 
  X, 
  Camera, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Laptop, 
  Car, 
  KeyRound, 
  Tag, 
  Package, 
  CalendarClock, 
  LifeBuoy, 
  QrCode, 
  Volume2, 
  VolumeX,
  ExternalLink,
  Barcode
} from 'lucide-react';
import { Asset } from '../../types';
import { formatRupiah } from '../../services/gabahService';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  onSelectAsset: (asset: Asset) => void;
  onOpenLoanModal: (asset: Asset) => void;
  onOpenTicketModal: (asset: Asset) => void;
  onOpenQrModal: (asset: Asset) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  assets,
  onSelectAsset,
  onOpenLoanModal,
  onOpenTicketModal,
  onOpenQrModal,
}) => {
  const [scanInput, setScanInput] = useState('');
  const [matchedAsset, setMatchedAsset] = useState<Asset | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Play pleasant beep sound using Web Audio API on successful scan
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // Audio context might be restricted before user gesture
    }
  };

  // Camera stream initiation
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isOpen && cameraActive) {
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
          setCameraError(null);
        })
        .catch(() => {
          setCameraError('Akses kamera tidak diizinkan atau tidak tersedia di perangkat ini. Gunakan mode manual/barcode scanner.');
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [isOpen, cameraActive]);

  // Focus input on mount
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    } else {
      setScanInput('');
      setMatchedAsset(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSearchCode = (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setMatchedAsset(null);
      return;
    }

    const found = assets.find(a => 
      a.asset_number.toLowerCase() === q ||
      a.corporate_asset_number?.toLowerCase() === q ||
      a.serial_number.toLowerCase() === q ||
      a.id.toLowerCase() === q ||
      a.name.toLowerCase().includes(q)
    );

    if (found) {
      setMatchedAsset(found);
      playBeep();
    } else {
      setMatchedAsset(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setScanInput(val);
    handleSearchCode(val);
  };

  const handleSimulatedScan = (code: string) => {
    setScanInput(code);
    handleSearchCode(code);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <ScanLine className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">Scanner Barcode &amp; QR Code Aset</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Stock Opname &amp; Handover
                </span>
              </div>
              <p className="text-xs text-slate-500">Scan label stiker fisik untuk pencarian instan dan audit gudang.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
              title={soundEnabled ? 'Mute Suara Beep' : 'Nyalakan Suara Beep'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-700" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          
          {/* Viewport Camera / Scanner Simulation */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-300 aspect-video flex items-center justify-center shadow-inner">
            {cameraActive && !cameraError ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="p-6 text-center space-y-2">
                <Barcode className="w-12 h-12 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-300 max-w-xs mx-auto">
                  {cameraError || 'Mode Barcode Scanner USB / Gun Scanner Fisik Aktif. Arahkan laser scanner ke label aset.'}
                </p>
              </div>
            )}

            {/* Target Reticle Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                
                {/* Laser scan line animation */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-400/80 shadow-[0_0_8px_#34d399] animate-[bounce_2s_infinite]" />
              </div>
            </div>

            {/* Camera Switcher badge */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur border border-white/10 text-slate-200">
              <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
                <ScanLine className="w-3.5 h-3.5" /> Sensor Siap Membaca
              </span>
              <button
                onClick={() => setCameraActive(!cameraActive)}
                className="hover:text-white underline"
              >
                {cameraActive ? 'Gunakan Laser Scanner' : 'Nyalakan Kamera'}
              </button>
            </div>
          </div>

          {/* Quick Input Barcode / Gun Scanner */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Input Nomor Aset / Serial / Barcode Manual:</span>
              <span className="text-[10px] text-slate-500 font-normal">Support Barcode Scanner Gun</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={scanInput}
                onChange={handleInputChange}
                placeholder="Contoh: IT-HLT-2026-0001 atau SN: PF-4X99Z1..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
              />
            </div>
          </div>

          {/* Quick Demo Test Chips */}
          <div className="space-y-1">
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <span>Uji Coba Scan Cepat:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {assets.slice(0, 4).map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleSimulatedScan(a.asset_number)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-mono text-emerald-800 border border-slate-200 transition-colors font-semibold"
                >
                  {a.asset_number}
                </button>
              ))}
            </div>
          </div>

          {/* Matched Asset Preview Card */}
          {matchedAsset ? (
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-300 space-y-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-900">Aset Berhasil Terdeteksi</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {matchedAsset.asset_number}
                </span>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-emerald-700 shadow-xs">
                  {matchedAsset.category_type === 'IT' && <Laptop className="w-6 h-6" />}
                  {matchedAsset.category_type === 'General' && <Car className="w-6 h-6" />}
                  {matchedAsset.category_type === 'License' && <KeyRound className="w-6 h-6" />}
                </div>

                <div className="flex-1 text-xs space-y-1">
                  <div className="font-extrabold text-slate-900 text-sm">{matchedAsset.name}</div>
                  <div className="text-slate-600">{matchedAsset.brand} • {matchedAsset.model}</div>
                  <div className="text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                    <span>SN: <strong className="font-mono text-slate-800">{matchedAsset.serial_number}</strong></span>
                    <span>Lokasi: <strong className="text-slate-800">{matchedAsset.location}</strong></span>
                    <span>Status: <strong className="capitalize text-slate-900">{matchedAsset.status}</strong></span>
                  </div>
                </div>
              </div>

              {/* Quick action buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200">
                <button
                  onClick={() => {
                    onClose();
                    onSelectAsset(matchedAsset);
                  }}
                  className="px-2 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold text-center transition-colors"
                >
                  Detail Lengkap
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onOpenQrModal(matchedAsset);
                  }}
                  className="px-2 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold text-center transition-colors"
                >
                  Cetak Label QR
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onOpenTicketModal(matchedAsset);
                  }}
                  className="px-2 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold text-center transition-colors"
                >
                  Buat Tiket
                </button>

                {matchedAsset.is_loanable ? (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenLoanModal(matchedAsset);
                    }}
                    className="px-2 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold text-center transition-all shadow-xs"
                  >
                    Pinjam Aset
                  </button>
                ) : (
                  <div className="px-2 py-2 text-[10px] text-slate-400 italic text-center flex items-center justify-center">
                    Aset Tetap
                  </div>
                )}
              </div>

            </div>
          ) : scanInput.trim() !== '' ? (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>Aset dengan kode "{scanInput}" tidak ditemukan dalam database inventaris.</span>
            </div>
          ) : null}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>GABAH Mobile &amp; Desktop Optical Recognition</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
