// The 4 prerendered marketing routes (scripts/prerender.mjs) each wrap their
// page in a top-level `motion.div` with a fade-in `initial` animation. That's
// fine for an in-app client-side navigation, but on a cold load, hydrateRoot()
// reconciles against static HTML captured *after* the animation had already
// settled — so the client's `initial={{opacity:0}}` first paint never matches
// what's on the page, and React tears down and regenerates the whole subtree.
//
// skipEntranceAnimation is true only for the very first render after the app
// boots (whether that's a cold load of a prerendered page or the plain SPA
// shell) and false for every render after that, so a real client-side
// navigation to one of these routes still gets its entrance animation.
export let skipEntranceAnimation = true

export function markInitialLoadDone() {
  skipEntranceAnimation = false
}
