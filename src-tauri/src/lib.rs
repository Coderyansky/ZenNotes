// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod notes;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .manage(notes::WatcherState(std::sync::Mutex::new(None)))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .setup(|app| {
            use tauri::Manager;
            use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            let _ = apply_vibrancy(
                &window,
                NSVisualEffectMaterial::UnderWindowBackground,
                None,
                None,
            );

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            notes::get_default_vault_path,
            notes::parse_vault,
            notes::read_note_content,
            notes::write_note_content,
            notes::search_vault,
            notes::save_asset_in_vault,
            notes::create_folder,
            notes::delete_element,
            notes::rename_element,
            notes::get_trash_items,
            notes::restore_trash_element,
            notes::empty_trash,
            notes::start_vault_watch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
