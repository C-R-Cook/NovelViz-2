// Prompt presets for T2I model testing.
// Add a new entry whenever you want a saved prompt set for a book.
// The key is just a display name shown in the UI dropdown.

export const T2I_PROMPT_PRESETS: Record<string, string[]> = {
  Dracula: [
    "A gaunt pale man standing in a dark castle doorway, candlelight casting deep shadows, Victorian gothic atmosphere, oil painting style",
    "A vast library with towering bookshelves reaching into darkness, a scholar at a reading desk under lamplight, gothic architecture",
    "A woman in Victorian dress on a cliff at night, stormy sea below, full moon behind dark clouds, dramatic lighting",
    "Ancient stone castle on a rocky promontory, mist rising from the valley at twilight, deep purples and blues, romantic gothic",
    "A horse-drawn carriage racing along a mountain road at night, forest on both sides, lanterns glowing, stormy sky",
    "Close portrait of a young woman with dark circles, pearl necklace, expression of unease, soft candlelight, Victorian setting",
    "Two men in Victorian coats examining old maps on a desk by lantern light, mysterious letters scattered about",
    "Interior of a Victorian ship cabin at night, brass instruments, porthole showing moonlit sea, leather-bound journals on desk",
    "A black bat silhouetted against a full moon, Romanian mountain peaks below, deep indigo night sky",
    "Grand gothic dining hall, long banquet table, candelabras, cobwebs in vaulted ceiling, shaft of moonlight",
  ],
  // Character prompts are deliberately name-free and use only visual/physical descriptions
  // to avoid models pattern-matching to the 1939 film cast (copyright risk).
  // Note: silver shoes (book) not ruby slippers (film).
  'Wizard of Oz': [
    'A young girl in a blue and white gingham dress with her hair in pigtails, carrying a small black terrier dog, standing on a dirt road through flat grey Kansas farmland, overcast sky, realist illustration style',
    'A man made entirely of tin standing in a forest, joints rusted stiff, raised axe frozen mid-swing, surrounded by dense woodland, dappled light, detailed storybook illustration',
    'A man constructed from stuffed cloth and straw, floppy limbs, dressed in tattered farm clothes and a pointed hat, standing in a cornfield on a wooden pole, bright summer day, painterly style',
    'A large lion with a timid expression, oversized mane, cowering slightly despite its size, standing on a yellow brick road through a dark forest, warm afternoon light, children\'s book illustration style',
    'A young girl in pigtails and a blue dress walking along a winding yellow brick road with a tin woodsman, a scarecrow, and a large cowardly lion, rolling green countryside, golden hour light, vintage storybook illustration',
    'An elderly man behind a large curtain operating levers and controls in a grand throne room, green-tinted light flooding the space, ornate emerald architecture, detailed illustration',
    'A vast emerald city with towering spires glowing green, seen from a distance across a poppy field in full bloom, dramatic sky, painterly fantasy illustration',
    'A field of bright red poppies stretching to the horizon, several figures collapsed asleep among the flowers, green city visible in the far distance, warm hazy light',
    'A small farmhouse being lifted into a swirling grey tornado, flat prairie landscape, dramatic stormy sky, debris spinning in the air, dramatic oil painting style',
    'A yellow brick road winding through a lush fantasy landscape, surrounded by oversized colourful flowers and strange twisted trees, soft magical light, detailed vintage illustration',
  ],
  // Add more books here as you build prompt sets:
  // 'Frankenstein': [ ... ],
  // 'The Picture of Dorian Gray': [ ... ],
};
