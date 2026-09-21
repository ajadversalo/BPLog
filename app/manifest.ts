import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BP log",
    short_name: "BP log",
    description: "A simple, private blood pressure logger.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f2",
    theme_color: "#f4f6f2",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
