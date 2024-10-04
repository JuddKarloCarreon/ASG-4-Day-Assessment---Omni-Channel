require('dotenv').config();

const express = require('express');
const session = require('express-session');
const mysql = require('./mysql2-connection.js');
const gmail = require('./gmail.js');
const twilio_functions = require('./twilio-functions.js');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const twilio = require('twilio');
const app = express();
const port = process.env.port;

const online_users = {};

const express_session = session(JSON.parse(process.env.session_config));

const pages = ['login', 'chat', 'email', 'message', 'call'];
const default_page_url = '/chat';
const navbar_links = [
  {
    name: 'Chat',
    link: '/chat'
  },
  {
    name: 'Email',
    link: '/email'
  },
  {
    name: 'Message',
    link: '/message'
  },
  {
    name: 'Call',
    link: '/call'
  },
  {
    name: 'Logout',
    link: '/logout'
  }
];

const checkLogin = (req, res) => {
  if (req.session.user_id == null) {
    res.redirect('/login');
    return false;
  }
  return true;
};

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static( __dirname + "/static" ));
app.use(express_session);

app.set("views", __dirname + "/views");
app.set("view engine", "ejs");

const server = app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      cb(null, 'uploads/'); // Directory to save uploaded files
  },
  filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to filename
  }
});
const upload = multer({ storage });

const io = require('socket.io')(server);
io.engine.use(express_session);

// Automatically create GET for pages
pages.forEach((page) => {
  app.get(`/${page}`, async (req, res) => {
    let go_ahead = true;

    const error = req.session.error || null;
    req.session.error = null;
    let params = { error };

    if (page !== 'login') {
      //check if loggin in when in any page other than the login page
      go_ahead = checkLogin(req, res);
      params['navbar_links'] = navbar_links;
      params['current_page'] = `/${page}`;
    } else if (req.session.user_id) {
      //if in the login page while logged in, automatically log out by destroying session
      req.session.destroy();
    }

    if (page === 'chat') {
      params['users'] = await mysql.getAllOtherUsers(req.session.user_id);
    }

    if (go_ahead) {
      res.render(page, params);
    }
  });
});

app.get('/', (req, res) => {
  let page = (req.session.user_id == undefined) ? '/login' : default_page_url;
  res.redirect(page);
});
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});
app.get('/attachment/:type/:id/:filename?', async (req, res) => {
  let type = req.params.type;
  if (type === 'chat') {
    let file_id = req.params.id;
    let table = req.params.type;
    const result = await mysql.getAttachment({id: file_id, table, user_id: req.session.user_id});
    if (result.length > 0) {
      let attachment = result[0].attachment;
      let filename = result[0].filename;
      let mimetype = result[0].mimetype;
      
      const buffer = Buffer.from(attachment, 'base64');
      // Set headers for file download
      res.set({
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Type': mimetype,
          'Content-Length': buffer.length
      });
  
      // Send the file
      res.send(buffer);
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }
  } else if (type === 'email') {
    let params = await mysql.getGmailCredentials(req.session.user_id);
    params['uid'] = req.params.id;
    params['filename'] = req.params.filename;
    params['res'] = res;
    gmail.getAttachment(params);
  }
  
});
app.get('/get_email', async (req, res) => {
  let params = await mysql.getGmailCredentials(req.session.user_id);
  params['uid'] = req.query.uid;
  params['res'] = res;
  gmail.viewEmail(params);
});
app.get('/token', (req, res) => {
  res.send(twilio_functions.generateAccessToken('browser-client'));
});

app.post('/signin', async (req, res) => {
  const {username, password} = req.body;
  let user = await mysql.validateSignin(username, password);
  if (user.length > 0) {
    req.session.user_id = user[0].id;
    req.session.username = user[0].username;
    res.redirect(default_page_url);
  } else {
    req.session.error = 'Invalid Credentials';
    res.redirect('/login');
  }
});
app.post('/submit_chat', upload.single('attachment'), async (req, res) => {
  let data = req.body;
  let message = [`<p><span>${req.session.username}:</span> ${data.message}</p>`];
  let recepients = [req.session.user_id];
  let recepient = online_users[data.recepient_id];
  let attachment = '';
  let filename = '';
  let mimetype = '';
  let has_attachment = false;
  if (recepient !== undefined) {
    if (recepient.types.includes('chat') && recepient.active.chat == req.session.user_id) {
      recepients.push(data.recepient_id);
    }
  }
  // File is available in req.file
  if (req.file) {
    ({ attachment, filename, mimetype } = toBase64(req.file));
    has_attachment = true;
  }

  const result = await mysql.submitChat({
    from_user_id: req.session.user_id,
    to_user_id: data.recepient_id,
    message: data.message,
    attachment: attachment,
    filename: filename,
    mimetype: mimetype
  });

  let insertId = result.insertId;

  recepients.forEach(recepient => io.to(online_users[recepient].socket_id).emit('update_log', { message, filename, insertId, has_attachment }));
  res.send('success');
});
app.post('/send_email', upload.single('attachment'), async (req, res) => {
  let data = req.body;
  // File is available in req.file

  let params = await mysql.getGmailCredentials(req.session.user_id);
  params['to'] = data.to;
  params['subject'] = data.subject;
  params['html'] = data.html;
  params['text'] = data.text;
  params['cc'] = data.cc;
  params['bcc'] = data.bcc;

  if (req.file) {
    const { attachment, filename, mimetype } = toBase64(req.file);
    params['attachment'] = attachment;
    params['filename'] = filename;
  }

  gmail.sendEmail(params);
});
app.post('/message', (req, res) => {
  let attachments = [];
  let params = {
    from_number: req.body.From,
    message: req.body.Body,
  };

  const numMedia = parseInt(req.body.NumMedia, 10);

  console.log(`Received an SMS from ${params.from_number}: ${params.message}`);

  // Check if there are any media attachments
  if (numMedia > 0) {
    for (let i = 0; i < numMedia; i++) {
      attachments.push(req.body[`MediaUrl${i}`]);
    }
    params['attachment'] = JSON.stringify(attachments);
  }
  io.emit('receive_message', params);

  return mysql.storeMessage(params);
});
app.post('/call', (req, res) => {
  const { to } = req.body;
  twilio_functions.createCall(to, res);
});
app.post('/voice', (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Please hold while we connect your call.');
    twiml.dial().client('browser-client'); // Replace with your client name
    res.type('text/xml');
    res.send(twiml.toString());
});

io.on('connection', function (socket) {
  let user_session = socket.request.session;

  socket.on('go_online', async function (data) {
    if (online_users[user_session.user_id] !== undefined) {
      online_users[user_session.user_id].types.push(data.type);
    } else {
      online_users[user_session.user_id] = {socket_id: socket.id, types: [data.type], active: {}};
    }
    if (data.type === 'email') {
      let gmail_credentials = await mysql.getGmailCredentials(user_session.user_id);
      if (gmail_credentials) {
        gmail_credentials['socket'] = socket;
        gmail.getInbox(gmail_credentials);
      }
    }
  });
  socket.on('disconnect', function () {
    if (online_users[user_session.user_id] !== undefined) {
      io.in(socket.id).disconnectSockets();
      delete online_users[user_session.user_id];
    }
  });
  socket.on('get_full_log', async function (data) {
    let params = {
      table: data.type,
      user_id: user_session.user_id,
      recepient_id: data.recepient_id
    };
    online_users[user_session.user_id].active[data.type] = data.recepient_id;
    let full_log = await mysql.getFullLog(params);
    socket.emit('receive_full_log', { full_log });
  });
  socket.on('send_message', function (data) {
    twilio_functions.sendMessage(data);
  });
});

function toBase64(rawFile) {
  const filePath = rawFile.path; // Path of the uploaded file
  // Convert the file to a Base64 string
  let file = fs.readFileSync(filePath);
  attachment = file.toString('base64');
  filename = rawFile.originalname;
  mimetype = rawFile.mimetype;
  fs.unlinkSync(filePath);
  return { attachment, filename, mimetype };
}

//sample attachment: https://drive.google.com/uc?id=1ZPLTVr10DmacmI6RFAMeKv7PV1e4uIGW