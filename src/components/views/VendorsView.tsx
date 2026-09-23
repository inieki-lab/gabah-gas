import React from 'react';
import { 
  Briefcase, 
  Phone, 
  Mail, 
  MapPin, 
  Star, 
  FileText, 
  Building2, 
  ExternalLink 
} from 'lucide-react';
import { Vendor } from '../../types';

interface VendorsViewProps {
  vendors: Vendor[];
}

export const VendorsView: React.FC<VendorsViewProps> = ({ vendors }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-emerald-600" />
          Direktori Rekanan &amp; Vendor Kontrak
        </h2>
        <p className="text-xs text-slate-600 mt-1">
          Daftar rekanan resmi pengadaan perangkat IT, armada GA, pemeliharaan gedung, dan lisensi software.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vendors.map((v) => (
          <div 
            key={v.id}
            className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3 shadow-xs hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
                  {v.category} Partner
                </span>
                <h3 className="font-extrabold text-slate-900 text-base mt-1.5">{v.name}</h3>
              </div>
              <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 text-amber-800 text-xs font-bold shrink-0">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                {v.rating}
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span>PIC: <strong className="text-slate-900">{v.pic_name}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                <a href={`tel:${v.pic_phone}`} className="font-mono text-emerald-700 hover:underline">
                  {v.pic_phone}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                <a href={`mailto:${v.pic_email}`} className="font-mono text-blue-700 hover:underline">
                  {v.pic_email}
                </a>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span className="text-slate-500">{v.address}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
              <div className="flex items-center justify-between font-semibold text-slate-600 mb-1 text-[11px]">
                <span>Kontrak Berjalan: <strong className="text-slate-900">{v.active_contracts_count} Perjanjian</strong></span>
                <span className="text-emerald-700 font-bold">SLA Compliance: 99%</span>
              </div>
              <p className="text-[11px] text-slate-500 italic">{v.notes}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
