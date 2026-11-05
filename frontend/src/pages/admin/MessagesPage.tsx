import { Reply } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { formatDateTime } from '@/lib/dates';
import { contactService } from '@/services/contactService';
import AdminPageHeader from './AdminPageHeader';

// everything sent through Contact Us, newest first
export default function MessagesPage() {
  const { data, loading, error, reload } = useAsync(() => contactService.getAll(), []);

  return (
    <div>
      <AdminPageHeader title="Messages" subtitle="What customers sent through the Contact Us form." />
      {loading ? (
        <LoadingState label="Loading messages..." layout="list" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState title="No messages yet" message="Messages from the Contact Us form will show up here." />
      ) : (
        <ul className="space-y-3">
          {data.map((m) => (
            <li key={m.message_id} className="rounded-card border border-line bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{m.subject}</p>
                  <p className="break-all text-sm text-muted">
                    {m.name} · {m.email}
                  </p>
                </div>
                <span className="text-xs text-muted">{formatDateTime(m.created_at)}</span>
              </div>
              <p className="mt-3 whitespace-pre-line break-words text-sm text-ink">{m.message}</p>
              <div className="mt-3 flex justify-end">
                <a
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(m.email)}&su=${encodeURIComponent(`Re: [Comfy&Co] ${m.subject}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline"
                >
                  <Reply className="size-4" /> Reply
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
