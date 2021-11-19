let _canceled = false;

self.addEventListener('message', (e: MessageEvent) => {
    if (!e.data) return;
    switch (e.data.action) {
        case 'export':
            _export(e.data.rows);
            break;
        case 'cancel':
            _canceled = true;
            break;
    }
}, false);

function _export(rows) {
    _canceled = false;
    const rooms = {};
    const rl = rows.length;
    postMessage({ event: 'progress', percent: 0 });
    for (let r = 0; r < rl; r++) {
        if (_canceled) {
            postMessage({ event: 'canceled' });
            return;
        }
        rows[r].ID = parseInt(rows[r].ID, 10);
        if (rooms[rows[r].ID]) {
            if (!rows[r].Exit) continue;
            rooms[rows[r].ID].exits[rows[r].Exit] = {
                num: parseInt(rows[r].DestID, 10),
                isdoor: rows[r].IsDoor,
                isclosed: rows[r].IsClosed
            };
        }
        else {
            rooms[rows[r].ID] = { num: rows[r].ID };
            let prop;
            for (prop in rows[r]) {
                if (prop === 'ID')
                    continue;
                if (!rows[r].hasOwnProperty(prop)) {
                    continue;
                }
                if (_canceled) {
                    postMessage({ event: 'canceled' });
                    return;
                }
                rooms[rows[r].ID][prop.toLowerCase()] = rows[r][prop];
            }
            rooms[rows[r].ID].exits = {};
            if (!rows[r].Exit) continue;
            rooms[rows[r].ID].exits[rows[r].Exit] = {
                num: parseInt(rows[r].DestID, 10),
                isdoor: rows[r].IsDoor,
                isclosed: rows[r].IsClosed
            };
        }
        postMessage({ event: 'progress', percent: Math.floor(r / rl * 100) });
    }
    postMessage({ event: 'complete', rooms: rooms });
}