//! Lumen — a local-first RSS reader. Tauri application entry point: opens the
//! database, wires shared state, installs the macOS tray, and starts the
//! background refresh scheduler.

mod ai;
mod commands;
mod db;
mod error;
mod extraction;
mod ingestion;
mod models;
mod notify;
mod opml;
mod sanitize;
mod state;
mod sync;

use state::AppState;
use std::fs;
use std::sync::RwLock;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

/// Localised tray-menu labels for the persisted UI language. Defaults to
/// English (the app's fallback language) when no language has been saved yet.
fn tray_labels(lang: &str) -> (&'static str, &'static str) {
    match lang {
        "zh" => ("显示 Lumen", "退出 Lumen"),
        "ja" => ("Lumen を表示", "Lumen を終了"),
        _ => ("Show Lumen", "Quit Lumen"),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            // ── Database ──────────────────────────────────────────────
            let data_dir = app.path().app_data_dir().expect("resolve app data dir");
            fs::create_dir_all(&data_dir).ok();
            let conn = db::open(&data_dir.join("lumen.db")).expect("open database");
            // On the very first launch, subscribe to a curated set of feeds.
            let seeded = db::seed_default_feeds(&conn).unwrap_or(false);
            // The HTTP client honours the persisted proxy / timeout settings.
            let http = RwLock::new(ingestion::fetch::build_client_from_settings(&conn));
            // The tray menu is localised to the saved UI language.
            let lang = db::get_setting(&conn, "language")
                .ok()
                .flatten()
                .unwrap_or_default();

            app.manage(AppState {
                db: tokio::sync::Mutex::new(conn),
                http,
            });

            // ── macOS window vibrancy ─────────────────────────────────
            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
                if let Some(window) = app.get_webview_window("main") {
                    let _ = apply_vibrancy(
                        &window,
                        NSVisualEffectMaterial::Sidebar,
                        None,
                        None,
                    );
                }
            }

            // ── Menu-bar tray (keeps the app resident for refreshes) ──
            let (show_label, quit_label) = tray_labels(&lang);
            let show = MenuItem::with_id(app, "show", show_label, true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", quit_label, true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Lumen")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // ── Background refresh scheduler ──────────────────────────
            ingestion::scheduler::spawn_scheduler(app.handle().clone());

            // After first-run seeding, fetch the default feeds right away.
            if seeded {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = ingestion::scheduler::refresh_all(&handle, None).await;
                });
            }

            // Reflect the current unread count on the Dock badge at launch.
            let badge_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                notify::update_badge(&badge_handle).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_folders,
            commands::create_folder,
            commands::rename_folder,
            commands::delete_folder,
            commands::list_feeds,
            commands::add_feed,
            commands::delete_feed,
            commands::move_feed,
            commands::rename_feed,
            commands::refresh_feeds,
            commands::list_articles,
            commands::get_article,
            commands::mark_read,
            commands::mark_starred,
            commands::mark_read_later,
            commands::mark_all_read,
            commands::smart_counts,
            commands::extract_fulltext,
            commands::import_opml,
            commands::export_opml,
            commands::get_setting,
            commands::set_setting,
            commands::ai_summarize,
            commands::ai_ask,
            commands::ai_digest,
            commands::storage_stats,
            commands::cleanup_articles,
            commands::vacuum_db,
            commands::reset_settings,
            commands::clear_all_data,
            commands::apply_network_settings,
            commands::freshrss_connect,
            commands::freshrss_disconnect,
            commands::freshrss_status,
            commands::freshrss_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lumen");
}
