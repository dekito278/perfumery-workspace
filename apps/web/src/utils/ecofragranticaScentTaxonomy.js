// Ecofragrantica scent taxonomy: 11 grandfamilies.
//
// This replaces the PerfumersWorld A-Z vocabulary as the way raw materials are FILED. The A-Z table in
// workbookAbcClassification.js stays exactly where it is — it is how the reference workbook describes a
// material, and the seeded reference data speaks it. What changes is the shelf a material sits on.
//
// 26 -> 11 is lossy on purpose (Iris, Jasmin, Muguet, Narcotic, Orchid, Rose and Light Chemical Floral
// all become Floral). The migration keeps the old value in raw_materials.legacy_category so the move is
// reversible in full, which the labels alone would not be.

export const ECOFRAGRANTICA_SCENT_TAXONOMY = [
  {
    key: 'fruity',
    label: 'Fruity',
    color: '#ff1f1f',
    subfamilies: ['Appley/Peary', 'Berries', 'Cassis', 'Cherry/Almondy', 'Peachy', 'Yeasty/Fermented', 'Tropical', 'Fruity Others'],
    descriptors: ['Appley', 'Apricotty', 'Banana-like', 'Bittery', 'Coconutty', 'Cranberric', 'Dried Fruity', 'Grapy', 'Jammy', 'Mango-like', 'Melony', 'Overripe', 'Peary', 'Pineappley', 'Plummy', 'Raspberric', 'Rotten', 'Strawberric', 'Tutti Fruity'],
  },
  {
    key: 'citrus',
    label: 'Citrus',
    color: '#ffd45a',
    subfamilies: ['Citrus Cologne', 'Grapefruity', 'Lemony/Limey', 'Orange/Mandarin', 'Citrus Others'],
    descriptors: ['Acidic/Sour', 'Bergamotty', 'Gingery', 'Lemongrassy', 'Lemony', 'Limey', 'Mandariny', 'Orangey', 'Yuzu'],
  },
  {
    key: 'green',
    label: 'Green',
    color: '#63b766',
    subfamilies: ['Cucumbery/Violet Leaf', 'Grassy', 'Green Pineappley', 'Green Stemmy', 'Green Others'],
    descriptors: ['Artichoky', 'Celeric', 'Cucumbery', 'Figgy/Tomato Leaf', 'Foliaged', 'Green Pea/Beany', 'Green Spinachy', 'Rhubarby', 'Shisoic', 'Violet Leaf'],
  },
  {
    key: 'floral',
    label: 'Floral',
    color: '#edaae8',
    subfamilies: ['Mimosic', 'Muguet', 'Rosy', 'Violetty/Orris', 'White Floral', 'Floral Others'],
    descriptors: ['Carnation/Lily-like', 'Hyacinthy', 'Jasminy', 'Lipsticky', 'Orange-Blossomy', 'Orrisy', 'Peonic', 'Perfumey', 'Tuberosey', 'Violetty', 'Winey'],
  },
  {
    key: 'sweet-balsamic',
    label: 'Sweet/Balsamic',
    color: '#8f71de',
    subfamilies: ['Balsamic', 'Coumarinic', 'Gourmand', 'Lactonic', 'Powdery', 'Sweet'],
    descriptors: ['Ambery Sweet', 'Baby-like', 'Baked Pastry-like', 'Butterscotch/Caramellic', 'Chocolaty', 'Creamy', 'Hay/Tobacco-like', 'Honey-like', 'Labdanumy', 'Maply', 'Milky', 'Sugary Brown', 'Sugary White', 'Vanillic'],
  },
  {
    key: 'woody',
    label: 'Woody',
    color: '#b07a55',
    subfamilies: ['Cedarwoody', 'Driftwoody', 'Earthy', 'Liquor-like', 'Nutty', 'Oudy', 'Resinous/Piney', 'Roasted', 'Sandalwoody', 'Smoldering', 'Spicy', 'Woody Others'],
    descriptors: ['Chypresque', 'Cinnamic', 'Clovy', 'Coffee-like', 'Cumminic', 'Curry-like', 'Frankincensy', 'Incense Stick-like', 'Mossy', 'Mukhalaty', 'Musty', 'Nutmeggy', 'Papery', 'Patchouliesque', 'Peanutty', 'Peppery', 'Piney', 'Popcorny', 'Pyrazinic', 'Resinous', 'Seediesque', 'Sesame-like', 'Smoky', 'Sooty', 'Tarmacky', 'Tea-like', 'Toasted', 'Walnutty/Hazelnutty'],
  },
  {
    key: 'animalic',
    label: 'Animalic',
    color: '#ad2b25',
    subfamilies: ['Barny/Fecal', 'Hairy', 'Leathery', 'Musky', 'Skin-like', 'Animalic Others'],
    descriptors: ['Alliaceous', 'Butyric', 'Cheesy', 'Civetty', 'Eggy', 'Fishy/Sea Creatures', 'Horsey', 'Kashmiry/Wooly', 'Meaty', 'Saffrony', 'Slimy', 'Sweaty', 'Ureal'],
  },
  {
    key: 'herbal',
    label: 'Herbal',
    color: '#8bdf8f',
    subfamilies: ['Lavendery', 'Minty', 'Anisic', 'Herbal Others'],
    descriptors: ['Basilic/Oreganic', 'Camphoraceous', 'Fougery', 'Immortellic', 'Methylic', 'Thujony', 'Turpentiny', 'Weedy'],
  },
  {
    key: 'mineral',
    label: 'Mineral',
    color: '#78d9cf',
    subfamilies: ['Aldehydic', 'Marine', 'Metallic', 'Ozonic/Electric', 'Sulfury', 'Wet', 'Mineral Others'],
    descriptors: ['Electric', 'Ozonic', 'Plastery/Dusty', 'Salty', 'Soapy'],
  },
  {
    key: 'industrial',
    label: 'Industrial',
    color: '#71849f',
    subfamilies: ['Chemical/Solventy', 'Industrial/Mechanical Others'],
    descriptors: ['Chlorinated/Swimming Pool', 'Fuel-like', 'Gassy', 'Inky', 'Medicinal', 'Rubbery/Olivy', 'Waxy'],
  },
  {
    key: 'soulful',
    label: 'Soulful',
    color: '#ffa047',
    subfamilies: ['Greasy', 'Starchy', 'Soulful Others'],
    descriptors: ['Bready', 'Buttery', 'Doughy', 'Hammy', 'Malty', 'Mushroomy', 'Ricey', 'Tomato Pulpy'],
  },
];

// Only the lookup is exported. The port also carried option-builders, a descriptor list and a
// sensations/textures vocabulary — nothing here calls any of them, and an export with no caller is a
// promise the next reader has to check. They are three lines each in saas-perfumers if a UI ever needs them.
export const findEcofragranticaGrandfamilyByValue = (value) => ECOFRAGRANTICA_SCENT_TAXONOMY.find(
  (family) => family.label.toLowerCase() === String(value || '').trim().toLowerCase()
    || family.key === String(value || '').trim().toLowerCase(),
) || null;
