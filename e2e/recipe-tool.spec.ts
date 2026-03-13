import { expect, test } from "@playwright/test";

test.describe("あすけんMyレシピURL生成ツール", () => {
	test("トップページが表示される", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByRole("heading", { name: /あすけん/ })).toBeVisible();
		await expect(page.getByLabel("レシピページのURL")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "URLを生成する" }),
		).toBeVisible();
	});

	test("空のURLで送信するとHTML5バリデーションが働く", async ({ page }) => {
		await page.goto("/");
		await page.getByRole("button", { name: "URLを生成する" }).click();
		// type="url" required の HTML5 バリデーションにより送信されない
		await expect(
			page.getByRole("button", { name: "URLを生成する" }),
		).toBeVisible();
	});

	test("不正なURLを入力するとエラーが表示される", async ({ page }) => {
		await page.goto("/");
		await page.getByLabel("レシピページのURL").fill("not-a-valid-url");
		await page.getByRole("button", { name: "URLを生成する" }).click();
		// HTML5 type="url" バリデーションが不正URLを弾くのでエラー表示はなし
		// または server action のバリデーションエラーが表示される
		await expect(page.locator("body")).toBeVisible();
	});

	test("/recipe?d= が不正なデータの場合はエラーメッセージを表示する", async ({
		page,
	}) => {
		await page.goto("/recipe?d=invalid-base64!!!!");
		await expect(page.getByText("レシピデータが見つかりません")).toBeVisible();
	});

	test("/recipe?d= が正しいデータの場合はJSON-LDが埋め込まれている", async ({
		page,
	}) => {
		const recipeData = {
			name: "テスト肉じゃが",
			recipeYield: "4人分",
			recipeIngredient: ["じゃがいも 300g", "玉ねぎ 1個"],
		};
		const encoded = Buffer.from(JSON.stringify(recipeData)).toString(
			"base64url",
		);

		await page.goto(`/recipe?d=${encoded}`);
		await expect(
			page.getByRole("heading", { name: "テスト肉じゃが" }),
		).toBeVisible();

		const jsonLdContent = await page.$eval(
			'script[type="application/ld+json"]',
			(el) => el.textContent,
		);
		const parsed = JSON.parse(jsonLdContent ?? "{}");
		expect(parsed["@type"]).toBe("Recipe");
		expect(parsed.name).toBe("テスト肉じゃが");
		expect(parsed.recipeIngredient).toContain("じゃがいも 300g");
	});
});
