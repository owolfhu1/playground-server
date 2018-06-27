const MongoClient = require('mongodb').MongoClient;
const dbUrl = "mongodb://orion:pass12@ds117711.mlab.com:17711/heroku_psk3b1p4";

const login = (loginData, callback) => {
  
    //default message
    let msg = {
        title: 'Incorrect Login',
        text: `The information you have provided does not match my records, please try again.`
    };
    
    let success = false;
    
    //connect to database
    MongoClient.connect(dbUrl,(err, db) => {
        if (err) throw err;
        
        //get database
        let dbo = db.db("heroku_psk3b1p4");
        
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
    
            callback(success,msg);
            
            //close db
            db.close();
        });
        
    });
    
};

const register = (registrationData, callback) => {
    MongoClient.connect(dbUrl,(err, db) => {
        if (err) throw err;
        
        //get database
        let dbo = db.db("heroku_psk3b1p4");
        
        //check for login doc, if exist then callback(false), otherwise register and callback(true)
        dbo.collection("login").findOne({name: registrationData.username}, function (err, result) {
            if (err) throw err;
            if (!result) {
                dbo.collection('login').insertOne({name: registrationData.username, pass: registrationData.password}, (err,res) => {
                    if (err) throw err;
                    callback(true);
                    db.close();
                });
            } else {
                callback(false);
                db.close();
            }
        });
        
    });
    
};

module.exports = {
    login : login,
    register : register
};

