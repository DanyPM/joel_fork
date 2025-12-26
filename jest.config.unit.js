/** @type {import("jest").Config} **/
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],

  /* re‑compile plain .js so CommonJS still works in the VM */
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true }],
    "^.+\\.jsx?$": "babel-jest"
  },

  /* Jest's resolver adds ".js" to relative imports—strip it back off */
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },

  /* Re‑transform the ESM‑only dependency that started all this */
  transformIgnorePatterns: [
    "/node_modules/(?!(whatsapp-api-js|p-limit|yocto-queue)/)"
  ],

  /* Test files to include - only unit tests, not integration tests */
  testMatch: [
    "**/tests/**/*.test.ts",
    "!**/tests/People.test.ts",
    "!**/tests/User.test.ts"
  ],

  collectCoverage: true,
  collectCoverageFrom: [
    "**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/tests/**",
    "!**/apps/**",
    "!**/commands/**"
  ],
  coverageProvider: "v8",
  coverageDirectory: "coverage",
  coverageReporters: ["json-summary", "text", "lcov"]
};
