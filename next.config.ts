import type { NextConfig } from "next";
import path from "node:path";

const root = path.resolve(".");

// Works on both Vercel and Cloudflare Pages.
// On Cloudflare, CF_PAGES_BRANCH is set to the deployed branch name.
const isProduction =
  process.env.VERCEL_ENV === "production" ||
  process.env.CF_PAGES_BRANCH === "main";

// Old slugs (from the previous blog URL structure) → current slugs.
// These were indexed by Google and must 301 to the canonical URLs.
const LEGACY_REDIRECTS: Array<{ source: string; destination: string }> = [
  {
    source: "/blog/2025-02-23-nestjs-lambda-localstack-serverless/",
    destination:
      "/blog/2025-02-24-running-nestjs-in-a-lambda-function-with-localstack-and-serverless-framework/",
  },
  {
    source: "/blog/2025-02-18-nestjs-kubernetes-jobs-nest-commander/",
    destination:
      "/blog/2025-02-18-implementing-kubernetes-jobs-with-nestjs-and-nest-commander-a-practical-guide-ex-implement/",
  },
  {
    source: "/blog/2025-02-08-nestjs-vienna-meetup-multi-tenancy-modules/",
    destination: "/blog/",
  },
  {
    source: "/blog/2025-02-01-real-time-chat-with-nestjs-socket-io/",
    destination: "/blog/2025-01-24-real-time-chat-with-nestjs-and-socket-io/",
  },
  {
    source: "/blog/2025-01-23-nestjs-multiple-payment-gateways-stripe/",
    destination: "/blog/2025-01-22-nestjs-payment-gateway-integration/",
  },
  {
    source:
      "/blog/2024-03-15-nestjs-clean-architecture-abstractions-databases/",
    destination:
      "/blog/2024-03-15-mastering-nestjs-building-scalable-systems-with-abstractions-ex-different-databases/",
  },
  {
    source: "/blog/2024-03-09-nestjs-clean-architecture-ddd-ecommerce-part-1/",
    destination:
      "/blog/2023-11-17-mastering-nestjs-unleashing-the-power-of-clean-architecture-and-ddd-in-e-commerce-developm/",
  },
  {
    source:
      "/blog/2024-03-08-language-learning-with-nestjs-nextjs-vercel-neon/",
    destination:
      "/blog/2024-03-08-empowering-language-learning-with-nestjs-nextjs-vercel-and-neon-tech-a-tech-infused-journe/",
  },
  {
    source: "/blog/2023-11-17-nestjs-sentry-error-tracking/",
    destination:
      "/blog/2023-11-17-mastering-error-tracking-a-beginner-s-guide-to-sentry-in-your-nestjs-project/",
  },
  {
    source: "/blog/2023-11-08-faster-tests-with-ai-nestjs/",
    destination:
      "/blog/2023-11-08-supercharge-your-testing-workflow-creating-unit-and-e2e-tests-10x-faster-with-chatgpt-3-in/",
  },
  {
    source: "/blog/2023-11-06-nestjs-openai-smart-questions/",
    destination:
      "/blog/2023-11-06-questions-generator-with-nestjs-and-openai/",
  },
  {
    source: "/blog/2023-10-24-migrating-nestjs-typeorm-to-prisma/",
    destination:
      "/blog/2023-10-16-migrating-nestjs-project-with-typeorm-to-prisma/",
  },
  {
    source: "/blog/2023-10-21-nodejs-without-frameworks-2023/",
    destination:
      "/blog/2023-10-16-creating-a-nodejs-project-without-frameworks-in-2023/",
  },
  {
    source: "/blog/2023-10-18-nestjs-unit-tests-jest-github-actions/",
    destination:
      "/blog/2023-10-16-applying-unit-tests-on-nestjs-with-jest-and-github-actions/",
  },
  {
    source: "/blog/2023-10-16-nestjs-e2e-tests-jest-github-actions/",
    destination:
      "/blog/2023-10-16-applying-integration-test-on-nestjs-with-jest-and-github-actions/",
  },
  {
    source: "/blog/2023-10-10-nestjs-config-module-zod/",
    destination:
      "/blog/2023-10-05-creating-a-configuration-module-like-a-specialist-with-zod-inside-nestjs/",
  },
  {
    source: "/blog/2023-10-09-nestjs-auth-flow-typeorm-neon/",
    destination:
      "/blog/2023-10-07-authentication-part-3-using-nestjs-and-postgres-database-neon-tech/",
  },
  {
    source: "/blog/2023-10-07-nestjs-auth-flow-part-2/",
    destination: "/blog/2023-10-06-authentication-part-2-using-nestjs/",
  },
  // without trailing slash variants (belt-and-suspenders — trailingSlash handles these,
  // but explicit entries catch any edge cases in reverse-proxy caches)
];

const nextConfig: NextConfig = {
  trailingSlash: true,
  turbopack: {
    root,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async redirects() {
    return LEGACY_REDIRECTS.map((r) => ({ ...r, permanent: true }));
  },
  async headers() {
    return [
      // Prevent Vercel preview deployments from being indexed.
      // Each preview URL gets canonical tags pointing to production, so without
      // this Google accumulates "alternate page with proper canonical tag" entries.
      ...(!isProduction
        ? [
            {
              source: "/(.*)",
              headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
            },
          ]
        : []),
      // OG image and Twitter image routes serve PNG files, not HTML.
      // Prevent Google from trying to index them as content pages.
      {
        source: "/:path*/opengraph-image",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
      {
        source: "/:path*/twitter-image",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
};

export default nextConfig;
