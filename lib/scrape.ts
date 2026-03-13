import { parse } from "node-html-parser";

export type RecipeData = {
	name: string;
	recipeYield: string;
	recipeIngredient: string[];
};

export type ScrapeResult =
	| { ok: true; data: RecipeData }
	| { ok: false; error: string };

export async function scrapeRecipe(url: string): Promise<ScrapeResult> {
	let html: string;
	try {
		const res = await fetch(url, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (compatible; AskenRecipeTool/1.0; +https://github.com/gniw)",
			},
			signal: AbortSignal.timeout(10_000),
		});
		if (!res.ok) {
			return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
		}
		const buffer = await res.arrayBuffer();

		// Content-Type ヘッダーまたは meta タグからエンコーディングを検出する
		let charset = "utf-8";
		const ctCharset = (res.headers.get("content-type") ?? "").match(
			/charset=([\w-]+)/i,
		)?.[1];
		if (ctCharset) {
			charset = ctCharset;
		} else {
			// latin1 で先頭2KBを読んでmetaタグのcharsetを探す
			const preview = new TextDecoder("latin1").decode(
				new Uint8Array(buffer).slice(0, 2048),
			);
			const metaCharset =
				preview.match(/charset=["']?([\w-]+)/i)?.[1];
			if (metaCharset) charset = metaCharset;
		}

		try {
			html = new TextDecoder(charset).decode(buffer);
		} catch {
			html = new TextDecoder("utf-8").decode(buffer);
		}
	} catch (e) {
		return {
			ok: false,
			error: e instanceof Error ? e.message : "フェッチに失敗しました",
		};
	}

	const root = parse(html);

	// JSON-LD から Recipe スキーマを探す
	const scriptTags = root.querySelectorAll(
		'script[type="application/ld+json"]',
	);
	for (const tag of scriptTags) {
		try {
			const json = JSON.parse(tag.innerHTML);
			const recipe = findRecipeSchema(json);
			if (recipe) {
				return { ok: true, data: normalizeRecipe(recipe) };
			}
		} catch {
			// JSON parse エラーはスキップ
		}
	}

	// サイト固有のスクレイパーにフォールバック
	if (url.includes("yoshikei")) {
		const data = scrapeYoshikei(root);
		if (data) return { ok: true, data };
	}

	// meta タグからタイトルだけ取れる場合はエラーに含める
	const title = root.querySelector("title")?.text?.trim() ?? "タイトル不明";
	return {
		ok: false,
		error: `このページにはレシピ情報（JSON-LD）が見つかりませんでした。\nページタイトル: ${title}`,
	};
}

// @graph 配列や入れ子オブジェクトから Recipe を再帰的に探す
function findRecipeSchema(json: unknown): Record<string, unknown> | null {
	if (!json || typeof json !== "object") return null;

	if (Array.isArray(json)) {
		for (const item of json) {
			const found = findRecipeSchema(item);
			if (found) return found;
		}
		return null;
	}

	const obj = json as Record<string, unknown>;

	if (obj["@type"] === "Recipe") return obj;

	// @graph 配列
	if (Array.isArray(obj["@graph"])) {
		for (const item of obj["@graph"]) {
			const found = findRecipeSchema(item);
			if (found) return found;
		}
	}

	return null;
}

// ヨシケイ専用スクレイパー
// 食材テーブルは「材料名 | 2人用 | 3人用 | 4人用」形式。2人用を使用する。
function scrapeYoshikei(root: ReturnType<typeof parse>): RecipeData | null {
	// 「材料」見出し（h3）を探す
	const allH3 = root.querySelectorAll("h3");
	const materialH3 = allH3.find((h) => h.text.trim() === "材料");
	if (!materialH3) return null;

	const materialSection = materialH3.parentNode;
	if (!materialSection) return null;

	// h4 から料理名を取得（主菜・副菜それぞれ）
	const dishNames = materialSection
		.querySelectorAll("h4")
		.map((h) => h.text.trim())
		.filter(Boolean);

	const h1 = root.querySelector("h1");
	const name =
		dishNames.length > 0
			? dishNames.join("・")
			: (h1?.text.replace(/\s+/g, " ").trim() ?? "レシピ名不明");

	// テーブルから食材（2人用カラム）を抽出
	const ingredients: string[] = [];
	for (const table of materialSection.querySelectorAll("table")) {
		for (const row of table.querySelectorAll("tbody tr")) {
			const cells = row.querySelectorAll("td");
			if (cells.length < 2) continue;

			// 先頭の A・B グループラベル（半角英大文字1字 + スペース）を除去
			const materialName = cells[0].text
				.trim()
				.replace(/^[A-Z]\s+/, "");
			const quantity = cells[1].text.trim(); // 2人用

			if (materialName && quantity) {
				ingredients.push(`${materialName} ${quantity}`);
			}
		}
	}

	if (ingredients.length === 0) return null;

	return {
		name,
		recipeYield: "2人分",
		recipeIngredient: ingredients.map(stripLeadingSymbols),
	};
}

// 先頭の全角記号（★◎●■など）と直後の空白を除去する
function stripLeadingSymbols(s: string): string {
	return s.replace(/^[^\p{L}\p{N}\s]+\s*/u, "").trim();
}

function normalizeRecipe(raw: Record<string, unknown>): RecipeData {
	const name = String(raw.name ?? "レシピ名不明");

	const recipeYield = Array.isArray(raw.recipeYield)
		? raw.recipeYield.join(", ")
		: String(raw.recipeYield ?? "1人分");

	const recipeIngredient = Array.isArray(raw.recipeIngredient)
		? raw.recipeIngredient.map((s) => stripLeadingSymbols(String(s)))
		: [];

	return { name, recipeYield, recipeIngredient };
}
