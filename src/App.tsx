import { useEffect, useState } from 'react';
import { setSoundEnabled, unlockAudio } from './audio/sfx';
import { ChipRain } from './components/ChipRain';
import { Modal } from './components/Modal';
import { Toasts } from './components/Toasts';
import { TopBar } from './components/TopBar';
import { Blackjack } from './screens/Blackjack';
import { Broke } from './screens/Broke';
import { Lobby, type GameScreen } from './screens/Lobby';
import { PokerRun } from './screens/PokerRun';
import { Roulette } from './screens/Roulette';
import { RuleBook, RuleBookTabs, type RuleTab } from './screens/RuleBook';
import { Shop } from './screens/Shop';
import { Trophies } from './screens/Trophies';
import { useCasino } from './store/useCasino';
import { useJuice } from './store/useJuice';

type Screen = 'lobby' | GameScreen;
type Overlay = 'shop' | 'trophies' | 'rules' | null;

const SCREEN_TITLE: Record<Screen, string> = {
  lobby: 'Pocket Casino',
  poker: 'Poker Roguelike',
  blackjack: 'Blackjack Arcade',
  roulette: 'Turbo Roulette',
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [ruleTab, setRuleTab] = useState<RuleTab>('poker');
  const [brokeDismissed, setBrokeDismissed] = useState(false);

  const bank = useCasino((s) => s.bank);
  const sound = useCasino((s) => s.sound);
  const reducedMotion = useCasino((s) => s.reducedMotion);
  const roundActive = useJuice((s) => s.roundActive);
  const shakeToken = useJuice((s) => s.shakeToken);
  const [shaking, setShaking] = useState(false);

  useEffect(() => setSoundEnabled(sound), [sound]);

  // Les navigateurs bloquent l'audio tant que l'utilisateur n'a pas interagi.
  useEffect(() => {
    const onFirstGesture = () => unlockAudio();
    window.addEventListener('pointerdown', onFirstGesture, { once: true });
    window.addEventListener('keydown', onFirstGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
    };
  }, []);

  useEffect(() => {
    document.body.dataset.motion = reducedMotion ? 'reduced' : 'full';
  }, [reducedMotion]);

  useEffect(() => {
    document.title = `${SCREEN_TITLE[screen]} - Pocket Casino`;
  }, [screen]);

  useEffect(() => {
    if (shakeToken === 0 || reducedMotion) return;
    setShaking(true);
    const timer = window.setTimeout(() => setShaking(false), 540);
    return () => window.clearTimeout(timer);
  }, [shakeToken, reducedMotion]);

  // Le panneau anti-banqueroute se représente des que la banque retombe à zéro.
  useEffect(() => {
    if (bank > 0) setBrokeDismissed(false);
  }, [bank]);

  const showBroke = bank === 0 && !brokeDismissed && !roundActive;

  return (
    <div className={`cabinet${shaking ? ' screen-shake' : ''}`}>
      <TopBar
        onBack={screen === 'lobby' ? undefined : () => setScreen('lobby')}
        onOpenShop={() => setOverlay('shop')}
        onOpenTrophies={() => setOverlay('trophies')}
        onOpenRules={() => setOverlay('rules')}
      />

      <main className="grow">
        {screen === 'lobby' ? (
          <Lobby
            onPlay={setScreen}
            onOpenShop={() => setOverlay('shop')}
            onOpenRules={() => setOverlay('rules')}
          />
        ) : null}
        {screen === 'poker' ? <PokerRun /> : null}
        {screen === 'blackjack' ? <Blackjack onOpenShop={() => setOverlay('shop')} /> : null}
        {screen === 'roulette' ? <Roulette /> : null}
      </main>

      <Footer />

      {overlay === 'shop' ? (
        <Modal title="Magasin d'avantages" onClose={() => setOverlay(null)}>
          <Shop />
        </Modal>
      ) : null}

      {overlay === 'trophies' ? (
        <Modal title="Trophées" onClose={() => setOverlay(null)}>
          <Trophies />
        </Modal>
      ) : null}

      {overlay === 'rules' ? (
        <Modal
          title="Casino Guide and Rules"
          onClose={() => setOverlay(null)}
          wide
          subheader={<RuleBookTabs tab={ruleTab} onChange={setRuleTab} />}
        >
          <RuleBook tab={ruleTab} />
        </Modal>
      ) : null}

      {showBroke ? <Broke onRecovered={() => setBrokeDismissed(true)} /> : null}

      <Toasts />
      <ChipRain />
    </div>
  );
}

function Footer() {
  const reducedMotion = useCasino((s) => s.reducedMotion);
  const setReducedMotion = useCasino((s) => s.setReducedMotion);
  const resetProgress = useCasino((s) => s.resetProgress);
  const [confirming, setConfirming] = useState(false);

  return (
    <footer className="shell row row--between row--wrap" style={{ paddingBottom: 'var(--u8)' }}>
      <span className="t-body t-muted">
        Jetons virtuels uniquement. Aucun argent réel, aucun achat, aucune publicité.
      </span>
      <div className="row row--wrap">
        <button
          type="button"
          className={`btn btn--sm${reducedMotion ? '' : ' btn--ghost'}`}
          aria-pressed={reducedMotion}
          onClick={() => setReducedMotion(!reducedMotion)}
        >
          Animations réduites : {reducedMotion ? 'oui' : 'non'}
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              className="btn btn--sm btn--danger"
              onClick={() => {
                resetProgress();
                setConfirming(false);
              }}
            >
              Confirmer la remise à zéro
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => setConfirming(false)}
            >
              Annuler
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => setConfirming(true)}
          >
            Repartir de zéro
          </button>
        )}
      </div>
    </footer>
  );
}
