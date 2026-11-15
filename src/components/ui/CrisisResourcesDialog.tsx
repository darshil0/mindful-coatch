import { useEffect, useRef } from 'react';
import { LifeBuoy, PhoneCall, X } from 'lucide-react';

interface CrisisResourcesDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CrisisResourcesDialog({ open, onClose }: CrisisResourcesDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 10);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crisis-resources-title"
        aria-describedby="crisis-resources-desc"
        className="w-full max-w-lg rounded-2xl border border-[#E6E4DD] bg-white p-6 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FDF2F2] text-[#9B2C2C]"
            >
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="crisis-resources-title"
                className="font-display text-xl font-medium text-[#1E2421]"
              >
                Immediate crisis &amp; urgent medical support
              </h2>
              <p
                id="crisis-resources-desc"
                className="mt-1 text-xs leading-relaxed text-[#5C6762]"
              >
                Mindful Coach is an educational wellness tool and cannot assess or respond
                to emergencies. If you or someone nearby may be in immediate danger,
                please connect directly with human support.
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close crisis resources"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] text-[#4A5550] hover:bg-[#F2F0EA]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <ul className="mt-5 space-y-3 text-sm text-[#1E2421]">
          <li className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-3.5">
            <p className="flex items-center gap-2 font-medium text-[#1E2421]">
              <PhoneCall className="h-4 w-4 text-[#9B2C2C]" aria-hidden="true" />
              <span>Local emergency medical or safety services</span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#4A5550]">
              Call <strong className="font-mono text-[#1E2421]">911</strong> (US/Canada),{' '}
              <strong className="font-mono text-[#1E2421]">999</strong> (UK),{' '}
              <strong className="font-mono text-[#1E2421]">112</strong> (EU/mobile
              worldwide), or <strong className="font-mono text-[#1E2421]">000</strong>{' '}
              (Australia), or go to the nearest hospital emergency department for chest
              pain, difficulty breathing, seizures, choking, fainting, or self-harm risk.
            </p>
          </li>

          <li className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-3.5">
            <p className="font-medium text-[#1E2421]">
              Confidential mental health &amp; crisis helplines
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#4A5550]">
              US &amp; Canada: Call or text{' '}
              <strong className="font-mono text-[#1E2421]">988</strong> (24/7 Suicide
              &amp; Crisis Lifeline) · UK: Call{' '}
              <strong className="font-mono text-[#1E2421]">111</strong> or{' '}
              <strong className="font-mono text-[#1E2421]">116 123</strong> (Samaritans) ·
              International directory:{' '}
              <a
                href="https://findahelpline.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#2F5D50] underline underline-offset-4 hover:text-[#1F4238]"
              >
                findahelpline.com
              </a>
              .
            </p>
          </li>
        </ul>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl bg-[#2F5D50] px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#254B40]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
