import '@tanstack/react-query'

// Declares the only query `meta` flags the app understands, so a typo such as
// `showErrorDialg` (the failure mode behind #171) fails typecheck instead of
// silently disabling the global error surface.
declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      showErrorDialog?: boolean
    }
  }
}
