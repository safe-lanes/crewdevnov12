import { describe, it, expect } from 'vitest';
import {
  matchHighestCoc,
  deriveCertCompLabel,
} from '@server/v2/vessel/services/vesselPlanningService';

type Lic = { licUuid: string; certificateDocument: string };

const lic = (id: string, cert: string): Lic => ({ licUuid: id, certificateDocument: cert });

describe('Officer Matrix — deriveCertCompLabel (no-regression contract)', () => {
  describe('existing labels (must not change)', () => {
    it('Master', () => {
      expect(deriveCertCompLabel('COC Master', 'deck')).toBe('Master II/2');
    });
    it('Chief Mate / Chief Officer', () => {
      expect(deriveCertCompLabel('COC Chief Mate', 'deck')).toBe('Chief Mate II/2');
      expect(deriveCertCompLabel('Chief Officer', 'deck')).toBe('Chief Mate II/2');
    });
    it('OOW Deck (oow / officer of the watch)', () => {
      expect(deriveCertCompLabel('COC OOW', 'deck')).toBe('OOW II/1');
      expect(deriveCertCompLabel('Officer of the Watch', 'deck')).toBe('OOW II/1');
    });
    it('Chief Engineer', () => {
      expect(deriveCertCompLabel('COC Chief Engineer', 'engine')).toBe('Chief Engineer III/2');
    });
    it('2nd Engineer', () => {
      expect(deriveCertCompLabel('COC Second Engineer', 'engine')).toBe('2nd Engineer III/2');
      expect(deriveCertCompLabel('2nd Engineer', 'engine')).toBe('2nd Engineer III/2');
    });
    it('3rd Engineer', () => {
      expect(deriveCertCompLabel('Third Engineer', 'engine')).toBe('3rd Engineer III/1');
      expect(deriveCertCompLabel('3rd Engineer', 'engine')).toBe('3rd Engineer III/1');
    });
    it('ETO (electro-technical / eto)', () => {
      expect(deriveCertCompLabel('Electro-Technical Officer', 'engine')).toBe('ETO III/6');
      expect(deriveCertCompLabel('COC ETO', 'engine')).toBe('ETO III/6');
    });
  });

  describe('newly recognized officer ranks', () => {
    it('2nd Officer / Second Mate variants', () => {
      expect(deriveCertCompLabel('Second Officer', 'deck')).toBe('2nd Officer II/1');
      expect(deriveCertCompLabel('2nd Officer', 'deck')).toBe('2nd Officer II/1');
      expect(deriveCertCompLabel('Second Mate', 'deck')).toBe('2nd Officer II/1');
      expect(deriveCertCompLabel('COC 2/O', 'deck')).toBe('2nd Officer II/1');
    });
    it('3rd Officer / Third Mate variants', () => {
      expect(deriveCertCompLabel('Third Officer', 'deck')).toBe('3rd Officer II/1');
      expect(deriveCertCompLabel('3rd Officer', 'deck')).toBe('3rd Officer II/1');
      expect(deriveCertCompLabel('Third Mate', 'deck')).toBe('3rd Officer II/1');
      expect(deriveCertCompLabel('COC 3/O', 'deck')).toBe('3rd Officer II/1');
    });
    it('Deck OOW aliases (OICNW)', () => {
      expect(deriveCertCompLabel('OICNW Deck', 'deck')).toBe('OOW II/1');
      expect(deriveCertCompLabel('OIC Nav Watch', 'deck')).toBe('OOW II/1');
    });
    it('4th Engineer variants', () => {
      expect(deriveCertCompLabel('Fourth Engineer', 'engine')).toBe('4th Engineer III/1');
      expect(deriveCertCompLabel('4th Engineer', 'engine')).toBe('4th Engineer III/1');
      expect(deriveCertCompLabel('COC 4/E', 'engine')).toBe('4th Engineer III/1');
    });
    it('5th Engineer variants', () => {
      expect(deriveCertCompLabel('Fifth Engineer', 'engine')).toBe('5th Engineer III/1');
      expect(deriveCertCompLabel('5th Engineer', 'engine')).toBe('5th Engineer III/1');
      expect(deriveCertCompLabel('COC 5/E', 'engine')).toBe('5th Engineer III/1');
    });
    it('Engine OOW (EOOW / OICEW / OIC Eng Watch) — must NOT label as deck OOW', () => {
      expect(deriveCertCompLabel('EOOW', 'engine')).toBe('OOW Eng III/1');
      expect(deriveCertCompLabel('OICEW', 'engine')).toBe('OOW Eng III/1');
      expect(deriveCertCompLabel('OIC Eng Watch', 'engine')).toBe('OOW Eng III/1');
    });
    it('Electrical Officer (distinct from ETO)', () => {
      expect(deriveCertCompLabel('Electrical Officer', 'engine')).toBe('Electrical Officer III/6');
      // Confirm ETO label is unaffected
      expect(deriveCertCompLabel('Electro-Technical Officer', 'engine')).toBe('ETO III/6');
    });
    it('Gas Engineer', () => {
      expect(deriveCertCompLabel('Gas Engineer', 'engine')).toBe('Gas Engineer III/1');
    });
  });

  describe('edge cases', () => {
    it('empty / null cert returns empty string', () => {
      expect(deriveCertCompLabel('', 'deck')).toBe('');
      expect(deriveCertCompLabel('', 'engine')).toBe('');
    });
    it('unknown cert returns empty string', () => {
      expect(deriveCertCompLabel('Random Certificate', 'deck')).toBe('');
      expect(deriveCertCompLabel('GMDSS GOC', 'deck')).toBe('');
    });
    it('case-insensitive matching', () => {
      expect(deriveCertCompLabel('MASTER', 'deck')).toBe('Master II/2');
      expect(deriveCertCompLabel('eoow', 'engine')).toBe('OOW Eng III/1');
    });
  });
});

describe('Officer Matrix — matchHighestCoc (highest priority wins)', () => {
  it('returns null when no licenses', () => {
    expect(matchHighestCoc<Lic>([], 'deck')).toBeNull();
  });

  it('returns null when no license matches any pattern', () => {
    const licenses = [lic('a', 'GMDSS GOC'), lic('b', 'Random Cert')];
    expect(matchHighestCoc(licenses, 'deck')).toBeNull();
  });

  it('Master beats Chief Officer beats OOW (deck)', () => {
    const licenses = [
      lic('oow', 'COC OOW'),
      lic('co', 'COC Chief Officer'),
      lic('m', 'COC Master'),
    ];
    expect(matchHighestCoc(licenses, 'deck')?.licUuid).toBe('m');
  });

  it('Chief Engineer beats 2nd Engineer beats 3rd Engineer (engine)', () => {
    const licenses = [
      lic('e3', 'COC 3rd Engineer'),
      lic('e2', 'COC 2nd Engineer'),
      lic('ec', 'COC Chief Engineer'),
    ];
    expect(matchHighestCoc(licenses, 'engine')?.licUuid).toBe('ec');
  });

  it('3rd Officer is selected when only 3rd Officer exists', () => {
    const licenses = [lic('a', 'COC Third Officer')];
    expect(matchHighestCoc(licenses, 'deck')?.licUuid).toBe('a');
  });

  it('4th Engineer is selected over 5th Engineer', () => {
    const licenses = [
      lic('e5', 'COC 5th Engineer'),
      lic('e4', 'COC 4th Engineer'),
    ];
    expect(matchHighestCoc(licenses, 'engine')?.licUuid).toBe('e4');
  });

  it('engine OOW (EOOW) is recognized for engine department', () => {
    const licenses = [lic('a', 'EOOW')];
    expect(matchHighestCoc(licenses, 'engine')?.licUuid).toBe('a');
  });

  it('engine OOW (EOOW) is disambiguated by department at the label layer', () => {
    const licenses = [lic('a', 'EOOW')];
    // 'eoow' contains the substring 'oow', so the deck matcher will also
    // select it as a candidate. Disambiguation between deck/engine OOW is
    // intentionally handled in deriveCertCompLabel, not in matchHighestCoc.
    expect(matchHighestCoc(licenses, 'deck')?.licUuid).toBe('a');
    expect(matchHighestCoc(licenses, 'engine')?.licUuid).toBe('a');
    expect(deriveCertCompLabel('EOOW', 'deck')).toBe('OOW II/1');
    expect(deriveCertCompLabel('EOOW', 'engine')).toBe('OOW Eng III/1');
  });

  it('case insensitive — lowercase cert text still matches', () => {
    const licenses = [lic('a', 'coc master')];
    expect(matchHighestCoc(licenses, 'deck')?.licUuid).toBe('a');
  });
});
