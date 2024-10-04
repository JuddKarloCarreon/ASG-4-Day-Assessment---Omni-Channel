require('dotenv').config();

const twilio = require('twilio');
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

// Replace with your Twilio Account SID and Auth Token
const accountSid = process.env.accountSid; 
const authToken = process.env.authToken; 
const apiKey = process.env.apiKey;
const apiSecret = process.env.apiSecret;
const appSid = process.env.appSid;

const client = twilio(accountSid, authToken);

const sendMessage = async (params) => {
  let new_params = {
    to: params.to,
    body: params.message,
    from: '+12097205069',
  };
  console.log(new_params);
  if (params.attachment) new_params['mediaUrl'] = [params.attachment];
  try {
    client.messages
    .create(new_params)
    .then(message => console.log('SMS Sent. ' + message.sid));
  } catch (error) {
    console.error(`Error sending message: ${error}`);
  }
};

const createCall = (to, res) => {
  client.calls
    .create({
        to: to,
        from: '+12097205069',
        url: 'https://fine-osprey-amazing.ngrok-free.app/voice' // Replace with your ngrok URL
    })
    .then(call => res.status(200).json(call))
    .catch(err => res.status(500).json({ error: err.message }));
}

const generateAccessToken = (identity) => {
  const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: appSid,
      incomingAllow: true, // Allow the client to receive incoming calls
  });

  const token = new AccessToken(accountSid, apiKey, apiSecret, {identity: identity});
  token.addGrant(voiceGrant);

  return token.toJwt();
}

module.exports = { sendMessage, createCall, generateAccessToken };