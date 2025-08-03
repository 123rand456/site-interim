import DOMPurify from 'dompurify';

// Configure DOMPurify for comment content
const sanitizeConfig = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'a',
    'ul',
    'ol',
    'li',
    'blockquote',
  ],
  ALLOWED_ATTR: ['href'],
  ALLOWED_URI_REGEXP: /^https?:\/\/|^mailto:/,
  ADD_TAGS: [],
  ADD_ATTR: [],
};

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param content - Raw HTML string from user input
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // For server-side usage, we need to check if we're in browser environment
  if (typeof window === 'undefined') {
    // Server-side: basic text sanitization as fallback
    return content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Client-side: use DOMPurify
  return DOMPurify.sanitize(content, sanitizeConfig);
}

/**
 * Sanitize plain text input (for names, emails, etc.)
 * @param text - Plain text input
 * @returns Sanitized text string
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .trim()
    .replace(/[<>]/g, '') // Remove basic HTML characters
    .substring(0, 500); // Limit length
}

/**
 * Validate and sanitize email addresses
 * @param email - Email input
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }

  const sanitized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailRegex.test(sanitized) ? sanitized : '';
}

/**
 * Rate limiting check for comments (client-side validation)
 * Note: This is supplementary to server-side rate limiting
 * @returns boolean indicating if user can submit
 */
export function checkCommentRateLimit(): boolean {
  const lastSubmission = localStorage.getItem('lastCommentSubmission');
  const now = Date.now();

  if (lastSubmission) {
    const timeDiff = now - parseInt(lastSubmission);
    const minInterval = 30 * 1000; // 30 seconds minimum between comments

    if (timeDiff < minInterval) {
      return false;
    }
  }

  localStorage.setItem('lastCommentSubmission', now.toString());
  return true;
}
