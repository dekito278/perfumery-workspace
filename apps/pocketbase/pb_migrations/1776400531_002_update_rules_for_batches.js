/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("batches");
  collection.listRule = "userId = @request.auth.id";
  collection.viewRule = "userId = @request.auth.id";
  collection.createRule = "@request.auth.id != ''";
  collection.updateRule = "userId = @request.auth.id";
  collection.deleteRule = "userId = @request.auth.id";
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("batches");
  collection.listRule = "userId = @request.auth.id";
  collection.viewRule = "userId = @request.auth.id";
  collection.createRule = "@request.auth.id != ''";
  collection.updateRule = "userId = @request.auth.id";
  collection.deleteRule = "userId = @request.auth.id";
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
