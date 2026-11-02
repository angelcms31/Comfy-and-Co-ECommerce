import { ButtonLink } from '@/components/ui/Button';
import ProductGrid from '@/components/ui/ProductGrid';
import { useAsync } from '@/hooks/useAsync';
import { productService } from '@/services/productService';

interface MoreProductsProps {
  title: string;
  categoryId?: number; // same category first ("more like this"), otherwise newest products
  excludeIds?: number[]; // products already on the page
}

// "you may also like" / "more like this" grid under the cart and product pages
export default function MoreProducts({ title, categoryId, excludeIds = [] }: MoreProductsProps) {
  const { data, loading, error, reload } = useAsync(() => productService.getAll({ categoryId, sort: 'newest' }), [categoryId]);
  const products = data?.filter((p) => !excludeIds.includes(p.product_id)).slice(0, 6) ?? null;

  if (data && products?.length === 0) return null;

  return (
    <section className="mt-14">
      <h2 className="mb-5 text-3xl font-semibold text-forest">{title}</h2>
      <ProductGrid products={products} loading={loading} error={error} onRetry={reload} />
      <div className="mt-8 flex justify-center">
        <ButtonLink to={categoryId ? `/products?category=${categoryId}` : '/products'} variant="outline" className="min-w-40">
          see more
        </ButtonLink>
      </div>
    </section>
  );
}
