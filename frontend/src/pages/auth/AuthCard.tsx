import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { LogoMark } from '@/components/layout/Logo';

// white card on the butter checker pattern, used by the customer login / sign up / reset pages
// wide puts the form in two columns on bigger screens so long forms fit without scrolling
export default function AuthCard({
  title,
  subtitle,
  notice,
  wide,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  notice?: string | null;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`checker-butter flex justify-center px-4 ${wide ? 'py-8 sm:py-10' : 'py-12 sm:py-16'}`}>
      <div className={`w-full rounded-2xl bg-white p-7 shadow-card sm:p-9 ${wide ? 'max-w-3xl' : 'max-w-md'}`}>
        <LogoMark className="mx-auto size-12" />
        <h1 className="mt-3 text-center text-3xl font-semibold text-forest">{title}</h1>
        {subtitle && <p className="mt-1 text-center text-sm text-muted">{subtitle}</p>}
        {notice && (
          <p role="status" className="mt-5 flex items-start gap-2 rounded-xl bg-mint-light px-3.5 py-2.5 text-sm text-forest">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            {notice}
          </p>
        )}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
