import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-lg border border-stroke bg-card px-3 py-2.5 text-[13px] transition-colors duration-150 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive/20 aria-invalid:ring-offset-2 aria-invalid:ring-offset-background md:text-[13px] dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
