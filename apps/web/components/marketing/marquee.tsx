import { cn } from "@/lib/cn";

// Pure-CSS infinite scroller (globals.css's marquee-scroll keyframe) - the
// content is rendered twice back-to-back and the track animates exactly
// -50%, so the loop seam is invisible regardless of how wide `items` ends
// up being. No JS, no measurement, no animation library.
export function Marquee({
  items,
  durationSeconds = 28,
  className,
}: {
  items: React.ReactNode[];
  durationSeconds?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("group relative overflow-hidden", className)}
      style={{
        maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div
        className="marquee-track flex w-max items-center"
        style={{ "--marquee-duration": `${durationSeconds}s` } as React.CSSProperties}
      >
        {[items, items].map((copy, copyIndex) => (
          <div key={copyIndex} className="flex items-center" aria-hidden={copyIndex === 1}>
            {copy.map((item, i) => (
              <div key={i} className="flex items-center">
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
