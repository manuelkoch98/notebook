use serde::Serialize;
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Serialize)]
pub struct AvailableUpdate {
    version: String,
    notes: Option<String>,
}

async fn available_update(app: &AppHandle) -> Result<Option<Update>, String> {
    if cfg!(debug_assertions) {
        return Ok(None);
    }
    let updater = app.updater_builder().timeout(Duration::from_secs(60));
    let request = updater.build().map_err(|_| "Die Update-Suche konnte nicht gestartet werden.")?;
    request.check().await.map_err(|_| "Die Update-Suche ist gerade nicht verfügbar.".to_string())
}

#[tauri::command]
pub async fn check_app_update(app: AppHandle) -> Result<Option<AvailableUpdate>, String> {
    Ok(available_update(&app).await?.map(|update| AvailableUpdate {
        version: update.version,
        notes: update.body,
    }))
}

#[tauri::command]
pub async fn install_app_update(app: AppHandle, version: String) -> Result<(), String> {
    let update = available_update(&app).await?.ok_or("Es ist kein Update mehr verfügbar.")?;
    if update.version != version {
        return Err("Es gibt inzwischen eine andere Version. Suche erneut nach Updates.".into());
    }
    update.download_and_install(|_, _| {}, || {}).await
        .map_err(|_| "Das Update konnte nicht installiert werden.".to_string())?;
    app.restart();
}
