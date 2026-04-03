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
function extractTableRef(lower: string): { tableId: string; remainingText: string } | null {
  // "Tisch X ..." - extract table and keep the rest
  const tischMatch = lower.match(/(?:für\s+)?tisch\s+(\w+)\s*(.*)/);
  if (tischMatch) {
    const tableNum = parseNumber(tischMatch[1]);
    if (tableNum !== null) {
      return { tableId: `tisch-${tableNum}`, remainingText: tischMatch[2]?.trim() || '' };
    }
    return { tableId: `tisch-${tischMatch[1]}`, remainingText: tischMatch[2]?.trim() || '' };
  }

  // "Terrasse X ..."
  const terrasseMatch = lower.match(/(?:für\s+)?terrasse\s+(\w+)\s*(.*)/);
  if (terrasseMatch) {
    const num = parseNumber(terrasseMatch[1]);
    if (num !== null) {
      return { tableId: `terrasse-${num}`, remainingText: terrasseMatch[2]?.trim() || '' };
    }
  }

  // "Bar X ..." - supports number words and additional text
  const barMatch = lower.match(/(?:für\s+)?bar\s+(\w+)\s*(.*)/);
  if (barMatch) {
    const num = parseNumber(barMatch[1]);
    if (num !== null) {
      return { tableId: `bar-${num}`, remainingText: barMatch[2]?.trim() || '' };
    }
  }

  return null;
}

export function parseIntent(text: string, menuItems: MenuItem[]): Intent {
  const lower = text.toLowerCase().trim();
  console.log('[VILO] Parsing intent:', lower);

  // Undo
  if (lower.includes('rückgängig') || lower.includes('undo') || lower.includes('zurück nehmen') || lower.includes('zurücknehmen')) {
    return { type: 'UNDO' };
  }

  // Billing - check before table to avoid "bar" conflicts with PAY_CASH
  if (lower.includes('rechnung')) {
    if (lower.includes('getrennt')) return { type: 'SPLIT_BILL' };
    if (lower.includes('zusammen')) return { type: 'COMBINED_BILL' };
    return { type: 'SHOW_BILL' };
  }
  if (lower.includes('getrennt') && lower.includes('zahlen')) return { type: 'SPLIT_BILL' };
  if (lower.includes('zusammen') && lower.includes('zahlen')) return { type: 'COMBINED_BILL' };
  if (lower.includes('mit karte') || lower.includes('kartenzahlung') || lower.includes('kreditkarte')) return { type: 'PAY_CARD' };
  if (lower.includes('barzahlung') || lower.includes('bar bezahlen') || (lower.includes('bar') && lower.includes('zahl'))) return { type: 'PAY_CASH' };

  // Course assignment
  if (lower.includes('vorspeise')) return { type: 'SET_COURSE', course: 'starter' };
  if (lower.includes('hauptgang') || lower.includes('hauptgericht')) return { type: 'SET_COURSE', course: 'main' };
  if (lower.includes('dessert') || lower.includes('nachspeise') || lower.includes('nachtisch')) return { type: 'SET_COURSE', course: 'dessert' };

  // Send to station
  if (lower.includes('an bar') || lower.includes('zur bar') || lower.includes('bar senden')) return { type: 'SEND_TO_STATION', station: 'bar' };
  if (lower.includes('an küche') || lower.includes('zur küche') || lower.includes('küche senden') || lower.includes('an kueche')) return { type: 'SEND_TO_STATION', station: 'kitchen' };
  if (lower.includes('senden') || lower.includes('abschicken') || lower.includes('bestellen') || lower === 'raus') return { type: 'SEND_TO_STATION', station: 'kitchen' };

  // Notes
  if (lower.startsWith('allergie') || lower.startsWith('notiz') || lower.startsWith('hinweis')) {
    const note = lower.replace(/^(allergie|notiz|hinweis)\s*/, '').trim();
    return { type: 'ADD_NOTE', note: note || text };
  }
  if (lower.includes('geburtstag')) return { type: 'ADD_NOTE', note: 'Geburtstag' };
  if (lower.includes('vip')) return { type: 'ADD_NOTE', note: 'VIP Gast' };

  // Table reference (possibly with order): "Tisch 3 eine Cola", "Bar 1 zwei Bier"
  const tableRef = extractTableRef(lower);
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
    // Just table selection
    return { type: 'SET_TABLE', tableId: tableRef.tableId };
  }

  // Seat + Order: "Gast 3 ein Bier"
  const seatMatch = lower.match(/gast\s+(\w+)\s+(.+)/);
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

  // Order items: "[Anzahl] [Item] [modifier]"
  const items = parseOrderItems(lower, menuItems);
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
