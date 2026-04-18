/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Fetch related collections to get their IDs
  const raw_materialsCollection = app.findCollectionByNameOrId("raw_materials");
  const batchesCollection = app.findCollectionByNameOrId("batches");

  const collection = new Collection({
    "createRule": "@request.auth.id != \"\"",
    "deleteRule": "batch_id.userId = @request.auth.id",
    "fields":     [
          {
                "autogeneratePattern": "[a-z0-9]{15}",
                "hidden": false,
                "id": "text5763254300",
                "max": 15,
                "min": 15,
                "name": "id",
                "pattern": "^[a-z0-9]+$",
                "presentable": false,
                "primaryKey": true,
                "required": true,
                "system": true,
                "type": "text"
          },
          {
                "hidden": false,
                "id": "relation9566986553",
                "name": "raw_material_id",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "relation",
                "cascadeDelete": false,
                "collectionId": raw_materialsCollection.id,
                "displayFields": [],
                "maxSelect": 1,
                "minSelect": 0
          },
          {
                "hidden": false,
                "id": "relation2409337481",
                "name": "batch_id",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "relation",
                "cascadeDelete": false,
                "collectionId": batchesCollection.id,
                "displayFields": [],
                "maxSelect": 1,
                "minSelect": 0
          },
          {
                "hidden": false,
                "id": "number0030739480",
                "name": "amount_deducted",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "number",
                "max": null,
                "min": 0,
                "onlyInt": false
          },
          {
                "hidden": false,
                "id": "select5639308246",
                "name": "type",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "select",
                "maxSelect": 1,
                "values": [
                      "ingredient",
                      "solvent"
                ]
          },
          {
                "hidden": false,
                "id": "autodate9349094479",
                "name": "created",
                "onCreate": true,
                "onUpdate": false,
                "presentable": false,
                "system": false,
                "type": "autodate"
          },
          {
                "hidden": false,
                "id": "autodate1402396772",
                "name": "updated",
                "onCreate": true,
                "onUpdate": true,
                "presentable": false,
                "system": false,
                "type": "autodate"
          }
    ],
    "id": "pbc_7534629817",
    "indexes": [],
    "listRule": "batch_id.userId = @request.auth.id",
    "name": "stock_deductions",
    "system": false,
    "type": "base",
    "updateRule": "batch_id.userId = @request.auth.id",
    "viewRule": "batch_id.userId = @request.auth.id"
  });

  try {
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("Collection name must be unique")) {
      console.log("Collection already exists, skipping");
      return;
    }
    throw e;
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("pbc_7534629817");
    return app.delete(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
