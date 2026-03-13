import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
		exclude: ["**/node_modules/**", "**/e2e/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "lcov"],
			exclude: ["*.config.*", "**/*.d.ts", "app/layout.tsx", "app/page.tsx"],
		},
	},
	resolve: {
		alias: {
			"@": "/Users/tsubasa.yamamoto/ghq/github.com/gniw/asken-recipe-tool",
		},
	},
});
