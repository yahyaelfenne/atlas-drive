import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib";
import type { ReactNode } from "react";
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content
          className={cn("dialog-content", wide && "dialog-wide")}
        >
          <div className="dialog-header">
            <div>
              <DialogPrimitive.Title className="dialog-title">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                className={description ? "dialog-description" : "sr-only"}
              >
                {description || title}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="close-button" aria-label="Fermer">
              <X size={21} />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
