// Table status display metadata — colors and service status labels.

export const SERVICE_STATUS_SHORT: Record<string, string> = {
  teilweise_platziert: 'Teilw.',
  platziert: 'Platziert',
  getraenke: 'Getränke',
  vorspeise: 'Vorspeise',
  hauptgericht: 'Hauptgang',
  dessert: 'Dessert',
  gang_1: '1.Gang', gang_2: '2.Gang', gang_3: '3.Gang', gang_4: '4.Gang',
  gang_5: '5.Gang', gang_6: '6.Gang', gang_7: '7.Gang', gang_8: '8.Gang',
  gang_9: '9.Gang', gang_10: '10.Gang', gang_11: '11.Gang', gang_12: '12.Gang',
  digestif: 'Digestif',
  flaschenservice: 'Flasche',
  rechnung_faellig: 'Rechnung',
  bezahlt: 'Bezahlt',
  restaurantleiter: 'Manager!',
  abraeumen: 'Abraeumen',
  abgeraeumt: 'Abgeraeumt',
  beendet: 'Beendet',
};

export const TABLE_STATUS_META = {
  free: { color: '#4a4664', glow: 'rgba(139,92,246,0.18)' },
  occupied: { color: '#8b5cf6', glow: 'rgba(139,92,246,0.4)' },
  billing: { color: '#f59e0b', glow: 'rgba(245,158,11,0.45)' },
  blocked: { color: '#ef4444', glow: 'rgba(239,68,68,0.45)' },
} as const;
