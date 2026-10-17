export function createUserRewardListHref(username, origin) {
  if (typeof username !== "string" || !username.trim() || username.length > 100 ||
      /[\u0000-\u001f\u007f]/u.test(username)) {
    throw new TypeError("A valid username is required to create a reward-list link.");
  }

  const destination = new URL("/reward/list/", origin);
  destination.searchParams.set("user", username);
  return `${destination.pathname}${destination.search}`;
}
