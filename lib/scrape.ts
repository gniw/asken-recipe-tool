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
		html = await res.text();
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
			const json = JSON.parse(tag.text);
			const recipe = findRecipeSchema(json);
			if (recipe) {
				return { ok: true, data: normalizeRecipe(recipe) };
			}
		} catch {
			// JSON parse エラーはスキップ
		}
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

function normalizeRecipe(raw: Record<string, unknown>): RecipeData {
	const name = String(raw.name ?? "レシピ名不明");

	const recipeYield = Array.isArray(raw.recipeYield)
		? raw.recipeYield.join(", ")
		: String(raw.recipeYield ?? "1人分");

	const recipeIngredient = Array.isArray(raw.recipeIngredient)
		? raw.recipeIngredient.map(String)
		: [];

	return { name, recipeYield, recipeIngredient };
}
