import express from "express";
import expressWs from "express-ws";
import * as ffi from "ffi-napi";
import * as os from "os";
import StructType from "ref-struct-napi";

const app = express();
const appWs = expressWs(app);

const arch = os.arch();

let Input = StructType({
    type: "int",
    padding: "int",
    wVK: "short",
    mScan: "short",
    dwFlags: "int",
    time: "int",
    dwExtraInfo: "int64",
});

let user32 = ffi.Library("user32", {
    SendInput: ["int", ["int", Input, "int"]],
    MapVirtualKeyExA: ["uint", ["uint", "uint", "int"]],
});

const extendedKeyPrefix = 0xe000;
const INPUT_KEYBOARD = 1;
const KEYEVENTF_EXTENDEDKEY = 0x0001;
const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_UNICODE = 0x0003;
const KEYEVENTF_SCANCODE = 0x0004;

export class KeyToggleOptions {
    asScanCode = true;
    keyCodeIsScanCode = false;
    flags?: number;
    async = true;
}

let entry = new Input();
entry.type = INPUT_KEYBOARD;
entry.time = 0;
entry.dwExtraInfo = 0;

export function KeyToggle(keyCode: number, type = "down" as "down" | "up", options?: Partial<KeyToggleOptions>) {
    const opt = Object.assign({}, new KeyToggleOptions(), options);

    if (opt.asScanCode) {
        let scanCode = opt.keyCodeIsScanCode ? keyCode : ConvertKeyCodeToScanCode(keyCode);
        let isExtendedKey = (scanCode & extendedKeyPrefix) == extendedKeyPrefix;

        entry.dwFlags = KEYEVENTF_SCANCODE;

        if (isExtendedKey) {
            entry.dwFlags |= KEYEVENTF_EXTENDEDKEY;
        }

        entry.wVK = 0;
        entry.wScan = isExtendedKey ? scanCode - extendedKeyPrefix : scanCode;
    }

    if (opt.flags != null) {
        entry.dwFlags = opt.flags;
    }

    if (type === "up") {
        entry.dwFlags |= KEYEVENTF_KEYUP;
    }

    if (opt.async) {
        return new Promise((resolve, reject) => {
            user32.SendInput.async(1, entry, arch === "x64" ? 40 : 28, (error: any, result: unknown) => {
                if (error) {
                    reject(error);
                }
                resolve(result);
            })
        })
    }

    return user32.SendInput(1, entry, arch === "x64" ? 40 : 28);
}

export function KeyTap(keyCode: number, opt?: Partial<KeyToggleOptions>) {
    KeyToggle(keyCode, "down", opt);
    KeyToggle(keyCode, "up", opt);
}

export function ConvertKeyCodeToScanCode(keyCode: number) {
    return user32.MapVirtualKeyExA(keyCode, 0, 0);
}

app.listen(5732, "0.0.0.0", () => {
    console.log("application started and listening on port 5732");
})

app.use(express.static(__dirname + "/src/www/"));

app.get("/", (_: any, res: { sendFile: (arg0: string) => void; }) => {
    res.sendFile(__dirname + "/src/www/app.html");
})

appWs.app.ws("/ws", (ws: any, _: any) => {
    ws.on("message", (msg: string) => {
        if (msg === "alive?") {
            ws.send("alive");
        }

        if (msg[0] === "b") {
            // process key
            // send key according to keycode
            // https://github.com/node-ffi-napi/node-ffi-napi is a viable solution
            let keyFlag = parseInt(msg.substring(1));
            if (keyFlag >= 0 && keyFlag <= 4) {
                KeyTap(keyFlag + 49);
            } else {
                KeyTap((keyFlag - 4) + 65);
            }
        }
    })
})