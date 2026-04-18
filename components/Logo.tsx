interface LogoProps {
  subtitle?: string;
  isDark: boolean;
  size?: 'sm' | 'md';
}

export function Logo({ subtitle, isDark, size = 'md' }: LogoProps) {
  const imgSize = size === 'sm' ? 'w-6 h-6' : 'w-9 h-9';
  const titleClass = size === 'sm' ? 'text-sm' : 'text-base';

  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/screencrafter.png"
        alt="Screencrafter"
        className={`${imgSize} rounded object-contain`}
      />
      <div>
        <h1 className={`${titleClass} font-bold tracking-tight leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Screencrafter
        </h1>
        {subtitle && (
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
