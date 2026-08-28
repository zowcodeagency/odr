// Shared entry for the three front-end Workers. Static assets serve everything
// except the paths in run_worker_first (see each app's wrangler.toml); those
// land here and are forwarded to the odr-api Worker over a service binding —
// same-origin in the browser, so no CORS and the JWT never crosses an origin.
export default {
  fetch: (req: Request, env: { API: { fetch: (r: Request) => Promise<Response> } }) => env.API.fetch(req),
};
