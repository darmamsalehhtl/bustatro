import { ANTE_CONFIG } from './src/game/constants.js';

const state = {
    ante: 0,
    blindIndex: 0,
    cash: 150,
    handsRemaining: 8,
    dealerMaxHP: 120,
    dealerCurrentHP: 120
};

const anteConfig = ANTE_CONFIG[state.ante];
console.log("anteConfig:", anteConfig);
const blind = anteConfig.blinds[state.blindIndex];
console.log("blind:", blind);
const bet = blind.minBet;
console.log("bet:", bet);
const dmgMult = Math.max(0.5, (0.5 + (bet / 20))).toFixed(2);
console.log("dmgMult:", dmgMult);
