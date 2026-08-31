export function Toast({ message, kind }: { message: string; kind: 'success' | 'error' }) {
  return (
    <div className={`toast toast-${kind}`} role="status">
      {message}
    </div>
  );
}
