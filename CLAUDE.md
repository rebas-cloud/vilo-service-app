# VILO - Restaurant POS + Reservierungssystem

## Projektstruktur
- **Monorepo-Root**: `/home/user/vilo-app/` (Git-Repo)
- **App-Verzeichnis**: `/home/user/vilo-app/vilo-app/` (Vite + React App)

## Tech-Stack
- React 18.3 + TypeScript 5.6 + Vite 6
- Tailwind CSS 3.4 (eigenes `vilo-*` Design-System, Dark Mode)
- Supabase (PostgreSQL + Realtime Sync)
- OpenAI GPT-4o-mini (optionale Sprachsteuerung)
- shadcn/ui (New York Style) + Tabler Icons

## Wichtige Befehle
```bash
cd vilo-app
npm run dev       # Dev-Server starten
npm run build     # TypeScript Check + Vite Build
npm run lint      # ESLint
npm run preview   # Production-Preview
npm test          # Vitest Tests
```

## Architektur
- **State**: React Context + useReducer (`src/context/AppContext.tsx`)
- **Backend**: Supabase REST + Realtime (`src/utils/supabase.ts`)
- **Offline-Fallback**: localStorage (`src/utils/storage.ts`)
- **Navigation**: State-basiert (AppScreen + SubTab), kein React Router
- **Lazy Loading**: Dashboard, OnboardingWizard, KitchenBarDisplay, ManagerSettings, ReservationList, Timeline, ProblemReservations

## Integrationen
- **Supabase**: Haupt-Backend (`src/utils/supabase.ts`)
- **OpenAI**: Sprachkommando-Parsing (`src/utils/llmParser.ts`)

## Produkt-Inspiration
- **OpenTable**: Reservierungssystem (UI/UX-Referenz fuer Reservierungen, Gaeste-CRM, Warteliste)
- **Orderbird**: POS/Kassensystem (UI/UX-Referenz fuer Tischplan, Bestellungen, Abrechnung)

## Konventionen
- Deutsche UI-Texte (kein i18n-Framework)
- Sprache der Codekommentare: Englisch
- CSS: Tailwind-Utility-Klassen, Custom Tokens mit `vilo-*` Prefix
- Path-Alias: `@/*` -> `./src/*`
- Importe: Named Exports bevorzugt
- Typ-Definitionen: `src/types.ts`

## Datenbank (Supabase)
Tabellen: `restaurants`, `owners`, `restaurant_data`, `shared_state`
Alle JSON-Felder enden mit `_json` Suffix.

## Umgebungsvariablen
Alle VITE_-prefixed. Siehe `.env.example` fuer vollstaendige Liste.
Pflicht: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
Optional: `VITE_OPENAI_API_KEY`, `VITE_OPENTABLE_*`, `VITE_ORDERBIRD_*`

## Modellwahl (Token-Optimierung)
Zu Beginn jedes neuen Tasks schlage das passende Modell vor, falls das aktuell aktive Modell ueberdimensioniert ist. Faustregel:
- **Haiku 4.5** – einfache Q&A, kurze Edits, Lookups, Datei-Reads
- **Sonnet 4.6** – Standard-Entwicklung, Refactoring, mehrstufige Aufgaben
- **Opus 4.7** – komplexe Architektur-Entscheidungen, grosse Refactorings, kritische Planungen

Wenn Opus 4.7 aktiv ist und der Task nicht Opus-wuerdig erscheint, explizit hinweisen (z. B. "Tipp: fuer diesen Task reicht Sonnet/Haiku").

## Subagenten (`.claude/agents/`)
Projekt-spezifische Subagenten fuer wiederkehrende Workflows. Delegiere proaktiv, wenn ein Task zum Aufgabenfeld passt:

**Domain-Spezialisten:**
- `floor-plan-specialist` (Sonnet) – FloorPlan.tsx, Geometrie, SVG, Tisch-Hooks
- `reservations-specialist` (Sonnet) – Reservierungen, Waitlist, Gaeste, Timeline
- `pos-specialist` (Sonnet) – Tische, Billing, KDS/BDS, money-critical
- `supabase-data` (Sonnet) – Supabase-Schema, Realtime, Offline-Fallback
- `voice-intent` (Sonnet) – Mic → Intent → Action Pipeline

**Cross-Cutting:**
- `ui-refactor` (Sonnet) – Components >300 Zeilen zerlegen (Hooks + Sub-Components)
- `test-writer` (Haiku) – Vitest + @testing-library Coverage schliessen

**Review-Agenten:**
- `de-ui-reviewer` (Haiku) – UI-Konsistenz: Deutsche Texte, vilo-* Tokens, Dark Mode
- `security-auditor` (Sonnet) – RLS, Secrets, XSS, PII-Logging
- `mobile-ux-auditor` (Haiku) – Touch-Targets, Viewport, Offline-UX

## Slash-Commands (`.claude/commands/`)
- `/ship` – lint + build + test + commit + push
- `/refactor-scan` – Findet Components >300 Zeilen
- `/smoke-test` – Manuelle End-to-End Checkliste

## Hooks (`.claude/hooks/`)
- `session-start.sh` – Installiert npm-Dependencies bei Web-Session-Start
- `pre-commit.sh` – Laeuft `npm run lint` vor jedem `git commit`, blockiert bei Fehlern
