import { useEffect, useState, useRef } from 'react';
import { 
  Download, Type, Square, MousePointer, 
  Image as ImageIcon, ChevronLeft, LayoutGrid, ChevronDown, FileImage, FileText,
  Trash2, Plus, Minus, Undo2, Redo2, Pipette,
  EyeOff, RefreshCcw, ArrowUpRight, Droplets, Circle, Minus as MinusIcon, Highlighter,
  ArrowUp, ArrowDown, Upload, PaintBucket
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useTheme } from '@/hooks/useTheme';
import { ThemeToggle } from '@/components/ThemeToggle';

// --- Types ---

type Tool = 'select' | 'text' | 'blur' | 'arrow' | 'rect' | 'circle' | 'line' | 'highlighter' | 'fill';

interface Annotation {
  id: string;
  type: Tool;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  color?: string;
  strokeWidth?: number;
  fontWeight?: string;
  fontStyle?: string;
  textBackgroundColor?: string;
  blurMode?: string;
  blurAmount?: number;
  opacity?: number;
  strokePreset?: 'thin' | 'medium' | 'thick';
  fill?: boolean;
  highlighter?: boolean;
}

interface EditorState {
  padding: number;
  rounding: number;
  shadow: string;
  frameStyle: 'chrome' | 'simple' | 'none';
  background: string;
  showUrl: boolean;
  zoom: number;
  customColor: string;
  activeTool: Tool;
}

const presets = {
  backgrounds: [
    { name: 'Transparent', value: 'transparent' },
    { name: 'Aurora', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { name: 'Sunset', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
    { name: 'Ocean', value: 'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)' },
    { name: 'Sky', value: 'linear-gradient(135deg, #c3cfe2 0%, #c3cfe2 100%)' },
    { name: 'White', value: '#ffffff' },
    { name: 'Black', value: '#000000' },
    { name: 'Blue', value: '#3b82f6' },
  ]
};

// --- App Component ---

function App() {
  const { theme, toggleTheme, isDark } = useTheme();
  const [data, setData] = useState<any>(null);
  const [stitchedImage, setStitchedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp' | 'pdf'>('png');
  
  const [editor, setEditor] = useState<EditorState>({
    padding: 0,
    rounding: 8,
    shadow: 'shadow-2xl',
    frameStyle: 'chrome',
    background: 'transparent',
    showUrl: true,
    zoom: 0.8,
    customColor: '#3b82f6',
    activeTool: 'select'
  });

  const exportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDrawing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const [captureHistory, setCaptureHistory] = useState<any[]>([]);

  useEffect(() => {
    browser.storage.local.get(['lastCapture', 'annotations', 'editorSettings', 'captureHistory']).then(async (res: any) => {
      try {
        if (res.lastCapture) {
          setData(res.lastCapture);
          if ((res.lastCapture.type === 'full-page' || res.lastCapture.type === 'full-page-scroll') && res.lastCapture.fragments) {
            const stitched = await stitchFragments(res.lastCapture);
            setStitchedImage(stitched);
          } else {
            setStitchedImage(res.lastCapture.image || null);
          }
          // Set filename from page title
          if (res.lastCapture.title) {
            const cleanTitle = res.lastCapture.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '');
            setFileName(`screencrafter-${cleanTitle}`);
          }
        }
        
        // Restore annotations and settings
        if (res.annotations) setAnnotations(res.annotations);
        if (res.editorSettings) setEditor(res.editorSettings);
        if (res.captureHistory) setCaptureHistory(res.captureHistory);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  // Save changes to storage
  useEffect(() => {
    if (!loading) {
      browser.storage.local.set({ annotations });
    }
  }, [annotations, loading]);

  useEffect(() => {
    if (!loading) {
      browser.storage.local.set({ editorSettings: editor });
    }
  }, [editor, loading]);

  useEffect(() => {
    if (!loading) {
      browser.storage.local.set({ captureHistory });
    }
  }, [captureHistory, loading]);

  // Add current capture to history if it's new
  useEffect(() => {
    if (data && data.id) {
      setCaptureHistory(prev => {
        if (prev.some(item => item.id === data.id)) return prev;
        return [data, ...prev].slice(0, 50); // Keep last 50 captures
      });
    }
  }, [data]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteAnnotation(selectedId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId]);
  const stitchFragments = async (cap: any): Promise<string> => {
    console.log('Editor: Stitching with metadata', { 
      fragments: cap.fragments.length, 
      fullHeight: cap.fullHeight,
      viewportWidth: cap.viewportWidth,
      fullWidth: cap.fullWidth 
    });
    
    const canvas = document.createElement('canvas');
    canvas.width = cap.viewportWidth || cap.fullWidth;
    canvas.height = cap.fullHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    // Draw each fragment at its correct vertical position
    for (let i = 0; i < cap.fragments.length; i++) {
      const frag = cap.fragments[i];
      const img = new Image();
      
      if (typeof frag === 'string') {
        img.src = frag;
        await new Promise(r => img.onload = r);
        const yOffset = i * cap.viewportHeight;
        const heightToDraw = Math.min(cap.viewportHeight, cap.fullHeight - yOffset);
        ctx.drawImage(img, 0, 0, cap.viewportWidth, heightToDraw, 0, yOffset, cap.viewportWidth, heightToDraw);
      } else {
        img.src = frag.dataUrl;
        await new Promise(r => img.onload = r);
        ctx.drawImage(img, frag.x || 0, frag.y || 0);
      }
    }
    return canvas.toDataURL('image/png');
  };

  const [history, setHistory] = useState<Annotation[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const saveToHistory = (newAnnotations: Annotation[]) => {
    // Only save if different from current history state to avoid duplicates
    const current = JSON.stringify(history[historyIndex]);
    const next = JSON.stringify(newAnnotations);
    if (current === next) return;

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(next));
    // Limit history to 50 steps
    if (newHistory.length > 50) newHistory.shift();
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setAnnotations(JSON.parse(JSON.stringify(history[prevIndex])));
      setSelectedId(null);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setAnnotations(JSON.parse(JSON.stringify(history[nextIndex])));
      setSelectedId(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  // --- Annotation Interaction ---

  const [isDragging, setIsDragging] = useState(false);
  const [resizingId, setResizingId] = useState<{ id: string, handle: string } | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleResizeStart = (e: React.MouseEvent, id: string, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingId({ id, handle });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / editor.zoom;
    const y = (e.clientY - rect.top) / editor.zoom;

    // Check if we clicked on an existing annotation (if not handled by propagation)
    // Actually, propagation stop handles this, so if we reach here, we clicked empty space.
    
    if (editor.activeTool === 'select') {
      setSelectedId(null);
      return;
    }
    
    isDrawing.current = true;
    startPos.current = { x, y };

    const newId = Math.random().toString(36).substr(2, 9);
    const newAnn: Annotation = {
      id: newId,
      type: editor.activeTool as Tool,
      x,
      y,
      x2: x,
      y2: y,
      width: editor.activeTool === 'text' ? 100 : 0,
      height: editor.activeTool === 'text' ? 32 : 0,
      color: editor.activeTool === 'fill' ? '#3b82f6' : '#3b82f6',
      fontSize: 24,
      fontWeight: 'normal',
      text: editor.activeTool === 'text' ? '' : '',
      strokePreset: 'medium',
      strokeWidth: 3,
      opacity: 1,
      fill: editor.activeTool === 'fill',
      highlighter: editor.activeTool === 'highlighter'
    };

    setAnnotations([...annotations, newAnn]);
    setSelectedId(newId);
    
    // Auto-focus text for immediate editing
    if (editor.activeTool === 'text') {
      setTimeout(() => {
        const el = document.querySelector('.contenteditable-root');
        if (el) (el as HTMLElement).focus();
      }, 10);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentX = (e.clientX - rect.left) / editor.zoom;
    const currentY = (e.clientY - rect.top) / editor.zoom;

    if (resizingId) {
      setAnnotations(prev => prev.map(a => {
        if (a.id !== resizingId.id) return a;
        
        if (a.type === 'arrow' || a.type === 'line') {
          if (resizingId.handle === 'start') {
            return { ...a, x: currentX, y: currentY };
          } else {
            return { ...a, x2: currentX, y2: currentY };
          }
        } else {
          const currentW = a.width || 0;
          const currentH = a.height || 0;
          if (resizingId.handle === 'se') {
            return { ...a, width: Math.max(10, currentX - a.x), height: Math.max(10, currentY - a.y) };
          } else if (resizingId.handle === 'ne') {
            return { ...a, y: currentY, height: Math.max(10, (a.y + currentH) - currentY) };
          } else if (resizingId.handle === 'sw') {
            return { ...a, x: currentX, width: Math.max(10, (a.x + currentW) - currentX), height: Math.max(10, currentY - a.y) };
          } else if (resizingId.handle === 'nw') {
            return { ...a, x: currentX, y: currentY, width: Math.max(10, (a.x + currentW) - currentX), height: Math.max(10, (a.y + currentH) - currentY) };
          } else if (resizingId.handle === 'n') {
            return { ...a, y: currentY, height: Math.max(10, (a.y + currentH) - currentY) };
          } else if (resizingId.handle === 's') {
            return { ...a, height: Math.max(10, currentY - a.y) };
          } else if (resizingId.handle === 'w') {
            return { ...a, x: currentX, width: Math.max(10, (a.x + currentW) - currentX) };
          } else if (resizingId.handle === 'e') {
            return { ...a, width: Math.max(10, currentX - a.x) };
          }
          return { ...a, width: Math.max(10, currentX - a.x), height: Math.max(10, currentY - a.y) };
        }
      }));
      return;
    }

    if (isDragging && selectedId) {
      setAnnotations(prev => prev.map(a => {
        if (a.id !== selectedId) return a;
        
        const dx = currentX - (a.x + dragOffset.current.x);
        const dy = currentY - (a.y + dragOffset.current.y);
        
        if (a.type === 'arrow' || a.type === 'line') {
          return { 
            ...a, 
            x: currentX - dragOffset.current.x, 
            y: currentY - dragOffset.current.y,
            x2: (a.x2 || 0) + dx,
            y2: (a.y2 || 0) + dy
          };
        }
        
        return { 
          ...a, 
          x: currentX - dragOffset.current.x, 
          y: currentY - dragOffset.current.y 
        };
      }));
      return;
    }

    if (!isDrawing.current || !selectedId || editor.activeTool === 'select') return;
    
    setAnnotations(prev => prev.map(a => {
      if (a.id !== selectedId) return a;
      
      if (a.type === 'arrow' || a.type === 'line') {
        return { ...a, x2: currentX, y2: currentY };
      } else {
        const width = Math.abs(currentX - startPos.current.x);
        const height = Math.abs(currentY - startPos.current.y);
        const x = Math.min(currentX, startPos.current.x);
        const y = Math.min(currentY, startPos.current.y);
        return { ...a, x, y, width: Math.max(10, width), height: Math.max(10, height) };
      }
    }));
  };

  const handleMouseUp = () => {
    if (isDrawing.current || isDragging || resizingId) {
      saveToHistory(annotations);
    }
    isDrawing.current = false;
    setIsDragging(false);
    setResizingId(null);
    
    // Switch back to select tool after creating text (so user can drag it)
    if (editor.activeTool === 'text') {
      setEditor(prev => ({ ...prev, activeTool: 'select' }));
    }
  };

  const updateAnnotation = (id: string, updates: Partial<Annotation>) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const deleteAnnotation = (id: string) => {
    const newAnns = annotations.filter(a => a.id !== id);
    setAnnotations(newAnns);
    saveToHistory(newAnns);
    setSelectedId(null);
  };

  const handleExport = async (format: 'png' | 'jpeg' | 'webp' | 'pdf' = 'png') => {
    if (!exportRef.current) return;
    setExportMenuOpen(false);
    const originalZoom = editor.zoom;
    const originalSelectedId = selectedId;
    setSelectedId(null); 
    setEditor(prev => ({ ...prev, zoom: 1 }));
    
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').split('.')[0];
    const finalName = fileName || (data?.title ? `screencrafter-${data.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '')}` : `screencrafter-capture-${timestamp}`);
    
    setTimeout(async () => {
      try {
        const dataUrl = await toPng(exportRef.current!, { 
          quality: 1.0, 
          pixelRatio: 2,
          skipFonts: true
        });

        if (format === 'pdf') {
          const img = new Image();
          img.src = dataUrl;
          await new Promise(r => img.onload = r);
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const pxToMm = 0.264583;
            const w = canvas.width * pxToMm;
            const h = canvas.height * pxToMm;
            const pdf = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'mm', format: [w, h] });
            pdf.addImage(jpgDataUrl, 'JPEG', 0, 0, w, h, undefined, 'FAST');
            pdf.save(`${finalName}.pdf`);
          }
        } else if (format === 'jpeg') {
          const link = document.createElement('a');
          link.download = `${finalName}.jpg`;
          link.href = dataUrl.replace('image/png', 'image/jpeg').replace('data:image', 'data:image/jpeg');
          link.click();
        } else if (format === 'webp') {
          const link = document.createElement('a');
          link.download = `${finalName}.webp`;
          link.href = dataUrl.replace('image/png', 'image/webp').replace('data:image', 'data:image/webp');
          link.click();
        } else {
          const link = document.createElement('a');
          link.download = `${finalName}.png`;
          link.href = dataUrl;
          link.click();
        }
      } finally {
        setEditor(prev => ({ ...prev, zoom: originalZoom }));
        setSelectedId(originalSelectedId);
      }
    }, 200);
  };

  const handleCopyToClipboard = async () => {
    if (!exportRef.current) return;
    setSelectedId(null);
    setEditor(prev => ({ ...prev, zoom: 1 }));
    
    setTimeout(async () => {
      try {
        const dataUrl = await toPng(exportRef.current!, { 
          quality: 1.0, 
          pixelRatio: 2,
          skipFonts: true
        });
        
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
      } catch (err) {
        console.error('Failed to copy:', err);
      } finally {
        setEditor(prev => ({ ...prev, zoom: editor.zoom }));
      }
    }, 200);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setStitchedImage(event.target?.result as string);
        setData({
          image: event.target?.result as string,
          fullWidth: img.naturalWidth,
          fullHeight: img.naturalHeight,
          title: file.name.replace(/\.[^/.]+$/, ''),
          timestamp: Date.now()
        });
        setFileName(file.name.replace(/\.[^/.]+$/, ''));
        setAnnotations([]);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const selectedAnn = annotations.find(a => a.id === selectedId);

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#0a0a0d] text-white">Loading...</div>;

  const checkerboardStyle = {
    backgroundImage: isDark 
      ? 'linear-gradient(45deg, #1a1a1e 25%, transparent 25%), linear-gradient(-45deg, #1a1a1e 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a1e 75%), linear-gradient(-45deg, transparent 75%, #1a1a1e 75%)'
      : 'linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)',
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
  };

  return (
    <div className={`flex flex-col h-screen transition-colors duration-300 ${isDark ? 'bg-[#0a0a0d] text-white' : 'bg-white text-gray-900'} font-sans overflow-hidden`}>
      {/* Navbar */}
      <nav className={`h-14 border-b flex items-center justify-between px-4 shrink-0 z-50 transition-colors ${isDark ? 'bg-[#16161a] border-white/5' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center gap-3">
          {/* Back to Dashboard */}
          <button 
            onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') })}
            className={`p-2 rounded-lg transition-all group ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            title="Back to Gallery"
          >
            <LayoutGrid size={18} className="group-hover:text-blue-500 transition-colors" />
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className={`p-2 rounded-lg transition-all group ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            title="Upload Image"
          >
            <Upload size={18} className="group-hover:text-blue-500 transition-colors" />
          </button>
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleImageUpload}
          />
          <div className={`h-6 w-px ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}></div>
          {/* Undo / Redo */}
          <div className="flex items-center gap-1">
            <button 
              onClick={undo} 
              disabled={historyIndex <= 0}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'} disabled:opacity-20 disabled:cursor-not-allowed`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={18} />
            </button>
            <button 
              onClick={redo} 
              disabled={historyIndex >= history.length - 1}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'} disabled:opacity-20 disabled:cursor-not-allowed`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={18} />
            </button>
            <button 
              onClick={() => { setAnnotations([]); setSelectedId(null); saveToHistory([]); }} 
              disabled={annotations.length === 0}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'} disabled:opacity-20 disabled:cursor-not-allowed`}
              title="Clear All"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filename */}
          <input 
            type="text" 
            value={fileName || (data?.title ? `screencrafter-${data.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '')}` : data?.timestamp ? `screencrafter-capture-${new Date(data.timestamp).toISOString().replace(/[-:]/g, '').replace('T', '-').split('.')[0]}` : 'screencrafter-capture')} 
            onChange={(e) => setFileName(e.target.value)} 
            placeholder="Untitled capture"
            className={`font-bold tracking-tight border outline-none focus:ring-2 focus:ring-blue-500/50 rounded-lg px-3 py-1 text-sm w-44 truncate text-right transition-colors ${isDark ? 'text-white bg-white/5 border-white/5 placeholder:text-gray-600 focus:bg-white/10' : 'text-gray-900 bg-gray-100 border-gray-200 placeholder:text-gray-400 focus:bg-gray-50'}`}
            title="Click to rename"
          />
          <div className={`h-6 w-px ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}></div>
          {/* Zoom Controls */}
          <div className={`flex items-center px-1.5 py-1 rounded-full border ${isDark ? 'bg-black/20 border-white/5' : 'bg-gray-100/50 border-gray-200'}`}>
            <button onClick={() => setEditor(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom - 0.1) }))} className="p-1 cursor-pointer opacity-60 hover:opacity-100 transition-opacity"><Minus size={14}/></button>
            <div className={`w-px h-3 mx-1 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}></div>
            <button onClick={() => setEditor(prev => ({ ...prev, zoom: 1 }))} className="text-[10px] font-mono font-bold w-12 text-center select-none hover:text-blue-500 transition-colors" title="Reset Zoom (100%)">{Math.round(editor.zoom * 100)}%</button>
            <div className={`w-px h-3 mx-1 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}></div>
            <button onClick={() => setEditor(prev => ({ ...prev, zoom: Math.min(2, prev.zoom + 0.1) }))} className="p-1 cursor-pointer opacity-60 hover:opacity-100 transition-opacity"><Plus size={14}/></button>
            <div className={`w-px h-3 mx-1 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}></div>
            <button onClick={() => setEditor(prev => ({ ...prev, zoom: 1 }))} className="p-1 cursor-pointer opacity-60 hover:opacity-100 transition-opacity" title="Reset Zoom">
              <RefreshCcw size={14} />
            </button>
          </div>
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} isDark={isDark} size={18} />
          <div className="relative">
            <div className="flex">
              <button onClick={() => handleExport(exportFormat)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white pl-4 pr-3 py-1.5 rounded-l-lg text-sm font-bold shadow-lg active:scale-95 transition-all">
                <Download size={16} /> Export {exportFormat.toUpperCase()}
              </button>
              <button 
                onClick={() => setExportMenuOpen(!exportMenuOpen)} 
                className="bg-blue-700 hover:bg-blue-600 text-white px-1.5 py-1.5 rounded-r-lg border-l border-blue-500/40 transition-all active:scale-95"
              >
                <ChevronDown size={14} />
              </button>
            </div>
            {exportMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
                <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl border shadow-2xl z-50 overflow-hidden ${isDark ? 'bg-[#1e1e24] border-white/10' : 'bg-white border-gray-200'}`}>
                  <button onClick={() => { setExportFormat('png'); handleExport('png'); }} className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold transition-colors ${isDark ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-gray-50 text-gray-700'}`}>
                    <FileImage size={15} className="text-blue-500" /> PNG Image
                  </button>
                  <button onClick={() => { setExportFormat('jpeg'); handleExport('jpeg'); }} className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold transition-colors ${isDark ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-gray-50 text-gray-700'}`}>
                    <FileImage size={15} className="text-orange-500" /> JPEG Image
                  </button>
                  <button onClick={() => { setExportFormat('webp'); handleExport('webp'); }} className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold transition-colors ${isDark ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-gray-50 text-gray-700'}`}>
                    <FileImage size={15} className="text-green-500" /> WebP Image
                  </button>
                  <button onClick={() => handleCopyToClipboard()} className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold transition-colors ${isDark ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-gray-50 text-gray-700'}`}>
                    <FileImage size={15} className="text-purple-500" /> Copy to Clipboard
                  </button>
                  <div className={`border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`} />
                  <button onClick={() => { setExportFormat('pdf'); handleExport('pdf'); }} className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold transition-colors ${isDark ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-gray-50 text-gray-700'}`}>
                    <FileText size={15} className="text-red-500" /> PDF Document
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Settings Panel */}
        <aside className={`w-72 border-r overflow-y-auto shrink-0 transition-colors ${isDark ? 'bg-[#16161a] border-white/5' : 'bg-white border-gray-100'}`}>
          <div className="p-6">
            {selectedAnn ? (
              /* Contextual Annotation Properties */
              <section className="animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="flex items-center justify-between mb-8">
                  <h3 className={`text-[11px] uppercase font-bold tracking-widest ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Annotation Props</h3>
                  <button onClick={() => setSelectedId(null)} className={`p-1.5 rounded-md transition-colors ${isDark ? 'hover:bg-white/5 text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`} title="Back to Settings">
                    <ChevronLeft size={16} />
                  </button>
                </div>
                
                <div className="space-y-8">
                  {/* Tool Badge */}
                  <div className={`px-4 py-3 rounded-xl border flex items-center gap-4 ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                      {selectedAnn.type === 'text' && <Type size={20} />}
                      {selectedAnn.type === 'rect' && <Square size={20} />}
                      {selectedAnn.type === 'circle' && <Circle size={20} />}
                      {selectedAnn.type === 'line' && <MinusIcon size={20} />}
                      {selectedAnn.type === 'highlighter' && <Highlighter size={20} />}
                      {selectedAnn.type === 'arrow' && <ArrowUpRight size={20} />}
                      {selectedAnn.type === 'blur' && <EyeOff size={20} />}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase opacity-40">Active Selection</div>
                      <div className="text-sm font-bold capitalize">{selectedAnn.type}</div>
                    </div>
                  </div>

                  {/* Blur Modes */}
                  {selectedAnn.type === 'blur' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div>
                        <span className="text-xs opacity-60 font-medium mb-3 block">Redaction Mode</span>
                        <div className={`grid grid-cols-2 gap-2 p-1 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                          {[
                            { id: 'blur', label: 'Blur', icon: <Droplets size={14}/> },
                            { id: 'color', label: 'Solid', icon: <Square size={14}/> }
                          ].map(mode => (
                            <button 
                              key={mode.id} 
                              onClick={() => updateAnnotation(selectedAnn.id, { blurMode: mode.id })} 
                              className={`flex flex-col items-center gap-1.5 py-2.5 rounded-lg transition-all ${
                                (selectedAnn.blurMode || 'blur') === mode.id 
                                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                  : 'text-gray-400 hover:text-gray-600 hover:bg-black/5'
                              }`}
                            >
                              {mode.id === 'blur' && <Droplets size={16}/>}
                              {mode.id === 'color' && <Square size={16}/>}
                              <span className="text-[9px] font-bold uppercase">{mode.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {((selectedAnn.blurMode || 'blur') === 'blur') && (
                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-xs opacity-60 font-medium">Blur Amount</span>
                            <span className="text-xs font-mono text-blue-500 font-bold">{(selectedAnn.blurAmount || 20)}px</span>
                          </div>
                          <input 
                            type="range" 
                            min="4" 
                            max="64" 
                            step="4" 
                            value={selectedAnn.blurAmount || 20} 
                            onChange={(e) => updateAnnotation(selectedAnn.id, { blurAmount: parseInt(e.target.value) })} 
                            className="w-full accent-blue-600 h-1.5 bg-blue-600/10 rounded-lg cursor-pointer appearance-none" 
                          />
                        </div>
                      )}

                      {selectedAnn.blurMode === 'color' && (
                        <div>
                          <span className="text-xs opacity-60 font-medium mb-3 block">Redaction Color</span>
                          <div className="grid grid-cols-5 gap-2">
                            {['#000000', '#ffffff', '#ef4444', '#3b82f6', '#10b981'].map(c => (
                              <button 
                                key={c} 
                                onClick={() => updateAnnotation(selectedAnn.id, { color: c })} 
                                className={`aspect-square rounded-full border-2 transition-all ${selectedAnn.color === c ? 'border-blue-500 scale-110 shadow-md' : 'border-transparent shadow-sm'}`} 
                                style={{ backgroundColor: c }} 
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Content for Text */}
                  {selectedAnn.type === 'text' && (
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs opacity-60 font-medium mb-2 block">Text Content</span>
                        <textarea 
                          value={selectedAnn.text} 
                          onChange={(e) => updateAnnotation(selectedAnn.id, { text: e.target.value })} 
                          className={`w-full bg-transparent border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 h-32 resize-none ${isDark ? 'border-white/10' : 'border-gray-200'}`}
                        />
                      </div>
<div className="flex items-center justify-between">
                         <span className="text-xs opacity-60 font-medium">Bold</span>
                         <button onClick={() => updateAnnotation(selectedAnn.id, { fontWeight: selectedAnn.fontWeight === 'bold' ? 'normal' : 'bold' })} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedAnn.fontWeight === 'bold' ? 'bg-blue-600 text-white' : isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                            {selectedAnn.fontWeight === 'bold' ? 'On' : 'Off'}
                         </button>
                       </div>
                       <div className="flex items-center justify-between">
                         <span className="text-xs opacity-60 font-medium">Italic</span>
                         <button onClick={() => updateAnnotation(selectedAnn.id, { fontStyle: selectedAnn.fontStyle === 'italic' ? 'normal' : 'italic' })} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedAnn.fontStyle === 'italic' ? 'bg-blue-600 text-white' : isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                            {selectedAnn.fontStyle === 'italic' ? 'On' : 'Off'}
                         </button>
                       </div>
                       <div>
                         <span className="text-xs opacity-60 font-medium mb-2 block">Text Color</span>
                         <div className="grid grid-cols-5 gap-1.5">
                           {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#ffffff', '#000000', '#ec4899', '#8b5cf6', '#06b6d4', '#4b5563'].map(c => (
                             <button 
                               key={c} 
                               onClick={() => updateAnnotation(selectedAnn.id, { color: c })} 
                               className={`aspect-square rounded-full border-2 transition-all ${selectedAnn.color === c ? 'border-blue-500 scale-110 shadow-md' : 'border-transparent shadow-sm'}`} 
                               style={{ backgroundColor: c }} 
                             />
                           ))}
                         </div>
                       </div>
                       <div>
                         <span className="text-xs opacity-60 font-medium mb-2 block">Background</span>
                         <div className="grid grid-cols-5 gap-1.5">
                           {['transparent', '#fef3c7', '#fce7f3', '#dbeafe', '#fee2e2', '#ecfdf5', '#fef08a', '#e9d5ff', '#fff7ed', '#374151'].map(c => (
                             <button 
                               key={c} 
                               onClick={() => updateAnnotation(selectedAnn.id, { textBackgroundColor: c })} 
                               className={`aspect-square rounded-full border-2 transition-all ${selectedAnn.textBackgroundColor === c || (!selectedAnn.textBackgroundColor && c === 'transparent') ? 'border-blue-500 scale-110 shadow-md' : 'border-transparent shadow-sm'}`} 
                               style={{ backgroundColor: c === 'transparent' ? 'transparent' : (c === 'transparent' ? 'transparent' : c)}} 
                             />
                           ))}
                         </div>
                       </div>
                     </div>
                   )}

{/* Color Picker for everything except Blur */}
                  {selectedAnn.type !== 'blur' && (
                    <div>
                      <div className="flex justify-between mb-3">
                        <span className="text-xs opacity-60 font-medium">Color Palette</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#ffffff', '#000000', '#ec4899', '#8b5cf6', '#06b6d4', '#4b5563'].map(c => (
                          <button 
                            key={c} 
                            onClick={() => updateAnnotation(selectedAnn.id, { color: c })} 
                            className={`aspect-square rounded-full border-2 transition-all ${selectedAnn.color === c ? 'border-blue-500 scale-110 shadow-md' : 'border-transparent shadow-sm'}`} 
                            style={{ backgroundColor: c }} 
                          />
                        ))}
                        <div className="relative aspect-square">
                          <input 
                            type="color" 
                            value={selectedAnn.color || '#3b82f6'} 
                            onChange={(e) => updateAnnotation(selectedAnn.id, { color: e.target.value })} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                          />
                          <div className={`w-full h-full rounded-full border-2 border-dashed flex items-center justify-center ${isDark ? 'border-white/20' : 'border-gray-300'}`}>
                             <Pipette size={12} className="opacity-40" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                   {(selectedAnn.type === 'rect' || selectedAnn.type === 'circle' || selectedAnn.type === 'line' || selectedAnn.type === 'arrow' || selectedAnn.type === 'highlighter' || selectedAnn.type === 'fill') && (
                     <div>
                       <span className="text-xs opacity-60 font-medium mb-3 block">Stroke Width</span>
                       <div className={`grid grid-cols-3 gap-2 p-1 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                         {[
                           { id: 'thin', label: 'S', w: 1 },
                           { id: 'medium', label: 'M', w: 3 },
                           { id: 'thick', label: 'L', w: 5 }
                         ].map(preset => (
                           <button 
                             key={preset.id} 
                             onClick={() => {
                               updateAnnotation(selectedAnn.id, { strokePreset: preset.id as 'thin' | 'medium' | 'thick', strokeWidth: preset.w });
                             }} 
                             className={`flex flex-col items-center gap-1.5 py-2.5 rounded-lg transition-all ${
                               selectedAnn.strokePreset === preset.id || (selectedAnn.strokePreset === undefined && preset.id === 'medium')
                                 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                 : 'text-gray-400 hover:text-gray-600 hover:bg-black/5'
                             }`}
                           >
                             <span className="text-[9px] font-bold">{preset.label}</span>
                           </button>
                         ))}
                       </div>
                     </div>
                   )}

                   {/* Opacity Control */}
                   {(selectedAnn.type === 'rect' || selectedAnn.type === 'circle' || selectedAnn.type === 'line' || selectedAnn.type === 'arrow' || selectedAnn.type === 'highlighter' || selectedAnn.type === 'fill') && (
                     <div>
                       <div className="flex justify-between mb-3">
                         <span className="text-xs opacity-60 font-medium">Opacity</span>
                         <span className="text-xs font-mono text-blue-500 font-bold">{Math.round((selectedAnn.opacity ?? 1) * 100)}%</span>
                       </div>
                       <input 
                         type="range" 
                         min="0.1" 
                         max="1" 
                         step="0.1" 
                         value={selectedAnn.opacity ?? 1} 
                         onChange={(e) => updateAnnotation(selectedAnn.id, { opacity: parseFloat(e.target.value) })} 
                         className="w-full accent-blue-600 h-1.5 bg-blue-600/10 rounded-lg cursor-pointer appearance-none" 
                       />
                     </div>
                   )}

                  {selectedAnn.type === 'text' && (
                    <div>
                      <div className="flex justify-between mb-3">
                        <span className="text-xs opacity-60 font-medium">Font Size</span>
                        <span className="text-xs font-mono text-blue-500 font-bold">{selectedAnn.fontSize}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="12" 
                        max="120" 
                        step="4" 
                        value={selectedAnn.fontSize} 
                        onChange={(e) => updateAnnotation(selectedAnn.id, { fontSize: parseInt(e.target.value) })} 
                        className="w-full accent-blue-600 h-1.5 bg-blue-600/10 rounded-lg cursor-pointer appearance-none" 
                      />
                    </div>
                  )}

                  <div className="pt-8">
                    {/* Layer Ordering */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button 
                        onClick={() => {
                          const idx = annotations.findIndex(a => a.id === selectedAnn.id);
                          if (idx < annotations.length - 1) {
                            const newAnns = [...annotations];
                            [newAnns[idx], newAnns[idx + 1]] = [newAnns[idx + 1], newAnns[idx]];
                            setAnnotations(newAnns);
                          }
                        }} 
                        className={`py-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                          isDark ? 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <ArrowUp size={14} /> Forward
                      </button>
                      <button 
                        onClick={() => {
                          const idx = annotations.findIndex(a => a.id === selectedAnn.id);
                          if (idx > 0) {
                            const newAnns = [...annotations];
                            [newAnns[idx], newAnns[idx - 1]] = [newAnns[idx - 1], newAnns[idx]];
                            setAnnotations(newAnns);
                          }
                        }} 
                        className={`py-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                          isDark ? 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <ArrowDown size={14} /> Back
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => deleteAnnotation(selectedAnn.id)} 
                      className="w-full py-3.5 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} /> Delete Annotation
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              /* Global Canvas & Frame Settings */
              <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
                {/* Canvas Settings */}
                <section>
                  <h3 className={`text-[11px] uppercase font-bold tracking-widest mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Canvas Settings</h3>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-xs opacity-60 font-medium">Padding</span>
                        <span className="text-xs font-mono text-blue-500">{editor.padding}px</span>
                      </div>
                      <input type="range" min="0" max="200" step="8" value={editor.padding} onChange={(e) => setEditor({...editor, padding: parseInt(e.target.value)})} className="w-full accent-blue-600 h-1 bg-blue-600/10 rounded-lg cursor-pointer appearance-none" />
                    </div>
                    <div>
                      <span className="text-xs opacity-60 font-medium mb-3 block">Background Color</span>
                      <div className="grid grid-cols-4 gap-2">
                        {presets.backgrounds.map((bg, i) => (
                          <button 
                            key={i} 
                            onClick={() => setEditor({...editor, background: bg.value})} 
                            className={`aspect-square w-full rounded-md border-2 transition-all overflow-hidden relative ${
                              editor.background === bg.value 
                                ? 'border-blue-500 scale-110 shadow-lg z-10' 
                                : isDark ? 'border-white/10 hover:border-white/20' : 'border-gray-200 hover:border-gray-300'
                            }`} 
                            style={{ 
                              background: bg.value.includes('gradient') ? bg.value : undefined,
                              backgroundColor: bg.value === 'transparent' ? undefined : (bg.value.includes('gradient') ? undefined : bg.value)
                            }}
                            title={bg.name}
                          >
                            {bg.value === 'transparent' && (
                              <div className="absolute inset-0" style={{ ...checkerboardStyle, backgroundSize: '10px 10px', backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px' }}></div>
                            )}
                          </button>
                        ))}
                        
                        {/* Custom Color Picker */}
                        <button 
                          onClick={() => document.getElementById('custom-bg-picker')?.click()}
                          className={`aspect-square w-full rounded-md border-2 border-dashed transition-all flex items-center justify-center relative overflow-hidden ${
                            !presets.backgrounds.some(bg => bg.value === editor.background) && editor.background !== 'transparent'
                              ? 'border-blue-500 scale-110 shadow-lg z-10' 
                              : isDark ? 'border-white/10 hover:border-white/20' : 'border-gray-200 hover:border-gray-300'
                          }`}
                          style={{
                            backgroundColor: !presets.backgrounds.some(bg => bg.value === editor.background) && editor.background !== 'transparent' 
                              ? editor.background : undefined
                          }}
                          title="Custom Color"
                        >
                          <Pipette size={18} className={(!presets.backgrounds.some(bg => bg.value === editor.background) && editor.background !== 'transparent') ? 'text-white mix-blend-difference' : (isDark ? 'text-gray-400' : 'text-gray-500')} />
                          <input 
                            id="custom-bg-picker"
                            type="color" 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                            onChange={(e) => setEditor({...editor, background: e.target.value})}
                            value={editor.background.startsWith('#') ? editor.background : '#3b82f6'}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Capture History */}
                {captureHistory.length > 0 && (
                  <section className="pt-4 border-t border-white/5">
                    <h3 className={`text-[11px] uppercase font-bold tracking-widest mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Recent Captures</h3>
                    <div className="grid grid-cols-2 gap-3 max-h-75 overflow-y-auto pr-2 custom-scrollbar">
                      {captureHistory.map((cap) => (
                        <button 
                          key={cap.id} 
                          onClick={() => {
                            setData(cap);
                            if (cap.type.startsWith('full-page') && cap.fragments) {
                              stitchFragments(cap).then(setStitchedImage);
                            } else {
                              setStitchedImage(cap.image || null);
                            }
                            // In a full implementation, you'd load capture-specific annotations here
                          }}
                          className={`group relative aspect-4/3 rounded-lg overflow-hidden border-2 transition-all ${data?.id === cap.id ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent hover:border-blue-500/40'}`}
                        >
                          {(cap.image || (cap.fragments && cap.fragments[0])) ? (
                            <img src={(cap.image || (typeof cap.fragments[0] === 'string' ? cap.fragments[0] : cap.fragments[0].dataUrl)) as string} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="" />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                              <ImageIcon size={20} className="opacity-20" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                             <span className="text-[9px] text-white font-bold truncate w-full">{cap.url?.replace(/^https?:\/\//, '')}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>  
        </aside>

        {/* Workspace */}
        <main onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} className={`flex-1 overflow-auto flex justify-center items-start p-20 relative group/canvas transition-colors ${isDark ? 'bg-[#09090b]' : 'bg-[#f8f9fa]'}`} style={checkerboardStyle}>
          <div style={{ transform: `scale(${editor.zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s ease-out' }}>
            <div ref={exportRef} className="relative shadow-2xl transition-all" style={{ padding: `${editor.padding}px`, background: editor.background }}>
              <div className="bg-white overflow-hidden shadow-2xl flex flex-col" style={{ borderRadius: `${editor.rounding}px` }}>
                {editor.frameStyle === 'chrome' && (
                  <div className="h-11 bg-[#f1f3f4] flex items-center px-4 gap-4 border-b border-gray-200 shrink-0">
                    <div className="flex gap-2 shrink-0"><div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div><div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div><div className="w-3 h-3 rounded-full bg-[#27c93f]"></div></div>
                    {editor.showUrl && <div className="flex-1 flex items-center justify-center"><div className="w-full max-w-lg h-7 bg-white rounded-md flex items-center px-3 text-[11px] border border-gray-200 font-medium truncate opacity-60">{data?.url}</div></div>}
                  </div>
                )}
      {/* SVG Filters for specialized effects */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="pixelate-filter" x="0%" y="0%" width="100%" height="100%">
            <feFlood x="2" y="2" height="2" width="2"/>
            <feComposite width="10" height="10"/>
            <feTile result="a"/>
            <feComposite in="SourceGraphic" in2="a" operator="in"/>
            <feMorphology operator="dilate" radius="5"/>
          </filter>
        </defs>
      </svg>

      <div 
        ref={canvasRef}
        onMouseDown={handleMouseDown} 
        className={`relative overflow-hidden min-w-200 ${editor.activeTool !== 'select' ? 'cursor-crosshair' : ''}`}
      >
        {stitchedImage && <img src={stitchedImage} alt="Capture" className="w-full h-auto block select-none pointer-events-none" />}
                  {annotations.map(ann => (
                    <div 
                      key={ann.id} 
                      onMouseDown={(e) => {
                        // Only stop propagation when in select mode - otherwise let click pass to canvas to create new shape
                        if (editor.activeTool === 'select') {
                          e.stopPropagation();
                          setSelectedId(ann.id);
                          setIsDragging(true);
                          const rect = canvasRef.current?.getBoundingClientRect();
                          if (rect) {
                            const mouseX = (e.clientX - rect.left) / editor.zoom;
                            const mouseY = (e.clientY - rect.top) / editor.zoom;
                            dragOffset.current = { x: mouseX - ann.x, y: mouseY - ann.y };
                          }
                        } else {
                          // When not in select mode, don't stop propagation - canvas will create new shape
                          // But we need to set selectedId first so it works properly
                          setSelectedId(ann.id);
                        }
                      }}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        // Double click to start editing text
                        if (selectedId === ann.id && ann.type === 'text') {
                          const el = e.currentTarget.querySelector('[contenteditable]');
                          if (el) (el as HTMLElement).focus();
                        }
                      }} 
                      style={{ 
                        position: 'absolute', 
                        left: (ann.type === 'arrow' || ann.type === 'line') ? 0 : ann.x, 
                        top: (ann.type === 'arrow' || ann.type === 'line') ? 0 : ann.y, 
                        width: (ann.type === 'blur' || ann.type === 'rect' || ann.type === 'circle' || ann.type === 'highlighter' || ann.type === 'fill') ? ann.width : (ann.type === 'arrow' || ann.type === 'line' ? '100%' : 'auto'), 
                        height: (ann.type === 'blur' || ann.type === 'rect' || ann.type === 'circle' || ann.type === 'highlighter' || ann.type === 'fill') ? ann.height : (ann.type === 'arrow' || ann.type === 'line' ? '100%' : 'auto'), 
                        border: (selectedId === ann.id && ann.type !== 'arrow' && ann.type !== 'line') ? `2px solid ${ann.color || '#3b82f6'}` : ((ann.type === 'rect' || ann.type === 'circle') ? `2px solid ${ann.color}` : 'none'), 
                        borderRadius: ann.type === 'circle' ? '50%' : ann.type === 'highlighter' ? '4px' : '0',
                        backgroundColor: ann.highlighter ? 'rgba(255, 255, 0, 0.35)' : (ann.fill ? (ann.color || '#3b82f6') : (ann.type === 'blur' ? (ann.blurMode === 'color' ? (ann.color || '#000000') : 'transparent') : 'transparent')),
                        cursor: (ann.type === 'arrow' || ann.type === 'line') ? 'inherit' : 'move', 
                        zIndex: 10,
                        opacity: ann.opacity ?? 1,
                        pointerEvents: ((ann.type === 'arrow' || ann.type === 'line')) ? 'none' : 'auto',
                        // Advanced Redaction Modes
                        ...(ann.type === 'blur' ? {
                          backdropFilter: (ann.blurMode === 'blur' || !ann.blurMode) 
                            ? `blur(${ann.blurAmount || 20}px)` 
                            : 'none',
                        } : {})
                      }} 
                      className={`${ann.type === 'blur' ? 'shadow-inner' : ''}`}
                    >
                      {selectedId === ann.id && (
                        <div className="pointer-events-auto absolute inset-0">
                          {/* All 8 Resize Handles - extended hit areas */}
                          {(ann.type === 'rect' || ann.type === 'circle' || ann.type === 'highlighter' || ann.type === 'fill' || ann.type === 'text' || ann.type === 'blur') && (
                            <>
                              {/* Corners - larger hit areas */}
                              <div className="absolute w-6 h-6 -top-3 -left-3 cursor-nwse-resize z-30" onMouseDown={(e) => handleResizeStart(e, ann.id, 'nw')} />
                              <div className="absolute w-6 h-6 -top-3 -right-3 cursor-nesw-resize z-30" onMouseDown={(e) => handleResizeStart(e, ann.id, 'ne')} />
                              <div className="absolute w-6 h-6 -bottom-3 -left-2 cursor-nesw-resize z-30" onMouseDown={(e) => handleResizeStart(e, ann.id, 'sw')} />
                              <div className="absolute w-6 h-6 -bottom-3 -right-3 cursor-nwse-resize z-30" onMouseDown={(e) => handleResizeStart(e, ann.id, 'se')} />
                              {/* Edge hit areas - full strips */}
                              <div className="absolute w-full h-3 top-0 cursor-ns-resize z-20" onMouseDown={(e) => handleResizeStart(e, ann.id, 'n')} />
                              <div className="absolute w-full h-3 bottom-0 cursor-ns-resize z-20" onMouseDown={(e) => handleResizeStart(e, ann.id, 's')} />
                              <div className="absolute h-full w-3 left-0 cursor-ew-resize z-20" onMouseDown={(e) => handleResizeStart(e, ann.id, 'w')} />
                              <div className="absolute h-full w-3 right-0 cursor-ew-resize z-20" onMouseDown={(e) => handleResizeStart(e, ann.id, 'e')} />
                            </>
                          )}
                          {/* Arrow Adjustment Handles */}
                          {(ann.type === 'arrow' || ann.type === 'line') && (
                            <>
                              <div 
                                className="absolute w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-full cursor-pointer z-40 shadow-sm hover:scale-125 transition-transform" 
                                style={{ left: ann.x, top: ann.y, transform: 'translate(-50%, -50%)' }}
                                onMouseDown={(e) => handleResizeStart(e, ann.id, 'start')}
                              />
                              <div 
                                className="absolute w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-full cursor-pointer z-40 shadow-sm hover:scale-125 transition-transform" 
                                style={{ left: ann.x2, top: ann.y2, transform: 'translate(-50%, -50%)' }}
                                onMouseDown={(e) => handleResizeStart(e, ann.id, 'end')}
                              />
                            </>
                          )}
                        </div>
                      )}
                      {ann.type === 'text' && (
                        <div 
                          contentEditable={selectedId === ann.id}
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newText = e.currentTarget.textContent || '';
                            if (newText !== ann.text) {
                              updateAnnotation(ann.id, { text: newText });
                              saveToHistory(annotations.map(a => a.id === ann.id ? { ...a, text: newText } : a));
                            }
                          }}
                          style={{ 
                            color: ann.color, 
                            fontSize: ann.fontSize, 
                            fontWeight: ann.fontWeight,
                            fontStyle: ann.fontStyle,
                            backgroundColor: ann.textBackgroundColor === 'transparent' ? 'transparent' : (ann.textBackgroundColor || 'transparent'),
                            padding: ann.textBackgroundColor && ann.textBackgroundColor !== 'transparent' ? '4px 6px' : '2px',
                            borderRadius: ann.textBackgroundColor && ann.textBackgroundColor !== 'transparent' ? '4px' : '0',
                            width: ann.width && ann.width > 20 ? ann.width : 'auto',
                            minHeight: ann.height && ann.height > 20 ? ann.height : 'auto',
                            textShadow: isDark ? '0 2px 8px rgba(0,0,0,0.8)' : '0 1px 4px rgba(0,0,0,0.2), 0 0 2px white' 
                          }} 
                          className="whitespace-pre-wrap font-sans leading-tight p-2 outline-none contenteditable-root"
                        >
                          {ann.text}
                        </div>
                      )}
                      {ann.type === 'rect' && (
                        <div style={{ width: '100%', height: '100%' }}></div>
                      )}
                      {ann.type === 'circle' && (
                        <div style={{ width: '100%', height: '100%' }}></div>
                      )}
                      {ann.type === 'highlighter' && (
                        <div style={{ width: '100%', height: '100%' }}></div>
                      )}
                      {ann.type === 'line' && (
                        <svg 
                          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
                        >
                          <defs>
                            <marker id={`lineStart-${ann.id}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                              <circle cx="3" cy="3" r="2.5" fill={ann.color} />
                            </marker>
                            <marker id={`lineEnd-${ann.id}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                              <circle cx="3" cy="3" r="2.5" fill={ann.color} />
                            </marker>
                          </defs>
                          <line 
                            x1={ann.x} y1={ann.y} x2={ann.x2} y2={ann.y2} 
                            stroke="transparent" 
                            strokeWidth="24" 
                            className="pointer-events-auto cursor-move"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setSelectedId(ann.id);
                              setIsDragging(true);
                              const rect = canvasRef.current?.getBoundingClientRect();
                              if (rect) {
                                const mouseX = (e.clientX - rect.left) / editor.zoom;
                                const mouseY = (e.clientY - rect.top) / editor.zoom;
                                dragOffset.current = { x: mouseX - ann.x, y: mouseY - ann.y };
                              }
                            }}
                          />
                          <line 
                            x1={ann.x} y1={ann.y} x2={ann.x2} y2={ann.y2} 
                            stroke={ann.color} 
                            strokeWidth={ann.strokeWidth || 2}
                            markerStart={`url(#lineStart-${ann.id})`}
                            markerEnd={`url(#lineEnd-${ann.id})`}
                            className="pointer-events-none"
                          />
                        </svg>
                      )}
                      {ann.type === 'arrow' && (
                        <svg 
                          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
                        >
                          <defs>
                            <marker id={`arrowhead-${ann.id}`} markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                              <polygon points="0 0, 10 3.5, 0 7" fill={ann.color} />
                            </marker>
                          </defs>
                          {/* Hit Area - thicker invisible line for easy clicking */}
                          <line 
                            x1={ann.x} y1={ann.y} x2={ann.x2} y2={ann.y2} 
                            stroke="transparent" 
                            strokeWidth="24" 
                            className="pointer-events-auto cursor-move"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setSelectedId(ann.id);
                              setIsDragging(true);
                              const rect = canvasRef.current?.getBoundingClientRect();
                              if (rect) {
                                const mouseX = (e.clientX - rect.left) / editor.zoom;
                                const mouseY = (e.clientY - rect.top) / editor.zoom;
                                dragOffset.current = { x: mouseX - ann.x, y: mouseY - ann.y };
                              }
                            }}
                          />
                          <line 
                            x1={ann.x} y1={ann.y} x2={ann.x2} y2={ann.y2} 
                            stroke={ann.color} 
                            strokeWidth={ann.strokeWidth || 3} 
                            markerEnd={`url(#arrowhead-${ann.id})`}
                            className="pointer-events-none"
                          />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Toolbar (Right Sidebar) */}
        <aside className={`w-16 border-l flex flex-col items-center py-4 gap-1 shrink-0 transition-colors ${isDark ? 'bg-[#16161a] border-white/5' : 'bg-white border-gray-100'}`}>
           <ToolButton icon={<MousePointer size={20}/>} active={editor.activeTool === 'select'} onClick={() => setEditor({...editor, activeTool: 'select'})} label="Select" isDark={isDark} />
<ToolButton icon={<Type size={20}/>} active={editor.activeTool === 'text'} onClick={() => setEditor({...editor, activeTool: 'text'})} label="Text" isDark={isDark} />
            <ToolButton icon={<Square size={20}/>} active={editor.activeTool === 'rect'} onClick={() => setEditor({...editor, activeTool: 'rect'})} label="Box" isDark={isDark} />
            <ToolButton icon={<Circle size={20}/>} active={editor.activeTool === 'circle'} onClick={() => setEditor({...editor, activeTool: 'circle'})} label="Circle" isDark={isDark} />
            <ToolButton icon={<PaintBucket size={20}/>} active={editor.activeTool === 'fill'} onClick={() => setEditor({...editor, activeTool: 'fill'})} label="Fill" isDark={isDark} />
            <ToolButton icon={<ArrowUpRight size={20}/>} active={editor.activeTool === 'arrow'} onClick={() => setEditor({...editor, activeTool: 'arrow'})} label="Arrow" isDark={isDark} />
            <ToolButton icon={<MinusIcon size={20}/>} active={editor.activeTool === 'line'} onClick={() => setEditor({...editor, activeTool: 'line'})} label="Line" isDark={isDark} />
            <ToolButton icon={<Highlighter size={20}/>} active={editor.activeTool === 'highlighter'} onClick={() => setEditor({...editor, activeTool: 'highlighter'})} label="Highlight" isDark={isDark} />
            <ToolButton icon={<EyeOff size={20}/>} active={editor.activeTool === 'blur'} onClick={() => setEditor({...editor, activeTool: 'blur'})} label="Blur" isDark={isDark} />
        </aside>
      </div>
    </div>
  );
}

function ToolButton({ icon, active, onClick, label, isDark }: any) {
  return (
    <div className="relative group/tool">
      <button 
        onClick={onClick} 
        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
          active 
            ? 'bg-blue-600 text-white shadow-lg scale-110' 
            : isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-blue-50 text-gray-500'
        }`}
      >
        {icon}
      </button>
      
      {/* Tooltip */}
      <div 
        className={`absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-md bg-gray-900 text-white text-[9px] font-bold uppercase tracking-widest whitespace-nowrap pointer-events-none opacity-0 group-hover/tool:opacity-100 transition-opacity duration-200 shadow-2xl z-100`}
        style={{ transitionDelay: '250ms' }}
      >
        {label}
        {/* Tiny arrow */}
        <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900" />
      </div>
    </div>
  );
}

export default App;
