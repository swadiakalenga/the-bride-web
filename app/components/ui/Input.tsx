import type { InputHTMLAttributes } from "react";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

export default function Input({
  value,
  onChange,
  placeholder = "",
  type = "text",
  className = "",
  ...props
}: InputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-amber-300 focus:bg-white focus:ring-2 focus:ring-amber-100 ${className}`}
      {...props}
    />
  );
}
