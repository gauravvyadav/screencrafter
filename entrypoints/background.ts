export default defineBackground(() => {
  let captureState = {
    isCapturing: false,
    capturingTabId: 0,
    shouldCancel: false,
    progress: { current: 0, total: 0 },
  };

  function sendProgressUpdate(current: number, total: number) {
    captureState.progress = { current, total };
    if (captureState.capturingTabId) {
      browser.tabs.sendMessage(captureState.capturingTabId, {
        type: 'CAPTURE_PROGRESS',
        current,
        total,
      }).catch(() => {});
    }
  }

  function notifyCaptureStatus() {
    return {
      inProgress: captureState.isCapturing,
      tabId: captureState.capturingTabId,
      progress: captureState.isCapturing ? captureState.progress : undefined,
    };
  }

  // Handle extension install
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      browser.tabs.create({ url: 'https://screencrafter.gauravlabs.com/install' });
    }
  });

  // Handle extension uninstall
  browser.runtime.setUninstallURL('https://screencrafter.gauravlabs.com/uninstall');

  function sanitizeUrl(url: string | undefined): string {
    try {
      const parsed = new URL(url || '');
      return parsed.origin;
    } catch {
      return '';
    }
  }

  /**
   * Ensures the content script is running in the given tab.
   * Pings the content script first; if it doesn't respond, re-injects it.
   * Returns true if the content script is ready, false if injection failed
   * (e.g. restricted pages like chrome://, edge://, about:, etc.).
   */
  async function ensureContentScript(tabId: number): Promise<boolean> {
    try {
      // Try pinging the content script
      const response = await browser.tabs.sendMessage(tabId, { type: 'PING' }).catch(() => null);
      if (response === 'PONG') return true;
    } catch {
      // Content script not reachable
    }

    // Content script not loaded — try to inject it
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['/content-scripts/content.js'],
      });

      // Wait up to 500ms for the script to initialize (poll every 50ms)
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 50));
        const response = await browser.tabs.sendMessage(tabId, { type: 'PING' }).catch(() => null);
        if (response === 'PONG') return true;
      }
      return false;
    } catch (err) {
      console.warn('Cannot inject content script into tab', tabId, err);
      return false;
    }
  }

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const isFromExtension = !sender.tab && sender.id === browser.runtime.id;
    const isFromTab = sender.tab?.id;
    if (!isFromExtension && !isFromTab) return;
    if (message.type === 'CAPTURE_VISIBLE') {
      handleCaptureVisible().then(() => sendResponse({}));
      return true;
    }

    if (message.type === 'CAPTURE_FULL_PAGE') {
      handleFullPageCaptureScroll().then(() => sendResponse({}));
      return true;
    }

    if (message.type === 'CAPTURE_AREA') {
      handleAreaCapture().then(() => sendResponse({}));
      return true;
    }

    if (message.type === 'OPEN_DASHBOARD') {
      browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
      sendResponse({});
      return true;
    }

    if (message.type === 'GET_CAPTURE_STATUS') {
      sendResponse(notifyCaptureStatus());
      return true;
    }

    if (message.type === 'CANCEL_CAPTURE') {
      captureState.shouldCancel = true;
      sendResponse({ canceled: true });
      return true;
    }
  });

  // Save capture to both lastCapture and captureHistory
  async function saveCapture(capture: any) {
    const { captureHistory = [] } = await browser.storage.local.get('captureHistory') as any;
    // Avoid duplicates by id
    const exists = captureHistory.some((c: any) => c.id === capture.id);
    const updatedHistory = exists
      ? captureHistory
      : [capture, ...captureHistory].slice(0, 50);
    await browser.storage.local.set({
      lastCapture: capture,
      captureHistory: updatedHistory,
    });
  }

  async function handleCaptureVisible() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const dataUrl = await browser.tabs.captureVisibleTab();
    const capture = {
      id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      image: dataUrl,
      url: sanitizeUrl(tab.url),
      title: tab.title || '',
      timestamp: Date.now(),
    };
    await saveCapture(capture);
    browser.tabs.create({ url: browser.runtime.getURL('/editor.html') });
  }

  /** Checks if a tab URL is capturable (not a restricted browser page). */
  function isCapturableTab(url: string | undefined): boolean {
    if (!url) return false;
    const restrictedPrefixes = [
      'chrome://', 'chrome-extension://', 'edge://', 'about:',
      'moz-extension://', 'devtools://', 'view-source:',
    ];
    const restrictedDomains = [
      'chromewebstore.google.com',
      'chrome.google.com/webstore',
      'microsoftedge.microsoft.com/addons',
      'addons.mozilla.org',
    ];
    if (restrictedPrefixes.some(prefix => url.startsWith(prefix))) return false;
    try {
      const host = new URL(url).hostname + new URL(url).pathname;
      if (restrictedDomains.some(d => host.startsWith(d))) return false;
    } catch { /* invalid URL */ }
    return true;
  }

  /** Shows a temporary badge on the extension icon when capture is blocked. */
  function notifyRestricted() {
    browser.action.setBadgeText({ text: '!' });
    browser.action.setBadgeBackgroundColor({ color: '#EF4444' });
    browser.action.setTitle({ title: 'Screencrafter: Cannot capture this page (restricted by browser)' });
    setTimeout(() => {
      browser.action.setBadgeText({ text: '' });
      browser.action.setTitle({ title: '' });
    }, 4000);
  }

  // --- SCROLL-BASED FULL PAGE CAPTURE ---
  async function handleFullPageCaptureScroll() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    if (!isCapturableTab(tab.url)) {
      console.warn('Cannot capture this page:', tab.url);
      notifyRestricted();
      return;
    }

    captureState.isCapturing = true;
    captureState.capturingTabId = tab.id;
    captureState.shouldCancel = false;
    captureState.progress = { current: 0, total: 0 };

    const cleanup = async () => {
      captureState.isCapturing = false;
      captureState.capturingTabId = 0;
      captureState.shouldCancel = false;
      captureState.progress = { current: 0, total: 0 };
      if (tab.id) {
        try {
          await browser.tabs.sendMessage(tab.id, { type: 'RESTORE_FIXED_ELEMENTS' });
        } catch {}
      }
    };

    try {
      const storage: any = await browser.storage.local.get('maxCaptureHeight');
      const MAX_HEIGHT = Number(storage.maxCaptureHeight || 15000);

      const dims = await browser.tabs.sendMessage(tab.id, { type: 'PREPARE_FULL_PAGE' });
      if (!dims) return;

      const viewport = await browser.tabs.sendMessage(tab.id, { type: 'GET_VIEWPORT' });

      const fullWidth = dims.width;
      const fullHeight = dims.height;
      const viewHeight = viewport.height;
      const dpr = dims.dpr;

      const fragments: { dataUrl: string, x: number, y: number }[] = [];
      let hasHiddenElements = false;

      const totalSteps = Math.ceil(Math.min(fullHeight, MAX_HEIGHT) / viewHeight);

      for (let y = 0; y < Math.min(fullHeight, MAX_HEIGHT); y += viewHeight) {
        if (captureState.shouldCancel) {
          console.log('Full-page capture canceled by user');
          await cleanup();
          return;
        }

        if (y > 0 && !hasHiddenElements) {
            await browser.tabs.sendMessage(tab.id, { type: 'HIDE_FIXED_ELEMENTS' }).catch(() => {});
            hasHiddenElements = true;
            await new Promise(r => setTimeout(r, 50));
        }

        await browser.tabs.sendMessage(tab.id, { type: 'SCROLL_TO', data: { x: 0, y: y } });

        await new Promise(r => setTimeout(r, 600));

        const dataUrl = await browser.tabs.captureVisibleTab({ format: 'png' });

        const scrollPos = await browser.tabs.sendMessage(tab.id, { type: 'GET_SCROLL_POS' });

        fragments.push({
          dataUrl,
          x: scrollPos.x * dpr,
          y: scrollPos.y * dpr,
        });

        sendProgressUpdate(fragments.length, totalSteps);

        if (scrollPos.y + viewHeight >= fullHeight || y >= fullHeight) {
            break;
        }
      }

      await cleanup();

      if (fragments.length > 0) {
        const capture = {
          id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fragments,
          fullWidth: fullWidth * dpr,
          fullHeight: fullHeight * dpr,
          url: sanitizeUrl(tab.url),
          title: tab.title || '',
          timestamp: Date.now(),
          type: 'full-page-scroll',
        };
        await saveCapture(capture);
        browser.tabs.create({ url: browser.runtime.getURL('/editor.html') });
      }
    } catch (err: any) {
      console.error('Scroll capture failed', err);
      await cleanup();
      browser.tabs.sendMessage(tab.id, {
        type: 'SHOW_ALERT',
        data: { message: 'Screencrafter Error: ' + (err.message || String(err)) }
      }).catch(() => {});
    }
  }

  async function handleAreaCapture() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    if (!isCapturableTab(tab.url)) {
      console.warn('Cannot capture this page:', tab.url);
      notifyRestricted();
      return;
    }

    const scriptReady = await ensureContentScript(tab.id);
    if (!scriptReady) {
      console.warn('Content script could not be injected into tab', tab.id);
      return;
    }

    try {
      const result = await browser.tabs.sendMessage(tab.id, { type: 'START_AREA_SELECTION' });
      if (!result || !result.area) return;

      const { area, dpr, finalScrollX, finalScrollY, action } = result;
      const doDownload = !action || action === 'download';
      const doOpenEditor = action === 'edit';

      const viewport = await browser.tabs.sendMessage(tab.id, { type: 'GET_VIEWPORT' });
      const viewHeight = viewport?.height || 768;

      const selectionFitsInViewport = area.height <= viewHeight;

      if (selectionFitsInViewport) {
        await browser.tabs.sendMessage(tab.id, { type: 'HIDE_TOOLBAR' }).catch(() => {});
        const dataUrl = await browser.tabs.captureVisibleTab({ format: 'png' });
        if (!dataUrl) return;

        const cropArea = {
          x: area.x * dpr,
          y: area.y * dpr,
          width: area.width * dpr,
          height: area.height * dpr,
        };

        const croppedDataUrl = await cropImage(dataUrl, cropArea, 1);
        if (croppedDataUrl) {
          if (doOpenEditor) {
            await saveCaptureForEditor(croppedDataUrl, area, dpr, tab);
          } else {
            downloadImage(croppedDataUrl);
          }
        }
      } else {
        const selectionFragments: { dataUrl: string; pageY: number }[] = [];
        const scrollYStart = Math.floor(area.y);
        const scrollYEnd = Math.ceil(area.y + area.height);
        const canvasHeight = Math.ceil((scrollYEnd - scrollYStart) * dpr);
        const viewportWidth = Math.ceil(area.width * dpr);
        const canvasWidth = Math.ceil(viewportWidth + Math.abs(area.x) * dpr);

        await browser.tabs.sendMessage(tab.id, { type: 'HIDE_TOOLBAR' }).catch(() => {});

        for (let y = scrollYStart; y < scrollYEnd; y += viewHeight) {
          await browser.tabs.sendMessage(tab.id, { type: 'SCROLL_TO', data: { x: 0, y: y } });
          await new Promise(r => setTimeout(r, 600));

          const dataUrl = await browser.tabs.captureVisibleTab({ format: 'png' });
          if (!dataUrl) continue;

          const scrollPos = await browser.tabs.sendMessage(tab.id, { type: 'GET_SCROLL_POS' });
          selectionFragments.push({
            dataUrl,
            pageY: scrollPos.y,
          });

          if (scrollPos.y + viewHeight >= scrollYEnd) break;
        }

        await browser.tabs.sendMessage(tab.id, { type: 'SCROLL_TO', data: { x: finalScrollX || 0, y: finalScrollY || 0 } });
        await new Promise(r => setTimeout(r, 300));

        if (selectionFragments.length > 0) {
          const stitchedDataUrl = await stitchFragmentsWithOffset(selectionFragments, canvasWidth, canvasHeight, dpr, area.x);
          if (stitchedDataUrl) {
            const selectionAreaInStitched = {
              x: Math.abs(Math.min(0, area.x)) * dpr,
              y: 0,
              width: area.width * dpr,
              height: area.height * dpr,
            };

            const croppedDataUrl = await cropImage(stitchedDataUrl, selectionAreaInStitched, 1);
            if (croppedDataUrl) {
              if (doOpenEditor) {
                await saveCaptureForEditor(croppedDataUrl, area, dpr, tab);
              } else {
                downloadImage(croppedDataUrl);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Area capture failed:', err);
    }
  }

  async function saveCaptureForEditor(imageDataUrl: string, area: any, dpr: number, tab: any) {
    const capture = {
      id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      image: imageDataUrl,
      url: sanitizeUrl(tab.url),
      title: tab.title || '',
      timestamp: Date.now(),
      type: 'area-select',
    };
    await browser.storage.local.set({ lastCapture: capture });
    await browser.storage.local.set({ annotations: [] });
    await browser.storage.local.set({ editorSettings: null });
    const editorUrl = browser.runtime.getURL('/editor.html');
    await browser.tabs.create({ url: editorUrl });
  }

  async function stitchFragmentsWithOffset(
    fragments: { dataUrl: string; pageY: number }[],
    canvasWidth: number,
    canvasHeight: number,
    dpr: number,
    selectionX: number
  ): Promise<string> {
    if (fragments.length === 0) return '';

    try {
      const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      const firstImg = await loadImage(fragments[0].dataUrl);
      const baseOffsetX = Math.abs(Math.min(0, selectionX)) * dpr;

      for (const fragment of fragments) {
        const img = await loadImage(fragment.dataUrl);
        const offsetY = (fragment.pageY * dpr) - (fragments[0].pageY * dpr);
        ctx.drawImage(img, baseOffsetX, offsetY, img.width, img.height);
      }

      const blob = await canvas.convertToBlob({ type: 'image/png' });
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('Stitch fragments with offset failed', e);
      return '';
    }
  }

  async function loadImage(dataUrl: string): Promise<ImageBitmap> {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    const blob = new Blob([array], { type: mime });
    return createImageBitmap(blob);
  }

  function downloadImage(dataUrl: string) {
    let downloadUrl = dataUrl;
    if (dataUrl.startsWith('data:')) {
      try {
        const [header, base64] = dataUrl.split(',');
        const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
        const binary = atob(base64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        const blob = new Blob([array], { type: mime });
        downloadUrl = URL.createObjectURL(blob);
      } catch (e) {
        console.error('Blob URL conversion failed', e);
      }
    }
    browser.downloads.download({ url: downloadUrl, filename: `screencrafter-crop-${Date.now()}.png` });
  }

  async function cropImage(dataUrl: string, area: any, dpr: number): Promise<string> {
    try {
      let img: HTMLImageElement | ImageBitmap;

      // MV2 (Firefox) / Background Page support
      if (typeof Image !== 'undefined') {
        img = new Image();
        img.src = dataUrl;
        await new Promise((resolve, reject) => {
          (img as HTMLImageElement).onload = resolve;
          (img as HTMLImageElement).onerror = reject;
        });
      } else {
      // MV3 (Chrome) / Service Worker support
      const [header, base64] = dataUrl.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
      const binary = atob(base64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
      const blob = new Blob([array], { type: mime });
      img = await createImageBitmap(blob);
      }

      const sw = Math.round(area.width * dpr);
      const sh = Math.round(area.height * dpr);
      const sx = Math.round(area.x * dpr);
      const sy = Math.round(area.y * dpr);

      // Create canvas (use document.createElement if in a background page for max compatibility)
      let canvas: any;
      if (typeof document !== 'undefined') {
        canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
      } else {
        canvas = new OffscreenCanvas(sw, sh);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      const radius = 8 * dpr;
      ctx.beginPath();
      ctx.moveTo(radius, 0); ctx.lineTo(sw - radius, 0);
      ctx.quadraticCurveTo(sw, 0, sw, radius);
      ctx.lineTo(sw, sh - radius);
      ctx.quadraticCurveTo(sw, sh, sw - radius, sh);
      ctx.lineTo(radius, sh);
      ctx.quadraticCurveTo(0, sh, 0, sh - radius);
      ctx.lineTo(0, radius); ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      // Handle blob conversion
      let croppedBlob: Blob;
      if (canvas.convertToBlob) {
        croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
      } else {
        // Fallback for regular canvas
        const data = canvas.toDataURL('image/png');
        return data;
      }

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(croppedBlob);
      });
    } catch (e) {
      console.error('Background crop failed', e);
      return '';
    }
  }
});