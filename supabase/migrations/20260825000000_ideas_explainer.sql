-- Ideas Tool: plain-language explainer field, so unfamiliar jargon/tech in
-- a generated idea (e.g. "eBPF") has a built-in explanation.

alter table ideas
  add column explainer text;
