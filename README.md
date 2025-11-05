WaiaSella POS 2.0 (Vite + TypeScript)

Overview

- Single‑page app built with Vite + TypeScript.
- Implements Sales + Cart, Inventory, Reports, and Reorder views.
- Data persists to `localStorage` (inventory + transactions locally).
- Sales automatically saved to Supabase `sales` table when configured.
- Optional Nano Banana integration enhances uploaded inventory images for clean, high-res product photos.

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

Nano Banana Image Enhancement (Optional)
--------------------------------------

- Add Nano Banana credentials to `.env` to auto-clean product photos when adding or updating inventory items:
  - `VITE_NANO_BANANA_API_KEY`
  - (Optional) `VITE_NANO_BANANA_API_URL`
  - (Optional) `VITE_NANO_BANANA_MODEL_ID`
- When configured, uploaded or captured images are sent to Nano Banana, and the enhanced photo is saved back to the item automatically.

Notes

- Tax is set to 16% VAT in `src/main.ts` (`TAX_RATE`). Adjust as needed.
- Low‑stock threshold is controlled by `LOW_STOCK_THRESHOLD` in `src/main.ts`.
- Seed inventory is written on first load. To reset, clear browser localStorage for this folder/app.
- Images use `picsum.photos` placeholders; replace with your own URLs via Inventory > edit item.
- App works without Supabase (fallback to localStorage only).

Deployment (GitHub Pages)

- GitHub Action builds with Node 20 and deploys `dist/` automatically on pushes to `main`.
- Vite `base` is set to `./` in `vite.config.ts` to work under a repo subpath.
