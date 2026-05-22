// =============================================
// BALATRO BLACKJACK - Casino Cheats (Jokers)
// =============================================

export const ALL_CHEATS = [
  {
    id: 'card_counter',
    name: 'Card Counter',
    description: 'Shows the next card in the deck',
    rarity: 'common',
    cost: 35,
    emoji: '👁️',
    effect: (ctx) => {
      // Handled in UI layer - shows next card
      return ctx;
    },
  },
  {
    id: 'marked_aces',
    name: 'Marked Aces',
    description: 'Aces are 50% more likely to be drawn',
    rarity: 'uncommon',
    cost: 50,
    emoji: '🃏',
    effect: (ctx) => {
      // Handled in deck drawing logic
      return ctx;
    },
  },
  {
    id: 'double_down_double',
    name: 'Double Double',
    description: 'Double Down multiplies final Mult by x1.5',
    rarity: 'uncommon',
    cost: 55,
    emoji: '💰',
    applyToScore: (score, ctx) => {
      if (ctx.didDoubleDown) {
        return { ...score, mult: score.mult * 1.5 };
      }
      return score;
    },
  },
  {
    id: 'bust_buffer',
    name: 'Bust Buffer',
    description: 'Once per round, survive a bust (the card is discarded)',
    rarity: 'mythic',
    cost: 1000,
    emoji: '🛡️',
    // Handled in game logic
    charges: 1,
  },
  {
    id: 'lucky_7s',
    name: 'Lucky 7s',
    description: 'Each 7 gives +15 Chips and +1.5 Mult',
    rarity: 'common',
    cost: 40,
    emoji: '🍀',
    // Handled in engine.js getCardBonuses
  },
  {
    id: 'blackjack_jackpot',
    name: 'Blackjack Jackpot',
    description: 'Natural Blackjack gives x2 Mult',
    rarity: 'rare',
    cost: 65,
    emoji: '🎰',
    applyToScore: (score, ctx) => {
      if (ctx.isNaturalBlackjack) {
        return { ...score, mult: score.mult * 2 };
      }
      return score;
    },
  },
  {
    id: 'under_the_table',
    name: 'Under the Table',
    description: 'Discard one card per round and draw a replacement',
    rarity: 'uncommon',
    cost: 45,
    emoji: '🔄',
    charges: 1,
    // Handled in game logic - adds a "Swap" action
  },
  {
    id: 'high_roller',
    name: 'High Roller',
    description: 'If bet ≥ $50, +20 Chips and +0.8 Mult',
    rarity: 'common',
    cost: 35,
    emoji: '🎲',
    applyToScore: (score, ctx) => {
      if (ctx.currentBet >= 50) {
        return { chips: score.chips + 20, mult: score.mult + 0.8 };
      }
      return score;
    },
  },
  {
    id: 'loaded_deck',
    name: 'Loaded Deck',
    description: 'Face cards give much more Mult',
    rarity: 'uncommon',
    cost: 50,
    emoji: '📦',
    // Handled in scoring: modifies face card mult from 1 to 5
  },
  {
    id: 'card_cloner',
    name: 'Card Cloner',
    description: 'Doubling Down deals 2 cards instead of 1!',
    rarity: 'rare',
    cost: 80,
    emoji: '👯',
    // Handled in game logic
  },
  {
    id: 'dealers_tax',
    name: "Dealer's Tax",
    description: 'If the dealer busts, receive extra $10',
    rarity: 'common',
    cost: 30,
    emoji: '💸',
    // Handled in round evaluation
  },
];

export function getRandomCheats(count, ownedIds = []) {
  const available = ALL_CHEATS.filter(c => !ownedIds.includes(c.id));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
