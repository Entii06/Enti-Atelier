import { useRef } from 'react';
import { X } from 'lucide-react';

const DONATE_IMAGE = '/assets/donate/buy-me-a-coffee.png';

export function DonateWidget() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label="Ủng hộ ENTI Atelier — mở mã QR"
        aria-haspopup="dialog"
        title="Ủng hộ ENTI Atelier"
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 w-20 sm:w-28 overflow-hidden rounded-2xl shadow-xl shadow-black/30 transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] cursor-pointer"
      >
        <img
          src={DONATE_IMAGE}
          alt="Buy me a coffee — ủng hộ ENTI Atelier"
          width={1254}
          height={1254}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="donate-dialog-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
        className="m-auto max-h-[90dvh] w-[min(90vw,30rem)] overflow-y-auto rounded-3xl border border-white/15 bg-[var(--bg-surface)] p-0 text-[var(--text-primary)] shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm"
      >
        <div className="relative">
          <h2 id="donate-dialog-title" className="sr-only">Ủng hộ ENTI Atelier</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Đóng mã QR ủng hộ"
            title="Đóng"
            className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white shadow-lg transition-colors hover:bg-black/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <img
            src={DONATE_IMAGE}
            alt="Mã QR chuyển khoản ủng hộ ENTI Atelier"
            width={1254}
            height={1254}
            decoding="async"
            className="block h-auto w-full"
          />
          <p className="px-5 py-4 text-center text-sm">
            Cảm ơn bạn đã đồng hành và ủng hộ ENTI Atelier!
          </p>
        </div>
      </dialog>
    </>
  );
}
