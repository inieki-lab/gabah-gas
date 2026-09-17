import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Package,
  CalendarClock,
  LifeBuoy,
  Laptop,
  Car,
  ChevronRight,
  Clock,
  X,
  Building2,
  Tag
} from 'lucide-react';
import { Asset, Loan, Ticket } from '../../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  loans: Loan[];
  tickets: Ticket[];
  onSelectAsset: (asset: Asset) => void;
  onSelectLoan: (loan: Loan) => void;
  onSelectTicket: (ticket: Ticket) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  assets = [],
  loans = [],
  tickets = [],
  onSelectAsset,
  onSelectLoan,
  onSelectTicket,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Keyboard escape shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        // Handled outside or toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cleanQuery = query.trim().toLowerCase();

  // Search results
  const matchedAssets = cleanQuery
    ? assets
        .filter((a) => {
          return (
            a.name.toLowerCase().includes(cleanQuery) ||
            a.asset_number.toLowerCase().includes(cleanQuery) ||
            a.corporate_asset_number?.toLowerCase().includes(cleanQuery) ||
            a.serial_number?.toLowerCase().includes(cleanQuery) ||
            a.brand?.toLowerCase().includes(cleanQuery) ||
            a.assigned_to?.name?.toLowerCase().includes(cleanQuery)
          );
        })
        .slice(0, 5)
    : [];

  const matchedLoans = cleanQuery
    ? loans
        .filter((l) => {
          return (
            l.loan_number.toLowerCase().includes(cleanQuery) ||
            l.asset_name.toLowerCase().includes(cleanQuery) ||
            l.borrower_name.toLowerCase().includes(cleanQuery) ||
            l.purpose.toLowerCase().includes(cleanQuery)
          );
        })
        .slice(0, 4)
    : [];

  const matchedTickets = cleanQuery
    ? tickets
        .filter((t) => {
          const code = t.ticket_number || t.ticket_code || '';
          return (
            code.toLowerCase().includes(cleanQuery) ||
            t.title.toLowerCase().includes(cleanQuery) ||
            t.reporter_name.toLowerCase().includes(cleanQuery) ||
            t.category.toLowerCase().includes(cleanQuery)
          );
        })
        .slice(0, 4)
    : [];

  const totalResults = matchedAssets.length + matchedLoans.length + matchedTickets.length;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-xs flex items-start justify-center p-4 pt-16 sm:pt-24 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400 shrink-0 ml-1" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Cari aset (IT-HLT-, FST-), no. tiket (TKT-), peminjaman, atau nama staf..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0 font-medium"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200/70 text-slate-600 font-bold">
              ESC
            </span>
          )}
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {!cleanQuery ? (
            <div className="py-10 text-center text-slate-400 space-y-2">
              <Search className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-medium text-slate-500">
                Ketikkan kata kunci untuk mencari seluruh data sistem GABAH
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {['ThinkPad', 'Avanza', 'TKT-2026', 'IT-HLT', 'Dewi Lestari'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ) : totalResults === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <p className="text-sm font-bold text-slate-700">Tidak ada hasil ditemukan</p>
              <p className="text-xs text-slate-400">
                Tidak ada data aset, tiket, atau peminjaman yang cocok dengan &quot;{query}&quot;
              </p>
            </div>
          ) : (
            <>
              {/* Assets Section */}
              {matchedAssets.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Package className="w-3 h-3 text-emerald-600" />
                    <span>Aset &amp; Perangkat ({matchedAssets.length})</span>
                  </div>
                  {matchedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      onClick={() => {
                        onSelectAsset(asset);
                        onClose();
                      }}
                      className="p-3 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors flex items-center justify-between group border border-transparent hover:border-slate-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                          {asset.category_type === 'IT' ? (
                            <Laptop className="w-4 h-4" />
                          ) : (
                            <Car className="w-4 h-4" />
                          )}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                              {asset.asset_number}
                            </span>
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {asset.name}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {asset.brand} {asset.model} • {asset.location}
                            {asset.assigned_to && ` • Pegang: ${asset.assigned_to.name}`}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 shrink-0 ml-2" />
                    </div>
                  ))}
                </div>
              )}

              {/* Loans Section */}
              {matchedLoans.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-slate-100">
                  <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <CalendarClock className="w-3 h-3 text-amber-600" />
                    <span>Peminjaman Aktif ({matchedLoans.length})</span>
                  </div>
                  {matchedLoans.map((loan) => (
                    <div
                      key={loan.id}
                      onClick={() => {
                        onSelectLoan(loan);
                        onClose();
                      }}
                      className="p-3 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors flex items-center justify-between group border border-transparent hover:border-slate-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                          <CalendarClock className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-amber-900 bg-amber-100/60 px-1.5 py-0.5 rounded">
                              {loan.loan_number}
                            </span>
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {loan.asset_name}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            Peminjam: {loan.borrower_name} • Keperluan: {loan.purpose}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase shrink-0">
                        {loan.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tickets Section */}
              {matchedTickets.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-slate-100">
                  <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <LifeBuoy className="w-3 h-3 text-rose-600" />
                    <span>Tiket Helpdesk ({matchedTickets.length})</span>
                  </div>
                  {matchedTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => {
                        onSelectTicket(ticket);
                        onClose();
                      }}
                      className="p-3 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors flex items-center justify-between group border border-transparent hover:border-slate-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
                          <LifeBuoy className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-rose-900 bg-rose-100/60 px-1.5 py-0.5 rounded">
                              {ticket.ticket_number || ticket.ticket_code}
                            </span>
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {ticket.title}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            Pelapor: {ticket.reporter_name} • Kategori: {ticket.category}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 uppercase shrink-0">
                        {ticket.priority}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 px-4">
          <span>GABAH Quick Search Omnibox</span>
          <span>Pencarian Terpadu Food Station</span>
        </div>
      </div>
    </div>
  );
};
