
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , about = require('./routes/about')
  , http = require('http')
  , mysql = require('mysql')
  , path = require('path');

var connection = mysql.createConnection({
  host : 'localhost',
  user : 'root',
  password : '1379qaz1',
  database : 'chat',
});

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('ip', process.env.IP || "192.168.111.254");
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('11Xda355Msx'));
  app.use(express.session());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/about', about.show);
app.get('/users', user.list);

var server = http.createServer(app).listen( function(){
  console.log("Express server listening on " +app.get('ip') + ":" + app.get('port'));
});

connection.connect(function(err){
  if (err) throw err;
});

var usernames = {};
var rooms = new Array();

connection.query('SELECT * FROM rooms', function(err,rows,fields) {
  if(err) throw err;
  console.log("Total of " + rows.length + " found!");
  if(rows.length > 0) {
      for (var i=0; i<rows.length;i++)
      {
        console.log("Adding room " + i + " " + rows[i].roomname)
        rooms[i] = rows[i].roomname;
      }
  }
});

var io = require('socket.io').listen(server);
io.sockets.on('connection', function (socket) {

  var rAddr = socket.handshake.address;
  console.log("Connection established with "+rAddr.address+":"+rAddr.port)
  if(rooms.length > 0)
  {
    socket.emit('updateloginrooms',rooms);
  } else {
    socket.emit('msgclient',"Impossible to find rooms! Please retry later!");
  }

  socket.on('login', function(username,password,room) {
    console.log("Login from " + username + "@" + rAddr.address);
    connection.query('SELECT count(*) as cntRows FROM members WHERE username = ' + connection.escape(username) + ' AND password = ' + connection.escape(password) + '', function(err,rows,fields) {
      if(err) throw err;

      var cntRows = rows[0].cntRows;
      if(cntRows>0) {
        console.log("Login successfull for user " + username + " in room " + room);
        socket.username = username;
        socket.room = room;
        usernames[username] = username;
        socket.join(room);
        socket.emit('updaterooms', rooms, room);
        socket.emit('activateChat', '@', 'You have connected to ' + room);
        socket.broadcast.to(room).emit('updatechat', '@', username + ' has connected');
        io.sockets.emit('updateusers', usernames);
      } else {
        console.log("Login failed!");
      }

    });
  });

  socket.on('sendChat', function(msg) {
    io.sockets.in(socket.room).emit('updatechat', socket.username, msg);
  });

  socket.on('switchRoom', function(newroom){
    socket.leave(socket.room);
    socket.join(newroom)
    socket.emit('updatechat', '@', 'You have connected to ' + newroom);
    socket.broadcast.to(socket.room).emit('updatechat', '@', socket.username + ' has left the room');
    socket.room = newroom;
    socket.broadcast.to(newroom).emit('updatechat','@', socket.username + ' has joined this room');
    socket.emit('updaterooms', rooms, newroom);
  });

});
