# Web (`packages/web`)

React + Vite dashboard and developer console. Primitives are shadcn/Radix in `src/components/ui/`; the theme is Tailwind v4 CSS variables in `src/styles/globals.css` (there is no `tailwind.config.*`).

## Design system

The reviewer-checkable design-system contract is `docs/handbook/product/interface-design.mdx` — tokens (public theme API vs internal base values), measured type scale and spacing rhythm, all 18 primitives with variants, and the state contract a page must satisfy in review. `DESIGN_SYSTEM.md` next to this file holds package-local working notes. New pages compose the documented primitives instead of adding one-offs.

## Commands (run from this directory)

- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — eslint over `src`
- `npm run test` — `vitest run`
