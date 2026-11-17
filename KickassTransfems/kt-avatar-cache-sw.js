'use strict';

const AVATAR_CACHE_NAME = 'kt-avatar-images-v1';
const AVATAR_CACHE_PREFIX = 'kt-avatar-images-';
const MAX_CACHED_AVATARS = 80;
const inFlightAvatarRequests = new Map();

function isKickAvatarUrl(value) {
  try {
    const url = new URL(value);
    const allowedHost = url.hostname === 'files.kick.com' || url.hostname === 'kick.com';
    const allowedPath = url.pathname.startsWith('/images/user/')
      || url.pathname.startsWith('/img/default-profile-pictures/');
    return url.protocol === 'https:' && allowedHost && allowedPath;
  } catch {
    return false;
  }
}

function isKickAvatarRequest(request) {
  return request.method === 'GET'
    && request.destination === 'image'
    && isKickAvatarUrl(request.url);
}

async function trimAvatarCache(cache) {
  const keys = await cache.keys();
  const excess = keys.length - MAX_CACHED_AVATARS;
  if (excess <= 0) return;
  await Promise.all(keys.slice(0, excess).map(request => cache.delete(request)));
}

function refreshAvatar(request) {
  const key = request.url;
  const inFlight = inFlightAvatarRequests.get(key);
  if (inFlight) return inFlight;

  const update = fetch(request).then(async response => {
    // Cross-origin Kick image responses may be opaque. They can still be
    // replayed by this worker to <img>, but the page purges one if it fails.
    if (response.ok || response.type === 'opaque') {
      const cache = await caches.open(AVATAR_CACHE_NAME);
      await cache.put(request, response.clone());
      await trimAvatarCache(cache);
    }
    return response;
  }).catch(() => null).finally(() => {
    inFlightAvatarRequests.delete(key);
  });

  inFlightAvatarRequests.set(key, update);
  return update;
}

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(AVATAR_CACHE_PREFIX) && name !== AVATAR_CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (!isKickAvatarRequest(request)) return;

  const refresh = refreshAvatar(request);
  event.waitUntil(refresh.then(() => undefined));
  event.respondWith((async () => {
    const cache = await caches.open(AVATAR_CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    return (await refresh) || Response.error();
  })());
});

self.addEventListener('message', event => {
  const message = event.data;
  if (message?.type !== 'kt-avatar-cache-delete' || !isKickAvatarUrl(message.url)) return;
  event.waitUntil(caches.open(AVATAR_CACHE_NAME).then(cache => cache.delete(message.url)));
});
