/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("batches");

  const existing = collection.fields.getByName("solvent_quantity_needed");
  if (existing) {
    if (existing.type === "number") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("solvent_quantity_needed"); // exists with wrong type, remove first
  }

  collection.fields.add(new NumberField({
    name: "solvent_quantity_needed",
    required: true,
    min: 0
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("batches");
    collection.fields.removeByName("solvent_quantity_needed");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
