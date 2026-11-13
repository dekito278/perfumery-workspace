import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme}
      // At the top, not the bottom: on a phone the bottom is where the checkout's and the cart's sticky
      // bar sits, and a toast there lay over "Buat Pesanan" and took its taps for four seconds (fifth
      // visitor audit, 13 Nov 2026).
      position="top-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          // min-height beats sonner's own 24px height: "Lihat keranjang" after adding a bottle was a
          // 71x24 target, on the one toast a buyer is most likely to tap (2026-11-02).
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:min-h-[44px] group-[.toast]:px-4",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:min-h-[44px] group-[.toast]:px-4",
        },
      }}
      {...props} />
  );
}

export { Toaster }
