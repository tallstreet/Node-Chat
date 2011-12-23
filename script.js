var app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    fs = require('fs'),
    User = require('./chat').User,
    Room = require('./chat').Room,
    Commands = require('./chat').Commands;


var room = new Room();
app.listen(process.argv[2] || 3000);

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
