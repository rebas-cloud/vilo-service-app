import { Intent, MenuItem } from '../types';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

// LLM call timeout in ms — keeps service fast even when OpenAI is slow
const LLM_TIMEOUT_MS = 8000;

const SYSTEM_PROMPT = `Du bist der Sprachassistent "Vilo" fuer ein Restaurant-POS-System. Deine Aufgabe ist es, gesprochene Befehle des Kellners in strukturierte JSON-Aktionen umzuwandeln.

Du erhaeltst:
- Den gesprochenen Text des Kellners (kann Dialekt, Umgangssprache oder unvollstaendige Saetze enthalten)
- Die aktuelle Speisekarte (Menu)
- Die verfuegbaren Tische
- Den aktuell aktiven Tisch (falls vorhanden)

Du musst GENAU EINES der folgenden JSON-Formate zurueckgeben. Antworte NUR mit dem JSON-Objekt — kein Text davor oder danach, keine Markdown-Formatierung.

=== INTENT-TYPEN ===

1. Tisch auswaehlen (NUR wenn kein Essen/Trinken erwaehnt wird):
{"type": "SET_TABLE", "tableId": "tisch-5"}
Tisch-IDs bestehen aus Praefix + Nummer: tisch-1..tisch-30, terrasse-1..terrasse-4, bar-1..bar-3
Beispiele:
  - "Tisch 5" → {"type":"SET_TABLE","tableId":"tisch-5"}
  - "geh mal zu Tisch 12" → {"type":"SET_TABLE","tableId":"tisch-12"}
  - "Terrasse 2" → {"type":"SET_TABLE","tableId":"terrasse-2"}
  - "zeig mir Bar 1" → {"type":"SET_TABLE","tableId":"bar-1"}
  - "navigiere zu Tisch neun" → {"type":"SET_TABLE","tableId":"tisch-9"}

2. Tisch + Bestellung (wenn Tisch UND Essen/Trinken im selben Satz):
{"type": "TABLE_ORDER", "tableId": "tisch-3", "items": [{"menuItemId": "cola-klein", "name": "Cola klein", "quantity": 1, "modifiers": [], "price": 2.80, "routing": "bar"}]}
WICHTIG: Verwende TABLE_ORDER wenn ein Tisch UND Bestellung zusammen genannt werden!
Beispiele:
  - "Tisch 3 will eine Cola klein" → TABLE_ORDER fuer tisch-3
  - "Tisch 5 zwei Bier und eine Pizza" → TABLE_ORDER fuer tisch-5
  - "fuer Terrasse 2 ein Wasser" → TABLE_ORDER fuer terrasse-2
  - "Bar 1 haette gerne zwei Cappuccino" → TABLE_ORDER fuer bar-1
  - "Rotwein fuer Tisch 3" → TABLE_ORDER fuer tisch-3

3. Bestellung hinzufuegen (kein Tisch genannt, gilt fuer aktiven Tisch):
{"type": "ADD_ORDER", "items": [{"menuItemId": "cola-klein", "name": "Cola klein", "quantity": 2, "modifiers": [], "price": 2.80, "routing": "bar"}]}
WICHTIG: Verwende exakte menuItemId, name, price und routing aus der Speisekarte!
Beispiele:
  - "zwei Cola klein" → ADD_ORDER 2x Cola klein
  - "ein Bier und eine Pizza Margherita" → ADD_ORDER 1x Bier + 1x Pizza
  - "der Herr haette gerne ein Schnitzel" → ADD_ORDER 1x Schnitzel
  - "noch ein Wasser bitte" → ADD_ORDER 1x Wasser
  - "nen Rotwein" → ADD_ORDER 1x Rotwein (umgangssprachlich "nen" = einen)
  - "zwei Cappu" → ADD_ORDER 2x Cappuccino (Abkuerzung erkennen)
  - "Schni ohne Salat" → ADD_ORDER 1x Schnitzel, modifiers: ["ohne Salat"]

4. Bestellung fuer bestimmten Gast:
{"type": "SET_SEAT", "seatId": 3, "items": [{"menuItemId": "bier", "name": "Bier", "quantity": 1, "modifiers": [], "price": 3.80, "routing": "bar"}]}
Beispiele:
  - "Gast 3 ein Bier" → SET_SEAT seatId:3
  - "fuer den zweiten Gast eine Pizza" → SET_SEAT seatId:2
  - "Sitzplatz 1 zwei Wasser" → SET_SEAT seatId:1

5. Gang zuweisen:
{"type": "SET_COURSE", "course": "starter"}
course: "starter" (Vorspeise), "main" (Hauptgang/Hauptgericht), "dessert" (Dessert/Nachspeise/Nachtisch)
Beispiele:
  - "das als Vorspeise" → SET_COURSE starter
  - "als Hauptgang" → SET_COURSE main
  - "zum Dessert" → SET_COURSE dessert
  - "Nachtisch" → SET_COURSE dessert

6. An Station senden:
{"type": "SEND_TO_STATION", "station": "kitchen"}
station: "kitchen" (Kueche) oder "bar" (Bar/Getraenke)
Beispiele:
  - "an die Kueche senden" → SEND_TO_STATION kitchen
  - "raus" → SEND_TO_STATION kitchen
  - "bestellen" → SEND_TO_STATION kitchen
  - "abschicken" → SEND_TO_STATION kitchen
  - "Bestellung abschliessen" → SEND_TO_STATION kitchen
  - "an Bar senden" → SEND_TO_STATION bar
  - "los" → SEND_TO_STATION kitchen

7. Rechnung anzeigen:
{"type": "SHOW_BILL"}
Beispiele: "Rechnung", "die Rechnung bitte", "zahlen", "abrechnen", "bezahlen"

8. Getrennt zahlen:
{"type": "SPLIT_BILL"}
Beispiele: "getrennt zahlen", "Rechnung getrennt", "jeder zahlt einzeln", "aufteilen"

9. Zusammen zahlen:
{"type": "COMBINED_BILL"}
Beispiele: "zusammen zahlen", "eine Rechnung", "alles zusammen"

10. Kartenzahlung:
{"type": "PAY_CARD"}
Beispiele: "mit Karte", "Kartenzahlung", "EC-Karte", "Maestro", "Kreditkarte"

11. Barzahlung:
{"type": "PAY_CASH"}
Beispiele: "bar", "Barzahlung", "bar bezahlen", "cash"

12. Notiz hinzufuegen:
{"type": "ADD_NOTE", "note": "Allergie Nuesse"}
Beispiele:
  - "Allergie Nuesse" → ADD_NOTE "Allergie Nuesse"
  - "Geburtstag" → ADD_NOTE "Geburtstag"
  - "VIP Gast" → ADD_NOTE "VIP Gast"
  - "Notiz kein Salz" → ADD_NOTE "kein Salz"
  - "laktoseintolerant" → ADD_NOTE "Laktoseintoleranz"
  - "vegetarisch" → ADD_NOTE "Vegetarisch"

13. Tischstatus setzen:
{"type": "SET_TABLE_STATUS", "tableId": "tisch-5", "status": "free"}
status: "free" (Tisch frei/leer) oder "billing" (Tisch bei Rechnung/bezahlt)
Beispiele:
  - "Tisch 5 frei" → SET_TABLE_STATUS tisch-5 free
  - "Tisch 3 ist frei" → SET_TABLE_STATUS tisch-3 free
  - "Tisch 7 bezahlt" → SET_TABLE_STATUS tisch-7 billing
  - "Tisch 2 freigeben" → SET_TABLE_STATUS tisch-2 free

14. Reservierung anlegen:
{"type": "MAKE_RESERVATION", "partySize": 4, "time": "19:00", "guestName": "Müller"}
time immer im Format HH:MM (24h). guestName optional.
Beispiele:
  - "Reservierung fuer 4 um 19 Uhr" → MAKE_RESERVATION partySize:4 time:"19:00"
  - "Reservierung Mayer 2 Personen halb 8" → MAKE_RESERVATION partySize:2 time:"19:30" guestName:"Mayer"
  - "Tisch fuer 6 Personen um 20:30" → MAKE_RESERVATION partySize:6 time:"20:30"
  - "Reservierung fuer morgen Abend auf den Namen Schmidt" → MAKE_RESERVATION guestName:"Schmidt"

15. Rueckgaengig:
{"type": "UNDO"}
Beispiele: "rueckgaengig", "zurueck", "undo", "das war falsch", "zuruecknehmen"

16. Unbekannt (wenn Befehl nicht eindeutig zugeordnet werden kann):
{"type": "UNKNOWN", "text": "original text"}

=== ALLGEMEINE REGELN ===
- Antworte NUR mit dem JSON-Objekt, kein anderer Text, keine Erklaerungen
- Bei Bestellungen: Finde passendes Menuitem auch bei ungenauer Aussprache oder Abkuerzungen
  - "Cappu" → Cappuccino, "Schni" → Schnitzel, "Marg" → Margherita
- modifiers-Array fuer Sonderwuensche: ["ohne Zwiebeln", "mit extra Kaese", "ohne Eis"]
- Mehrere Items: alle in das items-Array aufnehmen
- Zahlenwoerter erkennen: "ein/eine/einen/nen/nem" = 1, "zwei/zwo" = 2, "drei" = 3 usw.
- Wenn keine Menge angegeben: quantity = 1
- Dialekt und Umgangssprache tolerieren: "nen", "nem", "ne" = ein/einem/eine
- "noch ein/eine" = quantity 1 (kein Aufaddieren — das macht der Server)
- Aktiver Tisch: Wenn ein Tisch aktiv ist und kein anderer Tisch genannt wird, gilt dieser`;

export function isLLMAvailable(): boolean {
  return OPENAI_API_KEY.length > 0;
}

// Strip all forms of markdown code fences from the LLM response
function stripCodeFences(raw: string): string {
  // Remove opening fence (```json, ```JSON, ```, etc.)
  raw = raw.replace(/^```[a-z]*\n?/i, '');
  // Remove closing fence
  raw = raw.replace(/\n?```\s*$/i, '');
  return raw.trim();
}

export async function parseIntentLLM(
  text: string,
  menuItems: MenuItem[],
  tables: string[],
  activeTableId: string | null,
): Promise<Intent> {
  if (!OPENAI_API_KEY) {
    throw new Error('No OpenAI API key configured');
  }

  // Include aliases in menu text so LLM can match colloquial names
  const menuText = menuItems
    .map(m => {
      const aliasStr = m.aliases?.length ? ` | aliases: ${m.aliases.join(', ')}` : '';
      return `- id:${m.id} | ${m.name} | ${m.price.toFixed(2)} EUR | ${m.category} | routing:${m.routing}${aliasStr}`;
    })
    .join('\n');

  const tablesText = tables.slice(0, 40).join(', '); // cap to avoid token overflow

  const userMsg = `Verfuegbare Tische: ${tablesText}
Aktiver Tisch: ${activeTableId || 'keiner'}

Speisekarte:
${menuText}

Kellner sagt: "${text}"`;

  // AbortController gives us the 8-second timeout — caller falls back to rule parser on abort
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
        temperature: 0,
        max_tokens: 300,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error('[VILO LLM] API error:', response.status, errText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  let raw = data.choices?.[0]?.message?.content || '';

  raw = stripCodeFences(raw);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('[VILO LLM] JSON parse failed, raw:', raw.slice(0, 200));
    throw new Error('LLM response is not valid JSON');
  }

  // Validate the parsed JSON has a valid intent type
  const validTypes = [
    'SET_TABLE', 'TABLE_ORDER', 'ADD_ORDER', 'SET_SEAT', 'SET_COURSE',
    'ADD_NOTE', 'SEND_TO_STATION', 'SHOW_BILL', 'SPLIT_BILL',
    'COMBINED_BILL', 'PAY_CARD', 'PAY_CASH', 'UNDO',
    'SET_TABLE_STATUS', 'MAKE_RESERVATION',
    'UNKNOWN',
  ];

  if (!parsed || typeof parsed !== 'object' || !validTypes.includes(parsed.type as string)) {
    console.warn('[VILO LLM] Invalid intent type:', parsed?.type);
    return { type: 'UNKNOWN', text } as Intent;
  }

  // Validate items array exists for order types
  if (['ADD_ORDER', 'TABLE_ORDER', 'SET_SEAT'].includes(parsed.type as string)) {
    if (!Array.isArray(parsed.items) || (parsed.items as unknown[]).length === 0) {
      console.warn('[VILO LLM] Missing or empty items array for', parsed.type);
      return { type: 'UNKNOWN', text } as Intent;
    }
    // Validate each item has required fields and fill in defaults
    for (const item of parsed.items as Record<string, unknown>[]) {
      if (!item.menuItemId || !item.name || typeof item.price !== 'number') {
        console.warn('[VILO LLM] Invalid item in response:', item);
        return { type: 'UNKNOWN', text } as Intent;
      }
      item.quantity = (item.quantity as number) || 1;
      item.modifiers = (item.modifiers as string[]) || [];
      item.routing = (item.routing as string) || 'kitchen';
    }
  }

  // Validate tableId for table types
  if (['SET_TABLE', 'TABLE_ORDER', 'SET_TABLE_STATUS'].includes(parsed.type as string) && !parsed.tableId) {
    console.warn('[VILO LLM] Missing tableId for', parsed.type);
    return { type: 'UNKNOWN', text } as Intent;
  }

  // Validate MAKE_RESERVATION has required fields
  if (parsed.type === 'MAKE_RESERVATION') {
    if (!parsed.partySize || typeof parsed.partySize !== 'number') {
      (parsed as Record<string, unknown>).partySize = 2;
    }
    if (!parsed.time || typeof parsed.time !== 'string') {
      (parsed as Record<string, unknown>).time = '19:00';
    }
    // Normalize time to HH:MM if LLM returned "19 Uhr" style
    const timeStr = (parsed.time as string).replace(/\s*uhr\s*/i, '').trim();
    if (/^\d{1,2}$/.test(timeStr)) {
      (parsed as Record<string, unknown>).time = `${timeStr.padStart(2, '0')}:00`;
    }
  }

  // Validate SET_TABLE_STATUS has a valid status
  if (parsed.type === 'SET_TABLE_STATUS') {
    if (!['free', 'billing'].includes(parsed.status as string)) {
      console.warn('[VILO LLM] Invalid status for SET_TABLE_STATUS:', parsed.status);
      return { type: 'UNKNOWN', text } as Intent;
    }
  }

  return parsed as unknown as Intent;
}
