import { describe, expect, it, vi } from "vitest";
import { scrapeRecipe } from "../scrape";

const mockHtmlWithJsonLd = (recipeJson: object) => `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    ${JSON.stringify(recipeJson)}
  </script>
</head>
<body><h1>テストレシピ</h1></body>
</html>
`;

describe("scrapeRecipe", () => {
	it("JSON-LDからレシピ情報を正しく抽出できる", async () => {
		const recipe = {
			"@context": "https://schema.org",
			"@type": "Recipe",
			name: "肉じゃが",
			recipeYield: "4人分",
			recipeIngredient: ["じゃがいも 300g", "玉ねぎ 1個", "牛肉 200g"],
		};

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				text: () => Promise.resolve(mockHtmlWithJsonLd(recipe)),
			}),
		);

		const result = await scrapeRecipe("https://example.com/recipe/nikujaga");

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.name).toBe("肉じゃが");
		expect(result.data.recipeYield).toBe("4人分");
		expect(result.data.recipeIngredient).toEqual([
			"じゃがいも 300g",
			"玉ねぎ 1個",
			"牛肉 200g",
		]);

		vi.unstubAllGlobals();
	});

	it("@graph 内の Recipe スキーマも抽出できる", async () => {
		const jsonLd = {
			"@context": "https://schema.org",
			"@graph": [
				{ "@type": "WebPage", name: "ページ" },
				{
					"@type": "Recipe",
					name: "カレーライス",
					recipeYield: "2人分",
					recipeIngredient: ["カレールー 1箱", "玉ねぎ 2個"],
				},
			],
		};

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				text: () => Promise.resolve(mockHtmlWithJsonLd(jsonLd)),
			}),
		);

		const result = await scrapeRecipe("https://example.com/recipe/curry");

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.name).toBe("カレーライス");

		vi.unstubAllGlobals();
	});

	it("JSON-LDがない場合はエラーを返す", async () => {
		const html = `
      <html><head><title>普通のページ</title></head><body>レシピなし</body></html>
    `;

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				text: () => Promise.resolve(html),
			}),
		);

		const result = await scrapeRecipe("https://example.com/not-recipe");

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain(
			"レシピ情報（JSON-LD）が見つかりませんでした",
		);

		vi.unstubAllGlobals();
	});

	it("HTTPエラーの場合はエラーを返す", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				statusText: "Not Found",
			}),
		);

		const result = await scrapeRecipe("https://example.com/not-found");

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("404");

		vi.unstubAllGlobals();
	});

	it("ネットワークエラーの場合はエラーを返す", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new Error("fetch failed")),
		);

		const result = await scrapeRecipe("https://example.com/timeout");

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toBe("fetch failed");

		vi.unstubAllGlobals();
	});

	it("recipeIngredient が配列でない場合は空配列になる", async () => {
		const recipe = {
			"@type": "Recipe",
			name: "シンプルレシピ",
			recipeYield: "1人分",
			// recipeIngredient なし
		};

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				text: () => Promise.resolve(mockHtmlWithJsonLd(recipe)),
			}),
		);

		const result = await scrapeRecipe("https://example.com/simple");

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.recipeIngredient).toEqual([]);

		vi.unstubAllGlobals();
	});

	it("先頭の全角記号（★◎●■など）を除去する", async () => {
		const recipe = {
			"@type": "Recipe",
			name: "テストレシピ",
			recipeYield: "2人分",
			recipeIngredient: [
				"◎しょうゆ 大さじ1",
				"★砂糖 小さじ1",
				"●みりん 大さじ2",
				"■ごま油 少々",
				"ニラ 1束", // 記号なし → そのまま
				"◎◎二重記号 適量", // 複数記号 → すべて除去
			],
		};

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				text: () => Promise.resolve(mockHtmlWithJsonLd(recipe)),
			}),
		);

		const result = await scrapeRecipe("https://example.com/symbols");

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.recipeIngredient).toEqual([
			"しょうゆ 大さじ1",
			"砂糖 小さじ1",
			"みりん 大さじ2",
			"ごま油 少々",
			"ニラ 1束",
			"二重記号 適量",
		]);

		vi.unstubAllGlobals();
	});

	it("ヨシケイのHTML構造からレシピを抽出できる", async () => {
		const html = `
<!DOCTYPE html>
<html>
<head><title>商品詳細 | ヨシケイ</title></head>
<body>
  <h1><span>主菜</span>鶏すき煮 <span>副菜</span>にら玉焼き</h1>
  <section>
    <h3>材料</h3>
    <div>
      <h4>鶏すき煮</h4>
      <table>
        <thead>
          <tr><th>材料</th><th>2人用</th><th>3人用</th><th>4人用</th></tr>
        </thead>
        <tbody>
          <tr><td>若鶏モモ肉</td><td>200g</td><td>300g</td><td>400g</td></tr>
          <tr><td>豆腐</td><td>1パック</td><td>1と1/2パック</td><td>2パック</td></tr>
          <tr><td><span>A</span> だし汁</td><td>120ml</td><td>180ml</td><td>240ml</td></tr>
          <tr><td><span>A</span> しょうゆ</td><td>大2</td><td>大3</td><td>大4</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <h4>にら玉焼き</h4>
      <table>
        <thead>
          <tr><th>材料</th><th>2人用</th><th>3人用</th><th>4人用</th></tr>
        </thead>
        <tbody>
          <tr><td>卵</td><td>2コ</td><td>3コ</td><td>4コ</td></tr>
          <tr><td><span>B</span> 酒</td><td>大1/2</td><td>大2/3</td><td>大1</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</body>
</html>
`;

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				text: () => Promise.resolve(html),
			}),
		);

		const result = await scrapeRecipe(
			"https://www2.yoshikei-dvlp.co.jp/webodr/apl/10/recipe.aspx",
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.name).toBe("鶏すき煮・にら玉焼き");
		expect(result.data.recipeYield).toBe("2人分");
		expect(result.data.recipeIngredient).toEqual([
			"若鶏モモ肉 200g",
			"豆腐 1パック",
			"だし汁 120ml",
			"しょうゆ 大2",
			"卵 2コ",
			"酒 大1/2",
		]);

		vi.unstubAllGlobals();
	});
});
