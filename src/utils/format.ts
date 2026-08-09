/**
 * Author strings in publications.yaml mark Ricardo's own name with `**…**`.
 * This converts that to <strong>, escaping everything else first so the YAML
 * can never inject markup.
 */
export function authorsToHtml(authors: string): string {
  const escaped = authors
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong class="self">$1</strong>');
}

/**
 * Adds a sentence-ending period unless the string already has one — several
 * author lists end in "et al.", which would otherwise render as "et al..".
 */
export function endWithPeriod(text: string): string {
  return /[.?!]\s*$/.test(text) ? text.trimEnd() : `${text.trimEnd()}.`;
}

/** "https://doi.org/10.3390/toxics12110803" -> "doi.org" */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Short label for the link on a publication row. */
export function linkLabel(url: string): string {
  const host = hostOf(url);
  if (host.includes('doi.org')) return 'View DOI';
  if (host.includes('pubmed')) return 'View on PubMed';
  if (host.includes('nejm')) return 'Read in NEJM AI';
  return 'Read paper';
}
