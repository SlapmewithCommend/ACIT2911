const express = require("express");
var utils = require("./utils");

var router = express.Router();

router.post("/saveUser", saveUser);

module.exports = router;

function saveUser(request, response) {
    var email = request.body.email;
    var username = request.body.username;
    var password = request.body.password;

    var db = utils.getDb();

    var query = {
        $or: [{ email: email }, { username: username }]
    };

    db.collection("users")
        .find(query)
        .toArray((err, result) => {
            if (result.length > 0) {
                setTimeout(function() {
                    return response.redirect("/registration");
                }, 2500);
            } else if (result.length == 0) {
                db.collection("users").insertOne(
                    {
                        email: email,
                        username: username,
                        password: password,
                        settings: {
                            showEmail: false,
                            showName: false,
                            enableNotifs: false
                        }
                    },
                    (err, result) => {
                        if (err) {
                            response.send("Unable to register user");
                        }
                        response.redirect("/login");
                    }
                );
            }
        });
}
