/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("formula_items");

  const existing = collection.fields.getByName("dilution_percent");
  if (existing) {
    if (existing.type === "number") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("dilution_percent"); // exists with wrong type, remove first
  }

  collection.fields.add(new NumberField({
    name: "dilution_percent",
    required: false,
    min: 0,
    max: 100
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("formula_items");
    collection.fields.removeByName("dilution_percent");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
