import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('🚀 API endpoint called');

    // Test environment variables first
    const supabaseUrl = (import.meta as any).env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = (import.meta as any).env.PUBLIC_SUPABASE_ANON_KEY;

    // Environment check completed

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
      // Attribution parameters
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      refTag,
    } = body;

    // API called with page tracking data

    // Get real IP address from server (try multiple headers)
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
    const clientIP = forwardedFor || realIP || cfConnectingIP || '127.0.0.1'; // Use valid localhost IP

    // IP address extracted from headers

    // Create a fresh Supabase client for this request
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    // Supabase client created

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
      // Attribution parameters
      p_utm_source: utmSource || null,
      p_utm_medium: utmMedium || null,
      p_utm_campaign: utmCampaign || null,
      p_utm_content: utmContent || null,
      p_utm_term: utmTerm || null,
      p_ref_tag: refTag || null,
    });

    if (error) {
      console.error('❌ Server-side tracking error');
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
      });
    }

    console.log('✅ Server-side tracking successful');
    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
    });
  } catch (error) {
    console.error('❌ API error');
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
};
