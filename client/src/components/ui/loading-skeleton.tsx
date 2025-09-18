import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md overflow-hidden relative",
        // Shimmering gradient background
        "bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_25%,rgba(255,255,255,0.14)_37%,rgba(255,255,255,0.04)_63%)]",
        "bg-[length:400px_100%] animate-shimmer",
        className
      )}
      {...props}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header Skeleton */}
      <div className="glass-morphism sticky top-0 z-40 p-3 sm:p-4 border-b border-white/10">
        <div className="flex flex-col space-y-3 md:space-y-0 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center space-x-3">
              <div className="glass-morphism rounded-xl p-3 w-32 h-24">
                <div className="flex justify-between items-center mb-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </div>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="glass-morphism border-b border-white/10 px-2 md:px-4">
        <div className="flex space-x-2 py-1 overflow-x-auto">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-md mx-1" />
          ))}
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="p-4 space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-morphism rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>

        {/* Recent Activity Skeleton */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass-morphism rounded-xl p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
          
          <div className="glass-morphism rounded-xl p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center">
                  <Skeleton className="h-4 w-4 mr-2" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
