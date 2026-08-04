const DEFAULT_TIMEOUT_MS = 2800;

function compareStageNames(a, b) {
  return a.localeCompare(b, "ja", { numeric: false });
}

function effectSignature(effects) {
  return effects.join(",");
}

function comparePlans(a, b) {
  if (!b) return -1;
  if (a.excess !== b.excess) return a.excess - b.excess;
  if (a.stageTypes !== b.stageTypes) return a.stageTypes - b.stageTypes;
  return a.lexicalKey.localeCompare(b.lexicalKey, "ja", { numeric: false });
}

function makeCandidateStages(stages, itemIds) {
  const itemIndex = new Map(itemIds.map((id, index) => [id, index]));
  const byEffect = new Map();

  for (const stage of stages) {
    const effects = Array(itemIds.length).fill(0);
    for (const drop of stage.drops) {
      const index = itemIndex.get(drop.itemId);
      if (index != null) effects[index] += drop.quantity;
    }
    if (!effects.some(Boolean)) continue;

    const signature = effectSignature(effects);
    const existing = byEffect.get(signature);
    if (!existing || compareStageNames(stage.name, existing.stage.name) < 0) {
      byEffect.set(signature, { stage, effects, totalEffect: effects.reduce((sum, n) => sum + n, 0) });
    }
  }

  return [...byEffect.values()].sort(
    (a, b) => b.totalEffect - a.totalEffect || compareStageNames(a.stage.name, b.stage.name),
  );
}

function lowerBound(remaining, candidates, startIndex = 0) {
  if (remaining.every((value) => value === 0)) return 0;

  let bound = 0;
  let totalRemaining = 0;
  let maximumUsefulPerRun = 0;

  for (let itemIndex = 0; itemIndex < remaining.length; itemIndex += 1) {
    const needed = remaining[itemIndex];
    totalRemaining += needed;
    if (needed === 0) continue;

    let maximumForItem = 0;
    for (let candidateIndex = startIndex; candidateIndex < candidates.length; candidateIndex += 1) {
      maximumForItem = Math.max(maximumForItem, candidates[candidateIndex].effects[itemIndex]);
    }
    if (maximumForItem === 0) return Number.POSITIVE_INFINITY;
    bound = Math.max(bound, Math.ceil(needed / maximumForItem));
  }

  for (let candidateIndex = startIndex; candidateIndex < candidates.length; candidateIndex += 1) {
    const useful = candidates[candidateIndex].effects.reduce(
      (sum, quantity, itemIndex) => sum + Math.min(quantity, remaining[itemIndex]),
      0,
    );
    maximumUsefulPerRun = Math.max(maximumUsefulPerRun, useful);
  }

  if (maximumUsefulPerRun === 0) return Number.POSITIVE_INFINITY;
  return Math.max(bound, Math.ceil(totalRemaining / maximumUsefulPerRun));
}

function makeGreedyPlan(demands, candidates) {
  const remaining = [...demands];
  const counts = Array(candidates.length).fill(0);
  let totalRuns = 0;

  while (remaining.some(Boolean)) {
    let bestIndex = -1;
    let bestReduction = -1;
    for (let index = 0; index < candidates.length; index += 1) {
      const reduction = candidates[index].effects.reduce(
        (sum, quantity, itemIndex) => sum + Math.min(quantity, remaining[itemIndex]),
        0,
      );
      if (
        reduction > bestReduction ||
        (reduction === bestReduction &&
          bestIndex >= 0 &&
          compareStageNames(candidates[index].stage.name, candidates[bestIndex].stage.name) < 0)
      ) {
        bestIndex = index;
        bestReduction = reduction;
      }
    }

    if (bestIndex < 0 || bestReduction <= 0) return null;
    counts[bestIndex] += 1;
    totalRuns += 1;
    remaining.forEach((needed, itemIndex) => {
      remaining[itemIndex] = Math.max(0, needed - candidates[bestIndex].effects[itemIndex]);
    });
  }

  return { totalRuns, counts };
}

function searchAtRunCount(demands, candidates, totalRuns, deadline, shouldAbort) {
  const counts = Array(candidates.length).fill(0);
  const obtained = Array(demands.length).fill(0);
  let bestPlan = null;
  let exploredNodes = 0;

  function visit(candidateIndex, runsLeft, remaining, usedTypes) {
    exploredNodes += 1;
    if ((exploredNodes & 1023) === 0) {
      if (shouldAbort?.()) throw new DOMException("計算をキャンセルしました。", "AbortError");
      if (Date.now() > deadline) throw new Error("TIMEOUT");
    }

    const neededRuns = lowerBound(remaining, candidates, candidateIndex);
    if (!Number.isFinite(neededRuns) || neededRuns > runsLeft) return;

    const currentExcess = obtained.reduce(
      (sum, quantity, itemIndex) => sum + Math.max(0, quantity - demands[itemIndex]),
      0,
    );
    if (bestPlan && currentExcess > bestPlan.excess) return;

    if (remaining.every((value) => value === 0)) {
      if (runsLeft !== 0) return;
      const stageRuns = counts
        .map((runs, index) => ({ runs, stage: candidates[index].stage }))
        .filter((entry) => entry.runs > 0);
      const lexicalKey = stageRuns
        .flatMap((entry) => Array(entry.runs).fill(entry.stage.name))
        .sort(compareStageNames)
        .join("\u0000");
      const plan = {
        counts: [...counts],
        obtained: [...obtained],
        excess: currentExcess,
        stageTypes: usedTypes,
        lexicalKey,
      };
      if (comparePlans(plan, bestPlan) < 0) bestPlan = plan;
      return;
    }

    if (candidateIndex >= candidates.length || runsLeft === 0) return;

    const candidate = candidates[candidateIndex];
    let maximumUsefulCount = 0;
    for (let itemIndex = 0; itemIndex < remaining.length; itemIndex += 1) {
      const effect = candidate.effects[itemIndex];
      if (effect > 0 && remaining[itemIndex] > 0) {
        maximumUsefulCount = Math.max(maximumUsefulCount, Math.ceil(remaining[itemIndex] / effect));
      }
    }
    maximumUsefulCount = Math.min(maximumUsefulCount, runsLeft);

    for (let runCount = maximumUsefulCount; runCount >= 0; runCount -= 1) {
      counts[candidateIndex] = runCount;
      const nextRemaining = remaining.map((needed, itemIndex) =>
        Math.max(0, needed - candidate.effects[itemIndex] * runCount),
      );
      candidate.effects.forEach((effect, itemIndex) => {
        obtained[itemIndex] += effect * runCount;
      });

      visit(
        candidateIndex + 1,
        runsLeft - runCount,
        nextRemaining,
        usedTypes + (runCount > 0 ? 1 : 0),
      );

      candidate.effects.forEach((effect, itemIndex) => {
        obtained[itemIndex] -= effect * runCount;
      });
      counts[candidateIndex] = 0;
    }
  }

  visit(0, totalRuns, [...demands], 0);
  return { bestPlan, exploredNodes };
}

export function solveMinimumRuns({ requests, stages, timeoutMs = DEFAULT_TIMEOUT_MS, shouldAbort }) {
  const normalizedRequests = requests.map((request) => ({
    itemId: request.itemId,
    quantity: Number(request.quantity),
  }));

  if (
    normalizedRequests.length === 0 ||
    normalizedRequests.some(
      (request) =>
        !request.itemId || !Number.isInteger(request.quantity) || request.quantity < 1 || request.quantity > 999,
    )
  ) {
    return { status: "invalid", message: "必要数は1から999までの整数で入力してください。" };
  }

  const itemIds = normalizedRequests.map((request) => request.itemId);
  if (new Set(itemIds).size !== itemIds.length) {
    return { status: "invalid", message: "同じ設計図を重複して指定できません。" };
  }

  const candidates = makeCandidateStages(stages, itemIds);
  const unavailableItemIds = itemIds.filter(
    (_, itemIndex) => !candidates.some((candidate) => candidate.effects[itemIndex] > 0),
  );
  if (unavailableItemIds.length > 0) return { status: "unavailable", unavailableItemIds };

  const demands = normalizedRequests.map((request) => request.quantity);
  const greedy = makeGreedyPlan(demands, candidates);
  if (!greedy) return { status: "unavailable", unavailableItemIds: itemIds };

  const deadline = Date.now() + timeoutMs;
  const firstRunCount = lowerBound(demands, candidates);
  let totalExploredNodes = 0;

  try {
    for (let runCount = firstRunCount; runCount <= greedy.totalRuns; runCount += 1) {
      const { bestPlan, exploredNodes } = searchAtRunCount(
        demands,
        candidates,
        runCount,
        deadline,
        shouldAbort,
      );
      totalExploredNodes += exploredNodes;
      if (!bestPlan) continue;

      const stageRuns = bestPlan.counts
        .map((runs, index) => ({ stage: candidates[index].stage, runs }))
        .filter((entry) => entry.runs > 0)
        .sort((a, b) => b.runs - a.runs || compareStageNames(a.stage.name, b.stage.name));

      return {
        status: "ok",
        totalRuns: runCount,
        stageRuns,
        itemResults: normalizedRequests.map((request, index) => ({
          itemId: request.itemId,
          required: request.quantity,
          obtained: bestPlan.obtained[index],
          excess: bestPlan.obtained[index] - request.quantity,
        })),
        exploredNodes: totalExploredNodes,
      };
    }
  } catch (error) {
    if (error?.name === "AbortError") return { status: "cancelled" };
    if (error?.message === "TIMEOUT") return { status: "timeout" };
    throw error;
  }

  return { status: "unavailable", unavailableItemIds: itemIds };
}
