import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Upload,
  Link as LinkIcon,
  Loader2,
  RotateCcw,
  Trash2,
  ImagePlus,
} from 'lucide-react';
import { ArtworkItem, BasePaletteKey } from '../types';
import { compressImageFileToDataUrl } from '../utils/artworkStorage';
import { ArtworkImage } from './ArtworkImage';

interface NewArtworkPayload {
  viTitle: string;
  quoteVi: string;
  imageSrc: string;
  paletteKey: BasePaletteKey;
}

interface AddArtworkModalProps {
  isOpen: boolean;
  artworks: ArtworkItem[];
  hasDeletedBuiltins: boolean;
  defaultThemeId?: string;
  canEditServerDefaults?: boolean;
  onSetDefaultThemeId?: (id: string) => void;
  onClose: () => void;
  onAddArtworks: (items: NewArtworkPayload[]) => void;
  onDeleteArtwork: (id: string) => void;
  onRestoreBuiltins: () => void;
}

interface StagedUpload {
  id: string;
  title: string;
  dataUrl: string;
}

function stripFileExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

export const AddArtworkModal: React.FC<AddArtworkModalProps> = ({
  isOpen,
  artworks,
  hasDeletedBuiltins,
  defaultThemeId,
  canEditServerDefaults = false,
  onSetDefaultThemeId,
  onClose,
  onAddArtworks,
  onDeleteArtwork,
  onRestoreBuiltins,
}) => {
  const [sourceTab, setSourceTab] = useState<'upload' | 'url' | 'manage'>(
    'upload'
  );
  const [stagedFiles, setStagedFiles] = useState<StagedUpload[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const [imageUrl, setImageUrl] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [quoteVi, setQuoteVi] = useState('');
  const [paletteKey, setPaletteKey] = useState<BasePaletteKey>('starry_night');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSourceTab('upload');
    setStagedFiles([]);
    setImageUrl('');
    setUrlTitle('');
    setQuoteVi('');
    setPaletteKey('starry_night');
    setErrorMsg(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    setIsProcessing(true);

    const added: StagedUpload[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.type.startsWith('image/')) continue;
      try {
        const compressed = await compressImageFileToDataUrl(f);
        added.push({
          id: `stg-${Date.now()}-${i}`,
          title: stripFileExtension(f.name) || `Tranh tải lên ${i + 1}`,
          dataUrl: compressed,
        });
      } catch {
        setErrorMsg(`Không thể xử lý tệp "${f.name}".`);
      }
    }

    setStagedFiles((prev) => [...prev, ...added]);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    void handleFilesSelected(e.dataTransfer.files);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (sourceTab === 'upload') {
      if (stagedFiles.length === 0) {
        setErrorMsg('Vui lòng chọn ít nhất 1 ảnh từ thiết bị của bạn.');
        return;
      }
      onAddArtworks(
        stagedFiles.map((item) => ({
          viTitle: item.title.trim() || 'Ảnh nền cá nhân',
          quoteVi: quoteVi.trim(),
          imageSrc: item.dataUrl,
          paletteKey,
        }))
      );
      onClose();
      return;
    }

    if (sourceTab === 'url') {
      const cleanUrl = imageUrl.trim();
      if (!cleanUrl) {
        setErrorMsg('Vui lòng dán đường dẫn URL hợp lệ của bức ảnh.');
        return;
      }
      onAddArtworks([
        {
          viTitle: urlTitle.trim() || 'Tranh sưu tầm',
          quoteVi: quoteVi.trim(),
          imageSrc: cleanUrl,
          paletteKey,
        },
      ]);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="artwork-modal-title"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] text-[var(--text-primary)] overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4">
          <h2
            id="artwork-modal-title"
            className="font-serif text-2xl font-semibold text-[var(--text-primary)]"
          >
            Thêm &amp; Quản lý ảnh nền Pomodoro
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-6 pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center p-1 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => {
                setSourceTab('upload');
                setErrorMsg(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sourceTab === 'upload'
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Tải từ máy tính</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSourceTab('url');
                setErrorMsg(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sourceTab === 'url'
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Dán link ảnh</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSourceTab('manage');
                setErrorMsg(null);
              }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sourceTab === 'manage'
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Danh sách ảnh ({artworks.length})
            </button>
          </div>

          {hasDeletedBuiltins && (
            <button
              type="button"
              onClick={onRestoreBuiltins}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Khôi phục ảnh mặc định</span>
            </button>
          )}
        </div>

        {sourceTab === 'manage' ? (
          <div className="p-6 space-y-4">
            {artworks.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-sm text-[var(--text-muted)]">
                  Hiện chưa có bức ảnh nền nào. Hãy tải ảnh mới lên hoặc khôi
                  phục bộ ảnh mặc định.
                </p>
                {hasDeletedBuiltins && (
                  <button
                    type="button"
                    onClick={onRestoreBuiltins}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Khôi phục ảnh mặc định</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                {artworks.map((art) => {
                  const isOpeningDefault =
                    Boolean(defaultThemeId) && defaultThemeId === art.id;
                  return (
                    <div
                      key={art.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ArtworkImage
                          artwork={art}
                          className="w-14 h-10 rounded-lg shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                            {art.viTitle}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] truncate">
                            {art.isCustom
                              ? 'Ảnh thêm riêng'
                              : isOpeningDefault
                              ? 'Mặc định trang web · Mở đầu'
                              : 'Mặc định trang web'}
                          </p>
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-1 shrink-0">
                        {canEditServerDefaults &&
                          !art.isCustom &&
                          !isOpeningDefault &&
                          onSetDefaultThemeId && (
                            <button
                              type="button"
                              onClick={() => onSetDefaultThemeId(art.id)}
                              title="Đặt ảnh này hiện đầu tiên khi mở trang web"
                              className="px-2 py-1.5 text-xs font-medium rounded-lg text-[var(--accent)] hover:bg-[var(--bg-elevated)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Mở đầu
                            </button>
                          )}

                        <button
                          type="button"
                          onClick={() => onDeleteArtwork(art.id)}
                          aria-label={`Xóa ảnh ${art.viTitle}`}
                          title="Xóa ảnh này"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-[var(--semantic-danger)] hover:bg-[var(--bg-elevated)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-4 border-t border-[var(--border-subtle)] flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-sm font-medium rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {errorMsg && (
              <p className="text-xs font-medium text-[var(--semantic-danger)]">
                {errorMsg}
              </p>
            )}

            {sourceTab === 'upload' ? (
              <div className="space-y-4">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-[var(--border-strong)] hover:border-[var(--accent)] rounded-2xl p-6 text-center bg-[var(--bg-canvas)] transition-colors cursor-pointer"
                >
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
                      <p className="text-xs text-[var(--text-secondary)]">
                        Đang tối ưu độ phân giải ảnh...
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <ImagePlus className="w-7 h-7 text-[var(--accent)]" />
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        Nhấn để chọn ảnh hoặc kéo thả vào đây
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Hỗ trợ JPG, PNG, WEBP chất lượng cao (có thể chọn nhiều
                        ảnh cùng lúc)
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => void handleFilesSelected(e.target.files)}
                    className="hidden"
                  />
                </div>

                {stagedFiles.length > 0 && (
                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {stagedFiles.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]"
                      >
                        <img
                          src={item.dataUrl}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-16 h-11 object-cover rounded-lg shrink-0"
                        />
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) =>
                            setStagedFiles((prev) =>
                              prev.map((s) =>
                                s.id === item.id
                                  ? { ...s, title: e.target.value }
                                  : s
                              )
                            )
                          }
                          placeholder="Tên bức ảnh..."
                          className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setStagedFiles((prev) =>
                              prev.filter((s) => s.id !== item.id)
                            )
                          }
                          aria-label="Bỏ ảnh này"
                          className="p-2 text-[var(--text-muted)] hover:text-[var(--semantic-danger)] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="artwork-url-input"
                    className="block text-xs font-medium text-[var(--text-muted)] mb-1.5"
                  >
                    Đường dẫn ảnh (URL) *
                  </label>
                  <input
                    id="artwork-url-input"
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/van-gogh-wheatfield.jpg"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="artwork-url-title"
                    className="block text-xs font-medium text-[var(--text-muted)] mb-1.5"
                  >
                    Tên bức tranh / ảnh nền
                  </label>
                  <input
                    id="artwork-url-title"
                    type="text"
                    value={urlTitle}
                    onChange={(e) => setUrlTitle(e.target.value)}
                    placeholder="Ví dụ: Cánh Đồng Lúa Mì Với Đàn Quạ"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </div>

                {imageUrl.trim() && (
                  <div className="h-36 rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
                    <img
                      src={imageUrl.trim()}
                      alt="Xem trước ảnh nền"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-1">
              <div className="sm:col-span-7">
                <label
                  htmlFor="artwork-quote"
                  className="block text-xs font-medium text-[var(--text-muted)] mb-1.5"
                >
                  Câu trích dẫn / Ghi chú cảm hứng (tùy chọn)
                </label>
                <input
                  id="artwork-quote"
                  type="text"
                  value={quoteVi}
                  onChange={(e) => setQuoteVi(e.target.value)}
                  placeholder="Hiển thị khi bấm vào mục Lời họa sĩ..."
                  className="w-full px-3.5 py-2 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>

              <div className="sm:col-span-5">
                <label
                  htmlFor="artwork-palette"
                  className="block text-xs font-medium text-[var(--text-muted)] mb-1.5"
                >
                  Tông màu các trang phụ
                </label>
                <select
                  id="artwork-palette"
                  value={paletteKey}
                  onChange={(e) =>
                    setPaletteKey(e.target.value as BasePaletteKey)
                  }
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] cursor-pointer"
                >
                  <option value="starry_night">Xanh đêm (Đêm Đầy Sao)</option>
                  <option value="cafe_terrace">Xanh ánh đèn (Cà Phê Đêm)</option>
                  <option value="sunflowers">Vàng kem ấm (Hướng Dương)</option>
                  <option value="almond_blossom">Xanh ngọc sáng (Hạnh Nhân)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                Lưu ảnh nền
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
