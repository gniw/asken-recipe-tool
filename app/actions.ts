"use server";

import { scrapeRecipe } from "@/lib/scrape";

export type ActionState =
	| { status: "idle" }
	| { status: "error"; message: string }
	| { status: "success"; encodedData: string };

export async function scrapeAction(
	_prev: ActionState,
	formData: FormData,
): Promise<ActionState> {
	const url = formData.get("url");
	if (typeof url !== "string" || !url.trim()) {
		return { status: "error", message: "URLを入力してください" };
	}

	try {
		new URL(url);
	} catch {
		return { status: "error", message: "正しいURLを入力してください" };
	}

	const result = await scrapeRecipe(url.trim());

	if (!result.ok) {
		return { status: "error", message: result.error };
	}

	const encodedData = Buffer.from(JSON.stringify(result.data)).toString(
		"base64url",
	);
	return { status: "success", encodedData };
}
