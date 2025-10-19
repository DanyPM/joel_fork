import { JORFSearchItem } from "../entities/JORFSearchResponse.ts";
import { JORFtoDate } from "../utils/date.utils.ts";

export function getLatestSourceDate(
  records: Iterable<JORFSearchItem>
): Date | null {
  let latestTime = -Infinity;

  for (const record of records) {
    const recordTime = JORFtoDate(record.source_date).getTime();
    if (recordTime > latestTime) latestTime = recordTime;
  }

  return Number.isFinite(latestTime) ? new Date(latestTime) : null;
}
