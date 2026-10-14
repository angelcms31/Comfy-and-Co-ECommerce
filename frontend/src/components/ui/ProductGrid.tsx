import type { ReactNode } from 'react';
import type { ProductWithVariants } from '@/types/models';
import ProductCard, { ProductCardSkeleton } from './ProductCard';
import { EmptyState, ErrorState } from './States';

interface ProductGridProps {
  products: ProductWithVariants[] | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  skeletons?: number;
  empty?: ReactNode;
}

const grid = 'grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3';

export default function ProductGrid({ products, loading, error, onRetry, skeletons = 6, empty }: ProductGridProps) {
  if (loading) {
    return (
      <div className={grid} aria-busy="true">
        {Array.from({ length: skeletons }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!products?.length) return <>{empty ?? <EmptyState title="No products found" />}</>;

  return (
    <div className={grid}>
      {products.map((p, i) => (
        <ProductCard key={p.product_id} product={p} index={i} />
      ))}
    </div>
  );
}
