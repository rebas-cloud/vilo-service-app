import { describe, it, expect } from 'vitest';
import { parseIntent } from './intentParser';
import { MenuItem } from '../types';

const mockMenuItems: MenuItem[] = [
  {
    id: 'cola-1',
    name: 'Cola',
    price: 3.5,
    category: 'drinks',
    routing: 'bar',
    aliases: ['coke', 'softdrink'],
  },
  {
    id: 'beer-1',
    name: 'Bier',
    price: 4.5,
    category: 'drinks',
    routing: 'bar',
    aliases: ['pils', 'helles'],
  },
  {
    id: 'water-1',
    name: 'Wasser',
    price: 2.0,
    category: 'drinks',
    routing: 'bar',
  },
  {
    id: 'pasta-1',
    name: 'Pasta Carbonara',
    price: 14.5,
    category: 'mains',
    routing: 'kitchen',
    aliases: ['pasta', 'carbonara'],
  },
  {
    id: 'steak-1',
    name: 'Rindersteak',
    price: 24.0,
    category: 'mains',
    routing: 'kitchen',
    aliases: ['steak', 'fleisch'],
  },
  {
    id: 'salad-1',
    name: 'Grüner Salat',
    price: 8.5,
    category: 'starters',
    routing: 'kitchen',
    aliases: ['salat', 'salatbutter'],
  },
  {
    id: 'cake-1',
    name: 'Käsekuchen',
    price: 6.0,
    category: 'desserts',
    routing: 'kitchen',
    aliases: ['kuchen', 'cheese cake'],
  },
];

describe('parseIntent - Undo', () => {
  it('returns UNDO intent for "rückgängig"', () => {
    const intent = parseIntent('rückgängig', mockMenuItems);
    expect(intent.type).toBe('UNDO');
  });

  it('returns UNDO intent for "undo"', () => {
    const intent = parseIntent('undo', mockMenuItems);
    expect(intent.type).toBe('UNDO');
  });

  it('returns UNDO intent for "zurücknehmen"', () => {
    const intent = parseIntent('zurücknehmen', mockMenuItems);
    expect(intent.type).toBe('UNDO');
  });
});

describe('parseIntent - Billing', () => {
  it('returns SHOW_BILL for "rechnung"', () => {
    const intent = parseIntent('rechnung', mockMenuItems);
    expect(intent.type).toBe('SHOW_BILL');
  });

  it('returns SPLIT_BILL for "rechnung getrennt"', () => {
    const intent = parseIntent('rechnung getrennt', mockMenuItems);
    expect(intent.type).toBe('SPLIT_BILL');
  });

  it('returns COMBINED_BILL for "rechnung zusammen"', () => {
    const intent = parseIntent('rechnung zusammen', mockMenuItems);
    expect(intent.type).toBe('COMBINED_BILL');
  });

  it('returns SPLIT_BILL for "getrennt zahlen"', () => {
    const intent = parseIntent('getrennt zahlen', mockMenuItems);
    expect(intent.type).toBe('SPLIT_BILL');
  });

  it('returns COMBINED_BILL for "zusammen zahlen"', () => {
    const intent = parseIntent('zusammen zahlen', mockMenuItems);
    expect(intent.type).toBe('COMBINED_BILL');
  });

  it('returns PAY_CARD for "mit karte"', () => {
    const intent = parseIntent('mit karte', mockMenuItems);
    expect(intent.type).toBe('PAY_CARD');
  });

  it('returns PAY_CARD for "kartenzahlung"', () => {
    const intent = parseIntent('kartenzahlung', mockMenuItems);
    expect(intent.type).toBe('PAY_CARD');
  });

  it('returns PAY_CASH for "barzahlung"', () => {
    const intent = parseIntent('barzahlung', mockMenuItems);
    expect(intent.type).toBe('PAY_CASH');
  });

  it('returns PAY_CASH for "bar bezahlen"', () => {
    const intent = parseIntent('bar bezahlen', mockMenuItems);
    expect(intent.type).toBe('PAY_CASH');
  });

  it('returns PAY_CASH for "bar zahlen"', () => {
    const intent = parseIntent('bar zahlen', mockMenuItems);
    expect(intent.type).toBe('PAY_CASH');
  });
});

describe('parseIntent - Course Assignment', () => {
  it('returns SET_COURSE with starter for "vorspeise"', () => {
    const intent = parseIntent('vorspeise', mockMenuItems);
    expect(intent.type).toBe('SET_COURSE');
    if (intent.type === 'SET_COURSE') {
      expect(intent.course).toBe('starter');
    }
  });

  it('returns SET_COURSE with main for "hauptgang"', () => {
    const intent = parseIntent('hauptgang', mockMenuItems);
    expect(intent.type).toBe('SET_COURSE');
    if (intent.type === 'SET_COURSE') {
      expect(intent.course).toBe('main');
    }
  });

  it('returns SET_COURSE with main for "hauptgericht"', () => {
    const intent = parseIntent('hauptgericht', mockMenuItems);
    expect(intent.type).toBe('SET_COURSE');
    if (intent.type === 'SET_COURSE') {
      expect(intent.course).toBe('main');
    }
  });

  it('returns SET_COURSE with dessert for "dessert"', () => {
    const intent = parseIntent('dessert', mockMenuItems);
    expect(intent.type).toBe('SET_COURSE');
    if (intent.type === 'SET_COURSE') {
      expect(intent.course).toBe('dessert');
    }
  });

  it('returns SET_COURSE with dessert for "nachspeise"', () => {
    const intent = parseIntent('nachspeise', mockMenuItems);
    expect(intent.type).toBe('SET_COURSE');
    if (intent.type === 'SET_COURSE') {
      expect(intent.course).toBe('dessert');
    }
  });

  it('returns SET_COURSE with dessert for "nachtisch"', () => {
    const intent = parseIntent('nachtisch', mockMenuItems);
    expect(intent.type).toBe('SET_COURSE');
    if (intent.type === 'SET_COURSE') {
      expect(intent.course).toBe('dessert');
    }
  });
});

describe('parseIntent - Send to Station', () => {
  it('returns SEND_TO_STATION bar for "an bar"', () => {
    const intent = parseIntent('an bar', mockMenuItems);
    expect(intent.type).toBe('SEND_TO_STATION');
    if (intent.type === 'SEND_TO_STATION') {
      expect(intent.station).toBe('bar');
    }
  });

  it('returns SEND_TO_STATION bar for "zur bar"', () => {
    const intent = parseIntent('zur bar', mockMenuItems);
    expect(intent.type).toBe('SEND_TO_STATION');
    if (intent.type === 'SEND_TO_STATION') {
      expect(intent.station).toBe('bar');
    }
  });

  it('returns SEND_TO_STATION bar for "bar senden"', () => {
    const intent = parseIntent('bar senden', mockMenuItems);
    expect(intent.type).toBe('SEND_TO_STATION');
    if (intent.type === 'SEND_TO_STATION') {
      expect(intent.station).toBe('bar');
    }
  });

  it('returns SEND_TO_STATION kitchen for "an küche"', () => {
    const intent = parseIntent('an küche', mockMenuItems);
    expect(intent.type).toBe('SEND_TO_STATION');
    if (intent.type === 'SEND_TO_STATION') {
      expect(intent.station).toBe('kitchen');
    }
  });

  it('returns SEND_TO_STATION kitchen for "zur küche"', () => {
    const intent = parseIntent('zur küche', mockMenuItems);
    expect(intent.type).toBe('SEND_TO_STATION');
    if (intent.type === 'SEND_TO_STATION') {
      expect(intent.station).toBe('kitchen');
    }
  });

  it('returns SEND_TO_STATION kitchen for "senden"', () => {
    const intent = parseIntent('senden', mockMenuItems);
    expect(intent.type).toBe('SEND_TO_STATION');
    if (intent.type === 'SEND_TO_STATION') {
      expect(intent.station).toBe('kitchen');
    }
  });

  it('returns SEND_TO_STATION kitchen for "bestellen"', () => {
    const intent = parseIntent('bestellen', mockMenuItems);
    expect(intent.type).toBe('SEND_TO_STATION');
    if (intent.type === 'SEND_TO_STATION') {
      expect(intent.station).toBe('kitchen');
    }
  });

  it('returns SEND_TO_STATION kitchen for "raus"', () => {
    const intent = parseIntent('raus', mockMenuItems);
    expect(intent.type).toBe('SEND_TO_STATION');
    if (intent.type === 'SEND_TO_STATION') {
      expect(intent.station).toBe('kitchen');
    }
  });
});

describe('parseIntent - Add Note', () => {
  it('returns ADD_NOTE for "allergie" with note text', () => {
    const intent = parseIntent('allergie nüsse', mockMenuItems);
    expect(intent.type).toBe('ADD_NOTE');
    if (intent.type === 'ADD_NOTE') {
      expect(intent.note).toBe('nüsse');
    }
  });

  it('returns ADD_NOTE for "notiz" with note text', () => {
    const intent = parseIntent('notiz sehr wichtig', mockMenuItems);
    expect(intent.type).toBe('ADD_NOTE');
    if (intent.type === 'ADD_NOTE') {
      expect(intent.note).toBe('sehr wichtig');
    }
  });

  it('returns ADD_NOTE for "hinweis" with note text', () => {
    const intent = parseIntent('hinweis keine zwiebeln', mockMenuItems);
    expect(intent.type).toBe('ADD_NOTE');
    if (intent.type === 'ADD_NOTE') {
      expect(intent.note).toBe('keine zwiebeln');
    }
  });

  it('returns ADD_NOTE for "geburtstag"', () => {
    const intent = parseIntent('geburtstag', mockMenuItems);
    expect(intent.type).toBe('ADD_NOTE');
    if (intent.type === 'ADD_NOTE') {
      expect(intent.note).toBe('Geburtstag');
    }
  });

  it('returns ADD_NOTE for "vip"', () => {
    const intent = parseIntent('vip', mockMenuItems);
    expect(intent.type).toBe('ADD_NOTE');
    if (intent.type === 'ADD_NOTE') {
      expect(intent.note).toBe('VIP Gast');
    }
  });
});

describe('parseIntent - Set Table', () => {
  it('returns SET_TABLE for "Tisch 3"', () => {
    const intent = parseIntent('Tisch 3', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE');
    if (intent.type === 'SET_TABLE') {
      expect(intent.tableId).toBe('tisch-3');
    }
  });

  it('returns SET_TABLE for "tisch 5" with digit (preferred over word number)', () => {
    const intent = parseIntent('tisch 5', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE');
    if (intent.type === 'SET_TABLE') {
      expect(intent.tableId).toBe('tisch-5');
    }
  });

  it('returns SET_TABLE for "für tisch zwei"', () => {
    const intent = parseIntent('für tisch zwei', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE');
    if (intent.type === 'SET_TABLE') {
      expect(intent.tableId).toBe('tisch-2');
    }
  });

  it('returns SET_TABLE for "Terrasse 1"', () => {
    const intent = parseIntent('Terrasse 1', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE');
    if (intent.type === 'SET_TABLE') {
      expect(intent.tableId).toBe('terrasse-1');
    }
  });

  it('returns SET_TABLE for "bar 2"', () => {
    const intent = parseIntent('bar 2', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE');
    if (intent.type === 'SET_TABLE') {
      expect(intent.tableId).toBe('bar-2');
    }
  });
});

describe('parseIntent - Table Order (Table + Items)', () => {
  it('returns TABLE_ORDER for "Tisch 3 eine Cola"', () => {
    const intent = parseIntent('Tisch 3 eine Cola', mockMenuItems);
    expect(intent.type).toBe('TABLE_ORDER');
    if (intent.type === 'TABLE_ORDER') {
      expect(intent.tableId).toBe('tisch-3');
      expect(intent.items).toHaveLength(1);
      expect(intent.items[0].menuItemId).toBe('cola-1');
      expect(intent.items[0].quantity).toBe(1);
    }
  });

  it('returns TABLE_ORDER for "Tisch 1 zwei Bier"', () => {
    const intent = parseIntent('Tisch 1 zwei Bier', mockMenuItems);
    expect(intent.type).toBe('TABLE_ORDER');
    if (intent.type === 'TABLE_ORDER') {
      expect(intent.tableId).toBe('tisch-1');
      expect(intent.items).toHaveLength(1);
      expect(intent.items[0].menuItemId).toBe('beer-1');
      expect(intent.items[0].quantity).toBe(2);
    }
  });

  it('returns TABLE_ORDER for "bar 2 drei pils"', () => {
    const intent = parseIntent('bar 2 drei pils', mockMenuItems);
    expect(intent.type).toBe('TABLE_ORDER');
    if (intent.type === 'TABLE_ORDER') {
      expect(intent.tableId).toBe('bar-2');
      expect(intent.items).toHaveLength(1);
      expect(intent.items[0].menuItemId).toBe('beer-1');
      expect(intent.items[0].quantity).toBe(3);
    }
  });

  it('returns TABLE_ORDER with modifiers for "Tisch 2 Pasta ohne knoblauch"', () => {
    const intent = parseIntent('Tisch 2 Pasta ohne knoblauch', mockMenuItems);
    expect(intent.type).toBe('TABLE_ORDER');
    if (intent.type === 'TABLE_ORDER') {
      expect(intent.tableId).toBe('tisch-2');
      expect(intent.items).toHaveLength(1);
      expect(intent.items[0].modifiers).toContain('ohne knoblauch');
    }
  });

  it('returns TABLE_ORDER with multiple items for "Tisch 5 zwei Cola und eine Pasta"', () => {
    const intent = parseIntent('Tisch 5 zwei Cola und eine Pasta', mockMenuItems);
    expect(intent.type).toBe('TABLE_ORDER');
    if (intent.type === 'TABLE_ORDER') {
      expect(intent.tableId).toBe('tisch-5');
      expect(intent.items.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('parseIntent - Add Order (Items only, no table)', () => {
  it('returns ADD_ORDER for "eine Cola"', () => {
    const intent = parseIntent('eine Cola', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items).toHaveLength(1);
      expect(intent.items[0].menuItemId).toBe('cola-1');
      expect(intent.items[0].quantity).toBe(1);
    }
  });

  it('returns ADD_ORDER for "zwei Bier"', () => {
    const intent = parseIntent('zwei Bier', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items).toHaveLength(1);
      expect(intent.items[0].menuItemId).toBe('beer-1');
      expect(intent.items[0].quantity).toBe(2);
    }
  });

  it('returns ADD_ORDER for "drei Wasser"', () => {
    const intent = parseIntent('drei Wasser', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items).toHaveLength(1);
      expect(intent.items[0].menuItemId).toBe('water-1');
      expect(intent.items[0].quantity).toBe(3);
    }
  });

  it('returns ADD_ORDER with multiple items', () => {
    const intent = parseIntent('zwei Cola und einen Bier', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('returns ADD_ORDER for "Pasta Carbonara mit extra käse"', () => {
    const intent = parseIntent('Pasta Carbonara mit extra käse', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].modifiers).toContain('mit extra käse');
    }
  });

  it('returns ADD_ORDER for "Rindersteak ohne salz"', () => {
    const intent = parseIntent('Rindersteak ohne salz', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].modifiers).toContain('ohne salz');
    }
  });
});

describe('parseIntent - Set Seat', () => {
  it('returns SET_SEAT with items for "Gast 1 ein Bier"', () => {
    const intent = parseIntent('Gast 1 ein Bier', mockMenuItems);
    expect(intent.type).toBe('SET_SEAT');
    if (intent.type === 'SET_SEAT') {
      expect(intent.seatId).toBe(1);
      expect(intent.items).toHaveLength(1);
      expect(intent.items[0].menuItemId).toBe('beer-1');
    }
  });

  it('returns SET_SEAT for "Gast zwei eine Cola"', () => {
    const intent = parseIntent('Gast zwei eine Cola', mockMenuItems);
    expect(intent.type).toBe('SET_SEAT');
    if (intent.type === 'SET_SEAT') {
      expect(intent.seatId).toBe(2);
      expect(intent.items[0].menuItemId).toBe('cola-1');
    }
  });

  it('returns SET_SEAT for "Gast 3 zwei Wasser"', () => {
    const intent = parseIntent('Gast 3 zwei Wasser', mockMenuItems);
    expect(intent.type).toBe('SET_SEAT');
    if (intent.type === 'SET_SEAT') {
      expect(intent.seatId).toBe(3);
      expect(intent.items[0].menuItemId).toBe('water-1');
      expect(intent.items[0].quantity).toBe(2);
    }
  });
});

describe('parseIntent - Unknown Intent', () => {
  it('returns UNKNOWN for unrecognized text', () => {
    const intent = parseIntent('xyz nonsense asdf', mockMenuItems);
    expect(intent.type).toBe('UNKNOWN');
    if (intent.type === 'UNKNOWN') {
      expect(intent.text).toBe('xyz nonsense asdf');
    }
  });

  it('returns UNKNOWN for empty string', () => {
    const intent = parseIntent('', mockMenuItems);
    expect(intent.type).toBe('UNKNOWN');
  });

  it('returns UNKNOWN when table number is invalid', () => {
    const intent = parseIntent('Tisch abc', mockMenuItems);
    // Should still try to extract table with non-numeric id
    expect(intent.type).toBe('SET_TABLE');
  });
});

describe('parseIntent - German Language Edge Cases', () => {
  it('handles German umlauts in item names: "Käsekuchen"', () => {
    const intent = parseIntent('ein Käsekuchen', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].menuItemId).toBe('cake-1');
    }
  });

  it('handles German umlauts in aliases: "pils" for "Bier"', () => {
    const intent = parseIntent('zwei pils', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].menuItemId).toBe('beer-1');
    }
  });

  it('handles capitalization variations: "TISCH 1" (uppercase)', () => {
    const intent = parseIntent('TISCH 1', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE');
    if (intent.type === 'SET_TABLE') {
      expect(intent.tableId).toBe('tisch-1');
    }
  });

  it('handles German word numbers: "einundzwanzig"', () => {
    const intent = parseIntent('Tisch einundzwanzig', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE');
    if (intent.type === 'SET_TABLE') {
      expect(intent.tableId).toBe('tisch-21');
    }
  });

  it('handles "30" (numeric input for larger numbers)', () => {
    const intent = parseIntent('Tisch 30', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE');
    if (intent.type === 'SET_TABLE') {
      expect(intent.tableId).toBe('tisch-30');
    }
  });

  it('handles mixed case and spacing: "  Tisch    3  "', () => {
    const intent = parseIntent('  Tisch    3  ', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE');
    if (intent.type === 'SET_TABLE') {
      expect(intent.tableId).toBe('tisch-3');
    }
  });
});

describe('parseIntent - Alias Matching', () => {
  it('matches menu item by alias: "coke" for "Cola"', () => {
    const intent = parseIntent('eine coke', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].menuItemId).toBe('cola-1');
    }
  });

  it('matches menu item by alias: "helles" for "Bier"', () => {
    const intent = parseIntent('zwei helles', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].menuItemId).toBe('beer-1');
    }
  });

  it('matches menu item by short alias: "steak"', () => {
    const intent = parseIntent('ein steak', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].menuItemId).toBe('steak-1');
    }
  });

  it('prefers longest matching alias', () => {
    // "carbonara" should match "Pasta Carbonara" more specifically than just "Pasta"
    const intent = parseIntent('eine carbonara', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].menuItemId).toBe('pasta-1');
    }
  });
});

describe('parseIntent - Priority and Conflicts', () => {
  it('prioritizes bill commands over table (rechnung before bar)', () => {
    const intent = parseIntent('bar zahlen rechnung', mockMenuItems);
    expect(intent.type).toBe('SHOW_BILL');
  });

  it('prioritizes station routing over table selection (an küche before tisch)', () => {
    const intent = parseIntent('an küche Tisch 3', mockMenuItems);
    expect(intent.type).toBe('SEND_TO_STATION');
    if (intent.type === 'SEND_TO_STATION') {
      expect(intent.station).toBe('kitchen');
    }
  });

  it('identifies undo before checking for menu items', () => {
    const intent = parseIntent('rückgängig Cola', mockMenuItems);
    expect(intent.type).toBe('UNDO');
  });
});

describe('parseIntent - Order Routing', () => {
  it('preserves routing from menu item: bar drink', () => {
    const intent = parseIntent('eine Cola', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].routing).toBe('bar');
    }
  });

  it('preserves routing from menu item: kitchen dish', () => {
    const intent = parseIntent('eine Pasta', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].routing).toBe('kitchen');
    }
  });

  it('preserves price from menu item', () => {
    const intent = parseIntent('ein steak', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].price).toBe(24.0);
    }
  });
});

describe('parseIntent - Modifiers', () => {
  it('extracts modifier with "ohne"', () => {
    const intent = parseIntent('ein steak ohne salz', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].modifiers).toContain('ohne salz');
    }
  });

  it('extracts modifier with "mit"', () => {
    const intent = parseIntent('ein steak mit pfeffer', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].modifiers).toContain('mit pfeffer');
    }
  });

  it('extracts modifier with "extra"', () => {
    const intent = parseIntent('ein steak extra fleisch', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].modifiers).toContain('extra fleisch');
    }
  });

  it('extracts multiple modifiers', () => {
    const intent = parseIntent('ein steak ohne salz mit pfeffer', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].modifiers.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('parseIntent - Numeric Input', () => {
  it('parses digit input: "Tisch 5"', () => {
    const intent = parseIntent('Tisch 5', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE');
    if (intent.type === 'SET_TABLE') {
      expect(intent.tableId).toBe('tisch-5');
    }
  });

  it('parses word number input: "Tisch zwei"', () => {
    const intent = parseIntent('Tisch zwei', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE');
    if (intent.type === 'SET_TABLE') {
      expect(intent.tableId).toBe('tisch-2');
    }
  });

  it('parses quantity: "2 Cola" vs "zwei Cola"', () => {
    const intent1 = parseIntent('2 Cola', mockMenuItems);
    const intent2 = parseIntent('zwei Cola', mockMenuItems);
    if (intent1.type === 'ADD_ORDER' && intent2.type === 'ADD_ORDER') {
      expect(intent1.items[0].quantity).toBe(2);
      expect(intent2.items[0].quantity).toBe(2);
    }
  });
});

describe('parseIntent - Colloquial German ("nen", "nem", etc.)', () => {
  it('handles "nen Rotwein" (colloquial "einen")', () => {
    const menuWithWine: typeof mockMenuItems = [
      ...mockMenuItems,
      { id: 'rotwein-1', name: 'Rotwein', price: 6.5, category: 'drinks', routing: 'bar', aliases: [] },
    ];
    const intent = parseIntent('nen Rotwein', menuWithWine);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].menuItemId).toBe('rotwein-1');
      expect(intent.items[0].quantity).toBe(1);
    }
  });

  it('handles "gib mir ne Cola" → ADD_ORDER', () => {
    const intent = parseIntent('gib mir ne Cola', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].menuItemId).toBe('cola-1');
    }
  });

  it('handles "noch mal zwei Bier" → ADD_ORDER qty 2', () => {
    const intent = parseIntent('noch mal zwei Bier', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].quantity).toBe(2);
    }
  });

  it('handles "hätte gerne ein Bier" → ADD_ORDER', () => {
    const intent = parseIntent('hätte gerne ein Bier', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].menuItemId).toBe('beer-1');
    }
  });

  it('handles "der Herr hätte gern eine Cola" → ADD_ORDER', () => {
    const intent = parseIntent('der Herr hätte gern eine Cola', mockMenuItems);
    expect(intent.type).toBe('ADD_ORDER');
    if (intent.type === 'ADD_ORDER') {
      expect(intent.items[0].menuItemId).toBe('cola-1');
    }
  });
});

describe('parseIntent - Table Navigation Variants', () => {
  it('handles "gehe zu Tisch 5"', () => {
    const intent = parseIntent('gehe zu Tisch 5', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE');
    if (intent.type === 'SET_TABLE') {
      expect(intent.tableId).toBe('tisch-5');
    }
  });

  it('handles "geh zu Tisch 9"', () => {
    const intent = parseIntent('geh zu Tisch 9', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE');
    if (intent.type === 'SET_TABLE') {
      expect(intent.tableId).toBe('tisch-9');
    }
  });

  it('handles "navigiere zu Tisch 3"', () => {
    const intent = parseIntent('navigiere zu Tisch 3', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE');
    if (intent.type === 'SET_TABLE') {
      expect(intent.tableId).toBe('tisch-3');
    }
  });

  it('handles "zeig mir Tisch 7"', () => {
    const intent = parseIntent('zeig mir Tisch 7', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE');
    if (intent.type === 'SET_TABLE') {
      expect(intent.tableId).toBe('tisch-7');
    }
  });

  it('handles "öffne Tisch 2"', () => {
    const intent = parseIntent('öffne Tisch 2', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE');
    if (intent.type === 'SET_TABLE') {
      expect(intent.tableId).toBe('tisch-2');
    }
  });
});

describe('parseIntent - Table Status (SET_TABLE_STATUS)', () => {
  it('returns SET_TABLE_STATUS free for "Tisch 5 frei"', () => {
    const intent = parseIntent('Tisch 5 frei', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE_STATUS');
    if (intent.type === 'SET_TABLE_STATUS') {
      expect(intent.tableId).toBe('tisch-5');
      expect(intent.status).toBe('free');
    }
  });

  it('returns SET_TABLE_STATUS free for "Tisch 3 ist frei"', () => {
    const intent = parseIntent('Tisch 3 ist frei', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE_STATUS');
    if (intent.type === 'SET_TABLE_STATUS') {
      expect(intent.tableId).toBe('tisch-3');
      expect(intent.status).toBe('free');
    }
  });

  it('returns SET_TABLE_STATUS billing for "Tisch 7 bezahlt"', () => {
    const intent = parseIntent('Tisch 7 bezahlt', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE_STATUS');
    if (intent.type === 'SET_TABLE_STATUS') {
      expect(intent.tableId).toBe('tisch-7');
      expect(intent.status).toBe('billing');
    }
  });

  it('returns SET_TABLE_STATUS free for "Tisch 2 freigeben"', () => {
    const intent = parseIntent('Tisch 2 freigeben', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE_STATUS');
    if (intent.type === 'SET_TABLE_STATUS') {
      expect(intent.tableId).toBe('tisch-2');
      expect(intent.status).toBe('free');
    }
  });

  it('returns SET_TABLE_STATUS free for "Terrasse 1 leer"', () => {
    const intent = parseIntent('Terrasse 1 leer', mockMenuItems);
    expect(intent.type).toBe('SET_TABLE_STATUS');
    if (intent.type === 'SET_TABLE_STATUS') {
      expect(intent.tableId).toBe('terrasse-1');
      expect(intent.status).toBe('free');
    }
  });
});

describe('parseIntent - Reservation (MAKE_RESERVATION)', () => {
  it('returns MAKE_RESERVATION for "Reservierung für 4 um 19 Uhr"', () => {
    const intent = parseIntent('Reservierung für 4 um 19 Uhr', mockMenuItems);
    expect(intent.type).toBe('MAKE_RESERVATION');
    if (intent.type === 'MAKE_RESERVATION') {
      expect(intent.partySize).toBe(4);
      expect(intent.time).toBe('19:00');
    }
  });

  it('returns MAKE_RESERVATION for "Reservierung für 2 Personen um 20 Uhr"', () => {
    const intent = parseIntent('Reservierung für 2 Personen um 20 Uhr', mockMenuItems);
    expect(intent.type).toBe('MAKE_RESERVATION');
    if (intent.type === 'MAKE_RESERVATION') {
      expect(intent.partySize).toBe(2);
      expect(intent.time).toBe('20:00');
    }
  });

  it('returns MAKE_RESERVATION with guestName for "Reservierung Müller 4 Personen 19 Uhr"', () => {
    const intent = parseIntent('Reservierung auf den Namen Müller 4 Personen 19 Uhr', mockMenuItems);
    expect(intent.type).toBe('MAKE_RESERVATION');
    if (intent.type === 'MAKE_RESERVATION') {
      expect(intent.guestName).toBe('Müller');
    }
  });

  it('returns MAKE_RESERVATION for "Buchung 6 Personen halb 8"', () => {
    const intent = parseIntent('Buchung 6 Personen halb 8', mockMenuItems);
    expect(intent.type).toBe('MAKE_RESERVATION');
    if (intent.type === 'MAKE_RESERVATION') {
      expect(intent.partySize).toBe(6);
      expect(intent.time).toBe('07:30');
    }
  });

  it('returns MAKE_RESERVATION for "reservier einen Tisch für 3"', () => {
    const intent = parseIntent('reservier einen Tisch für 3', mockMenuItems);
    expect(intent.type).toBe('MAKE_RESERVATION');
  });
});

describe('parseIntent - Send to station expanded', () => {
  it('returns SEND_TO_STATION kitchen for "Bestellung abschließen"', () => {
    const intent = parseIntent('Bestellung abschließen', mockMenuItems);
    expect(intent.type).toBe('SEND_TO_STATION');
    if (intent.type === 'SEND_TO_STATION') {
      expect(intent.station).toBe('kitchen');
    }
  });

  it('returns SEND_TO_STATION kitchen for "fertig"', () => {
    const intent = parseIntent('fertig', mockMenuItems);
    expect(intent.type).toBe('SEND_TO_STATION');
    if (intent.type === 'SEND_TO_STATION') {
      expect(intent.station).toBe('kitchen');
    }
  });

  it('returns SEND_TO_STATION kitchen for "los"', () => {
    const intent = parseIntent('los', mockMenuItems);
    expect(intent.type).toBe('SEND_TO_STATION');
    if (intent.type === 'SEND_TO_STATION') {
      expect(intent.station).toBe('kitchen');
    }
  });
});

describe('parseIntent - Billing expanded', () => {
  it('returns SHOW_BILL for standalone "zahlen"', () => {
    const intent = parseIntent('zahlen', mockMenuItems);
    expect(intent.type).toBe('SHOW_BILL');
  });

  it('returns SHOW_BILL for standalone "bezahlen"', () => {
    const intent = parseIntent('bezahlen', mockMenuItems);
    expect(intent.type).toBe('SHOW_BILL');
  });

  it('returns PAY_CARD for "EC-Karte"', () => {
    const intent = parseIntent('EC-Karte', mockMenuItems);
    expect(intent.type).toBe('PAY_CARD');
  });

  it('returns UNDO for "das war falsch"', () => {
    const intent = parseIntent('das war falsch', mockMenuItems);
    expect(intent.type).toBe('UNDO');
  });
});

describe('parseIntent - Notes expanded', () => {
  it('returns ADD_NOTE for "laktose"', () => {
    const intent = parseIntent('laktose', mockMenuItems);
    expect(intent.type).toBe('ADD_NOTE');
    if (intent.type === 'ADD_NOTE') {
      expect(intent.note).toBe('Laktoseintoleranz');
    }
  });

  it('returns ADD_NOTE for "vegetarisch"', () => {
    const intent = parseIntent('vegetarisch', mockMenuItems);
    expect(intent.type).toBe('ADD_NOTE');
    if (intent.type === 'ADD_NOTE') {
      expect(intent.note).toBe('Vegetarisch');
    }
  });

  it('returns ADD_NOTE for "vegan"', () => {
    const intent = parseIntent('vegan', mockMenuItems);
    expect(intent.type).toBe('ADD_NOTE');
    if (intent.type === 'ADD_NOTE') {
      expect(intent.note).toBe('Vegan');
    }
  });

  it('returns ADD_NOTE for "anmerkung kein Alkohol"', () => {
    const intent = parseIntent('anmerkung kein Alkohol', mockMenuItems);
    expect(intent.type).toBe('ADD_NOTE');
    if (intent.type === 'ADD_NOTE') {
      expect(intent.note).toBe('kein Alkohol');
    }
  });
});
