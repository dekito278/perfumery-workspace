/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("accords");

  const record0 = new Record(collection);
    record0.set("name", "Floral Bouquet");
    record0.set("description", "A harmonious blend of rose and jasmine with sandalwood base");
    record0.set("stock_quantity", 500);
    record0.set("unit", "ml");
    record0.set("cost_per_unit", 85.0);
    record0.set("notes", "Perfect for feminine fragrances");
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
    record1.set("name", "Citrus Zest");
    record1.set("description", "Bright and energetic blend of bergamot and lemon");
    record1.set("stock_quantity", 750);
    record1.set("unit", "ml");
    record1.set("cost_per_unit", 42.0);
    record1.set("notes", "Great for fresh, daytime fragrances");
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
    record2.set("name", "Woody Base");
    record2.set("description", "Deep woody accord with cedarwood and patchouli");
    record2.set("stock_quantity", 600);
    record2.set("unit", "ml");
    record2.set("cost_per_unit", 65.0);
    record2.set("notes", "Excellent for masculine fragrances");
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
    record3.set("name", "Vanilla Musk");
    record3.set("description", "Warm and sensual blend of vanilla and synthetic musk");
    record3.set("stock_quantity", 300);
    record3.set("unit", "ml");
    record3.set("cost_per_unit", 72.0);
    record3.set("notes", "Perfect for evening fragrances");
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

  const record4 = new Record(collection);
    record4.set("name", "Oriental Spice");
    record4.set("description", "Exotic blend with warm spice notes and amber undertones");
    record4.set("stock_quantity", 400);
    record4.set("unit", "ml");
    record4.set("cost_per_unit", 95.0);
    record4.set("notes", "Luxurious and sophisticated");
    record4.set("userId", "demo_user_001");
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
