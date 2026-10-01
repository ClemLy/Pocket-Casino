import { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { setSoundEnabled, unlockAudio } from './audio/sfx';
import { ChipRain } from './components/ChipRain';
import { FeltBackdrop } from './components/FeltBackdrop';
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

/** Nom de la table affiche dans le rail, a cote de l'enseigne. */
const PLACE: Record<Screen, string | undefined> = {
  lobby: undefined,
  poker: 'Table de poker',
  blackjack: 'Table de blackjack',
  roulette: 'Roulette',
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
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <div
        className={`cabinet${screen === 'lobby' ? '' : ' cabinet--game'}${shaking ? ' screen-shake' : ''}`}
      >
        <FeltBackdrop />
        <TopBar
          place={PLACE[screen]}
          onBack={screen === 'lobby' ? undefined : () => setScreen('lobby')}
          onOpenShop={() => setOverlay('shop')}
          onOpenTrophies={() => setOverlay('trophies')}
          onOpenRules={() => setOverlay('rules')}
        />

        <main key={screen} className="screen-enter">
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

        {/* A table, chaque pixel de hauteur va au jeu : les reglages restent dans le hall. */}
        {screen === 'lobby' ? <Footer /> : null}

        {overlay === 'shop' ? (
          <Modal
            title="Magasin d'avantages"
            kicker="Comptoir du casino"
            onClose={() => setOverlay(null)}
            wide
          >
            <Shop />
          </Modal>
        ) : null}

        {overlay === 'trophies' ? (
          <Modal title="Trophées" kicker="Vitrine" onClose={() => setOverlay(null)} wide>
            <Trophies />
          </Modal>
        ) : null}

        {overlay === 'rules' ? (
          <Modal
            title="Carnet de règles"
            kicker="Casino Guide and Rules"
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
    </MotionConfig>
  );
}

function Footer() {
  const reducedMotion = useCasino((s) => s.reducedMotion);
  const setReducedMotion = useCasino((s) => s.setReducedMotion);
  const resetProgress = useCasino((s) => s.resetProgress);
  const [confirming, setConfirming] = useState(false);

  return (
    <footer className="footer">
      <span>Jetons virtuels uniquement. Aucun argent réel, aucun achat, aucune publicité.</span>
      <div className="footer__actions">
        <button
          type="button"
          className="link-btn"
          aria-pressed={reducedMotion}
          onClick={() => setReducedMotion(!reducedMotion)}
        >
          Animations réduites : {reducedMotion ? 'oui' : 'non'}
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              className="link-btn link-btn--danger"
              onClick={() => {
                resetProgress();
                setConfirming(false);
              }}
            >
              Confirmer la remise à zéro
            </button>
            <button type="button" className="link-btn" onClick={() => setConfirming(false)}>
              Annuler
            </button>
          </>
        ) : (
          <button type="button" className="link-btn" onClick={() => setConfirming(true)}>
            Repartir de zéro
          </button>
        )}
      </div>
    </footer>
  );
}
