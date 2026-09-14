import type { MetadataRoute } from "next";
import { PRODUCT_BRAND } from "@/lib/product-brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_BRAND.name,
    short_name: PRODUCT_BRAND.shortName,
    description: PRODUCT_BRAND.description,
    start_url: "/",
    display: "standalone",
    background_color: PRODUCT_BRAND.colors.mist,
    theme_color: PRODUCT_BRAND.colors.pine,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
