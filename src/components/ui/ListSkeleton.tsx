import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ListSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  showFilters?: boolean;
}

export function ListSkeleton({ 
  rows = 8, 
  columns = 6, 
  showHeader = true,
  showFilters = true 
}: ListSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      {showHeader && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
      )}

      {/* Filters skeleton */}
      {showFilters && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-full sm:w-48" />
          </CardContent>
        </Card>
      )}

      {/* Table skeleton */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {/* Table header */}
            <div className="flex gap-4 px-6 py-4 border-b bg-muted/30">
              {Array.from({ length: columns }).map((_, i) => (
                <Skeleton 
                  key={i} 
                  className="h-4" 
                  style={{ width: `${Math.random() * 60 + 60}px` }} 
                />
              ))}
            </div>
            
            {/* Table rows */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <div 
                key={rowIndex} 
                className="flex gap-4 px-6 py-4 border-b last:border-b-0 items-center"
              >
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <Skeleton 
                    key={colIndex} 
                    className="h-4" 
                    style={{ 
                      width: colIndex === 0 ? '120px' : `${Math.random() * 80 + 40}px`,
                      opacity: 1 - (rowIndex * 0.08)
                    }} 
                  />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-3/4 mb-1" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div>
          <Skeleton className="h-7 w-64 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-6 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
