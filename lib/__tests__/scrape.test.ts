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
});
