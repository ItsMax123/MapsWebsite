use axum::extract::State;
use axum::response::Html;
use axum::routing::get;
use axum::Router;
use std::fs;
use std::sync::Arc;
use tower_http::services::ServeDir;

type MapState = State<Arc<Views>>;

struct Views {
    pub index: Html<String>,
    pub map: Html<String>,
}

#[tokio::main]
async fn main() {
    let index_template = fs::read_to_string("public/index.html").unwrap();
    let map_template = fs::read_to_string("public/map.html").unwrap();

    let state: Arc<Views> = Arc::new(Views {
        index: Html(index_template.replace("{{maps}}", &maps())),
        map: Html(map_template),
    });

    let router = Router::new()
        .nest_service("/assets", ServeDir::new("public/assets"))
        .route("/", get(index))
        .route("/map/{id}", get(map))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:80").await.unwrap();
    axum::serve(listener, router).await.unwrap();
}

async fn index(State(state): MapState) -> Html<String> {
    state.index.clone()
}

async fn map(State(state): MapState) -> Html<String> {
    state.map.clone()
}

fn maps() -> String {
    let mut maps = String::new();
    if let Ok(entries) = fs::read_dir("public/assets/maps") {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(folder) = path.file_name().and_then(|n| n.to_str()) {
                    maps.push_str(&format!(
                        "<tr><td><a href='/map/{}'>{}</a></td></tr>",
                        folder, folder
                    ));
                }
            }
        }
    }
    maps
}