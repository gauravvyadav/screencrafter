import { Camera, Layers } from 'lucide-react';

interface CaptureTypeBadgeProps {
  type?: string;
  isDark: boolean;
}

export function CaptureTypeBadge({ type, isDark }: CaptureTypeBadgeProps) {
  const isFull = type?.includes('full');
  const label = isFull ? 'Full Page' : 'Visible';

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
      isFull
        ? (isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600')
        : (isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600')
    }`}>
      {isFull ? <Layers size={9} /> : <Camera size={9} />}
      {label}
    </span>
  );
}
