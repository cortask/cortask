const CRON_CHANGE_EVENT = "cortask:cron-change";
const FILES_CHANGE_EVENT = "cortask:files-change";

export function emitCronChange() {
  window.dispatchEvent(new CustomEvent(CRON_CHANGE_EVENT));
}

export function onCronChange(callback: () => void): () => void {
  window.addEventListener(CRON_CHANGE_EVENT, callback);
  return () => window.removeEventListener(CRON_CHANGE_EVENT, callback);
}

export function emitFilesChange() {
  window.dispatchEvent(new CustomEvent(FILES_CHANGE_EVENT));
}

export function onFilesChange(callback: () => void): () => void {
  window.addEventListener(FILES_CHANGE_EVENT, callback);
  return () => window.removeEventListener(FILES_CHANGE_EVENT, callback);
}
