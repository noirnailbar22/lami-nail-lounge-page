import type { Property } from "@prisma/client";

export const prop = (p: Partial<Property> = {}): Property =>
  ({
    id: Math.random().toString(36).slice(2), source: "csv", sourceRef: null, sourceUrl: null, fetchedAt: new Date("2026-10-01"), isDemo: true,
    address: "1 Test St", city: "Pflugerville", state: "TX", zip: "78660", subdivision: null, lat: null, lng: null, propertyType: "single_family",
    status: "active", listPrice: 400000, listDate: null, pendingPrice: null, soldPrice: null, soldDate: null, estimatePrice: null, estimateSource: null,
    beds: 3, baths: 2, sqft: 2000, lotSqft: null, yearBuilt: 2010, garageSpaces: 2, pool: false, stories: 1, condition: null, remodeled: null,
    remodelYear: null, hoaMonthly: null, daysOnMarket: null, priceReduced: null, description: null, conflicts: [], raw: null,
    createdAt: new Date(), updatedAt: new Date(), ...p,
  }) as Property;

