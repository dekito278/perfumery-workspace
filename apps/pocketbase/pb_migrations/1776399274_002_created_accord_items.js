/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Fetch related collections to get their IDs
  const accordsCollection = app.findCollectionByNameOrId("accords");
  const raw_materialsCollection = app.findCollectionByNameOrId("raw_materials");

  const collection = new Collection({
    "createRule": "@request.auth.id != ''",
    "deleteRule": "accord_id.userId = @request.auth.id",
    "fields":     [
          {
                "autogeneratePattern": "[a-z0-9]{15}",
                "hidden": false,
                "id": "text0669170198",
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
                "id": "relation4694152201",
                "name": "accord_id",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "relation",
                "cascadeDelete": false,
                "collectionId": accordsCollection.id,
                "displayFields": [],
                "maxSelect": 1,
                "minSelect": 0
          },
          {
                "hidden": false,
                "id": "relation3737898717",
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
                "id": "number4505788593",
                "name": "percentage",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "number",
                "max": 100,
                "min": 0,
                "onlyInt": false
          },
          {
                "hidden": false,
                "id": "autodate2474391746",
                "name": "created",
                "onCreate": true,
                "onUpdate": false,
                "presentable": false,
                "system": false,
                "type": "autodate"
          },
          {
                "hidden": false,
                "id": "autodate9934307364",
                "name": "updated",
                "onCreate": true,
                "onUpdate": true,
                "presentable": false,
                "system": false,
                "type": "autodate"
          }
    ],
    "id": "pbc_2794122162",
    "indexes": [],
    "listRule": "accord_id.userId = @request.auth.id",
    "name": "accord_items",
    "system": false,
    "type": "base",
    "updateRule": "accord_id.userId = @request.auth.id",
    "viewRule": "accord_id.userId = @request.auth.id"
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
    const collection = app.findCollectionByNameOrId("pbc_2794122162");
    return app.delete(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
