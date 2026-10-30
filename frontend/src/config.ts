// Environment validation
const requiredEnvVars = ['VITE_CONVEX_URL'];

const missingEnvVars = requiredEnvVars.filter(envVar => !import.meta.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}\n` +
    'Run `npx convex dev` to link this project, then copy the deployment URL into .env.'
  );
}

// Environment configuration
export const config = {
  convex: {
    url: import.meta.env.VITE_CONVEX_URL,
    siteUrl: import.meta.env.VITE_CONVEX_SITE_URL || import.meta.env.VITE_CONVEX_URL,
  },
  paystack: {
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
  },
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
