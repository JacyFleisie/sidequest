// ─────────────────────────────────────────────────────────────────────────────
// SideQuest data: provinces, quests, chains, home bases
// Everything is static & free — no APIs, no keys. Coordinates are approximate.
// ─────────────────────────────────────────────────────────────────────────────
import { HANGOUT_QUESTS } from './hangouts'

export type Category =
  | 'free'
  | 'chill'
  | 'food'
  | 'activity'
  | 'adventure'
  | 'event'
  | 'mystery'

export type Vibe =
  | 'chill'
  | 'funny'
  | 'social'
  | 'competitive'
  | 'romantic'
  | 'chaotic'
  | 'outdoors'
  | 'food'
  | 'entertainment'
  | 'random'

export type ProvinceId =
  | 'GP'
  | 'WC'
  | 'KZN'
  | 'EC'
  | 'FS'
  | 'LP'
  | 'MP'
  | 'NW'
  | 'NC'

export interface Province {
  id: ProvinceId
  name: string
  short: string
  badge: string
  badgeCount: number
  emoji: string
  lat: number
  lng: number
}

export const PROVINCES: Record<ProvinceId, Province> = {
  GP:  { id: 'GP',  name: 'Gauteng',        short: 'GP',  badge: 'Gauteng Explorer',  badgeCount: 25, emoji: '🏙️', lat: -26.2708, lng: 28.1123 },
  WC:  { id: 'WC',  name: 'Western Cape',   short: 'WC',  badge: 'Cape Explorer',     badgeCount: 25, emoji: '🏔️', lat: -33.9249, lng: 19.2220 },
  KZN: { id: 'KZN', name: 'KwaZulu-Natal',  short: 'KZN', badge: 'KZN Adventurer',    badgeCount: 20, emoji: '🌊', lat: -28.5306, lng: 30.8958 },
  EC:  { id: 'EC',  name: 'Eastern Cape',   short: 'EC',  badge: 'Sunshine Coast Explorer', badgeCount: 20, emoji: '🌅', lat: -32.2968, lng: 26.4194 },
  FS:  { id: 'FS',  name: 'Free State',     short: 'FS',  badge: 'Free State Wanderer', badgeCount: 15, emoji: '⛰️', lat: -28.4541, lng: 26.7968 },
  LP:  { id: 'LP',  name: 'Limpopo',        short: 'LP',  badge: 'Limpopo Trailblazer', badgeCount: 15, emoji: '🦏', lat: -23.4013, lng: 29.4179 },
  MP:  { id: 'MP',  name: 'Mpumalanga',     short: 'MP',  badge: 'Panorama Pathfinder', badgeCount: 15, emoji: '🌄', lat: -25.5653, lng: 30.5279 },
  NW:  { id: 'NW',  name: 'North West',     short: 'NW',  badge: 'North West Roamer',  badgeCount: 15, emoji: '🦁', lat: -25.6500, lng: 25.5650 },
  NC:  { id: 'NC',  name: 'Northern Cape',  short: 'NC',  badge: 'Big Sky Scout',      badgeCount: 15, emoji: '🌌', lat: -29.0467, lng: 21.9900 },
}

export interface Quest {
  id: string
  title: string
  emoji: string
  category: Category
  province: ProvinceId
  provinceName: string
  city: string
  region: string
  lat: number
  lng: number
  durationMin: number
  cost: number // R per person
  players: [number, number]
  difficulty: 1 | 2 | 3 | 4 | 5
  vibe: Vibe[]
  description: string
  purpose?: string
  completionLine: string
  xp: number
  trending?: boolean
  tags: string[]
  completedCount: number
}

export const CATEGORY_META: Record<Category, { label: string; color: string; emoji: string }> = {
  free:      { label: 'FREE',      color: '#3ddc6f', emoji: '🟢' },
  chill:     { label: 'CHILL',     color: '#4db8ff', emoji: '🔵' },
  food:      { label: 'FOOD',      color: '#ffd23f', emoji: '🟡' },
  activity:  { label: 'ACTIVITY',  color: '#ff9f1c', emoji: '🟠' },
  adventure: { label: 'ADVENTURE', color: '#ff4757', emoji: '🔴' },
  event:     { label: 'EVENT',     color: '#a55eea', emoji: '🟣' },
  mystery:   { label: 'MYSTERY',   color: '#ff6bd6', emoji: '⚫' },
}

export const VIBE_META: Record<Vibe, { label: string; emoji: string }> = {
  chill:         { label: 'Chill',         emoji: '😴' },
  funny:         { label: 'Funny',         emoji: '😂' },
  social:        { label: 'Social',        emoji: '🗣️' },
  competitive:   { label: 'Competitive',   emoji: '🔥' },
  romantic:      { label: 'Romantic',      emoji: '❤️' },
  chaotic:       { label: 'Chaotic',       emoji: '🤪' },
  outdoors:      { label: 'Outdoors',      emoji: '🌳' },
  food:          { label: 'Food',          emoji: '🍔' },
  entertainment: { label: 'Entertainment', emoji: '🎮' },
  random:        { label: 'Random',        emoji: '🎲' },
}

export interface ChainStep {
  questId: string
  note?: string
}

export interface Chain {
  id: string
  title: string
  emoji: string
  province: ProvinceId
  city: string
  region: string
  lat: number
  lng: number
  vibe: Vibe[]
  description: string
  completionLine: string
  xpBonus: number
  trending?: boolean
  steps: ChainStep[]
}

// ── Home bases used by the generator (distance tiers) ──────────────────────
export interface HomeBase {
  id: string
  label: string
  region: string
  lat: number
  lng: number
  neighbors: string[]
}

export const HOME_BASES: HomeBase[] = [
  { id: 'jhb',        label: 'Johannesburg',  region: 'jhb',           lat: -26.2041, lng: 28.0473, neighbors: ['pretoria', 'hartbeespoort'] },
  { id: 'pretoria',   label: 'Pretoria',      region: 'pretoria',      lat: -25.7479, lng: 28.2293, neighbors: ['jhb', 'hartbeespoort'] },
  { id: 'cape-town',  label: 'Cape Town',     region: 'cape-town',     lat: -33.9249, lng: 18.4241, neighbors: ['stellenbosch', 'hermanus'] },
  { id: 'stellenbosch', label: 'Stellenbosch', region: 'stellenbosch', lat: -33.9364, lng: 18.8617, neighbors: ['cape-town'] },
  { id: 'durban',     label: 'Durban',        region: 'durban',        lat: -29.8587, lng: 31.0218, neighbors: ['midlands'] },
  { id: 'pmb',        label: 'Pietermaritzburg', region: 'pmb',        lat: -29.6006, lng: 30.3794, neighbors: ['durban', 'midlands', 'drakensberg'] },
  { id: 'margate',    label: 'Margate',       region: 'margate',       lat: -30.8610, lng: 30.3710, neighbors: ['durban'] },
  { id: 'gebeha',     label: 'Gqeberha',      region: 'gebeha',        lat: -33.9615, lng: 25.6201, neighbors: ['garden-route', 'tsitsikamma', 'east-london'] },
  { id: 'jbay',       label: 'Jeffreys Bay',  region: 'jbay',          lat: -34.0430, lng: 24.9220, neighbors: ['gebeha', 'tsitsikamma', 'garden-route', 'st-francis'] },
  { id: 'east-london', label: 'East London',  region: 'east-london',   lat: -33.0153, lng: 27.9116, neighbors: ['wild-coast', 'gebeha', 'hogsback'] },
  { id: 'knysna',     label: 'Knysna',        region: 'garden-route',  lat: -34.0360, lng: 23.0480, neighbors: ['tsitsikamma', 'gebeha'] },
  { id: 'bloemfontein', label: 'Bloemfontein', region: 'bloemfontein', lat: -29.0852, lng: 26.1596, neighbors: ['golden-gate', 'kimberley', 'mokala'] },
  { id: 'parys',      label: 'Parys',         region: 'parys',         lat: -26.9030, lng: 27.4570, neighbors: ['jhb', 'bloemfontein'] },
  { id: 'kimberley',  label: 'Kimberley',     region: 'kimberley',     lat: -28.7383, lng: 24.7586, neighbors: ['bloemfontein', 'mokala'] },
  { id: 'polokwane',  label: 'Polokwane',     region: 'polokwane',     lat: -23.8962, lng: 29.4486, neighbors: ['modjadji', 'magoebaskloof', 'mapungubwe'] },
  { id: 'mbombela',   label: 'Mbombela',      region: 'mbombela',      lat: -25.4650, lng: 30.9850, neighbors: ['blyde', 'graskop', 'sudwala', 'hazyview', 'kruger'] },
  { id: 'dullstroom', label: 'Dullstroom',    region: 'dullstroom',    lat: -25.4170, lng: 30.1050, neighbors: ['mbombela', 'blyde', 'graskop', 'hazyview'] },
  { id: 'rustenburg', label: 'Rustenburg',    region: 'rustenburg',    lat: -25.6660, lng: 27.2420, neighbors: ['jhb', 'hartbeespoort', 'pilanesberg', 'sun-city'] },
  { id: 'upington',   label: 'Upington',      region: 'upington',      lat: -28.4530, lng: 21.2560, neighbors: ['augrabies', 'kgalagadi', 'namaqualand'] },
]

// ── Quest builder ───────────────────────────────────────────────────────────
const q = (d: Omit<Quest, 'provinceName'>): Quest => ({
  ...d,
  provinceName: PROVINCES[d.province].name,
})

// Generic "anywhere" quests, instantiated per major city so the generator can
// always find something near you.
const anywhere = (
  id: string,
  d: Omit<Quest, 'id' | 'provinceName' | 'city' | 'region' | 'lat' | 'lng' | 'province'>,
  spots: { province: ProvinceId; city: string; region: string; lat: number; lng: number }[],
): Quest[] =>
  spots.map((s, i) =>
    q({
      ...d,
      id: `${id}-${i}`,
      province: s.province,
      city: s.city,
      region: s.region,
      lat: s.lat,
      lng: s.lng,
    }),
  )

const MAIN_CITIES = [
  { province: 'GP' as ProvinceId,  city: 'Johannesburg', region: 'jhb',       lat: -26.2041, lng: 28.0473 },
  { province: 'WC' as ProvinceId,  city: 'Cape Town',    region: 'cape-town', lat: -33.9249, lng: 18.4241 },
  { province: 'KZN' as ProvinceId, city: 'Durban',       region: 'durban',    lat: -29.8587, lng: 31.0218 },
]

export const QUESTS: Quest[] = [
  // ── GAUTENG ────────────────────────────────────────────────────────────────
  q({
    id: 'gold-reef-city', title: 'Gold Reef City Thrill Run', emoji: '🎢',
    category: 'adventure', province: 'GP', city: 'Johannesburg', region: 'jhb',
    lat: -26.2362, lng: 28.0121,
    durationMin: 180, cost: 250, players: [2, 8], difficulty: 3,
    vibe: ['competitive', 'chaotic', 'entertainment'],
    description: 'Ride the Anaconda, then settle who screams loudest on the tower drop.',
    purpose: 'Prove who has the strongest nerves.',
    completionLine: 'You screamed in public. Twice. Worth it.',
    xp: 500, trending: true, tags: ['theme park', 'rides', 'group'],
    completedCount: 4123,
  }),
  q({
    id: 'maboneng-art-walk', title: 'Maboneng Street Art Hunt', emoji: '🎨',
    category: 'free', province: 'GP', city: 'Johannesburg', region: 'jhb',
    lat: -26.2002, lng: 28.0638,
    durationMin: 90, cost: 0, players: [1, 6], difficulty: 1,
    vibe: ['chill', 'funny', 'entertainment'],
    description: 'Find the 10 wildest murals in Maboneng. Loser buys coffee.',
    completionLine: 'You now have strong opinions about street art. Excellent.',
    xp: 180, tags: ['art', 'walk', 'free'],
    completedCount: 2871,
  }),
  q({
    id: 'zoo-lake-paddle', title: 'Zoo Lake Sunset Paddle', emoji: '🦆',
    category: 'chill', province: 'GP', city: 'Johannesburg', region: 'jhb',
    lat: -26.1647, lng: 28.0356,
    durationMin: 60, cost: 60, players: [1, 4], difficulty: 1,
    vibe: ['chill', 'romantic'],
    description: 'Rent a pedalo, feed the ducks (responsibly), watch the sky go orange.',
    purpose: 'Do absolutely nothing. Properly.',
    completionLine: 'The ducks have adopted you. You cannot return to normal life.',
    xp: 140, tags: ['lake', 'sunset', 'relax'],
    completedCount: 1984,
  }),
  q({
    id: 'vilakazi-history', title: 'Vilakazi Street History Walk', emoji: '🏛️',
    category: 'event', province: 'GP', city: 'Soweto', region: 'jhb',
    lat: -26.2353, lng: 27.9083,
    durationMin: 150, cost: 120, players: [1, 8], difficulty: 2,
    vibe: ['chill', 'outdoors'],
    description: 'The only street in the world that housed two Nobel laureates. Walk it, soak it in.',
    purpose: 'Know where you are. It matters.',
    completionLine: 'You walked where history walked. Now go eat a kota.',
    xp: 320, trending: true, tags: ['history', 'soweto', 'culture'],
    completedCount: 3540,
  }),
  q({
    id: 'constitution-hill', title: 'Constitution Hill Tour', emoji: '⚖️',
    category: 'event', province: 'GP', city: 'Johannesburg', region: 'jhb',
    lat: -26.1889, lng: 28.0436,
    durationMin: 120, cost: 90, players: [1, 6], difficulty: 2,
    vibe: ['chill'],
    description: 'Old fort, prison, now home to our Constitutional Court. Heavy but essential.',
    completionLine: 'You did the homework your school never gave you. Gold star.',
    xp: 300, tags: ['history', 'museum'],
    completedCount: 1652,
  }),
  q({
    id: 'melville-diner-race', title: 'Melville Late-Night Diner Race', emoji: '🍔',
    category: 'food', province: 'GP', city: 'Johannesburg', region: 'jhb',
    lat: -26.1746, lng: 28.0079,
    durationMin: 90, cost: 120, players: [2, 6], difficulty: 2,
    vibe: ['food', 'funny', 'competitive'],
    description: 'Three diners, one night. Everyone gets R60 and must rate their milkshake like a wine critic.',
    completionLine: 'You critiqued a milkshake with the word "tannins". Legend.',
    xp: 240, tags: ['food', 'night', 'competition'],
    completedCount: 1108,
  }),
  q({
    id: 'sandton-pool-battle', title: 'Sandton Pool Battle', emoji: '🎱',
    category: 'activity', province: 'GP', city: 'Sandton', region: 'jhb',
    lat: -26.1076, lng: 28.0567,
    durationMin: 60, cost: 80, players: [2, 8], difficulty: 2,
    vibe: ['competitive', 'entertainment', 'funny'],
    description: 'Two teams. Winner stays. Trash talk is mandatory.',
    completionLine: 'You spent 78 minutes playing pool instead of being productive. Excellent.',
    xp: 220, trending: true, tags: ['pool', 'bar', 'competition'],
    completedCount: 2873,
  }),
  q({
    id: 'walter-sisulu-walk', title: 'Walter Sisulu Garden & Waterfall', emoji: '🦅',
    category: 'free', province: 'GP', city: 'Roodepoort', region: 'jhb',
    lat: -26.0872, lng: 27.8431,
    durationMin: 120, cost: 0, players: [1, 8], difficulty: 1,
    vibe: ['outdoors', 'chill'],
    description: 'Waterfall, verreaux\'s eagles, and the best lawn in Joburg for a picnic.',
    completionLine: 'You saw a waterfall in Gauteng. Nobody believes you. Correct.',
    xp: 200, tags: ['nature', 'waterfall', 'free'],
    completedCount: 2241,
  }),
  q({
    id: 'pretoria-jacaranda-ramble', title: 'Jacaranda Avenue Ramble', emoji: '🌸',
    category: 'free', province: 'GP', city: 'Pretoria', region: 'pretoria',
    lat: -25.7405, lng: 28.2304,
    durationMin: 75, cost: 0, players: [1, 6], difficulty: 1,
    vibe: ['chill', 'romantic'],
    description: 'Walk the purple streets (season permitting) and find the single prettiest photo spot.',
    completionLine: 'You found the prettiest street in Pretoria. It is now your wallpaper.',
    xp: 150, tags: ['walk', 'free', 'pretty'],
    completedCount: 1902,
  }),
  q({
    id: 'voortrekker-view', title: 'Voortrekker Monument View Quest', emoji: '🗿',
    category: 'event', province: 'GP', city: 'Pretoria', region: 'pretoria',
    lat: -25.7753, lng: 28.1759,
    durationMin: 90, cost: 80, players: [1, 6], difficulty: 2,
    vibe: ['chill', 'outdoors'],
    description: 'History, architecture, and the best view of Pretoria from the top.',
    completionLine: 'You climbed a monument for a view. Peak Pretoria behaviour.',
    xp: 230, tags: ['history', 'view'],
    completedCount: 1347,
  }),
  q({
    id: 'union-buildings-sunset', title: 'Union Buildings Sunset Run', emoji: '🌇',
    category: 'activity', province: 'GP', city: 'Pretoria', region: 'pretoria',
    lat: -25.7417, lng: 28.2122,
    durationMin: 45, cost: 0, players: [1, 4], difficulty: 2,
    vibe: ['outdoors', 'competitive'],
    description: 'The iconic steps, the gardens, the view. Run or walk, just do it at golden hour.',
    completionLine: 'You ran where presidents walk. Now you own the place. Obviously.',
    xp: 160, tags: ['run', 'free', 'sunset'],
    completedCount: 998,
  }),
  q({
    id: 'modderfontein-hike', title: 'Modderfontein Reserve Sunrise Hike', emoji: '🥾',
    category: 'adventure', province: 'GP', city: 'Johannesburg', region: 'jhb',
    lat: -26.0900, lng: 28.1675,
    durationMin: 150, cost: 60, players: [1, 6], difficulty: 3,
    vibe: ['outdoors'],
    description: 'Gauteng\'s secret savannah. Kudu, zebra and a sunrise that fixes you.',
    completionLine: 'You saw zebras before 7am. Your ancestors are proud.',
    xp: 350, tags: ['hike', 'nature', 'sunrise'],
    completedCount: 1204,
  }),

  // ── WESTERN CAPE ───────────────────────────────────────────────────────────
  q({
    id: 'table-mountain-cableway', title: 'Table Mountain Summit', emoji: '🗻',
    category: 'adventure', province: 'WC', city: 'Cape Town', region: 'cape-town',
    lat: -33.9533, lng: 18.4037,
    durationMin: 180, cost: 380, players: [1, 8], difficulty: 3,
    vibe: ['outdoors', 'chill'],
    description: 'Up the cable car, walk the rim, question your life choices on the way down.',
    purpose: 'Stand on the mountain the whole world photographs.',
    completionLine: 'You stood on the flat mountain. The city bowed. Correctly.',
    xp: 520, trending: true, tags: ['mountain', 'view', 'iconic'],
    completedCount: 6981,
  }),
  q({
    id: 'bokap-photo-walk', title: 'Bo-Kaap Colour Walk', emoji: '📸',
    category: 'free', province: 'WC', city: 'Cape Town', region: 'cape-town',
    lat: -33.9218, lng: 18.4153,
    durationMin: 60, cost: 0, players: [1, 6], difficulty: 1,
    vibe: ['chill', 'funny'],
    description: 'Cobbled streets, candy-coloured houses, one mandatory dramatic photo.',
    completionLine: 'Your camera roll now looks like a paint store exploded. Beautiful.',
    xp: 150, tags: ['photo', 'free', 'colour'],
    completedCount: 3122,
  }),
  q({
    id: 'kirstenbosch-picnic', title: 'Kirstenbosch Picnic & Treetop Walk', emoji: '🌿',
    category: 'chill', province: 'WC', city: 'Cape Town', region: 'cape-town',
    lat: -33.9884, lng: 18.4316,
    durationMin: 120, cost: 100, players: [1, 8], difficulty: 1,
    vibe: ['chill', 'romantic'],
    description: 'Boomslang walkway above the treetops, then a picnic on the lawn.',
    completionLine: 'You walked on a snake made of bridges. The fynbos approves.',
    xp: 210, tags: ['garden', 'picnic', 'nature'],
    completedCount: 2560,
  }),
  q({
    id: 'boulders-penguins', title: 'Boulders Beach Penguin Watch', emoji: '🐧',
    category: 'chill', province: 'WC', city: 'Simon\'s Town', region: 'cape-town',
    lat: -34.1931, lng: 18.4512,
    durationMin: 90, cost: 90, players: [1, 8], difficulty: 1,
    vibe: ['chill', 'funny'],
    description: 'Watch endangered penguins waddle, swim and absolutely own the beach.',
    completionLine: 'You met the official owners of the beach. They did not charge you rent.',
    xp: 190, tags: ['animals', 'beach', 'family'],
    completedCount: 4410,
  }),
  q({
    id: 'chapmans-drive', title: 'Chapman\'s Peak Drive Run', emoji: '🛣️',
    category: 'adventure', province: 'WC', city: 'Cape Town', region: 'cape-town',
    lat: -34.0897, lng: 18.3599,
    durationMin: 90, cost: 70, players: [1, 5], difficulty: 2,
    vibe: ['outdoors', 'chaotic'],
    description: 'The most beautiful drive in the world. Windows down, music loud.',
    completionLine: 'You drove the world\'s most beautiful road and did NOT stop for photos. Liar.',
    xp: 240, tags: ['drive', 'view', 'coast'],
    completedCount: 3301,
  }),
  q({
    id: 'old-biscuit-mill', title: 'Old Biscuit Mill Food Market', emoji: '🥐',
    category: 'food', province: 'WC', city: 'Cape Town', region: 'cape-town',
    lat: -33.9250, lng: 18.4440,
    durationMin: 90, cost: 150, players: [1, 8], difficulty: 1,
    vibe: ['food', 'chill'],
    description: 'One market, unlimited snacks. Everyone must try something they can\'t pronounce.',
    completionLine: 'You ate things you cannot pronounce and loved all of them.',
    xp: 200, trending: true, tags: ['food', 'market', 'weekend'],
    completedCount: 5203,
  }),
  q({
    id: 'muizenberg-surf', title: 'Muizenberg First Wave', emoji: '🏄',
    category: 'adventure', province: 'WC', city: 'Muizenberg', region: 'cape-town',
    lat: -34.1076, lng: 18.4681,
    durationMin: 150, cost: 200, players: [1, 6], difficulty: 4,
    vibe: ['chaotic', 'funny', 'outdoors'],
    description: 'Lesson on the friendliest wave in SA. Falling is 90% of the fun.',
    completionLine: 'You stood up. Once. For 2 seconds. It counts. It counts.',
    xp: 380, tags: ['surf', 'beach', 'lesson'],
    completedCount: 2148,
  }),
  q({
    id: 'waterfront-sunset', title: 'V&A Sunset Ferris Wheel', emoji: '🎡',
    category: 'chill', province: 'WC', city: 'Cape Town', region: 'cape-town',
    lat: -33.9035, lng: 18.4221,
    durationMin: 45, cost: 150, players: [2, 6], difficulty: 1,
    vibe: ['chill', 'romantic'],
    description: 'Ride the wheel at golden hour, take the group photo at the top.',
    purpose: 'One perfect photo. That\'s the quest.',
    completionLine: 'You took THE photo. 94% of people would recommend you.',
    xp: 160, tags: ['ferris wheel', 'sunset', 'photo'],
    completedCount: 3691,
  }),
  q({
    id: 'stellenbosch-wine-trail', title: 'Stellenbosch Wine & Walk Trail', emoji: '🍷',
    category: 'food', province: 'WC', city: 'Stellenbosch', region: 'stellenbosch',
    lat: -33.9364, lng: 18.8617,
    durationMin: 240, cost: 250, players: [2, 8], difficulty: 2,
    vibe: ['food', 'chill', 'romantic'],
    description: 'Two estates, one walk between them, zero regrets.',
    completionLine: 'You are now 40% more sophisticated. The vines are proud.',
    xp: 400, tags: ['wine', 'walk', 'winelands'],
    completedCount: 4120,
  }),
  q({
    id: 'franschhoek-bike', title: 'Franschhoek Valley Bike Ride', emoji: '🚲',
    category: 'activity', province: 'WC', city: 'Franschhoek', region: 'stellenbosch',
    lat: -33.9128, lng: 19.1216,
    durationMin: 180, cost: 180, players: [2, 6], difficulty: 2,
    vibe: ['outdoors', 'chill'],
    description: 'Ride the wine valley with the mountains behind you. Stop for one mandatory pastry.',
    completionLine: 'You cycled past vineyards and ate a croissant. Peak French. In Africa.',
    xp: 330, tags: ['cycling', 'valley', 'outdoors'],
    completedCount: 1480,
  }),
  q({
    id: 'hermanus-whales', title: 'Hermanus Whale Watching Walk', emoji: '🐋',
    category: 'event', province: 'WC', city: 'Hermanus', region: 'hermanus',
    lat: -34.4075, lng: 19.2437,
    durationMin: 150, cost: 60, players: [1, 8], difficulty: 1,
    vibe: ['chill', 'outdoors'],
    description: 'Walk the cliff path (season permitting) and spot the biggest animals on Earth from land.',
    completionLine: 'You saw a whale from the shore. The whales saw you. Awkward for everyone.',
    xp: 280, tags: ['whales', 'coast', 'walk'],
    completedCount: 2764,
  }),

  // ── KWAZULU-NATAL ──────────────────────────────────────────────────────────
  q({
    id: 'ushaka-sharks', title: 'uShaka Shark Dive (Safe Side)', emoji: '🦈',
    category: 'adventure', province: 'KZN', city: 'Durban', region: 'durban',
    lat: -29.9531, lng: 31.0467,
    durationMin: 150, cost: 250, players: [1, 8], difficulty: 3,
    vibe: ['chaotic', 'entertainment'],
    description: 'Walk through the shark tunnel, scream into the glass, survive.',
    completionLine: 'A shark swam above your head and judged your hairstyle.',
    xp: 350, tags: ['aquarium', 'sharks', 'family'],
    completedCount: 3872,
  }),
  q({
    id: 'moses-mabhida-swing', title: 'Moses Mabhida Big Swing', emoji: '🪂',
    category: 'adventure', province: 'KZN', city: 'Durban', region: 'durban',
    lat: -29.8285, lng: 31.0302,
    durationMin: 60, cost: 300, players: [1, 4], difficulty: 5,
    vibe: ['chaotic', 'competitive'],
    description: 'The world\'s tallest swing. 220m of pure "why did I say yes".',
    purpose: 'Conquer the thing that scares you most.',
    completionLine: 'You swung off a stadium arch. Your heart is still in the air. Send help.',
    xp: 600, trending: true, tags: ['swing', 'adrenaline', 'iconic'],
    completedCount: 1980,
  }),
  q({
    id: 'golden-mile-walk', title: 'Golden Mile Sunrise Walk', emoji: '🌅',
    category: 'free', province: 'KZN', city: 'Durban', region: 'durban',
    lat: -29.8581, lng: 31.0281,
    durationMin: 60, cost: 0, players: [1, 8], difficulty: 1,
    vibe: ['outdoors', 'chill'],
    description: 'The promenade, the pier, the sea air. Start the day properly.',
    completionLine: 'You walked the Golden Mile at sunrise. The ocean high-fived you.',
    xp: 150, tags: ['beach', 'free', 'sunrise'],
    completedCount: 2904,
  }),
  q({
    id: 'victoria-market-bunny', title: 'Victoria Street Market Bunny Chow', emoji: '🐰',
    category: 'food', province: 'KZN', city: 'Durban', region: 'durban',
    lat: -29.8588, lng: 31.0250,
    durationMin: 60, cost: 70, players: [1, 6], difficulty: 1,
    vibe: ['food', 'funny'],
    description: 'Durban\'s greatest invention: a hollowed-out loaf full of curry. Eat it properly.',
    completionLine: 'You ate a bunny chow with your hands. Authentic. Messy. Perfect.',
    xp: 180, trending: true, tags: ['curry', 'iconic', 'street food'],
    completedCount: 3305,
  }),
  q({
    id: 'thousand-hills-zipline', title: 'Valley of a Thousand Hills Zipline', emoji: '🪢',
    category: 'adventure', province: 'KZN', city: 'Botha\'s Hill', region: 'durban',
    lat: -29.7136, lng: 30.8589,
    durationMin: 120, cost: 320, players: [1, 8], difficulty: 3,
    vibe: ['chaotic', 'outdoors'],
    description: 'Zip across the valley with the best view in KZN underneath you.',
    completionLine: 'You flew over a thousand hills. The hills did not see it coming.',
    xp: 420, tags: ['zipline', 'adventure', 'valley'],
    completedCount: 1430,
  }),
  q({
    id: 'howick-falls', title: 'Howick Falls Stop & Stare', emoji: '💦',
    category: 'chill', province: 'KZN', city: 'Howick', region: 'midlands',
    lat: -29.4867, lng: 30.2385,
    durationMin: 45, cost: 0, players: [1, 6], difficulty: 1,
    vibe: ['chill', 'outdoors'],
    description: '95m waterfall, three viewpoints, zero effort. Perfect road-trip fuel stop.',
    completionLine: 'You stared at a 95m waterfall for 10 minutes. Meditative. Wet. Great.',
    xp: 140, tags: ['waterfall', 'free', 'road trip'],
    completedCount: 2210,
  }),
  q({
    id: 'cathedral-peak-hike', title: 'Cathedral Peak Day Hike', emoji: '⛰️',
    category: 'adventure', province: 'KZN', city: 'Drakensberg', region: 'drakensberg',
    lat: -28.9544, lng: 29.1955,
    durationMin: 360, cost: 80, players: [1, 8], difficulty: 4,
    vibe: ['outdoors'],
    description: 'The Berg. Enough said. Bring layers and your sense of awe.',
    completionLine: 'You hiked in the Drakensberg. The mountain has accepted you.',
    xp: 650, tags: ['hike', 'mountain', 'epic'],
    completedCount: 1874,
  }),
  q({
    id: 'botanical-gardens-dbn', title: 'Durban Botanical Gardens Picnic', emoji: '🌴',
    category: 'chill', province: 'KZN', city: 'Durban', region: 'durban',
    lat: -29.8461, lng: 31.0060,
    durationMin: 120, cost: 60, players: [1, 8], difficulty: 1,
    vibe: ['chill', 'romantic'],
    description: 'South Africa\'s oldest botanical garden. Bring snacks, a blanket, and nothing else.',
    completionLine: 'You napped under a 100-year-old tree. Rested. Ancient. Blessed.',
    xp: 190, tags: ['garden', 'picnic', 'relax'],
    completedCount: 1540,
  }),
  q({
    id: 'umhlanga-pier-run', title: 'Umhlanga Pier Sunrise Run', emoji: '🏃',
    category: 'activity', province: 'KZN', city: 'Umhlanga', region: 'durban',
    lat: -29.7258, lng: 31.0867,
    durationMin: 60, cost: 0, players: [1, 4], difficulty: 2,
    vibe: ['outdoors', 'competitive'],
    description: 'The iconic lighthouse, the long pier, the Indian Ocean at your elbow.',
    completionLine: 'You outran the lighthouse. It never stood a chance.',
    xp: 160, tags: ['run', 'free', 'coast'],
    completedCount: 1280,
  }),

  // ── EASTERN CAPE ───────────────────────────────────────────────────────────
  q({
    id: 'addo-elephants', title: 'Addo Elephant Morning Drive', emoji: '🐘',
    category: 'event', province: 'EC', city: 'Addo', region: 'gebeha',
    lat: -33.4428, lng: 25.7494,
    durationMin: 240, cost: 350, players: [1, 8], difficulty: 2,
    vibe: ['outdoors', 'chill'],
    description: '600+ elephants. Your own car, the back roads, zero hurry.',
    completionLine: 'An elephant looked at you and kept walking. You have been judged. You passed.',
    xp: 450, trending: true, tags: ['game drive', 'elephants', 'park'],
    completedCount: 4210,
  }),
  q({
    id: 'storms-river-swing', title: 'Storms River Mouth & Swing', emoji: '🌉',
    category: 'adventure', province: 'EC', city: 'Tsitsikamma', region: 'tsitsikamma',
    lat: -34.0178, lng: 23.8947,
    durationMin: 180, cost: 220, players: [1, 8], difficulty: 3,
    vibe: ['outdoors', 'chaotic'],
    description: 'Suspension bridges, the mouth of the river, and the big swing if you\'re brave.',
    completionLine: 'You crossed the bridges. The ocean gave you a standing ovation.',
    xp: 430, tags: ['coast', 'bridges', 'forest'],
    completedCount: 2650,
  }),
  q({
    id: 'donkin-photo', title: 'Donkin Reserve Sunset Photo Quest', emoji: '🌆',
    category: 'free', province: 'EC', city: 'Gqeberha', region: 'gebeha',
    lat: -33.9615, lng: 25.6191,
    durationMin: 60, cost: 0, players: [1, 6], difficulty: 1,
    vibe: ['chill', 'funny'],
    description: 'The pyramid, the lighthouse, the view over the bay. One dramatic photo each.',
    completionLine: 'You photographed the lighthouse at golden hour. Art. Pure art.',
    xp: 140, tags: ['photo', 'free', 'sunset'],
    completedCount: 980,
  }),
  q({
    id: 'morgan-bay-beach', title: 'Morgan Bay Beach Day', emoji: '🏖️',
    category: 'chill', province: 'EC', city: 'Morgan Bay', region: 'wild-coast',
    lat: -32.7200, lng: 28.3300,
    durationMin: 240, cost: 50, players: [1, 8], difficulty: 1,
    vibe: ['chill', 'outdoors'],
    description: 'Wild Coast beach, barely anyone there, the ocean doing all the work.',
    completionLine: 'You had a beach almost to yourself. That\'s the whole quest. Won.',
    xp: 250, tags: ['beach', 'wild coast', 'escape'],
    completedCount: 760,
  }),
  q({
    id: 'hogsback-fairy', title: 'Hogsback Forest & Fairy Quest', emoji: '🧚',
    category: 'mystery', province: 'EC', city: 'Hogsback', region: 'hogsback',
    lat: -32.6000, lng: 26.9400,
    durationMin: 180, cost: 40, players: [1, 6], difficulty: 2,
    vibe: ['chill', 'funny', 'random'],
    description: 'Indigenous forest that inspired Tolkien. Find the fairy doors. Report back.',
    completionLine: 'You found a fairy door. You are now officially Middle-Earth adjacent.',
    xp: 300, tags: ['forest', 'tolkien', 'walk'],
    completedCount: 1120,
  }),
  q({
    id: 'nahoon-sunrise', title: 'Nahoon Beach Sunrise & Coffee', emoji: '☕',
    category: 'chill', province: 'EC', city: 'East London', region: 'east-london',
    lat: -32.9970, lng: 27.9580,
    durationMin: 75, cost: 60, players: [1, 6], difficulty: 1,
    vibe: ['chill'],
    description: 'Surfers, sand, sunrise, coffee. The full East London morning.',
    completionLine: 'You did East London properly: sunrise, sand, caffeine.',
    xp: 160, tags: ['beach', 'coffee', 'sunrise'],
    completedCount: 840,
  }),

  // ── FREE STATE ─────────────────────────────────────────────────────────────
  q({
    id: 'golden-gate-hike', title: 'Golden Gate Sunset Hike', emoji: '🏜️',
    category: 'adventure', province: 'FS', city: 'Golden Gate', region: 'golden-gate',
    lat: -28.5050, lng: 28.6200,
    durationMin: 180, cost: 80, players: [1, 8], difficulty: 3,
    vibe: ['outdoors'],
    description: 'Sandstone cliffs that turn gold at sunset. Free State\'s best kept secret.',
    completionLine: 'You watched the mountains turn to gold. The Free State forgives you for doubting it.',
    xp: 380, tags: ['hike', 'sunset', 'mountains'],
    completedCount: 1450,
  }),
  q({
    id: 'naval-hill-giraffes', title: 'Naval Hill Giraffe Walk', emoji: '🦒',
    category: 'free', province: 'FS', city: 'Bloemfontein', region: 'bloemfontein',
    lat: -29.1020, lng: 26.2160,
    durationMin: 90, cost: 0, players: [1, 6], difficulty: 1,
    vibe: ['outdoors', 'chill'],
    description: 'Giraffes on a hill IN the city. Free. Walk it and pinch yourself.',
    completionLine: 'You saw a giraffe in a city. This is not a dream. It\'s Bloemfontein.',
    xp: 200, trending: true, tags: ['giraffes', 'free', 'city'],
    completedCount: 1690,
  }),
  q({
    id: 'basotho-village', title: 'Basotho Cultural Village', emoji: '🏠',
    category: 'event', province: 'FS', city: 'Golden Gate', region: 'golden-gate',
    lat: -28.5300, lng: 28.6200,
    durationMin: 120, cost: 70, players: [1, 8], difficulty: 1,
    vibe: ['chill'],
    description: 'Traditional beehive huts, storytelling and a view that refuses to be beaten.',
    completionLine: 'You sat in a beehive hut and heard stories older than your family. Humbling.',
    xp: 260, tags: ['culture', 'heritage'],
    completedCount: 890,
  }),

  // ── LIMPOPO ────────────────────────────────────────────────────────────────
  q({
    id: 'mapungubwe-hill', title: 'Mapungubwe Kingdom Climb', emoji: '👑',
    category: 'adventure', province: 'LP', city: 'Mapungubwe', region: 'mapungubwe',
    lat: -22.1960, lng: 29.2110,
    durationMin: 240, cost: 120, players: [1, 8], difficulty: 3,
    vibe: ['outdoors', 'chill'],
    description: 'Climb the hill where southern Africa\'s first kingdom ruled. The golden rhino knows.',
    completionLine: 'You stood where kings stood. The Limpopo river applauded.',
    xp: 480, tags: ['history', 'world heritage', 'hike'],
    completedCount: 620,
  }),
  q({
    id: 'modjadji-cycads', title: 'Modjadji Cycad Forest', emoji: '🌵',
    category: 'mystery', province: 'LP', city: 'Modjadji', region: 'modjadji',
    lat: -23.6190, lng: 30.3510,
    durationMin: 120, cost: 50, players: [1, 6], difficulty: 2,
    vibe: ['chill', 'random'],
    description: 'The largest concentration of cycads on Earth, guarded by the Rain Queen\'s realm.',
    completionLine: 'You walked through a forest older than dinosaurs. It remembers. You don\'t.',
    xp: 280, tags: ['nature', 'ancient', 'unique'],
    completedCount: 430,
  }),
  q({
    id: 'polokwane-reserve', title: 'Polokwane Game Reserve Loop', emoji: '🦓',
    category: 'activity', province: 'LP', city: 'Polokwane', region: 'polokwane',
    lat: -23.9360, lng: 29.4800,
    durationMin: 150, cost: 60, players: [1, 6], difficulty: 2,
    vibe: ['outdoors'],
    description: 'Big five territory IN the city limits. Drive the loop, count the species.',
    completionLine: 'You spotted game in a city. Polokwane is showing off and we love it.',
    xp: 300, tags: ['game drive', 'city', 'wildlife'],
    completedCount: 980,
  }),

  // ── MPUMALANGA ─────────────────────────────────────────────────────────────
  q({
    id: 'blyde-canyon-view', title: 'Blyde River Canyon Viewpoints', emoji: '🏞️',
    category: 'adventure', province: 'MP', city: 'Blyde River Canyon', region: 'blyde',
    lat: -24.8670, lng: 30.8830,
    durationMin: 180, cost: 90, players: [1, 8], difficulty: 2,
    vibe: ['outdoors', 'chill'],
    description: 'Third deepest canyon on Earth. God\'s Window, Bourke\'s Luck, the works.',
    completionLine: 'You looked through God\'s Window. The view filed a complaint. Too good.',
    xp: 420, trending: true, tags: ['canyon', 'view', 'panorama'],
    completedCount: 3120,
  }),
  q({
    id: 'graskop-gorge-lift', title: 'Graskop Gorge Lift Ride', emoji: '🛗',
    category: 'chill', province: 'MP', city: 'Graskop', region: 'graskop',
    lat: -24.9310, lng: 30.8400,
    durationMin: 90, cost: 180, players: [1, 8], difficulty: 1,
    vibe: ['chill', 'outdoors'],
    description: 'A lift drops you 51m into a rainforest gorge. Walk the canopy, feel small.',
    completionLine: 'You descended into the gorge and emerged wiser. Also wetter. It rains there.',
    xp: 260, tags: ['lift', 'forest', 'gorge'],
    completedCount: 1680,
  }),
  q({
    id: 'sudwala-caves', title: 'Sudwala Caves Expedition', emoji: '🕳️',
    category: 'mystery', province: 'MP', city: 'Sudwala', region: 'sudwala',
    lat: -25.3690, lng: 30.7000,
    durationMin: 120, cost: 120, players: [1, 8], difficulty: 2,
    vibe: ['chill', 'random'],
    description: '240-million-year-old caves. Walk the lit route, or do the crystal tour if you dare.',
    completionLine: 'You explored caves older than the dinosaurs. Their occupants were not home. Lucky you.',
    xp: 280, tags: ['caves', 'geology', 'adventure'],
    completedCount: 1105,
  }),
  q({
    id: 'hazyview-elephants', title: 'Hazyview Elephant Interaction', emoji: '🐘',
    category: 'event', province: 'MP', city: 'Hazyview', region: 'hazyview',
    lat: -25.0481, lng: 31.0716,
    durationMin: 90, cost: 450, players: [1, 8], difficulty: 1,
    vibe: ['chill', 'outdoors'],
    description: 'Meet rescued elephants up close, feed them, be humbled by their size.',
    completionLine: 'An elephant took food from your hand. You are now its humble servant.',
    xp: 350, tags: ['elephants', 'animals', 'sanctuary'],
    completedCount: 2240,
  }),
  q({
    id: 'kruger-sunrise', title: 'Kruger Sunrise Safari Drive', emoji: '🦁',
    category: 'adventure', province: 'MP', city: 'Kruger Park', region: 'kruger',
    lat: -23.9440, lng: 31.1460,
    durationMin: 240, cost: 380, players: [1, 8], difficulty: 2,
    vibe: ['outdoors', 'chaotic'],
    description: 'Gates open at 5:30. Be first through. The Big Five are not early risers. You are.',
    completionLine: 'You saw the Big Five (or lied about it). The bush never forgets.',
    xp: 600, trending: true, tags: ['safari', 'big five', 'iconic'],
    completedCount: 5230,
  }),

  // ── NORTH WEST ─────────────────────────────────────────────────────────────
  q({
    id: 'sun-city-splash', title: 'Sun City Valley of Waves', emoji: '🌊',
    category: 'activity', province: 'NW', city: 'Sun City', region: 'sun-city',
    lat: -25.3440, lng: 27.0960,
    durationMin: 240, cost: 350, players: [2, 10], difficulty: 2,
    vibe: ['chaotic', 'entertainment'],
    description: 'Artificial waves in the bushveld. Slide first, ask questions later.',
    completionLine: 'You surfed a wave in the middle of the bush. The lions are confused. So are you.',
    xp: 450, tags: ['water park', 'slides', 'weekend'],
    completedCount: 3100,
  }),
  q({
    id: 'pilanesberg-loop', title: 'Pilanesberg Sunset Game Drive', emoji: '🦏',
    category: 'event', province: 'NW', city: 'Pilanesberg', region: 'pilanesberg',
    lat: -25.2570, lng: 27.1010,
    durationMin: 180, cost: 150, players: [1, 8], difficulty: 1,
    vibe: ['outdoors', 'chill'],
    description: 'A volcanic crater full of game, an hour from Joburg. Sunset drives hit different.',
    completionLine: 'A rhino crossed the road in front of you. You have been blessed. Pass it on.',
    xp: 380, tags: ['game drive', 'sunset', 'crater'],
    completedCount: 2900,
  }),
  q({
    id: 'harties-cableway', title: 'Hartbeespoort Cableway View', emoji: '🚡',
    category: 'chill', province: 'NW', city: 'Hartbeespoort', region: 'hartbeespoort',
    lat: -25.7386, lng: 27.8980,
    durationMin: 120, cost: 190, players: [1, 8], difficulty: 1,
    vibe: ['chill', 'romantic'],
    description: 'Up the Magaliesberg in a cable car, dam below, sundowners above.',
    completionLine: 'You drank a sundowner above the dam. The view paid for the ticket.',
    xp: 280, tags: ['cableway', 'view', 'sundowner'],
    completedCount: 1870,
  }),

  // ── NORTHERN CAPE ──────────────────────────────────────────────────────────
  q({
    id: 'big-hole-kimberley', title: 'Kimberley Big Hole & Mine Museum', emoji: '⛏️',
    category: 'event', province: 'NC', city: 'Kimberley', region: 'kimberley',
    lat: -28.7378, lng: 24.7590,
    durationMin: 120, cost: 90, players: [1, 8], difficulty: 1,
    vibe: ['chill'],
    description: 'The largest hand-dug hole on Earth. Diamonds made this country what it is.',
    completionLine: 'You stared into the Big Hole. It stared back. It\'s very big.',
    xp: 300, tags: ['history', 'diamonds', 'museum'],
    completedCount: 1340,
  }),
  q({
    id: 'augrabies-thunder', title: 'Augrabies Falls Thunder Walk', emoji: '💧',
    category: 'adventure', province: 'NC', city: 'Augrabies', region: 'augrabies',
    lat: -28.5911, lng: 20.3391,
    durationMin: 150, cost: 90, players: [1, 6], difficulty: 2,
    vibe: ['outdoors'],
    description: 'The Orange River thundering into a 56m gorge. "Augrabies" means place of great noise.',
    completionLine: 'You heard the falls before you saw them. Your ears will be fine. Probably.',
    xp: 320, tags: ['waterfall', 'desert', 'powerful'],
    completedCount: 880,
  }),
  q({
    id: 'kgalagadi-dunes', title: 'Kgalagadi Red Dune Drive', emoji: '🐆',
    category: 'adventure', province: 'NC', city: 'Kgalagadi', region: 'kgalagadi',
    lat: -26.4700, lng: 20.6110,
    durationMin: 300, cost: 400, players: [1, 8], difficulty: 3,
    vibe: ['outdoors'],
    description: 'Red dunes, black-maned lions, and more sky than you have ever seen.',
    completionLine: 'You drove through red dunes under a sky with no horizon. Botswana waved.',
    xp: 550, tags: ['desert', 'big cats', 'epic'],
    completedCount: 720,
  }),
  q({
    id: 'namaqualand-flowers', title: 'Namaqualand Flower Season', emoji: '🌼',
    category: 'event', province: 'NC', city: 'Springbok', region: 'namaqualand',
    lat: -29.6640, lng: 17.8860,
    durationMin: 240, cost: 100, players: [1, 8], difficulty: 1,
    vibe: ['chill', 'romantic'],
    description: 'One month a year the desert explodes into flowers. Time it right and weep.',
    completionLine: 'You saw the desert bloom. It only happens for a month. You were there.',
    xp: 420, trending: true, tags: ['flowers', 'spring', 'desert'],
    completedCount: 1560,
  }),

  ...HANGOUT_QUESTS,

  // ── ANYWHERE / NO-PURPOSE QUESTS (main cities) ─────────────────────────────
  ...anywhere('walk-nowhere', {
    title: 'Walk Somewhere You\'ve Never Walked', emoji: '🧭',
    category: 'mystery', durationMin: 30, cost: 0, players: [1, 4], difficulty: 1,
    vibe: ['random', 'chill'],
    description: 'Pick a street you\'ve never walked. Walk 30 minutes. Turn around. No maps, no plan.',
    purpose: 'There is no purpose. That\'s the point.',
    completionLine: 'You walked somewhere new and nothing happened. That\'s the whole quest. Perfect.',
    xp: 100, tags: ['free', 'explore', 'no purpose'],
    completedCount: 1450,
  }, MAIN_CITIES),
  ...anywhere('weirdest-r50', {
    title: 'The R50 Weirdest Thing', emoji: '🛒',
    category: 'mystery', durationMin: 60, cost: 50, players: [2, 5], difficulty: 2,
    vibe: ['funny', 'random', 'chaotic'],
    description: 'Everyone gets R50. Enter a shop. Buy the weirdest thing you can find. Compare. Vote.',
    completionLine: 'Someone bought something that cannot be described. The group is scarred. Winner.',
    xp: 180, tags: ['challenge', 'funny', 'shopping'],
    completedCount: 890,
  }, MAIN_CITIES),
  ...anywhere('ice-cream-quest', {
    title: 'Buy Ice Cream. That\'s It.', emoji: '🍦',
    category: 'food', durationMin: 30, cost: 40, players: [1, 6], difficulty: 1,
    vibe: ['chill', 'funny'],
    description: 'Find the best ice cream nearby. Buy it. Eat it. Quest complete.',
    purpose: 'Some quests are simple. This one is.',
    completionLine: 'You bought ice cream and did the quest. 10/10 efficiency. 10/10 flavour.',
    xp: 80, tags: ['ice cream', 'simple', 'treat'],
    completedCount: 2030,
  }, MAIN_CITIES),
  ...anywhere('drive-nowhere', {
    title: 'Drive Somewhere You\'ve Never Been', emoji: '🚗',
    category: 'mystery', durationMin: 90, cost: 100, players: [1, 4], difficulty: 2,
    vibe: ['random', 'chaotic'],
    description: 'Within 20 km of home, find a road you\'ve never driven. Drive it. Stop somewhere random.',
    completionLine: 'You got lost in your own city. Congratulations, you found something new.',
    xp: 200, tags: ['drive', 'explore', 'adventure'],
    completedCount: 760,
  }, MAIN_CITIES),
  ...anywhere('group-photo', {
    title: 'Recreate Your Oldest Group Photo', emoji: '📸',
    category: 'mystery', durationMin: 60, cost: 0, players: [2, 10], difficulty: 1,
    vibe: ['funny', 'romantic'],
    description: 'Find that embarrassing old photo. Same people, same pose, same spot if you can.',
    completionLine: 'You recreated the photo. Nobody looks the same. Everything is the same.',
    xp: 220, tags: ['friends', 'memory', 'photo'],
    completedCount: 540,
  }, MAIN_CITIES),
  ...anywhere('oldest-building', {
    title: 'Find the Oldest Building in 5 km', emoji: '🏚️',
    category: 'mystery', durationMin: 60, cost: 0, players: [1, 4], difficulty: 2,
    vibe: ['random', 'chill'],
    description: 'No cheating. Walk, look up, and find the oldest building within 5 km. Photo proof.',
    completionLine: 'You found a building older than your grandparents. It has stories. You have photos.',
    xp: 160, tags: ['history', 'explore', 'free'],
    completedCount: 380,
  }, MAIN_CITIES),
]

// ── CHAINS (multi-stop quests) ───────────────────────────────────────────────
export const CHAINS: Chain[] = [
  {
    id: 'chain-random-sandton',
    title: 'The Random Sandton Quest',
    emoji: '🎲',
    province: 'GP', city: 'Sandton', region: 'jhb',
    lat: -26.1076, lng: 28.0567,
    vibe: ['funny', 'random', 'chaotic'],
    description: 'A completely made-up, scientifically unproven route through Sandton. Trust the process.',
    completionLine: 'You completed a quest with no meaning and it meant everything. Statistically proven.',
    xpBonus: 150,
    trending: true,
    steps: [
      { questId: 'drive-nowhere-0', note: 'Drive somewhere within 5 km you\'ve never been. 30 min.' },
      { questId: 'melville-diner-race', note: 'Everyone gets R50. Find the best food. 45 min.' },
      { questId: 'sandton-pool-battle', note: 'Two teams. Winner stays. 1 hour.' },
      { questId: 'ice-cream-quest-0', note: 'Final boss: everyone gets ice cream. 30 min.' },
    ],
  },
  {
    id: 'chain-cape-classic',
    title: 'The Cape Town Classic',
    emoji: '🏔️',
    province: 'WC', city: 'Cape Town', region: 'cape-town',
    lat: -33.9249, lng: 18.4241,
    vibe: ['chill', 'outdoors', 'romantic'],
    description: 'The greatest hits. Colour, mountain, gardens, sunset. The full Cape experience in a day.',
    completionLine: 'You did Cape Town the way the postcards promise. The postcards are jealous.',
    xpBonus: 200,
    steps: [
      { questId: 'bokap-photo-walk', note: 'Start with colour. The photo walk. 1 hour.' },
      { questId: 'table-mountain-cableway', note: 'The main event. Up and over. 3 hours.' },
      { questId: 'kirstenbosch-picnic', note: 'Recovery picnic in the gardens. 2 hours.' },
      { questId: 'waterfront-sunset', note: 'Final boss: the wheel at golden hour. 45 min.' },
    ],
  },
  {
    id: 'chain-soweto-saturday',
    title: 'Soweto Saturday',
    emoji: '🎶',
    province: 'GP', city: 'Soweto', region: 'jhb',
    lat: -26.2353, lng: 27.9083,
    vibe: ['chill', 'food', 'entertainment'],
    description: 'History, a legendary lunch, and the best night out in Joburg. A full Soweto day.',
    completionLine: 'You did Soweto right: walked the history, ate the legends, danced the night.',
    xpBonus: 180,
    steps: [
      { questId: 'vilakazi-history', note: 'Walk the famous street. 2h30.' },
      { questId: 'soweto-kota-hunt', note: 'Lunch: the great kota hunt. 45 min.' },
      { questId: 'kofifi-jazz', note: 'Live jazz into the night. 2 hours.' },
    ],
  },
  {
    id: 'chain-garden-route',
    title: 'The Garden Route Quest',
    emoji: '🌊',
    province: 'WC', city: 'Wilderness', region: 'garden-route',
    lat: -33.9940, lng: 22.5890,
    vibe: ['outdoors', 'chill'],
    description: 'Lagoon, forest, coast. Three stops along the most famous road in the country.',
    completionLine: 'You drove the Garden Route and the Garden Route drove you. Emotional. Wet. Beautiful.',
    xpBonus: 250,
    steps: [
      { questId: 'wilderness-lagoon', note: 'Paddle or stroll the lagoon. 1h30.' },
      { questId: 'knysna-heads', note: 'The Heads viewpoint & waterfront. 1h30.' },
      { questId: 'storms-river-swing', note: 'Final boss: Storms River bridges. 3 hours.' },
    ],
  },
  {
    id: 'chain-drakensberg',
    title: 'The Drakensberg Quest',
    emoji: '⛰️',
    province: 'KZN', city: 'Drakensberg', region: 'drakensberg',
    lat: -28.9544, lng: 29.1955,
    vibe: ['outdoors'],
    description: 'Falls, peaks, and the highest pub in Africa. The Berg in three acts.',
    completionLine: 'You conquered the Berg. The Berg has now conquered you. Welcome to the club.',
    xpBonus: 300,
    steps: [
      { questId: 'howick-falls', note: 'Act I: the waterfall stop. 45 min.' },
      { questId: 'cathedral-peak-hike', note: 'Act II: the big hike. 6 hours.' },
      { questId: 'sani-pass-top', note: 'Act III: Sani Pass to the highest pub. 2 hours.' },
    ],
  },
  {
    id: 'chain-kruger-day',
    title: 'The Kruger Day',
    emoji: '🦁',
    province: 'MP', city: 'Kruger Park', region: 'kruger',
    lat: -23.9440, lng: 31.1460,
    vibe: ['outdoors', 'chaotic'],
    description: 'Sunrise drive, bush braai, star field. The safari day of a lifetime, minus the crowds.',
    completionLine: 'You did Kruger properly: dawn, braai, stars. The bush says "come again".',
    xpBonus: 220,
    steps: [
      { questId: 'kruger-sunrise', note: 'First through the gate. 4 hours.' },
      { questId: 'kruger-bush-braai', note: 'Lunch over fire in the bush. 1h30.' },
      { questId: 'kruger-stargazing', note: 'Final boss: the Milky Way over the lowveld. 1 hour.' },
    ],
  },
  {
    id: 'chain-durban-mile',
    title: 'The Durban Golden Mile',
    emoji: '🌞',
    province: 'KZN', city: 'Durban', region: 'durban',
    lat: -29.8581, lng: 31.0281,
    vibe: ['food', 'chill', 'entertainment'],
    description: 'Sea, spice, and sky. The definitive Durban day, from sunrise to swim.',
    completionLine: 'You did Durban the Durban way: sea, bunny chow, ocean again. Legend.',
    xpBonus: 160,
    steps: [
      { questId: 'golden-mile-walk', note: 'Sunrise on the promenade. 1 hour.' },
      { questId: 'victoria-market-bunny', note: 'Bunny chow. Non-negotiable. 1 hour.' },
      { questId: 'ushaka-sharks', note: 'Sharks, then a swim at the beach. 2h30.' },
    ],
  },
]

// Extra quests referenced by chains that live outside the main map list
const EXTRA: Quest[] = [
  q({
    id: 'soweto-kota-hunt', title: 'The Great Kota Hunt', emoji: '🥪',
    category: 'food', province: 'GP', city: 'Soweto', region: 'jhb',
    lat: -26.2375, lng: 27.9080,
    durationMin: 45, cost: 60, players: [2, 6], difficulty: 1,
    vibe: ['food', 'funny'],
    description: 'A kota is a quarter loaf of bread with everything in it. Find the best in Soweto.',
    completionLine: 'You ate a kota the size of your face. The spaza shop owner nods at you now.',
    xp: 150, tags: ['kota', 'street food', 'iconic'],
    completedCount: 1240,
  }),
  q({
    id: 'kofifi-jazz', title: 'Kofifi Jazz Night', emoji: '🎷',
    category: 'event', province: 'GP', city: 'Soweto', region: 'jhb',
    lat: -26.2380, lng: 27.9090,
    durationMin: 120, cost: 100, players: [2, 8], difficulty: 1,
    vibe: ['entertainment', 'chill'],
    description: 'Live jazz, low lights, high soul. The way Joburg nights are supposed to go.',
    completionLine: 'You sat in a dark room full of jazz and felt 100 years old. In the best way.',
    xp: 220, tags: ['jazz', 'nightlife', 'live music'],
    completedCount: 980,
  }),
  q({
    id: 'wilderness-lagoon', title: 'Wilderness Lagoon Paddle', emoji: '🛶',
    category: 'activity', province: 'WC', city: 'Wilderness', region: 'garden-route',
    lat: -33.9940, lng: 22.5890,
    durationMin: 90, cost: 120, players: [1, 6], difficulty: 2,
    vibe: ['outdoors', 'chill'],
    description: 'Paddle the Touw River mouth where it meets the sea. Otters may or may not appear.',
    completionLine: 'You paddled a lagoon and the mountains watched. No notes.',
    xp: 240, tags: ['paddle', 'lagoon', 'nature'],
    completedCount: 760,
  }),
  q({
    id: 'knysna-heads', title: 'Knysna Heads Viewpoint', emoji: '🌅',
    category: 'chill', province: 'WC', city: 'Knysna', region: 'garden-route',
    lat: -34.0800, lng: 23.0590,
    durationMin: 90, cost: 40, players: [1, 8], difficulty: 1,
    vibe: ['chill', 'romantic'],
    description: 'Two cliffs guarding the lagoon. The view is worth the entire drive.',
    completionLine: 'You saw the Heads at sunset. Knysna has filed a claim on your heart.',
    xp: 190, tags: ['view', 'coast', 'sunset'],
    completedCount: 1350,
  }),
  q({
    id: 'sani-pass-top', title: 'Sani Pass: Highest Pub in Africa', emoji: '🍺',
    category: 'adventure', province: 'KZN', city: 'Sani Pass', region: 'drakensberg',
    lat: -29.5833, lng: 29.2833,
    durationMin: 120, cost: 200, players: [1, 6], difficulty: 3,
    vibe: ['chaotic', 'funny'],
    description: '4x4 up the pass into Lesotho, then a cold one at 2874m. Worth every switchback.',
    completionLine: 'You drank a beer at the highest pub in Africa. Altitude hit. Glory achieved.',
    xp: 350, tags: ['4x4', 'lesotho', 'pub'],
    completedCount: 820,
  }),
  q({
    id: 'kruger-bush-braai', title: 'Kruger Bush Braai', emoji: '🔥',
    category: 'food', province: 'MP', city: 'Kruger Park', region: 'kruger',
    lat: -24.9828, lng: 31.6000,
    durationMin: 90, cost: 150, players: [2, 8], difficulty: 1,
    vibe: ['food', 'outdoors'],
    description: 'Fire, boerewors, and the sounds of the bush. The original South African restaurant.',
    completionLine: 'You braaied in the bush. The flames applauded. The lions stayed respectfully away.',
    xp: 260, tags: ['braai', 'bush', 'food'],
    completedCount: 1130,
  }),
  q({
    id: 'kruger-stargazing', title: 'Kruger Stargazing', emoji: '🌌',
    category: 'chill', province: 'MP', city: 'Kruger Park', region: 'kruger',
    lat: -24.9828, lng: 31.6000,
    durationMin: 60, cost: 50, players: [1, 6], difficulty: 1,
    vibe: ['chill', 'romantic'],
    description: 'No light pollution, no phones. Just the Milky Way doing its thing.',
    completionLine: 'You saw more stars than you knew existed. You are small. The sky is big. Perfect.',
    xp: 180, tags: ['stars', 'night', 'sky'],
    completedCount: 640,
  }),
]

export const ALL_QUESTS: Quest[] = [...QUESTS, ...EXTRA]

export const questById = (id: string): Quest => {
  const quest = ALL_QUESTS.find((x) => x.id === id)
  if (!quest) throw new Error(`Unknown quest: ${id}`)
  return quest
}

export interface ChainStats {
  durationMin: number
  cost: number
  players: [number, number]
  xp: number
}

export const chainStats = (chain: Chain): ChainStats => {
  const steps = chain.steps.map((s) => questById(s.questId))
  return {
    durationMin: steps.reduce((a, s) => a + s.durationMin, 0),
    cost: steps.reduce((a, s) => a + s.cost, 0),
    players: [
      Math.min(...steps.map((s) => s.players[0])),
      Math.max(...steps.map((s) => s.players[1])),
    ] as [number, number],
    xp: steps.reduce((a, s) => a + s.xp, 0) + chain.xpBonus,
  }
}
