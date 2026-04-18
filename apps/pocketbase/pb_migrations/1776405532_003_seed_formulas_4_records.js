/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("formulas");

  const record0 = new Record(collection);
    record0.set("name", "Midnight Rose");
    record0.set("code", "MR-001");
    record0.set("version", 1.0);
    record0.set("status", "active");
    record0.set("category", "perfume");
    record0.set("batch_size", 100);
    record0.set("batch_date", "2024-01-15");
    record0.set("markup_percentage", 60);
    record0.set("description", "A sophisticated floral perfume with woody base");
    record0.set("notes", "Best seller - high demand");
    record0.set("userId", "demo_user_001");
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
    record1.set("name", "Citrus Dream");
    record1.set("code", "CD-001");
    record1.set("version", 1.0);
    record1.set("status", "draft");
    record1.set("category", "eau_de_toilette");
    record1.set("batch_size", 250);
    record1.set("batch_date", "2024-01-20");
    record1.set("markup_percentage", 45);
    record1.set("description", "Fresh and vibrant citrus fragrance");
    record1.set("notes", "Under development");
    record1.set("userId", "demo_user_001");
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
    record2.set("name", "Amber Nights");
    record2.set("code", "AN-001");
    record2.set("version", 2.0);
    record2.set("status", "active");
    record2.set("category", "perfume");
    record2.set("batch_size", 150);
    record2.set("batch_date", "2024-01-10");
    record2.set("markup_percentage", 55);
    record2.set("description", "Warm amber and vanilla fragrance");
    record2.set("notes", "Reformulated version 2.0");
    record2.set("userId", "demo_user_001");
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
    record3.set("name", "Ocean Breeze");
    record3.set("code", "OB-001");
    record3.set("version", 1.0);
    record3.set("status", "archived");
    record3.set("category", "eau_de_cologne");
    record3.set("batch_size", 500);
    record3.set("batch_date", "2023-12-01");
    record3.set("markup_percentage", 40);
    record3.set("description", "Light aquatic fragrance");
    record3.set("notes", "Discontinued - archived");
    record3.set("userId", "demo_user_001");
  try {
    app.save(record3);
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
