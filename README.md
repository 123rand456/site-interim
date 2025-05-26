# Chizubo's Essays and Research

A personal website inspired by gwern.net, built with Astro and Tailwind CSS.

## 📁 Project Structure

```text
/
├── public/                  # Static assets
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── PageMetadata.astro   # Displays essay metadata
│   │   └── TableOfContents.astro # Navigation for structured content
│   ├── layouts/             # Page layout templates
│   │   ├── MainLayout.astro     # Base layout with navigation
│   │   └── EssayLayout.astro    # Essay-specific layout
│   ├── pages/               # Route definitions
│   │   ├── about/           # About page with sections
│   │   ├── essays/          # Essay collection
│   │   │   ├── example-essay.md  # Markdown essay
│   │   │   └── index.astro        # Essays listing page
│   │   └── index.astro      # Homepage
│   ├── styles/              # CSS styles
│   │   ├── components/      # Component-specific styles
│   │   ├── global.css       # Global styles
│   │   └── theme.css        # Theme variables
│   └── utils/               # Utility functions
│       └── constants.ts     # Shared constants
└── package.json
```

## Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |


## Styling Guidelines

The project follows these styling principles:

- **Component-specific styles**: Keep in component file
- **Shared styles and patterns**: Place in `/styles` directory
- **Global styles and CSS variables**: Use `/styles/theme.css` or `/styles/global.css`
- **Light/Dark Mode**: Implemented using CSS variables and Tailwind's dark mode

## To-Do

- [x] Add search functionality
- [x] Add essay indexing
- [x] Improve page styling with nested directional links 
- [x] Add toggle drop down 
- [] Add recommendation
- [] Add comments
- [] Add rss feed
- [] Add Dropcaps (?)

