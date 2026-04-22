export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const isFromExtension = sender.id === browser.runtime.id;
      const isFromTab = sender.tab?.id;
      if (!isFromExtension && !isFromTab) return;
      if (message.type === 'PING') {
        sendResponse('PONG');
        return;
      }
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
      if (message.type === 'CAPTURE_PROGRESS') {
        sendResponse(true);
        return true;
      }
      if (message.type === 'HIDE_TOOLBAR') {
        hideToolbar();
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
      ['sf-overlay','sf-selection','sf-toolbar'].forEach(id => {
        document.querySelectorAll(`[id^="${id}"]`).forEach(el => el.remove());
      });
      document.querySelectorAll('[class^="sf-handle"]').forEach(el => el.remove());

      const overlay = document.createElement('div');
      overlay.id = 'sf-overlay';
      overlay.style.cssText = `
        position:fixed!important;top:0!important;left:0!important;
        width:100vw!important;height:100vh!important;
        background:transparent!important;z-index:2147483640!important;
        cursor:crosshair!important;pointer-events:auto!important;
      `;

      const selection = document.createElement('div');
      selection.id = 'sf-selection';
      selection.style.cssText = `
        position:fixed!important;border:2px dashed #3b82f6!important;
        background:transparent!important;
        display:none!important;z-index:2147483645!important;
        pointer-events:none!important;
      `;

      const handleStyle = `
        position:fixed!important;width:8px!important;height:8px!important;
        background:#fff!important;border:2px solid #3b82f6!important;
        border-radius:2px!important;z-index:2147483646!important;
        pointer-events:auto!important;display:none!important;
        box-sizing:border-box!important;
      `;
      const handles: HTMLElement[] = [];
      const handlePositions = [
        'nw','n','ne','e','se','s','sw','w'
      ];
      handlePositions.forEach(pos => {
        const h = document.createElement('div');
        h.className = `sf-handle sf-handle-${pos}`;
        h.style.cssText = handleStyle;
        handles.push(h);
      });

      const toolbar = document.createElement('div');
      toolbar.id = 'sf-toolbar';
      toolbar.style.cssText = `
        position:fixed!important;display:none!important;
        z-index:2147483647!important;pointer-events:auto!important;
        background:#1e293b!important;border-radius:10px!important;
        box-shadow:0 8px 32px rgba(0,0,0,0.4)!important;
        font-family:system-ui,-apple-system,sans-serif!important;
        font-size:13px!important;user-select:none!important;
        overflow:hidden!important;
      `;
      toolbar.innerHTML = `
        <div class="sf-grip" style="
          position:relative!important;height:32px!important;
          cursor:grab!important;display:flex!important;
          align-items:center!important;justify-content:space-between!important;
          padding:0 12px!important;
          background:#334155!important;
        ">
          <span style="font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:0.5px;">SELECT AREA</span>
          <button id="sf-close" style="
            width:24px!important;height:24px!important;
            background:transparent!important;border:none!important;
            cursor:pointer!important;display:flex!important;
            align-items:center!important;justify-content:center!important;
            padding:0!important;color:#64748b!important;
            border-radius:4px!important;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div style="padding:12px!important;display:flex!important;flex-direction:column!important;gap:8px!important;">
          <button id="sf-download" style="
            display:flex!important;align-items:center!important;
            justify-content:center!important;gap:8px!important;
            padding:10px 16px!important;background:#22c55e!important;
            color:#fff!important;border:none!important;border-radius:8px!important;
            cursor:pointer!important;font-weight:600!important;font-size:13px!important;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </button>
          <button id="sf-edit" style="
            display:flex!important;align-items:center!important;
            justify-content:center!important;gap:8px!important;
            padding:10px 16px!important;background:#3b82f6!important;
            color:#fff!important;border:none!important;border-radius:8px!important;
            cursor:pointer!important;font-weight:600!important;font-size:13px!important;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
        </div>
      `;

      const container = document.body || document.documentElement;
      container.appendChild(overlay);
      container.appendChild(selection);
      handles.forEach(h => container.appendChild(h));
container.appendChild(toolbar);

      let bounds = { x: 0, y: 0, width: 0, height: 0 };
      let isDrawing = false;
      let isMovingSelection = false;
      let drawStartX = 0, drawStartY = 0;
      let activeHandle: string | null = null;
      let dragStartMouseX = 0, dragStartMouseY = 0;
      let dragStartBounds = { x: 0, y: 0, width: 0, height: 0 };
      let toolbarDragging = false;
      let toolbarDragStartX = 0, toolbarDragStartY = 0;
      let toolbarOffsetX = 0, toolbarOffsetY = 0;
      const SCROLL_THRESHOLD = 30;
      const SCROLL_SPEED = 15;
      const HANDLE_SIZE = 8;

      function getPageX(clientX: number) { return clientX + window.scrollX; }
      function getPageY(clientY: number) { return clientY + window.scrollY; }
      function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

      function updateSelection() {
        const vpX = bounds.x - window.scrollX;
        const vpY = bounds.y - window.scrollY;
        selection.style.left = vpX + 'px';
        selection.style.top = vpY + 'px';
        selection.style.width = bounds.width + 'px';
        selection.style.height = bounds.height + 'px';
        selection.style.boxShadow = '0 0 0 9999px rgba(0,0,0,0.5)';

        handles.forEach(h => {
          const pos = h.className.replace('sf-handle sf-handle-', '');
          let hx = vpX, hy = vpY;
          if (pos.includes('e')) hx = vpX + bounds.width - HANDLE_SIZE / 2;
          else if (pos === 'n' || pos === 's') hx = vpX + bounds.width / 2 - HANDLE_SIZE / 2;
          else if (pos === 'ne' || pos === 'se') hx = vpX + bounds.width - HANDLE_SIZE / 2;
          else hx = vpX - HANDLE_SIZE / 2;
          if (pos.includes('s')) hy = vpY + bounds.height - HANDLE_SIZE / 2;
          else if (pos === 'e' || pos === 'w') hy = vpY + bounds.height / 2 - HANDLE_SIZE / 2;
          else hy = vpY - HANDLE_SIZE / 2;
          h.style.left = hx + 'px';
          h.style.top = hy + 'px';
        });

        const tbX = vpX + bounds.width - 110 + toolbarOffsetX;
        const tbY = vpY + 12 + toolbarOffsetY;
        toolbar.style.left = tbX + 'px';
        toolbar.style.top = tbY + 'px';
        toolbar.style.transform = 'translateX(-50%)';
      }

      function showHandles() {
        handles.forEach(h => h.style.display = 'block');
      }

      function hideHandles() {
        handles.forEach(h => h.style.display = 'none');
      }

      function showToolbar() {
        toolbar.style.display = 'block';
        setTimeout(() => {
          const grip = toolbar.querySelector('.sf-grip') as HTMLElement;
          if (grip) grip.style.cursor = 'grab';
        }, 0);
      }

      function hideToolbar() {
        toolbar.style.display = 'none';
      }

      function hideOverlay() {
        overlay.style.display = 'none';
      }

      function showOverlay() {
        overlay.style.display = 'block';
      }

      function doDownload() {
        const scrollData = { ...bounds };
        bounds = { x: 0, y: 0, width: 0, height: 0 };
        hideOverlay();
        hideHandles();
        hideToolbar();
        selection.style.display = 'none';
        callback({
          area: scrollData,
          dpr: window.devicePixelRatio,
          finalScrollX: window.scrollX,
          finalScrollY: window.scrollY,
          action: 'download',
        });
      }

      function doEdit() {
        const scrollData = { ...bounds };
        bounds = { x: 0, y: 0, width: 0, height: 0 };
        hideOverlay();
        hideHandles();
        hideToolbar();
        selection.style.display = 'none';
        callback({
          area: scrollData,
          dpr: window.devicePixelRatio,
          finalScrollX: window.scrollX,
          finalScrollY: window.scrollY,
          action: 'edit',
        });
      }

      function doCancel() {
        selection.style.display = 'none';
        hideHandles();
        hideToolbar();
        overlay.remove();
        selection.remove();
        handles.forEach(h => h.remove());
        toolbar.remove();
        callback(null);
      }

      let scrollInterval: number | null = null;
      let scrollDirX = 0, scrollDirY = 0;

      function startScroll(dirX: number, dirY: number) {
        if (scrollInterval) return;
        scrollDirX = dirX; scrollDirY = dirY;
        scrollInterval = window.setInterval(() => {
          const maxX = document.documentElement.scrollWidth - window.innerWidth;
          const maxY = document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo(
            clamp(window.scrollX + scrollDirX * SCROLL_SPEED, 0, maxX),
            clamp(window.scrollY + scrollDirY * SCROLL_SPEED, 0, maxY)
          );
          updateSelection();
          updateStartMarker();
        }, 30);
      }

      function stopScroll() {
        if (scrollInterval) { clearInterval(scrollInterval); scrollInterval = null; }
      }

      function detectEdgeScroll(mx: number, my: number) {
        let dx = 0, dy = 0;
        if (mx <= SCROLL_THRESHOLD) dx = -1;
        else if (mx >= window.innerWidth - SCROLL_THRESHOLD) dx = 1;
        if (my <= SCROLL_THRESHOLD) dy = -1;
        else if (my >= window.innerHeight - SCROLL_THRESHOLD) dy = 1;
        if (dx || dy) startScroll(dx, dy);
        else stopScroll();
      }

      overlay.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        const mx = e.clientX - window.scrollX;
        const my = e.clientY - window.scrollY;
        const inSel = bounds.width > 5 &&
                     mx >= bounds.x && mx <= bounds.x + bounds.width &&
                     my >= bounds.y && my <= bounds.y + bounds.height;
        if (inSel) {
          isMovingSelection = true;
          dragStartMouseX = e.clientX;
          dragStartMouseY = e.clientY;
          dragStartBounds = { ...bounds };
          return;
        }
        if (bounds.width > 5) return;
        isDrawing = true;
        drawStartX = getPageX(e.clientX);
        drawStartY = getPageY(e.clientY);
        bounds = { x: drawStartX, y: drawStartY, width: 0, height: 0 };
        selection.style.display = 'block';
        hideHandles();
        hideToolbar();
        e.preventDefault();
      }, true);

      handles.forEach(h => {
        h.addEventListener('mousedown', (e: MouseEvent) => {
          e.stopPropagation();
          activeHandle = h.className.replace('sf-handle sf-handle-', '');
          dragStartMouseX = e.clientX;
          dragStartMouseY = e.clientY;
          dragStartBounds = { ...bounds };
        }, true);
      });

      toolbar.querySelector('#sf-download')?.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        stopScroll();
        doDownload();
      });

      toolbar.querySelector('#sf-edit')?.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        stopScroll();
        doEdit();
      });

      toolbar.querySelector('#sf-close')?.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        doCancel();
      });

      const grip = toolbar.querySelector('.sf-grip') as HTMLElement;
      if (grip) {
        grip.addEventListener('mousedown', (e: MouseEvent) => {
          e.stopPropagation();
          toolbarDragging = true;
          toolbarDragStartX = e.clientX - toolbarOffsetX;
          toolbarDragStartY = e.clientY - toolbarOffsetY;
          grip.style.cursor = 'grabbing';
        }, true);
      }

      window.addEventListener('mousemove', (e: MouseEvent) => {
        if (isDrawing) {
          const ex = getPageX(e.clientX);
          const ey = getPageY(e.clientY);
          bounds.x = Math.min(drawStartX, ex);
          bounds.y = Math.min(drawStartY, ey);
          bounds.width = Math.abs(ex - drawStartX);
          bounds.height = Math.abs(ey - drawStartY);
          detectEdgeScroll(e.clientX, e.clientY);
          updateSelection();
        } else if (isMovingSelection) {
          const dx = e.clientX - dragStartMouseX;
          const dy = e.clientY - dragStartMouseY;
          bounds.x = dragStartBounds.x + dx;
          bounds.y = dragStartBounds.y + dy;
          updateSelection();
        } else if (activeHandle) {
          const dx = e.clientX - dragStartMouseX;
          const dy = e.clientY - dragStartMouseY;
          const nb = { ...dragStartBounds };
          if (activeHandle.includes('w')) { nb.x += dx; nb.width -= dx; }
          if (activeHandle.includes('e')) nb.width += dx;
          if (activeHandle.includes('n')) { nb.y += dy; nb.height -= dy; }
          if (activeHandle.includes('s')) nb.height += dy;
          if (nb.width < 10 || nb.height < 10) return;
          bounds = nb;
          updateSelection();
        } else if (toolbarDragging) {
          toolbarOffsetX = e.clientX - toolbarDragStartX;
          toolbarOffsetY = e.clientY - toolbarDragStartY;
          updateSelection();
        } else {
          const mx = e.clientX - window.scrollX;
          const my = e.clientY - window.scrollY;
          const inSel = mx >= bounds.x && mx <= bounds.x + bounds.width &&
                     my >= bounds.y && my <= bounds.y + bounds.height;
          if (inSel && bounds.width > 5) {
            selection.style.cursor = 'move';
            showHandles();
            showToolbar();
          } else {
            selection.style.cursor = 'default';
          }
        }
      }, true);

      window.addEventListener('scroll', () => {
        updateSelection();
        updateStartMarker();
      }, { passive: true });

      window.addEventListener('mouseup', (e: MouseEvent) => {
        stopScroll();
        if (isDrawing) {
          isDrawing = false;
          if (bounds.width > 5 && bounds.height > 5) {
            showOverlay();
            hideHandles();
            showToolbar();
            updateSelection();
          } else {
            selection.style.display = 'none';
            hideToolbar();
          }
        }
        activeHandle = null;
        isMovingSelection = false;
        toolbarDragging = false;
        if (grip) grip.style.cursor = 'grab';
      }, true);

      window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          stopScroll();
          doCancel();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          stopScroll();
          doCapture();
        }
      }, true);

selection.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        isMovingSelection = true;
        dragStartMouseX = e.clientX;
        dragStartMouseY = e.clientY;
        dragStartBounds = { ...bounds };
      }, true);
    }
  },
});
