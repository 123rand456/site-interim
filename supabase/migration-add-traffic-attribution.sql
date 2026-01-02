-- =========================================
-- TRAFFIC ATTRIBUTION MIGRATION
-- Adds UTM parameters and ref tags for traffic source tracking
-- Part of TICKET-010: Traffic Attribution and Referral Tracking
-- Date: 2026-01-02
-- =========================================

SET search_path = public;

-- =========================================
-- 1. ADD COLUMNS TO page_views TABLE
-- =========================================

ALTER TABLE public.page_views 
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_content TEXT,
ADD COLUMN IF NOT EXISTS utm_term TEXT,
ADD COLUMN IF NOT EXISTS ref_tag TEXT;

-- =========================================
-- 2. ADD INDEXES FOR PERFORMANCE
-- =========================================

CREATE INDEX IF NOT EXISTS idx_page_views_utm_source ON public.page_views(utm_source);
CREATE INDEX IF NOT EXISTS idx_page_views_utm_campaign ON public.page_views(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_page_views_ref_tag ON public.page_views(ref_tag);

-- =========================================
-- 3. UPDATE track_page_view FUNCTION
-- =========================================

CREATE OR REPLACE FUNCTION public.track_page_view(
    p_page_path TEXT,
    p_page_title TEXT DEFAULT NULL,
    p_referrer TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_viewport_width INTEGER DEFAULT NULL,
    p_viewport_height INTEGER DEFAULT NULL,
    p_screen_width INTEGER DEFAULT NULL,
    p_screen_height INTEGER DEFAULT NULL,
    p_timezone TEXT DEFAULT NULL,
    p_language TEXT DEFAULT NULL,
    -- NEW: Attribution parameters
    p_utm_source TEXT DEFAULT NULL,
    p_utm_medium TEXT DEFAULT NULL,
    p_utm_campaign TEXT DEFAULT NULL,
    p_utm_content TEXT DEFAULT NULL,
    p_utm_term TEXT DEFAULT NULL,
    p_ref_tag TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    view_id UUID;
    unique_views_count INTEGER;
    ip_text TEXT;
    ip_inet INET;
BEGIN
    -- Extract client IP from headers if not provided
    IF p_ip_address IS NULL THEN
        ip_text := COALESCE(
            current_setting('request.headers', true)::json->>'x-forwarded-for',
            current_setting('request.headers', true)::json->>'x-real-ip',
            current_setting('request.headers', true)::json->>'cf-connecting-ip',
            NULL
        );
        IF ip_text IS NOT NULL THEN
            IF position(',' in ip_text) > 0 THEN
                ip_text := split_part(ip_text, ',', 1);
            END IF;
            ip_text := trim(ip_text);
            BEGIN
                ip_inet := ip_text::inet;
            EXCEPTION WHEN others THEN
                ip_inet := NULL;
            END;
        END IF;
    ELSE
        ip_inet := p_ip_address;
    END IF;

    -- Insert page view record with attribution data
    INSERT INTO public.page_views (
        page_path, page_title, referrer, user_agent, session_id, ip_address,
        viewport_width, viewport_height, screen_width, screen_height, timezone, language,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term, ref_tag
    ) VALUES (
        p_page_path, p_page_title, p_referrer, p_user_agent, p_session_id, ip_inet,
        p_viewport_width, p_viewport_height, p_screen_width, p_screen_height, p_timezone, p_language,
        p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_ref_tag
    ) RETURNING id INTO view_id;
    
    -- Calculate unique views (unique session IDs for this content)
    SELECT COUNT(DISTINCT session_id) INTO unique_views_count
    FROM public.page_views 
    WHERE page_path = p_page_path;
    
    -- Update content analytics with proper unique views count
    INSERT INTO public.content_analytics (content_path, content_type, total_views, unique_views)
    VALUES (p_page_path, 'page', 1, unique_views_count)
    ON CONFLICT (content_path) 
    DO UPDATE SET 
        total_views = content_analytics.total_views + 1,
        unique_views = unique_views_count,
        last_updated = NOW();
    
    RETURN view_id;
END;
$$;

-- =========================================
-- 4. CREATE ENHANCED ATTRIBUTION VIEW
-- =========================================

-- Drop old view
DROP VIEW IF EXISTS public.page_views_with_source;

-- Create new enhanced view with attribution priority
CREATE OR REPLACE VIEW public.page_views_with_attribution AS
SELECT 
  pv.*,
  
  -- Attribution source with priority: explicit > inferred > unknown
  COALESCE(
    pv.utm_source,                    -- 1. Explicit UTM (highest confidence)
    pv.ref_tag,                       -- 2. Simple ref tag (high confidence)
    CASE                              -- 3. Inferred from referrer/UA (medium/low confidence)
      -- X / Twitter
      WHEN pv.referrer ILIKE '%t.co%' OR pv.referrer ILIKE '%x.com%' OR pv.referrer ILIKE '%twitter.com%' OR pv.user_agent ILIKE '%Twitter%' THEN 'twitter'
      -- Instagram
      WHEN pv.referrer ILIKE '%l.instagram.com%' OR pv.referrer ILIKE '%instagram.com%' OR pv.user_agent ILIKE '%Instagram%' THEN 'instagram'
      -- LinkedIn
      WHEN pv.referrer ILIKE '%lnkd.in%' OR pv.referrer ILIKE '%linkedin.com%' OR pv.user_agent ILIKE '%LinkedIn%' THEN 'linkedin'
      -- Reddit variants
      WHEN pv.referrer ILIKE '%reddit.com%' OR pv.referrer ILIKE '%out.reddit.com%' OR pv.referrer ILIKE '%amp.reddit.com%' OR pv.referrer ILIKE '%reddit.app.link%' OR pv.referrer ILIKE '%redd.it%' OR pv.user_agent ILIKE '%Reddit%' THEN 'reddit'
      -- Telegram
      WHEN pv.referrer ILIKE '%t.me%' OR pv.referrer ILIKE '%telegram%' OR pv.user_agent ILIKE '%Telegram%' THEN 'telegram'
      -- Facebook
      WHEN pv.referrer ILIKE '%facebook.com%' OR pv.referrer ILIKE '%fb.com%' OR pv.user_agent ILIKE '%FBAN%' THEN 'facebook'
      -- Discord
      WHEN pv.referrer ILIKE '%discord.com%' OR pv.referrer ILIKE '%discord.gg%' THEN 'discord'
      -- WhatsApp
      WHEN pv.user_agent ILIKE '%WhatsApp%' THEN 'whatsapp'
      -- Internal navigation
      WHEN pv.referrer ILIKE '%mienstream.com%' THEN 'internal'
      -- Direct/unknown
      WHEN pv.referrer IS NULL OR pv.referrer = '' THEN 'direct'
      ELSE 'other'
    END
  ) AS attributed_source,
  
  -- Attribution confidence level
  CASE
    WHEN pv.utm_source IS NOT NULL THEN 'explicit_utm'
    WHEN pv.ref_tag IS NOT NULL THEN 'explicit_ref'
    WHEN pv.referrer IS NOT NULL AND pv.referrer NOT ILIKE '%mienstream.com%' THEN 'inferred_referrer'
    WHEN pv.user_agent ILIKE '%Instagram%' OR pv.user_agent ILIKE '%Twitter%' OR pv.user_agent ILIKE '%WhatsApp%' THEN 'inferred_ua'
    ELSE 'unknown'
  END AS attribution_confidence,
  
  -- Campaign info (from UTM only)
  pv.utm_medium AS campaign_medium,
  pv.utm_campaign AS campaign_name,
  pv.utm_content AS campaign_content,
  pv.utm_term AS campaign_term,
  
  -- Human-readable source label
  CASE 
    WHEN pv.ref_tag = 'bb' THEN 'Bumble Profile'
    WHEN pv.ref_tag = 'pc' OR pv.ref_tag = 'postcard' THEN 'Postcrossing Card'
    WHEN pv.ref_tag = 'tg' THEN 'Telegram Bio'
    WHEN pv.ref_tag = 'email' THEN 'Email Signature'
    WHEN pv.ref_tag = 'hn' THEN 'Hacker News'
    WHEN pv.ref_tag = 'lw' THEN 'LessWrong'
    WHEN pv.utm_source IS NOT NULL THEN 'Campaign: ' || pv.utm_source
    WHEN pv.referrer ILIKE '%mienstream.com%' THEN 'Internal Navigation'
    ELSE COALESCE(
      pv.utm_source, 
      pv.ref_tag,
      CASE
        WHEN pv.referrer ILIKE '%t.co%' OR pv.referrer ILIKE '%twitter%' THEN 'Twitter'
        WHEN pv.referrer ILIKE '%instagram%' THEN 'Instagram'
        WHEN pv.referrer ILIKE '%linkedin%' THEN 'LinkedIn'
        WHEN pv.referrer ILIKE '%reddit%' THEN 'Reddit'
        WHEN pv.referrer ILIKE '%telegram%' THEN 'Telegram'
        WHEN pv.referrer ILIKE '%facebook%' THEN 'Facebook'
        WHEN pv.referrer IS NULL OR pv.referrer = '' THEN 'Direct'
        ELSE 'Other'
      END
    )
  END AS source_label

FROM public.page_views pv;

-- Set security
ALTER VIEW public.page_views_with_attribution SET (security_invoker = on);

-- =========================================
-- 5. GRANT PERMISSIONS
-- =========================================

-- Grant select on the new view
GRANT SELECT ON public.page_views_with_attribution TO authenticated;
GRANT SELECT ON public.page_views_with_attribution TO anon;

-- =========================================
-- 6. USEFUL ANALYTICS QUERIES
-- =========================================

-- Create helper function: Get traffic breakdown
CREATE OR REPLACE FUNCTION public.get_traffic_breakdown(
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE(
    source_label TEXT,
    attributed_source TEXT,
    confidence TEXT,
    total_views BIGINT,
    unique_sessions BIGINT,
    percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH totals AS (
        SELECT COUNT(*)::NUMERIC as total_count
        FROM page_views_with_attribution
        WHERE created_at BETWEEN p_start_date AND p_end_date
    )
    SELECT 
        pva.source_label,
        pva.attributed_source,
        pva.attribution_confidence as confidence,
        COUNT(*)::BIGINT as total_views,
        COUNT(DISTINCT pva.session_id)::BIGINT as unique_sessions,
        ROUND((COUNT(*)::NUMERIC / totals.total_count * 100), 2) as percentage
    FROM page_views_with_attribution pva, totals
    WHERE pva.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY pva.source_label, pva.attributed_source, pva.attribution_confidence, totals.total_count
    ORDER BY total_views DESC;
END;
$$;

-- Grant execution
GRANT EXECUTE ON FUNCTION public.get_traffic_breakdown TO authenticated;

-- =========================================
-- COMPLETION NOTICE
-- =========================================

DO $$ 
BEGIN 
  RAISE NOTICE '✅ Traffic Attribution Migration Applied Successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 New columns added:';
  RAISE NOTICE '  - utm_source, utm_medium, utm_campaign, utm_content, utm_term';
  RAISE NOTICE '  - ref_tag';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 New view created: page_views_with_attribution';
  RAISE NOTICE '  - Replaces: page_views_with_source';
  RAISE NOTICE '  - Adds: attribution_confidence, campaign info, source_label';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Example trackable URLs:';
  RAISE NOTICE '  - Bumble: mienstream.com?ref=bb';
  RAISE NOTICE '  - Postcrossing: mienstream.com?ref=pc';
  RAISE NOTICE '  - Telegram: mienstream.com?ref=tg';
  RAISE NOTICE '  - Newsletter: mienstream.com?utm_source=newsletter&utm_medium=email';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 New function: get_traffic_breakdown(start_date, end_date)';
  RAISE NOTICE '  Usage: SELECT * FROM get_traffic_breakdown();';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Ready for TICKET-010 implementation!';
END $$;

