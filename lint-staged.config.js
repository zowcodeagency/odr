// Function form returns the command verbatim — no staged-file arguments
// get appended. tsc with -p (project) rejects mixed file lists, and it
// already type-checks the whole project anyway, so per-file invocation
// would be wrong. Trigger only when at least one .ts file is staged.
export default {
  "*.ts": () => "bunx tsc --noEmit -p tsconfig.json",
};
