'use client';
import { useRef, type ComponentPropsWithRef } from 'react';

// Share backdrop behavior across native dialogs without treating their padding,
// child controls, or a drag that began inside as an outside click.
export default function DismissibleDialog({
  onPointerDown,
  onClick,
  ...props
}: ComponentPropsWithRef<'dialog'>) {
  const startedOutside = useRef(false);
  function outside(dialog: HTMLDialogElement, x: number, y: number) {
    const rect = dialog.getBoundingClientRect();
    return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
  }
  return <dialog {...props}
    onPointerDown={(event) => {
      startedOutside.current = event.target === event.currentTarget &&
        outside(event.currentTarget, event.clientX, event.clientY);
      onPointerDown?.(event);
    }}
    onClick={(event) => {
      onClick?.(event);
      const dismiss = startedOutside.current && event.target === event.currentTarget &&
        outside(event.currentTarget, event.clientX, event.clientY);
      startedOutside.current = false;
      if (!dismiss || event.defaultPrevented) return;
      const dialog = event.currentTarget;
      // requestClose honors existing onCancel guards and triggers onClose cleanup.
      if (typeof dialog.requestClose === 'function') dialog.requestClose();
      else if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
    }}
  />;
}
