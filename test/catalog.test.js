import test from "node:test";
import assert from "node:assert/strict";
import { compareItems, compareStages, deriveItemName, deriveStageName } from "../src/core/catalog.js";

test("設計図は未設定を先頭にしてランク降順・指定分類順に並ぶ", () => {
  const items = [
    { id: "r9", rank: 9, category: "鎧" },
    { id: "r10-sword", rank: 10, category: "剣" },
    { id: "r11", rank: 11, category: "杖" },
    { id: "r10-armor", rank: 10, category: "鎧" },
    { id: "r10-necklace", rank: 10, category: "ネックレス" },
    { id: "unset", rank: null, category: "" },
  ];
  items.sort(compareItems);
  assert.deepEqual(
    items.map((item) => item.id),
    ["unset", "r11", "r10-armor", "r10-necklace", "r10-sword", "r9"],
  );
});

test("ステージは章番号・ステージ番号の高い順に並ぶ", () => {
  const stages = [
    { id: "a", chapter: 29, number: 10 },
    { id: "b", chapter: 30, number: 9 },
    { id: "c", chapter: 30, number: 10 },
  ];
  stages.sort(compareStages);
  assert.deepEqual(stages.map((stage) => stage.id), ["c", "b", "a"]);
});

test("名称は入力させず番号と分類から生成する", () => {
  assert.equal(deriveItemName({ rank: 11, category: "杖" }), "ランク11 杖");
  assert.equal(deriveItemName({ rank: null, category: "" }), "ランク未設定 分類未設定");
  assert.equal(deriveStageName({ chapter: 31, number: 2 }), "31-2");
});
