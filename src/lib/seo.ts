import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nestjs-ninja.com";
const SITE_NAME = "NestJS Ninja";
const DEFAULT_TITLE = "NestJS Ninja | Backend Architecture Notes";
const DEFAULT_DESCRIPTION =
  "A markdown-powered blog about NestJS, backend architecture, TypeScript, and practical development workflows.";
// Rendered by src/app/opengraph-image.tsx rather than hotlinked from a stock photo site,
// so it is branded, cannot disappear, and is always exactly 1200x630.
const DEFAULT_OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "NestJS Ninja: backend lessons and architecture notes",
};

type OgImageDescriptor = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

type BuildMetadataOptions = {
  title: string;
  description?: string;
  path?: string;
  keywords?: string[];
  image?: OgImageDescriptor;
  noIndex?: boolean;
};

type BuildArticleMetadataOptions = BuildMetadataOptions & {
  publishedTime: string;
  modifiedTime?: string;
  authors?: string[];
  tags?: string[];
};

export const siteConfig = {
  url: SITE_URL,
  // Public by design: IndexNow proves domain ownership by serving this same value at
  // /<key>.txt, so it is not a secret and belongs in the repository next to that file.
  indexNowKey: "30c5b27490ffe372b3b86d6ec198e746",
  name: SITE_NAME,
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
};

/**
 * Result-preview directives, shared by every page.
 *
 * Without max-image-preview: large, Google shows a thumbnail instead of the post's generated
 * cover. These have to be repeated on each page rather than set once on the root layout: page
 * metadata that mentions `robots` at all replaces the parent's value, and an explicit
 * `undefined` counts as mentioning it.
 */
const ROBOTS_DEFAULTS = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
} as const;

/** Feed discovery. Same reasoning: `alternates` is replaced wholesale by page metadata. */
const FEED_ALTERNATES = {
  "application/rss+xml": [{ url: "/rss.xml", title: `${SITE_NAME} RSS Feed` }],
};

const FILE_EXTENSION_RE = /\.[a-z]{2,4}$/i;

export function absoluteUrl(pathOrUrl?: string) {
  if (!pathOrUrl) {
    return `${SITE_URL}/`;
  }

  const url = new URL(pathOrUrl, SITE_URL);

  // Only add trailing slashes for local paths without file extensions.
  // External URLs (e.g. Unsplash CDN) and asset paths (.png, .xml, .svg)
  // must not be modified — their servers may not accept trailing slashes.
  const isLocal = url.origin === SITE_URL;
  const hasExtension = FILE_EXTENSION_RE.test(url.pathname);

  if (isLocal && !hasExtension && !url.pathname.endsWith("/")) {
    url.pathname += "/";
  }

  return url.toString();
}

function buildCanonical(path?: string) {
  if (!path) {
    return "/";
  }

  // Ensure trailing slash matches next.config trailingSlash: true.
  // Without this, the canonical tag points to a URL that 301-redirects,
  // and Google may treat the non-slash version as a separate "alternate page".
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function normalizeImage(image?: OgImageDescriptor) {
  const img = image ?? DEFAULT_OG_IMAGE;

  return {
    url: absoluteUrl(img.url),
    width: img.width ?? DEFAULT_OG_IMAGE.width,
    height: img.height ?? DEFAULT_OG_IMAGE.height,
    alt: img.alt ?? DEFAULT_OG_IMAGE.alt,
  };
}

export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  keywords: [
    "NestJS",
    "NestJS tutorial",
    "TypeScript",
    "Node.js",
    "backend architecture",
    "TypeORM",
    "software engineering",
    "developer blog",
  ],
  alternates: {
    canonical: "/",
    types: FEED_ALTERNATES,
  },
  robots: ROBOTS_DEFAULTS,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [normalizeImage()],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [normalizeImage().url],
  },
  category: "technology",
};

export function buildPageMetadata({
  title,
  description,
  path,
  keywords,
  image,
  noIndex,
}: BuildMetadataOptions): Metadata {
  const metaDescription = description ?? DEFAULT_DESCRIPTION;
  const canonicalPath = buildCanonical(path);
  const ogImage = normalizeImage(image);

  return {
    title,
    description: metaDescription,
    keywords,
    alternates: {
      canonical: canonicalPath,
      types: FEED_ALTERNATES,
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description: metaDescription,
      url: absoluteUrl(canonicalPath),
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: metaDescription,
      images: [ogImage.url],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : ROBOTS_DEFAULTS,
  };
}

export function buildArticleMetadata({
  title,
  description,
  path,
  keywords,
  image,
  publishedTime,
  modifiedTime,
  authors,
  tags,
  noIndex,
}: BuildArticleMetadataOptions): Metadata {
  const baseMetadata = buildPageMetadata({
    title,
    description,
    path,
    keywords,
    image,
    noIndex,
  });

  return {
    ...baseMetadata,
    openGraph: {
      ...(baseMetadata.openGraph ?? {}),
      type: "article",
      publishedTime,
      modifiedTime: modifiedTime ?? publishedTime,
      authors: authors?.length ? authors : [SITE_NAME],
      tags,
    },
  };
}
