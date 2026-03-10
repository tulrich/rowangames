# Rowan Games AI Agent Guidelines

This document outlines the architecture, tooling, and development workflow for creating games in the `rowangames` repository. All AI assistants working in this repository should adhere strictly to these guidelines.

## 🎯 Architecture & Goals
- **Self-Contained Games**: Each game must reside in its own dedicated subdirectory (e.g., `rowangames/my-awesome-game/`).
- **Single-File Output**: The production build of a game *must* compile down to a true single-file `index.html`. This means all JavaScript logic, CSS styling, and media assets (images, sounds) must be inlined (e.g., as base64 data URIs or inline scripts/styles).
- **Zero-Friction Playability**: The finalized `index.html` should be completely playable by double-clicking it in any standard web browser locally (using `file://` protocol), over a local dev server, and via GitHub Pages.
- **Source Tracking**: Both the source code (`src/`) and the final deployed single-file `index.html` will be checked into source control to allow GitHub Pages to serve them effortlessly.

## 🛠 Tech Stack
- **Language**: Vanilla JavaScript (ES Module syntax allowed in source, bundled for production). Do not use TypeScript unless explicitly instructed.
- **Build Tool / Bundler**: [Vite](https://vitejs.dev/)
- **Single-File Plugin**: `vite-plugin-singlefile` (Forces Vite to inline *all* assets, scripts, and styles into the output HTML).
- **Test Runner**: [Vitest](https://vitest.dev/) (Native Vite integration, fast, minimal config).
- **Canvas / Game Loop**: Pure HTML5 `<canvas>` and `requestAnimationFrame`.

## 📂 Standard Directory Structure
Every new game built in this repository should follow this template:

```text
rowangames/
├── AGENTS.md                       # This global instructions file
└── <game-name>/                    # The specific game's directory
    ├── package.json                # Dependencies: vite, vitest, vite-plugin-singlefile
    ├── vite.config.js              # Configured exactly for single-file builds
    ├── src/                        # All source code!
    │   ├── main.js                 # Entry point, game loop logic
    │   ├── style.css               # Styling 
    │   └── assets/                 # Raw images/sounds (to be inlined)
    ├── index.html                  # Dev template (Vite entry point)
    ├── test/                       # Unit tests
    │   └── game.test.js            # Vitest specs
    └── dist/                       # Build output directory
        └── index.html              # 🚀 THE SINGLE-FILE DEPLOYABLE GAME 🚀
```

*(Note: Depending on GitHub Pages configuration, the compiled `dist/index.html` may need to be mapped to the root of the game folder or a standard `docs/` path. Adjust the Vite `outDir` accordingly based on user preference, but `dist` is standard).*

## ⚙️ Standard Workflow Steps

### 1. Bootstrapping a New Game
For a new game (e.g., `snake`), execute the following commands in the terminal:
```bash
mkdir snake && cd snake
npm init -y
npm install -D vite vitest vite-plugin-singlefile
```

### 2. Configuration (`vite.config.js`)
Create a `vite.config.js` in the game folder to enforce the single-file requirement:
```javascript
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000000, // Very large limit to force inline
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    brotliSize: false,
    rollupOptions: {
      inlineDynamicImports: true,
      output: {
        manualChunks: () => 'everything.js'
      }
    }
  }
});
```

### 3. Writing `package.json` Scripts
Ensure the `package.json` includes the standard workflow commands:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "test": "vitest run"
}
```

### 4. Running the Dev Server
- Use `npm run watch` - Automatically monitor files and rebuild dist/index.html upon any changes.
- Or (perhaps) use `npm run dev`. This spins up a fast local web server that supports hot-module replacement (HMR), making local testing lightning fast.

### 5. Writing Tests
Put game logic into pure functions that can be tested independently of the Canvas/DOM. Keep test files in `test/` or alongside logic files (`logic.test.js`). Run tests using `npm test`.

### 6. Building for Production
Execute `npm run build`. The `vite-plugin-singlefile` will parse `index.html`, grab all referenced assets and JS, format them as base64 or inline `<script>` tags, and spit out one pristine, monolithic `dist/index.html`.

## ⚠️ Important Considerations for Agents
- **Local Asset Restrictions**: Browsers throw CORS errors when loading images/audio from local `file://` URIs via traditional HTTP requests. Because we compile to a **single file with inlined base64 assets**, this avoids local CORS issues entirely!
- **Asset Size Limits**: Since assets are encoded as base64 text, their size increases by ~30%. Do not use massive MP3s or huge PNGs unnecessarily. Prefer synthetic sounds (Web Audio API), pixel art, and procedural generation where possible to keep the HTML file lean.
- **Pure Game Logic Extraction**: Per known repository patterns, extract game logic into pure helper functions. Do not tightly couple core game math directly to `window`, `document`, or specific canvas IDs unless absolutely necessary. This makes unit testing via Vitest much easier.
