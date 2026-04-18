/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const raw_materialsCollection = app.findCollectionByNameOrId("raw_materials");
  const collection = app.findCollectionByNameOrId("batches");

  const existing = collection.fields.getByName("solvent_id");
  if (existing) {
    if (existing.type === "relation") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("solvent_id"); // exists with wrong type, remove first
  }

  collection.fields.add(new RelationField({
    name: "solvent_id",
    required: true,
    collectionId: raw_materialsCollection.id,
    maxSelect: 1
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("batches");
    collection.fields.removeByName("solvent_id");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
