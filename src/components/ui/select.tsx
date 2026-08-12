import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A native `<select>` wearing the same shell as `Input`.
 *
 * Filter bars mix the two side by side, and a select that sizes itself
 * differently from the search box next to it reads as a misalignment rather
 * than as a control. Native rather than a popup component on purpose: these
 * are short, flat option lists, and the platform picker is what a phone or a
 * keyboard user already knows how to drive.
 */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-8 min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-base transition-[color,box-shadow] duration-200 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Select }
