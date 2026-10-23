const COPY_SUFFIX = " (copy)";
const TITLE_CAP = 200;

/** Code points, which is what the definition's title cap counts. */
const codePoints = (text: string): string[] => {
  const points: string[] = [];
  for (const point of text) points.push(point);
  return points;
};

/** The source title plus " (copy)", cut so the result stays within 200 code points. */
export const duplicateTitle = (title: string): string => {
  const suffix = codePoints(COPY_SUFFIX);
  const points = codePoints(title);
  if (points.length + suffix.length <= TITLE_CAP) return `${title}${COPY_SUFFIX}`;
  return `${points.slice(0, TITLE_CAP - suffix.length).join("")}${COPY_SUFFIX}`;
};

/**
 * The stored definition with only its title changed. Every other key is copied as it was stored, so a
 * format this builder does not edit still duplicates.
 */
export const definitionAsCopy = <T extends object>(definition: T): T & { title: string } => {
  const title = Reflect.get(definition, "title");
  return { ...definition, title: duplicateTitle(typeof title === "string" ? title : "") };
};
