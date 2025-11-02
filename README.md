WaiaSella POS 2.0 (Vite + TypeScript)

Overview

- Single‑page app built with Vite + TypeScript.
- Implements Sales + Cart, Inventory, Reports, and Reorder views.
- Data persists to `localStorage`.

Run

- Dev server: `npm install` then `npm run dev`.
- Build: `npm run build` (outputs to `dist/`).
- Preview built app locally: `npm run preview`.

Notes

- Tax is currently set to 0.0 in `src/main.ts` (`TAX_RATE`). Adjust as needed.
- Low‑stock threshold is controlled by `LOW_STOCK_THRESHOLD` in `src/main.ts`.
- Seed inventory is written on first load. To reset, clear browser localStorage for this folder/app.
- Images use `picsum.photos` placeholders; replace with your own URLs via Inventory > edit item.

Deployment (GitHub Pages)

- GitHub Action builds with Node 20 and deploys `dist/` automatically on pushes to `main`.
- Vite `base` is set to `./` in `vite.config.ts` to work under a repo subpath.
