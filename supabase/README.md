# Supabase Schema Documentation

## 📋 **Schema Files Overview**

### **Production Schema**

- **`schema-final.sql`** - **USE THIS FILE**
  - Complete consolidated schema for Phase 2 security implementation
  - Includes all tables, functions, RLS policies, and optimizations
  - Safe to run multiple times (uses `IF NOT EXISTS` and `DROP POLICY IF EXISTS`)
  - Ready for production deployment

### **Legacy Files (Historical Reference)**

- `supabase-schema.sql` - Original base schema
- `auth-policies.sql` - Initial auth policies
- `security-fixes-phase2.sql` - First iteration of Phase 2 fixes
- `security-fixes-phase2-v2.sql` - Second iteration with improvements
- `performance-security-optimizations.sql` - Final optimizations

## 🚀 **Deployment Instructions**

### **For New Supabase Project:**

```sql
-- Run this single file in Supabase SQL Editor:
-- Copy and paste contents of schema-final.sql
```

### **For Existing Project:**

```sql
-- The schema-final.sql is idempotent and safe to run
-- It will update existing tables and recreate policies
```

## 🔧 **What's Included**

### **Tables Created:**

- `user_profiles` - User profile management
- `admin_users` - Admin user authentication
- `rate_limits` - Server-side rate limiting
- `security_events` - Security event logging
- Comments table (assumed to exist)

### **Functions Created:**

- `check_rate_limit()` - Rate limiting enforcement
- `log_security_event()` - Security event logging
- `insert_comment_secure()` - Secure comment insertion with rate limiting

### **Security Features:**

- Row Level Security (RLS) on all tables
- Admin-only access to security tables
- IP-based rate limiting (5 comments per 30 minutes)
- Comprehensive security event logging
- Optimized indexes for performance

## 📊 **Schema Evolution**

| Version  | File                                     | Description                        |
| -------- | ---------------------------------------- | ---------------------------------- |
| v1.0     | `supabase-schema.sql`                    | Base schema with comments          |
| v1.1     | `auth-policies.sql`                      | Added authentication policies      |
| v2.0     | `security-fixes-phase2.sql`              | Phase 2 security implementation    |
| v2.1     | `security-fixes-phase2-v2.sql`           | Bug fixes and improvements         |
| v2.2     | `performance-security-optimizations.sql` | Performance optimizations          |
| **v3.0** | **`schema-final.sql`**                   | **Consolidated production schema** |

## ✅ **Validation**

After running `schema-final.sql`, verify deployment:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('rate_limits', 'security_events', 'user_profiles', 'admin_users');

-- Check functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN ('check_rate_limit', 'log_security_event', 'insert_comment_secure');

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('rate_limits', 'security_events', 'user_profiles', 'admin_users');
```

## 🔐 **Security Notes**

- All security functions use `SECURITY DEFINER` for proper permissions
- RLS policies prevent unauthorized access to security data
- Rate limiting is enforced at the database level
- All functions include proper error handling and logging
