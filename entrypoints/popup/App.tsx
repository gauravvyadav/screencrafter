import { useState, useEffect } from 'react';
import { Monitor, FileText, Crop, Images, ArrowUpRight } from 'lucide-react';
import { sendMessage } from '@/utils/messaging';
import { useTheme } from '@/hooks/useTheme';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';

const VERSION = '0.1.0';

function App() {
  const { theme, toggleTheme, isDark } = useTheme();
  const [maxHeight, setMaxHeight] = useState(15000);

  useEffect(() => {
    browser.storage.local.get('maxCaptureHeight').then((res: any) => {
      if (res.maxCaptureHeight) setMaxHeight(Number(res.maxCaptureHeight));
    });
  }, []);

  const handleMaxHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setMaxHeight(val);
    browser.storage.local.set({ maxCaptureHeight: val });
  };

  const handleCaptureVisible = () => { sendMessage({ type: 'CAPTURE_VISIBLE' }); window.close(); };
  const handleFullPageCapture = () => { sendMessage({ type: 'CAPTURE_FULL_PAGE' }); window.close(); };
  const handleAreaCapture = () => { sendMessage({ type: 'CAPTURE_AREA' as any }); window.close(); };
  const handleOpenDashboard = () => sendMessage({ type: 'OPEN_DASHBOARD' });

  return (
    <div className={`flex flex-col w-[320px] transition-colors duration-300 ${isDark ? 'bg-[#0a0a0d] text-white' : 'bg-white text-gray-900'} overflow-hidden font-sans`}>
      <div className={`px-5 py-4 border-b flex items-center justify-between transition-colors duration-300 ${isDark ? 'border-white/5 bg-[#16161a]' : 'border-gray-100 bg-gray-50/50'}`}>
        <div className="flex items-center gap-2">
          <Logo isDark={isDark} size="sm" />
          <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md ${isDark ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>v{VERSION}</span>
        </div>
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} isDark={isDark} size={16} />
      </div>

      <div className="p-4 space-y-2">
        <OptionButton 
          onClick={handleCaptureVisible}
          icon={<Monitor size={20}/>}
          title="Visible Area"
          desc="Capture current viewport"
          isDark={isDark}
        />
        <OptionButton 
          onClick={handleFullPageCapture}
          icon={<FileText size={20}/>}
          title="Full Page"
          desc="Capture entire scrollable page"
          isDark={isDark}
        />
        <OptionButton 
          onClick={handleAreaCapture}
          icon={<Crop size={20}/>}
          title="Select Area"
          desc="Quick crop and download"
          isDark={isDark}
        />
        
        <div className={`mt-4 p-3 border rounded-xl transition-all ${isDark ? 'bg-white/5 border-white/5' : 'bg-white border-gray-200'}`}>
          <div className="flex justify-between items-center mb-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Max Capture Height</span>
            <span className="text-[10px] font-mono text-blue-500 font-bold">{maxHeight}px</span>
          </div>
          <input 
            type="range" 
            min="5000" 
            max="40000" 
            step="1000" 
            value={maxHeight} 
            onChange={handleMaxHeightChange} 
            className="w-full accent-blue-600 h-1 bg-blue-600/10 rounded-lg cursor-pointer appearance-none" 
          />
          <div className={`text-[9px] mt-2 font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Prevents infinite scroll runaway</div>
        </div>
      </div>

      <div className={`px-4 py-3 border-t transition-colors duration-300 ${isDark ? 'bg-[#16161a] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
        <button 
          onClick={handleOpenDashboard} 
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all group ${isDark ? 'bg-white/2 border-white/5 hover:bg-white/5 hover:border-white/10' : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200'}`}
        >
          <div className="flex items-center gap-2.5">
            <Images size={16} className={`transition-colors ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
            <span className={`text-xs font-bold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Screenshot Gallery</span>
          </div>
          <ArrowUpRight size={14} className={`transition-all ${isDark ? 'text-gray-600 group-hover:text-blue-400' : 'text-gray-400 group-hover:text-blue-500'} group-hover:translate-x-0.5 group-hover:-translate-y-0.5`} />
        </button>
      </div>
    </div>
  );
}

function OptionButton({ onClick, icon, title, desc, isDark }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 p-3 border rounded-xl transition-all group text-left ${isDark ? 'bg-white/2 border-white/5 hover:bg-white/5' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all group-hover:bg-blue-600 group-hover:text-white ${isDark ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
        {icon}
      </div>
      <div>
        <div className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{title}</div>
        <div className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{desc}</div>
      </div>
    </button>
  );
}

export default App;
