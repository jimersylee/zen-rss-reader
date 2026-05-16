//! Shared application state, registered via `Builder::manage` and injected into
//! commands as `tauri::State<AppState>`.

use reqwest::Client;
use rusqlite::Connection;
use std::sync::RwLock;
use tokio::sync::Mutex;

pub struct AppState {
    /// The single SQLite connection, guarded by an async mutex. All access is
    /// short and synchronous, so the lock is never held across `.await`.
    pub db: Mutex<Connection>,
    /// Shared HTTP client (connection pooling) for all feed fetching. Held
    /// behind an `RwLock` so the network settings (proxy, timeout) can rebuild
    /// it without an app restart. The lock is only ever held to clone the
    /// (cheap, `Arc`-backed) client out — never across an `.await`.
    pub http: RwLock<Client>,
}

impl AppState {
    /// Clone the current HTTP client out for use.
    pub fn http(&self) -> Client {
        self.http.read().expect("http lock poisoned").clone()
    }
}
