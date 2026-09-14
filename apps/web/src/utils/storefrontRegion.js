// Which shop is this visitor looking at: the Indonesian one, or the international one.
//
// Until now this was decided entirely by guessing at the browser's timezone and language. The guess is a
// good one — a German customer has a German browser — but it is still a guess, and it cannot be argued
// with. Dekito could not see his own international shop from Indonesia, a VPN does not change it (a VPN
// moves the IP, not the clock or the language), and a visitor the guess reads wrong has no way to say so.
//
// So the visitor can now choose, and the choice wins. The guess stays as the DEFAULT, which is what keeps
// the German customer from having to choose anything at all.
//
// Import-free so the guard runs the rules.

export const REGION_ID = 'id';
export const REGION_EN = 'en';
export const REGION_STORAGE_KEY = 'solivagant.storefront.region.v1';

const VALID = [REGION_ID, REGION_EN];

export const isValidRegion = (value) => VALID.includes(value);

/**
 * @param stored           what this browser chose last time, if anything
 * @param detectedOverseas what isLikelyOverseas() makes of the browser
 *
 * A stored choice always wins, including a choice of Indonesia made by someone the detection thinks is
 * abroad — that is precisely the person the switch exists for, and second-guessing them would make the
 * switch a suggestion rather than a control.
 */
export const resolveRegion = (stored, detectedOverseas) => {
  if (isValidRegion(stored)) return stored;
  return detectedOverseas ? REGION_EN : REGION_ID;
};

export const readStoredRegion = () => {
  try {
    const value = window.localStorage.getItem(REGION_STORAGE_KEY);
    return isValidRegion(value) ? value : null;
  } catch {
    // Private windows and blocked storage throw on read. No stored choice, so the guess decides — the
    // same place a first-time visitor starts.
    return null;
  }
};

export const writeStoredRegion = (region) => {
  if (!isValidRegion(region)) return false;
  try {
    window.localStorage.setItem(REGION_STORAGE_KEY, region);
    return true;
  } catch {
    // Blocked storage must not break the switch: the choice still applies to this page view, it just
    // will not survive a reload. Returning false rather than throwing keeps that honest for the caller.
    return false;
  }
};
