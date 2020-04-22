/**
 * Сервиса, который слушает обновление данных и хранит их (способ хранения текущих значений любой - БД, структуры в памяти, файлы на диске и т.п.)
 *
 * Сервис будет слушать события на Redis и сохранять в MongoDB
 */

"use strict";

const Redis = require("ioredis");
const { MongoClient } = require("mongodb");

const { MONGO_COLLECTION_NAME } = require("../constants");

/**
 * Connects to MongoDB
 * @param {string} [url]
 */
async function connectToMongo(
  url = process.env.MONGOHQ_URL ||
    "mongodb+srv://tino:6VUFWcLLhLaVDeTs@cluster0-sszzh.azure.mongodb.net/test-entities?retryWrites=true&w=majority"
) {
  const mongo = await MongoClient.connect(url, { useUnifiedTopology: true });
  const db = mongo.db();

  // TEST ONLY: we will cleanup collection on every restart
  // try {
  //   await db.dropCollection(MONGO_COLLECTION_NAME);
  // } catch (err) {
  //   if (err.codeName !== "NamespaceNotFound") {
  //     throw err;
  //   }
  // }

  // create or update collection and set JSON schema
  const collections = await db
    .listCollections({}, { nameOnly: true })
    .toArray();
  try {
    if (!collections.find(({ name }) => name === MONGO_COLLECTION_NAME)) {
      await db.createCollection(MONGO_COLLECTION_NAME, {
        validator: {
          $jsonSchema: require("../schemas/mongo-entities.json"),
        },
        validationLevel: "strict",
      });
    } else {
      // OK, ensure it have JSON schema in place
      await db.command({
        collMod: MONGO_COLLECTION_NAME,
        validator: {
          $jsonSchema: require("../schemas/mongo-entities.json"),
        },
        validationLevel: "strict",
      });
    }
  } catch (err) {
    if (err.codeName !== "NamespaceExists") throw err;
  }

  // Create id index, making review ID unique
  await db
    .collection(MONGO_COLLECTION_NAME)
    .createIndex({ id: -1 }, { unique: true });

  return db;
}
exports.connectToMongo = connectToMongo;

async function subscribeToRedis(
  url = process.env.REDIS_URL || "redis://localhost:6379"
) {
  // Redis will automatically reconnect and resubscribe
  // so, no problem if external server goes down sometimes
  const redis = new Redis(url);
  // subscribe to all entities
  await redis.psubscribe("*");
  return redis;
}

/**
 * Handles new entiry data receiving
 *
 * @param {string} entity
 * @param {string} serializedParameters
 * @param {import('mongodb').Db} db
 */
async function onEntity(entity, serializedParameters, db) {
  const parameters = serializedParameters
    .split(",")
    .map((n) => Number.parseFloat(n));

  console.log("[FACTORY] Received entity: %s", entity);

  // store it to MongoDB, that will automatically verify by JSON schema
  // so, it may throw on broken data
  try {
    await db.collection(MONGO_COLLECTION_NAME).updateOne(
      { id: entity },
      {
        $currentDate: { updatedAt: true },
        $set: { parameters },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
  } catch (err) {
    console.error(err);
  }
}

async function start() {
  const db = await connectToMongo();
  const redis = await subscribeToRedis();

  // listen for events from Redis and store them in MongoDB
  redis.on("pmessage", (pattern, entity, serializedParameters) =>
    onEntity(entity, serializedParameters, db)
  );
}
exports.start = start;

if (!module.parent) start();
