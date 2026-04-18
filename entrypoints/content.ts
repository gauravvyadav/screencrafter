export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const isFromExtension = sender.id === browser.runtime.id;
      const isFromTab = sender.tab?.id;
      if (!isFromExtension && !isFromTab) return;
      if (message.type === 'PREPARE_FULL_PAGE') {
        preparePage().then(sendResponse);
        return true;
      }
      if (message.type === 'START_AREA_SELECTION') {
        startSelection(sendResponse);
        return true;
      }
      if (message.type === 'GET_VIEWPORT') {
        sendResponse({ width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio });
        return true;
      }
      if (message.type === 'SCROLL_TO') {
        window.scrollTo(message.data.x, message.data.y);
        setTimeout(() => sendResponse(true), 150);
        return true;
      }
      if (message.type === 'GET_SCROLL_POS') {
        sendResponse({ x: window.scrollX, y: window.scrollY });
        return true;
      }
      if (message.type === 'HIDE_FIXED_ELEMENTS') {
        hideFixedElements();
        sendResponse(true);
        return true;
      }
      if (message.type === 'RESTORE_FIXED_ELEMENTS') {
        restoreFixedElements();
        sendResponse(true);
        return true;
      }
      if (message.type === 'SHOW_ALERT') {
        alert(message.data.message);
        sendResponse(true);
        return true;
      }
    });

    let hiddenElements: { el: HTMLElement, originalOpacity: string }[] = [];
    
    function hideFixedElements() {
      const elements = document.querySelectorAll('*');
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || (style.position === 'sticky' && el.getBoundingClientRect().top <= 50)) {
           if (style.opacity !== '0' && style.display !== 'none') {
               hiddenElements.push({ el, originalOpacity: el.style.opacity });
               el.style.setProperty('opacity', '0', 'important');
           }
        }
      }
    }
    
    function restoreFixedElements() {
       hiddenElements.forEach(({ el, originalOpacity }) => {
          el.style.opacity = originalOpacity;
       });
       hiddenElements.length = 0;
    }

    // Forces lazy-loaded content (like footers and images) to appear
    async function preparePage() {
      const originalScroll = window.scrollY;
      
      // 1. Jump to bottom
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise(r => setTimeout(r, 1000));
      
      // 2. Jump back to top
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 500));
      
      // 3. Return final dimensions
      return {
        width: Math.max(document.documentElement.offsetWidth, document.documentElement.scrollWidth),
        height: Math.max(document.documentElement.offsetHeight, document.documentElement.scrollHeight),
        dpr: window.devicePixelRatio
      };
    }

    function startSelection(callback: (res: any) => void) {
      const overlay = document.createElement('div');
      overlay.id = 'screencrafter-selection-overlay';
      overlay.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(0,0,0,0.4) !important;
        z-index: 2147483647 !important;
        cursor: crosshair !important;
        pointer-events: auto !important;
        user-select: none !important;
      `;
      
      const selection = document.createElement('div');
      selection.style.cssText = `
        position: fixed !important;
        border: 2px solid #3b82f6 !important;
        background: rgba(59,130,246,0.1) !important;
        display: none !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        border-radius: 8px !important;
      `;
      
      (document.documentElement || document.body).appendChild(overlay);
      (document.documentElement || document.body).appendChild(selection);

      let startX = 0, startY = 0, isSelecting = false;

      const cleanup = () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (selection.parentNode) selection.parentNode.removeChild(selection);
        window.removeEventListener('mousedown', onMouseDown, true);
        window.removeEventListener('mousemove', onMouseMove, true);
        window.removeEventListener('mouseup', onMouseUp, true);
        window.removeEventListener('keydown', onKeyDown, true);
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cleanup();
          callback(null);
        }
      };

      const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return;
        isSelecting = true;
        startX = e.clientX; startY = e.clientY;
        selection.style.display = 'block';
        selection.style.left = startX + 'px'; selection.style.top = startY + 'px';
        selection.style.width = '0px'; selection.style.height = '0px';
        e.preventDefault();
        e.stopPropagation();
      };
      const onMouseMove = (e: MouseEvent) => {
        if (!isSelecting) return;
        const currentX = e.clientX; const currentY = e.clientY;
        const width = Math.abs(currentX - startX); const height = Math.abs(currentY - startY);
        selection.style.width = width + 'px'; selection.style.height = height + 'px';
        selection.style.left = Math.min(currentX, startX) + 'px'; selection.style.top = Math.min(currentY, startY) + 'px';
      };
      const onMouseUp = async () => {
        if (!isSelecting) return;
        isSelecting = false;
        const rect = selection.getBoundingClientRect();
        const dpr = window.devicePixelRatio;
        cleanup();
        
        // Give the browser time to repaint without the overlay
        await new Promise(r => setTimeout(r, 150));
        
        if (rect.width > 5 && rect.height > 5) {
          callback({ 
            area: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
            dpr: dpr 
          });
        } else callback(null);
      };

      window.addEventListener('mousedown', onMouseDown, true);
      window.addEventListener('mousemove', onMouseMove, true);
      window.addEventListener('mouseup', onMouseUp, true);
      window.addEventListener('keydown', onKeyDown, true);
    }
  },
});
