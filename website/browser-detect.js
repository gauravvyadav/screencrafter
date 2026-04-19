const CONFIG_URL = '/config.json';

async function initBrowserDetection() {
  try {
    const response = await fetch(CONFIG_URL);
    const config = await response.json();
    
    const userAgent = navigator.userAgent;
    let browser = 'chrome'; // default to chrome for chromium-based
    let browserName = 'Chrome';
    
    if (userAgent.indexOf("Firefox") > -1) {
      browser = 'firefox';
      browserName = 'Firefox';
    } else if (userAgent.indexOf("Edg") > -1) {
      browser = 'edge';
      browserName = 'Edge';
    } else if (userAgent.indexOf("Brave") > -1) {
      browser = 'brave';
      browserName = 'Brave';
    } else if (userAgent.indexOf("Chrome") > -1) {
      browser = 'chrome';
      browserName = 'Chrome';
    } else {
      browser = 'chromium';
      browserName = 'Chromium';
    }
    
    // Store URL: if specifically defined use it, else use chrome for chromium-based, else default
    const storeUrl = config[browser] || config['chrome'] || config['default'];
    
    // Update all elements with data-browser-link
    document.querySelectorAll('[data-browser-link]').forEach(el => {
      el.href = storeUrl;
    });
    
    // Update all elements with data-browser-name
    document.querySelectorAll('[data-browser-name]').forEach(el => {
      el.textContent = browserName;
    });

    // Update browser-specific icons if they exist
    // Path: /assets/browsers/chrome.png, etc.
    document.querySelectorAll('[data-browser-icon]').forEach(img => {
      img.src = `/assets/browsers/${browser}.png`;
      img.alt = `${browserName} Icon`;
    });

    console.log(`Detected browser: ${browserName}, using store: ${storeUrl}`);
  } catch (error) {
    console.error('Browser detection failed:', error);
  }
}

document.addEventListener('DOMContentLoaded', initBrowserDetection);
