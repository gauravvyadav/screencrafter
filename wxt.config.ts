import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    version: '0.1.0',
    permissions: ['activeTab', 'tabs', 'storage', 'unlimitedStorage', 'downloads', 'scripting'],
    name: 'Full Page Screenshot Tool – Fast & Clean | Screencrafter',
    description: 'Full Page Screenshot Tool – Fast & Clean | Screencrafter. Capture, annotate, and save full page screenshots with ease.',
    action: {
      default_icon: {
        16: '/icon/16.png',
        32: '/icon/32.png',
        48: '/icon/48.png',
        128: '/icon/128.png',
      },
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline';",
    },
    browser_specific_settings: {
      gecko: {
        id: 'screencrafter@gauravvyadav',
        strict_min_version: '109.0',
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  },
  suppressWarnings: {
    firefoxDataCollection: true,
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
