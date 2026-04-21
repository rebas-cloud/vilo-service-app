import { Intent, MenuItem } from '../types';

const numberWords: Record<string, number> = {
  'ein': 1, 'eine': 1, 'einen': 1, 'eins': 1, 'einer': 1,
  'zwei': 2, 'zwo': 2,
  'drei': 3,
  'vier': 4,
  'fünf': 5,
  'sechs': 6,
  'sieben': 7,
  'acht': 8,
  'neun': 9,
  'zehn': 10,
  'elf': 11,
  'zwölf': 12,
  'dreizehn': 13,
  'vierzehn': 14,
  'fünfzehn': 15,
  'sechzehn': 16,
  'siebzehn': 17,
  'achtzehn': 18,
  'neunzehn': 19,
  'zwanzig': 20,
  'einundzwanzig': 21,
  'zweiundzwanzig': 22,
  'dreiundzwanzig': 23,
  'vierundzwanzig': 24,
  'fünfundzwanzig': 25,
  'dreißig': 30,
  'dreissig': 30,
  'vierzig': 40,
  'fünfzig': 50,
};

function parseNumber(text: string): number | null {
  const lower = text.toLowerCase().trim();
  if (numberWords[lower] !== undefined) return numberWords[lower];
  const num = parseInt(lower);
  if (!isNaN(num)) return num;
  return null;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .trim();
}

function fuzzyMatch(haystack: string, needle: string): boolean {
  const h = normalizeText(haystack);
  const n = normalizeText(needle);
  if (h.includes(n)) return true;
  // Also check without normalization
  if (haystack.toLowerCase().includes(needle.toLowerCase())) return true;
  return false;
}

function findMenuItem(text: string, menuItems: MenuItem[]): { item: MenuItem; alias: string } | null {
  const lower = text.toLowerCase().trim();

  const allMatches: { item: MenuItem; alias: string }[] = [];

  for (const item of menuItems) {
    const allAliases = [item.name.toLowerCase(), ...(item.aliases || []).map(a => a.toLowerCase())];
    for (const alias of allAliases) {
      if (fuzzyMatch(lower, alias) || fuzzyMatch(alias, lower)) {
        allMatches.push({ item, alias });
      }
    }
  }

  if (allMatches.length === 0) return null;

  // Pick the longest alias match (most specific)
  allMatches.sort((a, b) => b.alias.length - a.alias.length);
  return allMatches[0];
}

interface ParsedOrderItem {
  item: MenuItem;
  quantity: number;
  modifiers: string[];
}

function parseOrderItems(text: string, menuItems: MenuItem[]): ParsedOrderItem[] {
  const items: ParsedOrderItem[] = [];
  // Split by "und" or comma for multiple items
  const parts = text.split(/\s+und\s+|\s*,\s*/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    let quantity = 1;
    let itemText = trimmed;

    const words = trimmed.split(/\s+/);
    const firstNum = parseNumber(words[0]);
    if (firstNum !== null) {
      quantity = firstNum;
      itemText = words.slice(1).join(' ');
    }

    // Extract modifiers (ohne ..., mit ..., extra ...) - capture multiple words after keyword
    const modifiers: string[] = [];
    const modMatches = itemText.match(/(ohne|mit|extra)\s+[\wäöüß]+(\s+[\wäöüß]+)*/gi);
    if (modMatches) {
      for (const mod of modMatches) {
        modifiers.push(mod);
        itemText = itemText.replace(mod, '').trim();
      }
    }

    const found = findMenuItem(itemText, menuItems);
    if (found) {
      items.push({ item: found.item, quantity, modifiers });
    }
  }

  return items;
}

// Extract table reference from text: returns { tableId, remainingText } or null
// Handles navigation phrases: "gehe zu Tisch X", "navigiere zu Tisch X", "zeig Tisch X"
function extractTableRef(lower: string): { tableId: string; remainingText: string } | null {
  // Strip navigation prefixes before matching table keyword
  const stripped = lower
    .replace(/^(?:gehe?\s+(?:zu|zum|zur)\s+|navigiere?\s+(?:zu|zum|zur)\s+|zeig(?:e)?\s+(?:mir\s+)?|wechsel(?:e)?\s+(?:zu\s+)?|öffne?\s+)/i, '')
    .trim();

  // "Tisch X ..." - extract table and keep the rest
  const tischMatch = stripped.match(/(?:für\s+)?tisch\s+(\w+)\s*(.*)/);
  if (tischMatch) {
    const tableNum = parseNumber(tischMatch[1]);
    if (tableNum !== null) {
      return { tableId: `tisch-${tableNum}`, remainingText: tischMatch[2]?.trim() || '' };
    }
    return { tableId: `tisch-${tischMatch[1]}`, remainingText: tischMatch[2]?.trim() || '' };
  }

  // "Terrasse X ..."
  const terrasseMatch = stripped.match(/(?:für\s+)?terrasse\s+(\w+)\s*(.*)/);
  if (terrasseMatch) {
    const num = parseNumber(terrasseMatch[1]);
    if (num !== null) {
      return { tableId: `terrasse-${num}`, remainingText: terrasseMatch[2]?.trim() || '' };
    }
  }

  // "Bar X ..." - supports number words and additional text
  const barMatch = stripped.match(/(?:für\s+)?bar\s+(\w+)\s*(.*)/);
  if (barMatch) {
    const num = parseNumber(barMatch[1]);
    if (num !== null) {
      return { tableId: `bar-${num}`, remainingText: barMatch[2]?.trim() || '' };
    }
  }

  return null;
}

// Parse time strings like "19 Uhr", "halb 8", "19:30" → "19:00", "20:30"
function parseTimeString(text: string): string | null {
  // "19:30" or "19.30"
  const colonMatch = text.match(/(\d{1,2})[:.:](\d{2})\s*uhr?/i);
  if (colonMatch) return `${colonMatch[1].padStart(2, '0')}:${colonMatch[2]}`;

  // "19 Uhr" / "neunzehn Uhr"
  const hourMatch = text.match(/(\d{1,2})\s*uhr/i);
  if (hourMatch) return `${hourMatch[1].padStart(2, '0')}:00`;

  // German word hours: "neunzehn Uhr" etc.
  for (const [word, num] of Object.entries(numberWords)) {
    const wordRe = new RegExp(`${word}\\s+uhr`, 'i');
    if (wordRe.test(text)) return `${String(num).padStart(2, '0')}:00`;
  }

  // "halb 8" → 07:30, "halb neun" → 08:30
  const halbMatch = text.match(/halb\s+(\w+)/i);
  if (halbMatch) {
    const hourNum = parseNumber(halbMatch[1]);
    if (hourNum !== null) {
      const h = (hourNum - 1 + 24) % 24;
      return `${String(h).padStart(2, '0')}:30`;
    }
  }

  return null;
}

export function parseIntent(text: string, menuItems: MenuItem[]): Intent {
  const lower = text.toLowerCase().trim();

  // Normalize colloquial contractions before matching:
  // "nen" / "nem" / "ne" → "ein/einen/eine" so downstream number parsing works.
  // Strip common filler words that carry no quantity/item information.
  // Order matters: multi-word patterns before single-word ones.
  const normalized = lower
    .replace(/\bhätte\s+gerne?\b/g, '')
    .replace(/\bwürde\s+gerne?\b/g, '')
    .replace(/\bkann\s+ich\b/g, '')
    .replace(/\bwill\s+ich\b/g, '')
    .replace(/\bnoch\s+mal\b/g, 'noch')
    // "noch" as standalone leading word only — strip it so "noch zwei Bier" → "zwei Bier"
    .replace(/^noch\s+/, '')
    .replace(/\bnen\b/g, 'einen')
    .replace(/\bnem\b/g, 'einem')
    .replace(/\bne\b/g, 'eine')
    .replace(/\boch\b/g, 'noch')
    .replace(/\bgerne?\b/g, '')
    .replace(/\bbitte\b/g, '')
    .replace(/\bmal\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Priority 1 — Undo (check first, most unambiguous)
  if (lower.includes('rückgängig') || lower.includes('undo') || lower.includes('zurück nehmen') || lower.includes('zurücknehmen') || lower.includes('das war falsch')) {
    return { type: 'UNDO' };
  }

  // Priority 2 — Reservation creation
  // "Reservierung für 4 um 19 Uhr", "Reservierung Müller 3 Personen halb 8"
  if (lower.includes('reservierung') || lower.includes('reservier') || lower.includes('tisch reserv') || lower.includes('buching') || lower.includes('buchung')) {
    const partySizeMatch = normalized.match(/(\d+|ein(?:e|en|er)?|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s+(?:personen|person|leute|gäste|pax)/);
    let partySize = 2;
    if (partySizeMatch) {
      partySize = parseNumber(partySizeMatch[1]) ?? 2;
    } else {
      // fallback: look for any leading digit after "für"
      const fuerMatch = normalized.match(/für\s+(\w+)/);
      if (fuerMatch) partySize = parseNumber(fuerMatch[1]) ?? 2;
    }
    const time = parseTimeString(lower) ?? '19:00';

    // Optional guest name: "auf den Namen Müller" / "für Herrn Schmidt" / "Name Meier"
    let guestName: string | undefined;
    const nameMatch = lower.match(/(?:auf\s+(?:den\s+)?namen|für\s+(?:herrn|frau|familie)?|name)\s+([A-Za-zÄÖÜäöüß]+)/i);
    if (nameMatch) guestName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);

    return { type: 'MAKE_RESERVATION', partySize, time, guestName };
  }

  // Priority 3 — Billing (check before table to avoid "bar" conflicts with PAY_CASH)
  // Expanded: "abrechnen", "zahlen" alone, "bezahlen"
  if (lower.includes('rechnung') || lower === 'abrechnen' || lower === 'zahlen' || lower === 'bezahlen' || lower.includes('abrechnen')) {
    if (lower.includes('getrennt')) return { type: 'SPLIT_BILL' };
    if (lower.includes('zusammen')) return { type: 'COMBINED_BILL' };
    return { type: 'SHOW_BILL' };
  }
  if (lower.includes('getrennt') && lower.includes('zahlen')) return { type: 'SPLIT_BILL' };
  if (lower.includes('zusammen') && lower.includes('zahlen')) return { type: 'COMBINED_BILL' };
  if (lower.includes('mit karte') || lower.includes('kartenzahlung') || lower.includes('kreditkarte') || lower.includes('ec-karte') || lower.includes('ec karte') || lower.includes('maestro')) return { type: 'PAY_CARD' };
  if (lower.includes('barzahlung') || lower.includes('bar bezahlen') || (lower.includes('bar') && lower.includes('zahl'))) return { type: 'PAY_CASH' };

  // Priority 4 — Table status changes
  // "Tisch 5 frei", "Tisch 3 ist frei", "Tisch 7 bezahlt", "Tisch 2 auf frei setzen"
  const statusTableRef = extractTableRef(lower);
  if (statusTableRef) {
    const rest = statusTableRef.remainingText;
    if (rest.includes('frei') || rest.includes('ist frei') || rest.includes('freigeben') || rest.includes('leer')) {
      return { type: 'SET_TABLE_STATUS', tableId: statusTableRef.tableId, status: 'free' };
    }
    if (rest.includes('bezahlt') || rest.includes('hat bezahlt') || rest.includes('abrechnung') || rest.includes('billing')) {
      return { type: 'SET_TABLE_STATUS', tableId: statusTableRef.tableId, status: 'billing' };
    }
  }

  // Priority 5 — Course assignment
  if (lower.includes('vorspeise')) return { type: 'SET_COURSE', course: 'starter' };
  if (lower.includes('hauptgang') || lower.includes('hauptgericht')) return { type: 'SET_COURSE', course: 'main' };
  if (lower.includes('dessert') || lower.includes('nachspeise') || lower.includes('nachtisch')) return { type: 'SET_COURSE', course: 'dessert' };

  // Priority 6 — Send to station
  // "abschließen" and "fertig" as send-to-kitchen aliases for service flow
  if (lower.includes('an bar') || lower.includes('zur bar') || lower.includes('bar senden')) return { type: 'SEND_TO_STATION', station: 'bar' };
  if (lower.includes('an küche') || lower.includes('zur küche') || lower.includes('küche senden') || lower.includes('an kueche') || lower.includes('bestellung abschließen') || lower.includes('bestellung fertig')) return { type: 'SEND_TO_STATION', station: 'kitchen' };
  if (lower.includes('senden') || lower.includes('abschicken') || lower.includes('bestellen') || lower === 'raus' || lower === 'abschicken' || lower === 'fertig' || lower === 'los') return { type: 'SEND_TO_STATION', station: 'kitchen' };

  // Priority 7 — Notes
  // Use original text for note content to preserve capitalisation
  if (lower.startsWith('allergie') || lower.startsWith('notiz') || lower.startsWith('hinweis') || lower.startsWith('anmerkung')) {
    const noteRaw = text.replace(/^(allergie|notiz|hinweis|anmerkung)\s*/i, '').trim();
    return { type: 'ADD_NOTE', note: noteRaw || text };
  }
  if (lower.includes('geburtstag')) return { type: 'ADD_NOTE', note: 'Geburtstag' };
  if (lower.includes('vip')) return { type: 'ADD_NOTE', note: 'VIP Gast' };
  if (lower.includes('laktose')) return { type: 'ADD_NOTE', note: 'Laktoseintoleranz' };
  if (lower.includes('glutenfrei') || lower.includes('gluten')) return { type: 'ADD_NOTE', note: 'Glutenfrei' };
  if (lower.includes('vegetarisch')) return { type: 'ADD_NOTE', note: 'Vegetarisch' };
  if (lower.includes('vegan')) return { type: 'ADD_NOTE', note: 'Vegan' };

  // Priority 8 — Table reference (possibly with order): "Tisch 3 eine Cola", "Bar 1 zwei Bier"
  // Re-check tableRef (already extracted above for status check)
  const tableRef = statusTableRef ?? extractTableRef(normalized);
  if (tableRef) {
    // Check if there's an order in the remaining text
    if (tableRef.remainingText) {
      const tableOrderItems = parseOrderItems(tableRef.remainingText, menuItems);
      if (tableOrderItems.length > 0) {
        // Combined table + order → TABLE_ORDER
        return {
          type: 'TABLE_ORDER',
          tableId: tableRef.tableId,
          items: tableOrderItems.map(i => ({
            menuItemId: i.item.id,
            name: i.item.name,
            quantity: i.quantity,
            modifiers: i.modifiers,
            price: i.item.price,
            routing: i.item.routing,
          })),
        };
      }
    }
    // Just table selection - also matches "gehe zu Tisch X", "navigiere zu Tisch X"
    return { type: 'SET_TABLE', tableId: tableRef.tableId };
  }

  // Priority 9 — Seat + Order: "Gast 3 ein Bier"
  const seatMatch = normalized.match(/gast\s+(\w+)\s+(.+)/);
  if (seatMatch) {
    const seatNum = parseNumber(seatMatch[1]);
    if (seatNum !== null) {
      const orderText = seatMatch[2];
      const items = parseOrderItems(orderText, menuItems);
      if (items.length > 0) {
        return {
          type: 'SET_SEAT',
          seatId: seatNum,
          items: items.map(i => ({
            menuItemId: i.item.id,
            name: i.item.name,
            quantity: i.quantity,
            modifiers: i.modifiers,
            price: i.item.price,
            routing: i.item.routing,
          })),
        };
      }
    }
  }

  // Priority 10 — Order items: "[Anzahl] [Item] [modifier]"
  // Use normalized text to handle colloquial forms ("nen Cola" → "einen Cola")
  const items = parseOrderItems(normalized, menuItems);
  if (items.length > 0) {
    return {
      type: 'ADD_ORDER',
      items: items.map(i => ({
        menuItemId: i.item.id,
        name: i.item.name,
        quantity: i.quantity,
        modifiers: i.modifiers,
        price: i.item.price,
        routing: i.item.routing,
      })),
    };
  }

  return { type: 'UNKNOWN', text };
}
