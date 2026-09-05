// bun-types has no ambient declaration for `with { type: "file" }` imports of
// arbitrary extensions (only *.txt/*.toml/*.yaml/*.json5/*.html) — these two
// cover the PGlite wasm/data assets embedded in packages/db/src/pglite.ts.
declare module "*.wasm" {
  const path: string;
  export default path;
}

declare module "*.data" {
  const path: string;
  export default path;
}
