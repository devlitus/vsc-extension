const HTML_SANITIZE_PATTERN = /[<>&"']/g;

/**
 * Sanitizes a string to prevent XSS attacks.
 *
 * Replaces HTML special characters with their entity equivalents.
 *
 * @param str - Input string to sanitize
 * @returns Sanitized string with HTML entities
 */
export function sanitizeString(str: unknown): string {
  if (typeof str !== 'string') {
    return '';
  }
  return str.replace(HTML_SANITIZE_PATTERN, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}

/**
 * Validates GitHub repository format (owner/repo).
 *
 * @param repo - Repository string to validate
 * @returns true if valid format, false otherwise
 */
export function isValidGithubRepo(repo: string): boolean {
  if (typeof repo !== 'string' || repo.length === 0) return false;
  const GITHUB_REPO_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]*$/;
  const valid = GITHUB_REPO_REGEX.test(repo);
  if (!valid) {
    console.error('[Security] Invalid GitHub repo format:', repo);
  }
  return valid;
}
