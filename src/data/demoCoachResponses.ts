import type { WellnessGoal } from '../types/wellness';
import {
  detectUrgentSafetyConcern,
  URGENT_SAFETY_RESPONSE,
} from '../shared/coachSafety';

const MEDICAL_BOUNDARY_PATTERN =
  /\b(diagnos(e|is)|prescribe|medication|dosage|stop taking|pill|antidepressant|melatonin dose|ozempic|supplement dose)\b/i;

const EXTREME_WEIGHT_PATTERN =
  /\b(starve|fast for days|lose \d+\s*(lbs|pounds|kg) in a week|500 calories|800 calories|extreme diet|laxative)\b/i;

/**
 * Curated, non-AI responses used when Demo Coach mode is selected or when
 * upstream Live AI is temporarily unreachable, keeping every response clearly
 * labeled as non-AI wellness guidance.
 */
export function buildCuratedDemoResponse(
  userMessage: string,
  goal: WellnessGoal
): { content: string; isCrisisNotice: boolean } {
  const text = userMessage.trim();

  if (detectUrgentSafetyConcern(text)) {
    return {
      content: URGENT_SAFETY_RESPONSE,
      isCrisisNotice: true,
    };
  }

  if (MEDICAL_BOUNDARY_PATTERN.test(text)) {
    return {
      isCrisisNotice: false,
      content: `I can share general everyday wellness habits, though I cannot diagnose symptoms, recommend supplements or medications, or advise changing a prescribed plan.

Next steps:
- Write down what you have been noticing—such as when symptoms happen and how long they have lasted—to bring to a licensed doctor or pharmacist.
- Keep today's self-care simple while you wait for clinical guidance: prioritize comfortable rest, regular meals, and hydration.

Why this may help:
Questions about symptoms, diagnoses, or medications depend on your personal health history, which a qualified clinician can review safely with you.`,
    };
  }

  if (EXTREME_WEIGHT_PATTERN.test(text)) {
    return {
      isCrisisNotice: false,
      content: `I focus on steady, supportive everyday habits rather than rapid weight targets or restrictive eating plans, which can leave you feeling depleted.

Next steps:
- Aim for regular, balanced meals and snacks so your energy stays steadier across the day.
- Choose a gentle form of movement you genuinely find comfortable, such as a short walk or light stretching.
- Consider speaking with a registered dietitian or physician if you would like individualized nutrition support.

Why this may help:
Consistent nourishment and approachable movement support daily energy and well-being without the stress of harsh rules.`,
    };
  }

  const lower = text.toLowerCase();

  // Greetings or "what can you do" queries
  if (
    /^(hi|hello|hey|good morning|good afternoon|good evening|help|what can you do)\b/i.test(
      text
    ) &&
    text.length < 45
  ) {
    const focusName =
      goal === 'sleep'
        ? 'steadier evening wind-down habits'
        : goal === 'stress'
        ? 'everyday stress resets and calm pauses'
        : goal === 'weight'
        ? 'sustainable nourishment and enjoyable movement'
        : 'steady daily energy and pacing';
    return {
      isCrisisNotice: false,
      content: `Hello! I can share calm, practical everyday ideas around ${focusName}, sleep routines, gentle movement, and short resets during busy days.

Next steps:
- Ask about a specific moment in your day—such as winding down at night, handling an afternoon energy dip, or easing tension between tasks.
- Try one of the silent timed practices in the Sessions tab whenever you want a 1- to 5-minute guided pause.
- Log your self-reported energy, sleep, or steps on the Home tab if noticing daily patterns feels helpful.

Why this may help:
Focusing on one small, concrete part of your day makes wellness habits much easier to try without feeling overwhelmed.`,
    };
  }

  // Caffeine, afternoon dip, or midday slump
  if (/\b(caffeine|coffee|afternoon|slump|dip|midday|crash|groggy|tired at work)\b/i.test(lower)) {
    return {
      isCrisisNotice: false,
      content: `Midday energy dips are a normal part of daily alertness rhythms, and small physical shifts often refresh focus without relying on late-day caffeine.

Next steps:
- Drink a glass of water and step near a window or outdoors for 2 to 5 minutes of natural daylight.
- Stand up, unclench your shoulders, or open the 3-minute Energy reset session to give your eyes a break from close screens.
- Pair your afternoon with a lighter, well-defined task before tackling complex decisions.

Why this may help:
Brief light exposure, posture changes, and hydration reduce screen fatigue while protecting your ability to wind down later tonight.`,
    };
  }

  // Screen fatigue, posture, desk work, stretching
  if (/\b(screen|desk|posture|sit(ting)?|stretch|neck|back|eyes|computer)\b/i.test(lower)) {
    return {
      isCrisisNotice: false,
      content: `Long stretches at a screen quietly build tension in your eyes, neck, and shoulders, so brief micro-breaks work well even on packed days.

Next steps:
- Look toward a distant point across the room or out a window for 20 seconds to relax close-focus eye muscles.
- Let your shoulders drop away from your ears and rest your hands loosely in your lap for three unhurried breaths.
- Keep any gentle movement or stretching strictly within a comfortable, pain-free range.

Why this may help:
Frequent, low-effort posture resets interrupt static muscle tension before it builds into end-of-day fatigue.`,
    };
  }

  // Walking, steps, exercise, movement motivation
  if (/\b(walk(ing)?|steps|exercise|workout|move|movement|sedentary|active)\b/i.test(lower)) {
    return {
      isCrisisNotice: false,
      content: `When motivation or time feels tight, shrinking movement down to a short, comfortable block makes it much easier to start.

Next steps:
- Aim for a 5- to 10-minute easy walk—around the block, down a hallway, or after a meal—rather than waiting for a free hour.
- Choose a pace where you can breathe comfortably and notice your surroundings without rushing.
- Record your steps manually on Home only if tracking feels encouraging rather than pressuring.

Why this may help:
Gentle, repeatable movement supports circulation and mood while building momentum without exhausting your energy reserves.`,
    };
  }

  // Sleep-specific topics
  if (
    /\b(night|sleep|insomnia|bedtime|wake|waking|clock|nap|restless|wind[- ]?down)\b/i.test(
      lower
    )
  ) {
    if (/\b(middle of the night|wake|waking|clock|3\s*am|2\s*am|4\s*am)\b/i.test(lower)) {
      return {
        isCrisisNotice: false,
        content: `Waking briefly during the night is common, and turning away from the clock often reduces the pressure to fall back asleep immediately.

Next steps:
- Turn clock and phone displays out of view so you are not calculating remaining hours in the dark.
- Rest quietly with slow, comfortable breathing; if you still feel alert after ~20 minutes, read something calm in dim light until drowsiness returns.
- Keep your morning wake-up time reasonably steady rather than trying to force sleep.

Why this may help:
Checking the time often triggers alertness and frustration, whereas low-light rest lowers mental pressure and gives sleepiness room to return.`,
      };
    }

    return {
      isCrisisNotice: false,
      content: `A simple, repeatable wind-down cue helps signal to your mind and body that problem-solving for the day is finished.

Next steps:
- Dim overhead lights 20 to 30 minutes before bed and jot tomorrow's reminders on paper so you do not have to hold them in memory.
- Step away from fast-paced feeds or work messages and try the 4-minute Sleep wind-down session in the Sessions tab.
- If sleep difficulties are persistent or leave you exhausted during the day, check in with a healthcare professional.

Why this may help:
Reducing bright light and mental task-switching before bed lowers evening stimulation, helping drowsiness build naturally.`,
    };
  }

  // Stress, overwhelm, anxiety, breathing, tension
  if (
    /\b(stress|anxi(ous|ety)|overwhelm|tense|tension|jaw|shoulder|meeting|busy|calm|breath|panic|worry)\b/i.test(
      lower
    )
  ) {
    return {
      isCrisisNotice: false,
      content: `When demands stack up, a brief transition pause between tasks is often more realistic than trying to clear an entire hour.

Next steps:
- Pause for two minutes: rest your hands, let your shoulders drop slightly, and unclench your jaw.
- Breathe at an easy, unforced pace—or open the Gentle breathing session—returning to ordinary breathing anytime you wish.
- Choose just one small next action rather than holding your entire to-do list in mind at once.

Why this may help:
Brief physical and attention resets interrupt continuous rushing and help your nervous system settle enough to focus on one step at a time.`,
    };
  }

  // Meals, nutrition, hunger, weight, snacking
  if (
    /\b(weight|meal|eat(ing)?|hunger|fullness|food|snack|nourish|cook|nutrition|appetite)\b/i.test(
      lower
    )
  ) {
    return {
      isCrisisNotice: false,
      content: `Approaching meals and movement with consistency and self-kindness tends to be much more sustainable than strict all-or-nothing rules.

Next steps:
- Keep one or two simple, nourishing meal or snack combinations on hand for hectic days so you do not have to skip meals.
- Take a calm breath before and midway through eating to notice flavor, comfort, and fullness cues without judgment.
- Add 10 minutes of enjoyable movement—such as walking or light stretching—at a time that fits naturally into your routine.

Why this may help:
Regular nourishment and approachable movement support steadier daily energy and reduce decision fatigue on busy days.`,
    };
  }

  // Goal-aware default fallback for open-ended habits / routine questions
  if (goal === 'sleep') {
    return {
      isCrisisNotice: false,
      content: `Small daytime and evening anchors—like morning light, a consistent wake window, and a quiet 15-minute buffer before bed—gently support easier rest.

Next steps:
- Pick one consistent evening cue tonight, such as dimming a lamp or setting your phone across the room.
- Keep late-evening activities low-key, or use the Sleep wind-down session to transition out of work mode.
- Speak with a qualified clinician if ongoing sleep trouble affects your daytime well-being.

Why this may help:
Predictable environmental cues reduce evening alertness without turning bedtime into a high-pressure task.`,
    };
  }

  if (goal === 'stress') {
    return {
      isCrisisNotice: false,
      content: `Building one or two short pauses into existing transitions—like before lunch or right after work—helps prevent everyday tension from compounding.

Next steps:
- Pair a 60-second pause with something you already do daily, such as pouring water or closing your laptop.
- Notice physical support beneath your feet and chair, and let each exhale stay soft and unforced.
- Narrow your focus to the single next priority whenever your schedule feels crowded.

Why this may help:
Anchoring short resets to existing routines makes stress recovery realistic even on busy days.`,
    };
  }

  if (goal === 'weight') {
    return {
      isCrisisNotice: false,
      content: `Sustainable well-being grows out of steady, non-restrictive routines around regular meals, comfortable movement, and adequate rest.

Next steps:
- Focus on adding one supportive habit today—such as a balanced meal, a glass of water, or a 10-minute walk—rather than restricting yourself.
- Use the Mindfulness session to check in with physical energy and hunger cues calmly.
- Reach out to a healthcare professional or registered dietitian for personalized guidance if helpful.

Why this may help:
Supportive, low-pressure habits are easier to maintain day after day without triggering cycles of burnout.`,
    };
  }

  return {
    isCrisisNotice: false,
    content: `A gentle adjustment to pacing, natural light, and hydration can help you move through variable-energy days without pushing past your limits.

Next steps:
- Have a glass of water and step near natural light or stand up for two minutes away from your screen.
- Match your current energy to one manageable next step—or take the 3-minute Energy reset session for a quiet pause.
- If low energy feels persistent or concerning, consider discussing it with a healthcare professional.

Why this may help:
Short visual and posture breaks ease fatigue, while pacing tasks around your actual energy helps prevent afternoon burnout.`,
  };
}
