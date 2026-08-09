// ─────────────────────────────────────────────────────────────────────────────
// South African gazetteer for Google-Maps-style autocomplete.
// Fully local & free: cities, towns, suburbs, airports, universities, malls,
// landmarks and colleges — with aliases so "JHB", "UCT", "AIE" all resolve.
// Unknown places fall back to OpenStreetMap's free Nominatim API.
// ─────────────────────────────────────────────────────────────────────────────
import type { ProvinceId } from './quests'

export type GazType = 'city' | 'town' | 'suburb' | 'airport' | 'university' | 'mall' | 'landmark' | 'college'

export interface GazPlace {
  name: string
  province: ProvinceId
  lat: number
  lng: number
  type: GazType
  aliases?: string[]
}

export interface GazHit {
  name: string
  sub: string
  lat: number
  lng: number
  source: 'local' | 'osm'
}

const TYPE_LABEL: Record<GazType, string> = {
  city: '',
  town: '',
  suburb: 'Suburb',
  airport: 'Airport',
  university: 'University',
  mall: 'Mall',
  landmark: 'Landmark',
  college: 'College',
}

const PROV: Record<ProvinceId, string> = {
  GP: 'Gauteng',
  WC: 'Western Cape',
  KZN: 'KwaZulu-Natal',
  EC: 'Eastern Cape',
  FS: 'Free State',
  LP: 'Limpopo',
  MP: 'Mpumalanga',
  NW: 'North West',
  NC: 'Northern Cape',
}

const g = (
  name: string,
  province: ProvinceId,
  lat: number,
  lng: number,
  type: GazType,
  aliases?: string[],
): GazPlace => ({ name, province, lat, lng, type, aliases })

export const GAZ_PLACES: GazPlace[] = [
  // ── Cities & towns (all provinces) ─────────────────────────────────────────
  g('Johannesburg', 'GP', -26.2041, 28.0473, 'city', ['JHB', 'Joburg', 'Egoli']),
  g('Pretoria', 'GP', -25.7479, 28.2293, 'city', ['PTA', 'Tshwane']),
  g('Sandton', 'GP', -26.1076, 28.0567, 'city'),
  g('Soweto', 'GP', -26.2678, 27.8585, 'city'),
  g('Midrand', 'GP', -25.9895, 28.1284, 'city'),
  g('Centurion', 'GP', -25.8589, 28.1892, 'city'),
  g('Krugersdorp', 'GP', -26.1033, 27.7748, 'town'),
  g('Randburg', 'GP', -26.0935, 28.0026, 'city'),
  g('Roodepoort', 'GP', -26.1625, 27.8725, 'town'),
  g('Boksburg', 'GP', -26.2116, 28.2595, 'town'),
  g('Benoni', 'GP', -26.1884, 28.3207, 'town'),
  g('Springs', 'GP', -26.2567, 28.4431, 'town'),
  g('Brakpan', 'GP', -26.2349, 28.3693, 'town'),
  g('Edenvale', 'GP', -26.1394, 28.1538, 'town'),
  g('Kempton Park', 'GP', -26.0936, 28.2354, 'town'),
  g('Alberton', 'GP', -26.2671, 28.1222, 'town'),
  g('Germiston', 'GP', -26.2152, 28.1762, 'town'),
  g('Tembisa', 'GP', -25.9986, 28.2265, 'town'),
  g('Vereeniging', 'GP', -26.6736, 27.9262, 'town'),
  g('Vanderbijlpark', 'GP', -26.7035, 27.8252, 'town'),
  g('Heidelberg', 'GP', -26.5005, 28.3589, 'town'),
  g('Cullinan', 'GP', -25.6728, 28.5214, 'town'),
  g('Bronkhorstspruit', 'GP', -25.8085, 28.7425, 'town'),
  g('Hammanskraal', 'GP', -25.4081, 28.2789, 'town'),
  g('Nigel', 'GP', -26.4296, 28.4755, 'town'),
  g('Cape Town', 'WC', -33.9249, 18.4241, 'city', ['CPT']),
  g('Stellenbosch', 'WC', -33.9364, 18.8617, 'town', ['Stellies']),
  g('Paarl', 'WC', -33.7242, 18.9621, 'town'),
  g('Franschhoek', 'WC', -33.9128, 19.1216, 'town'),
  g('Worcester', 'WC', -33.6465, 19.4485, 'town'),
  g('Robertson', 'WC', -33.8036, 19.8854, 'town'),
  g('Montagu', 'WC', -33.7862, 20.1164, 'town'),
  g('Swellendam', 'WC', -34.0229, 20.4425, 'town'),
  g('Caledon', 'WC', -34.23, 19.4298, 'town'),
  g('Bredasdorp', 'WC', -34.5324, 20.0408, 'town'),
  g('Struisbaai', 'WC', -34.8033, 20.0574, 'town'),
  g('Agulhas', 'WC', -34.8275, 19.9994, 'town', ['Cape Agulhas', 'Southernmost tip of Africa']),
  g('Gansbaai', 'WC', -34.5827, 19.3521, 'town'),
  g('Kleinmond', 'WC', -34.3395, 19.0244, 'town'),
  g("Betty's Bay", 'WC', -34.3555, 18.8924, 'town'),
  g('Hermanus', 'WC', -34.4075, 19.2437, 'town'),
  g("Simon's Town", 'WC', -34.1913, 18.436, 'town'),
  g('Muizenberg', 'WC', -34.1076, 18.4681, 'town'),
  g('Hout Bay', 'WC', -34.0337, 18.3543, 'town'),
  g('Somerset West', 'WC', -34.0837, 18.8481, 'town'),
  g('Strand', 'WC', -34.1125, 18.8344, 'town'),
  g("Gordon's Bay", 'WC', -34.1572, 18.8639, 'town'),
  g('Grabouw', 'WC', -34.1549, 19.0155, 'town'),
  g('Ceres', 'WC', -33.3689, 19.3107, 'town'),
  g('Tulbagh', 'WC', -33.2873, 19.1438, 'town'),
  g('Oudtshoorn', 'WC', -33.5906, 22.2044, 'town'),
  g('George', 'WC', -33.9559, 22.461, 'town'),
  g('Mossel Bay', 'WC', -34.183, 22.1352, 'town'),
  g('Wilderness', 'WC', -33.994, 22.589, 'town'),
  g('Knysna', 'WC', -34.036, 23.048, 'town'),
  g('Riversdale', 'WC', -34.0934, 21.2581, 'town'),
  g('Beaufort West', 'WC', -32.3531, 22.5812, 'town'),
  g('Laingsburg', 'WC', -33.1952, 20.8589, 'town'),
  g('Clanwilliam', 'WC', -32.1754, 18.8923, 'town'),
  g('Citrusdal', 'WC', -32.5922, 19.0122, 'town'),
  g('Langebaan', 'WC', -33.0879, 18.0329, 'town'),
  g('Saldanha', 'WC', -32.9987, 17.9434, 'town'),
  g('Paternoster', 'WC', -32.8119, 17.8917, 'town'),
  g('Darling', 'WC', -33.3788, 18.3824, 'town'),
  g('Malmesbury', 'WC', -33.4602, 18.7276, 'town'),
  g('Wellington', 'WC', -33.6397, 19.0044, 'town'),
  g('Durban', 'KZN', -29.8587, 31.0218, 'city', ['DBN']),
  g('Pietermaritzburg', 'KZN', -29.6006, 30.3794, 'city', ['PMB']),
  g('Umhlanga', 'KZN', -29.7258, 31.0867, 'town'),
  g('Ballito', 'KZN', -29.5389, 31.2144, 'town'),
  g('Salt Rock', 'KZN', -29.4939, 31.2395, 'town'),
  g('Kloof', 'KZN', -29.7883, 30.8292, 'town'),
  g('Hillcrest', 'KZN', -29.7755, 30.7699, 'town'),
  g('Westville', 'KZN', -29.8307, 30.9275, 'town'),
  g('Pinetown', 'KZN', -29.8167, 30.8519, 'town'),
  g('Port Shepstone', 'KZN', -30.7414, 30.4549, 'town'),
  g('Scottburgh', 'KZN', -30.2865, 30.7533, 'town'),
  g('Margate', 'KZN', -30.861, 30.371, 'town'),
  g('Port Edward', 'KZN', -31.0491, 30.2226, 'town'),
  g('Richards Bay', 'KZN', -28.7807, 32.0377, 'town'),
  g('Empangeni', 'KZN', -28.7612, 31.8936, 'town'),
  g('Newcastle', 'KZN', -27.7446, 29.9318, 'town'),
  g('Ladysmith', 'KZN', -28.5591, 29.7807, 'town'),
  g('Estcourt', 'KZN', -29.0, 29.8667, 'town'),
  g('Howick', 'KZN', -29.4852, 30.2313, 'town'),
  g('Mooi River', 'KZN', -29.2073, 29.9951, 'town'),
  g('Underberg', 'KZN', -29.7927, 29.4931, 'town'),
  g('Himeville', 'KZN', -29.7471, 29.5125, 'town'),
  g('Kokstad', 'KZN', -30.5471, 29.4247, 'town'),
  g('St Lucia', 'KZN', -28.3753, 32.4104, 'town'),
  g('Hluhluwe', 'KZN', -28.0199, 32.2691, 'town'),
  g('Mtubatuba', 'KZN', -28.4178, 32.1855, 'town'),
  g('Vryheid', 'KZN', -27.7685, 30.7929, 'town'),
  g('Dundee', 'KZN', -28.1667, 30.2333, 'town'),
  g('Gqeberha', 'EC', -33.9615, 25.6201, 'city', ['Port Elizabeth', 'PE', 'PLZ', 'The Bay', 'Nelson Mandela Bay']),
  g('East London', 'EC', -33.0153, 27.9116, 'city', ['EL']),
  g('Mthatha', 'EC', -31.5889, 28.7834, 'town', ['Umtata']),
  g('Makhanda', 'EC', -33.3106, 26.5256, 'town', ['Grahamstown']),
  g('Port Alfred', 'EC', -33.6018, 26.8954, 'town'),
  g('Jeffreys Bay', 'EC', -34.043, 24.922, 'town', ['JBay']),
  g('St Francis Bay', 'EC', -34.167, 24.826, 'town'),
  g('Port St Johns', 'EC', -31.6328, 29.5367, 'town'),
  g('Graaff-Reinet', 'EC', -32.2522, 24.5308, 'town'),
  g('Cradock', 'EC', -32.1642, 25.6192, 'town'),
  g('Queenstown', 'EC', -31.8974, 26.8795, 'town'),
  g("King William's Town", 'EC', -32.8793, 27.3913, 'town'),
  g('Butterworth', 'EC', -32.3312, 28.1492, 'town'),
  g('Addo', 'EC', -33.5437, 25.7031, 'town'),
  g('Kirkwood', 'EC', -33.3981, 25.4429, 'town'),
  g('Hogsback', 'EC', -32.6, 26.94, 'town'),
  g('Bloemfontein', 'FS', -29.0852, 26.1596, 'city', ['BFN', 'Bloem']),
  g('Welkom', 'FS', -27.9774, 26.7351, 'town'),
  g('Bethlehem', 'FS', -28.2309, 28.3026, 'town'),
  g('Clarens', 'FS', -28.5167, 28.4185, 'town'),
  g('Ladybrand', 'FS', -29.1954, 27.4535, 'town'),
  g('Harrismith', 'FS', -28.2722, 29.1294, 'town'),
  g('Kroonstad', 'FS', -27.6454, 27.2337, 'town'),
  g('Sasolburg', 'FS', -26.8136, 27.8171, 'town'),
  g('Parys', 'FS', -26.903, 27.457, 'town'),
  g('Phuthaditjhaba', 'FS', -28.5296, 28.8108, 'town'),
  g('Polokwane', 'LP', -23.8962, 29.4486, 'city', ['Pietersburg']),
  g('Tzaneen', 'LP', -23.8238, 30.1639, 'town'),
  g('Hoedspruit', 'LP', -24.3512, 30.9534, 'town'),
  g('Phalaborwa', 'LP', -23.9429, 31.1424, 'town'),
  g('Thohoyandou', 'LP', -22.9459, 30.4849, 'town'),
  g('Louis Trichardt', 'LP', -23.0458, 29.9066, 'town', ['Makhado']),
  g('Musina', 'LP', -22.3407, 30.041, 'town', ['Messina']),
  g('Mokopane', 'LP', -24.1944, 29.0097, 'town', ['Potgietersrus']),
  g('Modimolle', 'LP', -24.7004, 28.4032, 'town', ['Nylstroom']),
  g('Bela-Bela', 'LP', -24.8839, 28.2921, 'town', ['Warmbaths']),
  g('Lephalale', 'LP', -23.6667, 27.75, 'town', ['Ellisras']),
  g('Groblersdal', 'LP', -25.1667, 29.4, 'town'),
  g('Mbombela', 'MP', -25.465, 30.985, 'city', ['Nelspruit']),
  g('White River', 'MP', -25.3267, 31.0148, 'town'),
  g('Hazyview', 'MP', -25.0481, 31.0716, 'town'),
  g('Sabie', 'MP', -25.0993, 30.7823, 'town'),
  g('Graskop', 'MP', -24.9312, 30.8407, 'town'),
  g("Pilgrim's Rest", 'MP', -24.9089, 30.7586, 'town'),
  g('Lydenburg', 'MP', -25.0973, 30.4582, 'town', ['Mashishing']),
  g('Ohrigstad', 'MP', -24.7502, 30.5606, 'town'),
  g('Barberton', 'MP', -25.7872, 31.0423, 'town'),
  g('Kaapsehoop', 'MP', -25.5892, 30.7653, 'town'),
  g('Waterval Boven', 'MP', -25.6413, 30.3506, 'town', ['Emgwenya']),
  g('Badplaas', 'MP', -25.958, 30.5651, 'town'),
  g('Secunda', 'MP', -26.55, 29.2, 'town'),
  g('Bethal', 'MP', -26.4581, 29.4655, 'town'),
  g('Ermelo', 'MP', -26.5333, 29.9833, 'town'),
  g('Middelburg', 'MP', -25.7751, 29.4648, 'town'),
  g('eMalahleni', 'MP', -25.8756, 29.2265, 'town', ['Witbank']),
  g('Belfast', 'MP', -25.6894, 30.0353, 'town', ['eMakhazeni']),
  g('Dullstroom', 'MP', -25.417, 30.105, 'town'),
  g('Rustenburg', 'NW', -25.666, 27.242, 'city'),
  g('Mahikeng', 'NW', -25.8652, 25.6442, 'town', ['Mafikeng', 'Mafeking']),
  g('Klerksdorp', 'NW', -26.862, 26.668, 'town'),
  g('Potchefstroom', 'NW', -26.7167, 27.1, 'town'),
  g('Lichtenburg', 'NW', -26.1488, 26.1594, 'town'),
  g('Zeerust', 'NW', -25.5369, 26.0827, 'town'),
  g('Brits', 'NW', -25.6349, 27.7803, 'town'),
  g('Hartbeespoort', 'NW', -25.7386, 27.898, 'town'),
  g('Sun City', 'NW', -25.344, 27.096, 'town'),
  g('Kimberley', 'NC', -28.7383, 24.7586, 'city', ['KIM', 'Diamond City']),
  g('Upington', 'NC', -28.453, 21.256, 'town'),
  g('Kuruman', 'NC', -27.4529, 23.4322, 'town'),
  g('Kathu', 'NC', -27.6956, 23.0494, 'town'),
  g('Springbok', 'NC', -29.664, 17.886, 'town'),
  g('Calvinia', 'NC', -31.4707, 20.1322, 'town'),
  g('Sutherland', 'NC', -32.3954, 20.6614, 'town'),
  g('De Aar', 'NC', -30.6497, 24.0123, 'town'),
  g('Colesberg', 'NC', -30.7187, 25.0915, 'town'),
  g('Victoria West', 'NC', -31.4021, 23.1169, 'town'),
  g('Carnarvon', 'NC', -30.9674, 22.1352, 'town'),

  // ── Hot suburbs & precincts ────────────────────────────────────────────────
  g('Rosebank', 'GP', -26.1445, 28.0414, 'suburb'),
  g('Melville', 'GP', -26.1746, 28.0079, 'suburb'),
  g('Maboneng', 'GP', -26.2002, 28.0638, 'suburb'),
  g('Braamfontein', 'GP', -26.1921, 28.0322, 'suburb'),
  g('Newtown', 'GP', -26.2016, 28.0348, 'suburb'),
  g('Greenside', 'GP', -26.1569, 28.0233, 'suburb'),
  g('Parkhurst', 'GP', -26.1444, 28.0131, 'suburb'),
  g('Norwood', 'GP', -26.1507, 28.0802, 'suburb'),
  g('Yeoville', 'GP', -26.1736, 28.0623, 'suburb'),
  g('Killarney', 'GP', -26.162, 28.0535, 'suburb'),
  g('Hyde Park', 'GP', -26.1316, 28.049, 'suburb'),
  g('Melrose Arch', 'GP', -26.136, 28.061, 'suburb'),
  g('Fourways', 'GP', -26.0167, 28.0045, 'suburb'),
  g('Hatfield', 'GP', -25.7475, 28.2331, 'suburb'),
  g('Brooklyn', 'GP', -25.7643, 28.2331, 'suburb'),
  g('Arcadia', 'GP', -25.7443, 28.2131, 'suburb'),
  g('Waterkloof', 'GP', -25.7769, 28.2369, 'suburb'),
  g('Lynnwood', 'GP', -25.7643, 28.2663, 'suburb'),
  g('Menlyn', 'GP', -25.7841, 28.2753, 'suburb'),
  g('Camps Bay', 'WC', -33.951, 18.3843, 'suburb'),
  g('Sea Point', 'WC', -33.9185, 18.3853, 'suburb'),
  g('Green Point', 'WC', -33.908, 18.409, 'suburb'),
  g('V&A Waterfront', 'WC', -33.9035, 18.4221, 'landmark'),
  g('Woodstock', 'WC', -33.9264, 18.4449, 'suburb'),
  g('Observatory', 'WC', -33.9394, 18.4665, 'suburb'),
  g('Claremont', 'WC', -33.9801, 18.4653, 'suburb'),
  g('Rondebosch', 'WC', -33.9634, 18.4765, 'suburb'),
  g('Newlands', 'WC', -33.9785, 18.4498, 'suburb'),
  g('Constantia', 'WC', -34.0314, 18.4185, 'suburb'),
  g('Bo-Kaap', 'WC', -33.9218, 18.4153, 'landmark'),
  g('Kalk Bay', 'WC', -34.1282, 18.4501, 'suburb'),
  g('Milnerton', 'WC', -33.8635, 18.4888, 'suburb'),
  g('Table View', 'WC', -33.8215, 18.4853, 'suburb'),
  g('Durbanville', 'WC', -33.8312, 18.6483, 'suburb'),
  g('Bellville', 'WC', -33.8993, 18.6293, 'suburb'),
  g('Parow', 'WC', -33.9004, 18.5918, 'suburb'),
  g('Umhlanga Rocks', 'KZN', -29.7258, 31.0867, 'suburb'),
  g('Musgrave', 'KZN', -29.8444, 31.0145, 'suburb'),
  g('Berea', 'KZN', -29.8349, 30.9984, 'suburb'),
  g('Glenwood', 'KZN', -29.8706, 30.9797, 'suburb'),
  g('Morningside', 'KZN', -29.8281, 31.0305, 'suburb'),
  g('Bluff', 'KZN', -29.9307, 31.0022, 'suburb'),
  g('KwaMashu', 'KZN', -29.7433, 30.9707, 'suburb'),
  g('Umlazi', 'KZN', -29.9636, 30.8797, 'suburb'),
  g('Khayelitsha', 'WC', -34.0387, 18.6771, 'suburb'),
  g('Gugulethu', 'WC', -33.9783, 18.5623, 'suburb'),
  g("Mitchell's Plain", 'WC', -34.0477, 18.6218, 'suburb'),
  g('Mdantsane', 'EC', -32.9475, 27.7425, 'suburb'),

  // ── Airports ───────────────────────────────────────────────────────────────
  g('OR Tambo International Airport', 'GP', -26.1392, 28.246, 'airport', ['ORTIA', 'JNB airport']),
  g('Cape Town International Airport', 'WC', -33.9715, 18.6021, 'airport', ['CPT airport']),
  g('King Shaka International Airport', 'KZN', -29.6172, 31.1089, 'airport', ['Durban airport']),
  g('Lanseria Airport', 'GP', -25.9384, 27.9261, 'airport', ['Lanseria']),
  g('Wonderboom Airport', 'GP', -25.6502, 28.2213, 'airport'),
  g('Kruger Mpumalanga International Airport', 'MP', -25.3833, 31.1056, 'airport', ['KMIA']),
  g('Chief Dawid Stuurman International Airport', 'EC', -33.986, 25.6046, 'airport', ['Gqeberha airport', 'PE airport', 'PLZ']),
  g('East London Airport', 'EC', -33.0356, 27.8259, 'airport', ['EL airport']),
  g('Bram Fischer International Airport', 'FS', -29.0925, 26.3024, 'airport', ['Bloemfontein airport', 'BFN']),
  g('Kimberley Airport', 'NC', -28.8028, 24.7652, 'airport'),
  g('Upington Airport', 'NC', -28.4008, 21.2606, 'airport'),
  g('George Airport', 'WC', -34.0056, 22.3789, 'airport'),

  // ── Universities (with acronym aliases) ────────────────────────────────────
  g('University of the Witwatersrand', 'GP', -26.1918, 28.0306, 'university', ['Wits', 'WITS', 'Wits University']),
  g('University of Johannesburg', 'GP', -26.1835, 28.0065, 'university', ['UJ']),
  g('University of Pretoria', 'GP', -25.7547, 28.2312, 'university', ['UP', 'Tuks', 'TUKS']),
  g('University of South Africa', 'GP', -25.7683, 28.1983, 'university', ['UNISA']),
  g('Tshwane University of Technology', 'GP', -25.7231, 28.1729, 'university', ['TUT']),
  g('University of Cape Town', 'WC', -33.9571, 18.4606, 'university', ['UCT']),
  g('Stellenbosch University', 'WC', -33.9293, 18.8648, 'university', ['SU', 'Stellies']),
  g('University of the Western Cape', 'WC', -33.9331, 18.6305, 'university', ['UWC']),
  g('Cape Peninsula University of Technology', 'WC', -33.9324, 18.6295, 'university', ['CPUT']),
  g('University of KwaZulu-Natal', 'KZN', -29.8678, 30.9806, 'university', ['UKZN']),
  g('Durban University of Technology', 'KZN', -29.8578, 31.0006, 'university', ['DUT']),
  g('Mangosuthu University of Technology', 'KZN', -29.9667, 30.8833, 'university', ['MUT']),
  g('Nelson Mandela University', 'EC', -33.9663, 25.6022, 'university', ['NMU']),
  g('Walter Sisulu University', 'EC', -31.5803, 28.7841, 'university', ['WSU']),
  g('University of the Free State', 'FS', -29.1044, 26.1853, 'university', ['UFS', 'Kovsies']),
  g('Vaal University of Technology', 'GP', -26.6845, 27.9292, 'university', ['VUT']),
  g('University of Limpopo', 'LP', -23.8857, 29.739, 'university', ['UL']),
  g('University of Mpumalanga', 'MP', -25.4381, 30.9526, 'university', ['UMP']),
  g('North-West University', 'NW', -26.6935, 27.0924, 'university', ['NWU', 'PUK']),
  g('Sol Plaatje University', 'NC', -28.7441, 24.7557, 'university', ['SPU']),

  // ── Malls & landmarks ──────────────────────────────────────────────────────
  // The Big Red Barn & the Irene / Centurion cluster (flower farm + nearby things to do)
  g('The Big Red Barn', 'GP', -25.8745, 28.243, 'landmark', ['Big Red Barn', 'Red Barn', 'Adene flowers', 'flower farm Centurion']),
  g('Irene', 'GP', -25.8684, 28.218, 'suburb', ['Irene, Centurion']),
  g('Sunlawns AH', 'GP', -25.8745, 28.243, 'suburb', ['Sunlawns']),
  g('Rietvlei Nature Reserve', 'GP', -25.8789, 28.2847, 'landmark', ['Rietvlei Dam', 'Rietvlei']),
  g('Smuts House Museum', 'GP', -25.8884, 28.2319, 'landmark', ['Jan Smuts House', 'Smuts House']),
  g('Irene Dairy Farm', 'GP', -25.8797, 28.2117, 'landmark', ['Irene Dairy']),
  g('Irene Village Mall', 'GP', -25.8616, 28.2503, 'mall'),
  g('Zwartkops Raceway', 'GP', -25.8096, 28.1096, 'landmark', ['Zwartkops']),
  g('SuperSport Park', 'GP', -25.8596, 28.1956, 'landmark', ['Centurion cricket', 'Supersport Park']),
  g('Centurion Mall', 'GP', -25.8565, 28.1869, 'mall'),
  g('Irene Country Lodge', 'GP', -25.8761, 28.2107, 'landmark'),
  g('Nelson Mandela Square', 'GP', -26.1073, 28.0556, 'landmark', ['Mandela Square']),
  g('Sandton City', 'GP', -26.1076, 28.0567, 'mall'),
  g('Mall of Africa', 'GP', -26.0151, 28.1074, 'mall'),
  g('Menlyn Park', 'GP', -25.7825, 28.276, 'mall'),
  g('Gateway Theatre of Shopping', 'KZN', -29.724, 31.064, 'mall', ['Gateway Mall', 'Gateway']),
  g('Canal Walk', 'WC', -33.894, 18.51, 'mall'),
  g('Gold Reef City', 'GP', -26.2362, 28.0121, 'landmark'),
  g('Constitution Hill', 'GP', -26.1889, 28.0436, 'landmark'),
  g('Union Buildings', 'GP', -25.7417, 28.2122, 'landmark'),
  g('Voortrekker Monument', 'GP', -25.7753, 28.1759, 'landmark'),
  g('Carlton Centre', 'GP', -26.2057, 28.0473, 'landmark', ['Top of Africa']),
  g('Ponte City', 'GP', -26.1928, 28.0586, 'landmark'),
  g('Orlando Towers', 'GP', -26.2305, 27.925, 'landmark', ['Soweto Towers']),
  g('Table Mountain', 'WC', -33.9628, 18.4098, 'landmark'),
  g('Lion\'s Head', 'WC', -33.9344, 18.3896, 'landmark'),
  g('Boulders Beach', 'WC', -34.1931, 18.4512, 'landmark', ['Penguin Beach']),
  g('Robben Island', 'WC', -33.8069, 18.3668, 'landmark'),
  g('Kirstenbosch National Botanical Garden', 'WC', -33.9884, 18.4316, 'landmark', ['Kirstenbosch']),
  g('Moses Mabhida Stadium', 'KZN', -29.8285, 31.0302, 'landmark'),
  g('uShaka Marine World', 'KZN', -29.9531, 31.0467, 'landmark', ['uShaka']),
  g('Cradle of Humankind', 'GP', -25.9632, 27.6676, 'landmark'),
  g('Sterkfontein Caves', 'GP', -26.0168, 27.7344, 'landmark'),
  g('Cango Caves', 'WC', -33.4429, 22.5557, 'landmark'),
  g('Lourensford Wine Estate', 'WC', -34.0718, 18.8887, 'landmark', ['Lourensford', 'Lourensford Market']),
  g('Val de Vie Estate', 'WC', -33.8597, 18.9376, 'landmark', ['Val de Vie', 'Pearl Valley']),
  g('Spier Wine Farm', 'WC', -33.9727, 18.79, 'landmark', ['Spier']),
  g('Vergelegen Wine Estate', 'WC', -34.0758, 18.8898, 'landmark', ['Vergelegen']),
  g('Kruger National Park', 'MP', -24.9496, 31.4422, 'landmark', ['Kruger']),
  g('Blyde River Canyon', 'MP', -24.867, 30.883, 'landmark'),
  g('God\'s Window', 'MP', -24.8615, 30.8286, 'landmark'),
  g('Bourke\'s Luck Potholes', 'MP', -24.6786, 30.8033, 'landmark'),
  g('Drakensberg', 'KZN', -28.9544, 29.1955, 'landmark', ['The Berg', 'uKhahlamba']),
  g('Sani Pass', 'KZN', -29.5833, 29.2833, 'landmark'),
  g('Golden Gate Highlands', 'FS', -28.505, 28.62, 'landmark', ['Golden Gate']),
  g('Augrabies Falls', 'NC', -28.5911, 20.3391, 'landmark'),
  g('Kgalagadi Transfrontier Park', 'NC', -26.47, 20.611, 'landmark', ['Kgalagadi']),
  g('Big Hole', 'NC', -28.7378, 24.759, 'landmark', ['Kimberley Big Hole']),
  g('Sun City Resort', 'NW', -25.344, 27.096, 'landmark', ['Sun City']),
  g('Pilanesberg Game Reserve', 'NW', -25.257, 27.101, 'landmark', ['Pilanesberg']),
  g('Addo Elephant Park', 'EC', -33.4428, 25.7494, 'landmark', ['Addo']),
  g('Kragga Kamma Game Park', 'EC', -33.9795, 25.4976, 'landmark', ['Kragga Kamma']),
  g('Bayworld Museum', 'EC', -33.9625, 25.6103, 'landmark', ['Bayworld']),
  g('Boardwalk Casino', 'EC', -33.9669, 25.6225, 'landmark', ['The Boardwalk']),
  g('Tsitsikamma National Park', 'EC', -34.0178, 23.8947, 'landmark', ['Tsitsikamma']),
  g('Mapungubwe', 'LP', -22.196, 29.211, 'landmark', ['Mapungubwe National Park']),
  g('Kruger Gate', 'MP', -24.9833, 31.4964, 'landmark', ['Paul Kruger Gate']),

  // ── Colleges & schools the user might type ────────────────────────────────
  g('AIE (Academy of Information Engineering), Midrand', 'GP', -25.982, 28.114, 'college', ['AIE', 'AIE Midrand']),
]

// ── Fuzzy search ─────────────────────────────────────────────────────────────
export const searchGazetteer = (query: string, limit = 6): GazHit[] => {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hits: { hit: GazHit; score: number }[] = []

  for (const p of GAZ_PLACES) {
    const names = [p.name, ...(p.aliases ?? [])]
    let best = 0
    for (const n of names) {
      const nq = n.toLowerCase()
      if (nq === q) best = Math.max(best, 12)
      else if (nq.startsWith(q)) best = Math.max(best, 7)
      else if (nq.includes(q)) best = Math.max(best, 4)
    }
    // Acronym match: "UI" matches a name whose words start with u/i (e.g. UJ)
    if (best === 0 && q.length >= 2 && q.length <= 4) {
      const initials = p.name
        .replace(/\(.*\)/, '')
        .split(/[\s,&-]+/)
        .filter(Boolean)
        .map((w) => w[0].toLowerCase())
        .join('')
      if (initials === q) best = 8
    }
    if (best > 0) {
      const typeLabel = TYPE_LABEL[p.type]
      hits.push({
        hit: {
          name: p.name,
          sub: typeLabel ? `${typeLabel} · ${PROV[p.province]}` : PROV[p.province],
          lat: p.lat,
          lng: p.lng,
          source: 'local',
        },
        score: best,
      })
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit).map((h) => h.hit)
}

// ── OpenStreetMap fallback (free, no key) ───────────────────────────────────
// Nominatim allows ~1 request/second; on a 429 rate-limit we back off and retry
// so a search never silently comes back empty.
export const searchOsm = async (query: string, signal?: AbortSignal): Promise<GazHit[]> => {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&countrycodes=za&q=${encodeURIComponent(
    query,
  )}`
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (signal?.aborted) return []
    try {
      const res = await fetch(url, { signal, headers: { Accept: 'application/json', 'Accept-Language': 'en' } })
      if (res.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)))
        continue
      }
      if (!res.ok) return []
      const data = (await res.json()) as { display_name: string; lat: string; lon: string }[]
      return data.map((d) => ({
        name: d.display_name.split(',')[0].trim(),
        sub: d.display_name,
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
        source: 'osm' as const,
      }))
    } catch (err) {
      if (signal?.aborted) return []
      // Transient network failure — retry once.
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 800))
        continue
      }
      return []
    }
  }
  return []
}
