$(document).ready(function () {
  const socket = io();
  const escapeHtml = (html) => {
    return html
      .replace(/&/g, '&amp;')    // Replace & with &amp;
      .replace(/</g, '&lt;')     // Replace < with &lt;
      .replace(/>/g, '&gt;')     // Replace > with &gt;
      .replace(/"/g, '&quot;')   // Replace " with &quot;
      .replace(/'/g, '&#39;');    // Replace ' with &#39; (or &apos;)
  }
  const addEmail = (email) => {
    console.log(email);
    $('#inbox').prepend(`
      <tr class="w-full cursor-pointer click_email" data-uid="${email.uid}">
        <td class="w-1/4">
          ${escapeHtml(email.from)}
        </td>
        <td class="w-1/2">
          ${escapeHtml(email.subject)}
        </td>
        <td class="w-1/4">
          ${escapeHtml(email.date)}
        </td>
      </tr>
    `);
  };

  $( "#tabs" ).tabs();

  socket.on('connect', function () {
    socket.emit('go_online', {type: 'email'});
  });
  socket.on('receive_inbox_single', (data) => { addEmail(data) });

  $('#inbox').on('click', '.click_email', function () {
    $('#container .click_email').removeClass('bg-blue-300');
    $(this).addClass('bg-blue-300');

    let uid = $(this).attr('data-uid');
    const card = (content) => {
      return `<a href="/attachment/email/${content.uid}/${content.name}" class="border-0 rounded-md bg-blue-400 p-1 inline-block mx-1" target="_blank">${content.name}</a>`;
    };

    $.get('/get_email', { uid }, function (res) {
      $('#from_email').text('From: ' + res.from);
      $('#to_email').text('To: ' + res.to);
      $('#subject_email').text('Subject: ' + res.subject);
      $('#html_email').html(res.html);
      let attachments = '';
      res.attachments.forEach((attachment) => {
        attachments += card({ uid, cid: attachment.cid, name: attachment.filename });
      });
      $('#preview').html(attachments);
    });
    $("#tabs").tabs("option", "active", 1);
  });
  $('#attachment').on('change', function () {
    console.log('change');
    const card = (content) => {
      let url = URL.createObjectURL(content);
      return `<a href="${url}" class="border-0 rounded-md bg-blue-400 p-1" target="_blank">${content.name}</a>`;
    };

    const files = $('#attachment')[0].files;
    const preview = $('#compose_preview');
    const preview_content = $('#compose_preview_content');
    
    preview_content.html('');
    preview.addClass('hidden');

    if (files.length != 0) {
      console.log('file');
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
  $('form').on('submit', function (e) {
    e.preventDefault();

    let message = $('#email_content').html();
    let text = $('#email_content').text();
    let attachment = $('#attachment').val();
    let fileInput = $('#attachment')[0];
                
    let formData = new FormData();
    formData.append('html', message);
    formData.append('text', text);
    formData.append('subject', $('#subject').val());
    formData.append('to', $('#recepient_email').val());
    if ($('#cc').val() !== '') formData.append('cc', $('#cc').val());
    if ($('#bcc').val() !== '') formData.append('bcc', $('#bcc').val());

    if (fileInput.files.length > 0) {
      formData.append('attachment', fileInput.files[0]); // Append file
    }

    if (message != '' || attachment != '') {
      $.ajax({
        url: '/send_email', // Your server endpoint
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
    $('#email_content').html('');
    $('#subject').val('');
    $('#recepient_email').val('');
    $('#cc').val('');
    $('#bcc').val('');
  });
  $('#font-family, #font-size').on('change', function () {
    console.log($(this).prop('id'));
    let selectedText = getSelectionText();
    let fontFamily = $('#font-family').val();
    let fontSize = $('#font-size').val();
    if (selectedText) {
      let modifiedText = ($(this).prop('id') === 'font-family' || $(this).prop('id') === 'font-size') ?
          `<span style="font-family: ${fontFamily}; font-size: ${fontSize}">${selectedText}</span>` :
        ($(this).prop('id') === 'bold') ?
          `<b>${selectedText}</b>` :
        ($(this).prop('id') === 'italic') ?
          `<i>${selectedText}</i>` :
          `<u>${selectedText}</u>`;
      modifySelectedText(modifiedText);
    }
  });
  $('#bold, #italic, #underline').on('mousedown', function (e) {
    e.preventDefault(); // Prevent button click from deselecting text
  });
  $('#bold, #italic, #underline').on('click', function () {
    console.log($(this).prop('id'));
    let selectedText = getSelectionText();
    console.log('sel', selectedText);
    if (selectedText) {
      let modifiedText = ($(this).prop('id') === 'bold') ?
          `<b>${selectedText}</b>` :
        ($(this).prop('id') === 'italic') ?
          `<i>${selectedText}</i>` :
          `<u>${selectedText}</u>`;
      console.log('mod', modifiedText);
      modifySelectedText(modifiedText);
    }
  });
  function getSelectionText() {
    let text = '';
    if (window.getSelection) {
        text = window.getSelection().toString();
    } else if (document.selection && document.selection.type != 'Control') {
        text = document.selection.createRange().text;
    }
    return text;
  }

  function modifySelectedText(newContent) {
    console.log(newContent);
    let range;
    if (window.getSelection) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
        range.deleteContents();

        // Create a new element with the new content
        const elem = $(`<div></div>`).html(newContent)[0].firstChild;

        // Insert the new content
        range.insertNode(elem);

        // Clear the selection
        selection.removeAllRanges();
      }
    }
  }
});