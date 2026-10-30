import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function validateDeploymentEnvironment(
  env: Record<string, string>,
  target: "preview" | "production"
) {
  const errors: string[] = [];
  const deployment = env.CONVEX_DEPLOYMENT ?? "";
  const deploymentPrefix = target === "preview" ? "dev:" : "prod:";
  const deploymentName = deployment.startsWith(deploymentPrefix)
    ? deployment.slice(deploymentPrefix.length)
    : "";

  if (!deploymentName || !/^[a-z0-9-]+$/i.test(deploymentName)) {
    errors.push(`CONVEX_DEPLOYMENT must be ${deploymentPrefix}<deployment-name>`);
  }

  const expectedUrls = [
    ["VITE_CONVEX_URL", ".convex.cloud"],
    ["VITE_CONVEX_SITE_URL", ".convex.site"],
  ] as const;

  for (const [name, suffix] of expectedUrls) {
    const value = env[name];
    if (!value) {
      errors.push(`${name} is required`);
      continue;
    }

    try {
      const url = new URL(value);
      if (
        url.protocol !== "https:" ||
        url.hostname !== `${deploymentName}${suffix}` ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      ) {
        errors.push(`${name} must be the HTTPS ${deploymentName}${suffix} deployment URL`);
      }
    } catch {
      errors.push(`${name} must be a valid HTTPS URL`);
    }
  }

  const publicKey = env.VITE_PAYSTACK_PUBLIC_KEY ?? "";
  const expectedKeyPrefix = target === "preview" ? "pk_test_" : "pk_live_";
  if (
    !publicKey.startsWith(expectedKeyPrefix) ||
    /xxxxx|replace|placeholder|your[-_]/i.test(publicKey)
  ) {
    errors.push(`VITE_PAYSTACK_PUBLIC_KEY must be a real Paystack ${target} public key`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Production build configuration is incomplete:\n- ${errors.join("\n- ")}`
    );
  }
}

export default defineConfig(({ command, mode }) => {
  if (command === "build" && mode === "production") {
    const env = loadEnv(mode, process.cwd(), "");
    validateDeploymentEnvironment(env, env.VERCEL_ENV === "preview" ? "preview" : "production");
  }

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-ui": ["lucide-react", "recharts", "sonner"],
          },
        },
      },
      sourcemap: false,
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
    },
    server: {
      port: 5173,
      host: true,
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom"],
    },
  };
});
