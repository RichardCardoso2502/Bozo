const test = require('node:test');
const assert = require('node:assert/strict');
const { CATEGORY_NAMES, createGame, endGame, formatPlayerScore } = require('./game');

function makePlayer(id, count, total) {
  return {
    id,
    total,
    scores: Object.fromEntries(Object.keys(CATEGORY_NAMES).slice(0, count).map(category => [category, 1]))
  };
}

test('classic prioritizes all ten combinations over a higher score', () => {
  const game = createGame('owner', 10);
  game.players = [makePlayer('high', 9, 200), makePlayer('complete', 10, 100)];
  const { ranking } = endGame(game);
  assert.match(ranking, /^1\. <@complete>: 100 pontos/);
  assert.equal(game.finished, true);
  assert.equal(game.players[0].id, 'high');
});

test('classic uses points when nobody completes all combinations', () => {
  const game = createGame('owner', 10);
  game.players = [makePlayer('more', 9, 100), makePlayer('high', 5, 200)];
  assert.match(endGame(game).ranking, /^1\. <@high>: 200 pontos/);
});

test('classic uses points between players with all combinations', () => {
  const game = createGame('owner', 10);
  game.players = [makePlayer('low', 10, 100), makePlayer('high', 10, 200)];
  assert.match(endGame(game).ranking, /^1\. <@high>: 200 pontos/);
});

test('games with three to nine rounds retain score-only ranking and display', () => {
  for (let rounds = 3; rounds < 10; rounds++) {
    const game = createGame('owner', rounds);
    game.players = [makePlayer('complete', 10, 100), makePlayer('high', 5, 200)];
    assert.equal(endGame(game).ranking, '1. <@high>: 200 pontos\n2. <@complete>: 100 pontos');
    assert.equal(formatPlayerScore(game, game.players[0]), '100 pontos');
  }
});

test('classic counts only valid combinations with positive points', () => {
  const game = createGame('owner', 10);
  const player = makePlayer('player', 0, 5);
  assert.match(formatPlayerScore(game, player), /\(0\/10 /);
  player.scores = { as: 5, duque: 0, unknown: 50 };
  assert.match(formatPlayerScore(game, player), /\(1\/10 /);
  const complete = makePlayer('complete', 10, 100);
  assert.match(formatPlayerScore(game, complete), /\(10\/10 /);
});