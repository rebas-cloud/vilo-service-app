import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock supabase before importing storage
vi.mock("@/utils/supabase", () => ({
  supabaseRegister: vi.fn(),
  supabaseGetRestaurant: vi.fn(),
  supabaseSaveConfig: vi.fn(),
  supabase: {},
}));

import {
  loadStorage,
  saveStorage,
  clearStorage,
  generateRestaurantCode,
  hashPassword,
  hasRestaurant,
  isSetupComplete,
  saveOwner,
  saveRestaurant,
  saveOnboardingStep,
  saveZones,
  saveTables,
  saveMenu,
  saveStaff,
  completeSetup,
  loadReservations,
  saveReservations,
  addReservation,
  updateReservation,
  deleteReservation,
  loadGuests,
  saveGuests,
  addGuest,
  updateGuest,
  deleteGuest,
  findGuestByPhone,
  addGuestVisit,
  addGuestNote,
  removeGuestNote,
  toggleGuestTag,
  loadWaitlist,
  saveWaitlist,
  addWaitlistEntry,
  updateWaitlistEntry,
  removeWaitlistEntry,
} from "./storage";
import type {
  OwnerAccount,
  Restaurant,
  Zone,
  Table,
  MenuItem,
  Staff,
  Reservation,
  Guest,
  GuestNote,
  GuestVisit,
  WaitlistEntry,
} from "@/types";

// ============================================================================
// Helper Functions
// ============================================================================

function makeOwner(): OwnerAccount {
  return {
    id: "owner-1",
    name: "Max Meier",
    email: "max@example.com",
    passwordHash: "hash123",
    restaurantId: "rest-1",
  };
}

function makeRestaurant(): Restaurant {
  return {
    id: "rest-1",
    name: "Test Restaurant",
    code: "ABC123",
    currency: "EUR",
    taxRate: 0.19,
  };
}

function makeZone(): Zone {
  return { id: "zone-1", name: "Main Hall" };
}

function makeTable(): Table {
  return {
    id: "table-1",
    name: "Table 1",
    zone: "zone-1",
    status: "free",
    seats: 4,
  };
}

function makeMenuItem(): MenuItem {
  return {
    id: "item-1",
    name: "Pasta",
    price: 12.5,
    category: "mains",
    routing: "kitchen",
  };
}

function makeStaff(): Staff {
  return {
    id: "staff-1",
    name: "John",
    pin: "1234",
    role: "waiter",
  };
}

function makeReservation(): Reservation {
  return {
    id: "res-1",
    guestName: "Alice",
    guestPhone: "+49 1234567890",
    partySize: 2,
    date: "2026-04-20",
    time: "19:00",
    duration: 90,
    status: "confirmed",
    source: "phone",
    createdAt: Date.now(),
  };
}

function makeGuest(): Guest {
  return {
    id: "guest-1",
    name: "Bob",
    phone: "+49 555123456",
    email: "bob@example.com",
    tags: [],
    notes: [],
    visits: [],
    totalVisits: 0,
    totalSpend: 0,
    createdAt: Date.now(),
  };
}

function makeGuestVisit(): GuestVisit {
  return {
    date: "2026-04-17",
    tableName: "Table 5",
    partySize: 4,
    revenue: 120.5,
    items: ["Pasta", "Salad"],
  };
}

function makeGuestNote(): GuestNote {
  return {
    id: "note-1",
    category: "general",
    text: "Prefers window seat",
    createdAt: Date.now(),
  };
}

function makeWaitlistEntry(): WaitlistEntry {
  return {
    id: "wait-1",
    guestName: "Charlie",
    guestPhone: "+49 555999888",
    partySize: 3,
    estimatedWaitMinutes: 30,
    status: "waiting",
    position: 1,
    addedAt: Date.now(),
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe("loadStorage / saveStorage / clearStorage", () => {
  it("loads default storage when localStorage is empty", () => {
    const result = loadStorage();
    expect(result).toEqual({
      owner: null,
      restaurant: null,
      zones: [],
      tables: [],
      tableCombinations: [],
      menu: [],
      staff: [],
      onboardingStep: 0,
      setupComplete: false,
    });
  });

  it("saves and loads storage with owner", () => {
    const owner = makeOwner();
    saveStorage({ owner });
    const result = loadStorage();
    expect(result.owner).toEqual(owner);
  });

  it("saves and loads storage with restaurant", () => {
    const restaurant = makeRestaurant();
    saveStorage({ restaurant });
    const result = loadStorage();
    expect(result.restaurant).toEqual(restaurant);
  });

  it("merges partial updates into existing storage", () => {
    const owner = makeOwner();
    const restaurant = makeRestaurant();
    saveStorage({ owner });
    saveStorage({ restaurant });
    const result = loadStorage();
    expect(result.owner).toEqual(owner);
    expect(result.restaurant).toEqual(restaurant);
  });

  it("saves zones, tables, menu, staff arrays", () => {
    const zones = [makeZone()];
    const tables = [makeTable()];
    const menu = [makeMenuItem()];
    const staff = [makeStaff()];
    saveStorage({ zones, tables, menu, staff });
    const result = loadStorage();
    expect(result.zones).toEqual(zones);
    expect(result.tables).toEqual(tables);
    expect(result.menu).toEqual(menu);
    expect(result.staff).toEqual(staff);
  });

  it("clears storage completely", () => {
    saveStorage({
      owner: makeOwner(),
      restaurant: makeRestaurant(),
    });
    clearStorage();
    const result = loadStorage();
    expect(result).toEqual({
      owner: null,
      restaurant: null,
      zones: [],
      tables: [],
      tableCombinations: [],
      menu: [],
      staff: [],
      onboardingStep: 0,
      setupComplete: false,
    });
  });

  it("returns default storage on parse error", () => {
    localStorage.setItem("vilo_data", "invalid json {");
    const result = loadStorage();
    expect(result.owner).toBeNull();
    expect(result.restaurant).toBeNull();
  });
});

describe("generateRestaurantCode", () => {
  it("generates 6-character code", () => {
    const code = generateRestaurantCode();
    expect(code).toHaveLength(6);
  });

  it("generates uppercase alphanumeric (no 0, O, 1, I)", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRestaurantCode();
      expect(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code)).toBe(true);
    }
  });

  it("generates different codes on multiple calls (high probability)", () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      codes.add(generateRestaurantCode());
    }
    // Extremely unlikely to get fewer than 99 unique codes from 100 random 6-char strings
    expect(codes.size).toBeGreaterThan(95);
  });
});

describe("hashPassword", () => {
  it("returns same hash for same input", async () => {
    const hash1 = await hashPassword("password123");
    const hash2 = await hashPassword("password123");
    expect(hash1).toBe(hash2);
  });

  it("returns different hash for different inputs", async () => {
    const hash1 = await hashPassword("password1");
    const hash2 = await hashPassword("password2");
    expect(hash1).not.toBe(hash2);
  });

  it("returns a non-empty string", async () => {
    const hash = await hashPassword("test");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("handles empty string", async () => {
    const hash = await hashPassword("");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("handles long strings", async () => {
    const longString = "a".repeat(1000);
    const hash = await hashPassword(longString);
    expect(typeof hash).toBe("string");
  });
});

describe("hasRestaurant / isSetupComplete", () => {
  beforeEach(() => {
    clearStorage();
  });

  it("hasRestaurant returns false when restaurant is null", () => {
    expect(hasRestaurant()).toBe(false);
  });

  it("hasRestaurant returns true when restaurant exists", () => {
    saveStorage({ restaurant: makeRestaurant() });
    expect(hasRestaurant()).toBe(true);
  });

  it("isSetupComplete returns false by default", () => {
    expect(isSetupComplete()).toBe(false);
  });

  it("isSetupComplete returns true when setupComplete is true", () => {
    saveStorage({ setupComplete: true });
    expect(isSetupComplete()).toBe(true);
  });
});

describe("saveOwner / saveRestaurant / saveOnboardingStep", () => {
  beforeEach(() => {
    clearStorage();
  });

  it("saveOwner saves owner to storage", () => {
    const owner = makeOwner();
    saveOwner(owner);
    const result = loadStorage();
    expect(result.owner).toEqual(owner);
  });

  it("saveRestaurant saves restaurant to storage", () => {
    const restaurant = makeRestaurant();
    saveRestaurant(restaurant);
    const result = loadStorage();
    expect(result.restaurant).toEqual(restaurant);
  });

  it("saveOnboardingStep updates onboarding step", () => {
    saveOnboardingStep(2);
    expect(loadStorage().onboardingStep).toBe(2);
  });
});

describe("saveZones / saveTables / saveMenu / saveStaff", () => {
  beforeEach(() => {
    clearStorage();
  });

  it("saveZones saves zones array", () => {
    const zones = [makeZone(), { id: "zone-2", name: "Patio" }];
    saveZones(zones);
    expect(loadStorage().zones).toEqual(zones);
  });

  it("saveTables saves tables array", () => {
    const tables = [makeTable(), { ...makeTable(), id: "table-2", name: "Table 2" }];
    saveTables(tables);
    expect(loadStorage().tables).toEqual(tables);
  });

  it("saveMenu saves menu array", () => {
    const menu = [makeMenuItem(), { ...makeMenuItem(), id: "item-2", name: "Pizza" }];
    saveMenu(menu);
    expect(loadStorage().menu).toEqual(menu);
  });

  it("saveStaff saves staff array", () => {
    const staff = [makeStaff(), { ...makeStaff(), id: "staff-2", name: "Jane" }];
    saveStaff(staff);
    expect(loadStorage().staff).toEqual(staff);
  });
});

describe("completeSetup", () => {
  beforeEach(() => {
    clearStorage();
  });

  it("sets setupComplete to true and onboardingStep to 4", () => {
    completeSetup();
    const result = loadStorage();
    expect(result.setupComplete).toBe(true);
    expect(result.onboardingStep).toBe(4);
  });
});

describe("Reservation CRUD", () => {
  beforeEach(() => {
    localStorage.removeItem("vilo_reservations");
  });

  it("loadReservations returns empty array when no data", () => {
    expect(loadReservations()).toEqual([]);
  });

  it("addReservation adds reservation and returns updated list", () => {
    const res = makeReservation();
    const result = addReservation(res);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(res);
  });

  it("loadReservations returns all added reservations", () => {
    const res1 = makeReservation();
    const res2 = { ...makeReservation(), id: "res-2", guestName: "Bob" };
    addReservation(res1);
    addReservation(res2);
    const result = loadReservations();
    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toEqual(["res-1", "res-2"]);
  });

  it("saveReservations replaces all reservations", () => {
    addReservation(makeReservation());
    const newList = [{ ...makeReservation(), id: "res-999" }];
    saveReservations(newList);
    expect(loadReservations()).toEqual(newList);
  });

  it("updateReservation modifies specific reservation", () => {
    const res = makeReservation();
    addReservation(res);
    updateReservation("res-1", { status: "seated" });
    const updated = loadReservations();
    expect(updated[0].status).toBe("seated");
    expect(updated[0].guestName).toBe("Alice");
  });

  it("updateReservation returns all reservations", () => {
    addReservation(makeReservation());
    const result = updateReservation("res-1", { partySize: 5 });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].partySize).toBe(5);
  });

  it("deleteReservation removes specific reservation", () => {
    addReservation(makeReservation());
    addReservation({ ...makeReservation(), id: "res-2" });
    const result = deleteReservation("res-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("res-2");
  });

  it("deleteReservation with non-existent id returns unchanged list", () => {
    addReservation(makeReservation());
    const result = deleteReservation("res-nonexistent");
    expect(result).toHaveLength(1);
  });

  it("returns empty array on parse error in loadReservations", () => {
    localStorage.setItem("vilo_reservations", "invalid json");
    expect(loadReservations()).toEqual([]);
  });
});

describe("Guest CRUD", () => {
  beforeEach(() => {
    localStorage.removeItem("vilo_guests");
  });

  it("loadGuests returns empty array when no data", () => {
    expect(loadGuests()).toEqual([]);
  });

  it("addGuest adds guest and returns updated list", () => {
    const guest = makeGuest();
    const result = addGuest(guest);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(guest);
  });

  it("loadGuests returns all added guests", () => {
    const guest1 = makeGuest();
    const guest2 = { ...makeGuest(), id: "guest-2", name: "Alice" };
    addGuest(guest1);
    addGuest(guest2);
    const result = loadGuests();
    expect(result).toHaveLength(2);
  });

  it("saveGuests replaces all guests", () => {
    addGuest(makeGuest());
    const newList = [{ ...makeGuest(), id: "guest-999" }];
    saveGuests(newList);
    expect(loadGuests()).toEqual(newList);
  });

  it("updateGuest modifies specific guest", () => {
    const guest = makeGuest();
    addGuest(guest);
    updateGuest("guest-1", { totalVisits: 5 });
    const updated = loadGuests();
    expect(updated[0].totalVisits).toBe(5);
    expect(updated[0].name).toBe("Bob");
  });

  it("deleteGuest removes specific guest", () => {
    addGuest(makeGuest());
    addGuest({ ...makeGuest(), id: "guest-2", name: "Alice" });
    const result = deleteGuest("guest-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("guest-2");
  });

  it("returns empty array on parse error in loadGuests", () => {
    localStorage.setItem("vilo_guests", "invalid json");
    expect(loadGuests()).toEqual([]);
  });
});

describe("findGuestByPhone", () => {
  beforeEach(() => {
    localStorage.removeItem("vilo_guests");
  });

  it("returns undefined when no guests", () => {
    expect(findGuestByPhone("+49 555123456")).toBeUndefined();
  });

  it("finds guest by exact phone match", () => {
    const guest = makeGuest();
    addGuest(guest);
    const found = findGuestByPhone("+49 555123456");
    expect(found).toEqual(guest);
  });

  it("normalizes phone with spaces", () => {
    const guest = { ...makeGuest(), phone: "+49 555 123 456" };
    addGuest(guest);
    const found = findGuestByPhone("+49555123456");
    expect(found).toEqual(guest);
  });

  it("converts +49 to 0 for normalization", () => {
    const guest = { ...makeGuest(), phone: "+49 555123456" };
    addGuest(guest);
    const found = findGuestByPhone("0 555123456");
    expect(found).toEqual(guest);
  });

  it("converts 0049 to 0 for normalization", () => {
    const guest = { ...makeGuest(), phone: "0049555123456" };
    addGuest(guest);
    const found = findGuestByPhone("0555123456");
    expect(found).toEqual(guest);
  });

  it("returns undefined for empty search string", () => {
    addGuest(makeGuest());
    expect(findGuestByPhone("")).toBeUndefined();
  });

  it("returns undefined for whitespace-only search string", () => {
    addGuest(makeGuest());
    expect(findGuestByPhone("   ")).toBeUndefined();
  });

  it("returns undefined when phone not found", () => {
    const guest = { ...makeGuest(), phone: "+49 555123456" };
    addGuest(guest);
    expect(findGuestByPhone("+49 999999999")).toBeUndefined();
  });

  it("ignores guests without phone", () => {
    const guest = { ...makeGuest(), phone: undefined };
    addGuest(guest);
    expect(findGuestByPhone("+49 555123456")).toBeUndefined();
  });
});

describe("addGuestVisit", () => {
  beforeEach(() => {
    localStorage.removeItem("vilo_guests");
  });

  it("appends visit to guest visits array", () => {
    const guest = makeGuest();
    addGuest(guest);
    const visit = makeGuestVisit();
    addGuestVisit("guest-1", visit);
    const updated = loadGuests()[0];
    expect(updated.visits).toHaveLength(1);
    expect(updated.visits[0]).toEqual(visit);
  });

  it("increments totalVisits", () => {
    const guest = { ...makeGuest(), totalVisits: 2 };
    addGuest(guest);
    const visit = makeGuestVisit();
    addGuestVisit("guest-1", visit);
    const updated = loadGuests()[0];
    expect(updated.totalVisits).toBe(3);
  });

  it("increments totalSpend", () => {
    const guest = { ...makeGuest(), totalSpend: 100 };
    addGuest(guest);
    const visit = { ...makeGuestVisit(), revenue: 50 };
    addGuestVisit("guest-1", visit);
    const updated = loadGuests()[0];
    expect(updated.totalSpend).toBe(150);
  });

  it("sets lastVisit to visit date", () => {
    const guest = makeGuest();
    addGuest(guest);
    const visit = { ...makeGuestVisit(), date: "2026-04-18" };
    addGuestVisit("guest-1", visit);
    const updated = loadGuests()[0];
    expect(updated.lastVisit).toBe("2026-04-18");
  });

  it("preserves other guests unchanged", () => {
    const other = { ...makeGuest(), id: "guest-2", name: "Alice" };
    addGuest(makeGuest());
    addGuest(other);
    const visit = makeGuestVisit();
    addGuestVisit("guest-1", visit);
    const guests = loadGuests();
    expect(guests[1]).toEqual(other);
  });
});

describe("addGuestNote / removeGuestNote", () => {
  beforeEach(() => {
    localStorage.removeItem("vilo_guests");
  });

  it("appends note to guest notes array", () => {
    const guest = makeGuest();
    addGuest(guest);
    const note = makeGuestNote();
    addGuestNote("guest-1", note);
    const updated = loadGuests()[0];
    expect(updated.notes).toHaveLength(1);
    expect(updated.notes[0]).toEqual(note);
  });

  it("removes note by id", () => {
    const guest = makeGuest();
    addGuest(guest);
    const note1 = makeGuestNote();
    const note2 = { ...makeGuestNote(), id: "note-2", text: "Another note" };
    addGuestNote("guest-1", note1);
    addGuestNote("guest-1", note2);
    removeGuestNote("guest-1", "note-1");
    const updated = loadGuests()[0];
    expect(updated.notes).toHaveLength(1);
    expect(updated.notes[0].id).toBe("note-2");
  });

  it("removeGuestNote does nothing if note not found", () => {
    const guest = makeGuest();
    addGuest(guest);
    const note = makeGuestNote();
    addGuestNote("guest-1", note);
    removeGuestNote("guest-1", "nonexistent");
    const updated = loadGuests()[0];
    expect(updated.notes).toHaveLength(1);
  });
});

describe("toggleGuestTag", () => {
  beforeEach(() => {
    localStorage.removeItem("vilo_guests");
  });

  it("adds tag when not present", () => {
    const guest = makeGuest();
    addGuest(guest);
    toggleGuestTag("guest-1", "vip");
    const updated = loadGuests()[0];
    expect(updated.tags).toContain("vip");
  });

  it("removes tag when present", () => {
    const guest: Guest = { ...makeGuest(), tags: ["vip"] };
    addGuest(guest);
    toggleGuestTag("guest-1", "vip");
    const updated = loadGuests()[0];
    expect(updated.tags).not.toContain("vip");
  });

  it("preserves other tags when toggling", () => {
    const guest: Guest = { ...makeGuest(), tags: ["vip", "stammgast"] };
    addGuest(guest);
    toggleGuestTag("guest-1", "vip");
    const updated = loadGuests()[0];
    expect(updated.tags).toEqual(["stammgast"]);
  });

  it("adds multiple tags via multiple toggles", () => {
    const guest = makeGuest();
    addGuest(guest);
    toggleGuestTag("guest-1", "vip");
    toggleGuestTag("guest-1", "stammgast");
    const updated = loadGuests()[0];
    expect(updated.tags).toEqual(["vip", "stammgast"]);
  });

  it("preserves other guests unchanged", () => {
    addGuest(makeGuest());
    addGuest({ ...makeGuest(), id: "guest-2", name: "Alice" });
    toggleGuestTag("guest-1", "vip");
    const guests = loadGuests();
    expect(guests[1].tags).toEqual([]);
  });
});

describe("Waitlist CRUD", () => {
  beforeEach(() => {
    localStorage.removeItem("vilo_waitlist");
  });

  it("loadWaitlist returns empty array when no data", () => {
    expect(loadWaitlist()).toEqual([]);
  });

  it("addWaitlistEntry adds entry and returns updated list", () => {
    const entry = makeWaitlistEntry();
    const result = addWaitlistEntry(entry);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(entry);
  });

  it("loadWaitlist returns all added entries", () => {
    const entry1 = makeWaitlistEntry();
    const entry2 = { ...makeWaitlistEntry(), id: "wait-2", guestName: "David" };
    addWaitlistEntry(entry1);
    addWaitlistEntry(entry2);
    const result = loadWaitlist();
    expect(result).toHaveLength(2);
  });

  it("saveWaitlist replaces all entries", () => {
    addWaitlistEntry(makeWaitlistEntry());
    const newList = [{ ...makeWaitlistEntry(), id: "wait-999" }];
    saveWaitlist(newList);
    expect(loadWaitlist()).toEqual(newList);
  });

  it("updateWaitlistEntry modifies specific entry", () => {
    const entry = makeWaitlistEntry();
    addWaitlistEntry(entry);
    updateWaitlistEntry("wait-1", { status: "seated" });
    const updated = loadWaitlist();
    expect(updated[0].status).toBe("seated");
    expect(updated[0].guestName).toBe("Charlie");
  });

  it("removeWaitlistEntry removes specific entry", () => {
    addWaitlistEntry(makeWaitlistEntry());
    addWaitlistEntry({ ...makeWaitlistEntry(), id: "wait-2", guestName: "David" });
    const result = removeWaitlistEntry("wait-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("wait-2");
  });

  it("returns empty array on parse error in loadWaitlist", () => {
    localStorage.setItem("vilo_waitlist", "invalid json");
    expect(loadWaitlist()).toEqual([]);
  });
});
