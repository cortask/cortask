const CRON_CHANGE_EVENT = "cortask:cron-change";

export function emitCronChange() {
  window.dispatchEvent(new CustomEvent(CRON_CHANGE_EVENT));
}

export function onCronChange(callback: () => void): () => void {
  window.addEventListener(CRON_CHANGE_EVENT, callback);
  return () => window.removeEventListener(CRON_CHANGE_EVENT, callback);
}
