import type { Per100g } from '../utils/nutritionMath.js';

export interface LocalFood { id: string; name: string; synonyms: string[]; per100g: Per100g }
const f = (calories: number, protein_g: number, carbs_g: number, fat_g: number, fiber_g: number, sugar_g: number, sodium_mg: number): Per100g =>
  ({ calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg });

/**
 * Curated per-100g reference values for common Indian foods (prepared/cooked, as served).
 * These are approximate, home-style averages compiled for the MVP so Indian meals do not fall through to
 * Western USDA entries. Replace/extend by adding a provider backed by IFCT 2017 or an admin-managed table.
 */
export const INDIAN_FOODS: LocalFood[] = [
  { id: 'roti', name: 'Roti (Chapati)', synonyms: ['chapati', 'chapatti', 'phulka', 'tawa roti', 'indian flatbread', 'whole wheat roti'], per100g: f(297, 9.6, 51.4, 5.7, 4.6, 1, 250) },
  { id: 'paratha', name: 'Paratha', synonyms: ['aloo paratha', 'plain paratha', 'stuffed paratha', 'parantha'], per100g: f(326, 7.9, 45, 13, 3, 1.5, 380) },
  { id: 'naan', name: 'Naan', synonyms: ['butter naan', 'garlic naan', 'tandoori roti'], per100g: f(290, 9, 50, 5.5, 2.2, 3, 450) },
  { id: 'rice', name: 'Cooked Rice', synonyms: ['rice', 'steamed rice', 'white rice', 'plain rice', 'basmati rice', 'boiled rice', 'jeera rice'], per100g: f(130, 2.7, 28.2, 0.3, 0.4, 0.1, 1) },
  { id: 'biryani', name: 'Chicken Biryani', synonyms: ['biryani', 'veg biryani', 'mutton biryani', 'hyderabadi biryani', 'pulao', 'pulav'], per100g: f(165, 8.5, 20, 5.5, 1, 1, 380) },
  { id: 'khichdi', name: 'Khichdi', synonyms: ['moong dal khichdi', 'dal khichdi'], per100g: f(110, 4, 19, 2, 1.5, 0.5, 250) },
  { id: 'dal', name: 'Dal (Cooked Lentils)', synonyms: ['daal', 'dal tadka', 'dal fry', 'toor dal', 'moong dal', 'masoor dal', 'lentil curry', 'lentils', 'dal makhani'], per100g: f(105, 6, 14, 3.2, 3.5, 1.5, 300) },
  { id: 'rajma', name: 'Rajma (Kidney Bean Curry)', synonyms: ['rajma masala', 'kidney bean curry', 'rajma chawal'], per100g: f(120, 6, 15, 4, 4.5, 1.8, 320) },
  { id: 'chole', name: 'Chole (Chickpea Curry)', synonyms: ['chana masala', 'chhole', 'chickpea curry', 'chana curry'], per100g: f(150, 7, 20, 5, 5.5, 2.5, 330) },
  { id: 'sambar', name: 'Sambar', synonyms: ['sambhar'], per100g: f(55, 3, 8, 1.5, 2, 2, 300) },
  { id: 'paneer', name: 'Paneer', synonyms: ['cottage cheese', 'paneer cubes', 'raw paneer'], per100g: f(296, 18.3, 3.6, 22.8, 0, 2.6, 22) },
  { id: 'paneer-curry', name: 'Paneer Curry', synonyms: ['paneer butter masala', 'palak paneer', 'matar paneer', 'paneer masala', 'kadai paneer', 'shahi paneer'], per100g: f(190, 8.5, 6.5, 15, 1.5, 3, 360) },
  { id: 'chicken-curry', name: 'Chicken Curry', synonyms: ['chicken masala', 'butter chicken', 'chicken gravy', 'kadai chicken'], per100g: f(160, 13, 4, 10, 0.8, 1.5, 380) },
  { id: 'mutton-curry', name: 'Mutton Curry', synonyms: ['mutton masala', 'lamb curry', 'goat curry', 'rogan josh'], per100g: f(190, 15, 4, 12, 0.8, 1.5, 400) },
  { id: 'tandoori-chicken', name: 'Tandoori Chicken', synonyms: ['chicken tikka', 'grilled chicken tikka'], per100g: f(150, 20, 3, 6, 0.3, 1, 400) },
  { id: 'sabzi', name: 'Sabzi (Mixed Vegetable Curry)', synonyms: ['sabji', 'sabzi curry', 'mixed vegetable curry', 'vegetable curry', 'mix veg', 'bhaji', 'bhindi sabzi'], per100g: f(85, 2.2, 9, 4.5, 2.8, 3.5, 300) },
  { id: 'aloo-sabzi', name: 'Aloo Sabzi (Potato Curry)', synonyms: ['aloo sabji', 'potato curry', 'aloo gobi', 'aloo jeera'], per100g: f(105, 2, 15, 4.3, 2, 1.5, 320) },
  { id: 'poha', name: 'Poha', synonyms: ['kanda poha', 'flattened rice'], per100g: f(130, 2.7, 24, 2.7, 1.5, 1.5, 250) },
  { id: 'upma', name: 'Upma', synonyms: ['rava upma', 'suji upma', 'semolina upma'], per100g: f(140, 3.5, 22, 4.5, 1.5, 1.2, 300) },
  { id: 'idli', name: 'Idli', synonyms: ['idly', 'steamed rice cake', 'idlis'], per100g: f(135, 4, 27.5, 0.7, 1, 0.3, 190) },
  { id: 'dosa', name: 'Dosa', synonyms: ['plain dosa', 'dosai', 'sada dosa'], per100g: f(168, 3.9, 29.5, 3.7, 1, 0.5, 270) },
  { id: 'masala-dosa', name: 'Masala Dosa', synonyms: ['masala dosai', 'potato dosa'], per100g: f(190, 4, 28, 7, 1.8, 1.5, 330) },
  { id: 'misal-pav', name: 'Misal Pav', synonyms: ['misal', 'usal pav', 'missal pav'], per100g: f(190, 7, 24, 7, 4, 3, 400) },
  { id: 'pav', name: 'Pav (Bread Roll)', synonyms: ['pao', 'ladi pav', 'bun', 'dinner roll'], per100g: f(270, 8, 49, 4.5, 2, 5, 500) },
  { id: 'vada-pav', name: 'Vada Pav', synonyms: ['wada pav', 'vada pao', 'batata vada pav'], per100g: f(245, 5.5, 33, 10, 2.5, 3, 480) },
  { id: 'samosa', name: 'Samosa', synonyms: ['aloo samosa', 'samosas', 'punjabi samosa'], per100g: f(262, 4.5, 30, 14, 2.5, 1.5, 400) },
  { id: 'pakora', name: 'Pakora', synonyms: ['pakoda', 'bhajiya', 'bhajji', 'onion pakora', 'veg pakora', 'pakoras'], per100g: f(280, 8, 25, 17, 3, 1.5, 450) },
  { id: 'omelette', name: 'Omelette', synonyms: ['omelet', 'masala omelette', 'egg omelette'], per100g: f(154, 10.6, 0.6, 11.7, 0, 0.4, 155) },
  { id: 'boiled-egg', name: 'Boiled Egg', synonyms: ['egg', 'eggs', 'hard boiled egg', 'boiled eggs'], per100g: f(155, 12.6, 1.1, 10.6, 0, 1.1, 124) },
  { id: 'curd', name: 'Curd (Dahi)', synonyms: ['dahi', 'yogurt', 'yoghurt', 'plain curd', 'plain yogurt'], per100g: f(61, 3.5, 4.7, 3.3, 0, 4.7, 46) },
  { id: 'raita', name: 'Raita', synonyms: ['cucumber raita', 'boondi raita'], per100g: f(60, 2.8, 5, 3, 0.3, 4, 120) },
];
