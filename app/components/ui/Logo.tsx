import Image from "next/image";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

export default function Logo({ size = "md", className = "" }: LogoProps) {
  const imgPx = { sm: 28, md: 36, lg: 80 };
  const textCls = { sm: "text-base", md: "text-xl", lg: "text-4xl" };
  const px = imgPx[size];

  if (size === "lg") {
    return (
      <span className={`flex flex-col items-center gap-3 ${className}`}>
        <Image
          src="/post-logo.jpeg"
          alt="TheBride"
          width={px}
          height={px}
          priority
          className="rounded-2xl shadow-lg"
        />
        <span className={`font-extrabold tracking-tight text-gray-900 ${textCls[size]}`}>
          The<span className="text-brand-600">Bride</span>
        </span>
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/post-logo.jpeg"
        alt="TheBride"
        width={px}
        height={px}
        priority
        className="rounded-lg"
      />
      <span className={`font-extrabold tracking-tight text-gray-900 ${textCls[size]}`}>
        The<span className="text-brand-600">Bride</span>
      </span>
    </span>
  );
}
