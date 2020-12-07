const MongoClient = require('mongodb').MongoClient;
const dbUrl = "mongodb+srv://orion:pass@cluster0.gdt6i.mongodb.net/playground?retryWrites=true&w=majority";

//handles verifying data is correct then runs callback(boolean,message)
const login = (loginData, callback) => {
  
    //default message
    let msg = {
        title: 'Incorrect Login',
        text: `The information you have provided does not match my records, please try again.`
    };

    //boolean tells server if user can login
    let success = false;
    
    //connect to database
    MongoClient.connect(dbUrl,(err, db) => {
        if (err) throw err;
        
        //get database
        let dbo = db.db("playground");
        
        //get the relevant login doc
        dbo.collection("login").findOne({name: loginData.username}, function (err, result) {
            if (err) throw err;
            
            //if username doesn't exist
            if (!result) {
                msg = {
                    title: 'Unknown Username',
                    text: `The Username ${loginData.username} has not been registered. You may`
                    + ` press register to register and then you will be able to log in.`
                };
            }
            
            //if login information is correct, login
            else if (result.pass === loginData.password) {
                success = true;
                msg = {
                    title: 'Login Successful!',
                    text: `Welcome to Orion's Playground, I hope you enjoy yourself ${loginData.username}.`
                };
            }

            //run callback
            callback(success,msg);
            
            //close db
            db.close();
        });
        
    });
    
};

//checks if name is free, registers them if so and runs callback(boolean)
const register = (registrationData, callback) => {
    MongoClient.connect(dbUrl,(err, db) => {
        if (err) throw err;
        
        //get database
        let dbo = db.db("playground");
        
        //check for login doc, if exist then callback(false), otherwise register and callback(true)
        dbo.collection("login").findOne({name: registrationData.username}, function (err, result) {
            if (err) throw err;

            //if no document found, register and callback(true)
            if (!result) {
                dbo.collection('login').insertOne({name: registrationData.username, pass: registrationData.password}, (err,res) => {
                    if (err) throw err;
                    callback(true);
                    db.close();
                });

            //if a document is found, callback(false)
            } else {
                callback(false);
                db.close();
            }
        });
        
    });
    
};

//export functions
module.exports = {login, register};

