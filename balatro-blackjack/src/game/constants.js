// =============================================
// BALATRO BLACKJACK - Game Constants
// =============================================

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
export const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};
export const SUIT_COLORS = {
  hearts: '#ff4757',
  diamonds: '#ff6b81',
  clubs: '#a4b0be',
  spades: '#dfe4ea',
};

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'J', 'Q', 'K', 'A'];

export const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'J': 10, 'Q': 10, 'K': 10, 'A': 11,
};

// Base chips/mult for each hand total
export const HAND_SCORES = {
  under17: { chips: 10, mult: 1.0, label: 'Low Stand' },
  17: { chips: 15, mult: 1.2, label: 'Stand 17' },
  18: { chips: 25, mult: 1.4, label: 'Stand 18' },
  19: { chips: 35, mult: 1.6, label: 'Stand 19' },
  20: { chips: 50, mult: 2.0, label: 'Stand 20' },
  21: { chips: 70, mult: 2.5, label: 'Perfect 21' },
  blackjack: { chips: 100, mult: 4.0, label: 'BLACKJACK' },
};

// Card score modifiers: how much each card adds to chips/mult
export const CARD_SCORE = {
  number: (rank) => ({ chips: RANK_VALUES[rank], mult: 0 }),
  face: { chips: 10, mult: 1 },       // J, Q, K
  ace: { chips: 11, mult: 2 },         // Ace (chips depend on player choice)
};

// Casino names for each ante
export const CASINO_NAMES = [
  'The Rusty Chip',
  'Neon Lounge',
  'Silver Dollar',
  'The Velvet Room',
  'Golden Nugget',
  'Diamond Palace',
  'Midnight Royale',
  'The Grand Jackpot',
];

// Dealer HP per ante per blind type
// Blackjack = instant kill, other wins do % damage based on score
export function getDealerHP(ante, blindType) {
  // Base HP scaling for each Ante to ensure exponential difficulty curve
  // and strict increases between Boss of previous Ante and Small of next Ante.
  const baseScale = [
    120,       // Ante 1
    450,       // Ante 2
    1600,      // Ante 3
    6000,      // Ante 4
    25000,     // Ante 5
    100000,    // Ante 6
    400000,    // Ante 7
    1500000    // Ante 8
  ];
  
  const safeAnte = Math.min(ante, baseScale.length - 1);
  const base = baseScale[safeAnte];

  const multipliers = {
    small: 1,
    big: 2,
    boss: 3.5,
  };

  return Math.round(base * multipliers[blindType]);
}

// How much damage a winning hand deals (percentage of max HP turned into flat damage)
// Blackjack = instant kill (100% HP)
// Other wins: damage = score.total * multiplier
export function calculateDamage(score, isNaturalBlackjack, dealerMaxHP, bet = 10) {
  if (isNaturalBlackjack) {
    return dealerMaxHP; // One-shot
  }
  // Base damage from score, then scaled by bet
  // betFactor: betting $10 = 1x, $25 = 1.6x, $50 = 2.5x, $100 = 4x
  const betFactor = 0.5 + (bet / 20);
  const scoreTotal = score.chips * score.mult;
  const damage = Math.round(scoreTotal * 0.3 * betFactor);
  return Math.max(1, damage);
}

// Ante configuration: each ante has 3 blinds (must be played in order)
export const ANTE_CONFIG = Array.from({ length: 8 }, (_, i) => {
  const ante = i + 1;
  return {
    ante,
    name: CASINO_NAMES[i],
    blinds: [
      {
        type: 'small',
        label: 'Small Blind',
        minBet: 5 + i * 5,
        dealerHP: getDealerHP(i, 'small'),
      },
      {
        type: 'big',
        label: 'Big Blind',
        minBet: 10 + i * 8,
        dealerHP: getDealerHP(i, 'big'),
      },
      {
        type: 'boss',
        label: 'Boss Blind',
        minBet: 15 + i * 12,
        dealerHP: getDealerHP(i, 'boss'),
        modifier: null, // will be set dynamically
      },
    ],
  };
});

// Boss blind modifiers
export const BOSS_MODIFIERS = [
  { id: 'no_ace_11', name: 'Rigid Aces', description: 'Aces can only count as 1' },
  { id: 'dealer_3_cards', name: 'Stacked Deck', description: 'Dealer starts with 3 cards' },
  { id: 'face_no_mult', name: 'Plain Face', description: 'Face cards give no Mult bonus' },
  { id: 'min_stand_18', name: 'High Stakes', description: 'Must reach at least 18 to Stand' },
  { id: 'no_double', name: 'No Doubles', description: 'Double Down is disabled' },
  { id: 'blind_draw', name: 'Blind Draw', description: 'You cannot see your first card' },
  { id: 'dealer_peeks', name: 'Dealer Peeks', description: 'Dealer hits until 18 instead of 17' },
  { id: 'half_payout', name: 'House Edge', description: 'Payouts are halved' },
];

// Starting player state
export const STARTING_CASH = 150;
export const MAX_CHEAT_SLOTS = 5;
export const HANDS_PER_BLIND = 8; // number of rounds to play per blind

// Shop prices
export const SHOP_PRICES = {
  cheat: { min: 30, max: 80 },
  cardUpgrade: { min: 20, max: 50 },
  handUpgrade: { min: 25, max: 60 },
  deckMod: { min: 15, max: 45 },
};
