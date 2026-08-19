"use client";

import * as React from "react";

// Dependency-free scroll-reveal primitive ("polished but static" v1
// interactivity - no framer-motion). Fires once, then disconnects - a
// section that's already been seen doesn't re-animate on scroll-back-up.
// prefers-reduced-motion is checked in the state initializer (not inside
// the effect) so there's nothing to synchronously setState() over once
// mounted - the effect only ever runs the IntersectionObserver path.
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useInView<T extends HTMLElement>(): [React.RefObject<T>, boolean] {
  // Single-type-param useRef<T>(null), not useRef<T | null>(null) - with
  // @types/react 18.3.x's stricter ref typing, only this form resolves to
  // RefObject<T> (directly assignable to JSX's `ref` prop); the `T | null`
  // form resolves to MutableRefObject<T | null>, which TS then rejects as
  // not assignable to a plain element ref.
  const ref = React.useRef<T>(null);
  const [inView, setInView] = React.useState(prefersReducedMotion);

  React.useEffect(() => {
    if (inView) return; // already true (reduced motion, or a re-mount) - nothing to observe.
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView]);

  return [ref, inView];
}
