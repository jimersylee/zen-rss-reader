//! Full-text article extraction. Pulls the main content out of a noisy web
//! page (Readability algorithm via `dom_smoothie`) for the "read full text" and
//! "read later" features.

use crate::error::{AppError, AppResult};
use crate::sanitize;
use dom_smoothie::Readability;

/// Extract the main article HTML from a full web page, then sanitize it.
/// `dom_smoothie`'s reader is not `Send`, so this stays fully synchronous —
/// call it inside `spawn_blocking`, never across an `.await`.
pub fn extract_article(html: &str, url: &str) -> AppResult<String> {
    let mut readability = Readability::new(html, Some(url), None)
        .map_err(|e| AppError::other(format!("readability init: {e}")))?;
    let article = readability
        .parse()
        .map_err(|e| AppError::other(format!("readability parse: {e}")))?;
    let content = article.content.to_string();
    if content.trim().is_empty() {
        return Err(AppError::code("noExtractableContent"));
    }
    Ok(sanitize::sanitize(&content, Some(url)))
}
