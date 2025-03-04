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

        // console.log(parsedMessage);
        switch (parsedMessage.type) {
            case ("connection"):
                console.log("Connected from " + parsedMessage.source);
                console.log(rooms);
                if (parsedMessage.pageIndex > 0) {
                    rooms[parsedMessage.roomID]["players"].push(ws);
                    console.log(rooms);
                }
                if (parsedMessage.pageIndex == 1) {
                    // console.log(rooms[parsedMessage.roomID]["facts"]);
                    const message = { type: "getFacts", factsList: rooms[parsedMessage.roomID]["facts"][parsedMessage.playerNum] };
                    ws.send(JSON.stringify(message));

                    rooms[parsedMessage.roomID]["tempPlayers"].push(ws);
                    if (parsedMessage.playerValue == rooms[parsedMessage.roomID]["playerNames"].length) {
                        rooms[parsedMessage.roomID]["players"] = rooms[parsedMessage.roomID]["tempPlayers"];
                    }
                }
                else if (parsedMessage.pageIndex == 2) {
                    console.log("send player names to player " + parsedMessage.playerNum);
                    
                    console.log(rooms[parsedMessage.roomID]);
                    rooms[parsedMessage.roomID]["tempPlayers"].push(ws);
                    if (parsedMessage.playerValue == rooms[parsedMessage.roomID]["playerNames"].length) {
                        rooms[parsedMessage.roomID]["players"] = rooms[parsedMessage.roomID]["tempPlayers"];
                    }
                    console.log(rooms[parsedMessage.roomID]);
                    const message = { type: "getPlayerNames", playerNames: rooms[parsedMessage.roomID]["playerNames"] };
                    ws.send(JSON.stringify(message));
                }
                break;
            case ("createRoom"):            createRoom(ws); break;
            case ("joinRoom"):              joinRoom(ws, parsedMessage.playerName, parsedMessage.roomID); break;
            case ("deleteRoom"):            console.log("deleteRoom"); deleteRoom(ws, parsedMessage.newRoomID); break;
            case ("restartRoom"):           console.log("restartRoom"); restartRoom(ws, parsedMessage.newRoomID); break;
            case ("openSubmissionScreen"):  
                updateRoomState(parsedMessage.newRoomID, false, true, false);
                if (parsedMessage.changePage) {
                    rooms[roomID]["tempPlayers"] = [];
                    sendUsersToPage(parsedMessage.newRoomID, "factSubmission", true);
                }
                break;
            case ("openQuizScreen"):        
                rooms[roomID]["tempPlayers"] = [];
                sendUsersToPage(parsedMessage.newRoomID, "game", true); 
                break;
                // updateRoomState(parsedMessage.roomID, false, false, false); 
                break;
            case ("startQuiz"):             updateRoomState(parsedMessage.roomID, false, false, true);  break;
            case ("factsUpdate"):           updateFactsList(ws, parsedMessage.theRoomID, parsedMessage.playerNum, parsedMessage.newFactsList); break;
            case ("quizButton"):            quizButton(parsedMessage.theRoomID, parsedMessage.playerNum, parsedMessage.buttonIndex);
            case ("quizNewRound"):          console.log(rooms[parsedMessage.theRoomID]["players"]); quizNewRound(parsedMessage.theRoomID); break;                
            default:
                console.log("Got message of type: " + parsedMessage.type);
                break;
        }
    });

    // const message = { type: "message", messageString: "Hi from server!" };
    // ws.send(JSON.stringify(message));
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
    rooms[roomID]["tempPlayers"] = [];
    rooms[roomID]["facts"] = {};
    rooms[roomID]["unity"] = ws;
    rooms[roomID]["canJoin"] = true;
    rooms[roomID]["canSubmitFacts"] = false;
    rooms[roomID]["canGuess"] = false;
    updateRoomState(roomID, true, false, false);

    rooms[roomID]["unity"].send(JSON.stringify({ type: "roomCreated", newRoomID: roomID }));
    console.log(rooms);
}

function joinRoom(ws, playerName, newID) {
    for (const [key, value] of Object.entries(rooms)) {
        if (key == newID) {
            console.log("Server exists!");
            if (rooms[key]["playerNames"].length >= 12) {
                ws.send(JSON.stringify({ type: 'fullServer' }));
                return;
            }
            else if (!rooms[key]["canJoin"]) {
                ws.send(JSON.stringify({ type: 'canJoinFalse' }));
                return;
            }
            rooms[key]["playerNames"].push(playerName);
            // rooms[key]["facts"][rooms[key]["players"].length] = [];
            rooms[key]["facts"][rooms[key]["players"].length] = [
                "A", 1,
                "B", 2,
                "C", 3,
                "D", 4,
                "E", 5,
                "F", 6,
                "G", 7,
                "H", 8,
                "I", 9,
                "J", 10
            ];
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
    updateRoomState(newRoomID, true, false, false);
    console.log(rooms);
}

function updateRoomState(roomID, canJoin, canSubmitFacts, canGuess) {
    rooms[roomID]["canJoin"] = canJoin;
    rooms[roomID]["canSubmitFacts"] = canSubmitFacts;
    rooms[roomID]["canGuess"] = canGuess;
}

function sendUsersToPage(theRoomID, nextPage="index", useParams = false) {
    if (!(theRoomID in rooms)) {
        return;
    }
    rooms[theRoomID]["players"].forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ 
                type: 'redirect', 
                url: `${nextPage}.html`,
                useParams: useParams
            }));
            
            rooms[theRoomID]["players"] = [];
        }
    });
}

function updateFactsList(ws, roomID, playerNum, newFactsList) {
    rooms[roomID]["facts"][playerNum] = newFactsList;
    rooms[roomID]["unity"].send(JSON.stringify({ type: "updateFacts", playerNumber: playerNum, factsList: newFactsList }));
}

function quizButton(theRoomID, playerNum, buttonIndex) {
    rooms[theRoomID]["unity"].send(JSON.stringify({ 
        type: "quizButton", 
        playerNumber: playerNum, 
        playerChoice: buttonIndex
    }));
}

function quizNewRound(theRoomID) {
    console.log("do quiz new round");
    rooms[theRoomID]["players"].forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'newRound' }));
        }
    });
}

app.server = app.listen(port, () => {
    console.log(`Server listening on ws://localhost:${port}`);
});

app.server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});
