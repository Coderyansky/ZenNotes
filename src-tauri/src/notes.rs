use notify::{event::ModifyKind, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use std::time::SystemTime;
use tauri::{AppHandle, Emitter, Manager};

pub struct WatcherState(pub Mutex<Option<RecommendedWatcher>>);

#[tauri::command]
pub fn start_vault_watch(app: AppHandle, path: String) -> Result<(), String> {
    let state = app.state::<WatcherState>();
    let mut guard = state.0.lock().unwrap();

    // Drop previous watcher first
    *guard = None;

    let app_handle = app.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(event) = res {
            let should_emit = matches!(
                event.kind,
                EventKind::Create(_)
                    | EventKind::Remove(_)
                    | EventKind::Modify(ModifyKind::Name(_))
            );
            if should_emit {
                let _ = app_handle.emit("vault-changed", ());
            }
        }
    })
    .map_err(|e| e.to_string())?;

    watcher
        .watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    *guard = Some(watcher);
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FileNode {
    File {
        id: String,
        name: String,
        path: String,
        modified_at: u64,
        snippet: Option<String>,
    },
    Folder {
        id: String,
        name: String,
        path: String,
        children: Vec<FileNode>,
    },
}

#[tauri::command]
pub fn get_default_vault_path(app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let docs_dir = app.path().document_dir().map_err(|e| e.to_string())?;
    let vault_dir = docs_dir.join("ZenNotesVault");
    let assets_dir = vault_dir.join("assets");
    
    if !vault_dir.exists() {
        std::fs::create_dir_all(&vault_dir).map_err(|e| e.to_string())?;
    }
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    }
    
    Ok(vault_dir.to_string_lossy().to_string())
}

fn build_tree(dir: &Path) -> Result<Vec<FileNode>, String> {
    let mut nodes = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        
        // Skip hidden files/folders and the assets folder
        if name.starts_with('.') || name == "assets" {
            continue;
        }

        if path.is_dir() {
            let children = build_tree(&path)?;
            nodes.push(FileNode::Folder {
                id: path.to_string_lossy().to_string(),
                name,
                path: path.to_string_lossy().to_string(),
                children,
            });
        } else if path.extension().map_or(false, |e| e == "md") {
            let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
            let modified_at = metadata
                .modified()
                .unwrap_or_else(|_| SystemTime::now())
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();

            let content = fs::read_to_string(&path).unwrap_or_default();
            let snippet = Some(content.chars().take(100).collect::<String>());

            nodes.push(FileNode::File {
                id: path.to_string_lossy().to_string(),
                name,
                path: path.to_string_lossy().to_string(),
                modified_at,
                snippet,
            });
        }
    }

    // Sort: Folders first, then files by modified_at descending
    nodes.sort_by(|a, b| match (a, b) {
        (FileNode::Folder { name: name_a, .. }, FileNode::Folder { name: name_b, .. }) => name_a.cmp(name_b),
        (FileNode::Folder { .. }, FileNode::File { .. }) => std::cmp::Ordering::Less,
        (FileNode::File { .. }, FileNode::Folder { .. }) => std::cmp::Ordering::Greater,
        (FileNode::File { modified_at: mod_a, .. }, FileNode::File { modified_at: mod_b, .. }) => mod_b.cmp(mod_a),
    });

    Ok(nodes)
}

#[tauri::command]
pub fn parse_vault(path: &str) -> Result<Vec<FileNode>, String> {
    build_tree(Path::new(path))
}

#[tauri::command]
pub fn read_note_content(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_note_content(path: &str, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_vault(query: &str, path: &str) -> Result<Vec<FileNode>, String> {
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();

    for entry in walkdir::WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() && entry.path().extension().map_or(false, |e| e == "md") {
            let content = fs::read_to_string(entry.path()).unwrap_or_default();
            let file_name = entry.file_name().to_string_lossy().to_string();

            if file_name.to_lowercase().contains(&query_lower) || content.to_lowercase().contains(&query_lower) {
                let file_path = entry.path().to_string_lossy().to_string();
                let metadata = fs::metadata(entry.path()).map_err(|e| e.to_string())?;
                let modified_at = metadata
                    .modified()
                    .unwrap_or_else(|_| SystemTime::now())
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                let snippet = Some(content.chars().take(100).collect::<String>());

                results.push(FileNode::File {
                    id: file_path.clone(),
                    name: file_name,
                    path: file_path,
                    modified_at,
                    snippet,
                });
            }
        }
    }

    results.sort_by(|a, b| {
        if let (FileNode::File { modified_at: am, .. }, FileNode::File { modified_at: bm, .. }) = (a, b) {
            bm.cmp(am)
        } else {
            std::cmp::Ordering::Equal
        }
    });
    
    Ok(results)
}

#[tauri::command]
pub fn save_asset_in_vault(vault_path: &str, name: String, data: Vec<u8>) -> Result<String, String> {
    let assets_dir = Path::new(vault_path).join("assets");
    
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    }
    
    // Generate a unique filename if it exists
    let ext = std::path::Path::new(&name)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("png");
        
    let unique_name = format!("{}_{}.{}", 
        name.replace(&format!(".{}", ext), ""), 
        std::time::SystemTime::now().duration_since(std::time::SystemTime::UNIX_EPOCH).unwrap().as_millis(),
        ext
    );

    let target_path = assets_dir.join(&unique_name);
    std::fs::write(&target_path, data).map_err(|e| e.to_string())?;
    
    // Return relative vault path or just the filename so UI knows what to embed
    Ok(format!("assets/{}", unique_name))
}

#[tauri::command]
pub fn create_folder(path: &str) -> Result<(), String> {
    std::fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_element(vault_path: &str, path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err("File not found".into());
    }

    let trash_dir = Path::new(vault_path).join(".trash");
    if !trash_dir.exists() {
        std::fs::create_dir_all(&trash_dir).map_err(|e| e.to_string())?;
    }

    // append a timestamp to avoid naming collisions in the trash
    let name = p.file_name().unwrap_or_default().to_string_lossy();
    let unique_name = format!("{}_{}", name, SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs());
    let target = trash_dir.join(unique_name);

    std::fs::rename(p, target).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_trash_items(vault_path: &str) -> Result<Vec<FileNode>, String> {
    let trash_dir = Path::new(vault_path).join(".trash");
    if !trash_dir.exists() {
        return Ok(Vec::new());
    }

    let mut nodes = Vec::new();
    let entries = fs::read_dir(trash_dir).map_err(|e| e.to_string())?;

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
        let modified_at = metadata
            .modified()
            .unwrap_or_else(|_| SystemTime::now())
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        if path.is_dir() {
            nodes.push(FileNode::Folder {
                id: path.to_string_lossy().to_string(),
                name,
                path: path.to_string_lossy().to_string(),
                children: vec![],
            });
        } else {
            nodes.push(FileNode::File {
                id: path.to_string_lossy().to_string(),
                name,
                path: path.to_string_lossy().to_string(),
                modified_at,
                snippet: None,
            });
        }
    }

    nodes.sort_by(|a, b| match (a, b) {
        (FileNode::Folder { name: name_a, .. }, FileNode::Folder { name: name_b, .. }) => name_a.cmp(name_b),
        (FileNode::Folder { .. }, FileNode::File { .. }) => std::cmp::Ordering::Less,
        (FileNode::File { .. }, FileNode::Folder { .. }) => std::cmp::Ordering::Greater,
        (FileNode::File { modified_at: mod_a, .. }, FileNode::File { modified_at: mod_b, .. }) => mod_b.cmp(mod_a),
    });

    Ok(nodes)
}

#[tauri::command]
pub fn restore_trash_element(vault_path: &str, trash_path: &str) -> Result<(), String> {
    let p = Path::new(trash_path);
    if !p.exists() {
        return Err("Element not found in trash".into());
    }

    let name = p.file_name().unwrap_or_default().to_string_lossy();
    // remove the timestamp if possible. Format is name_timestamp
    let mut parts: Vec<&str> = name.rsplitn(2, '_').collect();
    let original_name = if parts.len() == 2 { parts[1] } else { &name };

    let target = Path::new(vault_path).join(original_name);
    // Be careful not to overwrite
    let mut final_target = target.clone();
    let mut counter = 1;
    while final_target.exists() {
        let new_name = format!("{}_{}", original_name, counter);
        final_target = Path::new(vault_path).join(new_name);
        counter += 1;
    }

    std::fs::rename(p, final_target).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn empty_trash(vault_path: &str) -> Result<(), String> {
    let trash_dir = Path::new(vault_path).join(".trash");
    if trash_dir.exists() {
        std::fs::remove_dir_all(&trash_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn rename_element(old_path: &str, new_path: &str) -> Result<(), String> {
    std::fs::rename(old_path, new_path).map_err(|e| e.to_string())
}
