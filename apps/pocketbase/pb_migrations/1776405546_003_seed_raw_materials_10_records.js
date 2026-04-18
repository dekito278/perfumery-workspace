/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("raw_materials");

  const record0 = new Record(collection);
    record0.set("name", "Rose Absolute");
    record0.set("category", "floral");
    record0.set("type", "material");
    record0.set("stock_quantity", 250);
    record0.set("unit", "ml");
    record0.set("cost_per_unit", 45.5);
    record0.set("minimum_stock", 50);
    record0.set("default_dilution_percent", 5);
    record0.set("scent_family", "floral");
    record0.set("note_type", "middle");
    record0.set("low_stock_threshold", 50);
    record0.set("description", "Premium rose absolute from Bulgaria");
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
    record1.set("name", "Sandalwood Oil");
    record1.set("category", "woody");
    record1.set("type", "material");
    record1.set("stock_quantity", 180);
    record1.set("unit", "ml");
    record1.set("cost_per_unit", 38.0);
    record1.set("minimum_stock", 40);
    record1.set("default_dilution_percent", 3);
    record1.set("scent_family", "woody");
    record1.set("note_type", "base");
    record1.set("low_stock_threshold", 40);
    record1.set("description", "Indian sandalwood essential oil");
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
    record2.set("name", "Bergamot Essential Oil");
    record2.set("category", "citrus");
    record2.set("type", "material");
    record2.set("stock_quantity", 320);
    record2.set("unit", "ml");
    record2.set("cost_per_unit", 22.75);
    record2.set("minimum_stock", 60);
    record2.set("default_dilution_percent", 8);
    record2.set("scent_family", "citrus");
    record2.set("note_type", "top");
    record2.set("low_stock_threshold", 60);
    record2.set("description", "Cold-pressed bergamot from Italy");
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
    record3.set("name", "Vanilla Extract");
    record3.set("category", "gourmand");
    record3.set("type", "material");
    record3.set("stock_quantity", 95);
    record3.set("unit", "ml");
    record3.set("cost_per_unit", 28.5);
    record3.set("minimum_stock", 100);
    record3.set("default_dilution_percent", 4);
    record3.set("scent_family", "gourmand");
    record3.set("note_type", "base");
    record3.set("low_stock_threshold", 100);
    record3.set("description", "Madagascar vanilla extract - LOW STOCK");
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
    record4.set("name", "Jasmine Sambac");
    record4.set("category", "floral");
    record4.set("type", "material");
    record4.set("stock_quantity", 150);
    record4.set("unit", "ml");
    record4.set("cost_per_unit", 52.0);
    record4.set("minimum_stock", 50);
    record4.set("default_dilution_percent", 2);
    record4.set("scent_family", "floral");
    record4.set("note_type", "middle");
    record4.set("low_stock_threshold", 50);
    record4.set("description", "Precious jasmine from India");
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

  const record5 = new Record(collection);
    record5.set("name", "Cedarwood Atlas");
    record5.set("category", "woody");
    record5.set("type", "material");
    record5.set("stock_quantity", 280);
    record5.set("unit", "ml");
    record5.set("cost_per_unit", 18.5);
    record5.set("minimum_stock", 50);
    record5.set("default_dilution_percent", 6);
    record5.set("scent_family", "woody");
    record5.set("note_type", "base");
    record5.set("low_stock_threshold", 50);
    record5.set("description", "Moroccan cedarwood essential oil");
    record5.set("userId", "demo_user_001");
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
    record6.set("name", "Ethanol Solvent");
    record6.set("category", "solvent");
    record6.set("type", "solvent");
    record6.set("stock_quantity", 5000);
    record6.set("unit", "ml");
    record6.set("cost_per_unit", 2.5);
    record6.set("minimum_stock", 1000);
    record6.set("default_dilution_percent", null);
    record6.set("scent_family", null);
    record6.set("note_type", null);
    record6.set("low_stock_threshold", 1000);
    record6.set("description", "High-purity ethanol for dilution");
    record6.set("userId", "demo_user_001");
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
    record7.set("name", "Lemon Essential Oil");
    record7.set("category", "citrus");
    record7.set("type", "material");
    record7.set("stock_quantity", 420);
    record7.set("unit", "ml");
    record7.set("cost_per_unit", 15.0);
    record7.set("minimum_stock", 80);
    record7.set("default_dilution_percent", 10);
    record7.set("scent_family", "citrus");
    record7.set("note_type", "top");
    record7.set("low_stock_threshold", 80);
    record7.set("description", "Fresh lemon oil from Spain");
    record7.set("userId", "demo_user_001");
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
    record8.set("name", "Musk Synthetic");
    record8.set("category", "musk");
    record8.set("type", "material");
    record8.set("stock_quantity", 75);
    record8.set("unit", "ml");
    record8.set("cost_per_unit", 35.0);
    record8.set("minimum_stock", 100);
    record8.set("default_dilution_percent", 1);
    record8.set("scent_family", "musk");
    record8.set("note_type", "base");
    record8.set("low_stock_threshold", 100);
    record8.set("description", "Synthetic musk compound - LOW STOCK");
    record8.set("userId", "demo_user_001");
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
    record9.set("name", "Patchouli Oil");
    record9.set("category", "woody");
    record9.set("type", "material");
    record9.set("stock_quantity", 200);
    record9.set("unit", "ml");
    record9.set("cost_per_unit", 24.0);
    record9.set("minimum_stock", 50);
    record9.set("default_dilution_percent", 4);
    record9.set("scent_family", "woody");
    record9.set("note_type", "base");
    record9.set("low_stock_threshold", 50);
    record9.set("description", "Indonesian patchouli essential oil");
    record9.set("userId", "demo_user_001");
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
