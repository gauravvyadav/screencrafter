<p align="center">
  <img src="public/screencrafter.svg" width="64" height="64" alt="Screencrafter Logo" />
</p>

<h1 align="center">Screencrafter</h1>

<p align="center">
  <strong>Full Page Screenshot Tool – Fast & Clean</strong><br>
  Capture, annotate, and export high-quality screenshots with a professional-grade editor.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-0.2.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/Built_with-WXT-6366f1.svg" alt="WXT">
  <img src="https://img.shields.io/badge/Security-Hardened-green.svg" alt="Security">
  <img src="https://img.shields.io/badge/License-MIT-gray.svg" alt="License">
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/screencrafter-full-page-s/enmnnnddninomcgmojejldmbdhijdmnl" style="text-decoration: none;">
    <img src="assets/chrome-webstore.png" height="40" alt="Chrome Web Store" />
  </a>
  &nbsp;
  <a href="https://microsoftedge.microsoft.com/addons/detail/screencrafter-full-page/meiomcoilmakdienfncongkkoidmffag" style="text-decoration: none;">
    <img src="assets/English_Get it from Microsoft Edge.png" height="40" alt="Edge Addons" />
  </a>
  &nbsp;
  <a href="https://addons.mozilla.org/en-US/firefox/addon/screencrafter-screenshot-tool/" style="text-decoration: none;">
    <img src="assets/get-the-addon-firefox.webp" height="40" alt="Firefox Addons" />
  </a>
</p>

<p align="center">
  🌐 <b>Web:</b> <a href="https://screencrafter.gauravlabs.com/">https://screencrafter.gauravlabs.com</a>
</p>

---

## ✨ Features

### 📸 Smart Capture

- **Full Page Screenshot**: Intelligently scrolls and stitches even the longest pages without fragmenting.
- **Visible Area**: Instant capture of your current viewport.
- **Select Area**: Quick precision cropping for specific elements.

### 🎨 Professional Editor

- **Annotation Tools**: Draw arrows, rectangles, text, and apply blurs (redaction).
- **Beautiful Frames**: Toggle between "Chrome-style" browser frames or simple rounded layouts.
- **Dynamic Backgrounds**: Add stunning gradients or solid colors behind your captures.
- **Canvas Control**: Adjust padding, rounding, and shadows for a premium social-media-ready look.

### 📂 Screenshot Gallery

- **Persistent History**: Automatically saves your captures to local storage.
- **Advanced Dashboard**: Search, sort, and manage your collection with grid and list views.
- **Multi-Format Export**: Save your final designs as high-resolution PNGs or multi-page PDFs.

---

## 🔒 Security & Privacy

Screencrafter is built with a **Privacy-First** mindset:

- **URL Sanitization**: We only store the origin of the website (e.g., `https://google.com`) to prevent leaking sensitive session tokens or private URLs in your history.
- **Zero Tracking**: Your data never leaves your browser. All processing and storage happen locally.
- **Content Security Policy (CSP)**: Hardened manifest configuration to prevent unauthorized script execution and ensure a safe environment.
- **Validated Messaging**: Internal extension communication is strictly validated to prevent cross-scripting vulnerabilities.

---

## 🛠 Tech Stack

- **Framework**: [WXT](https://wxt.dev/) (Web Extension Toolbox)
- **UI Logic**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Processing**: `html-to-image` & `jsPDF`
- **Animations**: `Framer Motion`

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- `npm` (Node Package Manager)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/gauravvyadav/screencrafter.git
   cd screencrafter
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```
   _This will open a browser window with the extension automatically loaded._

### Building for Production

```bash
# Build for Chrome
npm run build

# Build for Firefox
npm run build:firefox
```

The production-ready extension will be located in `.output/`.

---

## 🤝 Contributing

This is an **Open Source** project and we welcome contributions! Whether it's a bug fix, new feature, or documentation improvement:

1. Fork the repo.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">Made with ❤️ for the web community</p>
