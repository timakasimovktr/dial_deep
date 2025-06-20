var user = {
  User: "100",
  Pass: "123456",
  Realm: "192.168.1.147",
  Display: "100",
  WSServer: "ws://192.168.1.147:8088/ws",
};

var socket = new JsSIP.WebSocketInterface(user.WSServer);
var configuration = {
  sockets: [socket],
  realm: user.Realm,
  username: user.User,
  password: user.Pass,
  display_name: user.Display,
  uri: "sip:" + user.User + "@" + user.Realm,
};

var ua = new JsSIP.UA(configuration);
ua.start();

var OPERATOR_TEXT = "1";
var route_filter = "category_1";

