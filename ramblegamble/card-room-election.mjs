// Same-origin host tabs share a room and queue for one exclusive reader lock.
// No timestamp leases: a throttled background tab must not create split brain.
export const ROOM_KEY = 'rg-card-room-v1';
export const ENABLED_KEY = 'rg-card-room-enabled-v2';
export const STATUS_KEY = 'rg-card-room-status-v2';
export const READER_LOCK = 'rg-card-room-reader-v2';
export function withRoomSubmissionLock(action, locks = globalThis.navigator?.locks) {
  return locks?.request ? locks.request('rg-card-room-submission-v2', action) : Promise.resolve().then(action);
}

export function electReader({ locks, activate, onError = () => {} }) {
  let wanted = false, request = null, release = null;
  function reconcile() {
    if (!wanted || request || !locks?.request) return;
    const controller = new AbortController();
    request = controller;
    locks.request(READER_LOCK, { signal: controller.signal }, async () => {
      if (!wanted || controller.signal.aborted) return;
      let deactivate;
      try {
        // Install the release callback before starting the transport.
        const held = new Promise(resolve => { release = resolve; });
        deactivate = activate();
        await held;
      } finally {
        release = null;
        deactivate?.();
      }
    }).catch(error => { if (error.name !== 'AbortError') { wanted = false; onError(error); } })
      .finally(() => { request = null; reconcile(); });
  }
  return {
    setWanted(next) {
      wanted = Boolean(next);
      if (!wanted) { request?.abort(); release?.(); }
      else reconcile();
    },
  };
}
