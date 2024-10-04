$(document).ready(function () {
  let device;
  
  fetch('/token')
    .then(response => response.text())
    .then(token => {
      // Initialize the Twilio Device
      device = new Twilio.Device(token, {
        debug: true,
      });

      device.on('ready', function() {
        console.log('Twilio Device Ready to make and receive calls');
        $('#status').text('Ready to call.')
        $('#callArea').removeClass('hidden');
      });

      device.on('error', function(error) {
        console.error('Twilio Device Error:', error);
        $('#status').text(`Error: ${error}.\nPlease refresh page.`);
      });

      device.on('incoming', function(call) {
        console.log('Incoming call from:', call.parameters.From);
        if (call.parameters.From === '+12097205069') {
          $('#callingArea').removeClass('hidden');
          $('#hangupButton').prop('disabled', false);
          call.accept();
        } else if (confirm('Accept incoming call from ' + call.parameters.From + '?')) {
          $('#status').text(`Called by: ${call.parameters.From}`);
          call.accept();
          $('#callingArea').removeClass('hidden');
          $('#callArea').addClass('hidden');
          $('#hangupButton').prop('disabled', false);
        } else {
          call.reject();
          $('#callButton').prop('disabled', false);
          $('#callArea').removeClass('hidden');
        }
      });

      device.on('disconnect', function() {
        console.log('Call disconnected');
        $('#status').text('Ready to call.')
        $('#hangupButton').prop('disabled', true);
        $('#callingArea').removeClass('hidden');
        $('#callingArea').addClass('hidden');
        $('#callButton').prop('disabled', false);
        $('#callArea').removeClass('hidden');
      });

      $('#callButton').on('click', async function () {
        console.log('call clicked');
        const phoneNumber = $('#call_number').val();
        const response = await fetch('https://fine-osprey-amazing.ngrok-free.app/call', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ to: phoneNumber }),
        });
        const data = await response.json();
        console.log(data);

        $('#status').text(`Calling: ${$('#call_number').val()}`);
        // $('#callingArea').removeClass('hidden');
        // $('#hangupButton').prop('disabled', false);
        $('#callButton').prop('disabled', true);
        $('#callArea').addClass('hidden');
      });

      $('#hangupButton').on ('click', function (){
        console.log('hangup clicked');
        device.disconnectAll();
        $('#hangupButton').prop('disabled', true);
        $('#callingArea').removeClass('hidden');
        $('#callingArea').addClass('hidden');
        $('#callButton').prop('disabled', false);
        $('#callArea').removeClass('hidden');
      });
    });
});