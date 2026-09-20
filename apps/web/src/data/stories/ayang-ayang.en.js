import id from './ayang-ayang.js';

// The English Ayang-ayang. Not a literal translation — the Indonesian is spoken, almost conversational
// ("Sakit gak, jatuh cinta sama orang yang kita gak bisa gapai?"), and a word-for-word English version of
// that reads like a greeting card. Two rules keep it his letter rather than a brochure:
//
//   - It says WE, never YOU. The Indonesian is "kita" three times over and "kamu" not once — the writer
//     is standing inside the feeling, not diagnosing the reader. In English "you" turns the confession
//     into an accusation, so the absence of the second person is guarded in productCopy.selfcheck.
//   - Contractions, plain words. "Gak" is not formal Indonesian, so "cannot" is not its translation.
//
// Everything that is not words — the colours, the Javanese script, the section order and layouts, the
// media slots — is taken from the Indonesian story rather than copied out, so an image added there does
// not have to be added twice, and the two can never drift into being different pages.
const story = {
  ...id,

  hero: {
    ...id.hero,
    eyebrow: 'A letter that was never sent',
    subtitle: "Does it hurt — falling for someone we can't reach?",
  },

  music: {
    ...id.music,
    label: 'Ambient — Quiet Gamelan',
  },

  sections: [
    {
      type: 'quote',
      text: "Some longing can't be spoken,\nonly worn on skin.",
    },
    {
      ...id.sections[1],
      eyebrow: 'About the scent',
      heading: 'Jasmine, speaking at night',
      body: "Top notes of jasmine and tuberose open a soft conversation — a whisper only heard once the world has gone to sleep. An amberwood heart carries a familiar warmth, like an embrace we remember but can't have again.",
    },
    {
      ...id.sections[2],
      caption: 'Between petals and memory',
    },
    {
      ...id.sections[3],
      eyebrow: 'Base & character',
      heading: 'The musk left on the pillow',
      body: 'A base of radiant musk and amber leaves a quiet trace — a scent that lasts long after the person has gone. Like the perfume still in the shirt of someone who once held us.',
    },
    {
      type: 'quote',
      // "Memikat" is something the wearer does to someone else. The draft read "for being wanted", which
      // turned the line inside out: it made the perfume about being looked at, in a letter whose whole
      // point is that nobody is looking.
      text: "Ayang-ayang isn't a perfume for charming anyone.\nIt's a perfume for remembering.",
    },
  ],
};

export default story;
