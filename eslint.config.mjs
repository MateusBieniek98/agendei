import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Regras desativadas para o projeto GN:
  // `react-hooks/set-state-in-effect` é nova no React 19/Next 16 e flagga
  // o padrão clássico "fetch-on-mount". Como este app é client-heavy e
  // ainda não migramos para `use(promise)`, mantemos o padrão tradicional.
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
