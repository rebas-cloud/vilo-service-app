---
name: smoke-test
description: Manual smoke-test checklist for the VILO app. Run after feature changes to verify core flows work end-to-end on `npm run dev`.
---

You are assisting with **smoke-test** for VILO. This is a checklist-driven manual verification.

## Prerequisites

```bash
cd /home/user/vilo-app/vilo-app
npm run dev
# Open http://localhost:5173 in a browser
```

## Checklist

### 1. Onboarding / Setup
- [ ] App loads (no console errors).
- [ ] Restaurant-Code-Eingabe funktioniert (oder Onboarding-Flow startet).
- [ ] Sprache ist Deutsch (UI-Labels, Buttons, Fehlermeldungen).

### 2. Floor Plan (wenn geändert)
- [ ] Tische rendern im Grid.
- [ ] Tisch selektieren (Click) → Highlight-Outline sichtbar.
- [ ] Tisch ziehen (Drag) → Position updated, andere Tische nicht überlappt.
- [ ] Neue Tisch hinzufügen (+ Button) → Form zeigt auf Deutsch.
- [ ] Tisch löschen → Bestätigung, Löschen funktioniert.

### 3. Reservations (wenn geändert)
- [ ] Reservierungs-Kalender lädt.
- [ ] Neue Reservierung anlegen (Form) → deutsche Labels.
- [ ] Gast-Name, Telefon eintragen → speichern funktioniert.
- [ ] Reservierung im Kalender sichtbar.
- [ ] Reservierung öffnen → Detail zeigt Daten korrekt.

### 4. POS / Table Management (wenn geändert)
- [ ] Tisch öffnen (Session starten) → Tisch-Status ändert sich.
- [ ] Menü-Item hinzufügen (Order) → erscheint in der Order-Liste.
- [ ] Preis korrekt angezeigt (deutsches Format: 2,50 €).
- [ ] Split-Rechnung starten (Button) → Form zeigt auf Deutsch.
- [ ] Zahlung absenden → Session schließt.

### 5. Offline-Fallback (wenn möglich)
- [ ] Browser DevTools → Network Tab → "Offline" aktivieren.
- [ ] App lädt noch (localStorage-Fallback).
- [ ] Neue Aktion (z. B. Tisch öffnen) → lokal gespeichert, Banner zeigt "Offline-Modus".
- [ ] Offline wieder ausschalten → Sync-Button oder Auto-Sync startet.

### 6. Dark Mode (optional)
- [ ] Toggle Dark-Mode (falls implementiert).
- [ ] Alle kritischen Farben lesbar (Kontrast ✓).
- [ ] `vilo-*` Tokens sichtbar (keine Pastellfarben-Blowout).

### 7. Responsive / Mobile (optional, wenn auf Tablet/Phone getestet)
- [ ] Viewport-Metadaten korrekt (keine Zoom-Sperre).
- [ ] Touch-Targets ≥ 44×44 px.
- [ ] Modals nicht über Viewport hinaus (scroll-lock aktiv).

## Report

After testing, note:
- ✅ All checks passed.
- ⚠️ Any issues found (feature, visual, performance).
- 🔴 Blockers (missing feature, crashes, data-loss).

Stop. Do not fix issues — only report.
