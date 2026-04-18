/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("accords");

  const record0 = new Record(collection);
    record0.set("name", "Floral Blend");
    record0.set("notes", "Classic floral accord");
    record0.set("stock_quantity", 25);
    record0.set("cost_per_unit", 32.5);
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
    record1.set("name", "Woody Base");
    record1.set("notes", "Deep woody foundation");
    record1.set("stock_quantity", 18);
    record1.set("cost_per_unit", 28.75);
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
    record2.set("name", "Citrus Top");
    record2.set("notes", "Fresh citrus opening");
    record2.set("stock_quantity", 12);
    record2.set("cost_per_unit", 26.25);
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
