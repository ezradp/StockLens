-- StockLens — trigger updated_at untuk tabel yang memilikinya.

--> statement-breakpoint

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

--> statement-breakpoint

CREATE TRIGGER companies_set_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

--> statement-breakpoint

CREATE TRIGGER valuation_scenarios_set_updated_at
  BEFORE UPDATE ON valuation_scenarios
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

--> statement-breakpoint

CREATE TRIGGER research_notes_set_updated_at
  BEFORE UPDATE ON research_notes
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
