/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("formula_items");

  const record0 = new Record(collection);
    const record0_formula_idLookup = app.findFirstRecordByFilter("formulas", "name='Signature Eau de Parfum'");
    if (!record0_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"name='Signature Eau de Parfum'\""); }
    record0.set("formula_id", record0_formula_idLookup.id);
    record0.set("item_type", "accord");
    const record0_item_idLookup = app.findFirstRecordByFilter("accords", "name='Floral Blend'");
    if (!record0_item_idLookup) { throw new Error("Lookup failed for item_id: no record in 'accords' matching \"name='Floral Blend'\""); }
    record0.set("item_id", record0_item_idLookup.id);
    record0.set("percentage", 40);
    record0.set("userId", "@request.auth.id");
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
    const record1_formula_idLookup = app.findFirstRecordByFilter("formulas", "name='Signature Eau de Parfum'");
    if (!record1_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"name='Signature Eau de Parfum'\""); }
    record1.set("formula_id", record1_formula_idLookup.id);
    record1.set("item_type", "accord");
    const record1_item_idLookup = app.findFirstRecordByFilter("accords", "name='Woody Base'");
    if (!record1_item_idLookup) { throw new Error("Lookup failed for item_id: no record in 'accords' matching \"name='Woody Base'\""); }
    record1.set("item_id", record1_item_idLookup.id);
    record1.set("percentage", 35);
    record1.set("userId", "@request.auth.id");
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
    const record2_formula_idLookup = app.findFirstRecordByFilter("formulas", "name='Signature Eau de Parfum'");
    if (!record2_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"name='Signature Eau de Parfum'\""); }
    record2.set("formula_id", record2_formula_idLookup.id);
    record2.set("item_type", "solvent");
    const record2_item_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Ethanol'");
    if (!record2_item_idLookup) { throw new Error("Lookup failed for item_id: no record in 'raw_materials' matching \"name='Ethanol'\""); }
    record2.set("item_id", record2_item_idLookup.id);
    record2.set("percentage", 25);
    record2.set("userId", "@request.auth.id");
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
    const record3_formula_idLookup = app.findFirstRecordByFilter("formulas", "name='Fresh Morning'");
    if (!record3_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"name='Fresh Morning'\""); }
    record3.set("formula_id", record3_formula_idLookup.id);
    record3.set("item_type", "accord");
    const record3_item_idLookup = app.findFirstRecordByFilter("accords", "name='Citrus Top'");
    if (!record3_item_idLookup) { throw new Error("Lookup failed for item_id: no record in 'accords' matching \"name='Citrus Top'\""); }
    record3.set("item_id", record3_item_idLookup.id);
    record3.set("percentage", 50);
    record3.set("userId", "@request.auth.id");
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
    const record4_formula_idLookup = app.findFirstRecordByFilter("formulas", "name='Fresh Morning'");
    if (!record4_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"name='Fresh Morning'\""); }
    record4.set("formula_id", record4_formula_idLookup.id);
    record4.set("item_type", "solvent");
    const record4_item_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Ethanol'");
    if (!record4_item_idLookup) { throw new Error("Lookup failed for item_id: no record in 'raw_materials' matching \"name='Ethanol'\""); }
    record4.set("item_id", record4_item_idLookup.id);
    record4.set("percentage", 50);
    record4.set("userId", "@request.auth.id");
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
    const record5_formula_idLookup = app.findFirstRecordByFilter("formulas", "name='Luxury Night'");
    if (!record5_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"name='Luxury Night'\""); }
    record5.set("formula_id", record5_formula_idLookup.id);
    record5.set("item_type", "accord");
    const record5_item_idLookup = app.findFirstRecordByFilter("accords", "name='Floral Blend'");
    if (!record5_item_idLookup) { throw new Error("Lookup failed for item_id: no record in 'accords' matching \"name='Floral Blend'\""); }
    record5.set("item_id", record5_item_idLookup.id);
    record5.set("percentage", 35);
    record5.set("userId", "@request.auth.id");
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
    const record6_formula_idLookup = app.findFirstRecordByFilter("formulas", "name='Luxury Night'");
    if (!record6_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"name='Luxury Night'\""); }
    record6.set("formula_id", record6_formula_idLookup.id);
    record6.set("item_type", "accord");
    const record6_item_idLookup = app.findFirstRecordByFilter("accords", "name='Woody Base'");
    if (!record6_item_idLookup) { throw new Error("Lookup failed for item_id: no record in 'accords' matching \"name='Woody Base'\""); }
    record6.set("item_id", record6_item_idLookup.id);
    record6.set("percentage", 40);
    record6.set("userId", "@request.auth.id");
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
    const record7_formula_idLookup = app.findFirstRecordByFilter("formulas", "name='Luxury Night'");
    if (!record7_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"name='Luxury Night'\""); }
    record7.set("formula_id", record7_formula_idLookup.id);
    record7.set("item_type", "raw_material");
    const record7_item_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Jasmine Absolute'");
    if (!record7_item_idLookup) { throw new Error("Lookup failed for item_id: no record in 'raw_materials' matching \"name='Jasmine Absolute'\""); }
    record7.set("item_id", record7_item_idLookup.id);
    record7.set("percentage", 15);
    record7.set("userId", "@request.auth.id");
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
    const record8_formula_idLookup = app.findFirstRecordByFilter("formulas", "name='Luxury Night'");
    if (!record8_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"name='Luxury Night'\""); }
    record8.set("formula_id", record8_formula_idLookup.id);
    record8.set("item_type", "solvent");
    const record8_item_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Ethanol'");
    if (!record8_item_idLookup) { throw new Error("Lookup failed for item_id: no record in 'raw_materials' matching \"name='Ethanol'\""); }
    record8.set("item_id", record8_item_idLookup.id);
    record8.set("percentage", 10);
    record8.set("userId", "@request.auth.id");
  try {
    app.save(record8);
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
