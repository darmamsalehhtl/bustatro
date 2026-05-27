// =============================================
// BALATRO BLACKJACK - Core Game Engine
// =============================================

import { SUITS, RANKS, RANK_VALUES, HAND_SCORES, BOSS_MODIFIERS } from './constants.js';

// --- Deck Utilities ---

let cardIdCounter = 0;

export function createDeck(deckMods = [], cheats = []) {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, id: `${rank}_${suit}_${++cardIdCounter}` });
    }
  }

  // Apply deck modifications
  for (const mod of deckMods) {
    if (mod.type === 'add') {
      deck.push({ rank: mod.rank, suit: mod.suit, id: `${mod.rank}_${mod.suit}_${++cardIdCounter}` });
    } else if (mod.type === 'remove') {
      const idx = deck.findIndex(c => c.rank === mod.rank && c.suit === mod.suit);
      if (idx !== -1) deck.splice(idx, 1);
    }
  }

  // Apply marked_aces cheat: add 2 extra Aces to increase probability by ~50%
  const hasMarkedAces = cheats.some(c => c.id === 'marked_aces');
  if (hasMarkedAces) {
    deck.push({ rank: 'A', suit: 'spades', id: `A_spades_${++cardIdCounter}_marked` });
    deck.push({ rank: 'A', suit: 'hearts', id: `A_hearts_${++cardIdCounter}_marked` });
  }

  return deck;
}

export function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function drawCard(deck, cheats = []) {
  if (deck.length === 0) return { card: null, deck };

  const card = deck[0];
  const remaining = deck.slice(1);
  return { card, deck: remaining };
}

// --- Hand Evaluation ---

export function getHandTotal(cards, aceChoices = {}) {
  let total = 0;
  for (const card of cards) {
    if (card.rank === 'A') {
      const choice = aceChoices[card.id];
      total += choice === 1 ? 1 : choice === 11 ? 11 : 11; // default to 11
    } else {
      total += RANK_VALUES[card.rank];
    }
  }
  return total;
}

export function isBlackjack(cards) {
  if (cards.length !== 2) return false;
  const hasAce = cards.some(c => c.rank === 'A');
  const hasTen = cards.some(c => ['J', 'Q', 'K'].includes(c.rank));
  return hasAce && hasTen;
}

export function isBust(total) {
  return total > 21;
}

export function isFaceCard(rank) {
  return ['J', 'Q', 'K'].includes(rank);
}

// --- Scoring ---

export function getHandScoreKey(total, isNatural) {
  if (isNatural) return 'blackjack';
  if (total === 21) return '21';
  if (total === 20) return '20';
  if (total === 19) return '19';
  if (total === 18) return '18';
  if (total === 17) return '17';
  return 'under17';
}

export function getCardBonuses(card, cheats = [], cardUpgrades = {}) {
  let chips = 0;
  let mult = 0;
  const hasLoadedDeck = cheats.some(c => c.id === 'loaded_deck');
  const cardUpgrade = cardUpgrades[card.rank] || { chips: 0, mult: 0 };
  
  if (card.rank === 'A') {
    chips = 3 + cardUpgrade.chips;
    mult = 0.5 + cardUpgrade.mult;
  } else if (isFaceCard(card.rank)) {
    chips = 4 + cardUpgrade.chips;
    mult = (hasLoadedDeck ? 1.5 : 0.3) + cardUpgrade.mult;
  } else {
    chips = Math.floor(RANK_VALUES[card.rank] / 2) + cardUpgrade.chips;
    mult = 0 + cardUpgrade.mult;
  }
  
  // Apply Lucky 7s cheat bonus directly to the 7 card visually, although it's calculated differently globally.
  // Wait, no, let's just make Lucky 7s give its bonus to EACH 7! It makes more sense.
  // We'll update the cheat later, but for now let's apply it here so it shows on the card.
  if (card.rank === '7' && cheats.some(c => c.id === 'lucky_7s')) {
    chips += 15;
    mult += 1.5;
  }

  return { chips, mult };
}

export function calculateScore(cards, aceChoices, cheats = [], handUpgrades = {}, cardUpgrades = {}, context = {}) {
  const total = getHandTotal(cards, aceChoices);
  const isNatural = isBlackjack(cards);
  const scoreKey = getHandScoreKey(total, isNatural);
  const baseScore = HAND_SCORES[scoreKey];

  // Start with base hand score + any upgrades to this hand level
  const handUpgrade = handUpgrades[scoreKey] || { chips: 0, mult: 0 };
  let chips = baseScore.chips + handUpgrade.chips;
  let mult = baseScore.mult + handUpgrade.mult;

  // Add card-level scoring
  for (const card of cards) {
    const cardBonus = getCardBonuses(card, cheats, cardUpgrades);
    chips += cardBonus.chips;
    mult += cardBonus.mult;
    
    // Note: Since we are adding Lucky 7s directly to the card above, we should NOT apply it globally anymore!
    // But wait, the cheat still has `applyToScore`. We will need to remove `applyToScore` from Lucky 7s in cheats.js so it doesn't double-dip.
  }

  let score = { chips, mult };

  // Apply cheat effects
  const ctx = {
    ...context,
    playerCards: cards,
    isNaturalBlackjack: isNatural,
  };

  for (const cheat of cheats) {
    if (cheat.applyToScore) {
      score = cheat.applyToScore(score, ctx);
    }
  }

  // Boss modifier: face cards give no mult
  if (context.bossModifier === 'face_no_mult') {
    // Recalculate without face card mult
    let faceMultRemoved = 0;
    const hasLoadedDeck = cheats.some(c => c.id === 'loaded_deck');
    for (const card of cards) {
      if (isFaceCard(card.rank)) {
        faceMultRemoved += (hasLoadedDeck ? 1.5 : 0.3) + (cardUpgrades[card.rank]?.mult || 0);
      }
    }
    score.mult = Math.max(0.5, score.mult - faceMultRemoved);
  }

  // Boss modifier: half payout
  if (context.bossModifier === 'half_payout') {
    score.chips = Math.round(score.chips / 2);
  }

  return {
    chips: Math.round(score.chips),
    mult: Math.round(score.mult * 100) / 100,
    total: Math.round(score.chips * score.mult),
    handLabel: baseScore.label,
    handTotal: total,
  };
}

// --- Dealer AI ---

export function dealerShouldHit(cards, aceChoices, bossModifier) {
  const threshold = bossModifier === 'dealer_peeks' ? 18 : 17;
  const total = getHandTotal(cards, aceChoices);
  return total < threshold;
}

export function getDealerAceChoices(cards) {
  // Dealer always plays optimally with aces
  const choices = {};
  let total = 0;

  // First pass: count non-aces and set all aces to 11
  const aces = [];
  for (const card of cards) {
    if (card.rank === 'A') {
      aces.push(card);
      choices[card.id] = 11;
      total += 11;
    } else {
      total += RANK_VALUES[card.rank];
    }
  }

  // Convert aces from 11 to 1 as needed
  for (const ace of aces) {
    if (total > 21) {
      choices[ace.id] = 1;
      total -= 10;
    }
  }

  return choices;
}

// --- Boss Modifier Selection ---

export function getRandomBossModifier(ante) {
  const idx = Math.floor(Math.random() * BOSS_MODIFIERS.length);
  return BOSS_MODIFIERS[idx];
}

// --- Payout Calculation ---

export function calculatePayout(bet, score) {
  return Math.round(bet * (1 + score.chips * score.mult * 0.005));
}
