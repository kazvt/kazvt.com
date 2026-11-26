export const CARD_GAME_PLAYERS = Object.freeze(["faroe", "erin", "kaz"]);
export const CARD_GAME_CATEGORIES = Object.freeze(["penalty", "challenge", "instant"]);
export const CARD_GAME_STORAGE_KEY = "ramblegamble.card-games.v1";
const ROUND_PHASES = new Set(["submissions", "voting", "results", "shopping"]);
const SMEEMO_PHASES = new Set(["preview", "stacking", "stacked", "dealing", "ready", "complete"]);
const MAX_LIST_ITEMS = 500;
const MAX_TEXT_LENGTH = 800;

export function emptyCardGamesState() {
  return {
    version: 1,
    decks: {
      evidence: [],
      suspects: [],
      quiplash: [],
      shop: { penalty: [], challenge: [], instant: [] },
    },
    round: null,
    smeemo: null,
  };
}

export function normalizeTextList(value) {
  const entries = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/) : [];
  return entries.slice(0, MAX_LIST_ITEMS)
    .map((entry) => cleanText(entry))
    .filter(Boolean);
}

export function parseShopCardList(value) {
  const lines = String(value ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const cards = [];
  const invalid = [];
  for (const line of lines) {
    const match = line.match(/^(.+?)\s*\[\s*(\d+)\s*\]\s*$/);
    if (!match) {
      invalid.push(line);
      continue;
    }
    const name = cleanText(match[1]);
    const price = Number(match[2]);
    if (!name || !Number.isSafeInteger(price) || price < 0) {
      invalid.push(line);
      continue;
    }
    cards.push({ name, price });
  }
  return { cards, invalid };
}

function cleanText(value) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, MAX_TEXT_LENGTH);
}

function normalizeShopCards(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LIST_ITEMS).flatMap((item) => {
    const name = cleanText(item?.name);
    const price = Number(item?.price);
    return name && Number.isSafeInteger(price) && price >= 0 ? [{ name, price }] : [];
  });
}

function normalizeRound(value) {
  if (!value || typeof value !== "object" || !["red-handed", "quiplash", "shop"].includes(value.mode)) return null;
  const phase = ROUND_PHASES.has(value.phase) ? value.phase : "submissions";
  const round = {
    mode: value.mode,
    phase,
    prompt: cleanText(value.prompt),
    submissions: Object.fromEntries(CARD_GAME_PLAYERS.map((player) => [player, cleanText(value.submissions?.[player]) || null])),
    responses: Array.isArray(value.responses) ? value.responses.slice(0, 3).flatMap((entry, index) => {
      const id = cleanText(entry?.id) || `answer-${index + 1}`;
      const text = cleanText(entry?.text);
      return text ? [{ id, text }] : [];
    }) : [],
    votes: {},
    winnerIds: Array.isArray(value.winnerIds) ? value.winnerIds.map(cleanText).filter(Boolean).slice(0, 3) : [],
  };
  if (value.mode === "red-handed") {
    round.hands = Object.fromEntries(CARD_GAME_PLAYERS.map((player) => [player, normalizeTextList(value.hands?.[player]).slice(0, 5)]));
  }
  if (value.mode === "shop") {
    round.cards = Array.isArray(value.cards) ? value.cards.slice(0, 3).flatMap((card, index) => {
      const category = CARD_GAME_CATEGORIES.includes(card?.category) ? card.category : null;
      const name = cleanText(card?.name);
      const price = Number(card?.price);
      if (!category || !name || !Number.isSafeInteger(price) || price < 0) return [];
      const buyer = CARD_GAME_PLAYERS.includes(card?.buyer) ? card.buyer : null;
      return [{ id: cleanText(card.id) || `shop-${index + 1}`, category, name, price, buyer, revealed: Boolean(card.revealed) }];
    }) : [];
  }
  const answerIds = new Set(round.responses.map((response) => response.id));
  for (const id of answerIds) {
    const votes = Number(value.votes?.[id]);
    round.votes[id] = Number.isSafeInteger(votes) && votes >= 0 ? votes : 0;
  }
  return round;
}

function normalizeSmeemo(value) {
  if (!value || typeof value !== "object" || !["playing", "complete"].includes(value.status)) return null;
  const legacy = !Array.isArray(value.cards) && value.piles && typeof value.piles === "object";
  const sourceCards = Array.isArray(value.cards)
    ? value.cards
    : legacy
      ? [
          ...(Array.isArray(value.draws) ? value.draws : []),
          ...CARD_GAME_PLAYERS.flatMap((player) => Array.isArray(value.piles[player]) ? value.piles[player] : []),
        ]
      : [];
  const cards = sourceCards.slice(0, 9).flatMap((card, index) => {
    if (!card || typeof card !== "object") return [];
    return [{ id: cleanText(card.id) || `scramble-${index + 1}`, smeemo: Boolean(card.smeemo) }];
  });
  if (cards.length !== 9 || new Set(cards.map(({ id }) => id)).size !== 9 || cards.filter(({ smeemo }) => smeemo).length !== 1) return null;

  const cardById = new Map(cards.map((card) => [card.id, card]));
  const sourceDraws = Array.isArray(value.draws) ? value.draws.slice(0, 9) : [];
  const draws = [];
  const drawnIds = new Set();
  for (const draw of sourceDraws) {
    const id = cleanText(draw?.id);
    const card = cardById.get(id);
    if (!card || drawnIds.has(id)) continue;
    drawnIds.add(id);
    draws.push({ id, smeemo: card.smeemo });
  }
  if (legacy) {
    for (const draw of sourceDraws) {
      const id = cleanText(draw?.id);
      if (id && cardById.has(id) && !drawnIds.has(id)) {
        drawnIds.add(id);
        draws.push({ id, smeemo: cardById.get(id).smeemo });
      }
    }
  }

  const cardIds = new Set(cards.map(({ id }) => id));
  const previewOrder = Array.isArray(value.previewOrder)
    ? value.previewOrder.map(cleanText).filter((id, index, all) => cardIds.has(id) && all.indexOf(id) === index)
    : [];
  const normalizedPreviewOrder = previewOrder.length === 9 ? previewOrder : cards.map(({ id }) => id);
  const found = draws.some(({ smeemo }) => smeemo);
  let phase = SMEEMO_PHASES.has(value.phase) ? value.phase : legacy ? "ready" : "preview";
  if (found) phase = "complete";
  else if (phase === "complete") phase = "ready";
  return {
    id: cleanText(value.id) || `legacy-${cards[0].id}`,
    status: found ? "complete" : "playing",
    phase,
    cards,
    previewOrder: normalizedPreviewOrder,
    draws,
  };
}

export function normalizeCardGamesState(value) {
  const empty = emptyCardGamesState();
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
  const decks = value.decks && typeof value.decks === "object" ? value.decks : {};
  const shop = decks.shop && typeof decks.shop === "object" ? decks.shop : {};
  return {
    version: 1,
    decks: {
      evidence: normalizeTextList(decks.evidence),
      suspects: normalizeTextList(decks.suspects),
      quiplash: normalizeTextList(decks.quiplash),
      shop: Object.fromEntries(CARD_GAME_CATEGORIES.map((category) => [category, normalizeShopCards(shop[category])])),
    },
    round: normalizeRound(value.round),
    smeemo: normalizeSmeemo(value.smeemo),
  };
}

function randomUnit(random = secureRandomUnit) {
  const value = Number(random());
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999999999, value)) : 0.5;
}

function secureRandomUnit() {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return value[0] / 0x100000000;
  }
  return Math.random();
}

function shuffle(values, random = secureRandomUnit) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(randomUnit(random) * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function pick(values, random) {
  return values[Math.floor(randomUnit(random) * values.length)];
}

export function createRedHandedRound(evidence, suspects, random = secureRandomUnit) {
  const aCards = normalizeTextList(evidence);
  const bCards = normalizeTextList(suspects);
  if (!aCards.length || !bCards.length) return null;
  const deck = shuffle(aCards, random);
  const hands = Object.fromEntries(CARD_GAME_PLAYERS.map((player) => [player, []]));
  for (let cardIndex = 0; cardIndex < 15; cardIndex += 1) {
    if (cardIndex > 0 && cardIndex % deck.length === 0) deck.push(...shuffle(aCards, random));
    hands[CARD_GAME_PLAYERS[cardIndex % CARD_GAME_PLAYERS.length]].push(deck[cardIndex]);
  }
  return {
    mode: "red-handed",
    phase: "submissions",
    prompt: pick(bCards, random),
    hands,
    submissions: Object.fromEntries(CARD_GAME_PLAYERS.map((player) => [player, null])),
    responses: [],
    votes: {},
    winnerIds: [],
  };
}

export function createQuiplashRound(prompts, random = secureRandomUnit) {
  const choices = normalizeTextList(prompts);
  if (!choices.length) return null;
  return {
    mode: "quiplash",
    phase: "submissions",
    prompt: pick(choices, random),
    submissions: Object.fromEntries(CARD_GAME_PLAYERS.map((player) => [player, null])),
    responses: [],
    votes: {},
    winnerIds: [],
  };
}

function beginVoting(round, random) {
  const entries = CARD_GAME_PLAYERS.map((player) => ({ player, text: round.submissions[player] }));
  const shuffled = shuffle(entries, random);
  round.responses = shuffled.map((entry, index) => ({ id: `answer-${index + 1}`, text: entry.text }));
  round.phase = "voting";
  round.votes = Object.fromEntries(round.responses.map(({ id }) => [id, 0]));
  return round;
}

export function submitRoundAnswer(roundValue, player, answer, random = secureRandomUnit) {
  const round = normalizeRound(roundValue);
  if (!round || round.phase !== "submissions" || !CARD_GAME_PLAYERS.includes(player)) return roundValue;
  const text = cleanText(answer);
  if (!text || round.submissions[player]) return roundValue;
  if (round.mode === "red-handed" && !round.hands[player].includes(text)) return roundValue;
  round.submissions[player] = text;
  if (CARD_GAME_PLAYERS.every((name) => round.submissions[name])) beginVoting(round, random);
  return round;
}

export function recordAudienceVote(roundValue, responseId, amount = 1) {
  const round = normalizeRound(roundValue);
  const delta = Number(amount);
  if (!round || round.phase !== "voting" || !round.responses.some((response) => response.id === responseId)) return roundValue;
  if (!Number.isSafeInteger(delta) || delta < 1 || round.votes[responseId] > Number.MAX_SAFE_INTEGER - delta) return roundValue;
  round.votes[responseId] += delta;
  return round;
}

export function revealAudienceResults(roundValue) {
  const round = normalizeRound(roundValue);
  if (!round || round.phase !== "voting") return roundValue;
  const maxVotes = Math.max(0, ...Object.values(round.votes));
  round.winnerIds = maxVotes > 0 ? round.responses.filter(({ id }) => round.votes[id] === maxVotes).map(({ id }) => id) : [];
  round.phase = "results";
  return round;
}

export function createShopRound(shopLists, random = secureRandomUnit) {
  const cards = CARD_GAME_CATEGORIES.map((category) => {
    const entries = normalizeShopCards(shopLists?.[category]);
    if (!entries.length) return null;
    const card = pick(entries, random);
    return { id: `shop-${category}`, category, name: card.name, price: card.price, buyer: null, revealed: false };
  });
  if (cards.some((card) => !card)) return null;
  return { mode: "shop", phase: "shopping", prompt: "", submissions: {}, responses: [], votes: {}, winnerIds: [], cards };
}

export function buyShopCard(roundValue, cardId, buyer, scoresValue) {
  const round = normalizeRound(roundValue);
  const scores = scoresValue && typeof scoresValue === "object" ? { ...scoresValue } : {};
  if (!round || round.mode !== "shop" || round.phase !== "shopping" || !CARD_GAME_PLAYERS.includes(buyer)) {
    return { round: roundValue, scores, error: "invalid-purchase" };
  }
  const card = round.cards.find((entry) => entry.id === cardId);
  if (!card || card.buyer) return { round: roundValue, scores, error: "already-sold" };
  const balance = Number(scores[buyer]);
  if (!Number.isSafeInteger(balance) || balance < card.price) return { round: roundValue, scores, error: "not-enough-points" };
  scores[buyer] = balance - card.price;
  card.buyer = buyer;
  card.revealed = true;
  return { round, scores, error: "" };
}

export function createSmeemoGame(random = secureRandomUnit) {
  const id = globalThis.crypto?.randomUUID?.() || `smeemo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const randomPosition = Number(random());
  const smeemoIndex = Math.min(8, Math.max(0, Number.isFinite(randomPosition) ? Math.floor(randomPosition * 9) : 0));
  const cards = Array.from({ length: 9 }, (_, index) => ({
    id: `${id}-card-${index + 1}`,
    smeemo: index === smeemoIndex,
  }));
  const previewCards = shuffle(cards, random);
  const shuffledCards = shuffle(previewCards, random);
  if (shuffledCards.every((card, index) => card.id === previewCards[index].id)) shuffledCards.push(shuffledCards.shift());
  return {
    id,
    status: "playing",
    phase: "preview",
    cards: shuffledCards,
    previewOrder: previewCards.map(({ id: cardId }) => cardId),
    draws: [],
  };
}

export function advanceSmeemoPhase(value, expectedPhase) {
  const game = normalizeSmeemo(value);
  const nextPhase = { preview: "stacking", stacking: "stacked", stacked: "dealing", dealing: "ready" }[expectedPhase];
  if (!game || game.status !== "playing" || game.phase !== expectedPhase || !nextPhase) return value;
  return { ...game, phase: nextPhase };
}

export function drawSmeemoCard(value, cardId) {
  const game = normalizeSmeemo(value);
  if (!game || game.status !== "playing") return { game: value, draw: null, error: "not-playing" };
  if (game.phase !== "ready") return { game: value, draw: null, error: "not-ready" };
  const card = game.cards.find((entry) => entry.id === cardId);
  if (!card) return { game: value, draw: null, error: "unknown-card" };
  if (game.draws.some((draw) => draw.id === card.id)) return { game: value, draw: null, error: "already-revealed" };
  const draw = { id: card.id, smeemo: card.smeemo };
  game.draws.push(draw);
  if (card.smeemo) {
    game.phase = "complete";
    game.status = "complete";
  }
  return { game, draw, error: "" };
}
