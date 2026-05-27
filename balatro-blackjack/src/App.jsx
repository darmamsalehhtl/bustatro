import { useState, useEffect } from 'react';
import { useGameState, PHASES } from './game/useGameState.js';
import { ANTE_CONFIG, HANDS_PER_BLIND, SUIT_SYMBOLS } from './game/constants.js';
import { getHandTotal, isBlackjack, isBust, getCardBonuses } from './game/engine.js';
import { ALL_CHEATS } from './game/cheats.js';
import Card from './components/Card.jsx';
import { AuthScreen } from './components/AuthScreens.jsx';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('bustatro_currentUser'));

  const handleLogin = (user) => {
    localStorage.setItem('bustatro_currentUser', user);
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('bustatro_currentUser');
    setCurrentUser(null);
  };

  if (!currentUser) {
    return (
      <div className="app">
        <AuthScreen onLogin={handleLogin} />
        <div className="crt-overlay" />
      </div>
    );
  }

  return <GameApp currentUser={currentUser} onLogout={handleLogout} />;
}

function GameApp({ currentUser, onLogout }) {
  const { state, actions } = useGameState(currentUser);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);

  if (!state) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ color: 'var(--neon-cyan)', animation: 'pulse 1s infinite' }}>Loading Save Data...</h2>
      </div>
    );
  }

  return (
    <div className="app">
      {state.phase !== PHASES.MENU && state.phase !== PHASES.RULES && state.phase !== PHASES.GOD_MODE_SETUP && state.phase !== PHASES.GAME_OVER && state.phase !== PHASES.GAME_WON && (
        <>
          <HUD 
            state={state} 
            currentUser={currentUser} 
            onLogout={onLogout} 
            onAbandon={() => setShowAbandonConfirm(true)}
          />
          {state.cheats.length > 0 && <CheatsBar cheats={state.cheats} />}
        </>
      )}
      <div className={`game-area ${state.phase === PHASES.ROUND_RESULT && state.roundResult?.damage > 0 ? 'shake-hard' : ''}`}>
        {state.phase === PHASES.MENU && <MenuScreen onStart={actions.startGame} onGodMode={actions.openGodModeSetup} onRules={actions.openRules} currentUser={currentUser} />}
        {state.phase === PHASES.GOD_MODE_SETUP && <GodModeScreen onStart={actions.startGodRun} onBack={actions.goToMenu} />}
        {state.phase === PHASES.RULES && <RulesScreen onClose={actions.closeRules} />}
        {state.phase === PHASES.BLIND_INTRO && <BlindIntroScreen state={state} onStart={actions.startBlind} />}
        {state.phase === PHASES.BETTING && <BettingScreen state={state} onBet={actions.placeBet} />}
        {(state.phase === PHASES.PLAYING || state.phase === PHASES.DEALER_TURN || state.phase === PHASES.ROUND_RESULT) && (
          <PlayingScreen state={state} actions={actions} />
        )}
        {state.phase === PHASES.SHOP && <ShopScreen state={state} actions={actions} />}
        {state.phase === PHASES.GAME_OVER && <GameOverScreen onRestart={actions.startGame} onMenu={actions.goToMenu} reason={state.gameOverReason} />}
        {state.phase === PHASES.GAME_WON && <GameWonScreen onRestart={actions.startGame} onMenu={actions.goToMenu} state={state} />}
      </div>
      {state.phase === PHASES.ACE_CHOICE && state.pendingAces?.length > 0 && (
        <AceChoiceModal card={state.pendingAces[0]} onChoose={actions.chooseAceValue} />
      )}
      {state.phase === PHASES.ROUND_RESULT && state.roundResult && (
        <RoundResultModal result={state.roundResult} state={state} onContinue={actions.nextRound} />
      )}
      <CheatAnimationOverlay trigger={state.cheatTrigger} onClear={actions.clearCheatTrigger} />
      {showAbandonConfirm && (
        <AbandonConfirmModal 
          onConfirm={() => {
            setShowAbandonConfirm(false);
            actions.abandonRun();
          }}
          onCancel={() => setShowAbandonConfirm(false)}
        />
      )}
      <div className="crt-overlay" />
    </div>
  );
}

function AbandonConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="result-overlay" style={{ zIndex: 2000 }} onClick={onCancel}>
      <div className="result-panel result-panel--lose" style={{ padding: '30px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <span className="result-outcome result-outcome--lose" style={{ fontSize: '1.5rem', marginBottom: '10px' }}>
          Abandon Run?
        </span>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.4' }}>
          Are you sure you want to end this run?<br/>All your current progress will be lost.
        </p>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn--danger" onClick={onConfirm}>Yes, End Run</button>
        </div>
      </div>
    </div>
  );
}

function CheatAnimationOverlay({ trigger, onClear }) {
  useEffect(() => {
    if (trigger) {
      const timer = setTimeout(() => {
        onClear();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [trigger, onClear]);

  if (!trigger) return null;

  return (
    <div className="cheat-animation-overlay">
      <div className="cheat-animation-content" key={trigger.ts}>
        <span className="cheat-animation-emoji">{trigger.emoji}</span>
        <h2 className="cheat-animation-text">{trigger.text}</h2>
      </div>
    </div>
  );
}

/* ---- Dealer HP Bar ---- */
function DealerHPBar({ current, max, label }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const hue = pct > 50 ? 0 : pct > 25 ? 30 : 0;
  return (
    <div className="hp-bar-wrapper">
      <div className="hp-bar__label">{label || 'Dealer HP'}</div>
      <div className="hp-bar">
        <div className="hp-bar__fill" style={{ width: `${pct}%` }} />
        <span className="hp-bar__text">{current} / {max}</span>
      </div>
    </div>
  );
}

/* ---- HUD ---- */
function HUD({ state, currentUser, onLogout, onAbandon }) {
  const anteConfig = ANTE_CONFIG[state.ante];
  const blind = anteConfig?.blinds[state.blindIndex];
  return (
    <div className="hud">
      <div className="hud-left">
        <div className="hud-casino-name">{anteConfig?.name || ''}</div>
        <div className="hud-stat">
          <span className="hud-stat__label">Ante</span>
          <span className="hud-stat__value hud-stat__value--ante">{state.ante + 1}/8</span>
        </div>
        <div className="hud-stat">
          <span className="hud-stat__label">Blind</span>
          <span className="hud-stat__value" style={{ color: blind?.type === 'boss' ? 'var(--neon-red)' : 'var(--neon-cyan)' }}>
            {blind?.label}
          </span>
        </div>
      </div>
      <div className="hud-center">
        {state.dealerMaxHP > 0 && (
          <DealerHPBar current={state.dealerCurrentHP} max={state.dealerMaxHP} />
        )}
      </div>
      <div className="hud-right">
        <div className="hud-stat">
          <span className="hud-stat__label">Player</span>
          <span className="hud-stat__value" style={{ color: 'var(--neon-purple)' }}>{currentUser}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-stat__label">Hands</span>
          <span className="hud-stat__value hud-stat__value--hands">{state.handsRemaining}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-stat__label">Cash</span>
          <span className="hud-stat__value hud-stat__value--cash">${state.cash}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button className="btn btn--small btn--danger" style={{ padding: '4px 10px', fontSize: '0.7rem' }} onClick={onAbandon}>End Run</button>
          <button className="btn btn--small" style={{ padding: '4px 10px', fontSize: '0.7rem' }} onClick={onLogout}>Logout</button>
        </div>
      </div>
    </div>
  );
}

function CheatsBar({ cheats }) {
  return (
    <div className="cheats-bar">
      <span className="cheats-bar__label">Cheats</span>
      {cheats.map((c, i) => (
        <div className="cheat-slot" key={c.id + i} title={c.description}>
          <span className="cheat-slot__emoji">{c.emoji}</span>
          <span className="cheat-slot__name">{c.name}</span>
        </div>
      ))}
    </div>
  );
}

/* ---- Menu ---- */
function MenuScreen({ onStart, onGodMode, onRules, currentUser }) {
  // TODO: Lock behind 'wins > 0' later
  const isGodModeUnlocked = true;

  return (
    <div className="menu-screen">
      <div className="menu-bg-cards">
        {['♠', '♥', '♦', '♣'].map((s, i) => (
          <span key={i} className="menu-bg-card" style={{ animationDelay: `${i * 0.5}s` }}>{s}</span>
        ))}
      </div>
      <h1 className="menu-title">
        <span className="menu-title__top">BUSTATRO</span>
        <span className="menu-title__bottom">BLACKJACK</span>
      </h1>
      <p className="menu-subtitle">
        Welcome back, <strong style={{ color: 'var(--neon-purple)' }}>{currentUser}</strong>.<br/>
        Beat 8 casinos. Build your deck. Stack the odds.<br/>The house always wins — unless you cheat.
      </p>
      <div className="menu-buttons" style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button className="btn btn--primary btn--large btn--glow" onClick={onStart}>
          Deal Me In
        </button>
        {isGodModeUnlocked && (
          <button className="btn btn--secondary btn--large btn--glow" style={{ borderColor: '#ff00ff', color: '#ff00ff', textShadow: '0 0 5px #ff00ff' }} onClick={onGodMode}>
            God-Run
          </button>
        )}
        <button className="btn btn--large" onClick={onRules}>
          How to Play
        </button>
      </div>
      <div className="menu-features">
        <div className="menu-feature"><span>🃏</span> Casino Cheats</div>
        <div className="menu-feature"><span>💀</span> Boss Blinds</div>
        <div className="menu-feature"><span>⬆️</span> Card Upgrades</div>
      </div>
    </div>
  );
}

/* ---- God Mode Setup ---- */
function GodModeScreen({ onStart, onBack }) {
  const [cash, setCash] = useState(1000);
  const [selectedCheatIds, setSelectedCheatIds] = useState([]);

  const toggleCheat = (cheatId) => {
    setSelectedCheatIds(prev => 
      prev.includes(cheatId) ? prev.filter(id => id !== cheatId) : [...prev, cheatId]
    );
  };

  const handleStart = () => {
    const cheats = ALL_CHEATS.filter(c => selectedCheatIds.includes(c.id));
    onStart({ cash: Number(cash), cheats });
  };

  return (
    <div className="menu-screen god-mode-screen">
      <h2 className="menu-title" style={{ fontSize: '2.5rem', textShadow: '0 0 10px #ff00ff' }}>GOD-RUN CONFIG</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '600px', background: 'rgba(20,20,30,0.8)', padding: '20px', borderRadius: '12px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--neon-gold)', fontWeight: 'bold' }}>Starting Cash: ${cash}</label>
          <input 
            type="range" 
            min="100" 
            max="100000" 
            step="100"
            value={cash} 
            onChange={e => setCash(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Select Starting Cheats:</label>
          <div className="god-mode-cheats" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '300px', overflowY: 'auto', padding: '5px' }}>
            {ALL_CHEATS.map(cheat => (
              <div 
                key={cheat.id} 
                onClick={() => toggleCheat(cheat.id)}
                className={`shop-item ${selectedCheatIds.includes(cheat.id) ? 'shop-item--selected' : ''}`}
                style={{ width: 'calc(50% - 4px)', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', border: selectedCheatIds.includes(cheat.id) ? '2px solid #ff00ff' : '1px solid var(--border-subtle)' }}
              >
                <span style={{ fontSize: '1.5rem' }}>{cheat.emoji}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center' }}>{cheat.name}</span>
                <span style={{ fontSize: '0.65rem', textAlign: 'center', color: 'var(--text-muted)' }}>{cheat.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="menu-buttons" style={{ display: 'flex', gap: '1rem', marginTop: '20px' }}>
        <button className="btn btn--secondary btn--large" onClick={onBack}>Cancel</button>
        <button className="btn btn--primary btn--large btn--glow" style={{ boxShadow: '0 0 15px #ff00ff', borderColor: '#ff00ff' }} onClick={handleStart}>START GOD-RUN</button>
      </div>
    </div>
  );
}

/* ---- Blind Intro (replaces blind select — forced order) ---- */
function BlindIntroScreen({ state, onStart }) {
  const anteConfig = ANTE_CONFIG[state.ante];
  const blind = anteConfig.blinds[state.blindIndex];
  const isBoss = blind.type === 'boss';
  return (
    <div className="blind-intro">
      <div className="blind-intro__casino">{anteConfig.name}</div>
      <div className={`blind-intro__card ${isBoss ? 'blind-intro__card--boss' : ''}`}>
        <span className="blind-intro__icon">
          {isBoss ? '💀' : blind.type === 'big' ? '🔶' : '🔹'}
        </span>
        <span className="blind-intro__type">{blind.label}</span>
        <div className="blind-intro__hp">
          <DealerHPBar current={blind.dealerHP} max={blind.dealerHP} label="Dealer HP" />
        </div>
        <span className="blind-intro__minbet">Min Bet: ${blind.minBet}</span>
        <span className="blind-intro__hands">{HANDS_PER_BLIND} hands to defeat the dealer</span>
        {isBoss && state.bossModifier && (
          <div className="blind-intro__modifier">
            ⚠️ <strong>{state.bossModifier.name}</strong>: {state.bossModifier.description}
          </div>
        )}
      </div>
      <button className="btn btn--primary btn--large btn--glow" onClick={onStart}>
        Start
      </button>
    </div>
  );
}

/* ---- Betting ---- */
function BettingScreen({ state, onBet }) {
  const anteConfig = ANTE_CONFIG[state.ante];
  const blind = anteConfig.blinds[state.blindIndex];
  const [bet, setBet] = useState(blind.minBet);

  useEffect(() => {
    setBet(Math.min(blind.minBet, state.cash));
  }, [blind.minBet, state.cash]);

  const adjustBet = (delta) => {
    setBet(prev => Math.max(blind.minBet, Math.min(state.cash, prev + delta)));
  };

  return (
    <div className="betting-screen">
      {state.bossModifier && (
        <div className="boss-banner">
          <span className="boss-banner__icon">💀</span>
          <span className="boss-banner__name">{state.bossModifier.name}</span>
          <span className="boss-banner__desc">{state.bossModifier.description}</span>
        </div>
      )}
      <DealerHPBar current={state.dealerCurrentHP} max={state.dealerMaxHP} />
      <h2 className="betting-screen__title">Place Your Bet</h2>
      <div className="bet-amount-container">
        <span className="bet-amount" style={{ width: 'auto', paddingRight: '5px' }}>$</span>
        <input 
          type="number" 
          className="bet-amount" 
          value={bet}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) {
              setBet(val);
            } else {
              setBet('');
            }
          }}
          onBlur={() => {
            if (bet === '') {
              setBet(blind.minBet);
            } else {
              setBet(prev => Math.max(blind.minBet, Math.min(state.cash, prev)));
            }
          }}
        />
      </div>
      <div className="bet-controls">
        <button className="btn btn--small" onClick={() => adjustBet(-25)}>-25</button>
        <button className="btn btn--small" onClick={() => adjustBet(-5)}>-5</button>
        <button className="btn btn--small" onClick={() => adjustBet(5)}>+5</button>
        <button className="btn btn--small" onClick={() => adjustBet(25)}>+25</button>
        <button className="btn btn--small btn--gold" onClick={() => setBet(state.cash)}>All In</button>
      </div>
      <div className="bet-info-row">
        <p className="bet-info">Min bet: ${blind.minBet} · Hands left: {state.handsRemaining}</p>
        <p className="bet-damage-info">🗡️ Damage Multiplier: <span className="highlight-red">{Math.max(0.5, (0.5 + (bet / 20))).toFixed(2)}x</span></p>
      </div>
      <button
        className={`btn btn--primary btn--large ${bet < blind.minBet || bet > state.cash ? 'btn--disabled' : ''}`}
        onClick={() => onBet(bet)}
        disabled={bet < blind.minBet || bet > state.cash}
      >Deal</button>
    </div>
  );
}

/* ---- Playing Screen ---- */
function PlayingScreen({ state, actions }) {
  const playerTotal = getHandTotal(state.playerCards, state.aceChoices);
  const isPlayerBJ = isBlackjack(state.playerCards);
  const playerBust = isBust(playerTotal);

  useEffect(() => {
    if (state.phase === PHASES.DEALER_TURN) {
      const timer = setTimeout(() => actions.stepDealerTurn(), 800);
      return () => clearTimeout(timer);
    }
  }, [state.phase, state.dealerCards.length, actions]);

  const hasSwap = state.cheats.some(c => c.id === 'under_the_table') && !state.swapUsed;
  const canDoubleDown = state.cash >= state.currentBet && state.playerCards.length === 2 && state.bossModifier?.id !== 'no_double';
  const hasCardCounter = state.cheats.some(c => c.id === 'card_counter');
  const nextCard = hasCardCounter && state.deck?.length > 0 ? state.deck[0] : null;
  const canStand = state.bossModifier?.id !== 'min_stand_18' || playerTotal >= 18;

  return (
    <>
      <div className="table">
        <div className="hand-area hand-area--dealer">
          <span className="hand-area__label">Dealer</span>
          <div className="hand-area__cards">
            {state.dealerCards.map((card, i) => (
              <Card key={card.id} card={card} faceDown={state.phase !== PHASES.DEALER_TURN && i > 0} bonuses={getCardBonuses(card, [], {})} />
            ))}
          </div>
          {state.phase === PHASES.DEALER_TURN && (
            <span className="hand-area__total">{getHandTotal(state.dealerCards, state.dealerAceChoices)}</span>
          )}
        </div>
        <div className="table-vs">VS</div>
        <div className="hand-area hand-area--player">
          <div className="hand-area__cards">
            {state.playerCards.map((card, i) => (
              <Card key={card.id} card={card}
                aceValue={card.rank === 'A' ? state.aceChoices[card.id] : null}
                swappable={state.swapMode && !state.swapUsed}
                onSwap={() => actions.swapCard(i)} bust={playerBust}
                bonuses={getCardBonuses(card, state.cheats, state.cardUpgrades)} />
            ))}
          </div>
          <span className={`hand-area__total ${playerBust ? 'hand-area__total--bust' : isPlayerBJ ? 'hand-area__total--bj' : ''}`}>
            {isPlayerBJ ? '★ BLACKJACK ★' : playerTotal}
          </span>
          <span className="hand-area__label">Your Hand · Bet: ${state.currentBet}</span>
        </div>
      </div>

      {nextCard && state.phase === PHASES.PLAYING && (
        <div className="next-card-preview">
          <span className="next-card-preview__label">Next</span>
          <Card card={nextCard} />
        </div>
      )}

      {state.phase === PHASES.PLAYING && !playerBust && (
        <div className="action-bar">
          <button className="btn btn--primary" onClick={actions.hit}>Hit</button>
          <button className={`btn btn--gold ${!canStand ? 'btn--disabled' : ''}`} onClick={actions.stand} disabled={!canStand}>Stand</button>
          {canDoubleDown && <button className="btn btn--green" onClick={actions.doubleDown}>Double Down</button>}
          {hasSwap && (
            <button className={`btn ${state.swapMode ? 'btn--danger' : ''}`} onClick={actions.toggleSwapMode}>
              {state.swapMode ? 'Cancel Swap' : '🔄 Swap'}
            </button>
          )}
        </div>
      )}
      {state.phase === PHASES.DEALER_TURN && (
        <div className="action-bar">
          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', animation: 'pulse 1s ease infinite' }}>
            Dealer is playing...
          </span>
        </div>
      )}
    </>
  );
}

/* ---- Ace Choice Modal ---- */
function AceChoiceModal({ card, onChoose }) {
  return (
    <div className="ace-modal">
      <div className="ace-modal__content">
        <h3 className="ace-modal__title">Choose Ace Value</h3>
        <Card card={card} />
        <div className="ace-modal__buttons">
          <button className="ace-btn" onClick={() => onChoose(card.id, 1)}>
            <span className="ace-btn__value">1</span><span className="ace-btn__label">Safe</span>
          </button>
          <button className="ace-btn" onClick={() => onChoose(card.id, 11)}>
            <span className="ace-btn__value">11</span><span className="ace-btn__label">Risky</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Round Result ---- */
function RoundResultModal({ result, state, onContinue }) {
  const [showAnimation, setShowAnimation] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowAnimation(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [result]);

  const isWin = ['win', 'win_tiebreak', 'dealer_bust'].includes(result.outcome);
  const isLose = ['lose', 'lose_tiebreak', 'bust'].includes(result.outcome);
  const labels = {
    win: 'YOU WIN!', win_tiebreak: 'WIN BY SCORE!', dealer_bust: 'DEALER BUSTS!',
    lose: 'DEALER WINS', lose_tiebreak: 'LOST BY SCORE', bust: 'BUST!', push: 'PUSH',
  };

  if (showAnimation) {
    const text = labels[result.outcome];
    const emoji = result.outcome === 'bust' ? '💥' : 
                  result.outcome.startsWith('lose') ? '💀' :
                  result.outcome === 'dealer_bust' ? '💸' :
                  result.outcome.startsWith('win') ? '🏆' : '⚖️';
    
    return (
      <div className="game-over-animation" style={{ background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)' }}>
        <div className="game-over-animation__content">
          <span className="game-over-animation__emoji">{emoji}</span>
          <h1 className="game-over-animation__text" style={{ color: isWin ? 'var(--neon-green)' : isLose ? 'var(--neon-red)' : 'var(--neon-gold)' }}>
            {text}
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="result-overlay" onClick={onContinue}>
      <div className={`result-panel ${isWin ? 'result-panel--win' : isLose ? 'result-panel--lose' : 'result-panel--push'}`}
        onClick={e => e.stopPropagation()}>
        <span className={`result-outcome ${isWin ? 'result-outcome--win' : isLose ? 'result-outcome--lose' : 'result-outcome--push'}`}>
          {labels[result.outcome]}
        </span>
        {result.isNaturalBlackjack && <span className="result-bj-badge">🂡 NATURAL BLACKJACK — ONE SHOT! 🂡</span>}
        <div className="result-totals">
          <div className="result-total"><span className="result-total__label">You</span><span className="result-total__value">{result.playerTotal}</span></div>
          <span className="result-vs">vs</span>
          <div className="result-total"><span className="result-total__label">Dealer</span><span className="result-total__value">{result.dealerTotal ?? '—'}</span></div>
        </div>
        {result.playerScore && (
          <div className="result-score-breakdown">
            <div className="score-display__breakdown">
              <span className="score-chips">{result.playerScore.chips} chips</span>{' × '}
              <span className="score-mult">{result.playerScore.mult}x</span>{' = '}
              <span style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>{result.playerScore.total}</span>
            </div>
            <span className="score-display__label">{result.playerScore.handLabel}</span>
          </div>
        )}
        {result.damage > 0 && (
          <div className="result-damage">
            <span className="result-damage__icon">💥</span>
            <span className="result-damage__value">-{result.damage} HP</span>
            <span className="result-damage__remaining">({Math.max(0, state.dealerCurrentHP - result.damage)} remaining)</span>
          </div>
        )}
        <span className={`result-payout ${result.payout > 0 ? 'result-payout--positive' : result.payout < 0 ? 'result-payout--negative' : 'result-payout--zero'}`}>
          {result.payout > 0 ? '+' : ''}{result.payout === 0 ? '±' : ''}${Math.abs(result.payout)}
        </span>
        <button className="btn btn--primary" onClick={onContinue}>Continue</button>
      </div>
    </div>
  );
}

/* ---- Shop ---- */
function ShopScreen({ state, actions }) {
  return (
    <div className="shop-screen">
      <h2 className="shop-screen__title">🏪 The Shop</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Spend your winnings before the next table.</p>
      <div className="shop-items">
        {state.shopItems.map(item => (
          <div key={item.id} className={`shop-item ${state.cash < item.cost ? 'shop-item--unaffordable' : ''}`}
            onClick={() => actions.buyShopItem(item)}>
            <span className={`shop-item__type ${item.type === 'cheat' ? `shop-item__type--${item.cheat.rarity}` : ''}`}>
              {item.type === 'cheat' ? `Casino Cheat (${item.cheat.rarity})` : item.type === 'cardUpgrade' ? 'Card Upgrade' :
               item.type === 'handUpgrade' ? 'Hand Upgrade' : 'Deck Mod'}
            </span>
            <span className="shop-item__emoji">{item.emoji}</span>
            <span className="shop-item__name">{item.name}</span>
            <span className="shop-item__desc">{item.description}</span>
            <span className="shop-item__cost">${item.cost}</span>
          </div>
        ))}
      </div>
      <button className="btn btn--primary btn--large" onClick={actions.leaveShop}>Next Table →</button>
    </div>
  );
}

function GameOverScreen({ onRestart, onMenu, reason }) {
  const [showAnimation, setShowAnimation] = useState(true);

  useEffect(() => {
    if (!reason || reason === 'abandoned') {
      setShowAnimation(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowAnimation(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [reason]);

  if (showAnimation) {
    const text = reason === 'out_of_hands' ? 'OUT OF HANDS!' : 'BANKRUPT!';
    const emoji = reason === 'out_of_hands' ? '⏱️' : '💸';
    return (
      <div className="game-over-animation">
        <div className="game-over-animation__content">
          <span className="game-over-animation__emoji">{emoji}</span>
          <h1 className="game-over-animation__text">{text}</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="endgame-screen">
      <h1 className="endgame-title endgame-title--lose">GAME OVER</h1>
      <p className="endgame-subtitle">
        {reason === 'out_of_hands' ? 'You ran out of hands before defeating the boss.' : 
         reason === 'out_of_cash' ? 'You went bankrupt trying to cheat the casino.' :
         'The house always wins... this time.'}
      </p>
      <div style={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
        <button className="btn" onClick={onMenu}>Return to Menu</button>
        <button className="btn btn--primary" onClick={onRestart}>Try Again</button>
      </div>
    </div>
  );
}

function GameWonScreen({ onRestart, onMenu, state }) {
  return (
    <div className="endgame-screen">
      <h1 className="endgame-title endgame-title--win">🏆 YOU WIN! 🏆</h1>
      <p className="endgame-subtitle">You conquered all 8 casinos with ${state.cash} in your pocket!</p>
      <div style={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
        <button className="btn" onClick={onMenu}>Return to Menu</button>
        <button className="btn btn--primary" onClick={onRestart}>Play Again</button>
      </div>
    </div>
  );
}

function RulesScreen({ onClose }) {
  return (
    <div className="rules-screen">
      <h1 className="rules-title">How to Play</h1>
      <div className="rules-content">
        <section className="rules-section">
          <h2>🃏 The Basics</h2>
          <p>Bustatro plays like standard Blackjack but with Roguelike progression.</p>
          <ul>
            <li><strong>Objective:</strong> Get a hand value closer to 21 than the dealer without going over (busting).</li>
            <li><strong>Card Values:</strong> Number cards are face value. Face cards (J, Q, K) are 10. Aces are 1 or 11 (you choose).</li>
            <li><strong>Actions:</strong>
              <ul>
                <li><strong>Hit:</strong> Draw another card.</li>
                <li><strong>Stand:</strong> Keep your current hand and end your turn.</li>
                <li><strong>Double Down:</strong> Double your bet, receive exactly one more card, and end your turn.</li>
              </ul>
            </li>
          </ul>
        </section>

        <section className="rules-section">
          <h2>⚔️ Dealing Damage</h2>
          <p>Instead of just winning money, you must defeat the Dealer's HP to advance to the next casino.</p>
          <ul>
            <li>Winning a hand deals damage to the dealer based on your <strong>Score</strong>.</li>
            <li><strong>Score Calculation:</strong> Chips × Multiplier = Damage.</li>
            <li><strong>Base Score:</strong>
              <ul>
                <li>Normal Win: 10 Chips × 1 Mult</li>
                <li>Blackjack: 50 Chips × 2 Mult</li>
                <li>Dealer Bust: 15 Chips × 1 Mult</li>
              </ul>
            </li>
            <li><strong>Betting:</strong> Higher bets increase your Damage Multiplier!</li>
          </ul>
        </section>

        <section className="rules-section">
          <h2>🏪 The Shop & Upgrades</h2>
          <p>Between casinos, you visit the Shop to buy powerful upgrades using your cash.</p>
          <ul>
            <li><strong>Casino Cheats:</strong> Powerful passive effects (e.g., Bust Buffer, Card Counter). You can hold up to 3.</li>
            <li><strong>Card Upgrades:</strong> Permanently increase the Chips/Mult of specific card ranks (e.g., all 7s give +5 Chips).</li>
            <li><strong>Hand Upgrades:</strong> Permanently increase the Base Score of winning hands (e.g., +20 Chips for winning with Blackjack).</li>
            <li><strong>Deck Mods:</strong> Modify your deck permanently (e.g., Add more Face cards, remove low cards).</li>
          </ul>
        </section>

        <section className="rules-section">
          <h2>💀 Boss Blinds</h2>
          <p>The final blind of every Ante is a Boss Blind with a special modifier that changes the rules of the game.</p>
          <ul>
            <li><strong>No Double:</strong> You cannot Double Down.</li>
            <li><strong>Rigid Aces:</strong> All Aces are forced to be worth 1.</li>
            <li><strong>Min Stand 18:</strong> You cannot Stand unless your hand is 18 or higher.</li>
            <li><strong>Dealer 3 Cards:</strong> The dealer starts with 3 cards instead of 2.</li>
          </ul>
        </section>
      </div>
      <button className="btn btn--primary btn--large rules-close-btn" onClick={onClose}>Back to Menu</button>
    </div>
  );
}

export default App;
