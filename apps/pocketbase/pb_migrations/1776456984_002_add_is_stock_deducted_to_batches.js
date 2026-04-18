/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("batches");

  const existing = collection.fields.getByName("is_stock_deducted");
  if (existing) {
    if (existing.type === "bool") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("is_stock_deducted"); // exists with wrong type, remove first
  }

  collection.fields.add(new BoolField({
    name: "is_stock_deducted",
    required: false
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("batches");
    collection.fields.removeByName("is_stock_deducted");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
