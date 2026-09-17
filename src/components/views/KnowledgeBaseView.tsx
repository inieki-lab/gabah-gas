import React, { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  ThumbsUp, 
  Eye, 
  Tag, 
  ArrowLeft, 
  Calendar, 
  User,
  Copy,
  Check,
  FileText,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { KnowledgeArticle } from '../../types';

interface KnowledgeBaseViewProps {
  articles: KnowledgeArticle[];
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({ articles }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
  const [votedArticles, setVotedArticles] = useState<Record<string, number>>({});
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleVote = (articleId: string, currentVotes: number) => {
    if (votedArticles[articleId] !== undefined) return;
    setVotedArticles(prev => ({ ...prev, [articleId]: currentVotes + 1 }));
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
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(itemText) }} />
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
                  <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(numMatch[2]) }} />
                </div>
              );
            }
          }
          if (trimmed === '') {
            return <div key={idx} className="h-1.5" />;
          }
          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }} />
          );
        })}
      </div>
    );
  };

  const formatInlineMarkdown = (text: string) => {
    return text
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-200 text-slate-900 font-mono text-[11px] font-bold border border-slate-300">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
  };

  return (
    <div className="space-y-6">
      
      <div>
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-600" />
          Knowledge Base &amp; Panduan Operasional (SOP)
        </h2>
        <p className="text-xs text-slate-600 mt-1">
          Pusat panduan mandiri troubleshooting IT, SOP peminjaman kendaraan, aktivasi lisensi, dan layanan GA.
        </p>
      </div>

      {selectedArticle ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-6 shadow-xs">
          <button
            onClick={() => setSelectedArticle(null)}
            className="flex items-center gap-2 text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Artikel
          </button>

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
                onClick={() => setSelectedArticle(art)}
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
        </>
      )}

    </div>
  );
};
