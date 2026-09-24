import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicitly enable Turbopack (default in Next.js 16)
  turbopack: {},

  // Prevent onnxruntime-web from being bundled server-side
  // (it's browser-only; WASM is loaded from CDN at runtime)
  serverExternalPackages: ['onnxruntime-web'],

  // webpack config kept as fallback for non-Turbopack builds
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    if (isServer) {
      config.externals = [...(config.externals || []), 'onnxruntime-web'];
    }
    return config;
  },
};

export default nextConfig;
