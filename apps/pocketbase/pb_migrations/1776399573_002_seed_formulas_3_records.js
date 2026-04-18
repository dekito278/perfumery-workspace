/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("formulas");

  const record0 = new Record(collection);
    record0.set("name", "Signature Eau de Parfum");
    record0.set("code", "SIG-001");
    record0.set("version", "1.0");
    record0.set("notes", "Premium signature scent");
    record0.set("markup_percentage", 150);
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
    record1.set("name", "Fresh Morning");
    record1.set("code", "FRESH-001");
    record1.set("version", "1.0");
    record1.set("notes", "Light daily fragrance");
    record1.set("markup_percentage", 120);
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
    record2.set("name", "Luxury Night");
    record2.set("code", "LUX-001");
    record2.set("version", "1.0");
    record2.set("notes", "Evening luxury scent");
    record2.set("markup_percentage", 180);
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
}, (app) => {
  // Rollback: record IDs not known, manual cleanup needed
})
