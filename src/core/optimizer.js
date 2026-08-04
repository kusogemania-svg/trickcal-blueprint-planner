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

function findMaximumMatching(graph) {
  const vertexCount = graph.length;
  const match = Array(vertexCount).fill(-1);
  const parent = Array(vertexCount).fill(-1);
  const base = Array.from({ length: vertexCount }, (_, index) => index);
  const used = Array(vertexCount).fill(false);
  const blossom = Array(vertexCount).fill(false);

  function lowestCommonAncestor(first, second) {
    const seen = Array(vertexCount).fill(false);
    while (true) {
      first = base[first];
      seen[first] = true;
      if (match[first] === -1) break;
      first = parent[match[first]];
    }
    while (true) {
      second = base[second];
      if (seen[second]) return second;
      second = parent[match[second]];
    }
  }

  function markPath(vertex, blossomBase, child) {
    while (base[vertex] !== blossomBase) {
      blossom[base[vertex]] = true;
      blossom[base[match[vertex]]] = true;
      parent[vertex] = child;
      child = match[vertex];
      vertex = parent[match[vertex]];
    }
  }

  function findAugmentingPath(root) {
    used.fill(false);
    parent.fill(-1);
    for (let index = 0; index < vertexCount; index += 1) base[index] = index;

    const queue = [root];
    used[root] = true;
    for (let head = 0; head < queue.length; head += 1) {
      const vertex = queue[head];
      for (const neighbor of graph[vertex]) {
        if (base[vertex] === base[neighbor] || match[vertex] === neighbor) continue;

        if (neighbor === root || (match[neighbor] !== -1 && parent[match[neighbor]] !== -1)) {
          const blossomBase = lowestCommonAncestor(vertex, neighbor);
          blossom.fill(false);
          markPath(vertex, blossomBase, neighbor);
          markPath(neighbor, blossomBase, vertex);
          for (let index = 0; index < vertexCount; index += 1) {
            if (!blossom[base[index]]) continue;
            base[index] = blossomBase;
            if (!used[index]) {
              used[index] = true;
              queue.push(index);
            }
          }
        } else if (parent[neighbor] === -1) {
          parent[neighbor] = vertex;
          if (match[neighbor] === -1) {
            let current = neighbor;
            while (current !== -1) {
              const previous = parent[current];
              const next = previous === -1 ? -1 : match[previous];
              match[current] = previous;
              if (previous !== -1) match[previous] = current;
              current = next;
            }
            return true;
          }
          const matchedNeighbor = match[neighbor];
          used[matchedNeighbor] = true;
          queue.push(matchedNeighbor);
        }
      }
    }
    return false;
  }

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    if (match[vertex] === -1) findAugmentingPath(vertex);
  }
  return match;
}

function makeUnitPairPlan(demands, candidates) {
  const totalDemand = demands.reduce((sum, demand) => sum + demand, 0);
  if (totalDemand > 600) return null;

  const singletonCandidates = Array(demands.length).fill(-1);
  const pairCandidates = new Map();
  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
    const affectedItems = [];
    for (let itemIndex = 0; itemIndex < demands.length; itemIndex += 1) {
      const effect = candidates[candidateIndex].effects[itemIndex];
      if (effect !== 0 && effect !== 1) return null;
      if (effect === 1) affectedItems.push(itemIndex);
    }
    if (affectedItems.length === 1) singletonCandidates[affectedItems[0]] = candidateIndex;
    else if (affectedItems.length === 2) pairCandidates.set(affectedItems.join(","), candidateIndex);
    else return null;
  }
  if (singletonCandidates.some((candidateIndex) => candidateIndex === -1)) return null;

  const cloneItems = [];
  const itemClones = demands.map((demand, itemIndex) => {
    const clones = [];
    for (let count = 0; count < demand; count += 1) {
      clones.push(cloneItems.length);
      cloneItems.push(itemIndex);
    }
    return clones;
  });
  const graph = Array.from({ length: cloneItems.length }, () => []);
  for (const key of pairCandidates.keys()) {
    const [firstItem, secondItem] = key.split(",").map(Number);
    for (const firstClone of itemClones[firstItem]) {
      for (const secondClone of itemClones[secondItem]) {
        graph[firstClone].push(secondClone);
        graph[secondClone].push(firstClone);
      }
    }
  }

  const match = findMaximumMatching(graph);
  const counts = Array(candidates.length).fill(0);
  let matchedPairs = 0;
  for (let clone = 0; clone < match.length; clone += 1) {
    if (match[clone] === -1) {
      counts[singletonCandidates[cloneItems[clone]]] += 1;
    } else if (clone < match[clone]) {
      const itemPair = [cloneItems[clone], cloneItems[match[clone]]].sort((a, b) => a - b).join(",");
      counts[pairCandidates.get(itemPair)] += 1;
      matchedPairs += 1;
    }
  }

  return {
    counts,
    obtained: [...demands],
    excess: 0,
    stageTypes: counts.filter((count) => count > 0).length,
    totalRuns: totalDemand - matchedPairs,
  };
}

function formatResult(normalizedRequests, candidates, plan, totalRuns, exploredNodes) {
  const stageRuns = plan.counts
    .map((runs, index) => ({ stage: candidates[index].stage, runs }))
    .filter((entry) => entry.runs > 0)
    .sort((a, b) => b.runs - a.runs || compareStageNames(a.stage.name, b.stage.name));

  return {
    status: "ok",
    totalRuns,
    stageRuns,
    itemResults: normalizedRequests.map((request, index) => ({
      itemId: request.itemId,
      required: request.quantity,
      obtained: plan.obtained[index],
      excess: plan.obtained[index] - request.quantity,
    })),
    exploredNodes,
  };
}

function searchAtRunCount(demands, candidates, totalRuns, deadline, shouldAbort) {
  const counts = Array(candidates.length).fill(0);
  const obtained = Array(demands.length).fill(0);
  let bestPlan = null;
  let exploredNodes = 0;

  function visit(candidateIndex, runsLeft, remaining, usedTypes) {
    exploredNodes += 1;
    if (shouldAbort?.()) throw new DOMException("計算をキャンセルしました。", "AbortError");
    if (Date.now() > deadline) throw new Error("TIMEOUT");

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

  if (demands.reduce((sum, demand) => sum + demand, 0) >= 64) {
    const unitPairPlan = makeUnitPairPlan(demands, candidates);
    if (unitPairPlan) {
      return formatResult(normalizedRequests, candidates, unitPairPlan, unitPairPlan.totalRuns, 0);
    }
  }

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
      return formatResult(normalizedRequests, candidates, bestPlan, runCount, totalExploredNodes);
    }
  } catch (error) {
    if (error?.name === "AbortError") return { status: "cancelled" };
    if (error?.message === "TIMEOUT") return { status: "timeout" };
    throw error;
  }

  return { status: "unavailable", unavailableItemIds: itemIds };
}
