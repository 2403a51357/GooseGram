/**
 * GooseGram Campus MBTI ("Goose-ality") Static Question Bank & Scoring Engine
 * 30 questions across 4 chapters.
 * 
 * Scoring rules:
 * Option A = +2 first pole
 * Option B = +1 first pole
 * Option C = +1 second pole
 * Option D = +2 second pole
 * 
 * Chapter 1 (Q1-7): Social Battery (E vs I)
 * Chapter 2 (Q8-15): Brain Wiring (S vs N) -> Tie-breaker: Q8
 * Chapter 3 (Q16-23): Decision Engine (T vs F) -> Tie-breaker: Q16
 * Chapter 4 (Q24-30): Lifestyle & Chaos (J vs P)
 */

export const CHAPTERS = [
  { id: 1, title: "Chapter 1: Social Battery", axis: "EI", start: 1, end: 7 },
  { id: 2, title: "Chapter 2: Brain Wiring", axis: "SN", start: 8, end: 15 },
  { id: 3, title: "Chapter 3: Decision Engine", axis: "TF", start: 16, end: 23 },
  { id: 4, title: "Chapter 4: Lifestyle & Chaos", axis: "JP", start: 24, end: 30 }
];

export const MBTI_QUESTIONS = [
  // =========================================================================
  // CHAPTER 1: SOCIAL BATTERY — E vs. I (Questions 1–7)
  // =========================================================================
  {
    id: 1,
    chapter: 1,
    chapterTitle: "Chapter 1: Social Battery",
    text: "After surviving a chaotic, loud week, your ideal Friday night reset is:",
    axis: "EI",
    pole1: "E",
    pole2: "I",
    options: [
      { text: "Rallying the squad for a spontaneous night out—chaos is my caffeine.", pole: "E", points: 2 },
      { text: "Chill dinner or chai run with 2–3 favorite humans before calling it a night.", pole: "E", points: 1 },
      { text: "Peak peace: good food, zero small talk, and full main-character recharge mode.", pole: "I", points: 1 },
      { text: "Phone on Do Not Disturb, headphones on, living in my own private universe till Monday.", pole: "I", points: 2 }
    ]
  },
  {
    id: 2,
    chapter: 1,
    chapterTitle: "Chapter 1: Social Battery",
    text: "A professor cancels a 2-hour lecture out of nowhere. Your immediate move:",
    axis: "EI",
    pole1: "E",
    pole2: "I",
    options: [
      { text: "Drop a message in the group chat—free time is meant for canteen lore.", pole: "E", points: 2 },
      { text: "Link up with whoever is walking out and see where the vibe takes us.", pole: "E", points: 1 },
      { text: "Claim a quiet spot, put on a show or music, and enjoy the unexpected peace.", pole: "I", points: 1 },
      { text: "Vanish off campus like a ninja before anyone drafts me into a group plan.", pole: "I", points: 2 }
    ]
  },
  {
    id: 3,
    chapter: 1,
    chapterTitle: "Chapter 1: Social Battery",
    text: "You walk into an event or party where you only know one person:",
    axis: "EI",
    pole1: "E",
    pole2: "I",
    options: [
      { text: "Side-quest mode activated—I'll leave knowing five new people and their life stories.", pole: "E", points: 2 },
      { text: "Warm up with my friend first, then smoothly jump into nearby conversations.", pole: "E", points: 1 },
      { text: "Stick to my duo and have one elite, deep conversation instead of ten shallow ones.", pole: "I", points: 1 },
      { text: "Grab a drink, observe the room like a wildlife documentary, and slip out early.", pole: "I", points: 2 }
    ]
  },
  {
    id: 4,
    chapter: 1,
    chapterTitle: "Chapter 1: Social Battery",
    text: "In a group project where everyone is awkwardly staring at each other:",
    axis: "EI",
    pole1: "E",
    pole2: "I",
    options: [
      { text: "Break the ice immediately, start pitching ideas, and get the room talking.", pole: "E", points: 2 },
      { text: "Throw out a few starter ideas to get the energy moving.", pole: "E", points: 1 },
      { text: "Let the loud ones brainstorm while I quietly figure out the smartest way to execute.", pole: "I", points: 1 },
      { text: "Lock in solo with my headphones at 1 AM—I work 10x faster in my own zone.", pole: "I", points: 2 }
    ]
  },
  {
    id: 5,
    chapter: 1,
    chapterTitle: "Chapter 1: Social Battery",
    text: "When some wild campus gossip or personal drama hits your brain:",
    axis: "EI",
    pole1: "E",
    pole2: "I",
    options: [
      { text: "I literally cannot process it until I talk it out live with my people.", pole: "E", points: 2 },
      { text: "Call or voice-note my go-to person to break down every angle together.", pole: "E", points: 1 },
      { text: "Sit with my thoughts first and figure out how I feel before sharing my take.", pole: "I", points: 1 },
      { text: "Lock it in my internal vault—staying lowkey and mysterious is undefeated.", pole: "I", points: 2 }
    ]
  },
  {
    id: 6,
    chapter: 1,
    chapterTitle: "Chapter 1: Social Battery",
    text: "Someone sits next to you on the campus bus or library table and starts chatting:",
    axis: "EI",
    pole1: "E",
    pole2: "I",
    options: [
      { text: "Love it—turn a 5-minute ride into an unhinged debate about life and random theories.", pole: "E", points: 2 },
      { text: "Match their energy and keep a friendly conversation rolling.", pole: "E", points: 1 },
      { text: "Keep it warm and polite, then happily drift back to my own screen.", pole: "I", points: 1 },
      { text: "Give a polite nod and let my noise-canceling headphones do the heavy lifting.", pole: "I", points: 2 }
    ]
  },
  {
    id: 7,
    chapter: 1,
    chapterTitle: "Chapter 1: Social Battery",
    text: "After 3 straight hours of hanging out with a big group:",
    axis: "EI",
    pole1: "E",
    pole2: "I",
    options: [
      { text: "Fully charged—who's down for round two somewhere else?", pole: "E", points: 2 },
      { text: "Had a blast, ready for a chill wind-down now.", pole: "E", points: 1 },
      { text: "Great memories, now I urgently need an hour of pure silence to reboot.", pole: "I", points: 1 },
      { text: "Social quota maxed out for the entire weekend—ghost mode engaged.", pole: "I", points: 2 }
    ]
  },

  // =========================================================================
  // CHAPTER 2: BRAIN WIRING — S vs. N (Questions 8–15)
  // =========================================================================
  {
    id: 8,
    chapter: 2,
    chapterTitle: "Chapter 2: Brain Wiring",
    text: "It's 2:30 AM and your brain is wide awake. What's running in the background?",
    axis: "SN",
    pole1: "S",
    pole2: "N",
    isTieBreaker: true,
    options: [
      { text: "Replaying real moments from today and locking in tomorrow's exact game plan.", pole: "S", points: 2 },
      { text: "A sudden 3 AM burst of practical motivation to reorganize my room, setup, or life.", pole: "S", points: 1 },
      { text: "Connecting random dots about human psychology, alternate timelines, or unspoken motives.", pole: "N", points: 1 },
      { text: "Deep inside a 4-layer 2 AM theory rabbit hole about consciousness, simulation glitches, or future tech.", pole: "N", points: 2 }
    ]
  },
  {
    id: 9,
    chapter: 2,
    chapterTitle: "Chapter 2: Brain Wiring",
    text: "Cramming a massive topic the night before an exam:",
    axis: "SN",
    pole1: "S",
    pole2: "N",
    options: [
      { text: "Past papers, solved examples, and exact patterns—give me what actually shows up.", pole: "S", points: 2 },
      { text: "Build a clean, step-by-step foundation from page one onward.", pole: "S", points: 1 },
      { text: "Grasp the big overarching concept first so the rest clicks automatically.", pole: "N", points: 1 },
      { text: "Connect the topic to weird real-world analogies and edge-case 'what ifs.'", pole: "N", points: 2 }
    ]
  },
  {
    id: 10,
    chapter: 2,
    chapterTitle: "Chapter 2: Brain Wiring",
    text: "Someone brings you a crazy story about a mutual acquaintance:",
    axis: "SN",
    pole1: "S",
    pole2: "N",
    options: [
      { text: "'Show me the receipts'—I want exact facts, timestamps, and what actually happened.", pole: "S", points: 2 },
      { text: "Stick to what's proven before jumping to wild conclusions.", pole: "S", points: 1 },
      { text: "Read between the lines immediately—the real motive is never on the surface.", pole: "N", points: 1 },
      { text: "Already predicting the next three plot twists that will happen next week.", pole: "N", points: 2 }
    ]
  },
  {
    id: 11,
    chapter: 2,
    chapterTitle: "Chapter 2: Brain Wiring",
    text: "Which compliment hits the hardest for you?",
    axis: "SN",
    pole1: "S",
    pole2: "N",
    options: [
      { text: "'You're sharp, grounded, and always know how to handle real-world situations.'", pole: "S", points: 2 },
      { text: "'You have elite taste and notice details everyone else completely misses.'", pole: "S", points: 1 },
      { text: "'Your brain works differently—you always spot angles nobody else sees.'", pole: "N", points: 1 },
      { text: "'Talking to you feels like unlocking a whole new dimension of ideas.'", pole: "N", points: 2 }
    ]
  },
  {
    id: 12,
    chapter: 2,
    chapterTitle: "Chapter 2: Brain Wiring",
    text: "Listening to a professor explain an abstract concept:",
    axis: "SN",
    pole1: "S",
    pole2: "N",
    options: [
      { text: "'Cool theory, now show me how this actually works in real life.'", pole: "S", points: 2 },
      { text: "Give me a concrete example or demo and I'll master it immediately.", pole: "S", points: 1 },
      { text: "Immediately start wondering, 'Wait—what happens if we flip this rule?'", pole: "N", points: 1 },
      { text: "One random phrase sparks a whole mental movie of wild side-project ideas.", pole: "N", points: 2 }
    ]
  },
  {
    id: 13,
    chapter: 2,
    chapterTitle: "Chapter 2: Brain Wiring",
    text: "You finish a movie or series with an ambiguous, cryptic ending:",
    axis: "SN",
    pole1: "S",
    pole2: "N",
    options: [
      { text: "Give me a real resolution—open endings feel like the writers got lazy.", pole: "S", points: 2 },
      { text: "Enjoyed the ride and visuals; no need to overcomplicate it.", pole: "S", points: 1 },
      { text: "Straight to Reddit/YouTube to dissect hidden clues and symbolism.", pole: "N", points: 1 },
      { text: "Spend the next three days crafting my own 2 AM theory about what it meant.", pole: "N", points: 2 }
    ]
  },
  {
    id: 14,
    chapter: 2,
    chapterTitle: "Chapter 2: Brain Wiring",
    text: "Picking a side project, hackathon idea, or elective:",
    axis: "SN",
    pole1: "S",
    pole2: "N",
    options: [
      { text: "Pick something practical that builds a proven, high-value skill.", pole: "S", points: 2 },
      { text: "Pick something hands-on where I can see tangible progress fast.", pole: "S", points: 1 },
      { text: "Pick whatever sounds experimental, weird, and open-ended.", pole: "N", points: 1 },
      { text: "Chase a crazy moonshot idea just to see if I can pull it off.", pole: "N", points: 2 }
    ]
  },
  {
    id: 15,
    chapter: 2,
    chapterTitle: "Chapter 2: Brain Wiring",
    text: "Walking down a familiar campus corridor or street:",
    axis: "SN",
    pole1: "S",
    pole2: "N",
    options: [
      { text: "Spot everything—new faces, outfits, posters, and subtle changes in the vibe.", pole: "S", points: 2 },
      { text: "Stay tuned in to my surroundings and the people moving around me.", pole: "S", points: 1 },
      { text: "Half-present physically, half-running an entire conversation or idea in my head.", pole: "N", points: 1 },
      { text: "Full autopilot—my body is walking to class while my brain is in 2035.", pole: "N", points: 2 }
    ]
  },

  // =========================================================================
  // CHAPTER 3: DECISION ENGINE — T vs. F (Questions 16–23)
  // =========================================================================
  {
    id: 16,
    chapter: 3,
    chapterTitle: "Chapter 3: Decision Engine",
    text: "A close friend pitches an idea to you that clearly has major flaws:",
    axis: "TF",
    pole1: "T",
    pole2: "F",
    isTieBreaker: true,
    options: [
      { text: "Keep it 100% real—honest feedback now saves them from crashing later.", pole: "T", points: 2 },
      { text: "Point out the weak spots logically, then help them upgrade the plan.", pole: "T", points: 1 },
      { text: "Hype up what's great about it first, then gently ask a few careful questions.", pole: "F", points: 1 },
      { text: "Match their excitement—sometimes people need belief before critique.", pole: "F", points: 2 }
    ]
  },
  {
    id: 17,
    chapter: 3,
    chapterTitle: "Chapter 3: Decision Engine",
    text: "A teammate ghosts their section of a project right before submission:",
    axis: "TF",
    pole1: "T",
    pole2: "F",
    options: [
      { text: "Put only the names of people who actually worked—fairness is non-negotiable.", pole: "T", points: 2 },
      { text: "Call it out directly and hold them accountable for their share.", pole: "T", points: 1 },
      { text: "Finish the work so the grade is safe, even if I'm quietly frustrated.", pole: "F", points: 1 },
      { text: "Cover for them—you never know what battle someone is fighting behind closed doors.", pole: "F", points: 2 }
    ]
  },
  {
    id: 18,
    chapter: 3,
    chapterTitle: "Chapter 3: Decision Engine",
    text: "A debate heats up in the group chat:",
    axis: "TF",
    pole1: "T",
    pole2: "F",
    options: [
      { text: "Stand on logic and facts—truth shouldn't bend just to keep things comfortable.", pole: "T", points: 2 },
      { text: "Focus on making a sharp, objective point without getting personal.", pole: "T", points: 1 },
      { text: "Step in to lower the temperature before friends actually fall out.", pole: "F", points: 1 },
      { text: "Read the room and make sure nobody feels ganged up on or unheard.", pole: "F", points: 2 }
    ]
  },
  {
    id: 19,
    chapter: 3,
    chapterTitle: "Chapter 3: Decision Engine",
    text: "A friend calls you stressed out over a breakup or brutal exam:",
    axis: "TF",
    pole1: "T",
    pole2: "F",
    options: [
      { text: "Switch straight into strategist mode: 'Alright, here's how we fix this.'", pole: "T", points: 2 },
      { text: "Hear them out briefly, then lay out practical next steps.", pole: "T", points: 1 },
      { text: "Ask first: 'Do you want solutions right now, or do you just need to vent?'", pole: "F", points: 1 },
      { text: "Fully lock into their corner—if they're hurting, I'm right there with them.", pole: "F", points: 2 }
    ]
  },
  {
    id: 20,
    chapter: 3,
    chapterTitle: "Chapter 3: Decision Engine",
    text: "What makes a campus rule or grading policy genuinely good?",
    axis: "TF",
    pole1: "T",
    pole2: "F",
    options: [
      { text: "Objective, consistent standards where everyone gets judged by the exact same metric.", pole: "T", points: 2 },
      { text: "Clear logic and efficiency without unnecessary drama.", pole: "T", points: 1 },
      { text: "Flexibility that accounts for real human context and effort.", pole: "F", points: 1 },
      { text: "Fairness that protects student morale and brings out people's best.", pole: "F", points: 2 }
    ]
  },
  {
    id: 21,
    chapter: 3,
    chapterTitle: "Chapter 3: Decision Engine",
    text: "Someone drops a ruthless roast on you in front of the group:",
    axis: "TF",
    pole1: "T",
    pole2: "F",
    options: [
      { text: "Fire back with a surgical, funnier comeback—game respects game.", pole: "T", points: 2 },
      { text: "Laugh it off—if it's true, they earned the point.", pole: "T", points: 1 },
      { text: "Laugh in the moment, then quietly wonder later if there was truth behind it.", pole: "F", points: 1 },
      { text: "Notice the intent behind the joke—vibe and loyalty matter to me.", pole: "F", points: 2 }
    ]
  },
  {
    id: 22,
    chapter: 3,
    chapterTitle: "Chapter 3: Decision Engine",
    text: "Making a major life call (switching tracks, moving, ending a chapter):",
    axis: "TF",
    pole1: "T",
    pole2: "F",
    options: [
      { text: "Strip out the emotion, weigh the odds, and pick the smartest long-term move.", pole: "T", points: 2 },
      { text: "Let logic lead the way, then do a quick gut check.", pole: "T", points: 1 },
      { text: "Weigh how it aligns with my values and the people who matter most.", pole: "F", points: 1 },
      { text: "Trust my intuition and heart—if it feels right, I'll make it work.", pole: "F", points: 2 }
    ]
  },
  {
    id: 23,
    chapter: 3,
    chapterTitle: "Chapter 3: Decision Engine",
    text: "You spot a classmate subtly peeking at notes during a brutal exam:",
    axis: "TF",
    pole1: "T",
    pole2: "F",
    options: [
      { text: "Not my business—everyone plays their own odds and owns the outcome.", pole: "T", points: 2 },
      { text: "Annoying if it messes with the curve, but I stay locked on my own paper.", pole: "T", points: 1 },
      { text: "Silently hope they don't get busted and wreck their whole semester.", pole: "F", points: 1 },
      { text: "Feel second-hand adrenaline for them until the invigilator walks away.", pole: "F", points: 2 }
    ]
  },

  // =========================================================================
  // CHAPTER 4: LIFESTYLE & CHAOS — J vs. P (Questions 24–30)
  // =========================================================================
  {
    id: 24,
    chapter: 4,
    chapterTitle: "Chapter 4: Lifestyle & Chaos",
    text: "An assignment deadline is 7 days away:",
    axis: "JP",
    pole1: "J",
    pole2: "P",
    options: [
      { text: "Knock it out early so I can chill completely guilt-free all week.", pole: "J", points: 2 },
      { text: "Break it into easy daily chunks and cruise smoothly to the finish line.", pole: "J", points: 1 },
      { text: "Let ideas simmer all week, then lock in strong the night before.", pole: "P", points: 1 },
      { text: "Peak performance only unlocks 2 hours before the portal closes—diamond pressure.", pole: "P", points: 2 }
    ]
  },
  {
    id: 25,
    chapter: 4,
    chapterTitle: "Chapter 4: Lifestyle & Chaos",
    text: "A friend texts at 9 PM: 'Spontaneous night drive / food run in 15 mins?':",
    axis: "JP",
    pole1: "J",
    pole2: "P",
    options: [
      { text: "Pass—I already locked in my night and tomorrow's schedule.", pole: "J", points: 2 },
      { text: "Only if we know the rough plan and when we're heading back.", pole: "J", points: 1 },
      { text: "Toss on a hoodie—half the fun is figuring it out on the way.", pole: "P", points: 1 },
      { text: "Already lacing up my shoes before they finish typing the location.", pole: "P", points: 2 }
    ]
  },
  {
    id: 26,
    chapter: 4,
    chapterTitle: "Chapter 4: Lifestyle & Chaos",
    text: "What does your browser or phone look like right now?",
    axis: "JP",
    pole1: "J",
    pole2: "P",
    options: [
      { text: "Clean folders, zero unread badges, tabs closed like a commander.", pole: "J", points: 2 },
      { text: "Mostly tidy—just the essentials open so I stay focused.", pole: "J", points: 1 },
      { text: "40+ open tabs and screenshots representing 12 different curiosity spirals.", pole: "P", points: 1 },
      { text: "So many open tabs Chrome stopped counting and just gave me :D.", pole: "P", points: 2 }
    ]
  },
  {
    id: 27,
    chapter: 4,
    chapterTitle: "Chapter 4: Lifestyle & Chaos",
    text: "Your strategy with college attendance percentages:",
    axis: "JP",
    pole1: "J",
    pole2: "P",
    options: [
      { text: "Keep a fortress buffer (90%+) so attendance rules never control my life.", pole: "J", points: 2 },
      { text: "Comfortable 80–85% zone—smart freedom without stress.", pole: "J", points: 1 },
      { text: "Precision math right on the 75% edge—maximum freedom per class.", pole: "P", points: 1 },
      { text: "Living dangerously on vibes and last-week medical miracles.", pole: "P", points: 2 }
    ]
  },
  {
    id: 28,
    chapter: 4,
    chapterTitle: "Chapter 4: Lifestyle & Chaos",
    text: "Planning a trip with friends:",
    axis: "JP",
    pole1: "J",
    pole2: "P",
    options: [
      { text: "Already dropped a clean itinerary with timings, stays, and food spots.", pole: "J", points: 2 },
      { text: "Lock down transport and stay first, leave small gaps to explore.", pole: "J", points: 1 },
      { text: "Book the tickets and let the mood of the day decide the rest.", pole: "P", points: 1 },
      { text: "Zero itinerary—getting lost is literally how core memories are made.", pole: "P", points: 2 }
    ]
  },
  {
    id: 29,
    chapter: 4,
    chapterTitle: "Chapter 4: Lifestyle & Chaos",
    text: "Starting a new hobby, show, or personal project:",
    axis: "JP",
    pole1: "J",
    pole2: "P",
    options: [
      { text: "Finish what I start before opening a new chapter.", pole: "J", points: 2 },
      { text: "Build a steady rhythm until I hit the milestone.", pole: "J", points: 1 },
      { text: "Ride a massive wave of obsession for 4 days, then follow the next spark.", pole: "P", points: 1 },
      { text: "Happily juggling 5 projects, 3 shows, and 10 new ideas at once.", pole: "P", points: 2 }
    ]
  },
  {
    id: 30,
    chapter: 4,
    chapterTitle: "Chapter 4: Lifestyle & Chaos",
    text: "How do schedules and deadlines actually feel to you?",
    axis: "JP",
    pole1: "J",
    pole2: "P",
    options: [
      { text: "Empowering—structure clears my head so I can execute at 100%.", pole: "J", points: 2 },
      { text: "Helpful guardrails that keep chaos from wasting my time.", pole: "J", points: 1 },
      { text: "Flexible guidelines that adapt when a better moment pops up.", pole: "P", points: 1 },
      { text: "A fun countdown clock that turns ordinary tasks into an extreme sport.", pole: "P", points: 2 }
    ]
  }
];

// =========================================================================
// THE 16 ARCHETYPES & COMPACT BADGES (ZERO SPACE BETWEEN EMOJI & 4 LETTERS)
// =========================================================================
export const MBTI_ARCHETYPES = {
  // Analysts (Soft Purple)
  INTJ: {
    code: "INTJ",
    emoji: "🦉",
    badge: "🦉INTJ",
    title: "Backbench Mastermind",
    bio: "Silent in class, already planned the next 5 years.",
    group: "Analysts",
    groupColor: "purple",
    pillClass: "mbti-pill-purple",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    text: "#6D28D9",
    highlight: "#7C3AED"
  },
  INTP: {
    code: "INTP",
    emoji: "🦝",
    badge: "🦝INTP",
    title: "3 AM Overthinker",
    bio: "Sleeps in lectures, solves impossible bugs at midnight.",
    group: "Analysts",
    groupColor: "purple",
    pillClass: "mbti-pill-purple",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    text: "#6D28D9",
    highlight: "#7C3AED"
  },
  ENTJ: {
    code: "ENTJ",
    emoji: "🦅",
    badge: "🦅ENTJ",
    title: "Fest Secretary",
    bio: "Turns a casual chai break into a 10-point action plan.",
    group: "Analysts",
    groupColor: "purple",
    pillClass: "mbti-pill-purple",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    text: "#6D28D9",
    highlight: "#7C3AED"
  },
  ENTP: {
    code: "ENTP",
    emoji: "🐧",
    badge: "🐧ENTP",
    title: "Chaos Penguin",
    bio: "Intelligent, lovable menace who argues just for sport.",
    group: "Analysts",
    groupColor: "purple",
    pillClass: "mbti-pill-purple",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    text: "#6D28D9",
    highlight: "#7C3AED"
  },

  // Diplomats (Soft Green)
  INFJ: {
    code: "INFJ",
    emoji: "🦊",
    badge: "🦊INFJ",
    title: "Campus Therapist",
    bio: "Knows everyone's secrets, gives elite advice, disappears.",
    group: "Diplomats",
    groupColor: "green",
    pillClass: "mbti-pill-green",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    text: "#047857",
    highlight: "#059669"
  },
  INFP: {
    code: "INFP",
    emoji: "🦢",
    badge: "🦢INFP",
    title: "Daydreamer",
    bio: "Romanticizing campus rain with headphones on 24/7.",
    group: "Diplomats",
    groupColor: "green",
    pillClass: "mbti-pill-green",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    text: "#047857",
    highlight: "#059669"
  },
  ENFJ: {
    code: "ENFJ",
    emoji: "🐬",
    badge: "🐬ENFJ",
    title: "Main Character",
    bio: "Friends with every batch, every club, and the canteen guy.",
    group: "Diplomats",
    groupColor: "green",
    pillClass: "mbti-pill-green",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    text: "#047857",
    highlight: "#059669"
  },
  ENFP: {
    code: "ENFP",
    emoji: "🦜",
    badge: "🦜ENFP",
    title: "Canteen Yap-Star",
    bio: "Starts 5 side-quests before finishing one assignment.",
    group: "Diplomats",
    groupColor: "green",
    pillClass: "mbti-pill-green",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    text: "#047857",
    highlight: "#059669"
  },

  // Sentinels (Soft Blue)
  ISTJ: {
    code: "ISTJ",
    emoji: "🐢",
    badge: "🐢ISTJ",
    title: "Notes Savior",
    bio: "The only reason the whole class passes internals.",
    group: "Sentinels",
    groupColor: "blue",
    pillClass: "mbti-pill-blue",
    bg: "#F0F9FF",
    border: "#BAE6FD",
    text: "#0369A1",
    highlight: "#0284C7"
  },
  ISFJ: {
    code: "ISFJ",
    emoji: "🦌",
    badge: "🦌ISFJ",
    title: "Hostel Mom/Dad",
    bio: "Always has extra chargers, paracetamol, and snacks.",
    group: "Sentinels",
    groupColor: "blue",
    pillClass: "mbti-pill-blue",
    bg: "#F0F9FF",
    border: "#BAE6FD",
    text: "#0369A1",
    highlight: "#0284C7"
  },
  ESTJ: {
    code: "ESTJ",
    emoji: "🦁",
    badge: "🦁ESTJ",
    title: "CR Energy",
    bio: "Reminds the professor about homework (still reliable though).",
    group: "Sentinels",
    groupColor: "blue",
    pillClass: "mbti-pill-blue",
    bg: "#F0F9FF",
    border: "#BAE6FD",
    text: "#0369A1",
    highlight: "#0284C7"
  },
  ESFJ: {
    code: "ESFJ",
    emoji: "🐕",
    badge: "🐕ESFJ",
    title: "Tea Distributor",
    bio: "Knows who broke up before they even know themselves.",
    group: "Sentinels",
    groupColor: "blue",
    pillClass: "mbti-pill-blue",
    bg: "#F0F9FF",
    border: "#BAE6FD",
    text: "#0369A1",
    highlight: "#0284C7"
  },

  // Explorers (Soft Amber)
  ISTP: {
    code: "ISTP",
    emoji: "🐈⬛",
    badge: "🐈⬛ISTP",
    title: "Ghost Mechanic",
    bio: "Zero attendance, shows up, fixes everything, leaves.",
    group: "Explorers",
    groupColor: "amber",
    pillClass: "mbti-pill-amber",
    bg: "#FFFBEB",
    border: "#FDE68A",
    text: "#B45309",
    highlight: "#D97706"
  },
  ISFP: {
    code: "ISFP",
    emoji: "🦋",
    badge: "🦋ISFP",
    title: "Aesthetic Rebel",
    bio: "Too cool for campus politics, elite music taste.",
    group: "Explorers",
    groupColor: "amber",
    pillClass: "mbti-pill-amber",
    bg: "#FFFBEB",
    border: "#FDE68A",
    text: "#B45309",
    highlight: "#D97706"
  },
  ESTP: {
    code: "ESTP",
    emoji: "🦈",
    badge: "🦈ESTP",
    title: "Last-Minute Legend",
    bio: "Zero prep, full confidence, somehow pulls it off.",
    group: "Explorers",
    groupColor: "amber",
    pillClass: "mbti-pill-amber",
    bg: "#FFFBEB",
    border: "#FDE68A",
    text: "#B45309",
    highlight: "#D97706"
  },
  ESFP: {
    code: "ESFP",
    emoji: "🦩",
    badge: "🦩ESFP",
    title: "Afterparty Starter",
    bio: "Turns a boring Tuesday night into core college lore.",
    group: "Explorers",
    groupColor: "amber",
    pillClass: "mbti-pill-amber",
    bg: "#FFFBEB",
    border: "#FDE68A",
    text: "#B45309",
    highlight: "#D97706"
  }
};

/**
 * Calculates 4-letter MBTI type from raw answers map { [questionId]: selectedOptionIndex }
 */
export function calculateMbtiType(answers = {}) {
  let scoreE = 0, scoreI = 0;
  let scoreS = 0, scoreN = 0;
  let scoreT = 0, scoreF = 0;
  let scoreJ = 0, scoreP = 0;

  MBTI_QUESTIONS.forEach((q) => {
    const selectedIdx = answers[q.id] ?? answers[String(q.id)];
    if (selectedIdx === undefined || selectedIdx === null) return;
    const option = q.options[selectedIdx];
    if (!option) return;

    if (option.pole === "E") scoreE += option.points;
    else if (option.pole === "I") scoreI += option.points;
    else if (option.pole === "S") scoreS += option.points;
    else if (option.pole === "N") scoreN += option.points;
    else if (option.pole === "T") scoreT += option.points;
    else if (option.pole === "F") scoreF += option.points;
    else if (option.pole === "J") scoreJ += option.points;
    else if (option.pole === "P") scoreP += option.points;
  });

  // Axis 1: E vs I
  let letter1 = scoreE > scoreI ? "E" : scoreI > scoreE ? "I" : "E";
  if (scoreE === scoreI) {
    const q1Ans = answers[1] ?? answers["1"];
    letter1 = (q1Ans === 0 || q1Ans === 1) ? "E" : "I";
  }

  // Axis 2: S vs N (Tie-breaker Question #8)
  let letter2;
  if (scoreS > scoreN) {
    letter2 = "S";
  } else if (scoreN > scoreS) {
    letter2 = "N";
  } else {
    // Tie-breaker Question #8
    const q8Ans = answers[8] ?? answers["8"];
    letter2 = (q8Ans === 0 || q8Ans === 1) ? "S" : "N";
  }

  // Axis 3: T vs F (Tie-breaker Question #16)
  let letter3;
  if (scoreT > scoreF) {
    letter3 = "T";
  } else if (scoreF > scoreT) {
    letter3 = "F";
  } else {
    // Tie-breaker Question #16
    const q16Ans = answers[16] ?? answers["16"];
    letter3 = (q16Ans === 0 || q16Ans === 1) ? "T" : "F";
  }

  // Axis 4: J vs P
  let letter4 = scoreJ > scoreP ? "J" : scoreP > scoreJ ? "P" : "P";
  if (scoreJ === scoreP) {
    const q24Ans = answers[24] ?? answers["24"];
    letter4 = (q24Ans === 0 || q24Ans === 1) ? "J" : "P";
  }

  const type = `${letter1}${letter2}${letter3}${letter4}`;
  return MBTI_ARCHETYPES[type] ? type : "ENTP";
}

/**
 * Calculates dynamic Vibe Match % between two MBTI types (between 78% and 96%)
 */
export function calculateVibeMatch(typeA, typeB) {
  if (!typeA || !typeB) return 85;
  const a = String(typeA).toUpperCase();
  const b = String(typeB).toUpperCase();
  if (a.length !== 4 || b.length !== 4) return 85;

  let base = 78;

  // Matching perception axis (N/S) gives deep shared worldview
  if (a[1] === b[1]) base += 8;

  // Complementary social energy (one E, one I balances dynamics)
  if (a[0] !== b[0]) base += 5;
  else base += 3;

  // Complementary or matching decision engine (T/F)
  if (a[2] === b[2]) base += 3;
  else base += 2;

  // Structure dynamic (one J, one P balances order and spontaneity)
  if (a[3] !== b[3]) base += 4;
  else base += 2;

  // Ensure deterministic slight variation based on characters
  const charSum = (a.charCodeAt(0) + b.charCodeAt(3)) % 5;
  const match = Math.min(96, Math.max(78, base + charSum - 2));

  return match;
}

export function getMbtiDetails(type) {
  if (!type) return null;
  const clean = String(type).toUpperCase().trim();
  return MBTI_ARCHETYPES[clean] || null;
}
