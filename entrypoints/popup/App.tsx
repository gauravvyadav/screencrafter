import { useState, useEffect, useCallback } from 'react';
import { Monitor, FileText, Crop, Images, ArrowUpRight, ShieldAlert, ExternalLink, X, Loader2 } from 'lucide-react';
import { sendMessage } from '@/utils/messaging';
import { useTheme } from '@/hooks/useTheme';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';

const VERSION = '0.1.0';

const RESTRICTED_PREFIXES = [
  'chrome://', 'chrome-extension://', 'edge://', 'about:',
  'moz-extension://', 'devtools://', 'view-source:',
];
const RESTRICTED_DOMAINS = [
  'chromewebstore.google.com',
  'chrome.google.com/webstore',
  'microsoftedge.microsoft.com/addons',
  'addons.mozilla.org',
];

function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;
  if (RESTRICTED_PREFIXES.some(p => url.startsWith(p))) return true;
  try {
    const { hostname, pathname } = new URL(url);
    const full = hostname + pathname;
    if (RESTRICTED_DOMAINS.some(d => full.startsWith(d))) return true;
  } catch { /* invalid URL */ }
  return false;
}

interface CaptureStatus {
  inProgress: boolean;
  tabId?: number;
  progress?: { current: number; total: number };
}

function App() {
  const { theme, toggleTheme, isDark } = useTheme();
  const [maxHeight, setMaxHeight] = useState(15000);
  const [restricted, setRestricted] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>({ inProgress: false });
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);

  const checkCaptureStatus = useCallback(async () => {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      setCurrentTabId(tab?.id ?? null);
      const status = await sendMessage({ type: 'GET_CAPTURE_STATUS' }) as CaptureStatus;
      setCaptureStatus(status);
    } catch {}
  }, []);

  useEffect(() => {
    browser.storage.local.get('maxCaptureHeight').then((res: any) => {
      if (res.maxCaptureHeight) setMaxHeight(Number(res.maxCaptureHeight));
    });

    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      setRestricted(isRestrictedUrl(tab?.url));
    });

    checkCaptureStatus();

    const handleFocus = () => checkCaptureStatus();
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(checkCaptureStatus, 1000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [checkCaptureStatus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && captureStatus.inProgress && captureStatus.tabId === currentTabId) {
        handleCancelCapture();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [captureStatus, currentTabId]);

  const handleMaxHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setMaxHeight(val);
    browser.storage.local.set({ maxCaptureHeight: val });
  };

  const handleCaptureVisible = () => { sendMessage({ type: 'CAPTURE_VISIBLE' }); window.close(); };
  const handleFullPageCapture = () => { sendMessage({ type: 'CAPTURE_FULL_PAGE' }); window.close(); };
  const handleAreaCapture = () => { sendMessage({ type: 'CAPTURE_AREA' }); window.close(); };
  const handleOpenDashboard = () => sendMessage({ type: 'OPEN_DASHBOARD' });
  const handleCancelCapture = async () => {
    await sendMessage({ type: 'CANCEL_CAPTURE' });
    checkCaptureStatus();
  };

  const isCapturingCurrentTab = captureStatus.inProgress && captureStatus.tabId === currentTabId;
  const progress = captureStatus.progress;
  const progressPercent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className={`flex flex-col w-[320px] transition-colors duration-300 ${isDark ? 'bg-[#0a0a0d] text-white' : 'bg-white text-gray-900'} overflow-hidden font-sans`}>
      <div className={`px-5 py-4 border-b flex items-center justify-between transition-colors duration-300 ${isDark ? 'border-white/5 bg-[#16161a]' : 'border-gray-100 bg-gray-50/50'}`}>
        <div className="flex items-center gap-2">
          <Logo isDark={isDark} size="sm" />
          <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md ${isDark ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>v{VERSION}</span>
        </div>
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} isDark={isDark} size={16} />
      </div>

      {restricted && <RestrictedBanner isDark={isDark} />}

      {isCapturingCurrentTab ? (
        <div className="p-4">
          <div className={`rounded-xl border p-4 space-y-3 ${isDark ? 'bg-blue-500/5 border-blue-500/15' : 'bg-blue-50 border-blue-200/60'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-blue-500/10' : 'bg-blue-100'}`}>
                <Loader2 size={18} className={`${isDark ? 'text-blue-400' : 'text-blue-600'} animate-spin`} />
              </div>
              <div>
                <p className={`text-[13px] font-semibold leading-snug ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                  Capturing Full Page...
                </p>
                {progress && (
                  <div className="mt-2">
                    <div className={`text-[10px] mb-1 ${isDark ? 'text-blue-400/70' : 'text-blue-700/80'}`}>
                      {progress.current} / {progress.total} fragments
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-blue-900/40' : 'bg-blue-200'}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className={`text-[9px] mt-1 font-mono font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                      {progressPercent}%
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className={`h-px ${isDark ? 'bg-blue-500/10' : 'bg-blue-200/50'}`} />
            <button
              onClick={handleCancelCapture}
              className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border font-semibold text-[12px] transition-all ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-red-50 border-red-200/60 text-red-600 hover:bg-red-100'}`}
            >
              <X size={14} />
              Cancel Capture
            </button>
            <p className={`text-[9px] text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              or press <kbd className={`px-1 py-0.5 rounded text-[8px] font-mono font-bold ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>Esc</kbd> to cancel
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          <OptionButton 
            onClick={handleCaptureVisible}
            icon={<Monitor size={20}/>}
            title="Visible Area"
            desc="Capture current viewport"
            isDark={isDark}
          />
          {!restricted && (
            <>
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
            </>
          )}
        </div>
      )}

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

function RestrictedBanner({ isDark }: { isDark: boolean }) {
  return (
    <div className="p-4">
      <div className={`rounded-xl border p-4 space-y-3 ${isDark ? 'bg-amber-500/5 border-amber-500/15' : 'bg-amber-50 border-amber-200/60'}`}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-amber-500/10' : 'bg-amber-100'}`}>
            <ShieldAlert size={18} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
          </div>
          <div>
            <p className={`text-[13px] font-semibold leading-snug ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
              Restricted Page
            </p>
            <p className={`text-[11px] mt-1 leading-relaxed ${isDark ? 'text-amber-400/70' : 'text-amber-700/80'}`}>
              <span className="font-semibold">Full Page</span> and <span className="font-semibold">Select Area</span> captures are unavailable on this page. Your browser restricts extensions from running scripts on web store, settings, and other extension pages.
            </p>
          </div>
        </div>

        <div className={`h-px ${isDark ? 'bg-amber-500/10' : 'bg-amber-200/50'}`} />

        <a
          href="https://gauravlabs.com"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.preventDefault();
            browser.tabs.create({ url: 'https://gauravlabs.com' });
            window.close();
          }}
          className={`flex items-center gap-2 text-[11px] font-semibold transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
        >
          <ExternalLink size={12} />
          Try on another page
        </a>
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
