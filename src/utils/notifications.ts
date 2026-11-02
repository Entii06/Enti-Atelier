import { PomodoroMode } from '../types';

export type BrowserNotificationPermission =
  | 'granted'
  | 'default'
  | 'denied'
  | 'unsupported';

export interface PermissionRequestOutcome {
  permission: BrowserNotificationPermission;
  blockedByFrame: boolean;
}

export function isEmbeddedInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    return window.Notification.permission as BrowserNotificationPermission;
  } catch {
    return 'unsupported';
  }
}

export async function requestBrowserNotificationPermission(): Promise<PermissionRequestOutcome> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { permission: 'unsupported', blockedByFrame: false };
  }

  const before = getBrowserNotificationPermission();
  if (before === 'granted') {
    return { permission: 'granted', blockedByFrame: false };
  }

  const startedAt = Date.now();
  try {
    let result: NotificationPermission = 'default';
    const maybePromise = window.Notification.requestPermission((cbRes) => {
      result = cbRes;
    });
    if (maybePromise && typeof maybePromise.then === 'function') {
      result = await maybePromise;
    }
    const elapsedMs = Date.now() - startedAt;
    const finalPerm = (result ||
      getBrowserNotificationPermission()) as BrowserNotificationPermission;

    // Cross-origin iframes often auto-deny or no-op in <25ms without showing a prompt
    const blockedByFrame =
      isEmbeddedInIframe() && finalPerm !== 'granted' && elapsedMs < 60;

    return {
      permission: finalPerm,
      blockedByFrame,
    };
  } catch {
    return {
      permission: getBrowserNotificationPermission(),
      blockedByFrame: isEmbeddedInIframe(),
    };
  }
}

function showSystemNotification(
  title: string,
  options: NotificationOptions
): boolean {
  if (getBrowserNotificationPermission() !== 'granted') {
    return false;
  }

  try {
    const notification = new window.Notification(title, options);
    notification.onclick = () => {
      try {
        window.focus();
        notification.close();
      } catch {
        // Ignore window focus restrictions
      }
    };
    return true;
  } catch {
    // Fallback for browsers requiring ServiceWorkerRegistration.showNotification
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          if (reg) {
            return reg.showNotification(title, options);
          }
          return undefined;
        })
        .catch(() => {});
      return true;
    }
    return false;
  }
}

export interface PomodoroNotificationPayload {
  completedMode: PomodoroMode;
  completedMinutes: number;
  nextMode: PomodoroMode;
  nextMinutes: number;
  intention?: string;
  artworkImageSrc?: string;
}

export function sendPomodoroBrowserNotification(
  payload: PomodoroNotificationPayload
): boolean {
  const {
    completedMode,
    completedMinutes,
    nextMode,
    nextMinutes,
    intention,
    artworkImageSrc,
  } = payload;

  let title = '';
  let body = '';

  if (completedMode === 'focus') {
    title = `Hoàn thành phiên Tập trung (${completedMinutes} phút)`;
    const nextLabel =
      nextMode === 'long_break'
        ? `Nghỉ dài (${nextMinutes} phút)`
        : `Nghỉ ngắn (${nextMinutes} phút)`;
    body = intention
      ? `“${intention}” · Đã chuyển sang ${nextLabel}. Hãy thư giãn đôi mắt nhé!`
      : `Đã chuyển sang ${nextLabel}. Hãy nghỉ ngơi vài phút trước phiên tiếp theo.`;
  } else {
    const breakName =
      completedMode === 'long_break' ? 'Nghỉ dài' : 'Nghỉ ngắn';
    title = `Hết giờ ${breakName} — Sẵn sàng tập trung!`;
    body = intention
      ? `Đã chuyển về phiên Tập trung (${nextMinutes} phút) · Mục tiêu: “${intention}”.`
      : `Đã chuyển về phiên Tập trung (${nextMinutes} phút). Nhấn vào đây để bắt đầu phiên mới.`;
  }

  const safeIcon =
    artworkImageSrc &&
    !artworkImageSrc.startsWith('data:') &&
    artworkImageSrc.length < 1024
      ? artworkImageSrc
      : undefined;

  return showSystemNotification(title, {
    body,
    icon: safeIcon,
    tag: 'atelier-arles-pomodoro-session',
    silent: false,
  });
}

export function sendTestBrowserNotification(artworkImageSrc?: string): boolean {
  const safeIcon =
    artworkImageSrc &&
    !artworkImageSrc.startsWith('data:') &&
    artworkImageSrc.length < 1024
      ? artworkImageSrc
      : undefined;

  return showSystemNotification("Enti Atelier · Thông báo đẩy đã bật", {
    body: 'Bạn sẽ nhận được thông báo ngay khi hết phiên Pomodoro mà không cần mở sẵn tab trình duyệt.',
    icon: safeIcon,
    tag: 'atelier-arles-pomodoro-test',
    silent: false,
  });
}

/**
 * Starts an unthrottled background ticker using an inline Web Worker so browsers
 * do not throttle timer checks to 1 minute when the tab is hidden or minimized.
 */
export function startUnthrottledTicker(
  onTick: () => void,
  intervalMs: number = 250
): () => void {
  let stopped = false;
  let worker: Worker | null = null;
  let workerUrl: string | null = null;
  let fallbackTimer: number | null = null;

  const safeTick = () => {
    if (!stopped) {
      onTick();
    }
  };

  const handleVisibility = () => {
    if (typeof document !== 'undefined' && !document.hidden) {
      safeTick();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }

  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    try {
      const script = `
        const id = setInterval(() => postMessage(0), ${Math.max(100, intervalMs)});
        onmessage = (e) => {
          if (e.data === 'stop') {
            clearInterval(id);
            close();
          }
        };
      `;
      const blob = new Blob([script], { type: 'application/javascript' });
      workerUrl = URL.createObjectURL(blob);
      worker = new Worker(workerUrl);
      worker.onmessage = safeTick;
      worker.onerror = () => {
        if (fallbackTimer === null && !stopped) {
          fallbackTimer = window.setInterval(safeTick, intervalMs);
        }
      };
    } catch {
      fallbackTimer = window.setInterval(safeTick, intervalMs);
    }
  } else if (typeof window !== 'undefined') {
    fallbackTimer = window.setInterval(safeTick, intervalMs);
  }

  return () => {
    stopped = true;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
    if (worker) {
      try {
        worker.postMessage('stop');
        worker.terminate();
      } catch {
        // Ignore worker termination errors
      }
      worker = null;
    }
    if (workerUrl) {
      try {
        URL.revokeObjectURL(workerUrl);
      } catch {
        // Ignore URL revoke errors
      }
      workerUrl = null;
    }
    if (fallbackTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
  };
}
