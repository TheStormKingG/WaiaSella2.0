WaiaSella POS 2.0 (Vite + TypeScript)

Overview

- Single‑page app built with Vite + TypeScript.
- Implements Sales + Cart, Inventory, Reports, and Reorder views.
- Data persists to `localStorage` (inventory + transactions locally).
- Sales automatically saved to Supabase `sales` table when configured.

Run

- Dev server: `npm install` then `npm run dev`.
- Build: `npm run build` (outputs to `dist/`).
- Preview built app locally: `npm run preview`.

Setup

1. Copy `env.example.txt` to `.env`
2. Add Supabase credentials:
   - `VITE_SUPABASE_URL`: `https://hutsgbcqxmizbcvqpmfq.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: Get from Supabase Dashboard > Settings > API
3. Create `sales` table in Supabase:
   - `transaction_id` (text, primary key)
   - `date` (timestamp)
   - `items` (jsonb)
   - `subtotal` (numeric)
   - `tax` (numeric)
   - `total` (numeric)
   - `profit` (numeric)

SQL to create the table:
```sql
CREATE TABLE sales (
  transaction_id TEXT PRIMARY KEY,
  date TIMESTAMP NOT NULL,
  items JSONB NOT NULL,
  subtotal NUMERIC NOT NULL,
  tax NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  profit NUMERIC NOT NULL
);

-- Enable RLS if needed
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (adjust as needed)
CREATE POLICY "Allow public inserts" ON sales
  FOR INSERT WITH CHECK (true);
```

Notes

- Tax is set to 16% VAT in `src/main.ts` (`TAX_RATE`). Adjust as needed.
- Low‑stock threshold is controlled by `LOW_STOCK_THRESHOLD` in `src/main.ts`.
- Seed inventory is written on first load. To reset, clear browser localStorage for this folder/app.
- Images use `picsum.photos` placeholders; replace with your own URLs via Inventory > edit item.
- App works without Supabase (fallback to localStorage only).

Deployment (GitHub Pages)

- GitHub Action builds with Node 20 and deploys `dist/` automatically on pushes to `main`.
- Vite `base` is set to `./` in `vite.config.ts` to work under a repo subpath.
