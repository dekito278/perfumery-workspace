/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("stock_logs");

  const record0 = new Record(collection);
    record0.set("date", "2026-04-10");
    record0.set("log_type", "batch production");
    const record0_material_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Rose Absolute'");
    if (!record0_material_idLookup) { throw new Error("Lookup failed for material_id: no record in 'raw_materials' matching \"name='Rose Absolute'\""); }
    record0.set("material_id", record0_material_idLookup.id);
    record0.set("quantity_change", -40);
    record0.set("notes", "Batch-001 production");
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
    record1.set("date", "2026-04-10");
    record1.set("log_type", "batch production");
    const record1_material_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Bergamot Oil'");
    if (!record1_material_idLookup) { throw new Error("Lookup failed for material_id: no record in 'raw_materials' matching \"name='Bergamot Oil'\""); }
    record1.set("material_id", record1_material_idLookup.id);
    record1.set("quantity_change", -25);
    record1.set("notes", "Batch-001 production");
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
    record2.set("date", "2026-04-12");
    record2.set("log_type", "manual adjustment");
    const record2_material_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Sandalwood'");
    if (!record2_material_idLookup) { throw new Error("Lookup failed for material_id: no record in 'raw_materials' matching \"name='Sandalwood'\""); }
    record2.set("material_id", record2_material_idLookup.id);
    record2.set("quantity_change", 10);
    record2.set("notes", "Restock from supplier");
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
    record3.set("date", "2026-04-15");
    record3.set("log_type", "accord production");
    const record3_accord_idLookup = app.findFirstRecordByFilter("accords", "name='Floral Blend'");
    if (!record3_accord_idLookup) { throw new Error("Lookup failed for accord_id: no record in 'accords' matching \"name='Floral Blend'\""); }
    record3.set("accord_id", record3_accord_idLookup.id);
    record3.set("quantity_change", 5);
    record3.set("notes", "Accord batch production");
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
    record4.set("date", "2026-04-16");
    record4.set("log_type", "manual adjustment");
    const record4_material_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Lemon Oil'");
    if (!record4_material_idLookup) { throw new Error("Lookup failed for material_id: no record in 'raw_materials' matching \"name='Lemon Oil'\""); }
    record4.set("material_id", record4_material_idLookup.id);
    record4.set("quantity_change", -2);
    record4.set("notes", "Spillage adjustment");
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
}, (app) => {
  // Rollback: record IDs not known, manual cleanup needed
})
