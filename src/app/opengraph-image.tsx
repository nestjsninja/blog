import { ImageResponse } from "next/og";

export const alt = "NestJS Ninja";
export const contentType = "image/png";
export const runtime = "edge";
export const size = { width: 1200, height: 630 };

/**
 * The site-wide social card.
 *
 * Replaces a hotlinked Unsplash photo, which was unbranded, could change or disappear without
 * warning, and made every share of the site root look like a stock-photo blog. Rendering it
 * here costs nothing, cannot 404, and is always exactly 1200x630.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 12% 12%, #6d28d9 0, #24103f 34%, #0b0714 76%)",
          color: "#ffffff",
          padding: 80,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <div
            style={{
              width: 96,
              height: 96,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 24,
              background: "linear-gradient(135deg, #ef4444, #8b5cf6)",
              boxShadow: "0 0 60px rgba(139, 92, 246, 0.45)",
              fontSize: 40,
              fontWeight: 900,
            }}
          >
            NN
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.1 }}>
              NestJS Ninja
            </div>
            <div style={{ color: "#ddd6fe", fontSize: 30, fontWeight: 700 }}>
              Backend lessons &amp; architecture notes
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 44,
            maxWidth: 980,
            color: "#d4d4d8",
            fontSize: 32,
            lineHeight: 1.35,
          }}
        >
          Practical NestJS: architecture, TypeORM, testing, authorization and AI
          integration, written from projects that actually shipped.
        </div>
      </div>
    ),
    size,
  );
}
