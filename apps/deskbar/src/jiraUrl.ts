// Paths people paste along with the site: an issue link, a board, a REST url copied from docs.
const PAGE_PATH = /\/(browse|secure|projects|rest|plugins)(\/|$).*/;

/** A pasted Jira address cut down to the site root, or the input unchanged when it isn't a url. */
export function normalizeJiraUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return trimmed;
  }
  // Cloud sites live at the root; self-hosted ones may sit under a context path like /jira-dc.
  if (url.hostname.endsWith('.atlassian.net')) return url.origin;
  return `${url.origin}${url.pathname.replace(PAGE_PATH, '').replace(/\/+$/, '')}`;
}
