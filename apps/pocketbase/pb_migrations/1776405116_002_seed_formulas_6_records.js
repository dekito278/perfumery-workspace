/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("formulas");

  const record0 = new Record(collection);
    record0.set("name", "Midnight Elegance");
    record0.set("code", "ME001");
    record0.set("version", "1.0");
    record0.set("markup_percentage", 50);
    record0.set("notes", "Deep and mysterious");
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
    record1.set("name", "Summer Breeze");
    record1.set("code", "SB001");
    record1.set("version", "1.0");
    record1.set("markup_percentage", 45);
    record1.set("notes", "Light and fresh");
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
    record2.set("name", "Forest Walk");
    record2.set("code", "FW001");
    record2.set("version", "1.0");
    record2.set("markup_percentage", 55);
    record2.set("notes", "Earthy and grounding");
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
    record3.set("name", "Rose Garden");
    record3.set("code", "RG001");
    record3.set("version", "1.0");
    record3.set("markup_percentage", 60);
    record3.set("notes", "Floral and romantic");
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
    record4.set("name", "Spice Market");
    record4.set("code", "SM001");
    record4.set("version", "1.0");
    record4.set("markup_percentage", 50);
    record4.set("notes", "Warm and spicy");
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
    record5.set("name", "Velvet Dreams");
    record5.set("code", "VD001");
    record5.set("version", "1.0");
    record5.set("markup_percentage", 65);
    record5.set("notes", "Luxurious and sensual");
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
}, (app) => {
  // Rollback: record IDs not known, manual cleanup needed
})
