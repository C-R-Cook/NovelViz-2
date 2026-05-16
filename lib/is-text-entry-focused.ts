/** True when focus is in a field where arrow keys should move the caret, not modal chrome. */
export function isTextEntryFocused(): boolean {
  const el = document.activeElement;
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return type !== "checkbox" && type !== "radio" && type !== "button" && type !== "submit";
  }
  return el.isContentEditable;
}
