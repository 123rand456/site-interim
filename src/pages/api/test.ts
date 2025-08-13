import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  try {
    console.log('🧪 Test API called');

    // Test environment variables
    const supabaseUrl = (import.meta as any).env.PUBLIC_SUPABASE_URL;
    const supabaseKey = (import.meta as any).env.PUBLIC_SUPABASE_ANON_KEY;

    console.log('🔧 Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      urlPrefix: supabaseUrl?.substring(0, 20) + '...',
    });

    // Test headers
    const headers = Object.fromEntries(request.headers.entries());
    console.log('📋 Request headers:', headers);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test API working',
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseKey: !!supabaseKey,
        headers: Object.keys(headers),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Test API error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
