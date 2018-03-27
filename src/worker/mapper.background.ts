/**
 * Back ground mapper processing
 *
 * Process mapper background systems
 * 
 * @author William
 */
self.addEventListener('message', (e: MessageEvent) => {
    if (!e.data) return;
    switch (e.data.action) {
        case 'import':
            //postMessage({ event: 'decoded', file: e.data.file, data: decode(e.data.data), last: e.data.last, download: e.data.download });
            break;
    }
}, false);