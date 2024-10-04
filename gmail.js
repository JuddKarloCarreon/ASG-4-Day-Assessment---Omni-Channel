const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const Imap = require('imap');

function sendEmail(params) {
  // Create a transporter object using Gmail SMTP
  const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
          user: params.gmail, // Your Gmail address
          pass: params.app_pass, // Your Gmail app password
      },
  });

  // Define the email options
  const mailOptions = {
    from: params.gmail,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  };
  ['cc', 'bcc'].forEach((val) => {
    if (params[val] != null && params[val] != '') {
      mailOptions[val] = params[val];
    }
  });
  if (params.attachment) {
    mailOptions['attachments'] = [{
      // Attach a file using base64 content
      filename: params.filename,
      content: params.attachment,
      encoding: 'base64',
    }];
  }

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
          return console.error('Error sending email:', error);
      }
      console.log('Email sent successfully:', info.response);
  });
}

function setupImap(params) {
  const imap = new Imap({
    user: params.gmail,
    password: params.app_pass,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: {
      rejectUnauthorized: false, // Accept self-signed certificates
    },
  });
  return imap;
}

async function getInbox(params) {
  console.log('Fetching inbox');
  let inbox = {};
  const imap = setupImap(params);

  imap.once('ready', () => {
    imap.openBox('INBOX', true, (err, box) => {
      if (err) throw err;

      // Search for all emails
      imap.search(['ALL'], async (err, results) => {
        if (err) throw err;

        if (!results || !results.length) {
          console.log('No emails found.');
          imap.end();
          return;
        }

        results = results.slice(-10);
        results = results.reverse();

        // Fetch the emails
        const fetch = imap.fetch(results, {
          bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
          struct: true
        });

        fetch.on('message', async (msg) => {
          await msg.on('body', async (stream) => {
            let uid = '';
            await msg.once('attributes', (attrs) => {
              uid = attrs.uid;
            });
            const parsed = await simpleParser(stream);
            if (!inbox[uid] && uid !== '') inbox[uid] = { uid };
            if (inbox[uid] && uid != null) {
              if (parsed.from) inbox[uid]['from'] = parsed.from.text;
              if (parsed.to) inbox[uid]['date'] = parsed.date;
              if (parsed.subject) inbox[uid]['subject'] = parsed.subject;
            }
          });
        });
        fetch.once('end', () => {
          imap.end();
          console.log('Done fetching all messages.');
          return;
        });
      });
    });
  });

  // Handle errors
  imap.once('error', (err) => {
    console.log('IMAP Error:', err);
  });

  imap.once('end', () => {
    console.log('Connection closed');
    let keys = Object.keys(inbox);
    keys.forEach((key) => {
      if (Object.keys(inbox[key]).length >= 4) {
        params.socket.emit('receive_inbox_single', inbox[key]);
      }
    });
  });

  // Connect to the IMAP server
  imap.connect();
}

async function viewEmail(params) {
  const imap = setupImap(params);
  let result = {};
  imap.once('ready', () => {
    imap.openBox('INBOX', false, (err) => {
      if (err) throw err;

      // Fetch email by UID
      imap.fetch(params.uid, { bodies: '' }).on('message', (msg) => {
        msg.on('body', (stream) => {
          simpleParser(stream, (err, parsed) => {
            if (err) {
              console.error('Error parsing email:', err);
            } else {
              result['subject'] = parsed.subject;
              result['from'] = parsed.from.text;
              result['to'] = parsed.to.text;
              result['text'] = parsed.text;
              result['html'] = parsed.html;
              if (parsed.attachments.length > 0) {
                result['attachments'] = [];
                parsed.attachments.forEach((attachment) => {
                  result['attachments'].push({
                    filename: attachment.filename
                  });
                });
              }
            }
          });
        });
      }).on('end', () => {
        console.log('Done fetching email');
        imap.end();
      });
    });
  });

  imap.once('error', (err) => {
    console.error('Connection error:', err);
  });

  imap.once('end', () => {
    console.log('Connection closed');
    params.res.send(result);
  });

  // Connect to the IMAP server
  imap.connect();
}

async function getAttachment(params) {
  console.log('Getting Attachment');
  const imap = setupImap(params);
  let result = {};
  imap.once('ready', () => {
    imap.openBox('INBOX', false, (err) => {
      if (err) throw err;

      // Fetch email by UID
      imap.fetch(params.uid, { bodies: '' }).on('message', (msg) => {
        msg.on('body', (stream) => {
          simpleParser(stream, (err, parsed) => {
            if (err) {
              console.error('Error parsing email:', err);
            } else {
              if (parsed.attachments.length > 0) {
                result['attachments'] = [];
                let attachment = parsed.attachments.find(attachment => attachment.filename === params.filename);
                if (attachment) {
                  // Set response headers for downloading the file
                  params.res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
                  params.res.setHeader('Content-Type', attachment.contentType);
                  
                  // Send the attachment data as a response
                  params.res.send(attachment.content);
                };
              }
            }
          });
        });
      }).on('end', () => {
        console.log('Done fetching email');
        imap.end();
      });
    });
  });

  imap.once('error', (err) => {
    console.error('Connection error:', err);
  });

  imap.once('end', () => {
    console.log('Connection closed');
    params.res.send(result);
  });

  // Connect to the IMAP server
  imap.connect();
}

module.exports = { sendEmail, getInbox, viewEmail, getAttachment };