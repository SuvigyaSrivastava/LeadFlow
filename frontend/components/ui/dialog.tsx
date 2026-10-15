"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;

const overlay =
  "fixed inset-0 z-40 bg-ink/45 backdrop-blur-[1px] data-[state=open]:animate-fade-in";

/** Keep the dialog open when the user clicks a toast rendered outside of it. */
export function ignoreToastInteraction(event: { target: EventTarget | null; preventDefault(): void }) {
  if ((event.target as HTMLElement | null)?.closest?.("[data-sonner-toaster]")) {
    event.preventDefault();
  }
}

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Centered, compact modal. Focus is trapped, Escape closes, focus returns to the opener. */
export function Modal({ open, onOpenChange, title, description, children, footer, className }: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlay} />
        <DialogPrimitive.Content
          onInteractOutside={ignoreToastInteraction}
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-surface shadow-overlay data-[state=open]:animate-pop-in",
            className,
          )}
        >
          <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-1">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold text-ink">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm text-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="-mt-1 -mr-2 grid size-8 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          </header>
          <div className="overflow-y-auto px-6 py-4">{children}</div>
          {footer ? (
            <footer className="flex justify-end gap-2 rounded-b-lg border-t border-line bg-canvas/60 px-6 py-3">
              {footer}
            </footer>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  onInteractOutside?: (event: Event) => void;
}

/** Right-hand detail panel on desktop, full screen on phones. Same dialog semantics. */
export function Sheet({ open, onOpenChange, children, onEscapeKeyDown, onInteractOutside }: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlay} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onEscapeKeyDown={onEscapeKeyDown}
          onInteractOutside={(event) => {
            ignoreToastInteraction(event);
            onInteractOutside?.(event);
          }}
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-surface shadow-overlay sm:max-w-[540px] sm:rounded-l-lg data-[state=open]:animate-slide-in"
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
