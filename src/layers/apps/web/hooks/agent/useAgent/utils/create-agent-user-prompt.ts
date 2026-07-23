const TIME_LITERAL_PATTERN = /(?<![\d:])(?:\d+:)?\d+:[0-5]\d(?:\.\d+)?(?![\d:])/g;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

function parseTimeLiteral(literal: string): number | null {
  const timeParts = literal.split(':').map(Number);
  if (timeParts.length === 2) {
    const [minutes, seconds] = timeParts;
    return minutes * SECONDS_PER_MINUTE + seconds;
  }

  if (timeParts.length !== 3) {
    return null;
  }

  const [hours, minutes, seconds] = timeParts;
  if (minutes >= SECONDS_PER_MINUTE) {
    return null;
  }

  return hours * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE + seconds;
}

export function createAgentUserPrompt(userInput: string): string {
  return userInput.replace(TIME_LITERAL_PATTERN, literal => {
    const seconds = parseTimeLiteral(literal);
    if (seconds === null || !Number.isFinite(seconds)) {
      return literal;
    }

    return `${seconds} seconds`;
  });
}
