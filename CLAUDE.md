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
