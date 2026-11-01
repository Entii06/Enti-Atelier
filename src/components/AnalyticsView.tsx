import React, { useMemo } from 'react';
import { resolveArtwork } from '../constants/themes';
import {
  ArtworkItem,
  PomodoroSessionRecord,
  RecallGrade,
  ReviewLogRecord,
  VocabCard,
} from '../types';
import { formatIntervalDays, getCardMaturity } from '../utils/srs';
import {
  CUTOUT_VIVID_CLASS,
  STARRY_CUTOUTS,
  StarryHeaderAccent,
} from './StarryCutoutAccents';

interface AnalyticsViewProps {
  cards: VocabCard[];
  artworks: ArtworkItem[];
  pomodoroHistory: PomodoroSessionRecord[];
  reviewLogs: ReviewLogRecord[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  cards,
  artworks,
  pomodoroHistory,
  reviewLogs,
}) => {
  const stats = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    const focusSessions = pomodoroHistory.filter((s) => s.mode === 'focus');
    const totalFocusedMinutes = focusSessions.reduce(
      (sum, s) => sum + s.durationMinutes,
      0
    );
    const todayFocusedMinutes = focusSessions
      .filter((s) => s.completedAt >= todayMs)
      .reduce((sum, s) => sum + s.durationMinutes, 0);

    const scheduledReviews = reviewLogs.filter(r => !r.practice);
    const rememberedReviews = scheduledReviews.filter(
      (r) => r.grade !== RecallGrade.AGAIN
    ).length;
    const retentionRate =
      scheduledReviews.length > 0
        ? Math.round((rememberedReviews / scheduledReviews.length) * 100)
        : 100;

    const maturityCounts = {
      new: 0,
      learning: 0,
      review: 0,
      mastered: 0,
    };
    cards.forEach((c) => {
      maturityCounts[getCardMaturity(c)] += 1;
    });

    const forecast: Array<{ label: string; count: number }> = [];
    const weekdayShort = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const now = Date.now();

    for (let d = 0; d < 7; d++) {
      const dayStart = todayMs + d * DAY_MS;
      const dayEnd = dayStart + DAY_MS;
      const count = cards.filter((c) => {
        if (d === 0) return c.nextReviewAt < dayEnd;
        return c.nextReviewAt >= dayStart && c.nextReviewAt < dayEnd;
      }).length;

      const dateObj = new Date(dayStart);
      const label =
        d === 0
          ? 'Hôm nay'
          : d === 1
          ? 'Ngày mai'
          : `${weekdayShort[dateObj.getDay()]} ${dateObj.getDate()}/${
              dateObj.getMonth() + 1
            }`;
      forecast.push({ label, count });
    }

    const maxForecast = Math.max(4, ...forecast.map((f) => f.count));

    return {
      totalFocusSessions: focusSessions.length,
      totalFocusedMinutes,
      todayFocusedMinutes,
      retentionRate,
      maturityCounts,
      forecast,
      maxForecast,
      now,
    };
  }, [cards, pomodoroHistory, reviewLogs]);

  const forecastCurve = useMemo(() => {
    const slotWidth = 560 / 7;
    const maxBarHeight = 132;
    const pts = stats.forecast.map((item, idx) => {
      const barHeight =
        item.count > 0
          ? Math.max(12, (item.count / stats.maxForecast) * maxBarHeight)
          : 6;
      const x = idx * slotWidth + slotWidth / 2;
      const y = 175 - barHeight;
      return { x, y, count: item.count, label: item.label, barHeight };
    });

    const buildSmoothPath = (offsetY = 0) => {
      if (pts.length === 0) return '';
      let d = `M ${pts[0].x} ${pts[0].y + offsetY}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const cx = (p0.x + p1.x) / 2;
        d += ` C ${cx} ${p0.y + offsetY}, ${cx} ${p1.y + offsetY}, ${p1.x} ${
          p1.y + offsetY
        }`;
      }
      return d;
    };

    return {
      points: pts,
      mainPath: buildSmoothPath(-6),
      echoPath: buildSmoothPath(-12),
    };
  }, [stats.forecast, stats.maxForecast]);

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-[var(--text-primary)]">
            Nhật ký tập trung &amp; Dự báo trí nhớ FSRS
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1.5 max-w-2xl">
            Số liệu thực tế từ các phiên Pomodoro đã hoàn thành và lịch trình lặp
            lại ngắt quãng trong 7 ngày tới.
          </p>
        </div>

        <StarryHeaderAccent variant="analytics" className="flex" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] divide-y lg:divide-y-0 sm:divide-x divide-[var(--border-subtle)] overflow-hidden">
        <div className="p-6">
          <p className="text-xs text-[var(--text-muted)]">
            Tổng thời gian tập trung
          </p>
          <p className="font-mono tabular-nums text-3xl font-semibold text-[var(--text-primary)] mt-1.5">
            {stats.totalFocusedMinutes}{' '}
            <span className="text-sm font-normal text-[var(--text-muted)]">
              phút
            </span>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-mono tabular-nums">
            Hôm nay: {stats.todayFocusedMinutes} phút ·{' '}
            {stats.totalFocusSessions} phiên
          </p>
        </div>

        <div className="p-6">
          <p className="text-xs text-[var(--text-muted)]">
            Tỷ lệ nhớ lại thành công
          </p>
          <p className="font-mono tabular-nums text-3xl font-semibold text-[var(--text-primary)] mt-1.5">
            {stats.retentionRate}%
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-mono tabular-nums">
            Qua {reviewLogs.length} lượt chấm thẻ
          </p>
        </div>

        <div className="p-6">
          <p className="text-xs text-[var(--text-muted)]">
            Từ đã thuộc lòng dài hạn
          </p>
          <p className="font-mono tabular-nums text-3xl font-semibold text-[var(--text-primary)] mt-1.5">
            {stats.maturityCounts.mastered}{' '}
            <span className="text-sm font-normal text-[var(--text-muted)]">
              / {cards.length} từ
            </span>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Chu kỳ lặp lại từ 21 ngày trở lên
          </p>
        </div>

        <div className="p-6">
          <p className="text-xs text-[var(--text-muted)]">
            Cần ôn trong 24 giờ tới
          </p>
          <p className="font-mono tabular-nums text-3xl font-semibold text-[var(--accent)] mt-1.5">
            {stats.forecast[0]?.count ?? 0}{' '}
            <span className="text-sm font-normal text-[var(--text-muted)]">
              thẻ
            </span>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-mono tabular-nums">
            Ngày mai: +{stats.forecast[1]?.count ?? 0} thẻ
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 rounded-2xl bg-[var(--bg-surface)] overflow-hidden flex flex-col justify-between">
          <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-2xl font-semibold text-[var(--text-primary)]">
                  Dự báo số thẻ tới hạn 7 ngày tới
                </h3>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
                  Phân bổ khối lượng ôn tập dựa trên chu kỳ FSRS hiện tại của từng
                  từ trong kho.
                </p>
              </div>
              <img
                src={STARRY_CUTOUTS.moonHalo}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                decoding="async"
                className={`w-12 h-12 sm:w-14 sm:h-14 object-contain opacity-100 pointer-events-none select-none shrink-0 ${CUTOUT_VIVID_CLASS}`}
              />
            </div>

            <div className="mt-8">
              <svg
                viewBox="0 0 560 220"
                className="w-full h-56 overflow-visible"
                role="img"
                aria-label="Biểu đồ dự báo thẻ từ cần ôn trong 7 ngày tới"
              >
                {/* Undulating Van Gogh dashed horizon guide lines */}
                <path
                  d="M 0 38 C 140 33, 280 43, 420 36 C 480 34, 525 40, 560 38"
                  fill="none"
                  stroke="var(--vg-stroke-muted)"
                  strokeWidth="1.3"
                  strokeDasharray="12 8 5 8"
                  strokeLinecap="round"
                />
                <path
                  d="M 0 106 C 140 101, 280 111, 420 104 C 480 102, 525 108, 560 106"
                  fill="none"
                  stroke="var(--vg-stroke-muted)"
                  strokeWidth="1.3"
                  strokeDasharray="12 8 5 8"
                  strokeLinecap="round"
                />
                <path
                  d="M 0 175 L 560 175"
                  fill="none"
                  stroke="var(--vg-stroke-blue)"
                  strokeWidth="1.8"
                  strokeDasharray="24 6 10 6"
                  strokeLinecap="round"
                />

                {forecastCurve.points.map((pt, idx) => {
                  const barWidth = 34;
                  const x = pt.x - barWidth / 2;
                  const isTodayActive = idx === 0 && pt.count > 0;

                  return (
                    <g key={pt.label}>
                      <rect
                        x={x}
                        y={pt.y}
                        width={barWidth}
                        height={pt.barHeight}
                        rx={7}
                        fill={
                          isTodayActive
                            ? 'var(--accent)'
                            : 'var(--vg-stroke-blue)'
                        }
                        fillOpacity={isTodayActive ? 0.92 : 0.42}
                      />
                      {pt.barHeight > 18 && (
                        <line
                          x1={pt.x}
                          y1={pt.y + 6}
                          x2={pt.x}
                          y2={175 - 5}
                          stroke={
                            isTodayActive
                              ? 'var(--accent-fg)'
                              : 'var(--vg-stroke-cyan)'
                          }
                          strokeOpacity={isTodayActive ? 0.35 : 0.65}
                          strokeWidth="2"
                          strokeDasharray="8 5 4 5"
                          strokeLinecap="round"
                        />
                      )}
                      <text
                        x={pt.x}
                        y={pt.y - 16}
                        textAnchor="middle"
                        fill="var(--text-primary)"
                        fontSize="12"
                        fontWeight={isTodayActive ? '700' : '500'}
                        fontFamily="var(--font-mono)"
                      >
                        {pt.count}
                      </text>
                      <text
                        x={pt.x}
                        y={200}
                        textAnchor="middle"
                        fill="var(--text-muted)"
                        fontSize="11"
                        fontFamily="var(--font-sans)"
                      >
                        {pt.label}
                      </text>
                    </g>
                  );
                })}

                {/* Flowing Starry Night impasto wave across forecast peaks */}
                <path
                  d={forecastCurve.echoPath}
                  fill="none"
                  stroke="var(--vg-stroke-cyan)"
                  strokeWidth="1.6"
                  strokeDasharray="10 7 4 7"
                  strokeLinecap="round"
                  strokeOpacity="0.85"
                />
                <path
                  d={forecastCurve.mainPath}
                  fill="none"
                  stroke="var(--vg-stroke-gold)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                {forecastCurve.points.map((pt, idx) => (
                  <g key={`star-${pt.label}`}>
                    <circle
                      cx={pt.x}
                      cy={pt.y - 6}
                      r="3.2"
                      fill="var(--vg-stroke-gold)"
                    />
                    {(idx === 0 || pt.count > 0) && (
                      <circle
                        cx={pt.x}
                        cy={pt.y - 6}
                        r="6.8"
                        fill="none"
                        stroke="var(--vg-stroke-gold)"
                        strokeWidth="1.2"
                        strokeDasharray="3 3"
                        strokeLinecap="round"
                      />
                    )}
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl bg-[var(--bg-surface)] overflow-hidden flex flex-col justify-between">
          <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                <div>
                  <h3 className="font-serif text-2xl font-semibold text-[var(--text-primary)]">
                    Cấu trúc độ chín trí nhớ
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
                    Tiến trình chuyển hóa từ mới thành vốn từ vựng dài hạn.
                  </p>
                </div>

                <div className="mt-6 divide-y divide-[var(--border-subtle)]">
                  {(
                    [
                      ['Từ mới (chưa ôn lần nào)', stats.maturityCounts.new],
                      [
                        'Đang học (chu kỳ ngắn 1–3 ngày)',
                        stats.maturityCounts.learning,
                      ],
                      [
                        'Đang củng cố (chu kỳ 4–20 ngày)',
                        stats.maturityCounts.review,
                      ],
                      [
                        'Đã thuộc lòng (chu kỳ ≥ 21 ngày)',
                        stats.maturityCounts.mastered,
                      ],
                    ] as Array<[string, number]>
                  ).map(([label, count], idx) => {
                    const pct =
                      cards.length > 0
                        ? Math.round((count / cards.length) * 100)
                        : 0;
                    const fillWidth =
                      pct > 0 ? Math.max(6, (pct / 100) * 240) : 0;

                    return (
                      <div key={label} className="py-3.5 space-y-2">
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="text-sm text-[var(--text-secondary)]">
                            {label}
                          </span>
                          <span className="font-mono tabular-nums text-sm font-semibold text-[var(--text-primary)] shrink-0">
                            {count} từ ({pct}%)
                          </span>
                        </div>

                        <svg
                          viewBox="0 0 240 6"
                          fill="none"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                          className="w-full h-1.5 block rounded-full overflow-hidden"
                        >
                          <rect
                            x="0"
                            y="0"
                            width="240"
                            height="6"
                            rx="3"
                            fill="var(--border-subtle)"
                          />
                          {fillWidth > 0 && (
                            <rect
                              x="0"
                              y="0"
                              width={fillWidth}
                              height="6"
                              rx="3"
                              fill={
                                idx >= 2
                                  ? 'var(--accent)'
                                  : 'var(--text-secondary)'
                              }
                            />
                          )}
                        </svg>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs text-[var(--text-muted)] pt-4 border-t border-[var(--border-subtle)]">
                Mẹo học bền vững: Duy trì 1–2 phiên Pomodoro mỗi ngày và thêm
                5–10 từ tiếng Anh thực sự gặp trong công việc hoặc sách báo.
              </p>
            </div>
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] p-6">
          <div className="pb-3 mb-2 border-b border-[var(--border-subtle)]">
            <h3 className="font-serif text-xl font-semibold text-[var(--text-primary)]">
              Phiên Pomodoro gần đây
            </h3>
          </div>
          {pomodoroHistory.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-6">
              Chưa có phiên Pomodoro nào hoàn tất. Hãy bắt đầu phiên tập trung
              đầu tiên của bạn.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {pomodoroHistory.slice(0, 6).map((item) => {
                const art = resolveArtwork(artworks, item.paintingTheme);
                return (
                  <div
                    key={item.id}
                    className="py-3 flex items-baseline justify-between gap-4 text-sm"
                  >
                    <div className="truncate">
                      <span className="font-medium text-[var(--text-primary)]">
                        {item.mode === 'focus'
                          ? 'Phiên tập trung'
                          : item.mode === 'short_break'
                          ? 'Nghỉ ngắn'
                          : 'Nghỉ dài'}
                      </span>
                      <span className="text-[var(--text-muted)] mx-1.5">·</span>
                      <span className="text-[var(--text-secondary)]">
                        {item.intention || art?.viTitle || 'Phòng vẽ'}
                      </span>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-[var(--text-muted)] shrink-0">
                      {item.durationMinutes} phút ·{' '}
                      {new Date(item.completedAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] p-6">
          <div className="pb-3 mb-2 border-b border-[var(--border-subtle)]">
            <h3 className="font-serif text-xl font-semibold text-[var(--text-primary)]">
              Lượt ôn từ vựng gần đây
            </h3>
          </div>
          {reviewLogs.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-6">
              Chưa có lượt chấm thẻ nào hôm nay. Hãy mở mục Ôn tập SRS để bắt
              đầu củng cố từ vựng.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {reviewLogs.slice(0, 6).map((log) => (
                <div
                  key={log.id}
                  className="py-3 flex items-baseline justify-between gap-4 text-sm"
                >
                  <div className="truncate">
                    <span className="font-serif text-lg font-semibold text-[var(--text-primary)]">
                      {log.word}
                    </span>
                    <span className="text-[var(--text-muted)] mx-1.5">·</span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {log.grade === RecallGrade.AGAIN
                        ? 'Quên — học lại'
                        : log.grade === RecallGrade.HARD
                        ? 'Khó nhớ'
                        : log.grade === RecallGrade.GOOD
                        ? 'Nhớ được'
                        : 'Rất dễ'}
                    </span>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[var(--text-muted)] shrink-0">
                    Chu kỳ mới: {formatIntervalDays(log.newInterval)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
