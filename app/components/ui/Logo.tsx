type LogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

export default function Logo({ size = "md", className = "" }: LogoProps) {
  const sizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
  };

  return (
    <span className={`font-extrabold tracking-tight ${sizes[size]} ${className}`}>
      <span className="text-amber-400">The</span>
      <span className="text-blue-500">Bride</span>
    </span>
  );
}
