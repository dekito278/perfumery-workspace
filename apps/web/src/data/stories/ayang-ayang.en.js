import id from './ayang-ayang.js';

// The English Ayang-ayang. A DRAFT of Dekito's voice, not a literal translation — the Indonesian is
// spoken, almost conversational ("Sakit gak, jatuh cinta sama orang yang kita gak bisa gapai?"), and a
// word-for-word English version of that reads like a greeting card. Correct it; it is his letter.
//
// Everything that is not words — the colours, the Javanese script, the section order and layouts, the
// media slots — is taken from the Indonesian story rather than copied out, so an image added there does
// not have to be added twice, and the two can never drift into being different pages.
const story = {
  ...id,

  hero: {
    ...id.hero,
    eyebrow: 'A letter that was never sent',
    subtitle: 'Does it hurt — loving someone you were never going to reach?',
  },

  music: {
    ...id.music,
    label: 'Ambient — Quiet Gamelan',
  },

  sections: [
    {
      type: 'quote',
      text: 'Some longing cannot be said out loud.\nIt can only be worn on skin.',
    },
    {
      ...id.sections[1],
      eyebrow: 'The opening',
      heading: 'Jasmine, speaking after dark',
      body: 'Jasmine and tuberose open a soft conversation — the kind of whisper you only hear once the world has gone to sleep. An amberwood heart brings back a warmth you recognise: an embrace you remember and cannot have again.',
    },
    {
      ...id.sections[2],
      caption: 'Between the petals and the memory',
    },
    {
      ...id.sections[3],
      eyebrow: 'The base',
      heading: 'The musk left on the pillow',
      body: 'Radiant musk and amber leave a quiet trace — a scent that stays long after the person has gone. Like perfume still held in the shirt of someone who once held you.',
    },
    {
      type: 'quote',
      text: 'Ayang-ayang is not a perfume for being wanted.\nIt is a perfume for remembering.',
    },
  ],
};

export default story;
