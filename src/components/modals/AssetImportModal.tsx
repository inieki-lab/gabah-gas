import React, { useRef, useState } from 'react';
import {
  FileSpreadsheet,
  X,
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { gabahApi } from '../../services/gabahApi';
import { parseAssetsImportCsv, downloadAssetsImportTemplate } from '../../services/gabahService';

interface AssetImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void | Promise<void>;
}

type ImportRow = ReturnType<typeof parseAssetsImportCsv>['valid'][number];

type ImportResult = {
  created: number;
  updated: number;
  failed: number;
  errors: string[];
  warnings: string[];
};

/**
 * IMPORT MASSAL ASET via CSV/Excel. Preview lokal dulu (parser
 * parseAssetsImportCsv), lalu kirim ke server yang memvalidasi ulang:
 * taxonomi kategori, authority divisi, duplikat SN/No. Accurate, dan
 * penomoran aset tetap server-authoritative.
 */
export const AssetImportModal: React.FC<AssetImportModalProps> = ({ open, onClose, onImported }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<{ valid: ImportRow[]; errors: string[] } | null>(null);
  const [allowUpdate, setAllowUpdate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const resetState = () => {
    setPreview(null);
    setResult(null);
    setError(null);
    setAllowUpdate(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFilePicked = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const parsed = parseAssetsImportCsv(text);
      setPreview(parsed);
      if (parsed.valid.length === 0 && parsed.errors.length > 0) {
        setError(`Tidak ada baris valid. ${parsed.errors[0]}`);
      }
    } catch {
      setError('Gagal membaca berkas. Pastikan formatnya CSV/Excel yang diekspor sebagai CSV.');
    }
  };

  const handleConfirmImport = async () => {
    if (!preview || preview.valid.length === 0) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await gabahApi.bulkImportAssets(preview.valid, allowUpdate);
      setResult({
        created: res?.created ?? 0,
        updated: res?.updated ?? 0,
        failed: res?.failed ?? 0,
        errors: res?.errors || [],
        warnings: res?.warnings || [],
      });
      setPreview(null);
      await onImported();
    } catch (err: any) {
      setError(err.message || 'Gagal mengimpor aset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Import Massal Aset</h3>
              <p className="text-[11px] text-slate-500">Dari berkas CSV / Excel (maks. 500 baris)</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Kolom <strong>Nama Aset</strong> wajib. Kategori &amp; divisi pemilik divalidasi server —
              nomor aset resmi dibuat otomatis. Baris bermasalah dilewati tanpa menggagalkan batch.
            </span>
          </div>

          {/* Template + file picker */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => downloadAssetsImportTemplate()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[11px] font-bold transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Unduh Template CSV
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 min-w-[180px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Pilih Berkas CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,.txt"
              className="hidden"
              onChange={(e) => handleFilePicked(e.target.files?.[0])}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Preview */}
          {preview && preview.valid.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {preview.valid.length} baris siap diimpor
              </div>
              {preview.errors.length > 0 && (
                <div className="text-[11px] font-semibold text-amber-700">
                  {preview.errors.length} baris bermasalah (dilewati)
                </div>
              )}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="max-h-40 overflow-y-auto">
                  <table className="w-full text-[10px]">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">Nama</th>
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">Kategori</th>
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">Serial</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.valid.slice(0, 50).map((r, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-2 py-1 text-slate-800 truncate max-w-[140px]">{r.name}</td>
                          <td className="px-2 py-1 text-slate-500 truncate max-w-[120px]">{r.category || '-'}</td>
                          <td className="px-2 py-1 text-slate-500 truncate max-w-[100px]">{r.serial_number || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.valid.length > 50 && (
                  <div className="px-2 py-1 bg-slate-50 text-[10px] text-slate-500">
                    …dan {preview.valid.length - 50} baris lainnya
                  </div>
                )}
              </div>

              {/* Upsert option */}
              <label className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowUpdate}
                  onChange={(e) => setAllowUpdate(e.target.checked)}
                  className="mt-0.5 accent-emerald-600"
                />
                <span>
                  <strong>Perbarui aset yang sudah terdaftar</strong> — baris dengan Serial Number /
                  Nomor Accurate yang cocok akan diperbarui, bukan ditolak.
                </span>
              </label>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <div className="text-lg font-black text-emerald-700">{result.created}</div>
                  <div className="text-[10px] font-bold text-emerald-600">Aset Baru</div>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-center">
                  <div className="text-lg font-black text-blue-700">{result.updated}</div>
                  <div className="text-[10px] font-bold text-blue-600">Diperbarui</div>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-center">
                  <div className="text-lg font-black text-rose-700">{result.failed}</div>
                  <div className="text-[10px] font-bold text-rose-600">Gagal</div>
                </div>
              </div>
              {result.errors.length > 0 && (
                <ul className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[10px] text-rose-800 space-y-1 list-disc list-inside max-h-28 overflow-y-auto">
                  {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
              {result.warnings.length > 0 && (
                <ul className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-800 space-y-1 list-disc list-inside max-h-28 overflow-y-auto">
                  {result.warnings.slice(0, 10).map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 text-xs font-bold rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {result ? 'Selesai' : 'Batal'}
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={isSubmitting || !preview || preview.valid.length === 0}
            className="flex-1 py-2.5 text-xs font-black rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Mengimpor…
              </>
            ) : (
              `Proses Impor${preview && preview.valid.length > 0 ? ` (${preview.valid.length} aset)` : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
