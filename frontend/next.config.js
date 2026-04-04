const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "..", ".env"),
});

dotenv.config({
  path: path.resolve(__dirname, ".env.local"),
  override: true,
});

const backendPort = process.env.BACKEND_PORT || "4101";
const nextPublicApiUrl = process.env.NEXT_PUBLIC_API_URL || `http://localhost:${backendPort}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_API_URL: nextPublicApiUrl,
  },
};

module.exports = nextConfig;
