//! HTML sanitization and text extraction. Every piece of feed- or web-supplied
//! HTML passes through `sanitize` before it is ever stored or rendered.

use ammonia::{Builder, UrlRelative};
use ego_tree::iter::Edge;
use scraper::node::Node;
use scraper::Html;
use url::Url;

/// Sanitize untrusted HTML for safe rendering inside the reader webview.
/// Relative URLs are rewritten against `base` so feed images/links resolve.
pub fn sanitize(html: &str, base: Option<&str>) -> String {
    let mut builder = Builder::default();
    builder
        .link_rel(Some("noopener noreferrer nofollow"))
        .add_generic_attributes(["loading"]);

    let parsed_base = base.and_then(|b| Url::parse(b).ok());
    if let Some(b) = parsed_base {
        builder.url_relative(UrlRelative::RewriteWithBase(b));
    }
    builder.clean(html).to_string()
}

/// Tags whose text content is dropped wholesale (it isn't human-readable copy).
const SKIP_TAGS: &[&str] = &["script", "style", "template", "noscript"];

/// Block-level tags: their edges are word boundaries, so text on either side
/// must not be allowed to run together (`</h1><p>` → "TitleBody").
const BLOCK_TAGS: &[&str] = &[
    "address", "article", "aside", "blockquote", "br", "caption", "dd", "div",
    "dl", "dt", "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5",
    "h6", "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section",
    "table", "td", "th", "tr", "ul",
];

/// Strip all markup from HTML, yielding collapsed plain text. Used for the
/// FTS body index, list snippets, and AI prompt context.
///
/// Parsing into a DOM (rather than letting ammonia concatenate text nodes)
/// gets two things right that a plain tag-strip does not: HTML entities are
/// decoded (`&amp;` → `&`), and a space is emitted at every block boundary so
/// adjacent paragraphs/headings keep their words apart — while inline tags
/// (`un<b>der</b>line`) still join seamlessly. The traversal is iterative, so
/// pathologically deep markup can't overflow the stack.
pub fn html_to_text(html: &str) -> String {
    let frag = Html::parse_fragment(html);
    let mut out = String::new();
    // Depth of the current script/style/etc. subtree — text is dropped while
    // this is non-zero.
    let mut skip = 0u32;
    for edge in frag.tree.root().traverse() {
        match edge {
            Edge::Open(node) => match node.value() {
                Node::Element(el) => {
                    let name = el.name();
                    if SKIP_TAGS.contains(&name) {
                        skip += 1;
                    } else if skip == 0 && BLOCK_TAGS.contains(&name) {
                        out.push(' ');
                    }
                }
                Node::Text(t) if skip == 0 => out.push_str(t),
                _ => {}
            },
            Edge::Close(node) => {
                if let Node::Element(el) = node.value() {
                    let name = el.name();
                    if SKIP_TAGS.contains(&name) {
                        skip = skip.saturating_sub(1);
                    } else if skip == 0 && BLOCK_TAGS.contains(&name) {
                        out.push(' ');
                    }
                }
            }
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}
