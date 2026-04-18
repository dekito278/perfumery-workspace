/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const batchesCollection = app.findCollectionByNameOrId("batches");
  const collection = app.findCollectionByNameOrId("stock_logs");

  const existing = collection.fields.getByName("batch_id");
  if (existing) {
    if (existing.type === "relation") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("batch_id"); // exists with wrong type, remove first
  }

  collection.fields.add(new RelationField({
    name: "batch_id",
    required: false,
    collectionId: batchesCollection.id,
    maxSelect: 1
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("stock_logs");
    collection.fields.removeByName("batch_id");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
