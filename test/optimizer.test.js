import test from "node:test";
import assert from "node:assert/strict";
import { createInitialData } from "../data/initial-data.js";
import { solveMinimumRuns } from "../src/core/optimizer.js";
import { EQUIPMENT_TEMPLATES, resolveEquipmentTemplate } from "../src/core/templates.js";

const stage = (name, drops) => ({
  id: `stage-${name}`,
  name,
  chapter: Number(name.split("-")[0]),
  number: Number(name.split("-")[1]),
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

test("同じドロップ内容では章・ステージ番号が大きい方を選ぶ", () => {
  const result = solveMinimumRuns({
    requests: [
      { itemId: "A", quantity: 1 },
      { itemId: "B", quantity: 1 },
    ],
    stages: [stage("2-1", [["A"]]), stage("1-2", [["B"]]), stage("1-1", [["A"]]), stage("2-2", [["B"]])],
  });
  assert.deepEqual(
    result.stageRuns.map((entry) => entry.stage.name).sort(),
    ["2-1", "2-2"],
  );
});

test("章番号を優先し、その後でステージ番号を比較する", () => {
  const result = solveMinimumRuns({
    requests: [{ itemId: "A", quantity: 3 }],
    stages: [stage("9-10", [["A"]]), stage("10-1", [["A"]]), stage("8-20", [["A"]])],
  });
  assert.equal(result.status, "ok");
  assert.deepEqual(result.stageRuns.map((entry) => [entry.stage.name, entry.runs]), [["10-1", 3]]);
});

test("1種類だけを満たす同等候補が複数ある場合はanywhereとする", () => {
  const result = solveMinimumRuns({
    requests: [{ itemId: "A", quantity: 3 }],
    stages: [stage("1-1", [["A"], ["C"]]), stage("2-1", [["A"], ["D"]])],
  });
  assert.equal(result.status, "ok");
  assert.equal(result.stageRuns[0].isAnywhere, true);
  assert.deepEqual(result.stageRuns[0].usefulItemIds, ["A"]);
});

test("2種類を同時に満たすステージは具体的な番号を表示する", () => {
  const result = solveMinimumRuns({
    requests: [
      { itemId: "A", quantity: 1 },
      { itemId: "B", quantity: 1 },
    ],
    stages: [stage("1-1", [["A"], ["B"]]), stage("2-1", [["A"]]), stage("2-2", [["B"]])],
  });
  assert.equal(result.status, "ok");
  assert.equal(result.stageRuns[0].isAnywhere, false);
  assert.equal(result.stageRuns[0].stage.name, "1-1");
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

test("同一ランク6種類を各42個指定しても短時間で厳密解を返す", () => {
  const data = createInitialData();
  const requests = data.items
    .filter((item) => item.rank === 8)
    .slice(0, 6)
    .map((item) => ({ itemId: item.id, quantity: 42 }));
  const result = solveMinimumRuns({ requests, stages: data.stages });
  assert.equal(result.status, "ok");
  assert.equal(result.totalRuns, 126);
  assert.equal(result.stageRuns.length, 3);
  assert.deepEqual(
    result.itemResults.map((entry) => entry.excess),
    [0, 0, 0, 0, 0, 0],
  );
});

test("全ランクの6種類組み合わせを各42個指定してもタイムアウトしない", () => {
  const data = createInitialData();
  for (const rank of [9, 8, 7, 6, 5, 4, 3, 2]) {
    const rankItems = data.items.filter((item) => item.rank === rank);
    for (let omitted = 0; omitted < rankItems.length; omitted += 1) {
      const requests = rankItems
        .filter((_, index) => index !== omitted)
        .map((item) => ({ itemId: item.id, quantity: 42 }));
      const result = solveMinimumRuns({ requests, stages: data.stages });
      assert.equal(result.status, "ok", `ランク${rank}・除外${rankItems[omitted].category}`);
      assert.ok(result.totalRuns >= 126 && result.totalRuns <= 252);
      assert.ok(result.itemResults.every((entry) => entry.obtained >= entry.required));
    }
  }
});

test("入手手段のない設計図を報告する", () => {
  const result = solveMinimumRuns({
    requests: [{ itemId: "missing", quantity: 1 }],
    stages: [stage("1-1", [["A"]])],
  });
  assert.deepEqual(result, { status: "unavailable", unavailableItemIds: ["missing"] });
});

function assertObtainedMatchesPlan(result) {
  assert.equal(result.stageRuns.reduce((sum, entry) => sum + entry.runs, 0), result.totalRuns);
  for (const item of result.itemResults) {
    const obtained = result.stageRuns.reduce((sum, entry) => sum + entry.runs * entry.stage.drops
      .filter((drop) => drop.itemId === item.itemId)
      .reduce((quantity, drop) => quantity + drop.quantity, 0), 0);
    assert.equal(item.obtained, obtained);
    assert.ok(obtained >= item.required);
    assert.equal(item.excess, obtained - item.required);
  }
}

test("ランク9物理を含む全テンプレートで高速に最小周回数を求める", () => {
  const data = createInitialData();
  // R9は1周に対象R9を最大1個なので312周が下限。他は必要数合計/2が下限。
  const minimumByRank = { 9: 312, 8: 192, 7: 126, 6: 150 };
  for (const template of EQUIPMENT_TEMPLATES) {
    const { requests } = resolveEquipmentTemplate(template.id, data.items);
    const result = solveMinimumRuns({ requests, stages: data.stages, timeoutMs: 1000 });
    assert.equal(result.status, "ok", template.label);
    assert.equal(result.totalRuns, minimumByRank[template.quantities[0].rank], template.label);
    assert.equal(result.exploredNodes, 0, "組み合わせ列挙に戻らないこと");
    assertObtainedMatchesPlan(result);
    if (template.id === "rank-9-physical") {
      // 単独収集できないR9の5部位260個に対しR8は120個必要なので140個は余る。
      assert.equal(result.itemResults.reduce((sum, item) => sum + item.excess, 0), 140);
    }
  }
});

test("単独候補のないグラフでも総周回数は独立した全探索の最小値と一致する", () => {
  const ids = ["A", "B", "C", "D"];
  const demands = [2, 1, 3, 2];
  const edges = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  for (let mask = 1; mask < 64; mask++) {
    const effects = edges.filter((_, i) => mask & (1 << i));
    if (mask % 2) effects.push([0]);
    if (mask % 3) effects.push([3]);
    if (ids.some((_, i) => !effects.some((edge) => edge.includes(i)))) continue;
    // 必要数を満たした値で打ち切る幅優先探索。マッチング実装とは独立。
    const queue = [{ remaining: demands, runs: 0 }];
    const seen = new Set([demands.join(",")]);
    let minimum;
    for (let head = 0; head < queue.length; head++) {
      const { remaining, runs } = queue[head];
      if (remaining.every((n) => n === 0)) { minimum = runs; break; }
      for (const edge of effects) {
        const next = remaining.map((n, i) => Math.max(0, n - Number(edge.includes(i))));
        const key = next.join(",");
        if (!seen.has(key)) { seen.add(key); queue.push({ remaining: next, runs: runs + 1 }); }
      }
    }
    // 独立した設計図64個を加えて高速経路に入れる。最適値には64周だけ加算。
    const result = solveMinimumRuns({
      requests: [...ids.map((itemId, i) => ({ itemId, quantity: demands[i] })), { itemId: "isolated", quantity: 64 }],
      stages: [...effects.map((edge, i) => stage(`1-${i + 1}`, edge.map((j) => [ids[j]]))), stage("2-1", [["isolated"]])],
    });
    assert.equal(result.status, "ok", `mask=${mask}`);
    assert.equal(result.totalRuns, minimum + 64, `mask=${mask}`);
    assert.equal(result.exploredNodes, 0);
    assertObtainedMatchesPlan(result);
  }
});

test("高速計算中もキャンセルと時間制限を確認する", () => {
  const data = createInitialData();
  const { requests } = resolveEquipmentTemplate("rank-9-physical", data.items);
  let checks = 0;
  assert.equal(solveMinimumRuns({ requests, stages: data.stages, shouldAbort: () => ++checks > 10 }).status, "cancelled");
  assert.equal(solveMinimumRuns({ requests, stages: data.stages, timeoutMs: -1 }).status, "timeout");
});
