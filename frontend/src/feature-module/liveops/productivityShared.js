import { formatDisplayDate, formatDateTimeLabel, smartSearchMatch, toNumber } from "../hrm/hrmShared";

export const normalizeListResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

export const splitCommaValues = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const splitParagraphs = (value) =>
  String(value || "")
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

export const checklistProgress = (items) => {
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const completed = list.filter((item) => item?.done).length;
  return { total, completed, percent: total ? Math.round((completed / total) * 100) : 0 };
};

export const tablePreviewCount = (tableData) => ({
  columns: Array.isArray(tableData?.columns) ? tableData.columns.length : 0,
  rows: Array.isArray(tableData?.rows) ? tableData.rows.length : 0,
});

export const eventCountdown = (value) => {
  if (!value) return "No date";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return formatDateTimeLabel(value);
  const diff = time - Date.now();
  const absMinutes = Math.round(Math.abs(diff) / 60000);
  const days = Math.floor(absMinutes / (60 * 24));
  const hours = Math.floor((absMinutes % (60 * 24)) / 60);
  const minutes = absMinutes % 60;
  const label = [];
  if (days) label.push(`${days}d`);
  if (hours) label.push(`${hours}h`);
  if (!days) label.push(`${minutes}m`);
  const joined = label.join(" ");
  return diff >= 0 ? `${joined} remaining` : `${joined} ago`;
};

export const noteToneClass = (tone) => {
  const key = String(tone || "amber").toLowerCase();
  if (["coral", "ocean", "mint", "violet", "amber"].includes(key)) return key;
  return "amber";
};

export const eventUrgency = (record) => {
  const startsAt = new Date(record?.starts_at || 0).getTime();
  if (Number.isNaN(startsAt)) return "info";
  const diff = startsAt - Date.now();
  if (diff < 0) return "danger";
  if (diff <= 1000 * 60 * 60 * 12) return "danger";
  if (diff <= 1000 * 60 * 60 * 24 * 2) return "warning";
  return "success";
};

export const todoMatches = (todo, search) =>
  smartSearchMatch(todo, search, [todo.due_at, todo.priority, ...(todo.labels || [])]);

export const noteMatches = (note, search) =>
  smartSearchMatch(note, search, [note.category, ...(note.tags || []), ...(note.blocks || []).map((block) => block?.text)]);

export const eventMatches = (event, search) =>
  smartSearchMatch(event, search, [event.location, event.notes, ...(event.attendees || [])]);

export const parseTableRowsText = (value) =>
  String(value || "")
    .split(/\n+/)
    .map((row) => row.split("|").map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));

export const stringifyTableRows = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => (Array.isArray(row) ? row.join(" | ") : ""))
    .filter(Boolean)
    .join("\n");

export const amountOrZero = (value) => toNumber(value || 0);
export { formatDisplayDate, formatDateTimeLabel };
