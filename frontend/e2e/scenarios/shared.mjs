import { readState, waitForState } from './players.mjs';

export const CARD_LABEL_PREFIX = '卡牌：';

export function cardNameFromLabel(label) {
  return label.startsWith(CARD_LABEL_PREFIX) ? label.slice(CARD_LABEL_PREFIX.length) : label;
}

/**
 * Wait until the latest public action matches the expected usage/card/target.
 * Face-down plays (harmony/doubt) hide the card identity on purpose, so pass
 * `null` as cardName for them; face-up skills expose the real card name.
 */
export async function waitForLatestAction(page, usageType, cardName, targetPlayerId = null) {
  await waitForState(page, ([usage, card, target]) => {
    const state = JSON.parse(window.render_game_to_text());
    const action = state.game?.latest_public_action;
    return action?.usage_type === usage && action?.card_name === card && (target === null || action?.target_player_id === target);
  }, `${cardName ?? usageType} public action`, [usageType, cardName, targetPlayerId]);
}

/** Visible own-hand card names, in display order. */
export async function readHandNames(page) {
  const labels = await page.locator('.table-hand [aria-label^="卡牌："]').evaluateAll((cards) => cards
    .filter((card) => card instanceof HTMLElement && card.offsetParent !== null)
    .map((card) => card.getAttribute('aria-label')));
  return labels.map(cardNameFromLabel);
}

/** Card names inside a modal/scope that renders identified cards. */
export async function readCardNamesIn(scope) {
  const labels = await scope.locator('[aria-label^="卡牌："]').evaluateAll((cards) => cards
    .map((card) => card.getAttribute('aria-label')));
  return labels.map(cardNameFromLabel);
}

/**
 * Read `<p>label</p><div…><Card/></div>` pairs inside a modal (for example the
 * Class Representative result panel: 你给出的牌 / 你收到的牌) and return
 * `{ [label]: cardName }`.
 */
export async function readLabeledCards(modal, labels) {
  return modal.evaluate((root, names) => {
    const found = {};
    for (const node of root.querySelectorAll('p')) {
      const key = node.textContent?.trim();
      if (!names.includes(key)) continue;
      const card = node.nextElementSibling?.querySelector?.('[aria-label^="卡牌："]');
      if (card) found[key] = card.getAttribute('aria-label').replace(/^卡牌：/, '');
    }
    return found;
  }, labels);
}

export function ownHandNames(state) {
  return (state.game?.own_hand ?? []).map((card) => card.name);
}
