import React, { useState } from 'react';
import {
  Briefcase,
  Phone,
  Mail,
  MapPin,
  Star,
  Building2,
  Plus,
  Pencil,
  X,
  Loader2,
} from 'lucide-react';
import { Vendor, UserProfile } from '../../types';

interface VendorsViewProps {
  vendors: Vendor[];
  currentUser: UserProfile;
  onCreateVendor?: (payload: Partial<Vendor> & { name: string }) => Promise<void>;
  onUpdateVendor?: (id: string, updates: Partial<Vendor>) => Promise<void>;
}

const emptyForm = {
  name: '',
  category: 'General',
  pic_name: '',
  pic_phone: '',
  pic_email: '',
  address: '',
  active_contracts_count: 0,
  rating: 4.0,
  notes: '',
};

export const VendorsView: React.FC<VendorsViewProps> = ({
  vendors,
  currentUser,
  onCreateVendor,
  onUpdateVendor,
}) => {
  const canManage = ['Admin GABAH', 'IT', 'GA'].includes(currentUser.role);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      category: currentUser.role === 'IT' ? 'IT' : 'General',
    });
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (v: Vendor) => {
    setEditingId(v.id);
    setForm({
      name: v.name,
      category: v.category || 'General',
      pic_name: v.pic_name || '',
      pic_phone: v.pic_phone || '',
      pic_email: v.pic_email || '',
      address: v.address || '',
      active_contracts_count: v.active_contracts_count || 0,
      rating: v.rating || 4.0,
      notes: v.notes || '',
    });
    setError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError('Nama vendor wajib diisi.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        pic_name: form.pic_name.trim(),
        pic_phone: form.pic_phone.trim(),
        pic_email: form.pic_email.trim(),
        address: form.address.trim(),
        active_contracts_count: Number(form.active_contracts_count) || 0,
        rating: Math.min(5, Math.max(1, Number(form.rating) || 4)),
        notes: form.notes.trim(),
      };
      if (editingId) {
        await onUpdateVendor?.(editingId, payload);
      } else {
        await onCreateVendor?.(payload);
      }
      setFormOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan vendor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-emerald-600" />
            Direktori Rekanan &amp; Vendor Kontrak
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Daftar rekanan resmi pengadaan perangkat IT, armada GA, pemeliharaan gedung, dan lisensi software.
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="self-start md:self-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Tambah Vendor
          </button>
        )}
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
                <span>PIC: <strong className="text-slate-900">{v.pic_name || '—'}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                <a href={`tel:${v.pic_phone}`} className="font-mono text-emerald-700 hover:underline">
                  {v.pic_phone || '—'}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                <a href={`mailto:${v.pic_email}`} className="font-mono text-blue-700 hover:underline">
                  {v.pic_email || '—'}
                </a>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span className="text-slate-500">{v.address || '—'}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
              <div className="flex items-center justify-between font-semibold text-slate-600 mb-1 text-[11px]">
                <span>Kontrak Berjalan: <strong className="text-slate-900">{v.active_contracts_count} Perjanjian</strong></span>
                <span className="text-emerald-700 font-bold">SLA Compliance: 99%</span>
              </div>
              <p className="text-[11px] text-slate-500 italic">{v.notes}</p>
            </div>

            {canManage && (
              <button
                onClick={() => openEdit(v)}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-300 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Vendor
              </button>
            )}
          </div>
        ))}
      </div>

      {vendors.length === 0 && (
        <div className="text-center py-16 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
          Belum ada vendor terdaftar.
          {canManage && ' Klik "Tambah Vendor" untuk menambahkan rekanan pertama.'}
        </div>
      )}

      {/* Create / Edit Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {editingId ? 'Edit Vendor' : 'Tambah Vendor Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-500">Data rekanan resmi GABAH</p>
                </div>
              </div>
              <button
                onClick={() => setFormOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Nama Vendor *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                  placeholder="cth: CV Sinar Teknologi Nusantara"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Kategori</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className={inputClass}
                    placeholder="cth: IT, GA, License"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Rating (1–5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    step={0.1}
                    value={form.rating}
                    onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Nama PIC</label>
                  <input
                    type="text"
                    value={form.pic_name}
                    onChange={(e) => setForm({ ...form, pic_name: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Telepon PIC</label>
                  <input
                    type="tel"
                    value={form.pic_phone}
                    onChange={(e) => setForm({ ...form, pic_phone: e.target.value })}
                    className={inputClass}
                    placeholder="08xx"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Email PIC</label>
                  <input
                    type="email"
                    value={form.pic_email}
                    onChange={(e) => setForm({ ...form, pic_email: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Kontrak Berjalan</label>
                  <input
                    type="number"
                    min={0}
                    value={form.active_contracts_count}
                    onChange={(e) => setForm({ ...form, active_contracts_count: Number(e.target.value) })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Alamat</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Catatan</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={`${inputClass} min-h-[64px] resize-y`}
                  placeholder="Catatan kinerja, kesepakatan khusus, dll."
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 text-xs font-black rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan…
                    </>
                  ) : editingId ? (
                    'Simpan Perubahan'
                  ) : (
                    'Tambah Vendor'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
