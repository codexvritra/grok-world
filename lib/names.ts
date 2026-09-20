const PREFIX = [
  'Whisper', 'Tide', 'Moon', 'Palm', 'Coral', 'Sunset', 'Amber', 'Cloud', 'Reed', 'Salt',
  'Fern', 'Driftwood', 'Lantern', 'Harbor', 'Meadow', 'Cinder', 'Muse', 'Willow', 'Ember', 'Dune'
];
const MID = ['garden', 'work', 'light', 'wood', 'stone', 'brook', 'shade', 'wind', 'song', 'tide', 'helper', 'nest'];
const TYPE = ['Farm', 'Studio', 'Estate', 'Court', 'Cottage', 'Workshop', 'Pavilion', 'House', 'Nook', 'Retreat'];

const SMALL_ADJ = ['tiny', 'small', 'quiet', 'sunny', 'cozy', 'crooked', 'humble'];
const SMALL_NOUN = ['open pavilion', 'garden nook', 'fishing dock', 'reading porch', 'toolshed', 'lookout'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generatePlaceName(): string {
  if (Math.random() < 0.3) {
    return `A ${pick(SMALL_ADJ)} ${pick(SMALL_NOUN)}`;
  }
  return `${pick(PREFIX)}${pick(MID)} ${pick(TYPE)}`;
}
