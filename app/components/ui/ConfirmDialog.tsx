"use client";

// ConfirmDialog — replaces window.confirm() for destructive actions.
// Works in browser, Android WebView, and iOS WKWebView (where window.confirm is broken).

export interface ConfirmDialogOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

interface Props extends ConfirmDialogOptions {
  open: boolean;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 px-4 pb-8 sm:items-center sm:pb-0"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <p className="font-bold text-gray-900 text-base">{title}</p>
        )}
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 active:bg-gray-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition active:scale-95 ${
              destructive
                ? "bg-red-500 hover:bg-red-600 active:bg-red-700"
                : "bg-amber-400 hover:bg-amber-500 active:bg-amber-600"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
