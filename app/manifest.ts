import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CareBase | Hospital workspace",
    short_name: "CareBase",
    description: "The connected operating system for hospital care teams.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8fb",
    theme_color: "#0e7490",
    icons: [
      {
        src: "/carebase-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/carebase-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}