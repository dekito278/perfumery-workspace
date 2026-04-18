/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const formula_categoriesCollection = app.findCollectionByNameOrId("formula_categories");
  const collection = app.findCollectionByNameOrId("formulas");

  const existing = collection.fields.getByName("category_relation");
  if (existing) {
    if (existing.type === "relation") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("category_relation"); // exists with wrong type, remove first
  }

  collection.fields.add(new RelationField({
    name: "category_relation",
    required: false,
    collectionId: formula_categoriesCollection.id,
    maxSelect: 1
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("formulas");
    collection.fields.removeByName("category_relation");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
