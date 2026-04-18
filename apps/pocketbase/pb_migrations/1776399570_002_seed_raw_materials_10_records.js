/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("raw_materials");

  const record0 = new Record(collection);
    record0.set("name", "Rose Absolute");
    record0.set("category", "floral");
    record0.set("type", "material");
    record0.set("stock_quantity", 50);
    record0.set("unit", "ml");
    record0.set("cost_per_unit", 45.0);
    record0.set("supplier_name", "Grasse Supplier");
    record0.set("minimum_stock", 10);
    record0.set("notes", "Premium rose");
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
    record1.set("name", "Bergamot Oil");
    record1.set("category", "citrus");
    record1.set("type", "material");
    record1.set("stock_quantity", 8);
    record1.set("unit", "ml");
    record1.set("cost_per_unit", 28.5);
    record1.set("supplier_name", "Italy Import");
    record1.set("minimum_stock", 5);
    record1.set("notes", "Low stock");
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
    record2.set("name", "Sandalwood");
    record2.set("category", "woody");
    record2.set("type", "material");
    record2.set("stock_quantity", 30);
    record2.set("unit", "ml");
    record2.set("cost_per_unit", 35.0);
    record2.set("supplier_name", "India Source");
    record2.set("minimum_stock", 15);
    record2.set("notes", "Rich base");
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
    record3.set("name", "Vanilla Extract");
    record3.set("category", "gourmand");
    record3.set("type", "material");
    record3.set("stock_quantity", 12);
    record3.set("unit", "ml");
    record3.set("cost_per_unit", 22.0);
    record3.set("supplier_name", "Madagascar");
    record3.set("minimum_stock", 8);
    record3.set("notes", "Sweet note");
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
    record4.set("name", "Musk Synthetic");
    record4.set("category", "musk");
    record4.set("type", "material");
    record4.set("stock_quantity", 20);
    record4.set("unit", "ml");
    record4.set("cost_per_unit", 18.5);
    record4.set("supplier_name", "Chemical Co");
    record4.set("minimum_stock", 10);
    record4.set("notes", "Modern musk");
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
    record5.set("name", "Ethanol");
    record5.set("category", "solvent");
    record5.set("type", "solvent");
    record5.set("stock_quantity", 100);
    record5.set("unit", "ml");
    record5.set("cost_per_unit", 5.0);
    record5.set("supplier_name", "Lab Supply");
    record5.set("minimum_stock", 50);
    record5.set("notes", "Alcohol base");
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
    record6.set("name", "Jasmine Absolute");
    record6.set("category", "floral");
    record6.set("type", "material");
    record6.set("stock_quantity", 15);
    record6.set("unit", "ml");
    record6.set("cost_per_unit", 55.0);
    record6.set("supplier_name", "Grasse Supplier");
    record6.set("minimum_stock", 5);
    record6.set("notes", "Expensive");
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
    record7.set("name", "Cedarwood");
    record7.set("category", "woody");
    record7.set("type", "material");
    record7.set("stock_quantity", 25);
    record7.set("unit", "ml");
    record7.set("cost_per_unit", 32.0);
    record7.set("supplier_name", "Forest Source");
    record7.set("minimum_stock", 12);
    record7.set("notes", "Dry base");
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
    record8.set("name", "Lemon Oil");
    record8.set("category", "citrus");
    record8.set("type", "material");
    record8.set("stock_quantity", 6);
    record8.set("unit", "ml");
    record8.set("cost_per_unit", 24.0);
    record8.set("supplier_name", "Spain Import");
    record8.set("minimum_stock", 4);
    record8.set("notes", "Low stock");
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

  const record9 = new Record(collection);
    record9.set("name", "Patchouli");
    record9.set("category", "green");
    record9.set("type", "material");
    record9.set("stock_quantity", 18);
    record9.set("unit", "ml");
    record9.set("cost_per_unit", 28.0);
    record9.set("supplier_name", "Indonesia");
    record9.set("minimum_stock", 8);
    record9.set("notes", "Earthy note");
    record9.set("userId", "@request.auth.id");
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
