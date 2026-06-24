export interface FilterablePost {
  /** Lowercased, pre-built haystack of title + excerpt + tags + body. */
  searchText: string;
  tags?: string[];
}

export interface PostFilter {
  query?: string;
  tag?: string | null;
}

/**
 * Narrows posts by an optional free-text query and an optional tag.
 *
 * - the query is trimmed and matched case-insensitively against `searchText`
 * - the tag must be present in the post's `tags`
 * - both are AND-ed; an empty query / null tag matches everything
 * - input order is preserved
 *
 * This is the logic behind the blog search + tag filter UI (`blog-search.tsx`).
 */
export function filterPosts<T extends FilterablePost>(
  posts: T[],
  filter: PostFilter = {},
): T[] {
  const query = (filter.query ?? "").trim().toLowerCase();
  const tag = filter.tag ?? null;

  return posts.filter((post) => {
    const matchesTag = !tag || (post.tags ?? []).includes(tag);
    const matchesQuery = !query || post.searchText.includes(query);
    return matchesTag && matchesQuery;
  });
}
