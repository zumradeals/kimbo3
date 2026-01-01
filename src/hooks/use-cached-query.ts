import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

interface UseCachedQueryOptions<T> {
  queryKey: string[];
  queryFn: () => Promise<T>;
  staleTime?: number;
  cacheTime?: number;
  refetchOnWindowFocus?: boolean;
}

/**
 * Hook optimisé pour les requêtes avec cache et stale-while-revalidate
 * - staleTime: 5 minutes par défaut (données considérées fraîches)
 * - cacheTime: 30 minutes par défaut (durée en cache)
 * - refetchOnWindowFocus: désactivé par défaut
 */
export function useCachedQuery<T>({
  queryKey,
  queryFn,
  staleTime = 5 * 60 * 1000, // 5 minutes
  cacheTime = 30 * 60 * 1000, // 30 minutes
  refetchOnWindowFocus = false,
}: UseCachedQueryOptions<T>) {
  const queryClient = useQueryClient();

  const result = useQuery({
    queryKey,
    queryFn,
    staleTime,
    gcTime: cacheTime,
    refetchOnWindowFocus,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const prefetch = useCallback(async () => {
    await queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime,
    });
  }, [queryClient, queryKey, queryFn, staleTime]);

  return {
    ...result,
    invalidate,
    prefetch,
  };
}

/**
 * Hook pour les listes paginées avec cache
 */
interface UsePaginatedQueryOptions<T> {
  queryKey: string[];
  queryFn: (params: { page: number; pageSize: number }) => Promise<{ data: T[]; count: number }>;
  page: number;
  pageSize: number;
  staleTime?: number;
}

export function usePaginatedQuery<T>({
  queryKey,
  queryFn,
  page,
  pageSize,
  staleTime = 5 * 60 * 1000,
}: UsePaginatedQueryOptions<T>) {
  const queryClient = useQueryClient();

  const result = useQuery({
    queryKey: [...queryKey, page, pageSize],
    queryFn: () => queryFn({ page, pageSize }),
    staleTime,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });

  // Prefetch next page
  const prefetchNextPage = useCallback(async () => {
    await queryClient.prefetchQuery({
      queryKey: [...queryKey, page + 1, pageSize],
      queryFn: () => queryFn({ page: page + 1, pageSize }),
      staleTime,
    });
  }, [queryClient, queryKey, page, pageSize, queryFn, staleTime]);

  return {
    ...result,
    prefetchNextPage,
    totalPages: result.data ? Math.ceil(result.data.count / pageSize) : 0,
    totalCount: result.data?.count ?? 0,
  };
}
