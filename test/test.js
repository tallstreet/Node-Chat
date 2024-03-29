var vows = require('vows'), assert = require('assert');

var chat = require('../chat');

var User = chat.User, Room = chat.Room, Commands = chat.Commands;

var MockSocket = function() {
    this.data = null;
}
 
MockSocket.prototype = {
    send: function  (data) {
      this.data = data;
    }
};

var client = new MockSocket();
vows.describe('Chat').addBatch({
  'A username' : {
    topic : function() {
      var user = new User();
      var room = new Room();
      return {
        user : user,
        room : room
      };
    },
    'must be more then 3 characters' : function(result) {
      assert.deepEqual(result.user.setName("ab", result.room), {
        result : "invalid",
        message : "Name must be 3 characters or longer."
      });
      assert.deepEqual(result.user.setName("", result.room), {
        result : "invalid",
        message : "Name must be 3 characters or longer."
      });
    },
    'can only contain numbers and letters' : function(result) {
      assert.deepEqual(result.user.setName("_abc def", result.room), {
        result : "invalid",
        message : "Only letters, numbers, and _ are allowed."
      });
      assert.deepEqual(result.user.setName("#abcdef", result.room), {
        result : "invalid",
        message : "Only letters, numbers, and _ are allowed."
      });
      assert.deepEqual(result.user.setName("abcdef$", result.room), {
        result : "invalid",
        message : "Only letters, numbers, and _ are allowed."
      });
    },
    'can\'t be changed' : function(result) {
      result.user.setName("_abcdef", result.room);
      assert.deepEqual(result.user.setName("_abcdefg", result.room), {
        result : "error",
        message : "Can't change name!"
      });
    }
  }, 
  'A username' : {
    topic : function() {
      var user = new User();
      var room = new Room();
      user.setName("abcdef", room);
      room.addUser(user);
      user = new User();
      return {
        user : user,
        room : room
      };
    },
    'must be unique' : function(result) {
      assert.deepEqual(result.user.setName("abcdef", result.room), {
        result : "invalid",
        message : "That name is taken."
      });
    }
  }, 
  'A room' : {
    topic : function() {
      var user = new User();
      var room = new Room();
      user.setName("abcdef", room);
      return {
        user : user,
        room : room
      };
    },
    'can add users' : function(result) {
      assert.isTrue(result.room.addUser(result.user));
    },
    'can get user' : function(result) {
      assert.strictEqual(result.room.getUser(result.user.name), result.user);
    },
    'can remove user' : function(result) {
      assert.isTrue(result.room.removeUser(result.user));
    },
    'can get users list' : function(result) {
      var user1 = new User();
      user1.setName("abcdef", result.room);
      result.room.addUser(user1);
      assert.deepEqual(result.room.allUsers(), [user1]);
      user2 = new User();
      user2.setName("abcdefg", result.room);
      result.room.addUser(user2);
      assert.deepEqual(result.room.allUsers(), [user1, user2]);
      result.room.removeUser(user1);
      assert.deepEqual(result.room.allUsers(), [user2]);
    }
  }, 
  'A command' : {
    topic : function() {
      var user = new User(client);
      var room = new Room();
      return {
        user : user,
        room : room
      };
    },
    'bad command gives error' : function(result) {
      Commands.parse(result.user, result.room, {command: "badcommand"});
      assert.deepEqual(JSON.parse(client.data), {name:null,message:"Unknown command: badcommand",command:"error"});
    },
    'can\'t send without name' : function(result) {
      Commands.parse(result.user, result.room, {command: "chat", message: "test"});
      assert.deepEqual(JSON.parse(client.data), {name:null,message:"Unknown command: badcommand",command:"error"});
    },
    'bad send sends' : function(result) {
      Commands.parse(result.user, result.room, {command: "name", name: "abcde"});
      assert.deepEqual(JSON.parse(client.data), { command: 'join', name: 'abcde' });
    },
    'can chat' : function(result) {
      Commands.parse(result.user, result.room, {command: "chat", message: "test"});
      assert.deepEqual(JSON.parse(client.data), {name:"abcde",message:"test",command:"broadcast"});
    },
    'new users can join' : function(result) {
      var client2 = new MockSocket();
      var user2 = new User(client2);
      Commands.parse(user2, result.room, {command: "name", name: "abcdef"});
      assert.deepEqual(JSON.parse(client.data), { command: 'join', name: 'abcdef' });
      assert.deepEqual(JSON.parse(client2.data), { command: 'join', name: 'abcdef' });
    },
    'new users can join and chat' : function(result) {
      var client2 = new MockSocket();
      var user2 = new User(client2);
      Commands.parse(user2, result.room, {command: "name", name: "abcdefg"});
      assert.deepEqual(JSON.parse(client.data), { command: 'join', name: 'abcdefg' });
      assert.deepEqual(JSON.parse(client2.data), { command: 'join', name: 'abcdefg' });
      Commands.parse(result.user, result.room, {command: "chat", message: "test2"});
      assert.deepEqual(JSON.parse(client.data), {name:"abcde",message:"test2",command:"broadcast"});
      assert.deepEqual(JSON.parse(client2.data), {name:"abcde",message:"test2",command:"broadcast"});
      Commands.parse(user2, result.room, {command: "chat", message: "test3"});
      assert.deepEqual(JSON.parse(client.data), {name:"abcdefg",message:"test3",command:"broadcast"});
      assert.deepEqual(JSON.parse(client2.data), {name:"abcdefg",message:"test3",command:"broadcast"});
    },
    'users can quit' : function(result) {
      var client2 = new MockSocket();
      var user2 = new User(client2);
      Commands.parse(user2, result.room, {command: "name", name: "abcdefgh"});
      Commands.parse(result.user, result.room, {command: "quit"});
      assert.deepEqual(JSON.parse(client2.data), { command: 'leave', name: 'abcde' });
    }
  }
}).export(module); // Export the Suite
