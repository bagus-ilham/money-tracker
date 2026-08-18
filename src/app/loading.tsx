import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-3">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <p className="text-xs font-medium text-text-muted animate-pulse">Memuat data...</p>
    </div>
  );
}
