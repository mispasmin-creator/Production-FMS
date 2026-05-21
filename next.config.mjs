/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ["jspdf", "jspdf-autotable"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      fflate: "fflate/browser",
    };
    return config;
  },
};

export default nextConfig;
