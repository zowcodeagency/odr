// bun-types has no ambient declaration for `with { type: "file" }` imports of these
// extensions — dev/build-box.ts embeds the built captain-pwa app and the drizzle
// migration files this way in the generated apps/box/src/assets.gen.ts.
declare module "*.png" {
  const path: string;
  export default path;
}
declare module "*.js" {
  const path: string;
  export default path;
}
declare module "*.css" {
  const path: string;
  export default path;
}
declare module "*.svg" {
  const path: string;
  export default path;
}
declare module "*.webmanifest" {
  const path: string;
  export default path;
}
declare module "*.sql" {
  const path: string;
  export default path;
}
declare module "*_headers" {
  const path: string;
  export default path;
}
