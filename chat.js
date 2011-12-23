var app = require('http').createServer(handler), io = require('socket.io')
    .listen(app), fs = require('fs');

app.listen(3000);

function handler(req, res) {
  fs.readFile(__dirname + '/index.html', function(err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
  });
};

// Attach basic socket event listeners
io.sockets.on("connection", function(client) {
  client.user = new User(client);
  client.on("message", function(data) {
    data = JSON.parse(data);
    Commands.parse(client.user, room, data);
  });

  client.on("disconnect", function() {
    Commands.leave(client.user, room, {});
  });
});

// A simple user object
var User = function(client) {
  this.name = null;
  this.client = client;
};

User.prototype = {
  setName : function(name, room) {
    if (!name || name.length < 3)
      return {
        result : "invalid",
        message : "Name must be 3 characters or longer."
      };
    if (!name || name.replace(/^\w+$/g, "") != "")
      return {
        result : "invalid",
        message : "Only letters, numbers, and _ are allowed."
      };
    if (room.getUser(name))
      return {
        result : "invalid",
        message : "That name is taken."
      };
    if (this.name)
      return {
        result : "error",
        message : "Can't change name!"
      };
    this.name = name;
    return {
      result : "succcess"
    };
  },

  send : function(data) {
    this.client.send(data);
  },

  // Send a message to a single user
  sendMessage : function(data) {
    var msg = JSON.stringify(data);
    this.send(msg);
  }
};

exports.User = User;

// A list of users, with appropriate methods
var Room = function() {
  this.users = {};
};

Room.prototype = {

  // Add a new user to the room
  addUser : function(user) {
    this.users[user.name] = user;
    return true;
  },

  // Checks to see if a user exists
  getUser : function(name) {
    var user = this.users[name];
    if (user && user.name) {
      return user;
    }
    ;
  },

  // Pull a user from the object
  removeUser : function(user) {
    this.users[user.name] = null;
    return true;
  },

  // Return all valid users
  allUsers : function() {
    var users = [];
    for (attr in this.users) {
      if (!this.users.hasOwnProperty(attr))
        continue;
      var user = this.getUser(attr);
      if (user && user.name) {
        users.push(user);
      }
    }
    return users;
  },

  // Send a message to all users in this list
  sendToAll : function(data) {
    var msg = JSON.stringify(data);
    var users = this.allUsers();
    for ( var i = 0; i < users.length; i++) {
      user = users[i];
      user.send(msg);
    }
  }

};

exports.Room = Room;

var room = new Room();

// The list of interface commands the server can send / receive
var Commands = {

  // Broadcast a chat message (may be a 'private' broadcast)
  broadcast : function(user, room, data) {
    data = {
      command : "broadcast",
      message : data.message,
      name : user.name
    };
    room.sendToAll(data);
  },

  // Send an error to a single user
  error : function(user, message) {
    var data = {
      name : user.name,
      message : message,
      command : "error"
    };
    user.sendMessage(data);
  },

  // A user requested an invalid name
  invalidName : function(user, message) {
    data = {
      command : "invalidName",
      name : user.name,
      message : message
    };
    user.sendMessage(data);
  },

  // A user has 'joined' a room (valid name)
  join : function(user, room, data) {
    room.addUser(user);
    data = {
      command : "join",
      name : user.name
    }
    room.sendToAll(data);
  },

  // A user has left a room (DCed, etc.)
  leave : function(user, room, data) {
    data = {
      command : "leave",
      name : user.name
    }
    if (!room) {
      util.log("No room for user?");
      return;
    }
    var result = room.removeUser(user);
    if (result)
      room.sendToAll(data);
  },

  // A user has requested a list of users in the room
  users : function(user, room, data) {
    userData = [];
    users = room.allUsers();
    for ( var i = 0; i < users.length; i++) {
      userData.push({
        name : users[i].name
      });
    }
    data = {
      command : "users",
      users : userData
    }
    user.sendMessage(data);
  },

  // The request commands (from a user)
  commands : {

    // A user is submitting a name for the room
    name : function(user, room, data) {
      var res = user.setName(data.name, room);
      if (res.result == "invalid") {
        return Commands.invalidName(user, res.message);
      } else if (res.result == "error") {
        return Commands.error(user, res.message);
      }

      Commands.join(user, room, data);
    },

    // A user has submitted a message
    chat : function(user, room, data) {
      Commands.broadcast(user, room, data);
    },

    // A user has requested a list of users
    users : function(user, room, data) {
      Commands.users(user, room, data);
    },

    // A user quits the channel nicely
    quit : function(user, room, data) {
      Commands.leave(user, room, data);
    }

  },

  // Parse a requested command
  parse : function(user, room, data) {
    if (Commands.commands.hasOwnProperty(data.command)) {
      Commands.commands[data.command](user, room, data);
    } else {
      Commands.error(user, "Unknown command: " + data.command);
    }
  }

};