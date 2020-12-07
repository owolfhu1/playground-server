const MongoClient = require('mongodb').MongoClient;
const dbUrl = "mongodb+srv://orion:pass@cluster0.gdt6i.mongodb.net/playground?retryWrites=true&w=majority";

//no callback, should be done once when user registers
const create = user => {
    MongoClient.connect(dbUrl,(err, db) => {
        if (err) throw err;
        let dbo = db.db("playground");
        dbo.collection('docs').insertOne({name: user}, (err,res) => {
           if (err) throw err;
           db.close();
        });
    });
};

// docData = {user:'username', filename:'someName', text: 'content of document'}
const save = (docData, callback) => {
    MongoClient.connect(dbUrl, (err,db) => {
        if (err) throw err;
        let dbo = db.db("playground");
        let toSet = {};
        toSet[docData.filename] = docData.text;
        dbo.collection('docs').updateOne({name:docData.user}, {$set:toSet}, (err,res) => {
            if (err) throw err;
            callback(res.result);
            db.close();
        });
    });
};

//removes a saved doc from user's doc document
const remove = (docData, callback) => {
    MongoClient.connect(dbUrl, (err,db) => {
        if (err) throw err;
        let dbo = db.db("playground");
        let toUnSet = {};
        toUnSet[docData.filename] = 1;
        dbo.collection('docs').updateOne({name:docData.user}, {$unset:toUnSet}, (err,res) => {
            if (err) throw err;
            callback();
            db.close();
        });
    });
};

//gets a document and runs callback(documentText)
const getOneDoc = (name, filename, callback) => {
    MongoClient.connect(dbUrl, (err,db) => {
        if (err) throw err;
        let dbo = db.db("playground");
        dbo.collection('docs').findOne({name}, (err,res) => {
            if (err) throw err;

            //callback results
            callback(res[filename]);
            db.close();
        });
    });
};

//gets list of keys in user's saved doc document and runs callback(arrayOfKeys)
const getAllFilenames = (name, callback) => {
    
    MongoClient.connect(dbUrl, (err,db) => {
        if (err) throw err;
        let dbo = db.db("playground");
        dbo.collection('docs').findOne({name}, (err,res) => {
            if (err) throw err;

            //start with empty array
            let array = [];

            //add each key that isnt _id or name
            for (let key in res)
                if (key !== '_id' && key !== 'name')
                    array.push(key);

            //callback the made array
            callback(array);
            db.close();
        });
    });
    
};

//export functions
module.exports = {create, save, remove, getOneDoc, getAllFilenames};
