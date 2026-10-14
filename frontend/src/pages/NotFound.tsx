import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <p className="font-display text-7xl font-semibold text-mint">404</p>
      <h1 className="mt-2 text-3xl font-semibold text-forest">This corner is empty</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">The page you're looking for doesn't exist or was moved.</p>
      <ButtonLink to="/" className="mt-6">
        Back to home
      </ButtonLink>
    </div>
  );
}
