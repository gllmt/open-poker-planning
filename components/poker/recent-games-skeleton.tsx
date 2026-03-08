import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function RecentGamesSkeleton() {
  return (
    <Card className="w-full glass-card dark:dark-glass-card">
      <CardHeader className="text-center">
        <CardTitle>
          <Skeleton className="h-5 w-40 mx-auto" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-3/4 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}
