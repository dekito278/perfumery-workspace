/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Fetch related collections to get their IDs
  const batchesCollection = app.findCollectionByNameOrId("batches");
  const raw_materialsCollection = app.findCollectionByNameOrId("raw_materials");

  const collection = new Collection({
    "createRule": "@request.auth.id != \"\"",
    "deleteRule": "batch_id.userId = @request.auth.id",
    "fields":     [
          {
                "autogeneratePattern": "[a-z0-9]{15}",
                "hidden": false,
                "id": "text6250845153",
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
                "id": "relation2437656143",
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
                "id": "relation1933179453",
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
                "id": "number6355458538",
                "name": "quantity_deducted",
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
                "id": "select5604418258",
                "name": "type",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "select",
                "maxSelect": 1,
                "values": [
                      "formula_ingredient",
                      "dilution_solvent",
                      "main_batch_solvent"
                ]
          },
          {
                "hidden": false,
                "id": "text4504055570",
                "name": "source",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "text",
                "autogeneratePattern": "",
                "max": 0,
                "min": 0,
                "pattern": ""
          },
          {
                "hidden": false,
                "id": "number9997698650",
                "name": "cost",
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
                "id": "autodate8196012304",
                "name": "created_at",
                "presentable": false,
                "primaryKey": false,
                "required": false,
                "system": false,
                "type": "autodate",
                "onCreate": true,
                "onUpdate": false
          },
          {
                "hidden": false,
                "id": "autodate8949909781",
                "name": "created",
                "onCreate": true,
                "onUpdate": false,
                "presentable": false,
                "system": false,
                "type": "autodate"
          },
          {
                "hidden": false,
                "id": "autodate9215485241",
                "name": "updated",
                "onCreate": true,
                "onUpdate": true,
                "presentable": false,
                "system": false,
                "type": "autodate"
          }
    ],
    "id": "pbc_3514903900",
    "indexes": [],
    "listRule": "batch_id.userId = @request.auth.id",
    "name": "batch_usage_records",
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
    const collection = app.findCollectionByNameOrId("pbc_3514903900");
    return app.delete(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
