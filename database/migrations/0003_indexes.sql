-- StockLens — indeks performa untuk pola query utama.

--> statement-breakpoint

-- Ticker unik secara case-insensitive + indeks pencarian.
CREATE UNIQUE INDEX companies_ticker_lower_unique ON companies (lower(ticker));
CREATE INDEX companies_ticker_idx ON companies (ticker);
CREATE INDEX companies_name_idx ON companies (lower(name));
CREATE INDEX companies_sector_idx ON companies (sector);
CREATE INDEX companies_exchange_idx ON companies (exchange);

--> statement-breakpoint

CREATE INDEX import_batches_user_recent_idx ON import_batches (user_id, created_at DESC);

--> statement-breakpoint

CREATE INDEX watchlist_items_company_idx ON watchlist_items (company_id);

--> statement-breakpoint

CREATE INDEX portfolio_transactions_portfolio_date_idx
  ON portfolio_transactions (portfolio_id, transaction_date);
CREATE INDEX portfolio_transactions_company_idx ON portfolio_transactions (company_id);

--> statement-breakpoint

CREATE INDEX valuation_scenarios_user_recent_idx ON valuation_scenarios (user_id, updated_at DESC);

--> statement-breakpoint

CREATE INDEX saved_screens_user_recent_idx ON saved_screens (user_id, created_at DESC);

--> statement-breakpoint

CREATE INDEX research_notes_user_recent_idx ON research_notes (user_id, updated_at DESC);
