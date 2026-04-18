/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("batches");
  collection.indexes.push("CREATE UNIQUE INDEX idx_batches_batch_code ON batches (batch_code)");
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("batches");
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_batches_batch_code"));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
