/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("formula_items");

  const record0 = new Record(collection);
    const record0_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='ME001'");
    if (!record0_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='ME001'\""); }
    record0.set("formula_id", record0_formula_idLookup.id);
    record0.set("item_type", "raw_material");
    record0.set("item_id", "oud_oil");
    record0.set("percentage", 35);
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
    const record1_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='ME001'");
    if (!record1_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='ME001'\""); }
    record1.set("formula_id", record1_formula_idLookup.id);
    record1.set("item_type", "accord");
    record1.set("item_id", "dark_amber");
    record1.set("percentage", 40);
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
    const record2_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='ME001'");
    if (!record2_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='ME001'\""); }
    record2.set("formula_id", record2_formula_idLookup.id);
    record2.set("item_type", "solvent");
    record2.set("item_id", "alcohol");
    record2.set("percentage", 25);
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
    const record3_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='SB001'");
    if (!record3_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='SB001'\""); }
    record3.set("formula_id", record3_formula_idLookup.id);
    record3.set("item_type", "raw_material");
    record3.set("item_id", "lemon_oil");
    record3.set("percentage", 30);
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
    const record4_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='SB001'");
    if (!record4_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='SB001'\""); }
    record4.set("formula_id", record4_formula_idLookup.id);
    record4.set("item_type", "raw_material");
    record4.set("item_id", "bergamot_oil");
    record4.set("percentage", 25);
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
    const record5_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='SB001'");
    if (!record5_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='SB001'\""); }
    record5.set("formula_id", record5_formula_idLookup.id);
    record5.set("item_type", "accord");
    record5.set("item_id", "citrus_accord");
    record5.set("percentage", 20);
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
    const record6_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='SB001'");
    if (!record6_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='SB001'\""); }
    record6.set("formula_id", record6_formula_idLookup.id);
    record6.set("item_type", "solvent");
    record6.set("item_id", "alcohol");
    record6.set("percentage", 25);
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
    const record7_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='FW001'");
    if (!record7_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='FW001'\""); }
    record7.set("formula_id", record7_formula_idLookup.id);
    record7.set("item_type", "raw_material");
    record7.set("item_id", "cedarwood_oil");
    record7.set("percentage", 30);
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
    const record8_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='FW001'");
    if (!record8_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='FW001'\""); }
    record8.set("formula_id", record8_formula_idLookup.id);
    record8.set("item_type", "raw_material");
    record8.set("item_id", "vetiver_oil");
    record8.set("percentage", 25);
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
    const record9_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='FW001'");
    if (!record9_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='FW001'\""); }
    record9.set("formula_id", record9_formula_idLookup.id);
    record9.set("item_type", "accord");
    record9.set("item_id", "woody_accord");
    record9.set("percentage", 20);
  try {
    app.save(record9);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record10 = new Record(collection);
    const record10_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='FW001'");
    if (!record10_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='FW001'\""); }
    record10.set("formula_id", record10_formula_idLookup.id);
    record10.set("item_type", "solvent");
    record10.set("item_id", "alcohol");
    record10.set("percentage", 25);
  try {
    app.save(record10);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record11 = new Record(collection);
    const record11_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='RG001'");
    if (!record11_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='RG001'\""); }
    record11.set("formula_id", record11_formula_idLookup.id);
    record11.set("item_type", "raw_material");
    record11.set("item_id", "rose_oil");
    record11.set("percentage", 40);
  try {
    app.save(record11);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record12 = new Record(collection);
    const record12_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='RG001'");
    if (!record12_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='RG001'\""); }
    record12.set("formula_id", record12_formula_idLookup.id);
    record12.set("item_type", "raw_material");
    record12.set("item_id", "geranium_oil");
    record12.set("percentage", 15);
  try {
    app.save(record12);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record13 = new Record(collection);
    const record13_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='RG001'");
    if (!record13_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='RG001'\""); }
    record13.set("formula_id", record13_formula_idLookup.id);
    record13.set("item_type", "accord");
    record13.set("item_id", "floral_accord");
    record13.set("percentage", 20);
  try {
    app.save(record13);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record14 = new Record(collection);
    const record14_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='RG001'");
    if (!record14_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='RG001'\""); }
    record14.set("formula_id", record14_formula_idLookup.id);
    record14.set("item_type", "solvent");
    record14.set("item_id", "alcohol");
    record14.set("percentage", 25);
  try {
    app.save(record14);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record15 = new Record(collection);
    const record15_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='SM001'");
    if (!record15_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='SM001'\""); }
    record15.set("formula_id", record15_formula_idLookup.id);
    record15.set("item_type", "raw_material");
    record15.set("item_id", "cinnamon_oil");
    record15.set("percentage", 25);
  try {
    app.save(record15);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record16 = new Record(collection);
    const record16_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='SM001'");
    if (!record16_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='SM001'\""); }
    record16.set("formula_id", record16_formula_idLookup.id);
    record16.set("item_type", "raw_material");
    record16.set("item_id", "clove_oil");
    record16.set("percentage", 20);
  try {
    app.save(record16);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record17 = new Record(collection);
    const record17_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='SM001'");
    if (!record17_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='SM001'\""); }
    record17.set("formula_id", record17_formula_idLookup.id);
    record17.set("item_type", "accord");
    record17.set("item_id", "spice_accord");
    record17.set("percentage", 30);
  try {
    app.save(record17);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record18 = new Record(collection);
    const record18_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='SM001'");
    if (!record18_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='SM001'\""); }
    record18.set("formula_id", record18_formula_idLookup.id);
    record18.set("item_type", "solvent");
    record18.set("item_id", "alcohol");
    record18.set("percentage", 25);
  try {
    app.save(record18);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record19 = new Record(collection);
    const record19_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='VD001'");
    if (!record19_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='VD001'\""); }
    record19.set("formula_id", record19_formula_idLookup.id);
    record19.set("item_type", "raw_material");
    record19.set("item_id", "sandalwood_oil");
    record19.set("percentage", 30);
  try {
    app.save(record19);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record20 = new Record(collection);
    const record20_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='VD001'");
    if (!record20_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='VD001'\""); }
    record20.set("formula_id", record20_formula_idLookup.id);
    record20.set("item_type", "raw_material");
    record20.set("item_id", "musk_oil");
    record20.set("percentage", 20);
  try {
    app.save(record20);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record21 = new Record(collection);
    const record21_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='VD001'");
    if (!record21_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='VD001'\""); }
    record21.set("formula_id", record21_formula_idLookup.id);
    record21.set("item_type", "accord");
    record21.set("item_id", "gourmand_accord");
    record21.set("percentage", 25);
  try {
    app.save(record21);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record22 = new Record(collection);
    const record22_formula_idLookup = app.findFirstRecordByFilter("formulas", "code='VD001'");
    if (!record22_formula_idLookup) { throw new Error("Lookup failed for formula_id: no record in 'formulas' matching \"code='VD001'\""); }
    record22.set("formula_id", record22_formula_idLookup.id);
    record22.set("item_type", "solvent");
    record22.set("item_id", "alcohol");
    record22.set("percentage", 25);
  try {
    app.save(record22);
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
