import { randomUUID } from "node:crypto";

/** The question ids of {@link pagedDefinition}, by name. */
export type PagedIds = Record<
  | "phone"
  | "url"
  | "address"
  | "timeOfDay"
  | "dateTime"
  | "dateRange"
  | "ranking"
  | "singleMatrix"
  | "multipleMatrix"
  | "rating"
  | "scale"
  | "slider"
  | "nps"
  | "consent",
  string
>;

const optional = { required: false } as const;

/**
 * A format 2 form with one page per group of the iteration's new inputs: phone, URL, address; time of day, date and
 * time, date range; ranking and both matrices; rating, scale, slider and NPS; and a must-be-yes checkbox. Only the
 * checkbox is required, so a test can page through the form and answer what it wants to look at.
 */
export const pagedDefinition = (title: string) => {
  const ids: PagedIds = {
    phone: randomUUID(),
    url: randomUUID(),
    address: randomUUID(),
    timeOfDay: randomUUID(),
    dateTime: randomUUID(),
    dateRange: randomUUID(),
    ranking: randomUUID(),
    singleMatrix: randomUUID(),
    multipleMatrix: randomUUID(),
    rating: randomUUID(),
    scale: randomUUID(),
    slider: randomUUID(),
    nps: randomUUID(),
    consent: randomUUID(),
  };
  const line = (shown: boolean) => ({ shown, required: false });
  const rows = [
    { value: "speed", label: "Speed" },
    { value: "price", label: "Price" },
  ];
  const columns = [
    { value: "poor", label: "Poor" },
    { value: "good", label: "Good" },
  ];
  const definition = {
    format: 2,
    title,
    pages: [
      {
        id: randomUUID(),
        title: "How to reach you",
        jumps: [],
        questions: [
          { id: ids.phone, type: "phone", label: "Phone number", ...optional, config: {} },
          { id: ids.url, type: "url", label: "Your website", ...optional, config: {} },
          {
            id: ids.address,
            type: "address",
            label: "Home address",
            ...optional,
            config: {
              lines: {
                line1: line(true),
                line2: line(false),
                city: line(true),
                region: line(false),
                postalCode: line(false),
                country: line(false),
              },
            },
          },
        ],
      },
      {
        id: randomUUID(),
        title: "When you travel",
        jumps: [],
        questions: [
          { id: ids.timeOfDay, type: "time_of_day", label: "Departure", ...optional, config: {} },
          { id: ids.dateTime, type: "date_time", label: "Check-in", ...optional, config: {} },
          { id: ids.dateRange, type: "date_range", label: "Your stay", ...optional, config: {} },
        ],
      },
      {
        id: randomUUID(),
        title: "What you prefer",
        jumps: [],
        questions: [
          {
            id: ids.ranking,
            type: "ranking",
            label: "Rank the activities",
            ...optional,
            config: {
              options: [
                { value: "hike", label: "Hike" },
                { value: "museum", label: "Museum" },
                { value: "beach", label: "Beach" },
              ],
            },
          },
          {
            id: ids.singleMatrix,
            type: "single_choice_matrix",
            label: "Rate the service",
            ...optional,
            config: { rows, columns },
          },
          {
            id: ids.multipleMatrix,
            type: "multiple_choice_matrix",
            label: "Rate the extras",
            ...optional,
            config: { rows, columns },
          },
        ],
      },
      {
        id: randomUUID(),
        title: "How it went",
        jumps: [],
        questions: [
          {
            id: ids.rating,
            type: "number",
            label: "Rate the stay",
            ...optional,
            config: { integer: true, min: 1, max: 5, display: "rating" },
          },
          {
            id: ids.scale,
            type: "number",
            label: "How comfortable was the bed?",
            ...optional,
            config: { integer: true, min: 1, max: 7, display: "scale" },
          },
          {
            id: ids.slider,
            type: "number",
            label: "Your budget",
            ...optional,
            config: { integer: true, min: 0, max: 100, step: 5, display: "slider" },
          },
          {
            id: ids.nps,
            type: "number",
            label: "Would you recommend us?",
            ...optional,
            config: {
              integer: true,
              min: 0,
              max: 10,
              display: "nps",
              minLabel: "Not likely",
              maxLabel: "Very likely",
            },
          },
        ],
      },
      {
        id: randomUUID(),
        title: "Before you send",
        jumps: [],
        questions: [
          {
            id: ids.consent,
            type: "boolean",
            label: "I accept the terms",
            required: true,
            config: { mustBeYes: true },
          },
        ],
      },
    ],
  };
  return { ids, definition };
};
