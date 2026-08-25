-- Reference link for a content idea: a real YouTube reel URL for "reel"
-- ideas sourced from a YouTube signal, or an Instagram hashtag-explore URL
-- for "carousel" ideas (there's no Instagram API in this stack to fetch a
-- real specific post URL, so a hashtag-explore page — always valid, always
-- shows genuinely relevant real posts — stands in for one).

alter table content_ideas
  add column reference_link text;
