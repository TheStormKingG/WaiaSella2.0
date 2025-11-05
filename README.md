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
2. Add your Supabase credentials to `.env`:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key (get from Dashboard > Settings > API)
3. Create `sales` table in Supabase (see SQL below)
4. (Optional) Enable Nano Banana product image enhancement by setting the following in `.env`:
   - `VITE_NANO_BANANA_API_URL`
   - `VITE_NANO_BANANA_API_KEY`
   - `VITE_NANO_BANANA_MODEL`

SQL to create the table:
```sql
CREATE TABLE sales (
  date TIMESTAMP PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  item_price NUMERIC NOT NULL,
  item_cost NUMERIC NOT NULL,
  item_subtotal NUMERIC NOT NULL,
  item_profit NUMERIC NOT NULL,
  transaction_subtotal NUMERIC NOT NULL,
  transaction_tax NUMERIC NOT NULL,
  transaction_total NUMERIC NOT NULL,
  transaction_profit NUMERIC NOT NULL
);

-- Create index for efficient transaction lookups
CREATE INDEX idx_transaction_id ON sales(transaction_id);

-- Enable RLS if needed
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (adjust as needed)
CREATE POLICY "Allow public inserts" ON sales
  FOR INSERT WITH CHECK (true);
```

Note: Each item in a sale creates a separate row with the same `transaction_id`. Unique `date` timestamps are generated per item (millisecond precision).

Notes

- Tax is set to 16% VAT in `src/main.ts` (`TAX_RATE`). Adjust as needed.
- Low‑stock threshold is controlled by `LOW_STOCK_THRESHOLD` in `src/main.ts`.
- Seed inventory is written on first load. To reset, clear browser localStorage for this folder/app.
- Images use `picsum.photos` placeholders; replace with your own URLs via Inventory > edit item.
- App works without Supabase (fallback to localStorage only).
- When Nano Banana is configured, new product images captured/uploaded during item creation are automatically enhanced and upscaled before being saved.

Deployment (GitHub Pages)

- GitHub Action builds with Node 20 and deploys `dist/` automatically on pushes to `main`.
- Vite `base` is set to `./` in `vite.config.ts` to work under a repo subpath.
