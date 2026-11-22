#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use keyring::Entry;
use rand::{distributions::Alphanumeric, Rng};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{io::{Read, Write}, net::TcpListener, time::{Duration, SystemTime, UNIX_EPOCH}};
use url::Url;

const SERVICE: &str = "com.manuelkoch98.atelier.chatgpt";
const AUTH_URL: &str = "https://auth.openai.com/api/accounts/authorize";
const TOKEN_URL: &str = "https://auth.openai.com/api/accounts/oauth/token";
const API_URL: &str = "https://api.openai.com/v1";
const CALLBACK_PATH: &str = "/auth/callback";
const REQUIRED_SCOPE: &str = "chatgpt.tokens.use.direct";

#[derive(Clone, Serialize, Deserialize)]
struct Credentials {
    client_id: String,
    access_token: String,
    refresh_token: String,
    id_token: String,
    email: String,
    subject: String,
    host_id: String,
    scopes: Vec<String>,
    expires_at: u64,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    id_token: String,
    expires_in: u64,
    scope: Option<String>,
}

#[derive(Deserialize)]
struct IdClaims {
    iss: String,
    sub: String,
    email: Option<String>,
    nonce: Option<String>,
}

#[derive(Deserialize)]
struct Discovery { jwks_uri: String }
#[derive(Deserialize)]
struct Jwks { keys: Vec<Jwk> }
#[derive(Deserialize)]
struct Jwk { kid: String, kty: String, n: String, e: String }

#[derive(Serialize)]
struct ChatStatus { connected: bool, email: Option<String>, plan_enabled: bool, desktop: bool }

#[derive(Deserialize)]
struct ChatTurn { role: String, content: String }

fn entry(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, key).map_err(|e| format!("Der sichere Anmeldespeicher ist nicht verfügbar: {e}"))
}

fn load_credentials() -> Result<Option<Credentials>, String> {
    match entry("account")?.get_password() {
        Ok(value) => serde_json::from_str(&value).map(Some).map_err(|e| format!("Die gespeicherte ChatGPT-Verbindung ist ungültig: {e}")),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("ChatGPT-Verbindung konnte nicht gelesen werden: {error}")),
    }
}

fn save_credentials(credentials: &Credentials) -> Result<(), String> {
    let value = serde_json::to_string(credentials).map_err(|e| e.to_string())?;
    entry("account")?.set_password(&value).map_err(|e| format!("ChatGPT-Verbindung konnte nicht sicher gespeichert werden: {e}"))
}

fn current_time() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() }
fn random_secret(length: usize) -> String {
    rand::thread_rng().sample_iter(&Alphanumeric).take(length).map(char::from).collect()
}

fn get_host_id() -> Result<String, String> {
    let host_entry = entry("host-id")?;
    match host_entry.get_password() {
        Ok(value) => Ok(value),
        Err(keyring::Error::NoEntry) => {
            let value = format!("urn:uuid:{}", uuid::Uuid::new_v4());
            host_entry.set_password(&value).map_err(|e| format!("Desktop-Kennung konnte nicht gespeichert werden: {e}"))?;
            Ok(value)
        }
        Err(error) => Err(format!("Desktop-Kennung konnte nicht gelesen werden: {error}")),
    }
}

fn validate_id_token(token: &str, client_id: &str, nonce: &str) -> Result<IdClaims, String> {
    let header = decode_header(token).map_err(|_| "OpenAI hat ein ungültiges Anmeldetoken zurückgegeben.".to_string())?;
    if header.alg != Algorithm::RS256 { return Err("OpenAI hat einen nicht unterstützten Signaturalgorithmus zurückgegeben.".into()); }
    let kid = header.kid.ok_or("OpenAI-Anmeldetoken enthält keinen Signaturschlüssel.")?;
    let client = Client::builder().timeout(Duration::from_secs(15)).build().map_err(|e| e.to_string())?;
    let discovery: Discovery = client.get("https://auth.openai.com/.well-known/openid-configuration").send().and_then(|r| r.error_for_status()).and_then(|r| r.json()).map_err(|_| "OpenAI-Anmeldedaten konnten nicht überprüft werden.".to_string())?;
    let jwks: Jwks = client.get(discovery.jwks_uri).send().and_then(|r| r.error_for_status()).and_then(|r| r.json()).map_err(|_| "OpenAI-Signaturschlüssel konnten nicht geladen werden.".to_string())?;
    let key = jwks.keys.into_iter().find(|key| key.kid == kid && key.kty == "RSA").ok_or("Passender OpenAI-Signaturschlüssel wurde nicht gefunden.")?;
    let decoding_key = DecodingKey::from_rsa_components(&key.n, &key.e).map_err(|_| "OpenAI-Signaturschlüssel ist ungültig.".to_string())?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&["https://auth.openai.com"]);
    validation.set_audience(&[client_id]);
    let claims = decode::<IdClaims>(token, &decoding_key, &validation).map_err(|_| "OpenAI-Anmeldung konnte nicht kryptografisch überprüft werden.".to_string())?.claims;
    if claims.iss != "https://auth.openai.com" || claims.nonce.as_deref() != Some(nonce) {
        return Err("OpenAI-Anmeldung hat die erwartete Identität nicht bestätigt.".into());
    }
    Ok(claims)
}

fn callback(listener: &TcpListener, expected_state: &str) -> Result<(String, Option<String>, Option<String>), String> {
    let (mut stream, _) = match listener.accept() {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => return Err("__WAIT__".into()),
        Err(_) => return Err("Anmeldung abgelaufen. Bitte erneut verbinden.".to_string()),
    };
    stream.set_read_timeout(Some(Duration::from_secs(15))).ok();
    let mut request = [0u8; 8192];
    let count = stream.read(&mut request).map_err(|_| "OpenAI-Anmeldeantwort konnte nicht gelesen werden.".to_string())?;
    let first_line = String::from_utf8_lossy(&request[..count]).lines().next().unwrap_or("").to_string();
    let path = first_line.split_whitespace().nth(1).ok_or("OpenAI-Anmeldeantwort war ungültig.")?;
    let url = Url::parse(&format!("http://127.0.0.1{path}")).map_err(|_| "OpenAI-Anmeldeantwort war ungültig.")?;
    let params: std::collections::HashMap<String, String> = url.query_pairs().into_owned().collect();
    let response_body = "<html><meta charset=\"utf-8\"><title>atelier</title><body style=\"font:16px system-ui;max-width:560px;margin:12vh auto;padding:24px;color:#222\"><h2>Anmeldung abgeschlossen</h2><p>Du kannst dieses Fenster schließen und zu atelier zurückkehren.</p></body></html>";
    let reply = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", response_body.len(), response_body);
    let _ = stream.write_all(reply.as_bytes());
    if params.get("state").map(String::as_str) != Some(expected_state) { return Err("OpenAI-Anmeldung konnte nicht sicher zugeordnet werden. Bitte erneut versuchen.".into()); }
    if let Some(error) = params.get("error") { return Err(if error == "access_denied" { "ChatGPT-Abo-Nutzung wurde nicht freigegeben.".into() } else { "OpenAI-Anmeldung wurde abgebrochen.".into() }); }
    let code = params.get("code").cloned().ok_or("OpenAI hat keinen Anmeldecode zurückgegeben.")?;
    Ok((code, params.get("client_id").cloned(), params.get("scope").cloned()))
}

#[tauri::command]
fn chatgpt_status() -> Result<ChatStatus, String> {
    let credentials = load_credentials()?;
    Ok(match credentials {
        Some(credentials) => ChatStatus { connected: true, email: Some(credentials.email), plan_enabled: credentials.scopes.iter().any(|scope| scope == REQUIRED_SCOPE), desktop: true },
        None => ChatStatus { connected: false, email: None, plan_enabled: false, desktop: true },
    })
}

#[tauri::command]
fn chatgpt_disconnect() -> Result<(), String> {
    match entry("account")?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("ChatGPT-Verbindung konnte nicht entfernt werden: {error}")),
    }
}

#[tauri::command]
fn chatgpt_connect() -> Result<ChatStatus, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|_| "Lokaler Anmeldeanschluss konnte nicht geöffnet werden.".to_string())?;
    listener.set_nonblocking(true).ok();
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}{CALLBACK_PATH}");
    let state = random_secret(40);
    let nonce = random_secret(40);
    let verifier = random_secret(64);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let host_id = get_host_id()?;
    let saved = load_credentials()?;
    let registering = saved.is_none();
    let mut authorize = Url::parse(AUTH_URL).map_err(|e| e.to_string())?;
    {
        let mut query = authorize.query_pairs_mut();
        query.append_pair("client_id", saved.as_ref().map(|value| value.client_id.as_str()).unwrap_or("dynamic_agent_client"));
        query.append_pair("response_type", "code");
        query.append_pair("redirect_uri", &redirect_uri);
        query.append_pair("scope", "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct");
        query.append_pair("resource", API_URL);
        query.append_pair("state", &state);
        query.append_pair("nonce", &nonce);
        query.append_pair("code_challenge_method", "S256");
        query.append_pair("code_challenge", &challenge);
        query.append_pair("ext_agent_host_id", &host_id);
        if registering { query.append_pair("agent_name_hint", "atelier"); }
        if let Some(credentials) = &saved {
            query.append_pair("id_token_hint", &credentials.id_token);
            if !credentials.email.is_empty() { query.append_pair("login_hint", &credentials.email); }
        }
    }
    open::that(authorize.as_str()).map_err(|_| "Dein Browser konnte nicht geöffnet werden. Öffne die Anmeldung erneut in atelier.".to_string())?;
    let started = std::time::Instant::now();
    let (code, callback_client_id, callback_scopes) = loop {
        match callback(&listener, &state) {
            Ok(result) => break result,
            Err(error) if error.contains("abgelaufen") => return Err(error),
            Err(error) if error == "__WAIT__" => {
                if started.elapsed() > Duration::from_secs(300) { return Err("Anmeldung abgelaufen. Bitte erneut verbinden.".into()); }
                std::thread::sleep(Duration::from_millis(150));
            }
            Err(error) => return Err(error),
        }
    };
    let client_id = if registering {
        callback_client_id.ok_or("OpenAI hat die Registrierung nicht abgeschlossen.".to_string())?
    } else {
        let expected = saved.as_ref().unwrap().client_id.clone();
        if callback_client_id.as_ref().is_some_and(|id| id != &expected) { return Err("OpenAI hat eine andere Anmeldeverbindung zurückgegeben. Bitte erneut anmelden.".into()); }
        expected
    };
    let form = [
        ("grant_type", "authorization_code".to_string()), ("client_id", client_id.clone()),
        ("code", code), ("code_verifier", verifier), ("redirect_uri", redirect_uri), ("resource", API_URL.to_string()),
    ];
    let client = Client::builder().timeout(Duration::from_secs(30)).build().map_err(|e| e.to_string())?;
    let token_response = client.post(TOKEN_URL).form(&form).send().and_then(|response| response.error_for_status()).and_then(|response| response.json::<TokenResponse>()).map_err(|_| "OpenAI konnte die Anmeldung nicht abschließen. Bitte versuche es erneut.".to_string())?;
    let claims = validate_id_token(&token_response.id_token, &client_id, &nonce)?;
    let scopes = token_response.scope.or(callback_scopes).unwrap_or_default().split_whitespace().map(str::to_string).collect::<Vec<_>>();
    if !scopes.iter().any(|scope| scope == REQUIRED_SCOPE) { return Err("Die Anmeldung war erfolgreich, aber die Freigabe zur Nutzung deines ChatGPT-Abos fehlt. Verbinde ChatGPT erneut und erlaube die Abo-Nutzung.".into()); }
    let credentials = Credentials {
        client_id, access_token: token_response.access_token,
        refresh_token: token_response.refresh_token.or_else(|| saved.as_ref().map(|value| value.refresh_token.clone())).ok_or("OpenAI hat kein erneuerbares Anmeldetoken bereitgestellt.".to_string())?,
        id_token: token_response.id_token, email: claims.email.unwrap_or_default(), subject: claims.sub,
        host_id, scopes, expires_at: current_time() + token_response.expires_in,
    };
    save_credentials(&credentials)?;
    Ok(ChatStatus { connected: true, email: Some(credentials.email), plan_enabled: true, desktop: true })
}

fn refreshed_credentials() -> Result<Credentials, String> {
    let mut credentials = load_credentials()?.ok_or("Verbinde zuerst dein ChatGPT-Abo.".to_string())?;
    if !credentials.scopes.iter().any(|scope| scope == REQUIRED_SCOPE) { return Err("Die ChatGPT-Abo-Nutzung ist nicht freigegeben. Verbinde dein Konto erneut.".into()); }
    if credentials.expires_at > current_time() + 90 { return Ok(credentials); }
    let client = Client::builder().timeout(Duration::from_secs(30)).build().map_err(|e| e.to_string())?;
    let form = [
        ("grant_type", "refresh_token"), ("client_id", credentials.client_id.as_str()),
        ("refresh_token", credentials.refresh_token.as_str()), ("resource", API_URL),
    ];
    let response = client.post(TOKEN_URL).form(&form).send().and_then(|response| response.error_for_status()).and_then(|response| response.json::<TokenResponse>()).map_err(|_| "ChatGPT-Verbindung abgelaufen. Bitte verbinde dein Konto erneut.".to_string())?;
    if let Some(scopes) = response.scope { credentials.scopes = scopes.split_whitespace().map(str::to_string).collect(); }
    if !credentials.scopes.iter().any(|scope| scope == REQUIRED_SCOPE) { return Err("OpenAI hat die Freigabe zur Nutzung des ChatGPT-Abos widerrufen. Verbinde dein Konto erneut.".into()); }
    credentials.access_token = response.access_token;
    credentials.refresh_token = response.refresh_token.unwrap_or(credentials.refresh_token);
    credentials.id_token = response.id_token;
    credentials.expires_at = current_time() + response.expires_in;
    save_credentials(&credentials)?;
    Ok(credentials)
}

#[tauri::command]
fn chatgpt_respond(question: String, context: String, history: Vec<ChatTurn>) -> Result<String, String> {
    if question.trim().is_empty() { return Err("Schreib zuerst eine Frage.".into()); }
    let credentials = refreshed_credentials()?;
    let mut input: Vec<serde_json::Value> = history.into_iter().filter(|turn| turn.role == "user" || turn.role == "assistant").rev().take(10).collect::<Vec<_>>().into_iter().rev().map(|turn| serde_json::json!({"role": turn.role, "content": turn.content})).collect();
    let prompt = if context.trim().is_empty() {
        question
    } else {
        format!("Beantworte die Frage anhand des folgenden persönlichen Wissensgartens. Verweise bei Aussagen auf die Quellenpfade in eckigen Klammern. Wenn die Notizen keine Antwort enthalten, sag das offen.\n\nKONTEXT AUS DEM VAULT:\n{}\n\nFRAGE:\n{}", context, question)
    };
    input.push(serde_json::json!({"role":"user","content":prompt}));
    let client = Client::builder().timeout(Duration::from_secs(120)).build().map_err(|e| e.to_string())?;
    let response = client.post(format!("{API_URL}/responses")).bearer_auth(credentials.access_token)
        .json(&serde_json::json!({"model":"gpt-6.2-sol","input":input,"store":false,"stream":true}))
        .send().map_err(|_| "Keine Verbindung zu OpenAI. Prüfe deine Internetverbindung und versuche es erneut.".to_string())?;
    let status = response.status();
    let body = response.text().map_err(|_| "OpenAI-Antwort konnte nicht gelesen werden.".to_string())?;
    if !status.is_success() {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&body) {
            let code = value.pointer("/error/code").and_then(|v| v.as_str()).unwrap_or("");
            if code == "subscription_sharing_usage_limit_exceeded" { return Err("Das Nutzungslimit für atelier ist erreicht. Es wurde keine kostenpflichtige API verwendet.".into()); }
            if code == "subscription_sharing_user_not_eligible" { return Err("Dieses ChatGPT-Konto kann die Abo-Nutzung in atelier derzeit nicht freigeben.".into()); }
        }
        return Err(format!("OpenAI hat die Anfrage abgelehnt (HTTP {}). Es wurde keine kostenpflichtige API verwendet.", status.as_u16()));
    }
    let mut answer = String::new();
    let mut completed = false;
    for event in body.split("\n\n") {
        let data = event.lines().filter_map(|line| line.strip_prefix("data: ")).collect::<Vec<_>>().join("\n");
        if data.is_empty() || data == "[DONE]" { continue; }
        let value: serde_json::Value = match serde_json::from_str(&data) { Ok(value) => value, Err(_) => continue };
        match value.get("type").and_then(|v| v.as_str()).unwrap_or("") {
            "response.output_text.delta" => if let Some(delta) = value.get("delta").and_then(|v| v.as_str()) { answer.push_str(delta); },
            "response.completed" => completed = true,
            "response.failed" => return Err("OpenAI konnte keine Antwort erstellen. Es wurde keine kostenpflichtige API verwendet.".into()),
            _ => (),
        }
    }
    if !completed { return Err("Die Antwort wurde unterbrochen. Bitte versuche es erneut.".into()); }
    Ok(answer)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![chatgpt_status, chatgpt_connect, chatgpt_disconnect, chatgpt_respond])
        .run(tauri::generate_context!())
        .expect("atelier could not start");
}
