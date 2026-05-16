import Image from "next/image";

type BikeCityLogoProps = {
  className?: string;
  imageClassName?: string;
  showText?: boolean;
  textClassName?: string;
  priority?: boolean;
};

export function BikeCityLogo({
  className = "",
  imageClassName = "h-12 w-36",
  showText = false,
  textClassName = "",
  priority = false,
}: BikeCityLogoProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <span className={`relative block overflow-hidden rounded-lg bg-[var(--brand-navy)] ${imageClassName}`}>
        <Image
          src="/bike-city-logo.jpg"
          alt="Bike City Biking Store logo"
          fill
          sizes="180px"
          priority={priority}
          className="object-contain"
        />
      </span>
      {showText && (
        <span className={`leading-tight ${textClassName}`}>
          <span className="block text-sm font-black text-slate-950">BIKE CITY</span>
          <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
            Biking Store
          </span>
        </span>
      )}
    </div>
  );
}
