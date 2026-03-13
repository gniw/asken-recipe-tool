"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "./actions";
import { scrapeAction } from "./actions";

const initialState: ActionState = { status: "idle" };

export default function Home() {
	const [state, formAction, isPending] = useActionState(
		scrapeAction,
		initialState,
	);
	const recipeUrlRef = useRef<HTMLInputElement>(null);

	const recipePageUrl =
		state.status === "success"
			? `${typeof window !== "undefined" ? window.location.origin : ""}/recipe?d=${state.encodedData}`
			: null;

	useEffect(() => {
		if (recipePageUrl && recipeUrlRef.current) {
			recipeUrlRef.current.select();
		}
	}, [recipePageUrl]);

	const jsonLd =
		state.status === "success"
			? JSON.stringify(
					{
						"@context": "https://schema.org",
						"@type": "Recipe",
						name: state.recipeData.name,
						recipeYield: state.recipeData.recipeYield,
						recipeIngredient: state.recipeData.recipeIngredient,
					},
					null,
					2,
				)
			: null;

	return (
		<main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
			<div className="w-full max-w-lg">
				<div className="bg-white rounded-2xl shadow-lg p-8">
					<h1 className="text-2xl font-bold text-green-700 mb-2">
						あすけん MyレシピURL生成ツール
					</h1>
					<p className="text-sm text-gray-500 mb-6">
						レシピページのURLを入力すると、あすけんの「Webから登録」に貼り付けられるURLを生成します。
					</p>

					<form action={formAction} className="space-y-4">
						<div>
							<label
								htmlFor="url"
								className="block text-sm font-medium text-gray-700 mb-1"
							>
								レシピページのURL
							</label>
							<input
								id="url"
								name="url"
								type="url"
								required
								placeholder="https://example.com/recipe/..."
								className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-sm"
							/>
						</div>

						<button
							type="submit"
							disabled={isPending}
							className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
						>
							{isPending ? "取得中..." : "URLを生成する"}
						</button>
					</form>

					{state.status === "error" && (
						<div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 whitespace-pre-wrap">
							{state.message}
						</div>
					)}

					{recipePageUrl && jsonLd && (
						<div className="mt-6 space-y-3">
							<p className="text-sm font-medium text-gray-700">
								生成されたURL（あすけんに貼り付けてください）
							</p>
							<input
								ref={recipeUrlRef}
								readOnly
								value={recipePageUrl}
								className="w-full px-3 py-2 border border-green-300 rounded-lg bg-green-50 text-xs text-gray-700 focus:outline-none"
								onClick={(e) => (e.target as HTMLInputElement).select()}
							/>
							<button
								type="button"
								onClick={() => navigator.clipboard.writeText(recipePageUrl)}
								className="w-full bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
							>
								コピーする
							</button>

							<details className="group mt-2">
								<summary className="cursor-pointer select-none text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 list-none">
									<span className="transition-transform group-open:rotate-90">▶</span>
									JSON-LDの内容を確認する
								</summary>
								<pre className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap break-all">
									{jsonLd}
								</pre>
							</details>
						</div>
					)}
				</div>
			</div>
		</main>
	);
}
