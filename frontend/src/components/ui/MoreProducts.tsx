import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import ProductGrid from '@/components/ui/ProductGrid';
import { useAsync } from '@/hooks/useAsync';
import { productService } from '@/services/productService';

interface MoreProductsProps {
  title: string;
  categoryId?: number; // same category first ("more like this"), otherwise newest products
  excludeIds?: number[]; // products already on the page
}

const STEP = 6; // products shown at first, and added by each "see more"

// "you may also like" / "more like this" grid under the cart and product pages
export default function MoreProducts({ title, categoryId, excludeIds = [] }: MoreProductsProps) {
  const { data, loading, error, reload } = useAsync(() => productService.getAll({ categoryId, sort: 'newest' }), [categoryId]);
  const [visible, setVisible] = useState(STEP);
  useEffect(() => setVisible(STEP), [categoryId]);
  const others = data?.filter((p) => !excludeIds.includes(p.product_id)) ?? null;
  const products = others?.slice(0, visible) ?? null;

  if (data && products?.length === 0) return null;

  return (
    <section className="mt-14">
      <h2 className="mb-5 text-3xl font-semibold text-forest">{title}</h2>
      <ProductGrid products={products} loading={loading} error={error} onRetry={reload} />
      {others && others.length > visible && (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" className="min-w-40" onClick={() => setVisible((v) => v + STEP)}>
            see more
          </Button>
        </div>
      )}
    </section>
  );
}
