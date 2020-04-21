const { MONGO_COLLECTION_NAME, connectToMongo, start } = require("./index");
const { Db } = require("mongodb");
const Redis = require("ioredis");

describe("data subscription service", () => {
  beforeAll(start);

  it("should receive and store events from Redis", async () => {
    const db = await connectToMongo();
    expect(db).toBeInstanceOf(Db);

    // create redis publisher
    const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

    // publish test correct event
    const goodParams =
      "-1,1,0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,0.10,0.11,0.12,0.13,0.14,0.15,0.16,0.17";
    await redis.publish("testgood", goodParams);
    // give it time to work
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // ensure that it's on the server
    const ent = await db.collection(MONGO_COLLECTION_NAME).findOne({
      id: "testgood",
    });
    expect(ent).toMatchObject({
      id: "testgood",
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      parameters: goodParams.split(",").map((n) => parseFloat(n)),
    });

    // try to publish byaka
    await db.collection(MONGO_COLLECTION_NAME).deleteMany({ id: "testbad" });
    await redis.publish("testbad", "2,3,4");
    // give it time to work
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const doc = await db
      .collection(MONGO_COLLECTION_NAME)
      .findOne({ id: "testbad" });
    const res = await db
      .collection(MONGO_COLLECTION_NAME)
      .countDocuments({ id: "testbad" }, { limit: 1 });
    expect(res).toBe(0);
  });
});
