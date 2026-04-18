/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("raw_materials");

  const record0 = new Record(collection);
    record0.set("name", "Rose Absolute");
    record0.set("category", "floral");
    record0.set("type", "material");
    record0.set("stock_quantity", 500);
    record0.set("unit", "ml");
    record0.set("cost_per_unit", 45.0);
    record0.set("supplier_name", "Grasse Imports");
    record0.set("minimum_stock", 200);
    const record0_userIdLookup = app.findFirstRecordByFilter("users", "email='demo@fragrance.local'");
    if (!record0_userIdLookup) { throw new Error("Lookup failed for userId: no record in 'users' matching \"email='demo@fragrance.local'\""); }
    record0.set("userId", record0_userIdLookup.id);
  try {
    app.save(record0);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record1 = new Record(collection);
    record1.set("name", "Sandalwood Oil");
    record1.set("category", "woody");
    record1.set("type", "material");
    record1.set("stock_quantity", 300);
    record1.set("unit", "ml");
    record1.set("cost_per_unit", 38.5);
    record1.set("supplier_name", "India Botanicals");
    record1.set("minimum_stock", 150);
    const record1_userIdLookup = app.findFirstRecordByFilter("users", "email='demo@fragrance.local'");
    if (!record1_userIdLookup) { throw new Error("Lookup failed for userId: no record in 'users' matching \"email='demo@fragrance.local'\""); }
    record1.set("userId", record1_userIdLookup.id);
  try {
    app.save(record1);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record2 = new Record(collection);
    record2.set("name", "Bergamot Oil");
    record2.set("category", "citrus");
    record2.set("type", "material");
    record2.set("stock_quantity", 150);
    record2.set("unit", "ml");
    record2.set("cost_per_unit", 22.0);
    record2.set("supplier_name", "Sicily Citrus");
    record2.set("minimum_stock", 200);
    record2.set("notes", "LOW STOCK");
    const record2_userIdLookup = app.findFirstRecordByFilter("users", "email='demo@fragrance.local'");
    if (!record2_userIdLookup) { throw new Error("Lookup failed for userId: no record in 'users' matching \"email='demo@fragrance.local'\""); }
    record2.set("userId", record2_userIdLookup.id);
  try {
    app.save(record2);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record3 = new Record(collection);
    record3.set("name", "Musk Compound");
    record3.set("category", "musk");
    record3.set("type", "material");
    record3.set("stock_quantity", 80);
    record3.set("unit", "ml");
    record3.set("cost_per_unit", 55.0);
    record3.set("supplier_name", "Synthetic Labs");
    record3.set("minimum_stock", 100);
    record3.set("notes", "LOW STOCK");
    const record3_userIdLookup = app.findFirstRecordByFilter("users", "email='demo@fragrance.local'");
    if (!record3_userIdLookup) { throw new Error("Lookup failed for userId: no record in 'users' matching \"email='demo@fragrance.local'\""); }
    record3.set("userId", record3_userIdLookup.id);
  try {
    app.save(record3);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record4 = new Record(collection);
    record4.set("name", "Vanilla Extract");
    record4.set("category", "gourmand");
    record4.set("type", "material");
    record4.set("stock_quantity", 400);
    record4.set("unit", "ml");
    record4.set("cost_per_unit", 18.0);
    record4.set("supplier_name", "Madagascar Spice");
    record4.set("minimum_stock", 250);
    const record4_userIdLookup = app.findFirstRecordByFilter("users", "email='demo@fragrance.local'");
    if (!record4_userIdLookup) { throw new Error("Lookup failed for userId: no record in 'users' matching \"email='demo@fragrance.local'\""); }
    record4.set("userId", record4_userIdLookup.id);
  try {
    app.save(record4);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record5 = new Record(collection);
    record5.set("name", "Patchouli Oil");
    record5.set("category", "woody");
    record5.set("type", "material");
    record5.set("stock_quantity", 220);
    record5.set("unit", "ml");
    record5.set("cost_per_unit", 32.0);
    record5.set("supplier_name", "Indonesia Botanicals");
    record5.set("minimum_stock", 200);
    const record5_userIdLookup = app.findFirstRecordByFilter("users", "email='demo@fragrance.local'");
    if (!record5_userIdLookup) { throw new Error("Lookup failed for userId: no record in 'users' matching \"email='demo@fragrance.local'\""); }
    record5.set("userId", record5_userIdLookup.id);
  try {
    app.save(record5);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record6 = new Record(collection);
    record6.set("name", "Ethanol 96%");
    record6.set("category", "solvent");
    record6.set("type", "solvent");
    record6.set("stock_quantity", 2000);
    record6.set("unit", "ml");
    record6.set("cost_per_unit", 8.5);
    record6.set("supplier_name", "Chemical Supplier");
    record6.set("minimum_stock", 1000);
    const record6_userIdLookup = app.findFirstRecordByFilter("users", "email='demo@fragrance.local'");
    if (!record6_userIdLookup) { throw new Error("Lookup failed for userId: no record in 'users' matching \"email='demo@fragrance.local'\""); }
    record6.set("userId", record6_userIdLookup.id);
  try {
    app.save(record6);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record7 = new Record(collection);
    record7.set("name", "Lemon Oil");
    record7.set("category", "citrus");
    record7.set("type", "material");
    record7.set("stock_quantity", 100);
    record7.set("unit", "ml");
    record7.set("cost_per_unit", 19.5);
    record7.set("supplier_name", "Sicily Citrus");
    record7.set("minimum_stock", 150);
    record7.set("notes", "LOW STOCK");
    const record7_userIdLookup = app.findFirstRecordByFilter("users", "email='demo@fragrance.local'");
    if (!record7_userIdLookup) { throw new Error("Lookup failed for userId: no record in 'users' matching \"email='demo@fragrance.local'\""); }
    record7.set("userId", record7_userIdLookup.id);
  try {
    app.save(record7);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record8 = new Record(collection);
    record8.set("name", "Jasmine Absolute");
    record8.set("category", "floral");
    record8.set("type", "material");
    record8.set("stock_quantity", 350);
    record8.set("unit", "ml");
    record8.set("cost_per_unit", 52.0);
    record8.set("supplier_name", "Grasse Imports");
    record8.set("minimum_stock", 200);
    const record8_userIdLookup = app.findFirstRecordByFilter("users", "email='demo@fragrance.local'");
    if (!record8_userIdLookup) { throw new Error("Lookup failed for userId: no record in 'users' matching \"email='demo@fragrance.local'\""); }
    record8.set("userId", record8_userIdLookup.id);
  try {
    app.save(record8);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record9 = new Record(collection);
    record9.set("name", "Cedarwood Oil");
    record9.set("category", "woody");
    record9.set("type", "material");
    record9.set("stock_quantity", 280);
    record9.set("unit", "ml");
    record9.set("cost_per_unit", 28.0);
    record9.set("supplier_name", "India Botanicals");
    record9.set("minimum_stock", 150);
    const record9_userIdLookup = app.findFirstRecordByFilter("users", "email='demo@fragrance.local'");
    if (!record9_userIdLookup) { throw new Error("Lookup failed for userId: no record in 'users' matching \"email='demo@fragrance.local'\""); }
    record9.set("userId", record9_userIdLookup.id);
  try {
    app.save(record9);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }
}, (app) => {
  // Rollback: record IDs not known, manual cleanup needed
})
