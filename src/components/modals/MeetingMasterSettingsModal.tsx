import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  AlertTriangle, 
  Layers, 
  Tag, 
  Tv, 
  Mic, 
  Coffee, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { MeetingTypeItem, MeetingFacilityItem, MeetingPriority, UserProfile } from '../../types';
import { gabahApi } from '../../services/gabahApi';

interface MeetingMasterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onMasterUpdated?: () => void;
}

export const MeetingMasterSettingsModal: React.FC<MeetingMasterSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onMasterUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'types' | 'facilities'>('types');
  const [types, setTypes] = useState<MeetingTypeItem[]>([]);
  const [facilities, setFacilities] = useState<MeetingFacilityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit / Create Form States for Type
  const [editingType, setEditingType] = useState<MeetingTypeItem | null>(null);
  const [isCreatingType, setIsCreatingType] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [typeDesc, setTypeDesc] = useState('');
  const [typePriority, setTypePriority] = useState<MeetingPriority>('medium');
  const [typeColor, setTypeColor] = useState('blue');

  // Edit / Create Form States for Facility
  const [editingFacility, setEditingFacility] = useState<MeetingFacilityItem | null>(null);
  const [isCreatingFacility, setIsCreatingFacility] = useState(false);
  const [facName, setFacName] = useState('');
  const [facCategory, setFacCategory] = useState<'GA' | 'IT'>('GA');
  const [facDesc, setFacDesc] = useState('');
  const [facIsActive, setFacIsActive] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [fetchedTypes, fetchedFacs] = await Promise.all([
        gabahApi.getMeetingTypes(),
        gabahApi.getMeetingFacilities(),
      ]);
      setTypes(fetchedTypes || []);
      setFacilities(fetchedFacs || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat master tipe dan fasilitas.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Type Handlers
  const handleStartCreateType = () => {
    setEditingType(null);
    setIsCreatingType(true);
    setTypeName('');
    setTypeCode('');
    setTypeDesc('');
    setTypePriority('medium');
    setTypeColor('blue');
  };

  const handleStartEditType = (item: MeetingTypeItem) => {
    setIsCreatingType(false);
    setEditingType(item);
    setTypeName(item.name);
    setTypeCode(item.code);
    setTypeDesc(item.description);
    setTypePriority(item.priority_level);
    setTypeColor(item.color || 'blue');
  };

  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!typeName.trim()) {
      setErrorMessage('Nama tipe rapat wajib diisi.');
      return;
    }

    try {
      if (editingType) {
        await gabahApi.updateMeetingType(editingType.id, {
          name: typeName.trim(),
          code: typeCode.trim() || typeName.toLowerCase().replace(/\s+/g, '_'),
          description: typeDesc.trim(),
          priority_level: typePriority,
          color: typeColor,
        });
        showNotification(`Tipe rapat "${typeName}" berhasil diperbarui.`);
      } else {
        await gabahApi.createMeetingType({
          name: typeName.trim(),
          code: typeCode.trim() || typeName.toLowerCase().replace(/\s+/g, '_'),
          description: typeDesc.trim(),
          priority_level: typePriority,
          color: typeColor,
        });
        showNotification(`Tipe rapat baru "${typeName}" berhasil ditambahkan.`);
      }
      setEditingType(null);
      setIsCreatingType(false);
      await loadData();
      onMasterUpdated?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan tipe rapat.');
    }
  };

  const handleDeleteType = async (id: string, name: string) => {
    if (!window.confirm(`Yakin ingin menghapus tipe rapat "${name}"?`)) return;
    try {
      await gabahApi.deleteMeetingType(id);
      showNotification(`Tipe rapat "${name}" telah dihapus.`);
      await loadData();
      onMasterUpdated?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menghapus tipe rapat.');
    }
  };

  // Facility Handlers
  const handleStartCreateFacility = () => {
    setEditingFacility(null);
    setIsCreatingFacility(true);
    setFacName('');
    setFacCategory('GA');
    setFacDesc('');
    setFacIsActive(true);
  };

  const handleStartEditFacility = (item: MeetingFacilityItem) => {
    setIsCreatingFacility(false);
    setEditingFacility(item);
    setFacName(item.name);
    setFacCategory(item.category);
    setFacDesc(item.description || '');
    setFacIsActive(item.is_active);
  };

  const handleSaveFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!facName.trim()) {
      setErrorMessage('Nama fasilitas rapat wajib diisi.');
      return;
    }

    try {
      if (editingFacility) {
        await gabahApi.updateMeetingFacility(editingFacility.id, {
          name: facName.trim(),
          category: facCategory,
          description: facDesc.trim(),
          is_active: facIsActive,
        });
        showNotification(`Fasilitas "${facName}" berhasil diperbarui.`);
      } else {
        await gabahApi.createMeetingFacility({
          name: facName.trim(),
          category: facCategory,
          description: facDesc.trim(),
          is_active: facIsActive,
        });
        showNotification(`Fasilitas baru "${facName}" berhasil ditambahkan.`);
      }
      setEditingFacility(null);
      setIsCreatingFacility(false);
      await loadData();
      onMasterUpdated?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan fasilitas.');
    }
  };

  const handleDeleteFacility = async (id: string, name: string) => {
    if (!window.confirm(`Yakin ingin menghapus fasilitas "${name}"?`)) return;
    try {
      await gabahApi.deleteMeetingFacility(id);
      showNotification(`Fasilitas "${name}" telah dihapus.`);
      await loadData();
      onMasterUpdated?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menghapus fasilitas.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Settings className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Master Data Tipe & Fasilitas Rapat</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                  Akses Admin
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">Kelola tipe pertemuan dan katalog fasilitas GA & IT untuk reservasi ruang rapat</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="border-b border-slate-200 bg-slate-50/80 px-6 pt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('types')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                activeTab === 'types'
                  ? 'border-emerald-600 text-emerald-800 bg-white shadow-xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                <span>1. Tipe Pertemuan ({types.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('facilities')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                activeTab === 'facilities'
                  ? 'border-emerald-600 text-emerald-800 bg-white shadow-xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                <span>2. Fasilitas GA & IT ({facilities.length})</span>
              </div>
            </button>
          </div>

          <div className="pb-2">
            {activeTab === 'types' ? (
              <button
                onClick={handleStartCreateType}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Tipe Rapat</span>
              </button>
            ) : (
              <button
                onClick={handleStartCreateFacility}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Fasilitas</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-4">
          
          {/* Messages */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3.5 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Terjadi Kesalahan:</strong> {errorMessage}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3.5 text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: MEETING TYPES */}
          {activeTab === 'types' && (
            <div className="space-y-4">
              
              {/* Add / Edit Form Drawer */}
              {(isCreatingType || editingType) && (
                <form onSubmit={handleSaveType} className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                    <h3 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      {editingType ? `Edit Tipe Rapat: ${editingType.name}` : 'Tambah Tipe Rapat Baru'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => { setIsCreatingType(false); setEditingType(null); }}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Batal
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Nama Tipe Rapat <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Rapat Dewan Direksi"
                        value={typeName}
                        onChange={e => setTypeName(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Tingkat Prioritas
                      </label>
                      <select
                        value={typePriority}
                        onChange={e => setTypePriority(e.target.value as MeetingPriority)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                      >
                        <option value="high">High (Prioritas Utama / Direksi)</option>
                        <option value="medium">Medium (Koordinasi Antar Divisi)</option>
                        <option value="low">Low (Reguler / Internal Tim)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Label Warna Badge
                      </label>
                      <select
                        value={typeColor}
                        onChange={e => setTypeColor(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                      >
                        <option value="purple">Ungu / Purple (Direksi / Pimpinan)</option>
                        <option value="blue">Biru / Blue (Internal / Proyek)</option>
                        <option value="emerald">Hijau / Emerald (Eksternal / Tamu)</option>
                        <option value="amber">Amber / Orange (Hybrid / Khusus)</option>
                        <option value="rose">Merah / Rose (Darurat / RUPS)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Deskripsi & Petunjuk Penggunaan
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Digunakan khusus agenda rapat pimpinan direksi, komisaris, atau tamu kehormatan."
                      value={typeDesc}
                      onChange={e => setTypeDesc(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { setIsCreatingType(false); setEditingType(null); }}
                      className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingType ? 'Simpan Perubahan' : 'Tambah Tipe Rapat'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Table of Types */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-4">Nama Tipe Rapat</th>
                      <th className="py-2.5 px-4">Prioritas Default</th>
                      <th className="py-2.5 px-4">Kode Sistem</th>
                      <th className="py-2.5 px-4">Deskripsi</th>
                      <th className="py-2.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {types.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${
                              item.color === 'purple' ? 'bg-purple-600' :
                              item.color === 'emerald' ? 'bg-emerald-600' :
                              item.color === 'amber' ? 'bg-amber-600' :
                              item.color === 'rose' ? 'bg-rose-600' : 'bg-blue-600'
                            }`} />
                            <span>{item.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.priority_level === 'high' 
                              ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                              : item.priority_level === 'medium'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {item.priority_level}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {item.code}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {item.description || '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleStartEditType(item)}
                              title="Edit Tipe Rapat"
                              className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteType(item.id, item.name)}
                              title="Hapus Tipe Rapat"
                              className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {types.length === 0 && !isLoading && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Belum ada tipe rapat. Silakan klik "Tambah Tipe Rapat".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* TAB 2: FACILITIES */}
          {activeTab === 'facilities' && (
            <div className="space-y-4">
              
              {/* Add / Edit Form Drawer for Facilities */}
              {(isCreatingFacility || editingFacility) && (
                <form onSubmit={handleSaveFacility} className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                    <h3 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      {editingFacility ? `Edit Fasilitas: ${editingFacility.name}` : 'Tambah Fasilitas Rapat Baru'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => { setIsCreatingFacility(false); setEditingFacility(null); }}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Batal
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Nama Fasilitas <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Polycom Studio Video Conference / Mic Wireless"
                        value={facName}
                        onChange={e => setFacName(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Kategori Penanggung Jawab
                      </label>
                      <select
                        value={facCategory}
                        onChange={e => setFacCategory(e.target.value as 'GA' | 'IT')}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                      >
                        <option value="GA">GA (General Affairs / Sarpras)</option>
                        <option value="IT">IT (Teknologi Informasi / Jaringan)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Keterangan / Spesifikasi
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Termasuk 2 mic meja nirkabel dan kabel type-C"
                        value={facDesc}
                        onChange={e => setFacDesc(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                      />
                    </div>

                    <div className="pt-4 flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={facIsActive}
                          onChange={e => setFacIsActive(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                      <span className="text-xs font-semibold text-slate-700">Status Aktif</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { setIsCreatingFacility(false); setEditingFacility(null); }}
                      className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingFacility ? 'Simpan Perubahan' : 'Tambah Fasilitas'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Table of Facilities */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-4">Nama Fasilitas</th>
                      <th className="py-2.5 px-4">Kategori Penanggung Jawab</th>
                      <th className="py-2.5 px-4">Deskripsi / Spesifikasi</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {facilities.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {item.name}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.category === 'IT'
                              ? 'bg-sky-100 text-sky-800 border border-sky-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {item.category === 'IT' ? 'IT Technical' : 'GA Sarpras'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {item.description || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            item.is_active 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
                            {item.is_active ? 'Aktif Tersedia' : 'Non-Aktif'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleStartEditFacility(item)}
                              title="Edit Fasilitas"
                              className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFacility(item.id, item.name)}
                              title="Hapus Fasilitas"
                              className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {facilities.length === 0 && !isLoading && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Belum ada fasilitas. Silakan klik "Tambah Fasilitas".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Perubahan tersimpan langsung dan langsung aktif di formulir pemesanan.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Tutup Pengaturan
          </button>
        </div>

      </div>
    </div>
  );
};
