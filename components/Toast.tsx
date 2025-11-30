"use client";

import { useEffect } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = "info", duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
  };

  const styles = {
    success: "bg-gradient-to-r from-green-500 to-emerald-600 text-white",
    error: "bg-gradient-to-r from-red-500 to-pink-600 text-white",
    warning: "bg-gradient-to-r from-yellow-500 to-orange-500 text-white",
    info: "bg-gradient-to-r from-purple-500 to-blue-600 text-white",
  };

  return (
    <div
      className={`${styles[type]} rounded-xl shadow-2xl p-4 flex items-center gap-3 min-w-[320px] max-w-md animate-slide-up backdrop-blur-sm`}
    >
      {icons[type]}
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={onClose}
        className="p-1 hover:bg-white/20 rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Toast Container Hook
export function useToast() {
  const showToast = (message: string, type: ToastType = "info") => {
    // This would integrate with a toast context/provider
    // For now, just log
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  return { showToast };
}
