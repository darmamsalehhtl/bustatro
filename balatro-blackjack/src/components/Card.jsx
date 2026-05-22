// =============================================
// Playing Card Component
// =============================================

import { SUIT_SYMBOLS } from '../game/constants.js';
import './Card.css';

export default function Card({
  card,
  faceDown = false,
  aceValue = null,
  swappable = false,
  onSwap = null,
  bust = false,
  winning = false,
  bonuses = null,
}) {
  if (!card) return null;

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitSymbol = SUIT_SYMBOLS[card.suit];

  const classes = [
    'playing-card',
    faceDown ? 'playing-card--face-down' : 'playing-card--face-up',
    isRed ? 'card--red' : 'card--black',
    swappable ? 'playing-card--swappable' : '',
    bust ? 'playing-card--bust' : '',
    winning ? 'playing-card--winning' : '',
  ].filter(Boolean).join(' ');

  if (faceDown) {
    return <div className={classes} />;
  }

  return (
    <div className={classes} onClick={swappable ? onSwap : undefined}>
      <div className="card-corner card-corner--top">
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit-small">{suitSymbol}</span>
      </div>
      <div className="card-center-suit">{suitSymbol}</div>
      <div className="card-corner card-corner--bottom">
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit-small">{suitSymbol}</span>
      </div>
      {card.rank === 'A' && aceValue && (
        <div className="ace-badge">= {aceValue}</div>
      )}
      {bonuses && (bonuses.chips > 0 || bonuses.mult > 0) && (
        <div className="card-bonuses">
          {bonuses.chips > 0 && <span className="card-bonus-chips">+{bonuses.chips}</span>}
          {bonuses.mult > 0 && <span className="card-bonus-mult">+{bonuses.mult}X</span>}
        </div>
      )}
    </div>
  );
}
