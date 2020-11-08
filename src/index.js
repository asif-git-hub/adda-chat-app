const express = require("express");
const http = require("http");
const path = require("path");
const {
	generateMessage,
	generateLocationMessage,
} = require("./utils/messages");
const socketio = require("socket.io");
const Filter = require("bad-words");
const {
	getUser,
	getUsersInRoom,
	removeUser,
	addUser,
} = require("./utils/users");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3004;
const publicDir = path.join(__dirname, "/public");

app.use(express.static(publicDir));

io.on("connection", (socket) => {
	console.log("New websocket connection");

	socket.on("join", (options, callback) => {
		const { error, user } = addUser({
			id: socket.id,
			...options,
		});

		if (error) {
			return callback(error);
		}

		socket.join(user.room);

		socket.emit("message", generateMessage("Adda Admin", "Welcome!"));
		socket.broadcast
			.to(user.room)
			.emit(
				"message",
				generateMessage(`${user.username} has joined ${user.room}`)
			);

		io.to(user.room).emit("roomData", {
			room: user.room,
			users: getUsersInRoom(user.room),
		});

		callback();
	});

	socket.on("sendMessage", (msg, callback) => {
		const filter = new Filter();
		const user = getUser(socket.id);

		if (filter.isProfane(msg)) {
			return callback("Profanity not allowed here!");
		}
		io.to(user.room).emit("message", generateMessage(user.username, msg));
		callback();
	});

	socket.on("sendLocation", (location, callback) => {
		const user = getUser(socket.id);

		io.to(user.room).emit(
			"locationMessage",
			generateLocationMessage(
				user.username,
				`https://google.com/maps?q=${location.latitude},${location.longitude}`
			)
		);
		callback();
	});

	socket.on("disconnect", () => {
		const user = removeUser(socket.id);
		if (user) {
			io.to(user.room).emit(
				"message",
				generateMessage("Adda Admin", `${user.username} has left`)
			);

			io.to(user.room).emit("roomData", {
				room: user.room,
				users: getUsersInRoom(user.room),
			});
		}
	});
});

server.listen(port, () => {
	console.info(`Server running on port ${port}`);
});
