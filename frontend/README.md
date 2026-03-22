# Frontend — React + Vite + shadcn/ui

## Folder Structure

```
src/
├── assets/        # Static assets (images, fonts, etc.)
├── components/
│   └── ui/        # shadcn/ui components
├── context/       # React context providers
├── hooks/         # Custom React hooks
├── lib/           # Utility libraries (e.g., cn() helper)
├── pages/         # Page-level components (routed views)
├── services/      # API service modules (axios calls)
├── styles/        # Global CSS and Tailwind config
└── utils/         # General utility functions
```

## Getting Started

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` by default.

## Build

```bash
npm run build
```

## Adding shadcn/ui Components

```bash
npx shadcn@latest add <component>
```

For example: `npx shadcn@latest add button`
