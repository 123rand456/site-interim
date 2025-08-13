import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('🚀 API endpoint called');

    // Test environment variables first
    const supabaseUrl = (import.meta as any).env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = (import.meta as any).env.PUBLIC_SUPABASE_ANON_KEY;

    console.log('🔧 Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
    });

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Missing environment variables');
      return new Response(
        JSON.stringify({ error: 'Missing Supabase environment variables' }),
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      pagePath,
      pageTitle,
      sessionId,
      viewportWidth,
      viewportHeight,
      screenWidth,
      screenHeight,
      timezone,
      language,
      referrer,
      userAgent,
    } = body;

    console.log('🔧 API called with:', { pagePath, pageTitle, sessionId });

    // Get real IP address from server (try multiple headers)
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
    const clientIP = forwardedFor || realIP || cfConnectingIP || '127.0.0.1'; // Use valid localhost IP

    console.log('🌐 IP Headers:', {
      'x-forwarded-for': forwardedFor,
      'x-real-ip': realIP,
      'cf-connecting-ip': cfConnectingIP,
      'final-ip': clientIP,
    });

    // Create a fresh Supabase client for this request
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    console.log('✅ Supabase client created');

    // Use the same RPC function that bypasses RLS
    const { data, error } = await supabaseClient.rpc('track_page_view', {
      p_page_path: pagePath,
      p_page_title: pageTitle,
      p_session_id: sessionId,
      p_ip_address: clientIP,
      p_referrer: referrer || request.headers.get('referer') || null,
      p_user_agent: userAgent || request.headers.get('user-agent') || null,
      p_viewport_width: viewportWidth || null,
      p_viewport_height: viewportHeight || null,
      p_screen_width: screenWidth || null,
      p_screen_height: screenHeight || null,
      p_timezone: timezone || null,
      p_language: language || null,
    });

    if (error) {
      console.error('❌ Server-side tracking error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
      });
    }

    console.log('✅ Server-side tracking successful:', data);
    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
    });
  } catch (error) {
    console.error('❌ API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
};
