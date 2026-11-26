import test from "node:test";
import assert from "node:assert/strict";
import {
  CARD_GAME_PLAYERS,
  createQuiplashRound,
  createRedHandedRound,
  createShopRound,
  createSmeemoGame,
  advanceSmeemoPhase,
  drawSmeemoCard,
  normalizeCardGamesState,
  parseShopCardList,
  recordAudienceVote,
  revealAudienceResults,
  submitRoundAnswer,
} from "./card-games.mjs";

function stableRandom() { return 0.25; }

test("Red Handed deals five A-cards to each fixed contestant and selects a B-card", () => {
  const round = createRedHandedRound(["evidence 1", "evidence 2", "evidence 3"], ["suspect 1", "suspect 2"], stableRandom);
  assert.equal(round.prompt, "suspect 1");
  assert.deepEqual(Object.keys(round.hands), CARD_GAME_PLAYERS);
  for (const player of CARD_GAME_PLAYERS) assert.equal(round.hands[player].length, 5);
  assert.equal(createRedHandedRound([], ["prompt"]), null);
  assert.equal(createRedHandedRound(["card"], []), null);
});

test("answers remain hidden until all three have submitted, then appear without player identities", () => {
  let round = createRedHandedRound(["A", "B", "C", "D", "E"], ["Prompt"], stableRandom);
  const firstAnswer = round.hands.faroe[0];
  round = submitRoundAnswer(round, "faroe", firstAnswer, stableRandom);
  assert.equal(round.phase, "submissions");
  assert.equal(round.responses.length, 0);
  round = submitRoundAnswer(round, "erin", round.hands.erin[0], stableRandom);
  assert.equal(round.phase, "submissions");
  round = submitRoundAnswer(round, "kaz", round.hands.kaz[0], stableRandom);
  assert.equal(round.phase, "voting");
  assert.equal(round.responses.length, 3);
  assert.equal(round.responses.some((entry) => "player" in entry), false);
  assert.equal(submitRoundAnswer(round, "faroe", "late answer"), round);
});

test("Quiplash accepts one private text response per player and opens voting at three", () => {
  let round = createQuiplashRound(["Prompt one", "Prompt two"], stableRandom);
  assert.equal(round.prompt, "Prompt one");
  round = submitRoundAnswer(round, "faroe", "answer one", stableRandom);
  round = submitRoundAnswer(round, "erin", "answer two", stableRandom);
  assert.equal(round.phase, "submissions");
  round = submitRoundAnswer(round, "kaz", "answer three", stableRandom);
  assert.equal(round.phase, "voting");
  assert.deepEqual(round.responses.map(({ text }) => text).sort(), ["answer one", "answer three", "answer two"]);
  assert.equal(submitRoundAnswer(round, "other", "nope"), round);
});

test("votes are validated, counted, and tied top answers are both winners", () => {
  let round = createQuiplashRound(["Prompt"], stableRandom);
  for (const player of CARD_GAME_PLAYERS) round = submitRoundAnswer(round, player, `answer ${player}`, stableRandom);
  assert.equal(recordAudienceVote(round, "missing"), round);
  round = recordAudienceVote(round, round.responses[0].id, 2);
  round = recordAudienceVote(round, round.responses[1].id, 2);
  round = revealAudienceResults(round);
  assert.equal(round.phase, "results");
  assert.equal(round.winnerIds.length, 2);
  assert.equal(recordAudienceVote(round, round.responses[2].id), round);
});

test("shop card lines require a safe nonnegative bracketed price", () => {
  const parsed = parseShopCardList("Rhyming Time [500]\nThe Punishment [0]\nmissing price\nBad [9007199254740992]");
  assert.deepEqual(parsed.cards, [{ name: "Rhyming Time", price: 500 }, { name: "The Punishment", price: 0 }]);
  assert.equal(parsed.invalid.length, 2);
});

test("shop round exposes one card per category and does not reveal or charge before purchase", () => {
  const round = createShopRound({
    penalty: [{ name: "The Punishment", price: 200 }],
    challenge: [{ name: "Rhyming Time", price: 500 }],
    instant: [{ name: "Lucky Berry", price: 100 }],
  }, stableRandom);
  assert.equal(round.cards.length, 3);
  assert.ok(round.cards.every((card) => !card.revealed && !card.buyer));
  assert.equal(createShopRound({ penalty: [], challenge: [{ name: "x", price: 1 }], instant: [{ name: "y", price: 2 }] }), null);
});

test("Smeemo creates nine cards with one hidden result and a shuffled order", () => {
  const game = createSmeemoGame(stableRandom);
  assert.equal(game.phase, "preview");
  assert.equal(game.cards.length, 9);
  assert.equal(game.cards.filter((card) => card.smeemo).length, 1);
  assert.equal(new Set(game.cards.map(({ id }) => id)).size, 9);
  assert.equal(new Set(game.previewOrder).size, 9);
  assert.deepEqual([...game.previewOrder].sort(), game.cards.map(({ id }) => id).sort());
  assert.notDeepEqual(game.previewOrder, game.cards.map(({ id }) => id));
});

test("a completed Smeemo game can be started again as a fresh round", () => {
  let first = createSmeemoGame(stableRandom);
  for (const phase of ["preview", "stacking", "stacked", "dealing"]) first = advanceSmeemoPhase(first, phase);
  const smeemo = first.cards.find((card) => card.smeemo);
  first = drawSmeemoCard(first, smeemo.id).game;
  assert.equal(first.status, "complete");

  const next = createSmeemoGame(stableRandom);
  assert.notEqual(next.id, first.id);
  assert.equal(next.status, "playing");
  assert.equal(next.phase, "preview");
  assert.deepEqual(next.draws, []);
  assert.equal(next.cards.filter((card) => card.smeemo).length, 1);
});

test("Smeemo advances through its host-controlled reveal animation phases", () => {
  let game = createSmeemoGame(stableRandom);
  assert.equal(drawSmeemoCard(game, game.cards[0].id).error, "not-ready");
  for (const [phase, next] of [["preview", "stacking"], ["stacking", "stacked"], ["stacked", "dealing"], ["dealing", "ready"]]) {
    const old = game;
    assert.equal(advanceSmeemoPhase(game, "wrong-phase"), old);
    game = advanceSmeemoPhase(game, phase);
    assert.equal(game.phase, next);
  }
  assert.equal(advanceSmeemoPhase(game, "ready"), game);
});

test("Smeemo reveals only the host-selected card, with no player or turn assignment", () => {
  let game = createSmeemoGame(() => 0.5);
  for (const phase of ["preview", "stacking", "stacked", "dealing"]) game = advanceSmeemoPhase(game, phase);
  const blank = game.cards.find((card) => !card.smeemo);
  const first = drawSmeemoCard(game, blank.id);
  assert.equal(first.error, "");
  assert.deepEqual(first.draw, { id: blank.id, smeemo: false });
  assert.equal("player" in first.draw, false);
  assert.deepEqual(first.game.draws.map(({ id }) => id), [blank.id]);
  assert.equal(drawSmeemoCard(first.game, blank.id).error, "already-revealed");

  const smeemo = first.game.cards.find((card) => card.smeemo);
  const found = drawSmeemoCard(first.game, smeemo.id);
  assert.deepEqual(found.draw, { id: smeemo.id, smeemo: true });
  assert.equal(found.game.status, "complete");
  assert.equal(found.game.phase, "complete");
  assert.equal(drawSmeemoCard(found.game, game.cards[2].id).error, "not-playing");
});

test("legacy Smeemo state migrates without carrying player-turn labels forward", () => {
  const cards = Array.from({ length: 9 }, (_, index) => ({ id: `legacy-${index + 1}`, smeemo: index === 6 }));
  const migrated = normalizeCardGamesState({
    smeemo: {
      status: "playing",
      piles: { faroe: cards.slice(1, 3), erin: cards.slice(3, 6), kaz: cards.slice(6, 9) },
      draws: [{ id: "legacy-1", player: "faroe", smeemo: false }],
      turnCursor: 1,
    },
  }).smeemo;
  assert.equal(migrated.cards.length, 9);
  assert.equal(migrated.phase, "ready");
  assert.deepEqual(migrated.draws, [{ id: "legacy-1", smeemo: false }]);
  assert.equal("turnCursor" in migrated, false);
  assert.equal("winner" in migrated, false);
});
