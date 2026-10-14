// A blanket `text.replace(/\n/g, "<br />")` sends a "<html>" body that's
// really just plain text with line breaks jammed in — no real markup at
// all, which is itself a mild spam-filter signal (genuine correspondence
// usually has actual paragraph structure). Blank-line-separated paragraphs
// become real <p> tags (or a real <ul> when every line in the paragraph is
// a "- " bullet); a single newline inside a plain paragraph becomes <br/>.
// `**bold**` markdown becomes <strong> — composed email bodies use it to
// highlight key numbers/names without needing real HTML authoring.
function boldify(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function plainTextToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => {
      const lines = para.split("\n").filter((l) => l.trim() !== "");
      const isList = lines.length > 0 && lines.every((l) => /^-\s+/.test(l.trim()));
      if (isList) {
        const items = lines.map((l) => `<li>${boldify(l.trim().replace(/^-\s+/, ""))}</li>`).join("");
        return `<ul style="margin:0;padding-left:20px;">${items}</ul>`;
      }
      return `<p>${boldify(para.replace(/\n/g, "<br />"))}</p>`;
    })
    .join("\n");
}

// Plain-text email clients can't render bold — strip the markers rather
// than show literal asterisks in the fallback `text` part of the message.
export function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}
