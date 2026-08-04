const CATEGORY_RENAMES = Object.freeze({
  煌めく装飾品: "リング",
  華麗な装飾品: "ネックレス",
  物理武器: "剣",
  魔法武器: "杖",
});

export function migrateKnownNames(masterData) {
  const migrated = structuredClone(masterData);
  let changed = false;

  migrated.items = migrated.items.map((item) => {
    if (item.code == null) return item;

    const category = CATEGORY_RENAMES[item.category] ?? item.category;
    let name = item.name;
    for (const [oldName, newName] of Object.entries(CATEGORY_RENAMES)) {
      name = name.replace(oldName, newName);
    }
    name = name.replace(/の(?:設計図|欠片)$/, "");

    if (category === item.category && name === item.name) return item;
    changed = true;
    return { ...item, category, name };
  });

  return { data: migrated, changed };
}
