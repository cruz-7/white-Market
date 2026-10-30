/**
 * Convex Auth application configuration.
 *
 * Convex Auth acts as its own OpenID Connect provider, so the deployment is
 * registered against itself with `applicationID: "convex"`. `CONVEX_SITE_URL`
 * is set automatically by the Convex CLI for the deployment this project is
 * linked to (dev: `*.convex.dev`, prod: the custom domain).
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
