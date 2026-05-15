import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nestjs-ninja.com";
const SITE_NAME = "NestJS Ninja";
const DEFAULT_TITLE = "NestJS Ninja | Backend Architecture Notes";
const DEFAULT_DESCRIPTION =
  "A markdown-powered blog about NestJS, backend architecture, TypeScript, and practical development workflows.";
const DEFAULT_OG_IMAGE = {
  url: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?q=80&w=1200&auto=format&fit=crop",
  width: 1200,
  height: 630,
  alt: "Code editor on a software engineering desk",
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
  name: SITE_NAME,
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
};

export function absoluteUrl(pathOrUrl?: string) {
  if (!pathOrUrl) {
    return SITE_URL;
  }

  return new URL(pathOrUrl, SITE_URL).toString();
}

function buildCanonical(path?: string) {
  if (!path) {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
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
    "software engineering",
    "Next.js",
    "React",
    "TypeScript",
    "developer blog",
  ],
  alternates: {
    canonical: "/",
  },
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
  robots: {
    index: true,
    follow: true,
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
    robots:
      typeof noIndex === "boolean"
        ? {
            index: !noIndex,
            follow: !noIndex,
          }
        : undefined,
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
