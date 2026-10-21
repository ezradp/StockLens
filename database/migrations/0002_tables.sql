-- StockLens — tabel inti (PRD §5) + constraint integritas.
-- Kaidah: UUID primary key, foreign keys eksplisit, CHECK untuk aturan domain,
-- dan UNIQUE untuk mencegah duplikasi data pasar/fondamen.

--> statement-breakpoint

-- Profil milik user (1:1 dengan akun auth; FK ke auth.users akan ditambahkan
-- secara kondisional di akhir file — hanya jika tabel auth.users tersedia).
CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  display_name text NOT NULL DEFAULT '',
  preferred_currency text NOT NULL DEFAULT 'USD',
  theme text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'system')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

-- Master perusahaan — data bersama (bukan milik user individu).
CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  name text NOT NULL,
  exchange text,
  sector text,
  industry text,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

CREATE TABLE import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  data_type text NOT NULL CHECK (data_type IN ('prices', 'fundamentals')),
  rows_imported integer NOT NULL DEFAULT 0 CHECK (rows_imported >= 0),
  rows_rejected integer NOT NULL DEFAULT 0 CHECK (rows_rejected >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

CREATE TABLE market_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  date date NOT NULL,
  open numeric(20, 6) NOT NULL CHECK (open > 0),
  high numeric(20, 6) NOT NULL CHECK (high >= open),
  low numeric(20, 6) NOT NULL CHECK (low > 0 AND low <= open),
  close numeric(20, 6) NOT NULL CHECK (close >= low AND close <= high),
  volume bigint NOT NULL DEFAULT 0 CHECK (volume >= 0),
  source_type text NOT NULL CHECK (source_type IN ('seed', 'import', 'provider', 'manual')),
  source_name text NOT NULL DEFAULT '',
  import_batch_id uuid REFERENCES import_batches (id) ON DELETE SET NULL,
  CONSTRAINT market_prices_import_requires_batch
    CHECK (source_type <> 'import' OR import_batch_id IS NOT NULL),
  UNIQUE (company_id, date)
);

--> statement-breakpoint

CREATE TABLE financial_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  statement_type text NOT NULL CHECK (statement_type IN ('income_statement', 'balance_sheet', 'cash_flow')),
  period_type text NOT NULL CHECK (period_type IN ('annual', 'quarterly', 'ttm')),
  period_end date NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_type text NOT NULL CHECK (source_type IN ('seed', 'import', 'provider', 'manual')),
  source_name text NOT NULL DEFAULT '',
  import_batch_id uuid REFERENCES import_batches (id) ON DELETE SET NULL,
  CONSTRAINT financial_statements_import_requires_batch
    CHECK (source_type <> 'import' OR import_batch_id IS NOT NULL),
  UNIQUE (company_id, statement_type, period_type, period_end)
);

--> statement-breakpoint

CREATE TABLE watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

--> statement-breakpoint

CREATE TABLE watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id uuid NOT NULL REFERENCES watchlists (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (watchlist_id, company_id)
);

--> statement-breakpoint

CREATE TABLE portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  base_currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

--> statement-breakpoint

CREATE TABLE portfolio_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolios (id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies (id) ON DELETE RESTRICT,
  transaction_type text NOT NULL
    CHECK (transaction_type IN ('buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'fee')),
  transaction_date date NOT NULL,
  quantity numeric(24, 8) CHECK (quantity IS NULL OR quantity > 0),
  price numeric(20, 6) CHECK (price IS NULL OR price >= 0),
  amount numeric(20, 6) CHECK (amount IS NULL OR amount >= 0),
  fees numeric(20, 6) NOT NULL DEFAULT 0 CHECK (fees >= 0),
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Buy/sell wajib punya company + quantity + price, dan tidak memakai amount.
  CONSTRAINT pt_trade_shape CHECK (
    transaction_type NOT IN ('buy', 'sell')
    OR (company_id IS NOT NULL AND quantity IS NOT NULL AND price IS NOT NULL)
  ),
  CONSTRAINT pt_no_amount_on_trades CHECK (
    transaction_type NOT IN ('buy', 'sell') OR amount IS NULL
  ),
  -- Deposit/withdrawal murni kas: tanpa company, tanpa quantity/price, wajib amount.
  CONSTRAINT pt_cash_shape CHECK (
    transaction_type NOT IN ('deposit', 'withdrawal')
    OR (company_id IS NULL AND quantity IS NULL AND price IS NULL AND amount IS NOT NULL)
  ),
  -- Dividend/fee wajib amount (company opsional misal untuk catatan pemilik saham).
  CONSTRAINT pt_amount_shape CHECK (
    transaction_type NOT IN ('dividend', 'fee') OR amount IS NOT NULL
  )
);

--> statement-breakpoint

CREATE TABLE valuation_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES companies (id) ON DELETE SET NULL,
  name text NOT NULL,
  assumptions_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  results_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

CREATE TABLE saved_screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  filters_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

CREATE TABLE research_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES companies (id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

-- FK profiles.id → auth.users hanya jika berjalan di Supabase (schema auth ada).
-- Di PostgreSQL lain, tabel user dikelola terpisah memenuhi persyaratan portabilitas.
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey
             FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE';
  END IF;
END;
$$;
