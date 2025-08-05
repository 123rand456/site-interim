import { defineMiddleware } from 'astro:middleware';

// Helper function to extract client IP address
function getClientIP(request: Request): string {
  // Check common headers for real IP (in order of priority)
  const headers = request.headers;

  // Vercel/Cloudflare specific headers
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can have multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  // Other common headers
  const realIP = headers.get('x-real-ip');
  if (realIP) return realIP;

  const cfConnectingIP = headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;

  // Fallback - note this might be a proxy IP in production
  return 'unknown';
}

export const onRequest = defineMiddleware(async (context, next) => {
  // Extract client IP and make it available to the application
  const clientIP = getClientIP(context.request);

  // Store IP in locals for use by pages/components
  context.locals.clientIP = clientIP;

  // Call next middleware and get response
  const response = await next();

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
});
