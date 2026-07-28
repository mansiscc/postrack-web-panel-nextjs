import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-21.5 w-full rounded-md border border-border bg-card px-3 py-2.5 text-[13px] transition-colors duration-150 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-primary aria-invalid:ring-1 aria-invalid:ring-primary/25 md:text-[13px] dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-primary/50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
