const CATEGORY_NAMES = {
  as: 'Ás',
  duque: 'Duque',
  terno: 'Terno',
  quadra: 'Quadra',
  quina: 'Quina',
  sena: 'Sena',
  fu: 'Fu',
  seguida: 'Seguida',
  quadrada: 'Quadrada',
  general: 'General'
};

const NUMBER_CATEGORIES = {
  as: 1,
  duque: 2,
  terno: 3,
  quadra: 4,
  quina: 5,
  sena: 6
};

function rollDice() {
  return Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
}

function getCounts(dice) {
  return dice.reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function calculateScores(dice) {
  const counts = getCounts(dice);
  const frequencies = Object.values(counts).sort((a, b) => a - b);
  const scores = {};

  for (const [category, face] of Object.entries(NUMBER_CATEGORIES)) {
    scores[category] = dice.filter(value => value === face).length * face;
  }

  scores.fu = frequencies.join(',') === '2,3' ? 20 : 0;
  scores.seguida = [
    [1, 2, 3, 4, 5],
    [2, 3, 4, 5, 6]
  ].some(sequence => sequence.every(value => dice.includes(value))) ? 30 : 0;
  scores.quadrada = frequencies.join(',') === '1,4' ? 40 : 0;
  scores.general = frequencies.length === 1 ? 50 : 0;

  return scores;
}

function createGame(ownerId, rounds) {
  return {
    ownerId,
    rounds,
    currentRound: 0,
    currentPlayerIndex: 0,
    players: [],
    started: false,
    finished: false
  };
}

function addPlayer(game, user) {
  if (game.started) return { error: 'A partida já começou.' };
  if (game.players.length >= 6) {
    return { error: 'O jogo permite no máximo 6 jogadores.' };
  }
  if (game.players.some(player => player.id === user.id)) {
    return { error: 'Você já está nesta partida.' };
  }

  game.players.push({
    id: user.id,
    name: user.globalName || user.username,
    scores: {},
    total: 0,
    dice: null,
    availableScores: null
  });

  return { player: game.players.at(-1) };
}

function startGame(game) {
  if (game.started) return { error: 'A partida já começou.' };
  if (game.players.length < 2) return { error: 'É preciso ter pelo menos 2 jogadores para iniciar.' };

  game.started = true;
  game.currentRound = 1;
  game.currentPlayerIndex = 0;
  return { player: game.players[0] };
}

function getCurrentPlayer(game) {
  return game.players[game.currentPlayerIndex];
}

function rollForCurrentPlayer(game) {
  if (!game.started || game.finished) return { error: 'Não há uma partida em andamento.' };

  const player = getCurrentPlayer(game);
  if (player.dice) return { error: 'Você já rolou. Escolha uma categoria com `/bozo-marcar`.' };

  player.dice = rollDice();
  player.availableScores = calculateScores(player.dice);
  return { player, dice: player.dice, scores: player.availableScores };
}

function scoreCurrentPlayer(game, category) {
  if (!game.started || game.finished) return { error: 'Não há uma partida em andamento.' };

  const player = getCurrentPlayer(game);
  if (!player.dice) return { error: 'Primeiro use `/bozo-confirmar` para rolar os dados.' };
  if (!CATEGORY_NAMES[category]) return { error: 'Categoria inválida.' };
  if (Object.hasOwn(player.scores, category)) return { error: 'Você já usou essa categoria.' };

  const points = player.availableScores[category];
  player.scores[category] = points;
  player.total += points;
  player.dice = null;
  player.availableScores = null;

  const lastPlayerInRound = game.currentPlayerIndex === game.players.length - 1;
  const lastRound = game.currentRound === game.rounds;

  if (lastPlayerInRound && lastRound) {
    game.finished = true;
    return { player, points, finished: true };
  }

  if (lastPlayerInRound) {
    game.currentRound += 1;
    game.currentPlayerIndex = 0;
  } else {
    game.currentPlayerIndex += 1;
  }

  return { player, points, nextPlayer: getCurrentPlayer(game), finished: false };
}

function formatScores(scores) {
  return Object.entries(scores)
    .filter(([, points]) => points > 0)
    .map(([category, points]) => `${CATEGORY_NAMES[category]}: ${points}`)
    .join(' | ') || 'nenhuma combinação pontuável';
}

module.exports = {
  CATEGORY_NAMES,
  calculateScores,
  createGame,
  addPlayer,
  startGame,
  getCurrentPlayer,
  rollForCurrentPlayer,
  scoreCurrentPlayer,
  formatScores
};
