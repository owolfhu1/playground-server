//import Deck from "cardgames/Deck";

const MongoClient = require('mongodb').MongoClient;
const DbUrl = "mongodb://orion:pass12@ds117711.mlab.com:17711/heroku_psk3b1p4";

// MongoClient.connect(DbUrl, function(err, db) {
//     if (err) throw err;
//
//
//     let dbo = db.db("heroku_psk3b1p4");
//
//
//     dbo.collection("login").find({}).toArray(function(err, result) {
//         if (err) throw err;
//         console.log(result);
//         db.close();
//     });
//
//     //let myobj = { name: "testname", pass: "testpass" };
//
//     // dbo.collection("login").insertOne(myobj, function(err, res) {
//     //     if (err) throw err;
//     //     console.log("1 document inserted");
//     //     db.close();
//     // });
//
// });



//============= Server ==============//
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const port = process.env.PORT || 4001;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

//============= Maps ==============//

const LoginMap = {};    // username : password
const UserMap = {};     // username : socketId
const AppMap = {};      //   appId : {app object}
const UserApps = {};    // username : [array of app ids]

//load login collection into LoginMap
MongoClient.connect(DbUrl, function(err, db) {
    if (err) throw err;

    //get the database
    let dbo = db.db("heroku_psk3b1p4");

    //find al documents
    dbo.collection("login").find({}).toArray(function(err, result) {
        if (err) throw err;

        //look at each document and add it to LoginMap
        for (let i in result)
            LoginMap[result[i].name] = result[i].pass;

        //close the database
        db.close();

    });

});

//============= Functions ==============//

//takes app id and username, and handles removing username from app
const leaveApp = data => {

    //get the app
    let app = AppMap[data.id];

    //remove user from app
    delete app.members[app.members.indexOf(data.username)];

    //remove app from user's UserApps array
    UserApps[data.username].splice(UserApps[data.username].indexOf(app.id));

    //switch on app.type, handles specific apps differently
    switch (app.type) {

        //chat room
        case 'chat' :

            //tells all remaining members to remove user
            for (let i in app.members) {
                io.to(UserMap[app.members[i]]).emit(data.id + "leave", data.username);
            }
            break;

        //shared doc
        case 'doc' :

            //get the chat associated with document
            let chat = AppMap[app.chatId];

            //tell chat members user has closed document
            for (let i in app.members) {
                if (chat.members.indexOf(app.members[i]) > -1)
                    io.to(UserMap[app.members[i]])
                        .emit(chat.id, `${data.username} has closed your shared doc.`);
            }
            break;

        //.
        //::..
        //more special cases to go here...
        //::''
        //'

    }

    //if there are no members left in app, delete app
    if (app.members.length === 0){
        delete AppMap[data.id];
    }

};

//sends emit to all users in UserMap
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
const makeId = () => {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                     "abcdefghijklmnopqrstuvwxyz";
    for (let i = 0; i < 8; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
};

//chat room factory
function ChatRoom(id) {
    this.type = 'chat';
    this.id = id;
    this.members = [];
}

//shared document factory
function Doc(chat) {
    this.type = 'doc';
    this.id = makeId();
    this.chatId = chat.id;
    this.members = chat.members;
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

//interaction from clients handled here
io.on('connection', socket => {
    console.log('User connected');

    //variables specific to client that has connected
    let id = socket.id;
    let username = '';

    //just logs a message from the client onto the server for testing
    socket.on('log', msg => {
        console.log(msg);
    });

    //when register is pressed on login component
    socket.on('register', data => {

        // ===== VALIDATION =====
        //user tried to register '', deny
        if (data.username === '') {
            socket.emit('popup', {
                title: 'Bad Username',
                text: 'Please enter a username to register'
            });
            return;
        }
        //username is too long
        if (data.username.length > 12) {
            socket.emit('popup', {
                title: 'Bad Username',
                text: 'Please enter a username to register'
            });
            return;
        }
        //if the username is taken, send a message
        if (data.username in LoginMap) {
            socket.emit('popup', {
                title: 'Username taken',
                text: `Sorry, the username ${data.username} is taken, please try again`
            });
        }

        //otherwise register them
        else
            MongoClient.connect(DbUrl, function(err, db) {

                //if there is an error
                if (err) {

                    //tell the error
                    socket.emit('popup', {
                        title: 'Error!',
                        text: err + "",
                    });

                    //throw it
                    throw err;

                }

                //get the database
                let dbo = db.db("heroku_psk3b1p4");

                //make doc to insert
                let loginDoc = { name: data.username, pass: data.password };

                //function to insert to database
                dbo.collection("login").insertOne(loginDoc, function(err, res) {
                    //if there is an error
                    if (err) {

                        //tell the error
                        socket.emit('popup', {
                            title: 'Error!',
                            text: err + "",
                        });

                        //throw it
                        throw err;

                    }

                    //add data to LoginMap
                    LoginMap[data.username] = data.password;

                    //tell client they have registered
                    socket.emit('popup', {
                        title: 'Successful Registration',
                        text: `Congratulations, you have registered the username ${data.username}. You may now login with it.`
                    });

                    //tell logged in clients a new user has registerd
                    emitToUserMap('global_chat', `New user '${data.username}' has registered.`);

                    //close db
                    db.close();

                });

            });

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
            UserApps[username] = [];
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

    //chat with user
    socket.on('chat_with', name => {

        //if user tries to chat with themself
        if(name === username) {
            socket.emit('popup', {
                title: 'Lonely??',
                text: `Sorry but you can't use my app to chat with yourself.`,
            });
            return;
        }

        //make a room
        let room = new ChatRoom(makeId());

        //add the users
        room.members.push(username);
        room.members.push(name);

        //add the app to the user's app array
        UserApps[username].push(room.id);
        UserApps[name].push(room.id);

        //add room to AppMap
        AppMap[room.id] = room;

        //launch the room to the clients
        socket.emit('launch', room);
        io.to(UserMap[name]).emit('launch', room);

    });

    //sends a message to clients chat rooms
    socket.on('chat_room_msg', data => {
        let room = AppMap[data.id];
        for (let index in room.members) {
            io.to(UserMap[room.members[index]]).emit(data.id, `${username}: ${data.input}`);
        }
    });


    //invites a user to an existing chat
    socket.on('chat_invite', data => {

        //if the name given belongs to a user
        if (data.name in UserMap) {

            //get the chat
            let chat = AppMap[data.id];

            //if user is not already in the chat
            if (chat.members.indexOf(data.name) === -1) {

                //tell clients that user is being added
                for (let i in chat.members)
                    io.to(UserMap[chat.members[i]])
                        .emit(chat.id + 'add', data.name);

                //add them to chat
                chat.members.push(data.name);

                //launch chat to invited user
                io.to(UserMap[data.name]).emit('launch', chat);

            }
        }

    });

    //creates a shared doc for everyone at a table
    socket.on('make_doc', chatId => {
        let app = new Doc(AppMap[chatId]);
        AppMap[app.id] = app;
        for (let i in app.members) {
            io.to(UserMap[app.members[i]]).emit('launch', app);
        }
    });

    //when user types in doc, updates for all members
    socket.on('update_doc', data => {
        let app = AppMap[data.id];
        for (let i in app.members) {
            io.to(UserMap[app.members[i]])
                .emit(app.id, {text:data.text, position:data.position});
        }
    });








    socket.on('close_me', data => {
        socket.emit('close', data.index);
        leaveApp({username:username, id:data.id})
    });

    //handles disconnection
    socket.on('disconnect', () => {
        console.log('user disconnected');

        //if user is logged in
        if (username) {

            //remove them
            delete UserMap[username];

            //tell logged in clients they were removed
            emitToUserMap('user_logout', username);

            for(let i in UserApps[username])
                leaveApp({
                    username:username,
                    id:UserApps[username][i]
                });

            delete UserApps[username];
        }

    });

});

//start listening for connections
server.listen(port, () => console.log(`Listening on port ${port}`));