function normalizeApiBase(rawBase) {
  const fallback = "http://localhost:4101";
  const base = (rawBase || fallback).replace(/\/$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}

export const API_BASE_URL = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL);
