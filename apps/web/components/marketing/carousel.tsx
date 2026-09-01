"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

// Native CSS scroll-snap, not a carousel library - the browser already
// does smooth scrolling, snap points, and touch/trackpad gestures for
// free; the buttons below just call scrollBy on top of that. Keeps this
// dependency-free like the rest of the marketing page's interactivity.
export function Carousel({
  children,
  className,
}: {
  children: React.ReactNode[];
  className?: string;
}) {
  const trackRef = React.useRef<HTMLDivElement>(null);

  function scrollByCard(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>("[data-carousel-item]");
    const step = card ? card.offsetWidth + 24 /* gap-6 */ : track.clientWidth * 0.8;
    track.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  return (
    <div className={cn("relative", className)}>
      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-4"
        style={{ scrollbarWidth: "none" }}
      >
        {children.map((child, i) => (
          <div key={i} data-carousel-item className="shrink-0 snap-start">
            {child}
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          className="hover-float flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground"
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          className="hover-float flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground"
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
