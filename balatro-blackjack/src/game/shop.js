// =============================================
// BALATRO BLACKJACK - Shop Item Generation
// =============================================

import { RANKS, HAND_SCORES } from './constants.js';
import { getRandomCheats } from './cheats.js';

const CARD_UPGRADE_NAMES = {
  '2': 'Deuce Boost', '3': 'Triple Threat', '4': 'Four Leaf', '5': 'High Five',
  '6': 'Lucky Six', '7': 'Seven Star', '8': 'Eight Ball', '9': 'Nine Lives',
  'J': 'Jack Pot', 'Q': 'Queen\'s Grace', 'K': 'King\'s Crown', 'A': 'Ace Up',
};

const HAND_UPGRADE_NAMES = {
  under17: 'Low Stand+', 17: 'Stand 17+', 18: 'Stand 18+', 19: 'Stand 19+',
  20: 'Stand 20+', 21: 'Perfect 21+', blackjack: 'Blackjack+',
};

export function generateShopItems(ante, ownedCheatIds, cash) {
  const items = [];

  // 2 cheats
  const cheats = getRandomCheats(2, ownedCheatIds);
  for (const cheat of cheats) {
    items.push({
      type: 'cheat',
      id: `shop_cheat_${cheat.id}`,
      cheat,
      name: cheat.name,
      description: cheat.description,
      cost: Math.round(cheat.cost * (1 + (ante - 1) * 0.15)),
      emoji: cheat.emoji,
    });
  }

  // 1 card upgrade
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
  const chipBonus = 5 + Math.floor(Math.random() * 10) + ante * 2;
  const multBonus = Math.round((0.5 + Math.random() * 1.5) * 10) / 10;
  items.push({
    type: 'cardUpgrade',
    id: `shop_card_${rank}_${Date.now()}`,
    rank,
    name: CARD_UPGRADE_NAMES[rank],
    description: `All ${rank}s: +${chipBonus} Chips, +${multBonus} Mult`,
    cost: 20 + ante * 5 + Math.floor(Math.random() * 15),
    chipBonus,
    multBonus,
    emoji: '⬆️',
  });

  // 1 hand upgrade
  const handKeys = Object.keys(HAND_SCORES);
  const handKey = handKeys[Math.floor(Math.random() * handKeys.length)];
  const hChipBonus = 10 + Math.floor(Math.random() * 20) + ante * 5;
  const hMultBonus = Math.round((0.3 + Math.random() * 1.0) * 10) / 10;
  items.push({
    type: 'handUpgrade',
    id: `shop_hand_${handKey}_${Date.now()}`,
    handKey,
    name: HAND_UPGRADE_NAMES[handKey],
    description: `${HAND_SCORES[handKey].label}: +${hChipBonus} Chips, +${hMultBonus} Mult`,
    cost: 25 + ante * 6 + Math.floor(Math.random() * 20),
    chipBonus: hChipBonus,
    multBonus: hMultBonus,
    emoji: '🎯',
  });

  // 1 deck modification
  const deckModRoll = Math.random();
  if (deckModRoll < 0.5) {
    // Add an ace
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const suit = suits[Math.floor(Math.random() * suits.length)];
    items.push({
      type: 'deckMod',
      id: `shop_deck_add_A_${suit}_${Date.now()}`,
      modAction: { type: 'add', rank: 'A', suit },
      name: 'Extra Ace',
      description: `Add an Ace of ${suit} to your deck`,
      cost: 30 + ante * 8,
      emoji: '➕',
    });
  } else {
    // Remove a low card
    const lowRanks = ['2', '3', '4', '5'];
    const removeRank = lowRanks[Math.floor(Math.random() * lowRanks.length)];
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const suit = suits[Math.floor(Math.random() * suits.length)];
    items.push({
      type: 'deckMod',
      id: `shop_deck_remove_${removeRank}_${suit}_${Date.now()}`,
      modAction: { type: 'remove', rank: removeRank, suit },
      name: `Trim ${removeRank}`,
      description: `Remove a ${removeRank} of ${suit} from your deck`,
      cost: 15 + ante * 4,
      emoji: '✂️',
    });
  }

  return items;
}
