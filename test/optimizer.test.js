import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../data/initial-data.js";
import { solveMinimumRuns } from "../src/core/optimizer.js";

const stage = (name, drops) => ({
  id: `stage-${name}`,
  name,
  drops: drops.map(([itemId, quantity = 1]) => ({ itemId, quantity })),
});

test("1種類の必要数を最小周回で満たす", () => {
  const result = solveMinimumRuns({
    requests: [{ itemId: "A", quantity: 3 }],
    stages: [stage("1-1", [["A"]])],
  });
  assert.equal(result.status, "ok");
  assert.equal(result.totalRuns, 3);
  assert.equal(result.stageRuns[0].runs, 3);
});

test("同時ドロップを利用して2種類を1周で満たす", () => {
  const result = solveMinimumRuns({
    requests: [
      { itemId: "A", quantity: 1 },
      { itemId: "B", quantity: 1 },
    ],
    stages: [stage("1-1", [["A"], ["B"]]), stage("1-2", [["A"]]), stage("1-3", [["B"]])],
  });
  assert.equal(result.status, "ok");
  assert.equal(result.totalRuns, 1);
  assert.equal(result.stageRuns[0].stage.name, "1-1");
});

test("総周回数が同じ場合は余剰数が少ない解を選ぶ", () => {
  const result = solveMinimumRuns({
    requests: [
      { itemId: "A", quantity: 2 },
      { itemId: "B", quantity: 1 },
    ],
    stages: [stage("1-1", [["A"], ["B"]]), stage("1-2", [["A"]])],
  });
  assert.equal(result.totalRuns, 2);
  assert.deepEqual(
    result.stageRuns.map((entry) => [entry.stage.name, entry.runs]),
    [
      ["1-1", 1],
      ["1-2", 1],
    ],
  );
  assert.deepEqual(
    result.itemResults.map((entry) => entry.excess),
    [0, 0],
  );
});

test("余剰数も同じ場合は使用ステージ種類数を減らす", () => {
  const result = solveMinimumRuns({
    requests: [
      { itemId: "A", quantity: 2 },
      { itemId: "B", quantity: 2 },
    ],
    stages: [stage("1-1", [["A"], ["B"]]), stage("1-2", [["A", 2]]), stage("1-3", [["B", 2]])],
  });
  assert.equal(result.stageRuns.length, 1);
  assert.equal(result.stageRuns[0].stage.name, "1-1");
});

test("同率解はステージ名の文字列順で一意に決まる", () => {
  const result = solveMinimumRuns({
    requests: [
      { itemId: "A", quantity: 1 },
      { itemId: "B", quantity: 1 },
    ],
    stages: [stage("2-1", [["A"]]), stage("1-2", [["B"]]), stage("1-1", [["A"]]), stage("2-2", [["B"]])],
  });
  assert.deepEqual(
    result.stageRuns.map((entry) => entry.stage.name).sort(),
    ["1-1", "1-2"],
  );
});

test("初期データの同時ドロップを実際のステージで利用する", () => {
  const data = createInitialData();
  const targetStage = data.stages.find((entry) => entry.name === "30-10");
  const result = solveMinimumRuns({
    requests: targetStage.drops.map((drop) => ({ itemId: drop.itemId, quantity: 3 })),
    stages: data.stages,
  });
  assert.equal(result.status, "ok");
  assert.equal(result.totalRuns, 3);
  assert.deepEqual(result.stageRuns.map((entry) => [entry.stage.name, entry.runs]), [["30-10", 3]]);
});

test("入手手段のない設計図を報告する", () => {
  const result = solveMinimumRuns({
    requests: [{ itemId: "missing", quantity: 1 }],
    stages: [stage("1-1", [["A"]])],
  });
  assert.deepEqual(result, { status: "unavailable", unavailableItemIds: ["missing"] });
});
