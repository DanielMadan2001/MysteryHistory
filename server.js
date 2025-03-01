const WebSocket = require('ws');
const express = require('express');
const app = express();

const port = process.env.PORT || 8080;

const rooms = { };

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws) => {
    console.log('Client connected');
    
    ws.on('message', function incoming(message) {
        const parsedMessage = JSON.parse(message);

        console.log(parsedMessage);
        switch (parsedMessage.type) {
            case ("connection"):
                console.log("Connected from " + parsedMessage.source);
                console.log(rooms);
                if (parsedMessage.pageIndex > 0) {
                    rooms[parsedMessage.roomID]["players"].push(ws);
                    console.log(rooms);
                }
                break;
            case ("createRoom"):    createRoom(ws); break;
            case ("joinRoom"):      joinRoom(ws, parsedMessage.playerName, parsedMessage.roomID); break;
            case ("deleteRoom"):    console.log("deleteRoom"); deleteRoom(ws, parsedMessage.newRoomID); break;
            case ("restartRoom"):   console.log("restartRoom"); restartRoom(ws, parsedMessage.newRoomID); break;
            case ("factsUpdate"):   updateFactsList(ws, parsedMessage.theRoomID, parsedMessage.playerNum, parsedMessage.newFactsList); break;
            default:
                console.log("Got message of type: " + parsedMessage.type);
                break;
        }

        // wss.clients.forEach(function each(client) {
        //     if (client !== ws && client.readyState === WebSocket.OPEN) {
        //         client.send(message);
        //     }
        // });
    });

    const message = { type: "message", messageString: "Hi from server!" };
    ws.send(JSON.stringify(message));
});

function createRoom(ws) {    
    roomID = "";
    while (roomID == "") {
        newID = "";
        for (let i = 0; i < 4; i++) {
            newID += (Math.floor(Math.random() * 10)).toString();
        }
        
        if (!(roomID in rooms)) { 
            roomID = newID;
        }
    }

    rooms[roomID] = {};
    rooms[roomID]["playerNames"] = [];
    rooms[roomID]["players"] = [];
    rooms[roomID]["facts"] = {};
    rooms[roomID]["unity"] = ws;

    rooms[roomID]["unity"].send(JSON.stringify({ type: "roomCreated", newRoomID: roomID }));
    console.log(rooms);
}

function joinRoom(ws, playerName, newID) {
    for (const [key, value] of Object.entries(rooms)) {
        if (key == newID) {
            console.log("Server exists!");
            if (rooms[key]["playerNames"].length >= 12) {
                ws.send(JSON.stringify({ type: 'toggleRedText' }));
                return;
            }
            rooms[key]["playerNames"].push(playerName);
            rooms[key]["facts"][rooms[key]["players"].length] = [];
            // rooms[key]["players"].push(ws);
            console.log(rooms);
            ws.send(JSON.stringify({ 
                type: 'redirect', 
                playerNumber: rooms[key]["players"].length, 
                roomID: key, 
                url: 'factSubmission.html' 
            }));

            rooms[key]["unity"].send(JSON.stringify({ 
                type: 'playerJoined', 
                newPlayerName: playerName,
                playerNumber: rooms[key]["players"].length
            }));
            return;
        }
      }
    // console.log(rooms);
    ws.send(JSON.stringify({ type: 'toggleRedText' }));
}

function deleteRoom(ws, newRoomID) {
    sendUsersToPage(newRoomID, "roomClosed");
    delete rooms[newRoomID];
    console.log(rooms);
}

function restartRoom(ws, newRoomID) { 
    sendUsersToPage(newRoomID, "roomRestarted");
    rooms[roomID]["playerNames"] = [];
    rooms[roomID]["players"] = [];
    rooms[roomID]["facts"] = {};
    console.log(rooms);
}

function sendUsersToPage(roomID, nextPage="index") {

    if (!(roomID in rooms)) {
        return;
    }
    rooms[roomID]["players"].forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ 
                type: 'redirect', 
                url: `${nextPage}.html` 
            }));
        }
    });
}

function updateFactsList(ws, roomID, playerNum, newFactsList) {
    rooms[roomID]["facts"][playerNum] = newFactsList;
    rooms[roomID]["unity"].send(JSON.stringify({ type: "updateFacts", playerNumber: playerNum, factsList: newFactsList }));
}

app.server = app.listen(port, () => {
    console.log(`Server listening on ws://localhost:${port}`);
});

app.server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});
