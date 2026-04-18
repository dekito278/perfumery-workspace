/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("batches");
  collection.fields.removeByName("created_at");
  return app.save(collection);
}, (app) => {
  try {

  const collection = app.findCollectionByNameOrId("batches");
  collection.fields.add(new AutodateField({
    name: "created_at",
    onCreate: true,
    onUpdate: false
  }));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
