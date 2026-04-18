/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("raw_materials");

  const existing = collection.fields.getByName("pyramid_placement");
  if (existing) {
    if (existing.type === "select") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("pyramid_placement"); // exists with wrong type, remove first
  }

  collection.fields.add(new SelectField({
    name: "pyramid_placement",
    required: false,
    values: ["top", "middle", "base"]
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("raw_materials");
    collection.fields.removeByName("pyramid_placement");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
