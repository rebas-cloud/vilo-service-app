import { Restaurant, Zone, Table, MenuItem, Staff } from '../types';

export const restaurant: Restaurant = {
  id: 'bella-vista',
  name: 'Bella Vista',
  code: 'DEMO42',
  currency: 'EUR',
  taxRate: 19,
};

export const zones: Zone[] = [
  { id: 'innen', name: 'Innen' },
  { id: 'terrasse', name: 'Terrasse' },
  { id: 'bar', name: 'Bar' },
];

export const tables: Table[] = [
  ...Array.from({ length: 15 }, (_, i) => ({
    id: `tisch-${i + 1}`,
    name: `Tisch ${i + 1}`,
    zone: 'innen',
    status: 'free' as const,
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `terrasse-${i + 1}`,
    name: `Terrasse ${i + 1}`,
    zone: 'terrasse',
    status: 'free' as const,
  })),
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `bar-${i + 1}`,
    name: `Bar ${i + 1}`,
    zone: 'bar',
    status: 'free' as const,
  })),
];

export const menu: MenuItem[] = [
  // Drinks
  { id: 'cola-klein', name: 'Cola klein', price: 2.80, category: 'drinks', routing: 'bar', aliases: ['cola', 'cola klein', 'kleine cola'] },
  { id: 'cola-gross', name: 'Cola groß', price: 3.50, category: 'drinks', routing: 'bar', aliases: ['cola groß', 'große cola', 'cola gross', 'grosse cola'] },
  { id: 'bier', name: 'Bier', price: 3.80, category: 'drinks', routing: 'bar', aliases: ['bier', 'ein bier', 'pils'] },
  { id: 'weissbier', name: 'Weißbier', price: 4.20, category: 'drinks', routing: 'bar', aliases: ['weißbier', 'weissbier', 'weizen'] },
  { id: 'wein-rot', name: 'Rotwein', price: 5.50, category: 'drinks', routing: 'bar', aliases: ['rotwein', 'wein rot', 'rot wein', 'roten wein'] },
  { id: 'wein-weiss', name: 'Weißwein', price: 5.50, category: 'drinks', routing: 'bar', aliases: ['weißwein', 'weisswein', 'wein weiß', 'weissen wein'] },
  { id: 'wasser', name: 'Wasser', price: 2.50, category: 'drinks', routing: 'bar', aliases: ['wasser', 'mineralwasser', 'stilles wasser'] },
  { id: 'espresso', name: 'Espresso', price: 2.20, category: 'drinks', routing: 'bar', aliases: ['espresso'] },
  { id: 'cappuccino', name: 'Cappuccino', price: 3.20, category: 'drinks', routing: 'bar', aliases: ['cappuccino'] },
  { id: 'apfelsaft', name: 'Apfelsaft', price: 3.00, category: 'drinks', routing: 'bar', aliases: ['apfelsaft', 'apfelschorle'] },
  { id: 'limo', name: 'Limonade', price: 2.80, category: 'drinks', routing: 'bar', aliases: ['limonade', 'limo'] },
  // Starters
  { id: 'bruschetta', name: 'Bruschetta', price: 6.50, category: 'starters', routing: 'kitchen', aliases: ['bruschetta'] },
  { id: 'suppe', name: 'Tagessuppe', price: 5.50, category: 'starters', routing: 'kitchen', aliases: ['suppe', 'tagessuppe'] },
  { id: 'salat', name: 'Gemischter Salat', price: 7.00, category: 'starters', routing: 'kitchen', aliases: ['salat', 'gemischter salat', 'großer salat'] },
  { id: 'antipasti', name: 'Antipasti', price: 8.50, category: 'starters', routing: 'kitchen', aliases: ['antipasti'] },
  // Mains
  { id: 'pizza-margherita', name: 'Pizza Margherita', price: 10.50, category: 'mains', routing: 'kitchen', aliases: ['pizza margherita', 'margherita'] },
  { id: 'pizza-salami', name: 'Pizza Salami', price: 11.50, category: 'mains', routing: 'kitchen', aliases: ['pizza salami', 'salami pizza', 'salami'] },
  { id: 'pizza-funghi', name: 'Pizza Funghi', price: 11.00, category: 'mains', routing: 'kitchen', aliases: ['pizza funghi', 'pilz pizza', 'funghi'] },
  { id: 'pasta-carbonara', name: 'Pasta Carbonara', price: 12.00, category: 'mains', routing: 'kitchen', aliases: ['pasta carbonara', 'carbonara', 'spaghetti carbonara'] },
  { id: 'pasta-bolognese', name: 'Pasta Bolognese', price: 11.50, category: 'mains', routing: 'kitchen', aliases: ['pasta bolognese', 'bolognese', 'spaghetti bolognese'] },
  { id: 'schnitzel', name: 'Wiener Schnitzel', price: 14.50, category: 'mains', routing: 'kitchen', aliases: ['schnitzel', 'wiener schnitzel'] },
  { id: 'steak', name: 'Rindersteak', price: 22.00, category: 'mains', routing: 'kitchen', aliases: ['steak', 'rindersteak'] },
  { id: 'lachs', name: 'Lachsfilet', price: 16.50, category: 'mains', routing: 'kitchen', aliases: ['lachs', 'lachsfilet', 'fisch'] },
  // Desserts
  { id: 'tiramisu', name: 'Tiramisu', price: 6.50, category: 'desserts', routing: 'kitchen', aliases: ['tiramisu'] },
  { id: 'eis', name: 'Gemischtes Eis', price: 5.00, category: 'desserts', routing: 'kitchen', aliases: ['eis', 'gemischtes eis', 'eiscreme'] },
  { id: 'panna-cotta', name: 'Panna Cotta', price: 6.00, category: 'desserts', routing: 'kitchen', aliases: ['panna cotta'] },
];

export const staff: Staff[] = [
  { id: 'max', name: 'Max', pin: '1234', role: 'waiter' },
  { id: 'anna', name: 'Anna', pin: '5678', role: 'waiter' },
  { id: 'chef', name: 'Marco', pin: '0000', role: 'manager' },
];
