#!/usr/bin/env node
/**
 * Régénère les captures d'écran du README.
 *
 *   npm run build && npm run screenshots
 *
 * Le script sert le bundle de production, pilote un Chromium et joue de
 * vraies parties. La seed passée dans l'URL rend chaque capture reproductible :
 * relancer le script deux fois de suite donne exactement les mêmes images.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'screenshots');
const PORT = Number(process.env.SHOT_PORT ?? 4310);
// 127.0.0.1 plutôt que localhost : sur certains runners Linux (dont GitHub
// Actions), la résolution de "localhost" essaie d'abord ::1 avant de
// retomber sur l'IPv4, ce qui peut ralentir ou faire échouer la connexion.
const HOST = '127.0.0.1';
const BASE = `http://${HOST}:${PORT}`;
const SERVER_TIMEOUT_MS = 45_000;
const SEED = 20260727;
const VIEWPORT = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

/** État de sauvegarde injecté avant le chargement, format du middleware zustand. */
const SAVE_KEY = 'pocket-casino/v1';

function baseSave(overrides = {}) {
  return {
    version: 1,
    state: {
      bank: 4250,
      debt: 0,
      inventory: { peek: 2, burn: 1, shield: 1, jokerCard: 2, extraDiscard: 3, safetyNet: 2 },
      trophies: {},
      presets: [],
      lastWheelAt: null,
      sound: false,
      reducedMotion: false,
      stats: {
        manchesGagnees: 27,
        plusGrosGain: 3200,
        meilleureSerieDouble: 3,
        toursDeRoulette: 41,
        meilleurAntePoker: 5,
        mainsDePoker: 96,
      },
      ...overrides,
    },
  };
}

/**
 * Lance `vite preview` et attend qu'il reponde reellement aux requetes HTTP.
 *
 * On avait auparavant guette la ligne "Local:" dans la sortie standard, mais
 * cette detection est fragile : elle depend du format exact des logs de Vite
 * et surtout, si le process ne demarre pas du tout (mauvais chemin, port deja
 * pris, environnement CI qui met plus de temps a demarrer), aucun evenement
 * 'error' n'etait ecoute. Le script attendait alors betement le timeout
 * complet avant d'echouer avec un message qui ne dit rien de la vraie cause.
 * On sonde desormais le serveur lui-meme, et on remonte la sortie du process
 * dans le message d'erreur pour que l'echec soit diagnosticable directement
 * depuis les logs CI.
 */
async function startServer() {
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    throw new Error('dist/ introuvable. Lance "npm run build" avant "npm run screenshots".');
  }

  const child = spawn(
    process.execPath,
    [
      join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'),
      'preview',
      '--host',
      HOST,
      '--port',
      String(PORT),
      '--strictPort',
    ],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let output = '';
  const record = (chunk) => {
    output += String(chunk);
  };
  child.stdout.on('data', record);
  child.stderr.on('data', record);
  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));

  const exitEarly = new Promise((_resolve, reject) => {
    child.on('error', (err) => {
      reject(new Error(`impossible de lancer vite preview : ${err.message}\n${output}`));
    });
    child.on('exit', (code) => {
      reject(new Error(`vite preview s'est arrete avec le code ${code}\n${output}`));
    });
  });
  // Une sortie inattendue plus tard (crash pendant les captures) ne doit pas
  // produire un rejet de promesse non gere une fois la course terminee.
  exitEarly.catch(() => {});

  const waitUntilReady = (async () => {
    const deadline = Date.now() + SERVER_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        await fetch(BASE, { signal: AbortSignal.timeout(1500) });
        return;
      } catch {
        // Pas encore pret : le serveur n'accepte pas encore les connexions.
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(
      `le serveur de prévisualisation ne répond pas apres ${SERVER_TIMEOUT_MS / 1000}s\n${output}`,
    );
  })();

  await Promise.race([waitUntilReady, exitEarly]);
  return child;
}

/** Ouvre une page neuve avec une sauvegarde connue et une seed fixe. */
async function openPage(browser, { save = baseSave(), viewport = VIEWPORT, seed = SEED } = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [SAVE_KEY, JSON.stringify(save)],
  );
  await page.goto(`${BASE}/?seed=${seed}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // Laisse retomber les animations d'entrée avant de déclencher l'obturateur.
  await page.waitForTimeout(700);
  return page;
}

async function shoot(page, name) {
  await page.waitForTimeout(260);
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`) });
  process.stdout.write(`  capture ${name}.png\n`);
}

const RANK_VALUE = { A: 14, K: 13, Q: 12, J: 11 };
const rankValue = (rank) => RANK_VALUE[rank] ?? Number.parseInt(rank, 10);

/**
 * Choisit jusqu'à 5 cartes formant la meilleure combinaison simple : on garde
 * les groupes de rangs identiques, sinon la carte la plus forte. Assez malin
 * pour valider un ante 1, assez simple pour rester lisible.
 */
async function bestSelection(cards, total) {
  const hand = [];
  for (let i = 0; i < total; i++) {
    const label = (await cards.nth(i).getAttribute('aria-label')) ?? '';
    hand.push({ index: i, rank: label.split(' de ')[0] });
  }

  const byRank = new Map();
  for (const card of hand) {
    if (!byRank.has(card.rank)) byRank.set(card.rank, []);
    byRank.get(card.rank).push(card);
  }

  const groups = [...byRank.values()].sort(
    (a, b) => b.length - a.length || rankValue(b[0].rank) - rankValue(a[0].rank),
  );

  const picked = [];
  for (const group of groups) {
    if (group.length >= 2 && picked.length + group.length <= 5) picked.push(...group);
  }
  if (picked.length === 0) {
    picked.push([...hand].sort((a, b) => rankValue(b.rank) - rankValue(a.rank))[0]);
  }
  return picked.slice(0, 5).map((c) => c.index);
}

const SHOTS = [
  {
    name: '01-lobby',
    async run(browser) {
      const page = await openPage(browser);
      await shoot(page, '01-lobby');
      await page.context().close();
    },
  },
  {
    name: '02-poker',
    async run(browser) {
      const page = await openPage(browser);
      await page.getByRole('button', { name: /Poker Roguelike/ }).click();
      await page.getByRole('button', { name: /Payer le buy-in/ }).click();
      await page.waitForTimeout(700);
      // Sélectionne les trois premières cartes pour afficher l'aperçu de score.
      const cards = page.locator('.hand-fan .card');
      // Les cartes respirent au repos : on force le clic plutot que d'attendre
      // une stabilite qui n'arrive jamais.
      for (const index of [0, 1, 2]) await cards.nth(index).click({ force: true });
      await shoot(page, '02-poker');
      await page.context().close();
    },
  },
  {
    name: '03-boutique-de-manche',
    async run(browser) {
      // La strategie du script est volontairement simple, elle ne valide pas
      // l'ante 1 a tous les coups. On essaie donc quelques seeds connues et on
      // garde la premiere partie gagnante : la capture reste deterministe.
      for (const seed of [1, 4, 7, 12, 20, 33]) {
        const page = await openPage(browser, { seed });
        await page.getByRole('button', { name: /Poker Roguelike/ }).click();
        await page.getByRole('button', { name: /Payer le buy-in/ }).click();
        await page.waitForTimeout(600);

        for (let round = 0; round < 4; round++) {
          const cards = page.locator('.hand-fan .card');
          const total = await cards.count();
          if (total === 0) break;
          for (const index of await bestSelection(cards, total)) {
            await cards.nth(index).click({ force: true });
          }
          await page.getByRole('button', { name: /Jouer la main/ }).click();
          // Le decompte anime carte par carte avant de rendre la main.
          await page.waitForTimeout(4800);
          const gagne = page.getByRole('button', { name: /Quitte ou double/i });
          if (await gagne.isVisible().catch(() => false)) {
            await page.getByRole('button', { name: /Encaisser/ }).click();
            await page.waitForTimeout(800);
            break;
          }
        }

        const enBoutique = await page
          .getByText(/Boutique de manche/i)
          .isVisible()
          .catch(() => false);

        if (enBoutique) {
          await shoot(page, '03-boutique-de-manche');
          await page.context().close();
          return;
        }
        await page.context().close();
      }
      throw new Error('aucune seed testee ne valide l ante 1');
    },
  },
  {
    name: '04-blackjack',
    async run(browser) {
      const page = await openPage(browser);
      await page.getByRole('button', { name: /Blackjack Arcade/ }).click();
      await page.getByRole('button', { name: 'Miser 100 $' }).click();
      await page.getByRole('checkbox').check({ force: true });
      await page.getByRole('button', { name: /Distribuer/ }).click();
      await page.waitForTimeout(1100);
      await shoot(page, '04-blackjack');
      await page.context().close();
    },
  },
  {
    name: '05-roulette',
    async run(browser) {
      const page = await openPage(browser);
      await page.getByRole('button', { name: /Roulette Turbo/ }).click();
      await page.waitForTimeout(400);
      await page.locator('.outside__cell--rouge').click();
      await page.locator('.board__cell', { hasText: /^7$/ }).first().click();
      await page.locator('.board__cell--zero').click();
      await shoot(page, '05-roulette');
      await page.context().close();
    },
  },
  {
    name: '06-quitte-ou-double',
    async run(browser) {
      const page = await openPage(browser);
      await page.getByRole('button', { name: /Roulette Turbo/ }).click();
      await page.waitForTimeout(400);
      // Rouge et Noir couverts : tout sauf le zero rend la mise, la manche est
      // donc gagnante et le bouton Quitte ou Double apparait.
      await page.locator('.outside__cell--rouge').click();
      await page.locator('.outside__cell--noir').click();
      await page.getByRole('button', { name: /Lancer la bille/ }).click();
      await page.getByRole('button', { name: /Quitte ou double/i }).click({ timeout: 20000 });
      await page.waitForTimeout(500);
      await shoot(page, '06-quitte-ou-double');
      await page.context().close();
    },
  },
  {
    name: '07-carnet-de-regles',
    async run(browser) {
      const page = await openPage(browser);
      await page.getByRole('button', { name: 'Carnet de règles' }).click();
      await page.getByRole('tab', { name: 'Blackjack' }).click();
      await shoot(page, '07-carnet-de-regles');
      await page.context().close();
    },
  },
  {
    name: '08-trophees',
    async run(browser) {
      const page = await openPage(browser, {
        save: baseSave({
          trophies: {
            'roi-du-bluff': 1750000000000,
            'premier-jeton': 1750000000000,
            'acrobate-du-risk': 1750000000000,
            'nettoyage-de-printemps': 1750000000000,
            'zero-absolu': 1750000000000,
          },
        }),
      });
      await page.getByRole('button', { name: 'Trophées' }).click();
      await shoot(page, '08-trophees');
      await page.context().close();
    },
  },
  {
    name: '09-magasin',
    async run(browser) {
      const page = await openPage(browser);
      await page.getByRole('button', { name: 'Boutique', exact: true }).click();
      await shoot(page, '09-magasin');
      await page.context().close();
    },
  },
  {
    name: '10-banqueroute',
    async run(browser) {
      const page = await openPage(browser, {
        save: baseSave({
          bank: 0,
          inventory: { peek: 0, burn: 0, shield: 0, jokerCard: 0, extraDiscard: 0, safetyNet: 0 },
        }),
      });
      await shoot(page, '10-banqueroute');
      await page.context().close();
    },
  },
  {
    name: '11-mobile',
    async run(browser) {
      const page = await openPage(browser, { viewport: MOBILE });
      await page.getByRole('button', { name: /Blackjack Arcade/ }).click();
      await page.getByRole('button', { name: 'Miser 25 $' }).click();
      await page.getByRole('button', { name: /Distribuer/ }).click();
      await page.waitForTimeout(1100);
      // Le clic a fait defiler jusqu'aux boutons : on remonte pour montrer la table.
      await page.evaluate(() => window.scrollTo(0, 0));
      await shoot(page, '11-mobile');
      await page.context().close();
    },
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const file of await readdir(OUT_DIR)) {
    if (file.endsWith('.png')) await rm(join(OUT_DIR, file));
  }

  const server = await startServer();
  const browser = await chromium.launch();
  let failures = 0;

  try {
    for (const shot of SHOTS) {
      process.stdout.write(`> ${shot.name}\n`);
      try {
        await shot.run(browser);
      } catch (error) {
        failures++;
        process.stderr.write(`  echec : ${error.message}\n`);
      }
    }
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }

  if (failures > 0) {
    process.stderr.write(`\n${failures} capture(s) en echec.\n`);
    process.exit(1);
  }
  process.stdout.write(`\n${SHOTS.length} captures ecrites dans screenshots/\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exit(1);
});
