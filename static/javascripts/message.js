$(document).ready(function () {
  const socket = io();

  socket.on('connect', function () {
    socket.emit('go_online', {type: 'sms'});
  });
  socket.on('receive_message', (data) => {
    console.log('received message');
    let message = `${data.from_number}: ${data.message}`;
    let links = [];
    if (data.attachment) {
      let attachments = JSON.parse(data.attachment);
      message += "\n\nLinks:";
      attachments.forEach((attachment) => {
        let link = `<a href="${attachment}">${attachment}</a>`;
        links.push(link);
        message += `${link}\n`;
      });
    }
    $('#message_area').append(`<div class="mb-1">${message}</div>`);
  });

  $('form').on('submit', function (e) {
    e.preventDefault();

    let message = $('#message').val();
    console.log(message);
    let attachment = $('#attachment').val();
    let to = $('#to').val();

    if ((message != '' || attachment != '') && to != '') {
      socket.emit('send_message', { to, message, attachment });
    }
    
    $('#message').val('');
    $('#attachment').val('');
  });
});