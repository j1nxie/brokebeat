let keys = document.getElementsByClassName('key');
let allKeys = [];
let memo = [];

function compileKey(key) {
    const prev = key.previousElementSibling;
    const next = key.nextElementSibling;
    return {
        top: key.offsetTop,
        bottom: key.offsetTop + key.offsetHeight,
        left: key.offsetLeft,
        right: key.offsetLeft + key.offsetWidth,
        almostLeft: !!prev ? key.offsetLeft + key.offsetWidth / 4 : -99999,
        almostRight: !!next ? key.offsetLeft + (key.offsetWidth * 3) / 4 : -99999,
        kflag: parseInt(key.dataset.kflag),
        prevKeyRef: prev,
        prevKeyKflag: prev ? parseInt(prev.dataset.kflag) : null,
        nextKeyRef: next,
        nextKeyKflag: next ? parseInt(next.dataset.kflag) : null,
        ref: key
    };
}

function isInside(x, y, compiledKey) {
    return (
        compiledKey.left <= x &&
        x < compiledKey.right &&
        compiledKey.top <= y &&
        y < compiledKey.bottom
    );
}

function getKey(x, y) {
    let res = memo[x];
    if (res === undefined) {
        for (const key of allKeys) {
            if (isInside(x, y, key)) {
                res = key;
                break;
            }
        }
        memo[x] = res;
    }
    return res;
}

function compileKeys() {
    keys = document.getElementsByClassName('key');

    for (const key of keys) {
        const compiledKey = compileKey(key);
        allKeys.push(compiledKey);
    }

    for (let i = 0; i < window.outerWidth; i++) {
        getKey(i, allKeys[0].top);
    }
}

let lastState = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function updateTouches(e) {
    try {
        e.preventDefault();
        let keyFlags = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

        for (const touch of e.touches) {
            const x = touch.clientX;
            const y = touch.clientY;

            const key = getKey(x, y);

            if (!key) {
                continue;
            }

            setKey(keyFlags, key.kflag);

            if (x < key.almostLeft) {
                setKey(keyFlags, key.prevKeyKflag);
            }

            if (key.almostRight < x) {
                setKey(keyFlags, key.nextKeyKflag);
            }
        }

        for (const key of allKeys) {
            if (keyFlags[key.kflag] !== lastState[key.kflag]) {
                if (keyFlags[key.kflag]) {
                    key.ref.setAttribute('data-active', '');
                } else {
                    key.ref.removeAttribute('data-active');
                }
            }
        }

        lastState = keyFlags;
    } catch (err) {
        alert(err);
    }
}

function setKey(keyFlags, kflag) {
    let idx = kflag;
    keyFlags[idx] = 1;
}

let ws = null;
let wsTimeout = 0;
let wsConnected = false;

function wsConnect() {
    ws = new WebSocket('ws://' + location.host + '/ws');
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
        ws?.send('alive?');
    };

    ws.onmessage = (e) => {
        if (e.data == 'alive') {
            wsTimeout = 0;
            wsConnected = true;
        }
    };
}

function wsWatch() {
    if (wsTimeout++ >= 2) {
        wsTimeout = 0;
        ws?.close();
        wsConnected = false;
        wsConnect();
        return;
    }

    if (wsConnected) {
        ws?.send('alive?');
    }
}

function sendKeys(keyFlags) {
    if (wsConnected) {
        ws.send('b' + keyFlags.join(''));
    }
}

const fs = document.getElementById('fullscreen');

function requestFullScreen() {
    if (!document.fullscreenElement && screen.height <= 1024) {
        if (fs?.requestFullscreen) {
            fs.requestFullscreen();
        }
    }
}

const cnt = document.getElementById("main");

cnt.addEventListener("touchstart", updateTouches);
cnt.addEventListener("touchmove", updateTouches);
cnt.addEventListener("touchend", updateTouches);

function initialize() {
    compileKeys();
    wsConnect();
    setInterval(wsWatch, 1000);
}

initialize();

window.onresize = compileKeys;