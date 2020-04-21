/**
 * Сервис который может отдать одну сущность или список всех сущностей в актуальном состоянии
 * (последнее состояние, полученное из внешнего источника)
 *
 * Сервис - это Express.JS сервер с тремя ендпоинтами:
 *  /entities - при конекте возвращает текущие данные по всем сущностям, и затем по SSE передает обновления
 * /entity/:id - возвращает текущие параметры для одной сущности
 * /status - возврящает количество клиентов слушающих SSE
 */

"use strict";

const express = require("express");
const cors = require("cors");
const SSE = require("express-sse");
const { MongoClient } = require("mongodb");

const { MONGO_COLLECTION_NAME } = require("../constants");

const app = express();
const sse = new SSE();

// Set cors middlewares
app.use(cors({ methods: "GET" }));

/**
 * MongoDB change stream handler that sends changes to all clients
 * via SSE
 * @param {import('mongodb').ChangeEvent} next
 */
function onNewEntity(next) {
  const { operationType, fullDocument } = next;
  if (!fullDocument) return;
  console.log("[API] %s of: %s", operationType, fullDocument.id);
  const entity = [fullDocument.id, ...fullDocument.parameters];
  sse.send(entity, operationType);

  // update initial content for SSE
  switch (operationType) {
    case "update": {
      const index = sse.initial.findIndex(
        ([entityName]) => entityName === fullDocument.id
      );
      if (index) {
        // remove old version
        sse.initial.splice(index, 1);
      }
    }

    // added new entity to the top of initials, maintaining it sorted
    // eslint-disable-next-line no-fallthrough
    case "insert":
      sse.initial.unshift(entity);
      break;
  }
}

/**
 * Initializes MongoDB connection and stores it in Express variable
 * @param {string} [url]
 */
async function initDB(
  url = process.env.MONGOHQ_URL ||
    "mongodb+srv://tino:6VUFWcLLhLaVDeTs@cluster0-sszzh.azure.mongodb.net/test-entities?retryWrites=true&w=majority&readOnly=true"
) {
  const mongo = await MongoClient.connect(url, { useUnifiedTopology: true });
  // save it to express
  const db = mongo.db();
  app.locals.db = db;

  // Update SSE initials with current values
  const entities = await db
    .collection(MONGO_COLLECTION_NAME)
    .aggregate([
      { $match: {} },
      { $sort: { updatedAt: -1 } },
      {
        $project: {
          _id: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    ])
    .toArray();
  sse.updateInit(entities.map(({ id, parameters }) => [id, ...parameters]));

  // subscribe to MongoDB change stream
  const changeStream = db
    .collection(MONGO_COLLECTION_NAME)
    .watch([{ $match: { operationType: { $in: ["insert", "update"] } } }], {
      fullDocument: "updateLookup",
    });
  changeStream.on("change", onNewEntity);
}

/**
 * Single entity route
 */
app.get("/entity/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) throw new TypeError("Wrong params!");

    // get entity from MongoDB
    const entity = await req.app.locals.db
      .collection(MONGO_COLLECTION_NAME)
      .findOne({ id });
    if (!entity) return res.end(404);

    res.status(200).json(entity);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Full entities data and updates via SSE
 */
app.get("/entities", sse.init);
app.get("/status", (req, res) =>
  res.json({ clients: sse.listenerCount("data") })
);

async function start(PORT = parseInt(process.env.PORT || "3000", 10)) {
  await initDB();

  // start server
  app.listen(PORT, () =>
    console.log(`Data server is listening on port ${PORT}`)
  );
}

if (!module.parent) start();
