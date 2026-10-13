import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

// The label is a prop with a Studio default, not a fixed string: the storefront renders this spinner too
// and the shop has two languages. A buyer-facing caller either translates it or hides it -- next to a
// translated "loading" line the spinner is decoration, and a second status region just says it again in
// the wrong language. buyerTextComesFromTheMessageFile.selfcheck.mjs holds callers to that.
function Spinner({
  className,
  'aria-label': ariaLabel = 'Loading',
  ...props
}) {
  return (
    <Loader2Icon
      role="status"
      aria-label={ariaLabel}
      className={cn("size-4 animate-spin", className)}
      {...props} />
  );
}

export { Spinner }
