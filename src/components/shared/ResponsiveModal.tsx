import { createContext, useContext } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';

const ResponsiveModalContext = createContext(false);

export function ResponsiveModal({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  return (
    <ResponsiveModalContext.Provider value={isMobile}>
      {isMobile ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          {children}
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      )}
    </ResponsiveModalContext.Provider>
  );
}

export function ResponsiveModalContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogContent> & {
  showCloseButton?: boolean;
}) {
  const isMobile = useContext(ResponsiveModalContext);

  if (isMobile) {
    return (
      <SheetContent
        side="bottom"
        showCloseButton={showCloseButton}
        className={cn(
          'flex max-h-[92dvh] w-full flex-col gap-0 overflow-hidden rounded-t-xl p-0',
          className,
        )}
        {...props}
      >
        {children}
      </SheetContent>
    );
  }

  return (
    <DialogContent
      className={cn('gap-0 overflow-hidden p-0', className)}
      showCloseButton={showCloseButton}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

export function ResponsiveModalHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const isMobile = useContext(ResponsiveModalContext);
  const Comp = isMobile ? SheetHeader : DialogHeader;
  return (
    <Comp
      className={cn('shrink-0 space-y-1.5 px-6 py-4 text-left', className)}
      {...props}
    />
  );
}

export function ResponsiveModalFooter({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const isMobile = useContext(ResponsiveModalContext);
  const Comp = isMobile ? SheetFooter : DialogFooter;
  return (
    <Comp
      className={cn(
        'mt-0 shrink-0 flex-row justify-end gap-2 border-t px-6 py-4',
        className,
      )}
      {...props}
    />
  );
}

export function ResponsiveModalTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = useContext(ResponsiveModalContext);
  const Comp = isMobile ? SheetTitle : DialogTitle;
  return <Comp className={className} {...props} />;
}

export function ResponsiveModalDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const isMobile = useContext(ResponsiveModalContext);
  const Comp = isMobile ? SheetDescription : DialogDescription;
  return <Comp className={className} {...props} />;
}

export function ResponsiveModalBody({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4',
        className,
      )}
      {...props}
    />
  );
}
