import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Trash2, Search, Image as ImageIcon, ExternalLink,
  Grid3X3, LayoutList, Clock, Globe,
  Camera, X, ChevronDown, Upload
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';
import { CaptureTypeBadge } from '@/components/CaptureTypeBadge';
import type { CaptureItem } from '@/utils/types';
import { getThumbnail, getDomain, formatRelativeDate, formatFullDate } from '@/utils/capture';

type ViewMode = 'grid' | 'list';
type SortMode = 'newest' | 'oldest' | 'site';

function App() {
  const { theme, toggleTheme, isDark } = useTheme();
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [selectedCapture, setSelectedCapture] = useState<CaptureItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    browser.storage.local.get(['captureHistory']).then((res: any) => {
      if (res.captureHistory) setCaptures(res.captureHistory);
      setLoading(false);
    });

    const handleChange = (changes: any) => {
      if (changes.captureHistory?.newValue) {
        setCaptures(changes.captureHistory.newValue);
      }
    };
    browser.storage.onChanged.addListener(handleChange);
    return () => browser.storage.onChanged.removeListener(handleChange);
  }, []);

  const openInEditor = (cap: CaptureItem) => {
    browser.storage.local.set({ lastCapture: cap }).then(() => {
      browser.tabs.create({ url: browser.runtime.getURL('/editor.html') });
    });
  };

  const deleteCapture = (cap: CaptureItem) => {
    const updated = captures.filter(c => c.timestamp !== cap.timestamp);
    setCaptures(updated);
    browser.storage.local.set({ captureHistory: updated });
    setDeleteConfirm(null);
    if (selectedCapture?.timestamp === cap.timestamp) setSelectedCapture(null);
  };

  const clearAll = () => {
    setCaptures([]);
    browser.storage.local.set({ captureHistory: [] });
    setSelectedCapture(null);
    setDeleteConfirm(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const newCapture: CaptureItem = {
          id: Math.random().toString(36).substr(2, 9),
          image: event.target?.result as string,
          fullWidth: img.naturalWidth,
          fullHeight: img.naturalHeight,
          title: file.name.replace(/\.[^/.]+$/, ''),
          timestamp: Date.now(),
          url: 'local-upload',
          type: 'upload'
        };
        const updated = [newCapture, ...captures].slice(0, 50);
        setCaptures(updated);
        browser.storage.local.set({ captureHistory: updated });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const filteredCaptures = useMemo(() => {
    let result = [...captures];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        (c.url?.toLowerCase().includes(q)) ||
        (c.title?.toLowerCase().includes(q)) ||
        getDomain(c.url).toLowerCase().includes(q)
      );
    }
    switch (sortMode) {
      case 'oldest': result.sort((a, b) => a.timestamp - b.timestamp); break;
      case 'site': result.sort((a, b) => getDomain(a.url).localeCompare(getDomain(b.url))); break;
      default: result.sort((a, b) => b.timestamp - a.timestamp);
    }
    return result;
  }, [captures, search, sortMode]);

  // Group by date for list view
  const grouped = useMemo(() => {
    const groups: Record<string, CaptureItem[]> = {};
    for (const cap of filteredCaptures) {
      const d = new Date(cap.timestamp);
      const today = new Date();
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      let key: string;
      if (d.toDateString() === today.toDateString()) key = 'Today';
      else if (d.toDateString() === yesterday.toDateString()) key = 'Yesterday';
      else key = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(cap);
    }
    return groups;
  }, [filteredCaptures]);

  if (loading) {
    return (
      <div className={`h-screen flex items-center justify-center ${isDark ? 'bg-[#0a0a0d]' : 'bg-gray-50'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading captures...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#0a0a0d] text-white' : 'bg-[#f5f5f7] text-gray-900'}`} style={{ fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif" }}>

      {/* ── Navbar ── */}
      <nav className={`sticky top-0 z-50 backdrop-blur-xl border-b transition-colors ${isDark ? 'bg-[#0a0a0d]/80 border-white/5' : 'bg-white/80 border-gray-200/60'}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo isDark={isDark} subtitle="Screenshot Gallery" />

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className={`relative flex items-center rounded-xl border transition-colors ${isDark ? 'bg-white/5 border-white/5 focus-within:border-blue-500/40' : 'bg-gray-100 border-gray-200 focus-within:border-blue-400'}`}>
              <Search size={15} className={`ml-3 shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                type="text"
                placeholder="Search captures..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`w-48 bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-gray-500 ${isDark ? 'text-white' : 'text-gray-900'}`}
              />
              {search && (
                <button onClick={() => setSearch('')} className="mr-2 p-0.5 rounded hover:bg-white/10">
                  <X size={14} className="text-gray-500" />
                </button>
              )}
            </div>

            {/* Upload */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              <Upload size={16} />
            </button>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageUpload}
            />

            <div className={`h-6 w-px mx-1 ${isDark ? 'bg-white/5' : 'bg-gray-200'}`} />

            {/* View toggle */}
            <div className={`flex p-0.5 rounded-lg border ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-md' : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                <Grid3X3 size={15} />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-md' : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                <LayoutList size={15} />
              </button>
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value as SortMode)}
                className={`appearance-none text-xs font-semibold pl-3 pr-7 py-2 rounded-lg border cursor-pointer outline-none transition-colors ${isDark ? 'bg-white/5 border-white/5 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-600'}`}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="site">By Site</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
            </div>

            <ThemeToggle theme={theme} toggleTheme={toggleTheme} isDark={isDark} />
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* ── Stats bar ── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border ${isDark ? 'bg-white/3 border-white/5' : 'bg-white border-gray-200'}`}>
              <Camera size={16} className="text-blue-500" />
              <span className="text-sm font-bold">{captures.length}</span>
              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>captures</span>
            </div>
            {search && (
              <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {filteredCaptures.length} result{filteredCaptures.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {captures.length > 0 && (
            <button onClick={() => setDeleteConfirm('all')} className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'}`}>
              Clear All
            </button>
          )}
        </div>

        {/* ── Empty state ── */}
        {captures.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-6 ${isDark ? 'bg-white/3 border border-white/5' : 'bg-gray-100 border border-gray-200'}`}>
              <ImageIcon size={40} className={isDark ? 'text-gray-700' : 'text-gray-300'} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold mb-2">No captures yet</h2>
            <p className={`text-sm max-w-sm text-center leading-relaxed ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Take your first screenshot using the Screencrafter popup. Your captures will appear here.
            </p>
          </div>
        )}

        {/* ── No results ── */}
        {captures.length > 0 && filteredCaptures.length === 0 && (
          <div className="flex flex-col items-center py-20">
            <Search size={32} className={isDark ? 'text-gray-700 mb-4' : 'text-gray-300 mb-4'} />
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No captures matching "{search}"</p>
          </div>
        )}

        {/* ── Grid View ── */}
        {viewMode === 'grid' && filteredCaptures.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredCaptures.map((cap, i) => (
              <CaptureCard key={cap.id || `${cap.timestamp}-${i}`} cap={cap} isDark={isDark} onSelect={setSelectedCapture} onEdit={openInEditor} onDelete={deleteCapture} />
            ))}
          </div>
        )}

        {/* ── List View ── */}
        {viewMode === 'list' && filteredCaptures.length > 0 && (
          <div className="space-y-8">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <h3 className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{date}</h3>
                <div className="space-y-2">
                  {items.map((cap, i) => (
                    <CaptureListRow key={cap.id || `${cap.timestamp}-${i}`} cap={cap} isDark={isDark} onSelect={setSelectedCapture} onEdit={openInEditor} onDelete={deleteCapture} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Preview Modal ── */}
      {selectedCapture && (
        <PreviewModal cap={selectedCapture} isDark={isDark} onClose={() => setSelectedCapture(null)} onEdit={openInEditor} onDelete={deleteCapture} />
      )}

      {/* ── Clear All Confirm Dialog ── */}
      {deleteConfirm === 'all' && (
        <ConfirmDialog
          isDark={isDark}
          title="Clear all captures?"
          message={`This will permanently delete ${captures.length} capture${captures.length !== 1 ? 's' : ''}. This action cannot be undone.`}
          confirmLabel="Delete All"
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={clearAll}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───

interface CaptureCardProps {
  cap: CaptureItem;
  isDark: boolean;
  onSelect: (c: CaptureItem) => void;
  onEdit: (c: CaptureItem) => void;
  onDelete: (c: CaptureItem) => void;
}

function CaptureCard({ cap, isDark, onSelect, onEdit, onDelete }: CaptureCardProps) {
  const thumb = getThumbnail(cap);
  return (
    <div
      className={`group relative rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] cursor-pointer ${isDark ? 'bg-white/2 border-white/5 hover:border-white/10' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-gray-200/60'}`}
      onClick={() => onSelect(cap)}
    >
      <div className={`aspect-video overflow-hidden ${isDark ? 'bg-white/2' : 'bg-gray-50'}`}>
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={28} className={isDark ? 'text-gray-800' : 'text-gray-200'} />
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
          <div className="flex gap-2 w-full">
            <button
              onClick={e => { e.stopPropagation(); onEdit(cap); }}
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded-lg transition-all active:scale-95"
            >
              <ExternalLink size={13} /> Edit
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(cap); }}
              className="p-2 bg-white/10 hover:bg-red-500 text-white rounded-lg transition-all active:scale-95"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
      <div className="p-3.5">
        <p className={`text-xs font-semibold truncate mb-1.5 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
          {cap.title || getDomain(cap.url)}
        </p>
        <div className="flex items-center gap-2">
          <CaptureTypeBadge type={cap.type} isDark={isDark} />
          <span className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            {formatRelativeDate(cap.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
}

function CaptureListRow({ cap, isDark, onSelect, onEdit, onDelete }: CaptureCardProps) {
  const thumb = getThumbnail(cap);
  return (
    <div
      onClick={() => onSelect(cap)}
      className={`group flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer ${isDark ? 'bg-white/2 border-white/5 hover:bg-white/4 hover:border-white/10' : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
    >
      <div className={`w-20 h-14 rounded-lg overflow-hidden shrink-0 ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover object-top" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={16} className={isDark ? 'text-gray-700' : 'text-gray-300'} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
          {cap.title || 'Untitled'}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Globe size={10} className={isDark ? 'text-gray-600' : 'text-gray-400'} />
          <span className={`text-[11px] truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{getDomain(cap.url)}</span>
        </div>
      </div>
      <CaptureTypeBadge type={cap.type} isDark={isDark} />
      <span className={`text-[11px] shrink-0 tabular-nums ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
        {new Date(cap.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
      </span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={e => { e.stopPropagation(); onEdit(cap); }} className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-all active:scale-90" title="Edit">
          <ExternalLink size={13} />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(cap); }} className={`p-1.5 rounded-lg transition-all active:scale-90 ${isDark ? 'hover:bg-red-500/20 text-gray-500 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'}`} title="Delete">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

interface PreviewModalProps {
  cap: CaptureItem;
  isDark: boolean;
  onClose: () => void;
  onEdit: (c: CaptureItem) => void;
  onDelete: (c: CaptureItem) => void;
}

function PreviewModal({ cap, isDark, onClose, onEdit, onDelete }: PreviewModalProps) {
  const thumb = getThumbnail(cap);
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-8" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        onClick={e => e.stopPropagation()}
        className={`relative w-full max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden border shadow-2xl flex flex-col ${isDark ? 'bg-[#16161a] border-white/10' : 'bg-white border-gray-200'}`}
      >
        <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate">{cap.title || 'Untitled Capture'}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <Globe size={10} /> {getDomain(cap.url)}
              </span>
              <span className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <Clock size={10} /> {formatFullDate(cap.timestamp)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={() => { onEdit(cap); onClose(); }}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all active:scale-95"
            >
              <ExternalLink size={13} /> Open in Editor
            </button>
            <button
              onClick={() => onDelete(cap)}
              className={`p-2 rounded-lg transition-all active:scale-95 ${isDark ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-500 hover:text-red-500'}`}
            >
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {thumb ? (
            <img src={thumb} alt="" className="w-full h-auto rounded-lg shadow-lg" />
          ) : (
            <div className={`w-full aspect-video rounded-lg flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
              <ImageIcon size={48} className={isDark ? 'text-gray-700' : 'text-gray-300'} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  isDark: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({ isDark, title, message, confirmLabel, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-8" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div onClick={e => e.stopPropagation()} className={`relative rounded-2xl p-8 border max-w-sm w-full shadow-2xl text-center ${isDark ? 'bg-[#16161a] border-white/10' : 'bg-white border-gray-200'}`}>
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-5">
          <Trash2 size={24} className="text-red-500" />
        </div>
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className={`text-sm mb-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-500 hover:bg-red-600 text-white transition-all active:scale-95">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
