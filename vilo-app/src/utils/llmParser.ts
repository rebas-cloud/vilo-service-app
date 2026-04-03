import { Intent, MenuItem } from '../types';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

const SYSTEM_PROMPT = `Du bist der Sprachassistent "Vilo" fuer ein Restaurant-POS-System. Deine Aufgabe ist es, gesprochene Befehle des Kellners in strukturierte JSON-Aktionen umzuwandeln.

Du erhaeltst:
- Den gesprochenen Text des Kellners
- Die aktuelle Speisekarte (Menu)
- Die verfuegbaren Tische
- Den aktuell aktiven Tisch (falls vorhanden)

Du musst GENAU EINES der folgenden JSON-Formate zurueckgeben:

1. Tisch auswaehlen (NUR wenn kein Essen/Trinken erwaehnt wird):
{"type": "SET_TABLE", "tableId": "tisch-5"}
Beispiele: "Tisch 5", "geh mal zu Tisch 12", "Terrasse 2", "Bar 1"
Tisch-IDs: tisch-1 bis tisch-15, terrasse-1 bis terrasse-4, bar-1 bis bar-3

1b. Tisch + Bestellung zusammen (wenn Tisch UND Essen/Trinken in einem Satz):
{"type": "TABLE_ORDER", "tableId": "tisch-3", "items": [{"menuItemId": "cola-klein", "name": "Cola klein", "quantity": 1, "modifiers": [], "price": 2.80, "routing": "bar"}]}
Beispiele: "Tisch 3 will eine Cola klein", "Tisch 5 zwei Bier und eine Pizza", "fuer Terrasse 2 ein Wasser", "Bar 1 haette gerne zwei Cappuccino"
WICHTIG: Verwende TABLE_ORDER wenn im gleichen Satz ein Tisch UND eine Bestellung genannt werden!

2. Bestellung hinzufuegen:
{"type": "ADD_ORDER", "items": [{"menuItemId": "cola-klein", "name": "Cola klein", "quantity": 2, "modifiers": [], "price": 2.80, "routing": "bar"}]}
Beispiele: "zwei Cola klein", "ein Bier und eine Pizza Margherita", "der Herr haette gerne ein Schnitzel", "noch ein Wasser bitte"
WICHTIG: Verwende die exakten menuItemId, name, price und routing Werte aus dem Menu!

3. Bestellung fuer bestimmten Gast:
{"type": "SET_SEAT", "seatId": 3, "items": [{"menuItemId": "bier", "name": "Bier", "quantity": 1, "modifiers": [], "price": 3.80, "routing": "bar"}]}
Beispiele: "Gast 3 ein Bier", "fuer den zweiten Gast eine Pizza"

4. Gang zuweisen:
{"type": "SET_COURSE", "course": "starter"}
course kann sein: "starter", "main", "dessert"
Beispiele: "das als Vorspeise", "als Hauptgang", "zum Dessert"

5. An Station senden:
{"type": "SEND_TO_STATION", "station": "kitchen"}
station kann sein: "kitchen" oder "bar"
Beispiele: "an die Kueche senden", "raus", "bestellen", "abschicken", "an Bar senden"

6. Rechnung anzeigen:
{"type": "SHOW_BILL"}
Beispiele: "Rechnung", "die Rechnung bitte", "zahlen", "abrechnen"

7. Getrennt zahlen:
{"type": "SPLIT_BILL"}
Beispiele: "getrennt zahlen", "Rechnung getrennt", "jeder zahlt einzeln"

8. Zusammen zahlen:
{"type": "COMBINED_BILL"}
Beispiele: "zusammen zahlen", "eine Rechnung", "alles zusammen"

9. Kartenzahlung:
{"type": "PAY_CARD"}
Beispiele: "mit Karte", "Kartenzahlung", "EC-Karte"

10. Barzahlung:
{"type": "PAY_CASH"}
Beispiele: "bar", "Barzahlung", "bar bezahlen"

11. Notiz hinzufuegen:
{"type": "ADD_NOTE", "note": "Allergie Nuesse"}
Beispiele: "Allergie Nuesse", "Geburtstag", "VIP Gast", "Notiz kein Salz"

12. Rueckgaengig:
{"type": "UNDO"}
Beispiele: "rueckgaengig", "zurueck", "undo", "das war falsch"

13. Unbekannt (wenn du den Befehl nicht verstehst):
{"type": "UNKNOWN", "text": "original text"}

WICHTIGE REGELN:
- Antworte NUR mit dem JSON-Objekt, kein anderer Text
- Bei Bestellungen: Finde das passende Menuitem auch bei ungenauer Aussprache (z.B. "Cappu" -> Cappuccino, "Schni" -> Wiener Schnitzel)
- Modifiers wie "ohne Zwiebeln", "mit extra Kaese", "ohne Eis" muessen als modifiers-Array erfasst werden
- Wenn mehrere Items bestellt werden ("ein Bier und zwei Cola"), alle in das items-Array
- Zahlenwoerter verstehen: "ein/eine/einen" = 1, "zwei" = 2, "drei" = 3, etc.
- Wenn keine Menge genannt wird, ist quantity = 1
- Sei tolerant bei Dialekt und umgangssprachlichen Ausdruecken
- "noch ein/eine" bedeutet quantity 1`;

export function isLLMAvailable(): boolean {
  return OPENAI_API_KEY.length > 0;
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

  const menuText = menuItems
    .map(m => `- id:${m.id} | ${m.name} | ${m.price.toFixed(2)} EUR | ${m.category} | routing:${m.routing}`)
    .join('\n');

  const tablesText = tables.join(', ');

  const userMsg = `Verfuegbare Tische: ${tablesText}
Aktiver Tisch: ${activeTableId || 'keiner'}

Speisekarte:
${menuText}

Kellner sagt: "${text}"`;

  console.log('[VILO LLM] Sending to GPT-4o-mini:', text);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[VILO LLM] API error:', response.status, errText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  let raw = data.choices?.[0]?.message?.content || '';

  // Strip markdown code fences if present
  raw = raw.trim();
  if (raw.startsWith('```')) {
    raw = raw.split('\n').slice(1).join('\n');
  }
  if (raw.endsWith('```')) {
    raw = raw.slice(0, -3);
  }
  raw = raw.trim();

  console.log('[VILO LLM] Response:', raw);

  const parsed = JSON.parse(raw);

  // Validate the parsed JSON has a valid intent type
  const validTypes = [
    'SET_TABLE', 'TABLE_ORDER', 'ADD_ORDER', 'SET_SEAT', 'SET_COURSE',
    'ADD_NOTE', 'SEND_TO_STATION', 'SHOW_BILL', 'SPLIT_BILL',
    'COMBINED_BILL', 'PAY_CARD', 'PAY_CASH', 'UNDO', 'UNKNOWN',
  ];

  if (!parsed || typeof parsed !== 'object' || !validTypes.includes(parsed.type)) {
    console.warn('[VILO LLM] Invalid intent type:', parsed?.type);
    return { type: 'UNKNOWN', text } as Intent;
  }

  // Validate items array exists for order types
  if (['ADD_ORDER', 'TABLE_ORDER', 'SET_SEAT'].includes(parsed.type)) {
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      console.warn('[VILO LLM] Missing or empty items array for', parsed.type);
      return { type: 'UNKNOWN', text } as Intent;
    }
    // Validate each item has required fields
    for (const item of parsed.items) {
      if (!item.menuItemId || !item.name || typeof item.price !== 'number') {
        console.warn('[VILO LLM] Invalid item in response:', item);
        return { type: 'UNKNOWN', text } as Intent;
      }
      // Ensure defaults
      item.quantity = item.quantity || 1;
      item.modifiers = item.modifiers || [];
      item.routing = item.routing || 'kitchen';
    }
  }

  // Validate tableId for table types
  if (['SET_TABLE', 'TABLE_ORDER'].includes(parsed.type) && !parsed.tableId) {
    console.warn('[VILO LLM] Missing tableId for', parsed.type);
    return { type: 'UNKNOWN', text } as Intent;
  }

  return parsed as Intent;
}
