import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, Clock, Download, Info, Smartphone } from 'lucide-react';
import Button, { ButtonLink } from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAsync } from '@/hooks/useAsync';
import { GCASH_ACCOUNT_NAME, GCASH_QR_IMAGE } from '@/lib/constants';
import { formatPeso } from '@/lib/pricing';
import { canPayGcash } from '@/lib/tracking';
import { orderService } from '@/services/orderService';
import NotFound from '../NotFound';

const REFERENCE_LENGTH = 13;

// The customer pays by scanning the store's GCash QR, then sends the reference number here. The site can't see GCash,
// so an admin checks the reference in the GCash app before the order counts as paid.
export default function GcashPaymentPage() {
  const orderId = Number(useParams().orderId);
  const toast = useToast();
  const { data: order, loading, error, reload, setData } = useAsync(() => orderService.getById(orderId), [orderId]);
  const [reference, setReference] = useState('');
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [qrMissing, setQrMissing] = useState(false);

  if (!Number.isInteger(orderId)) return <NotFound />;
  if (loading && !order) return <div className="container-page max-w-lg py-8"><LoadingState label="Loading your order..." layout="detail" /></div>;
  if (error) return error.toLowerCase().includes('not found') ? <NotFound /> : <ErrorState message={error} onRetry={reload} />;
  if (!order || order.payment_method !== 'GCash') return <NotFound />;

  const orderLink = `/orders/${order.order_id}`;
  const status = order._temp_payment_status;
  const paid = status === 'Paid';
  const verifying = status === 'For verification';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (reference.length !== REFERENCE_LENGTH) {
      setReferenceError(`The reference number has ${REFERENCE_LENGTH} digits`);
      return;
    }
    setReferenceError(null);
    setSending(true);
    try {
      setData(await orderService.confirmGcash(order.order_id, reference));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send your reference number');
    } finally {
      setSending(false);
    }
  };

  const summary = (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Pay to</dt>
        <dd className="text-right font-medium">{GCASH_ACCOUNT_NAME}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Order</dt>
        <dd className="font-medium">{order.order_num}</dd>
      </div>
      {(paid || verifying) && (
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Reference no.</dt>
          <dd className="font-medium tabular-nums">{order._temp_payment_ref}</dd>
        </div>
      )}
      <div className="flex justify-between gap-4 border-t border-line pt-3 text-lg font-semibold text-forest">
        <dt className="font-display">{paid ? 'Amount paid' : verifying ? 'Amount' : 'Amount to pay'}</dt>
        <dd>{formatPeso(order.total_amt)}</dd>
      </div>
    </dl>
  );

  const leaveButtons = (
    <div className="mt-6 space-y-3">
      <ButtonLink to={orderLink} size="lg" className="w-full">
        View my order
      </ButtonLink>
      <ButtonLink to="/products" variant="outline" size="lg" className="w-full">
        Continue shopping
      </ButtonLink>
    </div>
  );

  let content;
  if (paid || verifying) {
    const Icon = paid ? CheckCircle2 : Clock;
    content = (
      <>
        <div role="status" className="text-center">
          <Icon className="mx-auto size-14 text-forest" />
          <h1 className="mt-3 text-3xl font-semibold text-forest">{paid ? 'Payment confirmed' : "We're checking your payment"}</h1>
          <p className="mt-1 text-sm text-muted">
            {paid ? "We're getting your order ready to ship." : "We got your reference number. We'll prepare your order once the payment is confirmed."}
          </p>
        </div>
        <div className="mt-5">{summary}</div>
        {leaveButtons}
      </>
    );
  } else if (!canPayGcash(order)) {
    content = (
      <>
        <h1 className="text-3xl font-semibold text-forest">Pay with GCash</h1>
        <p className="mt-3 text-sm text-muted">This order is {order.order_stat.toLowerCase()}, so it can't be paid anymore.</p>
        {leaveButtons}
      </>
    );
  } else {
    content = (
      <>
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-mint text-forest">
            <Smartphone className="size-6" />
          </span>
          <h1 className="text-3xl font-semibold text-forest">Pay with GCash</h1>
        </div>

        {status === 'Rejected' && (
          <p role="alert" className="mt-5 flex gap-2 rounded-xl bg-cancelled p-3 text-sm text-cancelled-text">
            <Info className="mt-0.5 size-4 shrink-0" />
            We couldn't confirm reference no. {order._temp_payment_ref}. Please check it and send it again.
          </p>
        )}

        <div className="mt-5">{summary}</div>

        {qrMissing ? (
          <p role="alert" className="mt-5 rounded-xl bg-butter/50 p-4 text-center text-sm text-ink">
            Our GCash QR code isn't available right now. Please don't send any payment yet, and{' '}
            <Link to={`/contact?order=${order.order_num}`} className="font-medium text-forest underline">
              contact us
            </Link>{' '}
            for help.
          </p>
        ) : (
          <>
            <div className="mt-5 text-center">
              <img
                src={GCASH_QR_IMAGE}
                alt={`GCash QR code for ${GCASH_ACCOUNT_NAME}`}
                onError={() => setQrMissing(true)}
                className="mx-auto size-64 rounded-xl border border-line object-contain"
              />
              <a href={GCASH_QR_IMAGE} download="comfyco-gcash-qr" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
                <Download className="size-4" /> Save QR code
              </a>
            </div>

            <ol className="mt-5 list-decimal space-y-1 pl-5 text-sm text-ink">
              <li>Open your GCash app and scan this QR, or upload the saved photo.</li>
              <li>
                Pay exactly <span className="font-semibold">{formatPeso(order.total_amt)}</span>.
              </li>
              <li>Type the reference number from your GCash receipt below.</li>
            </ol>

            <form onSubmit={submit} noValidate className="mt-5 space-y-3">
              <Input
                label="GCash reference number"
                inputMode="numeric"
                autoComplete="off"
                placeholder={`${REFERENCE_LENGTH} digits`}
                value={reference}
                onChange={(e) => setReference(e.target.value.replace(/\D/g, '').slice(0, REFERENCE_LENGTH))}
                error={referenceError}
              />
              <Button type="submit" size="lg" className="w-full" loading={sending}>
                I've paid
              </Button>
            </form>
          </>
        )}

        <ButtonLink to={orderLink} variant="outline" size="lg" className="mt-3 w-full">
          Pay later
        </ButtonLink>
        <p className="mt-4 text-center text-xs text-muted">We will never ask for your GCash MPIN or OTP.</p>
      </>
    );
  }

  return (
    <div className="container-page max-w-lg py-8 sm:py-12">
      {!paid && !verifying && (
        <Link to={orderLink} className="inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
          <ChevronLeft className="size-4" /> Back to order
        </Link>
      )}
      <section className="mt-3 rounded-card bg-white p-6 shadow-card sm:p-8">{content}</section>
    </div>
  );
}
