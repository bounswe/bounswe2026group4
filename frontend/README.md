# Local History Story Map -- Frontend

A React single-page application for discovering, creating, and interacting with location-based historical stories on an interactive map.

## Tech Stack

- **React 19** with Vite 8
- **Tailwind CSS 4** for styling
- **shadcn/ui** (Radix UI primitives + CVA) for UI components
- **React Router DOM 7** for client-side routing
- **Axios** for HTTP requests
- **Leaflet / React Leaflet** for interactive maps
- **Vitest** + React Testing Library for testing
- **ESLint** for linting

## Prerequisites

- **Node.js** >= 20 (CI uses Node 20)
- **npm**

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

The dev server starts at `http://localhost:5173` by default.

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Start development server with HMR |
| `build` | `vite build` | Create production build in `dist/` |
| `preview` | `vite preview` | Serve the production build locally |
| `lint` | `eslint .` | Run ESLint on the codebase |
| `test` | `vitest` | Run tests in watch mode |
| `test:run` | `vitest run` | Run tests once (CI mode) |

## Environment Variables

Create a `.env` file in the `frontend/` directory. All custom variables must be prefixed with `VITE_`.

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend API base URL |
| `VITE_SITE_URL` | `https://storymap.page` | Public site origin used in Schema.org JSON-LD `@id` / `url` fields. Override in staging/dev so structured data doesn't point to production. |

## Testing

Tests use **Vitest** with **jsdom** and **React Testing Library**.

```bash
# Watch mode
npm test

# Single run (used in CI)
npm run test:run
```

Test files live alongside source code in `__tests__/` directories. The global test setup is at `src/test/setup.js`.

## Folder Structure

```
src/
├── assets/            # Static assets (images, fonts, etc.)
├── components/
│   ├── ui/            # shadcn/ui components (button, card, input, etc.)
│   ├── AppLayout/     # App shell / layout wrapper
│   ├── Interactions/  # Story interaction components (like, comment, etc.)
│   ├── MapPicker/     # Location picker for story submission
│   ├── MapView/       # Map display component
│   ├── SearchFilter/  # Search and filter controls
│   ├── StoryCard/     # Story card component
│   └── StoryDetailMap/# Map view on story detail page
├── context/           # React context providers (Auth, Toast)
├── hooks/             # Custom React hooks (useAuth, useDebounce, etc.)
├── lib/               # Utility libraries (e.g., cn() helper)
├── pages/             # Page-level components (routed views)
├── services/          # API service modules (axios calls)
├── styles/            # Global CSS and Tailwind config
├── test/              # Test setup files
└── utils/             # General utility functions
```

Path alias `@` is configured to resolve to `src/`, so you can import as `@/components/ui/button`.

## Adding shadcn/ui Components

```bash
npx shadcn@latest add <component>
```

For example: `npx shadcn@latest add button`

Components are installed into `src/components/ui/`.
