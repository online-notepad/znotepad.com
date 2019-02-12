const mongoose = require('mongoose');
const chalk = require('chalk');
const connected = chalk.bold.cyan;
const error = chalk.bold.yellow;
const disconnected = chalk.bold.red;
const termination = chalk.bold.magenta;

mongoose.Promise = global.Promise;

const HOST = process.env.DB_HOST || 'localhost';
const PORT = process.env.DB_PORT || 27017;
const DATABASE = process.env.DB_DATABASE || 'znotepad_web';
const AUTH_DB = process.env.DB_AUTH || 'znotepad_web';

const URIConnection = `mongodb://${HOST}:${PORT}/${DATABASE}?authSource=${AUTH_DB}`;

const options = {
    auth: {
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD
    },
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    autoIndex: false, // Don't build indexes
    autoReconnect: true,
    reconnectTries: Number.MAX_VALUE, // Never stop trying to reconnect
    reconnectInterval: 1000, // Reconnect every 1000ms
    poolSize: 10, // Maintain up to 10 socket connections
    // If not connected, return errors immediately rather than waiting for reconnect
    bufferMaxEntries: 0,
    connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    family: 4, // Use IPv4, skip trying IPv6
    keepAlive: true,
    keepAliveInitialDelay: 300000
};

const db = mongoose.connection;

db.on('connecting', () => {
    console.log('connecting to MongoDB...');
});

db.once('open', () => {
    console.log('MongoDB connection opened!');
});

db.on('reconnected', () => {
    console.log('MongoDB reconnected!');
});

db.on('connected', () => {
    console.log(connected("Mongoose default connection is open to ", URIConnection));
});

db.on('error', (err) => {
    console.error(error("Mongoose default connection has occurred " + err + " error"));
    // mongoose.disconnect();
});

db.on('disconnected', () => {
    console.log(disconnected("Mongoose default connection is disconnected"));
});

mongoose.connect(URIConnection, options)
    .then(() => console.info('connection successful'))
    .catch((error) => console.error(error));

process.on('SIGINT', () => {
    db.close(() => {
        console.log(termination("Mongoose default connection is disconnected due to application termination"));
        process.exit(0)
    });
});