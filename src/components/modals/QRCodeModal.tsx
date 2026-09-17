import React, { useRef } from 'react';
import { X, Printer, QrCode, Tag, Check, Building2 } from 'lucide-react';
import { Asset } from '../../types';

interface QRCodeModalProps {
  asset: Asset | null;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ asset, onClose }) => {
  if (!asset) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">Label Barcode &amp; QR Code Aset</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Physical Asset Label Tag */}
        <div className="p-6 flex flex-col items-center">
          
          <div 
            id="printable-asset-label"
            className="w-full bg-white text-slate-900 rounded-xl p-5 border-2 border-dashed border-slate-300 shadow-md space-y-3 print:border-black"
          >
            {/* Tag Header */}
            <div className="flex items-center justify-between border-b pb-2 border-slate-300">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center font-black text-xs">
                  G
                </div>
                <div>
                  <div className="font-black text-xs tracking-wider leading-none">PT FOOD STATION TJIPINANG JAYA</div>
                  <div className="text-[8px] text-slate-500 font-semibold mt-0.5">BUMD PANGAN DKI JAKARTA • GABAH</div>
                </div>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300">
                {asset.category_type}
              </span>
            </div>

            {/* Middle: QR SVG + Primary Numbers */}
            <div className="flex items-center gap-4 py-1">
              
              {/* QR Code SVG */}
              <div className="w-24 h-24 bg-white border border-slate-400 p-1 rounded-lg shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {/* Outer corner markers */}
                  <rect x="5" y="5" width="26" height="26" fill="#0f172a" />
                  <rect x="9" y="9" width="18" height="18" fill="#ffffff" />
                  <rect x="13" y="13" width="10" height="10" fill="#0f172a" />

                  <rect x="69" y="5" width="26" height="26" fill="#0f172a" />
                  <rect x="73" y="9" width="18" height="18" fill="#ffffff" />
                  <rect x="77" y="13" width="10" height="10" fill="#0f172a" />

                  <rect x="5" y="69" width="26" height="26" fill="#0f172a" />
                  <rect x="9" y="73" width="18" height="18" fill="#ffffff" />
                  <rect x="13" y="77" width="10" height="10" fill="#0f172a" />

                  {/* Pseudo random QR data dots */}
                  <rect x="36" y="8" width="6" height="6" fill="#0f172a" />
                  <rect x="48" y="14" width="6" height="6" fill="#0f172a" />
                  <rect x="36" y="24" width="6" height="6" fill="#0f172a" />
                  <rect x="54" y="24" width="6" height="6" fill="#0f172a" />

                  <rect x="8" y="36" width="6" height="6" fill="#0f172a" />
                  <rect x="20" y="44" width="6" height="6" fill="#0f172a" />
                  <rect x="8" y="54" width="6" height="6" fill="#0f172a" />
                  <rect x="40" y="40" width="18" height="18" fill="#0f172a" />
                  <rect x="44" y="44" width="10" height="10" fill="#ffffff" />
                  
                  <rect x="68" y="40" width="6" height="6" fill="#0f172a" />
                  <rect x="82" y="48" width="6" height="6" fill="#0f172a" />
                  <rect x="68" y="56" width="6" height="6" fill="#0f172a" />

                  <rect x="36" y="68" width="6" height="6" fill="#0f172a" />
                  <rect x="48" y="76" width="6" height="6" fill="#0f172a" />
                  <rect x="60" y="68" width="6" height="6" fill="#0f172a" />
                  <rect x="76" y="76" width="6" height="6" fill="#0f172a" />
                  <rect x="84" y="84" width="6" height="6" fill="#0f172a" />
                </svg>
              </div>

              {/* Numbers */}
              <div className="flex-1 min-w-0 space-y-1">
                <div>
                  <div className="text-[8px] font-bold uppercase text-slate-500">GABAH Asset Number</div>
                  <div className="font-mono font-black text-base text-slate-900 tracking-tight">
                    {asset.asset_number}
                  </div>
                </div>

                {asset.corporate_asset_number && (
                  <div>
                    <div className="text-[8px] font-bold uppercase text-slate-500">Corporate Asset (Accurate ERP)</div>
                    <div className="font-mono font-bold text-xs text-blue-700">
                      {asset.corporate_asset_number}
                    </div>
                  </div>
                )}

                <div className="text-[9px] text-slate-600 truncate font-mono">
                  S/N: {asset.serial_number}
                </div>
              </div>

            </div>

            {/* Asset Name & Specs bottom footer */}
            <div className="border-t border-slate-300 pt-2 text-[10px]">
              <div className="font-extrabold text-slate-900 truncate">{asset.name}</div>
              <div className="text-slate-600 truncate">{asset.brand} {asset.model} • {asset.location}</div>
            </div>

          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-6 w-full">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" /> Cetak Label Fisik
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
