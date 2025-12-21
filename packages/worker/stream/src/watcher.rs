use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::{Context, Result};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tokio::sync::mpsc;
use tracing::debug;

pub struct SegmentWatcher {
    rx: mpsc::Receiver<PathBuf>,
    #[allow(dead_code)]
    watcher: RecommendedWatcher,
}

impl SegmentWatcher {
    pub fn new(dir: &Path) -> Result<Self> {
        let (tx, rx) = mpsc::channel(100);
        let seen = std::sync::Arc::new(std::sync::Mutex::new(HashSet::<PathBuf>::new()));

        let tx_clone = tx.clone();
        let seen_clone = seen.clone();

        let mut watcher = notify::recommended_watcher(move |res: Result<Event, _>| {
            if let Ok(event) = res {
                // We're interested in write completions and file creations
                match event.kind {
                    EventKind::Create(_) | EventKind::Modify(_) => {
                        for path in event.paths {
                            // Only handle .ts files
                            if path.extension().is_some_and(|e| e == "ts") {
                                // Debounce: only send once per file
                                let mut seen_guard = seen_clone.lock().unwrap();
                                if !seen_guard.contains(&path) {
                                    // Wait a bit to ensure file is complete
                                    let tx = tx_clone.clone();
                                    let path_clone = path.clone();
                                    seen_guard.insert(path.clone());
                                    drop(seen_guard);

                                    std::thread::spawn(move || {
                                        // Wait for file to be fully written
                                        std::thread::sleep(Duration::from_secs(2));
                                        let _ = tx.blocking_send(path_clone);
                                    });
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
        })
        .context("create file watcher")?;

        watcher
            .watch(dir, RecursiveMode::NonRecursive)
            .with_context(|| format!("watch directory {}", dir.display()))?;

        // Scan for existing files
        let tx_clone = tx.clone();
        let dir_clone = dir.to_path_buf();
        tokio::spawn(async move {
            if let Ok(mut entries) = tokio::fs::read_dir(&dir_clone).await {
                while let Ok(Some(entry)) = entries.next_entry().await {
                    let path = entry.path();
                    if path.extension().is_some_and(|e| e == "ts") {
                        // Check if file is old enough (not currently being written)
                        if let Ok(meta) = tokio::fs::metadata(&path).await {
                            if let Ok(modified) = meta.modified() {
                                if modified.elapsed().unwrap_or_default() > Duration::from_secs(5) {
                                    let should_send = {
                                        let mut seen_guard = seen.lock().unwrap();
                                        if !seen_guard.contains(&path) {
                                            seen_guard.insert(path.clone());
                                            true
                                        } else {
                                            false
                                        }
                                    };
                                    if should_send {
                                        let _ = tx_clone.send(path).await;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        debug!("Watching for segments in {}", dir.display());

        Ok(Self { rx, watcher })
    }

    pub async fn next_segment(&mut self) -> Option<PathBuf> {
        self.rx.recv().await
    }
}
