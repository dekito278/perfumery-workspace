/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Fetch related collections to get their IDs
  const raw_materialsCollection = app.findCollectionByNameOrId("raw_materials");
  const accordsCollection = app.findCollectionByNameOrId("accords");

  const collection = new Collection({
    "createRule": "@request.auth.id != ''",
    "deleteRule": "userId = @request.auth.id",
    "fields":     [
          {
                "autogeneratePattern": "[a-z0-9]{15}",
                "hidden": false,
                "id": "text2824731932",
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
                "id": "date5156155703",
                "name": "date",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "date",
                "max": "",
                "min": ""
          },
          {
                "hidden": false,
                "id": "select7065335066",
                "name": "log_type",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "select",
                "maxSelect": 1,
                "values": [
                      "manual adjustment",
                      "accord production",
                      "batch production"
                ]
          },
          {
                "hidden": false,
                "id": "relation1639392714",
                "name": "material_id",
                "presentable": false,
                "primaryKey": false,
                "required": false,
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
                "id": "relation7226299402",
                "name": "accord_id",
                "presentable": false,
                "primaryKey": false,
                "required": false,
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
                "id": "number4321367834",
                "name": "quantity_change",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "number",
                "max": null,
                "min": null,
                "onlyInt": false
          },
          {
                "hidden": false,
                "id": "text5457687238",
                "name": "notes",
                "presentable": false,
                "primaryKey": false,
                "required": false,
                "system": false,
                "type": "text",
                "autogeneratePattern": "",
                "max": 0,
                "min": 0,
                "pattern": ""
          },
          {
                "hidden": false,
                "id": "text8806157351",
                "name": "userId",
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
                "id": "autodate0376846729",
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
                "id": "autodate5025158586",
                "name": "created",
                "onCreate": true,
                "onUpdate": false,
                "presentable": false,
                "system": false,
                "type": "autodate"
          },
          {
                "hidden": false,
                "id": "autodate9692433182",
                "name": "updated",
                "onCreate": true,
                "onUpdate": true,
                "presentable": false,
                "system": false,
                "type": "autodate"
          }
    ],
    "id": "pbc_1421900623",
    "indexes": [],
    "listRule": "userId = @request.auth.id",
    "name": "stock_logs",
    "system": false,
    "type": "base",
    "updateRule": "userId = @request.auth.id",
    "viewRule": "userId = @request.auth.id"
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
    const collection = app.findCollectionByNameOrId("pbc_1421900623");
    return app.delete(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
