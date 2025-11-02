WaiaSella POS (static prototype)

Overview

- Single‑page web app that runs with no build steps.
- Implements Sales + Cart, Inventory, Reports, and Reorder views.
- Data persists to `localStorage`.

Run

- Open `index.html` in a browser (double‑click or use a live server).
- Optional: host via a simple server (Python): `python -m http.server 8000` and visit `http://localhost:8000`.

Notes

- Tax is currently set to 0.0 in `app.js` (`TAX_RATE`). Adjust as needed.
- Low‑stock threshold is controlled by `LOW_STOCK_THRESHOLD` in `app.js`.
- Seed inventory is written on first load. To reset, clear browser localStorage for this folder/app.
- Images use `picsum.photos` placeholders; replace with your own URLs via Inventory > edit item.

