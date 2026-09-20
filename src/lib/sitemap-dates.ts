/**
 * Works out the `lastmod` to publish for a post.
 *
 * Posts are written ahead of time and dated for the Thursday they belong to, so a freshly
 * published post routinely carries a date a week in the future. Google treats an implausible
 * `lastmod` as a reason to distrust the field and fall back to ignoring it, which is the
 * opposite of what you want on the newest posts, the ones you most want crawled.
 *
 * So clamp it: a future date becomes "now", which is both true (the file really was published
 * just now) and believable.
 */
export function sitemapLastModified(
  postDate: string | Date,
  now: Date = new Date(),
): Date {
  const date = postDate instanceof Date ? postDate : new Date(postDate);

  if (Number.isNaN(date.getTime())) {
    return now;
  }

  return date.getTime() > now.getTime() ? now : date;
}
