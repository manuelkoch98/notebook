import DialogFrame from './DialogFrame.jsx';

export default function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Bestätigen', cancelLabel = 'Abbrechen', onConfirm, danger = false }) {
  return <DialogFrame open={open} onOpenChange={onOpenChange} title={title} description={description}>
    <div className="confirm-dialog-actions">
      <button type="button" className="button button-outline" onClick={() => onOpenChange(false)}>{cancelLabel}</button>
      <button type="button" className={`button ${danger ? 'button-danger' : 'button-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
    </div>
  </DialogFrame>;
}
