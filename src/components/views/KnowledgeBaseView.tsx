import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  ThumbsUp,
  Eye,
  ArrowLeft,
  Calendar,
  User,
  ShieldAlert,
  Sparkles,
  Plus,
  Pencil,
  X,
  Loader2,
  FileText,
} from 'lucide-react';
import { KnowledgeArticle, UserProfile } from '../../types';

interface KnowledgeBaseViewProps {
  articles: KnowledgeArticle[];
  currentUser: UserProfile;
  onOpenArticle?: (articleId: string) => void;
  onVote?: (articleId: string) => void;
  onCreateArticle?: (payload: { title: string; category: string; content: string; tags: string[] }) => Promise<void>;
  onUpdateArticle?: (id: string, updates: Partial<KnowledgeArticle>) => Promise<void>;
}

const ARTICLE_CATEGORIES = ['Policy', 'IT', 'GA'];

const emptyForm = {
  title: '',
  category: 'Policy',
  content: '',
  tags: '',
};

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  articles,
  currentUser,
  onOpenArticle,
  onVote,
  onCreateArticle,
  onUpdateArticle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
  const [votedArticles, setVotedArticles] = useState<Record<string, number>>({});
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const canWrite = ['Admin GABAH', 'IT', 'GA'].includes(currentUser.role);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError(null);
    setEditorOpen(true);
  };

  const openEdit = (a: KnowledgeArticle) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      category: ARTICLE_CATEGORIES.includes(a.category) ? a.category : 'Policy',
      content: a.content,
      tags: (a.tags || []).join(', '),
    });
    setError(null);
    setEditorOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim() || !form.content.trim()) {
      setError('Judul dan isi artikel wajib diisi.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        content: form.content,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10),
      };
      if (editingId) {
        await onUpdateArticle?.(editingId, payload);
      } else {
        await onCreateArticle?.(payload);
      }
      setEditorOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan artikel.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleVote = (articleId: string, currentVotes: number) => {
    if (votedArticles[articleId] !== undefined) return;
    setVotedArticles(prev => ({ ...prev, [articleId]: currentVotes + 1 }));
    if (onVote) onVote(articleId);
  };

  const filtered = articles.filter(a => {
    if (selectedCategory !== 'ALL' && a.category !== selectedCategory) return false;
    if (searchQuery.trim() === '') return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.content.toLowerCase().includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q))
    );
  });

  const categories = [
    { id: 'ALL', label: 'Semua Panduan' },
    { id: 'Policy', label: 'SOP & Kebijakan Korporat' },
    { id: 'IT', label: 'Panduan IT & Jaringan' },
  ];

  // Helper to render markdown-like content cleanly
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-3.5 text-xs text-slate-800 leading-relaxed font-sans">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={idx} className="text-sm font-black text-slate-900 pt-3 pb-1 border-b border-slate-200 flex items-center gap-2">
                <span className="w-1.5 h-4 rounded-full bg-emerald-600 inline-block"></span>
                {trimmed.replace('## ', '')}
              </h3>
            );
          }
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const itemText = trimmed.replace(/^[-*]\s+/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-emerald-600 font-bold mt-0.5">•</span>
                <span>{renderFormattedInline(itemText)}</span>
              </div>
            );
          }
          if (/^\d+\.\s+/.test(trimmed)) {
            const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
            if (numMatch) {
              return (
                <div key={idx} className="flex items-start gap-2 pl-2">
                  <span className="font-bold text-emerald-800 text-[11px] bg-emerald-100 rounded-full w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">
                    {numMatch[1]}
                  </span>
                  <span>{renderFormattedInline(numMatch[2])}</span>
                </div>
              );
            }
          }
          if (trimmed === '') {
            return <div key={idx} className="h-1.5" />;
          }
          return (
            <p key={idx}>{renderFormattedInline(trimmed)}</p>
          );
        })}
      </div>
    );
  };

  const renderFormattedInline = (text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
    const tokens = text.split(regex);

    tokens.forEach((token, i) => {
      if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
        parts.push(
          <code key={i} className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-900 font-mono text-[11px] font-bold border border-slate-300">
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
        parts.push(
          <strong key={i} className="font-bold text-slate-900">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token) {
        parts.push(<span key={i}>{token}</span>);
      }
    });

    return parts;
  };

  const inputClass =
    'w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all';

  return (
    <div className="space-y-6">

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            Knowledge Base &amp; Panduan Operasional (SOP)
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Pusat panduan mandiri troubleshooting IT, SOP peminjaman kendaraan, aktivasi lisensi, dan layanan GA.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={openCreate}
            className="self-start md:self-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Tulis Artikel
          </button>
        )}
      </div>

      {selectedArticle ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setSelectedArticle(null)}
              className="flex items-center gap-2 text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Artikel
            </button>
            {canWrite && (
              <button
                onClick={() => openEdit(selectedArticle)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit Artikel
              </button>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                {selectedArticle.category}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Diperbarui: {selectedArticle.updated_at}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Penulis: {selectedArticle.author}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">{selectedArticle.title}</h1>
          </div>

          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
            {renderFormattedContent(selectedArticle.content)}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-slate-200 pt-4 text-xs text-slate-500">
            <div className="flex items-center gap-2 flex-wrap">
              {selectedArticle.tags.map(tag => (
                <span key={tag} className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-medium">
                  #{tag}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4 text-slate-500" /> {selectedArticle.view_count} kali dibaca
              </span>
              <button
                onClick={() => handleVote(selectedArticle.id, selectedArticle.helpful_votes)}
                disabled={votedArticles[selectedArticle.id] !== undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  votedArticles[selectedArticle.id] !== undefined
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 cursor-default'
                    : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs'
                }`}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>
                  {votedArticles[selectedArticle.id] !== undefined
                    ? `${votedArticles[selectedArticle.id]} Bermanfaat (Terima kasih!)`
                    : `${selectedArticle.helpful_votes} Bermanfaat`}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Search & Category Pills */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari kata kunci panduan, SOP, WiFi, penomoran aset, peminjaman mobil, BAST..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-xs"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(art => (
              <div
                key={art.id}
                onClick={() => {
                  setSelectedArticle(art);
                  if (onOpenArticle) onOpenArticle(art.id);
                }}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-500 cursor-pointer transition-all hover:shadow-md space-y-3 shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                      {art.category}
                    </span>
                    <span className="text-[11px] text-slate-500">{art.updated_at}</span>
                  </div>

                  <h3 className="font-extrabold text-slate-900 text-base hover:text-emerald-700 transition-colors">
                    {art.title}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {art.content.replace(/[#*`-]/g, '').trim()}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-100 mt-2">
                  <span>Oleh: {art.author}</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {art.view_count}</span>
                    <span className="flex items-center gap-1 text-emerald-700 font-semibold"><ThumbsUp className="w-3.5 h-3.5" /> {votedArticles[art.id] ?? art.helpful_votes}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
              Tidak ada artikel yang cocok dengan pencarian.
            </div>
          )}
        </>
      )}

      {/* Create / Edit Article Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {editingId ? 'Edit Artikel' : 'Tulis Artikel Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-500">Panduan &amp; SOP GABAH — mendukung format ## , - , **tebal**, `kode`</p>
                </div>
              </div>
              <button
                onClick={() => setEditorOpen(false)}
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
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Judul Artikel *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputClass}
                  placeholder="cth: SOP Peminjaman Proyektor Ruang Rapat"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Kategori</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className={inputClass}
                  >
                    {ARTICLE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Tag (pisah koma)</label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    className={inputClass}
                    placeholder="wifi, jaringan, troubleshooting"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Isi Artikel *</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className={`${inputClass} min-h-[220px] resize-y font-mono leading-relaxed`}
                  placeholder={'## Langkah 1\n- Buka menu **Peminjaman**\n- Hubungi `IT Support` ext. 101'}
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Tips: `## Judul Bagian` untuk sub-judul, `- ` untuk poin, `**teks**` untuk tebal, `` `kode` `` untuk inline code.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
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
                    'Publikasikan Artikel'
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
