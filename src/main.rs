use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        ConnectInfo, State,
    },
    headers::{self},
    response::IntoResponse,
    routing::{get, get_service},
    Router, TypedHeader,
};
use futures::{sink::SinkExt, stream::StreamExt};
use state::InputState;
use std::{net::SocketAddr, path::PathBuf};
use tokio::{select, sync::mpsc};
use tower_http::{
    services::ServeDir,
    trace::{DefaultMakeSpan, TraceLayer},
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod state;

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .init();

    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("www");
    let input_state = InputState::new();

    let app = Router::new()
        .nest_service(
            "/",
            get_service(ServeDir::new(path).append_index_html_on_directories(true)),
        )
        .route("/ws", get(ws_handler))
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::default().include_headers(true)),
        )
        .with_state(input_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 5732));
    tracing::info!("listening on {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service_with_connect_info::<SocketAddr>())
        .await
        .unwrap();
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(input_state): State<InputState>,
    user_agent: Option<TypedHeader<headers::UserAgent>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
    let user_agent = if let Some(TypedHeader(user_agent)) = user_agent {
        user_agent.to_string()
    } else {
        String::from("unknown browser")
    };

    tracing::info!("{} at {} connected", user_agent, addr);

    ws.on_upgrade(move |socket| handle_socket(socket, input_state, addr))
}

async fn handle_socket(socket: WebSocket, state: InputState, _: SocketAddr) {
    // if socket.send(Message::Ping(vec![1, 2, 3])).await.is_ok() {
    //     tracing::debug!("pinged {}...", who);
    // } else {
    //     tracing::error!("could not send ping to {}!", who);
    //     return;
    // }

    let (mut sender, mut receiver) = socket.split();
    let (msg_write, mut msg_read) = mpsc::unbounded_channel::<Message>();

    let write_task = async move {
        while let Some(msg) = msg_read.recv().await {
            match sender.send(msg).await.ok() {
                Some(_) => {}
                None => {
                    break;
                }
            }
        }
    };

    let msg_write_handle = msg_write.clone();
    let state_handle = state.clone();

    let read_task = async move {
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(msg) => match msg {
                    Message::Text(msg) => {
                        let chars = msg.chars().collect::<Vec<char>>();

                        match chars.len() {
                            6 => {
                                if chars[0] == 'a' {
                                    msg_write_handle
                                        .send(Message::Text("alive".to_string()))
                                        .ok();
                                }
                            }
                            16 => {
                                if chars[0] == 'b' {
                                    let mut input_handle = state_handle.input.lock();
                                    for (idx, c) in chars[1..15].iter().enumerate() {
                                        input_handle.buttons[idx] = match *c == '1' {
                                            false => 0,
                                            true => 1,
                                        }
                                    }
                                }
                            }
                            _ => {
                                break;
                            }
                        }
                    }
                    Message::Close(_) => {
                        tracing::info!("websocket connection closed!");
                        let mut input_handle = state_handle.input.lock();
                        input_handle.buttons.fill(0);
                        break;
                    }
                    _ => {
                        unimplemented!()
                    }
                },
                Err(e) => {
                    tracing::error!("websocket connection error: {}", e);
                    let mut input_handle = state_handle.input.lock();
                    input_handle.buttons.fill(0);
                    break;
                }
            }
        }
    };

    select! {
        _ = read_task => {}
        _ = write_task => {}
    }
}

// fn process_message(msg: Message, who: SocketAddr) -> ControlFlow<(), ()> {
//     match msg {
//         Message::Text(t) => {
//             tracing::debug!("{} sent str: {:?}", who, t);
//         }
//         Message::Binary(d) => {
//             tracing::debug!("{} sent {} bytes: {:?}", who, d.len(), d);
//         }
//         Message::Close(c) => {
//             if let Some(cf) = c {
//                 tracing::debug!(
//                     "{} sent close with code {} and reason {}",
//                     who,
//                     cf.code,
//                     cf.reason
//                 );
//             } else {
//                 tracing::debug!("{} somehow sent close message without CloseFrame", who);
//             }
//             return ControlFlow::Break(());
//         }
//         Message::Pong(v) => {
//             tracing::debug!("{} sent pong with {:?}", who, v);
//         }
//         Message::Ping(v) => {
//             tracing::debug!("{} sent ping with {:?}", who, v);
//         }
//     }
//     ControlFlow::Continue(())
// }
