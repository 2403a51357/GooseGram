/**
 * Tea Status Badge Helper for Gossip Flair Posts
 *
 * Thresholds based on post net score:
 * - 30+: 👑 Goose Lore
 * - 15+: 🔥 Piping Hot
 * - 5+: ☕ Warm Tea
 * - -3 to -6: 🐍 Sus Tea
 * - -7 or lower: ❄️ Cold Tea
 * - Between -2 and 4: null (no badge)
 */
export function getTeaBadge(score) {
  const numScore = Number(score) || 0;

  if (numScore >= 30) {
    return { label: "👑 Goose Lore", className: "tea-goose-lore" };
  }
  if (numScore >= 15) {
    return { label: "🔥 Piping Hot", className: "tea-piping-hot" };
  }
  if (numScore >= 5) {
    return { label: "☕ Warm Tea", className: "tea-warm" };
  }
  if (numScore <= -7) {
    return { label: "❄️ Cold Tea", className: "tea-cold" };
  }
  if (numScore <= -3) {
    return { label: "🐍 Sus Tea", className: "tea-sus" };
  }
  return null;
}
