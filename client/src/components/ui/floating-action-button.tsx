import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function FloatingActionButton({ 
  onClick, 
  className,
  children 
}: FloatingActionButtonProps) {
  return (
    <Button
      onClick={onClick}
      className={cn(
        "fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full shadow-thrst-lg",
        "thrst-gradient hover:scale-110 transition-all duration-300",
        "animate-pulse-glow border-0",
        className
      )}
      data-testid="floating-action-button"
    >
      {children || <Plus className="h-6 w-6 text-white" />}
    </Button>
  );
}
