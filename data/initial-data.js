import { CATEGORY_ORDER, compareItems, compareStages, deriveItemName, deriveStageName } from "../src/core/catalog.js";

const SOURCE_UPDATED_AT = "2026-08-01T06:56:23+09:00";
const CREATED_AT = "2026-08-04T00:00:00.000Z";

export const ITEM_CATEGORIES = Object.freeze({
  1: CATEGORY_ORDER[0],
  2: CATEGORY_ORDER[2],
  3: CATEGORY_ORDER[3],
  4: CATEGORY_ORDER[4],
  5: CATEGORY_ORDER[1],
  6: CATEGORY_ORDER[5],
  7: CATEGORY_ORDER[6],
});

const STAGE_DROP_TSV = `30-10\t83,94
30-9\t84,92
30-8\t87,91
30-7\t85,97
30-6\t83,95
30-5\t86,96
30-4\t84,93
30-3\t82,94
30-2\t81,92
30-1\t87,97
29-10\t85,96
29-9\t83,95
29-8\t86,93
29-7\t84,93
29-6\t82,94
29-5\t81,92
29-4\t87,91
29-3\t85,97
29-2\t86,95
29-1\t85,96
28-10\t86,87
28-9\t83,85
28-8\t84,83
28-7\t82,83
28-6\t81,84
28-5\t87,82
28-4\t86,81
28-3\t86,87
28-2\t81,85
28-1\t84,86
27-10\t82,86
27-9\t81,84
27-8\t87,82
27-7\t85,81
27-6\t86,87
27-5\t82,85
27-4\t81,86
27-3\t87,83
27-2\t85,81
27-1\t83,84
26-10\t72,82
26-9\t76,81
26-8\t73,87
26-7\t76,85
26-6\t77,86
26-5\t75,83
26-4\t73,84
26-3\t76,82
26-2\t74,81
26-1\t72,87
25-10\t71,85
25-9\t77,83
25-8\t75,86
25-7\t74,84
25-6\t73,82
25-5\t74,81
25-4\t72,87
25-3\t71,85
25-2\t77,83
25-1\t75,83
24-10\t74,76
24-9\t72,77
24-8\t71,75
24-7\t77,73
24-6\t75,73
24-5\t76,74
24-4\t73,72
24-3\t74,71
24-2\t72,77
24-1\t71,75
23-10\t77,76
23-9\t75,76
23-8\t76,74
23-7\t71,72
23-6\t74,71
23-5\t72,77
23-4\t71,75
23-3\t77,76
23-2\t75,73
23-1\t76,71
22-10\t62,74
22-9\t63,72
22-8\t67,71
22-7\t65,77
22-6\t66,75
22-5\t63,76
22-4\t64,73
22-3\t62,74
22-2\t61,72
22-1\t67,71
21-10\t65,77
21-9\t66,75
21-8\t63,73
21-7\t64,76
21-6\t62,74
21-5\t61,72
21-4\t67,71
21-3\t65,77
21-2\t63,75
21-1\t66,75
20-10\t64,66
20-9\t62,63
20-8\t61,67
20-7\t67,65
20-6\t65,66
20-5\t66,63
20-4\t63,64
20-3\t64,62
20-2\t62,61
20-1\t61,67
19-10\t67,65
19-9\t65,64
19-8\t66,63
19-7\t63,64
19-6\t64,62
19-5\t62,61
19-4\t61,67
19-3\t61,65
19-2\t65,63
19-1\t66,61
18-10\t56,64
18-9\t54,62
18-8\t57,61
18-7\t55,67
18-6\t56,65
18-5\t53,63
18-4\t54,66
18-3\t52,64
18-2\t51,62
18-1\t57,61
17-10\t55,67
17-9\t56,65
17-8\t53,66
17-7\t54,63
17-6\t52,64
17-5\t51,62
17-4\t57,61
17-3\t55,67
17-2\t53,65
17-1\t56,66
16-10\t54,52
16-9\t52,53
16-8\t51,57
16-7\t57,55
16-6\t55,56
16-5\t56,53
16-4\t53,54
16-3\t54,52
16-2\t52,51
16-1\t51,57
15-10\t57,55
15-9\t55,53
15-8\t53,56
15-7\t56,54
15-6\t54,52
15-5\t52,51
15-4\t51,57
15-3\t57,55
15-2\t55,53
15-1\t53,56
14-10\t43,54
14-9\t47,52
14-8\t47,51
14-7\t45,57
14-6\t43,55
14-5\t46,56
14-4\t44,53
14-3\t42,54
14-2\t41,52
14-1\t47,51
13-10\t45,57
13-9\t45,55
13-8\t43,56
13-7\t44,53
13-6\t42,54
13-5\t41,52
13-4\t47,51
13-3\t45,57
13-2\t43,55
13-1\t44,56
12-10\t44,42
12-9\t42,41
12-8\t41,46
12-7\t46,45
12-6\t45,47
12-5\t44,43
12-4\t43,44
12-3\t44,42
12-2\t42,41
12-1\t41,46
11-10\t46,47
11-9\t43,45
11-8\t46,42
11-7\t43,44
11-6\t44,42
11-5\t42,41
11-4\t41,47
11-3\t46,41
11-2\t45,46
11-1\t47,45
10-10\t33,43
10-9\t33,44
10-8\t37,42
10-7\t35,41
10-6\t33,47
10-5\t33,46
10-4\t34,45
10-3\t32,43
10-2\t31,44
10-1\t37,42
9-10\t35,41
9-9\t35,47
9-8\t33,46
9-7\t34,45
9-6\t32,43
9-5\t31,44
9-4\t37,42
9-3\t35,41
9-2\t33,47
9-1\t31,46
8-10\t34
8-9\t32
8-8\t31
8-7\t36,37
8-6\t35,36
8-5\t33,35
8-4\t36,33
8-3\t34
8-2\t32
8-1\t31
7-10\t36,37
7-9\t35,36
7-8\t37,35
7-7\t33,36
7-6\t34
7-5\t32
7-4\t31
7-3\t36,37
7-2\t35,36
7-1\t37,35
6-10\t24,33
6-9\t22,34
6-8\t21,32
6-7\t27,31
6-6\t26,37
6-5\t25,36
6-4\t23,35
6-3\t24,33
6-2\t22,34
6-1\t21,32
5-10\t27,31
5-9\t26,37
5-8\t25,36
5-7\t23,35
5-6\t24,33
5-5\t22,34
5-4\t21,32
5-3\t27,31
5-2\t26,37
5-1\t25,36
4-10\t23,22
4-9\t24,23
4-8\t22,21
4-7\t21,27
4-6\t27,26
4-5\t26,25
4-4\t25,23
4-3\t23,24
4-2\t24,21
4-1\t22,27
3-10\t21,26
3-9\t27,25
3-8\t26,23
3-7\t25,22
3-6\t23,21
3-5\t24,27
3-4\t22,26
3-3\t21,25
3-2\t27,23
3-1\t26,24`;

function makeItem(code) {
  const rank = Math.floor(Number(code) / 10);
  const categoryCode = Number(code) % 10;
  const category = ITEM_CATEGORIES[categoryCode];

  return {
    id: `item-${code}`,
    code: String(code),
    name: deriveItemName({ rank, category }),
    rank,
    category,
    icon: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

function parseInitialData() {
  const itemCodes = new Set();
  const stages = STAGE_DROP_TSV.split("\n").map((line) => {
    const [name, codeList] = line.split("\t");
    const codes = codeList.split(",");
    codes.forEach((code) => itemCodes.add(code));
    const [chapter, number] = name.split("-").map(Number);

    const stage = {
      id: `stage-${name}`,
      chapter,
      number,
      drops: codes.map((code) => ({ itemId: `item-${code}`, quantity: 1 })),
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    };
    return { ...stage, name: deriveStageName(stage) };
  });

  const items = [...itemCodes]
    .map(makeItem)
    .sort(compareItems);

  stages.sort(compareStages);

  return {
    schemaVersion: 1,
    source: {
      name: "トリッカル・もちもちほっペ大作戦 Wiki 装備設計図",
      url: "https://wikiwiki.jp/thetrickal/%E8%A3%85%E5%82%99%E8%A8%AD%E8%A8%88%E5%9B%B3",
      updatedAt: SOURCE_UPDATED_AT,
    },
    items,
    stages,
  };
}

export const INITIAL_DATA = parseInitialData();

export function createInitialData() {
  return structuredClone(INITIAL_DATA);
}
