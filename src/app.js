import { downloadBackup, parseBackup } from "./core/backup.js";
import {
  CATEGORY_ORDER,
  compareItems,
  compareStages,
  deriveItemName,
  deriveStageName,
  itemIdentityKey,
  stageIdentityKey,
} from "./core/catalog.js";
import { loadMasterData, resetMasterData, saveMasterData } from "./core/storage.js";

const app = document.querySelector("#app");

const state = {
  view: "planner",
  editSection: "items",
  masterData: null,
  requests: [],
  result: null,
  busy: false,
  worker: null,
  calculationTimer: null,
  focusedQuantityId: null,
  modal: null,
  selector: { ranks: [], categories: [], draftIds: [] },
  editorQuery: "",
  toast: "",
};

const categoryGlyphs = {
  鎧: "鎧",
  帽子: "帽",
  リング: "輪",
  ブーツ: "靴",
  ネックレス: "飾",
  剣: "剣",
  杖: "杖",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getItem(itemId) {
  return state.masterData.items.find((item) => item.id === itemId);
}

function itemIcon(item, className = "item-icon") {
  const iconSource = item?.icon?.data ?? item?.defaultIconPath;
  if (iconSource) {
    return `<span class="${className}"><img src="${escapeHtml(iconSource)}" alt="" loading="lazy" /></span>`;
  }
  return `<span class="${className} fallback-icon rank-${item?.rank ?? "x"}" aria-hidden="true">${escapeHtml(
    categoryGlyphs[item?.category] ?? "設",
  )}</span>`;
}

function showToast(message) {
  state.toast = message;
  render();
  window.setTimeout(() => {
    if (state.toast === message) {
      state.toast = "";
      render();
    }
  }, 3200);
}

function navButton(view, label, glyph) {
  const active = state.view === view;
  return `<button class="nav-button ${active ? "active" : ""}" data-view="${view}" aria-current="${
    active ? "page" : "false"
  }"><span aria-hidden="true">${glyph}</span><small>${label}</small></button>`;
}

function renderHeader() {
  const labels = { planner: "最小周回プラン", editor: "データ編集", backup: "バックアップ" };
  return `<header class="app-header">
    <div class="app-title"><span class="mini-mark" aria-hidden="true">設</span><div><small>TRICKCAL TOOL</small><strong>${labels[state.view]}</strong></div></div>
    <span class="local-badge">端末内保存</span>
  </header>`;
}

function renderRequestRow(request) {
  const item = getItem(request.itemId);
  const quantity = String(request.quantity ?? "");
  const valid = /^\d+$/.test(quantity) && Number(quantity) >= 1 && Number(quantity) <= 999;
  return `<article class="request-row ${valid ? "" : "has-error"}">
    ${itemIcon(item)}
    <div class="request-name"><strong>${escapeHtml(item?.name ?? "削除された設計図")}</strong><small>${escapeHtml(
      item?.category ?? "分類なし",
    )}</small></div>
    <label class="quantity-field"><span>必要数</span><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" value="${escapeHtml(
      quantity,
    )}" data-quantity-id="${escapeHtml(request.itemId)}" aria-label="${escapeHtml(item?.name)}の必要数" /></label>
    <button class="icon-button danger" data-remove-request="${escapeHtml(request.itemId)}" aria-label="${escapeHtml(
      item?.name,
    )}を削除">×</button>
    ${valid ? "" : '<p class="field-error">1〜999の整数を入力してください。</p>'}
  </article>`;
}

function validateRequests() {
  return (
    state.requests.length > 0 &&
    state.requests.every((request) => {
      const quantity = Number(request.quantity);
      return Number.isInteger(quantity) && quantity >= 1 && quantity <= 999;
    })
  );
}

function renderResult() {
  if (!state.result) return "";
  if (state.result.status !== "ok") {
    const messages = {
      timeout: "計算時間の上限を超えました。条件を減らしてもう一度お試しください。",
      cancelled: "計算をキャンセルしました。",
      invalid: state.result.message,
      error: state.result.message ?? "計算中にエラーが発生しました。",
      unavailable: `入手できるステージがない設計図があります：${state.result.unavailableItemIds
        .map((id) => getItem(id)?.name ?? id)
        .join("、")}`,
    };
    return `<section class="result-panel error-panel"><h2>計算できませんでした</h2><p>${escapeHtml(
      messages[state.result.status] ?? "不明なエラーです。",
    )}</p></section>`;
  }

  const stageCards = state.result.stageRuns
    .map(({ stage, runs, isAnywhere, usefulItemIds = [] }) => {
      const displayedDrops = isAnywhere
        ? stage.drops.filter((drop) => usefulItemIds.includes(drop.itemId))
        : stage.drops;
      const drops = displayedDrops
        .map((drop) => {
          const item = getItem(drop.itemId);
          return `<li>${itemIcon(item, "tiny-icon")}<span>${escapeHtml(item?.name ?? drop.itemId)}</span><strong>×${
            drop.quantity * runs
          }</strong></li>`;
        })
        .join("");
      return `<article class="stage-card"><div class="stage-number"><small>STAGE</small><strong>${escapeHtml(
        isAnywhere ? "anywhere" : stage.name,
      )}</strong></div><div class="run-count"><strong>${runs}</strong><span>周</span></div><ul>${drops}</ul></article>`;
    })
    .join("");

  const itemRows = state.result.itemResults
    .map((entry) => {
      const item = getItem(entry.itemId);
      return `<tr><td>${itemIcon(item, "tiny-icon")}<span>${escapeHtml(item?.name ?? entry.itemId)}</span></td><td>${
        entry.required
      }</td><td>${entry.obtained}</td><td class="${entry.excess > 0 ? "excess" : ""}">+${entry.excess}</td></tr>`;
    })
    .join("");

  return `<section class="result-panel" id="calculation-result">
    <div class="result-hero"><div><small>MINIMUM ROUTE</small><h2>最小周回ルート</h2></div><div class="total-runs"><strong>${state.result.totalRuns}</strong><span>周</span></div></div>
    <h3>ステージ別</h3><div class="stage-list">${stageCards}</div>
    <h3>獲得内訳</h3><div class="table-scroll"><table><thead><tr><th>設計図</th><th>必要</th><th>獲得</th><th>余剰</th></tr></thead><tbody>${itemRows}</tbody></table></div>
  </section>`;
}

function renderPlanner() {
  return `<main class="main-content planner-content">
    <section class="intro-card"><p class="eyebrow">100% DROP SIMULATION</p><h1>欲しい設計図を<br />いちばん少ない周回で。</h1><p>設計図と必要数を選ぶと、副産物まで含めた最短ルートを計算します。</p><div class="assumption-chip">1周で登録ドロップを各1個獲得</div></section>
    <section class="request-section"><div class="section-heading"><div><small>STEP 1</small><h2>必要な設計図</h2></div><span>${state.requests.length}件</span></div>
      <div class="request-list">${
        state.requests.length > 0
          ? state.requests.map(renderRequestRow).join("")
          : '<div class="empty-state"><span aria-hidden="true">＋</span><strong>設計図を追加してください</strong><p>複数種類をまとめて選べます。</p></div>'
      }</div>
      <button class="secondary-button full" data-open-selector>設計図を追加</button>
    </section>
    ${state.busy ? '<div class="calculation-status" role="status"><span aria-hidden="true"></span>結果を更新しています…</div>' : ""}
    ${renderResult()}
  </main>`;
}

function renderItemSelector() {
  const alreadyAddedIds = new Set(state.requests.map((request) => request.itemId));
  const draftIds = new Set(state.selector.draftIds);
  const ranks = [...new Set(state.masterData.items.map((item) => item.rank ?? "__unset__"))].sort((a, b) => {
    if (a === "__unset__") return -1;
    if (b === "__unset__") return 1;
    return b - a;
  });
  const categorySet = new Set(state.masterData.items.map((item) => item.category?.trim() || "__unset__"));
  const categories = [
    ...(categorySet.has("__unset__") ? ["__unset__"] : []),
    ...CATEGORY_ORDER.filter((category) => categorySet.has(category)),
    ...[...categorySet]
      .filter((category) => category !== "__unset__" && !CATEGORY_ORDER.includes(category))
      .sort((a, b) => a.localeCompare(b, "ja")),
  ];
  const selectedRanks = new Set(state.selector.ranks);
  const selectedCategories = new Set(state.selector.categories);
  const filtered = [...state.masterData.items].sort(compareItems).filter((item) => {
    const rankKey = item.rank ?? "__unset__";
    const categoryKey = item.category?.trim() || "__unset__";
    return (
      (selectedRanks.size === 0 || selectedRanks.has(String(rankKey))) &&
      (selectedCategories.size === 0 || selectedCategories.has(categoryKey))
    );
  });

  return `<div class="modal-backdrop" data-close-modal><section class="modal-sheet selector-sheet" role="dialog" aria-modal="true" aria-labelledby="selector-title" data-modal-panel>
    <div class="modal-handle"></div><div class="modal-header"><div><small>SELECT BLUEPRINT</small><h2 id="selector-title">設計図を選択</h2></div><button class="confirm-button" data-confirm-selection>確定${draftIds.size ? `（${draftIds.size}）` : ""}</button></div>
    <div class="selector-filters"><fieldset class="filter-group"><legend>ランク（複数選択可）</legend><div class="filter-chips">${ranks
      .map((rank) => {
        const value = String(rank);
        const active = selectedRanks.has(value);
        return `<button type="button" class="filter-chip ${active ? "active" : ""}" data-filter-rank="${escapeHtml(
          value,
        )}" aria-pressed="${active}">${rank === "__unset__" ? "未設定" : `ランク${rank}`}</button>`;
      })
      .join("")}</div></fieldset><fieldset class="filter-group"><legend>分類（複数選択可）</legend><div class="filter-chips">${categories
      .map((category) => {
        const active = selectedCategories.has(category);
        return `<button type="button" class="filter-chip ${active ? "active" : ""}" data-filter-category="${escapeHtml(
          category,
        )}" aria-pressed="${active}">${escapeHtml(category === "__unset__" ? "未設定" : category)}</button>`;
      })
      .join("")}</div></fieldset></div>
    <div class="item-grid">${filtered
      .map((item) => {
        const alreadyAdded = alreadyAddedIds.has(item.id);
        const selected = draftIds.has(item.id);
        return `<button class="item-choice ${alreadyAdded ? "already-added" : ""} ${selected ? "selected" : ""}" data-select-item="${escapeHtml(item.id)}" ${
          alreadyAdded ? "disabled" : ""
        }>${itemIcon(item)}<span><small>RANK ${item.rank ?? "-"}</small><strong>${escapeHtml(item.category || item.name)}</strong></span>${
          alreadyAdded ? '<em>追加済み</em>' : selected ? '<em>選択中</em>' : ""
        }</button>`;
      })
      .join("")}</div>
  </section></div>`;
}

function renderEditor() {
  const isItems = state.editSection === "items";
  const query = state.editorQuery.toLowerCase();
  const entries = [...(isItems ? state.masterData.items : state.masterData.stages)]
    .sort(isItems ? compareItems : compareStages)
    .filter((entry) => entry.name.toLowerCase().includes(query));
  const cards = entries
    .map((entry) => {
      if (isItems) {
        return `<article class="manage-row">${itemIcon(entry)}<div><strong>${escapeHtml(entry.name)}</strong><small>ランク${
          entry.rank ?? "-"
        }・${escapeHtml(entry.category || "分類なし")}</small></div><button class="small-button" data-edit-item="${escapeHtml(
          entry.id,
        )}">編集</button><button class="icon-button danger" data-delete-item="${escapeHtml(entry.id)}" aria-label="削除">×</button></article>`;
      }
      const dropNames = entry.drops.map((drop) => getItem(drop.itemId)?.category ?? "不明").join("・");
      return `<article class="manage-row stage-manage-row"><div class="stage-chip">${escapeHtml(
        entry.name,
      )}</div><div><strong>ドロップ ${entry.drops.length}件</strong><small>${escapeHtml(dropNames)}</small></div><button class="small-button" data-edit-stage="${escapeHtml(
        entry.id,
      )}">編集</button><button class="icon-button danger" data-delete-stage="${escapeHtml(entry.id)}" aria-label="削除">×</button></article>`;
    })
    .join("");

  return `<main class="main-content"><section class="page-lead"><p class="eyebrow">LOCAL MASTER DATA</p><h1>ドロップ表を<br />自分で育てる。</h1><p>追加・修正した内容は、この端末のブラウザ内だけに保存されます。</p></section>
    <div class="segment-control"><button data-edit-section="items" class="${isItems ? "active" : ""}">設計図</button><button data-edit-section="stages" class="${!isItems ? "active" : ""}">ステージ</button></div>
    <section class="manage-section"><div class="section-heading"><div><small>${isItems ? "BLUEPRINTS" : "STAGES"}</small><h2>${
      isItems ? "設計図管理" : "ステージ管理"
    }</h2></div><span>${entries.length}件</span></div>
      <div class="manage-tools"><input type="search" placeholder="${isItems ? "ランク・分類で検索" : "ステージ番号で検索"}" value="${escapeHtml(
        state.editorQuery,
      )}" data-editor-query /><button class="primary-button compact" data-add-entry>${isItems ? "設計図を追加" : "ステージを追加"}</button></div>
      <div class="manage-list">${cards || '<div class="empty-state"><strong>該当するデータがありません</strong></div>'}</div>
    </section>
    <section class="danger-zone"><div><strong>初期データへ戻す</strong><p>編集した設計図、ステージ、登録画像を削除します。</p></div><button class="danger-button" data-reset-master>リセット</button></section>
  </main>`;
}

function itemEditorModal() {
  const item = state.modal.itemId ? getItem(state.modal.itemId) : null;
  return `<div class="modal-backdrop" data-close-modal><section class="modal-sheet form-sheet" role="dialog" aria-modal="true" data-modal-panel><div class="modal-handle"></div><div class="modal-header"><div><small>BLUEPRINT DATA</small><h2>${
    item ? "設計図を編集" : "設計図を追加"
  }</h2></div><button class="icon-button" data-close-modal>×</button></div>
    <form data-item-form><label>ランク<input name="rank" type="number" inputmode="numeric" min="1" step="1" value="${
      item?.rank ?? ""
    }" placeholder="未設定も可" /></label>
    <label>装備分類<input name="category" list="category-list" maxlength="40" value="${escapeHtml(
      item?.category ?? "",
    )}" placeholder="未設定も可" /></label><datalist id="category-list">${CATEGORY_ORDER
      .map((category) => `<option value="${escapeHtml(category)}"></option>`)
      .join("")}</datalist>
    <label>アイコン画像<input name="icon" type="file" accept="image/png,image/jpeg,image/webp" /></label>${
      item?.icon ? '<label class="check-label"><input name="removeIcon" type="checkbox" />登録画像を削除する</label>' : ""
    }<p class="form-error" data-item-form-error></p><button class="primary-button full" type="submit">保存する</button></form>
  </section></div>`;
}

function stageEditorModal() {
  const draft = state.modal.draft;
  const sortedItems = [...state.masterData.items].sort(compareItems);
  const itemOptions = sortedItems
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
    .join("");
  const dropRows = draft.drops
    .map(
      (drop, index) => `<div class="drop-edit-row"><select data-drop-item="${index}">${sortedItems
        .map(
          (item) =>
            `<option value="${escapeHtml(item.id)}" ${drop.itemId === item.id ? "selected" : ""}>${escapeHtml(
              item.name,
            )}</option>`,
        )
        .join("") || itemOptions}</select><input type="number" min="1" step="1" value="${drop.quantity}" data-drop-quantity="${
        index
      }" aria-label="1周あたりの個数" /><button type="button" class="icon-button danger" data-remove-drop="${index}" aria-label="ドロップを削除">×</button></div>`,
    )
    .join("");

  return `<div class="modal-backdrop" data-close-modal><section class="modal-sheet form-sheet" role="dialog" aria-modal="true" data-modal-panel><div class="modal-handle"></div><div class="modal-header"><div><small>STAGE DATA</small><h2>${
    state.modal.stageId ? "ステージを編集" : "ステージを追加"
  }</h2></div><button class="icon-button" data-close-modal>×</button></div>
    <form data-stage-form><div class="two-columns"><label>章番号<input required type="number" inputmode="numeric" min="1" step="1" value="${escapeHtml(
      draft.chapter,
    )}" data-stage-chapter /></label><label>ステージ番号<input required type="number" inputmode="numeric" min="1" step="1" value="${escapeHtml(
      draft.number,
    )}" data-stage-number /></label></div><fieldset><legend>ドロップ</legend><div class="drop-edit-list">${dropRows}</div><button type="button" class="secondary-button full" data-add-drop>ドロップを追加</button></fieldset><p class="form-error" data-form-error></p><button class="primary-button full" type="submit">保存する</button></form>
  </section></div>`;
}

function renderBackup() {
  return `<main class="main-content"><section class="page-lead backup-lead"><p class="eyebrow">DATA PORTABILITY</p><h1>端末の外にも、<br />安心をひとつ。</h1><p>設計図、ステージ、登録画像を1つのJSONファイルにまとめます。</p></section>
    <section class="backup-card"><span class="backup-glyph" aria-hidden="true">↓</span><div><small>EXPORT</small><h2>バックアップを書き出す</h2><p>現在のマスターデータを保存します。機種変更前にも実行してください。</p></div><button class="primary-button full" data-export>JSONを書き出す</button></section>
    <section class="backup-card"><span class="backup-glyph restore" aria-hidden="true">↑</span><div><small>RESTORE</small><h2>バックアップから復元</h2><p>読み込み前に内容を検証し、問題がある場合は現在のデータを変更しません。</p></div><label class="secondary-button full file-button">JSONを選択<input type="file" accept="application/json,.json" data-import /></label></section>
    <aside class="privacy-note"><strong>このアプリの保存範囲</strong><p>計算条件と結果は保存しません。マスターデータだけをブラウザ内に保存します。</p></aside>
  </main>`;
}

function renderModal() {
  if (!state.modal) return "";
  if (state.modal.type === "selector") return renderItemSelector();
  if (state.modal.type === "item") return itemEditorModal();
  if (state.modal.type === "stage") return stageEditorModal();
  return "";
}

function render() {
  const content =
    state.view === "planner" ? renderPlanner() : state.view === "editor" ? renderEditor() : renderBackup();
  app.innerHTML = `${renderHeader()}${content}<nav class="bottom-nav" aria-label="主要メニュー">${navButton(
    "planner",
    "周回計算",
    "◎",
  )}${navButton("editor", "データ編集", "▦")}${navButton("backup", "バックアップ", "⇅")}</nav>${
    state.toast ? `<div class="toast" role="status">${escapeHtml(state.toast)}</div>` : ""
  }${renderModal()}`;
  bindEvents();
  if (state.focusedQuantityId) {
    const input = document.querySelector(`[data-quantity-id="${CSS.escape(state.focusedQuantityId)}"]`);
    if (input) {
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
}

function closeModal() {
  state.modal = null;
  render();
}

function makeStageDraft(stage) {
  return stage
    ? { chapter: stage.chapter, number: stage.number, drops: structuredClone(stage.drops) }
    : {
        chapter: "",
        number: "",
        drops: [{ itemId: state.masterData.items[0]?.id ?? "", quantity: 1 }],
      };
}

function updateStageDraftFromElement(target) {
  if (target.matches("[data-stage-chapter]")) state.modal.draft.chapter = target.value;
  if (target.matches("[data-stage-number]")) state.modal.draft.number = target.value;
  if (target.matches("[data-drop-item]")) state.modal.draft.drops[Number(target.dataset.dropItem)].itemId = target.value;
  if (target.matches("[data-drop-quantity]")) {
    state.modal.draft.drops[Number(target.dataset.dropQuantity)].quantity = Number(target.value);
  }
}

async function persistMaster(message) {
  try {
    state.masterData = await saveMasterData(state.masterData);
    state.modal = null;
    queueCalculation();
    showToast(message);
  } catch (error) {
    stopPendingCalculation();
    state.masterData = await loadMasterData();
    render();
    showToast(`保存できませんでした：${error.message}`);
  }
}

function readImage(file) {
  if (!file) return Promise.resolve(null);
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return Promise.reject(new Error("PNG、JPEG、WebP画像を選択してください。"));
  }
  if (file.size > 2 * 1024 * 1024) return Promise.reject(new Error("画像は2MB以下にしてください。"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve({ mimeType: file.type, data: reader.result }));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function handleItemSubmit(form) {
  const formData = new FormData(form);
  const existing = state.modal.itemId ? getItem(state.modal.itemId) : null;
  const rankText = String(formData.get("rank") ?? "").trim();
  const rank = rankText ? Number(rankText) : null;
  const category = String(formData.get("category") ?? "").trim();
  if (rank != null && (!Number.isInteger(rank) || rank < 1)) throw new Error("ランクは1以上の整数で入力してください。");
  const identityKey = itemIdentityKey({ rank, category });
  if (state.masterData.items.some((item) => item.id !== existing?.id && itemIdentityKey(item) === identityKey)) {
    throw new Error("同じランクと装備分類の設計図がすでに登録されています。");
  }
  const now = new Date().toISOString();
  let icon = existing?.icon ?? null;
  if (formData.get("removeIcon")) icon = null;
  const file = formData.get("icon");
  if (file instanceof File && file.size > 0) icon = await readImage(file);

  const item = {
    id: existing?.id ?? `item-${crypto.randomUUID()}`,
    code: existing?.code ?? null,
    name: deriveItemName({ rank, category }),
    rank,
    category,
    icon,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (existing) {
    state.masterData.items = state.masterData.items.map((entry) => (entry.id === item.id ? item : entry));
  } else {
    state.masterData.items.push(item);
  }
  await persistMaster(existing ? "設計図を更新しました。" : "設計図を追加しました。");
}

async function handleStageSubmit() {
  const draft = state.modal.draft;
  const existing = state.modal.stageId
    ? state.masterData.stages.find((stage) => stage.id === state.modal.stageId)
    : null;
  const chapter = Number(draft.chapter);
  const number = Number(draft.number);
  if (!Number.isInteger(chapter) || chapter < 1) throw new Error("章番号は1以上の整数で入力してください。");
  if (!Number.isInteger(number) || number < 1) throw new Error("ステージ番号は1以上の整数で入力してください。");
  if (draft.drops.length === 0) throw new Error("ドロップを1件以上追加してください。");
  if (draft.drops.some((drop) => !drop.itemId || !Number.isInteger(drop.quantity) || drop.quantity < 1)) {
    throw new Error("ドロップと1周あたりの個数を正しく入力してください。");
  }
  if (new Set(draft.drops.map((drop) => drop.itemId)).size !== draft.drops.length) {
    throw new Error("同じ設計図を重複して登録できません。");
  }
  const identityKey = stageIdentityKey({ chapter, number });
  if (state.masterData.stages.some((stage) => stage.id !== existing?.id && stageIdentityKey(stage) === identityKey)) {
    throw new Error("同じ章番号とステージ番号がすでに登録されています。");
  }

  const now = new Date().toISOString();
  const stage = {
    id: existing?.id ?? `stage-${crypto.randomUUID()}`,
    chapter,
    number,
    name: deriveStageName({ chapter, number }),
    drops: structuredClone(draft.drops),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (existing) {
    state.masterData.stages = state.masterData.stages.map((entry) => (entry.id === stage.id ? stage : entry));
  } else {
    state.masterData.stages.push(stage);
  }
  await persistMaster(existing ? "ステージを更新しました。" : "ステージを追加しました。");
}

function stopPendingCalculation() {
  if (state.calculationTimer) window.clearTimeout(state.calculationTimer);
  state.calculationTimer = null;
  state.worker?.terminate();
  state.worker = null;
  state.busy = false;
}

function runCalculation() {
  state.calculationTimer = null;
  if (!validateRequests()) {
    state.busy = false;
    state.result = null;
    render();
    return;
  }
  const worker = new Worker(new URL("./optimizer.worker.js", import.meta.url), { type: "module" });
  state.worker = worker;
  const requestId = crypto.randomUUID();
  worker.addEventListener("message", (event) => {
    if (event.data.requestId !== requestId || state.worker !== worker) return;
    state.result = event.data.result;
    state.busy = false;
    state.worker = null;
    worker.terminate();
    render();
  });
  worker.addEventListener("error", (event) => {
    if (state.worker !== worker) return;
    state.result = { status: "error", message: event.message };
    state.busy = false;
    state.worker = null;
    worker.terminate();
    render();
  });
  worker.postMessage({
    requestId,
    requests: state.requests.map((request) => ({ itemId: request.itemId, quantity: Number(request.quantity) })),
    stages: state.masterData.stages,
    timeoutMs: 2800,
  });
}

function queueCalculation() {
  stopPendingCalculation();
  state.result = null;
  if (validateRequests()) {
    state.busy = true;
    state.calculationTimer = window.setTimeout(runCalculation, 180);
  }
  render();
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) =>
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      state.modal = null;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }),
  );
  document.querySelector("[data-open-selector]")?.addEventListener("click", () => {
    state.selector.ranks = [];
    state.selector.categories = [];
    state.selector.draftIds = [];
    state.modal = { type: "selector" };
    render();
  });
  document.querySelectorAll("[data-close-modal]").forEach((element) =>
    element.addEventListener("click", (event) => {
      if (element.hasAttribute("data-modal-panel")) return;
      if (event.target.closest("[data-modal-panel]") && !event.target.closest("[data-close-modal]")) return;
      closeModal();
    }),
  );
  document.querySelectorAll("[data-modal-panel]").forEach((panel) => panel.addEventListener("click", (event) => event.stopPropagation()));

  document.querySelectorAll("[data-quantity-id]").forEach((input) =>
    {
      input.addEventListener("focus", () => {
        state.focusedQuantityId = input.dataset.quantityId;
      });
      input.addEventListener("input", () => {
        const request = state.requests.find((entry) => entry.itemId === input.dataset.quantityId);
        input.value = input.value.replace(/[^0-9]/g, "").slice(0, 3);
        request.quantity = input.value;
        state.focusedQuantityId = request.itemId;
        queueCalculation();
      });
      input.addEventListener("blur", () => {
        const quantityId = input.dataset.quantityId;
        window.setTimeout(() => {
          if (
            state.focusedQuantityId === quantityId &&
            document.activeElement?.dataset.quantityId !== quantityId
          ) {
            state.focusedQuantityId = null;
          }
        }, 0);
      });
    },
  );
  document.querySelectorAll("[data-remove-request]").forEach((button) =>
    button.addEventListener("click", () => {
      state.requests = state.requests.filter((request) => request.itemId !== button.dataset.removeRequest);
      queueCalculation();
    }),
  );

  document.querySelectorAll("[data-filter-rank]").forEach((button) =>
    button.addEventListener("click", () => {
      const value = button.dataset.filterRank;
      state.selector.ranks = state.selector.ranks.includes(value)
        ? state.selector.ranks.filter((entry) => entry !== value)
        : [...state.selector.ranks, value];
      render();
    }),
  );
  document.querySelectorAll("[data-filter-category]").forEach((button) =>
    button.addEventListener("click", () => {
      const value = button.dataset.filterCategory;
      state.selector.categories = state.selector.categories.includes(value)
        ? state.selector.categories.filter((entry) => entry !== value)
        : [...state.selector.categories, value];
      render();
    }),
  );
  document.querySelectorAll("[data-select-item]").forEach((button) =>
    button.addEventListener("click", () => {
      const itemId = button.dataset.selectItem;
      state.selector.draftIds = state.selector.draftIds.includes(itemId)
        ? state.selector.draftIds.filter((entry) => entry !== itemId)
        : [...state.selector.draftIds, itemId];
      render();
    }),
  );
  document.querySelector("[data-confirm-selection]")?.addEventListener("click", () => {
    const existingIds = new Set(state.requests.map((request) => request.itemId));
    state.selector.draftIds.forEach((itemId) => {
      if (!existingIds.has(itemId)) state.requests.push({ itemId, quantity: "" });
    });
    state.requests.sort((a, b) => compareItems(getItem(a.itemId), getItem(b.itemId)));
    state.selector.draftIds = [];
    state.modal = null;
    queueCalculation();
  });

  document.querySelectorAll("[data-edit-section]").forEach((button) =>
    button.addEventListener("click", () => {
      state.editSection = button.dataset.editSection;
      state.editorQuery = "";
      render();
    }),
  );
  document.querySelector("[data-editor-query]")?.addEventListener("input", (event) => {
    state.editorQuery = event.target.value;
    render();
    const input = document.querySelector("[data-editor-query]");
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  });
  document.querySelector("[data-add-entry]")?.addEventListener("click", () => {
    state.modal =
      state.editSection === "items"
        ? { type: "item", itemId: null }
        : { type: "stage", stageId: null, draft: makeStageDraft(null) };
    render();
  });
  document.querySelectorAll("[data-edit-item]").forEach((button) =>
    button.addEventListener("click", () => {
      state.modal = { type: "item", itemId: button.dataset.editItem };
      render();
    }),
  );
  document.querySelectorAll("[data-edit-stage]").forEach((button) =>
    button.addEventListener("click", () => {
      const stage = state.masterData.stages.find((entry) => entry.id === button.dataset.editStage);
      state.modal = { type: "stage", stageId: stage.id, draft: makeStageDraft(stage) };
      render();
    }),
  );
  document.querySelectorAll("[data-delete-item]").forEach((button) =>
    button.addEventListener("click", async () => {
      const item = getItem(button.dataset.deleteItem);
      const references = state.masterData.stages.filter((stage) => stage.drops.some((drop) => drop.itemId === item.id));
      if (references.length > 0) {
        const names = references.map((stage) => stage.name).join("、");
        showToast(`先に参照ステージを変更してください：${names}`);
        return;
      }
      if (!window.confirm(`「${item.name}」を削除しますか？`)) return;
      state.masterData.items = state.masterData.items.filter((entry) => entry.id !== item.id);
      state.requests = state.requests.filter((request) => request.itemId !== item.id);
      await persistMaster("設計図を削除しました。");
    }),
  );
  document.querySelectorAll("[data-delete-stage]").forEach((button) =>
    button.addEventListener("click", async () => {
      const stage = state.masterData.stages.find((entry) => entry.id === button.dataset.deleteStage);
      if (!window.confirm(`ステージ「${stage.name}」を削除しますか？`)) return;
      state.masterData.stages = state.masterData.stages.filter((entry) => entry.id !== stage.id);
      await persistMaster("ステージを削除しました。");
    }),
  );
  document.querySelector("[data-reset-master]")?.addEventListener("click", async () => {
    if (!window.confirm("編集した設計図、ステージ、登録画像を削除して初期データへ戻しますか？")) return;
    stopPendingCalculation();
    state.masterData = await resetMasterData();
    state.requests = [];
    state.result = null;
    showToast("初期データへ戻しました。");
  });

  document.querySelector("[data-item-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await handleItemSubmit(event.currentTarget);
    } catch (error) {
      const output = document.querySelector("[data-item-form-error]");
      if (output) output.textContent = error.message;
    }
  });
  document.querySelector("[data-stage-form]")?.addEventListener("input", (event) => updateStageDraftFromElement(event.target));
  document.querySelector("[data-stage-form]")?.addEventListener("change", (event) => updateStageDraftFromElement(event.target));
  document.querySelector("[data-stage-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await handleStageSubmit();
    } catch (error) {
      const output = document.querySelector("[data-form-error]");
      if (output) output.textContent = error.message;
    }
  });
  document.querySelector("[data-add-drop]")?.addEventListener("click", () => {
    state.modal.draft.drops.push({ itemId: state.masterData.items[0]?.id ?? "", quantity: 1 });
    render();
  });
  document.querySelectorAll("[data-remove-drop]").forEach((button) =>
    button.addEventListener("click", () => {
      state.modal.draft.drops.splice(Number(button.dataset.removeDrop), 1);
      render();
    }),
  );

  document.querySelector("[data-export]")?.addEventListener("click", () => {
    downloadBackup(state.masterData);
    showToast("バックアップを書き出しました。");
  });
  document.querySelector("[data-import]")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const restored = parseBackup(await file.text());
      if (!window.confirm("現在のマスターデータを、選択したバックアップで置き換えますか？")) return;
      await saveMasterData(restored);
      stopPendingCalculation();
      state.masterData = restored;
      state.requests = [];
      state.result = null;
      showToast("バックアップを復元しました。");
    } catch (error) {
      showToast(`復元できませんでした：${error.message}`);
    }
  });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  try {
    const registration = await navigator.serviceWorker.register(new URL("../service-worker.js", import.meta.url), {
      scope: "../",
    });
    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      installing?.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          showToast("新しいバージョンがあります。再読み込みすると更新されます。");
        }
      });
    });
  } catch (error) {
    console.warn("Service Worker registration failed", error);
  }
}

async function start() {
  try {
    state.masterData = await loadMasterData();
    render();
    registerServiceWorker();
  } catch (error) {
    app.innerHTML = `<main class="fatal-error"><h1>初期データを読み込めませんでした</h1><p>${escapeHtml(
      error.message,
    )}</p><button onclick="location.reload()">再読み込み</button></main>`;
  }
}

start();
