import React, { useRef, useState } from 'react';
import { X, Printer, QrCode, Tag, Check, Building2, Filter, Layers } from 'lucide-react';
import { Asset } from '../../types';

interface BatchQRPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
}

export const BatchQRPrintModal: React.FC<BatchQRPrintModalProps> = ({
  isOpen,
  onClose,
  assets = [],
}) => {
  const [filterDivision, setFilterDivision] = useState<string>('ALL');
  const printRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen) return null;

  const filtered = assets.filter(a => {
    if (filterDivision === 'ALL') return true;
    return a.owner_division === filterDivision;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[92vh]">
        
        {/* Modal Toolbar (hidden during print) */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">Cetak Lembar Label Stiker QR (Batch A4)</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {filtered.length} Stiker Siap Cetak
                </span>
              </div>
              <p className="text-xs text-slate-500">Format stiker grid siap cetak ke kertas stiker A4 (Label Tom &amp; Jerry / Vinyl)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter division */}
            <select
              value={filterDivision}
              onChange={(e) => setFilterDivision(e.target.value)}
              className="text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Divisi ({assets.length})</option>
              <option value="IT">Divisi IT</option>
              <option value="GA">Divisi GA</option>
              <option value="Supply Chain">Supply Chain</option>
              <option value="PIBC">Pasar Induk PIBC</option>
            </select>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang (A4)</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Sheet Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 flex justify-center">
          <div
            ref={printRef}
            className="w-full max-w-[210mm] bg-white p-6 sm:p-8 shadow-xl rounded-sm border border-slate-200 print:m-0 print:p-2 print:border-none print:shadow-none"
            style={{ minHeight: '297mm' }}
          >
            {/* Sheet Header (only in print or preview) */}
            <div className="text-center pb-4 mb-4 border-b border-slate-300 flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold text-slate-900 uppercase">PT Food Station Tjipinang Jaya • Label Aset Resmi BUMD</span>
              <span>Dicetak: {new Date().toLocaleDateString('id-ID')}</span>
            </div>

            {/* Grid 2 Columns of Sturdy Sticker Labels */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-white text-slate-900 rounded-lg p-3.5 border-2 border-dashed border-slate-300 print:border-solid print:border-slate-800 flex flex-col justify-between space-y-2 shadow-2xs break-inside-avoid"
                >
                  {/* Label Header */}
                  <div className="flex items-center justify-between border-b pb-1.5 border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded bg-slate-900 text-white flex items-center justify-center font-black text-[10px]">
                        FS
                      </div>
                      <div>
                        <div className="font-black text-[10px] tracking-wider leading-none text-slate-900">PT FOOD STATION</div>
                        <div className="text-[7px] text-slate-500 font-bold uppercase mt-0.5">TJIPINANG JAYA (PERSERODA)</div>
                      </div>
                    </div>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300">
                      {asset.owner_division || asset.category_type}
                    </span>
                  </div>

                  {/* QR & Details */}
                  <div className="flex items-center gap-3">
                    {/* Compact QR Code */}
                    <div className="w-20 h-20 bg-white border border-slate-400 p-1 rounded shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        <rect x="0" y="0" width="30" height="30" fill="#0f172a" rx="2" />
                        <rect x="5" y="5" width="20" height="20" fill="#ffffff" rx="1" />
                        <rect x="10" y="10" width="10" height="10" fill="#0f172a" />
                        <rect x="70" y="0" width="30" height="30" fill="#0f172a" rx="2" />
                        <rect x="75" y="5" width="20" height="20" fill="#ffffff" rx="1" />
                        <rect x="80" y="10" width="10" height="10" fill="#0f172a" />
                        <rect x="0" y="70" width="30" height="30" fill="#0f172a" rx="2" />
                        <rect x="5" y="75" width="20" height="20" fill="#ffffff" rx="1" />
                        <rect x="10" y="80" width="10" height="10" fill="#0f172a" />
                        <rect x="36" y="8" width="6" height="18" fill="#0f172a" />
                        <rect x="50" y="14" width="8" height="6" fill="#0f172a" />
                        <rect x="14" y="38" width="8" height="14" fill="#0f172a" />
                        <rect x="36" y="36" width="28" height="28" fill="#0f172a" rx="2" />
                        <rect x="42" y="42" width="16" height="16" fill="#ffffff" />
                        <rect x="47" y="47" width="6" height="6" fill="#059669" />
                        <rect x="72" y="40" width="16" height="8" fill="#0f172a" />
                        <rect x="80" y="54" width="8" height="18" fill="#0f172a" />
                        <rect x="40" y="74" width="18" height="8" fill="#0f172a" />
                        <rect x="66" y="78" width="10" height="14" fill="#0f172a" />
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs font-black text-slate-900 truncate">
                        {asset.asset_number}
                      </div>
                      <div className="text-[11px] font-bold text-slate-800 line-clamp-1 mt-0.5">
                        {asset.name}
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono truncate mt-0.5">
                        SN: {asset.serial_number || 'REG-BUMD-01'}
                      </div>
                      <div className="text-[9px] text-slate-600 truncate mt-0.5">
                        Lokasi: {asset.location || 'Kantor Pusat Food Station'}
                      </div>
                    </div>
                  </div>

                  {/* Label Footer */}
                  <div className="text-[7px] text-slate-500 font-semibold border-t border-slate-200 pt-1 flex items-center justify-between">
                    <span>DILARANG MELEPAS STIKER TANPA IZIN</span>
                    <span className="font-mono">PORTAL GABAH</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between print:hidden">
          <span>Total {filtered.length} stiker dipilih</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
