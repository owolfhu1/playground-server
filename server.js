//server variables
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const port = process.env.PORT || 4001;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);



//============= Maps ==============//
const LoginMap = {}; // username : password
const UserMap = {}; //  username : socketId
const ChatMap = {}; // chatId : {chat object}

//============= Functions ==============//

//sends message to all users in UserMap
const emitToUserMap = (type, msg) => {
    for (let key in UserMap) {
        io.to(UserMap[key]).emit(type, msg);
    }
};

//returns a list of keys in a map
const getList = Map => {
    let list = [];
    for (let key in Map) {
        list.push(key);
    }
    return list;
};

//makes an id..
function makeid() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let i = 0; i < 8; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

function ChatRoom(id) {
    this.type = 'chat';
    this.id = id;
    this.members = [];
    this.text = '';
}

//adds a client to UserMap and handles clients accordingly
const pushToUserMap = (username, id) => {

    //sends user to all currently logged in clients for OnlineList
    emitToUserMap('user_login', username);

    //put user in UserMap
    UserMap[username] = id;

    //hide client's login window
    io.to(id).emit('login_hide');

    //show client's the lobby windows
    io.to(id).emit('lobby_show', username);

    //send client the list of users
    io.to(id).emit('set_login_list', getList(UserMap));

    //send welcome message
    io.to(id).emit('popup', {
        title: 'Login Successful!',
        text: `Welcome to Orion's Playground, I hope you enjoy yourself ${username}.`
    });

    //send user login message to global chat
    emitToUserMap('global_chat',`User '${username}' has logged in.`);

};

//interaction from clients will appear here
io.on('connection', socket => {
    console.log('User connected');

    //variables specific to client that has connected
    let id = socket.id;
    let username = '';

    //just logs a message from the client onto the server
    socket.on('log', msg => {
        console.log(msg);
    });

    //when register is pressed on login component
    socket.on('register', data => {

        //if the username is taken, send a message
        if (data.username in LoginMap)
            socket.emit('popup', {
                title: 'Username taken',
                text: `Sorry, the username ${data.username} is taken, please try again`});

        //otherwise register them
        else {

            //add data to LoginMap
            LoginMap[data.username] = data.password;

            //tell client they have registered
            socket.emit('popup', {
                title: 'Successful Registration',
                text: `Congratulations, you have registered the username ${data.username}. You may now login with it.`
            });

            //tell logged in clients a new user has registerd
            emitToUserMap('global_chat', `New user '${data.username}' has registered.`);
        }

    });

    //attempts to log user in
    socket.on('login', data => {

        //if user is already logged in
        if (data.username in UserMap) {
            socket.emit('popup', {
                title: 'Already Logged In',
                text : `The username ${data.username} is already logged in.`
            });
        }

        //if username doesn't exist
        else if (LoginMap[data.username] == null) {
            socket.emit('popup', {
                title: 'Unknown Username',
                text: `The Username ${data.username} has not been registered. You may`
                +` press register to register and then you will be able to log in`
            });
        }

        //if login information is correct, login
        else if (LoginMap[data.username] === data.password) {
            username = data.username;
            id = socket.id;
            pushToUserMap(username, id);
        }

        //if login information is incorrect
        else
            socket.emit('popup', {
                title: 'Incorrect Login',
                text: `The information you have provided does not match my records, please try again.`
            });

    });

    //global chat gets message and sends out to clients
    socket.on('global_chat', msg => emitToUserMap('global_chat',`${username}: ${msg}`));

    //chat with user TODO
    socket.on('chat_with', name => {
        if(name === username) {
            socket.emit('popup', {
                title: 'Lonely??',
                text: `Sorry but you can't use my app to chat with yourself.`,
            });
            return;
        }

        let room = new ChatRoom(makeid());

        room.members.push(username);
        room.members.push(name);

        ChatMap[room.id] = room;

        socket.emit('launch', room);
        io.to(UserMap[name]).emit('launch', room);


        console.log('chat created!');

    });


    socket.on('chat_room_msg', data => {
        let room = ChatMap[data.id];
        for (let index in room.members) {
            io.to(UserMap[room.members[index]]).emit(data.id, `${username}: ${data.input}`);
        }
    });



    //TODO this should do more then just close,
    //namly send a message to members of the object
    socket.on('close_me', index => {
        socket.emit('close', index);
    });





    //handles disconnection
    socket.on('disconnect', () => {
        console.log('user disconnected');

        //if user is in UserMap (logged in)
        if (username) {

            //remove them
            delete UserMap[username];

            //tell logged in clients they were removed
            emitToUserMap('user_logout', username);

        }

    });

});

//start listening for connections
server.listen(port, () => console.log(`Listening on port ${port}`));