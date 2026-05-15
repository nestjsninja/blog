import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getPostOgData } from "@/lib/post-og-data";

type Params = {
  params: Promise<{ slug: string }>;
};

export const alt = "NestJS Ninja article cover";
export const contentType = "image/png";
export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function OpenGraphImage({ params }: Params) {
  const { slug } = await params;
  const post = getPostOgData(slug);

  if (!post) {
    notFound();
  }

  const tags = post.tags?.slice(0, 3) ?? [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(circle at 12% 12%, #6d28d9 0, #24103f 34%, #0b0714 76%)",
          color: "#ffffff",
          padding: 64,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 74,
              height: 74,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              background: "linear-gradient(135deg, #ef4444, #8b5cf6)",
              boxShadow: "0 0 48px rgba(139, 92, 246, 0.45)",
              fontSize: 30,
              fontWeight: 900,
            }}
          >
            NN
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                color: "#ddd6fe",
                fontSize: 28,
                fontWeight: 800,
              }}
            >
              NestJS Ninja
            </div>
            <div style={{ color: "#a1a1aa", fontSize: 22 }}>
              Backend lessons & architecture notes
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {tags.map((tag) => (
              <div
                key={tag}
                style={{
                  border: "1px solid rgba(196, 181, 253, 0.35)",
                  borderRadius: 8,
                  color: "#ddd6fe",
                  background: "rgba(139, 92, 246, 0.16)",
                  fontSize: 22,
                  fontWeight: 700,
                  padding: "8px 14px",
                }}
              >
                {tag}
              </div>
            ))}
          </div>
          <div
            style={{
              maxWidth: 980,
              fontSize: 70,
              fontWeight: 900,
              lineHeight: 1.04,
              letterSpacing: 0,
            }}
          >
            {post.title}
          </div>
          <div
            style={{
              maxWidth: 980,
              color: "#d4d4d8",
              fontSize: 30,
              lineHeight: 1.35,
            }}
          >
            {post.excerpt}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#a1a1aa",
            fontSize: 24,
          }}
        >
          <div>{post.author}</div>
          <div>{formatDate(post.date)}</div>
        </div>
      </div>
    ),
    size,
  );
}
