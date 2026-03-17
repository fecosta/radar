/**
 * Format a file size in bytes to a human-readable string
 */
export function formatSize(bytes) {
  if (!bytes) return '—';
  const n = parseInt(bytes, 10);
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Format a date string to a relative or short date
 */
export function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Get a human-readable file type from MIME type
 */
export function getFileType(mimeType) {
  const map = {
    'application/vnd.google-apps.folder': 'Folder',
    'application/vnd.google-apps.document': 'Google Doc',
    'application/vnd.google-apps.spreadsheet': 'Google Sheet',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'application/vnd.google-apps.form': 'Google Form',
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
    'text/plain': 'Text',
    'text/csv': 'CSV',
  };
  if (map[mimeType]) return map[mimeType];
  if (mimeType?.startsWith('image/')) return 'Image';
  if (mimeType?.startsWith('video/')) return 'Video';
  if (mimeType?.startsWith('audio/')) return 'Audio';
  return 'File';
}

/**
 * Get an icon color for file type
 */
export function getFileColor(mimeType) {
  if (mimeType === 'application/vnd.google-apps.folder') return '#F59E0B';
  if (mimeType?.includes('document') || mimeType?.includes('word')) return '#4285F4';
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('sheet')) return '#0F9D58';
  if (mimeType?.includes('presentation')) return '#F4B400';
  if (mimeType?.includes('form')) return '#7627BB';
  if (mimeType === 'application/pdf') return '#EA4335';
  if (mimeType?.startsWith('image/')) return '#FF6D01';
  return '#94A3B8';
}

/**
 * Debounce a function call
 */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
