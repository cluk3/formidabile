/** An optional number field's value: empty (or not a number) leaves the setting out. */
export const optionalNumber = (value: string): number | undefined =>
  value === "" || Number.isNaN(Number(value)) ? undefined : Number(value);

/** An optional text field's value: empty leaves the setting out. */
export const optionalText = (value: string): string | undefined =>
  value === "" ? undefined : value;

export const fieldClass = "flex flex-col gap-1.5 text-sm font-medium";
export const checkClass = "flex items-center gap-2 text-sm";
export const nativeInputClass =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border bg-transparent px-2.5 py-1.5 text-base shadow-xs outline-none focus-visible:ring-3 md:text-sm";
