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

//handles removing username from app
const leaveApp = data => {
    
    let app = AppMap[data.id];
    delete app.members[app.members.indexOf(data.username)];
    UserApps[data.username].splice(UserApps[data.username].indexOf(app.id));
    switch (app.type) {
        
        case 'chat' :

            //tells all remaining members to remove user
            for (let i in app.members) {
                io.to(UserMap[app.members[i]]).emit(data.id + "leave", data.username);
            }
            break;
        
        case 'doc' :
            
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
    if (app.members.length === 0){
        delete AppMap[data.id];
    }

};

const emitToUserMap = (type, msg) => {
    for (let key in UserMap) {
        io.to(UserMap[key]).emit(type, msg);
    }
};

const pushToUserMap = (username, id) => {
    
    emitToUserMap('user_login', username);
    
    UserMap[username] = id;
    
    io.to(id).emit('login_hide');

    io.to(id).emit('lobby_show');
    
    io.to(id).emit('set_login_list', Tools.getList(UserMap));
    
    emitToUserMap('global_chat',`User '${username}' has logged in.`);

};

io.on('connection', socket => {
    console.log('User connected');

    //variables specific to client that has connected
    let id = socket.id;
    let username = '';
    
    socket.on('log', msg => {
        console.log(msg);
    });
    
    socket.on('self', emit => socket.emit(emit.type, emit.data));
    
    socket.on('get_name', () => socket.emit('get_name', username));
    
    socket.on('register', data => {
        
        data.password = Tools.hash(data.password);

        if (data.username === '')
            socket.emit('popup', {
                title: 'Bad Username',
                text: 'Please enter a username to register'
            });
        else if (data.username.length > 12)
            socket.emit('popup', {
                title: 'Bad Username',
                text: 'Please enter a username to register'
            });
            
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
    
    socket.on('global_chat', msg => emitToUserMap('global_chat',`${username}: ${msg}`));
    
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
    
    socket.on('chat_room_msg', data => {
        let room = AppMap[data.id];
        for (let index in room.members) {
            io.to(UserMap[room.members[index]]).emit(data.id, `${username}: ${data.input}`);
        }
    });
    
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

    
    
    
    socket.on('make_special', chatId => {
        
        let copy = JSON.parse(JSON.stringify(AppMap[chatId]));
        let app = new Constructors.SpecialGame(copy);
        
        AppMap[app.id] = app;
        for (let i in app.members) {
            io.to(UserMap[app.members[i]]).emit('launch', app);
        }
        
    });
    
    
    
    socket.on('update_doc', data => {
        let app = AppMap[data.id];
        for (let i in app.members) {
            io.to(UserMap[app.members[i]])
                .emit(app.id, {text:data.text, position:data.position});
        }
    });
    
    socket.on('save_doc', data => {
        Docs.save({
            filename:data.filename,
            user:username,
            text:data.text
        }, () => {
            Docs.getAllFilenames(username,array=> socket.emit('doc_names',array));
            socket.emit(data.id+'title', data.filename)
        });
    });
    
    socket.on('load_doc', data => {
        Docs.getOneDoc(username, data.name, text => {
            socket.emit(data.appId+'title', data.name);
            let app = AppMap[data.appId];
            for (let i in app.members)
                io.to(UserMap[app.members[i]])
                    .emit(app.id, {text, position:0});
        });
    });
    
    socket.on('delete_doc', title => {
        Docs.remove({filename:title,user:username},() => {
            Docs.getAllFilenames(username,array=> socket.emit('doc_names',array));
        })
    });

    socket.on('start_connect_4', chatId => {

        let copy = JSON.parse(JSON.stringify(AppMap[chatId]));
        let app = new Constructors.ConnectFour(copy);

        AppMap[app.id] = app;

        app.game = new GameConstructors.ConnectFour(result => {
            for (let i = 1; i < app.members.length; i++)
                app.nextTurn();
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

    socket.on('task_click', type => socket.emit('task_'+ type));
    
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

server.listen(port, () => console.log(`Listening on port ${port}`));