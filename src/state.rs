use parking_lot::Mutex;
use std::sync::Arc;

#[derive(Debug, Default)]
pub struct Input {
    pub buttons: [u8; 16],
    pub extra: [u8; 3],
}

impl Input {
    pub fn new() -> Self {
        Self {
            buttons: [0; 16],
            extra: [0; 3],
        }
    }

    pub fn to_flat(&self) -> Vec<bool> {
        self.buttons
            .iter()
            .map(|x| x > &0)
            .chain(self.extra.iter().map(|x| x > &0))
            .collect()
    }
}

pub struct InputState {
    pub input: Arc<Mutex<Input>>,
}

impl InputState {
    pub fn new() -> Self {
        Self {
            input: Arc::new(Mutex::new(Input::new())),
        }
    }

    pub fn snapshot(&self) -> Vec<u8> {
        let mut buf: Vec<u8> = vec![];

        let input_handle = self.input.lock();
        buf.extend(input_handle.buttons);
        buf.extend(input_handle.extra);

        buf
    }
}

impl Clone for InputState {
    fn clone(&self) -> Self {
        Self {
            input: Arc::clone(&self.input),
        }
    }
}
