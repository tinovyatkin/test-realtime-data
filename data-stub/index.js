/**
 * Stub data generator
 *
 * Сущности отправляются в нашу систему в случайной последовательности с частотой 10 сообщений в секунду.
 * Например: Entity1, Entity2, Entity3, Entity4…. Entity1, Entity3, Entity2, Entity4….
 * Уникальных сущностей 20.
 * Значения параметров меняются в любой момент.
 *
 * В некоторый период времени мы можем не получать обновлений (внешний сервис выключен).
 *
 * Мы создаем внешний источник данных в виде сервиса публикующего сущности на Redis сервере в качестве событий
 */

"use strict";

const faker = require("faker");
const Redis = require("ioredis");

const { ENTITIES_COUNT, ENTITY_PARAMETERS_COUNT } = require("../constants");

// generate our entities names, 20 as per task description
const ENTITIES = (exports.ENTITIES = Array.from(
  { length: ENTITIES_COUNT },
  () => faker.lorem.word()
));

function generateRandomEntity() {
  const entity = faker.random.arrayElement(ENTITIES);
  const parameters = Array.from({ length: ENTITY_PARAMETERS_COUNT }, () =>
    faker.random.number({ min: -1, max: 1, precision: 0.0001 })
  );
  return { entity, parameters };
}
exports.generateRandomEntity = generateRandomEntity; // for tests

async function fakeDataPublisher() {
  // connecting to Redis server as publisher
  const redis = new Redis(
    process.env.REDIS_URL ||
      "redis://h:xO6CWcLM8jbYTUsn5R1i5ScXHZruVRzE@redis-15123.c56.east-us.azure.cloud.redislabs.com:15123"
  );

  // start generating and publishing data
  for (;;) {
    const { entity, parameters } = generateRandomEntity();

    // publish it to redis
    await redis.publish(entity, parameters.map((p) => p.toFixed(4)).join(","));

    console.log("[DATA] Published data: %s", entity);
    // wait from 100ms (~ 10 message per second up to 5 second - simulates server is not available)
    await new Promise((resolve) =>
      setTimeout(resolve, faker.random.number({ min: 100, max: 5000 }))
    );
  }
}

if (!module.parent) fakeDataPublisher();
