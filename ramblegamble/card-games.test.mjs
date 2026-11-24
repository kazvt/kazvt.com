import test from "node:test";
import assert from "node:assert/strict";
import {
  CARD_GAME_PLAYERS,
  createQuiplashRound,
  createRedHandedRound,
  createShopRound,
  createSmeemoGame,
  drawSmeemoCard,
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

test("Smeemo is exactly one of nine cards distributed three per fixed player", () => {
  const game = createSmeemoGame(stableRandom);
  assert.deepEqual(Object.keys(game.piles), CARD_GAME_PLAYERS);
  assert.ok(CARD_GAME_PLAYERS.every((player) => game.piles[player].length === 3));
  assert.equal(CARD_GAME_PLAYERS.flatMap((player) => game.piles[player]).filter((card) => card.smeemo).length, 1);
});

test("Smeemo draws advance in player order, skip empty piles, and stop immediately on the berry", () => {
  let game = createSmeemoGame(() => 0.5);
  const total = CARD_GAME_PLAYERS.flatMap((player) => game.piles[player]).length;
  const order = [];
  let smeemoDrawn = false;
  for (let count = 0; count < total; count += 1) {
    const result = drawSmeemoCard(game);
    assert.ok(result.draw);
    order.push(result.draw.player);
    game = result.game;
    if (result.draw.smeemo) {
      smeemoDrawn = true;
      assert.equal(game.status, "complete");
      assert.equal(game.winner, result.draw.player);
      break;
    }
  }
  assert.equal(smeemoDrawn, true);
  assert.deepEqual(order.slice(0, 3), ["faroe", "erin", "kaz"]);
  assert.equal(drawSmeemoCard(game).draw, null);
});
