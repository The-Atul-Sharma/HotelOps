import { useEffect, useMemo, useState } from 'react';
import { PAGE_SIZE, paginate } from '@/components/shared/Pagination';

export function usePagination<T>(items: T[], resetKey: string | number, pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => paginate(items, safePage, pageSize),
    [items, safePage, pageSize],
  );

  return {
    page: safePage,
    setPage,
    pageSize,
    pageItems,
    total: items.length,
    totalPages,
  };
}
