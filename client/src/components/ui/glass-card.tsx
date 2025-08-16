import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  gradient?: boolean;
}

export function GlassCard({ children, className, gradient = false }: GlassCardProps) {
  if (gradient) {
    return (
      <div className={cn("gradient-border", className)}>
        <div className="gradient-border-content p-4">
          {children}
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("glass-morphism border-white/20", className)}>
      <CardContent className="p-4">
        {children}
      </CardContent>
    </Card>
  );
}
