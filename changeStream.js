const utils = require("./utils");
const promises = require("./promises");
const request = require("request");
const fetch = require("node-fetch");

const fs = require("fs");
const path = require("path");
const webpush = require("web-push");

var getSubscription = () => {
    return new Promise((resolve, reject) => {
        request
            .get({
                url: "https://localhost:8080/api/getsubscribe"
                /*
                agentOptions: {
                    key: fs.readFileSync(path.resolve("./localhost-key.pem")),
                    cert: fs.readFileSync(path.resolve("./localhost.pem"))
                }
                */
            })
            .on("error", err => {
                reject(err);
            })
            .on("response", response => {
                resolve(response.toJSON());
            });
    });
};

async function formatNotif(change) {
    if (change.ns.coll === "messages") {
        let payload = {
            title: `${change.fullDocument.username} - ${
                change.fullDocument.date
            }`,
            icon: "/images/reply.png",
            body: change.fullDocument.message,
            url: `/thread/${change.fullDocument.thread_id}`
        };
        //console.log(JSON.stringify(notification));

        let pushSubscription = await fetch(
            "https://localhost:8080/api/getsubscribe"
        ).then(response => {
            return response.json();
        });

        //console.log(pushSubscription.body);
        let notification = {
            pushSubscription: pushSubscription.body.subscription,
            payload: JSON.stringify(payload),
            options: pushSubscription.body.vapidKeys
        };
        return notification;
    }
}

async function openStream(user_id) {
    var db = utils.getDb();

    var user = await promises.userPromise(user_id);

    const collection = db.collection("messages");
  
    const thread_changeStream = collection.watch(
        [{ $match: 
            { $and: [
                { 'fullDocument.type': 'reply' },
                { 'fullDocument.thread_id': { $in: user.subscribed_threads }},
                { 'fullDocument.username': { $ne: user.username }}
            ]}
        }]
    );

    thread_changeStream.on("change", async change => {
        var item = {
            _id: change.fullDocument._id,
            thread_id: change.fullDocument.thread_id,
            message: change.fullDocument.message,
            read: false
        };

        await promises.updateUserPromise(user._id, item);
      
        let notification = await formatNotif(change);
        console.log([
            notification.pushSubscription,
            notification.payload,
            {
                vapidDetails: {
                    subject: "https://quiet-brook-91223.herokuapp.com/",
                    publicKey: notification.options.publicKey,
                    privateKey: notification.options.privateKey
                }
            }
        ]);
        let pushed = await webpush
            .sendNotification(
                notification.pushSubscription,
                notification.payload,
                {
                    vapidDetails: {
                        subject: "https://quiet-brook-91223.herokuapp.com/",
                        publicKey: notification.options.publicKey,
                        privateKey: notification.options.privateKey
                    }
                }
            )
            .catch(err => {
                if (err) {
                    return err;
                }
            });

        console.log(pushed);
    });
}

async function closeStream(user_id) {
    var db = utils.getDb();

    var user = await promises.userPromise(user_id);

    const collection = db.collection("messages");

    const thread_changeStream = collection.watch(
        [{ $match: 
            { $and: [
                { 'fullDocument.type': 'reply' },
                { 'fullDocument.thread_id': { $in: user.subscribed_threads }},
                { 'fullDocument.username': { $ne: user.username }}
            ]}
        }]
    );
    thread_changeStream.close();
}

module.exports = {
    open: openStream,
    close: closeStream
};
