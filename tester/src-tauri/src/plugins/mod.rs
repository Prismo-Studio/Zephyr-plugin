use std::path::PathBuf;

use serde::{Deserialize, Serialize};

pub mod commands;
pub mod install;
pub mod registry;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RegistryAuthor {
    pub name: String,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PluginType {
    Feature,
    Theme,
    Game,
    Mod,
}

/// Entry as it lives in `registry.json` on the plugins repo.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RegistryEntry {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(rename = "type")]
    pub kind: PluginType,
    pub author: RegistryAuthor,
    pub description: String,
    /// Optional so a plugin author who forgets `icon` doesn't break the whole
    /// registry parse for everyone else. Resolved to a type-specific Iconify
    /// fallback when missing.
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub default_installed: bool,
    #[serde(default = "default_true")]
    pub removable: bool,
    /// Path under the plugins repo where the asset folder lives, e.g.
    /// "themes/neon-pulse". Default empty so locally-loaded entries deserialize
    /// cleanly when the manifest comes straight from disk.
    #[serde(default)]
    pub path: String,
    /// For themes (and other asset-based plugins): filename of the asset under
    /// the plugin folder, e.g. "theme.css". Optional so older registry entries
    /// without it still deserialize.
    #[serde(default)]
    pub entry: Option<String>,

    /// Set when the user loaded this plugin from a local folder via the tester
    /// "Open plugin folder" flow. Install reads from this path instead of
    /// fetching over HTTP. Skipped from JSON (de)serialization so it never
    /// pollutes the registry cache.
    #[serde(skip)]
    pub local_path: Option<PathBuf>,
}

fn default_true() -> bool {
    true
}

/// Plugin entry as exposed to the frontend.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PluginEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub version: String,
    pub icon: String,
    pub kind: PluginType,
    pub built_in: bool,
    pub removable: bool,
    pub enabled: bool,
}

/// Feature ids whose runtime code is shipped in the Zephyr binary. The
/// tester has none — archipelago lives in upstream Zephyr only — so this is
/// empty. Registry entries with kind=feature will report `built_in: false`.
pub const BUILT_IN_FEATURE_IDS: &[&str] = &[];

pub fn is_built_in_feature(entry: &RegistryEntry) -> bool {
    matches!(entry.kind, PluginType::Feature)
        && BUILT_IN_FEATURE_IDS.contains(&entry.id.as_str())
}

/// Used when the network fetch and the local cache both fail (first launch
/// offline, etc.). Returning an empty list means the Plugins page is empty
/// in that degraded state, which makes the dependency on the remote
/// registry visible during testing.
pub fn fallback_registry() -> Vec<RegistryEntry> {
    vec![]
}
