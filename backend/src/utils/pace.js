function secondsToPace(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) {
    return null;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function paceToSeconds(pace) {
  if (!pace || typeof pace !== "string" || !pace.includes(":")) {
    return null;
  }

  const [minutesPart, secondsPart] = pace.split(":");
  const minutes = Number.parseInt(minutesPart, 10);
  const seconds = Number.parseInt(secondsPart, 10);

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || minutes < 0 || seconds < 0 || seconds > 59) {
    return null;
  }

  return (minutes * 60) + seconds;
}

module.exports = {
  secondsToPace,
  paceToSeconds,
};
