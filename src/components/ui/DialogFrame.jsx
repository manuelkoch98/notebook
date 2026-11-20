import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export default function DialogFrame({ open, onOpenChange, title, description, children }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content">
    <div className="dialog-titlebar"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description></div><Dialog.Close asChild><button className="icon-button" aria-label="Schließen"><X size={16}/></button></Dialog.Close></div>{children}
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
