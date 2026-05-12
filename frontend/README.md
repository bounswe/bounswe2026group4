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
| `test:e2e` | `playwright test` | Run E2E tests (headless) |
| `test:e2e:ui` | `playwright test --ui` | Run E2E tests with Playwright UI |
| `test:e2e:debug` | `playwright test --debug` | Debug E2E tests step-by-step |
| `test:e2e:install` | `playwright install --with-deps chromium` | Install Playwright browser (first-time setup) |

## Environment Variables

Copy `frontend/.env.example` to `frontend/.env` and fill in the values. All custom variables must be prefixed with `VITE_`.

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend API base URL |
| `VITE_SITE_URL` | `http://localhost:5173` | Public site origin — used in Schema.org JSON-LD `@id` / `url` fields. Set to your domain in production so structured data is correct. |

## Routes

| Path | Auth | Description |
|------|------|-------------|
| `/` | Public | Story feed |
| `/map` | Public | Interactive map view |
| `/timeline` | Public | Timeline view |
| `/login` | Public | Login |
| `/register` | Public | Registration |
| `/verify-email` | Public | Email verification |
| `/forgot-password` | Public | Forgot password |
| `/reset-password/:token` | Public | Password reset |
| `/complete-profile` | Authenticated | Post-registration profile completion |
| `/profile` | Authenticated | Own profile |
| `/profile/:userId` | Public | Public user profile |
| `/submit-story` | Authenticated | Submit a new story |
| `/stories/:id` | Public | Story detail |
| `/tags/:slug` | Public | Stories by tag |
| `/notifications/preferences` | Authenticated | Notification preferences |
| `/admin` | Admin | Admin panel (reports, stories) |

## Testing

### Unit tests

Tests use **Vitest** with **jsdom** and **React Testing Library**.

```bash
npm test          # Watch mode
npm run test:run  # Single run (used in CI)
```

Test files live in `__tests__/` directories colocated with the code they test. The global test setup is at `src/test/setup.js`.

### E2E tests

End-to-end tests use **Playwright** (Chromium). Backend traffic is mocked via `page.route`, so a live Django server is not required.

```bash
# First-time setup — install the Playwright browser
npm run test:e2e:install

# Run all E2E specs headlessly
npm run test:e2e

# Open the Playwright UI for interactive debugging
npm run test:e2e:ui

# Step through a failing test in debug mode
npm run test:e2e:debug
```

E2E specs live in `frontend/e2e/`. The Vite dev server is started automatically by Playwright on port 5173.

## Folder Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui primitives (button, card, input, etc.)
│   ├── AdminPanel/      # Admin panel components
│   ├── AdminRoute.jsx   # Route guard for admin-only pages
│   ├── AppLayout/       # App shell / nav / layout wrapper
│   ├── Follow/          # Follow / unfollow UI
│   ├── Interactions/    # Story interactions (like, comment, bookmark)
│   ├── MapPicker/       # Location picker for story submission
│   ├── MapView/         # Interactive map display
│   ├── Notifications/   # Notification components
│   ├── Profile/         # Profile page components
│   ├── ProtectedRoute.jsx # Route guard for authenticated pages
│   ├── Report/          # Report / flag content components
│   ├── SearchFilter/    # Search and filter controls
│   ├── StoryCard/       # Story card used in feed and search
│   ├── StoryDetailMap/  # Map shown on story detail page
│   ├── StructuredData/  # Schema.org JSON-LD injection
│   ├── Tags/            # Tag display components
│   └── Timeline/        # Timeline view components
├── context/             # React context providers (AuthContext, ToastContext)
├── hooks/               # Custom hooks (useAuth, useDebounce, useGeocoding, etc.)
├── lib/                 # Utility libraries (cn() helper)
├── pages/               # Page-level components (one per route)
├── services/            # API service modules (one per backend domain)
├── styles/              # Global CSS and Tailwind config
├── test/                # Vitest global setup
└── utils/               # Pure utility functions (edtf, distance, tags, etc.)
```

Path alias `@` is configured to resolve to `src/`, so you can import as `@/components/ui/button`.

## Services

Each file in `src/services/` wraps one backend domain:

| File | Domain |
|------|--------|
| `api.js` | Axios instance + token refresh interceptor |
| `authService.js` | Register, login, logout, token refresh |
| `userService.js` | User profiles, photo upload |
| `storyService.js` | Story CRUD, feed, map pins, search |
| `interactionService.js` | Likes, comments |
| `bookmarkService.js` | Bookmarks |
| `followService.js` | Follow / unfollow, followers/following lists |
| `tagService.js` | Tags |
| `notificationService.js` | Notifications |
| `reportService.js` | Content reports |
| `adminService.js` | Admin actions |
| `geocodingService.js` | Nominatim geocoding |
| `deviceLocationService.js` | Browser geolocation |
| `timelineService.js` | Timeline data |
| `tokenStore.js` | JWT token storage |
| `navigationRef.js` | Imperative navigation reference |

## Adding shadcn/ui Components

```bash
npx shadcn@latest add <component>
```

Components are installed into `src/components/ui/`.
