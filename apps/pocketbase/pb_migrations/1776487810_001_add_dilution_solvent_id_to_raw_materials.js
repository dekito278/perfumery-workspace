/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const raw_materialsCollection = app.findCollectionByNameOrId("raw_materials");
  const collection = app.findCollectionByNameOrId("raw_materials");

  const existing = collection.fields.getByName("dilution_solvent_id");
  if (existing) {
    if (existing.type === "relation") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("dilution_solvent_id"); // exists with wrong type, remove first
  }

  collection.fields.add(new RelationField({
    name: "dilution_solvent_id",
    required: false,
    collectionId: raw_materialsCollection.id,
    maxSelect: 1
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("raw_materials");
    collection.fields.removeByName("dilution_solvent_id");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
