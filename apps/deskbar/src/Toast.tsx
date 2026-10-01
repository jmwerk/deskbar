export type ToastKind = 'success' | 'error' | 'info';

export function Toast({ message, kind }: { message: string; kind: ToastKind }) {
  return (
    <div className={`toast toast-${kind}`} role="status">
      {message}
    </div>
  );
}
