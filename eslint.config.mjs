// ESLint 9 flat config with Next.js 15, TS, and React 19
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  { ignores: ["node_modules/**", ".next/**", "dist/**"] },
  js.configs.recommended,
  // TypeScript rules (no type-checking mode to keep setup simple)
  ...tseslint.configs.recommended,
  // Next's rules via compat (core web vitals)
  ...compat.extends("next/core-web-vitals"),
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "react/react-in-jsx-scope": "off"
    }
  }
];