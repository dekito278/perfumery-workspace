/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("accords");

  const existing = collection.fields.getByName("cost_per_unit");
  if (existing) {
    if (existing.type === "number") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("cost_per_unit"); // exists with wrong type, remove first
  }

  collection.fields.add(new NumberField({
    name: "cost_per_unit",
    required: false
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("accords");
    collection.fields.removeByName("cost_per_unit");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
