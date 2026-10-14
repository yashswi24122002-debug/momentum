// A blanket `text.replace(/\n/g, "<br />")` sends a "<html>" body that's
// really just plain text with line breaks jammed in — no real markup at
// all, which is itself a mild spam-filter signal (genuine correspondence
// usually has actual paragraph structure). Blank-line-separated paragraphs
// become real <p> tags; a single newline inside one becomes <br/>.
export function plainTextToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}
