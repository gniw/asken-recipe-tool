import type { Metadata } from "next";
import type { RecipeData } from "@/lib/scrape";

type Props = {
	searchParams: Promise<{ d?: string }>;
};

export async function generateMetadata({
	searchParams,
}: Props): Promise<Metadata> {
	const { d } = await searchParams;
	const recipe = decodeRecipe(d);
	return {
		title: recipe?.name ?? "レシピ",
	};
}

function decodeRecipe(encoded: string | undefined): RecipeData | null {
	if (!encoded) return null;
	try {
		return JSON.parse(
			Buffer.from(encoded, "base64url").toString("utf-8"),
		) as RecipeData;
	} catch {
		return null;
	}
}

export default async function RecipePage({ searchParams }: Props) {
	const { d } = await searchParams;
	const recipe = decodeRecipe(d);

	if (!recipe) {
		return (
			<html lang="ja">
				<body>
					<p>レシピデータが見つかりません。</p>
				</body>
			</html>
		);
	}

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "Recipe",
		name: recipe.name,
		recipeYield: recipe.recipeYield,
		recipeIngredient: recipe.recipeIngredient,
	};

	return (
		<html lang="ja">
			<head>
				<script
					type="application/ld+json"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LDの埋め込みに必要
					dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
				/>
			</head>
			<body>
				<h1>{recipe.name}</h1>
				<p>分量: {recipe.recipeYield}</p>
				<ul>
					{recipe.recipeIngredient.map((ingredient) => (
						<li key={ingredient}>{ingredient}</li>
					))}
				</ul>
			</body>
		</html>
	);
}
