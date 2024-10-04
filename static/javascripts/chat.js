$(document).ready(function () {
  const socket = io();
  const updateLog = (data) => {
    let link = (data.has_attachment) ?
      `<a href="/attachment/chat/${data.insertId}" class="block w-fit border-0 rounded-md bg-blue-400 p-1 w-fit" target="_blank">${data.filename}</a>`
      : '';
    $('#message_area').append(`
      <div>
        ${data.message}
        ${link}
      </div>
    `);
    $('#message_area').scrollTop($('#message_area').height() + $('#message_area')[0].scrollHeight);
  };

  socket.on('connect', function () {
    socket.emit('go_online', {type: 'chat'});
  });
  socket.on('update_log', (data) => updateLog(data));
  socket.on('receive_full_log', function (data) {
    data = data.full_log;
    data.forEach((log) => {
      let params = {
        has_attachment: (log.filename !== '' && log.filename != null) ? true : false,
        insertId: log.id,
        filename: log.filename,
        message: `<p><span>${log.from_username}:</span> ${log.message}</p>`
      };
      updateLog(params);
    });
  });

  $('form').on('submit', function (e) {
    e.preventDefault();

    let message = $(this).find('input[name="message"]').val();
    let attachment = $('#attachment').val();
    let cc = $('#cc').val();
    let bcc = $('#bcc').val();
    let fileInput = $('#attachment')[0];
                
    let formData = new FormData();
    formData.append('message', message);
    formData.append('recepient_id', $('select[name="recepient_id"]').val());
    if (fileInput.files.length > 0) {
      formData.append('attachment', fileInput.files[0]); // Append file
    }
    if (cc !== '') formData.append('cc', cc);
    if (bcc !== '') formData.append('bcc', bcc);
    if (message != '' || attachment != '') {
      $.ajax({
        url: '/submit_chat', // Your server endpoint
        type: 'POST',
        data: formData,
        contentType: false, // Prevent jQuery from setting content type
        processData: false, // Prevent jQuery from processing the data
        success: function(response) {
          $('#response').html('Upload successful! Response: ' + response);
        },
        error: function(jqXHR, textStatus, errorThrown) {
          $('#response').html('Upload failed: ' + textStatus);
        }
      });
    }
    
    $(this).find('input[name="message"]').val('');
    $('#attachment').val('');
    $('#attachment').trigger('change');
  });

  $('#send_to').on('change', function () {
    let recepient_id = $('#send_to').val();
    $('#message_area').html('');
    socket.emit('get_full_log', { recepient_id, type: 'chat' });
  });

  $('#attachment').on('change', function () {
    console.log('change');
    const card = (content) => {
      let url = URL.createObjectURL(content);
      return `<a href="${url}" class="border-0 rounded-md bg-blue-400 p-1" target="_blank">${content.name}</a>`;
    };

    const files = $('#attachment')[0].files;
    const preview = $('#preview');
    const preview_content = $('#preview_content');
    
    preview_content.html('');
    preview.addClass('hidden');

    if (files.length != 0) {
      let link = card(files[0]);
      preview.removeClass('hidden');
      preview_content.append(link);
    }
  });

  $('#remove_upload').on('click', function () {
    const preview = $('#preview');
    const preview_content = $('#preview_content');
    $('#attachment').val('');
    preview_content.html('');
    preview.addClass('hidden');
  });
});