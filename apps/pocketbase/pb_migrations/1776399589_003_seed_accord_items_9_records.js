/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("accord_items");

  const record0 = new Record(collection);
    const record0_accord_idLookup = app.findFirstRecordByFilter("accords", "name='Floral Blend'");
    if (!record0_accord_idLookup) { throw new Error("Lookup failed for accord_id: no record in 'accords' matching \"name='Floral Blend'\""); }
    record0.set("accord_id", record0_accord_idLookup.id);
    const record0_raw_material_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Rose Absolute'");
    if (!record0_raw_material_idLookup) { throw new Error("Lookup failed for raw_material_id: no record in 'raw_materials' matching \"name='Rose Absolute'\""); }
    record0.set("raw_material_id", record0_raw_material_idLookup.id);
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
    const record1_accord_idLookup = app.findFirstRecordByFilter("accords", "name='Floral Blend'");
    if (!record1_accord_idLookup) { throw new Error("Lookup failed for accord_id: no record in 'accords' matching \"name='Floral Blend'\""); }
    record1.set("accord_id", record1_accord_idLookup.id);
    const record1_raw_material_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Jasmine Absolute'");
    if (!record1_raw_material_idLookup) { throw new Error("Lookup failed for raw_material_id: no record in 'raw_materials' matching \"name='Jasmine Absolute'\""); }
    record1.set("raw_material_id", record1_raw_material_idLookup.id);
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
    const record2_accord_idLookup = app.findFirstRecordByFilter("accords", "name='Floral Blend'");
    if (!record2_accord_idLookup) { throw new Error("Lookup failed for accord_id: no record in 'accords' matching \"name='Floral Blend'\""); }
    record2.set("accord_id", record2_accord_idLookup.id);
    const record2_raw_material_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Musk Synthetic'");
    if (!record2_raw_material_idLookup) { throw new Error("Lookup failed for raw_material_id: no record in 'raw_materials' matching \"name='Musk Synthetic'\""); }
    record2.set("raw_material_id", record2_raw_material_idLookup.id);
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
    const record3_accord_idLookup = app.findFirstRecordByFilter("accords", "name='Woody Base'");
    if (!record3_accord_idLookup) { throw new Error("Lookup failed for accord_id: no record in 'accords' matching \"name='Woody Base'\""); }
    record3.set("accord_id", record3_accord_idLookup.id);
    const record3_raw_material_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Sandalwood'");
    if (!record3_raw_material_idLookup) { throw new Error("Lookup failed for raw_material_id: no record in 'raw_materials' matching \"name='Sandalwood'\""); }
    record3.set("raw_material_id", record3_raw_material_idLookup.id);
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
    const record4_accord_idLookup = app.findFirstRecordByFilter("accords", "name='Woody Base'");
    if (!record4_accord_idLookup) { throw new Error("Lookup failed for accord_id: no record in 'accords' matching \"name='Woody Base'\""); }
    record4.set("accord_id", record4_accord_idLookup.id);
    const record4_raw_material_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Cedarwood'");
    if (!record4_raw_material_idLookup) { throw new Error("Lookup failed for raw_material_id: no record in 'raw_materials' matching \"name='Cedarwood'\""); }
    record4.set("raw_material_id", record4_raw_material_idLookup.id);
    record4.set("percentage", 30);
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
    const record5_accord_idLookup = app.findFirstRecordByFilter("accords", "name='Woody Base'");
    if (!record5_accord_idLookup) { throw new Error("Lookup failed for accord_id: no record in 'accords' matching \"name='Woody Base'\""); }
    record5.set("accord_id", record5_accord_idLookup.id);
    const record5_raw_material_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Patchouli'");
    if (!record5_raw_material_idLookup) { throw new Error("Lookup failed for raw_material_id: no record in 'raw_materials' matching \"name='Patchouli'\""); }
    record5.set("raw_material_id", record5_raw_material_idLookup.id);
    record5.set("percentage", 20);
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
    const record6_accord_idLookup = app.findFirstRecordByFilter("accords", "name='Citrus Top'");
    if (!record6_accord_idLookup) { throw new Error("Lookup failed for accord_id: no record in 'accords' matching \"name='Citrus Top'\""); }
    record6.set("accord_id", record6_accord_idLookup.id);
    const record6_raw_material_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Bergamot Oil'");
    if (!record6_raw_material_idLookup) { throw new Error("Lookup failed for raw_material_id: no record in 'raw_materials' matching \"name='Bergamot Oil'\""); }
    record6.set("raw_material_id", record6_raw_material_idLookup.id);
    record6.set("percentage", 50);
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
    const record7_accord_idLookup = app.findFirstRecordByFilter("accords", "name='Citrus Top'");
    if (!record7_accord_idLookup) { throw new Error("Lookup failed for accord_id: no record in 'accords' matching \"name='Citrus Top'\""); }
    record7.set("accord_id", record7_accord_idLookup.id);
    const record7_raw_material_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Lemon Oil'");
    if (!record7_raw_material_idLookup) { throw new Error("Lookup failed for raw_material_id: no record in 'raw_materials' matching \"name='Lemon Oil'\""); }
    record7.set("raw_material_id", record7_raw_material_idLookup.id);
    record7.set("percentage", 35);
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
    const record8_accord_idLookup = app.findFirstRecordByFilter("accords", "name='Citrus Top'");
    if (!record8_accord_idLookup) { throw new Error("Lookup failed for accord_id: no record in 'accords' matching \"name='Citrus Top'\""); }
    record8.set("accord_id", record8_accord_idLookup.id);
    const record8_raw_material_idLookup = app.findFirstRecordByFilter("raw_materials", "name='Ethanol'");
    if (!record8_raw_material_idLookup) { throw new Error("Lookup failed for raw_material_id: no record in 'raw_materials' matching \"name='Ethanol'\""); }
    record8.set("raw_material_id", record8_raw_material_idLookup.id);
    record8.set("percentage", 15);
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
