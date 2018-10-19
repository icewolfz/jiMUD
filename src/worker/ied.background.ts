/**
 * IED decode/encoder
 *
 * Encode/decode text blocks in background thread
 * @author William
 */
self.addEventListener('message', (e: MessageEvent) => {
    if (!e.data) return;
    switch (e.data.action) {
        case 'decode-dir':
            postMessage({ event: 'decoded-dir', path: e.data.path, data: decode(e.data.data), tag: e.data.tag, local: e.data.local });
            break;
        case 'decode':
            postMessage({ event: 'decoded', file: e.data.file, data: decode(e.data.data), last: e.data.last, download: e.data.download });
            break;
        case 'encode':
            postMessage({ event: 'encoded', file: e.data.file, data: encode(e.data.data), last: e.data.last, download: e.data.download, compressed: e.data.compress });
            break;
    }
}, false);

function decode(data: string) {
    let decoded: string[];
    let c;
    if (!data || data.length === 0)
        return '';
    decoded = [];
    const dl = data.length;
    for (let d = 0; d < dl; d++) {
        c = data.charAt(d);
        if (c === '@') {
            decoded.push(String.fromCharCode(parseInt(data.substr(d + 1, 2), 16)));
            d += 2;
        }
        else
            decoded.push(c);
    }

    return decoded.join('');
}

function encode(data: string) {
    let encoded: string[];
    let c;
    let i;
    if (!data || data.length === 0)
        return '';

    encoded = [];
    const dl = data.length;
    for (let d = 0; d < dl; d++) {
        c = data.charAt(d);
        i = data.charCodeAt(d);
        if (i <= 32 || i >= 127 || c === '@' || c === '^' || c === '\\' || c === '/') {
            c = i.toString(16);
            if (c.length === 1)
                c = '0' + c;
            c = '@' + c;
        }
        encoded.push(c);
    }
    return encoded.join('');
}
