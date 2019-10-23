const express = require('express');
const bodyParser = require('body-parser')
const WebSocket = require('ws');

const app = express();
const wsServer = new WebSocket.Server({ port: 8080, clientTracking: true }, () => {
	console.log("websocket server started on port 8080");
});

// const packer = require('tight-sprite/palletizing');

const uuidv4 = require('uuid/v4');

var _ = require('lodash');

// configure express
var jsonParser = bodyParser.json();
app.use(express.static('public'));


var adminSocket;

app.listen(3000, '0.0.0.0', function(err){
	if(err) {
		throw err;
	}

	console.log('http server started on port 3000');
});

app.post('/broadcast', jsonParser, function(request, response){
	wsServer.broadcast(JSON.stringify(request.body));
	response.writeHead(200);
	response.write('sending broadcast to ' + wsServer.clients.size + ' clients');
	response.send();
});

app.post('/update-layout', jsonParser, function( req, res ){
	var frameLayout = req.body.frameLayout;
	sendLayoutToClients(req.body.srcVideoSize, frameLayout);
})

wsServer.broadcast = function broadcast(data) {
	wsServer.clients.forEach(function each(client) {
		if (client.readyState === WebSocket.OPEN) {
			client.send(data);
		}
	});
};

wsServer.on('connection', function connection(socket) {
	console.log("new connection: " + wsServer.clients.size);
	socket.on('message', function incoming(message) {
		console.log(message);

		if(message == "isAdmin"){
			adminSocket = socket;
			adminSocket.send('success');
			return;
		}
		
		clientDetails = JSON.parse(message);
		// console.log(clientDetails.w);
		// console.log(clientDetails.h);

    // set clientId on client
		clientDetails.clientId = uuidv4();

		clientIdDetails = {
			payload: { 
				action: "setClientId", 
				data: { clientId: clientDetails.clientId }
			}
		}

		clientIdDetailsString = JSON.stringify(clientIdDetails);
		console.log(clientIdDetailsString);
		socket.send(clientIdDetailsString);
		
		socket.details = clientDetails;

		if(adminSocket){
			adminSocket.send(JSON.stringify({ 
				payload: {
					action: "addClient",
					data: clientDetails 
				}
			}))
		}
	});

	socket.on('close', function close(){
		console.log(socket)
		console.log("client closed, current clients: " + wsServer.clients.size);

		if(adminSocket && socket !== adminSocket){
			const disconnectedClientId = this.details.clientId
			adminSocket.send(JSON.stringify({
				payload: {
					action: "removeClient",
					data: disconnectedClientId
				}
			}))
		} else if(adminSocket && socket == adminSocket){
			console.log('admin went away')
		}
	});

	socket.on('pong', keepalive);
});

function sendLayoutToClients(srcVideoSize, frameLayout){
	wsServer.clients.forEach(function each(client) {

		// skip the admin device which has no details set
		if(client.details === undefined){ 
			return;
		}

		var frame = frameLayout.find( frame => {
			return frame.id == client.details.clientId
		})

		if(frame !== undefined && client.readyState === WebSocket.OPEN) {
			msg = { 
				payload: {
					action: "relayout",
					data: {
						frame: frame,
						srcVideoSize: srcVideoSize
					}
				}
			}
			// console.log(msg)
			client.send(JSON.stringify(msg))
		}
	})
}
// function layoutFrames(){
// 	const clientViewports = [...wsServer.clients].map( socket => socket.details );

// 	var packerResult = packer(clientViewports);
// 	console.log(packerResult);

// 	const canvas = { width: packerResult.w, height: packerResult.h };
// 	// console.log("canvas:");
// 	// console.log(canvas);

// 	wsServer.clients.forEach(function each(client) {
// 		if (client.readyState === WebSocket.OPEN) {
// 			// console.log("prepping layout payload for client: ");
// 			// console.log(client);

// 			const rectangle = packerResult.rectangles.filter(rect => rect.clientId === client.details.clientId)[0];

// 			console.log("rectangle:");
// 			console.log(rectangle);

// 			client.send(JSON.stringify({ 
// 				payload: { 
// 					action: "relayout",
// 					data: { canvas: canvas, rectangle: rectangle }
// 				}
// 			}));
// 		}
// 	});
// }

// keepalive

const interval = setInterval(function ping(){
	console.log('pinging for keepalive')
	wsServer.clients.forEach(function each(client){
		if(client.isAlive === false) {
			return client.terminate();
		}

		client.isAlive = false;
		client.ping(noop);
	});
}, 30000);

function noop(){}

function keepalive(){
	this.isAlive = true;
}