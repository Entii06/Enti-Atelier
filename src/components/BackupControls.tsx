import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import type { ReviewLogRecord, VocabCard } from '../types';
import { CARDS_KEY, createBackup, parseBackup, restoreBackup } from '../utils/backup';
import type { WorkspaceBackup } from '../utils/backup';

export function BackupControls({ cards, reviews }: { cards: VocabCard[]; reviews: ReviewLogRecord[] }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<WorkspaceBackup | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [restored, setRestored] = useState(false);
  const fail = (error: unknown) => setMessage(error instanceof Error ? error.message : 'Không thể xử lý bản sao lưu.');
  const download = async () => {
    setBusy(true);
    setMessage('');
    try {
      const backup = await createBackup(cards, reviews);
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      if (blob.size > 100 * 1024 * 1024) throw new Error('Bản sao lưu vượt 100 MB. Hãy giảm số ảnh tải lên rồi xuất lại.');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `enti-atelier-backup-${backup.createdAt.slice(0, 10)}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Đã xuất bản sao lưu. Hãy giữ tệp ở nơi an toàn.');
    } catch (error) { fail(error); }
    finally { setBusy(false); }
  };
  const read = async (file?: File) => {
    if (!file) return;
    setPending(null);
    setMessage('');
    setBusy(true);
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('Tệp quá lớn (tối đa 100 MB).');
      setPending(parseBackup(JSON.parse(await file.text())));
    } catch (error) { fail(error); }
    finally { setBusy(false); }
  };
  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await restoreBackup(pending, cards);
      setPending(null);
      setRestored(true);
      setMessage('Đã khôi phục. Tải lại trang để cập nhật đầy đủ ảnh và các cài đặt.');
    } catch (error) {
      fail(error);
      setMessage('Khôi phục chưa hoàn tất. Dữ liệu hiện có được giữ lại; bạn có thể thử nhập lại tệp.');
    } finally { setBusy(false); }
  };
  return (
    <section aria-label="Sao lưu dữ liệu" className="mb-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-[var(--text-primary)]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="font-semibold">Sao lưu dữ liệu</p>
          <p className="text-sm text-[var(--text-muted)]">Lưu từ vựng, lịch ôn, phiên tập trung, ghép tranh, ảnh tải lên và cài đặt vào một tệp JSON.</p>
        </div>
        <button disabled={busy} onClick={download} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"><Download size={14} />Xuất bản sao lưu</button>
        <button disabled={busy || restored} onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"><Upload size={14} />Khôi phục</button>
        <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" aria-label="Chọn bản sao lưu JSON" onChange={event => { void read(event.target.files?.[0]); event.target.value = ''; }} />
      </div>
      {pending && <div className="mt-4 rounded-xl border border-[var(--border-subtle)] p-4">
        <p className="font-semibold">Bản sao lưu ngày {new Date(pending.createdAt).toLocaleString('vi-VN')}</p>
        <p className="mt-1 text-sm">{(pending.workspace[CARDS_KEY] as VocabCard[]).length} từ · {pending.reviews.length} lượt ôn · {pending.artworks.length} ảnh tải lên</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Gộp vào dữ liệu hiện tại. Từ trùng ID giữ lịch ôn mới hơn; ảnh trùng ID giữ ảnh hiện tại. Các tùy chọn giao diện và thời gian sẽ lấy từ bản sao lưu.</p>
        <div className="mt-3 flex gap-3">
          <button disabled={busy} onClick={restore} className="rounded-lg bg-yellow-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">{busy ? 'Đang khôi phục…' : 'Gộp và khôi phục'}</button>
          <button disabled={busy} onClick={() => setPending(null)} className="rounded-lg border border-[var(--border-subtle)] px-4 py-2">Hủy</button>
        </div>
      </div>}
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
      {restored && <button onClick={() => window.location.reload()} className="mt-3 rounded-lg bg-yellow-400 px-4 py-2 font-semibold text-slate-950">Tải lại trang</button>}
    </section>
  );
}
