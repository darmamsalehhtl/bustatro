# Bustatro: Blackjack

Bustatro ist ein Roguelike-Blackjack-Spiel, das klassisches Casino-Blackjack mit innovativen Spielmechaniken aus Roguelikes kombiniert. Statt nur Geld zu gewinnen, musst du die Dealer-HP besiegen - und mit dem richtigen Setup kannst du den Casino überlisten.

"The house always wins — unless you cheat."

## Spielkonzept

Das Spiel funktioniert wie Blackjack, aber mit Roguelike-Progression:

- **8 Casinos** (Antes): Jedes Casino wird schwächer, mit mehr Blinds
- **Damage-System**: Deine gewonnenen Hände fügen dem Dealer Schaden zu (basierend auf einer Score)
- **Casino-Cheats**: Passive Upgrades, die dir Vorteile geben (z.B. Bust Buffer, Card Counter)
- **Upgrades**: Permanente Verbesserungen für Karten und Hände
- **Boss Blinds**: Spezielle Gegner mit Modifiern, die die Regeln ändern

## Erste Schritte

### Installation

```bash
cd balatro-blackjack
npm install
```

### Development Server starten

```bash
npm run dev
```

Das startet:
- **Frontend**: Vite Dev Server auf `http://localhost:5173`
- **Backend**: Express Server auf `http://localhost:3001`

Die App ist dann unter `http://localhost:5173` erreichbar.

### Build

```bash
npm run build
```

## Spielmechaniken

### Blackjack Grundlagen

- **Ziel**: Eine Hand mit einem Wert näher an 21 als der Dealer, ohne zu busten
- **Kartenwerte**:
  - Zahlenkarten: Gesichtswert (2-10)
  - Figuren (J, Q, K): 10
  - Ass: 1 oder 11 (du wählst)
- **Aktionen**:
  - **Hit**: Eine weitere Karte ziehen
  - **Stand**: Hand beenden
  - **Double Down**: Einsatz verdoppeln, genau eine weitere Karte erhalten (wenn 2 Karten)

### Damage-System

Statt nur Geld zu gewinnen, machst du **Schaden** am Dealer:

```
Score = Chips × Multiplier = Schaden

Base Scores:
- Normal Win:        10 Chips × 1 Mult
- Blackjack:         50 Chips × 2 Mult  
- Dealer Bust:       15 Chips × 1 Mult

Einsatz-Multiplikator: 0.5x + (Einsatz / 20)
```

Je höher dein Einsatz, desto mehr Schaden!

### Shop & Upgrades

Nach jeder Casino besiegt, kaufst du Upgrades:

| Typ | Beschreibung | Beispiel |
|-----|--------------|----------|
| **Casino Cheats** | Passive Effekte (max. 3) | Bust Buffer: Überlebe bis zu 1 Bust pro Hand |
| **Card Upgrades** | +Chips/Mult für Kartenränge | +5 Chips für alle 7er |
| **Hand Upgrades** | +Base Score für Hände | +20 Chips für Blackjack Wins |
| **Deck Mods** | Deck-Modifikationen | +2 Face Cards, -4 niedrige Karten |

### Boss Blinds

Der letzte Blind jedes Antes ist ein Boss mit speziellem Modifikator:

- **No Double**: Du kannst nicht Double Down
- **Rigid Aces**: Alle Asse sind erzwungen auf 1
- **Min Stand 18**: Du kannst nur stehen, wenn Hand >= 18
- **Dealer 3 Cards**: Dealer startet mit 3 Karten

## Features

### Authentifizierung
- Einfaches Login-System (speichert Spielernamen lokal)
- Persistente Spielerdaten

### God Mode
- Unlock alle Cheats am Start
- Wähle deine Starting-Cheats aus
- Perfekt zum Testen und Balancen

### Cheat-System
Verfügbare Cheats:

| Name | Effekt |
|------|--------|
| **Bust Buffer** | Überlebe bis zu 1 Bust pro Hand |
| **Card Counter** | Siehe die nächste Karte |
| **Under the Table** | Tausche eine Karte pro Hand |
| **Marked Aces** | +50% Ass-Wahrscheinlichkeit |
| **Rapid Dealer** | Dealer zieht Karten schneller (harder) |
| **Money Laundering** | +20% Geldgewinne |

## Architektur

```
bustatro-blackjack/
├── src/                    # React Frontend
│   ├── App.jsx            # Hauptkomponente (UI/Screens)
│   ├── game/
│   │   ├── engine.js      # Game Logic & Berechnung
│   │   ├── useGameState.js # State Management
│   │   ├── constants.js    # Game Constants
│   │   ├── cheats.js       # Cheat Definitionen
│   │   └── shop.js         # Shop-Logik
│   ├── components/
│   │   ├── Card.jsx       # Kartenkomponente
│   │   └── AuthScreens.jsx # Login/Logout
│   ├── App.css            # Styling
│   └── index.css          # Global Styles
├── server/                 # Express Backend
│   └── index.js           # API & Datenbank
├── package.json
└── vite.config.js
```

### Backend (Express + SQLite)

Der Server verwaltet:
- Spieler-Profile
- Spielspeicherungen
- Statistiken

**API Endpoints**:
- `POST /api/auth/login` — Spieler anmelden
- `GET /api/saves/:player` — Spielspeicherung laden
- `POST /api/saves` — Spielspeicherung speichern

## Testing

Test-Dateien existieren bereits:

```bash
# Einsatz-Logik testen
node test_betting.js

# Rendering-Test
node test_render.js
```

## Styling

Das Spiel nutzt ein **Cyberpunk/Arcade-Theme** mit:
- Neon-Farben (Cyan, Magenta, Grün, Rot)
- CRT-Bildschirm-Effekt (Scanlines & Glow)
- Responsive Design
- Dark-Mode Default

CSS-Variablen in `src/index.css`:
- `--neon-cyan`, `--neon-magenta`, `--neon-green`, `--neon-red`
- `--bg-primary`, `--text-primary`, `--border-color`

## Spielprogression

```
Menu
  |
  v
Casino 1-8 (je mit 3 Blinds)
  |
  v (jeder Blind)
Blind Intro -> Betting -> Playing (Dealer Turn) -> Round Result
  |
  v (nach allen Blinds)
Shop (Upgrades kaufen)
  |
  v (nach Casino 8)
Game Won oder Game Over
```

## Development

### ESLint ausführen
```bash
npm run lint
```

### Neue Features hinzufügen

1. **Game Logic**: Änderungen in `src/game/engine.js` oder `src/game/useGameState.js`
2. **UI Screens**: Neue Komponenten in `src/App.jsx` hinzufügen
3. **Cheats**: Neue Cheats in `src/game/cheats.js` definieren
4. **Styling**: CSS in entsprechenden `.css` Dateien

### Game Constants

Alle Balance-Parameter sind in `src/game/constants.js`:
- Casino-Namen und Blind-HP
- Cheat-Eigenschaften
- Hand-Score-Base-Werte
- Etc.

## Bekannte Limitationen

- Keine Multiplayer-Unterstützung
- Statistiken noch nicht vollständig implementiert
- Boss Modifier Balancen können noch angepasst werden

## Lizenz & Hinweise

Dieses Projekt ist für Schulzwecke entwickelt worden und inspiriert von Balatro (vom Entwickler LocalThunk).
