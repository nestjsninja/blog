type MarkdownNode = {
  type: string;
  children?: MarkdownNode[];
  title?: string;
  url?: string;
  value?: string;
};

type VideoEmbed = {
  sourceUrl: string;
  embedUrl?: string;
  videoUrl?: string;
  title: string;
  type: "iframe" | "video";
};

const videoExtensions = new Set(["mp4", "mov", "ogg", "webm"]);

function youtubeId(url: URL) {
  if (url.hostname === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (url.hostname.endsWith("youtube.com")) {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }

    const [, type, id] = url.pathname.split("/");

    if (["embed", "shorts", "live"].includes(type)) {
      return id ?? null;
    }
  }

  return null;
}

function vimeoId(url: URL) {
  if (!url.hostname.endsWith("vimeo.com")) {
    return null;
  }

  return url.pathname.split("/").filter(Boolean).at(-1) ?? null;
}

function directVideoUrl(url: URL) {
  const extension = url.pathname.split(".").at(-1)?.toLowerCase() ?? "";

  return videoExtensions.has(extension) ? url.toString() : null;
}

export function videoEmbedFromUrl(value: string): VideoEmbed | null {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const id = youtubeId(url);

  if (id) {
    return {
      sourceUrl: value,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      title: "YouTube video",
      type: "iframe",
    };
  }

  const vimeoVideoId = vimeoId(url);

  if (vimeoVideoId) {
    return {
      sourceUrl: value,
      embedUrl: `https://player.vimeo.com/video/${vimeoVideoId}`,
      title: "Vimeo video",
      type: "iframe",
    };
  }

  const videoUrl = directVideoUrl(url);

  if (videoUrl) {
    return {
      sourceUrl: value,
      title: "Video",
      type: "video",
      videoUrl,
    };
  }

  return null;
}

function standaloneVideoLink(node: MarkdownNode) {
  if (node.type !== "paragraph" || node.children?.length !== 1) {
    return null;
  }

  const [child] = node.children;

  if (child.type === "link" && child.url) {
    return videoEmbedFromUrl(child.url);
  }

  if (child.type === "text" && child.value) {
    return videoEmbedFromUrl(child.value.trim());
  }

  return null;
}

function iframeNode(video: VideoEmbed): MarkdownNode {
  return {
    type: "html",
    value: `<div class="video-embed"><iframe src="${video.embedUrl}" title="${video.title}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><p><a href="${video.sourceUrl}" target="_blank" rel="noreferrer">Open video</a></p></div>`,
  };
}

function videoNode(video: VideoEmbed): MarkdownNode {
  return {
    type: "html",
    value: `<div class="video-embed"><video src="${video.videoUrl}" controls preload="metadata"></video><p><a href="${video.sourceUrl}" target="_blank" rel="noreferrer">Open video</a></p></div>`,
  };
}

function transformChildren(children?: MarkdownNode[]) {
  if (!children) {
    return;
  }

  for (const [index, node] of children.entries()) {
    const video = standaloneVideoLink(node);

    if (video) {
      children[index] = video.type === "iframe" ? iframeNode(video) : videoNode(video);
      continue;
    }

    transformChildren(node.children);
  }
}

export function remarkVideoEmbeds() {
  return function transformer(tree: MarkdownNode) {
    transformChildren(tree.children);
  };
}
