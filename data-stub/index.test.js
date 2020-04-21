const { ENTITIES, generateRandomEntity } = require("./index");
describe("data stub generating service", () => {
  it("should have 20 unique entities", () => {
    expect(ENTITIES).toHaveLength(20);
    expect(ENTITIES).toEqual(
      expect.arrayContaining([expect.stringMatching(/^\w+$/)])
    );
  });

  it("should generate random entity", () => {
    const { entity, parameters } = generateRandomEntity();
    expect(ENTITIES).toContain(entity);
    expect(parameters).toHaveLength(20);
    expect(parameters).toEqual(expect.arrayContaining([expect.any(Number)]));
  });
});
