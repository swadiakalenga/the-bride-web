import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
};

export default function Button({
  children,
  type = "button",
  disabled = false,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-3 text-base",
  };

  const styles = {
    primary: "bg-amber-400 text-white hover:bg-amber-500 shadow-sm font-semibold",
    secondary: "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 font-semibold",
    danger: "bg-red-500 text-white hover:bg-red-600 font-semibold",
    ghost: "text-gray-600 hover:bg-gray-100 font-semibold",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex min-h-9 items-center justify-center rounded-full transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
