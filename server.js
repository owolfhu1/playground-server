//============= Database ==============//

const Login = require('./database/login');
const Docs = require('./database/docs');

//============= Tools ==============//

const Tools = require('./tools/tools');
const Constructors = require('./tools/constructors');
const GameConstructors = require('./games/gameConstructors');

//============= Server ==============//

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const port = process.env.PORT || 4001;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

//============= Maps ==============//

const UserMap = {};     // username : socketId
const AppMap = {};      //    appId : {app object}
const UserApps = {};    // username : [array of app ids]

//============= Functions ==============//

//takes app id and username, and handles removing username from app
const leaveApp = data => {

    //get the app
    let app = AppMap[data.id];

    console.log(app);

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
    io.to(id).emit('set_login_list', Tools.getList(UserMap));

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
        
        //hash the password (more secure than nothing)
        data.password = Tools.hash(data.password);

        // ===== VALIDATION =====
        //user tried to register '', deny
        if (data.username === '')
            socket.emit('popup', {
                title: 'Bad Username',
                text: 'Please enter a username to register'
            });
        //username is too long
        else if (data.username.length > 12)
            socket.emit('popup', {
                title: 'Bad Username',
                text: 'Please enter a username to register'
            });
            
        //otherwise try to register
        else Login.register(data, success => {
        
                //send message based on if registered or not
                socket.emit('popup', success ? {
                    title: 'Successful Registration',
                    text: `Congratulations, you have registered the username ${data.username}. You may now login with it.`
                } : {
                    title: 'Username taken',
                    text: `Sorry, the username ${data.username} is taken, please try another name.`
                });
        
                //if registered let logged in users know
                //and add document to db for them to save docs to
                if (success) {
                    emitToUserMap('global_chat', `New user '${data.username}' has registered.`);
                    Docs.create(data.username);
                }
                
            });

    });

    //attempts to log user in
    socket.on('login', data => {

        //hash the password (more secure than nothing)
        data.password = Tools.hash(data.password);
    
        //if user is already logged in
        if (data.username in UserMap)
            socket.emit('popup', {
                title: 'Already Logged In',
                text : `The username ${data.username} is already logged in.`
            });
        
        //else try to log in
        else {
            
            Login.login(data, (success, msg) => {
        
                //if successful, login
                if (success) {
                    username = data.username;
                    pushToUserMap(username, id);
                    UserApps[username] = [];
                }
        
                //send message generated by database handler
                socket.emit('popup', msg);
        
            });
            
        }

    });

    //global chat gets message and sends out to clients
    socket.on('global_chat', msg => emitToUserMap('global_chat',`${username}: ${msg}`));

    //chat with user
    socket.on('chat_with', name => {

        //if user tries to chat with them self
        if(name === username) {
            socket.emit('popup', {
                title: 'Lonely??',
                text: `Sorry but you can't use my app to chat with yourself.`,
            });
            return;
        }

        //make a room
        let room = new Constructors.ChatRoom();

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

        console.log(data);

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

        //copy chat and use it to make Doc
        let copy = JSON.parse(JSON.stringify(AppMap[chatId]));
        let app = new Constructors.Doc(copy);

        AppMap[app.id] = app;
        for (let i in app.members) {
            io.to(UserMap[app.members[i]]).emit('launch', app);
            Docs.getAllFilenames(app.members[i],array=> io.to(UserMap[app.members[i]]).emit('doc_names',array));
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

    //requests from doc menu to save the document-> sends request to client document window to save doc
    //that then sends the request back to server with document body and title which finaly gets saved
    //TODO: refactor this to do all the work in here and get rid of 'save_doc_to_db' below!!!
    /**can probably refactor by sending a bound function as a prop to doc menu*/
    //so yeah, fix that lazy bum..
    socket.on('save_doc', data => {

        //if invalid title, make title 'untitled'
        if (data.name === '' || data.name === 'name' || data.name.indexOf('.') > -1)
            data.name = 'untitled';

        //sends request back to client
        socket.emit(data.id+'save', data.name);
        
    });
    //gets doc value and title and saves the data at last
    socket.on('save_doc_to_db', data => {

        //saves data
        Docs.save({
            filename:data.filename,
            user:username,
            text:data.text
        }, () => {
            //in callback
            //send file names to client's shared docs
            Docs.getAllFilenames(username,array=> socket.emit('doc_names',array));

            //send title to doc
            socket.emit(data.id+'title', data.filename)
        })
        
    });

    //when client requests to load a document,
    //get the document and send to all doc members.
    socket.on('load_doc', data => {

        //get the document
        Docs.getOneDoc(username, data.name, text => {
            //in callback
            //send title to user
            socket.emit(data.appId+'title', data.name);

            //get the app
            let app = AppMap[data.appId];

            //send loaded data to all doc users
            for (let i in app.members) {
                io.to(UserMap[app.members[i]])
                    .emit(app.id, {text, position:0});
            }

        });

    });

    //client requests to delete a doc, delete it and update menu buttons
    socket.on('delete_doc', title => {
        Docs.remove({filename:title,user:username},() => {
            //send file names to client's shared docs to make buttons
            Docs.getAllFilenames(username,array=> socket.emit('doc_names',array));
        })
    });


    socket.on('start_connect_4', chatId => {

        //copy chat and use it to build connect 4
        let copy = JSON.parse(JSON.stringify(AppMap[chatId]));
        let app = new Constructors.ConnectFour(copy);

        AppMap[app.id] = app;

        //make a new game //handle end of game in callback
        app.game = new GameConstructors.ConnectFour(result => {
            //go back to last turn
            for (let i = 1; i < app.members.length; i++)
                app.nextTurn();

            //send each player a message and close
            for (let m in app.members) {
                let player = app.members[m];
                io.to(UserMap[player]).emit('popup', {
                    title : 'Game Over',
                    text : !result ? 'Looks like no one won this game, nice try everyone!' :
                        app.turn() === player ? 'Congratulations, you have won!' :
                        `Sorry but it looks like ${app.turn()} has won`
                });
                io.to(UserMap[player]).emit(app.id+'close');
            }
        });

        for (let m in app.members) {
            UserApps[app.members[m]].push(app.id);
            io.to(UserMap[app.members[m]]).emit('launch', app);
        }

    });

    socket.on('drop_chip', data => {
        let app = AppMap[data.id];
        if (app.turn() === username)
            app.game.addChip(data.move, (success, board) => {

                if (success) {
                    app.nextTurn();
                    for (let i in app.members)
                        io.to(UserMap[app.members[i]]).emit(app.id, board);
                } else
                    socket.emit('popup', {title:'Bad Move', text:'You can\'t make that move'});

            });
        else
            socket.emit('popup', {title:'Not Your Turn', text:'Please wait! It is not your turn yet.'});

    });


    //closes an app for a client
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

            //for each app the user is using, close it
            for(let i in UserApps[username])
                leaveApp({
                    username:username,
                    id:UserApps[username][i]
                });

            //remove their UserApps map key
            delete UserApps[username];

        }

    });

});

//start listening for connections
server.listen(port, () => console.log(`Listening on port ${port}`));