import almondBlossomImg from '../assets/images/vangogh_almond_blossom_1793261859647.jpg';
import cafeTerraceImg from '../assets/images/vangogh_cafe_terrace_1793261859642.jpg';
import starryNightImg from '../assets/images/vangogh_starry_night_1793261856191.jpg';
import sunflowersImg from '../assets/images/vangogh_sunflowers_1793261858613.jpg';
import { ArtworkItem, PartOfSpeech } from '../types';

const PARIS_SUNSET_BALCONY_SRC =
  '/assets/artworks/Paris_Sunset_from_the_Balcony_81fc5463.png';
const PAINTER_SWIRLING_SUNSET_SRC =
  '/assets/artworks/Painter_Beneath_a_Swirling_Sunset_6b6fc621.png';

export const BUILTIN_ARTWORKS: ArtworkItem[] = [
  {
    id: 'custom-1793269980999-0-5f4x',
    viTitle: 'Sunflower Field Under a Swirling Sky',
    originalTitle: 'Tháng 1 · Cánh đồng hướng dương dưới bầu trời xoáy',
    locationYear: 'Tháng 1 · 31 mảnh ghép',
    medium: 'Ảnh nền mặc định · Bộ lịch 12 tháng',
    accessionCode: 'USR-01',
    quoteVi:
      'Những điều vĩ đại được kết tinh từ chuỗi những ngày tập trung nhỏ bé bền bỉ nối tiếp nhau.',
    quoteSource: "Atelier d'Arles · Tháng 1",
    imageSrc: '/assets/artworks/Sunflower Field Under a Swirling Sky.jpg',
    backupImageSrc: sunflowersImg,
    imageScaleClass: 'scale-100',
    fallbackBgClass:
      'bg-gradient-to-br from-slate-950 via-blue-950 to-amber-500',
    isDark: true,
    paletteKey: 'starry_night',
    isCustom: false,
  },
  {
    id: 'custom-1793269980999-1-753v',
    viTitle: 'Reclining Among Coastal Wildflowers',
    originalTitle: 'Tháng 2 · Nghỉ chân bên triền hoa dại ven biển',
    locationYear: 'Tháng 2 · 28 mảnh ghép',
    medium: 'Ảnh nền mặc định · Bộ lịch 12 tháng',
    accessionCode: 'USR-02',
    quoteVi:
      'Giữa tiếng sóng xanh và sắc hoa vàng ven biển, tâm trí tìm lại nhịp thở khoáng đạt đầu năm.',
    quoteSource: "Atelier d'Arles · Tháng 2",
    imageSrc: '/assets/artworks/Reclining Among Coastal Wildflowers.jpg',
    backupImageSrc: almondBlossomImg,
    imageScaleClass: 'scale-100',
    fallbackBgClass:
      'bg-gradient-to-br from-cyan-950 via-teal-800 to-amber-400',
    isDark: true,
    paletteKey: 'starry_night',
    isCustom: false,
  },
  {
    id: 'custom-1793269980999-2-r56l',
    viTitle: 'Van Gogh’s Crescent Moonfield',
    originalTitle: 'Tháng 3 · Trăng lưỡi liềm trên đồng hoa đêm',
    locationYear: 'Tháng 3 · 31 mảnh ghép',
    medium: 'Ảnh nền mặc định · Bộ lịch 12 tháng',
    accessionCode: 'USR-03',
    quoteVi:
      'Ngước nhìn vầng trăng khuyết trên cánh đồng tĩnh lặng luôn khơi dậy những ước mơ bền bỉ nhất.',
    quoteSource: "Atelier d'Arles · Tháng 3",
    imageSrc: '/assets/artworks/Van Gogh’s Crescent Moonfield.jpg',
    backupImageSrc: starryNightImg,
    imageScaleClass: 'scale-100',
    fallbackBgClass:
      'bg-gradient-to-br from-slate-950 via-blue-950 to-amber-400',
    isDark: true,
    paletteKey: 'starry_night',
    isCustom: false,
  },
  {
    id: 'custom-1793269980999-3-awu7',
    viTitle: 'Van Gogh Inspired Sunset Train Departure',
    originalTitle: 'Tháng 4 · Chuyến tàu khởi hành dưới hoàng hôn',
    locationYear: 'Tháng 4 · 30 mảnh ghép',
    medium: 'Ảnh nền mặc định · Bộ lịch 12 tháng',
    accessionCode: 'USR-04',
    quoteVi:
      'Mỗi hành trình mới đều bắt đầu từ bước chân lặng lẽ mang theo khung vải và niềm say mê trên vai.',
    quoteSource: "Atelier d'Arles · Tháng 4",
    imageSrc: '/assets/artworks/Van Gogh Inspired Sunset Train Departure.jpg',
    backupImageSrc: PARIS_SUNSET_BALCONY_SRC,
    imageScaleClass: 'scale-100',
    fallbackBgClass:
      'bg-gradient-to-br from-slate-950 via-amber-900 to-amber-500',
    isDark: true,
    paletteKey: 'cafe_terrace',
    isCustom: false,
  },
  {
    id: 'custom-1793269980999-4-mufc',
    viTitle: 'Painter in a Van Gogh–Inspired Times Square',
    originalTitle: 'Tháng 5 · Người họa sĩ giữa quảng trường rực sáng',
    locationYear: 'Tháng 5 · 31 mảnh ghép',
    medium: 'Ảnh nền mặc định · Bộ lịch 12 tháng',
    accessionCode: 'USR-05',
    quoteVi:
      'Giữa phố thị rực rỡ muôn ánh đèn, giữ vững sự tập trung riêng mình chính là bản lĩnh của người nghệ sĩ.',
    quoteSource: "Atelier d'Arles · Tháng 5",
    imageSrc: '/assets/artworks/Painter in a Van Gogh–Inspired Times Square.jpg',
    backupImageSrc: cafeTerraceImg,
    imageScaleClass: 'scale-100',
    fallbackBgClass:
      'bg-gradient-to-br from-slate-950 via-indigo-950 to-amber-500',
    isDark: true,
    paletteKey: 'cafe_terrace',
    isCustom: false,
  },
  {
    id: 'custom-1793269980999-5-6nty',
    viTitle: 'Twilight Traveler Beneath Vincent’s Wings',
    originalTitle: 'Tháng 6 · Lữ khách hoàng hôn dưới đôi cánh Vincent',
    locationYear: 'Tháng 6 · 30 mảnh ghép',
    medium: 'Ảnh nền mặc định · Bộ lịch 12 tháng',
    accessionCode: 'USR-06',
    quoteVi:
      'Khoảnh khắc tĩnh lặng trước giờ cất cánh là lúc ta nhìn rõ nhất đích đến của chặng đường phía trước.',
    quoteSource: "Atelier d'Arles · Tháng 6",
    imageSrc: '/assets/artworks/Twilight Traveler Beneath Vincent’s Wings.jpg',
    backupImageSrc: PAINTER_SWIRLING_SUNSET_SRC,
    imageScaleClass: 'scale-100',
    fallbackBgClass:
      'bg-gradient-to-br from-slate-950 via-purple-950 to-amber-500',
    isDark: true,
    paletteKey: 'starry_night',
    isCustom: false,
  },
  {
    id: 'custom-1793269980999-6-0d1w',
    viTitle: 'Pastel Van Gogh–Inspired Riverside Bridge',
    originalTitle: 'Tháng 7 · Cầu ven sông chiều mây sắc phấn',
    locationYear: 'Tháng 7 · 31 mảnh ghép',
    medium: 'Ảnh nền mặc định · Bộ lịch 12 tháng',
    accessionCode: 'USR-07',
    quoteVi:
      'Dừng lại bên thành cầu ngắm mặt nước chiều êm ả để lòng lắng sâu trước phiên học mới.',
    quoteSource: "Atelier d'Arles · Tháng 7",
    imageSrc: '/assets/artworks/Pastel Van Gogh–Inspired Riverside Bridge.jpg',
    backupImageSrc: almondBlossomImg,
    imageScaleClass: 'scale-100',
    fallbackBgClass:
      'bg-gradient-to-br from-indigo-950 via-violet-900 to-amber-300',
    isDark: true,
    paletteKey: 'starry_night',
    isCustom: false,
  },
  {
    id: 'custom-1793269980999-7-t48k',
    viTitle: 'Starry Night Rowboat Romance',
    originalTitle: 'Tháng 8 · Con thuyền nhỏ dưới đêm sao lấp lánh',
    locationYear: 'Tháng 8 · 31 mảnh ghép',
    medium: 'Ảnh nền mặc định · Bộ lịch 12 tháng',
    accessionCode: 'USR-08',
    quoteVi:
      'Ánh đèn lồng ấm áp phản chiếu trên mặt sông đêm nhắc rằng sự tĩnh tại luôn tỏa sáng dịu dàng.',
    quoteSource: "Atelier d'Arles · Tháng 8",
    imageSrc: '/assets/artworks/Starry Night Rowboat Romance.jpg',
    backupImageSrc: starryNightImg,
    imageScaleClass: 'scale-100',
    fallbackBgClass:
      'bg-gradient-to-br from-slate-950 via-emerald-950 to-amber-400',
    isDark: true,
    paletteKey: 'starry_night',
    isCustom: false,
  },
  {
    id: 'custom-1793269980999-8-igjj',
    viTitle: 'Sunflower Serenade Under Swirling Skies',
    originalTitle: 'Tháng 9 · Khúc vĩ cầm giữa mùa hướng dương',
    locationYear: 'Tháng 9 · 30 mảnh ghép',
    medium: 'Ảnh nền mặc định · Bộ lịch 12 tháng',
    accessionCode: 'USR-09',
    quoteVi:
      'Khi giai điệu và sắc màu hòa quyện, mỗi ngày rèn luyện đều ngân vang như một khúc nhạc riêng.',
    quoteSource: "Atelier d'Arles · Tháng 9",
    imageSrc: '/assets/artworks/Sunflower Serenade Under Swirling Skies.jpg',
    backupImageSrc: sunflowersImg,
    imageScaleClass: 'scale-100',
    fallbackBgClass:
      'bg-gradient-to-br from-slate-950 via-sky-900 to-amber-500',
    isDark: true,
    paletteKey: 'starry_night',
    isCustom: false,
  },
  {
    id: 'custom-1793271229478-0-wdx3',
    viTitle: 'Panoramic Starry Night Village',
    originalTitle: 'Tháng 10 · Toàn cảnh ngôi làng dưới bầu trời đầy sao',
    locationYear: 'Tháng 10 · 31 mảnh ghép',
    medium: 'Ảnh nền mặc định · Bộ lịch 12 tháng',
    accessionCode: 'USR-10',
    quoteVi:
      'Ban đêm thường sống động và giàu sắc thái hơn cả ban ngày nếu ta thực tâm quan sát từng vì sao.',
    quoteSource: "Atelier d'Arles · Tháng 10",
    imageSrc: '/assets/artworks/Starry Night.jpg',
    backupImageSrc: starryNightImg,
    imageScaleClass: 'scale-100',
    fallbackBgClass:
      'bg-gradient-to-br from-slate-950 via-blue-950 to-amber-500',
    isDark: true,
    paletteKey: 'starry_night',
    isCustom: false,
  },
  {
    id: 'default-paris-sunset-balcony',
    viTitle: 'Paris Sunset from the Balcony',
    originalTitle: 'Tháng 11 · Hoàng hôn Paris nhìn từ ban công',
    locationYear: 'Tháng 11 · 30 mảnh ghép',
    medium: 'Ảnh nền mặc định · Bộ lịch 12 tháng',
    accessionCode: 'USR-11',
    quoteVi:
      'Từ ban công lộng gió nhìn mặt trời nhuộm cam những mái nhà Paris, lòng biết ơn từng ngày bền bỉ đã qua.',
    quoteSource: "Atelier d'Arles · Tháng 11",
    imageSrc: PARIS_SUNSET_BALCONY_SRC,
    backupImageSrc: cafeTerraceImg,
    imageScaleClass: 'scale-100',
    fallbackBgClass:
      'bg-gradient-to-br from-slate-950 via-amber-900 to-orange-500',
    isDark: true,
    paletteKey: 'cafe_terrace',
    isCustom: false,
  },
  {
    id: 'default-painter-swirling-sunset',
    viTitle: 'Painter Beneath a Swirling Sunset',
    originalTitle: 'Tháng 12 · Người họa sĩ dưới vầng hoàng hôn xoáy',
    locationYear: 'Tháng 12 · 31 mảnh ghép',
    medium: 'Ảnh nền mặc định · Bộ lịch 12 tháng',
    accessionCode: 'USR-12',
    quoteVi:
      'Trước mặt biển chiều rực lửa khép lại một năm dài, giá vẽ vẫn vững vàng đón từng nét cọ cuối năm.',
    quoteSource: "Atelier d'Arles · Tháng 12",
    imageSrc: PAINTER_SWIRLING_SUNSET_SRC,
    backupImageSrc: starryNightImg,
    imageScaleClass: 'scale-100',
    fallbackBgClass:
      'bg-gradient-to-br from-slate-950 via-indigo-950 to-amber-500',
    isDark: true,
    paletteKey: 'starry_night',
    isCustom: false,
  },
];

export function getBuiltinBackupImageSrc(
  id: string,
  viTitle?: string
): string | undefined {
  const byId = BUILTIN_ARTWORKS.find((a) => a.id === id);
  if (byId?.backupImageSrc) return byId.backupImageSrc;
  if (viTitle) {
    const norm = viTitle.trim().toLowerCase();
    const byTitle = BUILTIN_ARTWORKS.find(
      (a) => a.viTitle.trim().toLowerCase() === norm
    );
    if (byTitle?.backupImageSrc) return byTitle.backupImageSrc;
  }
  return starryNightImg;
}

export function resolveArtwork(
  artworks: ArtworkItem[],
  id: string | undefined
): ArtworkItem | undefined {
  if (artworks.length > 0) {
    if (!id) return artworks[0];
    const direct = artworks.find((a) => a.id === id);
    if (direct) return direct;
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }
    return artworks[hash % artworks.length];
  }
  if (!id) return BUILTIN_ARTWORKS[0];
  return BUILTIN_ARTWORKS.find((a) => a.id === id) || BUILTIN_ARTWORKS[0];
}

/**
 * Canonical 1-to-1 mapping order between vocabulary parts of speech and gallery artworks:
 * Ảnh 1 -> verb (V)
 * Ảnh 2 -> adjective (adj)
 * Ảnh 3 -> noun (n)
 * Ảnh 4 -> adverb (adv)
 * Ảnh 5 -> phrase
 * Ảnh 6 -> idiom
 * Ảnh 7 -> phrasal_verb (phr. verb)
 * Ảnh 8 -> preposition (prep)
 * Ảnh 9 -> conjunction (conj)
 * Ảnh 10 -> pronoun (pron)
 * Ảnh 11 -> determiner (det)
 * Ảnh 12 -> interjection (interj)
 */
export const ORDERED_PARTS_OF_SPEECH: readonly PartOfSpeech[] = [
  'verb',
  'adjective',
  'noun',
  'adverb',
  'phrase',
  'idiom',
  'phrasal_verb',
  'preposition',
  'conjunction',
  'pronoun',
  'determiner',
  'interjection',
];

export function getPartOfSpeechSlotIndex(pos: PartOfSpeech): number {
  const idx = ORDERED_PARTS_OF_SPEECH.indexOf(pos);
  return idx >= 0 ? idx : 0;
}

export function getPartOfSpeechForSlotIndex(
  slotIndex: number
): PartOfSpeech | undefined {
  if (slotIndex < 0 || slotIndex >= ORDERED_PARTS_OF_SPEECH.length) {
    return undefined;
  }
  return ORDERED_PARTS_OF_SPEECH[slotIndex];
}

export function resolveArtworkForPartOfSpeech(
  artworks: ArtworkItem[],
  pos: PartOfSpeech
): ArtworkItem | undefined {
  const slotIndex = getPartOfSpeechSlotIndex(pos);
  if (artworks.length > 0) {
    if (slotIndex < artworks.length) {
      return artworks[slotIndex];
    }
    return artworks[slotIndex % artworks.length];
  }
  return BUILTIN_ARTWORKS[slotIndex] || BUILTIN_ARTWORKS[0];
}
