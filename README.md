# Chizubo's Essays and Research

A personal website inspired by gwern.net, built with Astro and Tailwind CSS.

## 📁 Project Structure

```text
/
├── public/                  # Static assets (robots.txt, favicon, etc. no processing or bundling here)
│   ├── *.svg
├── scripts/                 # Utility and automation scripts
│   └── algolia-index.mjs
├── src/
│   ├── assets/              # Images and other asset files (bundled and optimized, useful for images, fonts etc.)
│   ├── components/          # Reusable UI components
│   ├── contexts/            # React/JS context providers
│   ├── layouts/             # Page layout templates
│   ├── pages/               # Route definitions (Astro/MD/MDX)
│   ├── styles/              # CSS styles (global, theme, component)
│   └── utils/               # Utility functions and plugins
├── supabase/                # Supabase SQL and RLS policy files
│   ├── auth-policies.sql
│   └── supabase-schema.sql
├── .github/                 # GitHub configuration
│   └── workflows/
│       └── deploy.yml
├── .vscode/                 # VSCode workspace settings
│   ├── extensions.json
│   └── launch.json
├── package.json
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
└── README.md
```

## Commands

All commands are run from the root of the project, from a terminal:

| Command             | Action                                           |
| :------------------ | :----------------------------------------------- |
| `npm install`       | Installs dependencies                            |
| `npm run dev`       | Starts local dev server at `localhost:4321`      |
| `npm run build`     | Build your production site to `./dist/`          |
| `npm run preview`   | Preview your build locally, before deploying     |
| `npm run astro ...` | Run CLI commands like `astro add`, `astro check` |

## Styling Guidelines

The project follows these styling principles:

- **Component-specific styles**: Keep in component file
- **Shared styles and patterns**: Place in `/styles` directory
- **Global styles and CSS variables**: Use `/styles/theme.css` or `/styles/global.css`
- **Light/Dark Mode**: Implemented using CSS variables and Tailwind's dark mode

## Authentication Flow

The site uses Supabase for authentication, implementing a secure PKCE (Proof Key for Code Exchange)
flow with magic links. This provides a passwordless authentication system for admin access.

### Magic Link Authentication Flow

The first diagram shows the high-level magic link authentication flow:

```mermaid
sequenceDiagram
    participant User
    participant Callback Page
    participant Supabase

    User->>Callback Page: Clicks magic link with code
    Note over Callback Page: /auth/callback?code=xyz...
    Callback Page->>Supabase: exchangeCodeForSession(code)
    Supabase-->>Callback Page: Returns session token
    Callback Page->>User: Redirect to admin page
```

### Detailed PKCE Flow

The second diagram shows the detailed PKCE flow with magic links:

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant Supabase Auth
    participant Database

    Note over Client: Generate code_verifier
    Note over Client: Generate code_challenge (hash of verifier)
    User->>Client: Click "Admin Sign In"
    Client->>Supabase Auth: Request auth (email + code_challenge)
    Supabase Auth->>User: Send magic link email
    User->>Supabase Auth: Click magic link
    Supabase Auth-->>Client: Redirect with auth_code
    Client->>Supabase Auth: Exchange auth_code + code_verifier
    Note over Supabase Auth: Verify code_challenge matches verifier
    Supabase Auth-->>Client: Return session token
    Client->>Database: Query admin_users table
    Database-->>Client: Return admin status
    Client->>User: Update UI (show admin view)
```

This implementation ensures:

- Secure passwordless authentication
- Protection against CSRF attacks
- Verification of admin status
- Session management with secure tokens

## To-Do

- [x] Add search functionality
- [x] Add essay indexing
- [x] Improve page styling with nested directional links
- [x] Add toggle drop down
- [ ] Add recommendation
- [x] Add comments
- [x] Properly secure admin interface
- [ ] Add rss feed
- [ ] Optimize for mobile screen
- [ ] Change UI admin
- [ ] Add Dropcaps (?)
- [ ] Get Domain Name
