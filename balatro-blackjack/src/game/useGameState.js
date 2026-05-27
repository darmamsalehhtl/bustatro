// =============================================
// BALATRO BLACKJACK - Game State Hook
// Fixes: bust continuation, double ace choice, forced blind order
// New: dealer HP system (blackjack = one-shot)
// =============================================

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  createDeck, shuffleDeck, drawCard, getHandTotal, isBlackjack,
  isBust, calculateScore, dealerShouldHit, getDealerAceChoices,
  calculatePayout, getRandomBossModifier,
} from './engine.js';
import {
  ANTE_CONFIG, STARTING_CASH, MAX_CHEAT_SLOTS, HANDS_PER_BLIND,
  calculateDamage,
} from './constants.js';
import { generateShopItems } from './shop.js';
import { ALL_CHEATS } from './cheats.js';
import { sfxCardDeal, sfxHit, sfxBust, sfxWin, sfxLose, sfxBuy, sfxBlackjack, sfxChips } from './sounds.js';

const PHASES = {
  MENU: 'menu',
  BLIND_INTRO: 'blind_intro',   // shows the current blind before betting
  BETTING: 'betting',
  PLAYING: 'playing',
  ACE_CHOICE: 'ace_choice',
  DEALER_TURN: 'dealer_turn',
  ROUND_RESULT: 'round_result',
  SHOP: 'shop',
  GAME_OVER: 'game_over',
  GAME_WON: 'game_won',
  RULES: 'rules',
  GOD_MODE_SETUP: 'god_mode_setup',
};

export { PHASES };

function createInitialState() {
  return {
    phase: PHASES.MENU,
    cash: STARTING_CASH,
    ante: 0,          // 0-indexed, maps to ANTE_CONFIG
    blindIndex: 0,    // 0=small, 1=big, 2=boss (always sequential)
    handsRemaining: HANDS_PER_BLIND,

    // Dealer HP
    dealerMaxHP: 0,
    dealerCurrentHP: 0,

    // Deck
    deck: [],
    deckMods: [],

    // Current round
    playerCards: [],
    dealerCards: [],
    aceChoices: {},       // { cardId: 1 | 11 }
    dealerAceChoices: {},
    currentBet: 0,
    didDoubleDown: false,
    bustBufferUsed: false,
    swapUsed: false,
    swapMode: false,

    // After ace choice, where to go next
    aceReturnPhase: PHASES.PLAYING,  // PLAYING or DEALER_TURN

    // Upgrades
    cheats: [],
    cardUpgrades: {},
    handUpgrades: {},

    // Boss
    bossModifier: null,

    // Round result
    roundResult: null,

    // Shop
    shopItems: [],

    // Pending aces queue (for multiple ace choices)
    pendingAces: [],     // array of ace cards awaiting choice
    cheatTrigger: null,  // { id, emoji, text, ts }
  };
}

export function useGameState(currentUser) {
  const [state, setState] = useState(null);

  useEffect(() => {
    if (currentUser) {
      fetch(`/api/state/${currentUser}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.state) {
            setState(data.state);
          } else {
            setState(createInitialState());
          }
        })
        .catch(err => {
          console.error("Failed to load saved game state:", err);
          setState(createInitialState());
        });
    } else {
      setState(createInitialState());
    }
  }, [currentUser]);
  
  useEffect(() => {
    if (currentUser && state) {
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, state })
      }).catch(err => console.error("Failed to save game state:", err));
    }
  }, [state, currentUser]);
  const deckRef = useRef(state?.deck || []);
  // --- Actions ---

  const startGame = useCallback(() => {
    const s = createInitialState();
    s.phase = PHASES.BLIND_INTRO;
    s.cash = STARTING_CASH;
    s.ante = 0;
    s.blindIndex = 0;
    // Set up first blind HP
    const blind = ANTE_CONFIG[0].blinds[0];
    s.dealerMaxHP = blind.dealerHP;
    s.dealerCurrentHP = blind.dealerHP;
    s.handsRemaining = HANDS_PER_BLIND;
    setState(s);
  }, []);

  const startGodRun = useCallback((config) => {
    const s = createInitialState();
    s.phase = PHASES.BLIND_INTRO;
    s.cash = config.cash || STARTING_CASH;
    s.cheats = config.cheats || [];
    s.ante = 0;
    s.blindIndex = 0;
    const blind = ANTE_CONFIG[0].blinds[0];
    s.dealerMaxHP = blind.dealerHP;
    s.dealerCurrentHP = blind.dealerHP;
    s.handsRemaining = HANDS_PER_BLIND;
    setState(s);
  }, []);

  // Start the blind (from blind intro screen)
  const startBlind = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: PHASES.BETTING,
    }));
  }, []);

  const placeBet = useCallback((amount) => {
    setState(prev => {
      // Create and shuffle the deck
      const freshDeck = shuffleDeck(createDeck(prev.deckMods, prev.cheats));
      deckRef.current = freshDeck;

      // Deal 2 cards to player, 2 to dealer
      let deck = freshDeck;
      const playerCards = [];
      const dealerCards = [];

      for (let i = 0; i < 2; i++) {
        let result = drawCard(deck, prev.cheats);
        playerCards.push(result.card);
        deck = result.deck;

        result = drawCard(deck, []);
        dealerCards.push(result.card);
        deck = result.deck;
      }

      // Boss modifier: dealer starts with 3 cards
      if (prev.bossModifier?.id === 'dealer_3_cards') {
        const result = drawCard(deck, []);
        dealerCards.push(result.card);
        deck = result.deck;
      }

      deckRef.current = deck;
      const dealerAceChoices = getDealerAceChoices(dealerCards);

      sfxCardDeal();

      const isRigidAces = prev.bossModifier?.id === 'no_ace_11';
      const aceChoices = {};

      // Auto-set ace choices if rigid aces modifier
      if (isRigidAces) {
        for (const card of playerCards) {
          if (card.rank === 'A') aceChoices[card.id] = 1;
        }
      }

      // Check for natural blackjack (Ace + 10-value in first 2 cards)
      // For natural BJ: auto-set ace to 11 and skip to dealer turn
      const isNatBJ = isBlackjack(playerCards);

      if (isNatBJ) {
        // Sync the deck reference before skipping to dealer turn!
        deckRef.current = deck;
        // Auto-set the ace to 11 for natural blackjack
        for (const card of playerCards) {
          if (card.rank === 'A') aceChoices[card.id] = 11;
        }
        sfxBlackjack();
        return {
          ...prev,
          phase: PHASES.DEALER_TURN,
          currentBet: amount,
          playerCards,
          dealerCards,
          deck,
          aceChoices,
          dealerAceChoices,
          didDoubleDown: false,
          bustBufferUsed: false,
          swapUsed: false,
          swapMode: false,
          roundResult: null,
          pendingAces: [],
          aceReturnPhase: PHASES.PLAYING,
        };
      }

      // Collect all aces needing choices
      let pendingAces = [];
      if (!isRigidAces) {
        pendingAces = playerCards.filter(c => c.rank === 'A');
      }

      let phase = PHASES.PLAYING;
      if (pendingAces.length > 0) {
        phase = PHASES.ACE_CHOICE;
      }

      return {
        ...prev,
        phase,
        currentBet: amount,
        playerCards,
        dealerCards,
        deck,
        aceChoices,
        dealerAceChoices,
        didDoubleDown: false,
        bustBufferUsed: false,
        swapUsed: false,
        swapMode: false,
        roundResult: null,
        pendingAces,
        aceReturnPhase: PHASES.PLAYING,
      };
    });
  }, []);

  const chooseAceValue = useCallback((cardId, value) => {
    setState(prev => {
      const newAceChoices = { ...prev.aceChoices, [cardId]: value };
      // Remove this ace from the pending queue
      const remainingAces = prev.pendingAces.filter(c => c.id !== cardId);

      if (remainingAces.length > 0) {
        // More aces to choose
        return {
          ...prev,
          aceChoices: newAceChoices,
          pendingAces: remainingAces,
        };
      }

      // All aces chosen — check for bust before transitioning
      const total = getHandTotal(prev.playerCards, newAceChoices);

      if (isBust(total)) {
        // Check bust buffer
        const hasBustBuffer = prev.cheats.some(c => c.id === 'bust_buffer') && !prev.bustBufferUsed;
        if (hasBustBuffer) {
          sfxCardDeal();
          
          // Revert the ace draw (remove the card that caused the bust)
          const revertedCards = prev.playerCards.filter(c => c.id !== cardId);
          const revertedAceChoices = { ...newAceChoices };
          delete revertedAceChoices[cardId];
          
          return {
            ...prev,
            playerCards: revertedCards,
            aceChoices: revertedAceChoices,
            pendingAces: [],
            bustBufferUsed: true,
            phase: prev.aceReturnPhase,
          };
        }
        sfxBust();
        return {
          ...prev,
          aceChoices: newAceChoices,
          pendingAces: [],
          phase: PHASES.ROUND_RESULT,
          roundResult: {
            outcome: 'bust',
            playerTotal: total,
            dealerTotal: null,
            playerScore: null,
            dealerScore: null,
            payout: -prev.currentBet,
            damage: 0,
          },
        };
      }

      return {
        ...prev,
        aceChoices: newAceChoices,
        pendingAces: [],
        phase: prev.aceReturnPhase,
      };
    });
  }, []);

  const hit = useCallback(() => {
    setState(prev => {
      let deck = deckRef.current;
      const result = drawCard(deck, prev.cheats);
      if (!result.card) return prev;

      deck = result.deck;
      deckRef.current = deck;
      const newPlayerCards = [...prev.playerCards, result.card];
      sfxHit();

      const isRigidAces = prev.bossModifier?.id === 'no_ace_11';
      const aceChoices = { ...prev.aceChoices };

      // New card is an ace: need choice
      if (result.card.rank === 'A' && !isRigidAces) {
        return {
          ...prev,
          playerCards: newPlayerCards,
          deck,
          phase: PHASES.ACE_CHOICE,
          pendingAces: [result.card],
          aceReturnPhase: PHASES.PLAYING,
        };
      }

      // Auto-set ace to 1 if rigid aces
      if (result.card.rank === 'A' && isRigidAces) {
        aceChoices[result.card.id] = 1;
      }

      const total = getHandTotal(newPlayerCards, aceChoices);

      // Check bust
      if (isBust(total)) {
        const hasBustBuffer = prev.cheats.some(c => c.id === 'bust_buffer') && !prev.bustBufferUsed;
        if (hasBustBuffer) {
          sfxCardDeal();
          return {
            ...prev,
            // Do NOT add the busting card to the hand
            deck,
            bustBufferUsed: true,
            cheatTrigger: { id: 'bust_buffer', emoji: '🛡️', text: 'BUST PREVENTED!', ts: Date.now() },
          };
        }

        sfxBust();
        return {
          ...prev,
          playerCards: newPlayerCards,
          aceChoices,
          deck,
          phase: PHASES.ROUND_RESULT,
          roundResult: {
            outcome: 'bust',
            playerTotal: total,
            dealerTotal: null,
            playerScore: null,
            dealerScore: null,
            payout: -prev.currentBet,
            damage: 0,
          },
        };
      }

      return {
        ...prev,
        playerCards: newPlayerCards,
        aceChoices,
        deck,
      };
    });
  }, []);

  const stand = useCallback(() => {
    setState(prev => {
      if (prev.bossModifier?.id === 'min_stand_18') {
        const total = getHandTotal(prev.playerCards, prev.aceChoices);
        if (total < 18) return prev;
      }
      return { ...prev, phase: PHASES.DEALER_TURN };
    });
  }, []);

  const doubleDown = useCallback(() => {
    setState(prev => {
      if (prev.bossModifier?.id === 'no_double') return prev;
      if (prev.cash < prev.currentBet) return prev;

      let deck = deckRef.current;
      const hasCardCloner = prev.cheats.some(c => c.id === 'card_cloner');
      const cardsToDraw = hasCardCloner ? 2 : 1;
      
      let newPlayerCards = [...prev.playerCards];
      const pendingAces = [];
      const aceChoices = { ...prev.aceChoices };
      const isRigidAces = prev.bossModifier?.id === 'no_ace_11';
      let newCheatTrigger = null;

      for (let i = 0; i < cardsToDraw; i++) {
        const result = drawCard(deck, prev.cheats);
        if (!result.card) break;
        deck = result.deck;
        newPlayerCards.push(result.card);

        if (result.card.rank === 'A') {
          if (isRigidAces) {
            aceChoices[result.card.id] = 1;
          } else {
            pendingAces.push(result.card);
          }
        }
      }

      deckRef.current = deck;
      const newBet = prev.currentBet * 2;
      sfxHit();

      if (hasCardCloner) {
        newCheatTrigger = { id: 'card_cloner', emoji: '👯', text: 'DOUBLE DRAW!', ts: Date.now() };
      }

      if (pendingAces.length > 0) {
        // Need ace choice, then go to dealer turn
        return {
          ...prev,
          playerCards: newPlayerCards,
          deck,
          currentBet: newBet,
          didDoubleDown: true,
          phase: PHASES.ACE_CHOICE,
          pendingAces,
          aceReturnPhase: PHASES.DEALER_TURN,
          cheatTrigger: newCheatTrigger || prev.cheatTrigger,
        };
      }

      const total = getHandTotal(newPlayerCards, aceChoices);

      if (isBust(total)) {
        const hasBustBuffer = prev.cheats.some(c => c.id === 'bust_buffer') && !prev.bustBufferUsed;
        if (hasBustBuffer) {
          return {
            ...prev,
            // Do NOT add the busting card, but still charge the double bet and end the turn
            deck,
            currentBet: newBet,
            didDoubleDown: true,
            bustBufferUsed: true,
            phase: PHASES.DEALER_TURN,
            cheatTrigger: { id: 'bust_buffer', emoji: '🛡️', text: 'BUST PREVENTED!', ts: Date.now() },
          };
        }
        sfxBust();
        return {
          ...prev,
          playerCards: newPlayerCards,
          aceChoices,
          deck,
          currentBet: newBet,
          didDoubleDown: true,
          phase: PHASES.ROUND_RESULT,
          roundResult: {
            outcome: 'bust',
            playerTotal: total,
            dealerTotal: null,
            playerScore: null,
            dealerScore: null,
            payout: -newBet,
            damage: 0,
          },
        };
      }

      return {
        ...prev,
        playerCards: newPlayerCards,
        aceChoices,
        deck,
        currentBet: newBet,
        didDoubleDown: true,
        phase: PHASES.DEALER_TURN,
      };
    });
  }, []);

  const swapCard = useCallback((cardIndex) => {
    setState(prev => {
      if (prev.swapUsed) return prev;
      let deck = deckRef.current;
      const result = drawCard(deck, prev.cheats);
      if (!result.card) return prev;

      deck = result.deck;
      deckRef.current = deck;

      const newPlayerCards = [...prev.playerCards];
      const removedCard = newPlayerCards[cardIndex];
      newPlayerCards[cardIndex] = result.card;

      const aceChoices = { ...prev.aceChoices };
      delete aceChoices[removedCard.id];

      sfxCardDeal();

      const isRigidAces = prev.bossModifier?.id === 'no_ace_11';
      if (result.card.rank === 'A' && !isRigidAces) {
        return {
          ...prev,
          playerCards: newPlayerCards,
          aceChoices,
          deck,
          swapUsed: true,
          swapMode: false,
          phase: PHASES.ACE_CHOICE,
          pendingAces: [result.card],
          aceReturnPhase: PHASES.PLAYING,
          cheatTrigger: { id: 'card_swap', emoji: '🔄', text: 'CARD SWAPPED!', ts: Date.now() },
        };
      }

      if (result.card.rank === 'A' && isRigidAces) {
        aceChoices[result.card.id] = 1;
      }

      const total = getHandTotal(newPlayerCards, aceChoices);

      if (isBust(total)) {
        const hasBustBuffer = prev.cheats.some(c => c.id === 'bust_buffer') && !prev.bustBufferUsed;
        if (hasBustBuffer) {
          sfxCardDeal();
          const bufferedCards = [...prev.playerCards];
          bufferedCards.splice(cardIndex, 1);
          return {
            ...prev,
            playerCards: bufferedCards,
            aceChoices: { ...prev.aceChoices },
            deck,
            swapUsed: true,
            swapMode: false,
            bustBufferUsed: true,
            cheatTrigger: { id: 'bust_buffer', emoji: '🛡️', text: 'BUST PREVENTED!', ts: Date.now() },
          };
        }

        sfxBust();
        return {
          ...prev,
          playerCards: newPlayerCards,
          aceChoices,
          deck,
          swapUsed: true,
          swapMode: false,
          phase: PHASES.ROUND_RESULT,
          roundResult: {
            outcome: 'bust',
            playerTotal: total,
            dealerTotal: null,
            playerScore: null,
            dealerScore: null,
            payout: -prev.currentBet,
            damage: 0,
          },
        };
      }

      return {
        ...prev,
        playerCards: newPlayerCards,
        aceChoices,
        deck,
        swapUsed: true,
        swapMode: false,
        cheatTrigger: { id: 'card_swap', emoji: '🔄', text: 'CARD SWAPPED!', ts: Date.now() },
      };
    });
  }, []);

  const stepDealerTurn = useCallback(() => {
    setState(prev => {
      let deck = deckRef.current;
      let dealerCards = [...prev.dealerCards];
      let dealerAceChoices = getDealerAceChoices(dealerCards);

      // Check if dealer should hit
      if (dealerShouldHit(dealerCards, dealerAceChoices, prev.bossModifier?.id)) {
        const result = drawCard(deck, []);
        if (result.card) {
          dealerCards.push(result.card);
          deckRef.current = result.deck;
          sfxCardDeal();
          // Important: Recalculate ace choices with the new card so the UI reflects the correct total
          const newDealerAceChoices = getDealerAceChoices(dealerCards);
          return {
            ...prev,
            deck: result.deck,
            dealerCards,
            dealerAceChoices: newDealerAceChoices,
          };
        }
      }

      // If we reach here, dealer stands or deck is empty, resolve round
      deckRef.current = deck;

      const playerTotal = getHandTotal(prev.playerCards, prev.aceChoices);
      const dealerTotal = getHandTotal(dealerCards, dealerAceChoices);
      const playerIsNatBJ = isBlackjack(prev.playerCards);

      const context = {
        currentBet: prev.currentBet,
        didDoubleDown: prev.didDoubleDown,
        bossModifier: prev.bossModifier?.id,
      };

      const playerScore = calculateScore(
        prev.playerCards, prev.aceChoices, prev.cheats,
        prev.handUpgrades, prev.cardUpgrades, context
      );

      const dealerScore = calculateScore(
        dealerCards, dealerAceChoices, [],
        {}, {}, {}
      );

      let outcome;
      let payout;
      let damage = 0;

      if (isBust(dealerTotal)) {
        outcome = 'dealer_bust';
        payout = calculatePayout(prev.currentBet, playerScore);
        damage = calculateDamage(playerScore, playerIsNatBJ, prev.dealerMaxHP, prev.currentBet);
        if (prev.cheats.some(c => c.id === 'dealers_tax')) {
          payout += 10;
        }
        sfxWin();
      } else if (playerTotal > dealerTotal) {
        outcome = 'win';
        payout = calculatePayout(prev.currentBet, playerScore);
        damage = calculateDamage(playerScore, playerIsNatBJ, prev.dealerMaxHP, prev.currentBet);
        sfxWin();
      } else if (playerTotal < dealerTotal) {
        outcome = 'lose';
        payout = -prev.currentBet;
        damage = 0;
        sfxLose();
      } else {
        // Tie: resolve by score
        const pTotal = playerScore.chips * playerScore.mult;
        const dTotal = dealerScore.chips * dealerScore.mult;
        if (pTotal > dTotal) {
          outcome = 'win_tiebreak';
          payout = calculatePayout(prev.currentBet, playerScore);
          damage = calculateDamage(playerScore, false, prev.dealerMaxHP, prev.currentBet);
          sfxWin();
        } else if (pTotal < dTotal) {
          outcome = 'lose_tiebreak';
          payout = -prev.currentBet;
          damage = 0;
          sfxLose();
        } else {
          outcome = 'push';
          payout = 0;
          damage = 0;
        }
      }

      if (playerIsNatBJ && (outcome === 'win' || outcome === 'dealer_bust')) {
        sfxBlackjack();
      } else if (outcome.startsWith('win') || outcome === 'dealer_bust') {
        sfxChips();
      }

      return {
        ...prev,
        dealerCards,
        dealerAceChoices,
        deck,
        phase: PHASES.ROUND_RESULT,
        roundResult: {
          outcome,
          playerTotal,
          dealerTotal,
          playerScore,
          dealerScore,
          payout,
          damage,
          isNaturalBlackjack: playerIsNatBJ && (outcome === 'win' || outcome === 'dealer_bust'),
        },
      };
    });
  }, []);

  const nextRound = useCallback(() => {
    setState(prev => {
      const payout = prev.roundResult?.payout ?? 0;
      const damage = prev.roundResult?.damage ?? 0;
      const newCash = Math.max(0, prev.cash + payout);
      const newDealerHP = Math.max(0, prev.dealerCurrentHP - damage);
      const newHandsRemaining = prev.handsRemaining - 1;

      // Check if dealer is dead (blind won!)
      if (newDealerHP <= 0) {
        const isLastBlind = prev.blindIndex === 2;
        const isLastAnte = prev.ante === 7;

        if (isLastBlind && isLastAnte) {
          return {
            ...prev,
            cash: newCash,
            dealerCurrentHP: 0,
            phase: PHASES.GAME_WON,
          };
        }

        // Generate shop items
        const shopItems = generateShopItems(
          prev.ante + 1,
          prev.cheats.map(c => c.id),
          newCash
        );

        return {
          ...prev,
          cash: newCash,
          dealerCurrentHP: 0,
          handsRemaining: newHandsRemaining,
          phase: PHASES.SHOP,
          shopItems,
          playerCards: [],
          dealerCards: [],
          roundResult: null,
        };
      }

      // Out of hands and dealer still alive
      if (newHandsRemaining <= 0) {
        return {
          ...prev,
          cash: newCash,
          dealerCurrentHP: newDealerHP,
          phase: PHASES.GAME_OVER,
          gameOverReason: 'out_of_hands',
          playerCards: [],
          dealerCards: [],
        };
      }

      // Out of cash
      if (newCash <= 0) {
        return {
          ...prev,
          cash: 0,
          dealerCurrentHP: newDealerHP,
          phase: PHASES.GAME_OVER,
          gameOverReason: 'out_of_cash',
        };
      }

      // Continue playing this blind
      return {
        ...prev,
        cash: newCash,
        dealerCurrentHP: newDealerHP,
        handsRemaining: newHandsRemaining,
        phase: PHASES.BETTING,
        playerCards: [],
        dealerCards: [],
        roundResult: null,
      };
    });
  }, []);

  const buyShopItem = useCallback((item) => {
    setState(prev => {
      if (prev.cash < item.cost) return prev;

      sfxBuy();
      let changes = {
        cash: prev.cash - item.cost,
        shopItems: prev.shopItems.filter(i => i.id !== item.id),
      };

      if (item.type === 'cheat') {
        if (prev.cheats.length >= MAX_CHEAT_SLOTS) return prev;
        const fullCheat = ALL_CHEATS.find(c => c.id === item.cheat.id);
        changes.cheats = [...prev.cheats, { ...fullCheat }];
      } else if (item.type === 'cardUpgrade') {
        const existing = prev.cardUpgrades[item.rank] || { chips: 0, mult: 0 };
        changes.cardUpgrades = {
          ...prev.cardUpgrades,
          [item.rank]: {
            chips: existing.chips + item.chipBonus,
            mult: existing.mult + item.multBonus,
          },
        };
      } else if (item.type === 'handUpgrade') {
        const existing = prev.handUpgrades[item.handKey] || { chips: 0, mult: 0 };
        changes.handUpgrades = {
          ...prev.handUpgrades,
          [item.handKey]: {
            chips: existing.chips + item.chipBonus,
            mult: existing.mult + item.multBonus,
          },
        };
      } else if (item.type === 'deckMod') {
        changes.deckMods = [...prev.deckMods, item.modAction];
      }

      return { ...prev, ...changes };
    });
  }, []);

  const leaveShop = useCallback(() => {
    setState(prev => {
      // Always go to next blind in order
      const isLastBlind = prev.blindIndex === 2;
      let newAnte = prev.ante;
      let newBlindIndex = prev.blindIndex + 1;

      if (isLastBlind) {
        newAnte = prev.ante + 1;
        newBlindIndex = 0;
      }

      if (newAnte >= 8) {
        return { ...prev, phase: PHASES.GAME_WON };
      }

      // Set up next blind's dealer HP
      const nextBlind = ANTE_CONFIG[newAnte].blinds[newBlindIndex];
      let bossModifier = null;
      if (nextBlind.type === 'boss') {
        bossModifier = getRandomBossModifier(newAnte + 1);
      }

      return {
        ...prev,
        phase: PHASES.BLIND_INTRO,
        ante: newAnte,
        blindIndex: newBlindIndex,
        dealerMaxHP: nextBlind.dealerHP,
        dealerCurrentHP: nextBlind.dealerHP,
        handsRemaining: HANDS_PER_BLIND,
        bossModifier,
      };
    });
  }, []);

  const toggleSwapMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      swapMode: !prev.swapMode,
    }));
  }, []);

  return {
    state,
    actions: {
      startGame,
      startBlind,
      placeBet,
      chooseAceValue,
      hit,
      stand,
      doubleDown,
      swapCard,
      toggleSwapMode,
      stepDealerTurn,
      nextRound,
      buyShopItem,
      leaveShop,
      abandonRun: () => setState(prev => ({ ...prev, phase: PHASES.GAME_OVER, gameOverReason: 'abandoned' })),
      clearCheatTrigger: () => setState(prev => ({ ...prev, cheatTrigger: null })),
      openGodModeSetup: () => setState(prev => ({ ...prev, phase: PHASES.GOD_MODE_SETUP })),
      openRules: () => setState(prev => ({ ...prev, phase: PHASES.RULES })),
      closeRules: () => setState(prev => ({ ...prev, phase: PHASES.MENU })),
      goToMenu: () => setState(createInitialState()),
      startGodRun,
    },
  };
}
